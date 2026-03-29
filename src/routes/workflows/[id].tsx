import { createSignal, createEffect, onMount, For, Show, createResource } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { isServer } from "solid-js/web";
import { useParams, useNavigate } from "@solidjs/router";
import get from "lodash.get";
import { parseProtoContent, generateSkeleton, ParsedProto } from "~/lib/protoParser";

export default function WorkflowBuilder() {
  const params = useParams();
  const navigate = useNavigate();
  const isNew = params.id === "new";

  // Form state
  const [name, setName] = createSignal("New Workflow");
  const [protoContent, setProtoContent] = createSignal("");
  
  // Fetch saved protos from Registry
  const [savedProtos] = createResource(async () => {
    if (isServer) return [];
    try {
      const res = await fetch("/api/protos");
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });

  const [serverAddress, setServerAddress] = createSignal("localhost:50051");
  const [useTls, setUseTls] = createSignal(false);
  const [schedule, setSchedule] = createSignal("");
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

  // Parsed state
  const [parsedProto, setParsedProto] = createSignal<ParsedProto | null>(null);
  const [compileError, setCompileError] = createSignal<string | null>(null);

  // Execution state
  const [runId, setRunId] = createSignal<string | null>(null);
  const [runData, setRunData] = createSignal<any>(null);
  const [isRunning, setIsRunning] = createSignal(false);

  // Fetch existing if not new
  const fetchWorkflow = async () => {
    if (isNew || isServer) return null;
    const res = await fetch(`/api/workflows/${params.id}`);
    const json = await res.json();
    if (json.success && json.data) {
      setName(json.data.name || "Untitled");
      setProtoContent(json.data.protoContent || "");
      setServerAddress(json.data.serverAddress || "localhost:50051");
      setUseTls(json.data.useTls || false);
      setSchedule(json.data.schedule || "");
        
        const ac = json.data.authConfig;
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
        
        setSteps(reconcile(json.data.steps || []));
      return json.data;
    }
    return null;
  };

  const [workflow] = createResource(params.id, fetchWorkflow);

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
      protoContent: protoContent(),
      serverAddress: serverAddress(),
      useTls: useTls(),
      schedule: schedule(),
      authConfig: (authType() === "grpc" ? authService() : (authType() === "rest" ? authUrl() : bearerToken())) ? {
        type: authType(),
        serviceName: authType() === "grpc" ? authService() : undefined,
        methodName: authType() === "grpc" ? authMethod() : undefined,
        requestTemplate: authType() === "grpc" ? authRequestTemplate() : undefined,
        url: authType() === "rest" ? authUrl() : undefined,
        method: authType() === "rest" ? authRestMethod() : undefined,
        authScheme: authType() === "rest" ? authScheme() : undefined,
        username: authType() === "rest" ? authUsername() : undefined,
        password: authType() === "rest" ? authPassword() : undefined,
        bearerToken: authType() === "static" || (authType() === "rest" && authScheme() === "bearer") ? bearerToken() : undefined,
        body: authType() === "rest" ? authRestBody() : undefined,
        tokenPath: authTokenPath()
      } : undefined,
      steps: steps,
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

  const addStep = () => {
    setSteps([...steps, {
      id: `step_${steps.length + 1}`,
      serviceName: "",
      methodName: "",
      requestBodyTemplate: "{}",
      headersTemplate: "{}",
      serverAddress: "",
      useTls: useTls()
    }]);
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
    setSteps(steps.filter((_, i) => i !== index));
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

      <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Col: Setup & Proto */}
        <div class="col-span-1 space-y-6">
          <div class="card p-5">
            <h3 class="mb-4 text-lg font-bold text-white flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
              Connection
            </h3>
            
            <label class="mb-1 block text-sm font-medium text-[#8b8b9e]">Server Address</label>
            <input
              type="text"
              class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
              placeholder="e.g. localhost:50051"
              value={serverAddress()}
              onInput={(e) => setServerAddress(e.currentTarget.value)}
            />

            <label class="mt-4 flex items-center gap-3 cursor-pointer">
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

            <div class="mt-6 border-t border-[#2a2a3a] pt-6">
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

            <div class="mt-6 border-t border-[#2a2a3a] pt-6">
              <h3 class="mb-4 text-sm font-bold text-white flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Authentication
              </h3>

              <div class="space-y-4">
                <div class="flex p-1 bg-[#1e1e2e] rounded-lg">
                  <button
                    onClick={() => setAuthType("grpc")}
                    class={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${authType() === "grpc" ? "bg-blue-600 text-white shadow-lg" : "text-[#8b8b9e] hover:text-white"}`}
                  >
                    gRPC
                  </button>
                  <button
                    onClick={() => setAuthType("rest")}
                    class={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${authType() === "rest" ? "bg-blue-600 text-white shadow-lg" : "text-[#8b8b9e] hover:text-white"}`}
                  >
                    REST
                  </button>
                  <button
                    onClick={() => setAuthType("static")}
                    class={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${authType() === "static" ? "bg-blue-600 text-white shadow-lg" : "text-[#8b8b9e] hover:text-white"}`}
                  >
                    Static Token
                  </button>
                </div>

                <Show when={authType() === "grpc"}>
                  <div>
                    <label class="mb-1 block text-xs text-[#8b8b9e]">Auth Service</label>
                    <select
                      class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                      value={authService()}
                      onChange={(e) => setAuthService(e.currentTarget.value)}
                    >
                      <option value="">None (No Auth)</option>
                      <For each={parsedProto()?.services || []}>
                        {(svc) => <option value={svc.fullName}>{svc.fullName}</option>}
                      </For>
                    </select>
                  </div>

                  <Show when={authService()}>
                    <div>
                      <label class="mb-1 block text-xs text-[#8b8b9e]">Auth Method</label>
                      <select
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                        value={authMethod()}
                        onChange={(e) => setAuthMethod(e.currentTarget.value)}
                      >
                        <option value="" disabled>Select method...</option>
                        <For each={parsedProto()?.services.find(s => s.fullName === authService())?.methods || []}>
                          {(m) => <option value={m.name}>{m.name}</option>}
                        </For>
                      </select>
                    </div>

                    <div>
                      <label class="mb-1 block text-xs text-[#8b8b9e]">Request Template (JSON)</label>
                      <textarea
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1b1b26] p-2 text-xs font-mono text-emerald-300 focus:border-emerald-500 focus:outline-none"
                        rows={3}
                        value={authRequestTemplate()}
                        onInput={(e) => setAuthRequestTemplate(e.currentTarget.value)}
                      />
                    </div>
                  </Show>
                </Show>

                <Show when={authType() === "rest"}>
                  <div class="space-y-3">
                    <div>
                      <label class="mb-1 block text-xs text-[#8b8b9e]">URL</label>
                      <input
                        type="text"
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                        placeholder="https://auth.example.com/token"
                        value={authUrl()}
                        onInput={(e) => setAuthUrl(e.currentTarget.value)}
                      />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                       <div>
                        <label class="mb-1 block text-xs text-[#8b8b9e]">Method</label>
                        <select
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          value={authRestMethod()}
                          onChange={(e) => setAuthRestMethod(e.currentTarget.value)}
                        >
                          <option value="POST">POST</option>
                          <option value="GET">GET</option>
                          <option value="PUT">PUT</option>
                        </select>
                      </div>
                      <div>
                        <label class="mb-1 block text-xs text-[#8b8b9e]">Auth Scheme</label>
                        <select
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          value={authScheme()}
                          onChange={(e) => setAuthScheme(e.currentTarget.value as any)}
                        >
                          <option value="basic">Basic (User:Pass)</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                    </div>
                    <Show when={authScheme() === "basic"}>
                      <div class="grid grid-cols-2 gap-2">
                        <div>
                          <label class="mb-1 block text-xs text-[#8b8b9e]">Username (Basic)</label>
                          <input
                            type="text"
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                            value={authUsername()}
                            onInput={(e) => setAuthUsername(e.currentTarget.value)}
                          />
                        </div>
                        <div>
                          <label class="mb-1 block text-xs text-[#8b8b9e]">Password (Basic)</label>
                          <input
                            type="password"
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                            value={authPassword()}
                            onInput={(e) => setAuthPassword(e.currentTarget.value)}
                          />
                        </div>
                      </div>
                    </Show>
                    <Show when={authScheme() === "bearer"}>
                      <div>
                        <label class="mb-1 block text-xs text-[#8b8b9e]">Bearer Token</label>
                        <input
                          type="password"
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          value={bearerToken()}
                          onInput={(e) => setBearerToken(e.currentTarget.value)}
                        />
                      </div>
                    </Show>
                    <Show when={authRestMethod() !== "GET"}>
                      <div>
                        <label class="mb-1 block text-xs text-[#8b8b9e]">Body (JSON)</label>
                        <textarea
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1b1b26] p-2 text-xs font-mono text-emerald-300 focus:border-emerald-500 focus:outline-none"
                          rows={2}
                          value={authRestBody()}
                          onInput={(e) => setAuthRestBody(e.currentTarget.value)}
                        />
                      </div>
                    </Show>
                  </div>
                </Show>

                <Show when={authType() === "static"}>
                  <div class="space-y-3">
                    <div>
                      <label class="mb-1 block text-xs text-[#8b8b9e]">Static Bearer Token</label>
                      <input
                        type="password"
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                        placeholder="Paste your token here..."
                        value={bearerToken()}
                        onInput={(e) => setBearerToken(e.currentTarget.value)}
                      />
                      <p class="mt-2 text-[10px] text-[#5b5b6e]">
                        This token will be injected directly as <code class="text-[#8b8b9e] font-mono">Authorization: Bearer &lt;token&gt;</code> into all gRPC steps. No Auth API request will be made.
                      </p>
                    </div>
                  </div>
                </Show>

                <Show when={authType() !== "static"}>
                  <div class="pt-2 border-t border-[#2a2a3a]/50">
                    <label class="mb-1 block text-xs text-[#8b8b9e]">Token JSON Path</label>
                    <input
                      type="text"
                      class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                      placeholder="e.g. accessToken"
                      value={authTokenPath()}
                      onInput={(e) => setAuthTokenPath(e.currentTarget.value)}
                    />
                  </div>

                  <button
                    onClick={testAuth}
                    disabled={isTestingAuth() || (authType() === "grpc" && !authMethod()) || (authType() === "rest" && !authUrl())}
                    class="w-full rounded-lg bg-blue-600/20 py-2 text-xs font-bold text-blue-400 hover:bg-blue-600/30 transition-colors flex items-center justify-center gap-2 border border-blue-500/30"
                  >
                    <Show when={isTestingAuth()}>
                      <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </Show>
                    Test Authentication
                  </button>
                </Show>

                <Show when={authTestResult()}>
                  <div class={`mt-2 rounded p-2 text-[10px] ${authTestResult()!.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    <div class="font-bold mb-1">{authTestResult()!.success ? "✓ Success" : "✗ Error"}</div>
                    {authTestResult()!.success ? (
                      <div class="break-all font-mono">Token: {authTestResult()!.token}</div>
                    ) : (
                      <div class="break-words">{authTestResult()!.error}</div>
                    )}
                  </div>
                </Show>
              </div>
            </div>

          </div>

          <div class="card p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Proto Definition
              </h3>
              <Show when={savedProtos() && savedProtos().length > 0}>
                <select 
                  class="rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none max-w-[150px] truncate"
                  onChange={(e) => {
                    const id = e.currentTarget.value;
                    const p = savedProtos().find((x: any) => x.id === id);
                    if (p) setProtoContent(p.content);
                    // Reset selection to default option
                    e.currentTarget.value = "";
                  }}
                >
                  <option value="">Load saved proto...</option>
                  <For each={savedProtos()}>
                    {(p: any) => <option value={p.id}>{p.name}</option>}
                  </For>
                </select>
              </Show>
            </div>
            <textarea
              class="h-64 w-full resize-none font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-blue-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              placeholder="Paste your .proto schema here..."
              value={protoContent()}
              onInput={(e) => setProtoContent(e.currentTarget.value)}
            />
            <Show when={compileError()}>
              <div class="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {compileError()}
              </div>
            </Show>
          </div>
        </div>

        {/* Right Col: Steps Builder & Run Results */}
        <div class="col-span-1 lg:col-span-2 space-y-6">
          <Show when={runData()}>
            <div class={`card p-5 border ${runData().status === "completed" ? "border-emerald-500/30" : runData().status === "failed" ? "border-red-500/30" : "border-blue-500/30"}`}>
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-bold text-white">Execution Result</h3>
                <span class={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${runData().status === "completed" ? "bg-emerald-500/20 text-emerald-400" : runData().status === "failed" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`}>
                  {runData().status}
                </span>
              </div>
              <div class="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <For each={runData().logs}>
                  {(log: any) => (
                    <div class="rounded-lg bg-[#1e1e2e] border border-[#2a2a3a] p-4">
                      <div class="flex items-center justify-between mb-2">
                        <span class="font-mono text-white text-sm bg-[#2a2a3a] px-2 py-1 rounded">Step: {log.stepId}</span>
                        <span class={`text-xs ${log.status === "success" ? "text-emerald-400" : "text-red-400"}`}>
                          {log.status.toUpperCase()} {log.latencyMs ? `(${log.latencyMs}ms)` : ""}
                        </span>
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <p class="text-[10px] text-[#8b8b9e] uppercase mb-1">Rendered Payload</p>
                          <pre class="text-xs text-blue-300 font-mono overflow-x-auto bg-[#151520] p-2 rounded">{JSON.stringify(log.request, null, 2)}</pre>
                        </div>
                        <div>
                          <p class="text-[10px] text-[#8b8b9e] uppercase mb-1">Response</p>
                          <pre class={`text-xs font-mono overflow-x-auto bg-[#151520] p-2 rounded ${log.error ? "text-red-300" : "text-emerald-300"}`}>
                            {log.error || JSON.stringify(log.response, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-white">Workflow Steps</h2>
            <button onClick={addStep} class="text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1">
              + Add Step
            </button>
          </div>

          <div class="space-y-6">
            <For each={steps}>
              {(step, index) => (
                <div class="card p-5 relative border-l-4 border-l-blue-500">
                  <div class="absolute -left-[14px] -top-[14px] flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white ring-4 ring-[#0a0a0f]">
                    {index() + 1}
                  </div>
                  
                  <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-4 flex-1">
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
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-xs text-[#8b8b9e]">Request Payload Template</label>
                      <span class="text-[10px] text-blue-400 font-mono">{"{{ steps.<id>.response }}"}</span>
                    </div>
                    <textarea
                      class="h-32 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      value={step.requestBodyTemplate}
                      onInput={(e) => updateStep(index(), "requestBodyTemplate", e.currentTarget.value)}
                    />
                  </div>

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
                </div>
              )}
            </For>

            <Show when={steps.length === 0}>
              <div class="rounded-xl border border-dashed border-[#2a2a3a] py-12 text-center bg-[#0a0a0f]/50">
                <p class="text-[#8b8b9e] text-sm">No steps added yet. Add a step to start your workflow.</p>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </main>
  );
}
