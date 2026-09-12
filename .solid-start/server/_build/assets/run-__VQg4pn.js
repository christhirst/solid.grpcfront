import { g as getDb } from "./db-YKr91eu6.js";
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
import "./connections-DgOrSVbb.js";
import "uuid";
async function GET(event) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const rawDbId = id.includes(":") ? id.split(":")[1] : id;
    const dbId = rawDbId.replace(/[⟨⟩]/g, "");
    const recordId = new RecordId("workflow", dbId);
    const wfIdStr = recordId.toString();
    const cleanWfIdStr = `workflow:${dbId}`;
    const query = "SELECT * FROM workflow_run WHERE workflowId = $wfId OR workflowId = $wfIdStr OR workflowId = $cleanWfIdStr OR workflowId = $dbId ORDER BY startTime DESC LIMIT 20";
    let results = [[]];
    try {
      const raw = await db.query(query, {
        wfId: recordId,
        wfIdStr,
        cleanWfIdStr,
        dbId
      });
      results = [(raw[0] || []).map((r) => ({
        ...r,
        id: r.id?.toString().replace(/[⟨⟩]/g, "")
      }))];
    } catch (e) {
      if (!e.message?.includes("does not exist")) throw e;
    }
    return new Response(JSON.stringify({
      success: true,
      data: results[0]
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
  GET
};
//# sourceMappingURL=run-__VQg4pn.js.map
