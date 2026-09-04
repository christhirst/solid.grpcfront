import { a as getDynamicDb } from "./db-CWsCtsJQ.js";
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
    const dbName = event.params.db;
    const url = new URL(event.request.url);
    const table = url.searchParams.get("table") || url.searchParams.get("target") || "workflow_run";
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid database name"
      }), {
        status: 400
      });
    }
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (evt, data) => {
          controller.enqueue(encoder.encode(`event: ${evt}
data: ${JSON.stringify(data)}

`));
        };
        sendEvent("status", {
          message: `Subscribing to live query on table '${table}' in db '${dbName}'`
        });
        let queryUuid = null;
        let db = null;
        try {
          db = await getDynamicDb(dbName);
          queryUuid = await db.live(table, (action, result) => {
            sendEvent("live", {
              action,
              table,
              result,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          });
          sendEvent("status", {
            message: "Live query active",
            liveUuid: queryUuid
          });
        } catch (err) {
          sendEvent("error", {
            error: err.message || "Failed to start live query"
          });
          try {
            controller.close();
          } catch {
          }
          return;
        }
        event.request.signal.addEventListener("abort", () => {
          if (queryUuid && db) {
            db.kill(queryUuid).catch(() => {
            });
          }
        });
      }
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
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
//# sourceMappingURL=live-BbjlHsEY.js.map
