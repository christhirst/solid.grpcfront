import get from "lodash.get";
import type {
  ConditionAction,
  ConditionOperator,
  ConditionRule,
  EffectiveWidgetConfig,
  WidgetConfig,
} from "./widgetTypes";

/** Match a text against a wildcard pattern supporting * (any sequence) and ? (single char). */
export function matchWildcard(pattern: string, text: string, caseInsensitive = true): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*") && !pattern.includes("?")) {
    return caseInsensitive
      ? text.toLowerCase() === pattern.toLowerCase()
      : text === pattern;
  }
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regexString = "^" + escaped.replace(/\*/g, ".*").replace(/\?/g, ".") + "$";
  const regex = new RegExp(regexString, caseInsensitive ? "i" : "");
  return regex.test(text);
}

/** Recursively resolve a subPath from an object or envelope (e.g. data.data arrays). */
export function resolveSubPath(obj: any, subPath: string): any {
  if (obj === null || obj === undefined) return undefined;
  const normalized = subPath.replace(/\[(\w+)\]/g, ".$1").replace(/^\./, "");

  // 1. Direct lodash get (supports foo.bar, data.0.email, etc.)
  const direct = get(obj, subPath) ?? get(obj, normalized);
  if (direct !== undefined) {
    if (Array.isArray(direct)) {
      const filtered = direct.filter((v) => v !== undefined && v !== null && v !== "");
      return filtered.length === 1 ? filtered[0] : filtered;
    }
    return direct;
  }

  // 2. Check inside data or data.data envelope directly
  const inData =
    get(obj, `data.${normalized}`) ??
    get(obj, `data.data.${normalized}`) ??
    get(obj, `data.${subPath}`) ??
    get(obj, `data.data.${subPath}`);
  if (inData !== undefined) {
    if (Array.isArray(inData)) {
      const filtered = inData.filter((v) => v !== undefined && v !== null && v !== "");
      return filtered.length === 1 ? filtered[0] : filtered;
    }
    return inData;
  }

  // 3. If obj or obj.data is an array, support mapping or indexing
  let arr: any[] | undefined;
  if (Array.isArray(obj)) {
    arr = obj;
  } else if (Array.isArray(obj?.data)) {
    arr = obj.data;
  } else if (Array.isArray(obj?.data?.data)) {
    arr = obj.data.data;
  }

  if (arr) {
    // Check if normalized path starts with an array index e.g. "0.email" or "0"
    const indexMatch = normalized.match(/^(\d+)(?:\.(.*))?$/);
    if (indexMatch) {
      const idx = parseInt(indexMatch[1], 10);
      const rest = indexMatch[2];
      const targetItem = arr[idx];
      if (targetItem !== undefined) {
        if (!rest) return targetItem;
        return resolveSubPath(targetItem, rest);
      }
    }

    // Check if normalized path ends with an index e.g. "email.0"
    const suffixIndexMatch = normalized.match(/^(.*?)\.(\d+)$/);
    if (suffixIndexMatch) {
      const prop = suffixIndexMatch[1];
      const idx = parseInt(suffixIndexMatch[2], 10);
      const items = arr
        .map((item) => get(item, prop))
        .filter((v) => v !== undefined && v !== null && v !== "");
      if (items[idx] !== undefined) return items[idx];
    }

    // Map subPath across all array items
    const items = arr
      .map((item) => get(item, normalized) ?? get(item, subPath))
      .filter((v) => v !== undefined && v !== null && v !== "");
    if (items.length > 0) {
      return items.length === 1 ? items[0] : items;
    }
  }

  return undefined;
}

