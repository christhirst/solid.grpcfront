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

/**
 * Prominent control bar for navigating between dashboards and running the library slideshow.
 * Positioned above the dashboard preview pane so users clearly distinguish board-level navigation
 * from in-dashboard widget actions.
 */
export default function BoardNavBar(props: BoardNavBarProps) {
  const touch = "min-h-[44px] sm:min-h-0";

  return (
    <div
      class={`rounded-2xl border border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md shadow-xl transition-all ${
        props.compact ? "p-2.5 sm:p-3" : "p-3 sm:px-5 sm:py-3.5"
      }`}
      data-no-swipe
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Previous / Counter / Next */}
        <div class="flex items-center gap-1.5 sm:gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={props.onPrev}
            disabled={props.total < 2}
            aria-label="Previous dashboard"
            title="Previous dashboard (←)"
            class={`${touch} text-xs font-semibold gap-1.5 hover:border-purple-500/50 hover:bg-zinc-900`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <Show when={!props.compact}>
              <span class="hidden sm:inline">Previous</span>
            </Show>
          </Button>

          <div
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs select-none"
            aria-live="polite"
          >
            <span class="text-zinc-500 hidden md:inline">Dashboard</span>
            <span class="font-mono font-bold text-white tabular-nums">{props.index + 1}</span>
            <span class="text-zinc-600">/</span>
            <span class="font-mono text-zinc-400 tabular-nums">{props.total}</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={props.onNext}
            disabled={props.total < 2}
            aria-label="Next dashboard"
            title="Next dashboard (→)"
            class={`${touch} text-xs font-semibold gap-1.5 hover:border-purple-500/50 hover:bg-zinc-900`}
          >
            <Show when={!props.compact}>
              <span class="hidden sm:inline">Next</span>
            </Show>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </Button>
        </div>

        {/* Right: Interval select & Slideshow button */}
        <div class="flex items-center gap-2 sm:gap-3 ml-auto">
          <div class="flex items-center gap-1.5">
            <Show when={!props.compact}>
              <span class="hidden lg:inline text-xs text-zinc-400 font-medium">Interval:</span>
            </Show>
            <select
              value={props.slideshow.intervalSec()}
              onChange={(e) => props.slideshow.setIntervalSec(Number(e.currentTarget.value))}
              aria-label="Slideshow interval"
              title="Slideshow interval"
              class={`h-8 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-white focus:border-purple-500 focus:outline-none ${touch} font-medium cursor-pointer hover:border-zinc-700 transition-colors`}
            >
              <For each={[...SLIDESHOW_INTERVALS]}>{(sec) => <option value={sec}>{sec}s</option>}</For>
            </select>
          </div>

          <Button
            variant={props.slideshow.playing() ? "primary" : "secondary"}
            size="sm"
            onClick={props.slideshow.toggle}
            disabled={props.total < 2}
            aria-pressed={props.slideshow.playing()}
            title={props.slideshow.playing() ? "Pause slideshow" : "Start slideshow"}
            class={`${touch} text-xs font-semibold gap-2 ${
              props.slideshow.playing()
                ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30"
                : "hover:border-purple-500/50 hover:bg-zinc-900"
            }`}
          >
            <Show
              when={props.slideshow.playing()}
              fallback={
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
                  <Show when={!props.compact}>
                    <span class="hidden sm:inline">Play Slideshow</span>
                  </Show>
                </>
              }
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
              <Show when={!props.compact}>
                <span class="hidden sm:inline">Pause</span>
              </Show>
            </Show>
          </Button>
        </div>
      </div>

      {/* Progress Bar & Countdown when slideshow is playing */}
      <Show when={props.slideshow.playing()}>
        <div class="mt-2.5 pt-2 border-t border-zinc-800/70">
          <div class="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
            <span class="flex items-center gap-1.5 text-purple-300 font-medium">
              <span class="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping"></span>
              Slideshow active
            </span>
            <span class="font-mono text-zinc-400">
              Next in {Math.max(1, Math.ceil(props.slideshow.intervalSec() * (1 - props.slideshow.progress())))}s
            </span>
          </div>
          <div
            class="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800/80"
            role="progressbar"
            aria-label="Time until next dashboard"
          >
            <div
              class="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-[width] duration-200 ease-linear rounded-full"
              style={{ width: `${props.slideshow.progress() * 100}%` }}
            ></div>
          </div>
        </div>
      </Show>
    </div>
  );
}
