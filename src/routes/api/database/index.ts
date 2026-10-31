import { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { getDb } from "~/lib/db";
import { readJsonBody } from "~/lib/requestUtils";
import { getEffectiveAccessContext, getOwnerFromRequest } from "~/lib/auth";
import { canAccessResource, getResourcePermissions, normalizeGroupName } from "~/lib/groupAuth";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (ctx.sub !== "anonymous" && !ctx.capabilities.canManageDatabase) {
      return Response.json(
        { success: false, error: "Admin role is required to access Database management." },
        { status: 403 }
      );
    }

    let databases: string[] = [];
    try {
      const info = await db.query("INFO FOR NAMESPACE;");
      const databasesObj = (info[0] as any)?.databases || {};
      databases = Object.keys(databasesObj);
    } catch {
      databases = [process.env.SURREALDB_DB || "main"];
    }

    if (databases.length === 0) {
      databases = [process.env.SURREALDB_DB || "main"];
    }

    // Load database_meta records for ownership and group tags
    const metaMap: Record<string, any> = {};
    try {
      const metaRes = await db.query("SELECT * FROM database_meta;");
      const rows = (metaRes?.[0] as any[]) || [];
      for (const r of rows) {
        if (r?.name) {
          metaMap[r.name] = r;
        }
      }
    } catch {
      // Ignore if table does not exist yet
    }

    const visibleDatabases: string[] = [];
    const metaOutput: Record<string, any> = {};

    for (const dbName of databases) {
      const meta = metaMap[dbName] || { name: dbName, owner: "anonymous", tags: [] };
      const hasRealOwner = Boolean(meta.owner && meta.owner !== "anonymous");
      const hasTags = Array.isArray(meta.tags) && meta.tags.length > 0;

      let allowed = false;
      if (ctx.sub === "anonymous") {
        allowed = !hasRealOwner && !hasTags;
      } else {
        allowed = canAccessResource(ctx, meta, "view");
      }

      if (allowed) {
        visibleDatabases.push(dbName);
        metaOutput[dbName] = {
          name: dbName,
          owner: meta.owner || "anonymous",
          tags: Array.isArray(meta.tags) ? meta.tags : [],
          permissions: getResourcePermissions(ctx, meta),
        };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: visibleDatabases,
        meta: metaOutput,
      }),
      {
        headers: { "content-type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST(event: APIEvent) {
  try {
    const body = await readJsonBody(event);
    const name = body?.name;
    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Database name required" }), {
        status: 400,
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid database name" }), {
        status: 400,
      });
    }

    const db = await getDb();
    const owner = await getOwnerFromRequest(event.request);
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (!ctx.capabilities.canManageDatabase) {
      return Response.json(
        { success: false, error: "Admin role is required to create or manage databases." },
        { status: 403 }
      );
    }
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => normalizeGroupName(String(t).split(":")[0] || "")).filter(Boolean)
      : [];

    await db.query(`DEFINE DATABASE ${name};`);

    const now = new Date().toISOString();
    const metaId = new RecordId("database_meta", name);
    const metaData = {
      name,
      owner,
      tags,
      created_at: now,
      updated_at: now,
    };
    await db.query("UPSERT $id CONTENT $data;", { id: metaId, data: metaData });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          name,
          owner,
          tags,
          permissions: getResourcePermissions(ctx, metaData),
        },
      }),
      {
        headers: { "content-type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function PUT(event: APIEvent) {
  try {
    const body = await readJsonBody(event);
    const name = body?.name;
    if (!name || typeof name !== "string" || !/^[a-zA-Z0-9_]+$/.test(name)) {
      return Response.json({ success: false, error: "Valid database name is required." }, { status: 400 });
    }

    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (!ctx.capabilities.canManageDatabase) {
      return Response.json(
        { success: false, error: "Admin role is required to manage databases." },
        { status: 403 }
      );
    }
    const metaId = new RecordId("database_meta", name);
    const existingRes = await db.select(metaId);
    const existing = Array.isArray(existingRes) ? existingRes[0] : existingRes;

    if (existing) {
      const hasRealOwner = Boolean(existing.owner && existing.owner !== "anonymous");
      const hasTags = Array.isArray(existing.tags) && existing.tags.length > 0;
      if ((hasRealOwner || hasTags) && !canAccessResource(ctx, existing, "write")) {
        return Response.json(
          { success: false, error: "You do not have write permission to modify this database's tags." },
          { status: 403 }
        );
      }
    }

    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => normalizeGroupName(String(t).split(":")[0] || "")).filter(Boolean)
      : [];
    const owner =
      existing?.owner && existing.owner !== "anonymous"
        ? existing.owner
        : ctx.sub !== "anonymous"
          ? ctx.sub
          : "anonymous";
    const now = new Date().toISOString();
    const updatedMeta = {
      name,
      owner,
      tags,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    await db.query("UPSERT $id CONTENT $data;", { id: metaId, data: updatedMeta });

    return Response.json({
      success: true,
      data: {
        ...updatedMeta,
        permissions: getResourcePermissions(ctx, updatedMeta),
      },
    });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
