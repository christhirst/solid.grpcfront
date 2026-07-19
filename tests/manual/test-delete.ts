import { getDb } from "../../src/lib/db.ts";
import { RecordId } from "surrealdb";

async function run() {
  try {
    const db = await getDb();
    const id = new RecordId("workflow", "test_delete_123");
    
    console.log("Creating record...");
    await db.create(id, { name: "To be deleted" });
    
    const read1 = await db.select(id);
    console.log("Read 1:", JSON.stringify(read1));
    
    console.log("Deleting record...");
    await db.delete(id);
    
    const read2 = await db.select(id);
    console.log("Read 2:", JSON.stringify(read2));
    
  } catch (err) {
    console.error("Error:", err.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
