import { For, Show } from "solid-js";
import { unwrap } from "solid-js/store";
import type {
  FormField,
  FormFieldType,
  SurveyBranchOperator,
  SurveyBranchRule,
  SurveyConfig,
  SurveyStep,
  WidgetConfig,
} from "~/lib/dashboard/widgetTypes";
import { FORM_VALIDATOR_OPTIONS, type FormValidatorType } from "~/lib/formValidator";
import { SURVEY_COMPLETE_TARGET } from "~/lib/dashboard/surveyEngine";
import {
  buildFormFieldFromVariable,
  detectStepVariables,
  extractFormVariables,
} from "~/lib/workflowVariableChecker";

export interface SurveyBuilderEditorProps {
  btn: WidgetConfig;
  workflows: any[];
  onUpdateSurveyConfig: (next: SurveyConfig) => void;
}

const FIELD_TYPE_OPTIONS: Array<{ value: FormFieldType; label: string }> = [
  { value: "string", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Single choice (radio)" },
  { value: "checkbox_group", label: "Multiple choice (checkboxes)" },
  { value: "rating", label: "Rating scale" },
  { value: "date", label: "Date" },
  { value: "list", label: "List" },
];

const BRANCH_OPERATORS: Array<{ value: SurveyBranchOperator; label: string; needsValue: boolean }> = [
  { value: "equals", label: "equals", needsValue: true },
  { value: "notEquals", label: "does not equal", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "gt", label: "is greater than", needsValue: true },
  { value: "gte", label: "is at least", needsValue: true },
  { value: "lt", label: "is less than", needsValue: true },
  { value: "lte", label: "is at most", needsValue: true },
  { value: "isEmpty", label: "is empty", needsValue: false },
  { value: "isNotEmpty", label: "is answered", needsValue: false },
];

const inputCls =
  "w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500";
const labelCls = "text-[11px] text-[#8b8b9e] block mb-0.5";
const iconBtn =
  "text-[#5b5b6e] hover:text-white disabled:opacity-30 disabled:hover:text-[#5b5b6e] px-1 text-xs";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

/** Builder UI for configuring survey behavior, ordered steps, questions and branching rules. */
export function SurveyBuilderEditor(props: SurveyBuilderEditorProps) {
  const cfg = (): SurveyConfig => props.btn.surveyConfig || { steps: [] };
  const steps = () => cfg().steps || [];

  /** Deep-clones the current config, applies a mutation and commits it to the parent. */
  const mutate = (fn: (draft: SurveyConfig) => void) => {
    const draft: SurveyConfig = JSON.parse(JSON.stringify(unwrap(cfg())));
    draft.steps = draft.steps || [];
    fn(draft);
    props.onUpdateSurveyConfig(draft);
  };

  const move = <T,>(arr: T[], from: number, to: number) => {
    if (to < 0 || to >= arr.length) return;
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
  };

  const addStep = () =>
    mutate((d) => {
      d.steps.push({
        id: uid("step"),
        title: `Step ${d.steps.length + 1}`,
        description: "",
        fields: [{ name: uid("question"), label: "New question", type: "string", required: false }],
        branchRules: [],
      });
    });

  const fieldsUpTo = (stepIndex: number): FormField[] =>
    steps()
      .slice(0, stepIndex + 1)
      .flatMap((s) => s.fields || []);

  const syncWorkflowVars = (stepIndex: number) =>
    mutate((d) => {
      const step = d.steps[stepIndex];
      const wf = props.workflows?.find((w: any) => w.id === step?.workflowId);
      if (!step || !wf) return;
      const existing = new Set(d.steps.flatMap((s) => (s.fields || []).map((f) => f.name)));
      const stepVars = (wf.steps || []).flatMap((s: any) => detectStepVariables(s));
      for (const v of extractFormVariables(wf)) {
        if (existing.has(v)) continue;
        const match = stepVars.find(
          (sv: any) => sv.name === v || sv.name === `form.${v}` || sv.name === `dashboard_form.${v}`
        );
        step.fields.push(
          match ? buildFormFieldFromVariable({ ...match, name: v }) : { name: v, label: v, type: "string", required: true }
        );
      }
    });

  return (
    <div class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 space-y-4">
      {/* Behavior & completion */}
      <div class="p-3 rounded-xl border border-indigo-500/30 bg-[#12121c] space-y-3">
        <div class="text-xs font-bold text-indigo-300">📋 Survey Behavior &amp; Completion</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          <For
            each={
              [
                { key: "showProgress", label: "Show progress bar", def: true },
                { key: "allowBack", label: "Allow Back button", def: true },
                { key: "passAccumulatedAnswers", label: "Carry earlier answers into step workflows", def: true },
                { key: "allowRestart", label: 'Allow "Start Again" on completion', def: true },
                { key: "showSummary", label: "Show answer summary on completion", def: false },
              ] as const
            }
          >
            {(opt) => (
              <label class="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  class="w-3.5 h-3.5 rounded border-[#2a2a3a] bg-[#1e1e2e] text-indigo-500"
                  checked={(cfg() as any)[opt.key] ?? opt.def}
                  onChange={(e) => mutate((d) => ((d as any)[opt.key] = e.currentTarget.checked))}
                />
                <span>{opt.label}</span>
              </label>
            )}
          </For>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label class={labelCls}>Completion Title</label>
            <input
              class={inputCls}
              value={cfg().completionTitle ?? "Thank you!"}
              onInput={(e) => mutate((d) => (d.completionTitle = e.currentTarget.value))}
            />
          </div>
          <div>
            <label class={labelCls}>Completion Message</label>
            <input
              class={inputCls}
              value={cfg().completionMessage ?? "Your responses have been submitted."}
              onInput={(e) => mutate((d) => (d.completionMessage = e.currentTarget.value))}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div class="space-y-3">
        <For each={steps()}>
          {(step: SurveyStep, si) => (
            <div class="rounded-xl border border-[#2a2a3a] bg-[#14141e] p-3 space-y-3">
              <div class="flex items-center gap-2">
                <span class="shrink-0 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold px-2 py-0.5">
                  Step {si() + 1}
                </span>
                <input
                  class={`${inputCls} flex-1 font-semibold`}
                  value={step.title}
                  placeholder="Step title"
                  onInput={(e) => mutate((d) => (d.steps[si()].title = e.currentTarget.value))}
                />
                <button type="button" class={iconBtn} title="Move up" disabled={si() === 0} onClick={() => mutate((d) => move(d.steps, si(), si() - 1))}>▲</button>
                <button type="button" class={iconBtn} title="Move down" disabled={si() === steps().length - 1} onClick={() => mutate((d) => move(d.steps, si(), si() + 1))}>▼</button>
                <button type="button" class={`${iconBtn} hover:!text-red-400`} title="Delete step" onClick={() => mutate((d) => d.steps.splice(si(), 1))}>✕</button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div class="sm:col-span-2">
                  <label class={labelCls}>Description</label>
                  <input class={inputCls} value={step.description || ""} onInput={(e) => mutate((d) => (d.steps[si()].description = e.currentTarget.value))} />
                </div>
                <div>
                  <label class={labelCls}>Next button label</label>
                  <input class={inputCls} value={step.nextLabel || ""} placeholder="Next → / Submit" onInput={(e) => mutate((d) => (d.steps[si()].nextLabel = e.currentTarget.value))} />
                </div>
              </div>

              {/* Step workflow */}
              <div class="flex flex-wrap items-end gap-2">
                <div class="flex-1 min-w-[180px]">
                  <label class={labelCls}>Step Workflow (runs when advancing)</label>
                  <select
                    class={inputCls}
                    value={step.workflowId || ""}
                    onChange={(e) => mutate((d) => (d.steps[si()].workflowId = e.currentTarget.value || undefined))}
                  >
                    <option value="">None (collect only)</option>
                    <For each={props.workflows || []}>
                      {(w: any) => (
                        <option value={w.id} selected={w.id === step.workflowId}>
                          {w.direction === "write" ? "📤 (Write) " : "📥 (Read) "}
                          {w.name}
                        </option>
                      )}
                    </For>
                  </select>
                </div>
                <Show when={step.workflowId}>
                  <button
                    type="button"
                    onClick={() => syncWorkflowVars(si())}
                    class="text-[10px] font-semibold px-2 py-1.5 rounded bg-indigo-600/20 text-indigo-200 hover:bg-indigo-600/40 border border-indigo-500/30"
                  >
                    + Sync Workflow Vars
                  </button>
                </Show>
              </div>

              {/* Questions */}
              <div class="space-y-2">
                <For each={step.fields || []}>
                  {(field: FormField, fi) => (
                    <div class="bg-[#1e1e2e]/50 p-2 rounded-lg border border-[#2a2a3a] space-y-2">
                      <div class="flex flex-wrap items-end gap-2">
                        <div class="flex-1 min-w-[100px]">
                          <label class={labelCls}>Variable</label>
                          <input class={`${inputCls} font-mono text-purple-300`} value={field.name} onInput={(e) => mutate((d) => (d.steps[si()].fields[fi()].name = e.currentTarget.value))} />
                        </div>
                        <div class="flex-1 min-w-[120px]">
                          <label class={labelCls}>Question</label>
                          <input class={inputCls} value={field.label} onInput={(e) => mutate((d) => (d.steps[si()].fields[fi()].label = e.currentTarget.value))} />
                        </div>
                        <div class="w-40">
                          <label class={labelCls}>Type</label>
                          <select class={inputCls} value={field.type || "string"} onChange={(e) => mutate((d) => (d.steps[si()].fields[fi()].type = e.currentTarget.value as FormFieldType))}>
                            <For each={FIELD_TYPE_OPTIONS}>{(o) => <option value={o.value} selected={(field.type || "string") === o.value}>{o.label}</option>}</For>
                          </select>
                        </div>
                        <div class="w-36">
                          <label class={labelCls}>Validator</label>
                          <select
                            class={`${inputCls} text-amber-200`}
                            value={field.validator || "none"}
                            onChange={(e) =>
                              mutate((d) => {
                                const f = d.steps[si()].fields[fi()];
                                f.validator = e.currentTarget.value as FormValidatorType;
                                if (f.validator === "required") f.required = true;
                              })
                            }
                          >
                            <For each={FORM_VALIDATOR_OPTIONS}>{(o) => <option value={o.value} selected={(field.validator || "none") === o.value}>{o.label}</option>}</For>
                          </select>
                        </div>
                        <label class="flex items-center gap-1 text-[11px] text-zinc-300 pb-1.5 cursor-pointer">
                          <input type="checkbox" class="w-3.5 h-3.5 rounded border-[#2a2a3a] bg-[#1e1e2e] text-indigo-500" checked={!!field.required} onChange={(e) => mutate((d) => (d.steps[si()].fields[fi()].required = e.currentTarget.checked))} />
                          Required
                        </label>
                        <div class="flex items-center pb-1">
                          <button type="button" class={iconBtn} disabled={fi() === 0} onClick={() => mutate((d) => move(d.steps[si()].fields, fi(), fi() - 1))}>▲</button>
                          <button type="button" class={iconBtn} disabled={fi() === (step.fields || []).length - 1} onClick={() => mutate((d) => move(d.steps[si()].fields, fi(), fi() + 1))}>▼</button>
                          <button type="button" class={`${iconBtn} hover:!text-red-400`} onClick={() => mutate((d) => d.steps[si()].fields.splice(fi(), 1))}>✕</button>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div class="sm:col-span-2">
                          <label class={labelCls}>Helper description</label>
                          <input class={inputCls} value={field.description || ""} onInput={(e) => mutate((d) => (d.steps[si()].fields[fi()].description = e.currentTarget.value))} />
                        </div>
                        <div>
                          <label class={labelCls}>Default value</label>
                          <input class={inputCls} value={String(field.defaultValue ?? "")} onInput={(e) => mutate((d) => (d.steps[si()].fields[fi()].defaultValue = e.currentTarget.value))} />
                        </div>
                      </div>

                      <Show when={field.type === "select" || field.type === "radio" || field.type === "checkbox_group"}>
                        <div>
                          <label class={labelCls}>Options (comma-separated)</label>
                          <input class={inputCls} value={field.options || ""} placeholder="e.g. Yes, No, Maybe" onInput={(e) => mutate((d) => (d.steps[si()].fields[fi()].options = e.currentTarget.value))} />
                        </div>
                      </Show>

                      <Show when={field.type === "rating"}>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label class={labelCls}>Scale</label>
                            <select class={inputCls} value={String(field.ratingMax || 5)} onChange={(e) => mutate((d) => (d.steps[si()].fields[fi()].ratingMax = Number(e.currentTarget.value)))}>
                              <option value="5" selected={(field.ratingMax || 5) === 5}>1 – 5</option>
                              <option value="10" selected={field.ratingMax === 10}>1 – 10</option>
                            </select>
                          </div>
                          <div>
                            <label class={labelCls}>Low label</label>
                            <input class={inputCls} value={field.ratingMinLabel || ""} onInput={(e) => mutate((d) => (d.steps[si()].fields[fi()].ratingMinLabel = e.currentTarget.value))} />
                          </div>
                          <div>
                            <label class={labelCls}>High label</label>
                            <input class={inputCls} value={field.ratingMaxLabel || ""} onInput={(e) => mutate((d) => (d.steps[si()].fields[fi()].ratingMaxLabel = e.currentTarget.value))} />
                          </div>
                        </div>
                      </Show>

                      <Show when={field.validator === "regex"}>
                        <div>
                          <label class={labelCls}>Regex pattern</label>
                          <input class={`${inputCls} font-mono text-amber-200`} value={field.validatorPattern || ""} placeholder="^[a-z0-9_]+$" onInput={(e) => mutate((d) => (d.steps[si()].fields[fi()].validatorPattern = e.currentTarget.value))} />
                        </div>
                      </Show>

                      <Show when={!["boolean", "select", "radio", "rating", "date"].includes(field.type)}>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label class={labelCls}>{field.type === "number" ? "Min value" : field.type === "list" || field.type === "checkbox_group" ? "Min items" : "Min length"}</label>
                            <input type="number" class={inputCls} value={field.validatorMin ?? ""} onInput={(e) => mutate((d) => (d.steps[si()].fields[fi()].validatorMin = e.currentTarget.value === "" ? undefined : Number(e.currentTarget.value)))} />
                          </div>
                          <div>
                            <label class={labelCls}>{field.type === "number" ? "Max value" : field.type === "list" || field.type === "checkbox_group" ? "Max items" : "Max length"}</label>
                            <input type="number" class={inputCls} value={field.validatorMax ?? ""} onInput={(e) => mutate((d) => (d.steps[si()].fields[fi()].validatorMax = e.currentTarget.value === "" ? undefined : Number(e.currentTarget.value)))} />
                          </div>
                          <div>
                            <label class={labelCls}>Custom error message</label>
                            <input class={inputCls} value={field.validatorMessage || ""} onInput={(e) => mutate((d) => (d.steps[si()].fields[fi()].validatorMessage = e.currentTarget.value))} />
                          </div>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
                <button
                  type="button"
                  onClick={() =>
                    mutate((d) => d.steps[si()].fields.push({ name: uid("question"), label: "New question", type: "string", required: false }))
                  }
                  class="text-[10px] font-semibold px-2.5 py-1 rounded bg-indigo-600/20 text-indigo-200 hover:bg-indigo-600/40 border border-indigo-500/30"
                >
                  + Add Question
                </button>
              </div>

              {/* Branching */}
              <div class="pt-2 border-t border-[#2a2a3a]/60 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold text-cyan-300">↪ Conditional Branching / Skip Rules</span>
                  <button
                    type="button"
                    onClick={() =>
                      mutate((d) => {
                        const first = fieldsUpTo(si())[0];
                        const rules = (d.steps[si()].branchRules = d.steps[si()].branchRules || []);
                        rules.push({
                          id: uid("rule"),
                          field: first?.name || "",
                          operator: "equals",
                          value: "",
                          targetStepId: SURVEY_COMPLETE_TARGET,
                        });
                      })
                    }
                    class="text-[10px] font-semibold px-2 py-0.5 rounded bg-cyan-600/20 text-cyan-200 hover:bg-cyan-600/40 border border-cyan-500/30"
                  >
                    + Add Branch Rule
                  </button>
                </div>
                <Show when={(step.branchRules || []).length === 0}>
                  <p class="text-[10px] text-[#5b5b6e]">No rules — this step always continues to the next step.</p>
                </Show>
                <For each={step.branchRules || []}>
                  {(rule: SurveyBranchRule, ri) => {
                    const needsValue = () => BRANCH_OPERATORS.find((o) => o.value === rule.operator)?.needsValue !== false;
                    return (
                      <div class="flex flex-wrap items-center gap-1.5 bg-[#1e1e2e]/50 p-2 rounded-lg border border-[#2a2a3a]">
                        <span class="text-[10px] font-mono text-cyan-400">IF</span>
                        <select class={`${inputCls} !w-auto`} value={rule.field} onChange={(e) => mutate((d) => (d.steps[si()].branchRules![ri()].field = e.currentTarget.value))}>
                          <For each={fieldsUpTo(si())}>{(f) => <option value={f.name} selected={f.name === rule.field}>{f.label || f.name}</option>}</For>
                        </select>
                        <select class={`${inputCls} !w-auto`} value={rule.operator} onChange={(e) => mutate((d) => (d.steps[si()].branchRules![ri()].operator = e.currentTarget.value as SurveyBranchOperator))}>
                          <For each={BRANCH_OPERATORS}>{(o) => <option value={o.value} selected={o.value === rule.operator}>{o.label}</option>}</For>
                        </select>
                        <Show when={needsValue()}>
                          <input class={`${inputCls} !w-28`} value={rule.value || ""} placeholder="value" onInput={(e) => mutate((d) => (d.steps[si()].branchRules![ri()].value = e.currentTarget.value))} />
                        </Show>
                        <span class="text-[10px] font-mono text-cyan-400">→</span>
                        <select class={`${inputCls} !w-auto`} value={rule.targetStepId} onChange={(e) => mutate((d) => (d.steps[si()].branchRules![ri()].targetStepId = e.currentTarget.value))}>
                          <option value={SURVEY_COMPLETE_TARGET} selected={rule.targetStepId === SURVEY_COMPLETE_TARGET}>Finish survey</option>
                          <For each={steps()}>
                            {(s, idx) => (
                              <Show when={idx() !== si()}>
                                <option value={s.id} selected={s.id === rule.targetStepId}>Step {idx() + 1}: {s.title}</option>
                              </Show>
                            )}
                          </For>
                        </select>
                        <button type="button" class={`${iconBtn} hover:!text-red-400`} onClick={() => mutate((d) => d.steps[si()].branchRules!.splice(ri(), 1))}>✕</button>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          )}
        </For>

        <button
          type="button"
          onClick={addStep}
          class="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-600/20 text-indigo-200 hover:bg-indigo-600/40 border border-dashed border-indigo-500/40"
        >
          + Add Step
        </button>
      </div>
    </div>
  );
}

export default SurveyBuilderEditor;
