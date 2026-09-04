import { createSignal, createResource, createMemo, For, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { type ConnectionType, type AuthType } from "~/lib/connections";

const fetchConnections = async () => {
  const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/connections` : "/api/connections";
  const res = await fetch(url);
  const json = await res.json();
  return json.success ? json.data : [];
};

const fetchCas = async () => {
  try {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/cas` : "/api/cas";
    const res = await fetch(url);
    const json = await res.json();
    return json.success ? json.data : [];
  } catch {
    return [];
  }
};

const fetchProtos = async () => {
  try {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/protos` : "/api/protos";
    const res = await fetch(url);
    const json = await res.json();
    return json.success ? json.data : [];
  } catch {
    return [];
  }
};

export default function Connections() {
  const [connections, { refetch }] = createResource(fetchConnections);
  const [cas] = createResource(fetchCas);
  const [protos] = createResource(fetchProtos);

  // Filters & Search
  const [activeTab, setActiveTab] = createSignal<"all" | "http" | "grpc" | "surrealdb">("all");
  const [searchQuery, setSearchQuery] = createSignal("");

  // Form / Editor state
  const [selectedConnection, setSelectedConnection] = createSignal<any>(null);
  const [isEditing, setIsEditing] = createSignal(false);
  const [isNew, setIsNew] = createSignal(false);

  // Common Fields
  const [connType, setConnType] = createSignal<ConnectionType>("http");
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");

  // HTTP Fields
  const [url, setUrl] = createSignal("");
  const [method, setMethod] = createSignal("GET");
  const [headers, setHeaders] = createSignal("{}");
  const [caId, setCaId] = createSignal("");

  // Auth Fields (HTTP & gRPC)
  const [authType, setAuthType] = createSignal<AuthType>("none");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [bearerToken, setBearerToken] = createSignal("");

  // OAuth / Pre-request Token Fields
  const [tokenUrl, setTokenUrl] = createSignal("");
  const [tokenMethod, setTokenMethod] = createSignal("POST");
  const [tokenAuthScheme, setTokenAuthScheme] = createSignal<"none" | "basic" | "bearer">("none");
  const [tokenUsername, setTokenUsername] = createSignal("");
  const [tokenPassword, setTokenPassword] = createSignal("");
  const [tokenBearerToken, setTokenBearerToken] = createSignal("");
  const [tokenBody, setTokenBody] = createSignal("{}");
  const [tokenHeaders, setTokenHeaders] = createSignal("{}");
  const [tokenPath, setTokenPath] = createSignal("access_token");
  const [tokenHeaderName, setTokenHeaderName] = createSignal("Authorization");
  const [tokenHeaderPrefix, setTokenHeaderPrefix] = createSignal("Bearer ");
  const [tokenMetadataKey, setTokenMetadataKey] = createSignal("authorization");

  // gRPC Fields
  const [serverAddress, setServerAddress] = createSignal("");
  const [useTls, setUseTls] = createSignal(false);
  const [acceptInvalidCert, setAcceptInvalidCert] = createSignal(false);
  const [protoId, setProtoId] = createSignal("");
  const [grpcMetadata, setGrpcMetadata] = createSignal("{}");

  // SurrealDB Fields
  const [dbUrl, setDbUrl] = createSignal("ws://127.0.0.1:8000/rpc");
  const [dbUsername, setDbUsername] = createSignal("root");
  const [dbPassword, setDbPassword] = createSignal("");
  const [dbNamespace, setDbNamespace] = createSignal("solidflow");
  const [dbDatabase, setDbDatabase] = createSignal("main");

  // Testing & Saving States
  const [testResult, setTestResult] = createSignal<any>(null);
  const [isTesting, setIsTesting] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal<string | null>(null);
  const [inlineTestingId, setInlineTestingId] = createSignal<string | null>(null);
  const [cardTestResults, setCardTestResults] = createSignal<Record<string, any>>({});

  const filteredConnections = createMemo(() => {
    const list = connections() || [];
    const tab = activeTab();
    const q = searchQuery().toLowerCase().trim();

    return list.filter((conn: any) => {
      const type = conn.type || (conn.serverAddress ? "grpc" : (conn.namespace || conn.database ? "surrealdb" : "http"));
      const matchesTab = tab === "all" || type === tab || (tab === "http" && type === "oauth");
      if (!matchesTab) return false;

      if (!q) return true;
      const matchName = conn.name?.toLowerCase().includes(q);
      const matchUrl = conn.url?.toLowerCase().includes(q);
      const matchAddr = conn.serverAddress?.toLowerCase().includes(q);
      const matchDb = conn.database?.toLowerCase().includes(q) || conn.namespace?.toLowerCase().includes(q);
      return matchName || matchUrl || matchAddr || matchDb;
    });
  });

  const connectionCounts = createMemo(() => {
    const list = connections() || [];
    let httpCount = 0;
    let grpcCount = 0;
    let surrealCount = 0;

    for (const c of list) {
      const type = c.type || (c.serverAddress ? "grpc" : (c.namespace || c.database ? "surrealdb" : "http"));
      if (type === "grpc") grpcCount++;
      else if (type === "surrealdb") surrealCount++;
      else httpCount++;
    }

    return { all: list.length, http: httpCount, grpc: grpcCount, surrealdb: surrealCount };
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setUrl("");
    setMethod("GET");
    setHeaders("{}");
    setCaId("");
    setAuthType("none");
    setUsername("");
    setPassword("");
    setBearerToken("");
    setTokenUrl("");
    setTokenMethod("POST");
    setTokenAuthScheme("none");
    setTokenUsername("");
    setTokenPassword("");
    setTokenBearerToken("");
    setTokenBody("{}");
    setTokenHeaders("{}");
    setTokenPath("access_token");
    setTokenHeaderName("Authorization");
    setTokenHeaderPrefix("Bearer ");
    setTokenMetadataKey("authorization");
    setServerAddress("");
    setUseTls(false);
    setAcceptInvalidCert(false);
    setProtoId("");
    setGrpcMetadata("{}");
    setDbUrl("ws://127.0.0.1:8000/rpc");
    setDbUsername("root");
    setDbPassword("");
    setDbNamespace("solidflow");
    setDbDatabase("main");
    setTestResult(null);
  };

  const startNew = (type: ConnectionType = "http") => {
    setIsNew(true);
    setIsEditing(true);
    setSelectedConnection(null);
    resetForm();
    setConnType(type);

    if (type === "http") {
      setName("New HTTP Connection");
      setUrl("https://api.example.com");
      setMethod("GET");
    } else if (type === "grpc") {
      setName("New gRPC Connection");
      setServerAddress("localhost:50051");
    } else if (type === "surrealdb") {
      setName("New SurrealDB Connection");
      setDbUrl("ws://127.0.0.1:8000/rpc");
      setDbNamespace("solidflow");
      setDbDatabase("main");
    }
  };

  const startEdit = (conn: any) => {
    setIsNew(false);
    setIsEditing(true);
    setSelectedConnection(conn);
    resetForm();

    const type: ConnectionType = conn.type || (conn.serverAddress ? "grpc" : (conn.namespace || conn.database ? "surrealdb" : "http"));
    setConnType(type);

    setName(conn.name || "");
    setDescription(conn.description || "");

    // HTTP
    setUrl(conn.url || "");
    setMethod(conn.method || "GET");
    setHeaders(typeof conn.headers === "object" ? JSON.stringify(conn.headers, null, 2) : (conn.headers || "{}"));
    setCaId(conn.caId || "");

    // Auth
    setAuthType(conn.authType || (conn.tokenPath ? "oauth" : "none"));
    setUsername(conn.username || "");
    setPassword(conn.password || "");
    setBearerToken(conn.bearerToken || "");

    // Token Fetch
    setTokenUrl(conn.tokenUrl || (conn.authType === "oauth" ? conn.url : ""));
    setTokenMethod(conn.tokenMethod || "POST");
    setTokenAuthScheme(conn.tokenAuthScheme || conn.authScheme || "none");
    setTokenUsername(conn.tokenUsername || "");
    setTokenPassword(conn.tokenPassword || "");
    setTokenBearerToken(conn.tokenBearerToken || "");
    setTokenBody(typeof conn.tokenBody === "object" ? JSON.stringify(conn.tokenBody, null, 2) : (conn.tokenBody || conn.body || "{}"));
    setTokenHeaders(typeof conn.tokenHeaders === "object" ? JSON.stringify(conn.tokenHeaders, null, 2) : (conn.tokenHeaders || "{}"));
    setTokenPath(conn.tokenPath || "access_token");
    setTokenHeaderName(conn.tokenHeaderName || "Authorization");
    setTokenHeaderPrefix(conn.tokenHeaderPrefix !== undefined ? conn.tokenHeaderPrefix : "Bearer ");
    setTokenMetadataKey(conn.tokenMetadataKey || "authorization");

    // gRPC
    setServerAddress(conn.serverAddress || "");
    setUseTls(!!conn.useTls);
    setAcceptInvalidCert(!!conn.acceptInvalidCert);
    setProtoId(conn.protoId || "");
    setGrpcMetadata(typeof conn.metadata === "object" ? JSON.stringify(conn.metadata, null, 2) : (conn.metadata || "{}"));

    // SurrealDB
    setDbUrl(conn.url || "ws://127.0.0.1:8000/rpc");
    setDbUsername(conn.username || "root");
    setDbPassword(conn.password || "");
    setDbNamespace(conn.namespace || "solidflow");
    setDbDatabase(conn.database || "main");

    setTestResult(null);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setIsNew(false);
    setSelectedConnection(null);
    setTestResult(null);
  };

  const getPayload = () => {
    const type = connType();
    const base = {
      name: name().trim(),
      type,
      description: description().trim() || undefined,
    };

    if (type === "http") {
      return {
        ...base,
        url: url().trim(),
        method: method(),
        headers: headers(),
        authType: authType(),
        username: authType() === "basic" ? username() : undefined,
        password: authType() === "basic" ? password() : undefined,
        bearerToken: authType() === "bearer" ? bearerToken() : undefined,
        caId: caId() || undefined,
        // Pre-request token fields
        tokenUrl: authType() === "oauth" ? tokenUrl().trim() : undefined,
        tokenMethod: authType() === "oauth" ? tokenMethod() : undefined,
        tokenAuthScheme: authType() === "oauth" ? tokenAuthScheme() : undefined,
        tokenUsername: authType() === "oauth" && tokenAuthScheme() === "basic" ? tokenUsername() : undefined,
        tokenPassword: authType() === "oauth" && tokenAuthScheme() === "basic" ? tokenPassword() : undefined,
        tokenBearerToken: authType() === "oauth" && tokenAuthScheme() === "bearer" ? tokenBearerToken() : undefined,
        tokenBody: authType() === "oauth" ? tokenBody() : undefined,
        tokenHeaders: authType() === "oauth" ? tokenHeaders() : undefined,
        tokenPath: authType() === "oauth" ? tokenPath() : undefined,
        tokenHeaderName: authType() === "oauth" ? tokenHeaderName() : undefined,
        tokenHeaderPrefix: authType() === "oauth" ? tokenHeaderPrefix() : undefined,
      };
    } else if (type === "grpc") {
      return {
        ...base,
        serverAddress: serverAddress().trim(),
        useTls: useTls(),
        caId: useTls() ? (caId() || undefined) : undefined,
        acceptInvalidCert: useTls() ? acceptInvalidCert() : undefined,
        protoId: protoId() || undefined,
        metadata: grpcMetadata(),
        authType: authType(),
        bearerToken: authType() === "bearer" ? bearerToken() : undefined,
        // Pre-request token fields
        tokenUrl: authType() === "oauth" ? tokenUrl().trim() : undefined,
        tokenMethod: authType() === "oauth" ? tokenMethod() : undefined,
        tokenAuthScheme: authType() === "oauth" ? tokenAuthScheme() : undefined,
        tokenUsername: authType() === "oauth" && tokenAuthScheme() === "basic" ? tokenUsername() : undefined,
        tokenPassword: authType() === "oauth" && tokenAuthScheme() === "basic" ? tokenPassword() : undefined,
        tokenBearerToken: authType() === "oauth" && tokenAuthScheme() === "bearer" ? tokenBearerToken() : undefined,
        tokenBody: authType() === "oauth" ? tokenBody() : undefined,
        tokenHeaders: authType() === "oauth" ? tokenHeaders() : undefined,
        tokenPath: authType() === "oauth" ? tokenPath() : undefined,
        tokenMetadataKey: authType() === "oauth" ? tokenMetadataKey() : undefined,
        tokenHeaderPrefix: authType() === "oauth" ? tokenHeaderPrefix() : undefined,
      };
    } else {
      return {
        ...base,
        url: dbUrl().trim(),
        username: dbUsername().trim() || undefined,
        password: dbPassword() || undefined,
        namespace: dbNamespace().trim() || undefined,
        database: dbDatabase().trim() || undefined,
      };
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const payload = getPayload();
      const res = await fetch("/api/connections/test", {
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

  const testConnectionFromCard = async (conn: any, e: Event) => {
    e.preventDefault();
    e.stopPropagation();

    const id = conn.id;
    setInlineTestingId(id);

    try {
      const res = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: id }),
      });
      const json = await res.json();
      setCardTestResults((prev) => ({ ...prev, [id]: json }));
    } catch (e: any) {
      setCardTestResults((prev) => ({ ...prev, [id]: { success: false, error: e.message } }));
    } finally {
      setInlineTestingId(null);
    }
  };

  const saveConnection = async () => {
    if (!name().trim()) {
      alert("Connection Name is required.");
      return;
    }

    if (connType() === "http" && !url().trim()) {
      alert("URL is required for HTTP connection.");
      return;
    }

    if (connType() === "grpc" && !serverAddress().trim()) {
      alert("Server Address is required for gRPC connection.");
      return;
    }

    if (connType() === "surrealdb" && !dbUrl().trim()) {
      alert("Database URL is required for SurrealDB connection.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = getPayload();
      const connId = selectedConnection()?.id;
      const endpoint = isNew() ? "/api/connections" : `/api/connections/${connId.includes(":") ? connId.split(":")[1] : connId}`;
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
      {/* Header */}
      <div class="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-4xl font-extrabold tracking-tight text-white mb-2">Connections</h1>
          <p class="text-[15px] text-[#8b8b9e]">Manage HTTP, gRPC, and SurrealDB connections with optional pre-request token authentication</p>
        </div>

        <Show when={!isEditing()}>
          <div class="flex items-center gap-2">
            <button
              onClick={() => startNew("http")}
              class="rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-semibold px-4 py-2.5 text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/5 hover:-translate-y-0.5"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              + HTTP
            </button>
            <button
              onClick={() => startNew("grpc")}
              class="rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-semibold px-4 py-2.5 text-sm flex items-center gap-2 transition-all shadow-lg shadow-purple-500/5 hover:-translate-y-0.5"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              + gRPC
            </button>
            <button
              onClick={() => startNew("surrealdb")}
              class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-4 py-2.5 text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/5 hover:-translate-y-0.5"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
              + SurrealDB
            </button>
          </div>
        </Show>
      </div>

      {/* Filter Tabs & Search Bar */}
      <Show when={!isEditing()}>
        <div class="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between border-b border-[#2a2a3a]/60 pb-6">
          <div class="flex items-center gap-2 overflow-x-auto w-full md:w-auto p-1 bg-[#111118] border border-[#2a2a3a] rounded-xl">
            <button
              onClick={() => setActiveTab("all")}
              class={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab() === "all" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-[#8b8b9e] hover:text-white"
              }`}
            >
              All
              <span class={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab() === "all" ? "bg-white/20 text-white" : "bg-[#1e1e2e] text-[#8b8b9e]"}`}>
                {connectionCounts().all}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("http")}
              class={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab() === "http" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-[#8b8b9e] hover:text-white"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              HTTP
              <span class={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab() === "http" ? "bg-white/20 text-white" : "bg-[#1e1e2e] text-[#8b8b9e]"}`}>
                {connectionCounts().http}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("grpc")}
              class={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab() === "grpc" ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "text-[#8b8b9e] hover:text-white"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              gRPC
              <span class={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab() === "grpc" ? "bg-white/20 text-white" : "bg-[#1e1e2e] text-[#8b8b9e]"}`}>
                {connectionCounts().grpc}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("surrealdb")}
              class={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab() === "surrealdb" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-[#8b8b9e] hover:text-white"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
              SurrealDB
              <span class={`px-1.5 py-0.2 text-[10px] rounded-full ${activeTab() === "surrealdb" ? "bg-white/20 text-white" : "bg-[#1e1e2e] text-[#8b8b9e]"}`}>
                {connectionCounts().surrealdb}
              </span>
            </button>
          </div>

          <div class="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search connections..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full bg-[#111118] border border-[#2a2a3a] rounded-xl px-3.5 py-2 pl-9 text-xs text-white placeholder:text-[#5b5b6e] focus:border-blue-500 focus:outline-none"
            />
            <svg class="absolute left-3 top-2.5 text-[#5b5b6e]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
        </div>
      </Show>

      {/* Main Grid: List + Editor */}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Connection List */}
        <div class={isEditing() ? "lg:col-span-5 space-y-4" : "lg:col-span-12 space-y-4"}>
          <Show
            when={!connections.loading}
            fallback={
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="h-44 bg-[#111118]/80 rounded-2xl animate-pulse border border-[#1e1e2e]"></div>
                <div class="h-44 bg-[#111118]/80 rounded-2xl animate-pulse border border-[#1e1e2e]"></div>
                <div class="h-44 bg-[#111118]/80 rounded-2xl animate-pulse border border-[#1e1e2e]"></div>
              </div>
            }
          >
            <Show
              when={filteredConnections().length > 0}
              fallback={
                <Show when={!isEditing()}>
                  <div class="card flex flex-col items-center justify-center p-16 text-center border-dashed border-[#2a2a3a]">
                    <div class="mb-6 rounded-full bg-[#1e1e2e] p-6 text-[#5b5b6e]">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                    </div>
                    <h3 class="mb-2 text-xl font-bold text-white">No connections found</h3>
                    <p class="mb-6 max-w-md text-[#8b8b9e] text-sm">
                      {searchQuery() ? `No connections match "${searchQuery()}".` : "Configure HTTP, gRPC, or SurrealDB connections to use across workflows and testing."}
                    </p>
                    <div class="flex items-center gap-3">
                      <button onClick={() => startNew("http")} class="btn-primary">Add HTTP</button>
                      <button onClick={() => startNew("grpc")} class="btn-secondary">Add gRPC</button>
                      <button onClick={() => startNew("surrealdb")} class="btn-secondary">Add SurrealDB</button>
                    </div>
                  </div>
                </Show>
              }
            >
              <div class={`grid gap-4 ${isEditing() ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
                <For each={filteredConnections()}>
                  {(conn: any) => {
                    const type = conn.type || (conn.serverAddress ? "grpc" : (conn.namespace || conn.database ? "surrealdb" : "http"));
                    const isSelected = () => selectedConnection()?.id === conn.id;
                    const cardTest = () => cardTestResults()[conn.id];

                    return (
                      <div
                        onClick={() => startEdit(conn)}
                        class={`card p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between group ${
                          isSelected()
                            ? "border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500"
                            : "hover:border-[#3a3a4a] hover:-translate-y-0.5 hover:shadow-xl"
                        }`}
                      >
                        <div>
                          {/* Card Header: Type Badge + Actions */}
                          <div class="flex items-start justify-between mb-3">
                            <div class="flex items-center gap-2">
                              <Show when={type === "http" || type === "oauth"}>
                                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                </div>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">HTTP</span>
                              </Show>

                              <Show when={type === "grpc"}>
                                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                </div>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">gRPC</span>
                              </Show>

                              <Show when={type === "surrealdb"}>
                                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
                                </div>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SurrealDB</span>
                              </Show>
                            </div>

                            <button
                              class="text-[#5b5b6e] hover:text-red-400 transition-colors p-1"
                              onClick={(e) => deleteConnection(conn.id, e)}
                              disabled={isDeleting() === conn.id}
                              title="Delete Connection"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            </button>
                          </div>

                          {/* Title & Target Details */}
                          <h3 class="text-base font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{conn.name}</h3>
                          
                          <Show when={type === "http" || type === "oauth"}>
                            <p class="text-xs font-mono text-[#8b8b9e] break-all line-clamp-1 mb-2">{conn.url}</p>
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class="text-[9px] font-bold px-1.5 py-0.5 bg-[#1e1e2e] text-[#8b8b9e] rounded border border-[#2a2a3a] uppercase">{conn.method || "GET"}</span>
                              <Show when={conn.authType === "oauth" || conn.tokenPath}>
                                <span class="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 flex items-center gap-1">
                                  <span class="w-1 h-1 rounded-full bg-amber-400"></span> OAuth Pre-request
                                </span>
                              </Show>
                              <Show when={conn.authType === "basic"}>
                                <span class="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">Basic Auth</span>
                              </Show>
                              <Show when={conn.authType === "bearer"}>
                                <span class="text-[9px] font-bold px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">Bearer Token</span>
                              </Show>
                            </div>
                          </Show>

                          <Show when={type === "grpc"}>
                            <p class="text-xs font-mono text-[#8b8b9e] break-all line-clamp-1 mb-2">{conn.serverAddress}</p>
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${conn.useTls ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-[#1e1e2e] text-[#8b8b9e] border-[#2a2a3a]"}`}>
                                {conn.useTls ? "TLS" : "Insecure"}
                              </span>
                              <Show when={conn.authType === "oauth"}>
                                <span class="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">OAuth Token</span>
                              </Show>
                              <Show when={conn.protoId}>
                                <span class="text-[9px] font-bold px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">Proto Linked</span>
                              </Show>
                            </div>
                          </Show>

                          <Show when={type === "surrealdb"}>
                            <p class="text-xs font-mono text-[#8b8b9e] break-all line-clamp-1 mb-2">{conn.url}</p>
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-mono">
                                NS: {conn.namespace || "solidflow"} / DB: {conn.database || "main"}
                              </span>
                            </div>
                          </Show>
                        </div>

                        {/* Card Footer: Quick Test Result & Button */}
                        <div class="mt-4 pt-3 border-t border-[#2a2a3a]/40 flex items-center justify-between">
                          <Show
                            when={cardTest()}
                            fallback={<span class="text-[10px] text-[#5b5b6e]">Click to edit / configure</span>}
                          >
                            <div class="flex items-center gap-1 text-[10px]">
                              <Show when={cardTest().success} fallback={<span class="text-red-400 font-bold">✗ Failed</span>}>
                                <span class="text-emerald-400 font-bold flex items-center gap-1">
                                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                  ✓ Connected ({cardTest().latencyMs}ms)
                                </span>
                              </Show>
                            </div>
                          </Show>

                          <button
                            onClick={(e) => testConnectionFromCard(conn, e)}
                            disabled={inlineTestingId() === conn.id}
                            class="px-2.5 py-1 rounded bg-[#1e1e2e] hover:bg-[#2a2a3a] text-[#8b8b9e] hover:text-white text-[10px] font-semibold border border-[#2a2a3a] transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            <Show when={inlineTestingId() === conn.id} fallback="Test">
                              <svg class="animate-spin h-3 w-3 text-blue-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              Testing...
                            </Show>
                          </button>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          </Show>
        </div>

        {/* Connection Editor Form */}
        <Show when={isEditing()}>
          <div class="lg:col-span-7 card p-6 space-y-6">
            <div class="flex items-start justify-between border-b border-[#2a2a3a]/60 pb-4">
              <div>
                <h2 class="text-xl font-bold text-white mb-1">
                  {isNew() ? `New ${connType().toUpperCase()} Connection` : `Edit Connection: ${name() || "Untitled"}`}
                </h2>
                <p class="text-xs text-[#8b8b9e]">Configure protocol settings, credentials, and authentication</p>
              </div>

              {/* Type Switcher (only when creating new) */}
              <Show when={isNew()}>
                <div class="flex p-1 bg-[#151520] border border-[#2a2a3a] rounded-lg">
                  <button
                    onClick={() => setConnType("http")}
                    class={`px-3 py-1 text-xs font-bold rounded transition-all ${connType() === "http" ? "bg-blue-600 text-white" : "text-[#8b8b9e] hover:text-white"}`}
                  >
                    HTTP
                  </button>
                  <button
                    onClick={() => setConnType("grpc")}
                    class={`px-3 py-1 text-xs font-bold rounded transition-all ${connType() === "grpc" ? "bg-purple-600 text-white" : "text-[#8b8b9e] hover:text-white"}`}
                  >
                    gRPC
                  </button>
                  <button
                    onClick={() => setConnType("surrealdb")}
                    class={`px-3 py-1 text-xs font-bold rounded transition-all ${connType() === "surrealdb" ? "bg-emerald-600 text-white" : "text-[#8b8b9e] hover:text-white"}`}
                  >
                    SurrealDB
                  </button>
                </div>
              </Show>
            </div>

            <div class="space-y-4">
              {/* Common Name & Description */}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Connection Name *</label>
                  <input
                    type="text"
                    class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                    value={name()}
                    onInput={(e) => setName(e.currentTarget.value)}
                    placeholder="e.g. Stripe API or Production SurrealDB"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Description (Optional)</label>
                  <input
                    type="text"
                    class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                    value={description()}
                    onInput={(e) => setDescription(e.currentTarget.value)}
                    placeholder="Brief description of this connection"
                  />
                </div>
              </div>

              {/* ---------------- HTTP CONFIGURATION ---------------- */}
              <Show when={connType() === "http"}>
                <div class="space-y-4 pt-2 border-t border-[#2a2a3a]/40">
                  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div class="md:col-span-3">
                      <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Endpoint / Base URL *</label>
                      <input
                        type="text"
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                        value={url()}
                        onInput={(e) => setUrl(e.currentTarget.value)}
                        placeholder="https://api.example.com/v1"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Method</label>
                      <select
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        value={method()}
                        onChange={(e) => setMethod(e.currentTarget.value)}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Custom Headers (JSON)</label>
                      <textarea
                        class="w-full h-20 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-2.5 text-xs font-mono text-purple-300 focus:border-blue-500 focus:outline-none"
                        value={headers()}
                        onInput={(e) => setHeaders(e.currentTarget.value)}
                        placeholder='{"Accept": "application/json"}'
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Trusted CA Certificate</label>
                      <select
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        value={caId()}
                        onChange={(e) => setCaId(e.currentTarget.value)}
                      >
                        <option value="">System Default Root CAs</option>
                        <option value="accept_all">Accept All / Insecure (Dev)</option>
                        <For each={cas() || []}>
                          {(c: any) => (
                            <option value={c.id}>{c.name} ({c.id})</option>
                          )}
                        </For>
                      </select>
                      <p class="text-[10px] text-[#5b5b6e] mt-1">Select a custom CA certificate uploaded in /TrustedCA</p>
                    </div>
                  </div>
                </div>
              </Show>

              {/* ---------------- gRPC CONFIGURATION ---------------- */}
              <Show when={connType() === "grpc"}>
                <div class="space-y-4 pt-2 border-t border-[#2a2a3a]/40">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Server Address (host:port) *</label>
                      <input
                        type="text"
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                        value={serverAddress()}
                        onInput={(e) => setServerAddress(e.currentTarget.value)}
                        placeholder="localhost:50051 or grpc.example.com:443"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Associated Proto File (Optional)</label>
                      <select
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        value={protoId()}
                        onChange={(e) => setProtoId(e.currentTarget.value)}
                      >
                        <option value="">None (Generic / Inferred)</option>
                        <For each={protos() || []}>
                          {(p: any) => (
                            <option value={p.id}>{p.name} ({p.id})</option>
                          )}
                        </For>
                      </select>
                    </div>
                  </div>

                  {/* TLS & CA Settings */}
                  <div class="p-4 rounded-xl bg-[#111118] border border-[#2a2a3a] space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="useTlsCheckbox"
                          checked={useTls()}
                          onChange={(e) => setUseTls(e.currentTarget.checked)}
                          class="h-4 w-4 rounded border-[#2a2a3a] bg-[#1e1e2e] text-blue-600 focus:ring-blue-500"
                        />
                        <label for="useTlsCheckbox" class="text-xs font-bold text-white cursor-pointer">
                          Enable TLS / SSL Connection
                        </label>
                      </div>

                      <Show when={useTls()}>
                        <div class="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="acceptInvalidCertCheckbox"
                            checked={acceptInvalidCert()}
                            onChange={(e) => setAcceptInvalidCert(e.currentTarget.checked)}
                            class="h-4 w-4 rounded border-[#2a2a3a] bg-[#1e1e2e] text-amber-500 focus:ring-amber-500"
                          />
                          <label for="acceptInvalidCertCheckbox" class="text-xs text-amber-400 cursor-pointer">
                            Accept Self-Signed / Invalid Certs
                          </label>
                        </div>
                      </Show>
                    </div>

                    <Show when={useTls()}>
                      <div>
                        <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">CA Certificate Override</label>
                        <select
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          value={caId()}
                          onChange={(e) => setCaId(e.currentTarget.value)}
                        >
                          <option value="">System Default Root CAs</option>
                          <For each={cas() || []}>
                            {(c: any) => (
                              <option value={c.id}>{c.name} ({c.id})</option>
                            )}
                          </For>
                        </select>
                      </div>
                    </Show>
                  </div>

                  <div>
                    <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Default gRPC Metadata / Headers (JSON)</label>
                    <textarea
                      class="w-full h-16 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-2.5 text-xs font-mono text-purple-300 focus:border-blue-500 focus:outline-none"
                      value={grpcMetadata()}
                      onInput={(e) => setGrpcMetadata(e.currentTarget.value)}
                      placeholder='{"x-tenant-id": "acme"}'
                    />
                  </div>
                </div>
              </Show>

              {/* ---------------- SURREALDB CONFIGURATION ---------------- */}
              <Show when={connType() === "surrealdb"}>
                <div class="space-y-4 pt-2 border-t border-[#2a2a3a]/40">
                  <div>
                    <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">SurrealDB Endpoint URL *</label>
                    <input
                      type="text"
                      class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                      value={dbUrl()}
                      onInput={(e) => setDbUrl(e.currentTarget.value)}
                      placeholder="ws://127.0.0.1:8000/rpc or http://localhost:8000"
                    />
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Namespace (NS)</label>
                      <input
                        type="text"
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        value={dbNamespace()}
                        onInput={(e) => setDbNamespace(e.currentTarget.value)}
                        placeholder="solidflow"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Database (DB)</label>
                      <input
                        type="text"
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        value={dbDatabase()}
                        onInput={(e) => setDbDatabase(e.currentTarget.value)}
                        placeholder="main"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Username</label>
                      <input
                        type="text"
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        value={dbUsername()}
                        onInput={(e) => setDbUsername(e.currentTarget.value)}
                        placeholder="root"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Password</label>
                      <input
                        type="password"
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                        value={dbPassword()}
                        onInput={(e) => setDbPassword(e.currentTarget.value)}
                        placeholder="Password"
                      />
                    </div>
                  </div>
                </div>
              </Show>

              {/* ---------------- AUTHENTICATION / PRE-REQUEST TOKEN (HTTP & gRPC) ---------------- */}
              <Show when={connType() === "http" || connType() === "grpc"}>
                <div class="p-4 rounded-xl bg-[#111118] border border-[#2a2a3a] space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h4 class="text-xs font-bold text-white uppercase tracking-wider">Authentication Strategy</h4>
                      <p class="text-[11px] text-[#8b8b9e]">Select static credentials or dynamic pre-request OAuth token fetching</p>
                    </div>

                    <div class="flex p-1 bg-[#151520] border border-[#2a2a3a] rounded-lg">
                      <button
                        onClick={() => setAuthType("none")}
                        class={`px-2.5 py-1 text-xs font-bold rounded transition-all ${authType() === "none" ? "bg-blue-600 text-white" : "text-[#8b8b9e] hover:text-white"}`}
                      >
                        None
                      </button>
                      <Show when={connType() === "http"}>
                        <button
                          onClick={() => setAuthType("basic")}
                          class={`px-2.5 py-1 text-xs font-bold rounded transition-all ${authType() === "basic" ? "bg-blue-600 text-white" : "text-[#8b8b9e] hover:text-white"}`}
                        >
                          Basic
                        </button>
                      </Show>
                      <button
                        onClick={() => setAuthType("bearer")}
                        class={`px-2.5 py-1 text-xs font-bold rounded transition-all ${authType() === "bearer" ? "bg-blue-600 text-white" : "text-[#8b8b9e] hover:text-white"}`}
                      >
                        Bearer
                      </button>
                      <button
                        onClick={() => setAuthType("oauth")}
                        class={`px-2.5 py-1 text-xs font-bold rounded transition-all ${authType() === "oauth" ? "bg-amber-600 text-white shadow" : "text-amber-400 hover:text-white"}`}
                      >
                        Pre-request OAuth
                      </button>
                    </div>
                  </div>

                  {/* Basic Auth Form */}
                  <Show when={authType() === "basic"}>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#2a2a3a]/40">
                      <div>
                        <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Username</label>
                        <input
                          type="text"
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          value={username()}
                          onInput={(e) => setUsername(e.currentTarget.value)}
                        />
                      </div>
                      <div>
                        <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Password</label>
                        <input
                          type="password"
                          class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                          value={password()}
                          onInput={(e) => setPassword(e.currentTarget.value)}
                        />
                      </div>
                    </div>
                  </Show>

                  {/* Static Bearer Token Form */}
                  <Show when={authType() === "bearer"}>
                    <div class="pt-2 border-t border-[#2a2a3a]/40">
                      <label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Static Bearer Token</label>
                      <input
                        type="password"
                        class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                        value={bearerToken()}
                        onInput={(e) => setBearerToken(e.currentTarget.value)}
                        placeholder="eyJhbGciOi..."
                      />
                    </div>
                  </Show>

                  {/* Dynamic Pre-request OAuth Token Form */}
                  <Show when={authType() === "oauth"}>
                    <div class="space-y-3 pt-2 border-t border-amber-500/20">
                      <div class="flex items-center gap-2 text-amber-400 text-xs font-bold">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        Pre-request Token Retrieval Configuration
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div class="md:col-span-3">
                          <label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Token Endpoint URL *</label>
                          <input
                            type="text"
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                            value={tokenUrl()}
                            onInput={(e) => setTokenUrl(e.currentTarget.value)}
                            placeholder="https://auth.example.com/oauth/token"
                          />
                        </div>
                        <div>
                          <label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Method</label>
                          <select
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                            value={tokenMethod()}
                            onChange={(e) => setTokenMethod(e.currentTarget.value)}
                          >
                            <option value="POST">POST</option>
                            <option value="GET">GET</option>
                          </select>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Token Request Auth Scheme</label>
                          <select
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                            value={tokenAuthScheme()}
                            onChange={(e) => setTokenAuthScheme(e.currentTarget.value as any)}
                          >
                            <option value="none">None (Payload only)</option>
                            <option value="basic">Basic (Client ID : Client Secret)</option>
                            <option value="bearer">Static Bearer Token</option>
                          </select>
                        </div>

                        <div>
                          <label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">JSON Token Path</label>
                          <input
                            type="text"
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                            value={tokenPath()}
                            onInput={(e) => setTokenPath(e.currentTarget.value)}
                            placeholder="e.g. access_token or data.token"
                          />
                        </div>
                      </div>

                      <Show when={tokenAuthScheme() === "basic"}>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Client ID</label>
                            <input
                              type="text"
                              class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                              value={tokenUsername()}
                              onInput={(e) => setTokenUsername(e.currentTarget.value)}
                            />
                          </div>
                          <div>
                            <label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Client Secret</label>
                            <input
                              type="password"
                              class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                              value={tokenPassword()}
                              onInput={(e) => setTokenPassword(e.currentTarget.value)}
                            />
                          </div>
                        </div>
                      </Show>

                      <Show when={tokenAuthScheme() === "bearer"}>
                        <div>
                          <label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Token Request Bearer Token</label>
                          <input
                            type="password"
                            class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                            value={tokenBearerToken()}
                            onInput={(e) => setTokenBearerToken(e.currentTarget.value)}
                          />
                        </div>
                      </Show>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Token Request Body (JSON)</label>
                          <textarea
                            class="w-full h-20 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-2 text-xs font-mono text-amber-300 focus:border-amber-500 focus:outline-none"
                            value={tokenBody()}
                            onInput={(e) => setTokenBody(e.currentTarget.value)}
                            placeholder='{"grant_type": "client_credentials"}'
                          />
                        </div>
                        <div>
                          <label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Token Request Headers (JSON)</label>
                          <textarea
                            class="w-full h-20 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-2 text-xs font-mono text-amber-300 focus:border-amber-500 focus:outline-none"
                            value={tokenHeaders()}
                            onInput={(e) => setTokenHeaders(e.currentTarget.value)}
                            placeholder='{"Content-Type": "application/json"}'
                          />
                        </div>
                      </div>
                    </div>
                  </Show>
                </div>
              </Show>

              {/* ---------------- LIVE TEST RESULTS PANEL ---------------- */}
              <Show when={testResult()}>
                <div class={`p-4 rounded-xl border text-xs space-y-2 ${
                  testResult().success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}>
                  <div class="flex items-center justify-between font-bold uppercase tracking-wider">
                    <span class="flex items-center gap-1.5">
                      {testResult().success ? (
                        <>
                          <svg class="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          Test Succeeded
                        </>
                      ) : (
                        <>
                          <svg class="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          Test Failed
                        </>
                      )}
                    </span>
                    <Show when={testResult().latencyMs !== undefined}>
                      <span class="font-mono text-[10px] lowercase text-[#8b8b9e]">{testResult().latencyMs}ms</span>
                    </Show>
                  </div>

                  <Show when={testResult().message}>
                    <p class="text-xs">{testResult().message}</p>
                  </Show>

                  <Show when={testResult().error}>
                    <p class="text-xs font-mono break-all text-red-400">{testResult().error}</p>
                  </Show>

                  {/* If pre-request token was fetched */}
                  <Show when={testResult().token}>
                    <div class="p-2 rounded bg-black/40 border border-emerald-500/20 font-mono text-[11px] break-all">
                      <span class="text-emerald-400 font-bold">Extracted Token:</span> {testResult().token.slice(0, 40)}...
                    </div>
                  </Show>

                  {/* If HTTP response preview */}
                  <Show when={testResult().response}>
                    <div class="p-2 rounded bg-black/40 border border-emerald-500/20 font-mono text-[10px] break-all max-h-32 overflow-y-auto">
                      <span class="text-emerald-400 font-bold">Response:</span> {JSON.stringify(testResult().response, null, 2)}
                    </div>
                  </Show>
                </div>
              </Show>

              {/* ---------------- FORM ACTION BUTTONS ---------------- */}
              <div class="pt-4 border-t border-[#2a2a3a]/60 flex items-center justify-between">
                <button
                  onClick={testConnection}
                  disabled={isTesting()}
                  class="btn-secondary text-xs flex items-center gap-2 disabled:opacity-40"
                >
                  <Show when={isTesting()} fallback={
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                      Test Connection
                    </>
                  }>
                    <svg class="animate-spin h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Testing Connection...
                  </Show>
                </button>

                <div class="flex items-center gap-3">
                  <button onClick={cancelEdit} class="btn-secondary text-xs">Cancel</button>
                  <button
                    onClick={saveConnection}
                    disabled={isSaving() || !name().trim()}
                    class="btn-primary bg-blue-600 hover:bg-blue-500 text-white text-xs disabled:opacity-40 flex items-center gap-2"
                  >
                    <Show when={isSaving()} fallback="Save Connection">
                      <svg class="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Saving...
                    </Show>
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
