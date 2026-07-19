import { createSignal, createEffect, onMount, For, Show, createResource, createMemo } from "solid-js";
import { createStore, reconcile, produce } from "solid-js/store";
import { isServer } from "solid-js/web";
import { useParams, useNavigate } from "@solidjs/router";
import { parseProtoContent, generateSkeleton, ParsedProto } from "~/lib/protoParser";

// Safe dot-path getter to avoid CJS interop issues in Vite prod builds
function get(obj: any, path: string | string[], defValue?: any) {
  if (!path) return obj;
  const pathArray = Array.isArray(path) ? path : path.match(/([^[.\]])+/g);
  const result = pathArray?.reduce((prevObj, key) => prevObj && prevObj[key], obj);
  return result === undefined ? defValue : result;
}

import { DefaultChart } from "solid-chartjs";
import { Chart, registerables } from "chart.js";

if (!isServer) {
  Chart.register(...registerables);
}

function valueToLabel(value: any, fallback: number) {
  if (value === undefined || value === null || value === "") return String(fallback + 1);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function valueToNumber(value: any, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseJsonString(value: any) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeDataArray(value: any): any[] {
  let data = parseJsonString(value);

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const arrayKey = Object.keys(data).find((key) => Array.isArray(data[key]));
    if (arrayKey) data = data[arrayKey];
  }

  if (!Array.isArray(data)) {
    data = data !== undefined && data !== null ? [data] : [];
  }

  while (data.length === 1) {
    const first = parseJsonString(data[0]);
    if (!Array.isArray(first)) break;
    data = first;
  }

  return data.map(parseJsonString);
}

function collectObjectKeys(data: any[]) {
  const keys = new Set<string>();

  const addKeys = (value: any, prefix = "") => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;

    for (const key of Object.keys(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const nested = value[key];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        addKeys(nested, path);
      } else {
        keys.add(path);
      }
    }
  };

  for (const row of data) {
    addKeys(row);
  }
  return [...keys];
}

function pickKey(keys: string[], preferred: string[]) {
  const normalized = new Map(keys.map((key) => [key.toLowerCase(), key]));
  for (const key of preferred) {
    const match = normalized.get(key.toLowerCase());
    if (match) return match;
  }
  return "";
}

function inferChartKeys(data: any[], explicitX?: string, explicitY?: string) {
  const keys = collectObjectKeys(data);
  const xKey = explicitX || pickKey(keys, ["x", "step", "label", "name", "title", "date", "time", "id"]);
  let yKey = explicitY || pickKey(keys, ["y", "value", "metrics.value", "metrics.delta", "count", "total", "amount", "score", "completed"]);

  if (!yKey) {
    yKey = keys.find((key) => key !== xKey && data.some((row) => {
      const value = row && typeof row === "object" ? get(row, key) : undefined;
      return typeof value === "number" || typeof value === "boolean" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
    })) || "";
  }

  return { xKey, yKey };
}

