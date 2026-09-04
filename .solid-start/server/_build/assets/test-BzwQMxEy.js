import { g as getDb } from "./db-CWsCtsJQ.js";
import { RecordId } from "surrealdb";
import { n as normalizeConnection, t as testGrpcConnection, a as testSurrealDbConnection, b as testHttpConnection } from "./connections-BimqTFQY.js";
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
async function POST(event) {
  try {
    const body = await new Response(event.request.body).json();
    let config = body;
    if (body.connectionId && !body.url && !body.serverAddress) {
      const db = await getDb();
      const rawId = body.connectionId;
      const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
      const record = await db.select(new RecordId("connection", dbId));
      const conn = Array.isArray(record) ? record[0] : record;
      if (!conn) {
        return new Response(JSON.stringify({
          success: false,
          error: `Connection ${body.connectionId} not found`
        }), {
          status: 404,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
      config = {
        ...conn,
        ...body
      };
    }
    const normalized = normalizeConnection(config);
    let result;
    if (normalized.type === "grpc") {
      result = await testGrpcConnection(normalized);
    } else if (normalized.type === "surrealdb") {
      result = await testSurrealDbConnection(normalized);
    } else {
      result = await testHttpConnection(normalized);
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message || "Failed to execute connection test"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}
export {
  POST
};
//# sourceMappingURL=test-BzwQMxEy.js.map
