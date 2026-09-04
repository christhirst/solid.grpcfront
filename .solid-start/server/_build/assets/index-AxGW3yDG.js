import { g as getDb } from "./db-CWsCtsJQ.js";
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
import "./connections-BimqTFQY.js";
import "uuid";
async function GET(event) {
  try {
    const db = await getDb();
    const url = new URL(event.request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    let dashboards = [];
    try {
      let result;
      if (q) {
        result = await db.query("SELECT * FROM dashboard WHERE string::lowercase(name) CONTAINS string::lowercase($q) ORDER BY updated_at DESC", {
          q
        });
      } else {
        result = await db.query("SELECT * FROM dashboard ORDER BY updated_at DESC");
      }
      dashboards = (result[0] || []).map((w) => ({
        ...w,
        id: w.id?.toString().replace(/[⟨⟩]/g, "")
      }));
    } catch (e) {
      if (!e.message?.includes("does not exist")) throw e;
    }
    try {
      const responseBody = JSON.stringify({
        success: true,
        data: dashboards
      });
      return new Response(responseBody, {
        headers: {
          "Content-Type": "application/json"
        }
      });
    } catch (stringifyErr) {
      console.error("[API Dashboards] Stringification error:", stringifyErr);
      throw stringifyErr;
    }
  } catch (err) {
    console.error("[API Dashboards] General error:", err);
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
//# sourceMappingURL=index-AxGW3yDG.js.map
