import { describe, expect, it } from "bun:test";
import { buildUpdatedButtons, findButton, mergeFormPayload, normalizeId } from "./triggerHelpers";
import type { DashboardButton, DashboardRecord } from "./triggerHelpers";

describe("normalizeId", () => {
  it("returns the raw id from a SurrealDB-style id", () => {
    expect(normalizeId("dashboard:abc123")).toBe("abc123");
  });

  it("returns the id unchanged when no colon", () => {
    expect(normalizeId("abc123")).toBe("abc123");
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
