import { createSignal, For, Show, onMount, onCleanup, createEffect } from "solid-js";
import { DefaultChart } from "solid-chartjs";
import { Chart, registerables } from "chart.js";
import * as ChartGeo from "chartjs-chart-geo";
import get from "lodash.get";

Chart.register(...registerables);
if (typeof window !== "undefined") {
  Chart.register(
    ChartGeo.ChoroplethController,
    ChartGeo.GeoFeature,
    ChartGeo.ColorScale,
    ChartGeo.ProjectionScale
  );
}

import { evaluateNewsRules, newsColorClasses } from "~/lib/newsRulesEvaluator";
import { buildMixedChartData } from "~/lib/dashboard/chartSeries";
import type { ChartSeriesConfig } from "~/lib/dashboard/widgetTypes";
import DashboardGrid from "~/components/dashboard/DashboardGrid";
import { DashboardPublicButtonFormWidget } from "~/components/dashboard/DashboardPublicWidget";
import { useWidgetOutcome } from "~/components/dashboard/useWidgetOutcome";
import { applyWidgetConditions } from "~/lib/dashboard/widgetConditions";
import { getChartThemeColors, subscribeToThemeChanges } from "~/lib/theme";

function NewsWidgetComponent(props: { btn: any; dashboardId?: string }) {
  const [data, setData] = createSignal<any>("No Data");
  const [status, setStatus] = createSignal<"idle" | "loading" | "live" | "error">("idle");

  const evalResult = () => evaluateNewsRules(data(), props.btn.newsRules || []);
  const theme = () => newsColorClasses[evalResult().color] || newsColorClasses.blue;

  onMount(() => {
    if (!props.btn.workflowId) return;
    const wfId = (props.btn.workflowId.includes(":") ? props.btn.workflowId.split(":")[1] : props.btn.workflowId).replace(/[⟨⟩]/g, "");

    if (props.btn.streamActive !== false) {
      setStatus("live");
      const es = new EventSource(`/api/workflows/${wfId}/stream`);

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.data?.chunk || payload.data?.response) {
            let chunk = payload.data.chunk || payload.data.response;
            if (props.btn.dataPath) {
              chunk = get(chunk, props.btn.dataPath, chunk);
            }
            if (chunk !== undefined) setData(chunk);
          }
        } catch {}
      };

      es.addEventListener("step_chunk", (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          let chunk = payload.data?.chunk;
          if (props.btn.dataPath && chunk) {
            chunk = get(chunk, props.btn.dataPath, chunk);
          }
          if (chunk !== undefined) setData(chunk);
        } catch {}
      });

      es.addEventListener("step_complete", (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          let resData = payload.data?.response;
          if (props.btn.dataPath && resData) {
            resData = get(resData, props.btn.dataPath, resData);
          }
          if (resData !== undefined) setData(resData);
        } catch {}
      });

      es.onerror = () => { setStatus("idle"); };
      onCleanup(() => es.close());
    }
  });

  const fetchManual = async () => {
    if (!props.btn.workflowId) return;
    const wfId = (props.btn.workflowId.includes(":") ? props.btn.workflowId.split(":")[1] : props.btn.workflowId).replace(/[⟨⟩]/g, "");
    setStatus("loading");
    try {
      const res = await fetch(`/api/workflows/${wfId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: {} }),
      });
      const json = await res.json();
      if (json.success) setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div class={`w-full rounded-2xl border p-5 shadow-xl transition-all duration-300 ${theme().bg} ${theme().border}`}>
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">📰</span>
          <h3 class="text-sm font-bold text-white tracking-wide">{props.btn.label || "News Alert"}</h3>
        </div>
        <div class="flex items-center gap-2">
          <Show when={props.btn.streamActive !== false}>
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-500/20 text-purple-300 border-purple-500/30">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
              STREAM LIVE
            </span>
          </Show>
          <button onClick={fetchManual} class="text-[10px] text-slate-400 hover:text-white transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      <div class="mt-2">
        <div class={`text-lg font-extrabold tracking-tight ${theme().text}`}>
          {evalResult().text}
        </div>
      </div>
    </div>
  );
}

function ToggleWidgetComponent(props: { btn: any; dashboardId?: string; formState: any; updateForm: any; triggerButton: any }) {
  const [checked, setChecked] = createSignal(props.btn.defaultChecked || false);
  const [isFlipping, setIsFlipping] = createSignal(false);

  const varName = () => props.btn.formVarName || "toggle_state";
  const onTxt = () => props.btn.onLabel || "ON";
  const offTxt = () => props.btn.offLabel || "OFF";

  const handleToggle = async () => {
    const nextVal = !checked();
    setChecked(nextVal);
    setIsFlipping(true);

    props.updateForm(props.btn.id, varName(), nextVal);
    props.updateForm(props.btn.id, "toggle", nextVal ? "ON" : "OFF");

    await props.triggerButton(props.btn);
    setIsFlipping(false);
  };

  return (
    <div class="w-full rounded-2xl border border-[#2a2a3a] bg-[#12121a] p-4 shadow-xl flex items-center justify-between">
      <div>
        <h4 class="text-sm font-bold text-white mb-0.5">{props.btn.label || "Toggle Switch"}</h4>
        <span class="text-xs text-[#8b8b9e]">
          State: <strong class={checked() ? "text-emerald-400" : "text-slate-400"}>{checked() ? onTxt() : offTxt()}</strong>
        </span>
      </div>

      <button
        onClick={handleToggle}
        disabled={isFlipping()}
        class={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
          checked() ? "bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/30" : "bg-[#2a2a3a]"
        }`}
      >
        <span
          class={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${
            checked() ? "translate-x-8" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function lastStep(workflow: any) {
  const steps: any[] = workflow?.steps || [];
  return steps.length ? steps[steps.length - 1] : null;
}

export function lastStepType(workflow: any): "grpc" | "table" | "chart" {
  return (lastStep(workflow)?.type as any) || "grpc";
}


function valueToLabel(value: any, fallback: number) {
  if (value === undefined || value === null || value === "") return String(fallback + 1);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function valueToNumber(value: any, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseJsonString(value: any) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeDataArray(value: any): any[] {
  let data = parseJsonString(value);

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const arrayKey = Object.keys(data).find((key) => Array.isArray(data[key]));
    if (arrayKey) data = data[arrayKey];
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

function collectObjectKeys(data: any[]) {
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

  for (const row of data) {
    addKeys(row);
  }
  return [...keys];
}

function pickKey(keys: string[], preferred: string[]) {
  const normalized = new Map(keys.map((key) => [key.toLowerCase(), key]));
  for (const key of preferred) {
    const match = normalized.get(key.toLowerCase());
    if (match) return match;
  }
  return "";
}

function inferChartKeys(data: any[], explicitX?: string, explicitY?: string) {
  const keys = collectObjectKeys(data);
  const xKey = explicitX || pickKey(keys, ["x", "step", "label", "name", "title", "date", "time", "id"]);
  let yKey = explicitY || pickKey(keys, ["y", "value", "metrics.value", "metrics.delta", "count", "total", "amount", "score", "completed"]);

  if (!yKey) {
    yKey = keys.find((key) => key !== xKey && data.some((row) => {
      const value = row && typeof row === "object" ? get(row, key) : undefined;
      return typeof value === "number" || typeof value === "boolean" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
    })) || "";
  }

  return { xKey, yKey };
}

// ─── Mini table component ─────────────────────────────────────────────────────

function DashTable(props: { data: any[]; columns?: string[] }) {
  const rows = () => normalizeDataArray(props.data);
  const effectiveCols = () => {
    const explicit = (props.columns || []).filter(Boolean);
    if (explicit.length) return explicit;
    const keys = collectObjectKeys(rows());
    return keys.length ? keys : ["value"];
  };

  const cellValue = (row: any, key: string) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return key === "value" ? row : undefined;
    return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : get(row, key);
  };

  const formatCell = (value: any) => {
    if (value === undefined || value === null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  };

  return (
    <div class="overflow-auto max-h-[400px] rounded-xl border border-[#2a2a3a]/60 bg-[#0a0a0f]">
      <Show when={rows().length > 0} fallback={<div class="p-4 text-xs text-[#5a5a6e]">No table data</div>}>
        <table class="w-full text-left text-xs text-[#c8c8d8]">
          <thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0">
            <tr>
              <For each={effectiveCols()}>
                {(col) => (
                  <th class="px-4 py-2.5 font-semibold border-b border-[#2a2a3e] whitespace-nowrap uppercase text-[10px] tracking-wider">
                    {col}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#1e1e2e]">
            <For each={rows()}>
              {(row) => (
              <tr>
                  <For each={effectiveCols()}>
                    {(col) => {
                      const text = formatCell(cellValue(row, col));
                      return <td class="px-4 py-2 border-b border-[#1e1e2e]/50 max-w-[200px] truncate" title={text}>{text}</td>;
                    }}
                  </For>
              </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}

// ─── Mini chart component ─────────────────────────────────────────────────────

let globalUsTopoJson: any = null;
let globalWorldTopoJson: any = null;

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
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"
};

function DashChart(props: { data: any[]; xKey?: string; yKey?: string; chartType?: string; chartSeries?: ChartSeriesConfig[] }) {
  const cType = () => props.chartType || "bar";
  const isMixedChart = () => (cType() === "bar" || cType() === "line") && Array.isArray(props.chartSeries);
  const mixedData = () => buildMixedChartData(normalizeDataArray(props.data), props.xKey, props.chartSeries || []);
  const [topoJson, setTopoJson] = createSignal<any>(null);
  const [themeRevision, setThemeRevision] = createSignal(0);
  const chartTheme = () => {
    themeRevision();
    return getChartThemeColors();
  };

  onMount(() => {
    const unsubscribe = subscribeToThemeChanges(() => setThemeRevision((revision) => revision + 1));
    onCleanup(unsubscribe);
  });

  createEffect(() => {
    const type = cType();
    if (type === "choropleth-us") {
      if (globalUsTopoJson) {
        setTopoJson(globalUsTopoJson);
      } else {
        fetch("https://cdn.jsdelivr.net/npm/us-atlas/states-10m.json")
          .then((res) => res.json())
          .then((data) => {
            globalUsTopoJson = data;
            setTopoJson(data);
          });
      }
    } else if (type === "choropleth-world") {
      if (globalWorldTopoJson) {
        setTopoJson(globalWorldTopoJson);
      } else {
        fetch("https://cdn.jsdelivr.net/npm/world-atlas/countries-110m.json")
          .then((res) => res.json())
          .then((data) => {
            globalWorldTopoJson = data;
            setTopoJson(data);
          });
      }
    }
  });

  const buildData = () => {
    const data = normalizeDataArray(props.data);
    if (!Array.isArray(data) || !data.length) return { labels: [], datasets: [] };

    if (isMixedChart()) return mixedData();
    
    const type = cType();
    const isPie = type === "pie" || type === "doughnut";
    const isScatter = type === "scatter";
    const isBar = type === "bar";

    if (type.startsWith("choropleth")) {
      const isUS = type === "choropleth-us";
      const topo = topoJson();
      if (!topo) return { labels: [], datasets: [] };

      const features = isUS
        ? (ChartGeo.topojson.feature(topo, topo.objects.states) as any).features
        : (ChartGeo.topojson.feature(topo, topo.objects.countries) as any).features;

      const inferred = inferChartKeys(data, props.xKey, props.yKey);

      const items = data.map((item, i) => {
        const geoVal = inferred.xKey ? String(get(item, inferred.xKey) || "").trim() : "";
        const numVal = inferred.yKey ? valueToNumber(get(item, inferred.yKey), 0) : valueToNumber(item, 0);
        return { geoVal, numVal };
      });

      const matchedFeatures = features.map((d: any) => {
        const featName = d.properties.name;
        const matched = items.find(item => {
          const name = item.geoVal;
          if (name.toLowerCase() === featName.toLowerCase()) return true;
          if (isUS) {
            const mappedName = STATE_ABBR_MAP[name.toUpperCase()];
            if (mappedName && mappedName.toLowerCase() === featName.toLowerCase()) return true;
          }
          return false;
        });
        return {
          feature: d,
          value: matched ? matched.numVal : 0
        };
      });

      return {
        labels: features.map((d: any) => d.properties.name),
        datasets: [{
          label: inferred.yKey || "Value",
          outline: features,
          data: matchedFeatures,
        }]
      };
    }

    const inferred = inferChartKeys(data, props.xKey, props.yKey);

    if (isScatter) {
      const points: {x: number, y: number}[] = [];
      data.forEach((item, i) => {
        if (item && typeof item === "object") {
           points.push({
             x: inferred.xKey ? valueToNumber(get(item, inferred.xKey), i) : i,
             y: inferred.yKey ? valueToNumber(get(item, inferred.yKey), 0) : valueToNumber(item, 0)
           });
        } else {
           points.push({ x: i, y: Number(item) || 0 });
        }
      });
      return {
        labels: [],
        datasets: [{
          label: inferred.yKey || "Value",
          data: points,
          backgroundColor: "#a855f7",
          pointRadius: 4,
        }]
      };
    }

    const labels: any[] = [];
    const points: number[] = [];
    data.forEach((item, i) => {
      if (item && typeof item === "object") {
        labels.push(inferred.xKey ? valueToLabel(get(item, inferred.xKey), i) : String(i + 1));
        points.push(inferred.yKey ? valueToNumber(get(item, inferred.yKey), 0) : i + 1);
      } else {
        labels.push(String(i + 1));
        points.push(valueToNumber(item, 0));
      }
    });

    if (isPie) {
      const colors = ["#a855f7", "#6366f1", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4"];
      const bgColors = points.map((_, i) => colors[i % colors.length]);
      return {
        labels,
        datasets: [{
          label: inferred.yKey || "Value",
          data: points,
          backgroundColor: bgColors,
          borderWidth: 1,
          borderColor: chartTheme().cutout
        }]
      };
    }

    return {
      labels,
      datasets: [{
        label: inferred.yKey || "Value",
        data: points,
        borderColor: isBar ? "#6366f1" : "#a855f7",
        backgroundColor: isBar ? "rgba(99,102,241,0.75)" : "rgba(168,85,247,0.1)",
        borderWidth: isBar ? 0 : 2,
        borderRadius: isBar ? 4 : 0,
        pointBackgroundColor: "#a855f7",
        pointRadius: isBar ? 0 : 3,
        tension: 0.3,
        fill: !isBar,
      }],
    };
  };

  const chartOptions = () => {
    const type = cType();
    const colors = chartTheme();
    if (isMixedChart()) {
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
          y: {
            position: "left" as const,
            grid: { color: colors.grid },
            ticks: { color: colors.axis },
          },
          ...(mixedData().hasRightAxis ? {
            y1: {
              axis: "y" as const,
              position: "right" as const,
              grid: { drawOnChartArea: false, color: colors.grid },
              ticks: { color: colors.axis },
            },
          } : {}),
        },
      };
    }
    if (type.startsWith("choropleth")) {
      const isUS = type === "choropleth-us";
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          projection: {
            axis: "x",
            projection: isUS ? "albersUsa" : "equalEarth"
          },
          color: {
            axis: "x",
            interpolate: (v: number) => {
              const hue = 220 + v * (320 - 220); // 220 (blue) to 320 (pink/purple)
              const saturation = 30 + v * (85 - 30);
              const lightness = 25 + v * (65 - 25);
              return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            },
            legend: {
              position: "bottom-right",
              align: "bottom"
            }
          }
        }
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
      scales: isPie ? {} : {
        x: { grid: { color: colors.grid }, ticks: { color: colors.axis } },
        y: { grid: { color: colors.grid }, ticks: { color: colors.axis } },
      },
    };
  };

  return (
    <div class="h-[250px] bg-[#101015] p-3 rounded border border-[#2a2a3a]/50">
      <Show when={normalizeDataArray(props.data).length > 0} fallback={<p class="text-xs text-[#5a5a6e]">No valid array data for chart</p>}>
        <Show when={!cType().startsWith("choropleth") || topoJson()} fallback={<p class="text-xs text-[#8b8b9e] animate-pulse">Loading map assets...</p>}>
          <Show when={!isMixedChart() || mixedData().datasets.length > 0} fallback={<p class="py-8 text-center text-xs text-[#8b8b9e]">Add a Y field to at least one series to display this chart.</p>}>
            {/* @ts-ignore */}
            <DefaultChart type={isMixedChart() ? "bar" : cType().startsWith("choropleth") ? "choropleth" : (cType() as any)} data={buildData()} options={chartOptions()} />
          </Show>
        </Show>
      </Show>
    </div>
  );
}

// ─── Poll a run until complete ────────────────────────────────────────────────

async function pollRun(runId: string, onDone: (logs: any[]) => void, onError: (msg: string) => void) {
  const rawId = (runId.includes(":") ? runId.split(":")[1] : runId).replace(/[⟨⟩]/g, "");
  let attempts = 0;
  const interval = setInterval(async () => {
    attempts++;
    if (attempts > 60) {
      clearInterval(interval);
      onError("Timed out waiting for workflow result.");
      return;
    }
    try {
      const res = await fetch(`/api/workflows/runs/${rawId}`);
      const json = await res.json();
      if (json.success) {
        const run = json.data;
        if (run.status === "completed" || run.status === "failed") {
          clearInterval(interval);
          if (run.status === "failed") {
            onError("Workflow failed.");
          } else {
            onDone(run.logs || []);
          }
        }
      }
    } catch {
      // keep polling
    }
  }, 1500);
}

// Extract the data payload + meta from the last successful table/chart log
function extractLastStep(logs: any[]): { data: any[]; meta: any } {
  if (!logs.length) return { data: [], meta: {} };
  const last = [...logs].reverse().find(l => l.status === "success" && (l.stepType === "table" || l.stepType === "chart"));
  if (!last) {
    // fallback: last successful step
    const fallback = [...logs].reverse().find(l => l.status === "success");
    if (!fallback) return { data: [], meta: {} };
    const raw = fallback.response;
    return { data: Array.isArray(raw) ? raw : (raw ? [raw] : []), meta: fallback.meta || {} };
  }
  const raw = last.response;
  return { data: Array.isArray(raw) ? raw : (raw ? [raw] : []), meta: last.meta || {} };
}

// ─── Auto-loading widget (table or chart) ─────────────────────────────────────

function AutoWidget(props: { dashboardId: string; btn: any; workflow: any }) {
  const kind = props.btn.widgetType || lastStepType(props.workflow);
  const lastS = lastStep(props.workflow);

  const [status, setStatus] = createSignal<"loading" | "ready" | "error">("loading");
  const [tableData, setTableData] = createSignal<any[]>([]);
  const [stepMeta, setStepMeta] = createSignal<any>({});
  const [errorMsg, setErrorMsg] = createSignal("");

  onMount(async () => {
    try {
      const res = await fetch(`/api/dashboards/${props.dashboardId}/trigger/${props.btn.id}`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Trigger failed");

      await pollRun(
        json.runId,
        (logs) => {
          const { data, meta } = extractLastStep(logs);
          setTableData(data);
          setStepMeta(meta);
          setStatus("ready");
        },
        (msg) => {
          setErrorMsg(msg);
          setStatus("error");
        }
      );
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  });

  return (
    <div class="w-full">
      {/* Header */}
      <div class={`flex items-center justify-between mb-3 pb-2 border-b ${kind === "table" ? "border-emerald-500/20" : "border-purple-500/20"}`}>
        <h3 class={`text-sm font-bold ${kind === "table" ? "text-emerald-400" : "text-purple-400"}`}>
          {kind === "table" ? "📊" : "📈"} {props.btn.label}
        </h3>
        <Show when={status() === "loading"}>
          <svg class="animate-spin h-4 w-4 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </Show>
      </div>

      <Show when={status() === "loading"}>
        <div class="space-y-2">
          <div class="h-6 rounded bg-[#1e1e2e] animate-pulse"></div>
          <div class="h-6 rounded bg-[#1e1e2e] animate-pulse w-4/5"></div>
          <div class="h-6 rounded bg-[#1e1e2e] animate-pulse w-3/5"></div>
        </div>
      </Show>

      <Show when={status() === "error"}>
        <div class="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          ✗ {errorMsg()}
        </div>
      </Show>

      <Show when={status() === "ready"}>
        <Show when={kind === "table"}>
          <DashTable data={tableData()} columns={props.btn.columns ? props.btn.columns.split(",").map((c: string) => c.trim()).filter(Boolean) : stepMeta().columns} />
        </Show>
        <Show when={kind === "chart"}>
          <DashChart
            data={tableData()}
            xKey={props.btn.xKey || stepMeta().xKey || lastS?.xKey}
            yKey={props.btn.yKey || stepMeta().yKey || lastS?.yKey}
            chartType={props.btn.chartType || stepMeta().chartType || (lastS as any)?.chartType || "bar"}
            chartSeries={props.btn.chartSeries}
          />
        </Show>
      </Show>
    </div>
  );
}

// ─── Conditional Widget Wrapper ──────────────────────────────────────────────

function ConditionalWidgetWrapper(props: { btn: any; dashboardId?: string; children: any }) {
  const hasRules = () => (props.btn?.conditionRules || []).length > 0;
  const outcome = useWidgetOutcome(props.dashboardId, props.btn);
  const effective = () => (hasRules() ? applyWidgetConditions(props.btn, outcome().data) : { hidden: false });

  return (
    <Show when={!effective().hidden}>
      {props.children}
    </Show>
  );
}

// ─── Infographic Widget (AntV @antv/infographic) ──────────────────────────────

function InfographicWidget(props: { syntax?: string; data?: any; editable?: boolean; height?: string }) {
  let containerRef!: HTMLDivElement;
  let instance: any = null;

  const getSyntax = () => {
    if (props.syntax) return props.syntax;
    if (typeof props.data === "string") return props.data;
    return "";
  };

  onMount(async () => {
    try {
      const mod = await import("@antv/infographic");
      const Infographic = mod.Infographic || (mod as any).default;
      instance = new Infographic({
        container: containerRef,
        width: "100%",
        height: props.height || "400px",
        editable: props.editable || false,
      });
      const syntax = getSyntax();
      if (syntax) instance.render(syntax);
    } catch (e) {
      console.error("[InfographicWidget] Failed to load @antv/infographic:", e);
      if (containerRef) {
        containerRef.innerHTML = `<div style="padding:16px;color:#f87171;font-size:12px;border:1px solid rgba(248,113,113,0.2);border-radius:8px;background:rgba(248,113,113,0.05)">Failed to load infographic engine: ${String(e)}</div>`;
      }
    }
  });

  createEffect(() => {
    const syntax = getSyntax();
    if (instance && syntax) {
      try {
        instance.render(syntax);
      } catch (e) {
        console.error("[InfographicWidget] Render error:", e);
      }
    }
  });

  return (
    <div class="w-full rounded-xl border border-[#2a2a3a] bg-[#0d0f17] overflow-hidden" style={`min-height:${props.height || "300px"}`}>
      <div ref={containerRef} style="width:100%;min-height:inherit" />
    </div>
  );
}


// ─── Shared public dashboard view (used by /p/[id] and the /library preview) ──

/** Fetches every workflow referenced by the given buttons, keyed by the raw workflowId. */
export async function loadWorkflowMap(buttons: any[]): Promise<Record<string, any>> {
  const ids: string[] = [...new Set((buttons || []).map((b: any) => b.workflowId).filter(Boolean))] as string[];
  const entries = await Promise.all(
    ids.map(async (wid) => {
      const rawId = (wid.includes(":") ? wid.split(":")[1] : wid).replace(/[⟨⟩]/g, "");
      try {
        const r = await fetch(`/api/workflows/${rawId}`);
        const j = await r.json();
        return j.success ? [wid, j.data] : null;
      } catch {
        return null;
      }
    })
  );
  const map: Record<string, any> = {};
  entries.filter(Boolean).forEach(([id, wf]: any) => { map[id] = wf; });
  return map;
}

export interface PublicDashboardViewProps {
  /** Dashboard id without the "dashboard:" prefix. */
  dashboardId: string;
  buttons: any[];
  workflowMap: Record<string, any>;
  /** Preview mode: buttons, forms and toggles are shown but cannot trigger workflows. */
  readOnly?: boolean;
}

export default function PublicDashboardView(props: PublicDashboardViewProps) {
  const [executing, setExecuting] = createSignal<Record<string, "idle" | "running" | "success" | "error">>({});
  const [formState, setFormState] = createSignal<Record<string, Record<string, any>>>({});

  const updateForm = (btnId: string, field: string, value: any) => {
    setFormState(prev => ({
      ...prev,
      [btnId]: {
        ...(prev[btnId] || {}),
        [field]: value
      }
    }));
  };

  const triggerButton = async (btn: any, effectiveWorkflowId?: string) => {
    if (props.readOnly) return;
    if (executing()[btn.id] === "running") return;
    setExecuting(prev => ({ ...prev, [btn.id]: "running" }));
    try {
      const currentForm = formState()[btn.id] || {};
      const mergedForm: Record<string, any> = { ...currentForm };
      (btn.formConfig || []).forEach((f: any) => {
        if (f.name && (mergedForm[f.name] === undefined || mergedForm[f.name] === "")) {
          const savedVal = f.value ?? f.defaultValue;
          if (savedVal !== undefined && savedVal !== "") {
            mergedForm[f.name] = savedVal;
          }
        }
      });
      const payload: Record<string, any> = { form: mergedForm };
      if (effectiveWorkflowId) payload.workflowId = effectiveWorkflowId;

      const res = await fetch(`/api/dashboards/${props.dashboardId}/trigger/${btn.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setExecuting(prev => ({ ...prev, [btn.id]: "success" }));
        setTimeout(() => setExecuting(prev => ({ ...prev, [btn.id]: "idle" })), 2500);
      } else {
        alert("Action failed: " + json.error);
        setExecuting(prev => ({ ...prev, [btn.id]: "error" }));
        setTimeout(() => setExecuting(prev => ({ ...prev, [btn.id]: "idle" })), 2500);
      }
    } catch (e: any) {
      alert("Network or Server error: " + e.message);
      setExecuting(prev => ({ ...prev, [btn.id]: "error" }));
      setTimeout(() => setExecuting(prev => ({ ...prev, [btn.id]: "idle" })), 2500);
    }
  };

  /** In read-only mode interactive widgets are rendered inert with a hint. */
  const InteractiveShell = (p: { children: any }) => (
    <Show when={props.readOnly} fallback={p.children}>
      <div class="relative">
        <div class="pointer-events-none select-none opacity-60" aria-disabled="true">{p.children}</div>
        <div class="mt-1 text-[10px] text-[#5b5b6e] text-center">View only — open the public view to interact</div>
      </div>
    </Show>
  );

  return (
    <DashboardGrid
      buttons={props.buttons || []}
      isStatic={true}
      dashboardId={props.dashboardId}
      renderWidget={(btn) => {
        const wf = () => props.workflowMap[btn.workflowId];
        const kind = () => btn.widgetType || (wf() ? lastStepType(wf()) : "button");

        return (
          <Show when={kind() === "chart" || kind() === "table" || kind() === "infographic"} fallback={
            (() => {
              if (kind() === "news") {
                return (
                  <ConditionalWidgetWrapper btn={btn} dashboardId={props.dashboardId}>
                    <NewsWidgetComponent btn={btn} dashboardId={props.dashboardId} />
                  </ConditionalWidgetWrapper>
                );
              }
              if (kind() === "toggle") {
                return (
                  <ConditionalWidgetWrapper btn={btn} dashboardId={props.dashboardId}>
                    <InteractiveShell>
                      <ToggleWidgetComponent btn={btn} dashboardId={props.dashboardId} formState={formState()} updateForm={updateForm} triggerButton={triggerButton} />
                    </InteractiveShell>
                  </ConditionalWidgetWrapper>
                );
              }

              return (
                <InteractiveShell>
                  <DashboardPublicButtonFormWidget
                    btn={btn}
                    dashboardId={props.dashboardId}
                    executing={executing()}
                    formState={formState()}
                    updateForm={updateForm}
                    triggerButton={triggerButton}
                  />
                </InteractiveShell>
              );
            })()
          }>
            {/* ── Table / Chart / Infographic widget ── */}
            <ConditionalWidgetWrapper btn={btn} dashboardId={props.dashboardId}>
              <Show when={kind() === "infographic"} fallback={
                <div class={`rounded-2xl border p-5 shadow-xl ${kind() === "table" ? "border-emerald-500/20 bg-[#0a120d]" : "border-purple-500/20 bg-[#100a14]"}`}>
                  <Show when={wf()} fallback={
                    <div class="text-[#5b5b6e] text-sm italic">Loading workflow info...</div>
                  }>
                    <AutoWidget dashboardId={props.dashboardId} btn={btn} workflow={wf()} />
                  </Show>
                </div>
              }>
                <InfographicWidget syntax={btn.infographicSyntax} editable={btn.infographicEditable} />
              </Show>
            </ConditionalWidgetWrapper>
          </Show>
        );
      }}
    />
  );
}
