import { APIEvent } from "@solidjs/start/server";
import { getDynamicDb } from "~/lib/db";

export async function GET(event: APIEvent) {
  try {
    const dbName = event.params.db;
    const url = new URL(event.request.url);
    const table = url.searchParams.get("table") || url.searchParams.get("target") || "workflow_run";

    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid database name" }), { status: 400 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (evt: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        sendEvent("status", { message: `Subscribing to live query on table '${table}' in db '${dbName}'` });

        let queryUuid: string | null = null;
        let db: any = null;

        try {
          db = await getDynamicDb(dbName);

          queryUuid = await db.live(table, (action: string, result: any) => {
            sendEvent("live", {
              action,
              table,
              result,
              timestamp: new Date().toISOString(),
            });
          });

          sendEvent("status", { message: "Live query active", liveUuid: queryUuid });
        } catch (err: any) {
          sendEvent("error", { error: err.message || "Failed to start live query" });
          try { controller.close(); } catch {}
          return;
        }

        event.request.signal.addEventListener("abort", () => {
          if (queryUuid && db) {
            db.kill(queryUuid).catch(() => {});
          }
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
