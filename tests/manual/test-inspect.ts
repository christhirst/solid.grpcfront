import { getDb } from "../../src/lib/db.ts";

async function run() {
  const db = await getDb();
  console.log("Connected");
  try {
    const result = await db.query("SELECT * FROM workflow ORDER BY updated_at DESC LIMIT 5");
    const raw = result[0] || result;
    console.log("Found rows:", raw.length);
    if (raw.length > 0) {
      raw.forEach((r, i) => console.log(`Row ${i}:`, JSON.stringify(r)));
    }
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
