import { g as getDb } from "./db-CWsCtsJQ.js";
import { v4 } from "uuid";
import { RecordId } from "surrealdb";
import { g as getOwnerFromRequest } from "./auth-B3zGjE9E.js";
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
import "@auth/solid-start";
import "./authUrl-D6qtsd_i.js";
async function POST(event) {
  try {
    const db = await getDb();
    const body = await new Response(event.request.body).json();
    const owner = await getOwnerFromRequest(event.request);
    const rawId = body.id || `connection:${v4()}`;
    const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const normalized = normalizeConnection({
      ...body,
      id: rawId,
      owner,
      visibility: body.visibility || "public",
      created_at: body.created_at || now,
      updated_at: now
    });
    const {
      id: _,
      ...dataWithoutId
    } = normalized;
    const recordId = new RecordId("connection", dbId);
    const result = await db.query("CREATE $id CONTENT $data", {
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
  POST
};
//# sourceMappingURL=index-D84AgMr_.js.map
