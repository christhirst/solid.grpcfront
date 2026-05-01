import { g as getDb } from "./db-Dn0UBl1H.js";
import "surrealdb";
import "@sentry/node";
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
async function GET(event) {
  try {
    const db = await getDb();
    const result = await db.query("RETURN time::now();");
    return new Response(JSON.stringify({
      status: "ok",
      message: "Successfully connected to SurrealDB",
      time: result[0]
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      message: "Failed to connect to SurrealDB",
      error: error.message
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
//# sourceMappingURL=health-Cn_epsCJ.js.map
