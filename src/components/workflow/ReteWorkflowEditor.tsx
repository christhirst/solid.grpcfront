import { createSignal, onMount, onCleanup, Show, For, createEffect } from "solid-js";
import { isServer } from "solid-js/web";
import { NodeEditor, GetSchemes, ClassicPreset } from "rete";
import { AreaPlugin, AreaExtensions } from "rete-area-plugin";
import { ConnectionPlugin, Presets as ConnectionPresets } from "rete-connection-plugin";
import { SolidPlugin, Presets as SolidPresets, SolidArea2D } from "solid-rete-plugin";
import { AutoArrangePlugin, Presets as ArrangePresets } from "rete-auto-arrange-plugin";
import { WorkflowStep, getStepCategory, StepCategory } from "~/lib/stepCategories";

const dataSocket = new ClassicPreset.Socket("data");

export class StepNode extends ClassicPreset.Node {
  width = 290;
  height = 200;
  stepId: string;
  stepType: string;
  category: StepCategory;
  step: WorkflowStep;
  inputKeys: string[] = [];

  constructor(step: WorkflowStep) {
    const cat = getStepCategory(step.type, step.category, step.sourceStepIds);
    const typeInfo = getStepDisplayInfo(step.type || "grpc", cat);
    const categoryTag = cat === "target" ? " (Target)" : cat === "transform" ? " (Transform)" : " (Source)";
    super(`${typeInfo.icon} ${step.id || "Step"}${categoryTag}`);
    this.stepId = step.id;
    this.stepType = step.type || "grpc";
    this.category = cat;
    this.step = { ...step, category: this.category };

    this.setupSocketsByCategory();
  }

  setupSocketsByCategory() {
    // 1. SOURCES: Pure data producers. Starts the flow. Outputs data.
    if (this.category === "source") {
      if (!this.outputs["data"]) {
        this.addOutput("data", new ClassicPreset.Output(dataSocket, "Data Output"));
      }
      return;
    }

    // 2. TRANSFORMS & SERVICE CALLS (gRPC, HTTP, Database, JSONata):
    // Takes inputs from upstream, performs transformation or remote service invocation, and outputs the response.
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

      // Transforms MUST have an output to flow response downstream to next step
      if (!this.outputs["data"]) {
        const outLabel = this.stepType === "grpc" || this.stepType === "rest" || this.stepType === "database"
          ? "Service Response"
          : "Output";
        this.addOutput("data", new ClassicPreset.Output(dataSocket, outLabel));
      }
      return;
    }

    // 3. TARGETS: Visual terminal sinks. STRICTLY NO OUTPUT SOCKETS. Cannot start a flow.
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

      // NO OUTPUT SOCKETS ADDED. Target is strictly terminal!
      return;
    }
  }

  addExtraSourceSocket(): string {
    const newIdx = this.inputKeys.filter(k => k.startsWith("source_")).length + 1;
    const newKey = `source_${newIdx}`;
    if (!this.inputs[newKey]) {
      const label = this.category === "target" ? `Target Input ${newIdx}` : `Input ${newIdx}`;
      this.addInput(newKey, new ClassicPreset.Input(dataSocket, label, true));
      this.inputKeys.push(newKey);
    }
    return newKey;
  }
}

type Schemes = GetSchemes<
  StepNode,
  ClassicPreset.Connection<StepNode, StepNode>
>;
type AreaExtra = SolidArea2D<Schemes>;

export interface ReteWorkflowEditorProps {
  steps: WorkflowStep[];
  graph?: { nodes?: any[]; connections?: any[]; position?: [number, number]; zoom?: number };
  onStepsChange: (steps: WorkflowStep[]) => void;
  onGraphChange?: (graph: any) => void;
  onSelectStep?: (stepId: string) => void;
  selectedStepId?: string;
  isExecuting?: boolean;
}

