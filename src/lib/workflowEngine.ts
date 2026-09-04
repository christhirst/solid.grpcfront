import jsonata from "jsonata";
import get from "lodash.get";
import { getDb } from "~/lib/db";
import { executeGrpcCall, executeGrpcStreamCall } from "~/lib/grpcExecutor";
import { executeHttpStreamCall } from "~/lib/httpExecutor";
import { parseProtoContent } from "~/lib/protoParser";
import { RecordId } from "surrealdb";
import * as Sentry from "@sentry/node";
import { EventEmitter } from "events";
import { normalizeConnection, fetchPreRequestToken } from "~/lib/connections";
export { getStepCategory, type StepCategory, type WorkflowStep } from "./stepCategories";


export const workflowStreamManager = new EventEmitter();
workflowStreamManager.setMaxListeners(200);

export function emitWorkflowEvent(runId: string, workflowId: string, type: string, data: any) {
  const payload = {
    runId,
    workflowId,
    type,
    data,
    timestamp: new Date().toISOString(),
  };
  workflowStreamManager.emit(`run:${runId}`, payload);
  if (workflowId) {
    workflowStreamManager.emit(`wf:${workflowId}`, payload);
  }
}

async function getStepAuthHeader(step: any, db: any): Promise<string | undefined> {
  const authType = step.authType || "none";
  if (authType === "basic" && (step.authUsername || step.authPassword)) {
    const auth = Buffer.from(`${step.authUsername || ""}:${step.authPassword || ""}`).toString("base64");
    return `Basic ${auth}`;
  }
  
  if ((authType === "oauth" || step.connectionId) && step.connectionId) {
    console.log(`[STEP AUTH] Fetching connection details for ID: ${step.connectionId}`);
    try {
      const connDbId = step.connectionId.includes(":") ? step.connectionId.split(":")[1] : step.connectionId;
      const connRecord = await db.select(new RecordId("connection", connDbId));
      const rawConnection = Array.isArray(connRecord) ? connRecord[0] : connRecord;
      
      if (rawConnection) {
        const connection = normalizeConnection(rawConnection);
        console.log(`[STEP AUTH] Resolving auth for connection: ${connection.name} (type: ${connection.type})`);

        if (connection.authType === "basic" && (connection.username || connection.password)) {
          const auth = Buffer.from(`${connection.username || ""}:${connection.password || ""}`).toString("base64");
          return `Basic ${auth}`;
        }

        if (connection.authType === "bearer" && connection.bearerToken) {
          return `Bearer ${connection.bearerToken}`;
        }

        if (connection.authType === "oauth" || connection.tokenUrl) {
          const tokenRes = await fetchPreRequestToken({
            tokenUrl: connection.tokenUrl,
            tokenMethod: connection.tokenMethod,
            tokenAuthScheme: connection.tokenAuthScheme,
            tokenUsername: connection.tokenUsername,
            tokenPassword: connection.tokenPassword,
            tokenBearerToken: connection.tokenBearerToken,
            tokenBody: connection.tokenBody,
            tokenHeaders: connection.tokenHeaders,
            tokenPath: connection.tokenPath,
          });

          if (!tokenRes.success) {
            throw new Error(tokenRes.error);
          }

          const prefix = connection.tokenHeaderPrefix !== undefined ? connection.tokenHeaderPrefix : "Bearer ";
          return `${prefix}${tokenRes.token}`;
        }
      } else {
        throw new Error(`Connection ${step.connectionId} not found in database`);
      }
    } catch (err: any) {
      throw new Error(`Step Connection Setup Error: ${err.message}`);
    }
  }
  
  return undefined;
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
  /** ID of a saved ca_cert record to use for TLS (overrides system root CAs). */
  caId?: string;
  serverAddress: string;
  useTls: boolean;
  steps: WorkflowStep[];

  schedule?: string; // cron expression
  authConfig?: AuthConfig;
  connectionId?: string;
  graph?: { nodes: any[]; connections: any[]; position?: [number, number]; zoom?: number };
}


