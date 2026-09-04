import { g as getDb } from "./db-CWsCtsJQ.js";
import { RecordId } from "surrealdb";
import { n as normalizeConnection } from "./connections-BimqTFQY.js";
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
async function PUT(event) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const body = await new Response(event.request.body).json();
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    const recordId = new RecordId("connection", dbId);
    const normalized = normalizeConnection({
      ...body,
      id: `connection:${dbId}`,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    const {
      id: _,
      ...dataWithoutId
    } = normalized;
    const result = await db.query("UPDATE $id CONTENT $data", {
      id: recordId,
      data: dataWithoutId
    });
    const records = Array.isArray(result) ? result[0] || result : result;
    const record = Array.isArray(records) ? records[0] : records;
    const output = normalizeConnection(record ? {
      ...record,
      id: `connection:${dbId}`
    } : normalized);
    return new Response(JSON.stringify({
      success: true,
      data: output
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
//# sourceMappingURL=_id_-CPBN_4js.js.map
