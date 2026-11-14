import { describe, expect, it } from "bun:test";
import { parseBracketTokens, detectStepVariables, extractFormVariables } from "./workflowVariableChecker";
import type { WorkflowStep } from "./stepCategories";

describe("parseBracketTokens", () => {
  it("detects and categorizes upstream calculated queries as 'up'", () => {
    const text = "Bool: {{count((SELECT id FROM incident_source)) > 0;}}";
    const tokens = parseBracketTokens(text);
    expect(tokens.length).toBe(1);
    expect(tokens[0].name).toBe("count((SELECT id FROM incident_source)) > 0;");
    expect(tokens[0].direction).toBe("up");
  });

  it("detects and categorizes downstream dashboard parameters as 'down'", () => {
    const text = "SELECT * FROM {{ DB_Table }} WHERE active = true;";
    const tokens = parseBracketTokens(text);
    expect(tokens.length).toBe(1);
    expect(tokens[0].name).toBe("DB_Table");
    expect(tokens[0].direction).toBe("down");
  });

  it("detects step references as 'up'", () => {
    const text = "Bearer {{ steps.auth.response.token }}";
    const tokens = parseBracketTokens(text);
    expect(tokens.length).toBe(1);
    expect(tokens[0].name).toBe("steps.auth.response.token");
    expect(tokens[0].direction).toBe("up");
  });

  it("detects escaped \\{{ variable }} as literal", () => {
    const text = "SELECT * FROM \\{{ literal_table }} WHERE col = {{ dynamic_col }};";
    const tokens = parseBracketTokens(text);
    expect(tokens.length).toBe(2);
    const lit = tokens.find((t) => t.name === "literal_table");
    expect(lit).toBeDefined();
    expect(lit?.isLiteral).toBe(true);

    const dyn = tokens.find((t) => t.name === "dynamic_col");
    expect(dyn).toBeDefined();
    expect(dyn?.isLiteral).toBeUndefined();
  });
});

describe("detectStepVariables", () => {
  it("preserves existing aliases and direction overrides", () => {
    const step: WorkflowStep = {
      id: "step_1",
      type: "database",
      requestBodyTemplate: "SELECT * FROM {{ DB_Table }}; Bool: {{ count((SELECT id FROM incident_source)) > 0; }}",
      variables: [
        {
          id: "v1",
          name: "DB_Table",
          alias: "Target Table",
          direction: "down",
        },
        {
          id: "v2",
          name: "count((SELECT id FROM incident_source)) > 0;",
          alias: "has_incidents",
          direction: "up",
        },
      ],
    };

    const vars = detectStepVariables(step);
    expect(vars.length).toBe(2);
    
    const dbVar = vars.find((v) => v.name === "DB_Table");
    expect(dbVar).toBeDefined();
    expect(dbVar?.alias).toBe("Target Table");
    expect(dbVar?.direction).toBe("down");

    const upVar = vars.find((v) => v.name.includes("incident_source"));
    expect(upVar).toBeDefined();
    expect(upVar?.alias).toBe("has_incidents");
    expect(upVar?.direction).toBe("up");
  });
});

describe("extractFormVariables", () => {
  it("extracts bare downstream variables for dashboard forms", () => {
    const workflow = {
      steps: [
        {
          id: "s1",
          requestBodyTemplate: "SELECT * FROM {{ DB_Table }} WHERE type = {{ form.incident_type }};",
        },
      ],
    };

    const formVars = extractFormVariables(workflow);
    expect(formVars).toContain("DB_Table");
    expect(formVars).toContain("incident_type");
  });
});

describe("interpolateTemplate with bare downstream variables", () => {
  it("interpolates bare {{ DB_Table }} from form context", async () => {
    const { interpolateTemplate } = await import("./workflowEngine");
    const template = "count((SELECT id FROM {{ DB_Table }} > 0;";
    const context = {
      form: {
        DB_Table: "incident_source",
      },
    };

    const result = interpolateTemplate(template, context);
    expect(result).toBe("count((SELECT id FROM incident_source > 0;");
  });

  it("prioritizes direct context properties when available", async () => {
    const { interpolateTemplate } = await import("./workflowEngine");
    const template = "SELECT * FROM {{ steps.auth.response.table }} WHERE env = {{ env }}";
    const context = {
      steps: {
        auth: {
          response: {
            table: "secure_table",
          },
        },
      },
      env: "production",
    };

    const result = interpolateTemplate(template, context);
    expect(result).toBe("SELECT * FROM secure_table WHERE env = production");
  });
});

