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
export function pollRun(runId: string, callbacks: PollCallbacks, options: PollOptions = {}): () => void {
  const rawId = (runId.includes(":") ? runId.split(":")[1] : runId).replace(/[⟨⟩]/g, "");
  const maxAttempts = options.maxAttempts ?? 60;
  const baseMs = options.intervalMs ?? 800;
  let attempts = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    if (cancelled) return;
    attempts++;
    if (attempts > maxAttempts) {
      callbacks.onError("Timed out waiting for workflow result.");
      return;
    }

    try {
      const res = await fetch(`/api/workflows/runs/${rawId}`);
      const json = await res.json();
      if (!json.success) { scheduleNext(); return; }

      const run = json.data;
      if (run.status === "completed" || run.status === "failed") {
        if (run.status === "failed") {
          callbacks.onError("Workflow failed.");
        } else {
          callbacks.onDone(run.logs || []);
        }
        return; // terminal — stop polling
      }
    } catch {
      // keep polling on network errors
    }
    scheduleNext();
  };

  const scheduleNext = () => {
    if (cancelled) return;
    // Exponential backoff: baseMs, 1.2x, 1.44x … capped at 5s
    const delay = Math.min(baseMs * Math.pow(1.2, attempts - 1), 5000);
    timer = setTimeout(tick, delay);
  };

  // Start immediately
  tick();

  // Return a cancel function for cleanup
  return () => {
    cancelled = true;
    if (timer !== undefined) clearTimeout(timer);
  };
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
export async function triggerWidgetRun(
  dashboardId: string,
  buttonId: string,
  form: Record<string, unknown> = {},
  workflowId?: string
) {
  const payload: Record<string, unknown> = { form };
  if (workflowId) payload.workflowId = workflowId;

  const res = await fetch(`/api/dashboards/${dashboardId}/trigger/${buttonId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Trigger failed");
  return json.runId as string;
}
