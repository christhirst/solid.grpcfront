import { For, Show, Switch, Match, createSignal, createEffect } from "solid-js";
import {
  formatListFieldValue,
  parseListFieldValue,
  type EffectiveWidgetConfig,
  type FormField,
  type WidgetConfig,
} from "~/lib/dashboard/widgetTypes";
import { getWidgetTheme } from "~/lib/dashboard/widgetThemes";
import { parseOptionsList } from "~/lib/dashboard/surveyEngine";
import { getValueAtPath } from "~/lib/dashboard/widgetConditions";
import {
  formatValidatorBadge,
  validateFormFieldValue,
  validateFormPayload,
} from "~/lib/formValidator";

export type WidgetExecutionState = "idle" | "running" | "success" | "error";

export interface WidgetResponseOutcome {
  status: "idle" | "running" | "ready" | "error";
  data?: unknown;
  error?: string;
}

export interface DashboardButtonFormWidgetProps {
  btn: WidgetConfig;
  effective: EffectiveWidgetConfig;
  state: WidgetExecutionState;
  formState: Record<string, Record<string, unknown>>;
  updateForm: (btnId: string, field: string, value: unknown) => void;
  onTrigger: () => Promise<void> | void;
  responseOutcome?: WidgetResponseOutcome;
}

/** Build a button style for the given execution state and color. */
export function buildButtonClass(state: WidgetExecutionState, color?: string): string {
  const base = "w-full min-h-[36px] py-2 px-3 text-xs sm:text-sm font-bold text-white rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 select-none truncate";
  if (state === "running") return `${base} bg-slate-800 text-white/70 cursor-not-allowed`;
  if (state === "success") return `${base} bg-emerald-600 ring-2 ring-emerald-500/50`;
  if (state === "error") return `${base} bg-red-600 ring-2 ring-red-500/50`;
  const theme = getWidgetTheme(color);
  return `${base} active:scale-[0.98] focus:ring-2 focus:outline-none ${theme.buttonClass}`;
}

/** Resolves the display value of a field, falling back to its default value. */
export function getFieldValue(field: FormField, formValues: Record<string, unknown>): unknown {
  if (formValues[field.name] !== undefined) return formValues[field.name];
  return field.value ?? field.defaultValue ?? "";
}

