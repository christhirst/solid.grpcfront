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
async function GET(_event) {
  try {
    const db = await getDb();
    let certs = [];
    try {
      const result = await db.query("SELECT * FROM ca_cert ORDER BY updated_at DESC");
      certs = (result[0] || []).map((c) => ({
        ...c,
        id: c.id?.toString().replace(/[⟨⟩]/g, "")
      }));
    } catch (e) {
      if (!e.message?.includes("does not exist")) throw e;
    }
    return new Response(JSON.stringify({
      success: true,
      data: certs
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
//# sourceMappingURL=index-DQoR5ZZj.js.map
