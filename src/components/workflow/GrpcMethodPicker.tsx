import { createEffect, createMemo, createResource, For, Show, untrack } from "solid-js";
import { generateSkeleton, parseProtoContent, type ParsedProto } from "~/lib/protoParser";
import type { ReflectedSchema } from "~/lib/grpcReflection";

export type ReflectionResult = { success: boolean; data?: ReflectedSchema; error?: string };

export default function GrpcMethodPicker(props: {
  step: any;
  connections: any[];
  savedProtos: any[];
  fallbackProto: ParsedProto | null;
  update: (key: string, value: any) => void;
  discover: (id: string, refresh?: boolean) => Promise<ReflectionResult>;
}) {
  const connection = createMemo(() => props.connections.find(c => c.id === props.step.connectionId && c.type === "grpc"));
  const connectionId = (): string => connection()?.id || "";
  const persisted = untrack(() => ({
    id: props.step.grpcSchemaConnectionId,
    descriptorSet: props.step.grpcDescriptorSet,
    parsedProto: props.step.grpcParsedProto as ParsedProto | undefined,
    content: props.step.protoContent,
  }));
  const manualProto = () => props.step.grpcProtoId || "";
  const [discovery, { refetch }] = createResource<ReflectionResult & { id: string }, string, boolean>(
    () => connectionId() || false,
    async (id, info) => ({ id, ...await props.discover(id, info.refetching === true) }),
  );
  const currentDiscovery = () => discovery()?.id === connectionId() ? discovery() : undefined;
  const schema = createMemo(() => {
    const protoId = manualProto() || connection()?.protoId;
    const saved = props.savedProtos.find(p => p.id === protoId);
    if (!manualProto() && currentDiscovery()?.data) {
      return { ...currentDiscovery()!.data!, content: "" };
    }
    if (!manualProto() && persisted.id === connectionId() && persisted.descriptorSet && persisted.parsedProto) {
      return { descriptorSet: persisted.descriptorSet, parsedProto: persisted.parsedProto, content: "" };
    }
    if (saved?.content) {
      try {
        return { parsedProto: parseProtoContent(saved.content), descriptorSet: "", content: saved.content };
      } catch { /* The status below leaves manual proto selection available. */ }
    }
    if (persisted.content && !connectionId()) {
      try { return { parsedProto: parseProtoContent(persisted.content), descriptorSet: "", content: persisted.content }; } catch {}
    }
    return { parsedProto: props.fallbackProto, descriptorSet: "", content: "" };
  });
  createEffect(() => {
    const selected = schema();
    const id = connectionId();
    // Do not replace persisted definitions while discovery is still in flight.
    if (id && discovery.loading && !manualProto()) return;
    untrack(() => {
      props.update("grpcDescriptorSet", selected.descriptorSet || undefined);
      props.update("grpcSchemaConnectionId", selected.descriptorSet ? id : undefined);
      props.update("grpcParsedProto", selected.descriptorSet ? selected.parsedProto : undefined);
      props.update("protoContent", selected.content || undefined);
    });
  });
  const methods = () => schema().parsedProto?.services.find(s => s.fullName === props.step.serviceName)?.methods || [];

  return (
    <div class="space-y-2 min-w-0">
      <Show when={connectionId()}>
        <div class="flex items-start justify-between gap-3 text-xs" aria-live="polite">
          <span class={currentDiscovery()?.success ? "text-emerald-400" : "text-[#8b8b9e]"}>
            {discovery.loading ? "Loading services and methods from server reflection…"
              : currentDiscovery()?.success ? `Reflection loaded ${currentDiscovery()?.data?.parsedProto.services.length || 0} services.`
              : `Reflection unavailable: ${currentDiscovery()?.error || "No services returned"}. ${schema().parsedProto?.services.length ? "Using existing definitions." : "Select a saved proto below."}`}
          </span>
          <button type="button" class="shrink-0 text-blue-400 hover:text-blue-300 disabled:opacity-50"
            disabled={discovery.loading}
            onClick={() => { props.update("grpcProtoId", undefined); refetch(true); }}>
            Refresh
          </button>
        </div>
      </Show>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="min-w-0">
          <label for={`grpc-service-${props.step.id}`} class="mb-1 block text-xs font-semibold text-[#8b8b9e]">Service</label>
          <select id={`grpc-service-${props.step.id}`} class="w-full min-w-0 truncate rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            value={props.step.serviceName || ""}
            onChange={e => {
              const value = e.currentTarget.value;
              if (value.startsWith("PROTO:")) {
                props.update("grpcProtoId", value.slice(6));
                props.update("serviceName", "");
              } else props.update("serviceName", value);
              props.update("methodName", "");
            }}>
            <option value="">Select a service...</option>
            <For each={schema().parsedProto?.services || []}>
              {service => <option value={service.fullName} selected={props.step.serviceName === service.fullName}>{service.fullName}</option>}
            </For>
            <Show when={props.savedProtos.length}>
              <optgroup label="Load a Saved Proto">
                <For each={props.savedProtos}>{proto => <option value={`PROTO:${proto.id}`}>Load: {proto.name}</option>}</For>
              </optgroup>
            </Show>
          </select>
        </div>
        <div class="min-w-0">
          <label for={`grpc-method-${props.step.id}`} class="mb-1 block text-xs font-semibold text-[#8b8b9e]">Method</label>
          <select id={`grpc-method-${props.step.id}`} class="w-full min-w-0 truncate rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
            disabled={!props.step.serviceName} value={props.step.methodName || ""}
            onChange={e => {
              const name = e.currentTarget.value;
              props.update("methodName", name);
              const method = methods().find(m => m.name === name);
              if (method && schema().parsedProto) {
                props.update("requestBodyTemplate", JSON.stringify(generateSkeleton(schema().parsedProto!.messageTypes, method.requestType), null, 2));
              }
            }}>
            <option value="">Select a method...</option>
            <For each={methods()}>{method => <option value={method.name} selected={props.step.methodName === method.name}>{method.name} ({method.requestType} → {method.responseType})</option>}</For>
          </select>
        </div>
      </div>
    </div>
  );
}
