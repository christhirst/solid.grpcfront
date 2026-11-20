import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import get from "lodash.get";
import { evaluateNewsRules, newsColorClasses } from "~/lib/newsRulesEvaluator";

export interface NewsWidgetProps {
  btn: any;
  dashboardId?: string;
}

export function NewsWidgetComponent(props: NewsWidgetProps) {
  const [data, setData] = createSignal<any>("No Data");
  const [status, setStatus] = createSignal<"idle" | "loading" | "live" | "error">("idle");

  const evalResult = () => evaluateNewsRules(data(), props.btn.newsRules || []);
  const theme = () => newsColorClasses[evalResult().color] || newsColorClasses.blue;

  onMount(() => {
    if (isServer || !props.btn.workflowId) return;
    const wfId = (props.btn.workflowId.includes(":") ? props.btn.workflowId.split(":")[1] : props.btn.workflowId).replace(
      /[⟨⟩]/g,
      ""
    );

    if (props.btn.streamActive !== false) {
      setStatus("live");
      const dashQuery =
        props.dashboardId && props.dashboardId !== "new"
          ? `?dashboard=${encodeURIComponent(props.dashboardId)}`
          : "";
      const es = new EventSource(`/api/workflows/${wfId}/stream${dashQuery}`);

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.data?.chunk || payload.data?.response) {
            let chunk = payload.data.chunk || payload.data.response;
            if (props.btn.dataPath) {
              chunk = get(chunk, props.btn.dataPath, chunk);
            }
            if (chunk !== undefined) setData(chunk);
          }
        } catch {}
      };

      es.addEventListener("step_chunk", (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          let chunk = payload.data?.chunk;
          if (props.btn.dataPath && chunk) {
            chunk = get(chunk, props.btn.dataPath, chunk);
          }
          if (chunk !== undefined) setData(chunk);
        } catch {}
      });

      es.addEventListener("step_complete", (e: any) => {
        try {
          const payload = JSON.parse(e.data);
          let resData = payload.data?.response;
          if (props.btn.dataPath && resData) {
            resData = get(resData, props.btn.dataPath, resData);
          }
          if (resData !== undefined) setData(resData);
        } catch {}
      });

      es.onerror = () => {
        setStatus("idle");
      };
      onCleanup(() => es.close());
    }
  });

  const fetchManual = async () => {
    if (!props.btn.workflowId) return;
    const wfId = (props.btn.workflowId.includes(":") ? props.btn.workflowId.split(":")[1] : props.btn.workflowId).replace(
      /[⟨⟩]/g,
      ""
    );
    setStatus("loading");
    try {
      const dashQuery =
        props.dashboardId && props.dashboardId !== "new"
          ? `?dashboard=${encodeURIComponent(props.dashboardId)}`
          : "";
      const res = await fetch(`/api/workflows/${wfId}/run${dashQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: {}, dashboardId: props.dashboardId }),
      });
      const json = await res.json();
      if (json.success) setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div class={`w-full rounded-2xl border p-5 shadow-xl transition-all duration-300 ${theme().bg} ${theme().border}`}>
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">📰</span>
          <h3 class="text-sm font-bold text-white tracking-wide">{props.btn.label || "News Alert"}</h3>
        </div>
        <div class="flex items-center gap-2">
          <Show when={props.btn.streamActive !== false}>
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-500/20 text-purple-300 border-purple-500/30">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>
              STREAM LIVE
            </span>
          </Show>
          <button onClick={fetchManual} class="text-[10px] text-slate-400 hover:text-white transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      <div class="mt-2">
        <div class={`text-lg font-extrabold tracking-tight ${theme().text}`}>{evalResult().text}</div>
      </div>
    </div>
  );
}

export default NewsWidgetComponent;
