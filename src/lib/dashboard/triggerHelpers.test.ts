import { describe, expect, it } from "bun:test";
import { buildUpdatedButtons, findButton, mergeFormPayload, normalizeId } from "./triggerHelpers";
import type { DashboardButton, DashboardRecord } from "./triggerHelpers";

import { dashboardId } from "./boardTypes";
import { parseListFieldValue } from "./widgetTypes";

describe("normalizeId", () => {
  it("returns the raw id from a SurrealDB-style id", () => {
    expect(normalizeId("dashboard:abc123")).toBe("abc123");
  });

  it("returns the id unchanged when no colon", () => {
    expect(normalizeId("abc123")).toBe("abc123");
  });

  it("strips SurrealDB chevrons ⟨⟩ from ids", () => {
    expect(normalizeId("dashboard:⟨ea6d7921-095f-4dbe-bc87-7e765f4164a8⟩")).toBe("ea6d7921-095f-4dbe-bc87-7e765f4164a8");
    expect(normalizeId("⟨ea6d7921-095f-4dbe-bc87-7e765f4164a8⟩")).toBe("ea6d7921-095f-4dbe-bc87-7e765f4164a8");
    expect(normalizeId("")).toBe("");
  });
});

describe("dashboardId", () => {
  it("strips dashboard: table prefix and chevrons", () => {
    expect(dashboardId("dashboard:⟨ea6d7921-095f-4dbe-bc87-7e765f4164a8⟩")).toBe("ea6d7921-095f-4dbe-bc87-7e765f4164a8");
    expect(dashboardId("dashboard:simple_id")).toBe("simple_id");
  });
});

describe("findButton", () => {
  const dashboard: DashboardRecord = {
    id: "dashboard:test",
    buttons: [
      { id: "btn_1", workflowId: "wf:1" },
      { id: "btn_2", workflowId: "wf:2" },
    ],
  };

  it("finds a button by id", () => {
    expect(findButton(dashboard, "btn_2")?.workflowId).toBe("wf:2");
  });

  it("returns undefined for missing buttons", () => {
    expect(findButton(dashboard, "missing")).toBeUndefined();
  });
});

describe("mergeFormPayload", () => {
  const fields: DashboardButton["formConfig"] = [
    { name: "email", value: "saved@example.com" },
    { name: "empty", defaultValue: "fallback" },
  ];

  it("preserves submitted values", () => {
    const merged = mergeFormPayload({ email: "new@example.com" }, fields);
    expect(merged.email).toBe("new@example.com");
  });

  it("fills missing values from saved/default", () => {
    const merged = mergeFormPayload({}, fields);
    expect(merged.email).toBe("saved@example.com");
    expect(merged.empty).toBe("fallback");
  });

  it("normalizes 'list' fields from comma/newline/quoted strings into string arrays", () => {
    const listFields: DashboardButton["formConfig"] = [
      {
        name: "fallback_models",
        type: "list",
        defaultValue: `"qwen3.5-flash-2026-02-23",\n"qwen3.5-omni-flash",\n"qwen3-omni-flash-2025-12-01",\n"qwen3.5-omni-flash-2026-03-15",\n"qwen3.5-flash",\n"qwen3.6-flash-2026-04-16",\n"qwen3.6-flash`,
      },
    ];
    const mergedFromDefault = mergeFormPayload({}, listFields);
    expect(mergedFromDefault.fallback_models).toEqual([
      "qwen3.5-flash-2026-02-23",
      "qwen3.5-omni-flash",
      "qwen3-omni-flash-2025-12-01",
      "qwen3.5-omni-flash-2026-03-15",
      "qwen3.5-flash",
      "qwen3.6-flash-2026-04-16",
      "qwen3.6-flash",
    ]);

    const mergedFromSubmit = mergeFormPayload(
      { fallback_models: "model-a, model-b, model-c, model-d" },
      listFields
    );
    expect(mergedFromSubmit.fallback_models).toEqual([
      "model-a",
      "model-b",
      "model-c",
      "model-d",
    ]);

    expect(parseListFieldValue('["m1", "m2", "m3", "m4"]')).toEqual(["m1", "m2", "m3", "m4"]);
  });
});

describe("buildUpdatedButtons", () => {
  const buttons: DashboardButton[] = [
    { id: "btn_1", workflowId: "wf:1", formConfig: [{ name: "email" }] },
    { id: "btn_2", workflowId: "wf:2" },
  ];

  it("persists submitted values on the matching button", () => {
    const updated = buildUpdatedButtons(buttons, "btn_1", { email: "test@example.com" });
    expect(updated[0].formConfig?.[0].value).toBe("test@example.com");
    expect(updated[1]).toEqual(buttons[1]);
  });
});

describe("allowedWorkflowIds", () => {
  it("collects main, condition, conditional rule targets, and series workflow IDs", () => {
    const { allowedWorkflowIds } = require("./triggerHelpers");
    const button = {
      id: "widget_1",
      workflowId: "workflow:main",
      conditionWorkflowId: "workflow:cond",
      conditionRules: [
        { action: "setWorkflow", targetValue: "workflow:action_wf" },
        { action: "showWidget", elseAction: "setWorkflow", elseTargetValue: "workflow:else_wf" },
      ],
      chartSeries: [
        { label: "S1", yKey: "v1", type: "bar", workflowId: "workflow:series_1" },
        { label: "S2", yKey: "v2", type: "line" },
      ],
    };

    const allowed = allowedWorkflowIds(button);
    expect(allowed.has("main")).toBe(true);
    expect(allowed.has("cond")).toBe(true);
    expect(allowed.has("action_wf")).toBe(true);
    expect(allowed.has("else_wf")).toBe(true);
    expect(allowed.has("series_1")).toBe(true);
    expect(allowed.has("unrelated")).toBe(false);
  });

  it("handles chevron-wrapped workflow IDs properly", () => {
    const { allowedWorkflowIds, normalizeId } = require("./triggerHelpers");
    const button = {
      id: "btn_homicides",
      workflowId: "workflow:⟨92a5d7b0-a4f7-47f5-ad6a-525c481f16b5⟩",
    };
    const allowed = allowedWorkflowIds(button);
    expect(allowed.has("92a5d7b0-a4f7-47f5-ad6a-525c481f16b5")).toBe(true);
    expect(allowed.has(normalizeId("⟨92a5d7b0-a4f7-47f5-ad6a-525c481f16b5⟩"))).toBe(true);
  });
});
