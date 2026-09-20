import { For, Show, Switch, Match } from "solid-js";
import type { EffectiveWidgetConfig, FormField, WidgetConfig } from "~/lib/dashboard/widgetTypes";

export type WidgetExecutionState = "idle" | "running" | "success" | "error";

export interface DashboardButtonFormWidgetProps {
  btn: WidgetConfig;
  effective: EffectiveWidgetConfig;
  state: WidgetExecutionState;
  formState: Record<string, Record<string, unknown>>;
  updateForm: (btnId: string, field: string, value: unknown) => void;
  onTrigger: () => Promise<void> | void;
}

const colorClassMap: Record<string, string> = {
  blue: "bg-blue-600 hover:bg-blue-500 ring-blue-500/50",
  red: "bg-red-600 hover:bg-red-500 ring-red-500/50",
  emerald: "bg-emerald-600 hover:bg-emerald-500 ring-emerald-500/50",
  purple: "bg-purple-600 hover:bg-purple-500 ring-purple-500/50",
  slate: "bg-slate-700 hover:bg-slate-600 ring-slate-500/50",
};

/** Build a button style for the given execution state and color. */
export function buildButtonClass(state: WidgetExecutionState, color?: string): string {
  const base = "w-full h-full min-h-[36px] py-2 px-3 text-xs sm:text-sm font-bold text-white rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 select-none truncate";
  if (state === "running") return `${base} bg-slate-800 text-white/70 cursor-not-allowed`;
  if (state === "success") return `${base} bg-emerald-600 ring-2 ring-emerald-500/50`;
  if (state === "error") return `${base} bg-red-600 ring-2 ring-red-500/50`;
  const colorStyle = colorClassMap[color || "blue"] || colorClassMap.blue;
  return `${base} active:scale-[0.98] focus:ring-2 focus:outline-none ${colorStyle}`;
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

/** Shared button/form widget renderer. Hides the whole widget or the form based on the effective config. */
export function DashboardButtonFormWidget(props: DashboardButtonFormWidgetProps) {
  const effectiveColor = () => props.effective?.color || props.btn.color;
  const isDisabled = () => props.effective?.disabled || props.state !== "idle";
  const formValues = () => props.formState[props.btn.id] || {};
  const fields = () => props.btn.formConfig || [];
  const hasFields = () => fields().length > 0;
  const btnClass = () => buildButtonClass(props.state, effectiveColor());

  return (
    <Show when={!props.effective?.hidden}>
      <Show
        when={!props.effective?.formHidden && hasFields()}
        fallback={
          <button
            onClick={props.onTrigger}
            disabled={isDisabled()}
            class={btnClass()}
          >
            <ButtonContent state={props.state} label={props.effective?.label || props.btn.label || "Run"} />
          </button>
        }
      >
        <div class="rounded-2xl border border-[#2a2a3a] bg-[#0e0e15] p-5 shadow-xl space-y-4 text-left">
          <div class="flex items-center gap-2 pb-2 border-b border-[#2a2a3a]">
            <span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
            <h3 class="text-sm font-bold text-white">{props.effective?.label || props.btn.label}</h3>
          </div>

          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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

          <div class="pt-2">
            <button
              onClick={props.onTrigger}
              disabled={isDisabled()}
              class={btnClass()}
            >
              <ButtonContent state={props.state} label={`Execute ${props.effective?.label || props.btn.label}`} />
            </button>
          </div>
        </div>
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
