import { createSignal, createResource, For, Show, onMount, createMemo, createEffect } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { useParams, useNavigate, A } from "@solidjs/router";
import { isServer } from "solid-js/web";
import { DefaultChart } from "solid-chartjs";
import { Chart, registerables } from "chart.js";
import * as ChartGeo from "chartjs-chart-geo";
import get from "lodash.get";

if (!isServer) {
  Chart.register(...registerables);
  Chart.register(
    ChartGeo.ChoroplethController,
    ChartGeo.GeoFeature,
    ChartGeo.ColorScale,
    ChartGeo.ProjectionScale
  );
}

import { extractFormVariables, checkWidgetVariablesConfigured } from "~/lib/workflowVariableChecker";


import { evaluateNewsRules, newsColorClasses, type NewsRule } from "~/lib/newsRulesEvaluator";


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

  const addWidget = (widgetType: "button" | "form" | "chart" | "table" | "news" | "toggle" | "infographic") => {
    setShowWidgetPicker(false);
    const labels: Record<string, string> = {
      button: "New Button",
      form: "New Form",
      chart: "New Chart",
      table: "New Table",
      news: "News Alert Feed",
      toggle: "Toggle Switch",
      infographic: "New Infographic",
    };
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
      dataPath: "",
      streamActive: true,
      newsRules: [
        { id: "rule_1", operator: "contains", value: "error", color: "red", textTemplate: "CRITICAL: {{ value }}" },
        { id: "rule_2", operator: "contains", value: "ok", color: "emerald", textTemplate: "NORMAL: {{ value }}" },
        { id: "rule_3", operator: "default", value: "", color: "blue", textTemplate: "NEWS: {{ value }}" },
      ],
      onLabel: "ACTIVE",
      offLabel: "INACTIVE",
      formVarName: "toggle_state",
      defaultChecked: false,
      infographicSyntax: "",
      infographicTemplate: "list-row-simple-horizontal-arrow",
      infographicEditable: false,
    }]);
  };


  const updateButton = (index: number, ...args: any[]) => {
    setButtons(index, ...(args as any));
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
                    { type: "news",   icon: "📰", label: "News Alert", desc: "IF/ELSE color & text news feed", color: "text-amber-400" },
                    { type: "toggle", icon: "🎛️", label: "Toggle Switch", desc: "Interactive ON/OFF workflow switch", color: "text-cyan-400" },
                    { type: "infographic", icon: "🦋", label: "Infographic", desc: "Rich SVG infographic from AntV", color: "text-rose-400" },
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
                  wt() === "form"  ? "border-l-purple-500" : wt() === "infographic" ? "border-l-rose-500" : "border-l-blue-500";
                const typeLabel: Record<string, string> = {
                  button: "⚡ Button", form: "📝 Form", chart: "📈 Chart", table: "📊 Table", infographic: "🦋 Infographic"
                };
                const typeBadgeCls = () =>
                  wt() === "chart" ? "text-pink-400 bg-pink-500/10 border-pink-500/20" :
                  wt() === "table" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                  wt() === "form"  ? "text-purple-400 bg-purple-500/10 border-purple-500/20" :
                  wt() === "infographic" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" :
                  "text-blue-400 bg-blue-500/10 border-blue-500/20";

                const boundWf = createMemo(() => workflows()?.find((w: any) => w.id === btn.workflowId));
                const varStatus = createMemo(() => checkWidgetVariablesConfigured(boundWf(), btn.formConfig));

                return (
                  <div class={`card p-5 relative border-l-4 group overflow-hidden ${accentCls()}`}>
                    {/* Translucent top color: light red if variables exist & not all configured, light green if all configured */}
                    <Show when={varStatus().hasVariables}>
                      <div
                        class={`absolute top-0 left-0 right-0 h-12 rounded-t-2xl pointer-events-none transition-colors border-b ${
                          varStatus().allConfigured
                            ? "bg-emerald-500/20 border-emerald-500/30"
                            : "bg-red-500/20 border-red-500/30"
                        }`}
                      />
                    </Show>

                    <button onClick={() => removeButton(index())} class="absolute top-4 right-4 text-[#5b5b6e] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10" title="Remove widget">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>

                    {/* Type badge & workflow variable status badge */}
                    <div class="mb-4 flex items-center justify-between relative z-10">
                      <span class={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeBadgeCls()}`}>{typeLabel[wt()]}</span>
                      <Show when={varStatus().hasVariables}>
                        <span
                          class={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                            varStatus().allConfigured
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-red-500/20 text-red-300 border-red-500/40"
                          }`}
                        >
                          {varStatus().allConfigured ? "✓ All Vars Configured" : "⚠️ Vars Unconfigured"}
                        </span>
                      </Show>
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
                              <option value="timeline">⟳ Timeline</option>
                              <option value="choropleth-us">US Choropleth Map</option>
                              <option value="choropleth-world">World Choropleth Map</option>
                            </select>
                          </div>
                          <div>
                            <label class="mb-1 block text-xs text-[#8b8b9e]">
                              {btn.chartType?.startsWith("choropleth") ? "Region Field (State/Country)" : btn.chartType === "timeline" ? "Date/Year Field" : "X-Axis Field"}
                            </label>
                            <input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-pink-500 focus:outline-none" placeholder={btn.chartType?.startsWith("choropleth") ? "e.g. state" : btn.chartType === "timeline" ? "e.g. year" : "e.g. date"} value={btn.xKey || ""} onInput={(e) => updateButton(index(), "xKey", e.currentTarget.value)} />
                          </div>
                          <div>
                            <label class="mb-1 block text-xs text-[#8b8b9e]">
                              {btn.chartType?.startsWith("choropleth") ? "Value Field" : btn.chartType === "timeline" ? "Title/Header Field" : "Y-Axis Field"}
                            </label>
                            <input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-pink-500 focus:outline-none" placeholder={btn.chartType === "timeline" ? "e.g. header" : "e.g. value"} value={btn.yKey || ""} onInput={(e) => updateButton(index(), "yKey", e.currentTarget.value)} />
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
                                          onInput={(e) => { updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, name: e.currentTarget.value })); }} />
                                      </div>
                                      <div class="flex-1">
                                        <label class="text-[10px] text-[#5b5b6e] block mb-0.5">Label</label>
                                        <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500" value={field.label}
                                          onInput={(e) => { updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, label: e.currentTarget.value })); }} />
                                      </div>
                                      <div class="flex-1">
                                        <label class="text-[10px] text-[#5b5b6e] block mb-0.5">Saved Value</label>
                                        <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-emerald-300 font-mono focus:outline-none focus:border-purple-500" value={field.value ?? field.defaultValue ?? ""} placeholder="Default value"
                                          onInput={(e) => { updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, value: e.currentTarget.value, defaultValue: e.currentTarget.value })); }} />
                                      </div>
                                      <div class="w-20">
                                        <label class="text-[10px] text-[#5b5b6e] block mb-0.5">Type</label>
                                        <select class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-1 py-1 text-xs text-white focus:outline-none focus:border-purple-500" value={field.type}
                                          onChange={(e) => { updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, type: e.currentTarget.value })); }}>
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
                                          onInput={(e)=>{ updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, options: e.currentTarget.value })); }} placeholder="e.g. US, UK, Canada" />
                                      </div>
                                    </Show>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                      </Show>

                      {/* ── News Widget config ── */}
                      <Show when={wt() === "news"}>
                        <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 space-y-3">
                          <div class="flex items-center justify-between">
                            <label class="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                              📰 News Rules (IF / ELSE Conditions)
                            </label>
                            <button
                              onClick={() => {
                                const rules = [...(btn.newsRules || [])];
                                rules.push({ id: `rule_${Date.now()}`, operator: "equals", value: "ok", color: "emerald", textTemplate: "Status: {{ value }}" });
                                updateButton(index(), "newsRules", rules);
                              }}
                              class="text-[10px] px-2 py-0.5 rounded bg-amber-600/20 text-amber-300 hover:bg-amber-600/40 border border-amber-500/30"
                            >
                              + Add Rule
                            </button>
                          </div>

                          <div class="grid grid-cols-2 gap-2">
                            <div>
                              <label class="text-[10px] text-[#5b5b6e] block mb-0.5">Variable Data Path</label>
                              <input
                                class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:border-amber-500"
                                value={btn.dataPath || ""}
                                onInput={(e) => updateButton(index(), "dataPath", e.currentTarget.value)}
                                placeholder="e.g. steps.step_1.response"
                              />
                            </div>
                            <div class="flex items-center gap-2 pt-4">
                              <input
                                type="checkbox"
                                id={`stream_${btn.id}`}
                                checked={btn.streamActive !== false}
                                onChange={(e) => updateButton(index(), "streamActive", e.currentTarget.checked)}
                                class="rounded bg-[#0a0a0f] border-[#2a2a3a] text-amber-500"
                              />
                              <label for={`stream_${btn.id}`} class="text-xs text-amber-200 cursor-pointer">
                                Subscribe to Live Stream SSE
                              </label>
                            </div>
                          </div>

                          <div class="space-y-2">
                            <For each={btn.newsRules || []}>
                              {(rule: any, rIdx) => (
                                <div class="bg-[#1e1e2e]/60 p-2 rounded-lg border border-[#2a2a3a] space-y-1.5">
                                  <div class="flex items-center gap-2">
                                    <span class="text-[10px] font-mono text-amber-400 w-6">IF</span>
                                    <select
                                      class="bg-[#0a0a0f] border border-[#2a2a3a] rounded px-1.5 py-1 text-xs text-white focus:border-amber-500"
                                      value={rule.operator}
                                      onChange={(e) => {
                                        updateButton(index(), "newsRules", rIdx(), (r: any) => ({ ...r, operator: e.currentTarget.value }));
                                      }}
                                    >
                                      <option value="contains">Contains</option>
                                      <option value="equals">Equals</option>
                                      <option value="gt">Greater Than (&gt;)</option>
                                      <option value="lt">Less Than (&lt;)</option>
                                      <option value="regex">Regex</option>
                                      <option value="default">ELSE (Default)</option>
                                    </select>
                                    <Show when={rule.operator !== "default"}>
                                      <input
                                        class="flex-1 bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:border-amber-500"
                                        placeholder="Matching value..."
                                        value={rule.value}
                                        onInput={(e) => {
                                          updateButton(index(), "newsRules", rIdx(), (r: any) => ({ ...r, value: e.currentTarget.value }));
                                        }}
                                      />
                                    </Show>
                                    <select
                                      class="bg-[#0a0a0f] border border-[#2a2a3a] rounded px-1.5 py-1 text-xs text-white focus:border-amber-500"
                                      value={rule.color}
                                      onChange={(e) => {
                                        updateButton(index(), "newsRules", rIdx(), (r: any) => ({ ...r, color: e.currentTarget.value }));
                                      }}
                                    >
                                      <option value="emerald">Green</option>
                                      <option value="red">Red</option>
                                      <option value="amber">Amber</option>
                                      <option value="blue">Blue</option>
                                      <option value="purple">Purple</option>
                                      <option value="slate">Slate</option>
                                    </select>
                                    <button
                                      onClick={() => {
                                        const copy = (btn.newsRules || []).filter((_: any, i: number) => i !== rIdx());
                                        updateButton(index(), "newsRules", copy);
                                      }}
                                      class="text-[#5b5b6e] hover:text-red-400"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <div>
                                    <input
                                      class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-amber-200 focus:border-amber-500"
                                      placeholder="Text template e.g. CRITICAL: {{ value }}"
                                      value={rule.textTemplate || ""}
                                      onInput={(e) => {
                                        const copy = [...(btn.newsRules || [])];
                                        copy[rIdx()] = { ...copy[rIdx()], textTemplate: e.currentTarget.value };
                                        updateButton(index(), "newsRules", copy);
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      </Show>

                      {/* ── Toggle Switch Widget config ── */}
                      <Show when={wt() === "toggle"}>
                        <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 grid grid-cols-2 gap-3">
                          <div>
                            <label class="text-[10px] text-[#5b5b6e] block mb-0.5">ON Label</label>
                            <input
                              class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-emerald-400 focus:border-cyan-500"
                              value={btn.onLabel || "ON"}
                              onInput={(e) => updateButton(index(), "onLabel", e.currentTarget.value)}
                            />
                          </div>
                          <div>
                            <label class="text-[10px] text-[#5b5b6e] block mb-0.5">OFF Label</label>
                            <input
                              class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-slate-400 focus:border-cyan-500"
                              value={btn.offLabel || "OFF"}
                              onInput={(e) => updateButton(index(), "offLabel", e.currentTarget.value)}
                            />
                          </div>
                          <div>
                            <label class="text-[10px] text-[#5b5b6e] block mb-0.5">Form Variable Name</label>
                            <input
                              class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-purple-300 font-mono focus:border-cyan-500"
                              value={btn.formVarName || "toggle_state"}
                              onInput={(e) => updateButton(index(), "formVarName", e.currentTarget.value)}
                              placeholder="e.g. toggle_state"
                            />
                          </div>
                          <div class="flex items-center gap-2 pt-4">
                            <input
                              type="checkbox"
                              id={`def_${btn.id}`}
                              checked={btn.defaultChecked || false}
                              onChange={(e) => updateButton(index(), "defaultChecked", e.currentTarget.checked)}
                              class="rounded bg-[#0a0a0f] border-[#2a2a3a] text-cyan-500"
                            />
                            <label for={`def_${btn.id}`} class="text-xs text-cyan-200 cursor-pointer">
                              Default Checked ON
                            </label>
                          </div>
                        </div>
                      </Show>
                      {/* ── Infographic Widget config ── */}
                      <Show when={wt() === "infographic"}>
                        <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 space-y-3">
                          <div>
                            <label class="mb-1 block text-xs text-[#8b8b9e]">Template Preset</label>
                            <select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-xs text-white focus:border-rose-500 focus:outline-none"
                              value={btn.infographicTemplate || "list-row-simple-horizontal-arrow"}
                              onChange={(e) => {
                                const tmpl = e.currentTarget.value;
                                updateButton(index(), "infographicTemplate", tmpl);
                                if (!btn.infographicSyntax) {
                                  const presets: Record<string, string> = {
                                    "list-row-simple-horizontal-arrow": `infographic list-row-simple-horizontal-arrow\ndata\n  title ${btn.label || "My Infographic"}\n  lists\n    - label Step 1\n      desc First step\n    - label Step 2\n      desc Second step\n    - label Step 3\n      desc Third step`,
                                    "list-row-horizontal-icon-arrow": `infographic list-row-horizontal-icon-arrow\ndata\n  title ${btn.label || "Process Flow"}\n  lists\n    - label Phase 1\n      value 25\n      desc Planning\n      icon mdi/lightbulb-outline\n    - label Phase 2\n      value 50\n      desc Development\n      icon mdi/code-braces\n    - label Phase 3\n      value 100\n      desc Launch\n      icon mdi/rocket-launch`,
                                    "list-column": `infographic list-column\ndata\n  title ${btn.label || "Items"}\n  lists\n    - label Item A\n      desc Description A\n    - label Item B\n      desc Description B\n    - label Item C\n      desc Description C`,
                                    "compare": `infographic compare\ndata\n  title ${btn.label || "Comparison"}\n  lists\n    - label Option A\n      desc First option details\n    - label Option B\n      desc Second option details`,
                                  };
                                  if (presets[tmpl]) updateButton(index(), "infographicSyntax", presets[tmpl]);
                                }
                              }}>
                              <option value="list-row-simple-horizontal-arrow">Step Flow (Arrows)</option>
                              <option value="list-row-horizontal-icon-arrow">Step Flow (Icons)</option>
                              <option value="list-column">List (Vertical)</option>
                              <option value="list-row">List (Horizontal)</option>
                              <option value="compare">Compare</option>
                              <option value="hierarchy">Hierarchy / Org Chart</option>
                              <option value="relation">Relation Map</option>
                              <option value="sequence">Sequence / Timeline</option>
                            </select>
                          </div>
                          <div>
                            <label class="mb-1 flex items-center justify-between text-xs text-[#8b8b9e]">
                              <span>Infographic Syntax (DSL)</span>
                              <span class="text-[9px] text-rose-400/70 font-mono">antv/infographic</span>
                            </label>
                            <textarea
                              class="w-full rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-3 text-xs text-rose-200 font-mono focus:border-rose-500 focus:outline-none resize-y"
                              rows="10"
                              placeholder={`infographic list-row-simple-horizontal-arrow\ndata\n  title My Title\n  lists\n    - label Item 1\n      desc Description`}
                              value={btn.infographicSyntax || ""}
                              onInput={(e) => updateButton(index(), "infographicSyntax", e.currentTarget.value)}
                            />
                            <p class="mt-1 text-[9px] text-[#5b5b6e]">Write infographic DSL syntax, or bind a workflow that returns syntax as its output.</p>
                          </div>
                          <div class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`editable_${btn.id}`}
                              checked={btn.infographicEditable || false}
                              onChange={(e) => updateButton(index(), "infographicEditable", e.currentTarget.checked)}
                              class="rounded bg-[#0a0a0f] border-[#2a2a3a] text-rose-500"
                            />
                            <label for={`editable_${btn.id}`} class="text-xs text-rose-200 cursor-pointer">
                              Enable built-in editor (interactive)
                            </label>
                          </div>
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
                    if (wtype === "news") {
                      return <NewsWidgetComponent btn={btn} dashboardId={params.id} />;
                    }
                    if (wtype === "infographic") {
                      return <InfographicWidget syntax={btn.infographicSyntax} editable={btn.infographicEditable} />;
                    }
                    if (wtype === "toggle") {
                      return <ToggleWidgetComponent btn={btn} dashboardId={params.id} formState={formState()} updateForm={updateForm} triggerButton={triggerButton} />;
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

// ─── Inline Timeline widget ──────────────────────────────────────────────────
const TIMELINE_IMPORTANCE_COLOR: Record<number, string> = {
  1: "#4a5273", 2: "#2dd4bf", 3: "#6c63ff", 4: "#f59e0b", 5: "#f472b6"
};

function DashTimeline(props: { data: any[]; xKey?: string; yKey?: string }) {
  let vpRef!: HTMLDivElement;
  let canvasRef!: HTMLDivElement;

  const rows = () => normalizeDataArray(props.data);

  // Map each row to a timeline event
  const events = () => rows().map((row, i) => {
    const xk = props.xKey || "year";
    const yk = props.yKey || "header";
    const rawYear = row && typeof row === "object" ? get(row, xk) : row;
    const header  = row && typeof row === "object" ? get(row, yk) : String(row);
    const text    = row && typeof row === "object" ? (get(row, "text") || get(row, "description") || "") : "";
    const imp     = row && typeof row === "object" ? (Number(get(row, "importance") || get(row, "rating") || 3)) : 3;
    const link    = row && typeof row === "object" ? (get(row, "link") || get(row, "url") || "") : "";
    const date    = row && typeof row === "object" ? (get(row, "date") || String(rawYear)) : String(rawYear);
    const year    = Number(rawYear) || i;
    return { year, header: String(header || "Event"), text: String(text), importance: Math.min(5, Math.max(1, imp)), link: String(link), date: String(date) };
  });

  let scale = 1;
  let offsetX = 0;
  const BASE_PX = 80;
  const AXIS_Y = 140;
  let isPanning = false;
  let panStartX = 0;
  let panStartOX = 0;

  const yearToX = (y: number) => y * BASE_PX;

  const render = () => {
    if (!canvasRef || !vpRef) return;
    // clear dynamic children
    while (canvasRef.children.length > 1) canvasRef.removeChild(canvasRef.lastChild!);

    const evs = events();
    if (!evs.length) return;

    const years = evs.map(e => e.year);
    const minY = Math.min(...years);
    const maxY = Math.max(...years);
    const pad = 200;
    const canvasL = yearToX(minY) - pad;
    const canvasR = yearToX(maxY) + pad;
    const canvasW = Math.max(canvasR - canvasL, 600);

    canvasRef.style.width  = canvasW + "px";
    canvasRef.style.height = vpRef.clientHeight + "px";

    // axis
    const axis = canvasRef.querySelector(".tl-axis") as HTMLElement;
    if (axis) { axis.style.top = AXIS_Y + "px"; axis.style.width = canvasW + "px"; }

    const cx = (year: number) => yearToX(year) - canvasL;

    // ticks
    const range = maxY - minY;
    let interval = range > 2000 ? 500 : range > 500 ? 100 : range > 100 ? 50 : 10;
    for (let y = Math.floor(minY / interval) * interval - interval; y <= maxY + interval; y += interval) {
      const tick = document.createElement("div");
      tick.className = "tl-tick";
      tick.style.cssText = `position:absolute;left:${cx(y)}px;top:${AXIS_Y - 10}px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none;`;
      tick.innerHTML = `<div style="width:1px;height:10px;background:#2d3356"></div><div style="font-size:9px;color:#4a5273;margin-top:2px;white-space:nowrap">${y < 0 ? Math.abs(y) + " BCE" : y === 0 ? "0" : y + " CE"}</div>`;
      canvasRef.appendChild(tick);
    }

    // events
    const sorted = [...evs].sort((a, b) => a.year - b.year);
    sorted.forEach((ev, i) => {
      const above = i % 2 === 0;
      const x = cx(ev.year);
      const color = TIMELINE_IMPORTANCE_COLOR[ev.importance] || "#6c63ff";
      const stemH = ev.importance * 20 + 20;
      const node = document.createElement("div");
      node.style.cssText = `position:absolute;left:${x}px;${above ? `bottom:${vpRef.clientHeight - AXIS_Y}px` : `top:${AXIS_Y}px`};transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;cursor:pointer;`;

      const stemEl = document.createElement("div");
      stemEl.style.cssText = `width:2px;height:${stemH}px;background:linear-gradient(${above ? "to top" : "to bottom"},${color},transparent);flex-shrink:0;order:${above ? 0 : 1}`;

      const dot = document.createElement("div");
      dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};flex-shrink:0;order:${above ? 1 : 2};transition:transform 0.15s`;

      // label below dot (or above)
      const label = document.createElement("div");
      label.style.cssText = `position:absolute;${above ? `bottom:${stemH + 12}px` : `top:${stemH + 12}px`};left:50%;transform:translateX(-50%);background:#1a1e35;border:1px solid #2d3356;border-radius:8px;padding:6px 10px;width:160px;font-size:10px;color:#e2e8f0;pointer-events:none;opacity:0;transition:opacity 0.2s;z-index:10;box-shadow:0 4px 16px rgba(0,0,0,0.5);`;
      label.innerHTML = `<div style="font-size:9px;font-weight:700;color:${color};margin-bottom:3px">${ev.date}</div><div style="font-weight:600;margin-bottom:4px;line-height:1.3">${ev.header}</div>${ev.text ? `<div style="font-size:9px;color:#8892b0;line-height:1.5;margin-bottom:4px">${ev.text.slice(0,120)}${ev.text.length>120?"…":""}</div>` : ""}${ev.link ? `<a href="${ev.link}" target="_blank" style="font-size:9px;color:#a78bfa;text-decoration:none">→ Link</a>` : ""}`;

      node.addEventListener("mouseenter", () => { dot.style.transform = "scale(1.6)"; label.style.opacity = "1"; });
      node.addEventListener("mouseleave", () => { dot.style.transform = "scale(1)"; label.style.opacity = "0"; });

      node.appendChild(above ? stemEl : dot);
      node.appendChild(above ? dot : stemEl);
      node.appendChild(label);
      canvasRef.appendChild(node);
    });

    applyTransform();
  };

  const applyTransform = () => {
    if (!canvasRef) return;
    canvasRef.style.transform = `scale(${scale}) translate(${offsetX}px,0)`;
  };

  const centreView = () => {
    if (!vpRef || !events().length) return;
    const evs = events();
    const years = evs.map(e => e.year);
    const minY = Math.min(...years);
    const maxY = Math.max(...years);
    const pad = 200;
    const canvasL = yearToX(minY) - pad;
    const mid = yearToX((minY + maxY) / 2) - canvasL;
    offsetX = vpRef.clientWidth / (2 * scale) - mid;
    render();
  };

  onMount(() => {
    centreView();

    vpRef.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.min(8, Math.max(0.05, scale * factor));
      const pivot = (e.clientX - vpRef.getBoundingClientRect().left) / scale - offsetX;
      scale = newScale;
      offsetX = (e.clientX - vpRef.getBoundingClientRect().left) / scale - pivot;
      render();
    }, { passive: false });

    let panning2 = false, panStart2 = 0, panOX2 = 0;
    vpRef.addEventListener("mousedown", (e) => { if (e.button !== 0) return; panning2 = true; panStart2 = e.clientX; panOX2 = offsetX; vpRef.style.cursor = "grabbing"; });
    window.addEventListener("mousemove", (e) => { if (!panning2) return; offsetX = panOX2 + (e.clientX - panStart2) / scale; applyTransform(); });
    window.addEventListener("mouseup", () => { panning2 = false; vpRef.style.cursor = "grab"; });
  });

  return (
    <div style="position:relative;height:300px;background:#0d0f17;border-radius:10px;overflow:hidden;border:1px solid #2d3356">
      <div
        ref={vpRef}
        style="width:100%;height:100%;overflow:hidden;cursor:grab;position:relative"
      >
        <div ref={canvasRef} class="tl-canvas" style="position:absolute;transform-origin:0 0">
          <div class="tl-axis" style="position:absolute;left:0;height:2px;background:linear-gradient(90deg,transparent,#6c63ff 5%,#6c63ff 95%,transparent);box-shadow:0 0 12px rgba(108,99,255,0.4)"></div>
        </div>
      </div>
      <div style="position:absolute;bottom:6px;right:10px;font-size:9px;color:#4a5273;pointer-events:none">Scroll to zoom · Drag to pan</div>
    </div>
  );
}

function DashChart(props: { data: any[]; xKey?: string; yKey?: string; chartType?: string }) {
  const cType = () => props.chartType || "bar";
  const [topoJson, setTopoJson] = createSignal<any>(null);

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
    
    const type = cType();
    const isPie = type === "pie" || type === "doughnut";
    const isScatter = type === "scatter";
    const isBar = type === "bar";

    if (type.startsWith("choropleth")) {
      const isUS = type === "choropleth-us";
      const topo = topoJson();
      if (!topo) return { labels: [], datasets: [] };

      const features = isUS
        ? ChartGeo.topojson.feature(topo, topo.objects.states).features
        : ChartGeo.topojson.feature(topo, topo.objects.countries).features;

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
    const type = cType();
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
      plugins: { legend: { labels: { color: "#c8c8d8" } } },
      scales: isPie ? {} : {
        x: { grid: { color: "#2a2a3e" }, ticks: { color: "#8b8b9e" } },
        y: { grid: { color: "#2a2a3e" }, ticks: { color: "#8b8b9e" } },
      },
    };
  };

  return (
    <div class="bg-[#101015] p-3 rounded border border-[#2a2a3a]/50" style={cType() === "timeline" ? "" : "height:200px"}>
      <Show when={cType() === "timeline"} fallback={
        <Show when={normalizeDataArray(props.data).length > 0} fallback={<p class="text-xs text-[#5a5a6e]">No valid array data for chart</p>}>
          <Show when={!cType().startsWith("choropleth") || topoJson()} fallback={<p class="text-xs text-[#8b8b9e] animate-pulse">Loading map assets...</p>}>
            {/* @ts-ignore */}
            <DefaultChart type={cType().startsWith("choropleth") ? "choropleth" : (cType() as any)} data={buildData()} options={chartOptions()} />
          </Show>
        </Show>
      }>
        <DashTimeline data={props.data} xKey={props.xKey} yKey={props.yKey} />
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
          {kind === "table" ? "📊 Table Preview" : kind === "infographic" ? "🦋 Infographic Preview" : "📈 Chart Preview"}: {props.btn.label}
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
        <Show when={kind === "chart" && (props.btn.chartType || "bar") !== "timeline"}>
          <DashChart
            data={data()}
            xKey={props.btn.xKey || meta().xKey}
            yKey={props.btn.yKey || meta().yKey}
            chartType={props.btn.chartType || meta().chartType || "bar"}
          />
        </Show>
        <Show when={kind === "chart" && props.btn.chartType === "timeline"}>
          <DashTimeline
            data={data()}
            xKey={props.btn.xKey || meta().xKey}
            yKey={props.btn.yKey || meta().yKey}
          />
        </Show>
        <Show when={kind === "infographic"}>
          <InfographicWidget syntax={props.btn.infographicSyntax} data={data()} editable={props.btn.infographicEditable} />
        </Show>
      </Show>
    </div>
  );
}

function NewsWidgetComponent(props: { btn: any; dashboardId?: string }) {
  const [data, setData] = createSignal<any>("No Data");
  const [status, setStatus] = createSignal<"idle" | "loading" | "live" | "error">("idle");

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
    }
  });

  const fetchManual = async () => {
    if (!props.btn.workflowId) return;
    const wfId = props.btn.workflowId.includes(":") ? props.btn.workflowId.split(":")[1] : props.btn.workflowId;
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

// ─── Infographic Widget (AntV @antv/infographic) ──────────────────────────────

function InfographicWidget(props: { syntax?: string; data?: any; editable?: boolean; height?: string }) {
  let containerRef!: HTMLDivElement;
  let instance: any = null;

  const getSyntax = () => {
    // Prefer explicit syntax prop; if data is a string, treat it as syntax
    if (props.syntax) return props.syntax;
    if (typeof props.data === "string") return props.data;
    return "";
  };

  onMount(async () => {
    if (isServer) return;
    try {
      const mod = await import("@antv/infographic");
      const Infographic = mod.Infographic || mod.default;
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
