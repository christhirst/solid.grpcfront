function extractFormVariables(workflow) {
  if (!workflow) return [];
  const vars = /* @__PURE__ */ new Set();
  const regex = /\{\{\s*(?:form|dashboard_form)\.([a-zA-Z0-9_.-]+)\s*\}\}/g;
  const scanStr = (s) => {
    if (!s) return;
    let m;
    regex.lastIndex = 0;
    while ((m = regex.exec(s)) !== null) {
      vars.add(m[1]);
    }
  };
  if (workflow.authConfig) {
    scanStr(workflow.authConfig.requestTemplate);
    scanStr(workflow.authConfig.body);
    scanStr(workflow.authConfig.url);
  }
  (workflow.steps || []).forEach((step) => {
    scanStr(step.requestBodyTemplate);
    scanStr(step.headersTemplate);
    scanStr(step.restUrl);
    scanStr(step.databaseName);
    scanStr(step.databaseUrl);
    scanStr(step.databaseUser);
    scanStr(step.databasePass);
    scanStr(step.databaseNs);
  });
  return Array.from(vars);
}
function checkWorkflowConfiguredInDashboards(workflow, dashboards) {
  if (!workflow) return {
    hasVariables: false,
    allConfigured: true,
    reqVars: [],
    missingVars: []
  };
  const reqVars = extractFormVariables(workflow);
  if (reqVars.length === 0) {
    return {
      hasVariables: false,
      allConfigured: true,
      reqVars,
      missingVars: []
    };
  }
  const idStr = typeof workflow.id === "string" ? workflow.id : String(workflow.id || "");
  const wfId = idStr.includes(":") ? idStr : `workflow:${idStr}`;
  const rawId = idStr.includes(":") ? idStr.split(":")[1] : idStr;
  let isFullyConfiguredInAnyDashboard = false;
  for (const dash of dashboards || []) {
    for (const btn of dash.buttons || []) {
      const bWfId = btn.workflowId;
      if (bWfId === wfId || bWfId === rawId || bWfId && bWfId.endsWith(rawId)) {
        const configuredNames = new Set((btn.formConfig || []).map((f) => f.name?.trim()).filter(Boolean));
        const missing = reqVars.filter((v) => !configuredNames.has(v));
        if (missing.length === 0) {
          isFullyConfiguredInAnyDashboard = true;
          break;
        }
      }
    }
    if (isFullyConfiguredInAnyDashboard) break;
  }
  return {
    hasVariables: true,
    allConfigured: isFullyConfiguredInAnyDashboard,
    reqVars,
    missingVars: reqVars
  };
}
export {
  checkWorkflowConfiguredInDashboards as c
};
//# sourceMappingURL=workflowVariableChecker-Cs0JTqKX.js.map
