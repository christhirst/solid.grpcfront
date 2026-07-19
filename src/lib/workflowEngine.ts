import get from "lodash.get";
import { getDb } from "~/lib/db";
import { executeGrpcCall } from "~/lib/grpcExecutor";
import { parseProtoContent } from "~/lib/protoParser";
import { RecordId } from "surrealdb";
import * as Sentry from "@sentry/node";

async function getStepAuthHeader(step: any, db: any): Promise<string | undefined> {
  const authType = step.authType || "none";
  if (authType === "basic" && (step.authUsername || step.authPassword)) {
    const auth = Buffer.from(`${step.authUsername || ""}:${step.authPassword || ""}`).toString("base64");
    return `Basic ${auth}`;
  }
  
  if (authType === "oauth" && step.connectionId) {
    console.log(`[STEP AUTH] Fetching connection details for ID: ${step.connectionId}`);
    try {
      const connDbId = step.connectionId.includes(":") ? step.connectionId.split(":")[1] : step.connectionId;
      const connRecord = await db.select(new RecordId("connection", connDbId));
      const connection = Array.isArray(connRecord) ? connRecord[0] : connRecord;
      
      if (connection) {
        console.log(`[STEP AUTH] Executing REST auth call for connection: ${connection.name}`);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (connection.headers) {
           try {
              const parsedHeaders = JSON.parse(connection.headers);
              Object.assign(headers, parsedHeaders);
           } catch (e) {
              console.error(`[STEP AUTH] Failed to parse custom headers for connection:`, e);
           }
        }

        if (connection.authScheme === "basic" && (connection.username || connection.password)) {
          const auth = Buffer.from(`${connection.username || ""}:${connection.password || ""}`).toString("base64");
          headers["Authorization"] = `Basic ${auth}`;
        } else if (connection.authScheme === "bearer" && connection.bearerToken) {
          headers["Authorization"] = `Bearer ${connection.bearerToken}`;
        }

        let authUrl = connection.url || "";
        if (authUrl && !authUrl.startsWith("http://") && !authUrl.startsWith("https://")) {
          const separator = authUrl.startsWith("/") ? "" : "/";
          const port = process.env.PORT || 3000;
          authUrl = `http://127.0.0.1:${port}${separator}${authUrl}`;
        }

        const res = await fetch(authUrl, {
          method: connection.method || "POST",
          headers,
          body: connection.method !== "GET" ? (connection.body || "{}") : undefined,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        const authData = await res.json();
        const token = get(authData, connection.tokenPath || "access_token");
        if (!token) {
          throw new Error(`Token not found at JSON path '${connection.tokenPath || "access_token"}'`);
        }
        return `Bearer ${token}`;
      } else {
        throw new Error(`Connection ${step.connectionId} not found in database`);
      }
    } catch (err: any) {
      throw new Error(`Step Connection Setup Error: ${err.message}`);
    }
  }
  
  return undefined;
}

export interface WorkflowStep {
  id: string;
  type?: "grpc" | "table" | "chart" | "database" | "rest";
  databaseName?: string; // target dynamic DB for 'database' step type
  databaseUrl?: string;
  databaseUser?: string;
  databasePass?: string;
  databaseNs?: string;
  serviceName?: string;
  methodName?: string;
  restUrl?: string;
  restMethod?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  requestBodyTemplate?: string; // JSON string for grpc, SurrealQL template for database
  headersTemplate?: string; // JSON string with {{ }} templates
  serverAddress?: string; // Optional override
  useTls?: boolean; // Optional override
  dataPath?: string;   // lodash path to drill into nested array e.g. "shares"
  xKey?: string;       // property for X axis
  yKey?: string;       // property for Y axis
  chartType?: "bar" | "line"; // chart rendering type
  columns?: string[];  // optional explicit columns for table step
  authType?: "none" | "basic" | "oauth";
  authUsername?: string;
  authPassword?: string;
  connectionId?: string;
}

export interface AuthConfig {
  type: "grpc" | "rest" | "static";
  // gRPC specific
  serviceName?: string;
  methodName?: string;
  requestTemplate?: string;
  // REST specific
  url?: string;
  method?: string;
  body?: string;
  
  authScheme?: "basic" | "bearer" | "none";
  username?: string;
  password?: string;
  bearerToken?: string;
  
  tokenPath: string;
}

export interface WorkflowDefinition {
  id?: string;
  name: string;
  protoContent: string;
  protoId?: string;
  serverAddress: string;
  useTls: boolean;
  steps: WorkflowStep[];
  schedule?: string; // cron expression
  authConfig?: AuthConfig;
  connectionId?: string;
}

export interface WorkflowRunLog {
  stepId: string;
  stepType?: "grpc" | "table" | "chart" | "database" | "rest";
  status: "success" | "error";
  request: any;
  response?: any;
  error?: string;
  latencyMs?: number;
  meta?: any;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: "running" | "completed" | "failed";
  startTime: string;
  endTime?: string;
  context: Record<string, any>;
  logs: WorkflowRunLog[];
}

/**
 * Replace {{ path.to.variable }} in a string using the context object.
 */
function interpolateTemplate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, path) => {
    const val = get(context, String(path).trim());
    if (val === undefined) {
      return ``; // Or throw? For now empty string
    }
    // If it's an object/array being put into a JSON string, we should JSON stringify it.
    // However, if the template itself is JSON, stringifying an object might result in invalid JSON 
    // `{"field": "{"nested":"obj"}"}` vs `{"field": {"nested":"obj"}}`.
    // It's safer to parse the template into an object first and map values, but since we store it as a string
    // we'll do simple replacement. If a user maps an object, they shouldn't wrap the placeholder in quotes.
    if (typeof val === "object") {
      return JSON.stringify(val);
    }
    return String(val);
  });
}

