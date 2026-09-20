import { RecordId } from "surrealdb";
import defaultData from "./defaultData.json";

/**
 * Ensures that if SurrealDB is empty (e.g. fresh in-memory or newly created database),
 * default workflows, dashboards, and connections are seeded so the application never starts empty.
 */
export async function bootstrapDefaultData(db: any): Promise<void> {
  try {
    const wfRes = await db.query("SELECT count() FROM workflow;");
    const wfCount = Array.isArray(wfRes) && wfRes[0] && wfRes[0][0] ? wfRes[0][0].count : 0;

    const dashRes = await db.query("SELECT count() FROM dashboard;");
    const dashCount = Array.isArray(dashRes) && dashRes[0] && dashRes[0][0] ? dashRes[0][0].count : 0;

    if (wfCount > 0 || dashCount > 0) {
      return; // Already has data, no bootstrap needed
    }

    console.log("[DB] [BOOTSTRAP] Empty database detected. Bootstrapping default data...");

    // 1. Seed Connections
    for (const conn of defaultData.connections || []) {
      try {
        const rawId = conn.id;
        const dbId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
        const { id: _, ...dataWithoutId } = conn;
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