function LogTable(props: { data: any[]; columns?: string[] }) {
  const rows = () => normalizeDataArray(props.data);
  const effectiveCols = () => {
    const explicit = (props.columns || []).filter(Boolean);
    if (explicit.length) return explicit;
    const keys = collectObjectKeys(rows());
    return keys.length ? keys : ["value"];
  };

  const cellValue = (row: any, key: string) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return key === "value" ? row : undefined;
    return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : get(row, key);
  };

  const formatCell = (value: any) => {
    if (value === undefined || value === null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  };

  return (
    <div class="overflow-auto max-h-[300px] border border-[#2a2a3a]/50 rounded bg-[#101015] custom-scrollbar">
      <Show when={rows().length > 0} fallback={<div class="p-3 text-xs text-[#5a5a6e]">No table data</div>}>
        <table class="w-full text-left text-xs text-[#c8c8d8]">
          <thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0 shadow-sm">
            <tr>
              <For each={effectiveCols()}>
                {(col) => <th class="px-3 py-2 font-medium border-b border-[#2a2a3e] whitespace-nowrap uppercase text-[10px] tracking-wider">{col}</th>}
              </For>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#1e1e2e]">
            <For each={rows()}>
              {(row) => (
                <tr class="hover:bg-[#1a1a24]/50 transition-colors">
                  <For each={effectiveCols()}>
                    {(col) => {
                      const text = formatCell(cellValue(row, col));
                      return <td class="px-3 py-2 border-b border-[#1e1e2e]/50 max-w-[150px] truncate" title={text}>{text}</td>;
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}

function LogChart(props: { data: any[]; xKey?: string; yKey?: string; chartType?: string }) {
  const cType = () => props.chartType || "bar";
  
  const buildData = () => {
    const data = normalizeDataArray(props.data);
    if (!Array.isArray(data) || !data.length) return { labels: [], datasets: [] };
    
    const type = cType();
    const isPie = type === "pie" || type === "doughnut";
    const isScatter = type === "scatter";
    const isBar = type === "bar";
    const inferred = inferChartKeys(data, props.xKey, props.yKey);
    
    if (isScatter) {
      const points: {x: number, y: number}[] = [];
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item && typeof item === "object") {
           points.push({
             x: inferred.xKey ? valueToNumber(get(item, inferred.xKey), i) : i,
             y: inferred.yKey ? valueToNumber(get(item, inferred.yKey), 0) : valueToNumber(item, 0)
           });
        } else {
           points.push({ x: i, y: Number(item) || 0 });
        }
      }
      return {
        labels: [],
        datasets: [{
          label: inferred.yKey || "Value",
          data: points,
          backgroundColor: "#3b82f6",
          pointRadius: 4,
        }]
      };
    }
    
    const labels: any[] = [];
    const points: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (item && typeof item === "object") {
        labels.push(inferred.xKey ? valueToLabel(get(item, inferred.xKey), i) : String(i + 1));
        points.push(inferred.yKey ? valueToNumber(get(item, inferred.yKey), 0) : i + 1);
      } else {
        labels.push(String(i + 1));
        points.push(valueToNumber(item, 0));
      }
    }
    
    if (isPie) {
      const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4"];
      const bgColors = points.map((_, i) => colors[i % colors.length]);
      return {
        labels,
        datasets: [{
          label: inferred.yKey || "Value",
          data: points,
          backgroundColor: bgColors,
          borderWidth: 1,
          borderColor: "#1e1e2e"
        }]
      };
    }
    
    return {
      labels,
      datasets: [{
        label: inferred.yKey || "Value",
        data: points,
        borderColor: isBar ? "#6366f1" : "#3b82f6",
        backgroundColor: isBar ? "rgba(99,102,241,0.7)" : "rgba(59,130,246,0.1)",
        borderWidth: isBar ? 0 : 2,
        borderRadius: isBar ? 4 : 0,
        pointBackgroundColor: "#3b82f6",
        pointRadius: isBar ? 0 : 3,
        tension: 0.3,
        fill: !isBar,
      }]
    };
  };

  const chartOptions = () => {
    const isPie = cType() === "pie" || cType() === "doughnut";
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#c8c8d8" } } },
      scales: isPie ? {} : {
        x: { grid: { color: "#2a2a3e" }, ticks: { color: "#8b8b9e" } },
        y: { grid: { color: "#2a2a3e" }, ticks: { color: "#8b8b9e" } },
      },
    };
  };

  return (
    <div class="h-[250px] bg-[#101015] p-3 rounded border border-[#2a2a3a]/50">
      <Show when={normalizeDataArray(props.data).length > 0} fallback={<p class="text-xs text-[#5a5a6e]">No valid array data for chart</p>}>
        {/* @ts-ignore */}
        <DefaultChart type={cType() as any} data={buildData()} options={chartOptions()} />
      </Show>
    </div>
  );
}

const DATA_SOURCE_STEP_TYPES = new Set(["grpc", "rest", "database"]);

function isDataSourceStep(step: any) {
  return !!step && (!step.type || DATA_SOURCE_STEP_TYPES.has(step.type));
}

function stepResponseTemplate(step: any) {
  return `{{ steps.${step.id}.response }}`;
}

function SourceStepSelect(props: { steps: any[]; currentIndex: number; value: string; onChange: (val: string) => void }) {
  const sourceSteps = createMemo(() => {
    return props.steps.slice(0, props.currentIndex).filter(isDataSourceStep);
  });

  return (
    <select
      class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-orange-300 font-mono focus:border-orange-500 focus:outline-none mb-3"
      value={props.value}
      onChange={(e) => props.onChange(e.currentTarget.value)}
    >
      <option value="">Select a source step…</option>
      <For each={sourceSteps()}>
        {(s) => (
          <option value={stepResponseTemplate(s)}>
            {s.type === "rest" ? "🌐" : s.type === "database" ? "🛢️" : "⚡"} {s.id}{s.type === "rest" ? ` (${s.restUrl || "REST"})` : (s.methodName ? ` (${s.methodName})` : "")}
          </option>
        )}
      </For>
    </select>
  );
}

export default function WorkflowBuilder() {
  const params = useParams();
  const navigate = useNavigate();
  const isNew = params.id === "new";

  // Form state
  const [name, setName] = createSignal("New Workflow");
  const [protoContent, setProtoContent] = createSignal("");
  
  // Track active input for inserting variables
  const [hasActiveInput, setHasActiveInput] = createSignal(false);
  const [activeInput, setActiveInput] = createSignal<HTMLInputElement | HTMLTextAreaElement | null>(null);

  onMount(() => {
    if (isServer) return;
    
    // Fallback: If createResource didn't load during SSR properly, force fetch
    if (!savedProtos()) refetchProtos();
    if (!isNew && !workflow()) refetchWorkflow();

    document.addEventListener('focusin', (e) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
        setHasActiveInput(true);
        setActiveInput(t as any);
      }
    });
    document.addEventListener('focusout', () => {
      // Small timeout to allow mousedown to preventDefault before clearing
      setTimeout(() => {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setHasActiveInput(false);
          setActiveInput(null);
        }
      }, 50);
    });
  });

  const insertVariable = () => {
    const input = activeInput();
    if (!input) return;
    const varName = prompt("Enter variable name (e.g. sales or dashboard_form.sales):");
    if (!varName) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const val = input.value;
    
    let injection = `{{ dashboard_form.${varName} }}`;
    if (varName.startsWith("form.") || varName.startsWith("dashboard_form.")) {
      injection = `{{ ${varName} }}`;
    }
    
    const newVal = val.substring(0, start) + injection + val.substring(end);
    
    input.value = newVal;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    const cursor = start + injection.length;
    input.setSelectionRange(cursor, cursor);
    input.focus();
  };
  
  // Fetch saved protos from Registry
  const [savedProtos, { refetch: refetchProtos }] = createResource(async () => {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/protos` : "/api/protos";
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });

  const [serverAddress, setServerAddress] = createSignal("localhost:50051");
  const [useTls, setUseTls] = createSignal(false);
  const [schedule, setSchedule] = createSignal("");
  const [protoId, setProtoId] = createSignal("");
  const [authType, setAuthType] = createSignal<"grpc" | "rest" | "static">("grpc");
  const [authService, setAuthService] = createSignal("");
  const [authMethod, setAuthMethod] = createSignal("");
  const [authRequestTemplate, setAuthRequestTemplate] = createSignal("{}");
  
  const [authUrl, setAuthUrl] = createSignal("");
  const [authRestMethod, setAuthRestMethod] = createSignal("POST");
  const [authScheme, setAuthScheme] = createSignal<"basic" | "bearer" | "none">("basic");
  const [authUsername, setAuthUsername] = createSignal("");
  const [authPassword, setAuthPassword] = createSignal("");
  const [bearerToken, setBearerToken] = createSignal("");
  const [authRestBody, setAuthRestBody] = createSignal("{}");

  const [authTokenPath, setAuthTokenPath] = createSignal("accessToken");
  const [authTestResult, setAuthTestResult] = createSignal<{ success: boolean; token?: string; error?: string } | null>(null);
  const [isTestingAuth, setIsTestingAuth] = createSignal(false);
  const [steps, setSteps] = createStore<any[]>([]);
  const [showAddStepMenu, setShowAddStepMenu] = createSignal(false);
  
  const [connectionId, setConnectionId] = createSignal<string>("");
  const [showSettings, setShowSettings] = createSignal(false);
  const [connections] = createResource(async () => {
    try {
      const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/connections` : "/api/connections";
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch (e) {
      console.error("fetchConnections error:", e);
      return [];
    }
  });

  // Parsed state
  const [parsedProto, setParsedProto] = createSignal<ParsedProto | null>(null);
  const [compileError, setCompileError] = createSignal<string | null>(null);

  // Execution state
  const [runId, setRunId] = createSignal<string | null>(null);
  const [runData, setRunData] = createSignal<any>(null);
  const [isRunning, setIsRunning] = createSignal(false);

  const fetchWorkflow = async () => {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/workflows/${params.id}` : `/api/workflows/${params.id}`;
    if (isNew) return null;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    } catch (e) {
      console.error("fetchWorkflow error:", e);
    }
    return null;
  };

  const [workflow, { refetch: refetchWorkflow }] = createResource(params.id, fetchWorkflow);

  // Sync resource data to local mutable state safely on the client
  createEffect(() => {
    const data = workflow();
    if (data) {
      setName(data.name || "Untitled");
      setProtoId(data.protoId || "");
      if (data.protoContent) {
        setProtoContent(data.protoContent);
      }
      setServerAddress(data.serverAddress || "localhost:50051");
      setUseTls(data.useTls || false);
      setSchedule(data.schedule || "");
      setConnectionId(data.connectionId || "");
        
      const ac = data.authConfig;
      if (ac) {
        setAuthType(ac.type || "grpc");
        if (ac.type === "static") {
          setBearerToken(ac.bearerToken || "");
        } else if (ac.type === "grpc") {
          setAuthService(ac.serviceName || "");
          setAuthMethod(ac.methodName || "");
          setAuthRequestTemplate(ac.requestTemplate || "{}");
        } else {
          setAuthUrl(ac.url || "");
          setAuthRestMethod(ac.method || "POST");
          setAuthScheme(ac.authScheme || "basic");
          setAuthUsername(ac.username || "");
          setAuthPassword(ac.password || "");
          setBearerToken(ac.bearerToken || "");
          setAuthRestBody(ac.body || "{}");
        }
        setAuthTokenPath(ac.tokenPath || "accessToken");
      }
      
      setSteps(reconcile(data.steps || []));
    }
  });

  createEffect(() => {
    const id = protoId();
    const protos = savedProtos();
    if (id && protos) {
      const p = protos.find((x: any) => x.id === id);
      if (p) {
        setProtoContent(p.content || "");
      }
    }
  });


  // Re-parse proto content when it changes
  createEffect(() => {
    const currentParam = params.id; // track dependency
    const content = protoContent();
    if (!content.trim()) {
      setParsedProto(null);
      setCompileError(null);
      return;
    }
    try {
      const parsed = parseProtoContent(content);
      setParsedProto(parsed);
      setCompileError(null);
    } catch (err: any) {
      setCompileError(err.message || "Failed to parse .proto file");
      setParsedProto(null);
    }
  });

  const saveWorkflow = async () => {
    const payload = {
      id: isNew ? undefined : `workflow:${params.id}`,
      name: name(),
      protoId: protoId() || undefined,
      serverAddress: serverAddress(),
      useTls: useTls(),
      schedule: schedule(),
      connectionId: connectionId() || undefined,
      steps: steps.map(s => ({
        ...s,
        type: s.type || "grpc"
      })),
    };

    const endpoint = isNew ? "/api/workflows" : `/api/workflows/${params.id}`;
    const method = isNew ? "POST" : "PUT";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    const json = await res.json();
    if (json.success) {
      if (isNew) {
        navigate(`/workflows/${json.data.id.split(":")[1]}`);
      }
    } else {
      alert("Failed to save: " + json.error);
    }
  };

  const addStep = (type: string = "grpc") => {
    const newStep: any = {
      id: `step_${Math.random().toString(36).substr(2, 9)}`,
      type: type,
      serviceName: "",
      methodName: "",
      requestBodyTemplate: "{}",
      headersTemplate: "{}",
      serverAddress: "",
      useTls: useTls(),
      dataPath: "", xKey: "", yKey: ""
    };

    // Defaults for visualization steps
    if (type === "table" || type === "chart") {
       const previousSource = [...steps].reverse().find(isDataSourceStep);
       newStep.requestBodyTemplate = previousSource ? stepResponseTemplate(previousSource) : "";
    }
    if (type === "chart") {
       newStep.chartType = "bar";
    }

    setSteps(produce((s: any[]) => s.push(newStep)));
    setShowAddStepMenu(false);
  };

  const updateStep = (index: number, key: string, value: any) => {
    setSteps(index, key, value);
    
    // Auto skeleton generation if method changes
    if (key === "methodName" && parsedProto()) {
      const step = steps[index];
      const service = parsedProto()?.services.find((s) => s.fullName === step.serviceName);
      const method = service?.methods.find((m) => m.name === value);
      if (method) {
        const skeleton = generateSkeleton(parsedProto()!.messageTypes, method.requestType);
        setSteps(index, "requestBodyTemplate", JSON.stringify(skeleton, null, 2));
      }
    }
  };

  const removeStep = (index: number) => {
    setSteps(produce((s: any[]) => s.splice(index, 1)));
  };

  const runWorkflow = async () => {
    // 1. Save it first
    await saveWorkflow();
    const targetId = isNew ? "temp" : params.id; // Ideally block run on new until saved
    if (isNew) return; // For simplicity, we navigate on save so user can hit run on the new URL

    setIsRunning(true);
    setRunData(null);

    // 2. Trigger run
    const res = await fetch(`/api/workflows/${params.id}/run`, { method: "POST" });
    const json = await res.json();

    if (json.success) {
      setRunId(json.runId);
      pollRunData(json.runId);
    } else {
      alert("Failed to start run: " + json.error);
      setIsRunning(false);
    }
  };

  const testAuth = async () => {
    setIsTestingAuth(true);
    setAuthTestResult(null);
    try {
      if (authType() === "grpc") {
        const res = await fetch("/api/grpc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            protoContent: protoContent(),
            serverAddress: serverAddress(),
            useTls: useTls(),
            serviceName: authService(),
            methodName: authMethod(),
            requestBody: JSON.parse(authRequestTemplate()),
          }),
        });
        const json = await res.json();
        if (json.success) {
          const token = json.data ? (get(json.data, authTokenPath()) || "Not found at path") : "No data";
          setAuthTestResult({ success: true, token: String(token) });
        } else {
          setAuthTestResult({ success: false, error: json.error });
        }
      } else if (authType() === "rest") {
        // REST Auth Test
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authScheme() === "basic" && (authUsername() || authPassword())) {
          const b64 = btoa(`${authUsername()}:${authPassword()}`);
          headers["Authorization"] = `Basic ${b64}`;
        } else if (authScheme() === "bearer" && bearerToken()) {
          headers["Authorization"] = `Bearer ${bearerToken()}`;
        } else if (!authScheme() && (authUsername() || authPassword())) {
          const b64 = btoa(`${authUsername()}:${authPassword()}`);
          headers["Authorization"] = `Basic ${b64}`;
        }
        
        const res = await fetch(authUrl(), {
          method: authRestMethod(),
          headers,
          body: authRestMethod() !== "GET" ? authRestBody() : undefined
        });
        
        if (!res.ok) {
          const text = await res.text();
          setAuthTestResult({ success: false, error: `HTTP ${res.status}: ${text}` });
          return;
        }
        
        const json = await res.json();
        const token = get(json, authTokenPath()) || "Not found at path";
        setAuthTestResult({ success: true, token: String(token) });
      }
    } catch (e: any) {
      setAuthTestResult({ success: false, error: e.message });
    } finally {
      setIsTestingAuth(false);
    }
  };

  const pollRunData = async (id: string) => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/workflows/runs/${id.split(":")[1]}`);
      const json = await res.json();
      if (json.success) {
        setRunData(json.data);
        if (json.data.status === "completed" || json.data.status === "failed") {
          clearInterval(interval);
          setIsRunning(false);
        }
      }
    }, 1000); // poll every second
  };

  return (
    <main class="mx-auto max-w-7xl px-6 py-12">
      <div class="mb-8 flex items-center justify-between">
        <div>
          <input 
            class="bg-transparent text-3xl font-extrabold tracking-tight text-white border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2 transition-all"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="Workflow Name"
          />
        </div>
        <div class="flex items-center gap-4">
          <button 
            onMouseDown={(e) => {
              e.preventDefault();
              if (hasActiveInput()) insertVariable();
            }}
            class={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all ${
              hasActiveInput() ? "bg-purple-600 hover:bg-purple-500 shadow-md ring-2 ring-purple-500/50" : "bg-[#2a2a3a] text-[#5b5b6e] cursor-not-allowed"
            }`}
            title={hasActiveInput() ? "Insert {{ form.variable }} at cursor" : "Select an input field first"}
          >
            + Form Variable
          </button>
          
          <div class="w-px h-6 bg-[#2a2a3a] mx-1"></div>

          <button onClick={() => setShowSettings(true)} class="btn-secondary flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Settings
          </button>
          
          <button onClick={saveWorkflow} class="btn-secondary">Save Flow</button>
          <button onClick={runWorkflow} class="btn-primary flex items-center gap-2" disabled={isNew || isRunning()}>
            {isRunning() ? (
              <svg class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            )}
            Run
          </button>
        </div>
      </div>

      <div class="space-y-6">
        {/* Steps Builder & Run Results */}
        <div class="space-y-6">
          {/* Top-Level Run Status Banner */}
          <Show when={runData()}>
            {(() => {
              const authError = (runData()?.logs || []).find((l: any) => l.stepId === "auth" && l.status === "error");
              return (
                <div class={`card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border ${
                  runData().status === "completed" 
                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" 
                    : runData().status === "failed" 
                      ? "border-red-500/20 bg-red-500/5 text-red-400" 
                      : "border-blue-500/20 bg-blue-500/5 text-blue-400"
                }`}>
                  <div class="flex items-center gap-3">
                    <span class="flex h-2 w-2 relative">
                      <span class={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        runData().status === "completed" ? "bg-emerald-400" : runData().status === "failed" ? "bg-red-400" : "bg-blue-400"
                      }`}></span>
                      <span class={`relative inline-flex rounded-full h-2 w-2 ${
                        runData().status === "completed" ? "bg-emerald-500" : runData().status === "failed" ? "bg-red-500" : "bg-blue-500"
                      }`}></span>
                    </span>
                    <span class="text-xs font-bold uppercase tracking-wider">
                      Workflow Run Status: {runData().status}
                    </span>
                    <Show when={runData().endTime}>
                      <span class="text-[10px] text-[#5b5b6e]">
                        (Finished in {Math.max(0, new Date(runData().endTime!).getTime() - new Date(runData().startTime).getTime())}ms)
                      </span>
                    </Show>
                  </div>
                  
                  <Show when={authError}>
                    <div class="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      ⚠️ Authentication Failed: {authError.error}
                    </div>
                  </Show>
                  
                  <button 
                    onClick={() => setRunData(null)}
                    class="text-[10px] font-semibold text-[#8b8b9e] hover:text-white transition-colors self-start md:self-auto"
                  >
                    Clear Results
                  </button>
                </div>
              );
            })()}
          </Show>

          <div class="flex items-center justify-between relative">
            <h2 class="text-xl font-bold text-white">Workflow Steps</h2>
            <div class="relative">
              <button 
                type="button"
                onClick={() => setShowAddStepMenu(!showAddStepMenu())} 
                class="text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-all hover:bg-blue-500/20"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Step
              </button>
              
              <Show when={showAddStepMenu()}>
                <div class="absolute right-0 mt-2 w-56 rounded-xl bg-[#1e1e2e] border border-[#2a2a3a] shadow-2xl z-50 overflow-hidden fade-in py-1">
                  <div class="px-3 py-2 text-[10px] font-bold text-[#5b5b6e] uppercase tracking-wider border-b border-[#2a2a3a]/50 mb-1">Select Step Type</div>
                  <button type="button" onClick={() => addStep("grpc")} class="w-full text-left px-4 py-2 text-sm text-[#c8c8d8] hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-2 transition-colors">
                    <span class="text-lg">⚡</span> gRPC Request
                  </button>
                  <button type="button" onClick={() => addStep("rest")} class="w-full text-left px-4 py-2 text-sm text-[#c8c8d8] hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-2 transition-colors">
                    <span class="text-lg">🌐</span> REST Request
                  </button>
                  <button type="button" onClick={() => addStep("database")} class="w-full text-left px-4 py-2 text-sm text-[#c8c8d8] hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-2 transition-colors">
                    <span class="text-lg">🛢️</span> Database Query
                  </button>
                  <div class="h-px bg-[#2a2a3a] my-1 mx-2"></div>
                  <button type="button" onClick={() => addStep("table")} class="w-full text-left px-4 py-2 text-sm text-[#c8c8d8] hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-2 transition-colors">
                    <span class="text-lg">📊</span> View Table
                  </button>
                  <button type="button" onClick={() => addStep("chart")} class="w-full text-left px-4 py-2 text-sm text-[#c8c8d8] hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-2 transition-colors">
                    <span class="text-lg">📈</span> Chart
                  </button>
                </div>
              </Show>
            </div>
          </div>

          <div class="space-y-6">
            <For each={steps}>
              {(step, index) => {
                const [resultTab, setResultTab] = createSignal<"payload" | "response">("response");
                const log = createMemo(() => (runData()?.logs || []).find((l: any) => l.stepId === step.id));
                const stepData = createMemo(() => {
                  const currentLog = log();
                  if (!currentLog) return [];
                  const resp = currentLog.response;
                  return Array.isArray(resp) ? resp : (resp ? [resp] : []);
                });
                return (
                  <div class="card p-5 relative border-l-4 border-l-blue-500">
                    <div class="absolute -left-[14px] -top-[14px] flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white ring-4 ring-[#0a0a0f]">
                      {index() + 1}
                    </div>
                    <div class={`grid grid-cols-1 ${runData() ? "lg:grid-cols-2" : ""} gap-6`}>
                      {/* Left Column: Configuration */}
                      <div class="space-y-4">
                  
                  <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-4 flex-1">
                      <div class="w-1/3">
                        <label class="mb-1 block text-xs text-[#8b8b9e]">Step Type</label>
                        <select
                          class="w-full bg-[#1e1e2e] text-white font-medium text-sm border-b border-[#2a2a3a] focus:border-blue-500 outline-none pb-1"
                          value={step.type === "chart" ? (step.chartType || "bar") : (step.type || "grpc")}
                          onChange={(e) => {
                            const val = e.currentTarget.value;
                            if (["bar", "line", "doughnut", "pie", "scatter"].includes(val)) {
                              updateStep(index(), "type", "chart");
                              updateStep(index(), "chartType", val);
                            } else {
                              updateStep(index(), "type", val);
                            }
                          }}
                        >
                          <option value="grpc">⚡ gRPC Request</option>
                          <option value="rest">🌐 REST Request</option>
                          <option value="database">🛢️ Database Query</option>
                          <option value="table">📊 View Data Table</option>
                          <option value="bar">📊 Bar Chart</option>
                          <option value="line">📈 Line Chart</option>
                          <option value="doughnut">🍩 Doughnut Chart</option>
                          <option value="pie">🥧 Pie Chart</option>
                          <option value="scatter">📉 Scatter Chart</option>
                        </select>
                      </div>
                      <div class="flex-1">
                        <label class="mb-1 block text-xs text-[#8b8b9e]">Step ID (for variables)</label>
                        <input
                          type="text"
                          class="w-full bg-transparent text-white font-mono text-sm border-b border-[#2a2a3a] focus:border-blue-500 outline-none pb-1"
                          value={step.id}
                          onInput={(e) => updateStep(index(), "id", e.currentTarget.value)}
                        />
                      </div>
                    </div>
                    <button onClick={() => removeStep(index())} class="text-[#5b5b6e] hover:text-red-400 ml-4">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                    </button>
                  </div>

                  <Show when={!step.type || step.type === "grpc"}>
                    {/* gRPC Specific Configs */}
                    <div class="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label class="mb-1 block text-xs text-[#8b8b9e]">Service</label>
                        <select
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                          value={step.serviceName || ""}
                          onChange={(e) => {
                            const val = e.currentTarget.value;
                            if (val.startsWith("PROTO:")) {
                              const pId = val.substring(6);
                              const p = savedProtos()?.find((x: any) => x.id === pId);
                              if (p) {
                                setProtoContent(p.content);
                                updateStep(index(), "serviceName", "");
                                updateStep(index(), "methodName", "");
                              }
                            } else {
                              updateStep(index(), "serviceName", val);
                              updateStep(index(), "methodName", ""); // reset method
                            }
                          }}
                        >
                          <option value="" disabled={!step.serviceName}>Select a service...</option>
                          <Show when={savedProtos() && savedProtos().length > 0}>
                            <optgroup label="Load a Saved Proto">
                              <For each={savedProtos()}>
                                {(p: any) => <option value={`PROTO:${p.id}`}>Load: {p.name}</option>}
                              </For>
                            </optgroup>
                          </Show>
                          <Show when={parsedProto()?.services && parsedProto()!.services.length > 0}>
                            <optgroup label="Available Services in Proto">
                              <For each={parsedProto()?.services || []}>
                                {(svc) => <option value={svc.fullName} selected={step.serviceName === svc.fullName}>{svc.fullName}</option>}
                              </For>
                            </optgroup>
                          </Show>
                        </select>
                      </div>
                      <div>
                        <label class="mb-1 block text-xs text-[#8b8b9e]">Method</label>
                        <select
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                          disabled={!step.serviceName}
                          value={step.methodName || ""}
                          onChange={(e) => updateStep(index(), "methodName", e.currentTarget.value)}
                        >
                          <option value="" disabled>Select a method...</option>
                          <For each={parsedProto()?.services.find((s) => s.fullName === step.serviceName)?.methods || []}>
                            {(m) => <option value={m.name} selected={step.methodName === m.name}>{m.name} ({m.requestType} → {m.responseType})</option>}
                          </For>
                        </select>
                      </div>
                    </div>

                    <div class="mt-5 pt-5 border-t border-[#2a2a3a]/50">
                      <label class="mb-2 block text-xs font-semibold text-[#8b8b9e] flex items-center justify-between">
                        <span class="flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect></svg>
                          Server Overide
                        </span>
                        <Show when={step.serverAddress}>
                          <span class="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">Active</span>
                        </Show>
                      </label>
                      <div class="relative group">
                        <input
                          type="text"
                          class={`w-full rounded-lg border p-2.5 text-sm transition-all focus:outline-none placeholder:text-[#3a3a4e] ${step.serverAddress ? 'border-blue-500/40 bg-[#1e1e2e] text-blue-100' : 'border-[#2a2a3a] bg-[#1a1a26] text-[#8b8b9e] focus:border-blue-500/30'}`}
                          placeholder={`Fallback: ${serverAddress() || "None"}`}
                          value={step.serverAddress || ""}
                          onInput={(e) => updateStep(index(), "serverAddress", e.currentTarget.value)}
                        />
                        <Show when={!step.serverAddress}>
                          <div class="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#3a3a4e] uppercase pointer-events-none group-hover:text-[#4a4a5e] transition-colors">Default</div>
                        </Show>
                      </div>
                    </div>

                    <div class="mt-4 flex items-center justify-between px-1">
                      <label class="text-xs font-semibold text-[#8b8b9e] flex items-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        Encryption (TLS)
                      </label>
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          class="sr-only peer"
                          checked={step.useTls ?? useTls()}
                          onChange={(e) => updateStep(index(), "useTls", e.currentTarget.checked)}
                        />
                        <div class="w-8 h-4 bg-[#2a2a3a] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#8b8b9e] after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
                        <span class="ml-2 text-[10px] font-medium text-[#5b5b6e]">
                          { (step.useTls ?? useTls()) ? "Secure" : "Insecure" }
                        </span>
                      </label>
                    </div>

                    <div>
                      <div class="flex items-center justify-between mt-4 mb-1">
                        <label class="text-xs text-[#8b8b9e]">Request Payload Template</label>
                        <span class="text-[10px] text-blue-400 font-mono">{"{{ steps.<id>.response }}"}</span>
                      </div>
                      <textarea
                        class="h-32 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        value={step.requestBodyTemplate}
                        onInput={(e) => updateStep(index(), "requestBodyTemplate", e.currentTarget.value)}
                      />
                    </div>

                    <StepAuthSettings 
                      step={step} 
                      index={index()} 
                      updateStep={updateStep} 
                      connections={connections() || []} 
                    />

                    <div class="mt-4">
                      <div class="flex items-center justify-between mb-1">
                        <label class="text-xs text-[#8b8b9e]">Headers (Metadata) Template</label>
                        <span class="text-[10px] text-blue-400 font-mono">{"{ \"Authorization\": \"Bearer {{ ... }}\" }"}</span>
                      </div>
                      <textarea
                        class="h-20 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        placeholder='{ "key": "value" }'
                        value={step.headersTemplate || "{}"}
                        onInput={(e) => updateStep(index(), "headersTemplate", e.currentTarget.value)}
                      />
                    </div>
                  </Show>

                  {/* REST Request Config */}
                  <Show when={step.type === "rest"}>
                    <div class="mb-4 space-y-4">
                      <div>
                        <label class="mb-1 block text-xs text-[#8b8b9e]">URL Template</label>
                        <input
                          type="text"
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                          placeholder="e.g. https://api.stripe.com/v1/customers/{{ form.customerId }}"
                          value={step.restUrl || ""}
                          onInput={(e) => updateStep(index(), "restUrl", e.currentTarget.value)}
                        />
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="mb-1 block text-xs text-[#8b8b9e]">HTTP Method</label>
                          <select
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                            value={step.restMethod || "GET"}
                            onChange={(e) => updateStep(index(), "restMethod", e.currentTarget.value)}
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                          </select>
                        </div>
                      </div>
                      
                      <StepAuthSettings 
                        step={step} 
                        index={index()} 
                        updateStep={updateStep} 
                        connections={connections() || []} 
                      />
                      
                      <Show when={step.restMethod !== "GET" && step.restMethod !== "DELETE"}>
                        <div>
                          <div class="flex items-center justify-between mb-1">
                            <label class="text-xs text-[#8b8b9e]">Request Body Template (JSON)</label>
                            <span class="text-[10px] text-blue-400 font-mono">Supports {"{{ variables }}"}</span>
                          </div>
                          <textarea
                            class="h-32 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            value={step.requestBodyTemplate || ""}
                            onInput={(e) => updateStep(index(), "requestBodyTemplate", e.currentTarget.value)}
                          />
                        </div>
                      </Show>

                      <div>
                        <div class="flex items-center justify-between mt-4 mb-1">
                          <label class="text-xs text-[#8b8b9e]">Headers Template (JSON)</label>
                          <span class="text-[10px] text-blue-400 font-mono">{"{ \"Authorization\": \"Bearer {{ token }}\" }"}</span>
                        </div>
                        <textarea
                          class="h-20 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          placeholder='{ "Content-Type": "application/json" }'
                          value={step.headersTemplate || "{}"}
                          onInput={(e) => updateStep(index(), "headersTemplate", e.currentTarget.value)}
                        />
                      </div>
                    </div>
                  </Show>

                  {/* Database Query Config */}
                  <Show when={step.type === "database"}>
                    <div class="mb-4 space-y-4">
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="mb-1 block text-xs text-[#8b8b9e]">Connection URL <span class="text-[10px] text-[#5b5b6e]">(supports {'{{ variables }}'})</span></label>
                          <input
                            type="text"
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder:text-[#5b5b6e]"
                            placeholder="e.g. ws://127.0.0.1:8000/rpc (or leave blank)"
                            value={step.databaseUrl || ""}
                            onInput={(e) => updateStep(index(), "databaseUrl", e.currentTarget.value)}
                          />
                        </div>
                        
                        <div>
                          <label class="mb-1 block text-xs text-[#8b8b9e]">Namespace <span class="text-[10px] text-[#5b5b6e]">(supports {'{{ variables }}'})</span></label>
                          <input
                            type="text"
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder:text-[#5b5b6e]"
                            placeholder="e.g. solidflow (or leave blank)"
                            value={step.databaseNs || ""}
                            onInput={(e) => updateStep(index(), "databaseNs", e.currentTarget.value)}
                          />
                        </div>
                      </div>

                      <div class="grid grid-cols-3 gap-4">
                        <div>
                          <label class="mb-1 block text-xs text-[#8b8b9e]">Database Name <span class="text-[10px] text-[#5b5b6e]">(supports {'{{ variables }}'})</span></label>
                          <input
                            type="text"
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder:text-[#5b5b6e]"
                            placeholder="e.g. main (or leave blank)"
                            value={step.databaseName || ""}
                            onInput={(e) => updateStep(index(), "databaseName", e.currentTarget.value)}
                          />
                        </div>

                        <div>
                          <label class="mb-1 block text-xs text-[#8b8b9e]">Username <span class="text-[10px] text-[#5b5b6e]">(supports {'{{ variables }}'})</span></label>
                          <input
                            type="text"
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder:text-[#5b5b6e]"
                            placeholder="e.g. admin"
                            value={step.databaseUser || ""}
                            onInput={(e) => updateStep(index(), "databaseUser", e.currentTarget.value)}
                          />
                        </div>

                        <div>
                          <label class="mb-1 block text-xs text-[#8b8b9e]">Password <span class="text-[10px] text-[#5b5b6e]">(supports {'{{ variables }}'})</span></label>
                          <input
                            type="text"
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder:text-[#5b5b6e]"
                            placeholder="e.g. admin"
                            value={step.databasePass || ""}
                            onInput={(e) => updateStep(index(), "databasePass", e.currentTarget.value)}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div class="flex items-center justify-between mb-1">
                          <label class="block text-xs text-[#8b8b9e]">SurrealQL Query</label>
                          <span class="text-[10px] text-blue-400 font-mono">Supports {"{{ variables }}"}</span>
                        </div>
                        <div class="relative group">
                          <div class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 opacity-20 blur transition group-hover:opacity-40"></div>
                          <textarea
                            class="relative w-full h-32 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-3 text-sm font-mono text-red-300 focus:border-red-500 outline-none custom-scrollbar"
                            placeholder="SELECT * FROM users WHERE age > {{ steps.auth.response.min_age }};"
                            value={step.requestBodyTemplate || ""}
                            onInput={(e) => updateStep(index(), "requestBodyTemplate", e.currentTarget.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </Show>
                  
                  {/* Visualization Data Mapping */}
                  <Show when={step.type === "table" || step.type === "chart"}>
                    <div class="space-y-4 mt-2">

                      {/* Data Source */}
                      <div class="rounded-lg border border-orange-500/20 bg-[#0f0e08] p-4">
                        <p class="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
                          Data Source
                        </p>
                        <SourceStepSelect
                          steps={steps}
                          currentIndex={index()}
                          value={step.requestBodyTemplate || ""}
                          onChange={(val) => updateStep(index(), "requestBodyTemplate", val)}
                        />

                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label class="mb-1 block text-xs text-[#8b8b9e]">Nested Array Path <span class="text-[10px] text-[#5b5b6e]">(lodash dot path)</span></label>
                            <input
                              type="text"
                              class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-orange-500 focus:outline-none"
                              placeholder="e.g. shares"
                              value={step.dataPath || ""}
                              onInput={(e) => updateStep(index(), "dataPath", e.currentTarget.value)}
                            />
                            <p class="text-[10px] text-[#5b5b6e] mt-1">Leave empty if the response is already an array. Use dot notation for deeper nesting.</p>
                          </div>
                          <div class="bg-[#0d0d14] rounded-lg border border-[#2a2a3a] p-2.5">
                            <p class="text-[10px] text-[#5b5b6e] font-mono mb-1">Example response:</p>
                            <pre class="text-[10px] text-orange-300 font-mono overflow-x-auto">{`{ "cash": 98961,\n  "shares": [\n    { "symbol": "ORCL",\n      "count": 271 }\n  ]\n}`}</pre>
                            <p class="text-[10px] text-[#5b5b6e] mt-1">→ Path: <code class="text-orange-400 font-mono">shares</code></p>
                          </div>
                        </div>
                      </div>

                      {/* Chart Config */}
                      <Show when={step.type === "chart"}>
                        <div class="rounded-lg border border-purple-500/20 bg-[#0d0a10] p-4">
                          <p class="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                            Chart Overrides
                          </p>
                          <div class="grid grid-cols-2 gap-3">
                            <div>
                              <label class="mb-1 block text-xs text-[#8b8b9e]">X-Axis Property <span class="text-[10px] text-[#5b5b6e]">(optional)</span></label>
                              <input
                                type="text"
                                class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                                placeholder="Auto-detect"
                                value={step.xKey || ""}
                                onInput={(e) => updateStep(index(), "xKey", e.currentTarget.value)}
                              />
                            </div>
                            <div>
                              <label class="mb-1 block text-xs text-[#8b8b9e]">Y-Axis Property <span class="text-[10px] text-[#5b5b6e]">(optional)</span></label>
                              <input
                                type="text"
                                class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                                placeholder="Auto-detect"
                                value={step.yKey || ""}
                                onInput={(e) => updateStep(index(), "yKey", e.currentTarget.value)}
                              />
                            </div>
                          </div>
                          <Show when={step.xKey || step.yKey}>
                            <div class="mt-2 rounded-md bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 text-[10px] text-purple-300">
                              Will render: X = <code class="font-mono">{step.xKey || "index"}</code> · Y = <code class="font-mono">{step.yKey || "value"}</code>
                            </div>
                          </Show>
                        </div>
                      </Show>

                      {/* Table Column Config */}
                      <Show when={step.type === "table"}>
                        <div class="rounded-lg border border-emerald-500/20 bg-[#080f0a] p-4">
                          <p class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M3 15h18M9 3v18"></path></svg>
                            Table Column Overrides
                          </p>
                          <p class="text-[10px] text-[#5b5b6e] mb-3">Leave empty to show all keys found in the array. Add keys only when you want to limit or order columns.</p>
                          <div class="space-y-2">
                            <For each={(step as any).columns || []}>
                              {(col: string, ci) => (
                                <div class="flex gap-2">
                                  <input
                                    type="text"
                                    class="flex-1 rounded-lg border border-[#2a2a3a] bg-[#1a1a26] px-3 py-1.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                                    placeholder="key name, e.g. symbol"
                                    value={col}
                                    onInput={(e) => {
                                      const cols = [...((step as any).columns || [])];
                                      cols[ci()] = e.currentTarget.value;
                                      updateStep(index(), "columns", cols);
                                    }}
                                  />
                                  <button
                                    class="text-[#5b5b6e] hover:text-red-400 px-2"
                                    onClick={() => {
                                      const cols = [...((step as any).columns || [])];
                                      cols.splice(ci(), 1);
                                      updateStep(index(), "columns", cols);
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                                  </button>
                                </div>
                              )}
                            </For>
                            <button
                              class="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-1"
                              onClick={() => updateStep(index(), "columns", [...((step as any).columns || []), ""])}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                              Add column
                            </button>
                          </div>
                        </div>
                      </Show>

                    </div>
                  </Show>

                      </div> {/* Close Configuration Left Column */}

                      {/* Right Column: Execution Result */}
                      <Show when={runData()}>
                        <div class="border-t lg:border-t-0 lg:border-l border-[#2a2a3a]/50 pt-4 lg:pt-0 lg:pl-6 flex flex-col h-full min-h-[220px]">
                          <Show when={log()} fallback={
                            <div class="flex flex-col items-center justify-center h-full py-8 text-center text-[#5b5b6e]">
                              <Show when={isRunning() && !(runData()?.logs || []).some((l: any) => l.stepId === "auth" || l.status === "error")} fallback={
                                <div class="flex flex-col items-center">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mb-2 text-[#3a3a4e]"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                  <span class="text-xs italic">Step not executed</span>
                                </div>
                              }>
                                <svg class="animate-spin h-5 w-5 text-blue-500 mb-2" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span class="text-xs text-blue-400 animate-pulse font-medium">Waiting to execute...</span>
                              </Show>
                            </div>
                          }>
                            <div class="flex items-center justify-between mb-3 border-b border-[#2a2a3a]/30 pb-2">
                              <div class="flex items-center gap-2">
                                <span class={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  log()!.status === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                }`}>
                                  {log()!.status}
                                </span>
                                <Show when={log()!.latencyMs}>
                                  <span class="text-[10px] text-[#5b5b6e] font-mono">{log()!.latencyMs}ms</span>
                                </Show>
                              </div>
                              
                              <Show when={!step.type || step.type === "grpc" || step.type === "rest" || step.type === "database"}>
                                <div class="flex p-0.5 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => setResultTab("response")}
                                    class={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                                      resultTab() === "response" ? "bg-emerald-500/10 text-emerald-400" : "text-[#5b5b6e] hover:text-[#8b8b9e]"
                                    }`}
                                  >
                                    Response
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setResultTab("payload")}
                                    class={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                                      resultTab() === "payload" ? "bg-blue-500/10 text-blue-400" : "text-[#5b5b6e] hover:text-[#8b8b9e]"
                                    }`}
                                  >
                                    Payload
                                  </button>
                                </div>
                              </Show>
                              
                              <Show when={step.type === "table" || step.type === "chart"}>
                                <span class="text-[10px] text-[#5b5b6e] font-mono">
                                  {stepData().length} rows
                                </span>
                              </Show>
                            </div>
                            
                            <div class="flex-1 flex flex-col justify-start overflow-hidden">
                              <Show when={!step.type || step.type === "grpc" || step.type === "rest" || step.type === "database"}>
                                <Show when={resultTab() === "payload"}>
                                  <p class="text-[10px] text-[#5b5b6e] uppercase mb-1 font-semibold">Rendered Request Payload</p>
                                  <pre class="text-[11px] text-blue-300 font-mono overflow-auto max-h-[220px] bg-[#0a0a0f] p-3 rounded-lg border border-[#2a2a3a]/40 custom-scrollbar whitespace-pre-wrap break-all flex-1">
                                    {JSON.stringify(log()!.request, null, 2)}
                                  </pre>
                                </Show>
                                <Show when={resultTab() === "response"}>
                                  <p class="text-[10px] text-[#5b5b6e] uppercase mb-1 font-semibold">Response Content</p>
                                  <pre class={`text-[11px] font-mono overflow-auto max-h-[220px] bg-[#0a0a0f] p-3 rounded-lg border border-[#2a2a3a]/40 custom-scrollbar whitespace-pre-wrap break-all flex-1 ${
                                    log()!.error ? "text-red-300 border-red-500/20 bg-red-950/5" : "text-emerald-300"
                                  }`}>
                                    {log()!.error || JSON.stringify(log()!.response, null, 2)}
                                  </pre>
                                </Show>
                              </Show>
                              
                              <Show when={step.type === "table"}>
                                <div class="flex-1 overflow-hidden flex flex-col">
                                  <Show when={stepData().length > 0} fallback={
                                    <div class="text-[11px] text-[#5b5b6e] italic py-8 text-center border border-dashed border-[#2a2a3a] rounded-lg flex-1 flex items-center justify-center">
                                      No table rows found
                                    </div>
                                  }>
                                    <LogTable data={stepData()} columns={log()!.meta?.columns} />
                                  </Show>
                                </div>
                              </Show>
                              
                              <Show when={step.type === "chart"}>
                                <div class="flex-1 overflow-hidden flex flex-col justify-center">
                                  <Show when={stepData().length > 0} fallback={
                                    <div class="text-[11px] text-[#5b5b6e] italic py-8 text-center border border-dashed border-[#2a2a3a] rounded-lg flex-1 flex items-center justify-center">
                                      No chart points found
                                    </div>
                                  }>
                                    <LogChart
                                      data={stepData()}
                                      xKey={log()!.meta?.xKey}
                                      yKey={log()!.meta?.yKey}
                                      chartType={log()!.meta?.chartType || "bar"}
                                    />
                                  </Show>
                                </div>
                              </Show>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>

            <Show when={steps.length === 0}>
              <div class="rounded-xl border border-dashed border-[#2a2a3a] py-12 text-center bg-[#0a0a0f]/50">
                <p class="text-[#8b8b9e] text-sm">No steps added yet. Add a step to start your workflow.</p>
              </div>
            </Show>
          </div>
        </div>
      </div>
      {/* Settings Modal */}
      <Show when={showSettings()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div class="card max-w-lg w-full p-6 space-y-6 shadow-2xl border border-[#2a2a3a] bg-[#0c0c12]">
            <div class="flex items-center justify-between border-b border-[#2a2a3a] pb-4">
              <h2 class="text-xl font-bold text-white flex items-center gap-2">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                Workflow Settings
              </h2>
              <button 
                onClick={() => setShowSettings(false)}
                class="text-[#8b8b9e] hover:text-white transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="mb-1 block text-sm font-medium text-[#8b8b9e]">Proto File</label>
                <select
                  class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                  value={protoId()}
                  onChange={(e) => setProtoId(e.currentTarget.value)}
                >
                  <option value="">No Proto File (REST / Table Only)</option>
                  <Show when={!savedProtos.loading}>
                    <For each={savedProtos()}>
                      {(p) => (
                        <option value={p.id}>{p.name}</option>
                      )}
                    </For>
                  </Show>
                </select>
                <p class="mt-2 text-[10px] text-[#5b5b6e]">
                  Select a saved proto definition file from registry to enable autocomplete and service selectors in steps.
                </p>
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-[#8b8b9e]">Server Address</label>
                <input
                  type="text"
                  class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. localhost:50051"
                  value={serverAddress()}
                  onInput={(e) => setServerAddress(e.currentTarget.value)}
                />
              </div>

              <label class="flex items-center gap-3 cursor-pointer py-1">
                <div class="relative">
                  <input
                    type="checkbox"
                    class="peer sr-only"
                    checked={useTls()}
                    onChange={(e) => setUseTls(e.currentTarget.checked)}
                  />
                  <div class="h-6 w-11 rounded-full bg-[#2a2a3a] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-[#8b8b9e] after:transition-all after:content-[''] peer-checked:bg-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50"></div>
                </div>
                <span class="text-sm font-medium text-[#8b8b9e] peer-checked:text-white transition-colors">Use TLS Encryption</span>
              </label>

              <div class="border-t border-[#2a2a3a]/60 pt-4">
                <label class="mb-1 block text-sm font-medium text-[#8b8b9e]">
                  Schedule (Cron)
                  <span class="ml-1 text-[10px] text-[#5b5b6e]">e.g. */5 * * * *</span>
                </label>
                <input
                  type="text"
                  class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-blue-500 focus:outline-none placeholder:text-[#5b5b6e]"
                  placeholder="Leave empty for manual only"
                  value={schedule()}
                  onInput={(e) => setSchedule(e.currentTarget.value)}
                />
                <p class="mt-2 text-[10px] text-[#5b5b6e]">
                  Uses standard cron syntax (min hour day month weekday).
                </p>
              </div>

              <div class="border-t border-[#2a2a3a]/60 pt-4">
                <label class="mb-1 block text-sm font-medium text-[#8b8b9e]">OAuth Connection</label>
                <select
                  class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                  value={connectionId() || ""}
                  onChange={(e) => setConnectionId(e.currentTarget.value)}
                >
                  <option value="">No Connection (Public / Unauthenticated)</option>
                  <Show when={!connections.loading}>
                    <For each={connections()}>
                      {(conn) => (
                        <option value={conn.id}>{conn.name}</option>
                      )}
                    </For>
                  </Show>
                </select>
                <p class="mt-2 text-[10px] text-[#5b5b6e]">
                  Selected connection will retrieve an OAuth token and inject it as <code class="text-[#8b8b9e] font-mono">Authorization: Bearer &lt;token&gt;</code>.
                </p>
              </div>
            </div>

            <div class="pt-4 border-t border-[#2a2a3a] flex justify-end">
              <button 
                onClick={() => setShowSettings(false)}
                class="btn-primary px-6 py-2.5"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      </Show>
    </main>
  );
}

function StepAuthSettings(props: { step: any, index: number, updateStep: (idx: number, key: string, val: any) => void, connections: any[] }) {
  const currentAuthType = () => props.step?.authType || "none";
  const selectedConnection = () => {
    if (!props.step || !props.connections) return undefined;
    return props.connections.find((c: any) => c.id === props.step.connectionId);
  };

  return (
    <div class="mt-4 border-t border-[#2a2a3a]/60 pt-4 text-left">
      <label class="mb-2 block text-xs font-semibold text-[#8b8b9e] uppercase tracking-wider">Authentication</label>
      
      <div class="flex p-1 bg-[#151520] rounded-lg max-w-xs mb-3">
        <button
          onClick={() => props.updateStep(props.index, "authType", "none")}
          class={`flex-1 py-1 text-xs font-bold rounded transition-all ${currentAuthType() === "none" ? "bg-blue-600 text-white shadow" : "text-[#8b8b9e] hover:text-white"}`}
        >
          None
        </button>
        <button
          onClick={() => props.updateStep(props.index, "authType", "basic")}
          class={`flex-1 py-1 text-xs font-bold rounded transition-all ${currentAuthType() === "basic" ? "bg-blue-600 text-white shadow" : "text-[#8b8b9e] hover:text-white"}`}
        >
          Basic
        </button>
        <button
          onClick={() => props.updateStep(props.index, "authType", "oauth")}
          class={`flex-1 py-1 text-xs font-bold rounded transition-all ${currentAuthType() === "oauth" ? "bg-blue-600 text-white shadow" : "text-[#8b8b9e] hover:text-white"}`}
        >
          OAuth
        </button>
      </div>

      <Show when={currentAuthType() === "basic"}>
        <div class="grid grid-cols-2 gap-3 max-w-md">
          <div>
            <label class="mb-1 block text-[10px] text-[#8b8b9e]">Username</label>
            <input
              type="text"
              class="w-full rounded border border-[#2a2a3a] bg-[#1a1a26] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              placeholder="Username"
              value={props.step?.authUsername || ""}
              onInput={(e) => props.updateStep(props.index, "authUsername", e.currentTarget.value)}
            />
          </div>
          <div>
            <label class="mb-1 block text-[10px] text-[#8b8b9e]">Password</label>
            <input
              type="password"
              class="w-full rounded border border-[#2a2a3a] bg-[#1a1a26] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              placeholder="Password"
              value={props.step?.authPassword || ""}
              onInput={(e) => props.updateStep(props.index, "authPassword", e.currentTarget.value)}
            />
          </div>
        </div>
      </Show>

      <Show when={currentAuthType() === "oauth"}>
        <div class="max-w-md space-y-2">
          <label class="mb-1 block text-[10px] text-[#8b8b9e]">Select OAuth Connection</label>
          <select
            class="w-full rounded border border-[#2a2a3a] bg-[#1a1a26] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
            value={props.step?.connectionId || ""}
            onChange={(e) => props.updateStep(props.index, "connectionId", e.currentTarget.value)}
          >
            <option value="" disabled>Select Connection...</option>
            <For each={props.connections || []}>
              {(conn) => (
                <option value={conn.id}>{conn.name}</option>
              )}
            </For>
          </select>
          
          <Show when={selectedConnection()}>
            <p class="text-[10px] text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Returns token key: <span class="bg-[#1e1e2e] px-1.5 py-0.5 rounded border border-[#2a2a3a] text-white font-bold">{selectedConnection()?.tokenPath || "access_token"}</span>
            </p>
          </Show>
        </div>
      </Show>
    </div>
  );
}
