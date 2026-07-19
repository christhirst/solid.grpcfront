import { getDb } from "../../src/lib/db.ts";
import { runWorkflowBackground } from "../../src/lib/workflowEngine.ts";

async function run() {
  const db = await getDb();
  console.log("Connected to DB.");

  try {
    // Fetch the broken workflow the user just tried to run
    const result = await db.query("SELECT * FROM workflow ORDER BY updated_at DESC LIMIT 5");
    const raw = result[0] || result;
    const records = Array.isArray(raw) ? raw : [raw];
    
    // Find one that has 'Depot' step
    const target = records.find(r => r.steps && r.steps.some((s: any) => s.serviceName === "Depot"));
    if (!target) {
      console.log("No workflows with Depot service found in the latest 5.");
      console.log("Latest ids:", records.map(r => r.id));
      process.exit(1);
    }
    
    console.log("Triggering runWorkflowBackground for:", target.id);
    await runWorkflowBackground("workflow_run:test_runner", target);

  } catch (err) {
    console.error("Test script failed:", err.message);
  }
}

run().then(() => {
  // Give background time
  setTimeout(() => process.exit(0), 1000);
}).catch(() => process.exit(1));
