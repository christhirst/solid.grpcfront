import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { v4 as uuidv4 } from "uuid";
import { getAuthUser, getEffectiveAccessContext } from "~/lib/auth";
import { saveDashboard, publishingErrorResponse } from "~/lib/dashboard/publishing";
import { canAccessResource, getResourcePermissions } from "~/lib/groupAuth";
import { readJsonBody } from "~/lib/requestUtils";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const url = new URL(event.request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const publishedOnly =
      url.searchParams.get("published") === "true" || url.searchParams.get("public") === "true";

    let dashboards: any[] = [];
    try {
      let result;
      if (q) {
        result = await db.query(
          "SELECT * FROM dashboard WHERE (string::lowercase(name) CONTAINS string::lowercase($q) OR string::lowercase(description ?? '') CONTAINS string::lowercase($q) OR $q INSIDE tags) ORDER BY updated_at DESC",
          { q }
        );
      } else {
        result = await db.query("SELECT * FROM dashboard ORDER BY updated_at DESC");
      }
      const raw = ((result[0] as any[]) || []).map((w: any) => ({
        ...w,
        id: w.id?.toString().replace(/[⟨⟩]/g, ""),
      }));

      dashboards = raw
        .filter((d: any) => {
          const hasRealOwner = Boolean(d.owner && d.owner !== "anonymous");
          const hasTags = Array.isArray(d.tags) && d.tags.length > 0;

          if (publishedOnly) {
            // In library view: must be published (or shared with user's active group)
            if (!d.isPublic) return false;
            if (ctx.isSimulating) {
              return canAccessResource(ctx, d, "view");
            }
            if (hasRealOwner && hasTags) {
              return canAccessResource(ctx, d, "view");
            }
            return true;
          }

          // Management view (/dashboards)
          if (ctx.sub === "anonymous") {
            return !hasRealOwner && !hasTags;
          }
          return canAccessResource(ctx, d, "view");
        })
        .map((d: any) => ({
          ...d,
          permissions: getResourcePermissions(ctx, d),
        }));
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }

    return new Response(JSON.stringify({ success: true, data: dashboards }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[API Dashboards] General error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(event: APIEvent) {
  const user = await getAuthUser(event.request);
  if (!user || user.sub === "anonymous") {
    return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  }
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const body = await readJsonBody(event);
    const record = await saveDashboard(db, user.sub, uuidv4(), body, true, ctx);
    return Response.json({
      success: true,
      data: {
        ...record,
        permissions: getResourcePermissions(ctx, record),
      },
    });
  } catch (err) {
    return publishingErrorResponse(err);
  }
}
