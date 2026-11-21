import { APIEvent } from "@solidjs/start/server";
import { getDb } from "~/lib/db";
import { RecordId } from "surrealdb";
import { normalizeConnection } from "~/lib/connections";
import { getEffectiveAccessContext } from "~/lib/auth";
import { canAccessResource, getResourcePermissions, normalizeGroupName } from "~/lib/groupAuth";
import { offloadSecretsToOpenBao, deleteVaultSecrets, CONNECTION_SECRET_FIELDS } from "~/lib/openbao";
import {
  encryptRecordSecrets,
  mergeMaskedConnectionSecrets,
  sanitizeConnectionForClient,
} from "~/lib/crypto/envelope";

export async function GET(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    const recordId = new RecordId("connection", dbId);

    const result = await db.select(recordId);
    const records = Array.isArray(result) ? result : result ? [result] : [];
    const connection = records[0];

    if (!connection) {
      return new Response(JSON.stringify({ success: false, error: "Connection not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const hasRealOwner = Boolean(connection.owner && connection.owner !== "anonymous");
    const hasTags = Array.isArray(connection.tags) && connection.tags.length > 0;
    if (ctx.sub === "anonymous") {
      if (hasRealOwner || hasTags) {
        return Response.json(
          { success: false, error: "You do not have permission to view this connection." },
          { status: 403 }
        );
      }
    } else if (!canAccessResource(ctx, connection, "view")) {
      return Response.json(
        { success: false, error: "You do not have permission to view this connection." },
        { status: 403 }
      );
    }

    const normalized = sanitizeConnectionForClient(
      normalizeConnection({ ...connection, id: `connection:${dbId}` })
    ) as any;
    normalized.tags = Array.isArray(normalized.tags) ? normalized.tags : [];
    normalized.permissions = getResourcePermissions(ctx, normalized);

    return new Response(JSON.stringify({ success: true, data: normalized }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function PUT(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const body = await new Response(event.request.body).json();
    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    const recordId = new RecordId("connection", dbId);

    const existingRes = await db.select(recordId);
    const existing = Array.isArray(existingRes) ? existingRes[0] : existingRes;
    if (existing) {
      const hasRealOwner = Boolean(existing.owner && existing.owner !== "anonymous");
      const hasTags = Array.isArray(existing.tags) && existing.tags.length > 0;
      if ((hasRealOwner || hasTags) && !canAccessResource(ctx, existing, "write")) {
        return Response.json(
          { success: false, error: "You do not have write permission to modify this connection." },
          { status: 403 }
        );
      }
    }

    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => normalizeGroupName(String(t).split(":")[0] || "")).filter(Boolean)
      : Array.isArray(existing?.tags)
        ? existing.tags
        : [];
    const owner =
      existing?.owner && existing.owner !== "anonymous"
        ? existing.owner
        : ctx.sub !== "anonymous"
          ? ctx.sub
          : existing?.owner || "anonymous";

    let mergedBody: Record<string, any> = mergeMaskedConnectionSecrets(
      {
        ...existing,
        ...body,
      },
      existing,
      CONNECTION_SECRET_FIELDS
    );

    if (mergedBody.secretStorage === "openbao") {
      mergedBody = await offloadSecretsToOpenBao(
        `solidflow/connections/${dbId}`,
        mergedBody,
        existing,
        CONNECTION_SECRET_FIELDS
      );
      delete mergedBody.encrypted_dek;
      delete mergedBody.key_version;
      delete mergedBody.key_rotated_at;
    } else {
      mergedBody.secretStorage = "db";
      try {
        mergedBody = encryptRecordSecrets(
          `connection:${dbId}`,
          mergedBody,
          existing,
          CONNECTION_SECRET_FIELDS
        );
      } catch (encErr: any) {
        return Response.json(
          { success: false, error: encErr?.message || "Failed to encrypt connection credentials." },
          { status: 400 }
        );
      }
    }

    const normalized = normalizeConnection({
      ...mergedBody,
      id: `connection:${dbId}`,
      owner,
      tags,
      updated_at: new Date().toISOString(),
    });
    const { id: _, permissions: _p, ...dataWithoutId } = normalized as any;

    const result = await db.query("UPDATE $id CONTENT $data", { id: recordId, data: dataWithoutId });
    const records = Array.isArray(result) ? result[0] || result : result;
    const record = Array.isArray(records) ? records[0] : records;

    const output = sanitizeConnectionForClient(
      normalizeConnection(record ? { ...record, id: `connection:${dbId}` } : normalized)
    ) as any;
    output.permissions = getResourcePermissions(ctx, output);

    return new Response(JSON.stringify({ success: true, data: output }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE(event: APIEvent) {
  try {
    const id = event.params.id;
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    const dbId = (id.includes(":") ? id.split(":")[1] : id).replace(/[⟨⟩]/g, "").trim();
    const recordId = new RecordId("connection", dbId);

    const existingRes = await db.select(recordId);
    const existing = Array.isArray(existingRes) ? existingRes[0] : existingRes;
    if (existing) {
      const hasRealOwner = Boolean(existing.owner && existing.owner !== "anonymous");
      const hasTags = Array.isArray(existing.tags) && existing.tags.length > 0;
      if ((hasRealOwner || hasTags) && !canAccessResource(ctx, existing, "delete")) {
        return Response.json(
          { success: false, error: "You do not have delete permission for this connection." },
          { status: 403 }
        );
      }
    }

    await db.delete(recordId);
    await deleteVaultSecrets(`solidflow/connections/${dbId}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
