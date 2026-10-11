import { describe, expect, it } from "bun:test";
import {
  buildMixedChartData,
  buildMultiChartData,
  collectFieldNames,
  computeGaussianKDE,
  effectiveChartType,
  resolveChartSeries,
} from "./chartSeries";

describe("resolveChartSeries", () => {
  it("maps a legacy bar or line chart to one series", () => {
    const barSeries = resolveChartSeries(undefined, "bar", "deaths");
    expect(barSeries).toHaveLength(1);
    expect(barSeries[0].label).toBe("deaths");
    expect(barSeries[0].yKey).toBe("deaths");
    expect(barSeries[0].type).toBe("bar");
    expect(barSeries[0].axis).toBe("left");
    expect(barSeries[0].color).toBeDefined();

    expect(resolveChartSeries(undefined, "line", "rate")[0].type).toBe("line");
  });

  it("handles multi-chart initialization", () => {
    const multi = resolveChartSeries(undefined, "multi", "total");
    expect(multi).toHaveLength(1);
    expect(multi[0].label).toBe("total");
    expect(multi[0].type).toBe("bar");
  });

  it("preserves an explicitly empty series list", () => {
    expect(resolveChartSeries([], "bar", "deaths")).toEqual([]);
  });
});

describe("effectiveChartType", () => {
  it("detects multi when explicit", () => {
    expect(effectiveChartType("multi")).toBe("multi");
  });

  it("upgrades legacy bar chart with mixed series to multi", () => {
    expect(
      effectiveChartType("bar", [
        { label: "A", yKey: "a", type: "bar" },
        { label: "B", yKey: "b", type: "line" },
      ]),
    ).toBe("multi");
  });

  it("upgrades when advanced chart types are present", () => {
    expect(
      effectiveChartType("bar", [
        { label: "A", yKey: "a", type: "scatter" },
      ]),
    ).toBe("multi");
    expect(
      effectiveChartType("line", [
        { label: "A", yKey: "a", type: "bubble" },
      ]),
    ).toBe("multi");
    expect(
      effectiveChartType("bar", [
        { label: "A", yKey: "a", type: "area" },
      ]),
    ).toBe("multi");
    expect(
      effectiveChartType("bar", [
        { label: "A", yKey: "a", type: "density" },
      ]),
    ).toBe("multi");
  });

  it("upgrades when series specify distinct workflows", () => {
    expect(
      effectiveChartType("bar", [
        { label: "A", yKey: "a", type: "bar", workflowId: "wf_2" },
      ]),
    ).toBe("multi");
  });

  it("keeps pure bar or line when only uniform series exist", () => {
    expect(
      effectiveChartType("bar", [
        { label: "A", yKey: "a", type: "bar" },
        { label: "B", yKey: "b", type: "bar" },
      ]),
    ).toBe("bar");
  });
});

