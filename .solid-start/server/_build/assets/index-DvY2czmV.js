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
async function GET({
  request
}) {
  try {
    const db = await getDb();
    const info = await db.query("INFO FOR NAMESPACE;");
    const databasesObj = info[0]?.databases || {};
    const databases = Object.keys(databasesObj);
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
//# sourceMappingURL=index-DvY2czmV.js.map