export interface WorkflowRunLog {
  stepId: string;
  stepType?: "grpc" | "table" | "chart" | "database" | "rest" | "grpc_stream" | "rest_stream" | "surreal_live";
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


/**
 * Topologically sort workflow steps so that all upstream dependencies (sourceStepIds)
 * execute before the target steps that consume them. Cycles gracefully fall back to linear order.
 */
export function sortStepsTopologically(steps: WorkflowStep[]): WorkflowStep[] {
  if (!steps || steps.length <= 1) return steps || [];

  const stepMap = new Map<string, WorkflowStep>();
  steps.forEach((s) => stepMap.set(s.id, s));

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: WorkflowStep[] = [];

  function visit(stepId: string) {
    if (visited.has(stepId)) return;
    if (visiting.has(stepId)) {
      return; // Cycle detected: avoid infinite recursion
    }
    visiting.add(stepId);
    const step = stepMap.get(stepId);
    if (step && Array.isArray(step.sourceStepIds)) {
      for (const srcId of step.sourceStepIds) {
        if (stepMap.has(srcId)) {
          visit(srcId);
        }
      }
    }
    visiting.delete(stepId);
    visited.add(stepId);
    if (step) sorted.push(step);
  }

  for (const step of steps) {
    visit(step.id);
  }

  return sorted.length === steps.length ? sorted : steps;
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

  emitWorkflowEvent(runId, workflow.id || "", "workflow_start", {
    runId,
    workflowId: workflow.id,
    startTime: runRecord.startTime,
  });

  console.log("runWorkflowBackground called. Workflow object keys:", Object.keys(workflow));

  console.log("Proto content exists?", !!workflow.protoContent, "Length:", workflow.protoContent?.length);
  
  try {
    const { protoContent: storedProtoContent, protoId, caId, serverAddress, useTls: legacyUseTls, steps, authConfig, connectionId } = workflow;
    const ACCEPT_ALL_CA = "__accept_all__";
    const defaultCaId = caId || (legacyUseTls ? ACCEPT_ALL_CA : "");
    const useTls = defaultCaId !== "";

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

    // Fetch CA cert PEM if a CA is configured
    const caCertCache = new Map<string, string | undefined>();
    const resolveCaCert = async (selectedCaId: string) => {
      if (!selectedCaId || selectedCaId === ACCEPT_ALL_CA) return undefined;
      if (caCertCache.has(selectedCaId)) return caCertCache.get(selectedCaId);
      console.log(`[ENGINE] Fetching CA cert by ID: ${selectedCaId}`);
      try {
        const caDbId = selectedCaId.includes(":") ? selectedCaId.split(":")[1] : selectedCaId;
        const caRecord = await db.select(new RecordId("ca_cert", caDbId));
        const caFile = Array.isArray(caRecord) ? caRecord[0] : caRecord;
        if (caFile && caFile.content) {
          const cert = caFile.content;
          caCertCache.set(selectedCaId, cert);
          console.log(`[ENGINE] CA cert loaded: ${caFile.name || caDbId}`);
          return cert;
        }
      } catch (err: any) {
        console.error(`[ENGINE] Failed to resolve CA cert by ID ${selectedCaId}:`, err);
      }
      caCertCache.set(selectedCaId, undefined);
      return undefined;
    };
    const caCert = await resolveCaCert(defaultCaId);

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
        const rawConnection = Array.isArray(connRecord) ? connRecord[0] : connRecord;
        
        if (rawConnection) {
          const connection = normalizeConnection(rawConnection);
          console.log(`[AUTH] Resolving workflow connection auth: ${connection.name}`);

          if (connection.authType === "bearer" && connection.bearerToken) {
            authToken = connection.bearerToken;
            context.auth = { token: authToken };
          } else if (connection.authType === "basic" && (connection.username || connection.password)) {
            authToken = Buffer.from(`${connection.username || ""}:${connection.password || ""}`).toString("base64");
            context.auth = { token: authToken };
          } else if (connection.authType === "oauth" || connection.tokenUrl) {
            const tokenRes = await fetchPreRequestToken({
              tokenUrl: connection.tokenUrl,
              tokenMethod: connection.tokenMethod,
              tokenAuthScheme: connection.tokenAuthScheme,
              tokenUsername: connection.tokenUsername,
              tokenPassword: connection.tokenPassword,
              tokenBearerToken: connection.tokenBearerToken,
              tokenBody: connection.tokenBody,
              tokenHeaders: connection.tokenHeaders,
              tokenPath: connection.tokenPath,
            });

            if (!tokenRes.success) {
              throw new Error(tokenRes.error);
            }

            authToken = tokenRes.token;
            context.auth = { token: authToken, response: tokenRes.response };
            console.log(`[AUTH] Success. Connection token obtained.`);
          }
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
            caCert,
            acceptInvalidCert: defaultCaId === ACCEPT_ALL_CA,
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
            if (/^[a-zA-Z0-9._-]+(:\d+)/.test(authUrl.split("/")[0])) {
              authUrl = `http://${authUrl}`;
            } else {
              const separator = authUrl.startsWith("/") ? "" : "/";
              const port = process.env.PORT || 3000;
              authUrl = `http://127.0.0.1:${port}${separator}${authUrl}`;
            }
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

    const executionSteps = sortStepsTopologically(steps || []);
    for (const step of executionSteps) {
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

          emitWorkflowEvent(runId, workflow.id || "", "step_start", {
            stepId: step.id,
            stepType: step.type || "grpc",
          });

      if (step.type === "grpc_stream") {
        let requestPayload: any;
        const exactMatch = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
        if (exactMatch) {
          requestPayload = get(context, exactMatch[1].trim());
        } else {
          try {
            const parsedTemplate = JSON.parse(step.requestBodyTemplate || "{}");
            requestPayload = evaluatePayload(parsedTemplate, context);
          } catch (e) {
            requestPayload = {};
          }
        }

        const chunks: any[] = [];
        let streamError: string | undefined = undefined;

        const stepCaId = step.caId ?? defaultCaId;
        const stepCaCert = await resolveCaCert(stepCaId);
        await new Promise<void>((resolve) => {
          executeGrpcStreamCall(
            {
              protoContent,
              serverAddress: step.serverAddress || serverAddress,
              useTls: stepCaId !== "",
              caCert: stepCaCert,
              acceptInvalidCert: stepCaId === ACCEPT_ALL_CA,
              serviceName: step.serviceName || "",
              methodName: step.methodName || "",
              requestBody: requestPayload,
            },

            (chunk) => {
              chunks.push(chunk);
              emitWorkflowEvent(runId, workflow.id || "", "step_chunk", {
                stepId: step.id,
                chunk,
              });
            },
            (err) => {
              streamError = err.message || String(err);
              resolve();
            },
            () => resolve()
          );
        });

        const success = !streamError;
        context.steps[step.id] = {
          request: requestPayload,
          response: chunks,
          error: streamError,
        };

        runRecord.logs.push({
          stepId: step.id,
          stepType: "grpc_stream",
          status: success ? "success" : "error",
          request: requestPayload,
          response: chunks,
          error: streamError,
        });

        runRecord.context = context;
        const { id: _t1, ...data1 } = runRecord;
        const sId1 = new RecordId("workflow_run", dbId);
        await db.query("UPDATE $id CONTENT $data", { id: sId1, data: data1 });

        if (!success) {
          emitWorkflowEvent(runId, workflow.id || "", "step_failed", { stepId: step.id, error: streamError });
          runRecord.status = "failed";
          runRecord.endTime = new Date().toISOString();
          const { id: _t2, ...data2 } = runRecord;
          const sId2 = new RecordId("workflow_run", dbId);
          await db.query("UPDATE $id CONTENT $data", { id: sId2, data: data2 });
          return "abort";
        }

        emitWorkflowEvent(runId, workflow.id || "", "step_complete", { stepId: step.id, response: chunks });
        return "continue";
      }

      if (step.type === "rest_stream") {
        let requestPayload: any;
        let evaluatedUrl = step.restUrl || "";
        try {
          evaluatedUrl = interpolateTemplate(step.restUrl || "", context);
        } catch {
          evaluatedUrl = step.restUrl || "";
        }

        if (evaluatedUrl && !evaluatedUrl.startsWith("http://") && !evaluatedUrl.startsWith("https://")) {
          if (/^[a-zA-Z0-9._-]+(:\d+)/.test(evaluatedUrl.split("/")[0])) {
            evaluatedUrl = `http://${evaluatedUrl}`;
          } else {
            const separator = evaluatedUrl.startsWith("/") ? "" : "/";
            const port = process.env.PORT || 3000;
            evaluatedUrl = `http://127.0.0.1:${port}${separator}${evaluatedUrl}`;
          }
        }

        const chunks: any[] = [];
        let streamError: string | undefined = undefined;
        const stepCaId = step.caId ?? defaultCaId;
        const stepCaCert = await resolveCaCert(stepCaId);

        await new Promise<void>((resolve) => {
          executeHttpStreamCall(
            {
              url: evaluatedUrl,
              method: step.restMethod || "GET",
              body: step.requestBodyTemplate ? evaluatePayload(JSON.parse(step.requestBodyTemplate), context) : undefined,
              tls: stepCaId
                ? { ca: stepCaCert, rejectUnauthorized: stepCaId !== ACCEPT_ALL_CA }
                : undefined,
            },
            (chunk) => {
              chunks.push(chunk);
              emitWorkflowEvent(runId, workflow.id || "", "step_chunk", {
                stepId: step.id,
                chunk,
              });
            },
            (err) => {
              streamError = err.message || String(err);
              resolve();
            },
            () => resolve()
          );
        });

        const success = !streamError;
        context.steps[step.id] = {
          request: evaluatedUrl,
          response: chunks,
          error: streamError,
        };

        runRecord.logs.push({
          stepId: step.id,
          stepType: "rest_stream",
          status: success ? "success" : "error",
          request: { url: evaluatedUrl, method: step.restMethod || "GET" },
          response: chunks,
          error: streamError,
        });

        runRecord.context = context;
        const { id: _t1, ...data1 } = runRecord;
        const sId1 = new RecordId("workflow_run", dbId);
        await db.query("UPDATE $id CONTENT $data", { id: sId1, data: data1 });

        if (!success) {
          emitWorkflowEvent(runId, workflow.id || "", "step_failed", { stepId: step.id, error: streamError });
          runRecord.status = "failed";
          runRecord.endTime = new Date().toISOString();
          const { id: _t2, ...data2 } = runRecord;
          const sId2 = new RecordId("workflow_run", dbId);
          await db.query("UPDATE $id CONTENT $data", { id: sId2, data: data2 });
          return "abort";
        }

        emitWorkflowEvent(runId, workflow.id || "", "step_complete", { stepId: step.id, response: chunks });
        return "continue";
      }

      if (step.type === "surreal_live") {
        const targetTable = step.requestBodyTemplate?.trim() || "workflow_run";
        let targetDbName = interpolateTemplate(step.databaseName || "", context) || undefined;
        let targetDbUrl = interpolateTemplate(step.databaseUrl || "", context) || undefined;
        let targetDbUser = interpolateTemplate(step.databaseUser || "", context) || undefined;
        let targetDbPass = interpolateTemplate(step.databasePass || "", context) || undefined;
        let targetDbNs = interpolateTemplate(step.databaseNs || "", context) || undefined;

        if (step.connectionId && (!targetDbUrl || !targetDbName)) {
          try {
            const connDbId = step.connectionId.includes(":") ? step.connectionId.split(":")[1] : step.connectionId;
            const connRecord = await db.select(new RecordId("connection", connDbId));
            const rawConn = Array.isArray(connRecord) ? connRecord[0] : connRecord;
            if (rawConn) {
              const conn = normalizeConnection(rawConn) as any;
              if (conn.url && !targetDbUrl) targetDbUrl = conn.url;
              if (conn.username && !targetDbUser) targetDbUser = conn.username;
              if (conn.password && !targetDbPass) targetDbPass = conn.password;
              if (conn.namespace && !targetDbNs) targetDbNs = conn.namespace;
              if (conn.database && !targetDbName) targetDbName = conn.database;
            }
          } catch (e) {
            console.error("[WORKFLOW] Could not resolve SurrealDB connection for live step:", e);
          }
        }

        const chunks: any[] = [];
        let streamError: string | undefined = undefined;

        try {
          const { getCustomDb } = await import("~/lib/db");
          const ddb = await getCustomDb({
            url: targetDbUrl,
            user: targetDbUser,
            pass: targetDbPass,
            namespace: targetDbNs,
            database: targetDbName,
          });

          const liveUuid = await ddb.live(targetTable, (action: string, result: any) => {
            const eventData = { action, result, timestamp: new Date().toISOString() };
            chunks.push(eventData);
            emitWorkflowEvent(runId, workflow.id || "", "step_chunk", {
              stepId: step.id,
              chunk: eventData,
            });
          });

          await new Promise((r) => setTimeout(r, 2000));
          await ddb.kill(liveUuid).catch(() => {});
        } catch (err: any) {
          streamError = err.message || String(err);
        }

        const success = !streamError;
        context.steps[step.id] = {
          request: `LIVE SELECT * FROM ${targetTable}`,
          response: chunks,
          error: streamError,
        };

        runRecord.logs.push({
          stepId: step.id,
          stepType: "surreal_live",
          status: success ? "success" : "error",
          request: targetTable,
          response: chunks,
          error: streamError,
        });

        runRecord.context = context;
        const { id: _t1, ...data1 } = runRecord;
        const sId1 = new RecordId("workflow_run", dbId);
        await db.query("UPDATE $id CONTENT $data", { id: sId1, data: data1 });

        if (!success) {
          emitWorkflowEvent(runId, workflow.id || "", "step_failed", { stepId: step.id, error: streamError });
          runRecord.status = "failed";
          runRecord.endTime = new Date().toISOString();
          const { id: _t2, ...data2 } = runRecord;
          const sId2 = new RecordId("workflow_run", dbId);
          await db.query("UPDATE $id CONTENT $data", { id: sId2, data: data2 });
          return "abort";
        }

        emitWorkflowEvent(runId, workflow.id || "", "step_complete", { stepId: step.id, response: chunks });
        return "continue";
      }


      if (step.type === "transform") {
        let transformedResult: any;
        let transformError: string | undefined;

        try {
          const sourceIds = (step.sourceStepIds && step.sourceStepIds.length > 0)
            ? step.sourceStepIds
            : [];

          const sourcesData = sourceIds
            .map((srcId: string) => context.steps[srcId]?.response)
            .filter((v: any) => v !== undefined);

          const primaryInput = sourcesData.length === 1 ? sourcesData[0] : sourcesData;

          const evaluationScope = {
            ...context,
            steps: context.steps,
            source: primaryInput,
            sources: sourcesData,
            data: primaryInput,
          };

          const exprString = (step.transformExpression || "").trim() || "$";
          const expression = jsonata(exprString);
          transformedResult = await expression.evaluate(evaluationScope);

          if (transformedResult === undefined) {
            transformedResult = null;
          }
        } catch (err: any) {
          transformError = err.message || String(err);
          transformedResult = { error: `Transform Error: ${transformError}` };
        }

        const success = !transformError;
        context.steps[step.id] = {
          request: step.transformExpression,
          response: transformedResult,
          error: transformError,
        };

        runRecord.logs.push({
          stepId: step.id,
          stepType: "transform",
          status: success ? "success" : "error",
          request: step.transformExpression,
          response: transformedResult,
          error: transformError,
          meta: {
            sourceStepIds: step.sourceStepIds,
            transformExpression: step.transformExpression,
          },
        });

        const { id: _t_tr, ...data_tr } = runRecord;
        const sId_tr = new RecordId("workflow_run", dbId);
        await db.query("UPDATE $id CONTENT $data", { id: sId_tr, data: data_tr });

        if (!success) {
          emitWorkflowEvent(runId, workflow.id || "", "step_failed", { stepId: step.id, error: transformError });
          runRecord.status = "failed";
          runRecord.endTime = new Date().toISOString();
          const { id: _t_tr2, ...data_tr2 } = runRecord;
          const sId_tr2 = new RecordId("workflow_run", dbId);
          await db.query("UPDATE $id CONTENT $data", { id: sId_tr2, data: data_tr2 });
          return "abort";
        }

        emitWorkflowEvent(runId, workflow.id || "", "step_complete", { stepId: step.id, response: transformedResult });
        return "continue";
      }

      if (step.type === "table" || step.type === "chart" || step.type === "infographic") {
        let payload;
        const sourceIds = (step.sourceStepIds && step.sourceStepIds.length > 0)
          ? step.sourceStepIds
          : [];

        if (sourceIds.length > 0) {
          const sourcesData = sourceIds
            .map((srcId: string) => context.steps[srcId]?.response)
            .filter((v: any) => v !== undefined);

          if (step.requestBodyTemplate?.trim()) {
            try {
              const exactMatch = step.requestBodyTemplate.trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
              if (exactMatch) {
                payload = get(context, exactMatch[1].trim());
              } else {
                payload = evaluatePayload(JSON.parse(step.requestBodyTemplate), context);
              }
            } catch {
              payload = interpolateTemplate(step.requestBodyTemplate, context);
            }
          } else if (sourcesData.length === 1) {
            payload = sourcesData[0];
          } else if (sourcesData.length > 1) {
            // Multi-source automatic aggregation (combine arrays or merge objects)
            const allArrays = sourcesData.every((d: any) => {
              const parsed = parseJsonString(d);
              return Array.isArray(parsed);
            });
            if (allArrays) {
              payload = sourcesData.flatMap((d: any) => {
                const parsed = parseJsonString(d);
                return Array.isArray(parsed) ? parsed : [parsed];
              });
            } else {
              payload = sourcesData.reduce((acc: any, curr: any, idx: number) => {
                const key = sourceIds[idx] || `source_${idx + 1}`;
                acc[key] = curr;
                return acc;
              }, {});
            }
          }
        } else {
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
            sourceStepIds: step.sourceStepIds,
            dataPath: step.dataPath,
            xKey: step.xKey,
            yKey: step.yKey,
            chartType: (step as any).chartType || "bar",
            columns: (step as any).columns || [],
            infographicSyntax: (step as any).infographicSyntax,
            infographicTemplate: (step as any).infographicTemplate,
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
          let targetDbName = interpolateTemplate(step.databaseName || "", context) || undefined;
          let targetDbUrl = interpolateTemplate(step.databaseUrl || "", context) || undefined;
          let targetDbUser = interpolateTemplate(step.databaseUser || "", context) || undefined;
          let targetDbPass = interpolateTemplate(step.databasePass || "", context) || undefined;
          let targetDbNs = interpolateTemplate(step.databaseNs || "", context) || undefined;

          if (step.connectionId && (!targetDbUrl || !targetDbName)) {
            try {
              const connDbId = step.connectionId.includes(":") ? step.connectionId.split(":")[1] : step.connectionId;
              const connRecord = await db.select(new RecordId("connection", connDbId));
              const rawConn = Array.isArray(connRecord) ? connRecord[0] : connRecord;
              if (rawConn) {
                const conn = normalizeConnection(rawConn) as any;
                if (conn.url && !targetDbUrl) targetDbUrl = conn.url;
                if (conn.username && !targetDbUser) targetDbUser = conn.username;
                if (conn.password && !targetDbPass) targetDbPass = conn.password;
                if (conn.namespace && !targetDbNs) targetDbNs = conn.namespace;
                if (conn.database && !targetDbName) targetDbName = conn.database;
              }
            } catch (e) {
              console.error("[WORKFLOW] Could not resolve SurrealDB connection for database step:", e);
            }
          }
          
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
          // If the URL looks like a host:port or hostname (e.g. localhost:4000, 0.0.0.0:8080)
          // add http:// scheme rather than treating it as a relative path on the local server.
          if (/^[a-zA-Z0-9._-]+(:\d+)/.test(evaluatedUrl.split("/")[0])) {
            evaluatedUrl = `http://${evaluatedUrl}`;
          } else {
            const separator = evaluatedUrl.startsWith("/") ? "" : "/";
            const port = process.env.PORT || 3000;
            evaluatedUrl = `http://127.0.0.1:${port}${separator}${evaluatedUrl}`;
          }
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
          const stepCaId = step.caId ?? defaultCaId;
          const stepCaCert = await resolveCaCert(stepCaId);
          if (stepCaId) {
            (fetchOptions as any).tls = {
              ca: stepCaCert,
              rejectUnauthorized: stepCaId !== ACCEPT_ALL_CA,
            };
          }

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
      const stepCaId = step.caId ?? defaultCaId;
      const execResult = await executeGrpcCall({
        protoContent,
        serverAddress: step.serverAddress || serverAddress,
        useTls: stepCaId !== "",
        caCert: await resolveCaCert(stepCaId),
        acceptInvalidCert: stepCaId === ACCEPT_ALL_CA,
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

    emitWorkflowEvent(runId, workflow.id || "", "workflow_complete", {
      runId,
      workflowId: workflow.id,
      status: "completed",
      endTime: runRecord.endTime,
    });
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

    emitWorkflowEvent(runId, workflow.id || "", "workflow_failed", {
      runId,
      workflowId: workflow.id,
      status: "failed",
      error: error.message,
      endTime: runRecord.endTime,
    });
  }
}
