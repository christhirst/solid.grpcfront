import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { v4 as uuidv4 } from "uuid";
import { getAuthUser } from "~/lib/auth";
import { saveDashboard, publishingErrorResponse } from "~/lib/dashboard/publishing";
import { readJsonBody } from "~/lib/requestUtils";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    const url = new URL(event.request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const publishedOnly = url.searchParams.get("published") === "true" || url.searchParams.get("public") === "true";

    let dashboards: any = [];
    try {
      let result;
      if (q && publishedOnly) {
        result = await db.query(
          "SELECT * FROM dashboard WHERE isPublic = true AND (string::lowercase(name) CONTAINS string::lowercase($q) OR string::lowercase(description ?? '') CONTAINS string::lowercase($q) OR $q INSIDE tags) ORDER BY updated_at DESC",
          { q }
        );
      } else if (publishedOnly) {
        result = await db.query("SELECT * FROM dashboard WHERE isPublic = true ORDER BY updated_at DESC");
      } else if (q) {
        result = await db.query(
          "SELECT * FROM dashboard WHERE (string::lowercase(name) CONTAINS string::lowercase($q) OR string::lowercase(description ?? '') CONTAINS string::lowercase($q) OR $q INSIDE tags) ORDER BY updated_at DESC",
          { q }
        );
      } else {
        result = await db.query("SELECT * FROM dashboard ORDER BY updated_at DESC");
      }
      dashboards = ((result[0] as any[]) || []).map((w: any) => ({ ...w, id: w.id?.toString().replace(/[⟨⟩]/g, "") }));
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }

    try {
      const responseBody = JSON.stringify({ success: true, data: dashboards });
      return new Response(responseBody, {
        headers: { "Content-Type": "application/json" },
      });
    } catch (stringifyErr: any) {
      console.error("[API Dashboards] Stringification error:", stringifyErr);
      throw stringifyErr;
    }
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
  if (!user || user.sub === "anonymous") return Response.json({ success: false, error: "Please log in." }, { status: 401 });
  try {
    const db = await getDb();
    const body = await readJsonBody(event);
    const record = await saveDashboard(db, user.sub, uuidv4(), body, true);
    return Response.json({ success: true, data: record });
  } catch (err) {
    return publishingErrorResponse(err);
  }
}