/** Fetch a value from an object by dot-separated path. Empty path returns the root. */
export function getValueAtPath(data: unknown, path?: string): unknown {
  if (!path || path.trim() === "") return data;
  const clean = path.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
  if (!clean) return data;
  if (data === null || data === undefined) return undefined;

  if (typeof data !== "object") {
    if (clean === "response" || clean === "data" || clean === "value") return data;
    return undefined;
  }

  // 1. If path explicitly targets a step, evaluate step directly first
  const stepMatch = clean.match(/^steps\.([^.]+)(?:\.response)?(?:\.(.+))?$/);
  if (stepMatch) {
    const stepId = stepMatch[1];
    const subPath = stepMatch[2];
    const stepObj = get(data, `steps.${stepId}.response`) ?? get(data, `steps.${stepId}`);
    if (stepObj !== undefined) {
      if (!subPath || subPath === "response") return stepObj;
      const stepVal = resolveSubPath(stepObj, subPath);
      if (stepVal !== undefined) return stepVal;
    }
  }

  // 2. Direct lookup by clean path
  const direct = get(data, clean);
  if (direct !== undefined) {
    if (Array.isArray(direct)) {
      const filtered = direct.filter((v) => v !== undefined && v !== null && v !== "");
      return filtered.length === 1 ? filtered[0] : filtered;
    }
    return direct;
  }

  // 3. Fallback to variables or response/data envelopes
  const inVars = get(data, `variables.${clean}`);
  if (inVars !== undefined) return inVars;
  const inResp = get(data, `response.${clean}`);
  if (inResp !== undefined) return inResp;
  const inData = get(data, `data.${clean}`);
  if (inData !== undefined) return inData;

  // 4. Resolve subPath against root data object
  return resolveSubPath(data, clean);
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
  const ruleVal = rule.value;
  const isWildcard = typeof ruleVal === "string" && (ruleVal.includes("*") || ruleVal.includes("?"));

  switch (rule.operator) {
    case "equals": {
      if (isWildcard) {
        if (Array.isArray(value)) {
          return value.some((v) => matchWildcard(ruleVal as string, String(v ?? "")));
        }
        return matchWildcard(ruleVal as string, String(value ?? ""));
      }
      if (Array.isArray(value)) {
        return value.some((v) => v == coerceTo(ruleVal, v));
      }
      return value == coerceTo(ruleVal, value);
    }
    case "notEquals": {
      if (isWildcard) {
        if (Array.isArray(value)) {
          return !value.some((v) => matchWildcard(ruleVal as string, String(v ?? "")));
        }
        return !matchWildcard(ruleVal as string, String(value ?? ""));
      }
      if (Array.isArray(value)) {
        return !value.some((v) => v == coerceTo(ruleVal, v));
      }
      return value != coerceTo(ruleVal, value);
    }
    case "contains": {
      if (isWildcard) {
        if (Array.isArray(value)) {
          return value.some((v) => matchWildcard(ruleVal as string, String(v ?? "")));
        }
        return matchWildcard(ruleVal as string, String(value ?? ""));
      }
      if (typeof value === "string" && typeof ruleVal === "string") {
        return value.toLowerCase().includes(ruleVal.toLowerCase());
      }
      if (Array.isArray(value)) {
        return value.some((v) => String(v ?? "").toLowerCase().includes(String(ruleVal ?? "").toLowerCase()));
      }
      return false;
    }
    case "truthy":
      return Array.isArray(value) ? value.length > 0 : !!value;
    case "falsy":
      return Array.isArray(value) ? value.length === 0 : !value;
    case "gt":
      return compareNumeric(Array.isArray(value) ? value[0] : value, ruleVal, "gt");
    case "lt":
      return compareNumeric(Array.isArray(value) ? value[0] : value, ruleVal, "lt");
    case "gte":
      return compareNumeric(Array.isArray(value) ? value[0] : value, ruleVal, "gte");
    case "lte":
      return compareNumeric(Array.isArray(value) ? value[0] : value, ruleVal, "lte");
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
  const rules = widget.conditionRules ?? [];
  const hasShowRule = rules.some(
    (r) => r.action === "showWidget" || r.elseAction === "showWidget"
  );

  return {
    hidden: hasShowRule,
    formHidden: rules.some((r) => r.action === "showForm" || r.elseAction === "showForm"),
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

  const steps: Record<string, any> = {};
  let hasSteps = false;
  for (const log of logs) {
    if (log && log.stepId) {
      hasSteps = true;
      steps[log.stepId] = {
        response: log.response,
        meta: log.meta,
        status: log.status,
        ...(typeof log.response === "object" && log.response !== null && !Array.isArray(log.response)
          ? log.response
          : {}),
      };
    }
  }

  const base = typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? { ...raw }
    : { response: raw, data: raw, value: raw };

  if (hasSteps) {
    return {
      ...vars,
      ...base,
      steps,
    };
  }

  if (Object.keys(vars).length > 0) {
    return {
      ...vars,
      ...base,
    };
  }

  return raw;
}
