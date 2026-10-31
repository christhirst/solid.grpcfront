import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { v4 as uuidv4 } from "uuid";
import { RecordId } from "surrealdb";
import { getEffectiveAccessContext, getOwnerFromRequest } from "~/lib/auth";
import { canAccessResource, getResourcePermissions, normalizeGroupName } from "~/lib/groupAuth";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const url = new URL(event.request.url);
    const q = url.searchParams.get("q")?.trim() || "";

    let protos: any[] = [];
    try {
      let result;
      if (q) {
        result = await db.query(
          "SELECT * FROM proto_file WHERE (string::lowercase(name) CONTAINS string::lowercase($q) OR $q INSIDE tags) ORDER BY updated_at DESC",
          { q }
        );
      } else {
        result = await db.query("SELECT * FROM proto_file ORDER BY updated_at DESC");
      }
      const raw = (result[0] || []).map((p: any) => ({
        ...p,
        id: p.id?.toString().replace(/[⟨⟩]/g, ""),
      }));
      protos = raw
        .filter((p: any) => {
          const hasRealOwner = Boolean(p.owner && p.owner !== "anonymous");
          const hasTags = Array.isArray(p.tags) && p.tags.length > 0;
          if (ctx.sub === "anonymous") {
            return !hasRealOwner && !hasTags;
          }
          return canAccessResource(ctx, p, "view");
        })
        .map((p: any) => ({
          ...p,
          tags: Array.isArray(p.tags) ? p.tags : [],
          permissions: getResourcePermissions(ctx, p),
        }));
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }

    return new Response(JSON.stringify({ success: true, data: protos }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(event: APIEvent) {
  try {
    const db = await getDb();
    const body = await new Response(event.request.body).json();
    const owner = await getOwnerFromRequest(event.request);
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (ctx.sub !== "anonymous" && !ctx.capabilities.canManageProtos) {
      return Response.json(
        { success: false, error: "Creator or Admin role is required to upload Proto schemas." },
        { status: 403 }
      );
    }

    const rawId = body.id || `proto_file:${uuidv4()}`;
    const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const now = new Date().toISOString();
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => normalizeGroupName(String(t).split(":")[0] || "")).filter(Boolean)
      : [];

    const protoDef = {
      ...body,
      id: rawId,
      owner,
      tags,
      visibility: body.visibility || (tags.length > 0 ? "group" : "private"),
      created_at: body.created_at || now,
      updated_at: now,
    };
    const { id: _, permissions: _p, ...dataWithoutId } = protoDef;

    const recordId = new RecordId("proto_file", dbId);
    const result = await db.query("CREATE $id CONTENT $data", {
      id: recordId,
      data: dataWithoutId,
    });
    const records = Array.isArray(result) ? result[0] || result : result;
    const record = Array.isArray(records) ? records[0] : records;
    if (record) {
      record.id = `proto_file:${dbId}`;
      record.permissions = getResourcePermissions(ctx, record);
    }

    return new Response(JSON.stringify({ success: true, data: record }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
