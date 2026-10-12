import type { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { resolvePublicDashboard, publishingErrorResponse } from "~/lib/dashboard/publishing";

export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url);
    const dashboard = await resolvePublicDashboard(await getDb(), url.searchParams.get("namespace") || "", url.searchParams.get("slug") || "");
    if (!dashboard) return Response.json({ success: false, error: "Dashboard not found." }, { status: 404 });
    return Response.json({ success: true, data: dashboard });
  } catch (error) {
    return publishingErrorResponse(error);
  }
}
