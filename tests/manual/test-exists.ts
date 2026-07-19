import { getDb } from "../../src/lib/db.ts";
import { RecordId } from "surrealdb";

async function run() {
  const db = await getDb();
  const id = new RecordId("workflow", "test_exists_123");
  
  try {
    console.log("Creating (1st time)...");
    let res = await db.create(id).content({ name: "One" });
    console.log("Res1:", JSON.stringify(res));

    console.log("Creating (2nd time)...");
    res = await db.create(id).content({ name: "Two", extra: "field" });
    console.log("Res2:", JSON.stringify(res));
  } catch (err) {
    console.error("ERROR 2nd time:", err.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
