import { createSignal, createResource, For, Show } from "solid-js";
import { isServer } from "solid-js/web";

const fetchConnections = async () => {
  const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/connections` : "/api/connections";
  const res = await fetch(url);
  const json = await res.json();
  return json.success ? json.data : [];
};

export default function Connections() {
  const [connections, { refetch }] = createResource(fetchConnections);
  
  // Form/Editor state
  const [selectedConnection, setSelectedConnection] = createSignal<any>(null);
  const [isEditing, setIsEditing] = createSignal(false);
  const [isNew, setIsNew] = createSignal(false);

  // Form fields
  const [name, setName] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [method, setMethod] = createSignal("POST");
  const [authScheme, setAuthScheme] = createSignal<"basic" | "bearer" | "none">("none");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [bearerToken, setBearerToken] = createSignal("");
  const [body, setBody] = createSignal("{}");
  const [headers, setHeaders] = createSignal("{}");
  const [tokenPath, setTokenPath] = createSignal("access_token");

  // Testing & Saving states
  const [testResult, setTestResult] = createSignal<any>(null);
  const [isTesting, setIsTesting] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal<string | null>(null);

  const startNew = () => {
    setIsNew(true);
    setIsEditing(true);
    setSelectedConnection(null);

    setName("New OAuth Connection");
    setUrl("");
    setMethod("POST");
    setAuthScheme("none");
    setUsername("");
    setPassword("");
    setBearerToken("");
    setBody("{}");
    setHeaders("{}");
    setTokenPath("access_token");
    setTestResult(null);
  };

  const startEdit = (conn: any) => {
    setIsNew(false);
    setIsEditing(true);
    setSelectedConnection(conn);

    setName(conn.name || "");
    setUrl(conn.url || "");
    setMethod(conn.method || "POST");
    setAuthScheme(conn.authScheme || "none");
    setUsername(conn.username || "");
    setPassword(conn.password || "");
    setBearerToken(conn.bearerToken || "");
    setBody(conn.body || "{}");
    setHeaders(conn.headers || "{}");
    setTokenPath(conn.tokenPath || "access_token");
    setTestResult(null);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setIsNew(false);
    setSelectedConnection(null);
    setTestResult(null);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const payload = {
        url: url(),
        method: method(),
        body: method() !== "GET" ? body() : undefined,
        headers: headers(),
        authScheme: authScheme(),
        username: username(),
        password: password(),
        bearerToken: bearerToken(),
        tokenPath: tokenPath(),
      };

      const res = await fetch("/api/connections/test-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setTestResult(json);
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const saveConnection = async () => {
    if (!name().trim() || !url().trim()) {
      alert("Name and URL are required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name(),
        url: url(),
        method: method(),
        authScheme: authScheme(),
        username: username(),
        password: password(),
        bearerToken: bearerToken(),
        body: body(),
        headers: headers(),
        tokenPath: tokenPath(),
      };

      const connId = selectedConnection()?.id;
      const endpoint = isNew() ? "/api/connections" : `/api/connections/${connId.split(":")[1] || connId}`;
      const httpMethod = isNew() ? "POST" : "PUT";

      const res = await fetch(endpoint, {
        method: httpMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        setIsEditing(false);
        setIsNew(false);
        refetch();
      } else {
        alert("Failed to save connection: " + json.error);
      }
    } catch (e: any) {
      alert("Error saving connection: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteConnection = async (id: string, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this connection?")) return;

    setIsDeleting(id);
    try {
      const connDbId = id.includes(":") ? id.split(":")[1] : id;
      const res = await fetch(`/api/connections/${connDbId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        if (selectedConnection()?.id === id) {
          setIsEditing(false);
        }
        refetch();
      } else {
        alert("Failed to delete connection: " + json.error);
      }
    } catch (e: any) {
      alert("Error deleting connection: " + e.message);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <main class="mx-auto max-w-7xl px-6 py-12">
      <div class="mb-10 flex items-end justify-between">
        <div>
          <h1 class="text-4xl font-extrabold tracking-tight text-white mb-2">Connections</h1>
          <p class="text-[15px] text-[#8b8b9e]">Manage OAuth access tokens and credentials globally</p>
        </div>

        <Show when={!isEditing()}>
          <button onClick={startNew} class="btn-primary hover-lift glow-effect group flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="transition-transform group-hover:scale-110" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Connection
          </button>
        </Show>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Connection List / Editor */}
        <div class={isEditing() ? "lg:col-span-6 space-y-6" : "lg:col-span-12 space-y-6"}>
          <Show
            when={!connections.loading}
            fallback={
              <div class="space-y-4">
                <div class="h-24 bg-[#111118]/80 rounded-xl animate-pulse"></div>
                <div class="h-24 bg-[#111118]/80 rounded-xl animate-pulse"></div>
              </div>
            }
          >
            <Show
              when={connections() && connections().length > 0}
              fallback={
                <Show when={!isEditing()}>
                  <div class="card flex flex-col items-center justify-center p-16 text-center border-dashed border-[#2a2a3a]">
                    <div class="mb-6 rounded-full bg-[#1e1e2e] p-6 text-[#5b5b6e]">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                    </div>
                    <h3 class="mb-2 text-xl font-bold text-white">No connections configured</h3>
                    <p class="mb-6 max-w-md text-[#8b8b9e]">
                      Configure an OAuth endpoint to fetch access tokens and wire them to workflow HTTP/gRPC steps.
                    </p>
                    <button onClick={startNew} class="btn-primary">Add Connection</button>
                  </div>
                </Show>
              }
            >
              <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-1">
                <For each={connections()}>
                  {(conn: any) => (
                    <div 
                      onClick={() => startEdit(conn)}
                      class={`card p-6 flex items-start justify-between cursor-pointer transition-all duration-300 hover:shadow-lg ${
                        selectedConnection()?.id === conn.id 
                          ? "border-blue-500 bg-blue-500/5 shadow-blue-500/5" 
                          : "hover:border-[#3a3a4a] hover:-translate-y-0.5"
                      }`}
                    >
                      <div class="flex items-start gap-4">
                        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                            <line x1="6" y1="6" x2="6.01" y2="6"></line>
                            <line x1="6" y1="18" x2="6.01" y2="18"></line>
                          </svg>
                        </div>
                        <div>
                          <h3 class="text-lg font-bold text-white mb-1">{conn.name}</h3>
                          <p class="text-xs text-[#8b8b9e] font-mono break-all line-clamp-1">{conn.url}</p>
                          <div class="flex items-center gap-2 mt-2">
                            <span class="text-[10px] font-bold px-2 py-0.5 bg-[#1e1e2e] text-[#8b8b9e] rounded border border-[#2a2a3a] uppercase">{conn.method || "POST"}</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">{conn.authScheme || "none"} auth</span>
                          </div>
                        </div>
                      </div>

                      <button 
                        class="text-[#5b5b6e] hover:text-red-400 transition-colors p-1"
                        onClick={(e) => deleteConnection(conn.id, e)}
                        disabled={isDeleting() === conn.id}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>

        {/* Connection Editor Panel */}
        <Show when={isEditing()}>
          <div class="lg:col-span-6 card p-6 space-y-6">
            <div>
              <h2 class="text-xl font-bold text-white mb-1">{isNew() ? "New Connection" : "Edit Connection"}</h2>
              <p class="text-xs text-[#8b8b9e]">Configure client credentials / OAuth endpoint parameters</p>
            </div>

            <div class="space-y-4">
              <div>
                <label class="mb-1 block text-xs text-[#8b8b9e]">Name</label>
                <input 
                  type="text" 
                  class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none" 
                  value={name()} 
                  onInput={(e) => setName(e.currentTarget.value)}
                  placeholder="e.g. Stripe Client Auth"
                />
              </div>

              <div>
                <label class="mb-1 block text-xs text-[#8b8b9e]">OAuth Endpoint URL</label>
                <input 
                  type="text" 
                  class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none" 
                  value={url()} 
                  onInput={(e) => setUrl(e.currentTarget.value)}
                  placeholder="https://api.stripe.com/v1/oauth/token"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1 block text-xs text-[#8b8b9e]">HTTP Method</label>
                  <select 
                    class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none" 
                    value={method()} 
                    onChange={(e) => setMethod(e.currentTarget.value)}
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-xs text-[#8b8b9e]">Auth Scheme (for token retrieval)</label>
                  <select 
                    class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none" 
                    value={authScheme()} 
                    onChange={(e) => setAuthScheme(e.currentTarget.value as any)}
                  >
                    <option value="none">None (Body parameters only)</option>
                    <option value="basic">Basic (Username : Password)</option>
                    <option value="bearer">Static Bearer Token</option>
                  </select>
                </div>
              </div>

              <Show when={authScheme() === "basic"}>
                <div class="grid grid-cols-2 gap-4 pt-2 border-t border-[#2a2a3a]/40">
                  <div>
                    <label class="mb-1 block text-xs text-[#8b8b9e]">Username / Client ID</label>
                    <input 
                      type="text" 
                      class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none" 
                      value={username()} 
                      onInput={(e) => setUsername(e.currentTarget.value)}
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs text-[#8b8b9e]">Password / Client Secret</label>
                    <input 
                      type="password" 
                      class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none" 
                      value={password()} 
                      onInput={(e) => setPassword(e.currentTarget.value)}
                    />
                  </div>
                </div>
              </Show>

              <Show when={authScheme() === "bearer"}>
                <div class="pt-2 border-t border-[#2a2a3a]/40">
                  <label class="mb-1 block text-xs text-[#8b8b9e]">Bearer Token</label>
                  <input 
                    type="password" 
                    class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none" 
                    value={bearerToken()} 
                    onInput={(e) => setBearerToken(e.currentTarget.value)}
                  />
                </div>
              </Show>

              <Show when={method() !== "GET"}>
                <div>
                  <label class="mb-1 block text-xs text-[#8b8b9e]">Request Body (raw JSON or URL encoded)</label>
                  <textarea 
                    class="w-full h-24 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-2.5 text-xs font-mono text-purple-300 focus:border-blue-500 focus:outline-none" 
                    value={body()} 
                    onInput={(e) => setBody(e.currentTarget.value)}
                    placeholder='{"grant_type": "client_credentials"}'
                  />
                </div>
              </Show>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="mb-1 block text-xs text-[#8b8b9e]">Custom Headers (JSON)</label>
                  <textarea 
                    class="w-full h-20 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-2.5 text-xs font-mono text-purple-300 focus:border-blue-500 focus:outline-none" 
                    value={headers()} 
                    onInput={(e) => setHeaders(e.currentTarget.value)}
                    placeholder='{"Content-Type": "application/x-www-form-urlencoded"}'
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs text-[#8b8b9e]">Token JSON Path</label>
                  <input 
                    type="text" 
                    class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none" 
                    value={tokenPath()} 
                    onInput={(e) => setTokenPath(e.currentTarget.value)}
                    placeholder="e.g. access_token"
                  />
                  <p class="text-[9px] text-[#5b5b6e] mt-1">Nested lookup: e.g. <code class="font-mono bg-[#1a1a24] p-0.5">data.auth.token</code></p>
                </div>
              </div>

              {/* Testing results banner */}
              <Show when={testResult()}>
                <div class={`p-3 rounded-lg border text-xs ${
                  testResult().success 
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" 
                    : "bg-red-500/10 border-red-500/25 text-red-400"
                }`}>
                  <div class="font-bold uppercase tracking-wider mb-1">
                    {testResult().success ? "✓ Test Succeeded" : "✗ Test Failed"}
                  </div>
                  {testResult().success ? (
                    <div class="break-all font-mono mt-1">Extracted Token: {testResult().token}</div>
                  ) : (
                    <div class="break-words mt-1">{testResult().error}</div>
                  )}
                </div>
              </Show>

              <div class="pt-4 border-t border-[#2a2a3a]/60 flex items-center justify-between">
                <button 
                  onClick={testConnection} 
                  disabled={isTesting() || !url().trim()}
                  class="btn-secondary text-xs flex items-center gap-2 disabled:opacity-40"
                >
                  <Show when={isTesting()}>
                    <svg class="animate-spin h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  </Show>
                  Test Connection
                </button>

                <div class="flex items-center gap-3">
                  <button onClick={cancelEdit} class="btn-secondary text-xs">Cancel</button>
                  <button 
                    onClick={saveConnection} 
                    disabled={isSaving() || !name().trim() || !url().trim()}
                    class="btn-primary bg-purple-600 hover:bg-purple-500 text-white text-xs disabled:opacity-40"
                  >
                    Save Connection
                  </button>
                </div>
              </div>

            </div>
          </div>
        </Show>
      </div>
    </main>
  );
}
