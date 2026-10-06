import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";

export const SLIDESHOW_INTERVALS = [10, 30, 60] as const;
const STORAGE_KEY = "library.slideshowSeconds";
const TICK_MS = 250;

/**
 * Auto-advances through boards every N seconds while playing.
 * Pauses while the tab is hidden; `restart()` resets the countdown (call after manual navigation).
 */
export function useSlideshow(advance: () => void, canRun: () => boolean) {
  const [playing, setPlaying] = createSignal(false);
  const [intervalSec, setIntervalSecSignal] = createSignal<number>(60);
  const [elapsed, setElapsed] = createSignal(0);

  onMount(() => {
    if (isServer) return;
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if ((SLIDESHOW_INTERVALS as readonly number[]).includes(saved)) setIntervalSecSignal(saved);
  });

  const setIntervalSec = (sec: number) => {
    setIntervalSecSignal(sec);
    setElapsed(0);
    if (!isServer) localStorage.setItem(STORAGE_KEY, String(sec));
  };

  // Stop automatically when there is nothing to browse.
  createEffect(() => {
    if (!canRun() && playing()) setPlaying(false);
  });

  createEffect(() => {
    if (!playing()) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      if (document.hidden) return;
      const next = elapsed() + TICK_MS;
      if (next >= intervalSec() * 1000) {
        setElapsed(0);
        advance();
      } else {
        setElapsed(next);
      }
    }, TICK_MS);
    onCleanup(() => clearInterval(timer));
  });

  return {
    playing,
    intervalSec,
    setIntervalSec,
    progress: () => Math.min(1, elapsed() / (intervalSec() * 1000)),
    toggle: () => setPlaying((p) => (canRun() ? !p : false)),
    restart: () => setElapsed(0),
  };
}

export type Slideshow = ReturnType<typeof useSlideshow>;
