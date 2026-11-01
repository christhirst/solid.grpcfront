import {
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  For,
  Show,
} from "solid-js";
import { isServer, Portal } from "solid-js/web";
import { PUBLIC_TAG, normalizeTagList, type ResourcePermissions } from "~/lib/groupAuth";
import { fetchTaggableGroups } from "~/lib/taggableGroups";

export interface GroupTagPickerProps {
  tags: string[];
  endpoint: string;
  canEdit?: boolean;
  onUpdated?: (nextTags: string[], permissions?: ResourcePermissions) => void;
}

export function GroupTagPicker(props: GroupTagPickerProps) {
  const [open, setOpen] = createSignal(false);
  const [filterText, setFilterText] = createSignal("");
  const [taggable, setTaggable] = createSignal<string[]>([PUBLIC_TAG]);
  const [localTags, setLocalTags] = createSignal<string[]>([]);
  const [savingTag, setSavingTag] = createSignal<string | null>(null);
  const [errorMsg, setErrorMsg] = createSignal("");
  const [coords, setCoords] = createSignal<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  let triggerRef: HTMLButtonElement | undefined;
  let popoverRef: HTMLDivElement | undefined;
  let searchInputRef: HTMLInputElement | undefined;

  createEffect(() => {
    setLocalTags(normalizeTagList(props.tags));
  });

  const canEdit = createMemo(() => props.canEdit !== false);

  const taggableSet = createMemo(() => new Set(taggable()));

  const foreignTags = createMemo(() => {
    const allowed = taggableSet();
    return localTags().filter((t) => !allowed.has(t));
  });

  const filteredOptions = createMemo(() => {
    const q = filterText().trim().toLowerCase();
    const all = taggable();
    if (!q) return all;
    return all.filter((g) => g.toLowerCase().includes(q));
  });

  const summaryLabel = createMemo(() => {
    const tags = localTags();
    if (tags.length === 0) return "Private";
    if (tags.length === 1 && tags[0] === PUBLIC_TAG) return "Public";
    const first = tags[0];
    const extra = tags.length - 1;
    return extra > 0 ? `${first} +${extra}` : first;
  });

  const hasPublicTag = createMemo(() => localTags().includes(PUBLIC_TAG));
  const hasGroupTags = createMemo(() =>
    localTags().some((t) => t !== PUBLIC_TAG)
  );

  const updatePosition = () => {
    if (isServer || !triggerRef) return;
    const rect = triggerRef.getBoundingClientRect();
    const popoverWidth = 256;
    const maxLeft = Math.max(8, window.innerWidth - popoverWidth - 12);
    const left = Math.min(Math.max(8, rect.left), maxLeft);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < 280 && rect.top > 280
        ? Math.max(8, rect.top - 270)
        : rect.bottom + 6;
    setCoords({ top, left });
  };

  const openPopover = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (open()) {
      setOpen(false);
      return;
    }
    setErrorMsg("");
    setFilterText("");
    updatePosition();
    setOpen(true);
    const loaded = await fetchTaggableGroups();
    setTaggable(loaded);
    setTimeout(() => {
      searchInputRef?.focus();
    }, 15);
  };

  createEffect(() => {
    if (isServer || !open()) return;

    const handleOutside = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (triggerRef?.contains(target) || popoverRef?.contains(target)) return;
      setOpen(false);
    };

    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        setOpen(false);
      }
    };

    const handleScrollOrResize = () => updatePosition();

    window.addEventListener("mousedown", handleOutside, true);
    window.addEventListener("keydown", handleKey, true);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    onCleanup(() => {
      window.removeEventListener("mousedown", handleOutside, true);
      window.removeEventListener("keydown", handleKey, true);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    });
  });

  const toggleTag = async (tag: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canEdit() || savingTag()) return;

    const previous = [...localTags()];
    const exists = previous.includes(tag);
    const next = exists
      ? previous.filter((t) => t !== tag)
      : [...previous, tag];

    setLocalTags(next);
    setSavingTag(tag);
    setErrorMsg("");

    try {
      const res = await fetch(props.endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to update tags (${res.status})`);
      }
      const authoritative: string[] = Array.isArray(json.data?.tags)
        ? json.data.tags
        : next;
      setLocalTags(authoritative);
      props.onUpdated?.(authoritative, json.data?.permissions);
    } catch (err: any) {
      setLocalTags(previous);
      setErrorMsg(err?.message || "Could not update tags.");
    } finally {
      setSavingTag(null);
    }
  };

  return (
    <div
      class="inline-flex items-center"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={openPopover}
        title={
          canEdit()
            ? "Click to filter and toggle group tags"
            : "View assigned group tags"
        }
        class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono font-semibold transition-colors ${
          hasPublicTag()
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
            : hasGroupTags()
              ? "border-purple-500/40 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25"
              : "border-zinc-700/80 bg-zinc-900/90 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        }`}
      >
        <Show
          when={hasPublicTag()}
          fallback={
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.3"
              class="shrink-0 opacity-80"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          }
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.3"
            class="shrink-0 opacity-85"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </Show>
        <span class="max-w-[9rem] truncate">{summaryLabel()}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          class="shrink-0 opacity-70"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <Show when={!isServer && open()}>
        <Portal>
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${coords().top}px`,
              left: `${coords().left}px`,
              "z-index": "9999",
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            class="w-64 rounded-xl border border-zinc-700/90 bg-zinc-950 p-2 text-white shadow-2xl ring-1 ring-black/60"
          >
            <div class="mb-1.5 flex items-center justify-between px-1">
              <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <Show when={canEdit()} fallback="Assigned Groups">
                  Group Tags Checklist
                </Show>
              </span>
              <span class="font-mono text-[10px] text-zinc-500">
                {localTags().length} selected
              </span>
            </div>

            <Show when={canEdit()}>
              <div class="relative mb-1.5">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={filterText()}
                  placeholder="Filter groups..."
                  onInput={(e) => setFilterText(e.currentTarget.value)}
                  class="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </Show>

            <div class="max-h-52 overflow-y-auto space-y-0.5 pr-0.5">
              <Show
                when={canEdit()}
                fallback={
                  <Show
                    when={localTags().length > 0}
                    fallback={
                      <div class="px-2 py-3 text-center text-xs text-zinc-500 italic">
                        Private (owner only)
                      </div>
                    }
                  >
                    <For each={localTags()}>
                      {(t) => (
                        <div class="flex items-center justify-between rounded-lg px-2.5 py-1.5 font-mono text-xs text-zinc-200">
                          <span>{t}</span>
                          <span class="text-purple-400">✓</span>
                        </div>
                      )}
                    </For>
                  </Show>
                }
              >
                <Show
                  when={filteredOptions().length > 0}
                  fallback={
                    <div class="px-2 py-3 text-center text-xs text-zinc-500 italic">
                      No matching groups
                    </div>
                  }
                >
                  <For each={filteredOptions()}>
                    {(group) => {
                      const isChecked = () => localTags().includes(group);
                      const isPublicItem = () => group === PUBLIC_TAG;
                      const isBusy = () => savingTag() === group;

                      return (
                        <button
                          type="button"
                          onClick={(e) => toggleTag(group, e)}
                          disabled={Boolean(savingTag())}
                          class={`flex w-full min-h-[44px] sm:min-h-[32px] items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                            isChecked()
                              ? isPublicItem()
                                ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                                : "bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
                              : "text-zinc-300 hover:bg-zinc-900"
                          }`}
                        >
                          <div class="flex items-center gap-2 min-w-0">
                            <span
                              class={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                isChecked()
                                  ? isPublicItem()
                                    ? "border-emerald-400 bg-emerald-500 text-zinc-950"
                                    : "border-purple-400 bg-purple-500 text-white"
                                  : "border-zinc-700 bg-zinc-900 text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            <div class="min-w-0">
                              <div class="truncate font-mono font-semibold">
                                <Show
                                  when={isPublicItem()}
                                  fallback={group}
                                >
                                  <span>🌐 public</span>
                                </Show>
                              </div>
                              <Show when={isPublicItem()}>
                                <div class="text-[10px] text-zinc-400 truncate">
                                  Visible to all in category
                                </div>
                              </Show>
                            </div>
                          </div>
                          <Show when={isBusy()}>
                            <span class="text-[10px] font-mono text-zinc-400">
                              …
                            </span>
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </Show>
              </Show>

              <Show when={canEdit() && foreignTags().length > 0}>
                <div class="mt-1.5 border-t border-zinc-800 pt-1.5">
                  <div class="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Other groups (locked)
                  </div>
                  <For each={foreignTags()}>
                    {(ft) => (
                      <div class="flex items-center justify-between rounded-lg px-2.5 py-1 font-mono text-xs text-zinc-400">
                        <span class="truncate">{ft}</span>
                        <span class="text-[10px] text-zinc-500" title="You are not a member of this group">
                          🔒
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            <Show when={errorMsg()}>
              <p class="mt-1.5 rounded bg-rose-950/60 px-2 py-1 text-[11px] text-rose-300 border border-rose-500/30">
                {errorMsg()}
              </p>
            </Show>
          </div>
        </Portal>
      </Show>
    </div>
  );
}

export default GroupTagPicker;
