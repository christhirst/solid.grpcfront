import { createSignal, createEffect, Show, For, onMount, createResource } from "solid-js";
import { isServer } from "solid-js/web";
import { parseProtoContent, generateSkeleton, type ParsedProto, type ProtoMethod } from "~/lib/protoParser";
import { Line } from "solid-chartjs";
import { Chart, registerables } from "chart.js";
import get from "lodash.get";
import {
  createSolidTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/solid-table";

// Register Chart.js components
Chart.register(...registerables);

interface HistoryEntry {
  id: number;
  timestamp: Date;
  service: string;
  method: string;
  address: string;
  requestBody: string;
  response: any;
  latencyMs: number;
  success: boolean;
}

const SAMPLE_PROTO = `syntax = "proto3";

package example;

service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply);
  rpc SayGoodbye (GoodbyeRequest) returns (GoodbyeReply);
}

message HelloRequest {
  string name = 1;
  int32 age = 2;
}

message HelloReply {
  string message = 1;
  bool success = 2;
}

message GoodbyeRequest {
  string name = 1;
  string reason = 2;
}

message GoodbyeReply {
  string farewell = 1;
}`;

export default function GrpcClient() {
  // Proto state
  const [protoContent, setProtoContent] = createSignal("");
  const [parsedProto, setParsedProto] = createSignal<ParsedProto | null>(null);
  const [parseError, setParseError] = createSignal<string | null>(null);

  // Connection state
  const [serverAddress, setServerAddress] = createSignal("localhost:50051");
  const [useTls, setUseTls] = createSignal(false);

  // Selection state
  const [selectedService, setSelectedService] = createSignal("");
  const [selectedMethod, setSelectedMethod] = createSignal("");
  const [headers, setHeaders] = createSignal<{ key: string; value: string }[]>([]);

  // Request/Response state
  const [requestBody, setRequestBody] = createSignal("{}");
  const [response, setResponse] = createSignal<any>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [requestError, setRequestError] = createSignal<string | null>(null);

  // History
  const [history, setHistory] = createSignal<HistoryEntry[]>([]);
  const [historyCounter, setHistoryCounter] = createSignal(0);

  // Drag state
  const [isDragging, setIsDragging] = createSignal(false);

  // Active tab
  const [activeTab, setActiveTab] = createSignal<"response" | "history" | "chart" | "table">("response");

  // Chart state
  const [chartDataPath, setChartDataPath] = createSignal("");
  const [chartXKey, setChartXKey] = createSignal("");
  const [chartYKey, setChartYKey] = createSignal("");

  // Table state
  const [tableDataPath, setTableDataPath] = createSignal("");
  // Table header mapping: each entry defines column header and JSON key/path
  const [tableHeaders, setTableHeaders] = createSignal<{ header: string; key: string }[]>([]);

  const parsedTableData = () => {
    if (!response() || (!response().data && !response().response)) return null;
    let dataArray = response().data || response().response || response();
    
    if (tableDataPath()) {
      dataArray = get(dataArray, tableDataPath());
    }

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return null;
    }

    return dataArray;
  };

  const tableColumns = () => {
    const data = parsedTableData();
    if (!data || !data[0]) return [];
    
    const firstObj = data[0];
    if (typeof firstObj !== "object" || firstObj === null) {
      return [
        {
          id: "value",
          header: "Value",
          accessorFn: (row: any) => row,
        },
      ];
    }
     // If user defined custom headers, use them; otherwise fallback to object keys
     const custom = tableHeaders();
     if (custom.length > 0) {
       return custom.map((col) => ({
         accessorKey: col.key,
         header: col.header,
         cell: (info: any) => {
           const val = get(info.row.original, col.key);
           if (typeof val === "object" && val !== null) {
             return JSON.stringify(val);
           }
           return String(val ?? "");
         },
       }));
     }
     return Object.keys(firstObj).map((key) => ({
       accessorKey: key,
       header: key,
       cell: (info: any) => {
         const val = info.getValue();
         if (typeof val === "object" && val !== null) {
           return JSON.stringify(val);
         }
         return String(val ?? "");
       },
     }));
  };

  const table = createSolidTable({
    get data() {
      return parsedTableData() || [];
    },
    get columns() {
      return tableColumns();
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const parsedChartData = () => {
    if (!response() || !response().data) return null;
    let dataArray = response().data;
    
    if (chartDataPath()) {
      dataArray = get(dataArray, chartDataPath());
    }

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return null;
    }

    const labels = [];
    const points = [];

    for (let i = 0; i < dataArray.length; i++) {
      const item = dataArray[i];
      if (item && typeof item === "object") {
        labels.push(chartXKey() ? String(get(item, chartXKey()) || i) : i);
        const yVal = chartYKey() ? get(item, chartYKey()) : i;
        points.push(Number(yVal) || 0);
      } else {
        labels.push(i);
        points.push(Number(item) || 0);
      }
    }

    return {
      labels,
      datasets: [
        {
          label: chartYKey() || "Value",
          data: points,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderWidth: 2,
          pointBackgroundColor: "#10b981",
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.1,
          fill: true,
        }
      ]
    };
  };

  // Parse proto whenever content changes
  createEffect(() => {
    const content = protoContent();
    if (!content.trim()) {
      setParsedProto(null);
      setParseError(null);
      setSelectedService("");
      setSelectedMethod("");
      return;
    }

    try {
      const parsed = parseProtoContent(content);
      setParsedProto(parsed);
      setParseError(null);

      // Auto-select first service/method
      if (parsed.services.length > 0) {
        setSelectedService(parsed.services[0].fullName);
        if (parsed.services[0].methods.length > 0) {
          setSelectedMethod(parsed.services[0].methods[0].name);
        }
      }
    } catch (err: any) {
      setParsedProto(null);
      setParseError(err.message || "Failed to parse proto file");
    }
  });

  // Generate skeleton when method changes
  createEffect(() => {
    const proto = parsedProto();
    const serviceName = selectedService();
    const methodName = selectedMethod();

    if (!proto || !serviceName || !methodName) return;

    const service = proto.services.find((s) => s.fullName === serviceName);
    if (!service) return;

    const method = service.methods.find((m) => m.name === methodName);
    if (!method) return;

    const skeleton = generateSkeleton(proto.messageTypes, method.requestType);
    setRequestBody(JSON.stringify(skeleton, null, 2));
  });

  // Fetch saved protos
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


  // Get current method info
  const currentMethod = (): ProtoMethod | null => {
    const proto = parsedProto();
    const serviceName = selectedService();
    const methodName = selectedMethod();
    if (!proto || !serviceName || !methodName) return null;

    const service = proto.services.find((s) => s.fullName === serviceName);
    if (!service) return null;

    return service.methods.find((m) => m.name === methodName) || null;
  };

  // File upload handler
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setProtoContent(content);
    };
    reader.readAsText(file);
  };

  // Drag handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files[0];
    if (file && (file.name.endsWith(".proto") || file.type === "text/plain")) {
      handleFileUpload(file);
    }
  };

  const loadSample = () => {
    setProtoContent(SAMPLE_PROTO);
  };

  // Send gRPC request
  const sendRequest = async () => {
    const proto = parsedProto();
    const method = currentMethod();
    if (!proto || !method) return;

    setIsLoading(true);
    setRequestError(null);
    setResponse(null);
    setActiveTab("response");

    let parsedBody: Record<string, any>;
    try {
      parsedBody = JSON.parse(requestBody());
    } catch {
      setRequestError("Invalid JSON in request body");
      setIsLoading(false);
      return;
    }

    const startTime = Date.now();

    try {
      const res = await fetch("/api/grpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protoContent: protoContent(),
          serverAddress: serverAddress(),
          serviceName: selectedService(),
          methodName: selectedMethod(),
          requestBody: parsedBody,
          useTls: useTls(),
          metadata: headers().reduce((acc, h) => {
            if (h.key.trim()) acc[h.key.trim()] = h.value;
            return acc;
          }, {} as Record<string, string>),
        }),
      });

      const data = await res.json();
      const latency = data.latencyMs || Date.now() - startTime;

      setResponse(data);

      // Add to history
      const id = historyCounter() + 1;
      setHistoryCounter(id);
      setHistory((prev) => [
        {
          id,
          timestamp: new Date(),
          service: selectedService(),
          method: selectedMethod(),
          address: serverAddress(),
          requestBody: requestBody(),
          response: data,
          latencyMs: latency,
          success: data.success ?? false,
        },
        ...prev,
      ]);
    } catch (err: any) {
      setRequestError(err.message || "Network error");
    } finally {
      setIsLoading(false);
    }
  };

  // Replay from history
  const replayHistoryEntry = (entry: HistoryEntry) => {
    setServerAddress(entry.address);
    setRequestBody(entry.requestBody);
    setResponse(entry.response);
    setActiveTab("response");
  };

  return (
    <main class="relative min-h-screen">
      <div class="mesh-gradient" />
      <div class="grain-overlay" />

      <div class="relative z-10 mx-auto max-w-7xl px-6 py-8">
        {/* Page Header */}
        <div class="mb-8 fade-in-up delay-1">
          <div class="flex items-center gap-3 mb-2">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-500/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold tracking-tight text-white">gRPC Client</h1>
          </div>
          <p class="text-sm text-[#8b8b9e]">Upload a .proto file, pick a method, and fire requests at any gRPC server.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 fade-in-up delay-2">
          {/* Left Column: Proto + Config */}
          <div class="lg:col-span-5 space-y-4">
            {/* Proto Upload Card */}
            <div class="card p-4">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <h2 class="text-sm font-semibold text-white">Proto Definition</h2>
                </div>
                <div class="flex items-center gap-2">
                  <label class="cursor-pointer">
                    <input
                      type="file"
                      accept=".proto"
                      class="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    <span class="inline-flex items-center gap-1.5 rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-1.5 text-xs font-medium text-[#8b8b9e] transition-colors hover:border-[#2a2a3e] hover:text-white">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Upload
                    </span>
                  </label>
                  <button
                    onClick={loadSample}
                    class="inline-flex items-center gap-1.5 rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-1.5 text-xs font-medium text-[#8b8b9e] transition-colors hover:border-[#2a2a3e] hover:text-white"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 3v12" />
                      <circle cx="12" cy="12" r="1" />
                    </svg>
                    Sample
                  </button>
                </div>
              </div>

              {/* Drop zone / Editor */}
              <div
                class={`relative rounded-xl border-2 border-dashed transition-colors ${
                  isDragging()
                    ? "border-emerald-500 bg-emerald-500/5"
                    : "border-[#1e1e2e] hover:border-[#2a2a3e]"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Show
                  when={protoContent()}
                  fallback={
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5a5a6e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <p class="text-sm text-[#5a5a6e]">Drag & drop a .proto file here</p>
                      <p class="text-xs text-[#3a3a4e] mt-1">or use the buttons above</p>
                    </div>
                  }
                >
                  <textarea
                    value={protoContent()}
                    onInput={(e) => setProtoContent(e.currentTarget.value)}
                    class="w-full min-h-[250px] max-h-[400px] bg-transparent text-sm text-[#c8c8d8] font-mono p-4 resize-y focus:outline-none"
                    spellcheck={false}
                    placeholder="Paste your .proto content here..."
                  />
                </Show>
              </div>

              {/* Parse status */}
              <Show when={parseError()}>
                <div class="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <p class="text-xs text-red-400">{parseError()}</p>
                </div>
              </Show>

              <Show when={parsedProto()}>
                <div class="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <p class="text-xs text-emerald-400">
                    Parsed: {parsedProto()!.services.length} service(s), {" "}
                    {parsedProto()!.services.reduce((a, s) => a + s.methods.length, 0)} method(s), {" "}
                    {Object.keys(parsedProto()!.messageTypes).length / 2} message type(s)
                  </p>
                </div>
              </Show>
            </div>

            {/* Connection Config */}
            <div class="card p-4">
              <div class="flex items-center gap-2 mb-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                <h2 class="text-sm font-semibold text-white">Connection</h2>
              </div>

              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-medium text-[#5a5a6e] mb-1.5">Server Address</label>
                  <input
                    type="text"
                    value={serverAddress()}
                    onInput={(e) => setServerAddress(e.currentTarget.value)}
                    placeholder="localhost:50051"
                    class="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-2 text-sm text-white placeholder-[#3a3a4e] focus:outline-none focus:border-[#3b82f6] transition-colors"
                  />
                </div>

                <div class="flex items-center justify-between">
                  <label class="text-xs font-medium text-[#5a5a6e]">Use TLS</label>
                  <button
                    onClick={() => setUseTls(!useTls())}
                    class={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      useTls() ? "bg-emerald-500" : "bg-[#2a2a3e]"
                    }`}
                  >
                    <span
                      class={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                        useTls() ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Headers Card */}
            <div class="card p-4">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 7h-9" />
                    <path d="M14 17H5" />
                    <circle cx="17" cy="17" r="3" />
                    <circle cx="7" cy="7" r="3" />
                  </svg>
                  <h2 class="text-sm font-semibold text-white">Metadata Headers</h2>
                </div>
                <button
                  onClick={() => setHeaders([...headers(), { key: "", value: "" }])}
                  class="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  + Add Header
                </button>
              </div>

              <div class="space-y-2">
                <For each={headers()}>
                  {(header, index) => (
                    <div class="flex gap-2">
                      <input
                        type="text"
                        placeholder="Key"
                        value={header.key}
                        onInput={(e) => {
                          const newHeaders = [...headers()];
                          newHeaders[index()] = { ...newHeaders[index()], key: e.currentTarget.value };
                          setHeaders(newHeaders);
                        }}
                        class="flex-1 rounded-lg border border-[#1e1e2e] bg-[#12121a] px-2 py-1.5 text-xs text-white placeholder-[#3a3a4e] focus:outline-none focus:border-[#3b82f6]"
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={header.value}
                        onInput={(e) => {
                          const newHeaders = [...headers()];
                          newHeaders[index()] = { ...newHeaders[index()], value: e.currentTarget.value };
                          setHeaders(newHeaders);
                        }}
                        class="flex-1 rounded-lg border border-[#1e1e2e] bg-[#12121a] px-2 py-1.5 text-xs text-white placeholder-[#3a3a4e] focus:outline-none focus:border-[#3b82f6]"
                      />
                      <button
                        onClick={() => {
                          const newHeaders = [...headers()];
                          newHeaders.splice(index(), 1);
                          setHeaders(newHeaders);
                        }}
                        class="text-[#5a5a6e] hover:text-red-400 transition-colors px-1"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                      </button>
                    </div>
                  )}
                </For>
                <Show when={headers().length === 0}>
                  <p class="text-[10px] text-[#3a3a4e] text-center py-2 italic">No custom headers defined</p>
                </Show>
              </div>
            </div>

            {/* Service/Method Selection */}
            <Show when={parsedProto()}>
              <div class="card p-4">
                <div class="flex items-center gap-2 mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <h2 class="text-sm font-semibold text-white">Service & Method</h2>
                </div>

                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-medium text-[#5a5a6e] mb-1.5">Service</label>
                    <select
                      value={selectedService()}
                      onChange={(e) => {
                        setSelectedService(e.currentTarget.value);
                        const service = parsedProto()?.services.find((s) => s.fullName === e.currentTarget.value);
                        if (service && service.methods.length > 0) {
                          setSelectedMethod(service.methods[0].name);
                        }
                      }}
                      class="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors appearance-none cursor-pointer"
                    >
                      <For each={parsedProto()?.services || []}>
                        {(service) => (
                          <option value={service.fullName}>{service.fullName}</option>
                        )}
                      </For>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-[#5a5a6e] mb-1.5">Method</label>
                    <select
                      value={selectedMethod()}
                      onChange={(e) => setSelectedMethod(e.currentTarget.value)}
                      class="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors appearance-none cursor-pointer"
                    >
                      <For
                        each={
                          parsedProto()?.services.find((s) => s.fullName === selectedService())?.methods || []
                        }
                      >
                        {(method) => (
                          <option value={method.name}>
                            {method.name}
                          </option>
                        )}
                      </For>
                    </select>
                  </div>

                  {/* Method signature */}
                  <Show when={currentMethod()}>
                    <div class="rounded-lg bg-[#12121a] border border-[#1e1e2e] p-3">
                      <p class="text-xs font-mono text-[#8b8b9e]">
                        <span class="text-violet-400">rpc</span>{" "}
                        <span class="text-white">{currentMethod()!.name}</span>
                        <span class="text-[#5a5a6e]">(</span>
                        <span class="text-emerald-400">{currentMethod()!.requestType}</span>
                        <span class="text-[#5a5a6e]">)</span>
                        <span class="text-[#5a5a6e]"> → </span>
                        <span class="text-blue-400">{currentMethod()!.responseType}</span>
                      </p>
                      <Show when={currentMethod()!.requestStream || currentMethod()!.responseStream}>
                        <div class="mt-1.5 flex gap-2">
                          <Show when={currentMethod()!.requestStream}>
                            <span class="badge bg-amber-500/10 text-amber-400">client stream</span>
                          </Show>
                          <Show when={currentMethod()!.responseStream}>
                            <span class="badge bg-amber-500/10 text-amber-400">server stream</span>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>
          </div>

          {/* Right Column: Request + Response */}
          <div class="lg:col-span-7 space-y-4">
            {/* Request Editor */}
            <div class="card p-4">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <h2 class="text-sm font-semibold text-white">Request Body</h2>
                  <Show when={currentMethod()}>
                    <span class="text-xs text-[#5a5a6e] font-mono">{currentMethod()!.requestType}</span>
                  </Show>
                </div>

                <button
                  onClick={sendRequest}
                  disabled={isLoading() || !parsedProto() || !selectedMethod()}
                  class={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    isLoading() || !parsedProto() || !selectedMethod()
                      ? "bg-[#1e1e2e] text-[#5a5a6e] cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-px"
                  }`}
                >
                  <Show
                    when={!isLoading()}
                    fallback={
                      <svg width="14" height="14" viewBox="0 0 24 24" class="animate-spin">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10" stroke-linecap="round" />
                      </svg>
                    }
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </Show>
                  {isLoading() ? "Sending..." : "Send Request"}
                </button>
              </div>

              <textarea
                value={requestBody()}
                onInput={(e) => setRequestBody(e.currentTarget.value)}
                class="w-full min-h-[200px] rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4 text-sm text-[#c8c8d8] font-mono resize-y focus:outline-none focus:border-[#3b82f6] transition-colors"
                spellcheck={false}
                placeholder='{ "key": "value" }'
              />
            </div>

            {/* Tabs: Response / History */}
            <div class="card overflow-hidden">
              <div class="flex border-b border-[#1e1e2e]">
                <button
                  onClick={() => setActiveTab("response")}
                  class={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab() === "response"
                      ? "text-white border-b-2 border-emerald-500 bg-emerald-500/5"
                      : "text-[#5a5a6e] hover:text-[#8b8b9e]"
                  }`}
                >
                  Response
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  class={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative border-b-2 ${
                    activeTab() === "history"
                      ? "text-white border-violet-500 bg-violet-500/5"
                      : "text-[#5a5a6e] hover:text-[#8b8b9e] border-transparent"
                  }`}
                >
                  History
                  <Show when={history().length > 0}>
                    <span class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2a2a3e] px-1.5 text-[10px] font-bold text-[#8b8b9e]">
                      {history().length}
                    </span>
                  </Show>
                </button>
                <button
                  onClick={() => setActiveTab("chart")}
                  class={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab() === "chart"
                      ? "text-white border-blue-500 bg-blue-500/5"
                      : "text-[#5a5a6e] hover:text-[#8b8b9e] border-transparent"
                  }`}
                >
                  Chart
                </button>
                <button
                  onClick={() => setActiveTab("table")}
                  class={`flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab() === "table"
                      ? "text-white border-orange-500 bg-orange-500/5"
                      : "text-[#5a5b6e] hover:text-[#8b8b9e] border-transparent"
                  }`}
                >
                  Table
                </button>
              </div>

              {/* Response Tab */}
              <Show when={activeTab() === "response"}>
                <div class="p-4">
                  <Show when={requestError()}>
                    <div class="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 shrink-0">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <div>
                        <p class="text-sm font-medium text-red-400">Request failed</p>
                        <p class="text-xs text-red-400/70 mt-1">{requestError()}</p>
                      </div>
                    </div>
                  </Show>

                  <Show when={response()}>
                    <div>
                      {/* Status bar */}
                      <div class="flex items-center gap-3 mb-3">
                        <span
                          class={`badge ${
                            response()?.success
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          <span class={`h-1.5 w-1.5 rounded-full ${response()?.success ? "bg-emerald-400" : "bg-red-400"}`} />
                          {response()?.success ? response()?.status || "OK" : `Error ${response()?.grpcCode ?? ""}`}
                        </span>
                        <Show when={response()?.latencyMs}>
                          <span class="text-xs text-[#5a5a6e]">{response()!.latencyMs}ms</span>
                        </Show>
                      </div>

                      {/* Response body */}
                      <pre class="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4 text-sm font-mono text-[#c8c8d8] overflow-auto max-h-[400px]">
                        {JSON.stringify(response()?.data || response()?.error || response()?.grpcStatus || response(), null, 2)}
                      </pre>
                    </div>
                  </Show>

                  <Show when={!response() && !requestError() && !isLoading()}>
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a4e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      <p class="text-sm text-[#5a5a6e]">Send a request to see the response</p>
                    </div>
                  </Show>

                  <Show when={isLoading()}>
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" class="animate-spin mb-3">
                        <circle cx="12" cy="12" r="10" stroke="#3a3a4e" stroke-width="3" fill="none" />
                        <circle cx="12" cy="12" r="10" stroke="#10b981" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10" stroke-linecap="round" />
                      </svg>
                      <p class="text-sm text-[#5a5a6e]">Waiting for response...</p>
                    </div>
                  </Show>
                </div>
              </Show>

              {/* History Tab */}
              <Show when={activeTab() === "history"}>
                <div class="max-h-[500px] overflow-auto">
                  <Show
                    when={history().length > 0}
                    fallback={
                      <div class="flex flex-col items-center justify-center py-12 text-center">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a4e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <p class="text-sm text-[#5a5a6e]">No requests yet</p>
                      </div>
                    }
                  >
                    <For each={history()}>
                      {(entry) => (
                        <button
                          onClick={() => replayHistoryEntry(entry)}
                          class="w-full flex items-center justify-between px-4 py-3 border-b border-[#1e1e2e] text-left transition-colors hover:bg-[#1c1c28] group"
                        >
                          <div class="flex items-center gap-3 min-w-0">
                            <span
                              class={`h-2 w-2 rounded-full shrink-0 ${
                                entry.success ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            />
                            <div class="min-w-0">
                              <p class="text-sm font-medium text-white truncate">
                                {entry.method}
                              </p>
                              <p class="text-xs text-[#5a5a6e] truncate">
                                {entry.service} · {entry.address}
                              </p>
                            </div>
                          </div>
                          <div class="text-right shrink-0 ml-3">
                            <p class="text-xs text-[#5a5a6e]">{entry.latencyMs}ms</p>
                            <p class="text-[10px] text-[#3a3a4e]">
                              {entry.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </button>
                      )}
                    </For>
                  </Show>
                </div>
              </Show>

              {/* Chart Tab */}
              <Show when={activeTab() === "chart"}>
                <div class="p-4 space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-[#12121a] p-4 rounded-xl border border-[#1e1e2e]">
                    <div>
                      <label class="block text-[10px] font-medium text-[#8b8b9e] uppercase tracking-wider mb-1.5">Array Data Path</label>
                      <input
                        type="text"
                        value={chartDataPath()}
                        onInput={(e) => setChartDataPath(e.currentTarget.value)}
                        placeholder="e.g. data.bars (leave empty if root)"
                        class="w-full rounded-lg border border-[#2a2a3e] bg-[#1a1a24] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] font-medium text-[#8b8b9e] uppercase tracking-wider mb-1.5">X-Axis Property</label>
                      <input
                        type="text"
                        value={chartXKey()}
                        onInput={(e) => setChartXKey(e.currentTarget.value)}
                        placeholder="e.g. timestamp"
                        class="w-full rounded-lg border border-[#2a2a3e] bg-[#1a1a24] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors"
                      />
                    </div>
                    <div>
                      <label class="block text-[10px] font-medium text-[#8b8b9e] uppercase tracking-wider mb-1.5">Y-Axis Property</label>
                      <input
                        type="text"
                        value={chartYKey()}
                        onInput={(e) => setChartYKey(e.currentTarget.value)}
                        placeholder="e.g. close"
                        class="w-full rounded-lg border border-[#2a2a3e] bg-[#1a1a24] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors"
                      />
                    </div>
                  </div>

                  <Show
                    when={parsedChartData() !== null}
                    fallback={
                      <div class="flex flex-col items-center justify-center py-12 text-center rounded-xl bg-[#12121a] border border-[#1e1e2e] border-dashed">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a4e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <line x1="3" y1="9" x2="21" y2="9" />
                          <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                        <p class="text-sm text-[#5a5a6e]">No valid array data found at path</p>
                        <p class="text-xs text-[#3a3a4e] mt-1">Make a request and check your Array Data Path</p>
                      </div>
                    }
                  >
                    <div class="p-4 bg-[#12121a] rounded-xl border border-[#1e1e2e] h-[400px]">
                      {/* @ts-ignore */}
                      <Line
                        data={parsedChartData() as any}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { labels: { color: "#c8c8d8" } },
                            tooltip: { mode: "index", intersect: false }
                          },
                          scales: {
                            x: { grid: { color: "#2a2a3e" }, ticks: { color: "#8b8b9e" } },
                            y: { grid: { color: "#2a2a3e" }, ticks: { color: "#8b8b9e" } }
                          }
                        }}
                      />
                    </div>
                  </Show>
                </div>
              </Show>

              {/* Table Tab */}
              <Show when={activeTab() === "table"}>
                <div class="p-4 space-y-4">
                  <div class="bg-[#12121a] p-4 rounded-xl border border-[#1e1e2e]">
                    <label class="block text-[10px] font-medium text-[#8b8b9e] uppercase tracking-wider mb-1.5">Array Data Path</label>
                    <input
                      type="text"
                      value={tableDataPath()}
                      onInput={(e) => setTableDataPath(e.currentTarget.value)}
                      placeholder="e.g. data.items (leave empty if root)"
                      class="w-full rounded-lg border border-[#2a2a3e] bg-[#1a1a24] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors"
                    />
                  </div>

                    {/* Column Mapping UI */}
                    <div class="flex items-center gap-2 mt-2">
                      <span class="text-sm text-[#c8c8d8]">Columns:</span>
                      <For each={tableHeaders()}>
                        {(col, i) => (
                          <div class="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Header"
                              value={col.header}
                              onInput={(e) => {
                                const newHeaders = [...tableHeaders()];
                                newHeaders[i()] = { ...newHeaders[i()], header: e.currentTarget.value };
                                setTableHeaders(newHeaders);
                              }}
                              class="rounded-lg border border-[#1e1e2e] bg-[#12121a] px-2 py-1.5 text-xs text-white placeholder-[#3a3a4e] focus:outline-none focus:border-[#3b82f6]"
                            />
                            <input
                              type="text"
                              placeholder="JSON Key"
                              value={col.key}
                              onInput={(e) => {
                                const newHeaders = [...tableHeaders()];
                                newHeaders[i()] = { ...newHeaders[i()], key: e.currentTarget.value };
                                setTableHeaders(newHeaders);
                              }}
                              class="rounded-lg border border-[#1e1e2e] bg-[#12121a] px-2 py-1.5 text-xs text-white placeholder-[#3a3a4e] focus:outline-none focus:border-[#3b82f6]"
                            />
                            <button
                              onClick={() => {
                                const newHeaders = [...tableHeaders()];
                                newHeaders.splice(i(), 1);
                                setTableHeaders(newHeaders);
                              }}
                              class="text-[#5a5a6e] hover:text-red-400 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </For>
                      <button
                        onClick={() => setTableHeaders([...tableHeaders(), { header: "", key: "" }])}
                        class="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        + Add Column
                      </button>
                    </div>

                  <Show
                    when={parsedTableData() !== null}
                    fallback={
                      <div class="flex flex-col items-center justify-center py-12 text-center rounded-xl bg-[#12121a] border border-[#1e1e2e] border-dashed">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a4e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <line x1="3" y1="9" x2="21" y2="9" />
                          <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                        <p class="text-sm text-[#5a5a6e]">No valid array data found at path</p>
                        <p class="text-xs text-[#3a3a4e] mt-1">Make a request and check your Array Data Path</p>
                      </div>
                    }
                  >
                    <div class="bg-[#12121a] rounded-xl border border-[#1e1e2e] max-h-[500px] overflow-auto">
                      <table class="w-full text-left text-sm text-[#c8c8d8]">
                        <thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0 shadow-sm">
                          <For each={table.getHeaderGroups()}>
                            {(headerGroup) => (
                              <tr>
                                <For each={headerGroup.headers}>
                                  {(header) => (
                                    <th class="px-4 py-3 font-medium border-b border-[#2a2a3e] whitespace-nowrap">
                                      {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                          )}
                                    </th>
                                  )}
                                </For>
                              </tr>
                            )}
                          </For>
                        </thead>
                        <tbody class="divide-y divide-[#1e1e2e]">
                          <For each={table.getRowModel().rows}>
                            {(row) => (
                              <tr class="hover:bg-[#1a1a24]/50 transition-colors">
                                <For each={row.getVisibleCells()}>
                                  {(cell) => (
                                    <td class="px-4 py-3 border-b border-[#1e1e2e]/50 max-w-[200px] truncate" title={String(cell.getValue() ?? "")}>
                                      {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext()
                                      )}
                                    </td>
                                  )}
                                </For>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
