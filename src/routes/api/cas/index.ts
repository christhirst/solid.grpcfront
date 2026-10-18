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
    let certs: any[] = [];
    try {
      const result = await db.query("SELECT * FROM ca_cert ORDER BY updated_at DESC");
      const raw = (result[0] || []).map((c: any) => ({
        ...c,
        id: c.id?.toString().replace(/[⟨⟩]/g, ""),
      }));
      certs = raw
        .filter((c: any) => {
          const hasRealOwner = Boolean(c.owner && c.owner !== "anonymous");
          const hasTags = Array.isArray(c.tags) && c.tags.length > 0;
          if (ctx.sub === "anonymous") {
            return !hasRealOwner && !hasTags;
          }
          return canAccessResource(ctx, c, "view");
        })
        .map((c: any) => ({
          ...c,
          tags: Array.isArray(c.tags) ? c.tags : [],
          permissions: getResourcePermissions(ctx, c),
        }));
    } catch (e: any) {
      if (!e.message?.includes("does not exist")) throw e;
    }
    return new Response(JSON.stringify({ success: true, data: certs }), {
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

    const rawId = body.id || `ca_cert:${uuidv4()}`;
    const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const now = new Date().toISOString();
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => normalizeGroupName(String(t).split(":")[0] || "")).filter(Boolean)
      : [];

    const certDef = {
      ...body,
      id: rawId,
      owner,
      tags,
      visibility: body.visibility || (tags.length > 0 ? "group" : "private"),
      created_at: body.created_at || now,
      updated_at: now,
    };
    const { id: _, permissions: _p, ...dataWithoutId } = certDef;

    const recordId = new RecordId("ca_cert", dbId);
    const result = await db.query("CREATE $id CONTENT $data", {
      id: recordId,
      data: dataWithoutId,
    });
    const records = Array.isArray(result) ? result[0] || result : result;
    const record = Array.isArray(records) ? records[0] : records;
    if (record) {
      record.id = `ca_cert:${dbId}`;
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