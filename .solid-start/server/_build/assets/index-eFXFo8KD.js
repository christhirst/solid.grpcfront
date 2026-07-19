import { a as getDynamicDb } from "./db-jfehURwc.js";
import "surrealdb";
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
async function GET({
  params
}) {
  try {
    const dbName = params.db;
    const tableName = params.table;
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName) || !tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid database or table name"
      }), {
        status: 400
      });
    }
    const db = await getDynamicDb(dbName);
    const records = await db.query(`SELECT * FROM ${tableName}`);
    return new Response(JSON.stringify({
      success: true,
      data: records
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
//# sourceMappingURL=index-eFXFo8KD.js.map
