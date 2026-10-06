/** Elements where a horizontal drag must keep its normal meaning (scrolling, typing, clicking). */
const IGNORE_SELECTOR =
  "canvas,table,input,select,textarea,button,a,[data-no-swipe],.overflow-auto,.overflow-x-auto,[contenteditable='true']";

/**
 * Touch swipe detection (pointer events). Returns handlers to spread on the swipeable element.
 * Swipe left => onLeft (next), swipe right => onRight (previous).
 * The element should use `touch-action: pan-y` so vertical scrolling keeps working.
 */
export function useSwipe(opts: { onLeft: () => void; onRight: () => void; enabled: () => boolean }) {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  const reset = () => {
    tracking = false;
  };

  return {
    onPointerDown: (e: PointerEvent) => {
      if (!opts.enabled() || e.pointerType === "mouse") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(IGNORE_SELECTOR)) return;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
    },
    onPointerUp: (e: PointerEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) opts.onLeft();
      else opts.onRight();
    },
    onPointerCancel: reset,
  };
}
