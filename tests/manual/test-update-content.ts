import { getDb } from "../../src/lib/db.ts";
import { RecordId } from "surrealdb";

async function run() {
  const db = await getDb();
  const id = new RecordId("workflow", "test_content_update_123");
  
  try {
    console.log("Creating baseline...");
    try { await db.create(id).content({ name: "ContentTarget" }); } catch (e) {}
    
    console.log("Attempting update.content...");
    const res = await db.update(id).content({ extra: "field_content" });
    console.log("Update Result:", JSON.stringify(res));

    const verify = await db.select(id);
    console.log("Select Result:", JSON.stringify(verify));
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
