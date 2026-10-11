import get from "lodash.get";
import type { ChartSeriesConfig, ChartSeriesType } from "./widgetTypes";

export const SERIES_COLORS = [
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#3b82f6",
  "#84cc16",
  "#f43f5e",
];

export const MULTI_SERIES_TYPES: readonly ChartSeriesType[] = [
  "bar",
  "line",
  "scatter",
  "bubble",
  "density",
  "area",
] as const;

export function hexToRgba(hex: string, alpha: number): string {
  if (!hex || typeof hex !== "string") return `rgba(99, 102, 241, ${alpha})`;
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface MixedChartData {
  labels: string[];
  datasets: Array<{
    type: "bar" | "line" | "scatter" | "bubble";
    label: string;
    data: any[];
    yAxisID: "y" | "y1" | "yDensity";
    xAxisID?: "x" | "xDensity";
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    pointBackgroundColor?: string;
    pointBorderColor?: string;
    pointRadius?: number;
    pointHoverRadius?: number;
    tension?: number;
    fill?: boolean | string;
    showLine?: boolean;
    order?: number;
    stack?: string;
    spanGaps?: boolean;
  }>;
  hasRightAxis: boolean;
}

export interface MultiChartData extends MixedChartData {
  hasStack: boolean;
  hasDensity: boolean;
}

export function effectiveChartType(
  chartType?: string,
  chartSeries?: ChartSeriesConfig[],
): string {
  if (chartType === "multi") return "multi";
  if (Array.isArray(chartSeries) && chartSeries.length > 0) {
    const hasMultipleWorkflows = chartSeries.some(
      (s) => typeof s.workflowId === "string" && s.workflowId.trim() !== "",
    );
    const types = new Set(chartSeries.map((s) => s.type));
    const hasAdvancedTypes = chartSeries.some(
      (s) =>
        s.type === "scatter" ||
        s.type === "bubble" ||
        s.type === "density" ||
        s.type === "area",
    );
    if (
      hasMultipleWorkflows ||
      hasAdvancedTypes ||
      (types.has("bar") && types.has("line"))
    ) {
      return "multi";
    }
  }
  return chartType || "bar";
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
  if (chartType === "multi") {
    return [
      {
        id: `series_${Date.now()}_1`,
        label: yKey || "Series 1",
        yKey: yKey || "",
        type: "bar",
        axis: "left",
        color: SERIES_COLORS[0],
      },
    ];
  }
  if (chartType !== "bar" && chartType !== "line") return [];

  return [
    {
      id: `series_${Date.now()}_1`,
      label: yKey || "Value",
      yKey: yKey || "",
      type: chartType as "bar" | "line",
      axis: "left",
      color: SERIES_COLORS[0],
    },
  ];
}

export function parseJsonString(value: any): any {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("[") && !trimmed.startsWith("{"))) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function normalizeDataArray(value: any): any[] {
  let data = parseJsonString(value);

  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (Array.isArray(data.result)) data = data.result;
    else if (Array.isArray(data.data)) data = data.data;
    else if (Array.isArray(data.items)) data = data.items;
    else {
      const arrayKey = Object.keys(data).find((key) => Array.isArray(data[key]));
      if (arrayKey) data = data[arrayKey];
    }
  }

  if (!Array.isArray(data)) {
    data = data !== undefined && data !== null ? [data] : [];
  }

  while (data.length === 1) {
    const first = parseJsonString(data[0]);
    if (!Array.isArray(first)) break;
    data = first;
  }

  return data.map(parseJsonString);
}

export function collectObjectKeys(data: any[]): string[] {
  const keys = new Set<string>();

  const addKeys = (value: any, prefix = "") => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const nested = value[key];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        addKeys(nested, path);
      } else {
        keys.add(path);
      }
    }
  };

  data.forEach((row) => addKeys(row));
  return [...keys];
}

export function inferXKey(data: any[]): string {
  const keys = collectObjectKeys(data);
  const byLowercase = new Map(keys.map((key) => [key.toLowerCase(), key]));
  for (const preferred of [
    "x",
    "step",
    "label",
    "name",
    "title",
    "date",
    "time",
    "year",
    "month",
    "id",
  ]) {
    const match = byLowercase.get(preferred);
    if (match) return match;
  }
  return "";
}

