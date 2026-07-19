import { g as getDb } from "./db-jfehURwc.js";
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
import "uuid";
async function PUT(event) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const body = await new Response(event.request.body).json();
    const dbId = id.includes(":") ? id.split(":")[1] : id;
    const recordId = new RecordId("connection", dbId);
    const connection = {
      ...body,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const {
      id: _,
      ...dataWithoutId
    } = connection;
    const result = await db.query("UPDATE $id CONTENT $data", {
      id: recordId,
      data: dataWithoutId
    });
    const records = Array.isArray(result) ? result[0] || result : result;
    const record = Array.isArray(records) ? records[0] : records;
    if (record) {
      record.id = `connection:${dbId}`;
    }
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
//# sourceMappingURL=_id_-CwcToce6.js.map
