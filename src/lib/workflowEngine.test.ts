import { describe, expect, it } from "bun:test";
import {
  buildExecutionWaves,
  evaluatePayload,
  runWorkflowBackground,
  safeJsonParseWithEscapes,
  workflowStreamManager,
  type WorkflowDefinition,
} from "./workflowEngine";

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
    expect(mergeCalls.length).toBeLessThanOrEqual(2);
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
    expect(mockDb1.queries.filter((q) => q.sql.startsWith("UPDATE $id CONTENT $data")).length).toBe(1);

    // Second run with same input hits cache (0 intermediate step merges, 1 terminal update, fromCache event)
    const events: any[] = [];
    const listener = (evt: any) => events.push(evt);
    workflowStreamManager.on("run:workflow_run:run-202", listener);
    const mockDb2 = createMockDb();
    try {
      await runWorkflowBackground(workflow, "workflow_run:run-202", { form: { key: "k1" } }, mockDb2);
    } finally {
      workflowStreamManager.off("run:workflow_run:run-202", listener);
    }
    expect(mockDb2.queries.filter((q) => q.sql.startsWith("UPDATE $id MERGE $data")).length).toBe(0);
    expect(events.some((e) => e.type === "workflow_complete" && e.data?.fromCache === true)).toBe(true);

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

  it("repairs 7+ fallback_models templates with missing quote, trailing comma, or unquoted placeholders and expands list variables", async () => {
    // 1. Unclosed trailing quote + trailing commas (matching the 7-model snippet from TODO.md)
    const rawWithBrokenQuote = `{
      "model": "qwen3.8-flash",
      "fallback_models": [
        "qwen3.5-flash-2026-02-23",
        "qwen3.5-omni-flash",
        "qwen3-omni-flash-2025-12-01",
        "qwen3.5-omni-flash-2026-03-15",
        "qwen3.5-flash",
        "qwen3.6-flash-2026-04-16",
        "qwen3.6-flash
      ],
    }`;
    const parsedBroken = safeJsonParseWithEscapes(rawWithBrokenQuote);
    expect(parsedBroken.fallback_models).toHaveLength(7);
    expect(parsedBroken.fallback_models[6]).toBe("qwen3.6-flash");

    // 2. Unquoted placeholder and bracketed list expansion
    const unquotedTemplate = `{
      "model": "{{ model }}",
      "fallback_models": {{ fallback_models }}
    }`;
    const parsedUnquoted = safeJsonParseWithEscapes(unquotedTemplate);
    const models = ["m1", "m2", "m3", "m4", "m5", "m6", "m7"];
    expect(
      evaluatePayload(parsedUnquoted, {
        form: { model: "primary-m", fallback_models: models },
      })
    ).toEqual({
      model: "primary-m",
      fallback_models: models,
    });

    // 3. Array wrapper ["{{ fallback_models }}"] with list array or comma string
    const wrappedTemplate = {
      fallback_models: ["{{ fallback_models }}"],
    };
    expect(
      evaluatePayload(wrappedTemplate, {
        form: { fallback_models: models },
      })
    ).toEqual({ fallback_models: models });

    expect(
      evaluatePayload(wrappedTemplate, {
        form: { fallback_models: "m1, m2, m3, m4, m5" },
      })
    ).toEqual({ fallback_models: ["m1", "m2", "m3", "m4", "m5"] });
  });

  it("propagates step timeoutMs to REST requests and attaches ISO timestamps to run logs", async () => {
    const originalFetch = globalThis.fetch;
    let observedSignal: AbortSignal | undefined;
    let observedBody: any;
    try {
      globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        observedSignal = init?.signal ?? undefined;
        observedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const mockDb = createMockDb();
      const workflow: WorkflowDefinition = {
        id: "workflow:test-timeout-list",
        name: "Timeout & List Step",
        direction: "read",
        protoContent: "",
        serverAddress: "localhost:50051",
        useTls: false,
        steps: [
          {
            id: "rest_step",
            type: "rest",
            restMethod: "POST",
            restUrl: "http://example.local/api",
            timeoutMs: 120000,
            requestBodyTemplate: JSON.stringify({
              fallback_models: ["{{ fallback_models }}"],
            }),
          } as any,
        ],
      };

      await runWorkflowBackground(
        workflow,
        "workflow_run:run-timeout-list",
        { form: { fallback_models: ["m1", "m2", "m3", "m4", "m5"] } },
        mockDb
      );

      const finalData = mockDb.queries.find((q) => q.sql.startsWith("UPDATE $id CONTENT $data"))?.vars?.data;
      expect(finalData.status).toBe("completed");
      expect(observedSignal).toBeDefined();
      expect(observedBody).toEqual({ fallback_models: ["m1", "m2", "m3", "m4", "m5"] });
      expect(typeof finalData.logs[0].timestamp).toBe("string");
      expect(Number.isNaN(Date.parse(finalData.logs[0].timestamp))).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("executes independent read steps in parallel waves while keeping logs deterministic", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        await new Promise((r) => setTimeout(r, 100));
        return new Response(JSON.stringify({ url }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const mockDb = createMockDb();
      const workflow: WorkflowDefinition = {
        id: "workflow:test-parallel-waves",
        name: "Parallel Read Waves",
        direction: "read",
        protoContent: "",
        serverAddress: "localhost:50051",
        useTls: false,
        steps: [
          { id: "s1", type: "rest", restMethod: "GET", restUrl: "http://mock.local/1" } as any,
          { id: "s2", type: "rest", restMethod: "GET", restUrl: "http://mock.local/2" } as any,
          { id: "s3", type: "rest", restMethod: "GET", restUrl: "http://mock.local/3" } as any,
          {
            id: "t1",
            type: "transform",
            sourceStepIds: ["s1", "s2", "s3"],
            requestBodyTemplate: "{}",
            transformExpression: '{"urls": sources.url}',
          } as any,
        ],
      };

      const start = Date.now();
      await runWorkflowBackground(workflow, "workflow_run:run-parallel-1", {}, mockDb);
      const elapsed = Date.now() - start;

      // 3x 100ms in parallel should finish well under 240ms (vs >300ms sequential)
      expect(elapsed).toBeLessThan(240);

      const finalData = mockDb.queries.find((q) => q.sql.startsWith("UPDATE $id CONTENT $data"))?.vars?.data;
      expect(finalData.status).toBe("completed");
      expect(finalData.logs.map((l: any) => l.stepId)).toEqual(["s1", "s2", "s3", "t1"]);
      expect(finalData.context.steps.t1.response).toEqual({
        urls: ["http://mock.local/1", "http://mock.local/2", "http://mock.local/3"],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps write-direction steps strictly sequential as barriers", async () => {
    const originalFetch = globalThis.fetch;
    const timings: Record<string, { start: number; end: number }> = {};
    try {
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const key = String(input);
        const start = Date.now();
        await new Promise((r) => setTimeout(r, 50));
        const end = Date.now();
        timings[key] = { start, end };
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const mockDb = createMockDb();
      const workflow: WorkflowDefinition = {
        id: "workflow:test-write-barriers",
        name: "Write Barriers",
        direction: "write",
        protoContent: "",
        serverAddress: "localhost:50051",
        useTls: false,
        steps: [
          { id: "w1", type: "rest", direction: "write", restMethod: "POST", restUrl: "http://mock.local/w1", requestBodyTemplate: "{}" } as any,
          { id: "w2", type: "rest", direction: "write", restMethod: "POST", restUrl: "http://mock.local/w2", requestBodyTemplate: "{}" } as any,
        ],
      };

      await runWorkflowBackground(workflow, "workflow_run:run-write-seq", {}, mockDb);
      const t1 = timings["http://mock.local/w1"];
      const t2 = timings["http://mock.local/w2"];
      expect(t1).toBeDefined();
      expect(t2).toBeDefined();
      expect(t2.start).toBeGreaterThanOrEqual(t1.end);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("respects template-only {{ steps.s1.response }} dependencies without sourceStepIds", async () => {
    const originalFetch = globalThis.fetch;
    const seenUrls: string[] = [];
    try {
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        seenUrls.push(url);
        if (url.endsWith("/first")) {
          await new Promise((r) => setTimeout(r, 40));
          return new Response(JSON.stringify({ nextPath: "item-42" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch;

      const steps = [
        { id: "s1", type: "rest", restMethod: "GET", restUrl: "http://mock.local/first" } as any,
        { id: "s2", type: "rest", restMethod: "GET", restUrl: "http://mock.local/{{ steps.s1.response.nextPath }}" } as any,
      ];
      expect(buildExecutionWaves(steps, "read").map((w) => w.map((s) => s.id))).toEqual([["s1"], ["s2"]]);

      const mockDb = createMockDb();
      await runWorkflowBackground(
        {
          id: "workflow:test-template-dep",
          name: "Template Dep",
          direction: "read",
          protoContent: "",
          serverAddress: "localhost:50051",
          useTls: false,
          steps,
        },
        "workflow_run:run-template-dep",
        {},
        mockDb
      );

      expect(seenUrls).toEqual(["http://mock.local/first", "http://mock.local/item-42"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("preserves full un-truncated payloads on terminal save even with large responses", async () => {
    const mockDb = createMockDb();
    const bigString = "x".repeat(6000);
    const workflow: WorkflowDefinition = {
      id: "workflow:test-large-terminal",
      name: "Large Payload Terminal",
      direction: "read",
      protoContent: "",
      serverAddress: "localhost:50051",
      useTls: false,
      steps: [
        {
          id: "big_step",
          type: "transform",
          requestBodyTemplate: "{}",
          transformExpression: `{"blob": "${bigString}"}`,
        } as any,
      ],
    };

    await runWorkflowBackground(workflow, "workflow_run:run-large-1", {}, mockDb);
    const terminal = mockDb.queries.find((q) => q.sql.startsWith("UPDATE $id CONTENT $data"))?.vars?.data;
    expect(terminal.status).toBe("completed");
    expect(terminal.logs[0].response.blob.length).toBe(6000);
    expect(terminal.logs[0].response.__truncated).toBeUndefined();
  });
});
