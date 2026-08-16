import { g as getDb } from "./db-BycVvFuO.js";
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
import "uuid";
async function GET(event) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    let records = [];
    try {
      const recordId = new RecordId("workflow_run", dbId);
      const result = await db.select(recordId);
      records = Array.isArray(result) ? result : result ? [result] : [];
    } catch (e) {
    }
    if (!records || records.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: "Run not found"
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const record = Array.isArray(records) ? records[0] : records;
    if (record) record.id = `workflow_run:${dbId}`;
    return new Response(JSON.stringify({
      success: true,
      data: record
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
//# sourceMappingURL=_id_-Cw4IQZO8.js.map
