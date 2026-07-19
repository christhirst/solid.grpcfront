import { getDb } from "../../src/lib/db.ts";

async function run() {
  const db = await getDb();
  console.log("Connected");
  try {
    const result = await db.query("SELECT * FROM workflow ORDER BY updated_at DESC LIMIT 10");
    const raw = result[0] || result;
    console.log("Found rows:", raw.length);
    raw.forEach((r, i) => {
      console.log(`\nRow ${i} id:`, JSON.stringify(r.id));
      console.log(`Row ${i} name:`, r.name);
      console.log(`Row ${i} steps:`, JSON.stringify(r.steps));
      console.log(`Row ${i} protoLength:`, r.protoContent?.length);
      console.log(`Row ${i} start of proto:`, r.protoContent?.substring(0, 100));
      
      if (r.protoContent && r.steps && r.steps[0]) {
        console.log(`Testing parser directly against this protoContent...`);
        try {
          const { parseProtoContent } = require('../../src/lib/protoParser.ts'); // Wait, tsx can't require TS sometimes... we will see
        } catch (e) {}
      }
    });
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
