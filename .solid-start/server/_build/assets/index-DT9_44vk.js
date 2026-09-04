import { g as getDb } from "./db-CWsCtsJQ.js";
import { n as normalizeConnection } from "./connections-BimqTFQY.js";
import "surrealdb";
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
    const db = await getDb();
    let connections = [];
    try {
      const result = await db.query("SELECT * FROM connection ORDER BY updated_at DESC");
      const rawRecords = result[0] || [];
      connections = rawRecords.map((c) => normalizeConnection(c));
    } catch (e) {
      if (!e.message?.includes("does not exist")) throw e;
    }
    return new Response(JSON.stringify({
      success: true,
      data: connections
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
//# sourceMappingURL=index-DT9_44vk.js.map