/**
 * Better approach: recursively evaluate templates in an object, but we start from a JSON string.
 * Let's convert the template string with quotes removed if it's an object replacement.
 * Actually, the easiest way is to parse the template, then deep walk it and replace strings.
 */
function evaluatePayload(templateObj: any, context: Record<string, any>): any {
  if (typeof templateObj === "string") {
    // Check if the entire string is exactly a template e.g. "{{ steps.foo.response }}"
    const exactMatch = templateObj.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
    if (exactMatch) {
      return get(context, exactMatch[1].trim());
    }
    // Otherwise it's a mixed string "bearer {{ token }}"
    return interpolateTemplate(templateObj, context);
  }

  if (Array.isArray(templateObj)) {
    return templateObj.map((item) => evaluatePayload(item, context));
  }

  if (templateObj !== null && typeof templateObj === "object") {
    const result: any = {};
    for (const key of Object.keys(templateObj)) {
      result[key] = evaluatePayload(templateObj[key], context);
    }
    return result;
  }

  return templateObj;
}

function parseJsonString(value: any): any {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeVisualData(value: any): any[] {
  let data = parseJsonString(value);

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const arrayKey = Object.keys(data).find((key) => Array.isArray(data[key]));
    if (arrayKey) data = data[arrayKey];
  }

  if (!Array.isArray(data)) {
    data = data !== undefined && data !== null ? [data] : [];
  }

  while (Array.isArray(data) && data.length === 1) {
    const first = parseJsonString(data[0]);
    if (!Array.isArray(first)) break;
    data = first;
  }

  return data.map(parseJsonString);
}

export async function runWorkflowBackground(workflow: WorkflowDefinition, runId: string, customContext: Record<string, any> = {}) {
  return Sentry.startSpan(
    {
      name: `workflow.run: ${workflow.name}`,
      op: "workflow.run",
      attributes: {
        "workflow.id": workflow.id || "",
        "workflow.name": workflow.name,
        "workflow.run_id": runId,
        "workflow.step_count": workflow.steps.length,
      },
    },
    async () => _runWorkflowBackground(workflow, runId, customContext),
  );
}

