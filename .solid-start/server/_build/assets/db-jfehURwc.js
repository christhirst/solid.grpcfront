import { RecordId, Surreal } from "surrealdb";
import * as Sentry from "@sentry/node";
import cron from "node-cron";
import { l as logger } from "./logger-BDLv3oYI.js";
import get from "lodash.get";
import { e as executeGrpcCall } from "./grpcExecutor-C8N6gsCz.js";
import { p as parseProtoContent } from "./protoParser-C1XlV9an.js";
import { v4 } from "uuid";
async function getStepAuthHeader(step, db2) {
  const authType = step.authType || "none";
  if (authType === "basic" && (step.authUsername || step.authPassword)) {
    const auth = Buffer.from(`${step.authUsername || ""}:${step.authPassword || ""}`).toString("base64");
    return `Basic ${auth}`;
  }
  if (authType === "oauth" && step.connectionId) {
    console.log(`[STEP AUTH] Fetching connection details for ID: ${step.connectionId}`);
    try {
      const connDbId = step.connectionId.includes(":") ? step.connectionId.split(":")[1] : step.connectionId;
      const connRecord = await db2.select(new RecordId("connection", connDbId));
      const connection = Array.isArray(connRecord) ? connRecord[0] : connRecord;
      if (connection) {
        console.log(`[STEP AUTH] Executing REST auth call for connection: ${connection.name}`);
        const headers = {
          "Content-Type": "application/json"
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
          const port = process.env.PORT || 3e3;
          authUrl = `http://127.0.0.1:${port}${separator}${authUrl}`;
        }
        const res = await fetch(authUrl, {
          method: connection.method || "POST",
          headers,
          body: connection.method !== "GET" ? connection.body || "{}" : void 0
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
  console.log("runWorkflowBackground called. Workflow object keys:", Object.keys(workflow));
  console.log("Proto content exists?", !!workflow.protoContent, "Length:", workflow.protoContent?.length);
  try {
    const {
      protoContent: storedProtoContent,
      protoId,
      serverAddress,
      useTls,
      steps,
      authConfig,
      connectionId
    } = workflow;
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
        const connection = Array.isArray(connRecord) ? connRecord[0] : connRecord;
        if (connection) {
          console.log(`[AUTH] Executing REST auth call for connection: ${connection.name}`);
          const headers = {
            "Content-Type": "application/json"
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
            const port = process.env.PORT || 3e3;
            authUrl = `http://127.0.0.1:${port}${separator}${authUrl}`;
          }
          const res = await fetch(authUrl, {
            method: connection.method || "POST",
            headers,
            body: connection.method !== "GET" ? connection.body || "{}" : void 0
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
          }
          const authData = await res.json();
          authToken = get(authData, connection.tokenPath || "access_token");
          context.auth = {
            token: authToken,
            response: authData
          };
          console.log(`[AUTH] Success. Connection token obtained.`);
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
            const separator = authUrl.startsWith("/") ? "" : "/";
            const port = process.env.PORT || 3e3;
            authUrl = `http://127.0.0.1:${port}${separator}${authUrl}`;
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
    for (const step of steps) {
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
        if (step.type === "table" || step.type === "chart") {
          let payload;
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
              dataPath: step.dataPath,
              xKey: step.xKey,
              yKey: step.yKey,
              chartType: step.chartType || "bar",
              columns: step.columns || []
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
            const targetDbName = interpolateTemplate(step.databaseName || "", context) || void 0;
            const targetDbUrl = interpolateTemplate(step.databaseUrl || "", context) || void 0;
            const targetDbUser = interpolateTemplate(step.databaseUser || "", context) || void 0;
            const targetDbPass = interpolateTemplate(step.databasePass || "", context) || void 0;
            const targetDbNs = interpolateTemplate(step.databaseNs || "", context) || void 0;
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
            const separator = evaluatedUrl.startsWith("/") ? "" : "/";
            const port = process.env.PORT || 3e3;
            evaluatedUrl = `http://127.0.0.1:${port}${separator}${evaluatedUrl}`;
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
        const execResult = await executeGrpcCall({
          protoContent,
          serverAddress: step.serverAddress || serverAddress,
          useTls: step.useTls !== void 0 ? step.useTls : useTls,
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
}
let dbPromise = null;
const dynamicDbs = /* @__PURE__ */ new Map();
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
    const url = process.env.SURREALDB_URL || "";
    const user = process.env.SURREALDB_USER || "admin";
    const pass = process.env.SURREALDB_PASS || "";
    const namespace = process.env.SURREALDB_NS || "solidflow";
    const database = process.env.SURREALDB_DB || "main";
    connectSpan.setAttribute("db.url", url);
    connectSpan.setAttribute("db.namespace", namespace);
    connectSpan.setAttribute("db.name", database);
    console$1.log(`[DB] [INIT] Connecting to SurrealDB at ${url}...`);
    try {
      const db2 = new Surreal();
      console$1.log(`[DB] [INIT] Authenticating as user: ${user}`);
      await db2.connect(url, {
        authentication: {
          username: user,
          password: pass
        }
      });
      console$1.log(`[DB] [INIT] Ensuring namespace exists: ${namespace}`);
      await db2.query(`DEFINE NAMESPACE IF NOT EXISTS ${namespace}`);
      await db2.use({
        namespace
      });
      console$1.log(`[DB] [INIT] Ensuring database exists: ${database}`);
      await db2.query(`DEFINE DATABASE IF NOT EXISTS ${database}`);
      await db2.use({
        namespace,
        database
      });
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
    const url = process.env.SURREALDB_URL || "";
    const user = process.env.SURREALDB_USER || "admin";
    const pass = process.env.SURREALDB_PASS || "";
    const namespace = process.env.SURREALDB_NS || "solidflow";
    connectSpan.setAttribute("db.url", url);
    connectSpan.setAttribute("db.namespace", namespace);
    console$1.log(`[DB] [DYNAMIC] Connecting to dynamic database '${dbName}' at ${url}...`);
    try {
      const s = new Surreal();
      await s.connect(url, {
        authentication: {
          username: user,
          password: pass
        }
      });
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
  const url = opts.url || process.env.SURREALDB_URL || "";
  const user = opts.user || process.env.SURREALDB_USER || "admin";
  const pass = opts.pass || process.env.SURREALDB_PASS || "";
  const namespace = opts.namespace || process.env.SURREALDB_NS || "solidflow";
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
  getDb as g,
  runWorkflowBackground as r,
  scheduleWorkflow as s,
  unscheduleWorkflow as u
};
//# sourceMappingURL=db-jfehURwc.js.map
