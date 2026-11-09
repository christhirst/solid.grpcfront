import { describe, expect, it } from "bun:test";
import { runWorkflowBackground, type WorkflowDefinition } from "./workflowEngine";

function createMockDb() {
  const queries: Array<{ sql: string; vars?: Record<string, any> }> = [];
  return {
    queries,
    query: async (sql: string, vars?: Record<string, any>) => {
      queries.push({ sql, vars });
      return [[]];
    },
    select: async () => [],
  };
}

describe("runWorkflowBackground", () => {
  it("completes a multi-step workflow and persists terminal context without ReferenceError", async () => {
    const mockDb = createMockDb();
    const workflow: WorkflowDefinition = {
      id: "workflow:test-wf-1",
      name: "Test Multi-Step Workflow",
      direction: "read",
      protoContent: "",
      serverAddress: "localhost:50051",
      useTls: false,
      steps: [
        {
          id: "step_1",
          type: "transform",
          service: "",
          method: "",
          requestBodyTemplate: "{}",
          transformExpression: '{"items": [{"name": "alpha", "score": 10}, {"name": "beta", "score": 20}]}',
          variables: [{ name: "items", alias: "score_list", direction: "up" }],
        },
        {
          id: "step_2",
          type: "table",
          service: "",
          method: "",
          requestBodyTemplate: "{}",
          sourceStepIds: ["step_1"],
          dataPath: "items",
        },
      ],
    };

    await runWorkflowBackground(workflow, "workflow_run:run-101", { form: { env: "prod" } }, mockDb);

    const createCalls = mockDb.queries.filter((q) => q.sql.startsWith("CREATE $id CONTENT $data"));
    const mergeCalls = mockDb.queries.filter((q) => q.sql.startsWith("UPDATE $id MERGE $data"));
    const terminalUpdateCalls = mockDb.queries.filter((q) => q.sql.startsWith("UPDATE $id CONTENT $data"));

    expect(createCalls.length).toBe(1);
    expect(mergeCalls.length).toBe(2);
    expect(terminalUpdateCalls.length).toBe(1);

    const finalData = terminalUpdateCalls[0].vars?.data;
    expect(finalData.status).toBe("completed");
    expect(finalData.endTime).toBeDefined();
    expect(finalData.context.form).toEqual({ env: "prod" });
    expect(finalData.context.steps.step_1.response).toEqual({
      items: [
        { name: "alpha", score: 10 },
        { name: "beta", score: 20 },
      ],
    });
    expect(finalData.context.variables.score_list).toEqual([
      { name: "alpha", score: 10 },
      { name: "beta", score: 20 },
    ]);
    expect(finalData.context.__stepLiteralVars).toBeUndefined();
    expect(finalData.context.__vaultRefs).toBeUndefined();
  });

  it("persists failed status and context when a step fails", async () => {
    const mockDb = createMockDb();
    const workflow: WorkflowDefinition = {
      id: "workflow:test-wf-fail",
      name: "Test Failing Workflow",
      direction: "read",
      protoContent: "",
      serverAddress: "localhost:50051",
      useTls: false,
      steps: [
        {
          id: "step_bad",
          type: "transform",
          service: "",
          method: "",
          requestBodyTemplate: "{}",
          transformExpression: "$$$invalid_jsonata(((",
        },
      ],
    };

    await runWorkflowBackground(workflow, "workflow_run:run-102", { form: { target: "test" } }, mockDb);

    const terminalUpdateCalls = mockDb.queries.filter((q) => q.sql.startsWith("UPDATE $id CONTENT $data"));
    expect(terminalUpdateCalls.length).toBe(1);

    const finalData = terminalUpdateCalls[0].vars?.data;
    expect(finalData.status).toBe("failed");
    expect(finalData.endTime).toBeDefined();
    expect(finalData.context.form).toEqual({ target: "test" });
    expect(finalData.logs.length).toBe(1);
    expect(finalData.logs[0].status).toBe("error");
  });

  it("serves cached response on cache hit for read workflows with cacheTtlSeconds", async () => {
    const mockDb1 = createMockDb();
    const workflow: WorkflowDefinition & { cacheTtlSeconds?: number } = {
      id: "workflow:test-wf-cached",
      name: "Test Cached Read Workflow",
      direction: "read",
      cacheTtlSeconds: 30,
      protoContent: "",
      serverAddress: "localhost:50051",
      useTls: false,
      steps: [
        {
          id: "step_1",
          type: "transform",
          service: "",
          method: "",
          requestBodyTemplate: "{}",
          transformExpression: '{"cachedValue": 42}',
        },
      ],
    };

    // First run populates cache
    await runWorkflowBackground(workflow, "workflow_run:run-201", { form: { key: "k1" } }, mockDb1);
    expect(mockDb1.queries.filter((q) => q.sql.startsWith("UPDATE $id MERGE $data")).length).toBe(1);

    // Second run with same input hits cache (0 intermediate step merges, 1 terminal update)
    const mockDb2 = createMockDb();
    await runWorkflowBackground(workflow, "workflow_run:run-202", { form: { key: "k1" } }, mockDb2);
    expect(mockDb2.queries.filter((q) => q.sql.startsWith("UPDATE $id MERGE $data")).length).toBe(0);

    const terminalUpdates = mockDb2.queries.filter((q) => q.sql.startsWith("UPDATE $id CONTENT $data"));
    expect(terminalUpdates.length).toBe(1);
    expect(terminalUpdates[0].vars?.data.status).toBe("completed");
    expect(terminalUpdates[0].vars?.data.context.steps.step_1.response).toEqual({ cachedValue: 42 });
  });
});
