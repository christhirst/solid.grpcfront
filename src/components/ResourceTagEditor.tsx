import { createSignal, createMemo, onMount, For, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { Badge } from "~/components/ui/badge";
import { normalizeGroupName, validateGroupName } from "~/lib/groupAuth";

export interface ResourceTagEditorProps {
  tags: string[];
  onChange?: (nextTags: string[]) => void;
  readOnly?: boolean;
  compact?: boolean;
  placeholder?: string;
  label?: string;
}

/**
 * Reusable Group Tag Editor & Badge Display for Dashboards, Workflows, Connections, Databases, Protos, and CAs.
 * Tags represent hierarchical group namespaces (e.g. "group1", "group1.test1").
 */
export function ResourceTagEditor(props: ResourceTagEditorProps) {
  const [inputVal, setInputVal] = createSignal("");
  const [errorMsg, setErrorMsg] = createSignal("");
  const [knownGroups, setKnownGroups] = createSignal<string[]>([]);
  const [focused, setFocused] = createSignal(false);

  onMount(async () => {
    if (isServer || props.readOnly) return;
    try {
      const res = await fetch("/api/user/profile");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.allGrants)) {
        const names = json.data.allGrants
          .map((g: any) => String(g.group || ""))
          .filter(Boolean);
        setKnownGroups(names);
      }
    } catch {
      // Ignore if unauthenticated
    }
  });

  const currentTags = createMemo(() =>
    (props.tags || []).map((t) => normalizeGroupName(String(t).split(":")[0] || "")).filter(Boolean)
  );

  const suggestions = createMemo(() => {
    const q = normalizeGroupName(inputVal());
    const existing = new Set(currentTags());
    return knownGroups().filter(
      (g) => !existing.has(g) && (!q || g.includes(q))
    );
  });

  const addTag = (raw: string) => {
    if (props.readOnly || !props.onChange) return;
    const cleanRaw = raw.split(":")[0]?.trim() || "";
    if (!cleanRaw) return;
    const validationErr = validateGroupName(cleanRaw);
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }
    const norm = normalizeGroupName(cleanRaw);
    setErrorMsg("");
    if (norm && !currentTags().includes(norm)) {
      props.onChange([...currentTags(), norm]);
    }
    setInputVal("");
  };

  const removeTag = (tagToRemove: string, e?: Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (props.readOnly || !props.onChange) return;
    props.onChange(currentTags().filter((t) => t !== tagToRemove));
  };

  return (
    <div class="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <Show when={props.label}>
        <label class="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {props.label}
        </label>
      </Show>

      <div class="flex flex-wrap items-center gap-1.5">
        <Show
          when={currentTags().length > 0}
          fallback={
            <Show when={props.readOnly}>
              <span class="text-[11px] italic text-zinc-500">Private (Creator only)</span>
            </Show>
          }
        >
          <For each={currentTags()}>
            {(tag) => (
              <Badge
                variant="purple"
                class={`gap-1 font-mono ${
                  !props.readOnly && props.onChange
                    ? "cursor-pointer hover:bg-purple-500/25"
                    : ""
                } ${props.compact ? "px-2 py-0.5 text-[10px]" : ""}`}
                onClick={(e: MouseEvent) => {
                  if (!props.readOnly && props.onChange) {
                    removeTag(tag, e);
                  }
                }}
                title={
                  !props.readOnly && props.onChange
                    ? `Group "${tag}" — click to remove`
                    : `Shared with group "${tag}"`
                }
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  class="opacity-75 shrink-0"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span>{tag}</span>
                <Show when={!props.readOnly && props.onChange}>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </Show>
              </Badge>
            )}
          </For>
        </Show>

        <Show when={!props.readOnly && props.onChange}>
          <div class="relative inline-flex items-center">
            <input
              type="text"
              class={`rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none ${
                props.compact ? "w-36" : "w-44"
              }`}
              placeholder={props.placeholder || "Add group (e.g. group1.test1)"}
              value={inputVal()}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 180)}
              onInput={(e) => {
                setInputVal(e.currentTarget.value);
                setErrorMsg("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(inputVal());
                }
              }}
            />
            <Show when={inputVal().trim()}>
              <button
                type="button"
                onClick={() => addTag(inputVal())}
                class="ml-1 rounded-md bg-purple-600/30 border border-purple-500/40 px-2 py-1 text-[10px] font-semibold text-purple-200 hover:bg-purple-600/50"
              >
                + Add
              </button>
            </Show>

            {/* Quick pick dropdown from user's known groups */}
            <Show when={focused() && suggestions().length > 0}>
              <div class="absolute left-0 top-full mt-1 z-40 min-w-[11rem] max-h-40 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-1 shadow-2xl">
                <div class="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Your Groups
                </div>
                <For each={suggestions()}>
                  {(sug) => (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addTag(sug);
                      }}
                      class="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-mono text-xs text-zinc-200 hover:bg-purple-500/20 hover:text-purple-200"
                    >
                      <span>{sug}</span>
                      <span class="text-[10px] text-purple-400">+ Tag</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      <Show when={errorMsg()}>
        <p class="text-[11px] text-rose-400">{errorMsg()}</p>
      </Show>
    </div>
  );
}

export default ResourceTagEditor;

