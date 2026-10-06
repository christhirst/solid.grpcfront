import { For, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { SLIDESHOW_INTERVALS, type Slideshow } from "~/lib/dashboard/useSlideshow";

export interface BoardNavBarProps {
  /** Zero-based index of the selected board in the current list (-1 if none). */
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  slideshow: Slideshow;
  /** Compact layout for phones (icon-only prev/next). */
  compact?: boolean;
}

/** Prev / counter / Next + slideshow controls, shared by the desktop preview and the phone card. */
export default function BoardNavBar(props: BoardNavBarProps) {
  const touch = "min-h-[44px] sm:min-h-0";

  return (
    <div class="flex flex-wrap items-center gap-2" data-no-swipe>
      <Button
        variant="secondary"
        size="sm"
        onClick={props.onPrev}
        disabled={props.total < 2}
        aria-label="Previous board"
        title="Previous board (←)"
        class={touch}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        <Show when={!props.compact}>Prev</Show>
      </Button>

      <span class="px-1 font-mono text-xs tabular-nums text-zinc-400" aria-live="polite">
        {props.index + 1} / {props.total}
      </span>

      <Button
        variant="secondary"
        size="sm"
        onClick={props.onNext}
        disabled={props.total < 2}
        aria-label="Next board"
        title="Next board (→)"
        class={touch}
      >
        <Show when={!props.compact}>Next</Show>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </Button>

      <div class="ml-auto flex items-center gap-2">
        <Show when={!props.compact || props.slideshow.playing()}>
          <select
            value={props.slideshow.intervalSec()}
            onChange={(e) => props.slideshow.setIntervalSec(Number(e.currentTarget.value))}
            aria-label="Slideshow interval"
            title="Slideshow interval"
            class="h-8 rounded-lg border border-zinc-800 bg-zinc-900 px-2 text-xs text-white focus:border-purple-500 focus:outline-none min-h-[44px] sm:min-h-0"
          >
            <For each={[...SLIDESHOW_INTERVALS]}>{(sec) => <option value={sec}>{sec}s</option>}</For>
          </select>
        </Show>
        <Button
          variant={props.slideshow.playing() ? "primary" : "secondary"}
          size="sm"
          onClick={props.slideshow.toggle}
          disabled={props.total < 2}
          aria-pressed={props.slideshow.playing()}
          title={props.slideshow.playing() ? "Pause slideshow" : "Start slideshow"}
          class={touch}
        >
          <Show
            when={props.slideshow.playing()}
            fallback={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
            }
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          </Show>
          <Show when={!props.compact}>{props.slideshow.playing() ? "Pause" : "Slideshow"}</Show>
        </Button>
      </div>

      <Show when={props.slideshow.playing()}>
        <div class="basis-full h-0.5 overflow-hidden rounded bg-zinc-800" role="progressbar" aria-label="Time until next board">
          <div
            class="h-full bg-purple-500 transition-[width] duration-200 ease-linear"
            style={{ width: `${props.slideshow.progress() * 100}%` }}
          ></div>
        </div>
      </Show>
    </div>
  );
}