describe("checkWidgetVariablesConfigured", () => {
  it("marks missing variables as not configured (red) and set variables as configured (green)", async () => {
    const { checkWidgetVariablesConfigured } = await import("./workflowVariableChecker");
    const workflow = {
      id: "wf_1",
      steps: [
        {
          id: "s1",
          requestBodyTemplate: "SELECT * FROM {{ DB_Table }} WHERE severity = {{ severity }}",
          variables: [
            { id: "v1", name: "DB_Table", alias: "Target Table", direction: "down" },
            { id: "v2", name: "severity", alias: "Severity Level", direction: "down" },
          ],
        },
      ],
    };

    // Only DB_Table is configured in formConfig
    const formConfig = [
      { name: "DB_Table", label: "Target Table", type: "string" },
    ];

    const status = checkWidgetVariablesConfigured(workflow, formConfig);
    expect(status.hasVariables).toBe(true);
    expect(status.allConfigured).toBe(false);
    expect(status.missingVars).toEqual(["severity"]);
    expect(status.configuredVars).toEqual(["DB_Table"]);

    const dbVarStatus = status.varsWithStatus.find(v => v.name === "DB_Table");
    expect(dbVarStatus?.isConfigured).toBe(true);
    expect(dbVarStatus?.alias).toBe("Target Table");

    const sevVarStatus = status.varsWithStatus.find(v => v.name === "severity");
    expect(sevVarStatus?.isConfigured).toBe(false);
    expect(sevVarStatus?.alias).toBe("Severity Level");

    // Now configure both
    const fullFormConfig = [
      { name: "DB_Table", label: "Target Table", type: "string" },
      { name: "severity", label: "Severity Level", type: "number" },
    ];
    const fullStatus = checkWidgetVariablesConfigured(workflow, fullFormConfig);
    expect(fullStatus.allConfigured).toBe(true);
    expect(fullStatus.missingVars.length).toBe(0);
    expect(fullStatus.varsWithStatus.every(v => v.isConfigured)).toBe(true);
  });
});

describe("checkWorkflowConfiguredInDashboards", () => {
  it("identifies which variables are configured across linked dashboards", async () => {
    const { checkWorkflowConfiguredInDashboards } = await import("./workflowVariableChecker");
    const workflow = {
      id: "workflow:wf_alert",
      steps: [
        {
          id: "s1",
          requestBodyTemplate: "CREATE alert SET table = {{ DB_Table }}, note = {{ note }}",
        },
      ],
    };

    const dashboards = [
      {
        id: "dash_1",
        buttons: [
          {
            workflowId: "workflow:wf_alert",
            formConfig: [{ name: "DB_Table", label: "Table" }],
          },
        ],
      },
    ];

    const result = checkWorkflowConfiguredInDashboards(workflow, dashboards);
    expect(result.hasVariables).toBe(true);
    expect(result.hasLinkedDashboard).toBe(true);
    expect(result.allConfigured).toBe(false);
    expect(result.configuredVars).toContain("DB_Table");
    expect(result.missingVars).toContain("note");

    const dbVar = result.varsWithStatus.find(v => v.name === "DB_Table");
    expect(dbVar?.isConfigured).toBe(true);
    const noteVar = result.varsWithStatus.find(v => v.name === "note");
    expect(noteVar?.isConfigured).toBe(false);
  });
});

describe("extractUpstreamVariables", () => {
  it("extracts all upstream variables and aliases from workflow steps", async () => {
    const { extractUpstreamVariables } = await import("./workflowVariableChecker");
    const workflow = {
      id: "workflow:wf_bool",
      name: "Bool",
      steps: [
        {
          id: "step_1",
          name: "Check Incidents",
          type: "database",
          requestBodyTemplate: "{{count((SELECT id FROM incident_source)) > 0;}}",
          variables: [
            {
              id: "v1",
              name: "count((SELECT id FROM incident_source)) > 0;",
              alias: "has_it",
              direction: "up",
              type: "query",
            },
          ],
        },
      ],
    };

    const upstream = extractUpstreamVariables(workflow);
    expect(upstream.length).toBe(1);
    expect(upstream[0].name).toBe("count((SELECT id FROM incident_source)) > 0;");
    expect(upstream[0].alias).toBe("has_it");
    expect(upstream[0].type).toBe("query");
    expect(upstream[0].stepId).toBe("step_1");
  });
});

describe("interpolateTemplate with upstream query expressions", () => {
  it("preserves/unwraps query calculation expressions when unbound so SurrealDB can execute them", async () => {
    const { interpolateTemplate } = await import("./workflowEngine");
    const template = "{{count((SELECT id FROM incident_source)) > 0;}}";
    const context = { steps: {}, form: {} };

    const result = interpolateTemplate(template, context);
    expect(result).toBe("count((SELECT id FROM incident_source)) > 0;");
  });
});

