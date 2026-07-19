import { getDb } from "../../src/lib/db.ts";
import { RecordId } from "surrealdb";

async function run() {
  const db = await getDb();
  const id = new RecordId("workflow", "test_merge_123");
  
  try {
    console.log("Creating baseline...");
    await db.create(id).content({ name: "MergeTarget" });
    
    console.log("Attempting merge...");
    const res = await db.update(id).merge({ extra: "field" });
    console.log("Merge Result:", JSON.stringify(res));

    const verify = await db.select(id);
    console.log("Select Result:", JSON.stringify(verify));
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
