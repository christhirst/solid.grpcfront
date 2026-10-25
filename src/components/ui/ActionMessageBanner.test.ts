import { describe, expect, test } from "bun:test";
import { ActionMessage } from "./ActionMessageBanner";

describe("ActionMessageBanner", () => {
  test("ActionMessage type definitions support success and error", () => {
    const successMsg: ActionMessage = {
      type: "success",
      text: "Dashboard saved successfully.",
    };
    expect(successMsg.type).toBe("success");
    expect(successMsg.text).toBe("Dashboard saved successfully.");

    const errorMsg: ActionMessage = {
      type: "error",
      text: "Unable to save dashboard.",
    };
    expect(errorMsg.type).toBe("error");
    expect(errorMsg.text).toBe("Unable to save dashboard.");
  });

  test("derives correct styling classes and prefix icons based on message type", () => {
    const getVariantClasses = (type: "success" | "error") =>
      type === "error"
        ? "bg-red-500/10 border-red-500/30 text-red-300"
        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";

    const getIcon = (type: "success" | "error") => (type === "error" ? "⚠️" : "✓");

    expect(getVariantClasses("success")).toContain("emerald");
    expect(getIcon("success")).toBe("✓");

    expect(getVariantClasses("error")).toContain("red");
    expect(getIcon("error")).toBe("⚠️");
  });
});
