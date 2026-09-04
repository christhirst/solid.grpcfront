import { g as getDb } from "./db-CWsCtsJQ.js";
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
  request
}) {
  try {
    const db = await getDb();
    let databases = [];
    try {
      const info = await db.query("INFO FOR NAMESPACE;");
      const databasesObj = info[0]?.databases || {};
      databases = Object.keys(databasesObj);
    } catch {
      databases = [process.env.SURREALDB_DB || "main"];
    }
    if (databases.length === 0) {
      databases = [process.env.SURREALDB_DB || "main"];
    }
    return new Response(JSON.stringify({
      success: true,
      data: databases
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
//# sourceMappingURL=index-BxVpfagu.js.map