describe("buildMultiChartData", () => {
  const rows = [
    { year: 2020, deaths: 12, rate: "0.7" },
    { year: 2021, deaths: 15, rate: "0.9" },
  ];

  it("builds labeled mixed datasets with independent Y fields and axes", () => {
    const result = buildMixedChartData(rows, "year", [
      { label: "Deaths", yKey: "deaths", type: "bar", color: "#ff0000" },
      { label: "Rate", yKey: "rate", type: "line", axis: "right", color: "#00ff00" },
    ]);

    expect(result.labels).toEqual(["2020", "2021"]);
    expect(
      result.datasets.map(({ type, label, data, yAxisID, borderColor }) => ({
        type,
        label,
        data,
        yAxisID,
        borderColor,
      })),
    ).toEqual([
      { type: "bar", label: "Deaths", data: [12, 15], yAxisID: "y", borderColor: "#ff0000" },
      { type: "line", label: "Rate", data: [0.7, 0.9], yAxisID: "y1", borderColor: "#00ff00" },
    ]);
    expect(result.datasets[1].fill).toBe(false);
    expect(result.hasRightAxis).toBe(true);
  });

  it("merges multiple workflow sources with unified X categories", () => {
    const sourceA = [
      { month: "Jan", revenue: 100 },
      { month: "Feb", revenue: 150 },
    ];
    const sourceB = [
      { month: "Feb", cost: 80 },
      { month: "Mar", cost: 110 },
    ];

    const result = buildMultiChartData(
      {
        wf_rev: sourceA,
        wf_cost: sourceB,
      },
      "month",
      [
        { label: "Revenue", yKey: "revenue", type: "bar", workflowId: "wf_rev" },
        { label: "Cost", yKey: "cost", type: "line", workflowId: "wf_cost" },
      ],
    );

    expect(result.labels).toEqual(["Jan", "Feb", "Mar"]);
    expect(result.datasets[0].data).toEqual([100, 150, 0]);
    expect(result.datasets[1].data).toEqual([null, 80, 110]);
  });

  it("handles stacked area and ensures bars do not stack into area", () => {
    const data = [
      { period: "Q1", base: 50, added: 25, target: 100 },
      { period: "Q2", base: 60, added: 30, target: 110 },
    ];

    const result = buildMultiChartData(data, "period", [
      { label: "Base", yKey: "base", type: "area" },
      { label: "Added", yKey: "added", type: "area" },
      { label: "Target", yKey: "target", type: "bar" },
    ]);

    expect(result.hasStack).toBe(true);
    expect(result.datasets[0].stack).toBe("stacked_area");
    expect(result.datasets[1].stack).toBe("stacked_area");
    expect(result.datasets[2].stack).toBe("bar_2");
  });

  it("handles bubble chart with radius key scaling", () => {
    const data = [
      { step: "A", score: 10, weight: 15 },
      { step: "B", score: 20, weight: 50 },
    ];

    const result = buildMultiChartData(data, "step", [
      { label: "Performance", yKey: "score", type: "bubble", rKey: "weight" },
    ]);

    expect(result.datasets[0].type).toBe("bubble");
    expect(result.datasets[0].data).toEqual([
      { x: "A", y: 10, r: 15 },
      { x: "B", y: 20, r: 24 }, // clamped max 24
    ]);
  });

  it("handles Gaussian KDE for density plots", () => {
    const nums = [10, 12, 12, 13, 15, 18, 20, 21, 22];
    const kde = computeGaussianKDE(nums);
    expect(kde.length).toBeGreaterThan(10);
    expect(kde[0].y).toBeGreaterThanOrEqual(0);

    const result = buildMultiChartData(
      nums.map((n) => ({ val: n })),
      undefined,
      [{ label: "Val Distribution", yKey: "val", type: "density" }],
    );

    expect(result.hasDensity).toBe(true);
    expect(result.datasets[0].xAxisID).toBe("xDensity");
    expect(result.datasets[0].yAxisID).toBe("yDensity");
  });
});

describe("collectFieldNames", () => {
  it("extracts field names from SurrealDB nested array response", () => {
    const surrealResponse = [
      [
        { total: 142, month: "2026-05", active: true },
        { total: 190, month: "2026-06", active: false },
      ],
    ];

    const fields = collectFieldNames(surrealResponse);
    expect(fields.map((f) => f.path)).toContain("total");
    expect(fields.map((f) => f.path)).toContain("month");
    expect(fields.map((f) => f.path)).toContain("active");

    const totalField = fields.find((f) => f.path === "total");
    expect(totalField?.type).toBe("number");
    expect(totalField?.sample).toBe(142);
  });

  it("extracts nested object paths", () => {
    const resp = [{ id: "rec_1", metrics: { count: 10, rate: 0.5 } }];
    const fields = collectFieldNames(resp);
    expect(fields.map((f) => f.path)).toContain("id");
    expect(fields.map((f) => f.path)).toContain("metrics.count");
    expect(fields.map((f) => f.path)).toContain("metrics.rate");
  });
});
