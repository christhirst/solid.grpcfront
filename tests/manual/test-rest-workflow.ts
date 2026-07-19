import { runWorkflowBackground } from "../../src/lib/workflowEngine.js";

const workflow = {
  name: "Test REST",
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

const runId = "workflow_run:test-rest";

console.log("Starting workflow run...");
runWorkflowBackground(workflow as any, runId)
  .then(() => console.log("Workflow finished"))
  .catch(err => console.error("Workflow failed:", err));
