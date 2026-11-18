import type { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { resolvePublicDashboard, publishingErrorResponse } from "~/lib/dashboard/publishing";
import { getEffectiveAccessContext } from "~/lib/auth";
import { getVoteSummaries, voteKey } from "~/lib/votes";

export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url);
    const db = await getDb();
    const dashboard = await resolvePublicDashboard(db, url.searchParams.get("namespace") || "", url.searchParams.get("slug") || "");
    if (!dashboard) return Response.json({ success: false, error: "Dashboard not found." }, { status: 404 });
    try {
      const ctx = await getEffectiveAccessContext(event.request, db);
      const dbId = voteKey(dashboard.id);
      const voteMap = await getVoteSummaries(db, "dashboard", [dbId], ctx.sub !== "anonymous" ? ctx.sub : null);
      (dashboard as any).votes = voteMap.get(dbId) || {
        score: 0,
        up: 0,
        down: 0,
        myVote: 0,
        canVote: Boolean(ctx.sub && ctx.sub !== "anonymous"),
      };
    } catch {}
    return Response.json({ success: true, data: dashboard });
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
