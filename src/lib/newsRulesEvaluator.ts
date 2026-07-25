export interface NewsRule {
  id: string;
  operator: "equals" | "contains" | "gt" | "lt" | "regex" | "default";
  value: string;
  color: string;
  textTemplate: string;
}

export function evaluateNewsRules(dataValue: any, rules: NewsRule[]) {
  if (!Array.isArray(rules) || rules.length === 0) {
    const valStr = dataValue !== undefined && dataValue !== null ? (typeof dataValue === "object" ? JSON.stringify(dataValue) : String(dataValue)) : "No Data";
    return { color: "blue", text: valStr };
  }

  const strVal = typeof dataValue === "object" ? JSON.stringify(dataValue) : String(dataValue ?? "");
  const numVal = Number(dataValue);

  for (const rule of rules) {
    let match = false;
    const ruleVal = rule.value || "";

    switch (rule.operator) {
      case "equals":
        match = strVal.toLowerCase() === ruleVal.toLowerCase();
        break;
      case "contains":
        match = strVal.toLowerCase().includes(ruleVal.toLowerCase());
        break;
      case "gt":
        match = !isNaN(numVal) && !isNaN(Number(ruleVal)) && numVal > Number(ruleVal);
        break;
      case "lt":
        match = !isNaN(numVal) && !isNaN(Number(ruleVal)) && numVal < Number(ruleVal);
        break;
      case "regex":
        try { match = new RegExp(ruleVal, "i").test(strVal); } catch { match = false; }
        break;
      case "default":
        match = true;
        break;
    }

    if (match) {
      const renderedText = (rule.textTemplate || "{{ value }}").replace(/\{\{\s*value\s*\}\}/g, strVal);
      return { color: rule.color || "blue", text: renderedText };
    }
  }

  const defaultRule = rules.find((r) => r.operator === "default");
  if (defaultRule) {
    const renderedText = (defaultRule.textTemplate || "{{ value }}").replace(/\{\{\s*value\s*\}\}/g, strVal);
    return { color: defaultRule.color || "blue", text: renderedText };
  }

  return { color: "slate", text: strVal || "No matching data" };
}

export const newsColorClasses: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  emerald: { bg: "bg-emerald-950/40", border: "border-emerald-500/40", text: "text-emerald-300", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  red:     { bg: "bg-red-950/40",     border: "border-red-500/40",     text: "text-red-300",     badge: "bg-red-500/20 text-red-300 border-red-500/30" },
  amber:   { bg: "bg-amber-950/40",   border: "border-amber-500/40",   text: "text-amber-300",   badge: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  blue:    { bg: "bg-blue-950/40",    border: "border-blue-500/40",    text: "text-blue-300",    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  purple:  { bg: "bg-purple-950/40",  border: "border-purple-500/40",  text: "text-purple-300",  badge: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  slate:   { bg: "bg-slate-900/60",   border: "border-slate-700/60",   text: "text-slate-300",   badge: "bg-slate-700/30 text-slate-300 border-slate-600/30" },
};
