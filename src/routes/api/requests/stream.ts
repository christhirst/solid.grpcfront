import { APIEvent } from "@solidjs/start/server";
import { executeHttpStreamCall, type HttpStreamCallParams } from "~/lib/httpExecutor";

export async function POST(event: APIEvent) {
  try {
    const body: HttpStreamCallParams = await new Response(event.request.body).json();

    if (!body.url) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: url" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (evt: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        sendEvent("status", { message: "Connecting to HTTP stream...", url: body.url });

        const call = await executeHttpStreamCall(
          body,
          (chunk) => {
            sendEvent("data", { chunk, timestamp: new Date().toISOString() });
          },
          (error) => {
            sendEvent("error", { error: error.message || String(error) });
            try { controller.close(); } catch {}
          },
          () => {
            sendEvent("end", { message: "Stream complete" });
            try { controller.close(); } catch {}
          }
        );

        event.request.signal.addEventListener("abort", () => {
          call.cancel();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Unknown proxy error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
