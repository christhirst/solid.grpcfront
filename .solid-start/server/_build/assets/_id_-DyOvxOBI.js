import { ssr, ssrHydrationKey, escape, createComponent, ssrAttribute } from "solid-js/web";
import { createSignal, onMount, createEffect, Show, For } from "solid-js";
import { D as DefaultChart } from "./index-D4uTJpLk.js";
import { Chart, registerables } from "chart.js";
import { c as createSolidTable, f as flexRender } from "./index-DNUuAjQM.js";
import get from "lodash.get";
import { u as useParams } from "../../entry-server.js";
import { getCoreRowModel } from "@tanstack/table-core";
import "solid-js/store";
import "pathe";
import "radix3";
import "seroval";
import "seroval-plugins/web";
import "h3";
import "solid-js/web/storage";
import "cookie-es";
var _tmpl$ = ["<div", ' class="overflow-auto max-h-[400px] rounded-xl border border-[#2a2a3a]/60 bg-[#0a0a0f]"><table class="w-full text-left text-xs text-[#c8c8d8]"><thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0">', '</thead><tbody class="divide-y divide-[#1e1e2e]">', "</tbody></table></div>"], _tmpl$2 = ["<tr", ">", "</tr>"], _tmpl$3 = ["<th", ' class="px-4 py-2.5 font-semibold border-b border-[#2a2a3e] whitespace-nowrap uppercase text-[10px] tracking-wider">', "</th>"], _tmpl$4 = ["<tr", ' class="hover:bg-[#1a1a24]/60 transition-colors">', "</tr>"], _tmpl$5 = ["<td", ' class="px-4 py-2 border-b border-[#1e1e2e]/50 max-w-[200px] truncate"', ">", "</td>"], _tmpl$6 = ["<div", ' class="h-[250px] bg-[#101015] p-3 rounded border border-[#2a2a3a]/50">', "</div>"], _tmpl$7 = ["<p", ' class="text-xs text-[#5a5a6e]">No valid array data for chart</p>'], _tmpl$8 = ["<svg", ' class="animate-spin h-4 w-4 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$9 = ["<div", ' class="space-y-2"><div class="h-6 rounded bg-[#1e1e2e] animate-pulse"></div><div class="h-6 rounded bg-[#1e1e2e] animate-pulse w-4/5"></div><div class="h-6 rounded bg-[#1e1e2e] animate-pulse w-3/5"></div></div>'], _tmpl$0 = ["<div", ' class="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">✗ <!--$-->', "<!--/--></div>"], _tmpl$1 = ["<div", ' class="w-full"><div class="', '"><h3 class="', '"><!--$-->', "<!--/--> <!--$-->", "<!--/--></h3><!--$-->", "<!--/--></div><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$10 = ["<div", ' class="text-center mt-32"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto mb-4 text-[#8b8b9e]"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><h1 class="text-2xl font-bold text-white mb-2">Not Found</h1><p class="text-[#8b8b9e]">This dashboard does not exist or is not public.</p></div>'], _tmpl$11 = ["<div", ' class="flex items-center justify-center min-h-screen"><svg class="animate-spin h-8 w-8 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>'], _tmpl$12 = ["<div", ' class="text-center py-16 text-[#5b5b6e] text-sm italic">No actions available right now.</div>'], _tmpl$13 = ["<div", ' class="max-w-4xl mx-auto"><div class="relative pt-12 pb-8 text-center mb-10"><div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div><h1 class="text-4xl font-extrabold tracking-tight text-white mb-2">', '</h1><p class="text-[12px] font-bold tracking-widest text-[#5b5b6e] uppercase">Internal Operations</p></div><div class="space-y-6"><!--$-->', "<!--/--><!--$-->", '<!--/--></div><div class="mt-12 text-center text-[10px] text-[#5b5b6e]">Powered by <span class="font-bold font-mono text-purple-400/80">solid.grpcfront</span></div></div>'], _tmpl$14 = ["<div", ' class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"><div class="bg-[#101018] border border-[#2a2a3a] rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200"><div class="flex items-center justify-between mb-6 pb-4 border-b border-[#2a2a3a]"><h3 class="text-lg font-bold text-white flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-purple-500"></span><!--$-->', '<!--/--></h3><button class="text-[#8b8b9e] hover:text-white transition-colors" title="Close"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div><div class="space-y-4 mb-8 max-h-[60vh] overflow-y-auto pr-2">', '</div><div class="flex justify-end gap-3 pt-4 border-t border-[#2a2a3a]"><button class="px-5 py-2.5 rounded-xl border border-[#2a2a3a] text-sm font-bold text-[#8b8b9e] hover:bg-[#1e1e2e] hover:text-white transition-all">Cancel</button><button class="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-bold text-white shadow-lg transition-all active:scale-[0.98] flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>Execute</button></div></div></div>'], _tmpl$15 = ["<main", ' class="min-h-screen bg-[#050508] p-6 lg:p-16 font-sans"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></main>"], _tmpl$16 = ["<div", ' class="', '">', "</div>"], _tmpl$17 = ["<svg", ' width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'], _tmpl$18 = ["<span", ">", "</span>"], _tmpl$19 = ["<svg", ' class="animate-spin h-5 w-5 text-purple-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$20 = ["<span", ">Executing...</span>"], _tmpl$21 = ["<svg", ' class="animate-bounce h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>'], _tmpl$22 = ["<span", ">Success!</span>"], _tmpl$23 = ["<svg", ' class="animate-pulse h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'], _tmpl$24 = ["<span", ">Failed</span>"], _tmpl$25 = ["<button", "", "><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></button>"], _tmpl$26 = ["<div", ' class="text-[#5b5b6e] text-sm italic">Loading workflow info...</div>'], _tmpl$27 = ["<label", ' class="flex items-center gap-3 cursor-pointer"><input type="checkbox" class="w-4 h-4 rounded border-[#2a2a3a] bg-[#1e1e2e] text-purple-500 focus:ring-purple-500/50"', '><span class="text-sm text-white">Enable</span></label>'], _tmpl$28 = ["<select", ' class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all custom-select"', "><option value disabled>Select an option...</option><!--$-->", "<!--/--></select>"], _tmpl$29 = ["<input", "", ' class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"', ' placeholder="', '">'], _tmpl$30 = ["<div", '><label class="block text-xs font-bold text-[#8b8b9e] mb-1.5">', "</label><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$31 = ["<option", ">", "</option>"];
const id$$ = "src/routes/p/[id].tsx?pick=default&pick=$css";
Chart.register(...registerables);
function lastStep(workflow) {
  const steps = workflow?.steps || [];
  return steps.length ? steps[steps.length - 1] : null;
}
function lastStepType(workflow) {
  return lastStep(workflow)?.type || "grpc";
}
function DashTable(props) {
  const effectiveCols = () => {
    const explicit = (props.columns || []).filter(Boolean);
    if (explicit.length) return explicit;
    const d = props.data;
    if (!Array.isArray(d) || !d[0] || typeof d[0] !== "object") return [];
    return Object.keys(d[0]);
  };
  const table = createSolidTable({
    get data() {
      return Array.isArray(props.data) ? props.data : [];
    },
    get columns() {
      const cols = effectiveCols();
      if (!cols.length) {
        const d = props.data;
        if (!Array.isArray(d) || !d[0]) return [];
        if (typeof d[0] !== "object") return [{
          id: "value",
          header: "Value",
          accessorFn: (r) => r
        }];
      }
      return cols.map((k) => ({
        accessorKey: k,
        header: k,
        cell: (info) => {
          const v = info.getValue();
          return typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
        }
      }));
    },
    getCoreRowModel: getCoreRowModel()
  });
  return ssr(_tmpl$, ssrHydrationKey(), escape(createComponent(For, {
    get each() {
      return table.getHeaderGroups();
    },
    children: (hg) => ssr(_tmpl$2, ssrHydrationKey(), escape(createComponent(For, {
      get each() {
        return hg.headers;
      },
      children: (h) => ssr(_tmpl$3, ssrHydrationKey(), h.isPlaceholder ? escape(null) : escape(flexRender(h.column.columnDef.header, h.getContext())))
    })))
  })), escape(createComponent(For, {
    get each() {
      return table.getRowModel().rows;
    },
    children: (row) => ssr(_tmpl$4, ssrHydrationKey(), escape(createComponent(For, {
      get each() {
        return row.getVisibleCells();
      },
      children: (cell) => ssr(_tmpl$5, ssrHydrationKey(), ssrAttribute("title", escape(String(cell.getValue() ?? ""), true), false), escape(flexRender(cell.column.columnDef.cell, cell.getContext())))
    })))
  })));
}
function DashChart(props) {
  const cType = () => props.chartType || "bar";
  const buildData = () => {
    const data = props.data;
    if (!Array.isArray(data) || !data.length) return {
      labels: [],
      datasets: []
    };
    const type = cType();
    const isPie = type === "pie" || type === "doughnut";
    const isScatter = type === "scatter";
    const isBar = type === "bar";
    if (isScatter) {
      const points2 = [];
      data.forEach((item, i) => {
        if (item && typeof item === "object") {
          points2.push({
            x: Number(props.xKey ? get(item, props.xKey) : i) || 0,
            y: Number(props.yKey ? get(item, props.yKey) : i) || 0
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
          label: props.yKey || "Value",
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
        labels.push(props.xKey ? String(get(item, props.xKey) ?? i) : i);
        points.push(Number(props.yKey ? get(item, props.yKey) : i) || 0);
      } else {
        labels.push(i);
        points.push(Number(item) || 0);
      }
    });
    if (isPie) {
      const colors = ["#a855f7", "#6366f1", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4"];
      const bgColors = points.map((_, i) => colors[i % colors.length]);
      return {
        labels,
        datasets: [{
          label: props.yKey || "Value",
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
        label: props.yKey || "Value",
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
    const isPie = cType() === "pie" || cType() === "doughnut";
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
  return ssr(_tmpl$6, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return Array.isArray(props.data) && props.data.length > 0;
    },
    get fallback() {
      return ssr(_tmpl$7, ssrHydrationKey());
    },
    get children() {
      return createComponent(DefaultChart, {
        get type() {
          return cType();
        },
        get data() {
          return buildData();
        },
        get options() {
          return chartOptions();
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
  const kind = lastStepType(props.workflow);
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
  return ssr(_tmpl$1, ssrHydrationKey(), `flex items-center justify-between mb-3 pb-2 border-b ${kind === "table" ? "border-emerald-500/20" : "border-purple-500/20"}`, `text-sm font-bold ${kind === "table" ? "text-emerald-400" : "text-purple-400"}`, kind === "table" ? "📊" : "📈", escape(props.btn.label), escape(createComponent(Show, {
    get when() {
      return status() === "loading";
    },
    get children() {
      return ssr(_tmpl$8, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return status() === "loading";
    },
    get children() {
      return ssr(_tmpl$9, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return status() === "error";
    },
    get children() {
      return ssr(_tmpl$0, ssrHydrationKey(), escape(errorMsg()));
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
              return stepMeta().columns;
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
              return stepMeta().xKey || lastS?.xKey;
            },
            get yKey() {
              return stepMeta().yKey || lastS?.yKey;
            },
            get chartType() {
              return stepMeta().chartType || lastS?.chartType || "bar";
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
      if (json.success && json.data.isPublic) {
        const dash = json.data;
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
  const [activeModalBtn, setActiveModalBtn] = createSignal(null);
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
  return ssr(_tmpl$15, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return dashboard() === null;
    },
    get children() {
      return ssr(_tmpl$10, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return dashboard() === void 0;
    },
    get children() {
      return ssr(_tmpl$11, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return dashboard();
    },
    get children() {
      return ssr(_tmpl$13, ssrHydrationKey(), escape(dashboard().name), escape(createComponent(Show, {
        get when() {
          return (dashboard().buttons || []).length === 0;
        },
        get children() {
          return ssr(_tmpl$12, ssrHydrationKey());
        }
      })), escape(createComponent(For, {
        get each() {
          return dashboard().buttons || [];
        },
        children: (btn) => {
          const wf = () => workflowMap()[btn.workflowId];
          const kind = () => wf() ? lastStepType(wf()) : "grpc";
          return createComponent(Show, {
            get when() {
              return kind() !== "grpc";
            },
            get fallback() {
              const state = () => executing()[btn.id] || "idle";
              const colorConfig = colorOptions.find((c) => c.value === (btn.color || "blue"));
              const baseStyle = colorConfig ? colorConfig.class : "bg-blue-600 hover:bg-blue-500 ring-blue-500/50";
              const btnClass = () => {
                if (state() === "running") return "w-full py-4 px-6 text-[15px] font-bold text-white/70 rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-slate-800 cursor-not-allowed";
                if (state() === "success") return "w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-emerald-600 ring-4 ring-emerald-500/50";
                if (state() === "error") return "w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-red-600 ring-4 ring-red-500/50";
                return `w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.98] focus:ring-4 focus:outline-none ${baseStyle}`;
              };
              const btnInner = ssr(_tmpl$25, ssrHydrationKey(), ssrAttribute("disabled", state() !== "idle", true) + ssrAttribute("class", escape(btnClass(), true), false), escape(createComponent(Show, {
                get when() {
                  return state() === "idle";
                },
                get children() {
                  return [ssr(_tmpl$17, ssrHydrationKey()), ssr(_tmpl$18, ssrHydrationKey(), escape(btn.label))];
                }
              })), escape(createComponent(Show, {
                get when() {
                  return state() === "running";
                },
                get children() {
                  return [ssr(_tmpl$19, ssrHydrationKey()), ssr(_tmpl$20, ssrHydrationKey())];
                }
              })), escape(createComponent(Show, {
                get when() {
                  return state() === "success";
                },
                get children() {
                  return [ssr(_tmpl$21, ssrHydrationKey()), ssr(_tmpl$22, ssrHydrationKey())];
                }
              })), escape(createComponent(Show, {
                get when() {
                  return state() === "error";
                },
                get children() {
                  return [ssr(_tmpl$23, ssrHydrationKey()), ssr(_tmpl$24, ssrHydrationKey())];
                }
              })));
              return btnInner;
            },
            get children() {
              return ssr(_tmpl$16, ssrHydrationKey(), `rounded-2xl border p-5 shadow-xl ${kind() === "table" ? "border-emerald-500/20 bg-[#0a120d]" : "border-purple-500/20 bg-[#100a14]"}`, escape(createComponent(Show, {
                get when() {
                  return wf();
                },
                get fallback() {
                  return ssr(_tmpl$26, ssrHydrationKey());
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
            }
          });
        }
      })));
    }
  })), escape(createComponent(Show, {
    get when() {
      return activeModalBtn();
    },
    get children() {
      return ssr(_tmpl$14, ssrHydrationKey(), escape(activeModalBtn().label), escape(createComponent(For, {
        get each() {
          return activeModalBtn().formConfig;
        },
        children: (field) => {
          const val = (formState()[activeModalBtn().id] || {})[field.name];
          return ssr(_tmpl$30, ssrHydrationKey(), escape(field.label), escape(createComponent(Show, {
            get when() {
              return field.type === "boolean";
            },
            get children() {
              return ssr(_tmpl$27, ssrHydrationKey(), ssrAttribute("checked", !!val, true));
            }
          })), escape(createComponent(Show, {
            get when() {
              return field.type === "select";
            },
            get children() {
              return ssr(_tmpl$28, ssrHydrationKey(), ssrAttribute("value", escape(val, true) || "", false), escape(createComponent(For, {
                get each() {
                  return (field.options || "").split(",").map((o) => o.trim()).filter(Boolean);
                },
                children: (opt) => ssr(_tmpl$31, ssrHydrationKey() + ssrAttribute("value", escape(opt, true), false), escape(opt))
              })));
            }
          })), escape(createComponent(Show, {
            get when() {
              return field.type !== "boolean" && field.type !== "select";
            },
            get children() {
              return ssr(_tmpl$29, ssrHydrationKey() + ssrAttribute("type", field.type === "number" ? "number" : "text", false), ssrAttribute("required", field.required, true), ssrAttribute("value", escape(val, true) || "", false), `Enter ${escape(field.label, true)}...`);
            }
          })));
        }
      })));
    }
  })));
}
export {
  PublicDashboard as default,
  id$$
};
//# sourceMappingURL=_id_-DyOvxOBI.js.map
