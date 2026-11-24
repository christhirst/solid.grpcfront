import { For, Match, Show, Switch, createMemo, createSignal, onCleanup } from "solid-js";
import { createForm, getValues, reset, setValue, validate } from "@modular-forms/solid";
import type {
  EffectiveWidgetConfig,
  FormField,
  SurveyConfig,
  SurveyStep,
  WidgetConfig,
} from "~/lib/dashboard/widgetTypes";
import { parseListFieldValue } from "~/lib/dashboard/widgetTypes";
import {
  buildSurveyInitialValues,
  buildSurveyWorkflowPayload,
  normalizeSurveyStepAnswers,
  parseOptionsList,
  resolveNextSurveyStep,
} from "~/lib/dashboard/surveyEngine";
import {
  createModularFieldValidator,
  formatValidatorBadge,
  validateFormPayload,
} from "~/lib/formValidator";
import { getWidgetTheme } from "~/lib/dashboard/widgetThemes";
import { extractRunOutcome, getValueAtPath } from "~/lib/dashboard/widgetConditions";
import { pollRun } from "~/lib/dashboard/runPolling";
import type { WidgetResponseOutcome } from "./DashboardButtonFormWidget";

export interface SurveyTriggerResult {
  success: boolean;
  runId?: string;
  error?: string;
}

export interface DashboardSurveyWidgetProps {
  btn: WidgetConfig;
  effective?: EffectiveWidgetConfig;
  dashboardId?: string;
  readOnly?: boolean;
  /** True in the dashboard builder when the dashboard is unsaved (workflows cannot run yet). */
  isPreview?: boolean;
  onTriggerStep?: (
    payload: Record<string, unknown>,
    workflowId: string,
    stepId: string
  ) => Promise<SurveyTriggerResult | undefined>;
  onTriggerFinal?: (
    payload: Record<string, unknown>,
    workflowId: string
  ) => Promise<SurveyTriggerResult | undefined>;
}

const EMPTY_STEPS: SurveyStep[] = [];

const inputBase =
  "w-full min-h-[44px] rounded-lg border bg-[#1e1e2e] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 transition-all";

function fieldModularType(field: FormField): "string" | "string[]" | "boolean" {
  if (field.type === "checkbox_group") return "string[]";
  if (field.type === "boolean") return "boolean";
  return "string";
}

