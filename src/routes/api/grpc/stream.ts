import { APIEvent } from "@solidjs/start/server";
import { executeGrpcStreamCall, type GrpcStreamCallParams } from "~/lib/grpcExecutor";

export async function POST(event: APIEvent) {
  try {
    const body: GrpcStreamCallParams = await new Response(event.request.body).json();

    if (!body.protoContent || !body.serverAddress || !body.serviceName || !body.methodName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: protoContent, serverAddress, serviceName, methodName" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        sendEvent("status", { message: "Connecting to gRPC stream...", type: "info" });

        const call = await executeGrpcStreamCall(
          body,
          (chunk) => {
            sendEvent("data", { chunk, timestamp: new Date().toISOString() });
          },
          (error) => {
            sendEvent("error", { error: error.message || String(error) });
            try { controller.close(); } catch {}
          },
          () => {
            sendEvent("end", { message: "Stream finished" });
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
