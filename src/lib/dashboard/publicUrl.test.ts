import { describe, expect, test } from "bun:test";
import { publicDashboardPath, slugFromName, urlPartError } from "./publicUrl";

describe("public dashboard URLs", () => {
  test("suggests a readable, bounded URL from a title", () => {
    expect(slugFromName("  Café / Monthly Sales! ")).toBe("cafe-monthly-sales");
    expect(slugFromName("a".repeat(79) + " long title")).toBe("a".repeat(79));
  });

  test("rejects ambiguous or unsafe path segments", () => {
    for (const value of ["", "../admin", "a/b", "a%2fb", "a b", "Team", "-team", "team-", "team--a", "a_b", null, 123]) {
      expect(urlPartError(value, "Namespace")).toBeDefined();
    }
    expect(urlPartError("team-42", "Namespace")).toBeUndefined();
    expect(urlPartError("a".repeat(41), "Namespace")).toBeDefined();
    expect(urlPartError("a".repeat(81), "Dashboard URL")).toBeDefined();
  });

  test("prefers the configured URL and preserves legacy ID links", () => {
    expect(publicDashboardPath({ id: "dashboard:⟨abc-123⟩" })).toBe("/p/abc-123");
    expect(publicDashboardPath({ id: "dashboard:abc", namespace: "team-a", slug: "daily-sales" })).toBe("/p/team-a/daily-sales");
    expect(publicDashboardPath({ id: "dashboard:abc", slug: "daily-sales" })).toBe("/p/abc");
  });
});
