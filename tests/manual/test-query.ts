import { getDb } from "../../src/lib/db.ts";

async function run() {
  const db = await getDb();
  console.log("Connected");
  try {
    const result = await db.query("SELECT * FROM workflow LIMIT 2");
    console.log("Type of result:", typeof result);
    console.log("IsArray(result):", Array.isArray(result));
    console.log("result:", JSON.stringify(result));
    console.log("result[0]:", JSON.stringify(result[0]));
    
    // In SDK v2, are results grouped?
    const workflows = (Array.isArray(result) ? (result[0] || result) : result);
    console.log("Extracted workflows:", typeof workflows);
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
