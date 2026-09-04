import { g as getDb } from "./db-CWsCtsJQ.js";
import { RecordId } from "surrealdb";
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
async function PUT(event) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const body = await new Response(event.request.body).json();
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    const recordId = `ca_cert:${dbId}`;
    const certDef = {
      ...body,
      id: recordId,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const {
      id: _,
      ...dataWithoutId
    } = certDef;
    const sId = new RecordId("ca_cert", dbId);
    const result = await db.query("UPDATE $sId CONTENT $data", {
      sId,
      data: dataWithoutId
    });
    const record = Array.isArray(result) ? result[0] : result;
    if (record) record.id = `ca_cert:${dbId}`;
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
//# sourceMappingURL=_id_-WGFU9Gdb.js.map