export function valueToLabel(value: any, index: number): string {
  if (value === undefined || value === null || value === "") return String(index + 1);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function valueToNumber(value: any, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export interface FieldInfo {
  path: string;
  type: "string" | "number" | "boolean" | "date" | "object" | "array";
  sample?: any;
}

export function collectFieldNames(response: any): FieldInfo[] {
  if (response === undefined || response === null) return [];
  const rows = normalizeDataArray(response);
  const map = new Map<string, FieldInfo>();

  const inspectValue = (val: any, prefix = "", depth = 0) => {
    if (depth > 3 || val === undefined || val === null) return;
    if (typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
      for (const [k, v] of Object.entries(val)) {
        const fullPath = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
          inspectValue(v, fullPath, depth + 1);
        } else {
          let type: FieldInfo["type"] = "string";
          if (typeof v === "number") type = "number";
          else if (typeof v === "boolean") type = "boolean";
          else if (Array.isArray(v)) type = "array";
          else if (
            typeof v === "string" &&
            (v.includes("-") || v.includes("T")) &&
            !isNaN(Date.parse(v))
          ) {
            type = "date";
          }
          if (!map.has(fullPath)) {
            map.set(fullPath, { path: fullPath, type, sample: v });
          }
        }
      }
    }
  };

  if (rows.length > 0) {
    const sampleRows = rows.slice(0, 15);
    for (const row of sampleRows) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        inspectValue(row);
      }
    }
  } else if (typeof response === "object" && !Array.isArray(response)) {
    inspectValue(response);
  }

  return Array.from(map.values());
}

export function computeGaussianKDE(
  nums: number[],
  sampleCount = 41,
): Array<{ x: number; y: number }> {
  if (nums.length < 2) return [];
  const n = nums.length;
  const mean = nums.reduce((sum, v) => sum + v, 0) / n;
  const variance =
    nums.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
  const std = Math.sqrt(variance);
  let h = 1.06 * std * Math.pow(n, -0.2);
  if (!Number.isFinite(h) || h <= 0) h = 1;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const rangeStart = min - 2.5 * h;
  const rangeEnd = max + 2.5 * h;
  const step = (rangeEnd - rangeStart) / (sampleCount - 1);

  const points: Array<{ x: number; y: number }> = [];
  const sqrt2Pi = Math.sqrt(2 * Math.PI);

  for (let i = 0; i < sampleCount; i++) {
    const x = rangeStart + i * step;
    let sumKernel = 0;
    for (let j = 0; j < n; j++) {
      const u = (x - nums[j]) / h;
      sumKernel += Math.exp(-0.5 * u * u);
    }
    const density = sumKernel / (n * h * sqrt2Pi);
    points.push({
      x: Number(x.toFixed(2)),
      y: Number(density.toFixed(5)),
    });
  }
  return points;
}

