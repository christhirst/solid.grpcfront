import { createSignal, For, Show, onMount, createEffect } from "solid-js";
import { useParams } from "@solidjs/router";
import { DefaultChart } from "solid-chartjs";
import { Chart, registerables } from "chart.js";
import { createSolidTable, getCoreRowModel, flexRender } from "@tanstack/solid-table";
import get from "lodash.get";

Chart.register(...registerables);

// ─── helpers ──────────────────────────────────────────────────────────────────

function lastStep(workflow: any) {
  const steps: any[] = workflow?.steps || [];
  return steps.length ? steps[steps.length - 1] : null;
}

function lastStepType(workflow: any): "grpc" | "table" | "chart" {
  return (lastStep(workflow)?.type as any) || "grpc";
}

// ─── Mini table component ─────────────────────────────────────────────────────

function DashTable(props: { data: any[]; columns?: string[] }) {
  const effectiveCols = () => {
    const explicit = (props.columns || []).filter(Boolean);
    if (explicit.length) return explicit;
    const d = props.data;
    if (!Array.isArray(d) || !d[0] || typeof d[0] !== "object") return [];
    return Object.keys(d[0]);
  };

  const table = createSolidTable({
    get data() { return Array.isArray(props.data) ? props.data : []; },
    get columns() {
      const cols = effectiveCols();
      if (!cols.length) {
        const d = props.data;
        if (!Array.isArray(d) || !d[0]) return [];
        if (typeof d[0] !== "object") return [{ id: "value", header: "Value", accessorFn: (r: any) => r }];
      }
      return cols.map((k) => ({
        accessorKey: k,
        header: k,
        cell: (info: any) => {
          const v = info.getValue();
          return typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
        },
      }));
    },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div class="overflow-auto max-h-[400px] rounded-xl border border-[#2a2a3a]/60 bg-[#0a0a0f]">
      <table class="w-full text-left text-xs text-[#c8c8d8]">
        <thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0">
          <For each={table.getHeaderGroups()}>
            {(hg) => (
              <tr>
                <For each={hg.headers}>
                  {(h) => (
                    <th class="px-4 py-2.5 font-semibold border-b border-[#2a2a3e] whitespace-nowrap uppercase text-[10px] tracking-wider">
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  )}
                </For>
              </tr>
            )}
          </For>
        </thead>
        <tbody class="divide-y divide-[#1e1e2e]">
          <For each={table.getRowModel().rows}>
            {(row) => (
              <tr class="hover:bg-[#1a1a24]/60 transition-colors">
                <For each={row.getVisibleCells()}>
                  {(cell) => (
                    <td class="px-4 py-2 border-b border-[#1e1e2e]/50 max-w-[200px] truncate" title={String(cell.getValue() ?? "")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

// ─── Mini chart component ─────────────────────────────────────────────────────

function DashChart(props: { data: any[]; xKey?: string; yKey?: string; chartType?: string }) {
  const cType = () => props.chartType || "bar";

  const chartData = () => {
    const d = props.data;
    if (!Array.isArray(d) || !d.length) return null;
    
    const type = cType();
    const isPie = type === "pie" || type === "doughnut";
    const isScatter = type === "scatter";
    const isBar = type === "bar";

    if (isScatter) {
      const points: {x: number, y: number}[] = [];
      d.forEach((item, i) => {
        if (item && typeof item === "object") {
           points.push({
             x: Number(props.xKey ? get(item, props.xKey) : i) || 0,
             y: Number(props.yKey ? get(item, props.yKey) : i) || 0
           });
        } else {
           points.push({ x: i, y: Number(item) || 0 });
        }
      });
      return {
        datasets: [{
          label: props.yKey || "Value",
          data: points,
          backgroundColor: "#a855f7",
          pointRadius: 4,
        }]
      };
    }

    const labels: any[] = [];
    const points: number[] = [];
    d.forEach((item, i) => {
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
        fill: !isBar,
      }],
    };
  };

  const chartOptions = () => {
    const isPie = cType() === "pie" || cType() === "doughnut";
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#c8c8d8" } } },
      scales: isPie ? {} : {
        x: { grid: { color: "#2a2a3e" }, ticks: { color: "#8b8b9e" } },
        y: { grid: { color: "#2a2a3e" }, ticks: { color: "#8b8b9e" } },
      },
    };
  };

  return (
    <div class="h-[260px] bg-[#0a0a0f] p-3 rounded-xl border border-[#2a2a3a]/60">
      <Show when={chartData()} fallback={<p class="text-xs text-[#5a5a6e]">No chart data</p>}>
        {/* @ts-ignore */}
        <DefaultChart type={cType() as any} data={chartData()} options={chartOptions()} />
      </Show>
    </div>
  );
}

// ─── Poll a run until complete ────────────────────────────────────────────────

async function pollRun(runId: string, onDone: (logs: any[]) => void, onError: (msg: string) => void) {
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
  const kind = lastStepType(props.workflow);
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
          <DashTable data={tableData()} columns={stepMeta().columns} />
        </Show>
        <Show when={kind === "chart"}>
          <DashChart
            data={tableData()}
            xKey={stepMeta().xKey || lastS?.xKey}
            yKey={stepMeta().yKey || lastS?.yKey}
            chartType={stepMeta().chartType || (lastS as any)?.chartType || "bar"}
          />
        </Show>
      </Show>
    </div>
  );
}

// ─── Main public dashboard page ───────────────────────────────────────────────

export default function PublicDashboard() {
  const params = useParams();

  const [dashboard, setDashboard] = createSignal<any>(undefined);
  // Map workflowId -> full workflow object (for last-step detection)
  const [workflowMap, setWorkflowMap] = createSignal<Record<string, any>>({});

  onMount(async () => {
    try {
      const res = await fetch(`/api/dashboards/${params.id}`);
      const json = await res.json();
      if (json.success && json.data.isPublic) {
        const dash = json.data;
        setDashboard(dash);

        // Fetch each unique workflow referenced by a button
        const ids: string[] = [...new Set((dash.buttons || []).map((b: any) => b.workflowId).filter(Boolean))] as string[];
        const entries = await Promise.all(
          ids.map(async (wid) => {
            const rawId = wid.includes(":") ? wid.split(":")[1] : wid;
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

  // Button state (for grpc-type widgets)
  const [executing, setExecuting] = createSignal<Record<string, "idle" | "running" | "success" | "error">>({});

  const triggerButton = async (btn: any) => {
    if (executing()[btn.id] === "running") return;
    setExecuting(prev => ({ ...prev, [btn.id]: "running" }));
    try {
      const res = await fetch(`/api/dashboards/${params.id}/trigger/${btn.id}`, { method: "POST" });
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

  const colorOptions = [
    { value: "blue",    class: "bg-blue-600 hover:bg-blue-500 ring-blue-500/50" },
    { value: "red",     class: "bg-red-600 hover:bg-red-500 ring-red-500/50" },
    { value: "emerald", class: "bg-emerald-600 hover:bg-emerald-500 ring-emerald-500/50" },
    { value: "purple",  class: "bg-purple-600 hover:bg-purple-500 ring-purple-500/50" },
    { value: "slate",   class: "bg-slate-700 hover:bg-slate-600 ring-slate-500/50" },
  ];

  return (
    <main class="min-h-screen bg-[#050508] p-6 lg:p-16 font-sans">
      <Show when={dashboard() === null}>
        <div class="text-center mt-32">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto mb-4 text-[#8b8b9e]"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <h1 class="text-2xl font-bold text-white mb-2">Not Found</h1>
          <p class="text-[#8b8b9e]">This dashboard does not exist or is not public.</p>
        </div>
      </Show>

      <Show when={dashboard() === undefined}>
        <div class="flex items-center justify-center min-h-screen">
          <svg class="animate-spin h-8 w-8 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
      </Show>

      <Show when={dashboard()}>
        <div class="max-w-4xl mx-auto">
          {/* Header */}
          <div class="relative pt-12 pb-8 text-center mb-10">
            <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>
            <h1 class="text-4xl font-extrabold tracking-tight text-white mb-2">{dashboard().name}</h1>
            <p class="text-[12px] font-bold tracking-widest text-[#5b5b6e] uppercase">Internal Operations</p>
          </div>

          {/* Widgets grid */}
          <div class="space-y-6">
            <Show when={(dashboard().buttons || []).length === 0}>
              <div class="text-center py-16 text-[#5b5b6e] text-sm italic">No actions available right now.</div>
            </Show>

            <For each={dashboard().buttons || []}>
              {(btn) => {
                const wf = () => workflowMap()[btn.workflowId];
                const kind = () => wf() ? lastStepType(wf()) : "grpc";

                return (
                  <Show when={kind() !== "grpc"} fallback={
                    /* ── Button widget ── */
                    (() => {
                      const state = () => executing()[btn.id] || "idle";
                      const colorConfig = colorOptions.find(c => c.value === (btn.color || "blue"));
                      const baseStyle = colorConfig ? colorConfig.class : "bg-blue-600 hover:bg-blue-500 ring-blue-500/50";

                      const btnClass = () => {
                        if (state() === "running") return "w-full py-4 px-6 text-[15px] font-bold text-white/70 rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-slate-800 cursor-not-allowed";
                        if (state() === "success") return "w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-emerald-600 ring-4 ring-emerald-500/50";
                        if (state() === "error")   return "w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-red-600 ring-4 ring-red-500/50";
                        return `w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.98] focus:ring-4 focus:outline-none ${baseStyle}`;
                      };

                      return (
                        <button onClick={() => triggerButton(btn)} disabled={state() !== "idle"} class={btnClass()}>
                          <Show when={state() === "idle"}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            <span>{btn.label}</span>
                          </Show>
                          <Show when={state() === "running"}>
                            <svg class="animate-spin h-5 w-5 text-purple-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span>Executing...</span>
                          </Show>
                          <Show when={state() === "success"}>
                            <svg class="animate-bounce h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span>Success!</span>
                          </Show>
                          <Show when={state() === "error"}>
                            <svg class="animate-pulse h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                            <span>Failed</span>
                          </Show>
                        </button>
                      );
                    })()
                  }>
                    {/* ── Table / Chart widget ── */}
                    <div class={`rounded-2xl border p-5 shadow-xl ${kind() === "table" ? "border-emerald-500/20 bg-[#0a120d]" : "border-purple-500/20 bg-[#100a14]"}`}>
                      <Show when={wf()} fallback={
                        <div class="text-[#5b5b6e] text-sm italic">Loading workflow info...</div>
                      }>
                        <AutoWidget dashboardId={params.id!} btn={btn} workflow={wf()} />
                      </Show>
                    </div>
                  </Show>
                );
              }}
            </For>
          </div>

          <div class="mt-12 text-center text-[10px] text-[#5b5b6e]">
            Powered by <span class="font-bold font-mono text-purple-400/80">solid.grpcfront</span>
          </div>
        </div>
      </Show>
    </main>
  );
}
