import get from "lodash.get";
import type {
  ConditionAction,
  ConditionOperator,
  ConditionRule,
  EffectiveWidgetConfig,
  WidgetConfig,
} from "./widgetTypes";

/** Fetch a value from an object by dot-separated path. Empty path returns the root. */
export function getValueAtPath(data: unknown, path?: string): unknown {
  if (!path || path.trim() === "") return data;
  const trimmed = path.trim();
  if (data === null || data === undefined) return undefined;
  if (typeof data !== "object") {
    if (trimmed === "response" || trimmed === "data" || trimmed === "value") return data;
    return undefined;
  }
  const direct = get(data, trimmed);
  if (direct !== undefined) return direct;
  const inVars = get(data, `variables.${trimmed}`);
  if (inVars !== undefined) return inVars;
  const inResp = get(data, `response.${trimmed}`);
  if (inResp !== undefined) return inResp;
  const inData = get(data, `data.${trimmed}`);
  if (inData !== undefined) return inData;
  return undefined;
}

/** Coerce a value to a number, returning undefined when not possible. */
function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return undefined;
}

/** Try to coerce a rule value to the type of the data value for equality checks. */
function coerceTo(value: unknown, target: unknown): unknown {
  if (typeof target === "boolean") {
    if (value === "true" || value === true || value === 1 || value === "1") return true;
    if (value === "false" || value === false || value === 0 || value === "0") return false;
  }
  if (typeof target === "number" && (typeof value === "string" || typeof value === "number")) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}

/** Compare two values with numeric coercion. */
function compareNumeric(left: unknown, right: unknown, cmp: "gt" | "lt" | "gte" | "lte"): boolean {
  const a = toNumber(left);
  const b = toNumber(right);
  if (a === undefined || b === undefined) return false;
  switch (cmp) {
    case "gt":
      return a > b;
    case "lt":
      return a < b;
    case "gte":
      return a >= b;
    case "lte":
      return a <= b;
  }
}

/** Check whether a single condition is satisfied by the provided data. */
export function evaluateCondition(data: unknown, rule: ConditionRule): boolean {
  const value = getValueAtPath(data, rule.path);

  switch (rule.operator) {
    case "equals":
      return value == coerceTo(rule.value, value);
    case "notEquals":
      return value != coerceTo(rule.value, value);
    case "contains":
      if (typeof value === "string" && typeof rule.value === "string") {
        return value.includes(rule.value);
      }
      if (Array.isArray(value)) {
        return value.includes(rule.value);
      }
      return false;
    case "truthy":
      return !!value;
    case "falsy":
      return !value;
    case "gt":
      return compareNumeric(value, rule.value, "gt");
    case "lt":
      return compareNumeric(value, rule.value, "lt");
    case "gte":
      return compareNumeric(value, rule.value, "gte");
    case "lte":
      return compareNumeric(value, rule.value, "lte");
    default:
      return false;
  }
}

/** Apply a single action to an effective widget config. */
export function applyAction(
  effective: EffectiveWidgetConfig,
  action: ConditionAction,
  targetValue?: string
): EffectiveWidgetConfig {
  switch (action) {
    case "showWidget":
      return { ...effective, hidden: false };
    case "hideWidget":
      return { ...effective, hidden: true };
    case "showForm":
      return { ...effective, formHidden: false };
    case "hideForm":
      return { ...effective, formHidden: true };
    case "setLabel":
      return targetValue === undefined ? effective : { ...effective, label: targetValue };
    case "setWorkflow":
      return targetValue === undefined ? effective : { ...effective, workflowId: targetValue };
    case "setColor":
      return targetValue === undefined ? effective : { ...effective, color: targetValue };
    case "setDisabled":
      return { ...effective, disabled: true };
    case "setEnabled":
      return { ...effective, disabled: false };
    default:
      return effective;
  }
}

/** Default effective config for a widget before any rules are evaluated. */
export function defaultEffectiveConfig(widget: WidgetConfig): EffectiveWidgetConfig {
  return {
    hidden: false,
    formHidden: false,
    label: widget.label ?? "",
    workflowId: widget.workflowId ?? "",
  };
}

/**
 * Evaluate a widget's condition rules against a workflow outcome.
 * Rules are applied in order; later rules may override earlier ones.
 * Each rule supports an optional `elseAction` for the negative case.
 */
export function applyWidgetConditions(
  widget: WidgetConfig,
  outcome: unknown
): EffectiveWidgetConfig {
  const effective = defaultEffectiveConfig(widget);
  const rules = widget.conditionRules ?? [];
  if (rules.length === 0) return effective;

  return rules.reduce((acc, rule) => {
    const matched = evaluateCondition(outcome, rule);
    if (matched) {
      return applyAction(acc, rule.action, rule.targetValue);
    }
    if (rule.elseAction) {
      return applyAction(acc, rule.elseAction, rule.elseTargetValue);
    }
    return acc;
  }, effective);
}

/** Extract the outcome data to evaluate conditions against from run logs. */
export function extractRunOutcome(logs: any[]): unknown {
  if (!Array.isArray(logs) || logs.length === 0) return undefined;
  const last = [...logs].reverse().find((log) => log.status === "success");
  if (!last) return undefined;
  const raw = last.response ?? last.meta ?? undefined;
  const vars = (last as any).variables || {};
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return { ...vars, ...raw };
  }
  if (Object.keys(vars).length > 0) {
    return { ...vars, response: raw, data: raw, value: raw };
  }
  return raw;
}
