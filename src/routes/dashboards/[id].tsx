import { createSignal, For, Show, onMount, onCleanup, createMemo, createEffect, Index, lazy, Suspense } from "solid-js";
import { createClientResource } from "~/lib/clientResource";
import { createStore, reconcile } from "solid-js/store";
import { useParams, useNavigate, A } from "@solidjs/router";
import { isServer } from "solid-js/web";

import {
  extractFormVariables,
  checkWidgetVariablesConfigured,
  extractUpstreamVariables,
  detectStepVariables,
  buildFormFieldFromVariable,
} from "~/lib/workflowVariableChecker";
import { FORM_VALIDATOR_OPTIONS, formatValidatorBadge, type FormValidatorType } from "~/lib/formValidator";
import DashboardGrid, { getDefaultWidgetDimensions } from "~/components/dashboard/DashboardGrid";
import { DashboardButtonFormWidget } from "~/components/dashboard/DashboardButtonFormWidget";
import { DashboardPublicButtonFormWidget } from "~/components/dashboard/DashboardPublicWidget";
import { DashboardSurveyWidget } from "~/components/dashboard/DashboardSurveyWidget";
import { SurveyBuilderEditor } from "~/components/dashboard/SurveyBuilderEditor";
import { useFormSequence } from "~/components/dashboard/useFormSequence";
import { createDefaultSurveyConfig } from "~/lib/dashboard/surveyEngine";
import { useWidgetOutcome } from "~/components/dashboard/useWidgetOutcome";
import { applyWidgetConditions, defaultEffectiveConfig } from "~/lib/dashboard/widgetConditions";
import { resolveChartSeries, effectiveChartType, SERIES_COLORS, MULTI_SERIES_TYPES } from "~/lib/dashboard/chartSeries";
import type { ChartSeriesConfig, ChartSeriesType } from "~/lib/dashboard/widgetTypes";
import { DashTable } from "~/components/dashboard/widgets/DashTable";
import { NewsWidgetComponent } from "~/components/dashboard/widgets/NewsWidget";
import { extractLastStep, pollRun } from "~/lib/dashboard/runPolling";
import { TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { dashboardId } from "~/lib/dashboard/boardTypes";
import { publicDashboardPath, slugFromName, SLUG_MAX_LENGTH, urlPartError } from "~/lib/dashboard/publicUrl";
import { ResourceTagEditor } from "~/components/ResourceTagEditor";
import { ActionMessageBanner, type ActionMessage } from "~/components/ui/ActionMessageBanner";


import type { NewsRule } from "~/lib/newsRulesEvaluator";

const DashChart = lazy(() => import("~/components/dashboard/widgets/DashChart"));
const DashTimeline = lazy(() => import("~/components/dashboard/widgets/DashTimeline"));


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
  const isNew = () => params.id === "new";

  const [name, setName] = createSignal("New Dashboard");
  const [description, setDescription] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [contentTags, setContentTags] = createSignal<string[]>([]);
  const [tagInput, setTagInput] = createSignal("");
  const [tagSuggestions, setTagSuggestions] = createSignal<string[]>([]);
  const [showTagDropdown, setShowTagDropdown] = createSignal(false);
  const [isPublic, setIsPublic] = createSignal(false);
  const [namespace, setNamespace] = createSignal("");
  const [availableNamespaces, setAvailableNamespaces] = createSignal<
    { name: string; ownerType: "user" | "group"; ownerGroup?: string | null; canPublish: boolean }[]
  >([]);
  const [customSlug, setCustomSlug] = createSignal<string>();
  const slug = createMemo(() => customSlug() ?? slugFromName(name()));
  const [savedPath, setSavedPath] = createSignal("");
  const [savedPublished, setSavedPublished] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal("");
  const [actionMessage, setActionMessage] = createSignal<ActionMessage | null>(null);
  const [profileLoading, setProfileLoading] = createSignal(true);
  const [origin, setOrigin] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const previewPath = () => `/p/${namespace() || "your-namespace"}/${slug() || "dashboard-name"}`;
  const urlSaved = () => savedPublished() && savedPath() === previewPath();
  const [buttons, setButtons] = createStore<any[]>([]);
  const [activeTab, setActiveTab] = createSignal<"config" | "arrange">("config");

  const handleLayoutChange = (newLayout: Array<{ id: string; x: number; y: number; w: number; h: number }>) => {
    const map = new Map(newLayout.map((item) => [item.id, item]));
    const updated = buttons.map((btn) => {
      const pos = map.get(btn.id);
      if (pos) {
        return { ...btn, x: pos.x, y: pos.y, w: pos.w, h: pos.h };
      }
      return btn;
    });
    setButtons(reconcile(updated));
  };

  const autoPackLayout = () => {
    let curX = 0;
    let curY = 0;
    const updated = buttons.map((btn) => {
      const hasExpanded = !!(btn.showOutput || (btn.outputConfig && btn.outputConfig.length > 0) || (btn.formConfig && btn.formConfig.length > 0));
      const dims = getDefaultWidgetDimensions(btn.widgetType, hasExpanded);
      const w = dims.w;
      const h = dims.h;
      if (curX + w > 12) {
        curX = 0;
        curY += 4;
      }
      const res = { ...btn, x: curX, y: curY, w, h };
      curX += w;
      return res;
    });
    setButtons(reconcile(updated));
  };

  // Fetch all workflows for dropdowns
  const [workflows, { refetch: refetchWorkflows }] = createClientResource(
    () => (isServer ? false : true),
    async (shouldFetch) => {
      if (!shouldFetch) return [];
      try {
        const res = await fetch("/api/workflows", { credentials: "include" });
        const json = await res.json();
        return json.success && Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    },
    { initialValue: [] }
  );

  const fetchDashboard = async () => {
    if (isNew()) return;
    const res = await fetch(`/api/dashboards/${params.id}`);
    const json = await res.json();
    if (json.success && json.data) {
      setName(json.data.name || "Untitled");
      setIsPublic(json.data.isPublic || false);
      setSavedPublished(json.data.isPublic || false);
      setCustomSlug(json.data.slug || undefined);
      if (json.data.namespace) setNamespace(json.data.namespace);
      setSavedPath(publicDashboardPath(json.data));
      setButtons(reconcile(json.data.buttons || []));
      setDescription(json.data.description || "");
      setTags(json.data.tags || []);
      setContentTags(json.data.content_tags || []);
    }
  };

  const loadUserNamespaces = async () => {
    try {
      const response = await fetch("/api/user/profile");
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to load your namespace.");
      const list = Array.isArray(json.data.namespaces)
        ? json.data.namespaces.filter((n: any) => n.canPublish)
        : [];
      setAvailableNamespaces(list);
      if (!namespace()) {
        setNamespace(json.data.namespace || list[0]?.name || "");
      }
    } catch (error: any) {
      setSaveError(error.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadAllExistingContentTags = async () => {
    try {
      const res = await fetch("/api/dashboards/tags");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTagSuggestions(json.data);
      }
    } catch {
      // Ignore
    }
  };

  const addContentTag = (rawTag: string) => {
    const clean = rawTag.trim().replace(/^#+/, "");
    if (!clean) return;
    const current = contentTags();
    if (!current.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setContentTags([...current, clean]);
    }
    setTagInput("");
    setShowTagDropdown(false);
  };

  const removeContentTag = (tagToRemove: string) => {
    setContentTags(contentTags().filter((t) => t !== tagToRemove));
  };

  onMount(() => {
    refetchWorkflows();
    loadAllExistingContentTags();
    const handleWorkflowsRefresh = () => {
      refetchWorkflows();
      loadUserNamespaces();
    };
    window.addEventListener("user-groups-changed", handleWorkflowsRefresh);
    window.addEventListener("focus", handleWorkflowsRefresh);

    fetchDashboard().catch(() => setSaveError("Unable to load this dashboard."));
    setOrigin(window.location.origin);
    loadUserNamespaces();
    const onNamespaceChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ namespace?: string; namespaces?: any[] }>).detail || {};
      if (Array.isArray(detail.namespaces)) {
        setAvailableNamespaces(detail.namespaces.filter((n: any) => n.canPublish));
      } else {
        loadUserNamespaces();
      }
      if (detail.namespace && !namespace()) {
        setNamespace(detail.namespace);
      }
      setSaveError("");
      setCopied(false);
    };
    window.addEventListener("user-namespace-changed", onNamespaceChanged);
    onCleanup(() => {
      window.removeEventListener("user-groups-changed", handleWorkflowsRefresh);
      window.removeEventListener("focus", handleWorkflowsRefresh);
      window.removeEventListener("user-namespace-changed", onNamespaceChanged);
    });
  });

  const saveDashboard = async (quiet = false) => {
    if (saving() || profileLoading()) return false;
    setSaveError("");
    if (isPublic() && !namespace()) {
      setSaveError("Set a namespace in your user settings before publishing.");
      window.dispatchEvent(new Event("open-user-settings"));
      return false;
    }
    const validation = urlPartError(slug(), "Dashboard URL");
    if ((slug() || isPublic()) && validation) { setSaveError(validation); return false; }
    const payload = {
      id: isNew() ? undefined : `dashboard:${params.id}`,
      name: name(),
      description: description(),
      namespace: namespace() || undefined,
      isPublic: isPublic(),
      slug: slug(),
      content_tags: contentTags(),
      buttons: buttons,
    };

    const endpoint = isNew() ? "/api/dashboards" : `/api/dashboards/${params.id}`;
    const method = isNew() ? "POST" : "PUT";

    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Unable to save dashboard.");
      setCustomSlug(json.data.slug || undefined);
      setNamespace(json.data.namespace || namespace());
      setSavedPath(publicDashboardPath(json.data));
      setSavedPublished(json.data.isPublic === true);
      setCopied(false);
      window.dispatchEvent(new CustomEvent("user-groups-changed"));
      if (isNew()) {
        navigate(`/dashboards/${dashboardId(json.data.id)}`);
      } else if (quiet !== true) {
        setActionMessage({ type: "success", text: "Dashboard saved successfully." });
        setTimeout(() => {
          setActionMessage((prev) => (prev?.type === "success" ? null : prev));
        }, 3000);
      }
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unable to save dashboard.";
      setSaveError(errMsg);
      setActionMessage({ type: "error", text: errMsg });
      setTimeout(() => {
        setActionMessage((prev) => (prev?.type === "error" ? null : prev));
      }, 5000);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const copyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(`${origin()}${savedPath()}`);
      setCopied(true);
    } catch {
      setSaveError("Unable to copy. You can select and copy the URL below.");
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
    const bIdx = buttons.findIndex((b: any) => b.id === btnId);
    if (bIdx !== -1 && Array.isArray(buttons[bIdx]?.formConfig)) {
      const fIdx = buttons[bIdx].formConfig.findIndex((f: any) => f.name === field);
      if (fIdx !== -1) {
        setButtons(bIdx, "formConfig", fIdx, (f: any) => ({ ...f, value, defaultValue: value }));
      }
    }
  };

  const previewSequence = useFormSequence(() => buttons, {
    onClearForms: (ids) => {
      setFormState((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
    },
  });

  const triggerButton = async (
    btn: any,
    effectiveWorkflowId?: string,
    overrideForm?: Record<string, any>,
    extraBody?: Record<string, any>
  ) => {
    if (isNew()) {
      setActionMessage({ type: "error", text: "Please save the dashboard first before executing button actions!" });
      return;
    }
    if (executing()[btn.id] === "running") return;
    setExecuting(prev => ({ ...prev, [btn.id]: "running" }));
    try {
      const payload: Record<string, any> = {
        form: { ...previewSequence.carriedAnswers(btn), ...(overrideForm ?? formState()[btn.id] ?? {}) },
        ...(extraBody || {}),
      };
      if (effectiveWorkflowId) payload.workflowId = effectiveWorkflowId;
      if (btn.widgetType === "survey" || btn.sequenceConfig?.hideOnSubmit) payload.ephemeral = true;

      const res = await fetch(`/api/dashboards/${params.id}/trigger/${btn.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setExecuting(prev => ({ ...prev, [btn.id]: "success" }));
        setTimeout(() => setExecuting(prev => ({ ...prev, [btn.id]: "idle" })), 2500);
        return json;
      } else {
        const errMsg = json.error || "Action failed";
        setActionMessage({ type: "error", text: `Action failed: ${errMsg}` });
        setExecuting(prev => ({ ...prev, [btn.id]: "error" }));
        setTimeout(() => setExecuting(prev => ({ ...prev, [btn.id]: "idle" })), 2500);
        return json;
      }
    } catch (e: any) {
      const errMsg = e.message || "Network or Server error";
      setActionMessage({ type: "error", text: `Network or Server error: ${errMsg}` });
      setExecuting(prev => ({ ...prev, [btn.id]: "error" }));
      setTimeout(() => setExecuting(prev => ({ ...prev, [btn.id]: "idle" })), 2500);
      return { success: false, error: e.message };
    }
  };

  const addWidget = (widgetType: "button" | "form" | "survey" | "chart" | "table" | "news" | "toggle" | "infographic") => {
    setShowWidgetPicker(false);
    const labels: Record<string, string> = {
      button: "New Button",
      form: "New Form",
      survey: "New Survey",
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
      formConfig: widgetType === "form" ? [{ name: "input", label: "Input", type: "string", required: false }] : [],
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
      surveyConfig: widgetType === "survey" ? createDefaultSurveyConfig() : undefined,
    }]);
  };


  const updateButton = (index: number, ...args: any[]) => {
    (setButtons as any)(index, ...args);
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
    chart: "📈 Chart (visualizer)",
  };

  function ConditionalPreviewWrapper(props: { btn: any; dashboardId?: string; children: any }) {
    const hasRules = () => (props.btn?.conditionRules || []).length > 0;
    const outcome = useWidgetOutcome(props.dashboardId, props.btn);
    const effective = () => (hasRules() ? applyWidgetConditions(props.btn, outcome().data) : { hidden: false });

    return (
      <Show when={!effective().hidden}>
        {props.children}
      </Show>
    );
  }

  const renderLiveWidget = (btn: any) => {
    const wtype = btn.widgetType || widgetKind(btn);
      if (wtype === "table" || wtype === "chart") {
      return (
        <ConditionalPreviewWrapper btn={btn} dashboardId={params.id}>
          <PreviewWidget btn={btn} dashboardId={params.id} />
        </ConditionalPreviewWrapper>
      );
    }
    if (wtype === "news") {
      return (
        <ConditionalPreviewWrapper btn={btn} dashboardId={params.id}>
          <NewsWidgetComponent btn={btn} dashboardId={params.id} />
        </ConditionalPreviewWrapper>
      );
    }
    if (wtype === "infographic") {
      return (
        <ConditionalPreviewWrapper btn={btn} dashboardId={params.id}>
          <InfographicWidget syntax={btn.infographicSyntax} editable={btn.infographicEditable} />
        </ConditionalPreviewWrapper>
      );
    }
    if (wtype === "toggle") {
      return (
        <ConditionalPreviewWrapper btn={btn} dashboardId={params.id}>
          <ToggleWidgetComponent btn={btn} dashboardId={params.id} formState={formState()} updateForm={updateForm} triggerButton={triggerButton} />
        </ConditionalPreviewWrapper>
      );
    }

    if (wtype === "survey") {
      return (
        <DashboardSurveyWidget
          btn={btn}
          dashboardId={params.id}
          isPreview={isNew()}
          onTriggerStep={
            isNew()
              ? undefined
              : (payload, workflowId, stepId) =>
                  triggerButton(btn, workflowId, payload, { surveyStepId: stepId, ephemeral: true })
          }
          onTriggerFinal={
            isNew()
              ? undefined
              : (payload, workflowId) => triggerButton(btn, workflowId, payload, { ephemeral: true })
          }
        />
      );
    }
    if (wtype === "__chain_complete__") {
      return (
        <div class="w-full h-full rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 flex flex-col items-center justify-center gap-3 text-center">
          <div class="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300">✓</div>
          <p class="text-sm text-white font-semibold">{btn.message}</p>
          <Show when={btn.allowRestart}>
            <button type="button" onClick={() => previewSequence.resetChain(btn.rootId)} class="min-h-[44px] px-5 rounded-xl border border-[#2a2a3a] bg-[#1e1e2e] text-sm font-semibold text-[#c4c4d4] hover:bg-[#2a2a3a] transition-colors">
              Start Again
            </button>
          </Show>
        </div>
      );
    }

    return (
      <DashboardPublicButtonFormWidget
        btn={btn}
        dashboardId={params.id!}
        executing={executing()}
        formState={formState()}
        updateForm={updateForm}
        triggerButton={triggerButton}
        onSubmitSuccess={(submitted) => previewSequence.handleSubmitSuccess(btn, submitted)}
      />
    );
  };

  return (
    <main class="mx-auto max-w-7xl 2xl:max-w-[90rem] px-4 sm:px-6 py-12">
      <div class="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="min-w-0 flex-1">
          <input
            class="bg-transparent text-3xl font-extrabold tracking-tight text-white border-none outline-none focus:ring-2 focus:ring-purple-500 rounded px-2 -ml-2 transition-all w-full"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="Dashboard Name"
          />
          <div class="mt-2 ml-0">
            <textarea
              class="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300 placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-colors resize-none"
              rows={2}
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              placeholder="Add a description for this dashboard..."
            />
          </div>

          {/* Descriptive Content Tags with Auto-suggestions */}
          <div class="mt-3 relative">
            <div class="flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-2 focus-within:border-purple-500/80 focus-within:ring-1 focus-within:ring-purple-500/40 transition-colors">
              <span class="text-xs font-semibold uppercase tracking-wider text-purple-400 pl-1 pr-1 flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                Tags:
              </span>
              <For each={contentTags()}>
                {(tag) => (
                  <span class="inline-flex items-center gap-1 rounded-lg border border-purple-500/40 bg-purple-500/15 px-2 py-0.5 text-xs font-medium text-purple-200">
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeContentTag(tag)}
                      class="text-purple-400 hover:text-white transition-colors"
                      title="Remove tag"
                    >
                      ×
                    </button>
                  </span>
                )}
              </For>
              <div class="relative flex-1 min-w-[140px]">
                <input
                  type="text"
                  value={tagInput()}
                  onFocus={() => setShowTagDropdown(true)}
                  onBlur={() => setTimeout(() => setShowTagDropdown(false), 200)}
                  onInput={(e) => {
                    setTagInput(e.currentTarget.value);
                    setShowTagDropdown(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addContentTag(tagInput());
                    } else if (e.key === "Backspace" && !tagInput() && contentTags().length > 0) {
                      removeContentTag(contentTags()[contentTags().length - 1]);
                    } else if (e.key === "Escape") {
                      setShowTagDropdown(false);
                    }
                  }}
                  placeholder={contentTags().length === 0 ? "Add tags (e.g. GDP, Germany, Yearly, Profit)..." : "Add more tags..."}
                  class="w-full bg-transparent px-2 py-0.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                />

                {/* Auto-suggestion Dropdown */}
                <Show when={showTagDropdown()}>
                  {(() => {
                    const q = tagInput().trim().toLowerCase();
                    const existing = new Set(contentTags().map((t) => t.toLowerCase()));
                    const filtered = tagSuggestions().filter(
                      (s) => !existing.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q))
                    );
                    const canCreateNew = q && !tagSuggestions().some((s) => s.toLowerCase() === q);

                    return (
                      <Show when={filtered.length > 0 || canCreateNew}>
                        <div class="absolute left-0 top-full mt-1.5 z-50 w-64 max-h-48 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-1.5">
                          <Show when={canCreateNew}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                addContentTag(tagInput());
                              }}
                              class="w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 flex items-center justify-between"
                            >
                              <span>+ Create tag <strong>"{tagInput().trim()}"</strong></span>
                              <span class="text-[10px] text-zinc-500">New</span>
                            </button>
                          </Show>
                          <For each={filtered}>
                            {(suggestion) => (
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  addContentTag(suggestion);
                                }}
                                class="w-full text-left rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center justify-between"
                              >
                                <span>{suggestion}</span>
                                <span class="text-[10px] text-zinc-500">existing</span>
                              </button>
                            )}
                          </For>
                        </div>
                      </Show>
                    );
                  })()}
                </Show>
              </div>
            </div>
            <p class="mt-1 text-[11px] text-zinc-500 pl-1">
              Descriptive content tags are visible to everyone in the Public Dashboard Library to discover and cross-filter data.
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <TabsList>
          <TabsTrigger
            active={activeTab() === "config"}
            onClick={() => setActiveTab("config")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Configure
          </TabsTrigger>
          <TabsTrigger
            active={activeTab() === "arrange"}
            onClick={() => setActiveTab("arrange")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Arrange Layout (GridStack)
          </TabsTrigger>
        </TabsList>

        <div class="flex items-center gap-4">
          <label class="flex items-center gap-3 cursor-pointer mr-2">
            <span class="text-sm font-bold text-white transition-colors">Published</span>
            <div class="relative">
              <input
                type="checkbox"
                class="peer sr-only"
                checked={isPublic()}
                disabled={saving() || profileLoading()}
                onChange={async (e) => {
                  const next = e.currentTarget.checked;
                  if (next && !namespace()) {
                    e.currentTarget.checked = false;
                    setSaveError("Set a namespace in your user settings before publishing.");
                    window.dispatchEvent(new Event("open-user-settings"));
                    return;
                  }
                  const previous = isPublic();
                  setIsPublic(next);
                  if (!isNew() && !(await saveDashboard(true))) setIsPublic(previous);
                }}
              />
              <div class="h-6 w-11 rounded-full bg-[#2a2a3a] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-[#8b8b9e] after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50"></div>
            </div>
          </label>
          <button disabled={saving() || profileLoading()} onClick={() => saveDashboard(false)} class="btn-primary bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50">{saving() ? "Saving…" : "Save Dashboard"}</button>
        </div>
      </div>

      <ActionMessageBanner message={actionMessage()} onClose={() => setActionMessage(null)} />

      <section aria-label="Published dashboard URL" class="mb-8 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div class="sm:w-72">
            <div class="mb-1 flex items-center justify-between">
              <label for="dashboard-namespace-select" class="block text-sm font-semibold text-zinc-300">
                Namespace
              </label>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("open-user-settings"))}
                class="text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors"
              >
                Manage namespaces…
              </button>
            </div>
            <Show
              when={availableNamespaces().length > 0 || namespace()}
              fallback={
                <Button
                  type="button"
                  variant="secondary"
                  class="w-full justify-between"
                  disabled={profileLoading() || saving()}
                  onClick={() => window.dispatchEvent(new Event("open-user-settings"))}
                >
                  <span class="truncate">Create a namespace…</span>
                  <span aria-hidden="true">✎</span>
                </Button>
              }
            >
              <select
                id="dashboard-namespace-select"
                value={namespace()}
                disabled={profileLoading() || saving()}
                onChange={(e) => {
                  setNamespace(e.currentTarget.value);
                  setSaveError("");
                  setCopied(false);
                }}
                class="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 font-mono text-sm text-white focus:border-purple-500 focus:outline-none"
              >
                <Show
                  when={
                    namespace() &&
                    !availableNamespaces().some((n) => n.name === namespace())
                  }
                >
                  <option value={namespace()}>@{namespace()}</option>
                </Show>
                <For each={availableNamespaces()}>
                  {(ns) => (
                    <option value={ns.name}>
                      @{ns.name}{" "}
                      {ns.ownerType === "group" && ns.ownerGroup
                        ? `(group: ${ns.ownerGroup})`
                        : "(personal)"}
                    </option>
                  )}
                </For>
              </select>
            </Show>
          </div>
          <div class="min-w-0 flex-1">
            <label for="dashboard-url-slug" class="mb-1 block text-sm font-semibold text-zinc-300">Dashboard URL name</label>
            <Input id="dashboard-url-slug" value={slug()} disabled={saving()} maxLength={SLUG_MAX_LENGTH} placeholder="production-overview" spellcheck={false}
              aria-describedby="dashboard-url-help" onInput={(event) => { setCustomSlug(event.currentTarget.value.toLowerCase().trim()); setCopied(false); }} />
          </div>
          <Button type="button" variant="secondary" disabled={!urlSaved() || saving()} onClick={copyPublicUrl}>{copied() ? "Copied!" : "Copy link"}</Button>
        </div>
        <p id="dashboard-url-help" class="text-xs text-zinc-400">Use lowercase letters, numbers, and hyphens. The URL name must be unique within your namespace.</p>
        <p class="break-all font-mono text-sm text-purple-300 select-all">{origin()}{previewPath()}</p>
        <Show when={!urlSaved()}><p class="text-xs text-zinc-400">Save and publish to use this URL.</p></Show>
        <Show when={saveError()}><p role="alert" class="text-sm text-rose-400">{saveError()}</p></Show>
      </section>

      <Show when={activeTab() === "config"}>
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Editor */}
        <div class="min-w-0 lg:col-span-8 space-y-6">
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
                    { type: "survey", icon: "📋", label: "Survey / Wizard", desc: "Multi-step sequential forms", color: "text-indigo-400" },
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

          <div class="flex min-w-0 flex-col gap-8">
            <Show when={buttons.length === 0}>
              <div class="rounded-xl border border-dashed border-[#2a2a3a] py-16 text-center bg-[#0a0a0f]/50">
                <p class="text-[#8b8b9e] text-sm">No widgets yet. Click "Add Widget" to begin.</p>
              </div>
            </Show>
            <For each={buttons}>
              {(btn, index) => {
                const wt = () => btn.widgetType || "button";
                const effChartType = () => effectiveChartType(btn.chartType, btn.chartSeries);
                const isMultiChart = () => effChartType() === "multi";
                const isBarLineChart = () => effChartType() === "bar" || effChartType() === "line";
                const showSeriesConfig = () => isBarLineChart() || isMultiChart();
                const chartSeries = () => resolveChartSeries(btn.chartSeries, effChartType(), btn.yKey);
                const updateChartSeries = (next: ChartSeriesConfig[]) => updateButton(index(), "chartSeries", next);
                const updateChartSeriesItem = (seriesIndex: number, patch: Partial<ChartSeriesConfig>) => {
                  if (!Array.isArray(btn.chartSeries)) {
                    updateChartSeries(chartSeries().map((s) => ({ ...s })));
                  }
                  updateButton(index(), "chartSeries", seriesIndex, (prev: any) => ({ ...prev, ...patch }));
                };
                const addChartSeries = () => {
                  const current = chartSeries();
                  const nextColor = SERIES_COLORS[current.length % SERIES_COLORS.length];
                  updateChartSeries([
                    ...current,
                    {
                      id: `series_${Date.now()}_${current.length + 1}`,
                      label: `Series ${current.length + 1}`,
                      yKey: "",
                      type: isMultiChart() ? "line" : ((btn.chartType as any) || "bar"),
                      axis: "left",
                      color: nextColor,
                      workflowId: "",
                    },
                  ]);
                };
                const accentCls = () =>
                  wt() === "chart" ? "border-l-pink-500" :
                  wt() === "table" ? "border-l-emerald-500" :
                  wt() === "form"  ? "border-l-purple-500" : wt() === "survey" ? "border-l-indigo-500" : wt() === "infographic" ? "border-l-rose-500" : "border-l-blue-500";
                const typeLabel: Record<string, string> = {
                  button: "⚡ Button", form: "📝 Form", survey: "📋 Survey", chart: "📈 Chart", table: "📊 Table", infographic: "🦋 Infographic"
                };
                const typeBadgeCls = () =>
                  wt() === "chart" ? "text-pink-400 bg-pink-500/10 border-pink-500/20" :
                  wt() === "table" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                  wt() === "form"  ? "text-purple-400 bg-purple-500/10 border-purple-500/20" :
                  wt() === "survey" ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" :
                  wt() === "infographic" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" :
                  "text-blue-400 bg-blue-500/10 border-blue-500/20";

                const boundWf = createMemo(() => workflows()?.find((w: any) => w.id === btn.workflowId));
                const condWf = createMemo(() => btn.conditionWorkflowId ? workflows()?.find((w: any) => w.id === btn.conditionWorkflowId) : boundWf());
                const upstreamVars = createMemo(() => extractUpstreamVariables(condWf()));
                const surveyFields = () => (btn.surveyConfig?.steps || []).flatMap((s: any) => s.fields || []);
                const varStatus = createMemo(() =>
                  checkWidgetVariablesConfigured(boundWf(), wt() === "survey" ? surveyFields() : btn.formConfig)
                );
                const appendFormFields = (fields: any[]) => {
                  if (wt() === "survey") {
                    const stepsArr = btn.surveyConfig?.steps || [];
                    if (stepsArr.length === 0) return;
                    const lastIdx = stepsArr.length - 1;
                    updateButton(index(), "surveyConfig", "steps", lastIdx, "fields", [...(stepsArr[lastIdx].fields || []), ...fields]);
                  } else {
                    updateButton(index(), "formConfig", [...(btn.formConfig || []), ...fields]);
                  }
                };

                return (
                  <div class={`card min-w-0 p-5 relative border-l-4 group overflow-hidden ${accentCls()}`}>
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
                    <div class="mb-5 flex flex-wrap items-center gap-3 border-b border-[#2a2a3a] pb-4 pr-6 relative z-10">
                      <span class="min-w-0 truncate text-sm font-semibold text-white">{index() + 1}. {btn.label || "Untitled widget"}</span>
                      <span class={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeBadgeCls()}`}>{typeLabel[wt()] || (wt() === "news" ? "📰 News Alert" : "🎛️ Toggle Switch")}</span>
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
                        <label class="mb-1 block text-sm text-[#8b8b9e]">Label</label>
                        <input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none" value={btn.label} onInput={(e) => updateButton(index(), "label", e.currentTarget.value)} placeholder="Widget label" />
                      </div>

                      {/* Color — button/form/survey */}
                      <Show when={wt() === "button" || wt() === "form" || wt() === "survey"}>
                        <div>
                          <label class="mb-1 block text-sm text-[#8b8b9e]">Color</label>
                          <select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none" value={btn.color} onChange={(e) => updateButton(index(), "color", e.currentTarget.value)}>
                            <For each={colorOptions}>{(c) => <option value={c.value}>{c.label}</option>}</For>
                          </select>
                        </div>
                      </Show>

                      {/* Workflow binding — always */}
                      <div class="col-span-2 min-w-0 w-full sm:max-w-sm">
                        <div class="flex items-center justify-between mb-1">
                          <label for={`workflow-${btn.id}`} class="block text-sm font-bold text-[#8b8b9e]"><Show when={wt() === "survey"} fallback="Bind to Workflow">Final Survey Workflow (optional — runs on completion)</Show></label>
                          <button
                            type="button"
                            onClick={() => refetchWorkflows()}
                            class="text-[10px] text-[#8b8b9e] hover:text-white px-1.5 py-0.5 rounded bg-[#1e1e2e] hover:bg-[#2a2a3a] border border-[#2a2a3a] transition-colors flex items-center gap-1"
                            title="Reload workflows"
                          >
                            ↻ Refresh
                          </button>
                        </div>
                        <select id={`workflow-${btn.id}`} class="w-full min-w-0 max-w-full truncate rounded-lg border border-[#2a2a3a] bg-[#151520] p-2.5 text-sm text-emerald-300 shadow-inner focus:border-purple-500 focus:outline-none"
                          title={boundWf()?.name || "Select a workflow"}
                          value={btn.workflowId || ""}
                          onChange={(e) => {
                            const wfId = e.currentTarget.value;
                            updateButton(index(), "workflowId", wfId);
                            if (wt() === "button" || wt() === "form") {
                              const wf = workflows()?.find((w: any) => w.id === wfId);
                              if (wf) {
                                const vars = extractFormVariables(wf);
                                const existing = btn.formConfig || [];
                                const stepVars = (wf.steps || []).flatMap((s: any) => detectStepVariables(s));
                                const updated = vars.map((v: string) => {
                                  const matchingVar = stepVars.find((sv: any) => sv.name === v || sv.name === `form.${v}` || sv.name === `dashboard_form.${v}`);
                                  const existingField = existing.find((e: any) => e.name === v);
                                  if (existingField) {
                                    const base = matchingVar ? buildFormFieldFromVariable({ ...matchingVar, name: v }) : undefined;
                                    return {
                                      ...(base || {}),
                                      ...existingField,
                                      type: existingField.type || base?.type || "string",
                                      options: existingField.options !== undefined && existingField.options !== "" ? existingField.options : base?.options,
                                      validator: existingField.validator !== undefined ? existingField.validator : base?.validator,
                                      validatorPattern: existingField.validatorPattern !== undefined && existingField.validatorPattern !== "" ? existingField.validatorPattern : base?.validatorPattern,
                                      validatorMin: existingField.validatorMin !== undefined ? existingField.validatorMin : base?.validatorMin,
                                      validatorMax: existingField.validatorMax !== undefined ? existingField.validatorMax : base?.validatorMax,
                                      validatorMessage: existingField.validatorMessage !== undefined && existingField.validatorMessage !== "" ? existingField.validatorMessage : base?.validatorMessage,
                                    };
                                  }
                                  return matchingVar
                                    ? buildFormFieldFromVariable({ ...matchingVar, name: v })
                                    : { name: v, label: v, type: "string", required: true };
                                });
                                updateButton(index(), "formConfig", updated);
                              }
                            }
                          }}>
                          <option value="" disabled={wt() !== "survey"}><Show when={wt() === "survey"} fallback="Select a workflow...">None (use per-step workflows only)</Show></option>
                          <Show when={workflows.loading}>
                            <option value="" disabled>Loading workflows...</option>
                          </Show>
                          <Show when={!workflows.loading && (workflows() || []).length === 0}>
                            <option value="" disabled>No workflows available</option>
                          </Show>
                          <Show when={!workflows.loading && (workflows() || []).length > 0}>
                            <For each={workflows()}>{(w: any) => <option value={w.id} selected={w.id === btn.workflowId}>{w.direction === "write" ? "📤 (Write) " : "📥 (Read) "}{w.name}</option>}</For>
                          </Show>
                        </select>
                      </div>

                      {/* Workflow Downstream Variables Status & Checklist */}
                      <Show when={varStatus().hasVariables}>
                        <div class="col-span-2 pt-2 border-t border-[#2a2a3a]/50">
                          <div class="p-3 rounded-xl border bg-[#12121c] space-y-2.5 shadow-md border-[#2a2a3a]">
                            <div class="flex items-center justify-between flex-wrap gap-2">
                              <div class="flex items-center gap-2">
                                <span class="text-xs font-bold text-white flex items-center gap-1.5">
                                  <span>{varStatus().allConfigured ? "🟢" : "🔴"}</span>
                                  <span>Workflow Downstream Variables</span>
                                </span>
                                <span
                                  class={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    varStatus().allConfigured
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                      : "bg-red-500/20 text-red-300 border-red-500/40"
                                  }`}
                                >
                                  {varStatus().allConfigured
                                    ? "✓ All Variables Set"
                                    : `${varStatus().missingVars.length} of ${varStatus().reqVars.length} Need Values`}
                                </span>
                              </div>
                              <Show when={!varStatus().allConfigured && (wt() === "button" || wt() === "form" || wt() === "survey")}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    appendFormFields(
                                      varStatus().varsWithStatus.filter((item) => !item.isConfigured).map((item) => buildFormFieldFromVariable(item))
                                    );
                                  }}
                                  class="text-[10px] font-semibold px-2 py-1 rounded bg-red-600/20 text-red-300 hover:bg-red-600/40 border border-red-500/30 transition-colors"
                                  title="Add all missing variables to form fields"
                                >
                                  + Add All Missing to Form
                                </button>
                              </Show>
                            </div>

                            <p class="text-[11px] text-[#8b8b9e]">
                              Downstream variables required by the workflow. Unset variables appear in <strong class="text-red-400">red</strong>; once configured they turn <strong class="text-emerald-400">green</strong>.
                            </p>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              <For each={varStatus().varsWithStatus}>
                                {(item) => (
                                  <div
                                    class={`p-2 rounded-lg border flex items-center justify-between gap-2 transition-all ${
                                      item.isConfigured
                                        ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-200"
                                        : "bg-red-950/25 border-red-500/50 text-red-200 shadow-sm shadow-red-950/50"
                                    }`}
                                  >
                                    <div class="flex items-center gap-2 overflow-hidden min-w-0">
                                      <span class="text-xs shrink-0">{item.isConfigured ? "🟢" : "🔴"}</span>
                                      <div class="truncate">
                                        <div class="font-mono text-xs font-semibold truncate">
                                          {`{{ ${item.name} }}`}
                                        </div>
                                        <Show when={item.alias}>
                                          <div class="text-[10px] text-[#8b8b9e] truncate">
                                            Alias: <span class="text-white">{item.alias}</span>
                                          </div>
                                        </Show>
                                        <Show when={(item.type && item.type !== "string") || formatValidatorBadge(item)}>
                                          <div class="flex flex-wrap gap-1 mt-0.5">
                                            <Show when={item.type && item.type !== "string"}>
                                              <span class="text-[9px] font-sans font-semibold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30">
                                                {item.type}
                                              </span>
                                            </Show>
                                            <Show when={formatValidatorBadge(item)}>
                                              <span class="text-[9px] font-sans font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                                                {formatValidatorBadge(item)}
                                              </span>
                                            </Show>
                                          </div>
                                        </Show>
                                      </div>
                                    </div>

                                    <div class="flex items-center gap-1.5 shrink-0">
                                      <Show
                                        when={item.isConfigured}
                                        fallback={
                                          <Show
                                            when={wt() === "button" || wt() === "form" || wt() === "survey"}
                                            fallback={
                                              <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                                                Needs Value
                                              </span>
                                            }
                                          >
                                            <button
                                              type="button"
                                              onClick={() => {
                                                appendFormFields([buildFormFieldFromVariable(item)]);
                                              }}
                                              class="text-[10px] font-bold px-2 py-1 rounded bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40 transition-colors flex items-center gap-1"
                                            >
                                              <span>+ Add to Form</span>
                                            </button>
                                          </Show>
                                        }
                                      >
                                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                          ✓ Set in Form
                                        </span>
                                      </Show>
                                    </div>
                                  </div>
                                )}
                              </For>
                            </div>
                          </div>
                        </div>
                      </Show>

                      {/* Workflow Upstream Variables (Produced by Workflow for Conditions & Widgets) */}
                      <Show when={upstreamVars().length > 0}>
                        <div class="col-span-2 pt-2 border-t border-[#2a2a3a]/50">
                          <div class="p-3 rounded-xl border bg-[#12121c] space-y-2.5 shadow-md border-emerald-500/30">
                            <div class="flex items-center justify-between flex-wrap gap-2">
                              <div class="flex items-center gap-2">
                                <span class="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                  <span>🟢</span>
                                  <span>Workflow Upstream Variables (Outputs from {condWf()?.name || "Workflow"})</span>
                                </span>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                                  {upstreamVars().length} Available
                                </span>
                              </div>
                            </div>

                            <p class="text-[11px] text-[#8b8b9e]">
                              Variables and expressions produced by the workflow. Use these in <strong class="text-cyan-400">Conditional Rules</strong> to show/hide this widget or control its behavior.
                            </p>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              <For each={upstreamVars()}>
                                {(uv) => (
                                  <div class="p-2 rounded-lg border bg-emerald-950/20 border-emerald-500/40 text-emerald-200 flex items-center justify-between gap-2">
                                    <div class="truncate overflow-hidden min-w-0 flex-1">
                                      <Show when={uv.alias} fallback={<div class="font-mono text-xs font-semibold truncate">{uv.name}</div>}>
                                        <div class="font-bold text-xs text-white truncate flex items-center gap-1">
                                          <span class="text-emerald-400 font-mono text-[10px]">Alias:</span> {uv.alias}
                                        </div>
                                        <div class="font-mono text-[10px] text-emerald-300/70 truncate" title={uv.name}>{uv.name}</div>
                                      </Show>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const path = uv.alias || uv.name;
                                        const rules = [...(btn.conditionRules || [])];
                                        rules.push({
                                          id: `cond_${Date.now()}`,
                                          path,
                                          operator: "truthy",
                                          value: "true",
                                          action: wt() === "form" ? "showForm" : "showWidget",
                                          elseAction: wt() === "form" ? "hideForm" : "hideWidget",
                                        });
                                        updateButton(index(), "conditionRules", rules);
                                      }}
                                      class="text-[10px] font-bold px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 transition-colors shrink-0 flex items-center gap-1"
                                      title="Add a conditional rule using this variable"
                                    >
                                      <span>+ Use in Condition</span>
                                    </button>
                                  </div>
                                )}
                              </For>
                            </div>
                          </div>
                        </div>
                      </Show>

                      {/* ── Chart config ── */}
                      <Show when={wt() === "chart"}>
                        <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 grid grid-cols-3 gap-3">
                          <div>
                            <label class="mb-1 block text-sm text-[#8b8b9e]">Chart Type</label>
                            <select
                              class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-pink-500 focus:outline-none"
                              value={effChartType()}
                              onChange={(e) => {
                                const chartType = e.currentTarget.value;
                                if (chartType === "multi") {
                                  updateButton(index(), "chartType", "multi");
                                  if (!Array.isArray(btn.chartSeries) || btn.chartSeries.length === 0) {
                                    updateChartSeries(resolveChartSeries(undefined, "multi", btn.yKey));
                                  }
                                } else if (chartType === "bar" || chartType === "line") {
                                  updateButton(index(), "chartType", chartType);
                                  if (Array.isArray(btn.chartSeries)) {
                                    updateChartSeries(btn.chartSeries.map((series: ChartSeriesConfig) => ({ ...series, type: chartType as any })));
                                  }
                                } else {
                                  updateButton(index(), "chartType", chartType);
                                }
                              }}
                            >
                              <option value="bar">Bar</option>
                              <option value="line">Line</option>
                              <option value="multi">🧩 Multi-Chart (combine series)</option>
                              <option value="pie">Pie</option>
                              <option value="doughnut">Doughnut</option>
                              <option value="scatter">Scatter</option>
                              <option value="timeline">⟳ Timeline</option>
                              <option value="choropleth-us">US Choropleth Map</option>
                              <option value="choropleth-world">World Choropleth Map</option>
                            </select>
                          </div>
                          <div class={showSeriesConfig() ? "col-span-2" : ""}>
                            <label class="mb-1 block text-sm text-[#8b8b9e]">
                              {btn.chartType?.startsWith("choropleth") ? "Region Field (State/Country)" : btn.chartType === "timeline" ? "Date/Year Field" : "X-Axis Field"}
                            </label>
                            <input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-pink-500 focus:outline-none" placeholder={btn.chartType?.startsWith("choropleth") ? "e.g. state" : btn.chartType === "timeline" ? "e.g. year" : "e.g. date"} value={btn.xKey || ""} onInput={(e) => updateButton(index(), "xKey", e.currentTarget.value)} />
                          </div>
                          <Show when={!showSeriesConfig()}>
                          <div>
                            <label class="mb-1 block text-sm text-[#8b8b9e]">
                              {btn.chartType?.startsWith("choropleth") ? "Value Field" : btn.chartType === "timeline" ? "Title/Header Field" : "Y-Axis Field"}
                            </label>
                            <input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-pink-500 focus:outline-none" placeholder={btn.chartType === "timeline" ? "e.g. header" : "e.g. value"} value={btn.yKey || ""} onInput={(e) => updateButton(index(), "yKey", e.currentTarget.value)} />
                          </div>
                          </Show>

                          <Show when={showSeriesConfig()}>
                            <div class="col-span-3 rounded-lg border border-[#2a2a3a]/70 bg-[#11111a] p-3">
                              <div class="mb-3 flex items-start justify-between gap-3">
                                <div>
                                  <div class="text-sm font-semibold text-white">
                                    {isMultiChart() ? "Multi-Chart Series" : "Chart Series"}
                                  </div>
                                  <p class="mt-0.5 text-[10px] text-[#77778b]">
                                    {isMultiChart()
                                      ? "Configure multiple series with distinct types (Bar, Line, Stacked Area, Scatter, Bubble, Density), custom colors, and per-series workflows."
                                      : "Each series uses a field from the same rows and shares the X axis."}
                                  </p>
                                </div>
                                <button type="button" onClick={addChartSeries} class="shrink-0 rounded-md border border-pink-500/30 bg-pink-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-pink-300 hover:bg-pink-500/20">
                                  + Add Series
                                </button>
                              </div>

                              <div class="space-y-2">
                                <Index each={chartSeries()}>
                                  {(series, seriesIndex) => (
                                    <div class="flex flex-wrap xl:flex-nowrap items-end gap-2 rounded-md border border-[#28283a] bg-[#0b0b12] p-2">
                                      <Show when={isMultiChart()}>
                                        <div class="w-full xl:w-44 shrink-0">
                                          <label class="mb-1 block text-[10px] text-[#8b8b9e]">Workflow</label>
                                          <select
                                            class="w-full rounded-md border border-[#2a2a3a] bg-[#1e1e2e] px-2 py-1.5 text-xs text-emerald-300 focus:border-pink-500 focus:outline-none truncate"
                                            value={series().workflowId || ""}
                                            onChange={(e) => updateChartSeriesItem(seriesIndex, { workflowId: e.currentTarget.value })}
                                          >
                                            <option value="">↳ Widget Default</option>
                                            <For each={workflows()}>
                                              {(wf: any) => (
                                                <option value={wf.id}>{wf.name || wf.id}</option>
                                              )}
                                            </For>
                                          </select>
                                        </div>
                                      </Show>

                                      <div class="min-w-0 flex-1">
                                        <label class="mb-1 block text-[10px] text-[#8b8b9e]">Legend Label</label>
                                        <input
                                          type="text"
                                          class="w-full rounded-md border border-[#2a2a3a] bg-[#1e1e2e] px-2 py-1.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                                          value={series().label || ""}
                                          onInput={(e) => updateChartSeriesItem(seriesIndex, { label: e.currentTarget.value })}
                                          placeholder="e.g. Homicides"
                                        />
                                      </div>

                                      <div class="min-w-0 flex-1">
                                        <label class="mb-1 block text-[10px] text-[#8b8b9e]">Y Field</label>
                                        <input
                                          type="text"
                                          class="w-full rounded-md border border-[#2a2a3a] bg-[#1e1e2e] px-2 py-1.5 text-xs text-white focus:border-pink-500 focus:outline-none font-mono"
                                          value={series().yKey || ""}
                                          onInput={(e) => updateChartSeriesItem(seriesIndex, { yKey: e.currentTarget.value })}
                                          placeholder="e.g. count"
                                        />
                                      </div>

                                      <Show when={isMultiChart()}>
                                        <div class="w-32 shrink-0">
                                          <label class="mb-1 block text-[10px] text-[#8b8b9e]">Type</label>
                                          <select
                                            class="w-full rounded-md border border-[#2a2a3a] bg-[#1e1e2e] px-2 py-1.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                                            value={series().type || "bar"}
                                            onChange={(e) => updateChartSeriesItem(seriesIndex, { type: e.currentTarget.value as any })}
                                          >
                                            <option value="bar">Bar</option>
                                            <option value="line">Line</option>
                                            <option value="area">Stacked Area</option>
                                            <option value="scatter">Scatter</option>
                                            <option value="bubble">Bubble</option>
                                            <option value="density">Density Plot</option>
                                          </select>
                                        </div>
                                      </Show>

                                      <div class="w-20 shrink-0">
                                        <label class="mb-1 block text-[10px] text-[#8b8b9e]">Axis</label>
                                        <select
                                          class="w-full rounded-md border border-[#2a2a3a] bg-[#1e1e2e] px-2 py-1.5 text-xs text-white focus:border-pink-500 focus:outline-none"
                                          value={series().axis || "left"}
                                          onChange={(e) => updateChartSeriesItem(seriesIndex, { axis: e.currentTarget.value as any })}
                                        >
                                          <option value="left">Left</option>
                                          <option value="right">Right</option>
                                        </select>
                                      </div>

                                      <div class="w-12 shrink-0">
                                        <label class="mb-1 block text-[10px] text-[#8b8b9e]">Color</label>
                                        <input
                                          type="color"
                                          class="h-8 w-11 cursor-pointer rounded border border-[#2a2a3a] bg-[#1e1e2e] p-0.5"
                                          value={series().color || SERIES_COLORS[seriesIndex % SERIES_COLORS.length]}
                                          onInput={(e) => updateChartSeriesItem(seriesIndex, { color: e.currentTarget.value })}
                                          title="Pick series color"
                                        />
                                      </div>

                                      <Show when={isMultiChart() && series().type === "bubble"}>
                                        <div class="w-24 shrink-0">
                                          <label class="mb-1 block text-[10px] text-[#8b8b9e]">Radius (R)</label>
                                          <input
                                            type="text"
                                            class="w-full rounded-md border border-[#2a2a3a] bg-[#1e1e2e] px-2 py-1.5 text-xs text-white focus:border-pink-500 focus:outline-none font-mono"
                                            value={series().rKey || ""}
                                            onInput={(e) => updateChartSeriesItem(seriesIndex, { rKey: e.currentTarget.value })}
                                            placeholder="e.g. size"
                                          />
                                        </div>
                                      </Show>

                                      <button
                                        type="button"
                                        onClick={() => updateChartSeries(chartSeries().filter((_, i) => i !== seriesIndex))}
                                        class="self-end mb-0.5 rounded-md border border-rose-500/30 px-2 py-1.5 text-[10px] font-medium text-rose-300 hover:bg-rose-500/10 shrink-0"
                                        title="Remove series"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  )}
                                </Index>
                                <Show when={chartSeries().length === 0}>
                                  <p class="rounded-md border border-dashed border-[#343447] py-3 text-center text-xs text-[#77778b]">No series configured. Click "+ Add Series" to display data.</p>
                                </Show>
                              </div>
                            </div>
                          </Show>
                        </div>
                      </Show>

                      {/* ── Table config ── */}
                      <Show when={wt() === "table"}>
                        <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50">
                          <label class="mb-1 block text-sm text-[#8b8b9e]">Columns <span class="text-[#5b5b6e]">(comma-separated, blank = all)</span></label>
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
                              Fields auto-detected from workflow variables (<code class="font-mono text-blue-200">{`{{ form.* }}`}</code> and downstream <code class="font-mono text-blue-200">{`{{ parameters }}`}</code>). You can edit or add more.
                            </div>
                          </Show>
                          <Show when={btn.workflowId && (!btn.formConfig || btn.formConfig.length === 0)}>
                            <div class="mb-2 px-2 py-1.5 rounded-lg bg-[#1e1e2e] border border-dashed border-[#2a2a3a] text-[10px] text-[#5b5b6e] flex items-center gap-1.5">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="16"></line></svg>
                              No workflow input variables found — no required fields. Add fields manually if needed.
                            </div>
                          </Show>

                          <Show when={(btn.formConfig || []).length > 0}>
                            <div class="space-y-2">
                              <For each={btn.formConfig}>
                                {(field: any, fIdx) => (
                                  <div class="bg-[#1e1e2e]/50 p-2 rounded-lg border border-[#2a2a3a] space-y-2">
                                    <div class="flex flex-wrap items-center gap-2">
                                      <div class="flex-1 min-w-[100px]">
                                        <label class="text-xs text-[#5b5b6e] block mb-0.5">Variable</label>
                                        <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs font-mono text-purple-300 focus:outline-none focus:border-purple-500" value={field.name}
                                          onInput={(e) => { updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, name: e.currentTarget.value })); }} />
                                      </div>
                                      <div class="flex-1 min-w-[100px]">
                                        <label class="text-xs text-[#5b5b6e] block mb-0.5">Label</label>
                                        <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500" value={field.label}
                                          onInput={(e) => { updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, label: e.currentTarget.value })); }} />
                                      </div>
                                      <div class="flex-1 min-w-[100px]">
                                        <label class="text-xs text-[#5b5b6e] block mb-0.5">Saved Value</label>
                                        <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-emerald-300 font-mono focus:outline-none focus:border-purple-500"
                                          value={Array.isArray(field.value ?? field.defaultValue) ? (field.value ?? field.defaultValue).join(", ") : (field.value ?? field.defaultValue ?? "")}
                                          placeholder={field.type === "list" ? "e.g. item1, item2, item3" : "Default value"}
                                          onInput={(e) => { updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, value: e.currentTarget.value, defaultValue: e.currentTarget.value })); }} />
                                      </div>
                                      <div class="w-24">
                                        <label class="text-xs text-[#5b5b6e] block mb-0.5">Type</label>
                                        <select class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-1 py-1 text-xs text-white focus:outline-none focus:border-purple-500" value={field.type || "string"}
                                          onChange={(e) => { updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, type: e.currentTarget.value })); }}>
                                          <option value="string">String</option>
                                          <option value="number">Number</option>
                                          <option value="boolean">Boolean</option>
                                          <option value="select">Select</option>
                                          <option value="radio">Radio (single choice)</option>
                                          <option value="checkbox_group">Checkboxes (multi)</option>
                                          <option value="rating">Rating</option>
                                          <option value="date">Date</option>
                                          <option value="list">List</option>
                                          <option value="textarea">Textarea</option>
                                        </select>
                                      </div>
                                      <div class="w-36">
                                        <label class="text-xs text-[#5b5b6e] block mb-0.5">Validator</label>
                                        <select
                                          class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-1 py-1 text-xs text-amber-200 focus:outline-none focus:border-amber-500"
                                          value={field.validator || "none"}
                                          onChange={(e) => {
                                            const nextValidator = e.currentTarget.value as FormValidatorType;
                                            updateButton(index(), "formConfig", fIdx(), (f: any) => ({
                                              ...f,
                                              validator: nextValidator,
                                              required: nextValidator === "required" ? true : f.required,
                                            }));
                                          }}
                                        >
                                          <For each={FORM_VALIDATOR_OPTIONS}>
                                            {(opt) => <option value={opt.value}>{opt.label}</option>}
                                          </For>
                                        </select>
                                      </div>
                                      <button onClick={() => { const c=btn.formConfig.filter((_:any,i:number)=>i!==fIdx()); updateButton(index(),"formConfig",c); }} class="text-[#5b5b6e] hover:text-red-400 mt-3 shrink-0">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                      </button>
                                    </div>
                                    <Show when={field.type === "rating"}>
                                      <div class="pt-2 border-t border-[#2a2a3a]/50 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div>
                                          <label class="text-xs text-[#5b5b6e] block mb-0.5">Rating Max</label>
                                          <select class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-1 py-1 text-xs text-white focus:outline-none focus:border-purple-500" value={String(field.ratingMax || 5)}
                                            onChange={(e) => { updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, ratingMax: Number(e.currentTarget.value) })); }}>
                                            <option value="5">1 – 5</option>
                                            <option value="10">1 – 10</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label class="text-xs text-[#5b5b6e] block mb-0.5">Low label</label>
                                          <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500" value={field.ratingMinLabel || ""}
                                            onInput={(e) => { updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, ratingMinLabel: e.currentTarget.value })); }} />
                                        </div>
                                        <div>
                                          <label class="text-xs text-[#5b5b6e] block mb-0.5">High label</label>
                                          <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500" value={field.ratingMaxLabel || ""}
                                            onInput={(e) => { updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, ratingMaxLabel: e.currentTarget.value })); }} />
                                        </div>
                                      </div>
                                    </Show>
                                    <Show when={field.type === "select" || field.type === "radio" || field.type === "checkbox_group"}>
                                      <div class="pt-2 border-t border-[#2a2a3a]/50">
                                        <label class="text-xs text-[#5b5b6e] block mb-0.5">Options (comma-separated)</label>
                                        <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500" value={field.options||""}
                                          onInput={(e)=>{ updateButton(index(),"formConfig", fIdx(), (f: any) => ({ ...f, options: e.currentTarget.value })); }} placeholder="e.g. US, UK, Canada" />
                                      </div>
                                    </Show>
                                    <Show when={field.validator === "regex" || ((field.type || "string") !== "boolean" && (field.type || "string") !== "select") || (field.validator && field.validator !== "none") || field.validatorMin !== undefined || field.validatorMax !== undefined}>
                                      <div class="pt-2 border-t border-[#2a2a3a]/50 grid grid-cols-1 sm:grid-cols-4 gap-2">
                                        <Show when={field.validator === "regex"}>
                                          <div class="sm:col-span-2">
                                            <label class="text-[11px] text-amber-300/90 block mb-0.5">Regex Pattern</label>
                                            <input
                                              class="w-full bg-[#0a0a0f] border border-amber-500/30 rounded px-2 py-1 text-xs font-mono text-amber-200 focus:outline-none focus:border-amber-400"
                                              value={field.validatorPattern || ""}
                                              placeholder="e.g. ^[a-z0-9_]+$"
                                              onInput={(e) => {
                                                updateButton(index(), "formConfig", fIdx(), (f: any) => ({ ...f, validatorPattern: e.currentTarget.value }));
                                              }}
                                            />
                                          </div>
                                        </Show>
                                        <Show when={(field.type || "string") !== "boolean" && (field.type || "string") !== "select"}>
                                          <div>
                                            <label class="text-[11px] text-[#5b5b6e] block mb-0.5">
                                              {field.type === "number" ? "Min Value" : field.type === "list" ? "Min Items" : "Min Length"}
                                            </label>
                                            <input
                                              type="number"
                                              class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                                              value={field.validatorMin ?? ""}
                                              placeholder="Optional"
                                              onInput={(e) => {
                                                const v = e.currentTarget.value === "" ? undefined : Number(e.currentTarget.value);
                                                updateButton(index(), "formConfig", fIdx(), (f: any) => ({ ...f, validatorMin: v }));
                                              }}
                                            />
                                          </div>
                                          <div>
                                            <label class="text-[11px] text-[#5b5b6e] block mb-0.5">
                                              {field.type === "number" ? "Max Value" : field.type === "list" ? "Max Items" : "Max Length"}
                                            </label>
                                            <input
                                              type="number"
                                              class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                                              value={field.validatorMax ?? ""}
                                              placeholder="Optional"
                                              onInput={(e) => {
                                                const v = e.currentTarget.value === "" ? undefined : Number(e.currentTarget.value);
                                                updateButton(index(), "formConfig", fIdx(), (f: any) => ({ ...f, validatorMax: v }));
                                              }}
                                            />
                                          </div>
                                        </Show>
                                        <Show when={(field.validator && field.validator !== "none") || field.validatorMin !== undefined || field.validatorMax !== undefined}>
                                          <div class={field.validator === "regex" ? "sm:col-span-4" : "sm:col-span-2"}>
                                            <label class="text-[11px] text-[#5b5b6e] block mb-0.5">Custom Error Message</label>
                                            <input
                                              class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                                              value={field.validatorMessage || ""}
                                              placeholder="Optional custom error message"
                                              onInput={(e) => {
                                                updateButton(index(), "formConfig", fIdx(), (f: any) => ({ ...f, validatorMessage: e.currentTarget.value }));
                                              }}
                                            />
                                          </div>
                                        </Show>
                                      </div>
                                    </Show>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                      </Show>

                      {/* ── Survey builder ── */}
                      <Show when={wt() === "survey"}>
                        <SurveyBuilderEditor
                          btn={btn}
                          workflows={workflows() || []}
                          onUpdateSurveyConfig={(next) => updateButton(index(), "surveyConfig", reconcile(next))}
                        />
                      </Show>

                      {/* ── Sequential form flow ── */}
                      <Show when={wt() === "form"}>
                        <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50">
                          <div class="p-3 rounded-xl border border-indigo-500/30 bg-[#12121c] space-y-2.5">
                            <div class="text-xs font-bold text-indigo-300">⏭ Sequential Form Flow (One After Another)</div>
                            <p class="text-[11px] text-[#8b8b9e]">
                              Hide this form after it is submitted and reveal another form in the same spot.
                            </p>
                            <label class="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                              <input type="checkbox" class="w-3.5 h-3.5 rounded border-[#2a2a3a] bg-[#1e1e2e] text-indigo-500"
                                checked={!!btn.sequenceConfig?.hideOnSubmit}
                                onChange={(e) => updateButton(index(), "sequenceConfig", (c: any) => ({ ...(c || {}), hideOnSubmit: e.currentTarget.checked }))} />
                              <span>Hide this form after submit</span>
                            </label>
                            <label class="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                              <input type="checkbox" class="w-3.5 h-3.5 rounded border-[#2a2a3a] bg-[#1e1e2e] text-indigo-500"
                                checked={!!btn.sequenceConfig?.startsHidden}
                                onChange={(e) => updateButton(index(), "sequenceConfig", (c: any) => ({ ...(c || {}), startsHidden: e.currentTarget.checked }))} />
                              <span>Start hidden (wait for an earlier form to reveal this one)</span>
                            </label>
                            <div>
                              <label class="text-[11px] text-[#8b8b9e] block mb-0.5">Reveal next widget after submit</label>
                              <select class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                                value={btn.sequenceConfig?.nextWidgetId || ""}
                                onChange={(e) => updateButton(index(), "sequenceConfig", (c: any) => ({ ...(c || {}), nextWidgetId: e.currentTarget.value || undefined }))}>
                                <option value="" selected={!btn.sequenceConfig?.nextWidgetId}>None (end of flow)</option>
                                <For each={buttons}>
                                  {(other: any, oi) => (
                                    <Show when={other.id !== btn.id}>
                                      <option value={other.id} selected={other.id === btn.sequenceConfig?.nextWidgetId}>{oi() + 1}. {other.label || other.id}</option>
                                    </Show>
                                  )}
                                </For>
                              </select>
                            </div>
                            <label class="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                              <input type="checkbox" class="w-3.5 h-3.5 rounded border-[#2a2a3a] bg-[#1e1e2e] text-indigo-500"
                                checked={btn.sequenceConfig?.carryAnswersForward !== false}
                                onChange={(e) => updateButton(index(), "sequenceConfig", (c: any) => ({ ...(c || {}), carryAnswersForward: e.currentTarget.checked }))} />
                              <span>Carry answers from earlier forms forward to workflows</span>
                            </label>
                            <Show when={btn.sequenceConfig?.hideOnSubmit && !btn.sequenceConfig?.nextWidgetId}>
                              <div class="space-y-2 pt-2 border-t border-[#2a2a3a]/60">
                                <div>
                                  <label class="text-[11px] text-[#8b8b9e] block mb-0.5">Completion Message</label>
                                  <input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    value={btn.sequenceConfig?.completionMessage || ""}
                                    placeholder="Thank you! Your responses have been submitted."
                                    onInput={(e) => updateButton(index(), "sequenceConfig", (c: any) => ({ ...(c || {}), completionMessage: e.currentTarget.value }))} />
                                </div>
                                <label class="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                                  <input type="checkbox" class="w-3.5 h-3.5 rounded border-[#2a2a3a] bg-[#1e1e2e] text-indigo-500"
                                    checked={btn.sequenceConfig?.allowRestart !== false}
                                    onChange={(e) => updateButton(index(), "sequenceConfig", (c: any) => ({ ...(c || {}), allowRestart: e.currentTarget.checked }))} />
                                  <span>Allow "Start Again"</span>
                                </label>
                              </div>
                            </Show>
                          </div>
                        </div>
                      </Show>

                      {/* ── Output / Response Fields ── */}
                      <Show when={wt() === "button" || wt() === "form" || wt() === "survey"}>
                        <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50">
                          <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <label class="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                              Output / Response Field
                            </label>
                            <div class="flex items-center gap-3">
                              <label class="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-300">
                                <input
                                  type="checkbox"
                                  class="w-3.5 h-3.5 rounded border-[#2a2a3a] bg-[#1e1e2e] text-emerald-500 focus:ring-emerald-500/50"
                                  checked={!!btn.showOutput}
                                  onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    updateButton(index(), "showOutput", checked);
                                    if (checked && (!btn.outputConfig || btn.outputConfig.length === 0)) {
                                      updateButton(index(), "outputConfig", [
                                        { id: `out_${Date.now()}`, label: "Response", path: "" }
                                      ]);
                                    }
                                  }}
                                />
                                <span>Enable Output Field</span>
                              </label>

                              <Show when={btn.showOutput}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = [...(btn.outputConfig || [])];
                                    copy.push({ id: `out_${Date.now()}`, label: `Output ${copy.length + 1}`, path: "" });
                                    updateButton(index(), "outputConfig", copy);
                                  }}
                                  class="text-[10px] px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 border border-emerald-500/20 transition-colors"
                                >
                                  + Add Output Field
                                </button>
                              </Show>
                            </div>
                          </div>

                          <Show when={btn.showOutput}>
                            <div class="space-y-2 pt-1">
                              <p class="text-[11px] text-[#8b8b9e]">
                                Extract response variables like <code class="font-mono text-emerald-300">{`{{ steps.step_1.response.email }}`}</code> or leave path blank for full response.
                              </p>

                              <For each={btn.outputConfig || []}>
                                {(outField: any, oIdx) => (
                                  <div class="bg-[#1e1e2e]/50 p-2.5 rounded-lg border border-[#2a2a3a] space-y-1.5">
                                    <div class="flex items-center gap-2">
                                      <div class="w-1/3">
                                        <label class="text-[11px] text-[#8b8b9e] block mb-0.5">Field Label</label>
                                        <input
                                          class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                                          value={outField.label || ""}
                                          placeholder="e.g. Email, Surname"
                                          onInput={(e) => {
                                            updateButton(index(), "outputConfig", oIdx(), (o: any) => ({ ...o, label: e.currentTarget.value }));
                                          }}
                                        />
                                      </div>
                                      <div class="flex-1">
                                        <label class="text-[11px] text-[#8b8b9e] block mb-0.5">Variable Path</label>
                                        <input
                                          list={`out_paths_${btn.id}_${oIdx()}`}
                                          class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                                          value={outField.path || ""}
                                          placeholder="e.g. {{ steps.step_8m6qd1ynu.response.email }} (or blank for all)"
                                          onInput={(e) => {
                                            updateButton(index(), "outputConfig", oIdx(), (o: any) => ({ ...o, path: e.currentTarget.value }));
                                          }}
                                        />
                                        <datalist id={`out_paths_${btn.id}_${oIdx()}`}>
                                          <For each={upstreamVars()}>
                                            {(uv) => (
                                              <>
                                                <Show when={uv.alias}>
                                                  <option value={`{{ ${uv.alias} }}`}>{uv.alias} (from {uv.stepName})</option>
                                                </Show>
                                                <option value={`{{ ${uv.name} }}`}>{uv.name}</option>
                                              </>
                                            )}
                                          </For>
                                          <option value="response">response (full response payload)</option>
                                        </datalist>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const copy = (btn.outputConfig || []).filter((_: any, i: number) => i !== oIdx());
                                          updateButton(index(), "outputConfig", copy);
                                        }}
                                        class="text-[#5b5b6e] hover:text-red-400 mt-4 shrink-0 p-1"
                                        title="Remove output field"
                                      >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                      </button>
                                    </div>

                                    {/* Quick pick chips */}
                                    <Show when={upstreamVars().length > 0}>
                                      <div class="flex items-center gap-1 flex-wrap pt-0.5">
                                        <span class="text-[9px] text-[#5b5b6e]">Quick Picks:</span>
                                        <For each={upstreamVars()}>
                                          {(uv) => {
                                            const pickPath = uv.alias
                                              ? (uv.alias.startsWith("{{") ? uv.alias : `{{ ${uv.alias} }}`)
                                              : (uv.name ? (uv.name.startsWith("{{") ? uv.name : `{{ ${uv.name} }}`) : "");
                                            const suggestedLabel = uv.alias
                                              ? uv.alias.replace(/\{\{|\}\}/g, "").split(".").pop() || "Output"
                                              : (uv.name ? uv.name.replace(/\{\{|\}\}/g, "").split(".").pop() || "Output" : "Output");
                                            return (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  updateButton(index(), "outputConfig", oIdx(), (o: any) => ({
                                                    ...o,
                                                    path: pickPath,
                                                    label: o.label && o.label !== "Response" && !o.label.startsWith("Output ") ? o.label : suggestedLabel
                                                  }));
                                                }}
                                                class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors font-mono"
                                                title={`Set path to ${pickPath} and suggest label ${suggestedLabel}`}
                                              >
                                                {uv.alias || uv.name}
                                              </button>
                                            );
                                          }}
                                        </For>
                                      </div>
                                    </Show>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                      </Show>

                      {/* ── Conditional Rules config ── */}
                      <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 space-y-3">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                          <label class="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                            🎛️ Conditional Rules (show/hide/style based on workflow outcome)
                          </label>
                          <div class="flex items-center gap-2">
                            <select
                              class="bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 max-w-xs"
                              value={btn.conditionWorkflowId || ""}
                              onChange={(e) => updateButton(index(), "conditionWorkflowId", e.currentTarget.value || undefined)}
                              title="Select workflow that provides data for condition rules (defaults to bound workflow)"
                            >
                              <option value="">Source: Bound Workflow</option>
                              <For each={workflows()}>
                                {(w: any) => (
                                  <option value={w.id}>
                                    Source: {w.direction === "write" ? "📤 " : "📥 "}{w.name}
                                  </option>
                                )}
                              </For>
                            </select>
                            <button
                              onClick={() => {
                                const rules = [...(btn.conditionRules || [])];
                                rules.push({ id: `cond_${Date.now()}`, path: "", operator: "equals", value: "", action: "showWidget" });
                                updateButton(index(), "conditionRules", rules);
                              }}
                              class="text-[10px] px-2 py-0.5 rounded bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/40 border border-cyan-500/30"
                            >
                              + Add Condition
                            </button>
                          </div>
                        </div>

                          <div class="space-y-2">
                            <For each={btn.conditionRules || []}>
                              {(rule: any, rIdx) => (
                                <div class="bg-[#1e1e2e]/60 p-2 rounded-lg border border-[#2a2a3a] space-y-1.5">
                                  <div class="grid grid-cols-12 gap-2 items-end">
                                    <div class="col-span-3">
                                      <label class="text-xs text-[#5b5b6e] block mb-0.5">Data Path</label>
                                      <input
                                        list={`cond_paths_${btn.id}_${rIdx()}`}
                                        class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                                        value={rule.path || ""}
                                        onInput={(e) => { updateButton(index(), "conditionRules", rIdx(), (r: any) => ({ ...r, path: e.currentTarget.value })); }}
                                        placeholder="e.g. has_it or response"
                                      />
                                      <datalist id={`cond_paths_${btn.id}_${rIdx()}`}>
                                        <For each={upstreamVars()}>
                                          {(uv) => (
                                            <>
                                              <Show when={uv.alias}>
                                                <option value={uv.alias}>{uv.alias} (from {uv.stepName})</option>
                                              </Show>
                                              <option value={uv.name}>{uv.name}</option>
                                            </>
                                          )}
                                        </For>
                                        <option value="response">response (full response payload)</option>
                                        <option value="data">data</option>
                                        <option value="status">status</option>
                                      </datalist>
                                      <Show when={upstreamVars().length > 0}>
                                        <div class="flex items-center gap-1 flex-wrap pt-1">
                                          <span class="text-[9px] text-[#5b5b6e]">Picks:</span>
                                          <For each={upstreamVars()}>
                                            {(uv) => {
                                              const pickVal = uv.alias || uv.name;
                                              return (
                                                <button
                                                  type="button"
                                                  onClick={() => updateButton(index(), "conditionRules", rIdx(), (r: any) => ({ ...r, path: pickVal }))}
                                                  class="text-[9px] px-1 py-0.5 rounded bg-emerald-950/40 text-emerald-300 hover:bg-emerald-800/40 border border-emerald-500/30 transition-colors font-mono"
                                                  title={`Set path to ${pickVal}`}
                                                >
                                                  {uv.alias || uv.name}
                                                </button>
                                              );
                                            }}
                                          </For>
                                        </div>
                                      </Show>
                                    </div>
                                    <div class="col-span-3">
                                      <label class="text-xs text-[#5b5b6e] block mb-0.5">Operator</label>
                                      <select
                                        class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                                        value={rule.operator || "equals"}
                                        onChange={(e) => { updateButton(index(), "conditionRules", rIdx(), (r: any) => ({ ...r, operator: e.currentTarget.value })); }}
                                      >
                                        <option value="equals">equals</option>
                                        <option value="notEquals">not equals</option>
                                        <option value="contains">contains</option>
                                        <option value="truthy">truthy</option>
                                        <option value="falsy">falsy</option>
                                        <option value="gt">&gt;</option>
                                        <option value="lt">&lt;</option>
                                        <option value="gte">&gt;=</option>
                                        <option value="lte">&lt;=</option>
                                      </select>
                                    </div>
                                    <div class="col-span-2">
                                      <label class="text-xs text-[#5b5b6e] block mb-0.5">Compare Value</label>
                                      <input
                                        class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                                        value={rule.value ?? ""}
                                        onInput={(e) => { updateButton(index(), "conditionRules", rIdx(), (r: any) => ({ ...r, value: e.currentTarget.value })); }}
                                        placeholder="value"
                                      />
                                    </div>
                                    <div class="col-span-3">
                                      <label class="text-xs text-[#5b5b6e] block mb-0.5">Action</label>
                                      <select
                                        class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                                        value={rule.action || "showWidget"}
                                        onChange={(e) => { updateButton(index(), "conditionRules", rIdx(), (r: any) => ({ ...r, action: e.currentTarget.value })); }}
                                      >
                                        <option value="showWidget">show widget</option>
                                        <option value="hideWidget">hide widget</option>
                                        <option value="showForm">show form</option>
                                        <option value="hideForm">hide form</option>
                                        <option value="setLabel">set label</option>
                                        <option value="setWorkflow">set workflow</option>
                                        <option value="setColor">set color</option>
                                        <option value="setDisabled">disable widget</option>
                                        <option value="setEnabled">enable widget</option>
                                      </select>
                                    </div>
                                    <div class="col-span-1">
                                      <button onClick={() => { const c=(btn.conditionRules||[]).filter((_:any,i:number)=>i!==rIdx()); updateButton(index(),"conditionRules",c); }} class="text-[#5b5b6e] hover:text-red-400 shrink-0">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                      </button>
                                    </div>
                                  </div>
                                  <Show when={rule.action === "setLabel" || rule.action === "setWorkflow" || rule.action === "setColor"}>
                                    <div>
                                      <label class="text-xs text-[#5b5b6e] block mb-0.5">
                                        {rule.action === "setLabel" ? "New Label" : rule.action === "setColor" ? "Color Name" : "Target Workflow ID"}
                                      </label>
                                      <Show when={rule.action === "setColor"} fallback={
                                        <input
                                          class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                                          value={rule.targetValue ?? ""}
                                          onInput={(e) => { updateButton(index(), "conditionRules", rIdx(), (r: any) => ({ ...r, targetValue: e.currentTarget.value })); }}
                                          placeholder={rule.action === "setLabel" ? "e.g. Delete" : "e.g. workflow:delete-mail"}
                                        />
                                      }>
                                        <select
                                          class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                                          value={rule.targetValue ?? "blue"}
                                          onChange={(e) => { updateButton(index(), "conditionRules", rIdx(), (r: any) => ({ ...r, targetValue: e.currentTarget.value })); }}
                                        >
                                          <option value="blue">🔵 Blue</option>
                                          <option value="red">🔴 Red</option>
                                          <option value="emerald">🟢 Emerald</option>
                                          <option value="purple">🟣 Purple</option>
                                          <option value="slate">⚫ Slate</option>
                                        </select>
                                      </Show>
                                    </div>
                                  </Show>

                                  {/* Else Action (if/else) */}
                                  <div class="mt-1.5 pl-3 border-l-2 border-amber-500/30">
                                    <div class="grid grid-cols-12 gap-2 items-end">
                                      <div class="col-span-4">
                                        <label class="text-[10px] font-bold text-amber-400/80 block mb-0.5">Else Action (when NOT matched)</label>
                                        <select
                                          class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                                          value={rule.elseAction || ""}
                                          onChange={(e) => { updateButton(index(), "conditionRules", rIdx(), (r: any) => ({ ...r, elseAction: e.currentTarget.value || undefined })); }}
                                        >
                                          <option value="">— no else action —</option>
                                          <option value="showWidget">show widget</option>
                                          <option value="hideWidget">hide widget</option>
                                          <option value="showForm">show form</option>
                                          <option value="hideForm">hide form</option>
                                          <option value="setLabel">set label</option>
                                          <option value="setWorkflow">set workflow</option>
                                          <option value="setColor">set color</option>
                                          <option value="setDisabled">disable widget</option>
                                          <option value="setEnabled">enable widget</option>
                                        </select>
                                      </div>
                                      <Show when={rule.elseAction === "setLabel" || rule.elseAction === "setWorkflow" || rule.elseAction === "setColor"}>
                                        <div class="col-span-4">
                                          <label class="text-[10px] text-[#5b5b6e] block mb-0.5">
                                            {rule.elseAction === "setLabel" ? "Else Label" : rule.elseAction === "setColor" ? "Else Color" : "Else Workflow ID"}
                                          </label>
                                          <input
                                            class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                                            value={rule.elseTargetValue ?? ""}
                                            onInput={(e) => { updateButton(index(), "conditionRules", rIdx(), (r: any) => ({ ...r, elseTargetValue: e.currentTarget.value })); }}
                                            placeholder={rule.elseAction === "setLabel" ? "e.g. Default Label" : rule.elseAction === "setColor" ? "e.g. blue" : "e.g. workflow:default"}
                                          />
                                        </div>
                                      </Show>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>

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
                              <label class="text-xs text-[#5b5b6e] block mb-0.5">Variable Data Path</label>
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
                            <label class="text-xs text-[#5b5b6e] block mb-0.5">ON Label</label>
                            <input
                              class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-emerald-400 focus:border-cyan-500"
                              value={btn.onLabel || "ON"}
                              onInput={(e) => updateButton(index(), "onLabel", e.currentTarget.value)}
                            />
                          </div>
                          <div>
                            <label class="text-xs text-[#5b5b6e] block mb-0.5">OFF Label</label>
                            <input
                              class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-slate-400 focus:border-cyan-500"
                              value={btn.offLabel || "OFF"}
                              onInput={(e) => updateButton(index(), "offLabel", e.currentTarget.value)}
                            />
                          </div>
                          <div>
                            <label class="text-xs text-[#5b5b6e] block mb-0.5">Form Variable Name</label>
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
                            <label class="mb-1 block text-sm text-[#8b8b9e]">Template Preset</label>
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

        {/* Live Preview Column */}
        <div class="lg:col-span-4 pl-0 lg:pl-4 border-t lg:border-t-0 lg:border-l border-[#2a2a3a]/50 pt-8 lg:pt-0">
          <h2 class="text-sm font-bold text-[#8b8b9e] mb-4 tracking-wider uppercase flex items-center justify-between">
            <span>Live Preview</span>
            <div class="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setActiveTab("arrange")}
                class="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 normal-case tracking-normal font-semibold"
                title="Arrange widgets in 12-column canvas"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                Arrange
              </button>
              <Show when={previewSequence.hasSequence()}>
                <button
                  type="button"
                  onClick={() => previewSequence.resetAll()}
                  class="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1 normal-case tracking-normal font-semibold"
                  title="Restart the sequential form flow preview"
                >
                  ↺ Reset Form Flow
                </button>
              </Show>
              <Show when={savedPublished() && !isNew()}>
                <A href={savedPath()} target="_blank" class="text-xs text-blue-400 hover:underline flex items-center gap-1 normal-case tracking-normal font-semibold">
                  Public View
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </A>
              </Show>
            </div>
          </h2>

          <div class="bg-[#0a0a0f] rounded-2xl border border-[#2a2a3a] overflow-hidden min-h-[400px] shadow-2xl relative">
            {/* Fake browser header */}
            <div class="bg-[#1e1e2e] px-4 py-3 flex items-center gap-2 border-b border-[#2a2a3a]">
              <div class="flex gap-1.5">
                <div class="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div class="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <div class="mx-auto bg-[#0a0a0f] text-center rounded-md px-16 py-1 text-[10px] text-[#5b5b6e] font-mono truncate hidden sm:block">
                {savedPublished() && !isNew() ? savedPath() : `Draft: ${name()}`}
              </div>
            </div>

            {/* Board render */}
            <div class="p-4">
              <h1 class="text-xl font-bold text-white mb-6 text-center">{name() || "Untitled Dashboard"}</h1>
              <Show when={buttons.length === 0}>
                <div class="text-center text-[#5b5b6e] text-xs py-10 border border-dashed border-[#2a2a3a] rounded-lg">Widgets will appear here</div>
              </Show>
              <Show when={buttons.length > 0}>
                <DashboardGrid
                  buttons={previewSequence.displayedButtons()}
                  isStatic={false}
                  dashboardId={params.id}
                  onLayoutChange={previewSequence.isAdvanced() ? undefined : handleLayoutChange}
                  renderWidget={renderLiveWidget}
                />
              </Show>
            </div>
          </div>
        </div>
      </div>
      </Show>

      {/* Arrange Layout Mode: Full-width 12-column Canvas */}
      <Show when={activeTab() === "arrange"}>
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-purple-500/20 bg-[#12121e]">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-bold text-white flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-purple-400"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                  12-Column Grid Canvas Arranger
                </h2>
                <span class="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 uppercase">
                  Interactive Drag & Resize
                </span>
              </div>
              <p class="text-xs text-[#8b8b9e] mt-1">
                Drag by the top header bar to position widgets across 12 columns. Grab border handles to resize. Layout is saved automatically.
              </p>
            </div>

            <div class="flex items-center gap-2.5">
              <button
                type="button"
                onClick={autoPackLayout}
                class="btn-secondary text-xs flex items-center gap-1.5"
                title="Sequentially pack widgets into 12 columns"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                Auto Pack
              </button>

              <button
                type="button"
                disabled={saving() || profileLoading()}
                onClick={() => saveDashboard(false)}
                class="btn-primary bg-purple-600 hover:bg-purple-500 text-white text-xs flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                Save Layout
              </button>

              <Show when={savedPublished() && !isNew()}>
                <A
                  href={savedPath()}
                  target="_blank"
                  class="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/20"
                >
                  <span>Public View</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </A>
              </Show>
            </div>
          </div>

          <div class="rounded-2xl border border-[#2a2a3a] bg-[#0a0a0f] p-6 shadow-2xl min-h-[500px]">
            <Show
              when={buttons.length > 0}
              fallback={
                <div class="py-24 text-center text-[#5b5b6e] text-sm">
                  <div class="mb-3 text-2xl">📐</div>
                  <p class="font-semibold text-white">No widgets to arrange yet</p>
                  <p class="mt-1 text-xs">Switch to "Configure" tab to add your buttons, charts, tables, or alerts.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("config")}
                    class="mt-4 btn-secondary text-xs"
                  >
                    Go to Widget Configuration
                  </button>
                </div>
              }
            >
              <DashboardGrid
                buttons={buttons}
                isStatic={false}
                dashboardId={params.id}
                onLayoutChange={handleLayoutChange}
                renderWidget={renderLiveWidget}
              />
            </Show>
          </div>
        </div>
      </Show>
    </main>
  );
}

// ─── Live Preview Helper Components and Functions ─────────────────────────────

function PreviewWidget(props: { btn: any; dashboardId?: string }) {
  const [status, setStatus] = createSignal<"idle" | "loading" | "ready" | "error">("idle");
  const [data, setData] = createSignal<any[]>([]);
  const [dataBySource, setDataBySource] = createSignal<Record<string, any[]>>({});
  const [meta, setMeta] = createSignal<any>({});
  const [error, setError] = createSignal("");

  let disposed = false;
  let activeCancels: Array<() => void> = [];
  const cancelAllPolls = () => {
    for (const c of activeCancels) c();
    activeCancels = [];
  };
  onCleanup(() => {
    disposed = true;
    cancelAllPolls();
  });

  const runWorkflowPromise = (wfId: string): Promise<{ data: any[]; meta: any }> => {
    const rawId = wfId.includes(":") ? wfId.split(":")[1].replace(/[⟨⟩]/g, "") : wfId.replace(/[⟨⟩]/g, "");
    const dashQuery =
      props.dashboardId && props.dashboardId !== "new"
        ? `?dashboard=${encodeURIComponent(props.dashboardId)}`
        : "";
    return new Promise(async (resolve, reject) => {
      try {
        const res = await fetch(`/api/workflows/${rawId}/run${dashQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form: {}, dashboardId: props.dashboardId })
        });
        if (disposed) return reject(new Error("Cancelled"));
        const json = await res.json();
        if (disposed) return reject(new Error("Cancelled"));
        if (!json.success) throw new Error(json.error || `Failed to start workflow ${rawId}`);

        const cancel = pollRun(
          json.runId,
          {
            onDone: (logs) => {
              const { data: stepData, meta: stepMeta } = extractLastStep(logs);
              resolve({ data: stepData, meta: stepMeta });
            },
            onError: (msg) => reject(new Error(msg)),
          },
          { maxAttempts: 60, intervalMs: 1500 }
        );
        activeCancels.push(cancel);
      } catch (err) {
        reject(err);
      }
    });
  };

  const loadPreview = async () => {
    if (!props.btn.workflowId) return;
    cancelAllPolls();
    setStatus("loading");
    setError("");

    try {
      const { data: mainData, meta: mainMeta } = await runWorkflowPromise(props.btn.workflowId);
      if (disposed) return;
      setData(mainData);
      setMeta(mainMeta);

      const sourcesMap: Record<string, any[]> = {
        [props.btn.workflowId]: mainData,
        __default__: mainData,
      };

      const seriesList: ChartSeriesConfig[] = props.btn.chartSeries || [];
      const extraWfs = seriesList
        .map((s) => s.workflowId)
        .filter((w): w is string => typeof w === "string" && w.trim() !== "" && w !== props.btn.workflowId);
      const uniqueExtraWfs = [...new Set(extraWfs)];

      if (uniqueExtraWfs.length > 0) {
        await Promise.all(
          uniqueExtraWfs.map(async (extraWf) => {
            try {
              const res = await runWorkflowPromise(extraWf);
              sourcesMap[extraWf] = res.data;
            } catch (err: any) {
              console.warn(`Series workflow ${extraWf} failed to load:`, err);
              sourcesMap[extraWf] = [];
            }
          })
        );
      }
      if (disposed) return;

      setDataBySource(sourcesMap);
      setStatus("ready");
    } catch (e: any) {
      if (disposed) return;
      setError(e.message);
      setStatus("error");
    }
  };

  const kind = () => props.btn.widgetType;

  return (
    <div class="w-full rounded-xl border border-[#2a2a3a] bg-[#0e0e15] p-3 shadow-md text-left">
      <div class="flex items-center justify-between mb-2 pb-1.5 border-b border-[#2a2a3a]">
        <h3 class={`text-[10px] font-bold uppercase tracking-wider ${kind() === "table" ? "text-emerald-400" : "text-purple-400"}`}>
          {kind() === "table" ? "📊 Table Preview" : kind() === "infographic" ? "🦋 Infographic Preview" : "📈 Chart Preview"}: {props.btn.label}
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
        <Show when={kind() === "table"}>
          <DashTable 
            compact={true}
            data={data()} 
            columns={props.btn.columns ? props.btn.columns.split(",").map((c: string) => c.trim()).filter(Boolean) : meta().columns} 
          />
        </Show>
        <Show when={kind() === "chart" && (props.btn.chartType || "bar") !== "timeline"}>
          <Suspense fallback={<div class="h-[200px] animate-pulse rounded bg-[#101015]" />}>
            <DashChart
              data={data()}
              dataBySource={dataBySource()}
              xKey={props.btn.xKey || meta().xKey}
              yKey={props.btn.yKey || meta().yKey}
              chartType={props.btn.chartType || meta().chartType || "bar"}
              chartSeries={props.btn.chartSeries}
              height="200px"
              emptySeriesHint="Add a Y field to at least one series to preview this chart."
            />
          </Suspense>
        </Show>
        <Show when={kind() === "chart" && props.btn.chartType === "timeline"}>
          <Suspense fallback={<div class="h-[300px] animate-pulse rounded bg-[#101015]" />}>
            <DashTimeline
              data={data()}
              xKey={props.btn.xKey || meta().xKey}
              yKey={props.btn.yKey || meta().yKey}
            />
          </Suspense>
        </Show>
        <Show when={kind() === "infographic"}>
          <Suspense>
            <InfographicWidget syntax={props.btn.infographicSyntax} data={data()} editable={props.btn.infographicEditable} />
          </Suspense>
        </Show>
      </Show>
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

// ─── Infographic Widget (AntV @antv/infographic - Lazy Loaded) ────────────────
const InfographicWidget = lazy(() => import("~/components/dashboard/InfographicWidget"));

