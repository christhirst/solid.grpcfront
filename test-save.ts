import { getDb } from "./src/lib/db.ts";
import { RecordId } from "surrealdb";

async function run() {
  try {
    const db = await getDb();
    const id = new RecordId("workflow", "test_save_123");
    
    const payload = {
      name: "Test Flow",
      protoContent: "syntax='proto3';",
      serverAddress: "localhost:50051",
      useTls: true,
      steps: [{ id: "step1", serviceName: "Test", methodName: "DoSomething" }]
    };

    console.log("Creating/Updating record...");
    await db.update(id).merge(payload);
    
    const read = await db.select(id);
    console.log("Read stored record:", JSON.stringify(read));
    
  } catch (err) {
    console.error("Error:", err.message);
  }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
