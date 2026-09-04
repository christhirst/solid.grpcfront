import { g as getDb, r as runWorkflowBackground } from "./db-CWsCtsJQ.js";
import { v4 } from "uuid";
import { RecordId } from "surrealdb";
import "@sentry/node";
import "node-cron";
import "./logger-BDLv3oYI.js";
import "jsonata";
import "lodash.get";
import "./grpcExecutor-DlteWgV8.js";
import "@grpc/grpc-js";
import "@grpc/proto-loader";
import "fs";
import "path";
import "os";
import "./httpExecutor-C7gv4kID.js";
import "./protoParser-C1XlV9an.js";
import "protobufjs";
import "events";
import "./connections-BimqTFQY.js";
async function POST(event) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    let records = [];
    try {
      const recordId = new RecordId("workflow", dbId);
      const result = await db.select(recordId);
      records = Array.isArray(result) ? result : result ? [result] : [];
    } catch (e) {
      records = [];
    }
    if (!records || records.length === 0 || !records[0]) {
      return new Response(JSON.stringify({
        success: false,
        error: "Workflow not found"
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const workflow = Array.isArray(records) ? records[0] : records;
    const runId = `workflow_run:${v4()}`;
    let formPayload = {};
    try {
      const body = await event.request.json();
      if (body && body.form) {
        formPayload = body.form;
      }
    } catch (e) {
    }
    runWorkflowBackground(workflow, runId, {
      form: formPayload
    }).catch(console.error);
    return new Response(JSON.stringify({
      success: true,
      runId
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}
export {
  POST
};
//# sourceMappingURL=run-vcIhdssW.js.map
