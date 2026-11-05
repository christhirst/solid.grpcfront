import type { APIEvent } from "@solidjs/start/server";
import { RecordId } from "surrealdb";
import { getDb } from "~/lib/db";
import { getEffectiveAccessContext } from "~/lib/auth";
import {
  getOpenBaoStatus,
  getOpenBaoConfig,
  saveOpenBaoConfig,
  offloadSecretsToOpenBao,
  getCredentialSecuritySummary,
  writeVaultSecrets,
  formatVaultSecretRef,
  CONNECTION_SECRET_FIELDS,
} from "~/lib/openbao";

export async function GET(event: APIEvent) {
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (ctx.sub !== "anonymous" && !ctx.capabilities.canManageConnections) {
      return Response.json({ error: "Creator or Admin role required" }, { status: 403 });
    }
    const status = await getOpenBaoStatus();
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        configured: false,
        connected: false,
        url: "",
        mount: "secret",
        hasToken: false,
        source: "none",
        error: err?.message || "Failed to check OpenBao status",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(event: APIEvent) {
  try {
    const db = await getDb();
    const ctx = await getEffectiveAccessContext(event.request, db);
    if (ctx.sub !== "anonymous" && !ctx.capabilities.canManageConnections) {
      return Response.json({ error: "Creator or Admin role required" }, { status: 403 });
    }
    const body = await event.request.json();
    const action = body?.action || "save";

    if (action === "test") {
      const currentCfg = await getOpenBaoConfig();
      const testToken =
        body.token && body.token !== "********" ? body.token : currentCfg.token;

      const status = await getOpenBaoStatus({
        url: body.url ?? currentCfg.url,
        token: testToken,
        mount: body.mount ?? currentCfg.mount,
        namespace: body.namespace ?? currentCfg.namespace,
        caId: body.caId ?? currentCfg.caId,
        acceptInvalidCert: body.acceptInvalidCert ?? currentCfg.acceptInvalidCert,
      });

      return new Response(JSON.stringify(status), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      await saveOpenBaoConfig({
        url: body.url || "",
        token: body.token,
        mount: body.mount || "secret",
        namespace: body.namespace || "",
        caId: body.caId || "",
        acceptInvalidCert: Boolean(body.acceptInvalidCert),
      });
      const status = await getOpenBaoStatus();
      return new Response(JSON.stringify(status), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "offload_step_secret") {
      const { workflowId = "draft", stepId = "step", field = "secret", value } = body;
      if (!value || typeof value !== "string") {
        return new Response(JSON.stringify({ error: "Secret value is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const cleanWf = String(workflowId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const cleanStep = String(stepId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const cleanField = String(field).replace(/[^a-zA-Z0-9_-]/g, "_");
      const scopePath = `solidflow/workflows/${cleanWf}/${cleanStep}`;
      const { mount, path } = await writeVaultSecrets(scopePath, { [cleanField]: value });
      const ref = formatVaultSecretRef(mount, path, cleanField);
      return new Response(JSON.stringify({ ok: true, ref }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "migrate_all") {
      const status = await getOpenBaoStatus();
      if (!status.connected) {
        return new Response(
          JSON.stringify({
            error: status.error || "OpenBao is not connected. Cannot migrate secrets.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const db = await getDb();
      if (!db) {
        return new Response(JSON.stringify({ error: "Database unavailable" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const rawConns = await db.select("connection");
      const list = Array.isArray(rawConns) ? rawConns : [];
      let migratedCount = 0;

      for (const conn of list) {
        const summary = getCredentialSecuritySummary(conn, CONNECTION_SECRET_FIELDS);
        if (summary.cleartextFields.length === 0) continue;

        const rawId = conn.id ? String(conn.id).replace(/[⟨⟩]/g, "") : "";
        const cleanId = rawId.includes(":") ? rawId.split(":").slice(1).join(":") : rawId;
        if (!cleanId) continue;

        const scopePath = `solidflow/connections/${cleanId}`;
        const updatedPayload = await offloadSecretsToOpenBao(
          scopePath,
          { ...conn },
          conn,
          CONNECTION_SECRET_FIELDS
        );
        delete updatedPayload.id;
        updatedPayload.secretStorage = "openbao";
        updatedPayload.updatedAt = new Date().toISOString();

        try {
          await db.update(new RecordId("connection", cleanId)).merge(updatedPayload);
        } catch {
          await db.query(`UPDATE type::thing("connection", $id) MERGE $data`, {
            id: cleanId,
            data: updatedPayload,
          });
        }
        migratedCount++;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          migratedCount,
          message:
            migratedCount > 0
              ? `Migrated ${migratedCount} connection(s) from Cleartext DB to OpenBao Vault.`
              : "All connections with credentials are already secured in OpenBao.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "OpenBao operation failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
