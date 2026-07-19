import { getDb } from "../../src/lib/db.ts";
import { RecordId } from "surrealdb";

async function run() {
  const db = await getDb();
  console.log("Connected");
  try {
    const id = new RecordId("workflow", "test1234");
    const result = await db.create(id, { name: "test flow" });
    console.log("DB Result:", result);
    await db.delete(id);
  } catch (e) {
    console.error("CREATE ERROR:", e.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
