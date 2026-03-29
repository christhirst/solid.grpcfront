import { getDb } from "./src/lib/db.ts";
import { StringRecordId } from "surrealdb";

async function run() {
  const db = await getDb();
  const id = new StringRecordId("workflow", "test1234");
  try {
    const result = await db.query("CREATE $id CONTENT $data", {
      id,
      data: { name: "test flow" }
    });
    console.log("DB Result:", JSON.stringify(result));
  } catch (e) {
    console.error("CREATE ERROR:", e.message);
  }
  
  // Cleanup
  await db.query("DELETE $id", { id });
}
run();
