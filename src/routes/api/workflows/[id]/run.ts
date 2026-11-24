import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { runWorkflowBackground } from "~/lib/workflowEngine";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";
import { readJsonBody } from "~/lib/requestUtils";
import { buildWorkflowUserContext, getEffectiveAccessContext } from "~/lib/auth";
import { canAccessObject } from "~/lib/groupAuth";
import { canUseWorkflowViaDashboard } from "~/lib/dashboard/dashboardScope";
import { validateWorkflowFormPayload } from "~/lib/formValidator";

export async function POST(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const url = new URL(event.request.url);

    const dbId = (id || "").replace(/^workflow:/, "").replace(/[⟨⟩]/g, "").trim();
    let records: any = [];

    try {
      const recordId = new RecordId("workflow", dbId);
      const result = await db.select(recordId);
      records = Array.isArray(result) ? result : result ? [result] : [];
    } catch (e) {
      records = []; // record doesn't exist
    }

    if (!records || records.length === 0 || !records[0]) {
      return new Response(JSON.stringify({ success: false, error: "Workflow not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const workflow = {
      ...(Array.isArray(records) ? records[0] : records),
      id: `workflow:${dbId}`,
    };

    // Read form data from payload if present
    let formPayload: Record<string, any> = {};
    let hasFormBody = false;
    let bodyDashboardId = "";
    try {
      const body = await readJsonBody(event);
      if (body && body.form && typeof body.form === "object") {
        formPayload = body.form;
        hasFormBody = Object.keys(body.form).length > 0;
      }
      if (body && (body.dashboard || body.dashboardId)) {
        bodyDashboardId = String(body.dashboard || body.dashboardId);
      }
    } catch (e) {
      // Ignored
    }

    const dashboardIdParam = url.searchParams.get("dashboard") || bodyDashboardId;
    const directAllowed =
      ctx.capabilities.canManageWorkflows &&
      canAccessObject(ctx, workflow, "workflow", "use");
    const dashboardAllowed =
      !directAllowed &&
      Boolean(dashboardIdParam) &&
      (await canUseWorkflowViaDashboard(db, ctx, dashboardIdParam, dbId));

    if (!directAllowed && !dashboardAllowed) {
      return Response.json(
        {
          success: false,
          error: "You do not have permission (use) to execute this workflow.",
        },
        { status: 403 }
      );
    }

    if (hasFormBody || Boolean(dashboardIdParam)) {
      const validation = validateWorkflowFormPayload(workflow, undefined, formPayload);
      if (!validation.valid) {
        return new Response(
          JSON.stringify({
            success: false,
            error: validation.firstError || "Form validation failed",
            errors: validation.errors,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    const runId = `workflow_run:${uuidv4()}`;
    const $user = await buildWorkflowUserContext(event.request, db);

    // Kick off the background execution!
    runWorkflowBackground(workflow, runId, { form: formPayload, $user }).catch(console.error);

    return new Response(JSON.stringify({ success: true, runId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const url = new URL(event.request.url);
    const parsedLimit = Number.parseInt(url.searchParams.get("limit") || "20", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(50, Math.max(1, parsedLimit)) : 20;

    const db = await getDb();
    const rawDbId = id.includes(":") ? id.split(":")[1] : id;
    const dbId = rawDbId.replace(/[⟨⟩]/g, "");
    const recordId = new RecordId("workflow", dbId);
    const wfIdStr = recordId.toString();
    const cleanWfIdStr = `workflow:${dbId}`;
    const ids = Array.from(new Set([recordId, wfIdStr, cleanWfIdStr, dbId]));

    // Get recent runs for this workflow matching RecordId, chevron string, or clean string
    const query =
      "SELECT * OMIT context FROM workflow_run WHERE workflowId IN $ids ORDER BY startTime DESC LIMIT $limit";
    let results: any = [[]];
    try {
      const raw: any = await db.query(query, { ids, limit });
      results = [(raw[0] || []).map((r: any) => ({ ...r, id: r.id?.toString().replace(/[⟨⟩]/g, "") }))];
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }

    return new Response(JSON.stringify({ success: true, data: results[0] }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
