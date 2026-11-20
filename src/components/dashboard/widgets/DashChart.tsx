import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { DefaultChart } from "solid-chartjs";
import {
  ArcElement,
  BarController,
  BarElement,
  BubbleController,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  ScatterController,
  Title,
  Tooltip,
} from "chart.js";
import get from "lodash.get";
import { buildMultiChartData, effectiveChartType } from "~/lib/dashboard/chartSeries";
import type { ChartSeriesConfig } from "~/lib/dashboard/widgetTypes";
import { getChartThemeColors, subscribeToThemeChanges } from "~/lib/theme";
import { DashTimeline } from "./DashTimeline";
import { inferChartKeys, normalizeDataArray, valueToLabel, valueToNumber } from "./dataHelpers";

if (!isServer) {
  Chart.register(
    BarController,
    LineController,
    PieController,
    DoughnutController,
    ScatterController,
    BubbleController,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    Filler,
    Title
  );
}

// Cached fetch Promises so multiple map widgets mounting simultaneously share a single request
let usTopoPromise: Promise<any> | null = null;
let worldTopoPromise: Promise<any> | null = null;
let geoModPromise: Promise<typeof import("chartjs-chart-geo")> | null = null;

function fetchUsTopoJson(): Promise<any> {
  if (!usTopoPromise) {
    usTopoPromise = fetch("https://cdn.jsdelivr.net/npm/us-atlas/states-10m.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        usTopoPromise = null;
        throw err;
      });
  }
  return usTopoPromise;
}

function fetchWorldTopoJson(): Promise<any> {
  if (!worldTopoPromise) {
    worldTopoPromise = fetch("https://cdn.jsdelivr.net/npm/world-atlas/countries-110m.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        worldTopoPromise = null;
        throw err;
      });
  }
  return worldTopoPromise;
}

function loadChartGeo(): Promise<typeof import("chartjs-chart-geo")> {
  if (!geoModPromise) {
    geoModPromise = import("chartjs-chart-geo")
      .then((mod) => {
        if (!isServer) {
          Chart.register(mod.ChoroplethController, mod.GeoFeature, mod.ColorScale, mod.ProjectionScale);
        }
        return mod;
      })
      .catch((err) => {
        geoModPromise = null;
        throw err;
      });
  }
  return geoModPromise;
}

