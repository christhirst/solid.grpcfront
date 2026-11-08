import { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { getDb } from "~/lib/db";
import { getAuthUser, getEffectiveAccessContext } from "~/lib/auth";
import { canAccessObject, normalizeTagList } from "~/lib/groupAuth";
import { readJsonBody } from "~/lib/requestUtils";
import { castVote, normalizeVoteValue, voteKey } from "~/lib/votes";

export async function POST(event: APIEvent) {
  try {
    const user = await getAuthUser(event.request);
    if (!user || !user.sub || user.sub === "anonymous") {
      return Response.json(
        { success: false, error: "Please log in to vote." },
        { status: 401 }
      );
    }

    const body = await readJsonBody(event);
    const voteVal = normalizeVoteValue(body?.value);
    if (voteVal === null) {
      return Response.json(
        { success: false, error: "Invalid vote value. Expected 1, -1, or 0." },
        { status: 400 }
      );
    }

    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);

    const dbId = voteKey(id);
    let records: any = [];
    try {
      const recordId = new RecordId("dashboard", dbId);
      const result = await db.select(recordId);
      records = Array.isArray(result) ? result : result ? [result] : [];
    } catch {}

    if (!records || records.length === 0) {
      return Response.json({ success: false, error: "Dashboard not found" }, { status: 404 });
    }

    const record = Array.isArray(records) ? records[0] : records;
    const hasRealOwner = Boolean(record.owner && record.owner !== "anonymous");
    const tags = normalizeTagList(record.tags);

    // Permission check: any user who can view (or if public)
    const canView = canAccessObject(ctx, record, "dashboard", "view") || record.isPublic === true;
    if (!canView) {
      return Response.json(
        { success: false, error: "You do not have permission to view or vote on this dashboard." },
        { status: 403 }
      );
    }

    const summary = await castVote(db, "dashboard", dbId, user.sub, voteVal);

    return Response.json({
      success: true,
      data: summary,
    });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err.message || "Failed to vote on dashboard" },
      { status: 500 }
    );
  }
}
