import { g as getDb } from "./db-Dn0UBl1H.js";
import { RecordId } from "surrealdb";
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
async function PUT(event) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const body = await new Response(event.request.body).json();
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    const recordId = `proto_file:${dbId}`;
    const protoDef = {
      ...body,
      id: recordId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const {
      id: _,
      ...dataWithoutId
    } = protoDef;
    const sId = new RecordId("proto_file", dbId);
    const result = await db.query("UPDATE $sId CONTENT $data", {
      sId,
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
  PUT
};
//# sourceMappingURL=_id_-litt8f6s.js.map
