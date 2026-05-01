import { RecordId, Surreal } from "surrealdb";
import * as Sentry from "@sentry/node";
import cron from "node-cron";
import get from "lodash.get";
import { e as executeGrpcCall } from "./grpcExecutor-C8N6gsCz.js";
import { p as parseProtoContent } from "./protoParser-C1XlV9an.js";
import { v4 } from "uuid";
function interpolateTemplate(template, context) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const val = get(context, path);
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
    const exactMatch = templateObj.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
    if (exactMatch) {
      return get(context, exactMatch[1]);
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
      protoContent,
      serverAddress,
      useTls,
      steps,
      authConfig
    } = workflow;
    const parsedProto = parseProtoContent(protoContent);
    const context = {
      steps: {},
      auth: {},
      ...customContext
    };
    let authToken;
    if (authConfig) {
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
          const res = await fetch(authConfig.url, {
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
        if (step.type === "table" || step.type === "chart") {
          let payload;
          try {
            const exactMatch2 = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/);
            if (exactMatch2) {
              payload = get(context, exactMatch2[1]);
            } else {
              payload = evaluatePayload(JSON.parse(step.requestBodyTemplate || "{}"), context);
            }
          } catch (e) {
            payload = {
              error: `Failed to evaluate visual data source: ${e.message}`
            };
          }
          let visData = payload;
          if (step.dataPath && payload && typeof payload === "object") {
            visData = get(payload, step.dataPath);
          }
          if (!Array.isArray(visData)) {
            visData = visData !== void 0 && visData !== null ? [visData] : [];
          }
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
            const targetDbName = interpolateTemplate(step.databaseName || "", context) || "main";
            const {
              getDynamicDb: getDynamicDb2
            } = await Promise.resolve().then(() => db);
            const ddb = await getDynamicDb2(targetDbName);
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
          context.steps[step.id] = {
            request: queryPayload,
            response: execResult2.success ? execResult2.data : void 0,
            error: !execResult2.success ? execResult2.error : void 0
          };
          const logRecord2 = {
            stepId: step.id,
            stepType: "database",
            // casting to avoid strict type error if not updated in other places
            status: execResult2.success ? "success" : "error",
            request: queryPayload,
            response: execResult2.success ? execResult2.data : void 0,
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
          const method = step.restMethod || "GET";
          const hasBody = method !== "GET" && method !== "DELETE";
          if (hasBody) {
            const exactMatch2 = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/);
            if (exactMatch2) {
              requestPayload2 = get(context, exactMatch2[1]);
            } else {
              try {
                const parsedTemplate = JSON.parse(step.requestBodyTemplate || "{}");
                requestPayload2 = evaluatePayload(parsedTemplate, context);
              } catch (e) {
                requestPayload2 = interpolateTemplate(step.requestBodyTemplate || "", context);
              }
            }
          }
          let metadata2;
          if (authToken) {
            metadata2 = {
              "Authorization": `Bearer ${authToken}`
            };
          }
          if (step.headersTemplate) {
            try {
              const parsedHeaders = JSON.parse(step.headersTemplate);
              const evaluatedHeaders = evaluatePayload(parsedHeaders, context);
              metadata2 = metadata2 || {};
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
              data = await res.text();
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
        const exactMatch = (step.requestBodyTemplate || "").trim().match(/^\{\{\s*([\w.]+)\s*\}\}$/);
        if (exactMatch) {
          requestPayload = get(context, exactMatch[1]);
        } else {
          let parsedTemplate;
          try {
            parsedTemplate = JSON.parse(step.requestBodyTemplate || "{}");
          } catch (e) {
            throw new Error(`Invalid request payload in step ${step.id}: Must be a JSON object or a single exact template {{ variable }}. Error: ${e.message}`);
          }
          requestPayload = evaluatePayload(parsedTemplate, context);
        }
        let metadata;
        if (authToken) {
          metadata = {
            "Authorization": `Bearer ${authToken}`
          };
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
const scheduledJobs = /* @__PURE__ */ new Map();
async function initWorkflowScheduler() {
  console.log("Initializing workflow scheduler...");
  try {
    const db2 = await getDb();
    const result = await db2.query("SELECT * FROM workflow WHERE schedule AND schedule != ''");
    const workflows = result[0] || [];
    for (const wfData of workflows) {
      if (wfData.schedule) {
        scheduleWorkflow(wfData);
      }
    }
    console.log(`Initialized scheduler with ${workflows.length} workflows.`);
  } catch (error) {
    console.error("Failed to initialize workflow scheduler:", error);
  }
}
function scheduleWorkflow(workflow) {
  const workflowId = workflow.id.toString().replace(/[⟨⟩]/g, "");
  if (scheduledJobs.has(workflowId)) {
    console.log(`Unscheduling workflow: ${workflowId}`);
    scheduledJobs.get(workflowId)?.stop();
    scheduledJobs.delete(workflowId);
  }
  if (!workflow.schedule) return;
  try {
    const job = cron.schedule(workflow.schedule, async () => {
      console.log(`Running scheduled workflow: ${workflow.name} (${workflowId})`);
      const runId = `workflow_run:${v4()}`;
      const normalizedWorkflow = {
        ...workflow,
        id: workflowId
      };
      try {
        await runWorkflowBackground(normalizedWorkflow, runId);
      } catch (err) {
        console.error(`Scheduled run failed for ${workflowId}:`, err);
      }
    });
    scheduledJobs.set(workflowId, job);
    console.log(`Scheduled workflow: ${workflow.name} (${workflowId}) with cron: ${workflow.schedule}`);
  } catch (err) {
    console.error(`Failed to schedule workflow ${workflowId} with cron "${workflow.schedule}":`, err);
  }
}
function unscheduleWorkflow(id) {
  const workflowId = id.toString().replace(/[⟨⟩]/g, "");
  if (scheduledJobs.has(workflowId)) {
    console.log(`Unscheduling workflow: ${workflowId}`);
    scheduledJobs.get(workflowId)?.stop();
    scheduledJobs.delete(workflowId);
  }
}
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
    console.log(`[DB] Executing query: ${truncate(surql, 100)}`);
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
            console.log(`[DB] Query returned ${first.length} rows`);
            span.setAttribute("db.row_count", first.length);
          }
        }
        return result;
      } catch (err) {
        console.error(`[DB] Query failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .select() with a Sentry span */
  async select(thing) {
    const resource = resourceName(thing);
    console.log(`[DB] SELECT ${resource}`);
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
          console.log(`[DB] SELECT ${resource} returned ${result.length} rows`);
          span.setAttribute("db.row_count", result.length);
        }
        return result;
      } catch (err) {
        console.error(`[DB] SELECT ${resource} failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .create() with a Sentry span */
  async create(thing, data) {
    const resource = resourceName(thing);
    console.log(`[DB] CREATE ${resource}`);
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
        console.log(`[DB] CREATE ${resource} successful`);
        return res;
      } catch (err) {
        console.error(`[DB] CREATE ${resource} failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .update() with a Sentry span */
  async update(thing, data) {
    const resource = resourceName(thing);
    console.log(`[DB] UPDATE ${resource}`);
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
        console.log(`[DB] UPDATE ${resource} successful`);
        return res;
      } catch (err) {
        console.error(`[DB] UPDATE ${resource} failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .delete() with a Sentry span */
  async delete(thing) {
    const resource = resourceName(thing);
    console.log(`[DB] DELETE ${resource}`);
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
        console.log(`[DB] DELETE ${resource} successful`);
        return res;
      } catch (err) {
        console.error(`[DB] DELETE ${resource} failed: ${err.message}`);
        Sentry.captureException(err);
        throw err;
      }
    });
  }
  /** Forward .use() with a Sentry span */
  async use(opts) {
    console.log(`[DB] USE NS:${opts.namespace} DB:${opts.database}`);
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
        console.error(`[DB] USE failed: ${err.message}`);
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
    console.log(`[DB] [INIT] Connecting to SurrealDB at ${url}...`);
    try {
      const db2 = new Surreal();
      console.log(`[DB] [INIT] Authenticating as user: ${user}`);
      await db2.connect(url, {
        authentication: {
          username: user,
          password: pass
        }
      });
      console.log(`[DB] [INIT] Ensuring namespace exists: ${namespace}`);
      await db2.query(`DEFINE NAMESPACE IF NOT EXISTS ${namespace}`);
      await db2.use({
        namespace
      });
      console.log(`[DB] [INIT] Ensuring database exists: ${database}`);
      await db2.query(`DEFINE DATABASE IF NOT EXISTS ${database}`);
      await db2.use({
        namespace,
        database
      });
      console.log(`[DB] [INIT] Successfully connected to ${namespace}/${database}`);
      if (typeof window === "undefined") {
        console.log("[DB] [INIT] Initializing workflow scheduler...");
        initWorkflowScheduler().catch((err) => console.error("[DB] [INIT] Failed to init scheduler:", err));
      }
      return new TracedDb(db2, database);
    } catch (err) {
      console.error("[DB] [INIT] Failed to connect to SurrealDB:", err.message);
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
    console.log(`[DB] [DYNAMIC] Connecting to dynamic database '${dbName}' at ${url}...`);
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
      console.log(`[DB] [DYNAMIC] Successfully connected to '${dbName}'`);
      return new TracedDb(s, dbName);
    } catch (err) {
      console.error(`[DB] [DYNAMIC] Failed to connect to dynamic database ${dbName}:`, err.message);
      Sentry.captureException(err);
      dynamicDbs.delete(dbName);
      throw err;
    }
  });
  dynamicDbs.set(dbName, promise);
  return promise;
}
const db = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
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
//# sourceMappingURL=db-Dn0UBl1H.js.map
