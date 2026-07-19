import { getDb } from "../../src/lib/db.ts";
import { RecordId } from "surrealdb";
async function run() {
  const db = await getDb();
  const id = new RecordId("workflow", "test_content_123");
  const payload = { test: true, fields: ["hello"] };
  const res = await db.create(id).content(payload);
  console.log("CreateResult:", JSON.stringify(res));
  process.exit(0);
}
run();
