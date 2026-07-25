import { APIEvent } from "@solidjs/start/server";
import { workflowStreamManager } from "~/lib/workflowEngine";

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const url = new URL(event.request.url);
    const runId = url.searchParams.get("runId");

    const channel = runId ? `run:${runId}` : `wf:${id}`;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (evt: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        sendEvent("status", { message: `Subscribed to workflow stream on channel '${channel}'` });

        const eventHandler = (payload: any) => {
          sendEvent(payload.type || "message", payload);
          if (payload.type === "workflow_complete" || payload.type === "workflow_failed") {
            setTimeout(() => {
              try { controller.close(); } catch {}
            }, 500);
          }
        };

        workflowStreamManager.on(channel, eventHandler);

        event.request.signal.addEventListener("abort", () => {
          workflowStreamManager.off(channel, eventHandler);
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
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(event: APIEvent) {
  return GET(event);
}
