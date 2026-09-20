import type { StepVariable } from "./stepCategories";

/**
 * Parses all {{ ... }} brackets from a text string and categorizes them into
 * Upstream (🟢 "up" - outputs/calculations) or Downstream (🔴 "down" - dashboard input parameters).
 */
export function parseBracketTokens(text?: string): StepVariable[] {
  if (!text || typeof text !== "string") return [];
  const results: StepVariable[] = [];
  const seen = new Set<string>();
  const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const raw = m[1].trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);

    const isStepRef = raw.startsWith("steps.") || raw.startsWith("auth.");
    const isCalculation = /\b(SELECT|FROM|WHERE|count\(|LET|RETURN|IF)\b/i.test(raw) || /[><=+\-*/]/.test(raw);
    const isExplicitForm = raw.startsWith("form.") || raw.startsWith("dashboard_form.");
    
    // Upstream (Green): Calculated expressions, queries, or step references
    // Downstream (Red): Input parameters from dashboard / form
    const direction: "up" | "down" = (isStepRef || isCalculation) ? "up" : "down";
    
    results.push({
      id: `var_${results.length}_${raw.replace(/[^a-zA-Z0-9_]/g, "_")}`,
      name: raw,
      direction,
      type: isCalculation ? "query" : "string",
    });
  }
  return results;
}

/**
 * Detects all bracketed variables across all template fields of a step,
 * merging with any existing variable configurations/aliases.
 */
export function detectStepVariables(step: any): StepVariable[] {
  if (!step) return [];
  const existingMap = new Map<string, StepVariable>();
  (step.variables || []).forEach((v: StepVariable) => {
    if (v.name) existingMap.set(v.name.trim(), v);
  });

  const textsToScan = [
    step.requestBodyTemplate,
    step.headersTemplate,
    step.restUrl,
    step.databaseName,
    step.databaseUrl,
    step.databaseUser,
    step.databasePass,
    step.databaseNs,
    step.transformExpression,
  ].filter(Boolean) as string[];

  const detectedTokens: StepVariable[] = [];
  const seen = new Set<string>();

  for (const text of textsToScan) {
    const tokens = parseBracketTokens(text);
    for (const tok of tokens) {
      if (!seen.has(tok.name)) {
        seen.add(tok.name);
        const existing = existingMap.get(tok.name);
        if (existing) {
          detectedTokens.push({
            ...tok,
            ...existing,
            name: tok.name, // ensure name is preserved
          });
        } else {
          detectedTokens.push(tok);
        }
      }
    }
  }

  // Also include any manually added variables in step.variables that might not be in templates
  (step.variables || []).forEach((v: StepVariable) => {
    if (v.name && !seen.has(v.name.trim())) {
      seen.add(v.name.trim());
      detectedTokens.push(v);
    }
  });

  return detectedTokens;
}

export function extractFormVariables(workflow: any): string[] {
  if (!workflow) return [];
  const vars = new Set<string>();
  
  // 1. Check all steps for detected or configured downstream variables
  (workflow.steps || []).forEach((step: any) => {
    const stepVars = detectStepVariables(step);
    stepVars.forEach((v) => {
      if (v.direction === "down") {
        let cleanName = v.name;
        if (cleanName.startsWith("form.")) cleanName = cleanName.slice(5);
        if (cleanName.startsWith("dashboard_form.")) cleanName = cleanName.slice(15);
        vars.add(cleanName);
      }
    });
  });

  // 2. Also check workflow authConfig
  if (workflow.authConfig) {
    const authTokens = [
      ...parseBracketTokens(workflow.authConfig.requestTemplate),
      ...parseBracketTokens(workflow.authConfig.body),
      ...parseBracketTokens(workflow.authConfig.url),
    ];
    authTokens.forEach((v) => {
      if (v.direction === "down") {
        let cleanName = v.name;
        if (cleanName.startsWith("form.")) cleanName = cleanName.slice(5);
        if (cleanName.startsWith("dashboard_form.")) cleanName = cleanName.slice(15);
        vars.add(cleanName);
      }
    });
  }

  return Array.from(vars);
}

export interface VariableConfigStatus {
  name: string;
  alias?: string;
  type?: string;
  isConfigured: boolean;
}

