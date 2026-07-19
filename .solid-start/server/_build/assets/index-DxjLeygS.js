import { g as getDb } from "./db-jfehURwc.js";
import "surrealdb";
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
async function GET(event) {
  try {
    const db = await getDb();
    let connections = [];
    try {
      const result = await db.query("SELECT * FROM connection ORDER BY updated_at DESC");
      connections = (result[0] || []).map((c) => ({
        ...c,
        id: c.id?.toString().replace(/[⟨⟩]/g, "")
      }));
    } catch (e) {
      if (!e.message?.includes("does not exist")) throw e;
    }
    return new Response(JSON.stringify({
      success: true,
      data: connections
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
//# sourceMappingURL=index-DxjLeygS.js.map
