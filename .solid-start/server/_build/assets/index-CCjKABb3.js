import { g as getDb } from "./db-Dn0UBl1H.js";
import "surrealdb";
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
async function GET(event) {
  try {
    const db = await getDb();
    let dashboards = [];
    try {
      const result = await db.query("SELECT * FROM dashboard ORDER BY updated_at DESC");
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
//# sourceMappingURL=index-CCjKABb3.js.map