export function checkWidgetVariablesConfigured(workflow: any, formConfig: any[]) {
  const reqVars = extractFormVariables(workflow);
  if (!workflow || reqVars.length === 0) {
    return {
      hasVariables: false,
      allConfigured: true,
      reqVars: [] as string[],
      missingVars: [] as string[],
      configuredVars: [] as string[],
      varsWithStatus: [] as VariableConfigStatus[],
    };
  }
  const configuredNames = new Set((formConfig || []).map((f: any) => {
    let n = f.name?.trim() || "";
    if (n.startsWith("form.")) n = n.slice(5);
    if (n.startsWith("dashboard_form.")) n = n.slice(15);
    return n;
  }).filter(Boolean));

  const stepVars = (workflow.steps || []).flatMap((s: any) => detectStepVariables(s));

  const varsWithStatus: VariableConfigStatus[] = reqVars.map((v) => {
    const matching = stepVars.find(
      (sv: any) => sv.name === v || sv.name === `form.${v}` || sv.name === `dashboard_form.${v}`
    );
    const isConfigured = configuredNames.has(v);
    return {
      name: v,
      alias: matching?.alias?.trim() || undefined,
      type: matching?.type || "string",
      isConfigured,
    };
  });

  const missingVars = reqVars.filter((v) => !configuredNames.has(v));
  const configuredVars = reqVars.filter((v) => configuredNames.has(v));

  return {
    hasVariables: true,
    allConfigured: missingVars.length === 0,
    reqVars,
    missingVars,
    configuredVars,
    varsWithStatus,
  };
}

export function checkWorkflowConfiguredInDashboards(workflow: any, dashboards: any[]) {
  if (!workflow) {
    return {
      hasVariables: false,
      hasLinkedDashboard: false,
      allConfigured: true,
      reqVars: [] as string[],
      missingVars: [] as string[],
      configuredVars: [] as string[],
      varsWithStatus: [] as VariableConfigStatus[],
    };
  }
  const reqVars = extractFormVariables(workflow);
  if (reqVars.length === 0) {
    return {
      hasVariables: false,
      hasLinkedDashboard: false,
      allConfigured: true,
      reqVars: [] as string[],
      missingVars: [] as string[],
      configuredVars: [] as string[],
      varsWithStatus: [] as VariableConfigStatus[],
    };
  }
  const idStr = typeof workflow.id === "string" ? workflow.id : String(workflow.id || "");
  const wfId = idStr.includes(":") ? idStr : `workflow:${idStr}`;
  const rawId = idStr.includes(":") ? idStr.split(":")[1] : idStr;

  const allDashboardConfiguredNames = new Set<string>();
  let hasLinkedDashboard = false;

  for (const dash of dashboards || []) {
    for (const btn of dash.buttons || []) {
      const bWfId = btn.workflowId;
      if (bWfId === wfId || bWfId === rawId || (bWfId && bWfId.endsWith(rawId))) {
        hasLinkedDashboard = true;
        for (const f of btn.formConfig || []) {
          let n = f.name?.trim() || "";
          if (n.startsWith("form.")) n = n.slice(5);
          if (n.startsWith("dashboard_form.")) n = n.slice(15);
          if (n) {
            allDashboardConfiguredNames.add(n);
          }
        }
      }
    }
  }

  const stepVars = (workflow.steps || []).flatMap((s: any) => detectStepVariables(s));

  const varsWithStatus: VariableConfigStatus[] = reqVars.map((v) => {
    const matching = stepVars.find(
      (sv: any) => sv.name === v || sv.name === `form.${v}` || sv.name === `dashboard_form.${v}`
    );
    const isConfigured = allDashboardConfiguredNames.has(v);
    return {
      name: v,
      alias: matching?.alias?.trim() || undefined,
      type: matching?.type || "string",
      isConfigured,
    };
  });

  const missingVars = reqVars.filter((v) => !allDashboardConfiguredNames.has(v));
  const configuredVars = reqVars.filter((v) => allDashboardConfiguredNames.has(v));

  return {
    hasVariables: true,
    hasLinkedDashboard,
    allConfigured: hasLinkedDashboard && missingVars.length === 0,
    reqVars,
    missingVars,
    configuredVars,
    varsWithStatus,
  };
}