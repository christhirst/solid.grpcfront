import { a as getDynamicDb } from "./db-BDuWXNK_.js";
import "surrealdb";
import "node-cron";
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
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid database name"
      }), {
        status: 400
      });
    }
    const {
      query
    } = await request.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({
        success: false,
        error: "Query string required"
      }), {
        status: 400
      });
    }
    const db = await getDynamicDb(dbName);
    const result = await db.query(query);
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
//# sourceMappingURL=query-aVdrYsyp.js.map
