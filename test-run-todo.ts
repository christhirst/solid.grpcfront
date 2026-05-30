import { runWorkflowBackground } from "./src/lib/workflowEngine.ts";

const workflow = {
  name: "Test REST JSONPlaceholder",
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

const runId = "workflow_run:test-rest-todo";

console.log("Starting workflow run...");
runWorkflowBackground(workflow as any, runId)
  .then(() => console.log("Workflow finished successfully!"))
  .catch(err => console.error("Workflow failed with error:", err));
