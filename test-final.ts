import { getDb } from "./src/lib/db.ts";
import { RecordId } from "surrealdb";

async function run() {
  const db = await getDb();
  const id = new RecordId("workflow", "test_final_123");
  const data = { name: "Final", protoContent: "syntax='proto3';" };
  
  try {
    console.log("Creating...");
    const rawResult1 = await db.query("CREATE $id CONTENT $data", { id, data });
    let records1 = Array.isArray(rawResult1) ? (rawResult1[0] || rawResult1) : rawResult1;
    let rec1 = Array.isArray(records1) ? records1[0] : records1;
    console.log("Create output:", JSON.stringify(rec1));
    
    console.log("Updating...");
    const rawResult2 = await db.query("UPDATE $id CONTENT $data", { id, data: { ...data, extra: "field" } });
    let records2 = Array.isArray(rawResult2) ? (rawResult2[0] || rawResult2) : rawResult2;
    let rec2 = Array.isArray(records2) ? records2[0] : records2;
    console.log("Update output:", JSON.stringify(rec2));

  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
