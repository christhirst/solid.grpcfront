import get from "lodash.get";
import { getDb } from "~/lib/db";
import { executeGrpcCall } from "~/lib/grpcExecutor";
import { parseProtoContent } from "~/lib/protoParser";
import { RecordId } from "surrealdb";

export interface WorkflowStep {
  id: string;
  type?: "grpc" | "table" | "chart" | "database" | "rest";
  databaseName?: string; // target dynamic DB for 'database' step type
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
  serverAddress: string;
  useTls: boolean;
  steps: WorkflowStep[];
  schedule?: string; // cron expression
  authConfig?: AuthConfig;
}

export interface WorkflowRunLog {
  stepId: string;
  stepType?: "grpc" | "table" | "chart";
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
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const val = get(context, path);
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
    const exactMatch = templateObj.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
    if (exactMatch) {
      return get(context, exactMatch[1]);
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

export async function runWorkflowBackground(workflow: WorkflowDefinition, runId: string, customContext: Record<string, any> = {}) {
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
    const { protoContent, serverAddress, useTls, steps, authConfig } = workflow;

    const parsedProto = parseProtoContent(protoContent);
    const context = { steps: {} as any, auth: {} as any, ...customContext };

    // 1. Perform Authentication if configured
    let authToken: string | undefined;
    if (authConfig) {
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

          const res = await fetch(authConfig.url!, {
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
      if (step.type === "table" || step.type === "chart") {
        let payload;
        try {
          const exactMatch = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/);
          if (exactMatch) {
            payload = get(context, exactMatch[1]);
          } else {
            payload = evaluatePayload(JSON.parse(step.requestBodyTemplate || "{}"), context);
          }
        } catch (e: any) {
          payload = { error: `Failed to evaluate visual data source: ${e.message}` };
        }

        // Apply dataPath to drill into nested JSON (e.g. "shares" inside the response)
        let visData = payload;
        if (step.dataPath && payload && typeof payload === "object") {
          visData = get(payload, step.dataPath);
        }
        // Ensure it's an array
        if (!Array.isArray(visData)) {
          visData = visData !== undefined && visData !== null ? [visData] : [];
        }

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
        continue;
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
          const targetDbName = interpolateTemplate(step.databaseName || "", context) || "main";
          
          // Import here to avoid circular dependency if one existed, but it's fine at top-level
          const { getDynamicDb } = await import("~/lib/db");
          const ddb = await getDynamicDb(targetDbName);
          
          const surrealResult = await ddb.query(queryPayload);
          latencyMs = Date.now() - startTimeMs;
          
          execResult = { success: true, data: surrealResult };
        } catch (err: any) {
          execResult = { success: false, error: err.message };
        }

        context.steps[step.id] = {
          request: queryPayload,
          response: execResult.success ? execResult.data : undefined,
          error: !execResult.success ? execResult.error : undefined,
        };

        const logRecord: WorkflowRunLog = {
          stepId: step.id,
          stepType: "database" as any, // casting to avoid strict type error if not updated in other places
          status: execResult.success ? "success" : "error",
          request: queryPayload,
          response: execResult.success ? execResult.data : undefined,
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
          return;
        }
        continue;
      }

      if (step.type === "rest") {
        let requestPayload;
        let evaluatedUrl = step.restUrl || "";
        
        try {
          evaluatedUrl = interpolateTemplate(step.restUrl || "", context);
        } catch(e) {
          evaluatedUrl = step.restUrl || "";
        }

        const method = step.restMethod || "GET";
        const hasBody = method !== "GET" && method !== "DELETE";

        if (hasBody) {
          const exactMatch = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/);
          if (exactMatch) {
             requestPayload = get(context, exactMatch[1]);
          } else {
             try {
                const parsedTemplate = JSON.parse(step.requestBodyTemplate || "{}");
                requestPayload = evaluatePayload(parsedTemplate, context);
             } catch(e) {
                requestPayload = interpolateTemplate(step.requestBodyTemplate || "", context);
             }
          }
        }

        let metadata: Record<string, string> | undefined;
        if (authToken) {
          metadata = { "Authorization": `Bearer ${authToken}` };
        }

        if (step.headersTemplate) {
          try {
            const parsedHeaders = JSON.parse(step.headersTemplate);
            const evaluatedHeaders = evaluatePayload(parsedHeaders, context);
            metadata = metadata || {};
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
             data = await res.text();
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
           return;
        }
        continue;
      }

      let requestPayload;

      // Check if the entire template is a single variable reference e.g. "{{ steps.step_1.response }}"
      const exactMatch = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/);
      if (exactMatch) {
        requestPayload = get(context, exactMatch[1]);
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
      let metadata: Record<string, string> | undefined;
      
      // Auto-inject Auth Token if available
      if (authToken) {
        metadata = { "Authorization": `Bearer ${authToken}` };
      }

      if (step.headersTemplate) {
        try {
          const parsedHeaders = JSON.parse(step.headersTemplate);
          const evaluatedHeaders = evaluatePayload(parsedHeaders, context);
          metadata = metadata || {};
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
        return;
      }
    }

    // All steps successful
    runRecord.status = "completed";
    runRecord.endTime = new Date().toISOString();
    const { id: _t3, ...data3 } = runRecord;
    const sId3 = new RecordId("workflow_run", dbId);
    await db.query("UPDATE $id CONTENT $data", { id: sId3, data: data3 });
  } catch (error: any) {
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
