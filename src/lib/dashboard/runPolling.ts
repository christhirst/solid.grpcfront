/**
 * Pure helpers for polling a workflow run until it completes.
 */

export interface PollCallbacks {
  onDone: (logs: any[]) => void;
  onError: (message: string) => void;
}

export interface PollOptions {
  /** Maximum number of polling attempts. */
  maxAttempts?: number;
  /** Delay between attempts in milliseconds. */
  intervalMs?: number;
}

/** Poll a run endpoint until the run reaches a terminal state. */
export function pollRun(runId: string, callbacks: PollCallbacks, options: PollOptions = {}) {
  const rawId = (runId.includes(":") ? runId.split(":")[1] : runId).replace(/[⟨⟩]/g, "");
  const maxAttempts = options.maxAttempts ?? 60;
  const intervalMs = options.intervalMs ?? 1500;
  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(interval);
      callbacks.onError("Timed out waiting for workflow result.");
      return;
    }

    try {
      const res = await fetch(`/api/workflows/runs/${rawId}`);
      const json = await res.json();
      if (!json.success) return;

      const run = json.data;
      if (run.status === "completed" || run.status === "failed") {
        clearInterval(interval);
        if (run.status === "failed") {
          callbacks.onError("Workflow failed.");
        } else {
          callbacks.onDone(run.logs || []);
        }
      }
    } catch {
      // keep polling
    }
  }, intervalMs);
}

/** Extract the data payload and meta from the last successful table/chart log. */
export function extractLastStep(logs: any[]): { data: any[]; meta: any } {
  if (!logs.length) return { data: [], meta: {} };
  const last = [...logs].reverse().find((l) => l.status === "success" && (l.stepType === "table" || l.stepType === "chart"));
  if (!last) {
    const fallback = [...logs].reverse().find((l) => l.status === "success");
    if (!fallback) return { data: [], meta: {} };
    const raw = fallback.response;
    return { data: Array.isArray(raw) ? raw : raw ? [raw] : [], meta: fallback.meta || {} };
  }
  const raw = last.response;
  return { data: Array.isArray(raw) ? raw : raw ? [raw] : [], meta: last.meta || {} };
}

/** Trigger a dashboard widget and return the runId. */
export async function triggerWidgetRun(dashboardId: string, buttonId: string, form: Record<string, unknown> = {}) {
  const res = await fetch(`/api/dashboards/${dashboardId}/trigger/${buttonId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ form }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Trigger failed");
  return json.runId as string;
}
