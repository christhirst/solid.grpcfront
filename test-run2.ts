import { getDb } from "./src/lib/db.ts";
import { runWorkflowBackground } from "./src/lib/workflowEngine.ts";

async function run() {
  const db = await getDb();
  console.log("Connected to DB.");

  try {
    const rawResult = await db.query("SELECT * FROM workflow ORDER BY updated_at DESC LIMIT 5");
    let records = Array.isArray(rawResult) ? (rawResult[0] || rawResult) : rawResult;
    records = Array.isArray(records) ? records : [records];
    
    const target = records.find((r: any) => r && r.steps && r.steps.some((s: any) => s.serviceName === "Depot"));
    if (!target) {
      console.log("No workflows with Depot service found. Workflows:");
      console.log(JSON.stringify(records.map((r: any) => r?.id)));
      process.exit(0);
    }
    
    console.log("Triggering runWorkflowBackground for:", target.id);
    await runWorkflowBackground("workflow_run:test_runner", target);
    console.log("DONE!");
    process.exit(0);

  } catch (err) {
    console.error("Test script failed:", err.message);
    process.exit(1);
  }
}

// Ensure it absolutely exits
setTimeout(() => {
  console.error("Script timed out!");
  process.exit(2);
}, 2000);

run();
