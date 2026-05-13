import { createSignal, createResource, For, Show, onMount, createMemo } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { useParams, useNavigate, A } from "@solidjs/router";
import { isServer } from "solid-js/web";

function extractFormVariables(workflow: any): string[] {
  if (!workflow) return [];
  const vars = new Set<string>();
  const regex = /\{\{\s*form\.([a-zA-Z0-9_.-]+)\s*\}\}/g;
  const scanStr = (s?: string) => {
    if (!s) return;
    let m;
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
    scanStr(step.databaseName);
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
                    if (wtype === "table") {
                      return (
                        <div class="rounded-xl border border-emerald-500/30 bg-[#0e1a15] p-3">
                          <p class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M3 15h18M9 3v18"></path></svg>
                            {btn.label} — Table
                          </p>
                          <div class="text-[10px] text-[#5b5b6e] italic">Auto-loads table on open</div>
                        </div>
                      );
                    }
                    if (wtype === "chart") {
                      return (
                        <div class="rounded-xl border border-purple-500/30 bg-[#120e1a] p-3">
                          <p class="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                            {btn.label} — Chart
                          </p>
                          <div class="text-[10px] text-[#5b5b6e] italic">Auto-loads chart on open</div>
                        </div>
                      );
                    }
                    return (
                      <button class={`w-full py-4 text-sm font-bold text-white rounded-xl shadow-lg transition-transform hover:-translate-y-1 active:translate-y-0 ${colorCls}`}>
                        {btn.label}
                      </button>
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