async function _runWorkflowBackground(workflow: WorkflowDefinition, runId: string, customContext: Record<string, any> = {}) {
  const db = await getDb();
  
  const runRecord: WorkflowRun = {
    id: runId,
    workflowId: workflow.id as string,
    status: "running",
    startTime: new Date().toISOString(),
    context: { steps: {}, ...customContext },
    logs: [],
  };

  // Create initial run record in DB
  const { id: _runId, ...dataWithoutId } = runRecord;
  const idString = String(runId);
  const dbId = idString.includes(":") ? idString.split(":")[1] : idString;
  const runRecordId = new RecordId("workflow_run", dbId);
  await db.query("CREATE $id CONTENT $data", { id: runRecordId, data: dataWithoutId });

  console.log("runWorkflowBackground called. Workflow object keys:", Object.keys(workflow));
  console.log("Proto content exists?", !!workflow.protoContent, "Length:", workflow.protoContent?.length);
  
  try {
    const { protoContent: storedProtoContent, protoId, serverAddress, useTls, steps, authConfig, connectionId } = workflow;

    let protoContent = storedProtoContent || "";
    if (protoId) {
      console.log(`[ENGINE] Fetching workflow proto by ID: ${protoId}`);
      try {
        const protoDbId = protoId.includes(":") ? protoId.split(":")[1] : protoId;
        const protoRecord = await db.select(new RecordId("proto_file", protoDbId));
        const protoFile = Array.isArray(protoRecord) ? protoRecord[0] : protoRecord;
        if (protoFile && protoFile.content) {
          protoContent = protoFile.content;
        }
      } catch (err: any) {
        console.error(`[ENGINE] Failed to resolve proto file by ID ${protoId}:`, err);
      }
    }

    const parsedProto = parseProtoContent(protoContent);
    const formPayload = customContext.form || {};
    const context = {
      steps: {} as any,
      auth: {} as any,
      form: formPayload,
      dashboard_form: formPayload,
      ...customContext
    };

    // 1. Perform Authentication if configured
    let authToken: string | undefined;
    if (connectionId) {
      console.log(`[AUTH] Fetching connection details for ID: ${connectionId}`);
      try {
        const connDbId = connectionId.includes(":") ? connectionId.split(":")[1] : connectionId;
        const connRecord = await db.select(new RecordId("connection", connDbId));
        const connection = Array.isArray(connRecord) ? connRecord[0] : connRecord;
        
        if (connection) {
          console.log(`[AUTH] Executing REST auth call for connection: ${connection.name}`);
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (connection.headers) {
             try {
                const parsedHeaders = JSON.parse(connection.headers);
                Object.assign(headers, parsedHeaders);
             } catch (e) {
                console.error(`[AUTH] Failed to parse custom headers for connection:`, e);
             }
          }

          if (connection.authScheme === "basic" && (connection.username || connection.password)) {
            const auth = Buffer.from(`${connection.username || ""}:${connection.password || ""}`).toString("base64");
            headers["Authorization"] = `Basic ${auth}`;
          } else if (connection.authScheme === "bearer" && connection.bearerToken) {
            headers["Authorization"] = `Bearer ${connection.bearerToken}`;
          }

          let authUrl = connection.url || "";
          if (authUrl && !authUrl.startsWith("http://") && !authUrl.startsWith("https://")) {
            const separator = authUrl.startsWith("/") ? "" : "/";
            const port = process.env.PORT || 3000;
            authUrl = `http://127.0.0.1:${port}${separator}${authUrl}`;
          }

          const res = await fetch(authUrl, {
            method: connection.method || "POST",
            headers,
            body: connection.method !== "GET" ? (connection.body || "{}") : undefined,
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
          }

          const authData = await res.json();
          authToken = get(authData, connection.tokenPath || "access_token");
          context.auth = { token: authToken, response: authData };
          console.log(`[AUTH] Success. Connection token obtained.`);
        } else {
          throw new Error(`Connection ${connectionId} not found in database`);
        }
      } catch (err: any) {
        throw new Error(`Connection Setup Error: ${err.message}`);
      }
    } else if (authConfig) {
      if (authConfig.type === "static") {
        console.log(`[AUTH] Using static token`);
        authToken = authConfig.bearerToken;
        context.auth = { token: authToken };
      } else if (authConfig.type === "grpc") {
        console.log(`[AUTH] Executing gRPC auth call: ${authConfig.serviceName}.${authConfig.methodName}`);
        try {
          const authPayload = JSON.parse(authConfig.requestTemplate || "{}");
          const authResult = await executeGrpcCall({
            protoContent,
            serverAddress,
            useTls,
            serviceName: authConfig.serviceName!,
            methodName: authConfig.methodName!,
            requestBody: authPayload,
          });

          if (authResult.success) {
            authToken = get(authResult.data, authConfig.tokenPath);
            context.auth = { token: authToken, response: authResult.data };
            console.log(`[AUTH] Success. Token obtained.`);
          } else {
            throw new Error(`Authentication failed: ${authResult.error}`);
          }
        } catch (err: any) {
          throw new Error(`Auth Setup Error: ${err.message}`);
        }
      } else if (authConfig.type === "rest") {
        console.log(`[AUTH] Executing REST auth call: ${authConfig.method} ${authConfig.url}`);
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (authConfig.authScheme === "basic" && (authConfig.username || authConfig.password)) {
            const auth = Buffer.from(`${authConfig.username || ""}:${authConfig.password || ""}`).toString("base64");
            headers["Authorization"] = `Basic ${auth}`;
          } else if (authConfig.authScheme === "bearer" && authConfig.bearerToken) {
            headers["Authorization"] = `Bearer ${authConfig.bearerToken}`;
          } else if (!authConfig.authScheme && (authConfig.username || authConfig.password)) {
            // Fallback for older configurations that didn't have authScheme
            const auth = Buffer.from(`${authConfig.username || ""}:${authConfig.password || ""}`).toString("base64");
            headers["Authorization"] = `Basic ${auth}`;
          }

          let authUrl = authConfig.url || "";
          if (authUrl && !authUrl.startsWith("http://") && !authUrl.startsWith("https://")) {
            const separator = authUrl.startsWith("/") ? "" : "/";
            const port = process.env.PORT || 3000;
            authUrl = `http://127.0.0.1:${port}${separator}${authUrl}`;
          }

          const res = await fetch(authUrl, {
            method: authConfig.method || "POST",
            headers,
            body: authConfig.method !== "GET" ? (authConfig.body || "{}") : undefined,
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
          }

          const authData = await res.json();
          authToken = get(authData, authConfig.tokenPath);
          context.auth = { token: authToken, response: authData };
          console.log(`[AUTH] Success. REST token obtained.`);
        } catch (err: any) {
          throw new Error(`REST Auth Error: ${err.message}`);
        }
      }
    }

    for (const step of steps) {
      // Each step runs inside a Sentry span. The callback returns a signal
      // ("continue" | "abort") so we can control the outer loop without
      // using continue/return across the function boundary.
      const stepResult: "continue" | "abort" = await Sentry.startSpan(
        {
          name: `step: ${step.id} (${step.type || "grpc"})`,
          op: "workflow.step",
          attributes: {
            "workflow.step.id": step.id,
            "workflow.step.type": step.type || "grpc",
          },
        },
        async (): Promise<"continue" | "abort"> => {
          let stepAuthHeader = await getStepAuthHeader(step, db);
          if (!stepAuthHeader && authToken) {
            stepAuthHeader = `Bearer ${authToken}`;
          }

      if (step.type === "table" || step.type === "chart") {
        let payload;
        try {
          const exactMatch = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
          if (exactMatch) {
            payload = get(context, exactMatch[1].trim());
          } else {
            payload = evaluatePayload(JSON.parse(step.requestBodyTemplate || "{}"), context);
          }
        } catch (e: any) {
          payload = { error: `Failed to evaluate visual data source: ${e.message}` };
        }

        // Apply dataPath to drill into nested JSON (e.g. "shares" inside the response)
        let visData = parseJsonString(payload);
        if (step.dataPath && visData && typeof visData === "object") {
          visData = get(visData, step.dataPath);
        }
        visData = normalizeVisualData(visData);

        context.steps[step.id] = { request: step.requestBodyTemplate, response: visData };
        
        runRecord.logs.push({
          stepId: step.id,
          stepType: step.type,
          status: "success",
          request: step.requestBodyTemplate,
          response: visData,
          meta: {
            dataPath: step.dataPath,
            xKey: step.xKey,
            yKey: step.yKey,
            chartType: (step as any).chartType || "bar",
            columns: (step as any).columns || [],
          }
        });

        const { id: _t_v, ...data_v } = runRecord;
        const sId_v = new RecordId("workflow_run", dbId);
        await db.query("UPDATE $id CONTENT $data", { id: sId_v, data: data_v });
        return "continue";
      }

      if (step.type === "database") {
        let queryPayload;
        try {
           const parsedTemplate = JSON.parse(step.requestBodyTemplate || "{}");
           queryPayload = evaluatePayload(parsedTemplate, context);
        } catch (e) {
           // If it fails to parse as JSON, treat it as a raw string (which is standard for SurrealQL)
           queryPayload = interpolateTemplate(step.requestBodyTemplate || "", context);
        }
        
        let execResult;
        let latencyMs = 0;
        try {
          const startTimeMs = Date.now();
          const targetDbName = interpolateTemplate(step.databaseName || "", context) || undefined;
          const targetDbUrl = interpolateTemplate(step.databaseUrl || "", context) || undefined;
          const targetDbUser = interpolateTemplate(step.databaseUser || "", context) || undefined;
          const targetDbPass = interpolateTemplate(step.databasePass || "", context) || undefined;
          const targetDbNs = interpolateTemplate(step.databaseNs || "", context) || undefined;
          
          // Import here to avoid circular dependency if one existed, but it's fine at top-level
          const { getCustomDb } = await import("~/lib/db");
          const ddb = await getCustomDb({
            url: targetDbUrl,
            user: targetDbUser,
            pass: targetDbPass,
            namespace: targetDbNs,
            database: targetDbName,
          });
          
          const surrealResult = await ddb.query(queryPayload);
          latencyMs = Date.now() - startTimeMs;
          
          execResult = { success: true, data: surrealResult };
        } catch (err: any) {
          execResult = { success: false, error: err.message };
        }

        let responseData = execResult.success ? execResult.data : undefined;
        if (Array.isArray(responseData) && responseData.length > 0 && Array.isArray(responseData[0])) {
          responseData = responseData[0];
        }

        context.steps[step.id] = {
          request: queryPayload,
          response: responseData,
          error: !execResult.success ? execResult.error : undefined,
        };

        const logRecord: WorkflowRunLog = {
          stepId: step.id,
          stepType: "database" as any, // casting to avoid strict type error if not updated in other places
          status: execResult.success ? "success" : "error",
          request: queryPayload,
          response: responseData,
          error: execResult.error,
          latencyMs,
        };
        runRecord.logs.push(logRecord);

        runRecord.context = context;
        const { id: _t1, ...data1 } = runRecord;
        const sId1 = new RecordId("workflow_run", dbId);
        await db.query("UPDATE $id CONTENT $data", { id: sId1, data: data1 });

        if (!execResult.success) {
          runRecord.status = "failed";
          runRecord.endTime = new Date().toISOString();
          const { id: _t2, ...data2 } = runRecord;
          const sId2 = new RecordId("workflow_run", dbId);
          await db.query("UPDATE $id CONTENT $data", { id: sId2, data: data2 });
          return "abort";
        }
        return "continue";
      }

      if (step.type === "rest") {
        let requestPayload;
        let evaluatedUrl = step.restUrl || "";
        
        try {
          evaluatedUrl = interpolateTemplate(step.restUrl || "", context);
        } catch(e) {
          evaluatedUrl = step.restUrl || "";
        }

        if (evaluatedUrl && !evaluatedUrl.startsWith("http://") && !evaluatedUrl.startsWith("https://")) {
          const separator = evaluatedUrl.startsWith("/") ? "" : "/";
          const port = process.env.PORT || 3000;
          evaluatedUrl = `http://127.0.0.1:${port}${separator}${evaluatedUrl}`;
        }

        const method = step.restMethod || "GET";
        const hasBody = method !== "GET" && method !== "DELETE";

        if (hasBody) {
          const exactMatch = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
          if (exactMatch) {
             requestPayload = get(context, exactMatch[1].trim());
          } else {
             try {
                const parsedTemplate = JSON.parse(step.requestBodyTemplate || "{}");
                requestPayload = evaluatePayload(parsedTemplate, context);
             } catch(e) {
                requestPayload = interpolateTemplate(step.requestBodyTemplate || "", context);
             }
          }
        }

        let metadata: Record<string, string> = {};
        if (stepAuthHeader) {
          metadata["Authorization"] = stepAuthHeader;
        }

        if (step.headersTemplate) {
          try {
            const parsedHeaders = JSON.parse(step.headersTemplate);
            const evaluatedHeaders = evaluatePayload(parsedHeaders, context);
            for (const [key, value] of Object.entries(evaluatedHeaders)) {
              metadata[key] = String(value);
            }
          } catch (e) {
            console.error(`Failed to parse/evaluate headers for REST step ${step.id}:`, e);
          }
        }

        let execResult;
        let latencyMs = 0;
        try {
          const startTimeMs = Date.now();
          const fetchOptions: RequestInit = {
            method,
            headers: metadata,
          };

          if (hasBody && requestPayload !== undefined) {
             fetchOptions.body = typeof requestPayload === "object" ? JSON.stringify(requestPayload) : String(requestPayload);
             if (!fetchOptions.headers) fetchOptions.headers = {};
             if (!(fetchOptions.headers as any)["Content-Type"] && typeof requestPayload === "object") {
                (fetchOptions.headers as any)["Content-Type"] = "application/json";
             }
          }

          const res = await fetch(evaluatedUrl, fetchOptions);
          latencyMs = Date.now() - startTimeMs;
          
          let data;
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
             data = await res.json();
          } else {
             data = parseJsonString(await res.text());
          }

          if (!res.ok) {
             throw new Error(`HTTP ${res.status}: ${typeof data === "object" ? JSON.stringify(data) : data}`);
          }
          execResult = { success: true, data, latencyMs };
        } catch(err: any) {
          execResult = { success: false, error: err.message, latencyMs };
        }

        context.steps[step.id] = {
           request: requestPayload,
           url: evaluatedUrl,
           response: execResult.success ? execResult.data : undefined,
           error: !execResult.success ? execResult.error : undefined,
        };

        const logRecord: WorkflowRunLog = {
           stepId: step.id,
           stepType: "rest" as any,
           status: execResult.success ? "success" : "error",
           request: { url: evaluatedUrl, method, body: requestPayload },
           response: execResult.success ? execResult.data : undefined,
           error: execResult.error,
           latencyMs: execResult.latencyMs,
        };
        runRecord.logs.push(logRecord);

        runRecord.context = context;
        const { id: _t1, ...data1 } = runRecord;
        const sId1 = new RecordId("workflow_run", dbId);
        await db.query("UPDATE $id CONTENT $data", { id: sId1, data: data1 });

        if (!execResult.success) {
           runRecord.status = "failed";
           runRecord.endTime = new Date().toISOString();
           const { id: _t2, ...data2 } = runRecord;
           const sId2 = new RecordId("workflow_run", dbId);
           await db.query("UPDATE $id CONTENT $data", { id: sId2, data: data2 });
           return "abort";
        }
        return "continue";
      }

      let requestPayload;

      // Check if the entire template is a single variable reference e.g. "{{ steps.step_1.response }}"
      const exactMatch = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
      if (exactMatch) {
        requestPayload = get(context, exactMatch[1].trim());
      } else {
        let parsedTemplate;
        try {
          parsedTemplate = JSON.parse(step.requestBodyTemplate || "{}");
        } catch (e: any) {
          throw new Error(`Invalid request payload in step ${step.id}: Must be a JSON object or a single exact template {{ variable }}. Error: ${e.message}`);
        }
        // Evaluate the dynamic placeholders
        requestPayload = evaluatePayload(parsedTemplate, context);
      }

      // Evaluate headers if present
      let metadata: Record<string, string> = {};
      
      if (stepAuthHeader) {
        metadata["Authorization"] = stepAuthHeader;
      }

      if (step.headersTemplate) {
        try {
          const parsedHeaders = JSON.parse(step.headersTemplate);
          const evaluatedHeaders = evaluatePayload(parsedHeaders, context);
          for (const [key, value] of Object.entries(evaluatedHeaders)) {
            metadata[key] = String(value);
          }
        } catch (e) {
          console.error(`Failed to parse/evaluate headers for step ${step.id}:`, e);
        }
      }

      // Execute gRPC call
      const execResult = await executeGrpcCall({
        protoContent,
        serverAddress: step.serverAddress || serverAddress,
        useTls: step.useTls !== undefined ? step.useTls : useTls,
        serviceName: step.serviceName || "",
        methodName: step.methodName || "",
        requestBody: requestPayload,
        metadata,
      });

      // Save to context
      context.steps[step.id] = {
        request: requestPayload,
        response: execResult.success ? execResult.data : undefined,
        error: !execResult.success ? (execResult.error || "Unknown Error") : undefined,
      };

      // Add log
      const logRecord: WorkflowRunLog = {
        stepId: step.id,
        stepType: "grpc",
        status: execResult.success ? "success" : "error",
        request: requestPayload,
        response: execResult.data,
        error: execResult.error,
        latencyMs: execResult.latencyMs,
      };
      runRecord.logs.push(logRecord);

      // Save progress to DB
      runRecord.context = context;
      const { id: _t1, ...data1 } = runRecord;
      const sId1 = new RecordId("workflow_run", dbId);
      await db.query("UPDATE $id CONTENT $data", { id: sId1, data: data1 });

      // Stop workflow on failure
      if (!execResult.success) {
        runRecord.status = "failed";
        runRecord.endTime = new Date().toISOString();
        const { id: _t2, ...data2 } = runRecord;
        const sId2 = new RecordId("workflow_run", dbId);
        await db.query("UPDATE $id CONTENT $data", { id: sId2, data: data2 });
        return "abort";
      }

      return "continue";

      }); // end Sentry.startSpan for step

      if (stepResult === "abort") return;
    }

    // All steps successful
    runRecord.status = "completed";
    runRecord.endTime = new Date().toISOString();
    const { id: _t3, ...data3 } = runRecord;
    const sId3 = new RecordId("workflow_run", dbId);
    await db.query("UPDATE $id CONTENT $data", { id: sId3, data: data3 });
  } catch (error: any) {
    Sentry.captureException(error);
    runRecord.status = "failed";
    runRecord.endTime = new Date().toISOString();
    runRecord.logs.push({
      stepId: "SYSTEM",
      status: "error",
      request: null,
      error: error.message,
    });
    const { id: _t4, ...data4 } = runRecord;
    const sId4 = new RecordId("workflow_run", dbId);
    await db.query("UPDATE $id CONTENT $data", { id: sId4, data: data4 });
  }
}
