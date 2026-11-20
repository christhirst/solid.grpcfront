import { APIEvent } from "@solidjs/start/server";
import { workflowStreamManager } from "~/lib/workflowEngine";

export async function GET(event: APIEvent) {
  try {
    const runId = event.params.id;
    const channel = `run:${runId}`;

    let activeCleanup: (() => void) | null = null;
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let closed = false;
        const cleanup = () => {
          if (closed) return;
          closed = true;
          workflowStreamManager.off(channel, eventHandler);
        };
        activeCleanup = cleanup;

        const sendEvent = (evt: string, data: any) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            cleanup();
          }
        };

        sendEvent("status", { message: `Subscribed to workflow run stream on channel '${channel}'` });

        const eventHandler = (payload: any) => {
          sendEvent(payload.type || "message", payload);
          if (payload.type && payload.type !== "message") {
            sendEvent("message", payload);
          }
          if (payload.type === "workflow_complete" || payload.type === "workflow_failed") {
            setTimeout(() => {
              try { controller.close(); } catch {}
              cleanup();
            }, 500);
          }
        };

        workflowStreamManager.on(channel, eventHandler);

        if (event.request.signal.aborted) {
          cleanup();
          return;
        }
        event.request.signal.addEventListener("abort", cleanup, { once: true });
      },
      cancel() {
        activeCleanup?.();
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