describe("getWorkflowDashboardUsage", () => {
  it("detects usage across button executions, condition workflows, conditional rules, and series", async () => {
    const { getWorkflowDashboardUsage } = await import("./workflowVariableChecker");

    const targetWfId = "workflow:wf_main";
    const dashboards = [
      {
        id: "dash_1",
        name: "Dashboard One",
        buttons: [
          { id: "b1", workflowId: "workflow:wf_main" },
          { id: "b2", workflowId: "workflow:wf_other" },
        ],
      },
      {
        id: "dash_2",
        name: "Dashboard Two",
        buttons: [
          {
            id: "b3",
            workflowId: "workflow:wf_other",
            conditionWorkflowId: "workflow:wf_main",
          },
        ],
      },
      {
        id: "dash_3",
        name: "Dashboard Three",
        buttons: [
          {
            id: "b4",
            workflowId: "workflow:wf_other",
            conditionRules: [
              { action: "setWorkflow", targetValue: "wf_main" },
            ],
          },
        ],
      },
      {
        id: "dash_4",
        name: "Dashboard Four",
        buttons: [
          {
            id: "b5",
            workflowId: "workflow:wf_other",
            chartSeries: [
              { workflowId: "workflow:wf_main" },
            ],
          },
        ],
      },
    ];

    const usage = getWorkflowDashboardUsage(targetWfId, dashboards);
    expect(usage.count).toBe(4);
    expect(usage.dashboardNames).toContain("Dashboard One");
    expect(usage.dashboardNames).toContain("Dashboard Two");
    expect(usage.dashboardNames).toContain("Dashboard Three");
    expect(usage.dashboardNames).toContain("Dashboard Four");
  });

  it("deduplicates multiple references within the same dashboard", async () => {
    const { getWorkflowDashboardUsage } = await import("./workflowVariableChecker");

    const dashboards = [
      {
        id: "dash_shared",
        name: "Shared Dashboard",
        buttons: [
          { id: "b1", workflowId: "wf_target" },
          { id: "b2", conditionWorkflowId: "workflow:wf_target" },
          { id: "b3", chartSeries: [{ workflowId: "workflow:⟨wf_target⟩" }] },
        ],
      },
    ];

    const usage = getWorkflowDashboardUsage("wf_target", dashboards);
    expect(usage.count).toBe(1);
    expect(usage.dashboardNames).toEqual(["Shared Dashboard"]);
  });

  it("returns 0 when workflow is not configured in any dashboard", async () => {
    const { getWorkflowDashboardUsage } = await import("./workflowVariableChecker");

    const dashboards = [
      {
        id: "dash_1",
        name: "Dashboard One",
        buttons: [{ id: "b1", workflowId: "workflow:other" }],
      },
    ];

    const usage = getWorkflowDashboardUsage("workflow:wf_unused", dashboards);
    expect(usage.count).toBe(0);
    expect(usage.dashboardNames).toEqual([]);
    expect(usage.dashboardIds).toEqual([]);
  });
});

