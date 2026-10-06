/**
 * Deduplication cache for condition workflow runs.
 * When multiple dashboard widgets share the same conditionWorkflowId,
 * this ensures the workflow is triggered only once and the result is shared.
 */
import { extractRunOutcome } from "./widgetConditions";
import { pollRun, triggerWidgetRun } from "./runPolling";

interface CacheEntry {
  result: unknown;
  timestamp: number;
}

const inflight = new Map<string, Promise<unknown>>();
const cache = new Map<string, CacheEntry>();

/** Time-to-live for cached condition outcomes (ms). */
const TTL = 15_000;

/**
 * Get a condition workflow outcome, deduplicating concurrent requests
 * and caching results for TTL milliseconds.
 */
export function getConditionOutcome(
  dashboardId: string,
  buttonId: string,
  workflowId: string
): Promise<unknown> {
  const key = `${dashboardId}:${workflowId}`;

  // Return cached result if still fresh
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < TTL) {
    return Promise.resolve(cached.result);
  }

  // Deduplicate: if another widget already triggered this workflow, share the promise
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = runAndCache(key, dashboardId, buttonId, workflowId);
  inflight.set(key, promise);

  // Clean up inflight entry when done (success or failure)
  promise.finally(() => inflight.delete(key));

  return promise;
}

async function runAndCache(
  key: string,
  dashboardId: string,
  buttonId: string,
  workflowId: string
): Promise<unknown> {
  const runId = await triggerWidgetRun(dashboardId, buttonId, {}, workflowId);

  return new Promise((resolve, reject) => {
    pollRun(
      runId,
      {
        onDone: (logs) => {
          const result = extractRunOutcome(logs);
          cache.set(key, { result, timestamp: Date.now() });
          resolve(result);
        },
        onError: (msg) => {
          reject(new Error(msg));
        },
      },
      { maxAttempts: 60, intervalMs: 1500 }
    );
  });
}

/** Clear the cache (useful for testing or forced refresh). */
export function clearConditionCache() {
  cache.clear();
  inflight.clear();
}
