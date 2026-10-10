import { describe, expect, it } from "bun:test";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("uses dark mode when there is no saved preference", () => {
    expect(resolveTheme(null)).toBe("dark");
    expect(resolveTheme(undefined)).toBe("dark");
  });

  it("accepts light mode and falls back to dark for invalid preferences", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("unexpected")).toBe("dark");
  });
});
