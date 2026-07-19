import { createSignal, createResource, For, Show, onMount, createMemo } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { useParams, useNavigate, A } from "@solidjs/router";
import { isServer } from "solid-js/web";
import { DefaultChart } from "solid-chartjs";
import { Chart, registerables } from "chart.js";
import get from "lodash.get";

if (!isServer) {
  Chart.register(...registerables);
}

function extractFormVariables(workflow: any): string[] {
  if (!workflow) return [];
  const vars = new Set<string>();
  const regex = /\{\{\s*(?:form|dashboard_form)\.([a-zA-Z0-9_.-]+)\s*\}\}/g;
  const scanStr = (s?: string) => {
    if (!s) return;
    let m;
    // reset regex index to avoid state retention across searches
    regex.lastIndex = 0;
    while ((m = regex.exec(s)) !== null) {
      vars.add(m[1]);
    }
  };
  if (workflow.authConfig) {
    scanStr(workflow.authConfig.requestTemplate);
    scanStr(workflow.authConfig.body);
    scanStr(workflow.authConfig.url);
  }
  (workflow.steps || []).forEach((step: any) => {
    scanStr(step.requestBodyTemplate);
    scanStr(step.headersTemplate);
    scanStr(step.restUrl);
    scanStr(step.databaseName);
    scanStr(step.databaseUrl);
    scanStr(step.databaseUser);
    scanStr(step.databasePass);
    scanStr(step.databaseNs);
  });
  return Array.from(vars);
}

/** Return the type of the last meaningful step in a workflow */
function lastStepType(workflow: any): "grpc" | "table" | "chart" {
  const steps: any[] = workflow?.steps || [];
  if (!steps.length) return "grpc";
  const last = steps[steps.length - 1];
  return last?.type || "grpc";
}

