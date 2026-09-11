import { e as executeHttpStreamCall } from "./httpExecutor-C7gv4kID.js";
async function POST(event) {
  try {
    const body = await new Response(event.request.body).json();
    if (!body.url) {
      return new Response(JSON.stringify({
        error: "Missing required parameter: url"
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
        const sendEvent = (evt, data) => {
          controller.enqueue(encoder.encode(`event: ${evt}
data: ${JSON.stringify(data)}

`));
        };
        sendEvent("status", {
          message: "Connecting to HTTP stream...",
          url: body.url
        });
        const call = await executeHttpStreamCall(body, (chunk) => {
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
            message: "Stream complete"
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
//# sourceMappingURL=stream-DGc4apvF.js.map
