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
async function POST({
  request,
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
    const {
      data
    } = await request.json();
    if (!data || typeof data !== "object") {
      return new Response(JSON.stringify({
        success: false,
        error: "Data object required"
      }), {
        status: 400
      });
    }
    const db = await getDynamicDb(dbName);
    const result = await db.query(`CREATE ${tableName} CONTENT $data`, {
      data
    });
    return new Response(JSON.stringify({
      success: true,
      data: result
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
  POST
};
//# sourceMappingURL=index-CTDp6dyY.js.map
