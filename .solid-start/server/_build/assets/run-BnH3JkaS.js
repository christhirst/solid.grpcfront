import { g as getDb } from "./db-jfehURwc.js";
import { RecordId } from "surrealdb";
import "@sentry/node";
import "node-cron";
import "./logger-BDLv3oYI.js";
import "lodash.get";
import "./grpcExecutor-C8N6gsCz.js";
import "@grpc/grpc-js";
import "@grpc/proto-loader";
import "fs";
import "path";
import "os";
import "./protoParser-C1XlV9an.js";
import "protobufjs";
import "uuid";
async function GET(event) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    const recordId = new RecordId("workflow", dbId);
    const query = "SELECT * FROM workflow_run WHERE workflowId = $wfId ORDER BY startTime DESC LIMIT 20";
    let results = [[]];
    try {
      const raw = await db.query(query, {
        wfId: recordId
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
//# sourceMappingURL=run-BnH3JkaS.js.map
