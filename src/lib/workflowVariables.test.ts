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

  it("detects both up and down tokens in complex expressions", () => {
    const text = "count((SELECT id FROM {{ DB_Table }} WHERE severity > 3)) > {{ threshold }};";
    const tokens = parseBracketTokens(text);
    expect(tokens.length).toBe(2);
    expect(tokens[0].name).toBe("DB_Table");
    expect(tokens[0].direction).toBe("down");
    expect(tokens[1].name).toBe("threshold");
    expect(tokens[1].direction).toBe("down");
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



