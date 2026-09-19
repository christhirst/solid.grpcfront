import { describe, expect, it } from "bun:test";
import {
  applyAction,
  applyWidgetConditions,
  defaultEffectiveConfig,
  evaluateCondition,
  extractRunOutcome,
  getValueAtPath,
} from "./widgetConditions";
import type { ConditionRule, WidgetConfig } from "./widgetTypes";

describe("getValueAtPath", () => {
  it("returns the root when path is empty", () => {
    expect(getValueAtPath({ exists: true }, "")).toEqual({ exists: true });
  });

  it("navigates nested objects", () => {
    expect(getValueAtPath({ user: { email: "a@b.c" } }, "user.email")).toBe("a@b.c");
  });

  it("returns undefined for missing paths", () => {
    expect(getValueAtPath({}, "missing.path")).toBeUndefined();
  });
});

describe("evaluateCondition", () => {
  const data = { exists: true, count: 5, name: "hello" };

  it("matches equals", () => {
    expect(evaluateCondition(data, { id: "1", operator: "equals", path: "exists", value: true, action: "showWidget" } as ConditionRule)).toBe(true);
    expect(evaluateCondition(data, { id: "2", operator: "equals", path: "exists", value: false, action: "showWidget" } as ConditionRule)).toBe(false);
  });

  it("coerces string values for equality", () => {
    expect(evaluateCondition({ exists: true }, { id: "1", operator: "equals", path: "exists", value: "true", action: "showWidget" } as ConditionRule)).toBe(true);
    expect(evaluateCondition({ count: 5 }, { id: "2", operator: "equals", path: "count", value: "5", action: "showWidget" } as ConditionRule)).toBe(true);
  });

  it("matches notEquals", () => {
    expect(evaluateCondition(data, { id: "1", operator: "notEquals", path: "exists", value: false, action: "showWidget" } as ConditionRule)).toBe(true);
  });

  it("matches contains", () => {
    expect(evaluateCondition(data, { id: "1", operator: "contains", path: "name", value: "ell", action: "showWidget" } as ConditionRule)).toBe(true);
    expect(evaluateCondition(data, { id: "2", operator: "contains", path: "name", value: "xyz", action: "showWidget" } as ConditionRule)).toBe(false);
  });

  it("matches truthy/falsy", () => {
    expect(evaluateCondition({ value: 1 }, { id: "1", operator: "truthy", path: "value", action: "showWidget" } as ConditionRule)).toBe(true);
    expect(evaluateCondition({ value: 0 }, { id: "2", operator: "falsy", path: "value", action: "showWidget" } as ConditionRule)).toBe(true);
  });

  it("matches numeric comparisons", () => {
    expect(evaluateCondition(data, { id: "1", operator: "gt", path: "count", value: 3, action: "showWidget" } as ConditionRule)).toBe(true);
    expect(evaluateCondition(data, { id: "2", operator: "lte", path: "count", value: 5, action: "showWidget" } as ConditionRule)).toBe(true);
    expect(evaluateCondition(data, { id: "3", operator: "lt", path: "count", value: 5, action: "showWidget" } as ConditionRule)).toBe(false);
  });
});

describe("applyWidgetConditions", () => {
  const base: WidgetConfig = {
    id: "w1",
    label: "Add",
    widgetType: "button",
    workflowId: "wf-add",
  };

  it("returns defaults when no rules exist", () => {
    expect(applyWidgetConditions(base, { exists: true })).toEqual(defaultEffectiveConfig(base));
  });

  it("hides form and changes label when mail exists", () => {
    const widget: WidgetConfig = {
      ...base,
      conditionRules: [
        { id: "r1", path: "exists", operator: "equals", value: true, action: "hideForm" },
        { id: "r2", path: "exists", operator: "equals", value: true, action: "setLabel", targetValue: "Delete" },
        { id: "r3", path: "exists", operator: "equals", value: true, action: "setWorkflow", targetValue: "wf-delete" },
        { id: "r4", path: "exists", operator: "equals", value: false, action: "showForm" },
        { id: "r5", path: "exists", operator: "equals", value: false, action: "setLabel", targetValue: "Add" },
      ],
    };

    const existsTrue = applyWidgetConditions(widget, { exists: true });
    expect(existsTrue.hidden).toBe(false);
    expect(existsTrue.formHidden).toBe(true);
    expect(existsTrue.label).toBe("Delete");
    expect(existsTrue.workflowId).toBe("wf-delete");

    const existsFalse = applyWidgetConditions(widget, { exists: false });
    expect(existsFalse.formHidden).toBe(false);
    expect(existsFalse.label).toBe("Add");
    expect(existsFalse.workflowId).toBe("wf-add");
  });
});

describe("extractRunOutcome", () => {
  it("returns the last successful response", () => {
    const logs = [
      { status: "success", response: { ignored: true } },
      { status: "failed", response: { ignored: true } },
      { status: "success", response: { exists: true } },
    ];
    expect(extractRunOutcome(logs)).toEqual({ exists: true });
  });

  it("returns undefined when no successful logs", () => {
    expect(extractRunOutcome([{ status: "failed" }])).toBeUndefined();
  });
});