export function buildMultiChartData(
  dataBySource: Record<string, any[]> | any[],
  xKey: string | undefined,
  chartSeries: ChartSeriesConfig[],
  defaultSourceKey = "__default__",
): MultiChartData {
  const sourceMap: Record<string, any[]> = Array.isArray(dataBySource)
    ? { [defaultSourceKey]: dataBySource }
    : dataBySource && typeof dataBySource === "object"
      ? dataBySource
      : { [defaultSourceKey]: [] };

  const configuredSeries = chartSeries.filter(
    (series) => typeof series.yKey === "string" && series.yKey.trim(),
  );

  if (configuredSeries.length === 0) {
    return {
      labels: [],
      datasets: [],
      hasRightAxis: false,
      hasStack: false,
      hasDensity: false,
    };
  }

  const hasStack = configuredSeries.some((s) => s.type === "area");
  let hasDensity = false;

  // Build union of X labels across all non-density sources preserving appearance order
  const labelSet = new Set<string>();
  for (const series of configuredSeries) {
    if (series.type === "density") continue;
    const sKey = (series.workflowId && series.workflowId.trim()) || defaultSourceKey;
    const rows = normalizeDataArray(sourceMap[sKey] || sourceMap[defaultSourceKey] || []);
    const effX = series.xKey || xKey || inferXKey(rows);
    rows.forEach((row, idx) => {
      const lbl =
        row && typeof row === "object" && effX
          ? valueToLabel(get(row, effX), idx)
          : String(idx + 1);
      labelSet.add(lbl);
    });
  }

  let labels = Array.from(labelSet);
  if (labels.length === 0) {
    // If only density or no rows found with labels
    let maxLen = 0;
    for (const series of configuredSeries) {
      const sKey = (series.workflowId && series.workflowId.trim()) || defaultSourceKey;
      const rows = normalizeDataArray(sourceMap[sKey] || sourceMap[defaultSourceKey] || []);
      if (rows.length > maxLen) maxLen = rows.length;
    }
    labels = Array.from({ length: maxLen }, (_, i) => String(i + 1));
  }

  const datasets: MultiChartData["datasets"] = [];

  configuredSeries.forEach((series, index) => {
    const sKey = (series.workflowId && series.workflowId.trim()) || defaultSourceKey;
    const rows = normalizeDataArray(sourceMap[sKey] || sourceMap[defaultSourceKey] || []);
    const effX = series.xKey || xKey || inferXKey(rows);
    const color = series.color || SERIES_COLORS[index % SERIES_COLORS.length];
    const axis: "y" | "y1" = series.axis === "right" ? "y1" : "y";
    const label = (typeof series.label === "string" ? series.label.trim() : "") || series.yKey;
    const type: ChartSeriesType = series.type || "bar";

    // Map rows by label
    const rowByLabel = new Map<string, any>();
    rows.forEach((row, idx) => {
      const lbl =
        row && typeof row === "object" && effX
          ? valueToLabel(get(row, effX), idx)
          : String(idx + 1);
      if (!rowByLabel.has(lbl)) {
        rowByLabel.set(lbl, row);
      }
    });

    if (type === "density") {
      const nums = rows
        .map((r) => (r && typeof r === "object" ? get(r, series.yKey) : r))
        .map((v) => valueToNumber(v, NaN))
        .filter((n) => Number.isFinite(n));
      const kdePoints = computeGaussianKDE(nums);
      if (kdePoints.length > 0) {
        hasDensity = true;
        datasets.push({
          type: "line",
          label: `${label} (Density)`,
          data: kdePoints,
          xAxisID: "xDensity",
          yAxisID: "yDensity",
          borderColor: color,
          backgroundColor: hexToRgba(color, 0.25),
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 0,
          order: 0,
        });
      }
      return;
    }

    if (type === "bubble") {
      const bubblePoints = labels
        .map((lbl) => {
          const row = rowByLabel.get(lbl);
          if (!row) return null;
          const yVal = valueToNumber(row && typeof row === "object" ? get(row, series.yKey) : row);
          const rawR = series.rKey
            ? valueToNumber(row && typeof row === "object" ? get(row, series.rKey) : 6, 6)
            : 6;
          const r = Math.max(4, Math.min(24, Math.abs(rawR)));
          return { x: lbl, y: yVal, r };
        })
        .filter(Boolean);

      datasets.push({
        type: "bubble",
        label,
        data: bubblePoints,
        yAxisID: axis,
        backgroundColor: hexToRgba(color, 0.6),
        borderColor: color,
        borderWidth: 1.5,
        order: 0,
      });
      return;
    }

    if (type === "scatter") {
      const scatterPoints = labels.map((lbl) => {
        const row = rowByLabel.get(lbl);
        return row !== undefined
          ? valueToNumber(row && typeof row === "object" ? get(row, series.yKey) : row)
          : null;
      });

      datasets.push({
        type: "line",
        label,
        data: scatterPoints,
        yAxisID: axis,
        showLine: false,
        pointBackgroundColor: color,
        pointBorderColor: "#ffffff",
        pointRadius: 5,
        pointHoverRadius: 7,
        order: 0,
      });
      return;
    }

    if (type === "area") {
      const areaData = labels.map((lbl) => {
        const row = rowByLabel.get(lbl);
        return row !== undefined
          ? valueToNumber(row && typeof row === "object" ? get(row, series.yKey) : row)
          : 0;
      });

      datasets.push({
        type: "line",
        label,
        data: areaData,
        yAxisID: axis,
        backgroundColor: hexToRgba(color, 0.4),
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: color,
        pointRadius: 2,
        tension: 0.3,
        fill: true,
        stack: "stacked_area",
        order: 2,
      });
      return;
    }

    if (type === "line") {
      const lineData = labels.map((lbl) => {
        const row = rowByLabel.get(lbl);
        return row !== undefined
          ? valueToNumber(row && typeof row === "object" ? get(row, series.yKey) : row)
          : null;
      });

      datasets.push({
        type: "line",
        label,
        data: lineData,
        yAxisID: axis,
        backgroundColor: "transparent",
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: color,
        pointRadius: 3,
        tension: 0.3,
        fill: false,
        spanGaps: true,
        order: 0,
      });
      return;
    }

    // Default: bar
    const barData = labels.map((lbl) => {
      const row = rowByLabel.get(lbl);
      return row !== undefined
        ? valueToNumber(row && typeof row === "object" ? get(row, series.yKey) : row)
        : 0;
    });

    datasets.push({
      type: "bar",
      label,
      data: barData,
      yAxisID: axis,
      backgroundColor: hexToRgba(color, 0.75),
      borderColor: color,
      borderWidth: 1,
      borderRadius: 4,
      stack: hasStack ? `bar_${index}` : undefined,
      order: 1,
    });
  });

  return {
    labels,
    datasets,
    hasRightAxis: datasets.some((dataset) => dataset.yAxisID === "y1"),
    hasStack,
    hasDensity,
  };
}

export function buildMixedChartData(
  data: any[],
  xKey: string | undefined,
  chartSeries: ChartSeriesConfig[],
): MixedChartData {
  const multi = buildMultiChartData(data, xKey, chartSeries);
  return {
    labels: multi.labels,
    datasets: multi.datasets,
    hasRightAxis: multi.hasRightAxis,
  };
}
