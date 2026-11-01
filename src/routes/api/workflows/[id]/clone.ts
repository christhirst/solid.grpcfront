import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";
import { scheduleWorkflow } from "~/lib/workflowScheduler";
import { getEffectiveAccessContext, getOwnerFromRequest } from "~/lib/auth";
import {
  canAccessObject,
  getObjectPermissions,
  normalizeTagList,
} from "~/lib/groupAuth";
import { readJsonBody } from "~/lib/requestUtils";

export async function POST(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (!ctx.capabilities.canManageWorkflows) {
      return Response.json(
        { success: false, error: "Creator or Admin role is required to clone workflows." },
        { status: 403 }
      );
    }
    const body = await readJsonBody(event);
    const owner = await getOwnerFromRequest(event.request);

    const dbId = (id || "").replace(/^workflow:/, "").replace(/[⟨⟩]/g, "").trim();
    const recordId = new RecordId("workflow", dbId);
    const existingRes = await db.select(recordId);
    const existing = Array.isArray(existingRes) ? existingRes[0] : existingRes;

    if (!existing) {
      return Response.json({ success: false, error: "Workflow not found." }, { status: 404 });
    }

    // Permission check: must have view access to clone
    if (!canAccessObject(ctx, existing, "workflow", "view")) {
      return Response.json(
        { success: false, error: "You do not have permission to view or clone this workflow." },
        { status: 403 }
      );
    }

    const newDbId = uuidv4();
    const newRecordId = new RecordId("workflow", newDbId);
    const now = new Date().toISOString();

    const cloneName =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim()
        : `${existing.name || "Workflow"} (Copy)`;

    const tags = Array.isArray(body.tags)
      ? normalizeTagList(body.tags)
      : normalizeTagList(existing.tags);

    const { id: _oldId, permissions: _p, created_at: _ca, updated_at: _ua, ...sourceData } = existing;

    const clonedWorkflow = {
      ...sourceData,
      name: cloneName,
      owner,
      tags,
      visibility: tags.length > 0 ? "group" : "private",
      created_at: now,
      updated_at: now,
    };

    const result = await db.query("CREATE $id CONTENT $data", {
      id: newRecordId,
      data: clonedWorkflow,
    });
    const records = Array.isArray(result) ? result[0] || result : result;
    const record = Array.isArray(records) ? records[0] : records;

    if (record) {
      record.id = `workflow:${newDbId}`;
      record.permissions = getObjectPermissions(ctx, record, "workflow");
      if (record.schedule) {
        scheduleWorkflow(record);
      }
    }

    return Response.json({ success: true, data: record });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