/** Multi-step survey / wizard widget powered by @modular-forms/solid. */
export function DashboardSurveyWidget(props: DashboardSurveyWidgetProps) {
  const cfg = createMemo<SurveyConfig>(() => props.btn.surveyConfig || { steps: EMPTY_STEPS });
  const steps = createMemo<SurveyStep[]>(() => cfg().steps || EMPTY_STEPS);
  const allFields = createMemo<FormField[]>(() => steps().flatMap((s) => s.fields || []));
  const theme = () => getWidgetTheme(props.effective?.color || props.btn.color);

  const [surveyForm, { Form, Field }] = createForm<Record<string, any>>({
    initialValues: buildSurveyInitialValues(steps()),
    validateOn: "blur",
    revalidateOn: "input",
  });

  const [stepHistory, setStepHistory] = createSignal<number[]>([0]);
  const [rawSnapshot, setRawSnapshot] = createSignal<Record<string, unknown>>({});
  const [completed, setCompleted] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [stepError, setStepError] = createSignal<string | null>(null);
  const [previewNotice, setPreviewNotice] = createSignal<string | null>(null);
  const [summaryRows, setSummaryRows] = createSignal<Array<{ label: string; value: string }>>([]);
  const [finalOutcome, setFinalOutcome] = createSignal<WidgetResponseOutcome>({ status: "idle" });
  let doneStepWorkflows = new Set<string>();
  let cancelPoll: (() => void) | undefined;
  onCleanup(() => cancelPoll?.());

  const currentIndex = () => {
    const last = stepHistory()[stepHistory().length - 1] ?? 0;
    return Math.min(Math.max(last, 0), Math.max(steps().length - 1, 0));
  };
  const currentStep = () => steps()[currentIndex()];
  const isLastStep = () => resolveNextSurveyStep(steps(), currentIndex(), normalizedAll()).type === "complete";
  const canGoBack = () => cfg().allowBack !== false && stepHistory().length > 1 && !submitting();
  const progressPct = () => {
    if (completed()) return 100;
    const total = Math.max(steps().length, 1);
    return Math.round((Math.min(stepHistory().length, total) / total) * 100);
  };
  const hasOutput = () =>
    !!(props.btn.showOutput || (props.btn.outputConfig && props.btn.outputConfig.length > 0));

  const readAllRaw = (): Record<string, unknown> => {
    const current = getValues(surveyForm, { shouldActive: false }) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...rawSnapshot() };
    for (const f of allFields()) {
      if (!f.name) continue;
      if (current[f.name] !== undefined) merged[f.name] = current[f.name];
    }
    return merged;
  };
  const normalizedAll = () => normalizeSurveyStepAnswers(allFields(), readAllRaw());

  const handleAdvance = async () => {
    if (submitting()) return;
    setStepError(null);
    setPreviewNotice(null);
    const step = currentStep();
    if (!step) return;
    const idx = currentIndex();

    const names = (step.fields || []).map((f) => f.name).filter(Boolean);
    let allValid = true;
    if (names.length > 0) {
      allValid = await validate(surveyForm, names as any, { shouldFocus: false });
    }
    const raw = readAllRaw();
    const stepAnswers = normalizeSurveyStepAnswers(step.fields || [], raw);
    const check = validateFormPayload(step.fields || [], stepAnswers);
    if (!allValid || !check.valid) {
      if (allValid && check.firstError) setStepError(check.firstError);
      return;
    }
    setRawSnapshot(raw);

    const merged = normalizeSurveyStepAnswers(allFields(), raw);
    const next = resolveNextSurveyStep(steps(), idx, merged);
    const passAccumulated = cfg().passAccumulatedAnswers !== false;
    const visited = stepHistory();

    if (step.workflowId && !props.readOnly && !doneStepWorkflows.has(step.id)) {
      if (props.onTriggerStep) {
        setSubmitting(true);
        const payload = buildSurveyWorkflowPayload(steps(), visited, idx, raw, passAccumulated);
        const res = await props.onTriggerStep(payload, step.workflowId, step.id);
        setSubmitting(false);
        if (!res?.success) {
          setStepError(res?.error || "This step could not be submitted. Please try again.");
          return;
        }
        doneStepWorkflows.add(step.id);
      } else if (props.isPreview) {
        setPreviewNotice("Preview: step workflow skipped until the dashboard is saved.");
      }
    }

    if (next.type === "step") {
      setStepHistory([...visited, next.index]);
      return;
    }

    if (props.btn.workflowId && !props.readOnly) {
      if (props.onTriggerFinal) {
        setSubmitting(true);
        const payload = buildSurveyWorkflowPayload(steps(), visited, idx, raw, true);
        const res = await props.onTriggerFinal(payload, props.btn.workflowId);
        setSubmitting(false);
        if (!res?.success) {
          setStepError(res?.error || "The survey could not be submitted. Please try again.");
          return;
        }
        if (res.runId && hasOutput()) {
          cancelPoll?.();
          setFinalOutcome({ status: "running" });
          cancelPoll = pollRun(
            res.runId,
            {
              onDone: (logs) => setFinalOutcome({ status: "ready", data: extractRunOutcome(logs) }),
              onError: (msg) => setFinalOutcome({ status: "error", error: msg }),
            },
            { maxAttempts: 60, intervalMs: 1000 }
          );
        }
      } else if (props.isPreview) {
        setPreviewNotice("Preview: final workflow skipped until the dashboard is saved.");
      }
    }

    const rows: Array<{ label: string; value: string }> = [];
    for (const i of visited) {
      for (const f of steps()[i]?.fields || []) {
        const v = merged[f.name];
        rows.push({
          label: f.label || f.name,
          value: Array.isArray(v) ? v.join(", ") : v === "" || v === undefined ? "—" : String(v),
        });
      }
    }
    setSummaryRows(rows);
    setCompleted(true);
  };

  const handleBack = () => {
    if (!canGoBack()) return;
    setRawSnapshot(readAllRaw());
    setStepError(null);
    setPreviewNotice(null);
    setStepHistory(stepHistory().slice(0, -1));
  };

  const handleRestart = () => {
    cancelPoll?.();
    doneStepWorkflows = new Set<string>();
    reset(surveyForm, { initialValues: buildSurveyInitialValues(steps()) } as any);
    setRawSnapshot({});
    setStepHistory([0]);
    setCompleted(false);
    setStepError(null);
    setPreviewNotice(null);
    setSummaryRows([]);
    setFinalOutcome({ status: "idle" });
  };

  const nextLabel = () => {
    const step = currentStep();
    if (step?.nextLabel?.trim()) return step.nextLabel.trim();
    return isLastStep() ? "Submit" : "Next →";
  };

  return (
    <div
      class={`rounded-2xl border ${theme().border} ${theme().ring} ${theme().accentGlow} bg-[#0e0e15] p-5 shadow-xl text-left w-full h-full flex flex-col gap-4 overflow-y-auto`}
    >
      <style>{`@keyframes survey-step-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}.survey-step-enter{animation:survey-step-in .28s ease-out both}`}</style>

      {/* Header */}
      <div class="space-y-2.5">
        <div class="flex items-center justify-between gap-2 pb-2 border-b border-[#2a2a3a]/80">
          <div class="flex items-center gap-2 min-w-0">
            <span class={`w-2.5 h-2.5 rounded-full shrink-0 ${theme().headerDot}`}></span>
            <h3 class="text-sm font-bold text-white truncate">
              {props.effective?.label || props.btn.label || "Survey"}
            </h3>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <Show when={!completed() && steps().length > 0}>
              <span class="text-[10px] font-mono text-[#8b8b9e]">
                Step {currentIndex() + 1} of {steps().length}
              </span>
            </Show>
            <span class={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${theme().badge}`}>
              Survey
            </span>
          </div>
        </div>
        <Show when={cfg().showProgress !== false && steps().length > 0}>
          <div
            class="h-1.5 w-full rounded-full bg-[#1e1e2e] overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct()}
          >
            <div
              class="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
              style={{ width: `${progressPct()}%` }}
            />
          </div>
        </Show>
      </div>

      <Show when={steps().length === 0}>
        <div class="py-6 px-4 text-center rounded-xl border border-dashed border-[#2a2a3a] bg-[#14141e] text-xs text-[#8b8b9e]">
          No survey steps configured yet. Add steps in configuration.
        </div>
      </Show>

      {/* Active step (only one step is mounted at a time) */}
      <Show when={!completed() && steps().length > 0 ? currentStep()?.id : undefined} keyed>
        {(stepKey) => (
          <Form onSubmit={handleAdvance} class="flex flex-col gap-4 flex-1 survey-step-enter" id={`survey-step-${stepKey}`}>
            <div class="space-y-1">
              <h4 class="text-base font-bold text-white">{currentStep()?.title}</h4>
              <Show when={currentStep()?.description}>
                <p class="text-xs text-[#8b8b9e]">{currentStep()?.description}</p>
              </Show>
            </div>

            <div class="space-y-4">
              <For each={currentStep()?.fields || []}>
                {(f) => (
                  <Field
                    name={f.name as any}
                    type={fieldModularType(f) as any}
                    validate={createModularFieldValidator(f) as any}
                    keepState={true}
                  >
                    {(field: any, fprops: any) => {
                      const options = () => parseOptionsList(f.options);
                      const borderCls = () =>
                        field.error
                          ? "border-red-500/80 focus:border-red-500 focus:ring-red-500/50"
                          : "border-[#2a2a3a] focus:border-purple-500 focus:ring-purple-500/50";
                      const pick = (value: unknown) => {
                        setValue(surveyForm as any, f.name, value as any, { shouldTouched: true });
                        void validate(surveyForm as any, f.name as any, { shouldFocus: false });
                      };
                      const badge = () => formatValidatorBadge(f);
                      return (
                        <div class="space-y-1.5">
                          <div class="flex items-center justify-between gap-2">
                            <label class="block text-xs font-bold text-[#c4c4d4]">
                              {f.label || f.name}
                              <Show when={f.required}>
                                <span class="text-red-400 ml-0.5">*</span>
                              </Show>
                            </label>
                            <Show when={badge()}>
                              <span class="text-[9px] font-semibold px-1.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                                {badge()}
                              </span>
                            </Show>
                          </div>
                          <Show when={f.description}>
                            <p class="text-[11px] text-[#8b8b9e]">{f.description}</p>
                          </Show>

                          <Switch
                            fallback={
                              <input
                                {...fprops}
                                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                                value={String(field.value ?? "")}
                                placeholder={f.placeholder || `Enter ${f.label || f.name}...`}
                                class={`${inputBase} ${borderCls()}`}
                              />
                            }
                          >
                            <Match when={f.type === "textarea"}>
                              <textarea
                                {...fprops}
                                rows={3}
                                value={String(field.value ?? "")}
                                placeholder={f.placeholder || `Enter ${f.label || f.name}...`}
                                class={`${inputBase} ${borderCls()}`}
                              />
                            </Match>
                            <Match when={f.type === "boolean"}>
                              <label class="flex items-center gap-3 cursor-pointer min-h-[44px] rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] px-3">
                                <input
                                  {...fprops}
                                  type="checkbox"
                                  checked={!!field.value}
                                  class="w-4 h-4 rounded border-[#2a2a3a] bg-[#1e1e2e] text-purple-500"
                                />
                                <span class="text-sm text-white">Yes</span>
                              </label>
                            </Match>
                            <Match when={f.type === "select"}>
                              <select
                                {...fprops}
                                value={String(field.value ?? "")}
                                class={`${inputBase} ${borderCls()}`}
                              >
                                <option value="" selected={!field.value}>
                                  Select an option...
                                </option>
                                <For each={options()}>
                                  {(opt) => (
                                    <option value={opt} selected={field.value === opt}>
                                      {opt}
                                    </option>
                                  )}
                                </For>
                              </select>
                            </Match>
                            <Match when={f.type === "radio"}>
                              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label={f.label}>
                                <For each={options()}>
                                  {(opt) => (
                                    <button
                                      type="button"
                                      role="radio"
                                      aria-checked={field.value === opt}
                                      onClick={() => pick(opt)}
                                      class={`min-h-[44px] rounded-lg border px-3 py-2 text-left text-sm transition-all flex items-center gap-2.5 ${
                                        field.value === opt
                                          ? "border-purple-500 bg-purple-500/15 text-white ring-1 ring-purple-500/40"
                                          : "border-[#2a2a3a] bg-[#1e1e2e] text-[#c4c4d4] hover:border-purple-500/50"
                                      }`}
                                    >
                                      <span
                                        class={`w-4 h-4 shrink-0 rounded-full border-2 ${
                                          field.value === opt
                                            ? "border-purple-400 bg-purple-500"
                                            : "border-[#5b5b6e]"
                                        }`}
                                      />
                                      <span>{opt}</span>
                                    </button>
                                  )}
                                </For>
                              </div>
                            </Match>
                            <Match when={f.type === "checkbox_group"}>
                              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label={f.label}>
                                <For each={options()}>
                                  {(opt) => {
                                    const selected = () => parseListFieldValue(field.value).includes(opt);
                                    return (
                                      <button
                                        type="button"
                                        role="checkbox"
                                        aria-checked={selected()}
                                        onClick={() => {
                                          const cur = parseListFieldValue(field.value);
                                          pick(selected() ? cur.filter((v) => v !== opt) : [...cur, opt]);
                                        }}
                                        class={`min-h-[44px] rounded-lg border px-3 py-2 text-left text-sm transition-all flex items-center gap-2.5 ${
                                          selected()
                                            ? "border-purple-500 bg-purple-500/15 text-white ring-1 ring-purple-500/40"
                                            : "border-[#2a2a3a] bg-[#1e1e2e] text-[#c4c4d4] hover:border-purple-500/50"
                                        }`}
                                      >
                                        <span
                                          class={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-[10px] ${
                                            selected()
                                              ? "border-purple-400 bg-purple-500 text-white"
                                              : "border-[#5b5b6e]"
                                          }`}
                                        >
                                          <Show when={selected()}>✓</Show>
                                        </span>
                                        <span>{opt}</span>
                                      </button>
                                    );
                                  }}
                                </For>
                              </div>
                            </Match>
                            <Match when={f.type === "rating"}>
                              <div class="space-y-1.5">
                                <div class="flex flex-wrap gap-2" role="radiogroup" aria-label={f.label}>
                                  <For each={Array.from({ length: f.ratingMax && f.ratingMax > 0 ? f.ratingMax : 5 }, (_, i) => i + 1)}>
                                    {(n) => (
                                      <button
                                        type="button"
                                        role="radio"
                                        aria-checked={String(field.value) === String(n)}
                                        onClick={() => pick(String(n))}
                                        class={`min-h-[44px] min-w-[44px] rounded-lg border text-sm font-bold transition-all ${
                                          String(field.value) === String(n)
                                            ? "border-purple-500 bg-purple-600 text-white ring-1 ring-purple-400/50"
                                            : "border-[#2a2a3a] bg-[#1e1e2e] text-[#c4c4d4] hover:border-purple-500/50"
                                        }`}
                                      >
                                        {n}
                                      </button>
                                    )}
                                  </For>
                                </div>
                                <Show when={f.ratingMinLabel || f.ratingMaxLabel}>
                                  <div class="flex justify-between text-[10px] text-[#8b8b9e]">
                                    <span>{f.ratingMinLabel}</span>
                                    <span>{f.ratingMaxLabel}</span>
                                  </div>
                                </Show>
                              </div>
                            </Match>
                            <Match when={f.type === "list"}>
                              <div class="space-y-2">
                                <textarea
                                  {...fprops}
                                  rows={3}
                                  value={String(field.value ?? "")}
                                  placeholder="Comma or newline separated values..."
                                  class={`${inputBase} font-mono ${borderCls()}`}
                                />
                                <div class="flex flex-wrap gap-1.5">
                                  <For each={parseListFieldValue(field.value)}>
                                    {(item) => (
                                      <span class="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-[11px] font-mono text-purple-200">
                                        {item}
                                      </span>
                                    )}
                                  </For>
                                </div>
                              </div>
                            </Match>
                          </Switch>

                          <Show when={field.error}>
                            <p class="text-[11px] text-red-400 font-medium" role="alert">
                              {field.error}
                            </p>
                          </Show>
                        </div>
                      );
                    }}
                  </Field>
                )}
              </For>
            </div>

            <Show when={stepError()}>
              <div class="p-2.5 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-300" role="alert">
                {stepError()}
              </div>
            </Show>
            <Show when={previewNotice()}>
              <div class="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200">
                {previewNotice()}
              </div>
            </Show>

            <div class="flex items-center justify-between gap-3 pt-2 mt-auto">
              <Show when={canGoBack()} fallback={<span />}>
                <button
                  type="button"
                  onClick={handleBack}
                  class="min-h-[44px] px-4 rounded-xl border border-[#2a2a3a] bg-[#1e1e2e] text-sm font-semibold text-[#c4c4d4] hover:bg-[#2a2a3a] transition-colors"
                >
                  ← Back
                </button>
              </Show>
              <button
                type="submit"
                disabled={submitting() || props.effective?.disabled}
                class={`min-h-[44px] px-6 rounded-xl text-sm font-bold text-white shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed ${theme().buttonClass}`}
              >
                <Show when={submitting()} fallback={nextLabel()}>
                  Submitting...
                </Show>
              </button>
            </div>
          </Form>
        )}
      </Show>

      {/* Completion screen */}
      <Show when={completed()}>
        <div class="flex flex-col items-center gap-3 py-4 text-center survey-step-enter">
          <div class="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 text-xl">
            ✓
          </div>
          <h4 class="text-lg font-bold text-white">{cfg().completionTitle || "Thank you!"}</h4>
          <p class="text-sm text-[#8b8b9e]">
            {cfg().completionMessage || "Your responses have been submitted."}
          </p>

          <Show when={cfg().showSummary === true && summaryRows().length > 0}>
            <div class="w-full rounded-xl border border-[#2a2a3a] bg-[#14141e] divide-y divide-[#2a2a3a] text-left">
              <For each={summaryRows()}>
                {(row) => (
                  <div class="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                    <span class="text-[#8b8b9e]">{row.label}</span>
                    <span class="text-white font-medium text-right break-all">{row.value}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={hasOutput() && finalOutcome().status !== "idle"}>
            <div class={`w-full rounded-xl border ${theme().outputBorder} ${theme().outputBg} p-3 space-y-2 text-left`}>
              <Show when={finalOutcome().status === "running"}>
                <div class="text-xs text-purple-300 animate-pulse">Waiting for workflow response...</div>
              </Show>
              <Show when={finalOutcome().status === "error"}>
                <div class="text-xs text-red-300">{finalOutcome().error || "Workflow failed."}</div>
              </Show>
              <Show when={finalOutcome().status === "ready"}>
                <For each={props.btn.outputConfig && props.btn.outputConfig.length > 0 ? props.btn.outputConfig : [{ id: "out_default", label: "Response", path: "" }]}>
                  {(o) => {
                    const val = () => getValueAtPath(finalOutcome().data, o.path);
                    return (
                      <div class="space-y-0.5">
                        <div class={`text-[11px] font-bold uppercase tracking-wider ${theme().outputHeader}`}>
                          {o.label || "Response"}
                        </div>
                        <pre class="text-[11px] font-mono text-zinc-200 whitespace-pre-wrap break-all">
                          {typeof val() === "object" ? JSON.stringify(val(), null, 2) : String(val() ?? "")}
                        </pre>
                      </div>
                    );
                  }}
                </For>
              </Show>
            </div>
          </Show>

          <Show when={cfg().allowRestart !== false}>
            <button
              type="button"
              onClick={handleRestart}
              class="min-h-[44px] px-5 rounded-xl border border-[#2a2a3a] bg-[#1e1e2e] text-sm font-semibold text-[#c4c4d4] hover:bg-[#2a2a3a] transition-colors"
            >
              Start Again
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default DashboardSurveyWidget;
