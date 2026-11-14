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

  it("converts plain JSON objects to google.protobuf.Struct wire format and back cleanly", async () => {
    const { jsonToProtoStruct, protoStructToJson, toAuthzenGrpcRequest, fromAuthzenGrpcResponse } = await import("./authzenProto");

    const sample = {
      role: "admin",
      level: 3,
      active: true,
      noneVal: null,
      tags: ["ops", "sre"],
      nested: { department: "platform" },
    };

    const wireStruct = jsonToProtoStruct(sample);
    expect(wireStruct.fields.role).toEqual({ string_value: "admin" });
    expect(wireStruct.fields.level).toEqual({ number_value: 3 });
    expect(wireStruct.fields.active).toEqual({ bool_value: true });
    expect(wireStruct.fields.noneVal).toEqual({ null_value: 0 });
    expect(wireStruct.fields.tags).toEqual({
      list_value: { values: [{ string_value: "ops" }, { string_value: "sre" }] },
    });

    const roundTrip = protoStructToJson(wireStruct);
    expect(roundTrip).toEqual(sample);

    const grpcReq = toAuthzenGrpcRequest({
      subject: { type: "user", id: "u-123", properties: { groups: ["admins"] } },
      action: { name: "can_write" },
      resource: { type: "route", id: "r-1" },
      context: { ip: "127.0.0.1" },
    });
    expect(grpcReq.subject.properties.fields.groups.list_value.values[0].string_value).toBe("admins");
    expect(grpcReq.context.fields.ip.string_value).toBe("127.0.0.1");

    const grpcResp = fromAuthzenGrpcResponse({
      decision: true,
      context: { fields: { reason: { string_value: "matched policy" } } },
    });
    expect(grpcResp).toEqual({
      decision: true,
      context: { reason: "matched policy" },
    });
  });

  it("interpolates {{ $user.* }} variables and exposes $user in JSONata transform steps", async () => {
    const mockDb = createMockDb();
    const workflow: WorkflowDefinition = {
      id: "workflow:test-user-context",
      name: "User Context Test",
      direction: "read",
      protoContent: "",
      serverAddress: "localhost:50051",
      useTls: false,
      steps: [
        {
          id: "step_user_transform",
          type: "transform",
          service: "",
          method: "",
          requestBodyTemplate: "{}",
          transformExpression: '{"sub": $user.sub, "claimOrg": $user.oidc.claims.org, "groups": $user.userdata.groups}',
        },
      ],
    };

    const sampleUser = {
      authenticated: true,
      sub: "user-42",
      username: "alice",
      name: "Alice Smith",
      email: "alice@example.com",
      roles: ["editor"],
      groups: ["eng", "security"],
      namespace: "ns_prod",
      oidc: {
        claims: { sub: "user-42", org: "deepmind", acr: "phr" },
        header: { alg: "RS256" },
      },
      userdata: {
        id: "user-42",
        username: "alice",
        name: "Alice Smith",
        email: "alice@example.com",
        roles: ["editor"],
        groups: ["eng", "security"],
        namespace: "ns_prod",
        accessibleWorkflows: ["*"],
        accessibleDashboards: ["*"],
        accessibleDatabases: ["*"],
        accessibleConnections: ["*"],
      },
    };

    await runWorkflowBackground(
      workflow,
      "workflow_run:run-user-1",
      { form: {}, $user: sampleUser },
      mockDb
    );

    const terminalUpdates = mockDb.queries.filter((q) => q.sql.startsWith("UPDATE $id CONTENT $data"));
    expect(terminalUpdates.length).toBe(1);
    const finalData = terminalUpdates[0].vars?.data;
    expect(finalData.status).toBe("completed");
    expect(finalData.context.steps.step_user_transform.response).toEqual({
      sub: "user-42",
      claimOrg: "deepmind",
      groups: ["eng", "security"],
    });
  });

  it("enforces AuthZEN/Cerbos deny decision when authzOnDeny is 'enforce' and continues when 'continue'", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (url.includes("/access/v1/evaluation")) {
          const isAdmin = body?.subject?.properties?.role === "admin";
          return new Response(
            JSON.stringify({
              decision: isAdmin,
              context: { evaluatedBy: "authzen-mock", subjectId: body?.subject?.id },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      }) as typeof fetch;

      const sampleUser = {
        authenticated: true,
        sub: "user-guest",
        username: "guest",
        name: "Guest",
        email: "guest@example.com",
        roles: ["viewer"],
        groups: ["guests"],
        namespace: "default",
        oidc: { claims: { role: "guest" } },
        userdata: {
          id: "user-guest",
          username: "guest",
          name: "Guest",
          email: "guest@example.com",
          roles: ["viewer"],
          groups: ["guests"],
          namespace: "default",
          accessibleWorkflows: [],
          accessibleDashboards: [],
          accessibleDatabases: [],
          accessibleConnections: [],
        },
      };

      // 1. Test authzOnDeny = "enforce" (default) -> workflow fails and downstream step is skipped
      const mockDbEnforce = createMockDb();
      const enforceWorkflow: WorkflowDefinition = {
        id: "workflow:test-authz-enforce",
        name: "AuthZ Enforce Workflow",
        direction: "write",
        protoContent: "",
        serverAddress: "localhost:50051",
        useTls: false,
        steps: [
          {
            id: "check_access",
            type: "authz",
            service: "",
            method: "",
            requestBodyTemplate: "{}",
            authzProvider: "authzen_rest",
            authzOnDeny: "enforce",
            restUrl: "http://pdp.local/access/v1/evaluation",
            authzSubjectType: "user",
            authzSubjectId: "{{ $user.sub }}",
            authzSubjectProperties: "{{ $user.oidc.claims }}",
            authzActionName: "delete_record",
            authzResourceType: "record",
            authzResourceId: "{{ form.record_id }}",
          },
          {
            id: "downstream_action",
            type: "transform",
            service: "",
            method: "",
            requestBodyTemplate: "{}",
            transformExpression: '{"executed": true}',
          },
        ],
      };

      await runWorkflowBackground(
        enforceWorkflow,
        "workflow_run:run-authz-enforce",
        { form: { record_id: "rec-99" }, $user: sampleUser },
        mockDbEnforce
      );

      const enforceFinal = mockDbEnforce.queries.find((q) => q.sql.startsWith("UPDATE $id CONTENT $data"))?.vars?.data;
      expect(enforceFinal.status).toBe("failed");
      expect(enforceFinal.context.steps.check_access.response.decision).toBe(false);
      expect(enforceFinal.context.steps.downstream_action).toBeUndefined();

      // 2. Test authzOnDeny = "continue" -> workflow completes and downstream step can inspect steps.check_access.response.decision
      const mockDbContinue = createMockDb();
      const continueWorkflow: WorkflowDefinition = {
        ...enforceWorkflow,
        id: "workflow:test-authz-continue",
        steps: [
          {
            ...enforceWorkflow.steps[0],
            authzOnDeny: "continue",
          },
          {
            id: "downstream_action",
            type: "transform",
            service: "",
            method: "",
            requestBodyTemplate: "{}",
            transformExpression: '{"wasAllowed": steps.check_access.response.decision, "subjectId": steps.check_access.response.context.subjectId}',
          },
        ],
      };

      await runWorkflowBackground(
        continueWorkflow,
        "workflow_run:run-authz-continue",
        { form: { record_id: "rec-99" }, $user: sampleUser },
        mockDbContinue
      );

      const continueFinal = mockDbContinue.queries.find((q) => q.sql.startsWith("UPDATE $id CONTENT $data"))?.vars?.data;
      expect(continueFinal.status).toBe("completed");
      expect(continueFinal.context.steps.check_access.response.decision).toBe(false);
      expect(continueFinal.context.steps.downstream_action.response).toEqual({
        wasAllowed: false,
        subjectId: "user-guest",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
