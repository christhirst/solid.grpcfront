import { w as workflowStreamManager } from "./db-BycVvFuO.js";
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
    const runId = event.params.id;
    const channel = `run:${runId}`;
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (evt, data) => {
          controller.enqueue(encoder.encode(`event: ${evt}
data: ${JSON.stringify(data)}

`));
        };
        sendEvent("status", {
          message: `Subscribed to workflow run stream on channel '${channel}'`
        });
        const eventHandler = (payload) => {
          sendEvent(payload.type || "message", payload);
          if (payload.type === "workflow_complete" || payload.type === "workflow_failed") {
            setTimeout(() => {
              try {
                controller.close();
              } catch {
              }
            }, 500);
          }
        };
        workflowStreamManager.on(channel, eventHandler);
        event.request.signal.addEventListener("abort", () => {
          workflowStreamManager.off(channel, eventHandler);
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
//# sourceMappingURL=stream-BuH3b130.js.map
