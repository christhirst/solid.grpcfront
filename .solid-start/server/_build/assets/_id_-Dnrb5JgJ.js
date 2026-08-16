import { ssr, ssrHydrationKey, escape, createComponent, ssrStyleProperty, isServer, ssrAttribute, ssrStyle } from "solid-js/web";
import { createSignal, createEffect, onMount, onCleanup, Show, createResource, createMemo, For } from "solid-js";
import { ClassicPreset } from "rete";
import "rete-area-plugin";
import "rete-connection-plugin";
import "solid-rete-plugin";
import "rete-auto-arrange-plugin";
import { a as checkWorkflowConfiguredInDashboards } from "./workflowVariableChecker-CcT-pYzg.js";
import { createStore, reconcile } from "solid-js/store";
import { p as parseProtoContent, g as generateSkeleton } from "./protoParser-C1XlV9an.js";
import { D as DefaultChart } from "./index-D4uTJpLk.js";
import { Chart, registerables } from "chart.js";
import * as ChartGeo from "chartjs-chart-geo";
import { u as useParams, a as useNavigate } from "../../entry-server.js";
import "protobufjs";
import "pathe";
import "radix3";
import "seroval";
import "seroval-plugins/web";
import "h3";
import "solid-js/web/storage";
import "cookie-es";
function getStepCategory(type, explicitCategory, sourceStepIds) {
  if (type === "table" || type === "chart" || type === "infographic") {
    return "target";
  }
  if (explicitCategory) {
    return explicitCategory;
  }
  switch (type) {
    case "transform":
      return "transform";
    default:
      if (sourceStepIds && sourceStepIds.length > 0) {
        return "transform";
      }
      return "source";
  }
}
var _tmpl$$1 = ["<div", ' class="absolute left-0 mt-2 w-72 rounded-2xl bg-[#181824] border border-[#2a2a3a] shadow-2xl z-50 overflow-hidden py-1 divide-y divide-[#2a2a3a]/50"><div class="p-1"><div class="px-3 py-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5"><span>📥 1. SOURCES</span><span class="text-[9px] text-[#5b5b6e] font-normal">(Start Flow • Output Only)</span></div><button class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-blue-300 rounded-lg flex items-center gap-2"><span>⚡</span> <span>gRPC Request</span></button><button class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-cyan-300 rounded-lg flex items-center gap-2"><span>🌐</span> <span>HTTP / REST API</span></button><button class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-amber-300 rounded-lg flex items-center gap-2"><span>🗄️</span> <span>Database / SurrealQL</span></button></div><div class="p-1"><div class="px-3 py-1.5 text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5"><span>🔀 2. TRANSFORMS & SERVICES</span><span class="text-[9px] text-[#5b5b6e] font-normal">(In ➔ Service / Logic ➔ Out)</span></div><button class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-purple-300 rounded-lg flex items-center gap-2"><span>🔀</span> <span>JSONata Transformer / Merger</span></button><button class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-blue-300 rounded-lg flex items-center gap-2"><span>⚡</span> <span>gRPC Service Call (Transform)</span></button><button class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-cyan-300 rounded-lg flex items-center gap-2"><span>🌐</span> <span>HTTP / REST Call (Transform)</span></button><button class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-amber-300 rounded-lg flex items-center gap-2"><span>🗄️</span> <span>Database Mutation / Query</span></button></div><div class="p-1"><div class="px-3 py-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5"><span>🎯 3. TARGETS</span><span class="text-[9px] text-[#5b5b6e] font-normal">(Terminal Sinks • Input Only)</span></div><button class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-emerald-300 rounded-lg flex items-center gap-2"><span>📊</span> <span>Data Table</span></button><button class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-pink-300 rounded-lg flex items-center gap-2"><span>📈</span> <span>Chart Visualizer</span></button><button class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-rose-300 rounded-lg flex items-center gap-2"><span>🦋</span> <span>AntV Infographic Diagram</span></button></div></div>'], _tmpl$2$1 = ["<div", ' class="h-4 w-px bg-[#2a2a3a]"></div>'], _tmpl$3$1 = ["<button", ' class="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium flex items-center gap-1.5 border border-red-500/30 transition-colors" title="Delete selected step"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg><span>Delete</span></button>'], _tmpl$4$1 = ["<div", ' class="', '"><div class="absolute top-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none"><div class="flex items-center gap-2 bg-[#12121a]/95 backdrop-blur-md border border-[#2a2a3a] rounded-xl p-1.5 shadow-xl pointer-events-auto"><div class="relative"><button class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span>Add Node</span></button><!--$-->', '<!--/--></div><div class="h-4 w-px bg-[#2a2a3a]"></div><button class="px-2.5 py-1.5 rounded-lg bg-[#1a1a24] hover:bg-[#252535] text-[#c8c8d8] text-xs font-medium flex items-center gap-1.5 border border-[#2a2a3a]/50 transition-colors" title="Automatically arrange Source ➔ Transform ➔ Target columns"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline></svg><span>Auto Layout</span></button><button class="px-2.5 py-1.5 rounded-lg bg-[#1a1a24] hover:bg-[#252535] text-[#c8c8d8] text-xs font-medium flex items-center gap-1.5 border border-[#2a2a3a]/50 transition-colors" title="Fit graph to screen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg><span>Fit View</span></button><!--$-->', '<!--/--></div><div class="flex items-center gap-2.5 bg-[#12121a]/95 backdrop-blur-md border border-[#2a2a3a] rounded-xl px-3 py-1.5 shadow-xl pointer-events-auto text-xs font-semibold"><span class="text-blue-400 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span><!--$-->', '<!--/--> Sources</span><span class="text-[#5b5b6e]">➔</span><span class="text-purple-400 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span><!--$-->', '<!--/--> Transforms</span><span class="text-[#5b5b6e]">➔</span><span class="text-emerald-400 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><!--$-->', '<!--/--> Targets</span></div></div><div class="w-full h-full cursor-grab active:cursor-grabbing select-none" style="', '"></div><div class="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none text-[11px] text-[#5b5b6e]"><div class="flex items-center gap-3 bg-[#0a0a0f]/90 backdrop-blur px-3 py-1.5 rounded-lg border border-[#2a2a3a]/50"><span class="text-blue-400 font-bold">📥 Source (Start)</span><span>➔</span><span class="text-purple-400 font-bold">🔀 Transform (Processing & Service Calls)</span><span>➔</span><span class="text-emerald-400 font-bold">🎯 Target (Terminal Sink)</span></div><div class="hidden sm:block bg-[#0a0a0f]/90 backdrop-blur px-3 py-1.5 rounded-lg border border-[#2a2a3a]/50 text-slate-400">Sources start flows • Transforms process and call remote services • Targets render outputs</div></div></div>'];
const dataSocket = new ClassicPreset.Socket("data");
class StepNode extends ClassicPreset.Node {
  width = 290;
  height = 200;
  stepId;
  stepType;
  category;
  step;
  inputKeys = [];
  constructor(step) {
    const cat = getStepCategory(step.type, step.category, step.sourceStepIds);
    const typeInfo = getStepDisplayInfo(step.type || "grpc", cat);
    const categoryTag = cat === "target" ? " (Target)" : cat === "transform" ? " (Transform)" : " (Source)";
    super(`${typeInfo.icon} ${step.id || "Step"}${categoryTag}`);
    this.stepId = step.id;
    this.stepType = step.type || "grpc";
    this.category = cat;
    this.step = {
      ...step,
      category: this.category
    };
    this.setupSocketsByCategory();
  }
  setupSocketsByCategory() {
    if (this.category === "source") {
      if (!this.outputs["data"]) {
        this.addOutput("data", new ClassicPreset.Output(dataSocket, "Data Output"));
      }
      return;
    }
    if (this.category === "transform") {
      const sources = this.step.sourceStepIds || [];
      const count = Math.max(sources.length, 1);
      for (let i = 1; i <= count; i++) {
        const key = `source_${i}`;
        const label = count > 1 ? `Input ${i}` : "Input";
        if (!this.inputs[key]) {
          this.addInput(key, new ClassicPreset.Input(dataSocket, label, true));
          this.inputKeys.push(key);
        }
      }
      if (!this.outputs["data"]) {
        const outLabel = this.stepType === "grpc" || this.stepType === "rest" || this.stepType === "database" ? "Service Response" : "Output";
        this.addOutput("data", new ClassicPreset.Output(dataSocket, outLabel));
      }
      return;
    }
    if (this.category === "target") {
      const sources = this.step.sourceStepIds || [];
      const count = Math.max(sources.length, 1);
      for (let i = 1; i <= count; i++) {
        const key = `source_${i}`;
        const label = count > 1 ? `Target Input ${i}` : "Target Input";
        if (!this.inputs[key]) {
          this.addInput(key, new ClassicPreset.Input(dataSocket, label, true));
          this.inputKeys.push(key);
        }
      }
      return;
    }
  }
  addExtraSourceSocket() {
    const newIdx = this.inputKeys.filter((k) => k.startsWith("source_")).length + 1;
    const newKey = `source_${newIdx}`;
    if (!this.inputs[newKey]) {
      const label = this.category === "target" ? `Target Input ${newIdx}` : `Input ${newIdx}`;
      this.addInput(newKey, new ClassicPreset.Input(dataSocket, label, true));
      this.inputKeys.push(newKey);
    }
    return newKey;
  }
}
function getStepDisplayInfo(type, category) {
  const cat = category || getStepCategory(type);
  switch (type) {
    case "table":
      return {
        category: "target",
        label: "Table Target",
        icon: "📊",
        color: "emerald",
        border: "border-emerald-500",
        text: "text-emerald-400",
        bg: "bg-emerald-500/10"
      };
    case "chart":
      return {
        category: "target",
        label: "Chart Target",
        icon: "📈",
        color: "pink",
        border: "border-pink-500",
        text: "text-pink-400",
        bg: "bg-pink-500/10"
      };
    case "infographic":
      return {
        category: "target",
        label: "Infographic Target",
        icon: "🦋",
        color: "rose",
        border: "border-rose-500",
        text: "text-rose-400",
        bg: "bg-rose-500/10"
      };
    case "transform":
      return {
        category: "transform",
        label: "JSONata Transformer",
        icon: "🔀",
        color: "purple",
        border: "border-purple-500",
        text: "text-purple-400",
        bg: "bg-purple-500/10"
      };
    case "rest":
      return {
        category: cat,
        label: cat === "transform" ? "REST Call (Transform)" : "HTTP / REST Source",
        icon: "🌐",
        color: cat === "transform" ? "purple" : "cyan",
        border: cat === "transform" ? "border-purple-500" : "border-cyan-500",
        text: cat === "transform" ? "text-purple-400" : "text-cyan-400",
        bg: cat === "transform" ? "bg-purple-500/10" : "bg-cyan-500/10"
      };
    case "database":
      return {
        category: cat,
        label: cat === "transform" ? "DB Mutation / Query (Transform)" : "Database Source",
        icon: "🗄️",
        color: cat === "transform" ? "purple" : "amber",
        border: cat === "transform" ? "border-purple-500" : "border-amber-500",
        text: cat === "transform" ? "text-purple-400" : "text-amber-400",
        bg: cat === "transform" ? "bg-purple-500/10" : "bg-amber-500/10"
      };
    case "grpc_stream":
    case "rest_stream":
    case "surreal_live":
      return {
        category: cat,
        label: cat === "transform" ? "Stream Processor (Transform)" : "Realtime Stream Source",
        icon: "📡",
        color: "violet",
        border: "border-violet-500",
        text: "text-violet-400",
        bg: "bg-violet-500/10"
      };
    default:
      return {
        category: cat,
        label: cat === "transform" ? "gRPC Service Call (Transform)" : "gRPC Source",
        icon: "⚡",
        color: cat === "transform" ? "purple" : "blue",
        border: cat === "transform" ? "border-purple-500" : "border-blue-500",
        text: cat === "transform" ? "text-purple-400" : "text-blue-400",
        bg: cat === "transform" ? "bg-purple-500/10" : "bg-blue-500/10"
      };
  }
}
function ReteWorkflowEditor(props) {
  const [nodeCount, setNodeCount] = createSignal(0);
  const [connectionCount, setConnectionCount] = createSignal(0);
  const [showAddMenu, setShowAddMenu] = createSignal(false);
  const [selectedNodeId, setSelectedNodeId] = createSignal(props.selectedStepId || null);
  const getCategoryCounts = () => {
    let sources = 0;
    let transforms = 0;
    let targets = 0;
    (props.steps || []).forEach((s) => {
      const c = getStepCategory(s.type, s.category, s.sourceStepIds);
      if (c === "source") sources++;
      else if (c === "transform") transforms++;
      else if (c === "target") targets++;
    });
    return {
      sources,
      transforms,
      targets
    };
  };
  const initializeEditor = async () => {
    return;
  };
  createEffect(() => {
    const stepsSnapshot = (props.steps || []).map((s) => ({
      id: s.id,
      type: s.type,
      category: s.category || getStepCategory(s.type, s.category, s.sourceStepIds),
      sourceStepIds: [...s.sourceStepIds || []]
    }));
    JSON.stringify(stepsSnapshot);
  });
  onMount(() => {
    initializeEditor();
  });
  onCleanup(() => {
  });
  return ssr(_tmpl$4$1, ssrHydrationKey(), `relative w-full h-[620px] rounded-2xl bg-[#0c0c14] border border-[#2a2a3a] overflow-hidden shadow-2xl ${props.isExecuting ? "workflow-executing" : ""}`, escape(createComponent(Show, {
    get when() {
      return showAddMenu();
    },
    get children() {
      return ssr(_tmpl$$1, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return selectedNodeId();
    },
    get children() {
      return [ssr(_tmpl$2$1, ssrHydrationKey()), ssr(_tmpl$3$1, ssrHydrationKey())];
    }
  })), escape(getCategoryCounts().sources), escape(getCategoryCounts().transforms), escape(getCategoryCounts().targets), ssrStyleProperty("background-image:", "radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.06) 1px, transparent 0)") + ssrStyleProperty(";background-size:", "24px 24px"));
}
var _tmpl$ = ["<table", ' class="w-full text-left text-xs text-[#c8c8d8]"><thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0 shadow-sm"><tr>', '</tr></thead><tbody class="divide-y divide-[#1e1e2e]">', "</tbody></table>"], _tmpl$2 = ["<div", ' class="overflow-auto max-h-[300px] border border-[#2a2a3a]/50 rounded bg-[#101015] custom-scrollbar">', "</div>"], _tmpl$3 = ["<div", ' class="p-3 text-xs text-[#5a5a6e]">No table data</div>'], _tmpl$4 = ["<th", ' class="px-3 py-2 font-medium border-b border-[#2a2a3e] whitespace-nowrap uppercase text-[10px] tracking-wider">', "</th>"], _tmpl$5 = ["<tr", ' class="hover:bg-[#1a1a24]/50 transition-colors">', "</tr>"], _tmpl$6 = ["<td", ' class="px-3 py-2 border-b border-[#1e1e2e]/50 max-w-[150px] truncate"', ">", "</td>"], _tmpl$7 = ["<div", ' style="position:relative;height:250px;background:#0d0f17;border-radius:8px;overflow:hidden;border:1px solid #2d3356"><div style="width:100%;height:100%;overflow:hidden;cursor:grab;position:relative"><div class="lt-canvas" style="position:absolute;transform-origin:0 0"><div class="lt-axis" style="position:absolute;left:0;height:2px;background:linear-gradient(90deg,transparent,#6c63ff 5%,#6c63ff 95%,transparent);box-shadow:0 0 10px rgba(108,99,255,0.4)"></div></div></div><div style="position:absolute;bottom:5px;right:8px;font-size:8px;color:#4a5273;pointer-events:none">Scroll · Drag</div></div>'], _tmpl$8 = ["<div", ' class="bg-[#101015] p-3 rounded border border-[#2a2a3a]/50" style="', '">', "</div>"], _tmpl$9 = ["<p", ' class="text-xs text-[#5a5a6e]">No valid array data for chart</p>'], _tmpl$0 = ["<p", ' class="text-xs text-[#8b8b9e] animate-pulse">Loading map assets...</p>'], _tmpl$1 = ["<select", ' class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-orange-300 font-mono focus:border-orange-500 focus:outline-none mb-3"', "><option value>Select a source step…</option><!--$-->", "<!--/--></select>"], _tmpl$10 = ["<option", "><!--$-->", "<!--/--> <!--$-->", "<!--/--><!--$-->", "<!--/--></option>"], _tmpl$11 = ["<div", ' class="', '"><div class="flex items-center gap-3"><span class="text-xl">', '</span><div><div class="text-xs font-bold uppercase tracking-wider">', '</div><div class="text-[11px] text-slate-300 font-mono mt-0.5">Required Variables: <!--$-->', '<!--/--></div></div></div><span class="text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full border bg-black/40 border-current opacity-80">', "</span></div>"], _tmpl$12 = ["<div", ' class="card p-4 border border-purple-500/30 bg-purple-950/20 mb-6"><div class="flex items-center justify-between mb-2"><span class="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2"><span class="inline-block w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>Live Workflow Stream Events (<!--$-->', '<!--/-->)</span></div><div class="max-h-48 overflow-y-auto font-mono text-xs space-y-1 custom-scrollbar bg-[#0a0a0f] p-3 rounded-lg border border-purple-900/50">', "</div></div>"], _tmpl$13 = ["<div", ' class="absolute right-0 mt-2 w-72 rounded-2xl bg-[#181824] border border-[#2a2a3a] shadow-2xl z-50 overflow-hidden fade-in py-1 divide-y divide-[#2a2a3a]/50"><div class="p-1"><div class="px-3 py-1 text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center justify-between"><span>📥 1. SOURCES</span><span class="text-[9px] text-[#5b5b6e] font-normal">(Start Flow)</span></div><button type="button" class="w-full text-left px-3 py-1.5 text-xs text-blue-300 hover:bg-[#222234] rounded-lg flex items-center gap-2 transition-colors"><span>⚡</span> gRPC Request (Source)</button><button type="button" class="w-full text-left px-3 py-1.5 text-xs text-cyan-300 hover:bg-[#222234] rounded-lg flex items-center gap-2 transition-colors"><span>🌐</span> HTTP / REST API (Source)</button><button type="button" class="w-full text-left px-3 py-1.5 text-xs text-amber-300 hover:bg-[#222234] rounded-lg flex items-center gap-2 transition-colors"><span>🗄️</span> Database Query (Source)</button></div><div class="p-1"><div class="px-3 py-1 text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center justify-between"><span>🔀 2. TRANSFORMS & SERVICES</span><span class="text-[9px] text-[#5b5b6e] font-normal">(In ➔ Out)</span></div><button type="button" class="w-full text-left px-3 py-1.5 text-xs text-purple-300 hover:bg-[#222234] rounded-lg flex items-center gap-2 transition-colors"><span>🔀</span> JSONata Transformer / Merger</button><button type="button" class="w-full text-left px-3 py-1.5 text-xs text-blue-300 hover:bg-[#222234] rounded-lg flex items-center gap-2 transition-colors"><span>⚡</span> gRPC Service Call (Transform)</button><button type="button" class="w-full text-left px-3 py-1.5 text-xs text-cyan-300 hover:bg-[#222234] rounded-lg flex items-center gap-2 transition-colors"><span>🌐</span> HTTP / REST API Call (Transform)</button><button type="button" class="w-full text-left px-3 py-1.5 text-xs text-amber-300 hover:bg-[#222234] rounded-lg flex items-center gap-2 transition-colors"><span>🗄️</span> Database Mutation / Query</button></div><div class="p-1"><div class="px-3 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">🎯 3. TARGETS (Terminal Sinks)</div><button type="button" class="w-full text-left px-3 py-1.5 text-xs text-emerald-300 hover:bg-[#222234] rounded-lg flex items-center gap-2 transition-colors"><span>📊</span> View Data Table</button><button type="button" class="w-full text-left px-3 py-1.5 text-xs text-pink-300 hover:bg-[#222234] rounded-lg flex items-center gap-2 transition-colors"><span>📈</span> Chart Visualizer</button><button type="button" class="w-full text-left px-3 py-1.5 text-xs text-rose-300 hover:bg-[#222234] rounded-lg flex items-center gap-2 transition-colors"><span>🦋</span> AntV Infographic Diagram</button></div></div>'], _tmpl$14 = ["<div", ' class="space-y-4">', "</div>"], _tmpl$15 = ["<div", ' class="flex items-center justify-between pt-4 border-t border-[#2a2a3a]/50"><h3 class="text-sm font-bold uppercase tracking-wider text-[#8b8b9e]">Step Configurations (<!--$-->', '<!--/-->)</h3><span class="text-xs text-[#5b5b6e]">Select or edit step parameters below</span></div>'], _tmpl$16 = ["<div", ' class="rounded-xl border border-dashed border-[#2a2a3a] py-12 text-center bg-[#0a0a0f]/50"><p class="text-[#8b8b9e] text-sm">No steps added yet. Add a step to start your workflow.</p></div>'], _tmpl$17 = ["<div", ' class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left"><div class="card max-w-lg w-full p-6 space-y-6 shadow-2xl border border-[#2a2a3a] bg-[#0c0c12]"><div class="flex items-center justify-between border-b border-[#2a2a3a] pb-4"><h2 class="text-xl font-bold text-white flex items-center gap-2"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>Workflow Settings</h2><button class="text-[#8b8b9e] hover:text-white transition-colors"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div><div class="space-y-4"><div><label class="mb-1 block text-sm font-medium text-[#8b8b9e]">Proto File</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-blue-500 focus:outline-none"', "><option value>No Proto File (REST / Table Only)</option><!--$-->", '<!--/--></select><p class="mt-2 text-[10px] text-[#5b5b6e]">Select a saved proto definition file from registry to enable autocomplete and service selectors in steps.</p></div><div><label class="mb-1 block text-sm font-medium text-[#8b8b9e]">Server Address</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-blue-500 focus:outline-none" placeholder="e.g. localhost:50051"', '></div><div class="rounded-lg bg-[#0a0a12] border border-emerald-500/15 p-3 space-y-2"><label class="block text-xs font-medium text-emerald-400/80"><span class="inline-flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>Trusted CA Certificate</span></label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"', '><option value>None</option><option value="__accept_all__">Accept All</option><!--$-->', '<!--/--></select><p class="text-[10px] text-[#5a5a6e]">None uses plaintext. Accept All uses TLS without certificate validation. A selected CA uses TLS and validates the server certificate. <a href="/TrustedCA" class="text-emerald-400/70 hover:text-emerald-400 underline" target="_blank">Manage CAs →</a></p></div><div class="border-t border-[#2a2a3a]/60 pt-4"><label class="mb-1 block text-sm font-medium text-[#8b8b9e]">Schedule (Cron)<span class="ml-1 text-[10px] text-[#5b5b6e]">e.g. */5 * * * *</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-blue-500 focus:outline-none placeholder:text-[#5b5b6e]" placeholder="Leave empty for manual only"', '><p class="mt-2 text-[10px] text-[#5b5b6e]">Uses standard cron syntax (min hour day month weekday).</p></div><div class="border-t border-[#2a2a3a]/60 pt-4"><label class="mb-1 block text-sm font-medium text-[#8b8b9e]">OAuth Connection</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-blue-500 focus:outline-none"', "><option value>No Connection (Public / Unauthenticated)</option><!--$-->", '<!--/--></select><p class="mt-2 text-[10px] text-[#5b5b6e]">Selected connection will retrieve an OAuth token and inject it as <code class="text-[#8b8b9e] font-mono">Authorization: Bearer &lt;token&gt;</code>.</p></div></div><div class="pt-4 border-t border-[#2a2a3a] flex justify-end"><button class="btn-primary px-6 py-2.5">Close Settings</button></div></div></div>'], _tmpl$18 = ["<main", ' class="mx-auto max-w-7xl px-6 py-12"><div class="mb-8 flex items-center justify-between"><div><input class="bg-transparent text-3xl font-extrabold tracking-tight text-white border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2 transition-all"', ' placeholder="Workflow Name"></div><div class="flex items-center gap-4"><button class="', '"', '>+ Form Variable</button><div class="w-px h-6 bg-[#2a2a3a] mx-1"></div><button class="btn-secondary flex items-center gap-1.5"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>Settings</button><button class="btn-secondary">Save Flow</button><button class="btn-primary flex items-center gap-2"', "><!--$-->", '<!--/-->Run</button><button class="btn-primary bg-purple-600 hover:bg-purple-700 shadow-purple-500/20 flex items-center gap-2"', "><span>📡</span> Stream Run</button></div></div><!--$-->", "<!--/--><!--$-->", '<!--/--><div class="space-y-6"><div class="space-y-6"><!--$-->', '<!--/--><div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#2a2a3a]"><div class="flex flex-wrap items-center gap-3"><h2 class="text-xl font-bold text-white flex items-center gap-2">Workflow Structure</h2><div class="flex items-center bg-[#12121a] p-1 rounded-xl border border-[#2a2a3a]"><button type="button" class="', '"><span>🕸️ Visual Graph (Rete.js)</span></button><button type="button" class="', '"><span>📋 Step Details List (<!--$-->', '<!--/-->)</span></button></div></div><div class="relative"><button type="button" class="text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-all hover:bg-blue-500/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Add Step</button><!--$-->', "<!--/--></div></div><!--$-->", '<!--/--><div class="', '"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div></div></div><!--$-->", "<!--/--></main>"], _tmpl$19 = ["<svg", ' class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$20 = ["<svg", ' width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'], _tmpl$21 = ["<div", ' class="flex items-start gap-2 border-b border-[#1e1e2e] pb-1 text-slate-300"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-900/60 text-purple-200">', '</span><span class="text-slate-400 text-[10px]">', '</span><span class="truncate">', "</span></div>"], _tmpl$22 = ["<span", ' class="text-[10px] text-[#5b5b6e]">(Finished in <!--$-->', "<!--/-->ms)</span>"], _tmpl$23 = ["<div", ' class="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">⚠️ Authentication Failed: <!--$-->', "<!--/--></div>"], _tmpl$24 = ["<div", ' class="', '"><div class="flex items-center gap-3"><span class="flex h-2 w-2 relative"><span class="', '"></span><span class="', '"></span></span><span class="text-xs font-bold uppercase tracking-wider">Workflow Run Status: <!--$-->', "<!--/--></span><!--$-->", "<!--/--></div><!--$-->", '<!--/--><button class="text-[10px] font-semibold text-[#8b8b9e] hover:text-white transition-colors self-start md:self-auto">Clear Results</button></div>'], _tmpl$25 = ["<span", ' class="text-[10px] text-[#5b5b6e] italic">No outgoing data flow</span>'], _tmpl$26 = ["<div", ' class="mb-4 p-3 rounded-xl bg-[#141420] border border-[#2a2a3a] space-y-2"><div class="flex items-center justify-between"><span class="text-xs font-bold text-purple-300 flex items-center gap-1.5"><span>🔗 Connected Upstream Sources</span><span class="text-[10px] text-purple-400 font-semibold bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30"><!--$-->', '<!--/--> connected</span></span><span class="text-[10px] text-[#6b6b7e]">Toggle upstream steps to automatically connect in visual graph</span></div><!--$-->', "<!--/--></div>"], _tmpl$27 = ["<optgroup", ' label="Load a Saved Proto">', "</optgroup>"], _tmpl$28 = ["<optgroup", ' label="Available Services in Proto">', "</optgroup>"], _tmpl$29 = ["<div", ' class="grid grid-cols-2 gap-4 mb-4"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Service</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', "><option value", ">Select a service...</option><!--$-->", "<!--/--><!--$-->", '<!--/--></select></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">Method</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"', "><option value disabled>Select a method...</option><!--$-->", "<!--/--></select></div></div>"], _tmpl$30 = ["<span", ' class="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">Active</span>'], _tmpl$31 = ["<div", ' class="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#3a3a4e] uppercase pointer-events-none group-hover:text-[#4a4a5e] transition-colors">Default</div>'], _tmpl$32 = ["<div", ' class="mt-5 pt-5 border-t border-[#2a2a3a]/50"><label class="mb-2 block text-xs font-semibold text-[#8b8b9e] flex items-center justify-between"><span class="flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect></svg>Server Overide</span><!--$-->', '<!--/--></label><div class="relative group"><input type="text" class="', '" placeholder="', '"', "><!--$-->", "<!--/--></div></div>"], _tmpl$33 = ["<div", ' class="mt-4 px-1"><label class="mb-1 block text-xs font-semibold text-[#8b8b9e] flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>TLS trust</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2 text-xs text-white focus:border-emerald-500 focus:outline-none"', '><option value>None</option><option value="__accept_all__">Accept All</option><!--$-->', "<!--/--></select></div>"], _tmpl$34 = ["<div", '><div class="flex items-center justify-between mt-4 mb-1"><label class="text-xs text-[#8b8b9e]">Request Payload Template</label><span class="text-[10px] text-blue-400 font-mono">{{ steps.&lt;id>.response }}</span></div><textarea class="h-32 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"', "></textarea></div>"], _tmpl$35 = ["<div", ' class="mt-4"><div class="flex items-center justify-between mb-1"><label class="text-xs text-[#8b8b9e]">Headers (Metadata) Template</label><span class="text-[10px] text-blue-400 font-mono">{ "Authorization": "Bearer {{ ... }}" }</span></div><textarea class="h-20 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" placeholder="{ &quot;key&quot;: &quot;value&quot; }"', "></textarea></div>"], _tmpl$36 = ["<div", '><div class="flex items-center justify-between mb-1"><label class="text-xs text-[#8b8b9e]">Request Body Template (JSON)</label><span class="text-[10px] text-blue-400 font-mono">Supports {{ variables }}</span></div><textarea class="h-32 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"', "></textarea></div>"], _tmpl$37 = ["<div", ' class="mb-4 space-y-4"><div><label class="mb-1 block text-xs text-[#8b8b9e]">URL Template</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none" placeholder="e.g. https://api.stripe.com/v1/customers/{{ form.customerId }}"', '></div><div class="grid grid-cols-2 gap-4"><div><label class="mb-1 block text-xs text-[#8b8b9e]">HTTP Method</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', '><option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="DELETE">DELETE</option><option value="PATCH">PATCH</option></select></div></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">TLS trust</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"', '><option value>None</option><option value="__accept_all__">Accept All</option><!--$-->', "<!--/--></select></div><!--$-->", "<!--/--><!--$-->", '<!--/--><div><div class="flex items-center justify-between mt-4 mb-1"><label class="text-xs text-[#8b8b9e]">Headers Template (JSON)</label><span class="text-[10px] text-blue-400 font-mono">{ "Authorization": "Bearer {{ token }}" }</span></div><textarea class="h-20 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" placeholder="{ &quot;Content-Type&quot;: &quot;application/json&quot; }"', "></textarea></div></div>"], _tmpl$38 = ["<div", ' class="rounded-xl border border-purple-500/30 bg-[#120e1c] p-4 space-y-3"><div class="flex items-center justify-between"><p class="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5"><span>🔀</span> JSONata Transformation Engine</p><span class="text-[10px] text-purple-400/80 font-mono">jsonata v2</span></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">Quick Presets</label><div class="flex flex-wrap gap-1.5"><button type="button" class="px-2 py-1 rounded bg-[#1e1a2a] hover:bg-[#2e2640] border border-purple-500/20 text-[10px] text-purple-200">Pass Through ($)</button><button type="button" class="px-2 py-1 rounded bg-[#1e1a2a] hover:bg-[#2e2640] border border-purple-500/20 text-[10px] text-purple-200">Merge 2 Sources</button><button type="button" class="px-2 py-1 rounded bg-[#1e1a2a] hover:bg-[#2e2640] border border-purple-500/20 text-[10px] text-purple-200">Filter Array</button><button type="button" class="px-2 py-1 rounded bg-[#1e1a2a] hover:bg-[#2e2640] border border-purple-500/20 text-[10px] text-purple-200">Map & Compute</button><button type="button" class="px-2 py-1 rounded bg-[#1e1a2a] hover:bg-[#2e2640] border border-purple-500/20 text-[10px] text-purple-200">Math Aggregate</button></div></div><div><label class="mb-1 flex items-center justify-between text-xs text-[#8b8b9e]"><span>Transformation Expression</span><span class="text-[9px] text-[#5b5b6e]">Variables: $, source, sources, steps.&lt;id&gt;.response</span></label><textarea class="w-full rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-3 text-xs text-purple-200 font-mono focus:border-purple-500 focus:outline-none resize-y" rows="6" placeholder="$"', "></textarea></div></div>"], _tmpl$39 = ["<div", ' class="mb-4 space-y-4"><div class="grid grid-cols-2 gap-4"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Connection URL <span class="text-[10px] text-[#5b5b6e]">(supports {{ variables }})</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder:text-[#5b5b6e]" placeholder="e.g. ws://127.0.0.1:8000/rpc (or leave blank)"', '></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">Namespace <span class="text-[10px] text-[#5b5b6e]">(supports {{ variables }})</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder:text-[#5b5b6e]" placeholder="e.g. solidflow (or leave blank)"', '></div></div><div class="grid grid-cols-3 gap-4"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Database Name <span class="text-[10px] text-[#5b5b6e]">(supports {{ variables }})</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder:text-[#5b5b6e]" placeholder="e.g. main (or leave blank)"', '></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">Username <span class="text-[10px] text-[#5b5b6e]">(supports {{ variables }})</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder:text-[#5b5b6e]" placeholder="e.g. admin"', '></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">Password <span class="text-[10px] text-[#5b5b6e]">(supports {{ variables }})</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder:text-[#5b5b6e]" placeholder="e.g. admin"', '></div></div><div><div class="flex items-center justify-between mb-1"><label class="block text-xs text-[#8b8b9e]">SurrealQL Query</label><span class="text-[10px] text-blue-400 font-mono">Supports {{ variables }}</span></div><div class="relative group"><div class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 opacity-20 blur transition group-hover:opacity-40"></div><textarea class="relative w-full h-32 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-3 text-sm font-mono text-red-300 focus:border-red-500 outline-none custom-scrollbar" placeholder="SELECT * FROM users WHERE age > {{ steps.auth.response.min_age }};"', "></textarea></div></div></div>"], _tmpl$40 = ["<div", ' class="mt-2 rounded-md bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 text-[10px] text-purple-300">', "</div>"], _tmpl$41 = ["<div", ' class="rounded-lg border border-purple-500/20 bg-[#0d0a10] p-4"><p class="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>Chart Overrides</p><div class="grid grid-cols-2 gap-3"><div><label class="mb-1 block text-xs text-[#8b8b9e]"><!--$-->', '<!--/--> <span class="text-[10px] text-[#5b5b6e]">(optional)</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"', '></div><div><label class="mb-1 block text-xs text-[#8b8b9e]"><!--$-->', '<!--/--> <span class="text-[10px] text-[#5b5b6e]">(optional)</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none" placeholder="Auto-detect"', "></div></div><!--$-->", "<!--/--></div>"], _tmpl$42 = ["<div", ' class="rounded-lg border border-emerald-500/20 bg-[#080f0a] p-4"><p class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M3 15h18M9 3v18"></path></svg>Table Column Overrides</p><p class="text-[10px] text-[#5b5b6e] mb-3">Leave empty to show all keys found in the array. Add keys only when you want to limit or order columns.</p><div class="space-y-2"><!--$-->', '<!--/--><button class="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Add column</button></div></div>'], _tmpl$43 = ["<div", ' class="space-y-4 mt-2"><div class="rounded-lg border border-orange-500/20 bg-[#0f0e08] p-4"><p class="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>Data Source</p><!--$-->', '<!--/--><div class="grid grid-cols-2 gap-3"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Nested Array Path <span class="text-[10px] text-[#5b5b6e]">(lodash dot path)</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-orange-500 focus:outline-none" placeholder="e.g. shares"', '><p class="text-[10px] text-[#5b5b6e] mt-1">Leave empty if the response is already an array. Use dot notation for deeper nesting.</p></div><div class="bg-[#0d0d14] rounded-lg border border-[#2a2a3a] p-2.5"><p class="text-[10px] text-[#5b5b6e] font-mono mb-1">Example response:</p><pre class="text-[10px] text-orange-300 font-mono overflow-x-auto">{ "cash": 98961,\n  "shares": [\n    { "symbol": "ORCL",\n      "count": 271 }\n  ]\n}</pre><p class="text-[10px] text-[#5b5b6e] mt-1">→ Path: <code class="text-orange-400 font-mono">shares</code></p></div></div></div><!--$-->', "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$44 = ["<span", ' class="text-[10px] text-[#5b5b6e] font-mono"><!--$-->', "<!--/-->ms</span>"], _tmpl$45 = ["<div", ' class="flex p-0.5 bg-[#12121a] border border-[#2a2a3a] rounded-lg shadow-sm"><button type="button" class="', '">Response</button><button type="button" class="', '">Payload</button></div>'], _tmpl$46 = ["<span", ' class="text-[10px] text-[#5b5b6e] font-mono"><!--$-->', "<!--/--> rows</span>"], _tmpl$47 = ["<div", ' class="flex items-center justify-between mb-3 border-b border-[#2a2a3a]/30 pb-2"><div class="flex items-center gap-2"><span class="', '">', "</span><!--$-->", "<!--/--></div><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$48 = ["<p", ' class="text-[10px] text-[#5b5b6e] uppercase mb-1 font-semibold">Rendered Request Payload</p>'], _tmpl$49 = ["<pre", ' class="text-[11px] text-blue-300 font-mono overflow-auto max-h-[220px] bg-[#0a0a0f] p-3 rounded-lg border border-[#2a2a3a]/40 custom-scrollbar whitespace-pre-wrap break-all flex-1">', "</pre>"], _tmpl$50 = ["<p", ' class="text-[10px] text-[#5b5b6e] uppercase mb-1 font-semibold">Response Content</p>'], _tmpl$51 = ["<pre", ' class="', '">', "</pre>"], _tmpl$52 = ["<div", ' class="flex-1 overflow-hidden flex flex-col">', "</div>"], _tmpl$53 = ["<div", ' class="flex-1 overflow-hidden flex flex-col justify-center">', "</div>"], _tmpl$54 = ["<div", ' class="flex-1 flex flex-col justify-start overflow-hidden"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$55 = ["<div", ' class="border-t lg:border-t-0 lg:border-l border-[#2a2a3a]/50 pt-4 lg:pt-0 lg:pl-6 flex flex-col h-full min-h-[220px]">', "</div>"], _tmpl$56 = ["<div", ' class="', '"><div class="absolute -left-[14px] -top-[14px] flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white ring-4 ring-[#0a0a0f]">', '</div><div class="mb-3 flex items-center justify-between"><span class="', '">', "</span><!--$-->", '<!--/--></div><div class="', '"><div class="space-y-4"><!--$-->', '<!--/--><div class="flex justify-between items-start mb-4"><div class="flex items-center gap-4 flex-1"><div class="w-1/3"><label class="mb-1 block text-xs text-[#8b8b9e]">Step Type</label><select class="w-full bg-[#1e1e2e] text-white font-medium text-sm border-b border-[#2a2a3a] focus:border-blue-500 outline-none pb-1"', '><optgroup label="📥 1. Sources (Start Flow)"><option value="grpc">⚡ gRPC Request</option><option value="rest">🌐 HTTP / REST Request</option><option value="database">🛢️ Database Query</option></optgroup><optgroup label="🔀 2. Transforms (Processing)"><option value="transform">🔀 JSONata Transformer / Merger</option></optgroup><optgroup label="🎯 3. Targets (Terminal Sinks)"><option value="table">📊 View Data Table</option><option value="infographic">🦋 AntV Infographic Diagram</option><option value="bar">📊 Bar Chart</option><option value="line">📈 Line Chart</option><option value="doughnut">🍩 Doughnut Chart</option><option value="pie">🥧 Pie Chart</option><option value="scatter">📉 Scatter Chart</option><option value="timeline">⟳ Timeline</option><option value="choropleth-us">🗺️ US Choropleth Map</option><option value="choropleth-world">🗺️ World Choropleth Map</option></optgroup><option value="bar">📊 Bar Chart</option><option value="line">📈 Line Chart</option><option value="doughnut">🍩 Doughnut Chart</option><option value="pie">🥧 Pie Chart</option><option value="scatter">📉 Scatter Chart</option><option value="timeline">⟳ Timeline</option><option value="choropleth-us">🗺️ US Choropleth Map</option><option value="choropleth-world">🗺️ World Choropleth Map</option></select></div><div class="flex-1"><label class="mb-1 block text-xs text-[#8b8b9e]">Step ID (for variables)</label><input type="text" class="w-full bg-transparent text-white font-mono text-sm border-b border-[#2a2a3a] focus:border-blue-500 outline-none pb-1"', '></div></div><button class="text-[#5b5b6e] hover:text-red-400 ml-4"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div> <!--$-->", "<!--/--></div></div>"], _tmpl$57 = ["<div", ' class="flex flex-wrap gap-2">', "</div>"], _tmpl$58 = ["<div", ' class="mt-2 pt-2 border-t border-[#2a2a3a] flex items-center justify-between"><span class="text-[11px] text-purple-300 font-medium">Multi-Source Merge Strategy:</span><select class="bg-[#1e1e2e] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:border-purple-500 outline-none"', '><option value="concat">Array Concatenate (concat)</option><option value="merge_object">Object Deep Merge (merge_object)</option><option value="keyed">Keyed by Step ID (keyed)</option></select></div>'], _tmpl$59 = ["<div", ' class="space-y-2"><!--$-->', "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$60 = ["<p", ' class="text-[11px] text-[#5b5b6e] italic">No upstream source/transform steps available. Add a source step first.</p>'], _tmpl$61 = ["<button", ' type="button" class="', '"', '><span class="font-bold">', "</span><span>", '</span><span class="font-mono">', '</span><span class="text-[10px] opacity-70">(<!--$-->', "<!--/-->)</span></button>"], _tmpl$62 = ["<option", ' value="', '">Load: <!--$-->', "<!--/--></option>"], _tmpl$63 = ["<option", "", ">", "</option>"], _tmpl$64 = ["<option", "", "><!--$-->", "<!--/--> (<!--$-->", "<!--/--> → <!--$-->", "<!--/-->)</option>"], _tmpl$65 = ["<option", ">", "</option>"], _tmpl$66 = ["<span", '>Will render: Region = <code class="font-mono">', '</code> · Value = <code class="font-mono">', "</code></span>"], _tmpl$67 = ["<span", '>Will render: X = <code class="font-mono">', '</code> · Y = <code class="font-mono">', "</code></span>"], _tmpl$68 = ["<div", ' class="flex gap-2"><input type="text" class="flex-1 rounded-lg border border-[#2a2a3a] bg-[#1a1a26] px-3 py-1.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none" placeholder="key name, e.g. symbol"', '><button class="text-[#5b5b6e] hover:text-red-400 px-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div>'], _tmpl$69 = ["<svg", ' class="animate-spin h-5 w-5 text-blue-500 mb-2" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$70 = ["<span", ' class="text-xs text-blue-400 animate-pulse font-medium">Waiting to execute...</span>'], _tmpl$71 = ["<div", ' class="flex flex-col items-center justify-center h-full py-8 text-center text-[#5b5b6e]">', "</div>"], _tmpl$72 = ["<div", ' class="flex flex-col items-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mb-2 text-[#3a3a4e]"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg><span class="text-xs italic">Step not executed</span></div>'], _tmpl$73 = ["<div", ' class="text-[11px] text-[#5b5b6e] italic py-8 text-center border border-dashed border-[#2a2a3a] rounded-lg flex-1 flex items-center justify-center">No table rows found</div>'], _tmpl$74 = ["<div", ' class="text-[11px] text-[#5b5b6e] italic py-8 text-center border border-dashed border-[#2a2a3a] rounded-lg flex-1 flex items-center justify-center">No chart points found</div>'], _tmpl$75 = ["<div", ' class="grid grid-cols-2 gap-3 max-w-md"><div><label class="mb-1 block text-[10px] text-[#8b8b9e]">Username</label><input type="text" class="w-full rounded border border-[#2a2a3a] bg-[#1a1a26] p-2 text-xs text-white focus:border-blue-500 focus:outline-none" placeholder="Username"', '></div><div><label class="mb-1 block text-[10px] text-[#8b8b9e]">Password</label><input type="password" class="w-full rounded border border-[#2a2a3a] bg-[#1a1a26] p-2 text-xs text-white focus:border-blue-500 focus:outline-none" placeholder="Password"', "></div></div>"], _tmpl$76 = ["<p", ' class="text-[10px] text-emerald-400 font-mono mt-1 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Returns token key: <span class="bg-[#1e1e2e] px-1.5 py-0.5 rounded border border-[#2a2a3a] text-white font-bold">', "</span></p>"], _tmpl$77 = ["<div", ' class="max-w-md space-y-2"><label class="mb-1 block text-[10px] text-[#8b8b9e]">Select OAuth Connection</label><select class="w-full rounded border border-[#2a2a3a] bg-[#1a1a26] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"', "><option value disabled>Select Connection...</option><!--$-->", "<!--/--></select><!--$-->", "<!--/--></div>"], _tmpl$78 = ["<div", ' class="mt-4 border-t border-[#2a2a3a]/60 pt-4 text-left"><label class="mb-2 block text-xs font-semibold text-[#8b8b9e] uppercase tracking-wider">Authentication</label><div class="flex p-1 bg-[#151520] rounded-lg max-w-xs mb-3"><button class="', '">None</button><button class="', '">Basic</button><button class="', '">OAuth</button></div><!--$-->', "<!--/--><!--$-->", "<!--/--></div>"];
const id$$ = "src/routes/workflows/[id].tsx?pick=default&pick=$css";
function get(obj, path, defValue) {
  if (!path) return obj;
  const pathArray = Array.isArray(path) ? path : path.match(/([^[.\]])+/g);
  const result = pathArray?.reduce((prevObj, key) => prevObj && prevObj[key], obj);
  return result === void 0 ? defValue : result;
}
if (!isServer) {
  Chart.register(...registerables);
  Chart.register(ChartGeo.ChoroplethController, ChartGeo.GeoFeature, ChartGeo.ColorScale, ChartGeo.ProjectionScale);
}
function valueToLabel(value, fallback) {
  if (value === void 0 || value === null || value === "") return String(fallback + 1);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
function valueToNumber(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}
function parseJsonString(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}
function normalizeDataArray(value) {
  let data = parseJsonString(value);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const arrayKey = Object.keys(data).find((key) => Array.isArray(data[key]));
    if (arrayKey) data = data[arrayKey];
  }
  if (!Array.isArray(data)) {
    data = data !== void 0 && data !== null ? [data] : [];
  }
  while (data.length === 1) {
    const first = parseJsonString(data[0]);
    if (!Array.isArray(first)) break;
    data = first;
  }
  return data.map(parseJsonString);
}
function collectObjectKeys(data) {
  const keys = /* @__PURE__ */ new Set();
  const addKeys = (value, prefix = "") => {
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
function pickKey(keys, preferred) {
  const normalized = new Map(keys.map((key) => [key.toLowerCase(), key]));
  for (const key of preferred) {
    const match = normalized.get(key.toLowerCase());
    if (match) return match;
  }
  return "";
}
function inferChartKeys(data, explicitX, explicitY) {
  const keys = collectObjectKeys(data);
  const xKey = explicitX || pickKey(keys, ["x", "step", "label", "name", "title", "date", "time", "id"]);
  let yKey = explicitY || pickKey(keys, ["y", "value", "metrics.value", "metrics.delta", "count", "total", "amount", "score", "completed"]);
  if (!yKey) {
    yKey = keys.find((key) => key !== xKey && data.some((row) => {
      const value = row && typeof row === "object" ? get(row, key) : void 0;
      return typeof value === "number" || typeof value === "boolean" || typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
    })) || "";
  }
  return {
    xKey,
    yKey
  };
}
function LogTable(props) {
  const rows = () => normalizeDataArray(props.data);
  const effectiveCols = () => {
    const explicit = (props.columns || []).filter(Boolean);
    if (explicit.length) return explicit;
    const keys = collectObjectKeys(rows());
    return keys.length ? keys : ["value"];
  };
  const cellValue = (row, key) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return key === "value" ? row : void 0;
    return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : get(row, key);
  };
  const formatCell = (value) => {
    if (value === void 0 || value === null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  };
  return ssr(_tmpl$2, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return rows().length > 0;
    },
    get fallback() {
      return ssr(_tmpl$3, ssrHydrationKey());
    },
    get children() {
      return ssr(_tmpl$, ssrHydrationKey(), escape(createComponent(For, {
        get each() {
          return effectiveCols();
        },
        children: (col) => ssr(_tmpl$4, ssrHydrationKey(), escape(col))
      })), escape(createComponent(For, {
        get each() {
          return rows();
        },
        children: (row) => ssr(_tmpl$5, ssrHydrationKey(), escape(createComponent(For, {
          get each() {
            return effectiveCols();
          },
          children: (col) => {
            const text = formatCell(cellValue(row, col));
            return ssr(_tmpl$6, ssrHydrationKey(), ssrAttribute("title", escape(text, true), false), escape(text));
          }
        })))
      })));
    }
  })));
}
let globalUsTopoJson = null;
let globalWorldTopoJson = null;
const STATE_ABBR_MAP = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming"
};
function LogTimeline(props) {
  let vpRef;
  const rows = () => normalizeDataArray(props.data);
  const events = () => rows().map((row, i) => {
    const xk = props.xKey || "year";
    const yk = props.yKey || "header";
    const rawYear = row && typeof row === "object" ? get(row, xk) : row;
    const header = row && typeof row === "object" ? get(row, yk) : String(row);
    const text = row && typeof row === "object" ? get(row, "text") || get(row, "description") || "" : "";
    const imp = row && typeof row === "object" ? Number(get(row, "importance") || get(row, "rating") || 3) : 3;
    const link = row && typeof row === "object" ? get(row, "link") || get(row, "url") || "" : "";
    const date = row && typeof row === "object" ? get(row, "date") || String(rawYear) : String(rawYear);
    const year = Number(rawYear) || i;
    return {
      year,
      header: String(header || "Event"),
      text: String(text),
      importance: Math.min(5, Math.max(1, imp)),
      link: String(link),
      date: String(date)
    };
  });
  let scale = 1, offsetX = 0;
  const BASE_PX = 80;
  const yearToX = (y) => y * BASE_PX;
  onMount(() => {
    const evs = events();
    if (evs.length) {
      const years = evs.map((e) => e.year);
      const minY = Math.min(...years), maxY = Math.max(...years);
      const canvasL = yearToX(minY) - 200;
      const mid = yearToX((minY + maxY) / 2) - canvasL;
      offsetX = vpRef.clientWidth / (2 * scale) - mid;
    }
    vpRef.addEventListener("wheel", (e) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const ns = Math.min(8, Math.max(0.05, scale * f));
      const pivot = (e.clientX - vpRef.getBoundingClientRect().left) / scale - offsetX;
      scale = ns;
      offsetX = (e.clientX - vpRef.getBoundingClientRect().left) / scale - pivot;
    }, {
      passive: false
    });
    let p2 = false, psx = 0, pox = 0;
    vpRef.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      p2 = true;
      psx = e.clientX;
      pox = offsetX;
      vpRef.style.cursor = "grabbing";
    });
    window.addEventListener("mousemove", (e) => {
      if (!p2) return;
      offsetX = pox + (e.clientX - psx) / scale;
    });
    window.addEventListener("mouseup", () => {
      p2 = false;
      vpRef.style.cursor = "grab";
    });
  });
  return ssr(_tmpl$7, ssrHydrationKey());
}
function LogChart(props) {
  const cType = () => props.chartType || "bar";
  const [topoJson, setTopoJson] = createSignal(null);
  createEffect(() => {
    const type = cType();
    if (type === "choropleth-us") {
      if (globalUsTopoJson) {
        setTopoJson(globalUsTopoJson);
      } else {
        fetch("https://cdn.jsdelivr.net/npm/us-atlas/states-10m.json").then((res) => res.json()).then((data) => {
          globalUsTopoJson = data;
          setTopoJson(data);
        });
      }
    } else if (type === "choropleth-world") {
      if (globalWorldTopoJson) {
        setTopoJson(globalWorldTopoJson);
      } else {
        fetch("https://cdn.jsdelivr.net/npm/world-atlas/countries-110m.json").then((res) => res.json()).then((data) => {
          globalWorldTopoJson = data;
          setTopoJson(data);
        });
      }
    }
  });
  const buildData = () => {
    const data = normalizeDataArray(props.data);
    if (!Array.isArray(data) || !data.length) return {
      labels: [],
      datasets: []
    };
    const type = cType();
    const isPie = type === "pie" || type === "doughnut";
    const isScatter = type === "scatter";
    const isBar = type === "bar";
    if (type.startsWith("choropleth")) {
      const isUS = type === "choropleth-us";
      const topo = topoJson();
      if (!topo) return {
        labels: [],
        datasets: []
      };
      const features = isUS ? ChartGeo.topojson.feature(topo, topo.objects.states).features : ChartGeo.topojson.feature(topo, topo.objects.countries).features;
      const inferred2 = inferChartKeys(data, props.xKey, props.yKey);
      const items = data.map((item, i) => {
        const geoVal = inferred2.xKey ? String(get(item, inferred2.xKey) || "").trim() : "";
        const numVal = inferred2.yKey ? valueToNumber(get(item, inferred2.yKey), 0) : valueToNumber(item, 0);
        return {
          geoVal,
          numVal
        };
      });
      const matchedFeatures = features.map((d) => {
        const featName = d.properties.name;
        const matched = items.find((item) => {
          const name = item.geoVal;
          if (name.toLowerCase() === featName.toLowerCase()) return true;
          if (isUS) {
            const mappedName = STATE_ABBR_MAP[name.toUpperCase()];
            if (mappedName && mappedName.toLowerCase() === featName.toLowerCase()) return true;
          }
          return false;
        });
        return {
          feature: d,
          value: matched ? matched.numVal : 0
        };
      });
      return {
        labels: features.map((d) => d.properties.name),
        datasets: [{
          label: inferred2.yKey || "Value",
          outline: features,
          data: matchedFeatures
        }]
      };
    }
    const inferred = inferChartKeys(data, props.xKey, props.yKey);
    if (isScatter) {
      const points2 = [];
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item && typeof item === "object") {
          points2.push({
            x: inferred.xKey ? valueToNumber(get(item, inferred.xKey), i) : i,
            y: inferred.yKey ? valueToNumber(get(item, inferred.yKey), 0) : valueToNumber(item, 0)
          });
        } else {
          points2.push({
            x: i,
            y: Number(item) || 0
          });
        }
      }
      return {
        labels: [],
        datasets: [{
          label: inferred.yKey || "Value",
          data: points2,
          backgroundColor: "#3b82f6",
          pointRadius: 4
        }]
      };
    }
    const labels = [];
    const points = [];
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
        fill: !isBar
      }]
    };
  };
  const chartOptions = () => {
    const type = cType();
    if (type.startsWith("choropleth")) {
      const isUS = type === "choropleth-us";
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          projection: {
            axis: "x",
            projection: isUS ? "albersUsa" : "equalEarth"
          },
          color: {
            axis: "x",
            interpolate: (v) => {
              const hue = 220 + v * (320 - 220);
              const saturation = 30 + v * (85 - 30);
              const lightness = 25 + v * (65 - 25);
              return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            },
            legend: {
              position: "bottom-right",
              align: "bottom"
            }
          }
        }
      };
    }
    const isPie = cType() === "pie" || cType() === "doughnut";
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#c8c8d8"
          }
        }
      },
      scales: isPie ? {} : {
        x: {
          grid: {
            color: "#2a2a3e"
          },
          ticks: {
            color: "#8b8b9e"
          }
        },
        y: {
          grid: {
            color: "#2a2a3e"
          },
          ticks: {
            color: "#8b8b9e"
          }
        }
      }
    };
  };
  return ssr(_tmpl$8, ssrHydrationKey(), ssrStyle(cType() === "timeline" ? "" : "height:250px"), escape(createComponent(Show, {
    get when() {
      return cType() === "timeline";
    },
    get fallback() {
      return createComponent(Show, {
        get when() {
          return normalizeDataArray(props.data).length > 0;
        },
        get fallback() {
          return ssr(_tmpl$9, ssrHydrationKey());
        },
        get children() {
          return createComponent(Show, {
            get when() {
              return !cType().startsWith("choropleth") || topoJson();
            },
            get fallback() {
              return ssr(_tmpl$0, ssrHydrationKey());
            },
            get children() {
              return createComponent(DefaultChart, {
                get type() {
                  return cType().startsWith("choropleth") ? "choropleth" : cType();
                },
                get data() {
                  return buildData();
                },
                get options() {
                  return chartOptions();
                }
              });
            }
          });
        }
      });
    },
    get children() {
      return createComponent(LogTimeline, {
        get data() {
          return props.data;
        },
        get xKey() {
          return props.xKey;
        },
        get yKey() {
          return props.yKey;
        }
      });
    }
  })));
}
const DATA_SOURCE_STEP_TYPES = /* @__PURE__ */ new Set(["grpc", "rest", "database"]);
function isDataSourceStep(step) {
  return !!step && (!step.type || DATA_SOURCE_STEP_TYPES.has(step.type));
}
function stepResponseTemplate(step) {
  return `{{ steps.${step.id}.response }}`;
}
function SourceStepSelect(props) {
  const sourceSteps = createMemo(() => {
    return props.steps.slice(0, props.currentIndex).filter(isDataSourceStep);
  });
  return ssr(_tmpl$1, ssrHydrationKey(), ssrAttribute("value", escape(props.value, true), false), escape(createComponent(For, {
    get each() {
      return sourceSteps();
    },
    children: (s) => ssr(_tmpl$10, ssrHydrationKey() + ssrAttribute("value", escape(stepResponseTemplate(s), true), false), s.type === "rest" ? "🌐" : s.type === "database" ? "🛢️" : "⚡", escape(s.id), s.type === "rest" ? ` (${escape(s.restUrl) || "REST"})` : s.methodName ? ` (${escape(s.methodName)})` : "")
  })));
}
function WorkflowBuilder() {
  const params = useParams();
  useNavigate();
  const isNew = params.id === "new";
  const [name, setName] = createSignal("New Workflow");
  const [viewMode, setViewMode] = createSignal("graph");
  const [graphData, setGraphData] = createSignal(null);
  const [selectedStepId, setSelectedStepId] = createSignal(null);
  const [protoContent, setProtoContent] = createSignal("");
  const [hasActiveInput, setHasActiveInput] = createSignal(false);
  const [activeInput, setActiveInput] = createSignal(null);
  onMount(() => {
    if (isServer) return;
    if (!savedProtos()) refetchProtos();
    if (!isNew && !workflow()) refetchWorkflow();
    document.addEventListener("focusin", (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) {
        setHasActiveInput(true);
        setActiveInput(t);
      }
    });
    document.addEventListener("focusout", () => {
      setTimeout(() => {
        if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
          setHasActiveInput(false);
          setActiveInput(null);
        }
      }, 50);
    });
  });
  const [dashboards] = createResource(async () => {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/dashboards` : "/api/dashboards";
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });
  const [savedCas] = createResource(async () => {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/cas` : "/api/cas";
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });
  const [savedProtos, {
    refetch: refetchProtos
  }] = createResource(async () => {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/protos` : "/api/protos";
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });
  const ACCEPT_ALL_CA = "__accept_all__";
  const [serverAddress, setServerAddress] = createSignal("localhost:50051");
  const [schedule, setSchedule] = createSignal("");
  const [protoId, setProtoId] = createSignal("");
  const [caId, setCaId] = createSignal("");
  const [authType, setAuthType] = createSignal("grpc");
  const [authService, setAuthService] = createSignal("");
  const [authMethod, setAuthMethod] = createSignal("");
  const [authRequestTemplate, setAuthRequestTemplate] = createSignal("{}");
  const [authUrl, setAuthUrl] = createSignal("");
  const [authRestMethod, setAuthRestMethod] = createSignal("POST");
  const [authScheme, setAuthScheme] = createSignal("basic");
  const [authUsername, setAuthUsername] = createSignal("");
  const [authPassword, setAuthPassword] = createSignal("");
  const [bearerToken, setBearerToken] = createSignal("");
  const [authRestBody, setAuthRestBody] = createSignal("{}");
  const [authTokenPath, setAuthTokenPath] = createSignal("accessToken");
  const [authTestResult, setAuthTestResult] = createSignal(null);
  const [isTestingAuth, setIsTestingAuth] = createSignal(false);
  const [steps, setSteps] = createStore([]);
  const [showAddStepMenu, setShowAddStepMenu] = createSignal(false);
  const [connectionId, setConnectionId] = createSignal("");
  const [showSettings, setShowSettings] = createSignal(false);
  const [connections] = createResource(async () => {
    try {
      const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/connections` : "/api/connections";
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch (e) {
      console.error("fetchConnections error:", e);
      return [];
    }
  });
  const [parsedProto, setParsedProto] = createSignal(null);
  const [compileError, setCompileError] = createSignal(null);
  const [runId, setRunId] = createSignal(null);
  const [runData, setRunData] = createSignal(null);
  const [isRunning, setIsRunning] = createSignal(false);
  const [liveStreamEvents, setLiveStreamEvents] = createSignal([]);
  const fetchWorkflow = async () => {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/workflows/${params.id}` : `/api/workflows/${params.id}`;
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
  const [workflow, {
    refetch: refetchWorkflow
  }] = createResource(params.id, fetchWorkflow);
  const varConfigStatus = createMemo(() => {
    const data = workflow();
    if (!data) return {
      hasVariables: false,
      allConfigured: true,
      reqVars: [],
      missingVars: []
    };
    return checkWorkflowConfiguredInDashboards(data, dashboards() || []);
  });
  createEffect(() => {
    const data = workflow();
    if (data) {
      setName(data.name || "Untitled");
      setProtoId(data.protoId || "");
      setCaId(data.caId || (data.useTls ? ACCEPT_ALL_CA : ""));
      if (data.protoContent) {
        setProtoContent(data.protoContent);
      }
      setServerAddress(data.serverAddress || "localhost:50051");
      setSchedule(data.schedule || "");
      setConnectionId(data.connectionId || "");
      if (data.graph) {
        setGraphData(data.graph);
      }
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
      const rawSteps = data.steps || [];
      const normalizedSteps = rawSteps.map((s, idx) => {
        const cat = s.category || getStepCategory(s.type);
        let sources = s.sourceStepIds;
        if (!sources || sources.length === 0) {
          if (idx > 0 && rawSteps[idx - 1]?.id) {
            sources = [rawSteps[idx - 1].id];
          } else {
            sources = [];
          }
        }
        return {
          ...s,
          category: cat,
          sourceStepIds: sources
        };
      });
      setSteps(reconcile(normalizedSteps));
    }
  });
  createEffect(() => {
    const id = protoId();
    const protos = savedProtos();
    if (id && protos) {
      const p = protos.find((x) => x.id === id);
      if (p) {
        setProtoContent(p.content || "");
      }
    }
  });
  createEffect(() => {
    params.id;
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
    } catch (err) {
      setCompileError(err.message || "Failed to parse .proto file");
      setParsedProto(null);
    }
  });
  const updateStep = (index, key, value) => {
    setSteps(index, key, value);
    if (key === "methodName" && parsedProto()) {
      const step = steps[index];
      const service = parsedProto()?.services.find((s) => s.fullName === step.serviceName);
      const method = service?.methods.find((m) => m.name === value);
      if (method) {
        const skeleton = generateSkeleton(parsedProto().messageTypes, method.requestType);
        setSteps(index, "requestBodyTemplate", JSON.stringify(skeleton, null, 2));
      }
    }
  };
  return ssr(_tmpl$18, ssrHydrationKey(), ssrAttribute("value", escape(name(), true), false), `px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all ${hasActiveInput() ? "bg-purple-600 hover:bg-purple-500 shadow-md ring-2 ring-purple-500/50" : "bg-[#2a2a3a] text-[#5b5b6e] cursor-not-allowed"}`, ssrAttribute("title", hasActiveInput() ? "Insert {{ form.variable }} at cursor" : "Select an input field first", false), ssrAttribute("disabled", isNew || isRunning(), true), isRunning() ? _tmpl$19[0] + ssrHydrationKey() + _tmpl$19[1] : _tmpl$20[0] + ssrHydrationKey() + _tmpl$20[1], ssrAttribute("disabled", isNew || isRunning(), true), escape(createComponent(Show, {
    get when() {
      return varConfigStatus().hasVariables;
    },
    get children() {
      return ssr(_tmpl$11, ssrHydrationKey(), `mb-6 p-4 rounded-xl border flex items-center justify-between backdrop-blur-sm transition-colors ${varConfigStatus().allConfigured ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border-red-500/30 text-red-300"}`, varConfigStatus().allConfigured ? "✓" : "⚠️", varConfigStatus().allConfigured ? "Dashboard Variables Configured" : "Dashboard Variables Pending Configuration", escape(varConfigStatus().reqVars.map((v) => `{{ form.${v} }}`).join(", ")), varConfigStatus().allConfigured ? "Translucent Light Green" : "Translucent Light Red");
    }
  })), escape(createComponent(Show, {
    get when() {
      return liveStreamEvents().length > 0;
    },
    get children() {
      return ssr(_tmpl$12, ssrHydrationKey(), escape(liveStreamEvents().length), escape(createComponent(For, {
        get each() {
          return liveStreamEvents();
        },
        children: (evt) => ssr(_tmpl$21, ssrHydrationKey(), escape(evt.type) || "EVENT", escape(evt.timestamp), escape(JSON.stringify(evt.data)))
      })));
    }
  })), escape(createComponent(Show, {
    get when() {
      return runData();
    },
    get children() {
      return (() => {
        const authError = (runData()?.logs || []).find((l) => l.stepId === "auth" && l.status === "error");
        return ssr(_tmpl$24, ssrHydrationKey(), `card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border ${runData().status === "completed" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : runData().status === "failed" ? "border-red-500/20 bg-red-500/5 text-red-400" : "border-blue-500/20 bg-blue-500/5 text-blue-400"}`, `animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${runData().status === "completed" ? "bg-emerald-400" : runData().status === "failed" ? "bg-red-400" : "bg-blue-400"}`, `relative inline-flex rounded-full h-2 w-2 ${runData().status === "completed" ? "bg-emerald-500" : runData().status === "failed" ? "bg-red-500" : "bg-blue-500"}`, escape(runData().status), escape(createComponent(Show, {
          get when() {
            return runData().endTime;
          },
          get children() {
            return ssr(_tmpl$22, ssrHydrationKey(), escape(Math.max(0, new Date(runData().endTime).getTime() - new Date(runData().startTime).getTime())));
          }
        })), escape(createComponent(Show, {
          when: authError,
          get children() {
            return ssr(_tmpl$23, ssrHydrationKey(), escape(authError.error));
          }
        })));
      })();
    }
  })), `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode() === "graph" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" : "text-[#8b8b9e] hover:text-white hover:bg-[#1a1a24]"}`, `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode() === "steps" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30" : "text-[#8b8b9e] hover:text-white hover:bg-[#1a1a24]"}`, escape(steps.length), escape(createComponent(Show, {
    get when() {
      return showAddStepMenu();
    },
    get children() {
      return ssr(_tmpl$13, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return viewMode() === "graph";
    },
    get children() {
      return ssr(_tmpl$14, ssrHydrationKey(), escape(createComponent(ReteWorkflowEditor, {
        steps,
        get graph() {
          return graphData() || workflow()?.graph;
        },
        onStepsChange: (newSteps) => setSteps(reconcile(newSteps)),
        onGraphChange: (g) => setGraphData(g),
        onSelectStep: (stepId) => setSelectedStepId(stepId),
        get selectedStepId() {
          return selectedStepId();
        },
        get isExecuting() {
          return isRunning();
        }
      })));
    }
  })), `space-y-6 ${viewMode() === "graph" ? "mt-8" : ""}`, escape(createComponent(Show, {
    get when() {
      return viewMode() === "graph" && steps.length > 0;
    },
    get children() {
      return ssr(_tmpl$15, ssrHydrationKey(), escape(steps.length));
    }
  })), escape(createComponent(For, {
    each: steps,
    children: (step, index) => {
      const [resultTab, setResultTab] = createSignal("response");
      const log = createMemo(() => (runData()?.logs || []).find((l) => l.stepId === step.id));
      const stepData = createMemo(() => {
        const currentLog = log();
        if (!currentLog) return [];
        const resp = currentLog.response;
        return Array.isArray(resp) ? resp : resp ? [resp] : [];
      });
      return (() => {
        const stepCat = () => getStepCategory(step.type);
        const borderCls = () => stepCat() === "target" ? "border-l-emerald-500" : stepCat() === "transform" ? "border-l-purple-500" : "border-l-blue-500";
        const badgeCls = () => stepCat() === "target" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : stepCat() === "transform" ? "bg-purple-500/10 text-purple-300 border-purple-500/30" : "bg-blue-500/10 text-blue-300 border-blue-500/30";
        const badgeText = () => stepCat() === "target" ? "🎯 TARGET (Terminal Sink)" : stepCat() === "transform" ? "🔀 TRANSFORM (Data Processing)" : "📥 SOURCE (Data Producer)";
        return ssr(_tmpl$56, ssrHydrationKey(), `card p-5 relative border-l-4 ${escape(borderCls(), true)}`, escape(index()) + 1, `text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${escape(badgeCls(), true)}`, escape(badgeText()), escape(createComponent(Show, {
          get when() {
            return stepCat() === "target";
          },
          get children() {
            return ssr(_tmpl$25, ssrHydrationKey());
          }
        })), `grid grid-cols-1 ${runData() ? "lg:grid-cols-2" : ""} gap-6`, escape(createComponent(Show, {
          get when() {
            return stepCat() !== "source";
          },
          get children() {
            return ssr(_tmpl$26, ssrHydrationKey(), escape((step.sourceStepIds || []).length), (() => {
              const candidateSteps = () => steps.filter((s) => s.id !== step.id && getStepCategory(s.type) !== "target");
              const isConnected = (sId) => (step.sourceStepIds || []).includes(sId);
              return ssr(_tmpl$59, ssrHydrationKey(), escape(createComponent(Show, {
                get when() {
                  return candidateSteps().length > 0;
                },
                get fallback() {
                  return ssr(_tmpl$60, ssrHydrationKey());
                },
                get children() {
                  return ssr(_tmpl$57, ssrHydrationKey(), escape(createComponent(For, {
                    get each() {
                      return candidateSteps();
                    },
                    children: (cStep) => {
                      const cCat = getStepCategory(cStep.type);
                      const connected = () => isConnected(cStep.id);
                      return ssr(_tmpl$61, ssrHydrationKey(), `px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${connected() ? "bg-purple-600/30 border-purple-500 text-purple-200 shadow-md shadow-purple-500/20 ring-1 ring-purple-500/50" : "bg-[#1e1e2e] border-[#2a2a3a] text-[#8b8b9e] hover:text-white hover:border-[#4a4a5e]"}`, ssrAttribute("title", connected() ? "Click to disconnect" : "Click to connect to this step", false), connected() ? "✓" : "+", cCat === "source" ? "📥" : "🔀", escape(cStep.id), escape(cStep.type) || "grpc");
                    }
                  })));
                }
              })), escape(createComponent(Show, {
                get when() {
                  return step.type === "transform" && (step.sourceStepIds || []).length > 1;
                },
                get children() {
                  return ssr(_tmpl$58, ssrHydrationKey(), ssrAttribute("value", escape(step.mergeStrategy, true) || "concat", false));
                }
              })));
            })());
          }
        })), ssrAttribute("value", step.type === "chart" ? escape(step.chartType, true) || "bar" : escape(step.type, true) || "grpc", false), ssrAttribute("value", escape(step.id, true), false), escape(createComponent(Show, {
          get when() {
            return !step.type || step.type === "grpc";
          },
          get children() {
            return [ssr(_tmpl$29, ssrHydrationKey(), ssrAttribute("value", escape(step.serviceName, true) || "", false), ssrAttribute("disabled", !step.serviceName, true), escape(createComponent(Show, {
              get when() {
                return savedProtos() && savedProtos().length > 0;
              },
              get children() {
                return ssr(_tmpl$27, ssrHydrationKey(), escape(createComponent(For, {
                  get each() {
                    return savedProtos();
                  },
                  children: (p) => ssr(_tmpl$62, ssrHydrationKey(), `PROTO:${escape(p.id, true)}`, escape(p.name))
                })));
              }
            })), escape(createComponent(Show, {
              get when() {
                return parsedProto()?.services && parsedProto().services.length > 0;
              },
              get children() {
                return ssr(_tmpl$28, ssrHydrationKey(), escape(createComponent(For, {
                  get each() {
                    return parsedProto()?.services || [];
                  },
                  children: (svc) => ssr(_tmpl$63, ssrHydrationKey() + ssrAttribute("value", escape(svc.fullName, true), false), ssrAttribute("selected", step.serviceName === svc.fullName, true), escape(svc.fullName))
                })));
              }
            })), ssrAttribute("disabled", !step.serviceName, true) + ssrAttribute("value", escape(step.methodName, true) || "", false), escape(createComponent(For, {
              get each() {
                return parsedProto()?.services.find((s) => s.fullName === step.serviceName)?.methods || [];
              },
              children: (m) => ssr(_tmpl$64, ssrHydrationKey() + ssrAttribute("value", escape(m.name, true), false), ssrAttribute("selected", step.methodName === m.name, true), escape(m.name), escape(m.requestType), escape(m.responseType))
            }))), ssr(_tmpl$32, ssrHydrationKey(), escape(createComponent(Show, {
              get when() {
                return step.serverAddress;
              },
              get children() {
                return ssr(_tmpl$30, ssrHydrationKey());
              }
            })), `w-full rounded-lg border p-2.5 text-sm transition-all focus:outline-none placeholder:text-[#3a3a4e] ${step.serverAddress ? "border-blue-500/40 bg-[#1e1e2e] text-blue-100" : "border-[#2a2a3a] bg-[#1a1a26] text-[#8b8b9e] focus:border-blue-500/30"}`, `Fallback: ${escape(serverAddress(), true) || "None"}`, ssrAttribute("value", escape(step.serverAddress, true) || "", false), escape(createComponent(Show, {
              get when() {
                return !step.serverAddress;
              },
              get children() {
                return ssr(_tmpl$31, ssrHydrationKey());
              }
            }))), ssr(_tmpl$33, ssrHydrationKey(), ssrAttribute("value", escape(step.caId, true) ?? escape(caId(), true), false), escape(createComponent(For, {
              get each() {
                return savedCas();
              },
              children: (ca) => ssr(_tmpl$65, ssrHydrationKey() + ssrAttribute("value", escape(ca.id, true), false), escape(ca.name))
            }))), ssr(_tmpl$34, ssrHydrationKey(), ssrAttribute("value", escape(step.requestBodyTemplate, true), false)), createComponent(StepAuthSettings, {
              step,
              get index() {
                return index();
              },
              updateStep,
              get connections() {
                return connections() || [];
              }
            }), ssr(_tmpl$35, ssrHydrationKey(), ssrAttribute("value", escape(step.headersTemplate, true) || "{}", false))];
          }
        })), escape(createComponent(Show, {
          get when() {
            return step.type === "rest";
          },
          get children() {
            return ssr(_tmpl$37, ssrHydrationKey(), ssrAttribute("value", escape(step.restUrl, true) || "", false), ssrAttribute("value", escape(step.restMethod, true) || "GET", false), ssrAttribute("value", escape(step.caId, true) ?? escape(caId(), true), false), escape(createComponent(For, {
              get each() {
                return savedCas();
              },
              children: (ca) => ssr(_tmpl$65, ssrHydrationKey() + ssrAttribute("value", escape(ca.id, true), false), escape(ca.name))
            })), escape(createComponent(StepAuthSettings, {
              step,
              get index() {
                return index();
              },
              updateStep,
              get connections() {
                return connections() || [];
              }
            })), escape(createComponent(Show, {
              get when() {
                return step.restMethod !== "GET" && step.restMethod !== "DELETE";
              },
              get children() {
                return ssr(_tmpl$36, ssrHydrationKey(), ssrAttribute("value", escape(step.requestBodyTemplate, true) || "", false));
              }
            })), ssrAttribute("value", escape(step.headersTemplate, true) || "{}", false));
          }
        })), escape(createComponent(Show, {
          get when() {
            return step.type === "transform";
          },
          get children() {
            return ssr(_tmpl$38, ssrHydrationKey(), ssrAttribute("value", escape(step.transformExpression, true) || "$", false));
          }
        })), escape(createComponent(Show, {
          get when() {
            return step.type === "database";
          },
          get children() {
            return ssr(_tmpl$39, ssrHydrationKey(), ssrAttribute("value", escape(step.databaseUrl, true) || "", false), ssrAttribute("value", escape(step.databaseNs, true) || "", false), ssrAttribute("value", escape(step.databaseName, true) || "", false), ssrAttribute("value", escape(step.databaseUser, true) || "", false), ssrAttribute("value", escape(step.databasePass, true) || "", false), ssrAttribute("value", escape(step.requestBodyTemplate, true) || "", false));
          }
        })), escape(createComponent(Show, {
          get when() {
            return step.type === "table" || step.type === "chart";
          },
          get children() {
            return ssr(_tmpl$43, ssrHydrationKey(), escape(createComponent(SourceStepSelect, {
              steps,
              get currentIndex() {
                return index();
              },
              get value() {
                return step.requestBodyTemplate || "";
              },
              onChange: (val) => updateStep(index(), "requestBodyTemplate", val)
            })), ssrAttribute("value", escape(step.dataPath, true) || "", false), escape(createComponent(Show, {
              get when() {
                return step.type === "chart";
              },
              get children() {
                return ssr(_tmpl$41, ssrHydrationKey(), step.chartType?.startsWith("choropleth") ? "Geographic Region Field" : "X-Axis Property", ssrAttribute("placeholder", step.chartType?.startsWith("choropleth") ? "e.g. state" : "Auto-detect", false) + ssrAttribute("value", escape(step.xKey, true) || "", false), step.chartType?.startsWith("choropleth") ? "Value Field" : "Y-Axis Property", ssrAttribute("value", escape(step.yKey, true) || "", false), escape(createComponent(Show, {
                  get when() {
                    return step.xKey || step.yKey;
                  },
                  get children() {
                    return ssr(_tmpl$40, ssrHydrationKey(), step.chartType?.startsWith("choropleth") ? ssr(_tmpl$66, ssrHydrationKey(), escape(step.xKey), escape(step.yKey)) : ssr(_tmpl$67, ssrHydrationKey(), escape(step.xKey) || "index", escape(step.yKey) || "value"));
                  }
                })));
              }
            })), escape(createComponent(Show, {
              get when() {
                return step.type === "table";
              },
              get children() {
                return ssr(_tmpl$42, ssrHydrationKey(), escape(createComponent(For, {
                  get each() {
                    return step.columns || [];
                  },
                  children: (col, ci) => ssr(_tmpl$68, ssrHydrationKey(), ssrAttribute("value", escape(col, true), false))
                })));
              }
            })));
          }
        })), escape(createComponent(Show, {
          get when() {
            return runData();
          },
          get children() {
            return ssr(_tmpl$55, ssrHydrationKey(), escape(createComponent(Show, {
              get when() {
                return log();
              },
              get fallback() {
                return ssr(_tmpl$71, ssrHydrationKey(), escape(createComponent(Show, {
                  get when() {
                    return isRunning() && !(runData()?.logs || []).some((l) => l.stepId === "auth" || l.status === "error");
                  },
                  get fallback() {
                    return ssr(_tmpl$72, ssrHydrationKey());
                  },
                  get children() {
                    return [ssr(_tmpl$69, ssrHydrationKey()), ssr(_tmpl$70, ssrHydrationKey())];
                  }
                })));
              },
              get children() {
                return [ssr(_tmpl$47, ssrHydrationKey(), `px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${log().status === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`, escape(log().status), escape(createComponent(Show, {
                  get when() {
                    return log().latencyMs;
                  },
                  get children() {
                    return ssr(_tmpl$44, ssrHydrationKey(), escape(log().latencyMs));
                  }
                })), escape(createComponent(Show, {
                  get when() {
                    return !step.type || step.type === "grpc" || step.type === "rest" || step.type === "database" || step.type === "transform";
                  },
                  get children() {
                    return ssr(_tmpl$45, ssrHydrationKey(), `px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${resultTab() === "response" ? "bg-emerald-500/10 text-emerald-400" : "text-[#5b5b6e] hover:text-[#8b8b9e]"}`, `px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${resultTab() === "payload" ? "bg-blue-500/10 text-blue-400" : "text-[#5b5b6e] hover:text-[#8b8b9e]"}`);
                  }
                })), escape(createComponent(Show, {
                  get when() {
                    return step.type === "table" || step.type === "chart";
                  },
                  get children() {
                    return ssr(_tmpl$46, ssrHydrationKey(), escape(stepData().length));
                  }
                }))), ssr(_tmpl$54, ssrHydrationKey(), escape(createComponent(Show, {
                  get when() {
                    return !step.type || step.type === "grpc" || step.type === "rest" || step.type === "database" || step.type === "transform";
                  },
                  get children() {
                    return [createComponent(Show, {
                      get when() {
                        return resultTab() === "payload";
                      },
                      get children() {
                        return [ssr(_tmpl$48, ssrHydrationKey()), ssr(_tmpl$49, ssrHydrationKey(), escape(JSON.stringify(log().request, null, 2)))];
                      }
                    }), createComponent(Show, {
                      get when() {
                        return resultTab() === "response";
                      },
                      get children() {
                        return [ssr(_tmpl$50, ssrHydrationKey()), ssr(_tmpl$51, ssrHydrationKey(), `text-[11px] font-mono overflow-auto max-h-[220px] bg-[#0a0a0f] p-3 rounded-lg border border-[#2a2a3a]/40 custom-scrollbar whitespace-pre-wrap break-all flex-1 ${log().error ? "text-red-300 border-red-500/20 bg-red-950/5" : "text-emerald-300"}`, escape(log().error) || escape(JSON.stringify(log().response, null, 2)))];
                      }
                    })];
                  }
                })), escape(createComponent(Show, {
                  get when() {
                    return step.type === "table";
                  },
                  get children() {
                    return ssr(_tmpl$52, ssrHydrationKey(), escape(createComponent(Show, {
                      get when() {
                        return stepData().length > 0;
                      },
                      get fallback() {
                        return ssr(_tmpl$73, ssrHydrationKey());
                      },
                      get children() {
                        return createComponent(LogTable, {
                          get data() {
                            return stepData();
                          },
                          get columns() {
                            return log().meta?.columns;
                          }
                        });
                      }
                    })));
                  }
                })), escape(createComponent(Show, {
                  get when() {
                    return step.type === "chart";
                  },
                  get children() {
                    return ssr(_tmpl$53, ssrHydrationKey(), escape(createComponent(Show, {
                      get when() {
                        return stepData().length > 0;
                      },
                      get fallback() {
                        return ssr(_tmpl$74, ssrHydrationKey());
                      },
                      get children() {
                        return createComponent(Show, {
                          get when() {
                            return step.chartType === "timeline";
                          },
                          get fallback() {
                            return createComponent(LogChart, {
                              get data() {
                                return stepData();
                              },
                              get xKey() {
                                return log().meta?.xKey || step.xKey;
                              },
                              get yKey() {
                                return log().meta?.yKey || step.yKey;
                              },
                              get chartType() {
                                return log().meta?.chartType || step.chartType || "bar";
                              }
                            });
                          },
                          get children() {
                            return createComponent(LogTimeline, {
                              get data() {
                                return stepData();
                              },
                              get xKey() {
                                return log().meta?.xKey || step.xKey;
                              },
                              get yKey() {
                                return log().meta?.yKey || step.yKey;
                              }
                            });
                          }
                        });
                      }
                    })));
                  }
                })))];
              }
            })));
          }
        })));
      })();
    }
  })), escape(createComponent(Show, {
    get when() {
      return steps.length === 0;
    },
    get children() {
      return ssr(_tmpl$16, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return showSettings();
    },
    get children() {
      return ssr(_tmpl$17, ssrHydrationKey(), ssrAttribute("value", escape(protoId(), true), false), escape(createComponent(Show, {
        get when() {
          return !savedProtos.loading;
        },
        get children() {
          return createComponent(For, {
            get each() {
              return savedProtos();
            },
            children: (p) => ssr(_tmpl$65, ssrHydrationKey() + ssrAttribute("value", escape(p.id, true), false), escape(p.name))
          });
        }
      })), ssrAttribute("value", escape(serverAddress(), true), false), ssrAttribute("value", escape(caId(), true), false), escape(createComponent(Show, {
        get when() {
          return !savedCas.loading;
        },
        get children() {
          return createComponent(For, {
            get each() {
              return savedCas();
            },
            children: (ca) => ssr(_tmpl$65, ssrHydrationKey() + ssrAttribute("value", escape(ca.id, true), false), escape(ca.name))
          });
        }
      })), ssrAttribute("value", escape(schedule(), true), false), ssrAttribute("value", escape(connectionId(), true) || "", false), escape(createComponent(Show, {
        get when() {
          return !connections.loading;
        },
        get children() {
          return createComponent(For, {
            get each() {
              return connections();
            },
            children: (conn) => ssr(_tmpl$65, ssrHydrationKey() + ssrAttribute("value", escape(conn.id, true), false), escape(conn.name))
          });
        }
      })));
    }
  })));
}
function StepAuthSettings(props) {
  const currentAuthType = () => props.step?.authType || "none";
  const selectedConnection = () => {
    if (!props.step || !props.connections) return void 0;
    return props.connections.find((c) => c.id === props.step.connectionId);
  };
  return ssr(_tmpl$78, ssrHydrationKey(), `flex-1 py-1 text-xs font-bold rounded transition-all ${currentAuthType() === "none" ? "bg-blue-600 text-white shadow" : "text-[#8b8b9e] hover:text-white"}`, `flex-1 py-1 text-xs font-bold rounded transition-all ${currentAuthType() === "basic" ? "bg-blue-600 text-white shadow" : "text-[#8b8b9e] hover:text-white"}`, `flex-1 py-1 text-xs font-bold rounded transition-all ${currentAuthType() === "oauth" ? "bg-blue-600 text-white shadow" : "text-[#8b8b9e] hover:text-white"}`, escape(createComponent(Show, {
    get when() {
      return currentAuthType() === "basic";
    },
    get children() {
      return ssr(_tmpl$75, ssrHydrationKey(), ssrAttribute("value", escape(props.step?.authUsername, true) || "", false), ssrAttribute("value", escape(props.step?.authPassword, true) || "", false));
    }
  })), escape(createComponent(Show, {
    get when() {
      return currentAuthType() === "oauth";
    },
    get children() {
      return ssr(_tmpl$77, ssrHydrationKey(), ssrAttribute("value", escape(props.step?.connectionId, true) || "", false), escape(createComponent(For, {
        get each() {
          return props.connections || [];
        },
        children: (conn) => ssr(_tmpl$65, ssrHydrationKey() + ssrAttribute("value", escape(conn.id, true), false), escape(conn.name))
      })), escape(createComponent(Show, {
        get when() {
          return selectedConnection();
        },
        get children() {
          return ssr(_tmpl$76, ssrHydrationKey(), escape(selectedConnection()?.tokenPath) || "access_token");
        }
      })));
    }
  })));
}
export {
  WorkflowBuilder as default,
  id$$
};
//# sourceMappingURL=_id_-Dnrb5JgJ.js.map
