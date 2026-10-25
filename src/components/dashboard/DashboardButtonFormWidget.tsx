import { For, Show, Switch, Match, createSignal } from "solid-js";
import type { EffectiveWidgetConfig, FormField, WidgetConfig } from "~/lib/dashboard/widgetTypes";
import { getWidgetTheme } from "~/lib/dashboard/widgetThemes";
import { getValueAtPath } from "~/lib/dashboard/widgetConditions";

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
}) {
  return (
    <Switch
      fallback={
        <input
          type={props.field.type === "number" ? "number" : "text"}
          required={props.field.required}
          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
          value={String(props.value ?? "")}
          onInput={(e) => props.onChange(props.field.type === "number" ? Number(e.currentTarget.value) : e.currentTarget.value)}
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
          />
          <span class="text-sm text-white">Enable</span>
        </label>
      </Match>
      <Match when={props.field.type === "select"}>
        <select
          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
          value={String(props.value ?? "")}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        >
          <option value="" disabled>Select an option...</option>
          <For each={(props.field.options || "").split(",").map((o) => o.trim()).filter(Boolean)}>
            {(opt) => <option value={opt}>{opt}</option>}
          </For>
        </select>
      </Match>
      <Match when={props.field.type === "textarea"}>
        <textarea
          rows={3}
          required={props.field.required}
          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all font-mono"
          value={String(props.value ?? "")}
          onInput={(e) => props.onChange(e.currentTarget.value)}
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

  const isFormWidget = () => props.btn.widgetType === "form";
  const effectiveColor = () => props.effective?.color || props.btn.color;
  const theme = () => getWidgetTheme(effectiveColor());
  const isDisabled = () => props.effective?.disabled || props.state !== "idle";
  const formValues = () => props.formState[props.btn.id] || {};
  const fields = () => props.btn.formConfig || [];
  const hasFields = () => fields().length > 0;
  const btnClass = () => buildButtonClass(props.state, effectiveColor());

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
                      return (
                        <div class="col-span-1">
                          <label class="block text-xs font-bold text-[#8b8b9e] mb-1.5">{field.label}</label>
                          <FormFieldInput
                            field={field}
                            value={value()}
                            onChange={(value) => props.updateForm(props.btn.id, field.name, value)}
                          />
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
                          const formatted = () => {
                            const v = rawVal();
                            if (v === undefined) return "No response data";
                            if (typeof v === "object" && v !== null) {
                              return JSON.stringify(v, null, 2);
                            }
                            return String(v);
                          };
                          const handleCopy = () => {
                            const text = typeof rawVal() === "object" ? JSON.stringify(rawVal(), null, 2) : String(rawVal() ?? "");
                            if (typeof navigator !== "undefined" && navigator.clipboard) {
                              navigator.clipboard.writeText(text);
                              setCopiedFieldId(f.id);
                              setTimeout(() => setCopiedFieldId(null), 2000);
                            }
                          };

                          return (
                            <div class={`p-2.5 rounded-lg border ${theme().outputBorder} bg-[#0b0b12]/80 space-y-1`}>
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
                                <Show
                                  when={typeof rawVal() === "object" && rawVal() !== null}
                                  fallback={
                                    <div class="text-xs font-mono text-zinc-100 break-all select-all font-semibold py-0.5">
                                      {formatted()}
                                    </div>
                                  }
                                >
                                  <pre class="text-[11px] font-mono text-zinc-200 bg-[#07070b] p-2 rounded border border-zinc-800/80 overflow-x-auto max-h-48 overflow-y-auto select-all">
                                    {formatted()}
                                  </pre>
                                </Show>
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
