import { isServer, ssr, ssrHydrationKey, escape, createComponent, ssrAttribute } from "solid-js/web";
import { createSignal, createEffect, createResource, Show, For } from "solid-js";
import { p as parseProtoContent, g as generateSkeleton } from "./protoParser-C1XlV9an.js";
import { L as Line } from "./index-D4uTJpLk.js";
import { Chart, registerables } from "chart.js";
import { c as createSolidTable, f as flexRender } from "./index-DNUuAjQM.js";
import { getCoreRowModel } from "@tanstack/table-core";
import "protobufjs";
import "solid-js/store";
var _tmpl$ = ["<select", ' class="rounded-lg border border-[#1e1e2e] bg-[#12121a] px-2 py-1 text-xs text-[#8b8b9e] focus:border-[#2a2a3e] focus:outline-none max-w-[150px] truncate cursor-pointer hover:text-white transition-colors"><option value>Load saved proto...</option><!--$-->', "<!--/--></select>"], _tmpl$2 = ["<textarea", ' class="w-full min-h-[250px] max-h-[400px] bg-transparent text-sm text-[#c8c8d8] font-mono p-4 resize-y focus:outline-none" spellcheck="false" placeholder="Paste your .proto content here..."></textarea>'], _tmpl$3 = ["<div", ' class="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg><p class="text-xs text-red-400">', "</p></div>"], _tmpl$4 = ["<div", ' class="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><polyline points="20 6 9 17 4 12"></polyline></svg><p class="text-xs text-emerald-400">Parsed: <!--$-->', "<!--/--> service(s),  <!--$-->", "<!--/--> method(s)</p></div>"], _tmpl$5 = ["<div", ' class="card p-4"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg><h2 class="text-sm font-semibold text-white">Proto Definition</h2></div><!--$-->', '<!--/--></div><div class="flex items-center gap-2 mb-3"><label class="cursor-pointer"><input type="file" accept=".proto" class="hidden"><span class="inline-flex items-center gap-1.5 rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-1.5 text-xs font-medium text-[#8b8b9e] transition-colors hover:border-[#2a2a3e] hover:text-white"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>Upload</span></label><button class="inline-flex items-center gap-1.5 rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-1.5 text-xs font-medium text-[#8b8b9e] transition-colors hover:border-[#2a2a3e] hover:text-white"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><circle cx="12" cy="12" r="1"></circle></svg>Sample</button></div><div class="', '">', "</div><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$6 = ["<div", ' class="card p-4"><div class="flex items-center gap-2 mb-3"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg><h2 class="text-sm font-semibold text-white">Connection</h2></div><div class="space-y-3"><div><label class="block text-xs font-medium text-[#5a5a6e] mb-1.5">Server Address</label><input type="text"', ' placeholder="localhost:50051" class="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-2 text-sm text-white placeholder-[#3a3a4e] focus:outline-none focus:border-[#3b82f6] transition-colors"></div><div class="flex items-center justify-between"><label class="text-xs font-medium text-[#5a5a6e]">Use TLS</label><button class="', '"><span class="', '"></span></button></div></div></div>'], _tmpl$7 = ["<div", ' class="rounded-lg bg-[#12121a] border border-[#1e1e2e] p-3"><p class="text-xs font-mono text-[#8b8b9e]"><span class="text-violet-400">rpc</span> <span class="text-white">', '</span><span class="text-[#5a5a6e]">(</span><span class="text-emerald-400">', '</span><span class="text-[#5a5a6e]">)</span><span class="text-[#5a5a6e]"> → </span><span class="text-blue-400">', "</span></p></div>"], _tmpl$8 = ["<div", ' class="card p-4"><div class="flex items-center gap-2 mb-3"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg><h2 class="text-sm font-semibold text-white">Service & Method</h2></div><div class="space-y-3"><div><label class="block text-xs font-medium text-[#5a5a6e] mb-1.5">Service</label><select', ' class="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors appearance-none cursor-pointer">', '</select></div><div><label class="block text-xs font-medium text-[#5a5a6e] mb-1.5">Method</label><select', ' class="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors appearance-none cursor-pointer">', "</select></div><!--$-->", "<!--/--></div></div>"], _tmpl$9 = ["<div", ' class="card p-4 space-y-4"><div class="flex items-center gap-2 mb-1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg><h2 class="text-sm font-semibold text-white">HTTP Target Endpoint</h2></div><div class="grid grid-cols-12 gap-2"><div class="col-span-4"><label class="block text-[10px] font-semibold text-[#5a5a6e] mb-1.5 uppercase">Method</label><select', ' class="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] cursor-pointer appearance-none text-center font-bold"><option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="DELETE">DELETE</option><option value="PATCH">PATCH</option></select></div><div class="col-span-8"><label class="block text-[10px] font-semibold text-[#5a5a6e] mb-1.5 uppercase">Request URL</label><input type="text"', ' placeholder="https://api.example.com/data" class="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-3 py-2 text-sm text-white placeholder-[#3a3a4e] focus:outline-none focus:border-[#3b82f6] transition-colors font-mono"></div></div></div>'], _tmpl$0 = ["<p", ' class="text-[10px] text-[#3a3a4e] text-center py-2 italic">No custom headers defined</p>'], _tmpl$1 = ["<span", ' class="text-xs text-[#5a5a6e] font-mono">', "</span>"], _tmpl$10 = ["<svg", ' width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>'], _tmpl$11 = ["<span", ' class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2a2a3e] px-1.5 text-[10px] font-bold text-[#8b8b9e]">', "</span>"], _tmpl$12 = ["<div", ' class="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-4"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><div><p class="text-sm font-medium text-red-400">Request failed</p><p class="text-xs text-red-400/70 mt-1">', "</p></div></div>"], _tmpl$13 = ["<span", ' class="text-xs text-[#5a5a6e]"><!--$-->', "<!--/-->ms</span>"], _tmpl$14 = ["<div", '><div class="flex items-center gap-3 mb-3"><span class="', '"><span class="', '"></span><!--$-->', "<!--/--></span><!--$-->", '<!--/--></div><pre class="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4 text-sm font-mono text-[#c8c8d8] overflow-auto max-h-[400px]">', "</pre></div>"], _tmpl$15 = ["<div", ' class="flex flex-col items-center justify-center py-12 text-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a4e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg><p class="text-sm text-[#5a5a6e]">Send a request to see the response</p></div>'], _tmpl$16 = ["<div", ' class="flex flex-col items-center justify-center py-12 text-center"><svg width="24" height="24" viewBox="0 0 24 24" class="animate-spin mb-3"><circle cx="12" cy="12" r="10" stroke="#3a3a4e" stroke-width="3" fill="none"></circle><circle cx="12" cy="12" r="10" stroke="#10b981" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10" stroke-linecap="round"></circle></svg><p class="text-sm text-[#5a5a6e]">Waiting for response...</p></div>'], _tmpl$17 = ["<div", ' class="p-4"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$18 = ["<div", ' class="max-h-[500px] overflow-auto">', "</div>"], _tmpl$19 = ["<div", ' class="p-4 bg-[#12121a] rounded-xl border border-[#1e1e2e] h-[400px]">', "</div>"], _tmpl$20 = ["<div", ' class="p-4 space-y-4"><div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-[#12121a] p-4 rounded-xl border border-[#1e1e2e]"><div><label class="block text-[10px] font-medium text-[#8b8b9e] uppercase tracking-wider mb-1.5">Array Data Path</label><input type="text"', ' placeholder="e.g. data.bars (leave empty if root)" class="w-full rounded-lg border border-[#2a2a3e] bg-[#1a1a24] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors"></div><div><label class="block text-[10px] font-medium text-[#8b8b9e] uppercase tracking-wider mb-1.5">X-Axis Property</label><input type="text"', ' placeholder="e.g. timestamp" class="w-full rounded-lg border border-[#2a2a3e] bg-[#1a1a24] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors"></div><div><label class="block text-[10px] font-medium text-[#8b8b9e] uppercase tracking-wider mb-1.5">Y-Axis Property</label><input type="text"', ' placeholder="e.g. close" class="w-full rounded-lg border border-[#2a2a3e] bg-[#1a1a24] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors"></div></div><!--$-->', "<!--/--></div>"], _tmpl$21 = ["<div", ' class="bg-[#12121a] rounded-xl border border-[#1e1e2e] max-h-[500px] overflow-auto"><table class="w-full text-left text-sm text-[#c8c8d8]"><thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0 shadow-sm">', '</thead><tbody class="divide-y divide-[#1e1e2e]">', "</tbody></table></div>"], _tmpl$22 = ["<div", ' class="p-4 space-y-4"><div class="bg-[#12121a] p-4 rounded-xl border border-[#1e1e2e]"><label class="block text-[10px] font-medium text-[#8b8b9e] uppercase tracking-wider mb-1.5">Array Data Path</label><input type="text"', ' placeholder="e.g. data.items (leave empty if root)" class="w-full rounded-lg border border-[#2a2a3e] bg-[#1a1a24] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3b82f6] transition-colors"></div><div class="flex items-center gap-2 mt-2"><span class="text-sm text-[#c8c8d8]">Columns:</span><!--$-->', '<!--/--><button class="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors">+ Add Column</button></div><!--$-->', "<!--/--></div>"], _tmpl$23 = ["<main", ' class="relative min-h-screen"><div class="mesh-gradient"></div><div class="grain-overlay"></div><div class="relative z-10 mx-auto max-w-7xl px-6 py-8"><div class="mb-8 fade-in-up delay-1 flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><div class="flex items-center gap-3 mb-2"><div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-500/20"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg></div><h1 class="text-2xl font-bold tracking-tight text-white">Requests Client</h1></div><p class="text-sm text-[#8b8b9e]">Choose a protocol, customize your options, and trigger requests immediately.</p></div><div class="flex p-1 bg-[#12121a] border border-[#1e1e2e] rounded-xl self-start md:self-auto shrink-0 shadow-lg"><button class="', '"><span>⚡</span> gRPC Protocol</button><button class="', '"><span>🌐</span> HTTP / REST</button><button class="', '"><span>📡</span> <!--$-->', '<!--/--></button></div></div><div class="grid grid-cols-1 lg:grid-cols-12 gap-4 fade-in-up delay-2"><div class="lg:col-span-5 space-y-4"><!--$-->', "<!--/--><!--$-->", '<!--/--><div class="card p-4"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9"></path><path d="M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg><h2 class="text-sm font-semibold text-white">', '</h2></div><button class="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors">+ Add Header</button></div><div class="space-y-2"><!--$-->', "<!--/--><!--$-->", '<!--/--></div></div></div><div class="lg:col-span-7 space-y-4"><div class="card p-4"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg><h2 class="text-sm font-semibold text-white">', "</h2><!--$-->", "<!--/--></div><button", ' class="', '"><!--$-->', "<!--/--><!--$-->", "<!--/--></button></div><textarea", "", ' class="', '" spellcheck="false"', '></textarea></div><div class="card overflow-hidden"><div class="flex border-b border-[#1e1e2e]"><button class="', '">Response</button><button class="', '">History<!--$-->', '<!--/--></button><button class="', '">Chart</button><button class="', '">Table</button></div><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div></div></div></div></main>"], _tmpl$24 = ["<option", ">", "</option>"], _tmpl$25 = ["<div", ' class="flex flex-col items-center justify-center py-12 text-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5a5a6e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg><p class="text-sm text-[#5a5a6e]">Drag & drop a .proto file here</p><p class="text-xs text-[#3a3a4e] mt-1">or use the buttons above</p></div>'], _tmpl$26 = ["<div", ' class="flex gap-2"><input type="text" placeholder="Key"', ' class="flex-1 rounded-lg border border-[#1e1e2e] bg-[#12121a] px-2 py-1.5 text-xs text-white placeholder-[#3a3a4e] focus:outline-none focus:border-[#3b82f6]"><input type="text" placeholder="Value"', ' class="flex-1 rounded-lg border border-[#1e1e2e] bg-[#12121a] px-2 py-1.5 text-xs text-white placeholder-[#3a3a4e] focus:outline-none focus:border-[#3b82f6]"><button class="text-[#5a5a6e] hover:text-red-400 transition-colors px-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div>'], _tmpl$27 = ["<svg", ' width="14" height="14" viewBox="0 0 24 24" class="animate-spin"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10" stroke-linecap="round"></circle></svg>'], _tmpl$28 = ["<div", ' class="flex flex-col items-center justify-center py-12 text-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a4e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><p class="text-sm text-[#5a5a6e]">No requests yet</p></div>'], _tmpl$29 = ["<button", ' class="w-full flex items-center justify-between px-4 py-3 border-b border-[#1e1e2e] text-left transition-colors hover:bg-[#1c1c28] group"><div class="flex items-center gap-3 min-w-0"><span class="', '"></span><div class="min-w-0"><p class="text-sm font-medium text-white truncate">', '</p><p class="text-xs text-[#5a5a6e] truncate"><!--$-->', "<!--/--> · <!--$-->", '<!--/--></p></div></div><div class="text-right shrink-0 ml-3"><p class="text-xs text-[#5a5a6e]"><!--$-->', '<!--/-->ms</p><p class="text-[10px] text-[#3a3a4e]">', "</p></div></button>"], _tmpl$30 = ["<div", ' class="flex flex-col items-center justify-center py-12 text-center rounded-xl bg-[#12121a] border border-[#1e1e2e] border-dashed"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3a3a4e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg><p class="text-sm text-[#5a5a6e]">No valid array data found at path</p><p class="text-xs text-[#3a3a4e] mt-1">Make a request and check your Array Data Path</p></div>'], _tmpl$31 = ["<div", ' class="flex gap-2 items-center"><input type="text" placeholder="Header"', ' class="rounded-lg border border-[#1e1e2e] bg-[#12121a] px-2 py-1.5 text-xs text-white placeholder-[#3a3a4e] focus:outline-none focus:border-[#3b82f6]"><input type="text" placeholder="JSON Key"', ' class="rounded-lg border border-[#1e1e2e] bg-[#12121a] px-2 py-1.5 text-xs text-white placeholder-[#3a3a4e] focus:outline-none focus:border-[#3b82f6]"><button class="text-[#5a5a6e] hover:text-red-400 transition-colors">✕</button></div>'], _tmpl$32 = ["<tr", ">", "</tr>"], _tmpl$33 = ["<th", ' class="px-4 py-3 font-medium border-b border-[#2a2a3e] whitespace-nowrap">', "</th>"], _tmpl$34 = ["<tr", ' class="hover:bg-[#1a1a24]/50 transition-colors">', "</tr>"], _tmpl$35 = ["<td", ' class="px-4 py-3 border-b border-[#1e1e2e]/50 max-w-[200px] truncate"', ">", "</td>"];
const id$$ = "src/routes/requests.tsx?pick=default&pick=$css";
function get(obj, path, defValue) {
  if (!path) return obj;
  const pathArray = Array.isArray(path) ? path : path.match(/([^[.\]])+/g);
  const result = pathArray?.reduce((prevObj, key) => prevObj && prevObj[key], obj);
  return result === void 0 ? defValue : result;
}
if (!isServer) {
  Chart.register(...registerables);
}
function RequestsClient() {
  const [requestType, setRequestType] = createSignal("grpc");
  const [httpMethod, setHttpMethod] = createSignal("GET");
  const [httpUrl, setHttpUrl] = createSignal("https://jsonplaceholder.typicode.com/todos/");
  const [protoContent, setProtoContent] = createSignal("");
  const [parsedProto, setParsedProto] = createSignal(null);
  const [parseError, setParseError] = createSignal(null);
  const [serverAddress, setServerAddress] = createSignal("localhost:50051");
  const [useTls, setUseTls] = createSignal(false);
  const [selectedService, setSelectedService] = createSignal("");
  const [selectedMethod, setSelectedMethod] = createSignal("");
  const [headers, setHeaders] = createSignal([]);
  const [requestBody, setRequestBody] = createSignal("{}");
  const [response, setResponse] = createSignal(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [requestError, setRequestError] = createSignal(null);
  const [isStreaming, setIsStreaming] = createSignal(false);
  const [history, setHistory] = createSignal([]);
  const [historyCounter, setHistoryCounter] = createSignal(0);
  const [isDragging, setIsDragging] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal("response");
  const [chartDataPath, setChartDataPath] = createSignal("");
  const [chartXKey, setChartXKey] = createSignal("");
  const [chartYKey, setChartYKey] = createSignal("");
  const [tableDataPath, setTableDataPath] = createSignal("");
  const [tableHeaders, setTableHeaders] = createSignal([]);
  const parsedTableData = () => {
    if (!response() || !response().data && !response().response) return null;
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
      return [{
        id: "value",
        header: "Value",
        accessorFn: (row) => row
      }];
    }
    const custom = tableHeaders();
    if (custom.length > 0) {
      return custom.map((col) => ({
        accessorKey: col.key,
        header: col.header,
        cell: (info) => {
          const val = get(info.row.original, col.key);
          if (typeof val === "object" && val !== null) {
            return JSON.stringify(val);
          }
          return String(val ?? "");
        }
      }));
    }
    return Object.keys(firstObj).map((key) => ({
      accessorKey: key,
      header: key,
      cell: (info) => {
        const val = info.getValue();
        if (typeof val === "object" && val !== null) {
          return JSON.stringify(val);
        }
        return String(val ?? "");
      }
    }));
  };
  const table = createSolidTable({
    get data() {
      return parsedTableData() || [];
    },
    get columns() {
      return tableColumns();
    },
    getCoreRowModel: getCoreRowModel()
  });
  const parsedChartData = () => {
    if (!response() || !response().data && !response().response) return {
      labels: [],
      datasets: []
    };
    let dataArray = response().data || response().response;
    if (chartDataPath()) {
      dataArray = get(dataArray, chartDataPath());
    }
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return {
        labels: [],
        datasets: []
      };
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
      datasets: [{
        label: chartYKey() || "Value",
        data: points,
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        borderWidth: 2,
        pointBackgroundColor: "#10b981",
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
        fill: true
      }]
    };
  };
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
      console.log("Parsing proto content...");
      const parsed = parseProtoContent(content);
      setParsedProto(parsed);
      setParseError(null);
      if (parsed.services.length > 0) {
        const firstService = parsed.services[0].fullName;
        setSelectedService(firstService);
        if (parsed.services[0].methods.length > 0) {
          setSelectedMethod(parsed.services[0].methods[0].name);
        }
      }
    } catch (err) {
      console.error("Proto parse error:", err);
      setParsedProto(null);
      setParseError(err.message || "Failed to parse proto file");
    }
  });
  createEffect(() => {
    const proto = parsedProto();
    const serviceName = selectedService();
    const methodName = selectedMethod();
    if (!proto || !serviceName || !methodName || requestType() !== "grpc") return;
    const service = proto.services.find((s) => s.fullName === serviceName);
    if (!service) return;
    const method = service.methods.find((m) => m.name === methodName);
    if (!method) return;
    const skeleton = generateSkeleton(proto.messageTypes, method.requestType);
    setRequestBody(JSON.stringify(skeleton, null, 2));
  });
  const [savedProtos] = createResource(async () => {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/protos` : "/api/protos";
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });
  const currentMethod = () => {
    const proto = parsedProto();
    const serviceName = selectedService();
    const methodName = selectedMethod();
    if (!proto || !serviceName || !methodName) return null;
    const service = proto.services.find((s) => s.fullName === serviceName);
    if (!service) return null;
    return service.methods.find((m) => m.name === methodName) || null;
  };
  return ssr(_tmpl$23, ssrHydrationKey(), `flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${requestType() === "grpc" ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30 shadow-md" : "text-[#8b8b9e] hover:text-white border border-transparent"}`, `flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${requestType() === "http" ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30 shadow-md" : "text-[#8b8b9e] hover:text-white border border-transparent"}`, `flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all border ${isStreaming() ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-md" : "text-[#8b8b9e] hover:text-white border-transparent"}`, isStreaming() ? "Stream ON" : "Stream OFF", escape(createComponent(Show, {
    get when() {
      return requestType() === "grpc";
    },
    get children() {
      return [ssr(_tmpl$5, ssrHydrationKey(), escape(createComponent(Show, {
        get when() {
          return savedProtos() && savedProtos().length > 0;
        },
        get children() {
          return ssr(_tmpl$, ssrHydrationKey(), escape(createComponent(For, {
            get each() {
              return savedProtos();
            },
            children: (p) => ssr(_tmpl$24, ssrHydrationKey() + ssrAttribute("value", escape(p.id, true), false), escape(p.name))
          })));
        }
      })), `relative rounded-xl border-2 border-dashed transition-colors ${isDragging() ? "border-emerald-500 bg-emerald-500/5" : "border-[#1e1e2e] hover:border-[#2a2a3e]"}`, escape(createComponent(Show, {
        get when() {
          return protoContent();
        },
        get fallback() {
          return ssr(_tmpl$25, ssrHydrationKey());
        },
        get children() {
          return ssr(_tmpl$2, ssrHydrationKey() + ssrAttribute("value", escape(protoContent(), true), false));
        }
      })), escape(createComponent(Show, {
        get when() {
          return parseError();
        },
        get children() {
          return ssr(_tmpl$3, ssrHydrationKey(), escape(parseError()));
        }
      })), escape(createComponent(Show, {
        get when() {
          return parsedProto();
        },
        get children() {
          return ssr(_tmpl$4, ssrHydrationKey(), escape(parsedProto().services.length), escape(parsedProto().services.reduce((a, s) => a + s.methods.length, 0)));
        }
      }))), ssr(_tmpl$6, ssrHydrationKey(), ssrAttribute("value", escape(serverAddress(), true), false), `relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useTls() ? "bg-emerald-500" : "bg-[#2a2a3e]"}`, `inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${useTls() ? "translate-x-4" : "translate-x-0.5"}`), createComponent(Show, {
        get when() {
          return parsedProto();
        },
        get children() {
          return ssr(_tmpl$8, ssrHydrationKey(), ssrAttribute("value", escape(selectedService(), true), false), escape(createComponent(For, {
            get each() {
              return parsedProto()?.services || [];
            },
            children: (service) => ssr(_tmpl$24, ssrHydrationKey() + ssrAttribute("value", escape(service.fullName, true), false), escape(service.fullName))
          })), ssrAttribute("value", escape(selectedMethod(), true), false), escape(createComponent(For, {
            get each() {
              return parsedProto()?.services.find((s) => s.fullName === selectedService())?.methods || [];
            },
            children: (method) => ssr(_tmpl$24, ssrHydrationKey() + ssrAttribute("value", escape(method.name, true), false), escape(method.name))
          })), escape(createComponent(Show, {
            get when() {
              return currentMethod();
            },
            get children() {
              return ssr(_tmpl$7, ssrHydrationKey(), escape(currentMethod().name), escape(currentMethod().requestType), escape(currentMethod().responseType));
            }
          })));
        }
      })];
    }
  })), escape(createComponent(Show, {
    get when() {
      return requestType() === "http";
    },
    get children() {
      return ssr(_tmpl$9, ssrHydrationKey(), ssrAttribute("value", escape(httpMethod(), true), false), ssrAttribute("value", escape(httpUrl(), true), false));
    }
  })), requestType() === "grpc" ? "Metadata Headers" : "HTTP Headers", escape(createComponent(For, {
    get each() {
      return headers();
    },
    children: (header, index) => ssr(_tmpl$26, ssrHydrationKey(), ssrAttribute("value", escape(header.key, true), false), ssrAttribute("value", escape(header.value, true), false))
  })), escape(createComponent(Show, {
    get when() {
      return headers().length === 0;
    },
    get children() {
      return ssr(_tmpl$0, ssrHydrationKey());
    }
  })), requestType() === "grpc" ? "Request Message Body" : "HTTP Request Body", escape(createComponent(Show, {
    get when() {
      return requestType() === "grpc" && currentMethod();
    },
    get children() {
      return ssr(_tmpl$1, ssrHydrationKey(), escape(currentMethod().requestType));
    }
  })), ssrAttribute("disabled", isLoading() || requestType() === "grpc" && (!parsedProto() || !selectedMethod()), true), `inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${isLoading() || requestType() === "grpc" && (!parsedProto() || !selectedMethod()) ? "bg-[#1e1e2e] text-[#5a5a6e] cursor-not-allowed" : "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-px"}`, escape(createComponent(Show, {
    get when() {
      return !isLoading();
    },
    get fallback() {
      return ssr(_tmpl$27, ssrHydrationKey());
    },
    get children() {
      return ssr(_tmpl$10, ssrHydrationKey());
    }
  })), isLoading() ? "Sending..." : "Send Request", ssrAttribute("value", escape(requestBody(), true), false), ssrAttribute("disabled", requestType() === "http" && (httpMethod() === "GET" || httpMethod() === "DELETE"), true), `w-full min-h-[200px] rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4 text-sm text-[#c8c8d8] font-mono resize-y focus:outline-none focus:border-[#3b82f6] transition-colors ${requestType() === "http" && (httpMethod() === "GET" || httpMethod() === "DELETE") ? "opacity-30 cursor-not-allowed" : ""}`, ssrAttribute("placeholder", requestType() === "http" && (httpMethod() === "GET" || httpMethod() === "DELETE") ? "No body payload is sent with GET / DELETE requests" : '{ "key": "value" }', false), `flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab() === "response" ? "text-white border-b-2 border-emerald-500 bg-emerald-500/5" : "text-[#5a5a6e] hover:text-[#8b8b9e]"}`, `flex-1 px-4 py-3 text-sm font-medium transition-colors relative border-b-2 ${activeTab() === "history" ? "text-white border-violet-500 bg-violet-500/5" : "text-[#5a5a6e] hover:text-[#8b8b9e] border-transparent"}`, escape(createComponent(Show, {
    get when() {
      return history().length > 0;
    },
    get children() {
      return ssr(_tmpl$11, ssrHydrationKey(), escape(history().length));
    }
  })), `flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab() === "chart" ? "text-white border-blue-500 bg-blue-500/5" : "text-[#5a5a6e] hover:text-[#8b8b9e] border-transparent"}`, `flex-1 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab() === "table" ? "text-white border-orange-500 bg-orange-500/5" : "text-[#5a5b6e] hover:text-[#8b8b9e] border-transparent"}`, escape(createComponent(Show, {
    get when() {
      return activeTab() === "response";
    },
    get children() {
      return ssr(_tmpl$17, ssrHydrationKey(), escape(createComponent(Show, {
        get when() {
          return requestError();
        },
        get children() {
          return ssr(_tmpl$12, ssrHydrationKey(), escape(requestError()));
        }
      })), escape(createComponent(Show, {
        get when() {
          return response();
        },
        get children() {
          return ssr(_tmpl$14, ssrHydrationKey(), `badge ${response()?.success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`, `h-1.5 w-1.5 rounded-full ${response()?.success ? "bg-emerald-400" : "bg-red-400"}`, response()?.success ? escape(response()?.status) || "OK" : `Error ${escape(response()?.grpcCode) ?? escape(response()?.statusCode) ?? ""}`, escape(createComponent(Show, {
            get when() {
              return response()?.latencyMs;
            },
            get children() {
              return ssr(_tmpl$13, ssrHydrationKey(), escape(response().latencyMs));
            }
          })), escape(JSON.stringify(response()?.data || response()?.error || response()?.grpcStatus || response(), null, 2)));
        }
      })), escape(createComponent(Show, {
        get when() {
          return !response() && !requestError() && !isLoading();
        },
        get children() {
          return ssr(_tmpl$15, ssrHydrationKey());
        }
      })), escape(createComponent(Show, {
        get when() {
          return isLoading();
        },
        get children() {
          return ssr(_tmpl$16, ssrHydrationKey());
        }
      })));
    }
  })), escape(createComponent(Show, {
    get when() {
      return activeTab() === "history";
    },
    get children() {
      return ssr(_tmpl$18, ssrHydrationKey(), escape(createComponent(Show, {
        get when() {
          return history().length > 0;
        },
        get fallback() {
          return ssr(_tmpl$28, ssrHydrationKey());
        },
        get children() {
          return createComponent(For, {
            get each() {
              return history();
            },
            children: (entry) => ssr(_tmpl$29, ssrHydrationKey(), `h-2 w-2 rounded-full shrink-0 ${entry.success ? "bg-emerald-500" : "bg-red-500"}`, escape(entry.method), escape(entry.service), escape(entry.address), escape(entry.latencyMs), escape(entry.timestamp.toLocaleTimeString()))
          });
        }
      })));
    }
  })), escape(createComponent(Show, {
    get when() {
      return activeTab() === "chart";
    },
    get children() {
      return ssr(_tmpl$20, ssrHydrationKey(), ssrAttribute("value", escape(chartDataPath(), true), false), ssrAttribute("value", escape(chartXKey(), true), false), ssrAttribute("value", escape(chartYKey(), true), false), escape(createComponent(Show, {
        get when() {
          return parsedChartData().datasets?.length > 0;
        },
        get fallback() {
          return ssr(_tmpl$30, ssrHydrationKey());
        },
        get children() {
          return ssr(_tmpl$19, ssrHydrationKey(), escape(createComponent(Line, {
            get data() {
              return parsedChartData();
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  labels: {
                    color: "#c8c8d8"
                  }
                },
                tooltip: {
                  mode: "index",
                  intersect: false
                }
              },
              scales: {
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
            }
          })));
        }
      })));
    }
  })), escape(createComponent(Show, {
    get when() {
      return activeTab() === "table";
    },
    get children() {
      return ssr(_tmpl$22, ssrHydrationKey(), ssrAttribute("value", escape(tableDataPath(), true), false), escape(createComponent(For, {
        get each() {
          return tableHeaders();
        },
        children: (col, i) => ssr(_tmpl$31, ssrHydrationKey(), ssrAttribute("value", escape(col.header, true), false), ssrAttribute("value", escape(col.key, true), false))
      })), escape(createComponent(Show, {
        get when() {
          return parsedTableData() !== null;
        },
        get fallback() {
          return ssr(_tmpl$30, ssrHydrationKey());
        },
        get children() {
          return ssr(_tmpl$21, ssrHydrationKey(), escape(createComponent(For, {
            get each() {
              return table.getHeaderGroups();
            },
            children: (headerGroup) => ssr(_tmpl$32, ssrHydrationKey(), escape(createComponent(For, {
              get each() {
                return headerGroup.headers;
              },
              children: (header) => ssr(_tmpl$33, ssrHydrationKey(), header.isPlaceholder ? escape(null) : escape(flexRender(header.column.columnDef.header, header.getContext())))
            })))
          })), escape(createComponent(For, {
            get each() {
              return table.getRowModel().rows;
            },
            children: (row) => ssr(_tmpl$34, ssrHydrationKey(), escape(createComponent(For, {
              get each() {
                return row.getVisibleCells();
              },
              children: (cell) => ssr(_tmpl$35, ssrHydrationKey(), ssrAttribute("title", escape(String(cell.getValue() ?? ""), true), false), escape(flexRender(cell.column.columnDef.cell, cell.getContext())))
            })))
          })));
        }
      })));
    }
  })));
}
export {
  RequestsClient as default,
  id$$
};
//# sourceMappingURL=requests-CrDNhDce.js.map
