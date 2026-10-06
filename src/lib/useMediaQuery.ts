import { createSignal, onCleanup, onMount } from "solid-js";

/**
 * SSR-safe media query signal. It is `false` on the server and during hydration,
 * and is updated right after mount to avoid hydration mismatches.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = createSignal(false);

  onMount(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    onCleanup(() => mql.removeEventListener("change", handler));
  });

  return matches;
}
