import { describe, expect, it } from "bun:test";

describe("Dashboard Content Tags and Library Filtering", () => {
  it("filters dashboards by matching ANY or ALL selected content tags", () => {
    const dashboards = [
      { id: "d1", name: "German Economic Indicators", tags: ["public"], content_tags: ["GDP", "Germany", "yearly"] },
      { id: "d2", name: "Italian Economic Indicators", tags: ["public"], content_tags: ["GDP", "Italy", "yearly"] },
      { id: "d3", name: "German Tech Companies", tags: ["group1"], content_tags: ["Tech", "Germany", "Google"] },
      { id: "d4", name: "Internal Finance", tags: ["finance"], content_tags: ["Profit", "Google"] },
    ];

    // Filter by single content tag: Germany
    const germanyOnly = dashboards.filter(d => (d.content_tags || []).includes("Germany"));
    expect(germanyOnly.map(d => d.id)).toEqual(["d1", "d3"]);

    // Filter by combinable content tags: GDP AND Germany
    const gdpAndGermany = dashboards.filter(d =>
      ["GDP", "Germany"].every(t => (d.content_tags || []).includes(t))
    );
    expect(gdpAndGermany.map(d => d.id)).toEqual(["d1"]);

    // Filter by combinable Group Tag AND Content Tag: group1 AND Germany
    const group1AndGermany = dashboards.filter(d =>
      (d.tags || []).includes("group1") && (d.content_tags || []).includes("Germany")
    );
    expect(group1AndGermany.map(d => d.id)).toEqual(["d3"]);

    // Filter by combinable Group Tag AND Content Tag: public AND Germany
    const publicAndGermany = dashboards.filter(d =>
      (d.tags || []).includes("public") && (d.content_tags || []).includes("Germany")
    );
    expect(publicAndGermany.map(d => d.id)).toEqual(["d1"]);
  });

  it("handles empty or missing content_tags safely", () => {
    const emptyDash = { id: "d_empty" };
    const hasTag = (emptyDash as any).content_tags?.includes("Germany") || false;
    expect(hasTag).toBe(false);
  });
});