const STATE_ABBR_MAP: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const PURPLE_PIE_COLORS = ["#a855f7", "#6366f1", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4"];
const BLUE_PIE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4"];

export interface DashChartProps {
  data: any[];
  dataBySource?: Record<string, any[]>;
  xKey?: string;
  yKey?: string;
  chartType?: string;
  chartSeries?: ChartSeriesConfig[];
  height?: string;
  accentColor?: "purple" | "blue";
  emptySeriesHint?: string;
}

export function DashChart(props: DashChartProps) {
  const normalizedData = createMemo(() => normalizeDataArray(props.data));
  const effType = createMemo(() => effectiveChartType(props.chartType, props.chartSeries));
  const isMixedChart = createMemo(
    () => (effType() === "bar" || effType() === "line" || effType() === "multi") && Array.isArray(props.chartSeries)
  );
  const multiData = createMemo(() =>
    isMixedChart()
      ? buildMultiChartData(props.dataBySource || normalizedData(), props.xKey, props.chartSeries || [])
      : null
  );

  const [topoJson, setTopoJson] = createSignal<any>(null);
  const [geoMod, setGeoMod] = createSignal<typeof import("chartjs-chart-geo") | null>(null);
  const [themeRevision, setThemeRevision] = createSignal(0);
  const chartTheme = createMemo(() => {
    themeRevision();
    return getChartThemeColors();
  });

  onMount(() => {
    const unsubscribe = subscribeToThemeChanges(() => setThemeRevision((revision) => revision + 1));
    onCleanup(unsubscribe);
  });

  createEffect(() => {
    if (isServer) return;
    const type = effType();
    if (type !== "choropleth-us" && type !== "choropleth-world") return;

    let active = true;
    onCleanup(() => {
      active = false;
    });

    const topoPromise = type === "choropleth-us" ? fetchUsTopoJson() : fetchWorldTopoJson();
    Promise.all([loadChartGeo(), topoPromise])
      .then(([mod, topo]) => {
        if (!active) return;
        setGeoMod(() => mod);
        setTopoJson(topo);
      })
      .catch(() => {});
  });

  const geoFeatures = createMemo(() => {
    const type = effType();
    if (!type.startsWith("choropleth")) return null;
    const mod = geoMod();
    const topo = topoJson();
    if (!mod || !topo) return null;
    const isUS = type === "choropleth-us";
    const fc = isUS
      ? (mod.topojson.feature(topo, topo.objects.states) as any)
      : (mod.topojson.feature(topo, topo.objects.countries) as any);
    return fc?.features || null;
  });

  const hasChartData = createMemo(() => {
    const m = multiData();
    return normalizedData().length > 0 || (isMixedChart() && Boolean(m && m.datasets.length > 0));
  });

  const buildData = createMemo(() => {
    const data = normalizedData();
    const mixed = isMixedChart();
    const m = multiData();

    if (!Array.isArray(data) || !data.length) {
      if (mixed && m && m.datasets.length > 0) return m;
      return { labels: [], datasets: [] };
    }

    if (mixed && m) return m;

    const type = effType();
    const isPie = type === "pie" || type === "doughnut";
    const isScatter = type === "scatter";
    const isBar = type === "bar";

    if (type.startsWith("choropleth")) {
      const features = geoFeatures();
      if (!features) return { labels: [], datasets: [] };

      const isUS = type === "choropleth-us";
      const inferred = inferChartKeys(data, props.xKey, props.yKey);

      const valueByName = new Map<string, number>();
      for (const item of data) {
        const rawGeo = inferred.xKey ? String(get(item, inferred.xKey) || "").trim() : "";
        if (!rawGeo) continue;
        const numVal = inferred.yKey ? valueToNumber(get(item, inferred.yKey), 0) : valueToNumber(item, 0);
        const lower = rawGeo.toLowerCase();
        if (!valueByName.has(lower)) valueByName.set(lower, numVal);
        if (isUS) {
          const expanded = STATE_ABBR_MAP[rawGeo.toUpperCase()];
          if (expanded) {
            const expandedLower = expanded.toLowerCase();
            if (!valueByName.has(expandedLower)) valueByName.set(expandedLower, numVal);
          }
        }
      }

      const labels: string[] = [];
      const matchedFeatures = features.map((d: any) => {
        const featName = d.properties.name;
        labels.push(featName);
        const matchedVal = valueByName.get(String(featName).toLowerCase());
        return {
          feature: d,
          value: matchedVal !== undefined ? matchedVal : 0,
        };
      });

      return {
        labels,
        datasets: [
          {
            label: inferred.yKey || "Value",
            outline: features,
            data: matchedFeatures,
          },
        ],
      };
    }

    const inferred = inferChartKeys(data, props.xKey, props.yKey);
    const isBlue = props.accentColor === "blue";

    if (isScatter) {
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item && typeof item === "object") {
          points.push({
            x: inferred.xKey ? valueToNumber(get(item, inferred.xKey), i) : i,
            y: inferred.yKey ? valueToNumber(get(item, inferred.yKey), 0) : valueToNumber(item, 0),
          });
        } else {
          points.push({ x: i, y: Number(item) || 0 });
        }
      }
      return {
        labels: [],
        datasets: [
          {
            label: inferred.yKey || "Value",
            data: points,
            backgroundColor: isBlue ? "#3b82f6" : "#a855f7",
            pointRadius: 4,
          },
        ],
      };
    }

    const labels: any[] = [];
    const points: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (item && typeof item === "object") {
        labels.push(inferred.xKey ? valueToLabel(get(item, inferred.xKey), i) : String(i + 1));
        points.push(inferred.yKey ? valueToNumber(get(item, inferred.yKey), 0) : i + 1);
      } else {
        labels.push(String(i + 1));
        points.push(valueToNumber(item, 0));
      }
    }

    if (isPie) {
      const palette = isBlue ? BLUE_PIE_COLORS : PURPLE_PIE_COLORS;
      const bgColors = points.map((_, i) => palette[i % palette.length]);
      return {
        labels,
        datasets: [
          {
            label: inferred.yKey || "Value",
            data: points,
            backgroundColor: bgColors,
            borderWidth: 1,
            borderColor: chartTheme().cutout,
          },
        ],
      };
    }

    return {
      labels,
      datasets: [
        {
          label: inferred.yKey || "Value",
          data: points,
          borderColor: isBar ? "#6366f1" : isBlue ? "#3b82f6" : "#a855f7",
          backgroundColor: isBar
            ? isBlue
              ? "rgba(99,102,241,0.7)"
              : "rgba(99,102,241,0.75)"
            : isBlue
              ? "rgba(59,130,246,0.1)"
              : "rgba(168,85,247,0.1)",
          borderWidth: isBar ? 0 : 2,
          borderRadius: isBar ? 4 : 0,
          pointBackgroundColor: isBlue ? "#3b82f6" : "#a855f7",
          pointRadius: isBar ? 0 : 3,
          tension: 0.3,
          fill: !isBar,
        },
      ],
    };
  });

  const chartOptions = createMemo(() => {
    const type = effType();
    const colors = chartTheme();
    const m = multiData();
    if (isMixedChart() && m) {
      const yScale = {
        grid: { color: colors.grid },
        ticks: { color: colors.axis },
        position: "left" as const,
        stacked: m.hasStack,
      };
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: colors.text } },
          tooltip: {
            backgroundColor: colors.tooltip,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
          },
        },
        scales: {
          x: { grid: { color: colors.grid }, ticks: { color: colors.axis } },
          y: yScale,
          ...(m.hasRightAxis
            ? {
                y1: {
                  axis: "y" as const,
                  position: "right" as const,
                  grid: { drawOnChartArea: false, color: colors.grid },
                  ticks: { color: colors.axis },
                },
              }
            : {}),
          ...(m.hasDensity
            ? {
                xDensity: {
                  type: "linear" as const,
                  position: "top" as const,
                  grid: { drawOnChartArea: false, color: colors.grid },
                  ticks: { color: colors.axis, font: { size: 9 } },
                  title: { display: true, text: "Distribution", color: colors.axis, font: { size: 9 } },
                },
                yDensity: {
                  type: "linear" as const,
                  position: "right" as const,
                  grid: { drawOnChartArea: false },
                  ticks: { display: false },
                },
              }
            : {}),
        },
      };
    }

    if (type.startsWith("choropleth")) {
      const isUS = type === "choropleth-us";
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          projection: {
            axis: "x",
            projection: isUS ? "albersUsa" : "equalEarth",
          },
          color: {
            axis: "x",
            interpolate: (v: number) => {
              const hue = 220 + v * (320 - 220);
              const saturation = 30 + v * (85 - 30);
              const lightness = 25 + v * (65 - 25);
              return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            },
            legend: {
              position: "bottom-right",
              align: "bottom",
            },
          },
        },
      };
    }

    const isPie = type === "pie" || type === "doughnut";
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: colors.text } },
        tooltip: {
          backgroundColor: colors.tooltip,
          titleColor: colors.tooltipText,
          bodyColor: colors.tooltipText,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
        },
      },
      scales: isPie
        ? {}
        : {
            x: { grid: { color: colors.grid }, ticks: { color: colors.axis } },
            y: { grid: { color: colors.grid }, ticks: { color: colors.axis } },
          },
    };
  });

  return (
    <div
      class="bg-[#101015] p-3 rounded border border-[#2a2a3a]/50"
      style={effType() === "timeline" ? "" : `height:${props.height || "250px"}`}
    >
      <Show
        when={effType() === "timeline"}
        fallback={
          <Show when={hasChartData()} fallback={<p class="text-xs text-[#5a5a6e]">No valid array data for chart</p>}>
            <Show
              when={!effType().startsWith("choropleth") || Boolean(geoFeatures())}
              fallback={<p class="text-xs text-[#8b8b9e] animate-pulse">Loading map assets...</p>}
            >
              <Show
                when={!isMixedChart() || Boolean(multiData()?.datasets.length)}
                fallback={
                  <p class="py-8 text-center text-xs text-[#8b8b9e]">
                    {props.emptySeriesHint || "Add a Y field to at least one series to display this chart."}
                  </p>
                }
              >
                <DefaultChart
                  type={
                    isMixedChart()
                      ? "bar"
                      : effType().startsWith("choropleth")
                        ? "choropleth"
                        : (effType() as any)
                  }
                  data={buildData() as any}
                  options={chartOptions() as any}
                />
              </Show>
            </Show>
          </Show>
        }
      >
        <DashTimeline data={props.data} xKey={props.xKey} yKey={props.yKey} height={props.height} />
      </Show>
    </div>
  );
}

export default DashChart;
