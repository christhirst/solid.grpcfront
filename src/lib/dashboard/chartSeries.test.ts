import { describe, expect, it } from "bun:test";
import { buildMixedChartData, resolveChartSeries } from "./chartSeries";

describe("resolveChartSeries", () => {
  it("maps a legacy bar or line chart to one series", () => {
    expect(resolveChartSeries(undefined, "bar", "deaths")).toEqual([
      { label: "deaths", yKey: "deaths", type: "bar", axis: "left" },
    ]);
    expect(resolveChartSeries(undefined, "line", "rate")[0].type).toBe("line");
  });

  it("preserves an explicitly empty series list", () => {
    expect(resolveChartSeries([], "bar", "deaths")).toEqual([]);
  });
});

describe("buildMixedChartData", () => {
  const rows = [
    { year: 2020, deaths: 12, rate: "0.7" },
    { year: 2021, deaths: 15, rate: "0.9" },
  ];

  it("builds labeled mixed datasets with independent Y fields and axes", () => {
    const result = buildMixedChartData(rows, "year", [
      { label: "Deaths", yKey: "deaths", type: "bar" },
      { label: "Rate", yKey: "rate", type: "line", axis: "right" },
    ]);

    expect(result.labels).toEqual(["2020", "2021"]);
    expect(result.datasets.map(({ type, label, data, yAxisID }) => ({ type, label, data, yAxisID }))).toEqual([
      { type: "bar", label: "Deaths", data: [12, 15], yAxisID: "y" },
      { type: "line", label: "Rate", data: [0.7, 0.9], yAxisID: "y1" },
    ]);
    expect(result.datasets[1].fill).toBe(false);
    expect(result.hasRightAxis).toBe(true);
  });

  it("omits series with no Y field and uses the left axis by default", () => {
    const result = buildMixedChartData(rows, undefined, [
      { label: "Unconfigured", yKey: "", type: "line", axis: "right" },
      { label: "Deaths", yKey: "deaths", type: "bar" },
    ]);

    expect(result.datasets).toHaveLength(1);
    expect(result.datasets[0].yAxisID).toBe("y");
    expect(result.hasRightAxis).toBe(false);
  });

  it("supports nested X and Y fields", () => {
    const result = buildMixedChartData(
      [{ group: { month: "Jan" }, values: { total: 4 } }],
      "group.month",
      [{ label: "Total", yKey: "values.total", type: "line" }],
    );

    expect(result.labels).toEqual(["Jan"]);
    expect(result.datasets[0].data).toEqual([4]);
  });
});
