import { isServer } from "solid-js/web";
import { PUBLIC_TAG, normalizeGroupName } from "~/lib/groupAuth";

let cachedPromise: Promise<string[]> | null = null;
let listenerBound = false;

export function invalidateTaggableGroupsCache(): void {
  cachedPromise = null;
}

function ensureInvalidationListener(): void {
  if (isServer || listenerBound || typeof window === "undefined") return;
  listenerBound = true;
  window.addEventListener("user-groups-changed", () => {
    cachedPromise = null;
  });
}

export async function fetchTaggableGroups(): Promise<string[]> {
  if (isServer) return [PUBLIC_TAG];
  ensureInvalidationListener();
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    try {
      const res = await fetch("/api/user/groups");
      if (!res.ok) return [PUBLIC_TAG];
      const json = await res.json();
      if (json?.success && Array.isArray(json.data?.taggableGroups)) {
        const list = json.data.taggableGroups
          .map((g: unknown) => normalizeGroupName(String(g)))
          .filter(Boolean);
        return list.includes(PUBLIC_TAG) ? list : [PUBLIC_TAG, ...list];
      }
      return [PUBLIC_TAG];
    } catch {
      return [PUBLIC_TAG];
    }
  })();

  return cachedPromise;
}
