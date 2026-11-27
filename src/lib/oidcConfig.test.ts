import { describe, expect, it } from "bun:test";
import { parseOidcScope } from "./oidcConfig";

describe("parseOidcScope", () => {
  it("parses comma-separated scopes preserving case", () => {
    expect(parseOidcScope("openId, solid.main")).toBe("openId solid.main");
  });

  it("keeps space-separated scopes as-is", () => {
    expect(parseOidcScope("openid solid.main profile")).toBe("openid solid.main profile");
  });

  it("handles mixed commas, spaces, and newlines", () => {
    expect(parseOidcScope("openid,\nsolid.main\n  email")).toBe("openid solid.main email");
  });

  it("returns undefined for empty or whitespace/comma-only input", () => {
    expect(parseOidcScope("  , ,  ")).toBeUndefined();
    expect(parseOidcScope("")).toBeUndefined();
    expect(parseOidcScope(undefined)).toBeUndefined();
    expect(parseOidcScope(null)).toBeUndefined();
  });

  it("preserves exact scope order without deduplication or modification", () => {
    expect(parseOidcScope("b,a")).toBe("b a");
    expect(parseOidcScope("solid.main,openId,solid.main")).toBe("solid.main openId solid.main");
  });
});
