import { ssr, ssrHydrationKey, escape, createComponent, ssrAttribute, ssrStyle } from "solid-js/web";
import { createSignal, onMount, createEffect, Show, For } from "solid-js";
import { D as DefaultChart } from "./index-D4uTJpLk.js";
import { Chart, registerables } from "chart.js";
import * as ChartGeo from "chartjs-chart-geo";
import get from "lodash.get";
import { n as newsColorClasses, e as evaluateNewsRules } from "./newsRulesEvaluator-Br54GSU2.js";
import { u as useParams } from "../../entry-server.js";
import "solid-js/store";
import "pathe";
import "radix3";
import "seroval";
import "seroval-plugins/web";
import "h3";
import "solid-js/web/storage";
import "cookie-es";
var _tmpl$ = ["<span", ' class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-500/20 text-purple-300 border-purple-500/30"><span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>STREAM LIVE</span>'], _tmpl$2 = ["<div", ' class="', '"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><span class="text-xl">📰</span><h3 class="text-sm font-bold text-white tracking-wide">', '</h3></div><div class="flex items-center gap-2"><!--$-->', '<!--/--><button class="text-[10px] text-slate-400 hover:text-white transition-colors">↻ Refresh</button></div></div><div class="mt-2"><div class="', '">', "</div></div></div>"], _tmpl$3 = ["<div", ' class="w-full rounded-2xl border border-[#2a2a3a] bg-[#12121a] p-4 shadow-xl flex items-center justify-between"><div><h4 class="text-sm font-bold text-white mb-0.5">', '</h4><span class="text-xs text-[#8b8b9e]">State: <strong', ">", "</strong></span></div><button", ' class="', '"><span class="', '"></span></button></div>'], _tmpl$4 = ["<table", ' class="w-full text-left text-xs text-[#c8c8d8]"><thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0"><tr>', '</tr></thead><tbody class="divide-y divide-[#1e1e2e]">', "</tbody></table>"], _tmpl$5 = ["<div", ' class="overflow-auto max-h-[400px] rounded-xl border border-[#2a2a3a]/60 bg-[#0a0a0f]">', "</div>"], _tmpl$6 = ["<div", ' class="p-4 text-xs text-[#5a5a6e]">No table data</div>'], _tmpl$7 = ["<th", ' class="px-4 py-2.5 font-semibold border-b border-[#2a2a3e] whitespace-nowrap uppercase text-[10px] tracking-wider">', "</th>"], _tmpl$8 = ["<tr", ">", "</tr>"], _tmpl$9 = ["<td", ' class="px-4 py-2 border-b border-[#1e1e2e]/50 max-w-[200px] truncate"', ">", "</td>"], _tmpl$0 = ["<div", ' class="h-[250px] bg-[#101015] p-3 rounded border border-[#2a2a3a]/50">', "</div>"], _tmpl$1 = ["<p", ' class="text-xs text-[#5a5a6e]">No valid array data for chart</p>'], _tmpl$10 = ["<p", ' class="text-xs text-[#8b8b9e] animate-pulse">Loading map assets...</p>'], _tmpl$11 = ["<svg", ' class="animate-spin h-4 w-4 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$12 = ["<div", ' class="space-y-2"><div class="h-6 rounded bg-[#1e1e2e] animate-pulse"></div><div class="h-6 rounded bg-[#1e1e2e] animate-pulse w-4/5"></div><div class="h-6 rounded bg-[#1e1e2e] animate-pulse w-3/5"></div></div>'], _tmpl$13 = ["<div", ' class="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">✗ <!--$-->', "<!--/--></div>"], _tmpl$14 = ["<div", ' class="w-full"><div class="', '"><h3 class="', '"><!--$-->', "<!--/--> <!--$-->", "<!--/--></h3><!--$-->", "<!--/--></div><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$15 = ["<div", ' class="text-center mt-32"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto mb-4 text-[#8b8b9e]"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><h1 class="text-2xl font-bold text-white mb-2">Not Found</h1><p class="text-[#8b8b9e]">This dashboard does not exist or is not public.</p></div>'], _tmpl$16 = ["<div", ' class="flex items-center justify-center min-h-screen"><svg class="animate-spin h-8 w-8 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>'], _tmpl$17 = ["<div", ' class="text-center py-16 text-[#5b5b6e] text-sm italic">No actions available right now.</div>'], _tmpl$18 = ["<div", ' class="max-w-4xl mx-auto"><div class="relative pt-12 pb-8 text-center mb-10"><div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div><h1 class="text-4xl font-extrabold tracking-tight text-white mb-2">', '</h1><p class="text-[12px] font-bold tracking-widest text-[#5b5b6e] uppercase">Internal Operations</p></div><div class="space-y-6"><!--$-->', "<!--/--><!--$-->", '<!--/--></div><div class="mt-12 text-center text-[10px] text-[#5b5b6e]">Powered by <span class="font-bold font-mono text-purple-400/80">solid.grpcfront</span></div></div>'], _tmpl$19 = ["<main", ' class="min-h-screen bg-[#050508] p-6 lg:p-16 font-sans"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></main>"], _tmpl$20 = ["<svg", ' width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'], _tmpl$21 = ["<span", ">Execute <!--$-->", "<!--/--></span>"], _tmpl$22 = ["<svg", ' class="animate-spin h-4 w-4 text-purple-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$23 = ["<span", ">Running...</span>"], _tmpl$24 = ["<svg", ' class="animate-bounce h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>'], _tmpl$25 = ["<span", ">Success!</span>"], _tmpl$26 = ["<svg", ' class="animate-pulse h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'], _tmpl$27 = ["<span", ">Failed</span>"], _tmpl$28 = ["<div", ' class="rounded-2xl border border-[#2a2a3a] bg-[#0e0e15] p-5 shadow-xl space-y-4 text-left"><div class="flex items-center gap-2 pb-2 border-b border-[#2a2a3a]"><span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span><h3 class="text-sm font-bold text-white">', '</h3></div><div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">', '</div><div class="pt-2"><button', "><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></button></div></div>"], _tmpl$29 = ["<svg", ' width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'], _tmpl$30 = ["<span", ">", "</span>"], _tmpl$31 = ["<svg", ' class="animate-spin h-5 w-5 text-purple-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$32 = ["<span", ">Executing...</span>"], _tmpl$33 = ["<svg", ' class="animate-bounce h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>'], _tmpl$34 = ["<svg", ' class="animate-pulse h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'], _tmpl$35 = ["<button", "", "><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></button>"], _tmpl$36 = ["<label", ' class="flex items-center gap-3 cursor-pointer py-1.5"><input type="checkbox" class="w-4 h-4 rounded border-[#2a2a3a] bg-[#1e1e2e] text-purple-500 focus:ring-purple-500/50"', '><span class="text-sm text-white">Enable</span></label>'], _tmpl$37 = ["<select", ' class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"', "><option value disabled>Select an option...</option><!--$-->", "<!--/--></select>"], _tmpl$38 = ["<textarea", ' rows="3"', ' class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all font-mono"', ' placeholder="', '"></textarea>'], _tmpl$39 = ["<input", "", ' class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"', ' placeholder="', '">'], _tmpl$40 = ["<div", ' class="col-span-1"><label class="block text-xs font-bold text-[#8b8b9e] mb-1.5">', "</label><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$41 = ["<option", ">", "</option>"], _tmpl$42 = ["<div", ' class="', '">', "</div>"], _tmpl$43 = ["<div", ' class="text-[#5b5b6e] text-sm italic">Loading workflow info...</div>'], _tmpl$44 = ["<div", ' class="w-full rounded-xl border border-[#2a2a3a] bg-[#0d0f17] overflow-hidden" style="', '"><div style="width:100%;min-height:inherit"></div></div>'];
const id$$ = "src/routes/p/[id].tsx?pick=default&pick=$css";
Chart.register(...registerables);
if (typeof window !== "undefined") {
  Chart.register(ChartGeo.ChoroplethController, ChartGeo.GeoFeature, ChartGeo.ColorScale, ChartGeo.ProjectionScale);
}
function NewsWidgetComponent(props) {
  const [data, setData] = createSignal("No Data");
  const [status, setStatus] = createSignal("idle");
  const evalResult = () => evaluateNewsRules(data(), props.btn.newsRules || []);
  const theme = () => newsColorClasses[evalResult().color] || newsColorClasses.blue;
  onMount(() => {
    if (!props.btn.workflowId) return;
    const wfId = props.btn.workflowId.includes(":") ? props.btn.workflowId.split(":")[1] : props.btn.workflowId;
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
            if (chunk !== void 0) setData(chunk);
          }
        } catch {
        }
      };
      es.addEventListener("step_chunk", (e) => {
        try {
          const payload = JSON.parse(e.data);
          let chunk = payload.data?.chunk;
          if (props.btn.dataPath && chunk) {
            chunk = get(chunk, props.btn.dataPath, chunk);
          }
          if (chunk !== void 0) setData(chunk);
        } catch {
        }
      });
      es.addEventListener("step_complete", (e) => {
        try {
          const payload = JSON.parse(e.data);
          let resData = payload.data?.response;
          if (props.btn.dataPath && resData) {
            resData = get(resData, props.btn.dataPath, resData);
          }
          if (resData !== void 0) setData(resData);
        } catch {
        }
      });
      es.onerror = () => {
        setStatus("idle");
      };
    }
  });
  return ssr(_tmpl$2, ssrHydrationKey(), `w-full rounded-2xl border p-5 shadow-xl transition-all duration-300 ${escape(theme().bg, true)} ${escape(theme().border, true)}`, escape(props.btn.label) || "News Alert", escape(createComponent(Show, {
    get when() {
      return props.btn.streamActive !== false;
    },
    get children() {
      return ssr(_tmpl$, ssrHydrationKey());
    }
  })), `text-lg font-extrabold tracking-tight ${escape(theme().text, true)}`, escape(evalResult().text));
}
function ToggleWidgetComponent(props) {
  const [checked, setChecked] = createSignal(props.btn.defaultChecked || false);
  const [isFlipping, setIsFlipping] = createSignal(false);
  const onTxt = () => props.btn.onLabel || "ON";
  const offTxt = () => props.btn.offLabel || "OFF";
  return ssr(_tmpl$3, ssrHydrationKey(), escape(props.btn.label) || "Toggle Switch", ssrAttribute("class", checked() ? "text-emerald-400" : "text-slate-400", false), checked() ? escape(onTxt()) : escape(offTxt()), ssrAttribute("disabled", isFlipping(), true), `relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${checked() ? "bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/30" : "bg-[#2a2a3a]"}`, `pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${checked() ? "translate-x-8" : "translate-x-0"}`);
}
function lastStep(workflow) {
  const steps = workflow?.steps || [];
  return steps.length ? steps[steps.length - 1] : null;
}
function lastStepType(workflow) {
  return lastStep(workflow)?.type || "grpc";
}
function valueToLabel(value, fallback) {
  if (value === void 0 || value === null || value === "") return String(fallback + 1);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
function valueToNumber(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}
function parseJsonString(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}
function normalizeDataArray(value) {
  let data = parseJsonString(value);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const arrayKey = Object.keys(data).find((key) => Array.isArray(data[key]));
    if (arrayKey) data = data[arrayKey];
  }
  if (!Array.isArray(data)) {
    data = data !== void 0 && data !== null ? [data] : [];
  }
  while (data.length === 1) {
    const first = parseJsonString(data[0]);
    if (!Array.isArray(first)) break;
    data = first;
  }
  return data.map(parseJsonString);
}
function collectObjectKeys(data) {
  const keys = /* @__PURE__ */ new Set();
  const addKeys = (value, prefix = "") => {
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
function pickKey(keys, preferred) {
  const normalized = new Map(keys.map((key) => [key.toLowerCase(), key]));
  for (const key of preferred) {
    const match = normalized.get(key.toLowerCase());
    if (match) return match;
  }
  return "";
}
function inferChartKeys(data, explicitX, explicitY) {
  const keys = collectObjectKeys(data);
  const xKey = explicitX || pickKey(keys, ["x", "step", "label", "name", "title", "date", "time", "id"]);
  let yKey = explicitY || pickKey(keys, ["y", "value", "metrics.value", "metrics.delta", "count", "total", "amount", "score", "completed"]);
  if (!yKey) {
    yKey = keys.find((key) => key !== xKey && data.some((row) => {
      const value = row && typeof row === "object" ? get(row, key) : void 0;
      return typeof value === "number" || typeof value === "boolean" || typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
    })) || "";
  }
  return {
    xKey,
    yKey
  };
}
function DashTable(props) {
  const rows = () => normalizeDataArray(props.data);
  const effectiveCols = () => {
    const explicit = (props.columns || []).filter(Boolean);
    if (explicit.length) return explicit;
    const keys = collectObjectKeys(rows());
    return keys.length ? keys : ["value"];
  };
  const cellValue = (row, key) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return key === "value" ? row : void 0;
    return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : get(row, key);
  };
  const formatCell = (value) => {
    if (value === void 0 || value === null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  };
  return ssr(_tmpl$5, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return rows().length > 0;
    },
    get fallback() {
      return ssr(_tmpl$6, ssrHydrationKey());
    },
    get children() {
      return ssr(_tmpl$4, ssrHydrationKey(), escape(createComponent(For, {
        get each() {
          return effectiveCols();
        },
        children: (col) => ssr(_tmpl$7, ssrHydrationKey(), escape(col))
      })), escape(createComponent(For, {
        get each() {
          return rows();
        },
        children: (row) => ssr(_tmpl$8, ssrHydrationKey(), escape(createComponent(For, {
          get each() {
            return effectiveCols();
          },
          children: (col) => {
            const text = formatCell(cellValue(row, col));
            return ssr(_tmpl$9, ssrHydrationKey(), ssrAttribute("title", escape(text, true), false), escape(text));
          }
        })))
      })));
    }
  })));
}
let globalUsTopoJson = null;
let globalWorldTopoJson = null;
const STATE_ABBR_MAP = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming"
};
function DashChart(props) {
  const cType = () => props.chartType || "bar";
  const [topoJson, setTopoJson] = createSignal(null);
  createEffect(() => {
    const type = cType();
    if (type === "choropleth-us") {
      if (globalUsTopoJson) {
        setTopoJson(globalUsTopoJson);
      } else {
        fetch("https://cdn.jsdelivr.net/npm/us-atlas/states-10m.json").then((res) => res.json()).then((data) => {
          globalUsTopoJson = data;
          setTopoJson(data);
        });
      }
    } else if (type === "choropleth-world") {
      if (globalWorldTopoJson) {
        setTopoJson(globalWorldTopoJson);
      } else {
        fetch("https://cdn.jsdelivr.net/npm/world-atlas/countries-110m.json").then((res) => res.json()).then((data) => {
          globalWorldTopoJson = data;
          setTopoJson(data);
        });
      }
    }
  });
  const buildData = () => {
    const data = normalizeDataArray(props.data);
    if (!Array.isArray(data) || !data.length) return {
      labels: [],
      datasets: []
    };
    const type = cType();
    const isPie = type === "pie" || type === "doughnut";
    const isScatter = type === "scatter";
    const isBar = type === "bar";
    if (type.startsWith("choropleth")) {
      const isUS = type === "choropleth-us";
      const topo = topoJson();
      if (!topo) return {
        labels: [],
        datasets: []
      };
      const features = isUS ? ChartGeo.topojson.feature(topo, topo.objects.states).features : ChartGeo.topojson.feature(topo, topo.objects.countries).features;
      const inferred2 = inferChartKeys(data, props.xKey, props.yKey);
      const items = data.map((item, i) => {
        const geoVal = inferred2.xKey ? String(get(item, inferred2.xKey) || "").trim() : "";
        const numVal = inferred2.yKey ? valueToNumber(get(item, inferred2.yKey), 0) : valueToNumber(item, 0);
        return {
          geoVal,
          numVal
        };
      });
      const matchedFeatures = features.map((d) => {
        const featName = d.properties.name;
        const matched = items.find((item) => {
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
        labels: features.map((d) => d.properties.name),
        datasets: [{
          label: inferred2.yKey || "Value",
          outline: features,
          data: matchedFeatures
        }]
      };
    }
    const inferred = inferChartKeys(data, props.xKey, props.yKey);
    if (isScatter) {
      const points2 = [];
      data.forEach((item, i) => {
        if (item && typeof item === "object") {
          points2.push({
            x: inferred.xKey ? valueToNumber(get(item, inferred.xKey), i) : i,
            y: inferred.yKey ? valueToNumber(get(item, inferred.yKey), 0) : valueToNumber(item, 0)
          });
        } else {
          points2.push({
            x: i,
            y: Number(item) || 0
          });
        }
      });
      return {
        labels: [],
        datasets: [{
          label: inferred.yKey || "Value",
          data: points2,
          backgroundColor: "#a855f7",
          pointRadius: 4
        }]
      };
    }
    const labels = [];
    const points = [];
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
          borderColor: "#0a0a0f"
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
        fill: !isBar
      }]
    };
  };
  const chartOptions = () => {
    const type = cType();
    if (type.startsWith("choropleth")) {
      const isUS = type === "choropleth-us";
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          projection: {
            axis: "x",
            projection: isUS ? "albersUsa" : "equalEarth"
          },
          color: {
            axis: "x",
            interpolate: (v) => {
              const hue = 220 + v * (320 - 220);
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
        legend: {
          labels: {
            color: "#c8c8d8"
          }
        }
      },
      scales: isPie ? {} : {
        x: {
          grid: {
            color: "#2a2a3e"
          },
          ticks: {
            color: "#8b8b9e"
          }
        },
        y: {
          grid: {
            color: "#2a2a3e"
          },
          ticks: {
            color: "#8b8b9e"
          }
        }
      }
    };
  };
  return ssr(_tmpl$0, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return normalizeDataArray(props.data).length > 0;
    },
    get fallback() {
      return ssr(_tmpl$1, ssrHydrationKey());
    },
    get children() {
      return createComponent(Show, {
        get when() {
          return !cType().startsWith("choropleth") || topoJson();
        },
        get fallback() {
          return ssr(_tmpl$10, ssrHydrationKey());
        },
        get children() {
          return createComponent(DefaultChart, {
            get type() {
              return cType().startsWith("choropleth") ? "choropleth" : cType();
            },
            get data() {
              return buildData();
            },
            get options() {
              return chartOptions();
            }
          });
        }
      });
    }
  })));
}
async function pollRun(runId, onDone, onError) {
  const rawId = runId.includes(":") ? runId.split(":")[1] : runId;
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
    }
  }, 1500);
}
function extractLastStep(logs) {
  if (!logs.length) return {
    data: [],
    meta: {}
  };
  const last = [...logs].reverse().find((l) => l.status === "success" && (l.stepType === "table" || l.stepType === "chart"));
  if (!last) {
    const fallback = [...logs].reverse().find((l) => l.status === "success");
    if (!fallback) return {
      data: [],
      meta: {}
    };
    const raw2 = fallback.response;
    return {
      data: Array.isArray(raw2) ? raw2 : raw2 ? [raw2] : [],
      meta: fallback.meta || {}
    };
  }
  const raw = last.response;
  return {
    data: Array.isArray(raw) ? raw : raw ? [raw] : [],
    meta: last.meta || {}
  };
}
function AutoWidget(props) {
  const kind = props.btn.widgetType || lastStepType(props.workflow);
  const lastS = lastStep(props.workflow);
  const [status, setStatus] = createSignal("loading");
  const [tableData, setTableData] = createSignal([]);
  const [stepMeta, setStepMeta] = createSignal({});
  const [errorMsg, setErrorMsg] = createSignal("");
  onMount(async () => {
    try {
      const res = await fetch(`/api/dashboards/${props.dashboardId}/trigger/${props.btn.id}`, {
        method: "POST"
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Trigger failed");
      await pollRun(json.runId, (logs) => {
        const {
          data,
          meta
        } = extractLastStep(logs);
        setTableData(data);
        setStepMeta(meta);
        setStatus("ready");
      }, (msg) => {
        setErrorMsg(msg);
        setStatus("error");
      });
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  });
  return ssr(_tmpl$14, ssrHydrationKey(), `flex items-center justify-between mb-3 pb-2 border-b ${kind === "table" ? "border-emerald-500/20" : "border-purple-500/20"}`, `text-sm font-bold ${kind === "table" ? "text-emerald-400" : "text-purple-400"}`, kind === "table" ? "📊" : "📈", escape(props.btn.label), escape(createComponent(Show, {
    get when() {
      return status() === "loading";
    },
    get children() {
      return ssr(_tmpl$11, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return status() === "loading";
    },
    get children() {
      return ssr(_tmpl$12, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return status() === "error";
    },
    get children() {
      return ssr(_tmpl$13, ssrHydrationKey(), escape(errorMsg()));
    }
  })), escape(createComponent(Show, {
    get when() {
      return status() === "ready";
    },
    get children() {
      return [createComponent(Show, {
        when: kind === "table",
        get children() {
          return createComponent(DashTable, {
            get data() {
              return tableData();
            },
            get columns() {
              return props.btn.columns ? props.btn.columns.split(",").map((c) => c.trim()).filter(Boolean) : stepMeta().columns;
            }
          });
        }
      }), createComponent(Show, {
        when: kind === "chart",
        get children() {
          return createComponent(DashChart, {
            get data() {
              return tableData();
            },
            get xKey() {
              return props.btn.xKey || stepMeta().xKey || lastS?.xKey;
            },
            get yKey() {
              return props.btn.yKey || stepMeta().yKey || lastS?.yKey;
            },
            get chartType() {
              return props.btn.chartType || stepMeta().chartType || lastS?.chartType || "bar";
            }
          });
        }
      })];
    }
  })));
}
function PublicDashboard() {
  const params = useParams();
  const [dashboard, setDashboard] = createSignal(void 0);
  const [workflowMap, setWorkflowMap] = createSignal({});
  onMount(async () => {
    try {
      const res = await fetch(`/api/dashboards/${params.id}`);
      const json = await res.json();
      if (json.success) {
        const dash = json.data;
        const vis = dash.visibility || "public";
        const allowed = vis === "public" || dash.isPublic;
        if (!allowed) {
          setDashboard(null);
          return;
        }
        setDashboard(dash);
        const ids = [...new Set((dash.buttons || []).map((b) => b.workflowId).filter(Boolean))];
        const entries = await Promise.all(ids.map(async (wid) => {
          const rawId = wid.includes(":") ? wid.split(":")[1] : wid;
          try {
            const r = await fetch(`/api/workflows/${rawId}`);
            const j = await r.json();
            return j.success ? [wid, j.data] : null;
          } catch {
            return null;
          }
        }));
        const map = {};
        entries.filter(Boolean).forEach(([id, wf]) => {
          map[id] = wf;
        });
        setWorkflowMap(map);
      } else {
        setDashboard(null);
      }
    } catch {
      setDashboard(null);
    }
  });
  createEffect(() => {
    if (dashboard()) document.title = dashboard().name || "Dashboard";
  });
  const [executing, setExecuting] = createSignal({});
  const [formState, setFormState] = createSignal({});
  const updateForm = (btnId, field, value) => {
    setFormState((prev) => ({
      ...prev,
      [btnId]: {
        ...prev[btnId] || {},
        [field]: value
      }
    }));
  };
  const triggerButton = async (btn) => {
    if (executing()[btn.id] === "running") return;
    setExecuting((prev) => ({
      ...prev,
      [btn.id]: "running"
    }));
    try {
      const currentForm = formState()[btn.id] || {};
      const mergedForm = {
        ...currentForm
      };
      (btn.formConfig || []).forEach((f) => {
        if (f.name && (mergedForm[f.name] === void 0 || mergedForm[f.name] === "")) {
          const savedVal = f.value ?? f.defaultValue;
          if (savedVal !== void 0 && savedVal !== "") {
            mergedForm[f.name] = savedVal;
          }
        }
      });
      const payload = {
        form: mergedForm
      };
      const res = await fetch(`/api/dashboards/${params.id}/trigger/${btn.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setExecuting((prev) => ({
          ...prev,
          [btn.id]: "success"
        }));
        setTimeout(() => setExecuting((prev) => ({
          ...prev,
          [btn.id]: "idle"
        })), 2500);
      } else {
        alert("Action failed: " + json.error);
        setExecuting((prev) => ({
          ...prev,
          [btn.id]: "error"
        }));
        setTimeout(() => setExecuting((prev) => ({
          ...prev,
          [btn.id]: "idle"
        })), 2500);
      }
    } catch (e) {
      alert("Network or Server error: " + e.message);
      setExecuting((prev) => ({
        ...prev,
        [btn.id]: "error"
      }));
      setTimeout(() => setExecuting((prev) => ({
        ...prev,
        [btn.id]: "idle"
      })), 2500);
    }
  };
  const colorOptions = [{
    value: "blue",
    class: "bg-blue-600 hover:bg-blue-500 ring-blue-500/50"
  }, {
    value: "red",
    class: "bg-red-600 hover:bg-red-500 ring-red-500/50"
  }, {
    value: "emerald",
    class: "bg-emerald-600 hover:bg-emerald-500 ring-emerald-500/50"
  }, {
    value: "purple",
    class: "bg-purple-600 hover:bg-purple-500 ring-purple-500/50"
  }, {
    value: "slate",
    class: "bg-slate-700 hover:bg-slate-600 ring-slate-500/50"
  }];
  return ssr(_tmpl$19, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return dashboard() === null;
    },
    get children() {
      return ssr(_tmpl$15, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return dashboard() === void 0;
    },
    get children() {
      return ssr(_tmpl$16, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return dashboard();
    },
    get children() {
      return ssr(_tmpl$18, ssrHydrationKey(), escape(dashboard().name), escape(createComponent(Show, {
        get when() {
          return (dashboard().buttons || []).length === 0;
        },
        get children() {
          return ssr(_tmpl$17, ssrHydrationKey());
        }
      })), escape(createComponent(For, {
        get each() {
          return dashboard().buttons || [];
        },
        children: (btn) => {
          const wf = () => workflowMap()[btn.workflowId];
          const kind = () => btn.widgetType || (wf() ? lastStepType(wf()) : "button");
          return createComponent(Show, {
            get when() {
              return kind() === "chart" || kind() === "table" || kind() === "infographic";
            },
            get fallback() {
              if (kind() === "news") {
                return createComponent(NewsWidgetComponent, {
                  btn,
                  get dashboardId() {
                    return params.id;
                  }
                });
              }
              if (kind() === "toggle") {
                return createComponent(ToggleWidgetComponent, {
                  btn,
                  get dashboardId() {
                    return params.id;
                  },
                  get formState() {
                    return formState();
                  },
                  updateForm,
                  triggerButton
                });
              }
              if (kind() === "infographic") {
                return createComponent(InfographicWidget, {
                  get syntax() {
                    return btn.infographicSyntax;
                  },
                  get editable() {
                    return btn.infographicEditable;
                  }
                });
              }
              const state = () => executing()[btn.id] || "idle";
              const colorConfig = colorOptions.find((c) => c.value === (btn.color || "blue"));
              const baseStyle = colorConfig ? colorConfig.class : "bg-blue-600 hover:bg-blue-500 ring-blue-500/50";
              const btnClass = () => {
                if (state() === "running") return "w-full py-4 px-6 text-[15px] font-bold text-white/70 rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-slate-800 cursor-not-allowed";
                if (state() === "success") return "w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-emerald-600 ring-4 ring-emerald-500/50";
                if (state() === "error") return "w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-red-600 ring-4 ring-red-500/50";
                return `w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.98] focus:ring-4 focus:outline-none ${baseStyle}`;
              };
              return createComponent(Show, {
                get when() {
                  return btn.formConfig && btn.formConfig.length > 0;
                },
                get fallback() {
                  return ssr(_tmpl$35, ssrHydrationKey(), ssrAttribute("disabled", state() !== "idle", true) + ssrAttribute("class", escape(btnClass(), true), false), escape(createComponent(Show, {
                    get when() {
                      return state() === "idle";
                    },
                    get children() {
                      return [ssr(_tmpl$29, ssrHydrationKey()), ssr(_tmpl$30, ssrHydrationKey(), escape(btn.label))];
                    }
                  })), escape(createComponent(Show, {
                    get when() {
                      return state() === "running";
                    },
                    get children() {
                      return [ssr(_tmpl$31, ssrHydrationKey()), ssr(_tmpl$32, ssrHydrationKey())];
                    }
                  })), escape(createComponent(Show, {
                    get when() {
                      return state() === "success";
                    },
                    get children() {
                      return [ssr(_tmpl$33, ssrHydrationKey()), ssr(_tmpl$25, ssrHydrationKey())];
                    }
                  })), escape(createComponent(Show, {
                    get when() {
                      return state() === "error";
                    },
                    get children() {
                      return [ssr(_tmpl$34, ssrHydrationKey()), ssr(_tmpl$27, ssrHydrationKey())];
                    }
                  })));
                },
                get children() {
                  return ssr(_tmpl$28, ssrHydrationKey(), escape(btn.label), escape(createComponent(For, {
                    get each() {
                      return btn.formConfig;
                    },
                    children: (field) => {
                      const val = () => {
                        const v = (formState()[btn.id] || {})[field.name];
                        if (v !== void 0) return v;
                        return field.value ?? field.defaultValue ?? "";
                      };
                      return ssr(_tmpl$40, ssrHydrationKey(), escape(field.label), escape(createComponent(Show, {
                        get when() {
                          return field.type === "boolean";
                        },
                        get children() {
                          return ssr(_tmpl$36, ssrHydrationKey(), ssrAttribute("checked", !!val(), true));
                        }
                      })), escape(createComponent(Show, {
                        get when() {
                          return field.type === "select";
                        },
                        get children() {
                          return ssr(_tmpl$37, ssrHydrationKey(), ssrAttribute("value", escape(val(), true) || "", false), escape(createComponent(For, {
                            get each() {
                              return (field.options || "").split(",").map((o) => o.trim()).filter(Boolean);
                            },
                            children: (opt) => ssr(_tmpl$41, ssrHydrationKey() + ssrAttribute("value", escape(opt, true), false), escape(opt))
                          })));
                        }
                      })), escape(createComponent(Show, {
                        get when() {
                          return field.type === "textarea";
                        },
                        get children() {
                          return ssr(_tmpl$38, ssrHydrationKey(), ssrAttribute("required", field.required, true), ssrAttribute("value", escape(val(), true) || "", false), `Enter ${escape(field.label, true)}...`);
                        }
                      })), escape(createComponent(Show, {
                        get when() {
                          return field.type !== "boolean" && field.type !== "select" && field.type !== "textarea";
                        },
                        get children() {
                          return ssr(_tmpl$39, ssrHydrationKey() + ssrAttribute("type", field.type === "number" ? "number" : "text", false), ssrAttribute("required", field.required, true), ssrAttribute("value", escape(val(), true) || "", false), `Enter ${escape(field.label, true)}...`);
                        }
                      })));
                    }
                  })), ssrAttribute("disabled", state() !== "idle", true) + ssrAttribute("class", escape(btnClass(), true), false), escape(createComponent(Show, {
                    get when() {
                      return state() === "idle";
                    },
                    get children() {
                      return [ssr(_tmpl$20, ssrHydrationKey()), ssr(_tmpl$21, ssrHydrationKey(), escape(btn.label))];
                    }
                  })), escape(createComponent(Show, {
                    get when() {
                      return state() === "running";
                    },
                    get children() {
                      return [ssr(_tmpl$22, ssrHydrationKey()), ssr(_tmpl$23, ssrHydrationKey())];
                    }
                  })), escape(createComponent(Show, {
                    get when() {
                      return state() === "success";
                    },
                    get children() {
                      return [ssr(_tmpl$24, ssrHydrationKey()), ssr(_tmpl$25, ssrHydrationKey())];
                    }
                  })), escape(createComponent(Show, {
                    get when() {
                      return state() === "error";
                    },
                    get children() {
                      return [ssr(_tmpl$26, ssrHydrationKey()), ssr(_tmpl$27, ssrHydrationKey())];
                    }
                  })));
                }
              });
            },
            get children() {
              return createComponent(Show, {
                get when() {
                  return kind() === "infographic";
                },
                get fallback() {
                  return ssr(_tmpl$42, ssrHydrationKey(), `rounded-2xl border p-5 shadow-xl ${kind() === "table" ? "border-emerald-500/20 bg-[#0a120d]" : "border-purple-500/20 bg-[#100a14]"}`, escape(createComponent(Show, {
                    get when() {
                      return wf();
                    },
                    get fallback() {
                      return ssr(_tmpl$43, ssrHydrationKey());
                    },
                    get children() {
                      return createComponent(AutoWidget, {
                        get dashboardId() {
                          return params.id;
                        },
                        btn,
                        get workflow() {
                          return wf();
                        }
                      });
                    }
                  })));
                },
                get children() {
                  return createComponent(InfographicWidget, {
                    get syntax() {
                      return btn.infographicSyntax;
                    },
                    get editable() {
                      return btn.infographicEditable;
                    }
                  });
                }
              });
            }
          });
        }
      })));
    }
  })));
}
function InfographicWidget(props) {
  let containerRef;
  let instance = null;
  const getSyntax = () => {
    if (props.syntax) return props.syntax;
    if (typeof props.data === "string") return props.data;
    return "";
  };
  onMount(async () => {
    try {
      const mod = await import("@antv/infographic");
      const Infographic = mod.Infographic || mod.default;
      instance = new Infographic({
        container: containerRef,
        width: "100%",
        height: props.height || "400px",
        editable: props.editable || false
      });
      const syntax = getSyntax();
      if (syntax) instance.render(syntax);
    } catch (e) {
      console.error("[InfographicWidget] Failed to load @antv/infographic:", e);
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
  return ssr(_tmpl$44, ssrHydrationKey(), ssrStyle(`min-height:${props.height || "300px"}`));
}
export {
  PublicDashboard as default,
  id$$
};
//# sourceMappingURL=_id_-BhpffeBx.js.map
