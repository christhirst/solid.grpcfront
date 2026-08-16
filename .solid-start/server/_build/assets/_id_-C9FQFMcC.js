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
    const recordId = new RecordId("connection", dbId);
    const result = await db.select(recordId);
    const records = Array.isArray(result) ? result : result ? [result] : [];
    const connection = records[0];
    if (!connection) {
      return new Response(JSON.stringify({
        success: false,
        error: "Connection not found"
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    connection.id = `connection:${dbId}`;
    return new Response(JSON.stringify({
      success: true,
      data: connection
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
//# sourceMappingURL=_id_-C9FQFMcC.js.map
