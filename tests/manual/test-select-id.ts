import { getDb } from "../../src/lib/db.ts";
import { RecordId } from "surrealdb";

async function run() {
  const db = await getDb();
  console.log("Connected");
  
  const rawId = "472b8245-80fe-434a-8abd-f9d4e561226d";
  
  // Try 1: db.select(new RecordId("workflow", rawId))
  try {
    const res = await db.select(new RecordId("workflow", rawId));
    console.log("Select with RecordId:", JSON.stringify(res));
  } catch (e: any) {
    console.log("Select with RecordId failed:", e.message);
  }

  // Try 2: db.query("SELECT * FROM workflow WHERE id = $id", { id: new RecordId("workflow", rawId) })
  try {
    const res = await db.query("SELECT * FROM workflow WHERE id = $id", { id: new RecordId("workflow", rawId) });
    console.log("Query with RecordId:", JSON.stringify(res[0]));
  } catch (e: any) {
    console.log("Query with RecordId failed:", e.message);
  }

  // Try 3: db.query("SELECT * FROM type::thing('workflow', $id)", { id: rawId })
  try {
    const res = await db.query("SELECT * FROM type::thing('workflow', $id)", { id: rawId });
    console.log("Query with type::thing:", JSON.stringify(res[0]));
  } catch (e: any) {
    console.log("Query with type::thing failed:", e.message);
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
