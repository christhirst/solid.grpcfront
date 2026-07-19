import { getDb } from "../../src/lib/db.ts";
import { StringRecordId } from "surrealdb";
import { v4 as uuidv4 } from "uuid";

async function run() {
  const db = await getDb();
  console.log("DB connected");

  const dbId = uuidv4();
  const recordId = new StringRecordId("test_table", dbId);
  const data = { name: "test record" };

  try {
    const result = await db.query("CREATE $recordId CONTENT $data", {
      recordId,
      data
    });
    console.log("CREATE Result:", JSON.stringify(result));
  } catch (err: any) {
    console.error("Failed CREATE:", err.message);
  }

  try {
    const result2 = await db.query("SELECT * FROM test_table");
    console.log("SELECT Result:", JSON.stringify(result2));
  } catch (err: any) {
    console.error("Failed SELECT:", err.message);
  }
}

run().catch(console.error);