/** Render a single form field input. */
function FormFieldInput(props: {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  invalid?: boolean;
  onBlur?: () => void;
}) {
  const inputBorderClass = () =>
    props.invalid
      ? "border-red-500/80 focus:border-red-500 focus:ring-red-500/50"
      : "border-[#2a2a3a] focus:border-purple-500 focus:ring-purple-500/50";

  return (
    <Switch
      fallback={
        <input
          type={props.field.type === "number" ? "number" : "text"}
          required={props.field.required}
          class={`w-full rounded-lg border bg-[#1e1e2e] p-2.5 text-sm text-white focus:outline-none focus:ring-1 transition-all ${inputBorderClass()}`}
          value={String(props.value ?? "")}
          onInput={(e) =>
            props.onChange(
              props.field.type === "number"
                ? e.currentTarget.value === ""
                  ? ""
                  : Number(e.currentTarget.value)
                : e.currentTarget.value
            )
          }
          onBlur={() => props.onBlur?.()}
          placeholder={`Enter ${props.field.label}...`}
        />
      }
    >
      <Match when={props.field.type === "boolean"}>
        <label class="flex items-center gap-3 cursor-pointer py-1.5">
          <input
            type="checkbox"
            class="w-4 h-4 rounded border-[#2a2a3a] bg-[#1e1e2e] text-purple-500 focus:ring-purple-500/50"
            checked={!!props.value}
            onChange={(e) => props.onChange(e.currentTarget.checked)}
            onBlur={() => props.onBlur?.()}
          />
          <span class="text-sm text-white">Enable</span>
        </label>
      </Match>
      <Match when={props.field.type === "select"}>
        <select
          class={`w-full rounded-lg border bg-[#1e1e2e] p-2.5 text-sm text-white focus:outline-none focus:ring-1 transition-all ${inputBorderClass()}`}
          value={String(props.value ?? "")}
          onChange={(e) => props.onChange(e.currentTarget.value)}
          onBlur={() => props.onBlur?.()}
        >
          <option value="" disabled>Select an option...</option>
          <For each={(props.field.options || "").split(",").map((o) => o.trim()).filter(Boolean)}>
            {(opt) => <option value={opt}>{opt}</option>}
          </For>
        </select>
      </Match>
      <Match when={props.field.type === "list"}>
        {(() => {
          const [rawText, setRawText] = createSignal(formatListFieldValue(props.value));
          const items = () => parseListFieldValue(props.value);

          createEffect(() => {
            const nextFormatted = formatListFieldValue(props.value);
            const currentParsed = parseListFieldValue(rawText()).join("\n");
            const nextParsed = parseListFieldValue(props.value).join("\n");
            if (currentParsed !== nextParsed) {
              setRawText(nextFormatted);
            }
          });

          const removeItem = (idx: number) => {
            const next = items().filter((_, i) => i !== idx);
            setRawText(next.join(", "));
            props.onChange(next);
          };

          return (
            <div class="space-y-2">
              <textarea
                rows={3}
                required={props.field.required}
                class={`w-full rounded-lg border bg-[#1e1e2e] p-2.5 text-sm text-white focus:outline-none focus:ring-1 transition-all font-mono ${inputBorderClass()}`}
                value={rawText()}
                onInput={(e) => {
                  const text = e.currentTarget.value;
                  setRawText(text);
                  props.onChange(parseListFieldValue(text));
                }}
                onBlur={() => props.onBlur?.()}
                placeholder={`Comma or newline separated values for ${props.field.label}...`}
              />
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-[10px] font-mono text-[#8b8b9e]">
                  {items().length} {items().length === 1 ? "item" : "items"}
                </span>
                <For each={items()}>
                  {(item, i) => (
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-[11px] font-mono text-purple-200">
                      <span class="truncate max-w-[180px]">{item}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(i())}
                        class="text-purple-300/70 hover:text-red-400 font-bold leading-none"
                        title="Remove item"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </For>
              </div>
            </div>
          );
        })()}
      </Match>
      <Match when={props.field.type === "date"}>
        <input
          type="date"
          required={props.field.required}
          class={`w-full min-h-[44px] rounded-lg border bg-[#1e1e2e] p-2.5 text-sm text-white focus:outline-none focus:ring-1 transition-all ${inputBorderClass()}`}
          value={String(props.value ?? "")}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          onBlur={() => props.onBlur?.()}
        />
      </Match>
      <Match when={props.field.type === "radio"}>
        <div class="grid grid-cols-1 gap-2" role="radiogroup" aria-label={props.field.label}>
          <For each={parseOptionsList(props.field.options)}>
            {(opt) => (
              <button
                type="button"
                role="radio"
                aria-checked={String(props.value ?? "") === opt}
                onClick={() => {
                  props.onChange(opt);
                  props.onBlur?.();
                }}
                class={`min-h-[44px] rounded-lg border px-3 py-2 text-left text-sm transition-all flex items-center gap-2.5 ${
                  String(props.value ?? "") === opt
                    ? "border-purple-500 bg-purple-500/15 text-white ring-1 ring-purple-500/40"
                    : "border-[#2a2a3a] bg-[#1e1e2e] text-[#c4c4d4] hover:border-purple-500/50"
                }`}
              >
                <span
                  class={`w-4 h-4 shrink-0 rounded-full border-2 ${
                    String(props.value ?? "") === opt ? "border-purple-400 bg-purple-500" : "border-[#5b5b6e]"
                  }`}
                />
                <span>{opt}</span>
              </button>
            )}
          </For>
        </div>
      </Match>
      <Match when={props.field.type === "checkbox_group"}>
        <div class="grid grid-cols-1 gap-2" role="group" aria-label={props.field.label}>
          <For each={parseOptionsList(props.field.options)}>
            {(opt) => {
              const selected = () => parseListFieldValue(props.value).includes(opt);
              return (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected()}
                  onClick={() => {
                    const cur = parseListFieldValue(props.value);
                    props.onChange(selected() ? cur.filter((v) => v !== opt) : [...cur, opt]);
                    props.onBlur?.();
                  }}
                  class={`min-h-[44px] rounded-lg border px-3 py-2 text-left text-sm transition-all flex items-center gap-2.5 ${
                    selected()
                      ? "border-purple-500 bg-purple-500/15 text-white ring-1 ring-purple-500/40"
                      : "border-[#2a2a3a] bg-[#1e1e2e] text-[#c4c4d4] hover:border-purple-500/50"
                  }`}
                >
                  <span
                    class={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-[10px] ${
                      selected() ? "border-purple-400 bg-purple-500 text-white" : "border-[#5b5b6e]"
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
      <Match when={props.field.type === "rating"}>
        <div class="space-y-1.5">
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label={props.field.label}>
            <For
              each={Array.from(
                { length: props.field.ratingMax && props.field.ratingMax > 0 ? props.field.ratingMax : 5 },
                (_, i) => i + 1
              )}
            >
              {(n) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={String(props.value ?? "") === String(n)}
                  onClick={() => {
                    props.onChange(n);
                    props.onBlur?.();
                  }}
                  class={`min-h-[44px] min-w-[44px] rounded-lg border text-sm font-bold transition-all ${
                    String(props.value ?? "") === String(n)
                      ? "border-purple-500 bg-purple-600 text-white ring-1 ring-purple-400/50"
                      : "border-[#2a2a3a] bg-[#1e1e2e] text-[#c4c4d4] hover:border-purple-500/50"
                  }`}
                >
                  {n}
                </button>
              )}
            </For>
          </div>
          <Show when={props.field.ratingMinLabel || props.field.ratingMaxLabel}>
            <div class="flex justify-between text-[10px] text-[#8b8b9e]">
              <span>{props.field.ratingMinLabel}</span>
              <span>{props.field.ratingMaxLabel}</span>
            </div>
          </Show>
        </div>
      </Match>
      <Match when={props.field.type === "textarea"}>
        <textarea
          rows={3}
          required={props.field.required}
          class={`w-full rounded-lg border bg-[#1e1e2e] p-2.5 text-sm text-white focus:outline-none focus:ring-1 transition-all font-mono ${inputBorderClass()}`}
          value={String(props.value ?? "")}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          onBlur={() => props.onBlur?.()}
          placeholder={`Enter ${props.field.label}...`}
        />
      </Match>
    </Switch>
  );
}

/** Shared button/form widget renderer with optional labeled response output fields and color theming. */
export function DashboardButtonFormWidget(props: DashboardButtonFormWidgetProps) {
  const [showResponse, setShowResponse] = createSignal(true);
  const [copiedFieldId, setCopiedFieldId] = createSignal<string | null>(null);
  const [touchedFields, setTouchedFields] = createSignal<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = createSignal(false);

  const isFormWidget = () => props.btn.widgetType === "form";
  const effectiveColor = () => props.effective?.color || props.btn.color;
  const theme = () => getWidgetTheme(effectiveColor());
  const isDisabled = () => props.effective?.disabled || props.state !== "idle";
  const formValues = () => props.formState[props.btn.id] || {};
  const fields = () => props.btn.formConfig || [];
  const hasFields = () => fields().length > 0;
  const btnClass = () => buildButtonClass(props.state, effectiveColor());
  const formValidation = () => validateFormPayload(fields(), formValues());

  const hasOutput = () => !!(props.btn.showOutput || (props.btn.outputConfig && props.btn.outputConfig.length > 0));
  const outputFields = () => {
    if (props.btn.outputConfig && props.btn.outputConfig.length > 0) {
      return props.btn.outputConfig;
    }
    return [{ id: "out_default", label: "Response", path: "" }];
  };

  // Render as a card if it is a Form widget, has input fields, or has output enabled
  const isCardMode = () => isFormWidget() || hasFields() || hasOutput();

  const handleTriggerClick = async () => {
    if (hasFields()) {
      setSubmitAttempted(true);
      const check = formValidation();
      if (!check.valid) {
        return;
      }
    }
    setSubmitAttempted(false);
    if (hasOutput()) {
      setShowResponse(true);
    }
    await props.onTrigger();
  };

  return (
    <Show when={!props.effective?.hidden}>
      <Show
        when={isCardMode()}
        fallback={
          /* Standalone compact Button Widget */
          <button
            onClick={handleTriggerClick}
            disabled={isDisabled()}
            class={btnClass()}
          >
            <ButtonContent state={props.state} label={props.effective?.label || props.btn.label || "Run"} />
          </button>
        }
      >
        {/* Card Mode: Form Widget, Button with Input Fields, or Button with Output Fields */}
        <Show when={!props.effective?.formHidden}>
          <div class={`rounded-2xl border ${theme().border} ${theme().ring} ${theme().accentGlow} bg-[#0e0e15] p-5 shadow-xl space-y-4 text-left w-full h-full flex flex-col justify-between transition-all duration-300`}>
            <div class="space-y-4">
              {/* Header */}
              <div class="flex items-center justify-between pb-2 border-b border-[#2a2a3a]/80">
                <div class="flex items-center gap-2 min-w-0">
                  <span class={`w-2.5 h-2.5 rounded-full shrink-0 ${theme().headerDot}`}></span>
                  <h3 class="text-sm font-bold text-white truncate">{props.effective?.label || props.btn.label}</h3>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <Show when={hasOutput()}>
                    <button
                      type="button"
                      onClick={() => setShowResponse(!showResponse())}
                      class={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                        showResponse()
                          ? `${theme().outputBadge} hover:opacity-80`
                          : "text-zinc-400 bg-zinc-800/40 border-zinc-700 hover:text-zinc-200"
                      }`}
                      title={showResponse() ? "Hide response output" : "Show response output"}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <Show when={showResponse()} fallback={<polygon points="5 3 19 12 5 21 5 3"></polygon>}>
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </Show>
                      </svg>
                      <span>{showResponse() ? "Response" : "Show Response"}</span>
                    </button>
                  </Show>
                  <span class={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${theme().badge}`}>
                    {isFormWidget() ? "Form" : "Button"}
                  </span>
                </div>
              </div>

              {/* Input Form Fields */}
              <Show when={hasFields()}>
                <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 pt-1">
                  <For each={fields()}>
                    {(field) => {
                      const value = () => getFieldValue(field, formValues());
                      const fieldResult = () => validateFormFieldValue(field, value());
                      const hasTypedValue = () =>
                        value() !== undefined && value() !== null && String(value()).trim() !== "";
                      const showError = () =>
                        !fieldResult().valid &&
                        (submitAttempted() || !!touchedFields()[field.name] || hasTypedValue());
                      const validatorBadge = () => formatValidatorBadge(field);

                      return (
                        <div class="col-span-1">
                          <div class="flex items-center justify-between gap-2 mb-1.5">
                            <label class="block text-xs font-bold text-[#8b8b9e] truncate">
                              {field.label}
                            </label>
                            <Show when={validatorBadge()}>
                              <span class="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                                {validatorBadge()}
                              </span>
                            </Show>
                          </div>
                          <Show when={field.description}>
                            <p class="mb-1.5 text-[11px] text-[#8b8b9e]">{field.description}</p>
                          </Show>
                          <FormFieldInput
                            field={field}
                            value={value()}
                            invalid={showError()}
                            onBlur={() =>
                              setTouchedFields((prev) => ({ ...prev, [field.name]: true }))
                            }
                            onChange={(nextVal) => {
                              setTouchedFields((prev) => ({ ...prev, [field.name]: true }));
                              props.updateForm(props.btn.id, field.name, nextVal);
                            }}
                          />
                          <Show when={showError()}>
                            <p class="mt-1 text-[11px] text-red-400 font-medium">
                              {fieldResult().error}
                            </p>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>

              {/* Fallback notice for empty form widget without output */}
              <Show when={isFormWidget() && !hasFields() && !hasOutput()}>
                <div class="py-6 px-4 my-2 text-center rounded-xl border border-dashed border-[#2a2a3a] bg-[#14141e] text-xs text-[#8b8b9e]">
                  No form fields configured yet. Add fields in configuration.
                </div>
              </Show>
            </div>

            {/* Bottom Actions & Response Output */}
            <div class="pt-3 space-y-3">
              <Show when={submitAttempted() && !formValidation().valid}>
                <div class="p-2.5 rounded-lg bg-red-950/50 border border-red-500/40 text-xs text-red-300">
                  {formValidation().firstError || "Please fix the highlighted form errors before submitting."}
                </div>
              </Show>

              {/* Trigger Button */}
              <button
                onClick={handleTriggerClick}
                disabled={isDisabled()}
                class={btnClass()}
              >
                <ButtonContent
                  state={props.state}
                  label={
                    isFormWidget()
                      ? `Submit ${props.effective?.label || props.btn.label}`
                      : props.effective?.label || props.btn.label || "Run"
                  }
                />
              </button>

              {/* Labeled Response Output Area */}
              <Show when={hasOutput() && showResponse()}>
                <div class={`rounded-xl border ${theme().outputBorder} ${theme().outputBg} p-3.5 space-y-2.5 transition-all`}>
                  <div class="flex items-center justify-between text-xs font-bold text-zinc-300 border-b border-zinc-800/60 pb-1.5">
                    <span class="flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                      <span>Response</span>
                    </span>
                    <Show when={props.responseOutcome?.status === "running"}>
                      <span class="text-[10px] text-purple-400 flex items-center gap-1 font-normal animate-pulse">
                        <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                        Executing...
                      </span>
                    </Show>
                  </div>

                  <Show when={props.responseOutcome?.status === "error"}>
                    <div class="p-2 rounded bg-red-950/40 border border-red-500/30 text-xs text-red-300">
                      {props.responseOutcome?.error || "Workflow failed to produce a response."}
                    </div>
                  </Show>

                  <Show when={props.responseOutcome?.status === "running"}>
                    <div class="py-4 text-center space-y-2">
                      <div class="inline-block animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                      <div class="text-[11px] text-zinc-400">Waiting for workflow response...</div>
                    </div>
                  </Show>

                  <Show when={props.responseOutcome?.status !== "running" && props.responseOutcome?.status !== "error"}>
                    <div class="space-y-2">
                      <For each={outputFields()}>
                        {(f) => {
                          const rawVal = () => {
                            if (!props.responseOutcome?.data) return undefined;
                            return getValueAtPath(props.responseOutcome.data, f.path);
                          };
                          const hasValue = () => rawVal() !== undefined;
                          const isPrimitiveArray = () => {
                            const v = rawVal();
                            return Array.isArray(v) && v.every((item) => typeof item !== "object" || item === null);
                          };
                          const copyText = () => {
                            const v = rawVal();
                            if (v === undefined || v === null) return "";
                            if (isPrimitiveArray()) {
                              return (v as any[]).join(", ");
                            }
                            if (typeof v === "object") {
                              return JSON.stringify(v, null, 2);
                            }
                            return String(v);
                          };
                          const handleCopy = () => {
                            const text = copyText();
                            if (typeof navigator !== "undefined" && navigator.clipboard) {
                              navigator.clipboard.writeText(text);
                              setCopiedFieldId(f.id);
                              setTimeout(() => setCopiedFieldId(null), 2000);
                            }
                          };

                          return (
                            <div class={`p-2.5 rounded-lg border ${theme().outputBorder} bg-zinc-950/40 border-zinc-800/80 space-y-1`}>
                              <div class="flex items-center justify-between text-[11px]">
                                <span class={`font-bold uppercase tracking-wider ${theme().outputHeader}`}>
                                  {f.label || "Response"}
                                </span>
                                <Show when={hasValue()}>
                                  <button
                                    type="button"
                                    onClick={handleCopy}
                                    class="text-[10px] text-zinc-400 hover:text-white px-1.5 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 transition-colors flex items-center gap-1"
                                    title="Copy value"
                                  >
                                    <Show when={copiedFieldId() === f.id} fallback={<span>Copy</span>}>
                                      <span class="text-emerald-400 font-semibold">✓ Copied</span>
                                    </Show>
                                  </button>
                                </Show>
                              </div>

                              <Show
                                when={hasValue()}
                                fallback={
                                  <div class="text-xs text-zinc-500 italic py-1">
                                    Click button above to fetch response
                                  </div>
                                }
                              >
                                <Switch>
                                  <Match when={isPrimitiveArray()}>
                                    <div class="flex flex-wrap gap-1.5 py-1">
                                      <For each={rawVal() as (string | number)[]}>
                                        {(item) => (
                                          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-zinc-800/80 text-zinc-200 border border-zinc-700/60 select-all">
                                            {String(item)}
                                          </span>
                                        )}
                                      </For>
                                    </div>
                                  </Match>
                                  <Match when={typeof rawVal() === "object" && rawVal() !== null}>
                                    <pre class="text-[11px] font-mono text-zinc-200 bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800/80 overflow-x-auto max-h-48 overflow-y-auto select-all whitespace-pre-wrap break-all">
                                      {JSON.stringify(rawVal(), null, 2)}
                                    </pre>
                                  </Match>
                                  <Match when={true}>
                                    <div class="text-xs font-mono text-zinc-100 break-all select-all font-semibold py-1">
                                      {String(rawVal())}
                                    </div>
                                  </Match>
                                </Switch>
                              </Show>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </Show>
    </Show>
  );
}

function ButtonContent(props: { state: WidgetExecutionState; label: string }) {
  return (
    <>
      <Show when={props.state === "idle"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span>{props.label}</span>
      </Show>
      <Show when={props.state === "running"}>
        <svg class="animate-spin h-4 w-4 text-purple-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span>Running...</span>
      </Show>
      <Show when={props.state === "success"}>
        <svg class="animate-bounce h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Success!</span>
      </Show>
      <Show when={props.state === "error"}>
        <svg class="animate-pulse h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
        <span>Failed</span>
      </Show>
    </>
  );
}
