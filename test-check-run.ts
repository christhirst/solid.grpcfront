import { getDb } from "./src/lib/db.ts";
import { RecordId } from "surrealdb";

async function run() {
  const db = await getDb();
  console.log("Connected");
  try {
    const res = await db.select(new RecordId("workflow_run", "test-rest-todo"));
    console.log("Run details:", JSON.stringify(res, null, 2));
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
