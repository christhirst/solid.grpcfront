import { getDb } from "../../src/lib/db.ts";

async function run() {
  const db = await getDb();
  console.log("Connected");
  try {
    const ids = ["workflow:472b8245-80fe-434a-8abd-f9d4e561226d", "workflow:32307516-cea2-4bf3-8046-e24dd32cac27"];
    for (const wId of ids) {
      console.log(`\nQuerying runs for workflow: ${wId}`);
      const result = await db.query("SELECT * FROM workflow_run WHERE workflowId = $wId", { wId });
      const raw = result[0] || [];
      console.log(`Runs found: ${raw.length}`);
      if (raw.length > 0) {
        console.log("Latest run:", JSON.stringify(raw[0], null, 2));
      }
    }
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
