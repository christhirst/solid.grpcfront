import { createEffect, createMemo, createSignal, For, Show, untrack } from "solid-js";
import { generateSkeleton, parseProtoContent, type ParsedProto } from "~/lib/protoParser";
import type { ReflectedSchema } from "~/lib/grpcReflection";

export type ReflectionResult = { success: boolean; data?: ReflectedSchema; error?: string };

export default function GrpcMethodPicker(props: {
  step: any;
  connections: any[];
  savedProtos: any[];
  fallbackProto: ParsedProto | null;
  update: (key: string, value: any) => void;
  discover: (id: string, refresh?: boolean, payload?: any) => Promise<ReflectionResult>;
}) {
  const [isReflecting, setIsReflecting] = createSignal(false);
  const [reflectionError, setReflectionError] = createSignal<string | null>(null);
  const [reflectionResult, setReflectionResult] = createSignal<ReflectedSchema | null>(null);
  const [showDetails, setShowDetails] = createSignal(false);
  const [servicesFilter, setServicesFilter] = createSignal("");

  const isCustom = () => {
    if (props.step.connectionMode === "custom") return true;
    if (props.step.connectionMode === "saved") return false;
    if (props.step.connectionId) return false;
    if (props.step.serverAddress) return true;
    return !props.connections.some((c: any) => c.type === "grpc");
  };

  const connection = createMemo(() => props.connections.find((c: any) => c.id === props.step.connectionId && c.type === "grpc"));
  const cleanConnectionId = () => (props.step.connectionId || "").replace(/^connection:/, "").replace(/[⟨⟩]/g, "").trim();

  const effectiveAddress = () => {
    if (isCustom()) {
      return props.step.serverAddress || "";
    }
    return props.step.serverAddress || connection()?.serverAddress || "";
  };

  const manualProto = () => props.step.grpcProtoId || "";

  // Prepare reflection request payload combining connection defaults and step overrides
  const targetPayload = () => {
    if (isCustom()) {
      return {
        type: "grpc",
        serverAddress: props.step.serverAddress || "",
        caId: props.step.caId,
        useTls: Boolean(props.step.caId),
        authType: props.step.authType || "none",
        username: props.step.authUsername || props.step.username,
        password: props.step.authPassword || props.step.password,
        bearerToken: props.step.bearerToken,
        metadata: props.step.headersTemplate,
      };
    }
    const conn = connection();
    if (!conn) return null;
    return {
      ...conn,
      ...(props.step.serverAddress ? { serverAddress: props.step.serverAddress } : {}),
      ...(props.step.caId !== undefined && props.step.caId !== "" ? { caId: props.step.caId } : {}),
      ...(props.step.headersTemplate ? { metadata: props.step.headersTemplate } : {}),
      ...(props.step.authType ? { authType: props.step.authType } : {}),
      ...(props.step.authUsername ? { username: props.step.authUsername } : {}),
      ...(props.step.authPassword ? { password: props.step.authPassword } : {}),
      ...(props.step.bearerToken ? { bearerToken: props.step.bearerToken } : {}),
    };
  };

  // Trigger reflection query against target host
  const fetchReflection = async () => {
    const addr = effectiveAddress();
    if (!addr) {
      setReflectionError("Please provide a Server Address first (host:port).");
      return;
    }

    setIsReflecting(true);
    setReflectionError(null);

    try {
      const payload = targetPayload();
      const targetId = isCustom() ? "adhoc" : (cleanConnectionId() || "adhoc");
      const res = await props.discover(targetId, true, payload);

      if (res.success && res.data) {
        setReflectionResult(res.data);
        untrack(() => {
          props.update("grpcDescriptorSet", res.data?.descriptorSet);
          props.update("grpcParsedProto", res.data?.parsedProto);
          props.update("grpcSchemaConnectionId", isCustom() ? "custom" : cleanConnectionId());
          props.update("grpcProtoId", undefined);
        });
      } else {
        setReflectionError(res.error || "Server reflection unavailable");
      }
    } catch (e: any) {
      setReflectionError(e.message || "Failed to contact server for reflection");
    } finally {
      setIsReflecting(false);
    }
  };

  // Initialize from persisted step schema if available
  createEffect(() => {
    if (!reflectionResult() && props.step.grpcParsedProto) {
      setReflectionResult({
        descriptorSet: props.step.grpcDescriptorSet || "",
        parsedProto: props.step.grpcParsedProto,
      });
    }
  });

  const schema = createMemo(() => {
    const protoId = manualProto() || (!isCustom() ? connection()?.protoId : undefined);
    const saved = props.savedProtos.find((p: any) => p.id === protoId);

    if (manualProto() && saved?.content) {
      try {
        return { parsedProto: parseProtoContent(saved.content), descriptorSet: "", content: saved.content };
      } catch {}
    }

    if (reflectionResult()?.parsedProto) {
      return {
        parsedProto: reflectionResult()!.parsedProto,
        descriptorSet: reflectionResult()!.descriptorSet || props.step.grpcDescriptorSet || "",
        content: "",
      };
    }

    if (props.step.grpcParsedProto && props.step.grpcDescriptorSet) {
      return {
        parsedProto: props.step.grpcParsedProto as ParsedProto,
        descriptorSet: props.step.grpcDescriptorSet,
        content: "",
      };
    }

    if (saved?.content) {
      try {
        return { parsedProto: parseProtoContent(saved.content), descriptorSet: "", content: saved.content };
      } catch {}
    }

    if (props.step.protoContent) {
      try {
        return { parsedProto: parseProtoContent(props.step.protoContent), descriptorSet: "", content: props.step.protoContent };
      } catch {}
    }

    return { parsedProto: props.fallbackProto, descriptorSet: "", content: "" };
  });

  const discoveredServices = () => schema().parsedProto?.services || [];
  const totalDiscoveredMethods = () => discoveredServices().reduce((acc: number, s: any) => acc + (s.methods?.length || 0), 0);
  const hasReflectionData = () => discoveredServices().length > 0;

  const filteredServices = () => {
    const q = servicesFilter().toLowerCase().trim();
    if (!q) return discoveredServices();
    return discoveredServices().filter((s: any) =>
      s.fullName.toLowerCase().includes(q) ||
      (s.methods || []).some((m: any) => m.name.toLowerCase().includes(q))
    );
  };

  const methods = () => schema().parsedProto?.services.find((s: any) => s.fullName === props.step.serviceName)?.methods || [];

  const getStreamingBadge = (m: any) => {
    if (m.clientStreaming && m.serverStreaming) return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (m.clientStreaming) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    if (m.serverStreaming) return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  };

  const getStreamingLabel = (m: any) => {
    if (m.clientStreaming && m.serverStreaming) return "Bidi Stream";
    if (m.clientStreaming) return "Client Stream";
    if (m.serverStreaming) return "Server Stream";
    return "Unary";
  };

  const selectServiceAndMethod = (serviceName: string, methodName: string) => {
    props.update("serviceName", serviceName);
    props.update("methodName", methodName);
    const service = schema().parsedProto?.services.find((s: any) => s.fullName === serviceName);
    const method = service?.methods?.find((m: any) => m.name === methodName);
    if (method && schema().parsedProto) {
      const skeleton = generateSkeleton(schema().parsedProto!.messageTypes, method.requestType);
      props.update("requestBodyTemplate", JSON.stringify(skeleton, null, 2));
    }
  };

  return (
    <div class="space-y-4 min-w-0">
      {/* ⚡ Server Reflection Card */}
      <div class="rounded-xl border border-[#2a2a3a] bg-[#141420] p-4 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 class="text-xs font-bold text-white flex items-center gap-1.5">
              <span class="text-purple-400">⚡</span>
              <span>Server Reflection</span>
              <Show when={effectiveAddress()}>
                <span class="font-mono text-[10px] text-zinc-400 font-normal">({effectiveAddress()})</span>
              </Show>
            </h4>
            <p class="text-[11px] text-[#8b8b9e]">
              Query the gRPC server for published services and RPC methods using gRPC reflection.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchReflection}
            disabled={isReflecting() || !effectiveAddress()}
            class="shrink-0 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Show when={isReflecting()} fallback={<span>⚡</span>}>
              <svg class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </Show>
            <span>{isReflecting() ? "Querying Server..." : "Fetch Services & Methods"}</span>
          </button>
        </div>

        {/* Error Display */}
        <Show when={reflectionError()}>
          <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1">
            <div class="flex items-center gap-2 text-xs font-semibold text-red-400">
              <span>⚠️ Reflection Unavailable</span>
            </div>
            <p class="font-mono text-[11px] text-red-200/90 break-all">{reflectionError()}</p>
            <p class="text-[10px] text-zinc-400 pt-1">
              Tip: Ensure the server address, TLS trust, and credentials (Basic Auth or Bearer) are correct. If reflection is disabled on the server, upload a .proto file under Proto Files and link it below.
            </p>
          </div>
        </Show>

        {/* Success Display */}
        <Show when={hasReflectionData()}>
          <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
            <div class="flex items-center justify-between text-xs font-semibold text-emerald-400">
              <span class="flex items-center gap-1.5">
                <span>✓</span>
                <span>Discovered {discoveredServices().length} Service(s) and {totalDiscoveredMethods()} Method(s)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails())}
                class="text-[11px] text-purple-300 hover:text-purple-200 underline font-medium"
              >
                {showDetails() ? "Hide Inspection" : "Inspect Services"}
              </button>
            </div>

            {/* Expanded Inspection View */}
            <Show when={showDetails()}>
              <div class="mt-2 pt-2 border-t border-emerald-500/20 space-y-3">
                <input
                  type="text"
                  placeholder="Filter services and methods..."
                  class="w-full bg-[#151520] border border-[#2a2a3a] rounded-lg px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                  value={servicesFilter()}
                  onInput={(e) => setServicesFilter(e.currentTarget.value)}
                />
                <div class="max-h-48 overflow-y-auto space-y-2 pr-1">
                  <For each={filteredServices()}>
                    {(srv: any) => (
                      <div class="bg-[#12121c] p-2 rounded-lg border border-[#2a2a3a]/60 space-y-1">
                        <div class="text-[11px] font-bold text-white font-mono flex items-center justify-between">
                          <span>{srv.fullName}</span>
                          <span class="text-[9px] text-zinc-400 font-sans font-normal">{srv.methods?.length || 0} RPCs</span>
                        </div>
                        <div class="space-y-1 pl-2 border-l border-purple-500/30 mt-1">
                          <For each={srv.methods || []}>
                            {(m: any) => (
                              <div class="flex items-center justify-between gap-2 text-[10px]">
                                <div class="flex items-center gap-1.5 truncate">
                                  <span class="font-mono text-zinc-200 font-semibold">{m.name}</span>
                                  <span class="text-zinc-500 font-mono text-[9px]">({m.requestType} → {m.responseType})</span>
                                </div>
                                <div class="flex items-center gap-1.5 shrink-0">
                                  <span class={`text-[8px] font-bold px-1 py-0.5 rounded border ${getStreamingBadge(m)}`}>
                                    {getStreamingLabel(m)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => selectServiceAndMethod(srv.fullName, m.name)}
                                    class="px-1.5 py-0.5 bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white rounded text-[9px] font-medium transition-colors"
                                  >
                                    Select
                                  </button>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Service & Method Selectors */}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="min-w-0">
          <label for={`grpc-service-${props.step.id}`} class="mb-1 block text-xs font-semibold text-[#8b8b9e]">Service</label>
          <select
            id={`grpc-service-${props.step.id}`}
            class="w-full min-w-0 truncate rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            value={props.step.serviceName || ""}
            onChange={(e) => {
              const value = e.currentTarget.value;
              if (value.startsWith("PROTO:")) {
                props.update("grpcProtoId", value.slice(6));
                props.update("serviceName", "");
              } else {
                props.update("serviceName", value);
              }
              props.update("methodName", "");
            }}
          >
            <option value="">Select a service...</option>
            <For each={schema().parsedProto?.services || []}>
              {(service: any) => (
                <option value={service.fullName} selected={props.step.serviceName === service.fullName}>
                  {service.fullName}
                </option>
              )}
            </For>
            <Show when={props.savedProtos.length > 0}>
              <optgroup label="Load a Saved Proto">
                <For each={props.savedProtos}>
                  {(proto: any) => (
                    <option value={`PROTO:${proto.id}`}>Load: {proto.name}</option>
                  )}
                </For>
              </optgroup>
            </Show>
          </select>
        </div>

        <div class="min-w-0">
          <label for={`grpc-method-${props.step.id}`} class="mb-1 block text-xs font-semibold text-[#8b8b9e]">Method</label>
          <select
            id={`grpc-method-${props.step.id}`}
            class="w-full min-w-0 truncate rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
            disabled={!props.step.serviceName}
            value={props.step.methodName || ""}
            onChange={(e) => {
              const name = e.currentTarget.value;
              props.update("methodName", name);
              const method = methods().find((m: any) => m.name === name);
              if (method && schema().parsedProto) {
                const skeleton = generateSkeleton(schema().parsedProto!.messageTypes, method.requestType);
                props.update("requestBodyTemplate", JSON.stringify(skeleton, null, 2));
              }
            }}
          >
            <option value="">Select a method...</option>
            <For each={methods()}>
              {(method: any) => (
                <option value={method.name} selected={props.step.methodName === method.name}>
                  {method.name} ({method.requestType} → {method.responseType}) [{getStreamingLabel(method)}]
                </option>
              )}
            </For>
          </select>
        </div>
      </div>
    </div>
  );
}
