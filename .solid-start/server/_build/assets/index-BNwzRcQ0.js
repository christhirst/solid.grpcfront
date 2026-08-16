import { g as getDb } from "./db-BycVvFuO.js";
import "surrealdb";
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
async function GET(event) {
  try {
    const db = await getDb();
    const url = new URL(event.request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    let protos = [];
    try {
      let result;
      if (q) {
        result = await db.query("SELECT * FROM proto_file WHERE string::lowercase(name) CONTAINS string::lowercase($q) ORDER BY updated_at DESC", {
          q
        });
      } else {
        result = await db.query("SELECT * FROM proto_file ORDER BY updated_at DESC");
      }
      protos = (result[0] || []).map((p) => ({
        ...p,
        id: p.id?.toString().replace(/[⟨⟩]/g, "")
      }));
    } catch (e) {
      if (!e.message?.includes("does not exist")) throw e;
    }
    return new Response(JSON.stringify({
      success: true,
      data: protos
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
  GET
};
//# sourceMappingURL=index-BNwzRcQ0.js.map
