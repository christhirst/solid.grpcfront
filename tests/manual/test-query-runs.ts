import { getDb } from "../../src/lib/db.ts";

async function run() {
  const db = await getDb();
  console.log("Connected");
  try {
    const result = await db.query("SELECT * FROM workflow_run ORDER BY startTime DESC LIMIT 5");
    console.log("Runs count:", (result[0] || []).length);
    console.log("Latest runs:", JSON.stringify(result[0], null, 2));
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
