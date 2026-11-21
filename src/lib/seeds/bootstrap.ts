import { RecordId } from "surrealdb";
import defaultData from "./defaultData.json";
import { AUTHZEN_PROTO_CONTENT } from "~/lib/authzenProto";
import { encryptRecordSecrets, getEncryptionStatus } from "~/lib/crypto/envelope";
import { CONNECTION_SECRET_FIELDS } from "~/lib/vaultRef";

/**
 * Ensures that if SurrealDB is empty (e.g. fresh in-memory or newly created database),
 * default workflows, dashboards, and connections are seeded so the application never starts empty.
 */
export async function bootstrapDefaultData(db: any): Promise<void> {
  try {
    // Always ensure built-in OpenID AuthZEN 1.0 proto schema is present in proto_file registry
    try {
      const authzenProtoId = new RecordId("proto_file", "authzen");
      const existingProto = await db.select(authzenProtoId).catch(() => null);
      const protoRecord = Array.isArray(existingProto) ? existingProto[0] : existingProto;
      if (!protoRecord) {
        const now = new Date().toISOString();
        await db.query("UPSERT $id CONTENT $data;", {
          id: authzenProtoId,
          data: {
            name: "authzen.proto",
            content: AUTHZEN_PROTO_CONTENT,
            owner: "anonymous",
            visibility: "public",
            tags: ["public", "authzen"],
            created_at: now,
            updated_at: now,
          },
        });
      }
    } catch {}

    const wfRes = await db.query("SELECT count() FROM workflow;");
    const wfCount = Array.isArray(wfRes) && wfRes[0] && wfRes[0][0] ? wfRes[0][0].count : 0;

    const dashRes = await db.query("SELECT count() FROM dashboard;");
    const dashCount = Array.isArray(dashRes) && dashRes[0] && dashRes[0][0] ? dashRes[0][0].count : 0;

    if (wfCount > 0 || dashCount > 0) {
      // Heal legacy seeded incident_source_from_DB workflow if it still has stale step-level
      // databaseUser="ai" / databasePass="T#0g#0sh#1G#1nza" overrides masking the saved connection
      try {
        const incidentWfId = new RecordId("workflow", "92a5d7b0-a4f7-47f5-ad6a-525c481f16b5");
        const existingIncidentWf = await db.select(incidentWfId).catch(() => null);
        const incidentWf = Array.isArray(existingIncidentWf) ? existingIncidentWf[0] : existingIncidentWf;
        if (incidentWf && Array.isArray(incidentWf.steps)) {
          let stepsChanged = false;
          const cleanedSteps = incidentWf.steps.map((s: any) => {
            if (
              s &&
              s.type === "database" &&
              (s.connectionMode === "saved" || s.connectionId) &&
              s.databaseUser === "ai" &&
              (s.databasePass === "T#0g#0sh#1G#1nza" || !s.databasePass || String(s.databasePass).startsWith("bao:"))
            ) {
              stepsChanged = true;
              const { databaseUser: _u, databasePass: _p, ...rest } = s;
              return rest;
            }
            return s;
          });
          if (stepsChanged) {
            await db.query("UPDATE $id MERGE { steps: $steps };", {
              id: incidentWfId,
              steps: cleanedSteps,
            });
            console.log("[DB] [BOOTSTRAP] Cleaned legacy step-level credential overrides on incident_source_from_DB.");
          }
        }
      } catch {}
      return; // Already has data, no bootstrap needed
    }

    console.log("[DB] [BOOTSTRAP] Empty database detected. Bootstrapping default data...");

    // 1. Seed Connections
    const encryptionConfigured = getEncryptionStatus().configured;
    for (const conn of defaultData.connections || []) {
      try {
        const rawId = conn.id;
        const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
        const { id: _, ...rawWithoutId } = conn;
        const dataWithoutId = encryptionConfigured
          ? encryptRecordSecrets(`connection:${dbId}`, rawWithoutId, null, CONNECTION_SECRET_FIELDS)
          : rawWithoutId;
        const recordId = new RecordId("connection", dbId);
        await db.query("CREATE $id CONTENT $data;", { id: recordId, data: dataWithoutId });
      } catch (err: any) {
        console.warn(`[DB] [BOOTSTRAP] Could not seed connection ${conn.id}:`, err?.message || err);
      }
    }

    // 2. Seed Workflows
    for (const wf of defaultData.workflows || []) {
      try {
        const rawId = wf.id;
        const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
        const { id: _, ...dataWithoutId } = wf;
        const recordId = new RecordId("workflow", dbId);
        await db.query("CREATE $id CONTENT $data;", { id: recordId, data: dataWithoutId });
      } catch (err: any) {
        console.warn(`[DB] [BOOTSTRAP] Could not seed workflow ${wf.id}:`, err?.message || err);
      }
    }

    // 3. Seed Dashboards
    for (const dash of defaultData.dashboards || []) {
      try {
        const rawId = dash.id;
        const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
        const { id: _, ...dataWithoutId } = dash;
        const recordId = new RecordId("dashboard", dbId);
        await db.query("CREATE $id CONTENT $data;", { id: recordId, data: dataWithoutId });
      } catch (err: any) {
        console.warn(`[DB] [BOOTSTRAP] Could not seed dashboard ${dash.id}:`, err?.message || err);
      }
    }

    console.log("[DB] [BOOTSTRAP] Successfully seeded default workflows, dashboards, and connections.");
  } catch (e: any) {
    console.warn("[DB] [BOOTSTRAP] Error during default data check/bootstrap:", e?.message || e);
  }
}