export default function DashboardBuilder() {
  const params = useParams();
  const navigate = useNavigate();
  const isNew = params.id === "new";

  const [name, setName] = createSignal("New Dashboard");
  const [isPublic, setIsPublic] = createSignal(false);
  const [buttons, setButtons] = createStore<any[]>([]);

  // Fetch all workflows for dropdowns
  const [workflows] = createResource(async () => {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/workflows` : "/api/workflows";
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });

  const fetchDashboard = async () => {
    if (isNew) return;
    const res = await fetch(`/api/dashboards/${params.id}`);
    const json = await res.json();
    if (json.success && json.data) {
      setName(json.data.name || "Untitled");
      setIsPublic(json.data.isPublic || false);
      setButtons(reconcile(json.data.buttons || []));
    }
  };

  onMount(() => { fetchDashboard(); });

  const saveDashboard = async (quiet = false) => {
    const payload = {
      id: isNew ? undefined : `dashboard:${params.id}`,
      name: name(),
      isPublic: isPublic(),
      buttons: buttons,
    };

    const endpoint = isNew ? "/api/dashboards" : `/api/dashboards/${params.id}`;
    const method = isNew ? "POST" : "PUT";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (json.success) {
      if (isNew) {
        navigate(`/dashboards/${json.data.id.split(":")[1]}`);
      } else if (quiet !== true) {
        alert("Saved successfully!");
      }
    } else {
      alert("Failed to save: " + json.error);
    }
  };

  const [showWidgetPicker, setShowWidgetPicker] = createSignal(false);

  // Button execution state for builder live preview
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

  const triggerButton = async (btn: any) => {
    if (isNew) {
      alert("Please save the dashboard first before executing button actions!");
      return;
    }
    if (executing()[btn.id] === "running") return;
    setExecuting(prev => ({ ...prev, [btn.id]: "running" }));
    try {
      const payload = {
        form: formState()[btn.id] || {}
      };
      
      const res = await fetch(`/api/dashboards/${params.id}/trigger/${btn.id}`, { 
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

  const addWidget = (widgetType: "button" | "form" | "chart" | "table") => {
    setShowWidgetPicker(false);
    const labels: Record<string, string> = { button: "New Button", form: "New Form", chart: "New Chart", table: "New Table" };
    setButtons([...buttons, {
      id: `btn_${Math.random().toString(36).substr(2, 9)}`,
      label: labels[widgetType] || "New Widget",
      widgetType,
      workflowId: "",
      color: "blue",
      chartType: "bar",
      xKey: "",
      yKey: "",
      columns: "",
      formConfig: [],
    }]);
  };

  const updateButton = (index: number, key: string, value: any) => {
    setButtons(index, key, value);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const colorOptions = [
    { value: "blue",    label: "Blue",   class: "bg-blue-600 hover:bg-blue-500" },
    { value: "red",     label: "Red",    class: "bg-red-600 hover:bg-red-500" },
    { value: "emerald", label: "Green",  class: "bg-emerald-600 hover:bg-emerald-500" },
    { value: "purple",  label: "Purple", class: "bg-purple-600 hover:bg-purple-500" },
    { value: "slate",   label: "Slate",  class: "bg-slate-700 hover:bg-slate-600" },
  ];

  /** Derive last-step type for a given widget from the loaded workflows list */
  const widgetKind = (btn: any): "grpc" | "table" | "chart" => {
    const wfList = workflows();
    if (!wfList || !btn.workflowId) return "grpc";
    const wf = wfList.find((w: any) => w.id === btn.workflowId);
    return wf ? lastStepType(wf) : "grpc";
  };

  const kindLabel: Record<string, string> = {
    grpc:  "⚡ Button (triggers run)",
    table: "📊 Table (auto-refreshes)",
    chart: "📈 Chart (auto-refreshes)",
  };

  return (
    <main class="mx-auto max-w-7xl px-6 py-12">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <input
            class="bg-transparent text-3xl font-extrabold tracking-tight text-white border-none outline-none focus:ring-2 focus:ring-purple-500 rounded px-2 -ml-2 transition-all"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="Dashboard Name"
          />
        </div>
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-3 cursor-pointer mr-4">
            <span class="text-sm font-bold text-white transition-colors">Published</span>
            <div class="relative">
              <input
                type="checkbox"
                class="peer sr-only"
                checked={isPublic()}
                onChange={async (e) => {
                  setIsPublic(e.currentTarget.checked);
                  if (!isNew) await saveDashboard(true);
                }}
              />
              <div class="h-6 w-11 rounded-full bg-[#2a2a3a] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-[#8b8b9e] after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50"></div>
            </div>
          </label>
          <button onClick={() => saveDashboard(false)} class="btn-primary bg-purple-600 hover:bg-purple-500 text-white">Save Dashboard</button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Editor */}
        <div class="lg:col-span-8 space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Widget Configuration
            </h2>
            <div class="relative">
              <button onClick={() => setShowWidgetPicker(!showWidgetPicker())} class="btn-secondary text-xs flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Widget
              </button>
              <Show when={showWidgetPicker()}>
                <div class="absolute right-0 top-10 z-20 bg-[#1a1a26] border border-[#2a2a3a] rounded-xl shadow-2xl overflow-hidden w-52">
                  <div class="px-3 py-2 text-[10px] font-bold text-[#5b5b6e] uppercase tracking-wider border-b border-[#2a2a3a]">Choose Widget Type</div>
                  {([
                    { type: "button", icon: "▶", label: "Button", desc: "Trigger a workflow run", color: "text-blue-400" },
                    { type: "form",   icon: "📝", label: "Form",   desc: "Button with input fields", color: "text-purple-400" },
                    { type: "chart",  icon: "📈", label: "Chart",  desc: "Auto-load chart data", color: "text-pink-400" },
                    { type: "table",  icon: "📊", label: "Table",  desc: "Auto-load table data", color: "text-emerald-400" },
                  ] as const).map(opt => (
                    <button
                      onClick={() => addWidget(opt.type)}
                      class="w-full text-left px-4 py-3 hover:bg-[#252535] transition-colors flex items-start gap-3 border-b border-[#2a2a3a]/50 last:border-0"
                    >
                      <span class={`text-lg leading-none mt-0.5 ${opt.color}`}>{opt.icon}</span>
                      <div>
                        <div class={`text-sm font-bold ${opt.color}`}>{opt.label}</div>
                        <div class="text-[10px] text-[#5b5b6e]">{opt.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </Show>
            </div>
          </div>

          <div class="space-y-4">
            <Show when={buttons.length === 0}>
              <div class="rounded-xl border border-dashed border-[#2a2a3a] py-16 text-center bg-[#0a0a0f]/50">
                <p class="text-[#8b8b9e] text-sm">No widgets yet. Click "Add Widget" to begin.</p>
              </div>
            </Show>
            <For each={buttons}>
              {(btn, index) => {
                const wt = () => btn.widgetType || "button";
                const accentCls = () =>
                  wt() === "chart" ? "border-l-pink-500" :
                  wt() === "table" ? "border-l-emerald-500" :
                  wt() === "form"  ? "border-l-purple-500" : "border-l-blue-500";
                const typeLabel: Record<string, string> = {
                  button: "⚡ Button", form: "📝 Form", chart: "📈 Chart", table: "📊 Table"
                };
                const typeBadgeCls = () =>
                  wt() === "chart" ? "text-pink-400 bg-pink-500/10 border-pink-500/20" :
                  wt() === "table" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                  wt() === "form"  ? "text-purple-400 bg-purple-500/10 border-purple-500/20" :
                  "text-blue-400 bg-blue-500/10 border-blue-500/20";

                return (
                  <div class={`card p-5 relative border-l-4 group ${accentCls()}`}>
                    <button onClick={() => removeButton(index())} class="absolute top-4 right-4 text-[#5b5b6e] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove widget">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>

                    {/* Type badge */}
                    <div class="mb-4">
                      <span class={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeBadgeCls()}`}>{typeLabel[wt()]}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                      {/* Label — always */}
                      <div>
                        <label class="mb-1 block text-xs text-[#8b8b9e]">Label</label>
                        <input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none" value={btn.label} onInput={(e) => updateButton(index(), "label", e.currentTarget.value)} placeholder="Widget label" />
                      </div>

                      {/* Color — button/form only */}
                      <Show when={wt() === "button" || wt() === "form"}>
                        <div>
                          <label class="mb-1 block text-xs text-[#8b8b9e]">Color</label>
                          <select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none" value={btn.color} onChange={(e) => updateButton(index(), "color", e.currentTarget.value)}>
                            <For each={colorOptions}>{(c) => <option value={c.value}>{c.label}</option>}</For>
                          </select>
                        </div>
                      </Show>

                      {/* Workflow binding — always */}
                      <div class="col-span-2">
                        <label class="mb-1 block text-xs font-bold text-[#8b8b9e]">Bind to Workflow</label>
                        <select class="w-full rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-sm text-emerald-300 font-mono shadow-inner focus:border-purple-500 focus:outline-none"
                          value={btn.workflowId || ""}
                          onChange={(e) => {
                            const wfId = e.currentTarget.value;
                            updateButton(index(), "workflowId", wfId);
                            if (wt() === "button" || wt() === "form") {
                              const wf = workflows()?.find((w: any) => w.id === wfId);
                              if (wf) {
                                const vars = extractFormVariables(wf);
                                const existing = btn.formConfig || [];
                                const updated = vars.map((v: string) =>
                                  existing.find((e: any) => e.name === v) || { name: v, label: v, type: "string", required: true }
                                );
                                updateButton(index(), "formConfig", updated);
                              }
                            }
                          }}>
                          <option value="" disabled>Select a workflow...</option>
                          <Show when={!workflows.loading}>
                            <For each={workflows()}>{(w) => <option value={w.id} selected={w.id === btn.workflowId}>{w.name}</option>}</For>
                          </Show>
                        </select>
                      </div>

                      {/* ── Chart config ── */}
                      <Show when={wt() === "chart"}>
                        <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 grid grid-cols-3 gap-3">
                          <div>
                            <label class="mb-1 block text-xs text-[#8b8b9e]">Chart Type</label>
                            <select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-pink-500 focus:outline-none" value={btn.chartType || "bar"} onChange={(e) => updateButton(index(), "chartType", e.currentTarget.value)}>
                              <option value="bar">Bar</option>
                              <option value="line">Line</option>
                              <option value="pie">Pie</option>
                              <option value="doughnut">Doughnut</option>
                              <option value="scatter">Scatter</option>
                            </select>
                          </div>
                          <div>
                            <label class="mb-1 block text-xs text-[#8b8b9e]">X-Axis Field</label>
                            <input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-pink-500 focus:outline-none" placeholder="e.g. date" value={btn.xKey || ""} onInput={(e) => updateButton(index(), "xKey", e.currentTarget.value)} />
                          </div>
                          <div>
                            <label class="mb-1 block text-xs text-[#8b8b9e]">Y-Axis Field</label>
                            <input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-pink-500 focus:outline-none" placeholder="e.g. value" value={btn.yKey || ""} onInput={(e) => updateButton(index(), "yKey", e.currentTarget.value)} />
                          </div>
                        </div>
                      </Show>

                      {/* ── Table config ── */}
                      <Show when={wt() === "table"}>
                        <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50">
                          <label class="mb-1 block text-xs text-[#8b8b9e]">Columns <span class="text-[#5b5b6e]">(comma-separated, blank = all)</span></label>
                          <input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none" placeholder="e.g. name, status, amount" value={btn.columns || ""} onInput={(e) => updateButton(index(), "columns", e.currentTarget.value)} />
                        </div>
                      </Show>

                      {/* ── Form/Button fields ── */}
                      <Show when={wt() === "button" || wt() === "form"}>
                        <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50">
                          <div class="flex items-center justify-between mb-2">
                            <label class="text-xs font-bold text-[#8b8b9e] flex items-center gap-1.5">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                              Form Fields
                            </label>
                            <button onClick={() => {
                              const copy = [...(btn.formConfig || [])];
                              copy.push({ name: `field_${Date.now()}`, label: "New Field", type: "string", required: false });
                              updateButton(index(), "formConfig", copy);
                            }} class="text-[10px] px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 border border-purple-500/20 transition-colors">+ Add Field</button>
                          </div>

                          {/* Auto-detect hint */}
                          <Show when={btn.workflowId && btn.formConfig?.length > 0}>
                            <div class="mb-2 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 flex items-center gap-1.5">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                              Fields auto-detected from <code class="font-mono text-blue-200">{`{{ form.* }}`}</code> variables in the workflow. You can edit or add more.
                            </div>
                          </Show>
                          <Show when={btn.workflowId && (!btn.formConfig || btn.formConfig.length === 0)}>
                            <div class="mb-2 px-2 py-1.5 rounded-lg bg-[#1e1e2e] border border-dashed border-[#2a2a3a] text-[10px] text-[#5b5b6e] flex items-center gap-1.5">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                              No <code class="font-mono">{`{{ form.* }}`}</code> variables found — no required fields. Add fields manually if needed.
                            </div>
                          </Show>

                          <Show when={(btn.formConfig || []).length > 0}>
                            <div class="space-y-2">
                              <For each={btn.formConfig}>
                                {(field: any, fIdx) => (
                                  <div class="bg-[#1e1e2e]/50 p-2 rounded-lg border border-[#2a2a3a]">
                                    <div class="flex items-center gap-2">
                                      <div class="flex-1">
                                        <label class="text-[10px] text-[#5b5b6e] block mb-0.5">Variable</label>
                                        <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs font-mono text-purple-300 focus:outline-none focus:border-purple-500" value={field.name}
                                          onInput={(e) => { const c=[...btn.formConfig]; c[fIdx()]={...c[fIdx()],name:e.currentTarget.value}; updateButton(index(),"formConfig",c); }} />
                                      </div>
                                      <div class="flex-1">
                                        <label class="text-[10px] text-[#5b5b6e] block mb-0.5">Label</label>
                                        <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500" value={field.label}
                                          onInput={(e) => { const c=[...btn.formConfig]; c[fIdx()]={...c[fIdx()],label:e.currentTarget.value}; updateButton(index(),"formConfig",c); }} />
                                      </div>
                                      <div class="w-20">
                                        <label class="text-[10px] text-[#5b5b6e] block mb-0.5">Type</label>
                                        <select class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-1 py-1 text-xs text-white focus:outline-none focus:border-purple-500" value={field.type}
                                          onChange={(e) => { const c=[...btn.formConfig]; c[fIdx()]={...c[fIdx()],type:e.currentTarget.value}; updateButton(index(),"formConfig",c); }}>
                                          <option value="string">String</option>
                                          <option value="number">Number</option>
                                          <option value="boolean">Boolean</option>
                                          <option value="select">Select</option>
                                        </select>
                                      </div>
                                      <button onClick={() => { const c=btn.formConfig.filter((_:any,i:number)=>i!==fIdx()); updateButton(index(),"formConfig",c); }} class="text-[#5b5b6e] hover:text-red-400 mt-3 shrink-0">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                      </button>
                                    </div>
                                    <Show when={field.type === "select"}>
                                      <div class="mt-2 pt-2 border-t border-[#2a2a3a]/50">
                                        <label class="text-[10px] text-[#5b5b6e] block mb-0.5">Options (comma-separated)</label>
                                        <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500" value={field.options||""}
                                          onInput={(e)=>{ const c=[...btn.formConfig]; c[fIdx()]={...c[fIdx()],options:e.currentTarget.value}; updateButton(index(),"formConfig",c); }} placeholder="e.g. US, UK, Canada" />
                                      </div>
                                    </Show>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>


        {/* Live Preview */}
        <div class="lg:col-span-4 pl-0 lg:pl-4 border-t lg:border-t-0 lg:border-l border-[#2a2a3a]/50 pt-8 lg:pt-0">
          <h2 class="text-sm font-bold text-[#8b8b9e] mb-4 tracking-wider uppercase flex items-center justify-between">
            Live Preview
            <Show when={isPublic() && !isNew}>
              <A href={`/p/${params.id}`} target="_blank" class="text-xs text-blue-400 hover:underline flex items-center gap-1 normal-case tracking-normal">
                Open Public Link
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </A>
            </Show>
          </h2>

          <div class="bg-[#0a0a0f] rounded-2xl border border-[#2a2a3a] overflow-hidden min-h-[400px] shadow-2xl relative">
            {/* Fake browser header */}
            <div class="bg-[#1e1e2e] px-4 py-3 flex items-center gap-2 border-b border-[#2a2a3a]">
              <div class="flex gap-1.5">
                <div class="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div class="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <div class="mx-auto bg-[#0a0a0f] text-center rounded-md px-24 py-1 text-[10px] text-[#5b5b6e] font-mono truncate hidden sm:block">
                {isPublic() && !isNew ? `/p/${params.id}` : `Draft: ${name()}`}
              </div>
            </div>

            {/* Board render */}
            <div class="p-6">
              <h1 class="text-xl font-bold text-white mb-6 text-center">{name() || "Untitled Dashboard"}</h1>
              <div class="flex flex-col gap-3">
                <Show when={buttons.length === 0}>
                  <div class="text-center text-[#5b5b6e] text-xs py-10 border border-dashed border-[#2a2a3a] rounded-lg">Widgets will appear here</div>
                </Show>
                <For each={buttons}>
                  {(btn) => {
                    const wtype = btn.widgetType || widgetKind(btn);
                    const colorCls = colorOptions.find(c => c.value === (btn.color || "blue"))?.class || "bg-blue-600 hover:bg-blue-500";
                    if (wtype === "table" || wtype === "chart") {
                      return (
                        <PreviewWidget btn={btn} />
                      );
                    }
                    const state = () => executing()[btn.id] || "idle";
                    const btnClass = () => {
                      if (state() === "running") return "w-full py-4 px-6 text-[15px] font-bold text-white/70 rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-slate-800 cursor-not-allowed";
                      if (state() === "success") return "w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-emerald-600 ring-4 ring-emerald-500/50";
                      if (state() === "error")   return "w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 bg-red-600 ring-4 ring-red-500/50";
                      return `w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.98] focus:ring-4 focus:outline-none ${colorCls}`;
                    };

                    return (
                      <Show when={btn.formConfig && btn.formConfig.length > 0} fallback={
                        <button 
                          onClick={() => triggerButton(btn)} 
                          disabled={state() !== "idle"} 
                          class={btnClass()}
                        >
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
                      }>
                        <div class="rounded-2xl border border-[#2a2a3a] bg-[#0e0e15] p-5 shadow-xl space-y-4 text-left">
                          <div class="flex items-center gap-2 pb-2 border-b border-[#2a2a3a]">
                            <span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                            <h3 class="text-sm font-bold text-white">{btn.label}</h3>
                          </div>
                          
                          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                            <For each={btn.formConfig}>
                              {(field: any) => {
                                const val = () => (formState()[btn.id] || {})[field.name];
                                return (
                                  <div class="col-span-1">
                                    <label class="block text-xs font-bold text-[#8b8b9e] mb-1.5">{field.label}</label>
                                    <Show when={field.type === "boolean"}>
                                      <label class="flex items-center gap-3 cursor-pointer py-1.5">
                                        <input
                                          type="checkbox"
                                          class="w-4 h-4 rounded border-[#2a2a3a] bg-[#1e1e2e] text-purple-500 focus:ring-purple-500/50"
                                          checked={!!val()}
                                          onChange={(e) => updateForm(btn.id, field.name, e.currentTarget.checked)}
                                        />
                                        <span class="text-sm text-white">Enable</span>
                                      </label>
                                    </Show>
                                    <Show when={field.type === "select"}>
                                      <select
                                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
                                        value={val() || ""}
                                        onChange={(e) => updateForm(btn.id, field.name, e.currentTarget.value)}
                                      >
                                        <option value="" disabled>Select an option...</option>
                                        <For each={(field.options || "").split(",").map((o: string) => o.trim()).filter(Boolean)}>
                                          {(opt) => <option value={opt}>{opt}</option>}
                                        </For>
                                      </select>
                                    </Show>
                                    <Show when={field.type !== "boolean" && field.type !== "select"}>
                                      <input
                                        type={field.type === "number" ? "number" : "text"}
                                        required={field.required}
                                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
                                        value={val() || ""}
                                        onInput={(e) => updateForm(btn.id, field.name, field.type === "number" ? Number(e.currentTarget.value) : e.currentTarget.value)}
                                        placeholder={`Enter ${field.label}...`}
                                      />
                                    </Show>
                                  </div>
                                );
                              }}
                            </For>
                          </div>

                          <div class="pt-2">
                            <button
                              onClick={() => triggerButton(btn)}
                              disabled={state() !== "idle"}
                              class={btnClass()}
                            >
                              <Show when={state() === "idle"}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                <span>Execute {btn.label}</span>
                              </Show>
                              <Show when={state() === "running"}>
                                <svg class="animate-spin h-4 w-4 text-purple-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>Running...</span>
                              </Show>
                              <Show when={state() === "success"}>
                                <svg class="animate-bounce h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                <span>Success!</span>
                              </Show>
                              <Show when={state() === "error"}>
                                <svg class="animate-pulse h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                <span>Failed</span>
                              </Show>
                            </button>
                          </div>
                        </div>
                      </Show>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Live Preview Helper Components and Functions ─────────────────────────────

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

function extractLastStep(logs: any[]): { data: any[]; meta: any } {
  if (!logs.length) return { data: [], meta: {} };
  const last = [...logs].reverse().find(l => l.status === "success" && (l.stepType === "table" || l.stepType === "chart"));
  if (!last) {
    const fallback = [...logs].reverse().find(l => l.status === "success");
    if (!fallback) return { data: [], meta: {} };
    const raw = fallback.response;
    return { data: Array.isArray(raw) ? raw : (raw ? [raw] : []), meta: fallback.meta || {} };
  }
  const raw = last.response;
  return { data: Array.isArray(raw) ? raw : (raw ? [raw] : []), meta: last.meta || {} };
}

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
    <div class="overflow-auto max-h-[250px] rounded-xl border border-[#2a2a3a]/60 bg-[#0a0a0f]">
      <Show when={rows().length > 0} fallback={<div class="p-4 text-xs text-[#5a5a6e]">No table data</div>}>
        <table class="w-full text-left text-xs text-[#c8c8d8]">
          <thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0">
            <tr>
              <For each={effectiveCols()}>
                {(col) => (
                  <th class="px-3 py-2 font-semibold border-b border-[#2a2a3e] whitespace-nowrap uppercase text-[9px] tracking-wider">
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
                      return <td class="px-3 py-1.5 border-b border-[#1e1e2e]/50 max-w-[150px] truncate" title={text}>{text}</td>;
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

function DashChart(props: { data: any[]; xKey?: string; yKey?: string; chartType?: string }) {
  const cType = () => props.chartType || "bar";

  const buildData = () => {
    const data = normalizeDataArray(props.data);
    if (!Array.isArray(data) || !data.length) return { labels: [], datasets: [] };
    
    const type = cType();
    const isPie = type === "pie" || type === "doughnut";
    const isScatter = type === "scatter";
    const isBar = type === "bar";
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
    <div class="h-[200px] bg-[#101015] p-3 rounded border border-[#2a2a3a]/50">
      <Show when={normalizeDataArray(props.data).length > 0} fallback={<p class="text-xs text-[#5a5a6e]">No valid array data for chart</p>}>
        {/* @ts-ignore */}
        <DefaultChart type={cType() as any} data={buildData()} options={chartOptions()} />
      </Show>
    </div>
  );
}

function PreviewWidget(props: { btn: any }) {
  const [status, setStatus] = createSignal<"idle" | "loading" | "ready" | "error">("idle");
  const [data, setData] = createSignal<any[]>([]);
  const [meta, setMeta] = createSignal<any>({});
  const [error, setError] = createSignal("");

  const loadPreview = async () => {
    if (!props.btn.workflowId) return;
    setStatus("loading");
    setError("");

    try {
      const res = await fetch(`/api/workflows/${props.btn.workflowId.split(":")[1]}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: {} })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to start workflow");

      await pollRun(
        json.runId,
        (logs) => {
          const { data: stepData, meta: stepMeta } = extractLastStep(logs);
          setData(stepData);
          setMeta(stepMeta);
          setStatus("ready");
        },
        (msg) => {
          setError(msg);
          setStatus("error");
        }
      );
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  };

  const kind = props.btn.widgetType;

  return (
    <div class="w-full rounded-xl border border-[#2a2a3a] bg-[#0e0e15] p-3 shadow-md text-left">
      <div class="flex items-center justify-between mb-2 pb-1.5 border-b border-[#2a2a3a]">
        <h3 class={`text-[10px] font-bold uppercase tracking-wider ${kind === "table" ? "text-emerald-400" : "text-purple-400"}`}>
          {kind === "table" ? "📊 Table Preview" : "📈 Chart Preview"}: {props.btn.label}
        </h3>
        <div class="flex items-center gap-2">
          <Show when={status() === "loading"}>
            <svg class="animate-spin h-3 w-3 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </Show>
          <button 
            onClick={loadPreview} 
            disabled={status() === "loading" || !props.btn.workflowId}
            class="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 border border-blue-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status() === "idle" ? "Load Data" : "Refresh"}
          </button>
        </div>
      </div>

      <Show when={status() === "idle"}>
        <div class="text-center py-4 text-[10px] text-[#5b5b6e] italic">
          {props.btn.workflowId ? 'Click "Load Data" to fetch preview' : 'Please bind a workflow first'}
        </div>
      </Show>

      <Show when={status() === "loading"}>
        <div class="space-y-1.5 py-3">
          <div class="h-3 rounded bg-[#1e1e2e] animate-pulse"></div>
          <div class="h-3 rounded bg-[#1e1e2e] animate-pulse w-4/5"></div>
        </div>
      </Show>

      <Show when={status() === "error"}>
        <div class="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-[10px] text-red-400">
          ✗ {error()}
        </div>
      </Show>

      <Show when={status() === "ready"}>
        <Show when={kind === "table"}>
          <DashTable 
            data={data()} 
            columns={props.btn.columns ? props.btn.columns.split(",").map((c: string) => c.trim()).filter(Boolean) : meta().columns} 
          />
        </Show>
        <Show when={kind === "chart"}>
          <DashChart
            data={data()}
            xKey={props.btn.xKey || meta().xKey}
            yKey={props.btn.yKey || meta().yKey}
            chartType={props.btn.chartType || meta().chartType || "bar"}
          />
        </Show>
      </Show>
    </div>
  );
}
