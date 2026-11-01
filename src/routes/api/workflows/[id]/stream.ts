import { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { workflowStreamManager } from "~/lib/workflowEngine";
import { getDb } from "~/lib/db";
import { getEffectiveAccessContext } from "~/lib/auth";
import { canAccessObject } from "~/lib/groupAuth";
import { canUseWorkflowViaDashboard } from "~/lib/dashboard/dashboardScope";

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const url = new URL(event.request.url);
    const runId = url.searchParams.get("runId");
    const dashboardIdParam = url.searchParams.get("dashboard") || "";
    const dbId = (id || "").replace(/^workflow:/, "").replace(/[⟨⟩]/g, "").trim();

    if (dbId) {
      try {
        const db = await getDb();
        const ctx = await getEffectiveAccessContext(event.request, db);
        const result = await db.select(new RecordId("workflow", dbId));
        const wf = Array.isArray(result) ? result[0] : result;
        if (wf) {
          const directAllowed =
            ctx.capabilities.canManageWorkflows &&
            canAccessObject(ctx, wf, "workflow", "use");
          const dashboardAllowed =
            !directAllowed &&
            Boolean(dashboardIdParam) &&
            (await canUseWorkflowViaDashboard(db, ctx, dashboardIdParam, dbId));
          if (!directAllowed && !dashboardAllowed) {
            return Response.json(
              { success: false, error: "You do not have permission to stream this workflow." },
              { status: 403 }
            );
          }
        }
      } catch {
        // Proceed if DB not reachable for local runId stream
      }
    }

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
          if (payload.type && payload.type !== "message") {
            sendEvent("message", payload);
          }
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
