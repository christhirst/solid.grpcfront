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
    if (isServer) return [];
    try {
      const res = await fetch("/api/workflows");
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

  const addWidget = () => {
    setButtons([...buttons, {
      id: `btn_${Math.random().toString(36).substr(2, 9)}`,
      label: "New Widget",
      workflowId: "",
      color: "blue"
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
            <button onClick={addWidget} class="btn-secondary text-xs flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Widget
            </button>
          </div>

          <div class="space-y-4">
            <Show when={buttons.length === 0}>
              <div class="rounded-xl border border-dashed border-[#2a2a3a] py-16 text-center bg-[#0a0a0f]/50">
                <p class="text-[#8b8b9e] text-sm">No widgets yet. Click "Add Widget" to begin.</p>
              </div>
            </Show>
            <For each={buttons}>
              {(btn, index) => {
                const kind = () => widgetKind(btn);
                const kindBadgeColor = () => kind() === "grpc" ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
                  : kind() === "table" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                  : "text-purple-400 bg-purple-500/10 border-purple-500/20";

                return (
                  <div class="card p-5 relative border-l-4 border-l-purple-500 group">
                    <button
                      onClick={() => removeButton(index())}
                      class="absolute top-4 right-4 text-[#5b5b6e] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove widget"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>

                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="mb-1 block text-xs text-[#8b8b9e]">Widget Label</label>
                        <input
                          type="text"
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                          value={btn.label}
                          onInput={(e) => updateButton(index(), "label", e.currentTarget.value)}
                          placeholder="e.g. Portfolio Overview"
                        />
                      </div>
                      <div>
                        <label class="mb-1 block text-xs text-[#8b8b9e]">Color Theme</label>
                        <select
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
                          value={btn.color}
                          onChange={(e) => updateButton(index(), "color", e.currentTarget.value)}
                        >
                          <For each={colorOptions}>
                            {(c) => <option value={c.value}>{c.label}</option>}
                          </For>
                        </select>
                      </div>
                      <div class="col-span-2">
                        <label class="mb-1 block text-xs font-bold text-[#8b8b9e]">Bind to Workflow</label>
                        <select
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-sm text-emerald-300 font-mono shadow-inner focus:border-purple-500 focus:outline-none"
                          value={btn.workflowId || ""}
                          onChange={(e) => {
                            const wfId = e.currentTarget.value;
                            updateButton(index(), "workflowId", wfId);
                            
                            const wfList = workflows();
                            const wf = wfList?.find((w: any) => w.id === wfId);
                            if (wf) {
                              const vars = extractFormVariables(wf);
                              const existing = btn.formConfig || [];
                              const updated = vars.map(v => {
                                const ex = existing.find((e: any) => e.name === v);
                                return ex || { name: v, label: v, type: "string", required: true };
                              });
                              updateButton(index(), "formConfig", updated);
                            }
                          }}
                        >
                          <option value="" disabled>Select a workflow...</option>
                          <Show when={!workflows.loading}>
                            <For each={workflows()}>
                              {(w) => <option value={w.id} selected={w.id === btn.workflowId}>{w.name}</option>}
                            </For>
                          </Show>
                        </select>
                      </div>

                      {/* Form Config Editor */}
                      <Show when={btn.formConfig?.length > 0}>
                        <div class="col-span-2 mt-2 pt-4 border-t border-[#2a2a3a]/50">
                          <label class="mb-2 block text-xs font-bold text-[#8b8b9e] flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Detected Form Variables
                          </label>
                          <div class="space-y-3">
                            <For each={btn.formConfig}>
                              {(field, fIdx) => (
                                <div class="bg-[#1e1e2e]/50 p-2 rounded-lg border border-[#2a2a3a]">
                                  <div class="flex items-center gap-3">
                                    <div class="flex-1">
                                      <label class="text-[10px] text-[#5b5b6e] uppercase tracking-wider block mb-1">Variable</label>
                                      <div class="text-sm font-mono text-purple-300">{'{{'} form.{field.name} {'}}'}</div>
                                    </div>
                                    <div class="flex-1">
                                      <label class="text-[10px] text-[#5b5b6e] uppercase tracking-wider block mb-1">Label</label>
                                      <input
                                        class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white placeholder-[#5b5b6e] focus:outline-none focus:border-purple-500"
                                        value={field.label}
                                        onInput={(e) => {
                                          const copy = [...btn.formConfig];
                                          copy[fIdx()] = { ...copy[fIdx()], label: e.currentTarget.value };
                                          updateButton(index(), "formConfig", copy);
                                        }}
                                      />
                                    </div>
                                    <div class="w-24">
                                      <label class="text-[10px] text-[#5b5b6e] uppercase tracking-wider block mb-1">Type</label>
                                      <select
                                        class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                                        value={field.type}
                                        onChange={(e) => {
                                          const copy = [...btn.formConfig];
                                          copy[fIdx()] = { ...copy[fIdx()], type: e.currentTarget.value };
                                          updateButton(index(), "formConfig", copy);
                                        }}
                                      >
                                        <option value="string">String</option>
                                        <option value="number">Number</option>
                                        <option value="boolean">Boolean</option>
                                        <option value="select">Select</option>
                                      </select>
                                    </div>
                                  </div>
                                  <Show when={field.type === "select"}>
                                    <div class="mt-2 pt-2 border-t border-[#2a2a3a]/50">
                                      <label class="text-[10px] text-[#5b5b6e] uppercase tracking-wider block mb-1">Select Options (comma separated)</label>
                                      <input
                                        class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white placeholder-[#5b5b6e] focus:outline-none focus:border-purple-500"
                                        value={field.options || ""}
                                        onInput={(e) => {
                                          const copy = [...btn.formConfig];
                                          copy[fIdx()] = { ...copy[fIdx()], options: e.currentTarget.value };
                                          updateButton(index(), "formConfig", copy);
                                        }}
                                        placeholder="e.g. US, UK, Canada"
                                      />
                                    </div>
                                  </Show>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>
                      
                      {/* Widget type badge */}
                      <Show when={btn.workflowId}>
                        <div class="col-span-2">
                          <span class={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md border ${kindBadgeColor()}`}>
                            {kindLabel[kind()]}
                          </span>
                          <span class="ml-2 text-[10px] text-[#5b5b6e]">
                            Detected from the last step of the selected workflow.
                          </span>
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
                    const kind = widgetKind(btn);
                    const colorCls = colorOptions.find(c => c.value === (btn.color || "blue"))?.class || "bg-blue-600 hover:bg-blue-500";
                    if (kind === "table") {
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
                    if (kind === "chart") {
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