describe("Literal Variable Exclusion & Pass-Through", () => {
  it("preserves isLiteral override in detectStepVariables", () => {
    const step: WorkflowStep = {
      id: "s1",
      requestBodyTemplate: '{"text": "{{ my_template_var }}", "other": "{{ normal_var }}"}',
      variables: [
        {
          id: "v1",
          name: "my_template_var",
          direction: "down",
          isLiteral: true,
        },
      ],
    };
    const vars = detectStepVariables(step);
    const lit = vars.find((v) => v.name === "my_template_var");
    expect(lit).toBeDefined();
    expect(lit?.isLiteral).toBe(true);

    const normal = vars.find((v) => v.name === "normal_var");
    expect(normal).toBeDefined();
    expect(normal?.isLiteral).toBeUndefined();
  });

  it("excludes isLiteral variables from extractFormVariables", () => {
    const workflow = {
      steps: [
        {
          id: "s1",
          requestBodyTemplate: '{"a": "{{ configured_var }}", "b": "\\{{ escaped_var }}", "c": "{{ literal_var }}"}',
          variables: [
            {
              id: "v3",
              name: "literal_var",
              direction: "down" as const,
              isLiteral: true,
            },
          ],
        },
      ],
    };

    const formVars = extractFormVariables(workflow);
    expect(formVars).toContain("configured_var");
    expect(formVars).not.toContain("escaped_var");
    expect(formVars).not.toContain("literal_var");
  });

  it("does not report missing variables when all variables are literal or configured", async () => {
    const { checkWorkflowConfiguredInDashboards } = await import("./workflowVariableChecker");
    const workflow = {
      id: "wf_test",
      steps: [
        {
          id: "s1",
          requestBodyTemplate: '{"query": "\\{{ backend_var }}"}',
        },
      ],
    };
    const dashboards: any[] = [];
    const status = checkWorkflowConfiguredInDashboards(workflow, dashboards);
    expect(status.hasVariables).toBe(false);
    expect(status.allConfigured).toBe(true);
    expect(status.missingVars.length).toBe(0);
  });

  it("interpolateTemplate unescapes \\{{ var }} to {{ var }} and preserves it", async () => {
    const { interpolateTemplate } = await import("./workflowEngine");
    const template = "https://example.com/api?template=\\{{ backend_var }}&active={{ active }}";
    const context = {
      active: true,
      backend_var: "SHOULD_NOT_BE_USED",
    };

    const result = interpolateTemplate(template, context);
    expect(result).toBe("https://example.com/api?template={{ backend_var }}&active=true");
  });

  it("interpolateTemplate preserves variables marked in __stepLiteralVars even if present in context", async () => {
    const { interpolateTemplate } = await import("./workflowEngine");
    const template = "Bearer {{ auth_header }} {{ literal_token }}";
    const context = {
      auth_header: "Token123",
      literal_token: "SECRET_VALUE_NOT_USED",
      __stepLiteralVars: new Set(["literal_token"]),
    };

    const result = interpolateTemplate(template, context);
    expect(result).toBe("Bearer Token123 {{ literal_token }}");
  });

  it("interpolateTemplate preserves unresolved non-configured variables as {{ rawPath }} instead of blanking out", async () => {
    const { interpolateTemplate } = await import("./workflowEngine");
    const template = "Hello {{ user.name }}, your code is {{ verification_code }}";
    const context = {
      user: { name: "Alice" },
      // verification_code is not configured
    };

    const result = interpolateTemplate(template, context);
    expect(result).toBe("Hello Alice, your code is {{ verification_code }}");
  });
});

describe("$user runtime variables and authz step detection", () => {
  it("categorizes {{ $user }} and {{ $user.* }} tokens as 'up' and excludes them from required dashboard form inputs", () => {
    const tokens = parseBracketTokens(
      "sub={{ $user.sub }} claims={{ $user.oidc.claims }} userdata={{ $user.userdata }} groups={{ $user.userdata.groups }} root={{ $user }} form={{ target_id }}"
    );
    const userSub = tokens.find((t) => t.name === "$user.sub");
    const userClaims = tokens.find((t) => t.name === "$user.oidc.claims");
    const userData = tokens.find((t) => t.name === "$user.userdata");
    const userGroups = tokens.find((t) => t.name === "$user.userdata.groups");
    const userRoot = tokens.find((t) => t.name === "$user");
    const targetId = tokens.find((t) => t.name === "target_id");

    expect(userSub?.direction).toBe("up");
    expect(userClaims?.direction).toBe("up");
    expect(userData?.direction).toBe("up");
    expect(userGroups?.direction).toBe("up");
    expect(userRoot?.direction).toBe("up");
    expect(targetId?.direction).toBe("down");

    const workflow = {
      steps: [
        {
          id: "s_authz",
          type: "authz",
          authzSubjectId: "{{ $user.sub }}",
          authzSubjectProperties: "{{ $user.oidc.claims }}",
          authzResourceId: "{{ target_id }}",
          authzContext: '{"userdata": {{ $user.userdata }}}',
        },
      ],
    };

    const formVars = extractFormVariables(workflow);
    expect(formVars).toEqual(["target_id"]);
  });

  it("detectStepVariables scans all authz step fields", () => {
    const step: WorkflowStep = {
      id: "step_authz_1",
      type: "authz",
      authzSpaceId: "{{ space_name }}",
      authzSubjectType: "user",
      authzSubjectId: "{{ $user.sub }}",
      authzSubjectProperties: "{{ $user.oidc.claims }}",
      authzActionName: "{{ action_verb }}",
      authzResourceType: "document",
      authzResourceId: "{{ doc_id }}",
      authzResourceProperties: '{"owner": "{{ doc_owner }}"}',
      authzContext: '{"userdata": {{ $user.userdata }}}',
    };

    const detected = detectStepVariables(step);
    const names = detected.map((v) => v.name);
    expect(names).toContain("space_name");
    expect(names).toContain("$user.sub");
    expect(names).toContain("$user.oidc.claims");
    expect(names).toContain("action_verb");
    expect(names).toContain("doc_id");
    expect(names).toContain("doc_owner");
    expect(names).toContain("$user.userdata");
  });
});





