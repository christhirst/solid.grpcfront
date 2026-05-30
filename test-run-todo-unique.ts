import { runWorkflowBackground } from "./src/lib/workflowEngine.ts";
import { getDb } from "./src/lib/db.ts";
import { RecordId } from "surrealdb";
import { v4 as uuidv4 } from "uuid";

const workflow = {
  name: "Test REST JSONPlaceholder 1",
  protoContent: "",
  serverAddress: "",
  useTls: false,
  steps: [
    {
      id: "step_1",
      type: "rest",
      restUrl: "https://jsonplaceholder.typicode.com/todos/1",
      restMethod: "GET"
    }
  ]
};

const runUUID = uuidv4();
const runId = `workflow_run:${runUUID}`;

console.log("Starting workflow run with ID:", runId);
runWorkflowBackground(workflow as any, runId)
  .then(async () => {
    console.log("Workflow finished!");
    const db = await getDb();
    const res = await db.select(new RecordId("workflow_run", runUUID));
    console.log("Run logs from DB:", JSON.stringify(res, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error("Workflow failed with error:", err);
    process.exit(1);
  });
