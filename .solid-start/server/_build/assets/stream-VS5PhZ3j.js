import { a as executeGrpcStreamCall } from "./grpcExecutor-DlteWgV8.js";
import "@grpc/grpc-js";
import "@grpc/proto-loader";
import "fs";
import "path";
import "os";
async function POST(event) {
  try {
    const body = await new Response(event.request.body).json();
    if (!body.protoContent || !body.serverAddress || !body.serviceName || !body.methodName) {
      return new Response(JSON.stringify({
        error: "Missing required fields: protoContent, serverAddress, serviceName, methodName"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (event2, data) => {
          controller.enqueue(encoder.encode(`event: ${event2}
data: ${JSON.stringify(data)}

`));
        };
        sendEvent("status", {
          message: "Connecting to gRPC stream...",
          type: "info"
        });
        const call = await executeGrpcStreamCall(body, (chunk) => {
          sendEvent("data", {
            chunk,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }, (error) => {
          sendEvent("error", {
            error: error.message || String(error)
          });
          try {
            controller.close();
          } catch {
          }
        }, () => {
          sendEvent("end", {
            message: "Stream finished"
          });
          try {
            controller.close();
          } catch {
          }
        });
        event.request.signal.addEventListener("abort", () => {
          call.cancel();
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
      error: err.message || "Unknown proxy error"
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
//# sourceMappingURL=stream-VS5PhZ3j.js.map
