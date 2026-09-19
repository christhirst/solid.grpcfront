import { ssrElement, mergeProps, escape, isServer, ssr, ssrHydrationKey, ssrAttribute, createComponent, ssrStyle } from "solid-js/web";
import { splitProps, createSignal, createResource, onMount, For, Show, createMemo, createEffect } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { D as DefaultChart } from "./index-D4uTJpLk.js";
import { Chart, registerables } from "chart.js";
import * as ChartGeo from "chartjs-chart-geo";
import get from "lodash.get";
import { c as checkWidgetVariablesConfigured } from "./workflowVariableChecker-CcT-pYzg.js";
import { D as DashboardGrid } from "./DashboardGrid-B4n-WQG5.js";
import { D as DashboardButtonFormWidget, d as defaultEffectiveConfig, n as newsColorClasses, e as evaluateNewsRules } from "./newsRulesEvaluator-DTKSj8r8.js";
import { b as useParams, u as useNavigate, B as Badge } from "../../entry-server.js";
import { A } from "./components-DY6vXCQs.js";
import "gridstack";
import "pathe";
import "radix3";
import "seroval";
import "seroval-plugins/web";
import "@auth/solid-start/client";
import "h3";
import "solid-js/web/storage";
import "cookie-es";
function TabsList(props) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return ssrElement("div", mergeProps({
    get ["class"]() {
      return `inline-flex items-center justify-center rounded-xl bg-zinc-900/80 p-1 border border-zinc-800 text-zinc-400 ${local.class || ""}`;
    }
  }, rest), () => escape(local.children), true);
}
function TabsTrigger(props) {
  const [local, rest] = splitProps(props, ["active", "class", "children"]);
  return ssrElement("button", mergeProps({
    type: "button",
    get ["class"]() {
      return `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50 select-none ${local.active ? "bg-purple-600 text-white shadow-sm shadow-purple-500/20" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"} ${local.class || ""}`;
    }
  }, rest), () => escape(local.children), true);
}
var _tmpl$ = ["<svg", ' width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'], _tmpl$2 = ["<svg", ' width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>'], _tmpl$3 = ["<div", ' class="absolute right-0 top-10 z-20 bg-[#1a1a26] border border-[#2a2a3a] rounded-xl shadow-2xl overflow-hidden w-52"><div class="px-3 py-2 text-[10px] font-bold text-[#5b5b6e] uppercase tracking-wider border-b border-[#2a2a3a]">Choose Widget Type</div><!--$-->', "<!--/--></div>"], _tmpl$4 = ["<div", ' class="rounded-xl border border-dashed border-[#2a2a3a] py-16 text-center bg-[#0a0a0f]/50"><p class="text-[#8b8b9e] text-sm">No widgets yet. Click "Add Widget" to begin.</p></div>'], _tmpl$5 = ["<svg", ' width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>'], _tmpl$6 = ["<div", ' class="text-center text-[#5b5b6e] text-xs py-10 border border-dashed border-[#2a2a3a] rounded-lg">Widgets will appear here</div>'], _tmpl$7 = ["<div", ' class="grid grid-cols-1 lg:grid-cols-12 gap-8"><div class="lg:col-span-8 space-y-6"><div class="flex items-center justify-between"><h2 class="text-lg font-bold text-white flex items-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>Widget Configuration</h2><div class="relative"><button class="btn-secondary text-xs flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Add Widget</button><!--$-->', '<!--/--></div></div><div class="space-y-4"><!--$-->', "<!--/--><!--$-->", '<!--/--></div></div><div class="lg:col-span-4 pl-0 lg:pl-4 border-t lg:border-t-0 lg:border-l border-[#2a2a3a]/50 pt-8 lg:pt-0"><h2 class="text-sm font-bold text-[#8b8b9e] mb-4 tracking-wider uppercase flex items-center justify-between"><span>Live Preview</span><div class="flex items-center gap-2.5"><button type="button" class="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 normal-case tracking-normal font-semibold" title="Arrange widgets in 12-column canvas"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>Arrange</button><!--$-->', '<!--/--></div></h2><div class="bg-[#0a0a0f] rounded-2xl border border-[#2a2a3a] overflow-hidden min-h-[400px] shadow-2xl relative"><div class="bg-[#1e1e2e] px-4 py-3 flex items-center gap-2 border-b border-[#2a2a3a]"><div class="flex gap-1.5"><div class="w-3 h-3 rounded-full bg-red-500/80"></div><div class="w-3 h-3 rounded-full bg-yellow-500/80"></div><div class="w-3 h-3 rounded-full bg-green-500/80"></div></div><div class="mx-auto bg-[#0a0a0f] text-center rounded-md px-16 py-1 text-[10px] text-[#5b5b6e] font-mono truncate hidden sm:block">', '</div></div><div class="p-4"><h1 class="text-xl font-bold text-white mb-6 text-center">', "</h1><!--$-->", "<!--/--><!--$-->", "<!--/--></div></div></div></div>"], _tmpl$8 = ["<span", ">Public View</span>"], _tmpl$9 = ["<div", ' class="space-y-6"><div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-purple-500/20 bg-[#12121e]"><div><div class="flex items-center gap-2"><h2 class="text-lg font-bold text-white flex items-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-purple-400"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>12-Column Grid Canvas Arranger</h2><span class="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 uppercase">Interactive Drag & Resize</span></div><p class="text-xs text-[#8b8b9e] mt-1">Drag by the top header bar to position widgets across 12 columns. Grab border handles to resize. Layout is saved automatically.</p></div><div class="flex items-center gap-2.5"><button type="button" class="btn-secondary text-xs flex items-center gap-1.5" title="Sequentially pack widgets into 12 columns"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>Auto Pack</button><button type="button" class="btn-primary bg-purple-600 hover:bg-purple-500 text-white text-xs flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>Save Layout</button><!--$-->', '<!--/--></div></div><div class="rounded-2xl border border-[#2a2a3a] bg-[#0a0a0f] p-6 shadow-2xl min-h-[500px]">', "</div></div>"], _tmpl$0 = ["<main", ' class="mx-auto max-w-7xl px-6 py-12"><div class="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"><div class="min-w-0 flex-1"><input class="bg-transparent text-3xl font-extrabold tracking-tight text-white border-none outline-none focus:ring-2 focus:ring-purple-500 rounded px-2 -ml-2 transition-all w-full"', ' placeholder="Dashboard Name"><div class="mt-2 ml-0"><textarea class="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300 placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-colors resize-none" rows="2"', ' placeholder="Add a description for this dashboard..."></textarea></div><div class="mt-2 flex flex-wrap items-center gap-2"><!--$-->', '<!--/--><input class="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none w-32" placeholder="Add tag..."', "></div></div><!--$-->", '<!--/--><div class="flex items-center gap-4"><label class="flex items-center gap-3 cursor-pointer mr-2"><span class="text-sm font-bold text-white transition-colors">Published</span><div class="relative"><input type="checkbox" class="peer sr-only"', `><div class="h-6 w-11 rounded-full bg-[#2a2a3a] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-[#8b8b9e] after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50"></div></div></label><button class="btn-primary bg-purple-600 hover:bg-purple-500 text-white">Save Dashboard</button></div></div><!--$-->`, "<!--/--><!--$-->", "<!--/--></main>"], _tmpl$1 = ["<svg", ' width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'], _tmpl$10 = ["<button", ' class="w-full text-left px-4 py-3 hover:bg-[#252535] transition-colors flex items-start gap-3 border-b border-[#2a2a3a]/50 last:border-0"><span class="', '">', '</span><div><div class="', '">', '</div><div class="text-[10px] text-[#5b5b6e]">', "</div></div></button>"], _tmpl$11 = ["<div", ' class="', '"></div>'], _tmpl$12 = ["<span", ' class="', '">', "</span>"], _tmpl$13 = ["<div", '><label class="mb-1 block text-xs text-[#8b8b9e]">Color</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"', ">", "</select></div>"], _tmpl$14 = ["<div", ' class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 grid grid-cols-3 gap-3"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Chart Type</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-pink-500 focus:outline-none"', '><option value="bar">Bar</option><option value="line">Line</option><option value="pie">Pie</option><option value="doughnut">Doughnut</option><option value="scatter">Scatter</option><option value="timeline">⟳ Timeline</option><option value="choropleth-us">US Choropleth Map</option><option value="choropleth-world">World Choropleth Map</option></select></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">', '</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-pink-500 focus:outline-none"', '></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">', '</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-pink-500 focus:outline-none"', "></div></div>"], _tmpl$15 = ["<div", ' class="col-span-2 pt-3 border-t border-[#2a2a3a]/50"><label class="mb-1 block text-xs text-[#8b8b9e]">Columns <span class="text-[#5b5b6e]">(comma-separated, blank = all)</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none" placeholder="e.g. name, status, amount"', "></div>"], _tmpl$16 = ["<div", ' class="mb-2 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 flex items-center gap-1.5"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>Fields auto-detected from <code class="font-mono text-blue-200">{{ form.* }}</code> variables in the workflow. You can edit or add more.</div>'], _tmpl$17 = ["<div", ' class="mb-2 px-2 py-1.5 rounded-lg bg-[#1e1e2e] border border-dashed border-[#2a2a3a] text-[10px] text-[#5b5b6e] flex items-center gap-1.5"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>No <code class="font-mono">{{ form.* }}</code> variables found — no required fields. Add fields manually if needed.</div>'], _tmpl$18 = ["<div", ' class="space-y-2">', "</div>"], _tmpl$19 = ["<div", ' class="col-span-2 pt-3 border-t border-[#2a2a3a]/50"><div class="flex items-center justify-between mb-2"><label class="text-xs font-bold text-[#8b8b9e] flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>Form Fields</label><button class="text-[10px] px-2 py-0.5 rounded bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 border border-purple-500/20 transition-colors">+ Add Field</button></div><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$20 = ["<div", ' class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 space-y-3"><div class="flex items-center justify-between"><label class="text-xs font-bold text-cyan-400 flex items-center gap-1.5">🎛️ Conditional Rules (show/hide/label based on workflow outcome)</label><button class="text-[10px] px-2 py-0.5 rounded bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/40 border border-cyan-500/30">+ Add Condition</button></div><div class="space-y-2">', "</div></div>"], _tmpl$21 = ["<div", ' class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 space-y-3"><div class="flex items-center justify-between"><label class="text-xs font-bold text-amber-400 flex items-center gap-1.5">📰 News Rules (IF / ELSE Conditions)</label><button class="text-[10px] px-2 py-0.5 rounded bg-amber-600/20 text-amber-300 hover:bg-amber-600/40 border border-amber-500/30">+ Add Rule</button></div><div class="grid grid-cols-2 gap-2"><div><label class="text-[10px] text-[#5b5b6e] block mb-0.5">Variable Data Path</label><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:border-amber-500"', ' placeholder="e.g. steps.step_1.response"></div><div class="flex items-center gap-2 pt-4"><input type="checkbox" id="', '"', ' class="rounded bg-[#0a0a0f] border-[#2a2a3a] text-amber-500"><label for="', '" class="text-xs text-amber-200 cursor-pointer">Subscribe to Live Stream SSE</label></div></div><div class="space-y-2">', "</div></div>"], _tmpl$22 = ["<div", ' class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 grid grid-cols-2 gap-3"><div><label class="text-[10px] text-[#5b5b6e] block mb-0.5">ON Label</label><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-emerald-400 focus:border-cyan-500"', '></div><div><label class="text-[10px] text-[#5b5b6e] block mb-0.5">OFF Label</label><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-slate-400 focus:border-cyan-500"', '></div><div><label class="text-[10px] text-[#5b5b6e] block mb-0.5">Form Variable Name</label><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-purple-300 font-mono focus:border-cyan-500"', ' placeholder="e.g. toggle_state"></div><div class="flex items-center gap-2 pt-4"><input type="checkbox" id="', '"', ' class="rounded bg-[#0a0a0f] border-[#2a2a3a] text-cyan-500"><label for="', '" class="text-xs text-cyan-200 cursor-pointer">Default Checked ON</label></div></div>'], _tmpl$23 = ["<div", ' class="col-span-2 pt-3 border-t border-[#2a2a3a]/50 space-y-3"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Template Preset</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-xs text-white focus:border-rose-500 focus:outline-none"', '><option value="list-row-simple-horizontal-arrow">Step Flow (Arrows)</option><option value="list-row-horizontal-icon-arrow">Step Flow (Icons)</option><option value="list-column">List (Vertical)</option><option value="list-row">List (Horizontal)</option><option value="compare">Compare</option><option value="hierarchy">Hierarchy / Org Chart</option><option value="relation">Relation Map</option><option value="sequence">Sequence / Timeline</option></select></div><div><label class="mb-1 flex items-center justify-between text-xs text-[#8b8b9e]"><span>Infographic Syntax (DSL)</span><span class="text-[9px] text-rose-400/70 font-mono">antv/infographic</span></label><textarea class="w-full rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-3 text-xs text-rose-200 font-mono focus:border-rose-500 focus:outline-none resize-y" rows="10" placeholder="infographic list-row-simple-horizontal-arrow\ndata\n  title My Title\n  lists\n    - label Item 1\n      desc Description"', '></textarea><p class="mt-1 text-[9px] text-[#5b5b6e]">Write infographic DSL syntax, or bind a workflow that returns syntax as its output.</p></div><div class="flex items-center gap-2"><input type="checkbox" id="', '"', ' class="rounded bg-[#0a0a0f] border-[#2a2a3a] text-rose-500"><label for="', '" class="text-xs text-rose-200 cursor-pointer">Enable built-in editor (interactive)</label></div></div>'], _tmpl$24 = ["<div", ' class="', '"><!--$-->', '<!--/--><button class="absolute top-4 right-4 text-[#5b5b6e] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10" title="Remove widget"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button><div class="mb-4 flex items-center justify-between relative z-10"><span class="', '">', "</span><!--$-->", '<!--/--></div><div class="grid grid-cols-2 gap-4"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Label</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"', ' placeholder="Widget label"></div><!--$-->', '<!--/--><div class="col-span-2"><label class="mb-1 block text-xs font-bold text-[#8b8b9e]">Bind to Workflow</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-sm text-emerald-300 font-mono shadow-inner focus:border-purple-500 focus:outline-none"', "><option value disabled>Select a workflow...</option><!--$-->", "<!--/--></select></div><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div></div>"], _tmpl$25 = ["<option", ">", "</option>"], _tmpl$26 = ["<option", "", ">", "</option>"], _tmpl$27 = ["<div", ' class="mt-2 pt-2 border-t border-[#2a2a3a]/50"><label class="text-[10px] text-[#5b5b6e] block mb-0.5">Options (comma-separated)</label><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"', ' placeholder="e.g. US, UK, Canada"></div>'], _tmpl$28 = ["<div", ' class="bg-[#1e1e2e]/50 p-2 rounded-lg border border-[#2a2a3a]"><div class="flex items-center gap-2"><div class="flex-1"><label class="text-[10px] text-[#5b5b6e] block mb-0.5">Variable</label><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs font-mono text-purple-300 focus:outline-none focus:border-purple-500"', '></div><div class="flex-1"><label class="text-[10px] text-[#5b5b6e] block mb-0.5">Label</label><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"', '></div><div class="flex-1"><label class="text-[10px] text-[#5b5b6e] block mb-0.5">Saved Value</label><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-emerald-300 font-mono focus:outline-none focus:border-purple-500"', ' placeholder="Default value"></div><div class="w-20"><label class="text-[10px] text-[#5b5b6e] block mb-0.5">Type</label><select class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-1 py-1 text-xs text-white focus:outline-none focus:border-purple-500"', '><option value="string">String</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="select">Select</option></select></div><button class="text-[#5b5b6e] hover:text-red-400 mt-3 shrink-0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div><!--$-->', "<!--/--></div>"], _tmpl$29 = ["<div", '><label class="text-[10px] text-[#5b5b6e] block mb-0.5">', '</label><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"', "></div>"], _tmpl$30 = ["<div", ' class="bg-[#1e1e2e]/60 p-2 rounded-lg border border-[#2a2a3a] space-y-1.5"><div class="grid grid-cols-12 gap-2 items-end"><div class="col-span-3"><label class="text-[10px] text-[#5b5b6e] block mb-0.5">Data Path</label><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"', ' placeholder="e.g. exists"></div><div class="col-span-3"><label class="text-[10px] text-[#5b5b6e] block mb-0.5">Operator</label><select class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"', '><option value="equals">equals</option><option value="notEquals">not equals</option><option value="contains">contains</option><option value="truthy">truthy</option><option value="falsy">falsy</option><option value="gt">&gt;</option><option value="lt">&lt;</option><option value="gte">&gt;=</option><option value="lte">&lt;=</option></select></div><div class="col-span-2"><label class="text-[10px] text-[#5b5b6e] block mb-0.5">Compare Value</label><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"', ' placeholder="value"></div><div class="col-span-3"><label class="text-[10px] text-[#5b5b6e] block mb-0.5">Action</label><select class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"', '><option value="showWidget">show widget</option><option value="hideWidget">hide widget</option><option value="showForm">show form</option><option value="hideForm">hide form</option><option value="setLabel">set label</option><option value="setWorkflow">set workflow</option></select></div><div class="col-span-1"><button class="text-[#5b5b6e] hover:text-red-400 shrink-0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div></div><!--$-->', "<!--/--></div>"], _tmpl$31 = ["<input", ' class="flex-1 bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-white focus:border-amber-500" placeholder="Matching value..."', ">"], _tmpl$32 = ["<div", ' class="bg-[#1e1e2e]/60 p-2 rounded-lg border border-[#2a2a3a] space-y-1.5"><div class="flex items-center gap-2"><span class="text-[10px] font-mono text-amber-400 w-6">IF</span><select class="bg-[#0a0a0f] border border-[#2a2a3a] rounded px-1.5 py-1 text-xs text-white focus:border-amber-500"', '><option value="contains">Contains</option><option value="equals">Equals</option><option value="gt">Greater Than (&gt;)</option><option value="lt">Less Than (&lt;)</option><option value="regex">Regex</option><option value="default">ELSE (Default)</option></select><!--$-->', '<!--/--><select class="bg-[#0a0a0f] border border-[#2a2a3a] rounded px-1.5 py-1 text-xs text-white focus:border-amber-500"', '><option value="emerald">Green</option><option value="red">Red</option><option value="amber">Amber</option><option value="blue">Blue</option><option value="purple">Purple</option><option value="slate">Slate</option></select><button class="text-[#5b5b6e] hover:text-red-400">✕</button></div><div><input class="w-full bg-[#0a0a0f] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-amber-200 focus:border-amber-500" placeholder="Text template e.g. CRITICAL: {{ value }}"', "></div></div>"], _tmpl$33 = ["<div", ' class="py-24 text-center text-[#5b5b6e] text-sm"><div class="mb-3 text-2xl">📐</div><p class="font-semibold text-white">No widgets to arrange yet</p><p class="mt-1 text-xs">Switch to "Configure" tab to add your buttons, charts, tables, or alerts.</p><button type="button" class="mt-4 btn-secondary text-xs">Go to Widget Configuration</button></div>'], _tmpl$34 = ["<table", ' class="w-full text-left text-xs text-[#c8c8d8]"><thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0"><tr>', '</tr></thead><tbody class="divide-y divide-[#1e1e2e]">', "</tbody></table>"], _tmpl$35 = ["<div", ' class="overflow-auto max-h-[250px] rounded-xl border border-[#2a2a3a]/60 bg-[#0a0a0f]">', "</div>"], _tmpl$36 = ["<div", ' class="p-4 text-xs text-[#5a5a6e]">No table data</div>'], _tmpl$37 = ["<th", ' class="px-3 py-2 font-semibold border-b border-[#2a2a3e] whitespace-nowrap uppercase text-[9px] tracking-wider">', "</th>"], _tmpl$38 = ["<tr", ">", "</tr>"], _tmpl$39 = ["<td", ' class="px-3 py-1.5 border-b border-[#1e1e2e]/50 max-w-[150px] truncate"', ">", "</td>"], _tmpl$40 = ["<div", ' style="position:relative;height:300px;background:#0d0f17;border-radius:10px;overflow:hidden;border:1px solid #2d3356"><div style="width:100%;height:100%;overflow:hidden;cursor:grab;position:relative"><div class="tl-canvas" style="position:absolute;transform-origin:0 0"><div class="tl-axis" style="position:absolute;left:0;height:2px;background:linear-gradient(90deg,transparent,#6c63ff 5%,#6c63ff 95%,transparent);box-shadow:0 0 12px rgba(108,99,255,0.4)"></div></div></div><div style="position:absolute;bottom:6px;right:10px;font-size:9px;color:#4a5273;pointer-events:none">Scroll to zoom · Drag to pan</div></div>'], _tmpl$41 = ["<div", ' class="bg-[#101015] p-3 rounded border border-[#2a2a3a]/50" style="', '">', "</div>"], _tmpl$42 = ["<p", ' class="text-xs text-[#5a5a6e]">No valid array data for chart</p>'], _tmpl$43 = ["<p", ' class="text-xs text-[#8b8b9e] animate-pulse">Loading map assets...</p>'], _tmpl$44 = ["<svg", ' class="animate-spin h-3 w-3 text-blue-500" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$45 = ["<div", ' class="text-center py-4 text-[10px] text-[#5b5b6e] italic">', "</div>"], _tmpl$46 = ["<div", ' class="space-y-1.5 py-3"><div class="h-3 rounded bg-[#1e1e2e] animate-pulse"></div><div class="h-3 rounded bg-[#1e1e2e] animate-pulse w-4/5"></div></div>'], _tmpl$47 = ["<div", ' class="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-[10px] text-red-400">✗ <!--$-->', "<!--/--></div>"], _tmpl$48 = ["<div", ' class="w-full rounded-xl border border-[#2a2a3a] bg-[#0e0e15] p-3 shadow-md text-left"><div class="flex items-center justify-between mb-2 pb-1.5 border-b border-[#2a2a3a]"><h3 class="', '"><!--$-->', "<!--/-->: <!--$-->", '<!--/--></h3><div class="flex items-center gap-2"><!--$-->', "<!--/--><button", ' class="text-[9px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 border border-blue-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">', "</button></div></div><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$49 = ["<span", ' class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-500/20 text-purple-300 border-purple-500/30"><span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span>STREAM LIVE</span>'], _tmpl$50 = ["<div", ' class="', '"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><span class="text-xl">📰</span><h3 class="text-sm font-bold text-white tracking-wide">', '</h3></div><div class="flex items-center gap-2"><!--$-->', '<!--/--><button class="text-[10px] text-slate-400 hover:text-white transition-colors">↻ Refresh</button></div></div><div class="mt-2"><div class="', '">', "</div></div></div>"], _tmpl$51 = ["<div", ' class="w-full rounded-2xl border border-[#2a2a3a] bg-[#12121a] p-4 shadow-xl flex items-center justify-between"><div><h4 class="text-sm font-bold text-white mb-0.5">', '</h4><span class="text-xs text-[#8b8b9e]">State: <strong', ">", "</strong></span></div><button", ' class="', '"><span class="', '"></span></button></div>'], _tmpl$52 = ["<div", ' class="w-full rounded-xl border border-[#2a2a3a] bg-[#0d0f17] overflow-hidden" style="', '"><div style="width:100%;min-height:inherit"></div></div>'];
const id$$ = "src/routes/dashboards/[id].tsx?pick=default&pick=$css";
if (!isServer) {
  Chart.register(...registerables);
  Chart.register(ChartGeo.ChoroplethController, ChartGeo.GeoFeature, ChartGeo.ColorScale, ChartGeo.ProjectionScale);
}
function lastStepType(workflow) {
  const steps = workflow?.steps || [];
  if (!steps.length) return "grpc";
  const last = steps[steps.length - 1];
  return last?.type || "grpc";
}
function DashboardBuilder() {
  const params = useParams();
  useNavigate();
  const isNew = params.id === "new";
  const [name, setName] = createSignal("New Dashboard");
  const [description, setDescription] = createSignal("");
  const [tags, setTags] = createSignal([]);
  const [tagInput, setTagInput] = createSignal("");
  const [isPublic, setIsPublic] = createSignal(false);
  const [buttons, setButtons] = createStore([]);
  const [activeTab, setActiveTab] = createSignal("config");
  const handleLayoutChange = (newLayout) => {
    const map = new Map(newLayout.map((item) => [item.id, item]));
    const updated = buttons.map((btn) => {
      const pos = map.get(btn.id);
      if (pos) {
        return {
          ...btn,
          x: pos.x,
          y: pos.y,
          w: pos.w,
          h: pos.h
        };
      }
      return btn;
    });
    setButtons(reconcile(updated));
  };
  const [workflows] = createResource(async () => {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/workflows` : "/api/workflows";
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });
  const fetchDashboard = async () => {
    if (isNew) return;
    const res = await fetch(`/api/dashboards/${params.id}`);
    const json = await res.json();
    if (json.success && json.data) {
      setName(json.data.name || "Untitled");
      setIsPublic(json.data.isPublic || false);
      setButtons(reconcile(json.data.buttons || []));
      setDescription(json.data.description || "");
      setTags(json.data.tags || []);
    }
  };
  onMount(() => {
    fetchDashboard();
  });
  const [showWidgetPicker, setShowWidgetPicker] = createSignal(false);
  const [executing, setExecuting] = createSignal({});
  const [formState, setFormState] = createSignal({});
  const updateForm = (btnId, field, value) => {
    setFormState((prev) => ({
      ...prev,
      [btnId]: {
        ...prev[btnId] || {},
        [field]: value
      }
    }));
  };
  const triggerButton = async (btn, effectiveWorkflowId) => {
    if (isNew) {
      alert("Please save the dashboard first before executing button actions!");
      return;
    }
    if (executing()[btn.id] === "running") return;
    setExecuting((prev) => ({
      ...prev,
      [btn.id]: "running"
    }));
    try {
      const payload = {
        form: formState()[btn.id] || {}
      };
      if (effectiveWorkflowId) payload.workflowId = effectiveWorkflowId;
      const res = await fetch(`/api/dashboards/${params.id}/trigger/${btn.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setExecuting((prev) => ({
          ...prev,
          [btn.id]: "success"
        }));
        setTimeout(() => setExecuting((prev) => ({
          ...prev,
          [btn.id]: "idle"
        })), 2500);
      } else {
        alert("Action failed: " + json.error);
        setExecuting((prev) => ({
          ...prev,
          [btn.id]: "error"
        }));
        setTimeout(() => setExecuting((prev) => ({
          ...prev,
          [btn.id]: "idle"
        })), 2500);
      }
    } catch (e) {
      alert("Network or Server error: " + e.message);
      setExecuting((prev) => ({
        ...prev,
        [btn.id]: "error"
      }));
      setTimeout(() => setExecuting((prev) => ({
        ...prev,
        [btn.id]: "idle"
      })), 2500);
    }
  };
  const colorOptions = [{
    value: "blue",
    label: "Blue",
    class: "bg-blue-600 hover:bg-blue-500"
  }, {
    value: "red",
    label: "Red",
    class: "bg-red-600 hover:bg-red-500"
  }, {
    value: "emerald",
    label: "Green",
    class: "bg-emerald-600 hover:bg-emerald-500"
  }, {
    value: "purple",
    label: "Purple",
    class: "bg-purple-600 hover:bg-purple-500"
  }, {
    value: "slate",
    label: "Slate",
    class: "bg-slate-700 hover:bg-slate-600"
  }];
  const widgetKind = (btn) => {
    const wfList = workflows();
    if (!wfList || !btn.workflowId) return "grpc";
    const wf = wfList.find((w) => w.id === btn.workflowId);
    return wf ? lastStepType(wf) : "grpc";
  };
  const renderLiveWidget = (btn) => {
    const wtype = btn.widgetType || widgetKind(btn);
    colorOptions.find((c) => c.value === (btn.color || "blue"))?.class || "bg-blue-600 hover:bg-blue-500";
    if (wtype === "table" || wtype === "chart") {
      return createComponent(PreviewWidget, {
        btn
      });
    }
    if (wtype === "news") {
      return createComponent(NewsWidgetComponent, {
        btn,
        get dashboardId() {
          return params.id;
        }
      });
    }
    if (wtype === "infographic") {
      return createComponent(InfographicWidget, {
        get syntax() {
          return btn.infographicSyntax;
        },
        get editable() {
          return btn.infographicEditable;
        }
      });
    }
    if (wtype === "toggle") {
      return createComponent(ToggleWidgetComponent, {
        btn,
        get dashboardId() {
          return params.id;
        },
        get formState() {
          return formState();
        },
        updateForm,
        triggerButton
      });
    }
    return createComponent(DashboardButtonFormWidget, {
      btn,
      get effective() {
        return defaultEffectiveConfig(btn);
      },
      get state() {
        return executing()[btn.id] || "idle";
      },
      get formState() {
        return formState();
      },
      updateForm,
      onTrigger: () => triggerButton(btn)
    });
  };
  return ssr(_tmpl$0, ssrHydrationKey(), ssrAttribute("value", escape(name(), true), false), ssrAttribute("value", escape(description(), true), false), escape(createComponent(For, {
    get each() {
      return tags();
    },
    children: (tag) => createComponent(Badge, {
      variant: "purple",
      "class": "gap-1 cursor-pointer hover:bg-purple-500/25",
      onClick: () => setTags(tags().filter((t) => t !== tag)),
      get children() {
        return [tag, ssr(_tmpl$1, ssrHydrationKey())];
      }
    })
  })), ssrAttribute("value", escape(tagInput(), true), false), escape(createComponent(TabsList, {
    get children() {
      return [createComponent(TabsTrigger, {
        get active() {
          return activeTab() === "config";
        },
        onClick: () => setActiveTab("config"),
        get children() {
          return [ssr(_tmpl$, ssrHydrationKey()), "Configure"];
        }
      }), createComponent(TabsTrigger, {
        get active() {
          return activeTab() === "arrange";
        },
        onClick: () => setActiveTab("arrange"),
        get children() {
          return [ssr(_tmpl$2, ssrHydrationKey()), "Arrange Layout (GridStack)"];
        }
      })];
    }
  })), ssrAttribute("checked", isPublic(), true), escape(createComponent(Show, {
    get when() {
      return activeTab() === "config";
    },
    get children() {
      return ssr(_tmpl$7, ssrHydrationKey(), escape(createComponent(Show, {
        get when() {
          return showWidgetPicker();
        },
        get children() {
          return ssr(_tmpl$3, ssrHydrationKey(), escape([{
            type: "button",
            icon: "▶",
            label: "Button",
            desc: "Trigger a workflow run",
            color: "text-blue-400"
          }, {
            type: "form",
            icon: "📝",
            label: "Form",
            desc: "Button with input fields",
            color: "text-purple-400"
          }, {
            type: "chart",
            icon: "📈",
            label: "Chart",
            desc: "Auto-load chart data",
            color: "text-pink-400"
          }, {
            type: "table",
            icon: "📊",
            label: "Table",
            desc: "Auto-load table data",
            color: "text-emerald-400"
          }, {
            type: "news",
            icon: "📰",
            label: "News Alert",
            desc: "IF/ELSE color & text news feed",
            color: "text-amber-400"
          }, {
            type: "toggle",
            icon: "🎛️",
            label: "Toggle Switch",
            desc: "Interactive ON/OFF workflow switch",
            color: "text-cyan-400"
          }, {
            type: "infographic",
            icon: "🦋",
            label: "Infographic",
            desc: "Rich SVG infographic from AntV",
            color: "text-rose-400"
          }].map((opt) => ssr(_tmpl$10, ssrHydrationKey(), `text-lg leading-none mt-0.5 ${escape(opt.color, true)}`, escape(opt.icon), `text-sm font-bold ${escape(opt.color, true)}`, escape(opt.label), escape(opt.desc)))));
        }
      })), escape(createComponent(Show, {
        get when() {
          return buttons.length === 0;
        },
        get children() {
          return ssr(_tmpl$4, ssrHydrationKey());
        }
      })), escape(createComponent(For, {
        each: buttons,
        children: (btn, index) => {
          const wt = () => btn.widgetType || "button";
          const accentCls = () => wt() === "chart" ? "border-l-pink-500" : wt() === "table" ? "border-l-emerald-500" : wt() === "form" ? "border-l-purple-500" : wt() === "infographic" ? "border-l-rose-500" : "border-l-blue-500";
          const typeLabel = {
            button: "⚡ Button",
            form: "📝 Form",
            chart: "📈 Chart",
            table: "📊 Table",
            infographic: "🦋 Infographic"
          };
          const typeBadgeCls = () => wt() === "chart" ? "text-pink-400 bg-pink-500/10 border-pink-500/20" : wt() === "table" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : wt() === "form" ? "text-purple-400 bg-purple-500/10 border-purple-500/20" : wt() === "infographic" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-blue-400 bg-blue-500/10 border-blue-500/20";
          const boundWf = createMemo(() => workflows()?.find((w) => w.id === btn.workflowId));
          const varStatus = createMemo(() => checkWidgetVariablesConfigured(boundWf(), btn.formConfig));
          return ssr(_tmpl$24, ssrHydrationKey(), `card p-5 relative border-l-4 group overflow-hidden ${escape(accentCls(), true)}`, escape(createComponent(Show, {
            get when() {
              return varStatus().hasVariables;
            },
            get children() {
              return ssr(_tmpl$11, ssrHydrationKey(), `absolute top-0 left-0 right-0 h-12 rounded-t-2xl pointer-events-none transition-colors border-b ${varStatus().allConfigured ? "bg-emerald-500/20 border-emerald-500/30" : "bg-red-500/20 border-red-500/30"}`);
            }
          })), `text-[10px] font-bold px-2 py-0.5 rounded-full border ${escape(typeBadgeCls(), true)}`, escape(typeLabel[wt()]), escape(createComponent(Show, {
            get when() {
              return varStatus().hasVariables;
            },
            get children() {
              return ssr(_tmpl$12, ssrHydrationKey(), `text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${varStatus().allConfigured ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-red-500/20 text-red-300 border-red-500/40"}`, varStatus().allConfigured ? "✓ All Vars Configured" : "⚠️ Vars Unconfigured");
            }
          })), ssrAttribute("value", escape(btn.label, true), false), escape(createComponent(Show, {
            get when() {
              return wt() === "button" || wt() === "form";
            },
            get children() {
              return ssr(_tmpl$13, ssrHydrationKey(), ssrAttribute("value", escape(btn.color, true), false), escape(createComponent(For, {
                each: colorOptions,
                children: (c) => ssr(_tmpl$25, ssrHydrationKey() + ssrAttribute("value", escape(c.value, true), false), escape(c.label))
              })));
            }
          })), ssrAttribute("value", escape(btn.workflowId, true) || "", false), escape(createComponent(Show, {
            get when() {
              return !workflows.loading;
            },
            get children() {
              return createComponent(For, {
                get each() {
                  return workflows();
                },
                children: (w) => ssr(_tmpl$26, ssrHydrationKey() + ssrAttribute("value", escape(w.id, true), false), ssrAttribute("selected", w.id === btn.workflowId, true), escape(w.name))
              });
            }
          })), escape(createComponent(Show, {
            get when() {
              return wt() === "chart";
            },
            get children() {
              return ssr(_tmpl$14, ssrHydrationKey(), ssrAttribute("value", escape(btn.chartType, true) || "bar", false), btn.chartType?.startsWith("choropleth") ? "Region Field (State/Country)" : btn.chartType === "timeline" ? "Date/Year Field" : "X-Axis Field", ssrAttribute("placeholder", btn.chartType?.startsWith("choropleth") ? "e.g. state" : btn.chartType === "timeline" ? "e.g. year" : "e.g. date", false) + ssrAttribute("value", escape(btn.xKey, true) || "", false), btn.chartType?.startsWith("choropleth") ? "Value Field" : btn.chartType === "timeline" ? "Title/Header Field" : "Y-Axis Field", ssrAttribute("placeholder", btn.chartType === "timeline" ? "e.g. header" : "e.g. value", false) + ssrAttribute("value", escape(btn.yKey, true) || "", false));
            }
          })), escape(createComponent(Show, {
            get when() {
              return wt() === "table";
            },
            get children() {
              return ssr(_tmpl$15, ssrHydrationKey(), ssrAttribute("value", escape(btn.columns, true) || "", false));
            }
          })), escape(createComponent(Show, {
            get when() {
              return wt() === "button" || wt() === "form";
            },
            get children() {
              return ssr(_tmpl$19, ssrHydrationKey(), escape(createComponent(Show, {
                get when() {
                  return btn.workflowId && btn.formConfig?.length > 0;
                },
                get children() {
                  return ssr(_tmpl$16, ssrHydrationKey());
                }
              })), escape(createComponent(Show, {
                get when() {
                  return btn.workflowId && (!btn.formConfig || btn.formConfig.length === 0);
                },
                get children() {
                  return ssr(_tmpl$17, ssrHydrationKey());
                }
              })), escape(createComponent(Show, {
                get when() {
                  return (btn.formConfig || []).length > 0;
                },
                get children() {
                  return ssr(_tmpl$18, ssrHydrationKey(), escape(createComponent(For, {
                    get each() {
                      return btn.formConfig;
                    },
                    children: (field, fIdx) => ssr(_tmpl$28, ssrHydrationKey(), ssrAttribute("value", escape(field.name, true), false), ssrAttribute("value", escape(field.label, true), false), ssrAttribute("value", escape(field.value, true) ?? escape(field.defaultValue, true) ?? "", false), ssrAttribute("value", escape(field.type, true), false), escape(createComponent(Show, {
                      get when() {
                        return field.type === "select";
                      },
                      get children() {
                        return ssr(_tmpl$27, ssrHydrationKey(), ssrAttribute("value", escape(field.options, true) || "", false));
                      }
                    })))
                  })));
                }
              })));
            }
          })), escape(createComponent(Show, {
            get when() {
              return wt() === "button" || wt() === "form";
            },
            get children() {
              return ssr(_tmpl$20, ssrHydrationKey(), escape(createComponent(For, {
                get each() {
                  return btn.conditionRules || [];
                },
                children: (rule, rIdx) => ssr(_tmpl$30, ssrHydrationKey(), ssrAttribute("value", escape(rule.path, true) || "", false), ssrAttribute("value", escape(rule.operator, true) || "equals", false), ssrAttribute("value", escape(rule.value, true) ?? "", false), ssrAttribute("value", escape(rule.action, true) || "showWidget", false), escape(createComponent(Show, {
                  get when() {
                    return rule.action === "setLabel" || rule.action === "setWorkflow";
                  },
                  get children() {
                    return ssr(_tmpl$29, ssrHydrationKey(), rule.action === "setLabel" ? "New Label" : "Target Workflow ID", ssrAttribute("value", escape(rule.targetValue, true) ?? "", false) + ssrAttribute("placeholder", rule.action === "setLabel" ? "e.g. Delete" : "e.g. workflow:delete-mail", false));
                  }
                })))
              })));
            }
          })), escape(createComponent(Show, {
            get when() {
              return wt() === "news";
            },
            get children() {
              return ssr(_tmpl$21, ssrHydrationKey(), ssrAttribute("value", escape(btn.dataPath, true) || "", false), `stream_${escape(btn.id, true)}`, ssrAttribute("checked", btn.streamActive !== false, true), `stream_${escape(btn.id, true)}`, escape(createComponent(For, {
                get each() {
                  return btn.newsRules || [];
                },
                children: (rule, rIdx) => ssr(_tmpl$32, ssrHydrationKey(), ssrAttribute("value", escape(rule.operator, true), false), escape(createComponent(Show, {
                  get when() {
                    return rule.operator !== "default";
                  },
                  get children() {
                    return ssr(_tmpl$31, ssrHydrationKey(), ssrAttribute("value", escape(rule.value, true), false));
                  }
                })), ssrAttribute("value", escape(rule.color, true), false), ssrAttribute("value", escape(rule.textTemplate, true) || "", false))
              })));
            }
          })), escape(createComponent(Show, {
            get when() {
              return wt() === "toggle";
            },
            get children() {
              return ssr(_tmpl$22, ssrHydrationKey(), ssrAttribute("value", escape(btn.onLabel, true) || "ON", false), ssrAttribute("value", escape(btn.offLabel, true) || "OFF", false), ssrAttribute("value", escape(btn.formVarName, true) || "toggle_state", false), `def_${escape(btn.id, true)}`, ssrAttribute("checked", btn.defaultChecked || false, true), `def_${escape(btn.id, true)}`);
            }
          })), escape(createComponent(Show, {
            get when() {
              return wt() === "infographic";
            },
            get children() {
              return ssr(_tmpl$23, ssrHydrationKey(), ssrAttribute("value", escape(btn.infographicTemplate, true) || "list-row-simple-horizontal-arrow", false), ssrAttribute("value", escape(btn.infographicSyntax, true) || "", false), `editable_${escape(btn.id, true)}`, ssrAttribute("checked", btn.infographicEditable || false, true), `editable_${escape(btn.id, true)}`);
            }
          })));
        }
      })), escape(createComponent(Show, {
        get when() {
          return isPublic() && !isNew;
        },
        get children() {
          return createComponent(A, {
            get href() {
              return `/p/${params.id}`;
            },
            target: "_blank",
            "class": "text-xs text-blue-400 hover:underline flex items-center gap-1 normal-case tracking-normal font-semibold",
            get children() {
              return ["Public View", ssr(_tmpl$5, ssrHydrationKey())];
            }
          });
        }
      })), isPublic() && !isNew ? `/p/${escape(params.id)}` : `Draft: ${escape(name())}`, escape(name()) || "Untitled Dashboard", escape(createComponent(Show, {
        get when() {
          return buttons.length === 0;
        },
        get children() {
          return ssr(_tmpl$6, ssrHydrationKey());
        }
      })), escape(createComponent(Show, {
        get when() {
          return buttons.length > 0;
        },
        get children() {
          return createComponent(DashboardGrid, {
            buttons,
            isStatic: false,
            get dashboardId() {
              return params.id;
            },
            onLayoutChange: handleLayoutChange,
            renderWidget: renderLiveWidget
          });
        }
      })));
    }
  })), escape(createComponent(Show, {
    get when() {
      return activeTab() === "arrange";
    },
    get children() {
      return ssr(_tmpl$9, ssrHydrationKey(), escape(createComponent(Show, {
        get when() {
          return isPublic() && !isNew;
        },
        get children() {
          return createComponent(A, {
            get href() {
              return `/p/${params.id}`;
            },
            target: "_blank",
            "class": "flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/20",
            get children() {
              return [ssr(_tmpl$8, ssrHydrationKey()), ssr(_tmpl$5, ssrHydrationKey())];
            }
          });
        }
      })), escape(createComponent(Show, {
        get when() {
          return buttons.length > 0;
        },
        get fallback() {
          return ssr(_tmpl$33, ssrHydrationKey());
        },
        get children() {
          return createComponent(DashboardGrid, {
            buttons,
            isStatic: false,
            get dashboardId() {
              return params.id;
            },
            onLayoutChange: handleLayoutChange,
            renderWidget: renderLiveWidget
          });
        }
      })));
    }
  })));
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
function DashTable(props) {
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
  return ssr(_tmpl$35, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return rows().length > 0;
    },
    get fallback() {
      return ssr(_tmpl$36, ssrHydrationKey());
    },
    get children() {
      return ssr(_tmpl$34, ssrHydrationKey(), escape(createComponent(For, {
        get each() {
          return effectiveCols();
        },
        children: (col) => ssr(_tmpl$37, ssrHydrationKey(), escape(col))
      })), escape(createComponent(For, {
        get each() {
          return rows();
        },
        children: (row) => ssr(_tmpl$38, ssrHydrationKey(), escape(createComponent(For, {
          get each() {
            return effectiveCols();
          },
          children: (col) => {
            const text = formatCell(cellValue(row, col));
            return ssr(_tmpl$39, ssrHydrationKey(), ssrAttribute("title", escape(text, true), false), escape(text));
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
function DashTimeline(props) {
  let vpRef;
  let scale = 1;
  let offsetX = 0;
  onMount(() => {
    vpRef.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.min(8, Math.max(0.05, scale * factor));
      const pivot = (e.clientX - vpRef.getBoundingClientRect().left) / scale - offsetX;
      scale = newScale;
      offsetX = (e.clientX - vpRef.getBoundingClientRect().left) / scale - pivot;
    }, {
      passive: false
    });
    let panning2 = false, panStart2 = 0, panOX2 = 0;
    vpRef.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      panning2 = true;
      panStart2 = e.clientX;
      panOX2 = offsetX;
      vpRef.style.cursor = "grabbing";
    });
    window.addEventListener("mousemove", (e) => {
      if (!panning2) return;
      offsetX = panOX2 + (e.clientX - panStart2) / scale;
    });
    window.addEventListener("mouseup", () => {
      panning2 = false;
      vpRef.style.cursor = "grab";
    });
  });
  return ssr(_tmpl$40, ssrHydrationKey());
}
function DashChart(props) {
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
      data.forEach((item, i) => {
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
      });
      return {
        labels: [],
        datasets: [{
          label: inferred.yKey || "Value",
          data: points2,
          backgroundColor: "#a855f7",
          pointRadius: 4
        }]
      };
    }
    const labels = [];
    const points = [];
    data.forEach((item, i) => {
      if (item && typeof item === "object") {
        labels.push(inferred.xKey ? valueToLabel(get(item, inferred.xKey), i) : String(i + 1));
        points.push(inferred.yKey ? valueToNumber(get(item, inferred.yKey), 0) : i + 1);
      } else {
        labels.push(String(i + 1));
        points.push(valueToNumber(item, 0));
      }
    });
    if (isPie) {
      const colors = ["#a855f7", "#6366f1", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4"];
      const bgColors = points.map((_, i) => colors[i % colors.length]);
      return {
        labels,
        datasets: [{
          label: inferred.yKey || "Value",
          data: points,
          backgroundColor: bgColors,
          borderWidth: 1,
          borderColor: "#0a0a0f"
        }]
      };
    }
    return {
      labels,
      datasets: [{
        label: inferred.yKey || "Value",
        data: points,
        borderColor: isBar ? "#6366f1" : "#a855f7",
        backgroundColor: isBar ? "rgba(99,102,241,0.75)" : "rgba(168,85,247,0.1)",
        borderWidth: isBar ? 0 : 2,
        borderRadius: isBar ? 4 : 0,
        pointBackgroundColor: "#a855f7",
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
    const isPie = type === "pie" || type === "doughnut";
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
  return ssr(_tmpl$41, ssrHydrationKey(), ssrStyle(cType() === "timeline" ? "" : "height:200px"), escape(createComponent(Show, {
    get when() {
      return cType() === "timeline";
    },
    get fallback() {
      return createComponent(Show, {
        get when() {
          return normalizeDataArray(props.data).length > 0;
        },
        get fallback() {
          return ssr(_tmpl$42, ssrHydrationKey());
        },
        get children() {
          return createComponent(Show, {
            get when() {
              return !cType().startsWith("choropleth") || topoJson();
            },
            get fallback() {
              return ssr(_tmpl$43, ssrHydrationKey());
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
      return createComponent(DashTimeline, {
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
function PreviewWidget(props) {
  const [status, setStatus] = createSignal("idle");
  const [data, setData] = createSignal([]);
  const [meta, setMeta] = createSignal({});
  const [error, setError] = createSignal("");
  const kind = props.btn.widgetType;
  return ssr(_tmpl$48, ssrHydrationKey(), `text-[10px] font-bold uppercase tracking-wider ${kind === "table" ? "text-emerald-400" : "text-purple-400"}`, kind === "table" ? "📊 Table Preview" : kind === "infographic" ? "🦋 Infographic Preview" : "📈 Chart Preview", escape(props.btn.label), escape(createComponent(Show, {
    get when() {
      return status() === "loading";
    },
    get children() {
      return ssr(_tmpl$44, ssrHydrationKey());
    }
  })), ssrAttribute("disabled", status() === "loading" || !props.btn.workflowId, true), status() === "idle" ? "Load Data" : "Refresh", escape(createComponent(Show, {
    get when() {
      return status() === "idle";
    },
    get children() {
      return ssr(_tmpl$45, ssrHydrationKey(), props.btn.workflowId ? 'Click "Load Data" to fetch preview' : "Please bind a workflow first");
    }
  })), escape(createComponent(Show, {
    get when() {
      return status() === "loading";
    },
    get children() {
      return ssr(_tmpl$46, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return status() === "error";
    },
    get children() {
      return ssr(_tmpl$47, ssrHydrationKey(), escape(error()));
    }
  })), escape(createComponent(Show, {
    get when() {
      return status() === "ready";
    },
    get children() {
      return [createComponent(Show, {
        when: kind === "table",
        get children() {
          return createComponent(DashTable, {
            get data() {
              return data();
            },
            get columns() {
              return props.btn.columns ? props.btn.columns.split(",").map((c) => c.trim()).filter(Boolean) : meta().columns;
            }
          });
        }
      }), createComponent(Show, {
        get when() {
          return kind === "chart" && (props.btn.chartType || "bar") !== "timeline";
        },
        get children() {
          return createComponent(DashChart, {
            get data() {
              return data();
            },
            get xKey() {
              return props.btn.xKey || meta().xKey;
            },
            get yKey() {
              return props.btn.yKey || meta().yKey;
            },
            get chartType() {
              return props.btn.chartType || meta().chartType || "bar";
            }
          });
        }
      }), createComponent(Show, {
        get when() {
          return kind === "chart" && props.btn.chartType === "timeline";
        },
        get children() {
          return createComponent(DashTimeline, {
            get data() {
              return data();
            },
            get xKey() {
              return props.btn.xKey || meta().xKey;
            },
            get yKey() {
              return props.btn.yKey || meta().yKey;
            }
          });
        }
      }), createComponent(Show, {
        when: kind === "infographic",
        get children() {
          return createComponent(InfographicWidget, {
            get syntax() {
              return props.btn.infographicSyntax;
            },
            get data() {
              return data();
            },
            get editable() {
              return props.btn.infographicEditable;
            }
          });
        }
      })];
    }
  })));
}
function NewsWidgetComponent(props) {
  const [data, setData] = createSignal("No Data");
  const [status, setStatus] = createSignal("idle");
  const evalResult = () => evaluateNewsRules(data(), props.btn.newsRules || []);
  const theme = () => newsColorClasses[evalResult().color] || newsColorClasses.blue;
  onMount(() => {
    if (!props.btn.workflowId) return;
    const wfId = (props.btn.workflowId.includes(":") ? props.btn.workflowId.split(":")[1] : props.btn.workflowId).replace(/[⟨⟩]/g, "");
    if (props.btn.streamActive !== false) {
      setStatus("live");
      const es = new EventSource(`/api/workflows/${wfId}/stream`);
      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.data?.chunk || payload.data?.response) {
            let chunk = payload.data.chunk || payload.data.response;
            if (props.btn.dataPath) {
              chunk = get(chunk, props.btn.dataPath, chunk);
            }
            if (chunk !== void 0) setData(chunk);
          }
        } catch {
        }
      };
      es.addEventListener("step_chunk", (e) => {
        try {
          const payload = JSON.parse(e.data);
          let chunk = payload.data?.chunk;
          if (props.btn.dataPath && chunk) {
            chunk = get(chunk, props.btn.dataPath, chunk);
          }
          if (chunk !== void 0) setData(chunk);
        } catch {
        }
      });
      es.addEventListener("step_complete", (e) => {
        try {
          const payload = JSON.parse(e.data);
          let resData = payload.data?.response;
          if (props.btn.dataPath && resData) {
            resData = get(resData, props.btn.dataPath, resData);
          }
          if (resData !== void 0) setData(resData);
        } catch {
        }
      });
      es.onerror = () => {
        setStatus("idle");
      };
    }
  });
  return ssr(_tmpl$50, ssrHydrationKey(), `w-full rounded-2xl border p-5 shadow-xl transition-all duration-300 ${escape(theme().bg, true)} ${escape(theme().border, true)}`, escape(props.btn.label) || "News Alert", escape(createComponent(Show, {
    get when() {
      return props.btn.streamActive !== false;
    },
    get children() {
      return ssr(_tmpl$49, ssrHydrationKey());
    }
  })), `text-lg font-extrabold tracking-tight ${escape(theme().text, true)}`, escape(evalResult().text));
}
function ToggleWidgetComponent(props) {
  const [checked, setChecked] = createSignal(props.btn.defaultChecked || false);
  const [isFlipping, setIsFlipping] = createSignal(false);
  const onTxt = () => props.btn.onLabel || "ON";
  const offTxt = () => props.btn.offLabel || "OFF";
  return ssr(_tmpl$51, ssrHydrationKey(), escape(props.btn.label) || "Toggle Switch", ssrAttribute("class", checked() ? "text-emerald-400" : "text-slate-400", false), checked() ? escape(onTxt()) : escape(offTxt()), ssrAttribute("disabled", isFlipping(), true), `relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${checked() ? "bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/30" : "bg-[#2a2a3a]"}`, `pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${checked() ? "translate-x-8" : "translate-x-0"}`);
}
function InfographicWidget(props) {
  let containerRef;
  let instance = null;
  const getSyntax = () => {
    if (props.syntax) return props.syntax;
    if (typeof props.data === "string") return props.data;
    return "";
  };
  onMount(async () => {
    if (isServer) return;
    try {
      const mod = await import("@antv/infographic");
      const Infographic = mod.Infographic || mod.default;
      instance = new Infographic({
        container: containerRef,
        width: "100%",
        height: props.height || "400px",
        editable: props.editable || false
      });
      const syntax = getSyntax();
      if (syntax) instance.render(syntax);
    } catch (e) {
      console.error("[InfographicWidget] Failed to load @antv/infographic:", e);
    }
  });
  createEffect(() => {
    const syntax = getSyntax();
    if (instance && syntax) {
      try {
        instance.render(syntax);
      } catch (e) {
        console.error("[InfographicWidget] Render error:", e);
      }
    }
  });
  return ssr(_tmpl$52, ssrHydrationKey(), ssrStyle(`min-height:${props.height || "300px"}`));
}
export {
  DashboardBuilder as default,
  id$$
};
//# sourceMappingURL=_id_-BMIQmLR3.js.map
