import { describe, it, expect } from "bun:test";
import { getWidgetTheme, widgetColorThemes } from "./widgetThemes";
import { getDefaultWidgetDimensions } from "~/components/dashboard/DashboardGrid";
import { getValueAtPath } from "./widgetConditions";
import type { OutputField } from "./widgetTypes";

describe("widgetThemes", () => {
  it("resolves specific theme classes for each valid color", () => {
    const emerald = getWidgetTheme("emerald");
    expect(emerald.border).toContain("border-emerald-500");
    expect(emerald.outputBorder).toContain("border-emerald-500");
    expect(emerald.outputBg).toContain("bg-emerald-950");
    expect(emerald.headerDot).toContain("bg-emerald-500");

    const purple = getWidgetTheme("purple");
    expect(purple.border).toContain("border-purple-500");
    expect(purple.outputBorder).toContain("border-purple-500");

    const red = getWidgetTheme("red");
    expect(red.border).toContain("border-red-500");

    const blue = getWidgetTheme("blue");
    expect(blue.border).toContain("border-blue-500");

    const slate = getWidgetTheme("slate");
    expect(slate.border).toContain("border-slate-500");
  });

  it("falls back to blue theme for missing or invalid colors", () => {
    expect(getWidgetTheme(undefined).border).toEqual(widgetColorThemes.blue.border);
    expect(getWidgetTheme("invalid_color").border).toEqual(widgetColorThemes.blue.border);
  });
});

describe("getDefaultWidgetDimensions with output fields", () => {
  it("returns compact dimensions (h: 1) for button without output or form fields", () => {
    const dims = getDefaultWidgetDimensions("button", false);
    expect(dims.w).toBe(3);
    expect(dims.h).toBe(1);
    expect(dims.minH).toBe(1);
  });

  it("expands dimensions (h: 3, minH: 2) for button with output or form fields", () => {
    const dims = getDefaultWidgetDimensions("button", true);
    expect(dims.w).toBe(4);
    expect(dims.h).toBe(3);
    expect(dims.minH).toBe(2);
  });

  it("preserves standard dimensions for forms, tables, and charts", () => {
    expect(getDefaultWidgetDimensions("form", true).h).toBe(4);
    expect(getDefaultWidgetDimensions("table", false).w).toBe(12);
    expect(getDefaultWidgetDimensions("chart", false).h).toBe(4);
  });
});

describe("Output fields variable extraction and labeling", () => {
  const mockOutcome = {
    steps: {
      step_8m6qd1ynu: {
        status: "success",
        response: {
          status: 200,
          data: {
            data: [
              { id: "usr_1", username: "admin", email: "admin@example.com", surname: "Doe" },
              { id: "usr_2", username: "tester", email: "tester@company.org", surname: "Smith" }
            ]
          }
        }
      }
    },
    variables: {
      Target_Table: "users"
    }
  };

  it("extracts specific nested field by bracketed path", () => {
    const field: OutputField = {
      id: "f1",
      label: "Email",
      path: "{{ steps.step_8m6qd1ynu.response.email }}"
    };

    const val = getValueAtPath(mockOutcome, field.path);
    // When extracted across array of objects, returns all matching emails
    expect(val).toEqual(["admin@example.com", "tester@company.org"]);
  });

  it("extracts surname field with custom label", () => {
    const field: OutputField = {
      id: "f2",
      label: "Surname",
      path: "{{ steps.step_8m6qd1ynu.response.surname }}"
    };

    const val = getValueAtPath(mockOutcome, field.path);
    expect(val).toEqual(["Doe", "Smith"]);
  });

  it("returns full response when path is empty", () => {
    const field: OutputField = {
      id: "f3",
      label: "Full Response",
      path: ""
    };

    const val = getValueAtPath(mockOutcome, field.path);
    expect(val).toEqual(mockOutcome);
  });

  it("handles single object payloads without array wrapping", () => {
    const singleUserOutcome = {
      steps: {
        step_single: {
          response: {
            email: "alice@domain.com",
            surname: "Wonderland"
          }
        }
      }
    };

    const emailField: OutputField = {
      id: "f_alice",
      label: "Email",
      path: "{{ steps.step_single.response.email }}"
    };

    expect(getValueAtPath(singleUserOutcome, emailField.path)).toBe("alice@domain.com");
  });
});
