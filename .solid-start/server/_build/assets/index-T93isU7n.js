import { g as getDb } from "./db-jfehURwc.js";
import { v4 } from "uuid";
import { RecordId } from "surrealdb";
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
async function POST(event) {
  try {
    const db = await getDb();
    const body = await new Response(event.request.body).json();
    const rawId = body.id || `proto_file:${v4()}`;
    const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const protoDef = {
      ...body,
      id: rawId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const {
      id: _,
      ...dataWithoutId
    } = protoDef;
    const recordId = new RecordId("proto_file", dbId);
    const result = await db.query("CREATE $id CONTENT $data", {
      id: recordId,
      data: dataWithoutId
    });
    const record = Array.isArray(result) ? result[0] : result;
    if (record) record.id = `proto_file:${dbId}`;
    return new Response(JSON.stringify({
      success: true,
      data: record
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
  POST
};
//# sourceMappingURL=index-T93isU7n.js.map
