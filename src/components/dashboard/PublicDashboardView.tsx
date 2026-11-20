import { createEffect, createSignal, lazy, Match, onCleanup, onMount, Show, Suspense, Switch, type Accessor } from "solid-js";
import { createStore } from "solid-js/store";
import { isServer } from "solid-js/web";

import DashboardGrid from "~/components/dashboard/DashboardGrid";
import { DashboardPublicButtonFormWidget } from "~/components/dashboard/DashboardPublicWidget";
import { useWidgetOutcome, type WidgetOutcome } from "~/components/dashboard/useWidgetOutcome";
import { DashTable } from "~/components/dashboard/widgets/DashTable";
import { NewsWidgetComponent } from "~/components/dashboard/widgets/NewsWidget";
import { extractLastStep, pollRun } from "~/lib/dashboard/runPolling";
import { applyWidgetConditions } from "~/lib/dashboard/widgetConditions";

const DashChart = lazy(() => import("~/components/dashboard/widgets/DashChart"));

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


// ─── Auto-loading widget (table or chart) ─────────────────────────────────────

function AutoWidget(props: {
  dashboardId: string;
  btn: any;
  workflow: any;
  sharedOutcome?: Accessor<WidgetOutcome>;
}) {
  const kind = () => props.btn.widgetType || lastStepType(props.workflow);
  const lastS = () => lastStep(props.workflow);

  const [status, setStatus] = createSignal<"loading" | "ready" | "error">("loading");
  const [tableData, setTableData] = createSignal<any[]>([]);
  const [dataBySource, setDataBySource] = createSignal<Record<string, any[]>>({});
  const [stepMeta, setStepMeta] = createSignal<any>({});
  const [errorMsg, setErrorMsg] = createSignal("");

  let disposed = false;
  const cancels: Array<() => void> = [];
  onCleanup(() => {
    disposed = true;
    for (const c of cancels) c();
  });

  const runExtraSeries = () => {
    const seriesList: any[] = props.btn.chartSeries || [];
    const extraSeriesWfs = seriesList
      .map((s) => s.workflowId)
      .filter((w) => typeof w === "string" && w.trim() !== "" && w !== props.btn.workflowId);
    const uniqueExtraWfs = [...new Set(extraSeriesWfs)] as string[];

    if (uniqueExtraWfs.length === 0) return;

    Promise.all(
      uniqueExtraWfs.map(async (extraWf) => {
        try {
          const sRes = await fetch(`/api/dashboards/${props.dashboardId}/trigger/${props.btn.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflowId: extraWf, seriesRun: true }),
          });
          if (disposed) return;
          const sJson = await sRes.json();
          if (disposed || !sJson.success) return;
          const cancelExtra = pollRun(
            sJson.runId,
            {
              onDone: (sLogs) => {
                if (disposed) return;
                const { data: sData } = extractLastStep(sLogs);
                setDataBySource((prev) => ({ ...prev, [extraWf]: sData }));
              },
              onError: () => {},
            },
            { maxAttempts: 60, intervalMs: 1500 }
          );
          cancels.push(cancelExtra);
        } catch {
          // Ignore failure for individual auxiliary series
        }
      })
    );
  };

  // Reuse outcome from ConditionalWidgetWrapper when conditionRules share the same workflow
  if (props.sharedOutcome) {
    createEffect(() => {
      const out = props.sharedOutcome!();
      if (out.status === "loading") {
        setStatus("loading");
      } else if (out.status === "error") {
        setErrorMsg(out.error || "Failed to load widget state");
        setStatus("error");
      } else if (out.status === "ready") {
        const { data, meta } = extractLastStep(out.logs || []);
        setTableData(data);
        setStepMeta(meta);
        setDataBySource((prev) => ({
          ...prev,
          [props.btn.workflowId]: data,
          __default__: data,
        }));
        setStatus("ready");
      }
    });
  }

  onMount(async () => {
    if (isServer) return;
    if (props.sharedOutcome) {
      runExtraSeries();
      return;
    }

    try {
      const res = await fetch(`/api/dashboards/${props.dashboardId}/trigger/${props.btn.id}`, { method: "POST" });
      if (disposed) return;
      const json = await res.json();
      if (disposed) return;
      if (!json.success) throw new Error(json.error || "Trigger failed");

      const cancelMain = pollRun(
        json.runId,
        {
          onDone: (logs) => {
            if (disposed) return;
            const { data, meta } = extractLastStep(logs);
            setTableData(data);
            setStepMeta(meta);
            setDataBySource((prev) => ({
              ...prev,
              [props.btn.workflowId]: data,
              __default__: data,
            }));
            setStatus("ready");
          },
          onError: (msg) => {
            if (disposed) return;
            setErrorMsg(msg);
            setStatus("error");
          },
        },
        { maxAttempts: 60, intervalMs: 1500 }
      );
      cancels.push(cancelMain);

      runExtraSeries();
    } catch (e: any) {
      if (disposed) return;
      setErrorMsg(e.message);
      setStatus("error");
    }
  });

  return (
    <div class="w-full">
      {/* Header */}
      <div class={`flex items-center justify-between mb-3 pb-2 border-b ${kind() === "table" ? "border-emerald-500/20" : "border-purple-500/20"}`}>
        <h3 class={`text-sm font-bold ${kind() === "table" ? "text-emerald-400" : "text-purple-400"}`}>
          {kind() === "table" ? "📊" : "📈"} {props.btn.label}
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
        <Show when={kind() === "table"}>
          <DashTable data={tableData()} columns={props.btn.columns ? props.btn.columns.split(",").map((c: string) => c.trim()).filter(Boolean) : stepMeta().columns} />
        </Show>
        <Show when={kind() === "chart"}>
          <Suspense fallback={<div class="h-[250px] animate-pulse rounded bg-[#101015]" />}>
            <DashChart
              data={tableData()}
              dataBySource={dataBySource()}
              xKey={props.btn.xKey || stepMeta().xKey || lastS()?.xKey}
              yKey={props.btn.yKey || stepMeta().yKey || lastS()?.yKey}
              chartType={props.btn.chartType || stepMeta().chartType || (lastS() as any)?.chartType || "bar"}
              chartSeries={props.btn.chartSeries}
            />
          </Suspense>
        </Show>
      </Show>
    </div>
  );
}

// ─── Conditional Widget Wrapper ──────────────────────────────────────────────

function ConditionalWidgetWrapper(props: {
  btn: any;
  dashboardId?: string;
  children: any | ((outcome: Accessor<WidgetOutcome>) => any);
}) {
  const hasRules = () => (props.btn?.conditionRules || []).length > 0;
  const outcome = useWidgetOutcome(props.dashboardId, props.btn);
  const effective = () => (hasRules() ? applyWidgetConditions(props.btn, outcome().data) : { hidden: false });

  return (
    <Show when={!effective().hidden}>
      {typeof props.children === "function" ? props.children(outcome) : props.children}
    </Show>
  );
}

// ─── Infographic Widget (AntV @antv/infographic - Lazy Loaded) ────────────────
const InfographicWidget = lazy(() => import("~/components/dashboard/InfographicWidget"));


// ─── Shared public dashboard view (used by /p/[id] and the /library preview) ──

/** Fetches every workflow referenced by the given buttons, keyed by the raw workflowId. */
export async function loadWorkflowMap(buttons: any[], dashId?: string): Promise<Record<string, any>> {
  const ids: string[] = [...new Set((buttons || []).flatMap((b: any) => [
    b.workflowId,
    ...(b.chartSeries || []).map((s: any) => s.workflowId)
  ]).filter(Boolean))] as string[];
  const cleanDashId = dashId
    ? (dashId.includes(":") ? dashId.split(":")[1] : dashId).replace(/[⟨⟩]/g, "")
    : "";
  const dashQuery = cleanDashId ? `?dashboard=${encodeURIComponent(cleanDashId)}` : "";
  const entries = await Promise.all(
    ids.map(async (wid) => {
      const rawId = (wid.includes(":") ? wid.split(":")[1] : wid).replace(/[⟨⟩]/g, "");
      try {
        const r = await fetch(`/api/workflows/${rawId}${dashQuery}`);
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
  const [executing, setExecuting] = createStore<Record<string, "idle" | "running" | "success" | "error">>({});
  const [formState, setFormState] = createStore<Record<string, Record<string, any>>>({});

  const updateForm = (btnId: string, field: string, value: any) => {
    if (!formState[btnId]) {
      setFormState(btnId, { [field]: value });
    } else {
      setFormState(btnId, field, value);
    }
  };

  const triggerButton = async (btn: any, effectiveWorkflowId?: string) => {
    if (props.readOnly) return;
    if (executing[btn.id] === "running") return;
    setExecuting(btn.id, "running");
    try {
      const currentForm = formState[btn.id] || {};
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
        setExecuting(btn.id, "success");
        setTimeout(() => setExecuting(btn.id, "idle"), 2500);
        return json;
      } else {
        alert("Action failed: " + json.error);
        setExecuting(btn.id, "error");
        setTimeout(() => setExecuting(btn.id, "idle"), 2500);
        return json;
      }
    } catch (e: any) {
      alert("Network or Server error: " + e.message);
      setExecuting(btn.id, "error");
      setTimeout(() => setExecuting(btn.id, "idle"), 2500);
      return { success: false, error: e.message };
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
        const canShareConditionOutcome = () =>
          (btn.conditionRules?.length || 0) > 0 && !btn.conditionWorkflowId;

        return (
          <Show
            when={kind() === "chart" || kind() === "table" || kind() === "infographic"}
            fallback={
              <Switch
                fallback={
                  <InteractiveShell>
                    <DashboardPublicButtonFormWidget
                      btn={btn}
                      dashboardId={props.dashboardId}
                      executing={executing}
                      formState={formState}
                      updateForm={updateForm}
                      triggerButton={triggerButton}
                    />
                  </InteractiveShell>
                }
              >
                <Match when={kind() === "news"}>
                  <ConditionalWidgetWrapper btn={btn} dashboardId={props.dashboardId}>
                    <NewsWidgetComponent btn={btn} dashboardId={props.dashboardId} />
                  </ConditionalWidgetWrapper>
                </Match>
                <Match when={kind() === "toggle"}>
                  <ConditionalWidgetWrapper btn={btn} dashboardId={props.dashboardId}>
                    <InteractiveShell>
                      <ToggleWidgetComponent
                        btn={btn}
                        dashboardId={props.dashboardId}
                        formState={formState}
                        updateForm={updateForm}
                        triggerButton={triggerButton}
                      />
                    </InteractiveShell>
                  </ConditionalWidgetWrapper>
                </Match>
              </Switch>
            }
          >
            {/* ── Table / Chart / Infographic widget ── */}
            <ConditionalWidgetWrapper btn={btn} dashboardId={props.dashboardId}>
              {(outcome: Accessor<WidgetOutcome>) => (
                <Show
                  when={kind() === "infographic"}
                  fallback={
                    <div class={`rounded-2xl border p-5 shadow-xl ${kind() === "table" ? "border-emerald-500/20 bg-[#0a120d]" : "border-purple-500/20 bg-[#100a14]"}`}>
                      <Show when={wf()} fallback={
                        <div class="text-[#5b5b6e] text-sm italic">Loading workflow info...</div>
                      }>
                        <AutoWidget
                          dashboardId={props.dashboardId}
                          btn={btn}
                          workflow={wf()}
                          sharedOutcome={canShareConditionOutcome() ? outcome : undefined}
                        />
                      </Show>
                    </div>
                  }
                >
                  <Suspense>
                    <InfographicWidget syntax={btn.infographicSyntax} editable={btn.infographicEditable} />
                  </Suspense>
                </Show>
              )}
            </ConditionalWidgetWrapper>
          </Show>
        );
      }}
    />
  );
}
