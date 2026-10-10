import get from "lodash.get";
import type { ChartSeriesConfig } from "./widgetTypes";

const SERIES_COLORS = ["#6366f1", "#a855f7", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6", "#84cc16", "#f43f5e"];

export interface MixedChartData {
  labels: string[];
  datasets: Array<{
    type: "bar" | "line";
    label: string;
    data: number[];
    yAxisID: "y" | "y1";
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    pointBackgroundColor: string;
    pointRadius: number;
    tension: number;
    fill: false;
    order: number;
  }>;
  hasRightAxis: boolean;
}

/**
 * Build the editor's series list without changing saved legacy settings until
 * the user edits or adds a series.
 */
export function resolveChartSeries(
  chartSeries: ChartSeriesConfig[] | undefined,
  chartType?: string,
  yKey?: string,
): ChartSeriesConfig[] {
  if (Array.isArray(chartSeries)) return chartSeries;
  if (chartType !== "bar" && chartType !== "line") return [];

  return [{ label: yKey || "Value", yKey: yKey || "", type: chartType, axis: "left" }];
}

function collectObjectKeys(data: any[]) {
  const keys = new Set<string>();

  const addKeys = (value: any, prefix = "") => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const nested = value[key];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) addKeys(nested, path);
      else keys.add(path);
    }
  };

  data.forEach((row) => addKeys(row));
  return [...keys];
}

function inferXKey(data: any[]) {
  const keys = collectObjectKeys(data);
  const byLowercase = new Map(keys.map((key) => [key.toLowerCase(), key]));
  for (const preferred of ["x", "step", "label", "name", "title", "date", "time", "year", "month", "id"]) {
    const match = byLowercase.get(preferred);
    if (match) return match;
  }
  return "";
}

function valueToLabel(value: any, index: number) {
  if (value === undefined || value === null || value === "") return String(index + 1);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function valueToNumber(value: any) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function buildMixedChartData(
  data: any[],
  xKey: string | undefined,
  chartSeries: ChartSeriesConfig[],
): MixedChartData {
  const rows = Array.isArray(data) ? data : [];
  const effectiveXKey = xKey || inferXKey(rows);
  const labels = rows.map((row, index) =>
    row && typeof row === "object" && effectiveXKey
      ? valueToLabel(get(row, effectiveXKey), index)
      : String(index + 1),
  );
  const configuredSeries = chartSeries.filter((series) => typeof series.yKey === "string" && series.yKey.trim());

  const datasets = configuredSeries.map((series, index) => {
    const type: "line" | "bar" = series.type === "line" ? "line" : "bar";
    const color = SERIES_COLORS[index % SERIES_COLORS.length];
    const axis: "y" | "y1" = series.axis === "right" ? "y1" : "y";
    const label = typeof series.label === "string" ? series.label.trim() : "";
    return {
      type,
      label: label || series.yKey,
      data: rows.map((row) => valueToNumber(row && typeof row === "object" ? get(row, series.yKey) : row)),
      yAxisID: axis,
      backgroundColor: type === "bar" ? `${color}bf` : "transparent",
      borderColor: color,
      borderWidth: type === "bar" ? 0 : 2,
      borderRadius: type === "bar" ? 4 : 0,
      pointBackgroundColor: color,
      pointRadius: type === "line" ? 3 : 0,
      tension: type === "line" ? 0.3 : 0,
      fill: false as const,
      // Chart.js draws datasets with a lower order on top. Keep lines visible
      // when a bar series and line series share the same chart area.
      order: type === "line" ? 0 : 1,
    };
  });

  return {
    labels,
    datasets,
    hasRightAxis: datasets.some((dataset) => dataset.yAxisID === "y1"),
  };
}
