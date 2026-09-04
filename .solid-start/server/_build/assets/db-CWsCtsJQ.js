import { RecordId, Surreal } from "surrealdb";
import * as Sentry from "@sentry/node";
import cron from "node-cron";
import { l as logger } from "./logger-BDLv3oYI.js";
import jsonata from "jsonata";
import get from "lodash.get";
import { e as executeGrpcCall, a as executeGrpcStreamCall } from "./grpcExecutor-DlteWgV8.js";
import { e as executeHttpStreamCall } from "./httpExecutor-C7gv4kID.js";
import { p as parseProtoContent } from "./protoParser-C1XlV9an.js";
import { EventEmitter } from "events";
import { n as normalizeConnection, f as fetchPreRequestToken } from "./connections-BimqTFQY.js";
import { v4 } from "uuid";
const workflowStreamManager = new EventEmitter();
workflowStreamManager.setMaxListeners(200);
function emitWorkflowEvent(runId, workflowId, type, data) {
  const payload = {
    runId,
    workflowId,
    type,
    data,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  workflowStreamManager.emit(`run:${runId}`, payload);
  if (workflowId) {
    workflowStreamManager.emit(`wf:${workflowId}`, payload);
  }
}
async function getStepAuthHeader(step, db2) {
  const authType = step.authType || "none";
  if (authType === "basic" && (step.authUsername || step.authPassword)) {
    const auth = Buffer.from(`${step.authUsername || ""}:${step.authPassword || ""}`).toString("base64");
    return `Basic ${auth}`;
  }
  if ((authType === "oauth" || step.connectionId) && step.connectionId) {
    console.log(`[STEP AUTH] Fetching connection details for ID: ${step.connectionId}`);
    try {
      const connDbId = step.connectionId.includes(":") ? step.connectionId.split(":")[1] : step.connectionId;
      const connRecord = await db2.select(new RecordId("connection", connDbId));
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
            tokenPath: connection.tokenPath
          });
          if (!tokenRes.success) {
            throw new Error(tokenRes.error);
          }
          const prefix = connection.tokenHeaderPrefix !== void 0 ? connection.tokenHeaderPrefix : "Bearer ";
          return `${prefix}${tokenRes.token}`;
        }
      } else {
        throw new Error(`Connection ${step.connectionId} not found in database`);
      }
    } catch (err) {
      throw new Error(`Step Connection Setup Error: ${err.message}`);
    }
  }
  return void 0;
}
function interpolateTemplate(template, context) {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, path) => {
    const val = get(context, String(path).trim());
    if (val === void 0) {
      return ``;
    }
    if (typeof val === "object") {
      return JSON.stringify(val);
    }
    return String(val);
  });
}
function evaluatePayload(templateObj, context) {
  if (typeof templateObj === "string") {
    const exactMatch = templateObj.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
    if (exactMatch) {
      return get(context, exactMatch[1].trim());
    }
    return interpolateTemplate(templateObj, context);
  }
  if (Array.isArray(templateObj)) {
    return templateObj.map((item) => evaluatePayload(item, context));
  }
  if (templateObj !== null && typeof templateObj === "object") {
    const result = {};
    for (const key of Object.keys(templateObj)) {
      result[key] = evaluatePayload(templateObj[key], context);
    }
    return result;
  }
  return templateObj;
}
function parseJsonString(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}
function sortStepsTopologically(steps) {
  if (!steps || steps.length <= 1) return steps || [];
  const stepMap = /* @__PURE__ */ new Map();
  steps.forEach((s) => stepMap.set(s.id, s));
  const visited = /* @__PURE__ */ new Set();
  const visiting = /* @__PURE__ */ new Set();
  const sorted = [];
  function visit(stepId) {
    if (visited.has(stepId)) return;
    if (visiting.has(stepId)) {
      return;
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
function normalizeVisualData(value) {
  let data = parseJsonString(value);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const arrayKey = Object.keys(data).find((key) => Array.isArray(data[key]));
    if (arrayKey) data = data[arrayKey];
  }
  if (!Array.isArray(data)) {
    data = data !== void 0 && data !== null ? [data] : [];
  }
  while (Array.isArray(data) && data.length === 1) {
    const first = parseJsonString(data[0]);
    if (!Array.isArray(first)) break;
    data = first;
  }
  return data.map(parseJsonString);
}
async function runWorkflowBackground(workflow, runId, customContext = {}) {
  return Sentry.startSpan({
    name: `workflow.run: ${workflow.name}`,
    op: "workflow.run",
    attributes: {
      "workflow.id": workflow.id || "",
      "workflow.name": workflow.name,
      "workflow.run_id": runId,
      "workflow.step_count": workflow.steps.length
    }
  }, async () => _runWorkflowBackground(workflow, runId, customContext));
}
async function _runWorkflowBackground(workflow, runId, customContext = {}) {
  const db$1 = await getDb();
  const runRecord = {
    id: runId,
    workflowId: workflow.id,
    status: "running",
    startTime: (/* @__PURE__ */ new Date()).toISOString(),
    context: {
      steps: {},
      ...customContext
    },
    logs: []
  };
  const {
    id: _runId,
    ...dataWithoutId
  } = runRecord;
  const idString = String(runId);
  const dbId = idString.includes(":") ? idString.split(":")[1] : idString;
  const runRecordId = new RecordId("workflow_run", dbId);
  await db$1.query("CREATE $id CONTENT $data", {
    id: runRecordId,
    data: dataWithoutId
  });
  emitWorkflowEvent(runId, workflow.id || "", "workflow_start", {
    runId,
    workflowId: workflow.id,
    startTime: runRecord.startTime
  });
  console.log("runWorkflowBackground called. Workflow object keys:", Object.keys(workflow));
  console.log("Proto content exists?", !!workflow.protoContent, "Length:", workflow.protoContent?.length);
  try {
    const {
      protoContent: storedProtoContent,
      protoId,
      caId,
      serverAddress,
      useTls: legacyUseTls,
      steps,
      authConfig,
      connectionId
    } = workflow;
    const ACCEPT_ALL_CA = "__accept_all__";
    const defaultCaId = caId || (legacyUseTls ? ACCEPT_ALL_CA : "");
    const useTls = defaultCaId !== "";
    let protoContent = storedProtoContent || "";
    if (protoId) {
      console.log(`[ENGINE] Fetching workflow proto by ID: ${protoId}`);
      try {
        const protoDbId = protoId.includes(":") ? protoId.split(":")[1] : protoId;
        const protoRecord = await db$1.select(new RecordId("proto_file", protoDbId));
        const protoFile = Array.isArray(protoRecord) ? protoRecord[0] : protoRecord;
        if (protoFile && protoFile.content) {
          protoContent = protoFile.content;
        }
      } catch (err) {
        console.error(`[ENGINE] Failed to resolve proto file by ID ${protoId}:`, err);
      }
    }
    const caCertCache = /* @__PURE__ */ new Map();
    const resolveCaCert = async (selectedCaId) => {
      if (!selectedCaId || selectedCaId === ACCEPT_ALL_CA) return void 0;
      if (caCertCache.has(selectedCaId)) return caCertCache.get(selectedCaId);
      console.log(`[ENGINE] Fetching CA cert by ID: ${selectedCaId}`);
      try {
        const caDbId = selectedCaId.includes(":") ? selectedCaId.split(":")[1] : selectedCaId;
        const caRecord = await db$1.select(new RecordId("ca_cert", caDbId));
        const caFile = Array.isArray(caRecord) ? caRecord[0] : caRecord;
        if (caFile && caFile.content) {
          const cert = caFile.content;
          caCertCache.set(selectedCaId, cert);
          console.log(`[ENGINE] CA cert loaded: ${caFile.name || caDbId}`);
          return cert;
        }
      } catch (err) {
        console.error(`[ENGINE] Failed to resolve CA cert by ID ${selectedCaId}:`, err);
      }
      caCertCache.set(selectedCaId, void 0);
      return void 0;
    };
    const caCert = await resolveCaCert(defaultCaId);
    const parsedProto = parseProtoContent(protoContent);
    const formPayload = customContext.form || {};
    const context = {
      steps: {},
      auth: {},
      form: formPayload,
      dashboard_form: formPayload,
      ...customContext
    };
    let authToken;
    if (connectionId) {
      console.log(`[AUTH] Fetching connection details for ID: ${connectionId}`);
      try {
        const connDbId = connectionId.includes(":") ? connectionId.split(":")[1] : connectionId;
        const connRecord = await db$1.select(new RecordId("connection", connDbId));
        const rawConnection = Array.isArray(connRecord) ? connRecord[0] : connRecord;
        if (rawConnection) {
          const connection = normalizeConnection(rawConnection);
          console.log(`[AUTH] Resolving workflow connection auth: ${connection.name}`);
          if (connection.authType === "bearer" && connection.bearerToken) {
            authToken = connection.bearerToken;
            context.auth = {
              token: authToken
            };
          } else if (connection.authType === "basic" && (connection.username || connection.password)) {
            authToken = Buffer.from(`${connection.username || ""}:${connection.password || ""}`).toString("base64");
            context.auth = {
              token: authToken
            };
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
              tokenPath: connection.tokenPath
            });
            if (!tokenRes.success) {
              throw new Error(tokenRes.error);
            }
            authToken = tokenRes.token;
            context.auth = {
              token: authToken,
              response: tokenRes.response
            };
            console.log(`[AUTH] Success. Connection token obtained.`);
          }
        } else {
          throw new Error(`Connection ${connectionId} not found in database`);
        }
      } catch (err) {
        throw new Error(`Connection Setup Error: ${err.message}`);
      }
    } else if (authConfig) {
      if (authConfig.type === "static") {
        console.log(`[AUTH] Using static token`);
        authToken = authConfig.bearerToken;
        context.auth = {
          token: authToken
        };
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
            serviceName: authConfig.serviceName,
            methodName: authConfig.methodName,
            requestBody: authPayload
          });
          if (authResult.success) {
            authToken = get(authResult.data, authConfig.tokenPath);
            context.auth = {
              token: authToken,
              response: authResult.data
            };
            console.log(`[AUTH] Success. Token obtained.`);
          } else {
            throw new Error(`Authentication failed: ${authResult.error}`);
          }
        } catch (err) {
          throw new Error(`Auth Setup Error: ${err.message}`);
        }
      } else if (authConfig.type === "rest") {
        console.log(`[AUTH] Executing REST auth call: ${authConfig.method} ${authConfig.url}`);
        try {
          const headers = {
            "Content-Type": "application/json"
          };
          if (authConfig.authScheme === "basic" && (authConfig.username || authConfig.password)) {
            const auth = Buffer.from(`${authConfig.username || ""}:${authConfig.password || ""}`).toString("base64");
            headers["Authorization"] = `Basic ${auth}`;
          } else if (authConfig.authScheme === "bearer" && authConfig.bearerToken) {
            headers["Authorization"] = `Bearer ${authConfig.bearerToken}`;
          } else if (!authConfig.authScheme && (authConfig.username || authConfig.password)) {
            const auth = Buffer.from(`${authConfig.username || ""}:${authConfig.password || ""}`).toString("base64");
            headers["Authorization"] = `Basic ${auth}`;
          }
          let authUrl = authConfig.url || "";
          if (authUrl && !authUrl.startsWith("http://") && !authUrl.startsWith("https://")) {
            if (/^[a-zA-Z0-9._-]+(:\d+)/.test(authUrl.split("/")[0])) {
              authUrl = `http://${authUrl}`;
            } else {
              const separator = authUrl.startsWith("/") ? "" : "/";
              const port = process.env.PORT || 3e3;
              authUrl = `http://127.0.0.1:${port}${separator}${authUrl}`;
            }
          }
          const res = await fetch(authUrl, {
            method: authConfig.method || "POST",
            headers,
            body: authConfig.method !== "GET" ? authConfig.body || "{}" : void 0
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
          }
          const authData = await res.json();
          authToken = get(authData, authConfig.tokenPath);
          context.auth = {
            token: authToken,
            response: authData
          };
          console.log(`[AUTH] Success. REST token obtained.`);
        } catch (err) {
          throw new Error(`REST Auth Error: ${err.message}`);
        }
      }
    }
    const executionSteps = sortStepsTopologically(steps || []);
    for (const step of executionSteps) {
      const stepResult = await Sentry.startSpan({
        name: `step: ${step.id} (${step.type || "grpc"})`,
        op: "workflow.step",
        attributes: {
          "workflow.step.id": step.id,
          "workflow.step.type": step.type || "grpc"
        }
      }, async () => {
        let stepAuthHeader = await getStepAuthHeader(step, db$1);
        if (!stepAuthHeader && authToken) {
          stepAuthHeader = `Bearer ${authToken}`;
        }
        emitWorkflowEvent(runId, workflow.id || "", "step_start", {
          stepId: step.id,
          stepType: step.type || "grpc"
        });
        if (step.type === "grpc_stream") {
          let requestPayload2;
          const exactMatch2 = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
          if (exactMatch2) {
            requestPayload2 = get(context, exactMatch2[1].trim());
          } else {
            try {
              const parsedTemplate = JSON.parse(step.requestBodyTemplate || "{}");
              requestPayload2 = evaluatePayload(parsedTemplate, context);
            } catch (e) {
              requestPayload2 = {};
            }
          }
          const chunks = [];
          let streamError = void 0;
          const stepCaId2 = step.caId ?? defaultCaId;
          const stepCaCert = await resolveCaCert(stepCaId2);
          await new Promise((resolve) => {
            executeGrpcStreamCall({
              protoContent,
              serverAddress: step.serverAddress || serverAddress,
              useTls: stepCaId2 !== "",
              caCert: stepCaCert,
              acceptInvalidCert: stepCaId2 === ACCEPT_ALL_CA,
              serviceName: step.serviceName || "",
              methodName: step.methodName || "",
              requestBody: requestPayload2
            }, (chunk) => {
              chunks.push(chunk);
              emitWorkflowEvent(runId, workflow.id || "", "step_chunk", {
                stepId: step.id,
                chunk
              });
            }, (err) => {
              streamError = err.message || String(err);
              resolve();
            }, () => resolve());
          });
          const success = !streamError;
          context.steps[step.id] = {
            request: requestPayload2,
            response: chunks,
            error: streamError
          };
          runRecord.logs.push({
            stepId: step.id,
            stepType: "grpc_stream",
            status: success ? "success" : "error",
            request: requestPayload2,
            response: chunks,
            error: streamError
          });
          runRecord.context = context;
          const {
            id: _t12,
            ...data12
          } = runRecord;
          const sId12 = new RecordId("workflow_run", dbId);
          await db$1.query("UPDATE $id CONTENT $data", {
            id: sId12,
            data: data12
          });
          if (!success) {
            emitWorkflowEvent(runId, workflow.id || "", "step_failed", {
              stepId: step.id,
              error: streamError
            });
            runRecord.status = "failed";
            runRecord.endTime = (/* @__PURE__ */ new Date()).toISOString();
            const {
              id: _t2,
              ...data2
            } = runRecord;
            const sId2 = new RecordId("workflow_run", dbId);
            await db$1.query("UPDATE $id CONTENT $data", {
              id: sId2,
              data: data2
            });
            return "abort";
          }
          emitWorkflowEvent(runId, workflow.id || "", "step_complete", {
            stepId: step.id,
            response: chunks
          });
          return "continue";
        }
        if (step.type === "rest_stream") {
          let requestPayload2;
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
              const port = process.env.PORT || 3e3;
              evaluatedUrl = `http://127.0.0.1:${port}${separator}${evaluatedUrl}`;
            }
          }
          const chunks = [];
          let streamError = void 0;
          const stepCaId2 = step.caId ?? defaultCaId;
          const stepCaCert = await resolveCaCert(stepCaId2);
          await new Promise((resolve) => {
            executeHttpStreamCall({
              url: evaluatedUrl,
              method: step.restMethod || "GET",
              body: step.requestBodyTemplate ? evaluatePayload(JSON.parse(step.requestBodyTemplate), context) : void 0,
              tls: stepCaId2 ? {
                ca: stepCaCert,
                rejectUnauthorized: stepCaId2 !== ACCEPT_ALL_CA
              } : void 0
            }, (chunk) => {
              chunks.push(chunk);
              emitWorkflowEvent(runId, workflow.id || "", "step_chunk", {
                stepId: step.id,
                chunk
              });
            }, (err) => {
              streamError = err.message || String(err);
              resolve();
            }, () => resolve());
          });
          const success = !streamError;
          context.steps[step.id] = {
            request: evaluatedUrl,
            response: chunks,
            error: streamError
          };
          runRecord.logs.push({
            stepId: step.id,
            stepType: "rest_stream",
            status: success ? "success" : "error",
            request: {
              url: evaluatedUrl,
              method: step.restMethod || "GET"
            },
            response: chunks,
            error: streamError
          });
          runRecord.context = context;
          const {
            id: _t12,
            ...data12
          } = runRecord;
          const sId12 = new RecordId("workflow_run", dbId);
          await db$1.query("UPDATE $id CONTENT $data", {
            id: sId12,
            data: data12
          });
          if (!success) {
            emitWorkflowEvent(runId, workflow.id || "", "step_failed", {
              stepId: step.id,
              error: streamError
            });
            runRecord.status = "failed";
            runRecord.endTime = (/* @__PURE__ */ new Date()).toISOString();
            const {
              id: _t2,
              ...data2
            } = runRecord;
            const sId2 = new RecordId("workflow_run", dbId);
            await db$1.query("UPDATE $id CONTENT $data", {
              id: sId2,
              data: data2
            });
            return "abort";
          }
          emitWorkflowEvent(runId, workflow.id || "", "step_complete", {
            stepId: step.id,
            response: chunks
          });
          return "continue";
        }
        if (step.type === "surreal_live") {
          const targetTable = step.requestBodyTemplate?.trim() || "workflow_run";
          let targetDbName = interpolateTemplate(step.databaseName || "", context) || void 0;
          let targetDbUrl = interpolateTemplate(step.databaseUrl || "", context) || void 0;
          let targetDbUser = interpolateTemplate(step.databaseUser || "", context) || void 0;
          let targetDbPass = interpolateTemplate(step.databasePass || "", context) || void 0;
          let targetDbNs = interpolateTemplate(step.databaseNs || "", context) || void 0;
          if (step.connectionId && (!targetDbUrl || !targetDbName)) {
            try {
              const connDbId = step.connectionId.includes(":") ? step.connectionId.split(":")[1] : step.connectionId;
              const connRecord = await db$1.select(new RecordId("connection", connDbId));
              const rawConn = Array.isArray(connRecord) ? connRecord[0] : connRecord;
              if (rawConn) {
                const conn = normalizeConnection(rawConn);
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
          const chunks = [];
          let streamError = void 0;
          try {
            const {
              getCustomDb: getCustomDb2
            } = await Promise.resolve().then(() => db);
            const ddb = await getCustomDb2({
              url: targetDbUrl,
              user: targetDbUser,
              pass: targetDbPass,
              namespace: targetDbNs,
              database: targetDbName
            });
            const liveUuid = await ddb.live(targetTable, (action, result) => {
              const eventData = {
                action,
                result,
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              };
              chunks.push(eventData);
              emitWorkflowEvent(runId, workflow.id || "", "step_chunk", {
                stepId: step.id,
                chunk: eventData
              });
            });
            await new Promise((r) => setTimeout(r, 2e3));
            await ddb.kill(liveUuid).catch(() => {
            });
          } catch (err) {
            streamError = err.message || String(err);
          }
          const success = !streamError;
          context.steps[step.id] = {
            request: `LIVE SELECT * FROM ${targetTable}`,
            response: chunks,
            error: streamError
          };
          runRecord.logs.push({
            stepId: step.id,
            stepType: "surreal_live",
            status: success ? "success" : "error",
            request: targetTable,
            response: chunks,
            error: streamError
          });
          runRecord.context = context;
          const {
            id: _t12,
            ...data12
          } = runRecord;
          const sId12 = new RecordId("workflow_run", dbId);
          await db$1.query("UPDATE $id CONTENT $data", {
            id: sId12,
            data: data12
          });
          if (!success) {
            emitWorkflowEvent(runId, workflow.id || "", "step_failed", {
              stepId: step.id,
              error: streamError
            });
            runRecord.status = "failed";
            runRecord.endTime = (/* @__PURE__ */ new Date()).toISOString();
            const {
              id: _t2,
              ...data2
            } = runRecord;
            const sId2 = new RecordId("workflow_run", dbId);
            await db$1.query("UPDATE $id CONTENT $data", {
              id: sId2,
              data: data2
            });
            return "abort";
          }
          emitWorkflowEvent(runId, workflow.id || "", "step_complete", {
            stepId: step.id,
            response: chunks
          });
          return "continue";
        }
        if (step.type === "transform") {
          let transformedResult;
          let transformError;
          try {
            const sourceIds = step.sourceStepIds && step.sourceStepIds.length > 0 ? step.sourceStepIds : [];
            const sourcesData = sourceIds.map((srcId) => context.steps[srcId]?.response).filter((v) => v !== void 0);
            const primaryInput = sourcesData.length === 1 ? sourcesData[0] : sourcesData;
            const evaluationScope = {
              ...context,
              steps: context.steps,
              source: primaryInput,
              sources: sourcesData,
              data: primaryInput
            };
            const exprString = (step.transformExpression || "").trim() || "$";
            const expression = jsonata(exprString);
            transformedResult = await expression.evaluate(evaluationScope);
            if (transformedResult === void 0) {
              transformedResult = null;
            }
          } catch (err) {
            transformError = err.message || String(err);
            transformedResult = {
              error: `Transform Error: ${transformError}`
            };
          }
          const success = !transformError;
          context.steps[step.id] = {
            request: step.transformExpression,
            response: transformedResult,
            error: transformError
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
              transformExpression: step.transformExpression
            }
          });
          const {
            id: _t_tr,
            ...data_tr
          } = runRecord;
          const sId_tr = new RecordId("workflow_run", dbId);
          await db$1.query("UPDATE $id CONTENT $data", {
            id: sId_tr,
            data: data_tr
          });
          if (!success) {
            emitWorkflowEvent(runId, workflow.id || "", "step_failed", {
              stepId: step.id,
              error: transformError
            });
            runRecord.status = "failed";
            runRecord.endTime = (/* @__PURE__ */ new Date()).toISOString();
            const {
              id: _t_tr2,
              ...data_tr2
            } = runRecord;
            const sId_tr2 = new RecordId("workflow_run", dbId);
            await db$1.query("UPDATE $id CONTENT $data", {
              id: sId_tr2,
              data: data_tr2
            });
            return "abort";
          }
          emitWorkflowEvent(runId, workflow.id || "", "step_complete", {
            stepId: step.id,
            response: transformedResult
          });
          return "continue";
        }
        if (step.type === "table" || step.type === "chart" || step.type === "infographic") {
          let payload;
          const sourceIds = step.sourceStepIds && step.sourceStepIds.length > 0 ? step.sourceStepIds : [];
          if (sourceIds.length > 0) {
            const sourcesData = sourceIds.map((srcId) => context.steps[srcId]?.response).filter((v) => v !== void 0);
            if (step.requestBodyTemplate?.trim()) {
              try {
                const exactMatch2 = step.requestBodyTemplate.trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
                if (exactMatch2) {
                  payload = get(context, exactMatch2[1].trim());
                } else {
                  payload = evaluatePayload(JSON.parse(step.requestBodyTemplate), context);
                }
              } catch {
                payload = interpolateTemplate(step.requestBodyTemplate, context);
              }
            } else if (sourcesData.length === 1) {
              payload = sourcesData[0];
            } else if (sourcesData.length > 1) {
              const allArrays = sourcesData.every((d) => {
                const parsed = parseJsonString(d);
                return Array.isArray(parsed);
              });
              if (allArrays) {
                payload = sourcesData.flatMap((d) => {
                  const parsed = parseJsonString(d);
                  return Array.isArray(parsed) ? parsed : [parsed];
                });
              } else {
                payload = sourcesData.reduce((acc, curr, idx) => {
                  const key = sourceIds[idx] || `source_${idx + 1}`;
                  acc[key] = curr;
                  return acc;
                }, {});
              }
            }
          } else {
            try {
              const exactMatch2 = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
              if (exactMatch2) {
                payload = get(context, exactMatch2[1].trim());
              } else {
                payload = evaluatePayload(JSON.parse(step.requestBodyTemplate || "{}"), context);
              }
            } catch (e) {
              payload = {
                error: `Failed to evaluate visual data source: ${e.message}`
              };
            }
          }
          let visData = parseJsonString(payload);
          if (step.dataPath && visData && typeof visData === "object") {
            visData = get(visData, step.dataPath);
          }
          visData = normalizeVisualData(visData);
          context.steps[step.id] = {
            request: step.requestBodyTemplate,
            response: visData
          };
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
              chartType: step.chartType || "bar",
              columns: step.columns || [],
              infographicSyntax: step.infographicSyntax,
              infographicTemplate: step.infographicTemplate
            }
          });
          const {
            id: _t_v,
            ...data_v
          } = runRecord;
          const sId_v = new RecordId("workflow_run", dbId);
          await db$1.query("UPDATE $id CONTENT $data", {
            id: sId_v,
            data: data_v
          });
          return "continue";
        }
        if (step.type === "database") {
          let queryPayload;
          try {
            const parsedTemplate = JSON.parse(step.requestBodyTemplate || "{}");
            queryPayload = evaluatePayload(parsedTemplate, context);
          } catch (e) {
            queryPayload = interpolateTemplate(step.requestBodyTemplate || "", context);
          }
          let execResult2;
          let latencyMs = 0;
          try {
            const startTimeMs = Date.now();
            let targetDbName = interpolateTemplate(step.databaseName || "", context) || void 0;
            let targetDbUrl = interpolateTemplate(step.databaseUrl || "", context) || void 0;
            let targetDbUser = interpolateTemplate(step.databaseUser || "", context) || void 0;
            let targetDbPass = interpolateTemplate(step.databasePass || "", context) || void 0;
            let targetDbNs = interpolateTemplate(step.databaseNs || "", context) || void 0;
            if (step.connectionId && (!targetDbUrl || !targetDbName)) {
              try {
                const connDbId = step.connectionId.includes(":") ? step.connectionId.split(":")[1] : step.connectionId;
                const connRecord = await db$1.select(new RecordId("connection", connDbId));
                const rawConn = Array.isArray(connRecord) ? connRecord[0] : connRecord;
                if (rawConn) {
                  const conn = normalizeConnection(rawConn);
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
            const {
              getCustomDb: getCustomDb2
            } = await Promise.resolve().then(() => db);
            const ddb = await getCustomDb2({
              url: targetDbUrl,
              user: targetDbUser,
              pass: targetDbPass,
              namespace: targetDbNs,
              database: targetDbName
            });
            const surrealResult = await ddb.query(queryPayload);
            latencyMs = Date.now() - startTimeMs;
            execResult2 = {
              success: true,
              data: surrealResult
            };
          } catch (err) {
            execResult2 = {
              success: false,
              error: err.message
            };
          }
          let responseData = execResult2.success ? execResult2.data : void 0;
          if (Array.isArray(responseData) && responseData.length > 0 && Array.isArray(responseData[0])) {
            responseData = responseData[0];
          }
          context.steps[step.id] = {
            request: queryPayload,
            response: responseData,
            error: !execResult2.success ? execResult2.error : void 0
          };
          const logRecord2 = {
            stepId: step.id,
            stepType: "database",
            // casting to avoid strict type error if not updated in other places
            status: execResult2.success ? "success" : "error",
            request: queryPayload,
            response: responseData,
            error: execResult2.error,
            latencyMs
          };
          runRecord.logs.push(logRecord2);
          runRecord.context = context;
          const {
            id: _t12,
            ...data12
          } = runRecord;
          const sId12 = new RecordId("workflow_run", dbId);
          await db$1.query("UPDATE $id CONTENT $data", {
            id: sId12,
            data: data12
          });
          if (!execResult2.success) {
            runRecord.status = "failed";
            runRecord.endTime = (/* @__PURE__ */ new Date()).toISOString();
            const {
              id: _t2,
              ...data2
            } = runRecord;
            const sId2 = new RecordId("workflow_run", dbId);
            await db$1.query("UPDATE $id CONTENT $data", {
              id: sId2,
              data: data2
            });
            return "abort";
          }
          return "continue";
        }
        if (step.type === "rest") {
          let requestPayload2;
          let evaluatedUrl = step.restUrl || "";
          try {
            evaluatedUrl = interpolateTemplate(step.restUrl || "", context);
          } catch (e) {
            evaluatedUrl = step.restUrl || "";
          }
          if (evaluatedUrl && !evaluatedUrl.startsWith("http://") && !evaluatedUrl.startsWith("https://")) {
            if (/^[a-zA-Z0-9._-]+(:\d+)/.test(evaluatedUrl.split("/")[0])) {
              evaluatedUrl = `http://${evaluatedUrl}`;
            } else {
              const separator = evaluatedUrl.startsWith("/") ? "" : "/";
              const port = process.env.PORT || 3e3;
              evaluatedUrl = `http://127.0.0.1:${port}${separator}${evaluatedUrl}`;
            }
          }
          const method = step.restMethod || "GET";
          const hasBody = method !== "GET" && method !== "DELETE";
          if (hasBody) {
            const exactMatch2 = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
            if (exactMatch2) {
              requestPayload2 = get(context, exactMatch2[1].trim());
            } else {
              try {
                const parsedTemplate = JSON.parse(step.requestBodyTemplate || "{}");
                requestPayload2 = evaluatePayload(parsedTemplate, context);
              } catch (e) {
                requestPayload2 = interpolateTemplate(step.requestBodyTemplate || "", context);
              }
            }
          }
          let metadata2 = {};
          if (stepAuthHeader) {
            metadata2["Authorization"] = stepAuthHeader;
          }
          if (step.headersTemplate) {
            try {
              const parsedHeaders = JSON.parse(step.headersTemplate);
              const evaluatedHeaders = evaluatePayload(parsedHeaders, context);
              for (const [key, value] of Object.entries(evaluatedHeaders)) {
                metadata2[key] = String(value);
              }
            } catch (e) {
              console.error(`Failed to parse/evaluate headers for REST step ${step.id}:`, e);
            }
          }
          let execResult2;
          let latencyMs = 0;
          try {
            const startTimeMs = Date.now();
            const fetchOptions = {
              method,
              headers: metadata2
            };
            const stepCaId2 = step.caId ?? defaultCaId;
            const stepCaCert = await resolveCaCert(stepCaId2);
            if (stepCaId2) {
              fetchOptions.tls = {
                ca: stepCaCert,
                rejectUnauthorized: stepCaId2 !== ACCEPT_ALL_CA
              };
            }
            if (hasBody && requestPayload2 !== void 0) {
              fetchOptions.body = typeof requestPayload2 === "object" ? JSON.stringify(requestPayload2) : String(requestPayload2);
              if (!fetchOptions.headers) fetchOptions.headers = {};
              if (!fetchOptions.headers["Content-Type"] && typeof requestPayload2 === "object") {
                fetchOptions.headers["Content-Type"] = "application/json";
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
            execResult2 = {
              success: true,
              data,
              latencyMs
            };
          } catch (err) {
            execResult2 = {
              success: false,
              error: err.message,
              latencyMs
            };
          }
          context.steps[step.id] = {
            request: requestPayload2,
            url: evaluatedUrl,
            response: execResult2.success ? execResult2.data : void 0,
            error: !execResult2.success ? execResult2.error : void 0
          };
          const logRecord2 = {
            stepId: step.id,
            stepType: "rest",
            status: execResult2.success ? "success" : "error",
            request: {
              url: evaluatedUrl,
              method,
              body: requestPayload2
            },
            response: execResult2.success ? execResult2.data : void 0,
            error: execResult2.error,
            latencyMs: execResult2.latencyMs
          };
          runRecord.logs.push(logRecord2);
          runRecord.context = context;
          const {
            id: _t12,
            ...data12
          } = runRecord;
          const sId12 = new RecordId("workflow_run", dbId);
          await db$1.query("UPDATE $id CONTENT $data", {
            id: sId12,
            data: data12
          });
          if (!execResult2.success) {
            runRecord.status = "failed";
            runRecord.endTime = (/* @__PURE__ */ new Date()).toISOString();
            const {
              id: _t2,
              ...data2
            } = runRecord;
            const sId2 = new RecordId("workflow_run", dbId);
            await db$1.query("UPDATE $id CONTENT $data", {
              id: sId2,
              data: data2
            });
            return "abort";
          }
          return "continue";
        }
        let requestPayload;
        const exactMatch = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
        if (exactMatch) {
          requestPayload = get(context, exactMatch[1].trim());
        } else {
          let parsedTemplate;
          try {
            parsedTemplate = JSON.parse(step.requestBodyTemplate || "{}");
          } catch (e) {
            throw new Error(`Invalid request payload in step ${step.id}: Must be a JSON object or a single exact template {{ variable }}. Error: ${e.message}`);
          }
          requestPayload = evaluatePayload(parsedTemplate, context);
        }
        let metadata = {};
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
          metadata
        });
        context.steps[step.id] = {
          request: requestPayload,
          response: execResult.success ? execResult.data : void 0,
          error: !execResult.success ? execResult.error || "Unknown Error" : void 0
        };
        const logRecord = {
          stepId: step.id,
          stepType: "grpc",
          status: execResult.success ? "success" : "error",
          request: requestPayload,
          response: execResult.data,
          error: execResult.error,
          latencyMs: execResult.latencyMs
        };
        runRecord.logs.push(logRecord);
        runRecord.context = context;
        const {
          id: _t1,
          ...data1
        } = runRecord;
        const sId1 = new RecordId("workflow_run", dbId);
        await db$1.query("UPDATE $id CONTENT $data", {
          id: sId1,
          data: data1
        });
        if (!execResult.success) {
          runRecord.status = "failed";
          runRecord.endTime = (/* @__PURE__ */ new Date()).toISOString();
          const {
            id: _t2,
            ...data2
          } = runRecord;
          const sId2 = new RecordId("workflow_run", dbId);
          await db$1.query("UPDATE $id CONTENT $data", {
            id: sId2,
            data: data2
          });
          return "abort";
        }
        return "continue";
      });
      if (stepResult === "abort") return;
    }
    runRecord.status = "completed";
    runRecord.endTime = (/* @__PURE__ */ new Date()).toISOString();
    const {
      id: _t3,
      ...data3
    } = runRecord;
    const sId3 = new RecordId("workflow_run", dbId);
    await db$1.query("UPDATE $id CONTENT $data", {
      id: sId3,
      data: data3
    });
    emitWorkflowEvent(runId, workflow.id || "", "workflow_complete", {
      runId,
      workflowId: workflow.id,
      status: "completed",
      endTime: runRecord.endTime
    });
  } catch (error) {
    Sentry.captureException(error);
    runRecord.status = "failed";
    runRecord.endTime = (/* @__PURE__ */ new Date()).toISOString();
    runRecord.logs.push({
      stepId: "SYSTEM",
      status: "error",
      request: null,
      error: error.message
    });
    const {
      id: _t4,
      ...data4
    } = runRecord;
    const sId4 = new RecordId("workflow_run", dbId);
    await db$1.query("UPDATE $id CONTENT $data", {
      id: sId4,
      data: data4
    });
    emitWorkflowEvent(runId, workflow.id || "", "workflow_failed", {
      runId,
      workflowId: workflow.id,
      status: "failed",
      error: error.message,
      endTime: runRecord.endTime
    });
  }
}
const console$2 = {
  log: (...args) => logger.info(...args),
  error: (...args) => logger.error(...args),
  warn: (...args) => logger.warn(...args)
};
const scheduledJobs = /* @__PURE__ */ new Map();
async function initWorkflowScheduler() {
  console$2.log("Initializing workflow scheduler...");
  try {
    const db2 = await getDb();
    const result = await db2.query("SELECT * FROM workflow WHERE schedule AND schedule != ''");
    const workflows = result[0] || [];
    for (const wfData of workflows) {
      if (wfData.schedule) {
        scheduleWorkflow(wfData);
      }
    }
    console$2.log(`Initialized scheduler with ${workflows.length} workflows.`);
  } catch (error) {
    console$2.error("Failed to initialize workflow scheduler:", error);
  }
}
function scheduleWorkflow(workflow) {
  const workflowId = workflow.id.toString().replace(/[⟨⟩]/g, "");
  if (scheduledJobs.has(workflowId)) {
    console$2.log(`Unscheduling workflow: ${workflowId}`);
    scheduledJobs.get(workflowId)?.stop();
    scheduledJobs.delete(workflowId);
  }
  if (!workflow.schedule) return;
  try {
    const job = cron.schedule(workflow.schedule, async () => {
      console$2.log(`Running scheduled workflow: ${workflow.name} (${workflowId})`);
      const runId = `workflow_run:${v4()}`;
      const normalizedWorkflow = {
        ...workflow,
        id: workflowId
      };
      try {
        await runWorkflowBackground(normalizedWorkflow, runId);
      } catch (err) {
        console$2.error(`Scheduled run failed for ${workflowId}:`, err);
      }
    });
    scheduledJobs.set(workflowId, job);
    console$2.log(`Scheduled workflow: ${workflow.name} (${workflowId}) with cron: ${workflow.schedule}`);
  } catch (err) {
    console$2.error(`Failed to schedule workflow ${workflowId} with cron "${workflow.schedule}":`, err);
  }
}
function unscheduleWorkflow(id) {
  const workflowId = id.toString().replace(/[⟨⟩]/g, "");
  if (scheduledJobs.has(workflowId)) {
    console$2.log(`Unscheduling workflow: ${workflowId}`);
    scheduledJobs.get(workflowId)?.stop();
    scheduledJobs.delete(workflowId);
  }
}
const console$1 = {
  log: (...args) => logger.info(...args),
  error: (...args) => logger.error(...args),
  warn: (...args) => logger.warn(...args)
};
const QUERY_MAX_LEN = 300;
function truncate(s, max = QUERY_MAX_LEN) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
function resourceName(thing) {
  if (!thing) return "unknown";
  if (typeof thing === "string") return thing.split(":")[0];
  if (thing.tb) return String(thing.tb);
  return String(thing);
}
class TracedDb {
  inner;
  dbLabel;
  constructor(inner, label = "main") {
    this.inner = inner;
    this.dbLabel = label;
  }
  /** Forward .query() with a Sentry span */
  async query(surql, vars) {
    console$1.log(`[DB] Executing query: ${truncate(surql, 100)}`);
    return Sentry.startSpan({
      name: truncate(surql, 80),
      op: "db.query",
      attributes: {
        "db.system": "surrealdb",
        "db.name": this.dbLabel,
        "db.statement": truncate(surql)
      }
    }, async (span) => {
      try {
        const result = await this.inner.query(surql, vars);
        if (Array.isArray(result)) {
          const first = result[0];
          if (Array.isArray(first)) {
            console$1.log(`[DB] Query returned ${first.length} rows`);
            span.setAttribute("db.row_count", first.length);
          }
        }
        return result;
      } catch (err) {
        console$1.error(`[DB] Query failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .select() with a Sentry span */
  async select(thing) {
    const resource = resourceName(thing);
    console$1.log(`[DB] SELECT ${resource}`);
    return Sentry.startSpan({
      name: `SELECT ${resource}`,
      op: "db.select",
      attributes: {
        "db.system": "surrealdb",
        "db.name": this.dbLabel,
        "db.collection.name": resource
      }
    }, async (span) => {
      try {
        const result = await this.inner.select(thing);
        if (Array.isArray(result)) {
          console$1.log(`[DB] SELECT ${resource} returned ${result.length} rows`);
          span.setAttribute("db.row_count", result.length);
        }
        return result;
      } catch (err) {
        console$1.error(`[DB] SELECT ${resource} failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .create() with a Sentry span */
  async create(thing, data) {
    const resource = resourceName(thing);
    console$1.log(`[DB] CREATE ${resource}`);
    return Sentry.startSpan({
      name: `CREATE ${resource}`,
      op: "db.create",
      attributes: {
        "db.system": "surrealdb",
        "db.name": this.dbLabel,
        "db.collection.name": resource
      }
    }, async () => {
      try {
        const res = await this.inner.create(thing, data);
        console$1.log(`[DB] CREATE ${resource} successful`);
        return res;
      } catch (err) {
        console$1.error(`[DB] CREATE ${resource} failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .update() with a Sentry span */
  async update(thing, data) {
    const resource = resourceName(thing);
    console$1.log(`[DB] UPDATE ${resource}`);
    return Sentry.startSpan({
      name: `UPDATE ${resource}`,
      op: "db.update",
      attributes: {
        "db.system": "surrealdb",
        "db.name": this.dbLabel,
        "db.collection.name": resource
      }
    }, async () => {
      try {
        const res = await this.inner.update(thing, data);
        console$1.log(`[DB] UPDATE ${resource} successful`);
        return res;
      } catch (err) {
        console$1.error(`[DB] UPDATE ${resource} failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .delete() with a Sentry span */
  async delete(thing) {
    const resource = resourceName(thing);
    console$1.log(`[DB] DELETE ${resource}`);
    return Sentry.startSpan({
      name: `DELETE ${resource}`,
      op: "db.delete",
      attributes: {
        "db.system": "surrealdb",
        "db.name": this.dbLabel,
        "db.collection.name": resource
      }
    }, async () => {
      try {
        const res = await this.inner.delete(thing);
        console$1.log(`[DB] DELETE ${resource} successful`);
        return res;
      } catch (err) {
        console$1.error(`[DB] DELETE ${resource} failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .use() with a Sentry span */
  async use(opts) {
    console$1.log(`[DB] USE NS:${opts.namespace} DB:${opts.database}`);
    return Sentry.startSpan({
      name: `USE ${opts.namespace || ""}/${opts.database || ""}`,
      op: "db.use",
      attributes: {
        "db.system": "surrealdb",
        "db.namespace": opts.namespace || "",
        "db.name": opts.database || ""
      }
    }, async () => {
      try {
        return await this.inner.use(opts);
      } catch (err) {
        console$1.error(`[DB] USE failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .live() with a Sentry span */
  async live(table, callback) {
    console$1.log(`[DB] LIVE ${table}`);
    return Sentry.startSpan({
      name: `LIVE ${table}`,
      op: "db.live",
      attributes: {
        "db.system": "surrealdb",
        "db.name": this.dbLabel,
        "db.collection.name": table
      }
    }, async () => {
      try {
        const queryUuid = await this.inner.live(table, callback);
        console$1.log(`[DB] LIVE ${table} started with UUID ${queryUuid}`);
        return queryUuid;
      } catch (err) {
        console$1.error(`[DB] LIVE ${table} failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .subscribeLive() or .listenLive() */
  async subscribeLive(queryUuid, callback) {
    if (typeof this.inner.subscribeLive === "function") {
      await this.inner.subscribeLive(queryUuid, callback);
    } else if (typeof this.inner.listenLive === "function") {
      await this.inner.listenLive(queryUuid, callback);
    }
  }
  /** Forward .kill() to terminate a live query */
  async kill(queryUuid) {
    console$1.log(`[DB] KILL LIVE ${queryUuid}`);
    try {
      await this.inner.kill(queryUuid);
    } catch (err) {
      console$1.error(`[DB] KILL LIVE ${queryUuid} failed: ${err.message}`);
    }
  }
}
let dbPromise = null;
const dynamicDbs = /* @__PURE__ */ new Map();
const DEFAULT_SURREALDB_URL = "wss://ux-ti-06g5t3b4ldol77m9fqh7a91jv8.azure-gwc.surreal.cloud/rpc";
const DEFAULT_SURREALDB_USER = "solid";
const DEFAULT_SURREALDB_PASS = "sol1d";
const DEFAULT_SURREALDB_NS = "solidflow";
const DEFAULT_SURREALDB_DB = "main";
async function getDb() {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = Sentry.startSpan({
    name: "SurrealDB Connect (main)",
    op: "db.connect",
    attributes: {
      "db.system": "surrealdb"
    }
  }, async (connectSpan) => {
    const url = process.env.SURREALDB_URL || DEFAULT_SURREALDB_URL;
    const user = process.env.SURREALDB_USER || DEFAULT_SURREALDB_USER;
    const pass = process.env.SURREALDB_PASS || DEFAULT_SURREALDB_PASS;
    const namespace = process.env.SURREALDB_NS || DEFAULT_SURREALDB_NS;
    const database = process.env.SURREALDB_DB || DEFAULT_SURREALDB_DB;
    connectSpan.setAttribute("db.url", url);
    connectSpan.setAttribute("db.namespace", namespace);
    connectSpan.setAttribute("db.name", database);
    console$1.log(`[DB] [INIT] Connecting to SurrealDB at ${url}...`);
    try {
      const db2 = new Surreal();
      console$1.log(`[DB] [INIT] Authenticating as user: ${user}`);
      try {
        await db2.connect(url, {
          authentication: {
            namespace,
            database,
            username: user,
            password: pass
          }
        });
      } catch {
        await db2.connect(url, {
          authentication: {
            username: user,
            password: pass
          }
        });
      }
      try {
        console$1.log(`[DB] [INIT] Ensuring namespace exists: ${namespace}`);
        await db2.query(`DEFINE NAMESPACE IF NOT EXISTS ${namespace}`);
      } catch (e) {
      }
      await db2.use({
        namespace
      });
      try {
        console$1.log(`[DB] [INIT] Ensuring database exists: ${database}`);
        await db2.query(`DEFINE DATABASE IF NOT EXISTS ${database}`);
      } catch (e) {
      }
      await db2.use({
        namespace,
        database
      });
      try {
        await db2.query(`
                        DEFINE TABLE IF NOT EXISTS workflow TYPE NORMAL SCHEMALESS PERMISSIONS FULL;
                        DEFINE TABLE IF NOT EXISTS connection TYPE NORMAL SCHEMALESS PERMISSIONS FULL;
                        DEFINE TABLE IF NOT EXISTS workflow_run TYPE NORMAL SCHEMALESS PERMISSIONS FULL;
                        DEFINE TABLE IF NOT EXISTS dashboard TYPE NORMAL SCHEMALESS PERMISSIONS FULL;
                    `);
      } catch (e) {
      }
      console$1.log(`[DB] [INIT] Successfully connected to ${namespace}/${database}`);
      if (typeof window === "undefined") {
        console$1.log("[DB] [INIT] Initializing workflow scheduler...");
        initWorkflowScheduler().catch((err) => console$1.error("[DB] [INIT] Failed to init scheduler:", err));
      }
      return new TracedDb(db2, database);
    } catch (err) {
      console$1.error("[DB] [INIT] Failed to connect to SurrealDB:", err.message);
      Sentry.captureException(err);
      dbPromise = null;
      throw err;
    }
  });
  return dbPromise;
}
async function getDynamicDb(dbName) {
  if (dynamicDbs.has(dbName)) {
    return dynamicDbs.get(dbName);
  }
  const promise = Sentry.startSpan({
    name: `SurrealDB Connect (${dbName})`,
    op: "db.connect",
    attributes: {
      "db.system": "surrealdb",
      "db.name": dbName
    }
  }, async (connectSpan) => {
    const url = process.env.SURREALDB_URL || DEFAULT_SURREALDB_URL;
    const user = process.env.SURREALDB_USER || DEFAULT_SURREALDB_USER;
    const pass = process.env.SURREALDB_PASS || DEFAULT_SURREALDB_PASS;
    const namespace = process.env.SURREALDB_NS || DEFAULT_SURREALDB_NS;
    connectSpan.setAttribute("db.url", url);
    connectSpan.setAttribute("db.namespace", namespace);
    console$1.log(`[DB] [DYNAMIC] Connecting to dynamic database '${dbName}' at ${url}...`);
    try {
      const s = new Surreal();
      try {
        await s.connect(url, {
          authentication: {
            namespace,
            database: dbName,
            username: user,
            password: pass
          }
        });
      } catch {
        await s.connect(url, {
          authentication: {
            username: user,
            password: pass
          }
        });
      }
      await s.use({
        namespace,
        database: dbName
      });
      console$1.log(`[DB] [DYNAMIC] Successfully connected to '${dbName}'`);
      return new TracedDb(s, dbName);
    } catch (err) {
      console$1.error(`[DB] [DYNAMIC] Failed to connect to dynamic database ${dbName}:`, err.message);
      Sentry.captureException(err);
      dynamicDbs.delete(dbName);
      throw err;
    }
  });
  dynamicDbs.set(dbName, promise);
  return promise;
}
const customDbs = /* @__PURE__ */ new Map();
async function getCustomDb(opts) {
  const url = opts.url || process.env.SURREALDB_URL || DEFAULT_SURREALDB_URL;
  const user = opts.user || process.env.SURREALDB_USER || DEFAULT_SURREALDB_USER;
  const pass = opts.pass || process.env.SURREALDB_PASS || DEFAULT_SURREALDB_PASS;
  const namespace = opts.namespace || process.env.SURREALDB_NS || DEFAULT_SURREALDB_NS;
  const database = opts.database || "main";
  const cacheKey = `${url}|${user}|${pass}|${namespace}|${database}`;
  if (customDbs.has(cacheKey)) {
    return customDbs.get(cacheKey);
  }
  const promise = Sentry.startSpan({
    name: `SurrealDB Connect (custom: ${database})`,
    op: "db.connect",
    attributes: {
      "db.system": "surrealdb",
      "db.name": database
    }
  }, async (connectSpan) => {
    connectSpan.setAttribute("db.url", url);
    connectSpan.setAttribute("db.namespace", namespace);
    console$1.log(`[DB] [CUSTOM] Connecting to custom database '${database}' at ${url}...`);
    try {
      const s = new Surreal();
      await s.connect(url, {
        authentication: {
          username: user,
          password: pass
        }
      });
      try {
        await s.query(`DEFINE NAMESPACE IF NOT EXISTS ${namespace}`);
      } catch (e) {
        console$1.log(`[DB] [CUSTOM] Could not define namespace (possibly insufficient permissions): ${e.message}`);
      }
      await s.use({
        namespace
      });
      try {
        await s.query(`DEFINE DATABASE IF NOT EXISTS ${database}`);
      } catch (e) {
        console$1.log(`[DB] [CUSTOM] Could not define database (possibly insufficient permissions): ${e.message}`);
      }
      await s.use({
        namespace,
        database
      });
      console$1.log(`[DB] [CUSTOM] Successfully connected to '${database}'`);
      return new TracedDb(s, database);
    } catch (err) {
      console$1.error(`[DB] [CUSTOM] Failed to connect to custom database ${database}:`, err.message);
      Sentry.captureException(err);
      customDbs.delete(cacheKey);
      throw err;
    }
  });
  customDbs.set(cacheKey, promise);
  return promise;
}
const db = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getCustomDb,
  getDb,
  getDynamicDb
}, Symbol.toStringTag, { value: "Module" }));
export {
  getDynamicDb as a,
  db as d,
  getDb as g,
  runWorkflowBackground as r,
  scheduleWorkflow as s,
  unscheduleWorkflow as u,
  workflowStreamManager as w
};
//# sourceMappingURL=db-CWsCtsJQ.js.map
