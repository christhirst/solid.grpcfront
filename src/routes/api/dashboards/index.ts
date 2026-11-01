import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { v4 as uuidv4 } from "uuid";
import { getAuthUser, getEffectiveAccessContext } from "~/lib/auth";
import { saveDashboard, publishingErrorResponse } from "~/lib/dashboard/publishing";
import {
  PUBLIC_TAG,
  canAccessObject,
  getObjectPermissions,
  normalizeTagList,
} from "~/lib/groupAuth";
import { readJsonBody } from "~/lib/requestUtils";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const url = new URL(event.request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const libraryOnly =
      url.searchParams.get("library") === "true" ||
      url.searchParams.get("published") === "true" ||
      url.searchParams.get("public") === "true";

    if (!libraryOnly && ctx.sub !== "anonymous" && !ctx.capabilities.canEditDashboards) {
      return Response.json(
        {
          success: false,
          error: "Your platform role (viewer) can only use the Library.",
        },
        { status: 403 }
      );
    }

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
          const tags = normalizeTagList(d.tags);
          const groupTags = tags.filter((t) => t !== PUBLIC_TAG);

          if (libraryOnly) {
            if (canAccessObject(ctx, d, "dashboard", "view")) return true;
            if (d.isPublic === true && !ctx.isSimulating) {
              // Published dashboards without group restrictions (or with 'public' tag) are visible to all in Library
              if (!hasRealOwner || groupTags.length === 0) return true;
            }
            return false;
          }

          // Management view (/dashboards)
          if (ctx.sub === "anonymous") {
            return !hasRealOwner && tags.length === 0;
          }
          return canAccessObject(ctx, d, "dashboard", "view");
        })
        .map((d: any) => ({
          ...d,
          tags: normalizeTagList(d.tags),
          permissions: getObjectPermissions(ctx, d, "dashboard"),
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
    if (!ctx.capabilities.canEditDashboards) {
      return Response.json(
        { success: false, error: "Your platform role (viewer) can only use the Library and cannot create dashboards." },
        { status: 403 }
      );
    }
    const body = await readJsonBody(event);
    const record = await saveDashboard(db, user.sub, uuidv4(), body, true, ctx);
    return Response.json({
      success: true,
      data: {
        ...record,
        permissions: getObjectPermissions(ctx, record, "dashboard"),
      },
    });
  } catch (err) {
    return publishingErrorResponse(err);
  }
}
