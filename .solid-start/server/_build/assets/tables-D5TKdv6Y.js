import { a as getDynamicDb } from "./db-CWsCtsJQ.js";
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
import "./connections-BimqTFQY.js";
import "uuid";
async function GET({
  params
}) {
  try {
    const dbName = params.db;
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid database name"
      }), {
        status: 400
      });
    }
    const db = await getDynamicDb(dbName);
    const info = await db.query("INFO FOR DATABASE;");
    const tablesObj = info[0]?.tables || {};
    const tables = Object.keys(tablesObj);
    return new Response(JSON.stringify({
      success: true,
      data: tables
    }), {
      headers: {
        "content-type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: {
        "content-type": "application/json"
      }
    });
  }
}
export {
  GET
};
//# sourceMappingURL=tables-D5TKdv6Y.js.map