export function getStepDisplayInfo(type: string, category?: StepCategory) {
  const cat = category || getStepCategory(type);
  switch (type) {
    case "table":
      return { category: "target" as StepCategory, label: "Table Target", icon: "📊", color: "emerald", border: "border-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10" };
    case "chart":
      return { category: "target" as StepCategory, label: "Chart Target", icon: "📈", color: "pink", border: "border-pink-500", text: "text-pink-400", bg: "bg-pink-500/10" };
    case "infographic":
      return { category: "target" as StepCategory, label: "Infographic Target", icon: "🦋", color: "rose", border: "border-rose-500", text: "text-rose-400", bg: "bg-rose-500/10" };
    case "transform":
      return { category: "transform" as StepCategory, label: "JSONata Transformer", icon: "🔀", color: "purple", border: "border-purple-500", text: "text-purple-400", bg: "bg-purple-500/10" };
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

export default function ReteWorkflowEditor(props: ReteWorkflowEditorProps) {
  let containerRef!: HTMLDivElement;
  let editor: NodeEditor<Schemes> | null = null;
  let area: AreaPlugin<Schemes, AreaExtra> | null = null;
  let arrange: AutoArrangePlugin<Schemes> | null = null;
  let isInternalSync = false;
  let hasDoneInitialLayout = false;

  const [nodeCount, setNodeCount] = createSignal(0);
  const [connectionCount, setConnectionCount] = createSignal(0);
  const [showAddMenu, setShowAddMenu] = createSignal(false);
  const [selectedNodeId, setSelectedNodeId] = createSignal<string | null>(props.selectedStepId || null);

  const getCategoryCounts = () => {
    let sources = 0;
    let transforms = 0;
    let targets = 0;
    (props.steps || []).forEach(s => {
      const c = getStepCategory(s.type, s.category, s.sourceStepIds);
      if (c === "source") sources++;
      else if (c === "transform") transforms++;
      else if (c === "target") targets++;
    });
    return { sources, transforms, targets };
  };

  const syncConnectionsToSteps = () => {
    if (!editor || isInternalSync) return;
    isInternalSync = true;

    try {
      const connections = editor.getConnections();
      setConnectionCount(connections.length);

      const nodes = editor.getNodes();
      setNodeCount(nodes.length);

      // Map upstream source steps to target/transform steps
      const stepSourceMap: Record<string, string[]> = {};
      for (const conn of connections) {
        const sourceNode = editor.getNode(conn.source);
        const targetNode = editor.getNode(conn.target);
        if (sourceNode && targetNode) {
          if (!stepSourceMap[targetNode.stepId]) {
            stepSourceMap[targetNode.stepId] = [];
          }
          if (!stepSourceMap[targetNode.stepId].includes(sourceNode.stepId)) {
            stepSourceMap[targetNode.stepId].push(sourceNode.stepId);
          }
        }
      }

      // Update steps list
      const updatedSteps = nodes.map(node => {
        const sources = stepSourceMap[node.stepId] || [];
        const cat = getStepCategory(node.stepType, node.category, sources);
        return {
          ...node.step,
          id: node.stepId,
          type: node.stepType as any,
          category: cat,
          sourceStepIds: sources,
        };
      });

      props.onStepsChange(updatedSteps);

      // Save graph layout
      if (props.onGraphChange && area) {
        const nodePositions = nodes.map(node => {
          const view = area?.nodeViews.get(node.id);
          return {
            id: node.id,
            stepId: node.stepId,
            position: view?.position || { x: 0, y: 0 },
          };
        });

        const serializedConnections = connections.map(c => ({
          id: c.id,
          source: c.source,
          sourceOutput: c.sourceOutput,
          target: c.target,
          targetInput: c.targetInput,
        }));

        props.onGraphChange({
          nodes: nodePositions,
          connections: serializedConnections,
          zoom: area.area.transform.k,
          position: [area.area.transform.x, area.area.transform.y],
        });
      }
    } finally {
      isInternalSync = false;
    }
  };

  // Synchronize Rete graph whenever external props.steps changes
  const syncFromExternalSteps = async (stepsList: WorkflowStep[]) => {
    if (!editor || !area || isInternalSync) return;
    isInternalSync = true;

    try {
      const currentNodes = editor.getNodes();
      const nodeByStepId = new Map<string, StepNode>();
      for (const node of currentNodes) {
        nodeByStepId.set(node.stepId, node);
      }

      // 1. Add missing nodes or update existing nodes
      for (let i = 0; i < stepsList.length; i++) {
        const step = stepsList[i];
        let node = nodeByStepId.get(step.id);
        if (!node) {
          node = new StepNode(step);
          await editor.addNode(node);
          nodeByStepId.set(step.id, node);
          const cat = node.category;
          const posX = cat === "source" ? 80 : cat === "transform" ? 440 : 800;
          const posY = 80 + i * 220;
          await area.translate(node.id, { x: posX, y: posY });
        } else {
          node.step = step;
        }
      }

      // 2. Remove nodes that are no longer in stepsList
      const validStepIds = new Set(stepsList.map(s => s.id));
      for (const node of currentNodes) {
        if (!validStepIds.has(node.stepId)) {
          const conns = editor.getConnections().filter(c => c.source === node.id || c.target === node.id);
          for (const c of conns) {
            await editor.removeConnection(c.id);
          }
          await editor.removeNode(node.id);
          nodeByStepId.delete(node.stepId);
        }
      }

      // 3. Sync connections according to step.sourceStepIds
      const currentConns = editor.getConnections();
      const desiredConnKeys = new Set<string>();

      for (const step of stepsList) {
        const targetNode = nodeByStepId.get(step.id);
        if (!targetNode) continue;
        const sources = step.sourceStepIds || [];

        for (let idx = 0; idx < sources.length; idx++) {
          const srcId = sources[idx];
          const sourceNode = nodeByStepId.get(srcId);
          if (!sourceNode) continue;

          desiredConnKeys.add(`${sourceNode.id}->${targetNode.id}`);

          // Check if connection already exists
          const exists = currentConns.some(c => c.source === sourceNode.id && c.target === targetNode.id);
          if (!exists) {
            // Find or allocate input socket
            let inputKey = targetNode.inputKeys[idx];
            if (!inputKey || !targetNode.inputs[inputKey]) {
              inputKey = targetNode.addExtraSourceSocket();
            }
            const outputKey = Object.keys(sourceNode.outputs)[0] || "data";
            try {
              await editor.addConnection(
                new ClassicPreset.Connection(sourceNode, outputKey, targetNode, inputKey)
              );
            } catch (err) {
              console.warn("[Rete] Could not add connection from sync:", err);
            }
          }
        }
      }

      // 4. Remove connections that were unselected / disconnected
      for (const conn of editor.getConnections()) {
        const srcNode = editor.getNode(conn.source);
        const tgtNode = editor.getNode(conn.target);
        if (srcNode && tgtNode) {
          const key = `${srcNode.id}->${tgtNode.id}`;
          if (!desiredConnKeys.has(key)) {
            await editor.removeConnection(conn.id);
          }
        }
      }

      setNodeCount(editor.getNodes().length);
      setConnectionCount(editor.getConnections().length);

      if (!hasDoneInitialLayout && stepsList.length > 0 && area) {
        hasDoneInitialLayout = true;
        setTimeout(() => {
          if (area && editor) {
            AreaExtensions.zoomAt(area, editor.getNodes());
          }
        }, 150);
      }
    } finally {
      isInternalSync = false;
    }
  };

  const initializeEditor = async () => {
    if (isServer || !containerRef) return;

    containerRef.innerHTML = "";

    editor = new NodeEditor<Schemes>();
    area = new AreaPlugin<Schemes, AreaExtra>(containerRef);
    const connection = new ConnectionPlugin<Schemes, AreaExtra>();
    const render = new SolidPlugin<Schemes, AreaExtra>();
    arrange = new AutoArrangePlugin<Schemes>();

    // Configure presets
    render.addPreset(SolidPresets.classic.setup());
    connection.addPreset(ConnectionPresets.classic.setup());
    arrange.addPreset(ArrangePresets.classic.setup());

    editor.use(area);
    area.use(connection);
    area.use(render);
    area.use(arrange);

    // Event listeners
    editor.addPipe((context) => {
      if (
        context.type === "connectioncreated" ||
        context.type === "connectionremoved" ||
        context.type === "nodecreated" ||
        context.type === "noderemoved"
      ) {
        setTimeout(syncConnectionsToSteps, 50);
      }
      return context;
    });

    area.addPipe((context) => {
      if (context.type === "nodetranslated") {
        setTimeout(syncConnectionsToSteps, 200);
      }
      if (context.type === "nodepicked") {
        const node = editor?.getNode(context.data.id);
        if (node) {
          setSelectedNodeId(node.stepId);
          if (props.onSelectStep) props.onSelectStep(node.stepId);
        }
      }
      return context;
    });

    // Populate initial steps
    if (props.steps && props.steps.length > 0) {
      await syncFromExternalSteps(props.steps);
    }
  };

  // Deep reactive effect: Synchronize Rete graph whenever props.steps changes or loads
  createEffect(() => {
    const stepsSnapshot = (props.steps || []).map(s => ({
      id: s.id,
      type: s.type,
      category: s.category || getStepCategory(s.type, s.category, s.sourceStepIds),
      sourceStepIds: [...(s.sourceStepIds || [])],
    }));
    const trackKey = JSON.stringify(stepsSnapshot);

    if (editor && area && trackKey) {
      syncFromExternalSteps(props.steps || []);
    }
  });

  onMount(() => {
    initializeEditor();
  });

  onCleanup(() => {
    if (area) area.destroy();
  });

  const handleAddNode = async (type: string, explicitCategory?: StepCategory) => {
    if (!editor || !area) return;
    setShowAddMenu(false);

    const cat = explicitCategory || getStepCategory(type);
    const newStepId = `step_${Math.random().toString(36).substr(2, 9)}`;
    const newStep: WorkflowStep = {
      id: newStepId,
      type: type as any,
      category: cat,
      serviceName: "",
      methodName: "",
      requestBodyTemplate: "{}",
      sourceStepIds: [],
      chartType: "bar",
      infographicTemplate: "list-row-simple-horizontal-arrow",
      transformExpression: "$",
      transformType: "jsonata",
    };

    const node = new StepNode(newStep);
    await editor.addNode(node);

    // Place new node according to its category column
    const colX = cat === "source" ? 80 : cat === "transform" ? 440 : 800;
    const viewPos = {
      x: colX + Math.random() * 40,
      y: -area.area.transform.y / area.area.transform.k + 120 + Math.random() * 60,
    };
    await area.translate(node.id, viewPos);

    setSelectedNodeId(newStepId);
    if (props.onSelectStep) props.onSelectStep(newStepId);

    syncConnectionsToSteps();
  };

  const handleDeleteSelected = async () => {
    if (!editor || !selectedNodeId()) return;
    const node = editor.getNodes().find(n => n.stepId === selectedNodeId());
    if (node) {
      const connections = editor.getConnections().filter(
        c => c.source === node.id || c.target === node.id
      );
      for (const c of connections) {
        await editor.removeConnection(c.id);
      }
      await editor.removeNode(node.id);
      setSelectedNodeId(null);
      syncConnectionsToSteps();
    }
  };

  const handleAutoArrange = async () => {
    if (!arrange || !area || !editor) return;
    try {
      await arrange.layout({
        options: {
          "elk.algorithm": "layered",
          "elk.direction": "RIGHT",
          "elk.layered.spacing.nodeNodeBetweenLayers": "160",
          "elk.spacing.nodeNode": "80",
        },
      });
      await AreaExtensions.zoomAt(area, editor.getNodes());
      syncConnectionsToSteps();
    } catch (e) {
      console.warn("Auto arrange failed:", e);
    }
  };

  const handleFitView = () => {
    if (area && editor) {
      AreaExtensions.zoomAt(area, editor.getNodes());
    }
  };

  return (
    <div class={`relative w-full h-[620px] rounded-2xl bg-[#0c0c14] border border-[#2a2a3a] overflow-hidden shadow-2xl ${props.isExecuting ? "workflow-executing" : ""}`}>
      {/* Top Toolbar */}
      <div class="absolute top-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Left Action Buttons */}
        <div class="flex items-center gap-2 bg-[#12121a]/95 backdrop-blur-md border border-[#2a2a3a] rounded-xl p-1.5 shadow-xl pointer-events-auto">
          {/* Add Node Dropdown */}
          <div class="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu())}
              class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Add Node</span>
            </button>

            <Show when={showAddMenu()}>
              <div class="absolute left-0 mt-2 w-72 rounded-2xl bg-[#181824] border border-[#2a2a3a] shadow-2xl z-50 overflow-hidden py-1 divide-y divide-[#2a2a3a]/50">
                {/* 1. SOURCES */}
                <div class="p-1">
                  <div class="px-3 py-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📥 1. SOURCES</span>
                    <span class="text-[9px] text-[#5b5b6e] font-normal">(Start Flow • Output Only)</span>
                  </div>
                  <button
                    onClick={() => handleAddNode("grpc", "source")}
                    class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-blue-300 rounded-lg flex items-center gap-2"
                  >
                    <span>⚡</span> <span>gRPC Request</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("rest", "source")}
                    class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-cyan-300 rounded-lg flex items-center gap-2"
                  >
                    <span>🌐</span> <span>HTTP / REST API</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("database", "source")}
                    class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-amber-300 rounded-lg flex items-center gap-2"
                  >
                    <span>🗄️</span> <span>Database / SurrealQL</span>
                  </button>
                </div>

                {/* 2. TRANSFORMS & SERVICE CALLS */}
                <div class="p-1">
                  <div class="px-3 py-1.5 text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🔀 2. TRANSFORMS & SERVICES</span>
                    <span class="text-[9px] text-[#5b5b6e] font-normal">(In ➔ Service / Logic ➔ Out)</span>
                  </div>
                  <button
                    onClick={() => handleAddNode("transform", "transform")}
                    class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-purple-300 rounded-lg flex items-center gap-2"
                  >
                    <span>🔀</span> <span>JSONata Transformer / Merger</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("grpc", "transform")}
                    class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-blue-300 rounded-lg flex items-center gap-2"
                  >
                    <span>⚡</span> <span>gRPC Service Call (Transform)</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("rest", "transform")}
                    class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-cyan-300 rounded-lg flex items-center gap-2"
                  >
                    <span>🌐</span> <span>HTTP / REST Call (Transform)</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("database", "transform")}
                    class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-amber-300 rounded-lg flex items-center gap-2"
                  >
                    <span>🗄️</span> <span>Database Mutation / Query</span>
                  </button>
                </div>

                {/* 3. TARGETS */}
                <div class="p-1">
                  <div class="px-3 py-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🎯 3. TARGETS</span>
                    <span class="text-[9px] text-[#5b5b6e] font-normal">(Terminal Sinks • Input Only)</span>
                  </div>
                  <button
                    onClick={() => handleAddNode("table", "target")}
                    class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-emerald-300 rounded-lg flex items-center gap-2"
                  >
                    <span>📊</span> <span>Data Table</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("chart", "target")}
                    class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-pink-300 rounded-lg flex items-center gap-2"
                  >
                    <span>📈</span> <span>Chart Visualizer</span>
                  </button>
                  <button
                    onClick={() => handleAddNode("infographic", "target")}
                    class="w-full text-left px-3 py-1.5 hover:bg-[#222234] text-xs text-rose-300 rounded-lg flex items-center gap-2"
                  >
                    <span>🦋</span> <span>AntV Infographic Diagram</span>
                  </button>
                </div>
              </div>
            </Show>
          </div>

          <div class="h-4 w-px bg-[#2a2a3a]" />

          {/* Auto Arrange */}
          <button
            onClick={handleAutoArrange}
            class="px-2.5 py-1.5 rounded-lg bg-[#1a1a24] hover:bg-[#252535] text-[#c8c8d8] text-xs font-medium flex items-center gap-1.5 border border-[#2a2a3a]/50 transition-colors"
            title="Automatically arrange Source ➔ Transform ➔ Target columns"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polyline></svg>
            <span>Auto Layout</span>
          </button>

          {/* Fit View */}
          <button
            onClick={handleFitView}
            class="px-2.5 py-1.5 rounded-lg bg-[#1a1a24] hover:bg-[#252535] text-[#c8c8d8] text-xs font-medium flex items-center gap-1.5 border border-[#2a2a3a]/50 transition-colors"
            title="Fit graph to screen"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
            <span>Fit View</span>
          </button>

          <Show when={selectedNodeId()}>
            <div class="h-4 w-px bg-[#2a2a3a]" />
            <button
              onClick={handleDeleteSelected}
              class="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium flex items-center gap-1.5 border border-red-500/30 transition-colors"
              title="Delete selected step"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span>Delete</span>
            </button>
          </Show>
        </div>

        {/* Right Info: 3 Category Counts */}
        <div class="flex items-center gap-2.5 bg-[#12121a]/95 backdrop-blur-md border border-[#2a2a3a] rounded-xl px-3 py-1.5 shadow-xl pointer-events-auto text-xs font-semibold">
          <span class="text-blue-400 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            {getCategoryCounts().sources} Sources
          </span>
          <span class="text-[#5b5b6e]">➔</span>
          <span class="text-purple-400 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            {getCategoryCounts().transforms} Transforms
          </span>
          <span class="text-[#5b5b6e]">➔</span>
          <span class="text-emerald-400 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {getCategoryCounts().targets} Targets
          </span>
        </div>
      </div>

      {/* Rete Canvas Mount Target */}
      <div
        ref={containerRef}
        class="w-full h-full cursor-grab active:cursor-grabbing select-none"
        style={{
          "background-image": `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.06) 1px, transparent 0)`,
          "background-size": "24px 24px",
        }}
      />

      {/* Bottom Category Pipeline Architecture Banner */}
      <div class="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none text-[11px] text-[#5b5b6e]">
        <div class="flex items-center gap-3 bg-[#0a0a0f]/90 backdrop-blur px-3 py-1.5 rounded-lg border border-[#2a2a3a]/50">
          <span class="text-blue-400 font-bold">📥 Source (Start)</span>
          <span>➔</span>
          <span class="text-purple-400 font-bold">🔀 Transform (Processing & Service Calls)</span>
          <span>➔</span>
          <span class="text-emerald-400 font-bold">🎯 Target (Terminal Sink)</span>
        </div>
        <div class="hidden sm:block bg-[#0a0a0f]/90 backdrop-blur px-3 py-1.5 rounded-lg border border-[#2a2a3a]/50 text-slate-400">
          Sources start flows • Transforms process and call remote services • Targets render outputs
        </div>
      </div>
    </div>
  );
}
