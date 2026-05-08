import { isServer, ssr, ssrHydrationKey, ssrAttribute, escape, createComponent } from "solid-js/web";
import { createSignal, onMount, createResource, createEffect, Show, For } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import get from "lodash.get";
import { p as parseProtoContent } from "./protoParser-C1XlV9an.js";
import { D as DefaultChart } from "./index-D4uTJpLk.js";
import { Chart, registerables } from "chart.js";
import { c as createSolidTable, f as flexRender } from "./index-DNUuAjQM.js";
import { u as useParams, a as useNavigate } from "../../entry-server.js";
import { getCoreRowModel } from "@tanstack/table-core";
import "protobufjs";
import "pathe";
import "radix3";
import "seroval";
import "seroval-plugins/web";
import "h3";
import "solid-js/web/storage";
import "cookie-es";
var _tmpl$ = ["<div", ' class="overflow-auto max-h-[300px] border border-[#2a2a3a]/50 rounded bg-[#101015] custom-scrollbar"><table class="w-full text-left text-xs text-[#c8c8d8]"><thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0 shadow-sm">', '</thead><tbody class="divide-y divide-[#1e1e2e]">', "</tbody></table></div>"], _tmpl$2 = ["<tr", ">", "</tr>"], _tmpl$3 = ["<th", ' class="px-3 py-2 font-medium border-b border-[#2a2a3e] whitespace-nowrap uppercase text-[10px] tracking-wider">', "</th>"], _tmpl$4 = ["<tr", ' class="hover:bg-[#1a1a24]/50 transition-colors">', "</tr>"], _tmpl$5 = ["<td", ' class="px-3 py-2 border-b border-[#1e1e2e]/50 max-w-[150px] truncate"', ">", "</td>"], _tmpl$6 = ["<div", ' class="h-[250px] bg-[#101015] p-3 rounded border border-[#2a2a3a]/50">', "</div>"], _tmpl$7 = ["<p", ' class="text-xs text-[#5a5a6e]">No valid array data for chart</p>'], _tmpl$8 = ["<div", '><label class="mb-1 block text-xs text-[#8b8b9e]">Auth Service</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-sm text-white focus:border-blue-500 focus:outline-none"', "><option value>None (No Auth)</option><!--$-->", "<!--/--></select></div>"], _tmpl$9 = ["<div", '><label class="mb-1 block text-xs text-[#8b8b9e]">Auth Method</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-sm text-white focus:border-blue-500 focus:outline-none"', "><option value disabled>Select method...</option><!--$-->", "<!--/--></select></div>"], _tmpl$0 = ["<div", '><label class="mb-1 block text-xs text-[#8b8b9e]">Request Template (JSON)</label><textarea class="w-full rounded-lg border border-[#2a2a3a] bg-[#1b1b26] p-2 text-xs font-mono text-emerald-300 focus:border-emerald-500 focus:outline-none" rows="3"', "></textarea></div>"], _tmpl$1 = ["<div", ' class="grid grid-cols-2 gap-2"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Username (Basic)</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"', '></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">Password (Basic)</label><input type="password" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"', "></div></div>"], _tmpl$10 = ["<div", '><label class="mb-1 block text-xs text-[#8b8b9e]">Bearer Token</label><input type="password" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"', "></div>"], _tmpl$11 = ["<div", '><label class="mb-1 block text-xs text-[#8b8b9e]">Body (JSON)</label><textarea class="w-full rounded-lg border border-[#2a2a3a] bg-[#1b1b26] p-2 text-xs font-mono text-emerald-300 focus:border-emerald-500 focus:outline-none" rows="2"', "></textarea></div>"], _tmpl$12 = ["<div", ' class="space-y-3"><div><label class="mb-1 block text-xs text-[#8b8b9e]">URL</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none" placeholder="https://auth.example.com/token"', '></div><div class="grid grid-cols-2 gap-2"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Method</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"', '><option value="POST">POST</option><option value="GET">GET</option><option value="PUT">PUT</option></select></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">Auth Scheme</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"', '><option value="basic">Basic (User:Pass)</option><option value="bearer">Bearer Token</option><option value="none">None</option></select></div></div><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$13 = ["<div", ' class="space-y-3"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Static Bearer Token</label><input type="password" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none" placeholder="Paste your token here..."', '><p class="mt-2 text-[10px] text-[#5b5b6e]">This token will be injected directly as <code class="text-[#8b8b9e] font-mono">Authorization: Bearer &lt;token&gt;</code> into all gRPC steps. No Auth API request will be made.</p></div></div>'], _tmpl$14 = ["<div", ' class="pt-2 border-t border-[#2a2a3a]/50"><label class="mb-1 block text-xs text-[#8b8b9e]">Token JSON Path</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none" placeholder="e.g. accessToken"', "></div>"], _tmpl$15 = ["<svg", ' class="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$16 = ["<button", "", ' class="w-full rounded-lg bg-blue-600/20 py-2 text-xs font-bold text-blue-400 hover:bg-blue-600/30 transition-colors flex items-center justify-center gap-2 border border-blue-500/30"><!--$-->', "<!--/-->Test Authentication</button>"], _tmpl$17 = ["<div", ' class="', '"><div class="font-bold mb-1">', "</div><!--$-->", "<!--/--></div>"], _tmpl$18 = ["<select", ' class="rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none max-w-[150px] truncate"><option value>Load saved proto...</option><!--$-->', "<!--/--></select>"], _tmpl$19 = ["<div", ' class="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">', "</div>"], _tmpl$20 = ["<div", ' class="', '"><div class="flex justify-between items-center mb-4"><h3 class="text-lg font-bold text-white">Execution Result</h3><span class="', '">', '</span></div><div class="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">', "</div></div>"], _tmpl$21 = ["<div", ' class="absolute right-0 mt-2 w-56 rounded-xl bg-[#1e1e2e] border border-[#2a2a3a] shadow-2xl z-50 overflow-hidden fade-in py-1"><div class="px-3 py-2 text-[10px] font-bold text-[#5b5b6e] uppercase tracking-wider border-b border-[#2a2a3a]/50 mb-1">Select Step Type</div><button class="w-full text-left px-4 py-2 text-sm text-[#c8c8d8] hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-2 transition-colors"><span class="text-lg">⚡</span> gRPC Request</button><button class="w-full text-left px-4 py-2 text-sm text-[#c8c8d8] hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-2 transition-colors"><span class="text-lg">🌐</span> REST Request</button><button class="w-full text-left px-4 py-2 text-sm text-[#c8c8d8] hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-2 transition-colors"><span class="text-lg">🛢️</span> Database Query</button><div class="h-px bg-[#2a2a3a] my-1 mx-2"></div><button class="w-full text-left px-4 py-2 text-sm text-[#c8c8d8] hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-2 transition-colors"><span class="text-lg">📊</span> View Table</button><button class="w-full text-left px-4 py-2 text-sm text-[#c8c8d8] hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-2 transition-colors"><span class="text-lg">📈</span> Chart</button></div>'], _tmpl$22 = ["<div", ' class="rounded-xl border border-dashed border-[#2a2a3a] py-12 text-center bg-[#0a0a0f]/50"><p class="text-[#8b8b9e] text-sm">No steps added yet. Add a step to start your workflow.</p></div>'], _tmpl$23 = ["<main", ' class="mx-auto max-w-7xl px-6 py-12"><div class="mb-8 flex items-center justify-between"><div><input class="bg-transparent text-3xl font-extrabold tracking-tight text-white border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 -ml-2 transition-all"', ' placeholder="Workflow Name"></div><div class="flex items-center gap-4"><button class="', '"', '>+ Form Variable</button><div class="w-px h-6 bg-[#2a2a3a] mx-1"></div><button class="btn-secondary">Save Flow</button><button class="btn-primary flex items-center gap-2"', "><!--$-->", '<!--/-->Run</button></div></div><div class="grid grid-cols-1 gap-8 lg:grid-cols-3"><div class="col-span-1 space-y-6"><div class="card p-5"><h3 class="mb-4 text-lg font-bold text-white flex items-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>Connection</h3><label class="mb-1 block text-sm font-medium text-[#8b8b9e]">Server Address</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-blue-500 focus:outline-none" placeholder="e.g. localhost:50051"', '><label class="mt-4 flex items-center gap-3 cursor-pointer"><div class="relative"><input type="checkbox" class="peer sr-only"', `><div class="h-6 w-11 rounded-full bg-[#2a2a3a] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-[#8b8b9e] after:transition-all after:content-[''] peer-checked:bg-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50"></div></div><span class="text-sm font-medium text-[#8b8b9e] peer-checked:text-white transition-colors">Use TLS Encryption</span></label><div class="mt-6 border-t border-[#2a2a3a] pt-6"><label class="mb-1 block text-sm font-medium text-[#8b8b9e]">Schedule (Cron)<span class="ml-1 text-[10px] text-[#5b5b6e]">e.g. */5 * * * *</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-sm text-white focus:border-blue-500 focus:outline-none placeholder:text-[#5b5b6e]" placeholder="Leave empty for manual only"`, '><p class="mt-2 text-[10px] text-[#5b5b6e]">Uses standard cron syntax (min hour day month weekday).</p></div><div class="mt-6 border-t border-[#2a2a3a] pt-6"><h3 class="mb-4 text-sm font-bold text-white flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>Authentication</h3><div class="space-y-4"><div class="flex p-1 bg-[#1e1e2e] rounded-lg"><button class="', '">gRPC</button><button class="', '">REST</button><button class="', '">Static Token</button></div><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", '<!--/--></div></div></div><div class="card p-5"><div class="flex items-center justify-between mb-4"><h3 class="text-lg font-bold text-white flex items-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>Proto Definition</h3><!--$-->', '<!--/--></div><textarea class="h-64 w-full resize-none font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-3 text-blue-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50" placeholder="Paste your .proto schema here..."', "></textarea><!--$-->", '<!--/--></div></div><div class="col-span-1 lg:col-span-2 space-y-6"><!--$-->', '<!--/--><div class="flex items-center justify-between relative"><h2 class="text-xl font-bold text-white">Workflow Steps</h2><div class="relative"><button class="text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-all hover:bg-blue-500/20"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Add Step</button><!--$-->', '<!--/--></div></div><div class="space-y-6"><!--$-->', "<!--/--><!--$-->", "<!--/--></div></div></div></main>"], _tmpl$24 = ["<svg", ' class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$25 = ["<svg", ' width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'], _tmpl$26 = ["<option", ">", "</option>"], _tmpl$27 = ["<div", ' class="break-all font-mono">Token: <!--$-->', "<!--/--></div>"], _tmpl$28 = ["<div", ' class="break-words">', "</div>"], _tmpl$29 = ["<span", ' class="bg-blue-500/20 text-blue-400 text-[10px] px-1 py-0.5 rounded uppercase tracking-wider">', "</span>"], _tmpl$30 = ["<div", ' class="grid grid-cols-2 gap-4"><div><p class="text-[10px] text-[#8b8b9e] uppercase mb-1">Rendered Payload</p><pre class="text-xs text-blue-300 font-mono overflow-x-auto bg-[#151520] p-2 rounded">', '</pre></div><div><p class="text-[10px] text-[#8b8b9e] uppercase mb-1">Response</p><pre class="', '">', "</pre></div></div>"], _tmpl$31 = ["<div", ' class="mt-2"><p class="text-[10px] text-[#8b8b9e] uppercase mb-1">Rendered Table Data</p><!--$-->', "<!--/--></div>"], _tmpl$32 = ["<div", ' class="mt-2"><p class="text-[10px] text-[#8b8b9e] uppercase mb-1">Rendered Chart Data</p><!--$-->', "<!--/--></div>"], _tmpl$33 = ["<div", ' class="rounded-lg bg-[#1e1e2e] border border-[#2a2a3a] p-4"><div class="flex items-center justify-between mb-2"><span class="font-mono text-white text-sm bg-[#2a2a3a] px-2 py-1 rounded flex items-center gap-2">Step: <!--$-->', "<!--/--><!--$-->", '<!--/--></span><span class="', '"><!--$-->', "<!--/--> <!--$-->", "<!--/--></span></div><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$34 = ["<optgroup", ' label="Load a Saved Proto">', "</optgroup>"], _tmpl$35 = ["<optgroup", ' label="Available Services in Proto">', "</optgroup>"], _tmpl$36 = ["<div", ' class="grid grid-cols-2 gap-4 mb-4"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Service</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', "><option value", ">Select a service...</option><!--$-->", "<!--/--><!--$-->", '<!--/--></select></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">Method</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"', "><option value disabled>Select a method...</option><!--$-->", "<!--/--></select></div></div>"], _tmpl$37 = ["<span", ' class="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">Active</span>'], _tmpl$38 = ["<div", ' class="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#3a3a4e] uppercase pointer-events-none group-hover:text-[#4a4a5e] transition-colors">Default</div>'], _tmpl$39 = ["<div", ' class="mt-5 pt-5 border-t border-[#2a2a3a]/50"><label class="mb-2 block text-xs font-semibold text-[#8b8b9e] flex items-center justify-between"><span class="flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect></svg>Server Overide</span><!--$-->', '<!--/--></label><div class="relative group"><input type="text" class="', '" placeholder="', '"', "><!--$-->", "<!--/--></div></div>"], _tmpl$40 = ["<div", ' class="mt-4 flex items-center justify-between px-1"><label class="text-xs font-semibold text-[#8b8b9e] flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>Encryption (TLS)</label><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" class="sr-only peer"', `><div class="w-8 h-4 bg-[#2a2a3a] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#8b8b9e] after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div><span class="ml-2 text-[10px] font-medium text-[#5b5b6e]">`, "</span></label></div>"], _tmpl$41 = ["<div", '><div class="flex items-center justify-between mt-4 mb-1"><label class="text-xs text-[#8b8b9e]">Request Payload Template</label><span class="text-[10px] text-blue-400 font-mono">{{ steps.&lt;id>.response }}</span></div><textarea class="h-32 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"', "></textarea></div>"], _tmpl$42 = ["<div", ' class="mt-4"><div class="flex items-center justify-between mb-1"><label class="text-xs text-[#8b8b9e]">Headers (Metadata) Template</label><span class="text-[10px] text-blue-400 font-mono">{ "Authorization": "Bearer {{ ... }}" }</span></div><textarea class="h-20 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" placeholder="{ &quot;key&quot;: &quot;value&quot; }"', "></textarea></div>"], _tmpl$43 = ["<div", '><div class="flex items-center justify-between mb-1"><label class="text-xs text-[#8b8b9e]">Request Body Template (JSON)</label><span class="text-[10px] text-blue-400 font-mono">Supports {{ variables }}</span></div><textarea class="h-32 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"', "></textarea></div>"], _tmpl$44 = ["<div", ' class="mb-4 space-y-4"><div><label class="mb-1 block text-xs text-[#8b8b9e]">URL Template</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none" placeholder="e.g. https://api.stripe.com/v1/customers/{{ form.customerId }}"', '></div><div class="grid grid-cols-2 gap-4"><div><label class="mb-1 block text-xs text-[#8b8b9e]">HTTP Method</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', '><option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="DELETE">DELETE</option><option value="PATCH">PATCH</option></select></div></div><!--$-->', '<!--/--><div><div class="flex items-center justify-between mt-4 mb-1"><label class="text-xs text-[#8b8b9e]">Headers Template (JSON)</label><span class="text-[10px] text-blue-400 font-mono">{ "Authorization": "Bearer {{ token }}" }</span></div><textarea class="h-20 w-full resize-y font-mono text-sm rounded-lg border border-[#2a2a3a] bg-[#151520] p-3 text-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" placeholder="{ &quot;Content-Type&quot;: &quot;application/json&quot; }"', "></textarea></div></div>"], _tmpl$45 = ["<div", ' class="mb-4"><div class="mb-4"><label class="mb-1 block text-xs text-[#8b8b9e]">Target Database Name <span class="text-[10px] text-[#5b5b6e]">(supports {{ variables }})</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder:text-[#5b5b6e]" placeholder="e.g. analytics_db or {{ steps.test.response.db_name }}"', '></div><div><div class="flex items-center justify-between mb-1"><label class="block text-xs text-[#8b8b9e]">SurrealQL Query</label><span class="text-[10px] text-blue-400 font-mono">Supports {{ variables }}</span></div><div class="relative group"><div class="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-red-600 to-orange-500 opacity-20 blur transition group-hover:opacity-40"></div><textarea class="relative w-full h-32 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-3 text-sm font-mono text-red-300 focus:border-red-500 outline-none custom-scrollbar" placeholder="SELECT * FROM users WHERE age > {{ steps.auth.response.min_age }};"', "></textarea></div></div></div>"], _tmpl$46 = ["<div", ' class="mt-2 rounded-md bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 text-[10px] text-purple-300">Will render: X = <code class="font-mono">', '</code> · Y = <code class="font-mono">', "</code></div>"], _tmpl$47 = ["<div", ' class="rounded-lg border border-purple-500/20 bg-[#0d0a10] p-4"><p class="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>Chart Configuration</p><div class="grid grid-cols-2 gap-3"><div><label class="mb-1 block text-xs text-[#8b8b9e]">X-Axis Property</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none" placeholder="symbol"', '></div><div><label class="mb-1 block text-xs text-[#8b8b9e]">Y-Axis Property</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none" placeholder="count"', "></div></div><!--$-->", "<!--/--></div>"], _tmpl$48 = ["<div", ' class="rounded-lg border border-emerald-500/20 bg-[#080f0a] p-4"><p class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18M3 15h18M9 3v18"></path></svg>Table Columns</p><p class="text-[10px] text-[#5b5b6e] mb-3">List the JSON keys to show as columns (e.g. <code class="text-emerald-400 font-mono">symbol</code>, <code class="text-emerald-400 font-mono">count</code>). Leave empty to auto-detect all keys.</p><div class="space-y-2"><!--$-->', '<!--/--><button class="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Add column</button></div></div>'], _tmpl$49 = ["<div", ' class="space-y-4 mt-2"><div class="rounded-lg border border-orange-500/20 bg-[#0f0e08] p-4"><p class="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>Data Source</p><label class="mb-1 block text-xs text-[#8b8b9e]">Source Step (previous gRPC step)</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-orange-300 font-mono focus:border-orange-500 focus:outline-none mb-3"', "><option value>Select a source step…</option><!--$-->", '<!--/--></select><div class="grid grid-cols-2 gap-3"><div><label class="mb-1 block text-xs text-[#8b8b9e]">Nested Array Path <span class="text-[10px] text-[#5b5b6e]">(lodash dot path)</span></label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a26] p-2.5 text-sm text-white font-mono focus:border-orange-500 focus:outline-none" placeholder="e.g. shares"', '><p class="text-[10px] text-[#5b5b6e] mt-1">Leave empty if the response is already an array. Use dot notation for deeper nesting.</p></div><div class="bg-[#0d0d14] rounded-lg border border-[#2a2a3a] p-2.5"><p class="text-[10px] text-[#5b5b6e] font-mono mb-1">Example response:</p><pre class="text-[10px] text-orange-300 font-mono overflow-x-auto">{ "cash": 98961,\n  "shares": [\n    { "symbol": "ORCL",\n      "count": 271 }\n  ]\n}</pre><p class="text-[10px] text-[#5b5b6e] mt-1">→ Path: <code class="text-orange-400 font-mono">shares</code></p></div></div></div><!--$-->', "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$50 = ["<div", ' class="card p-5 relative border-l-4 border-l-blue-500"><div class="absolute -left-[14px] -top-[14px] flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white ring-4 ring-[#0a0a0f]">', '</div><div class="flex justify-between items-start mb-4"><div class="flex items-center gap-4 flex-1"><div class="w-1/3"><label class="mb-1 block text-xs text-[#8b8b9e]">Step Type</label><select class="w-full bg-[#1e1e2e] text-white font-medium text-sm border-b border-[#2a2a3a] focus:border-blue-500 outline-none pb-1"', '><option value="grpc">⚡ gRPC Request</option><option value="rest">🌐 REST Request</option><option value="database">🛢️ Database Query</option><option value="table">📊 View Data Table</option><option value="bar">📊 Bar Chart</option><option value="line">📈 Line Chart</option><option value="doughnut">🍩 Doughnut Chart</option><option value="pie">🥧 Pie Chart</option><option value="scatter">📉 Scatter Chart</option></select></div><div class="flex-1"><label class="mb-1 block text-xs text-[#8b8b9e]">Step ID (for variables)</label><input type="text" class="w-full bg-transparent text-white font-mono text-sm border-b border-[#2a2a3a] focus:border-blue-500 outline-none pb-1"', '></div></div><button class="text-[#5b5b6e] hover:text-red-400 ml-4"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$51 = ["<option", ' value="', '">Load: <!--$-->', "<!--/--></option>"], _tmpl$52 = ["<option", "", ">", "</option>"], _tmpl$53 = ["<option", "", "><!--$-->", "<!--/--> (<!--$-->", "<!--/--> → <!--$-->", "<!--/-->)</option>"], _tmpl$54 = ["<option", ' value="', '">⚡ <!--$-->', "<!--/--><!--$-->", "<!--/--></option>"], _tmpl$55 = ["<div", ' class="flex gap-2"><input type="text" class="flex-1 rounded-lg border border-[#2a2a3a] bg-[#1a1a26] px-3 py-1.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none" placeholder="key name, e.g. symbol"', '><button class="text-[#5b5b6e] hover:text-red-400 px-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div>'], _tmpl$56 = ["<rect", ' x="3" y="3" width="18" height="18" rx="2"></rect>'], _tmpl$57 = ["<path", ' d="M3 9h18M3 15h18M9 3v18"></path>'], _tmpl$58 = ["<rect", ' x="2" y="3" width="4" height="18"></rect>'], _tmpl$59 = ["<rect", ' x="9" y="8" width="4" height="13"></rect>'], _tmpl$60 = ["<rect", ' x="16" y="14" width="4" height="7"></rect>'], _tmpl$61 = ["<div", ' class="text-[11px] text-[#5b5b6e] italic py-3 text-center border border-dashed border-[#2a2a3a] rounded-lg">No data — run the workflow to see the preview</div>'], _tmpl$62 = ["<div", ' class="', '"><div class="flex items-center justify-between mb-3"><span class="', '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><!--$-->', "<!--/--><!--$-->", '<!--/--></svg>Live Preview</span><span class="text-[10px] text-[#5b5b6e]"><!--$-->', "<!--/--> row<!--$-->", "<!--/--></span></div><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"];
const id$$ = "src/routes/workflows/[id].tsx?pick=default&pick=$css";
Chart.register(...registerables);
function LogTable(props) {
  const effectiveCols = () => {
    const explicit = (props.columns || []).filter(Boolean);
    if (explicit.length) return explicit;
    const d = props.data;
    if (!Array.isArray(d) || !d[0] || typeof d[0] !== "object") return [];
    return Object.keys(d[0]);
  };
  const table = createSolidTable({
    get data() {
      return Array.isArray(props.data) ? props.data : [];
    },
    get columns() {
      const cols = effectiveCols();
      if (!cols.length) {
        const d = props.data;
        if (!Array.isArray(d) || !d[0]) return [];
        if (typeof d[0] !== "object") return [{
          id: "value",
          header: "Value",
          accessorFn: (r) => r
        }];
      }
      return cols.map((k) => ({
        accessorKey: k,
        header: k,
        cell: (info) => {
          const v = info.getValue();
          if (typeof v === "object" && v !== null) return JSON.stringify(v);
          return String(v ?? "");
        }
      }));
    },
    getCoreRowModel: getCoreRowModel()
  });
  return ssr(_tmpl$, ssrHydrationKey(), escape(createComponent(For, {
    get each() {
      return table.getHeaderGroups();
    },
    children: (hg) => ssr(_tmpl$2, ssrHydrationKey(), escape(createComponent(For, {
      get each() {
        return hg.headers;
      },
      children: (h) => ssr(_tmpl$3, ssrHydrationKey(), h.isPlaceholder ? escape(null) : escape(flexRender(h.column.columnDef.header, h.getContext())))
    })))
  })), escape(createComponent(For, {
    get each() {
      return table.getRowModel().rows;
    },
    children: (row) => ssr(_tmpl$4, ssrHydrationKey(), escape(createComponent(For, {
      get each() {
        return row.getVisibleCells();
      },
      children: (cell) => ssr(_tmpl$5, ssrHydrationKey(), ssrAttribute("title", escape(String(cell.getValue() ?? ""), true), false), escape(flexRender(cell.column.columnDef.cell, cell.getContext())))
    })))
  })));
}
function LogChart(props) {
  const cType = () => props.chartType || "bar";
  const buildData = () => {
    const data = props.data;
    if (!Array.isArray(data) || !data.length) return {
      labels: [],
      datasets: []
    };
    const type = cType();
    const isPie = type === "pie" || type === "doughnut";
    const isScatter = type === "scatter";
    const isBar = type === "bar";
    if (isScatter) {
      const points2 = [];
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item && typeof item === "object") {
          points2.push({
            x: Number(props.xKey ? get(item, props.xKey) : i) || 0,
            y: Number(props.yKey ? get(item, props.yKey) : i) || 0
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
          label: props.yKey || "Value",
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
        labels.push(props.xKey ? String(get(item, props.xKey) ?? i) : i);
        points.push(Number(props.yKey ? get(item, props.yKey) : i) || 0);
      } else {
        labels.push(i);
        points.push(Number(item) || 0);
      }
    }
    if (isPie) {
      const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4"];
      const bgColors = points.map((_, i) => colors[i % colors.length]);
      return {
        labels,
        datasets: [{
          label: props.yKey || "Value",
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
        label: props.yKey || "Value",
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
  return ssr(_tmpl$6, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return Array.isArray(props.data) && props.data.length > 0;
    },
    get fallback() {
      return ssr(_tmpl$7, ssrHydrationKey());
    },
    get children() {
      return createComponent(DefaultChart, {
        get type() {
          return cType();
        },
        get data() {
          return buildData();
        },
        get options() {
          return chartOptions();
        }
      });
    }
  })));
}
function WorkflowBuilder() {
  const params = useParams();
  useNavigate();
  const isNew = params.id === "new";
  const [name, setName] = createSignal("New Workflow");
  const [protoContent, setProtoContent] = createSignal("");
  const [hasActiveInput, setHasActiveInput] = createSignal(false);
  const [activeInput, setActiveInput] = createSignal(null);
  onMount(() => {
    if (isServer) return;
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
  const [parsedProto, setParsedProto] = createSignal(null);
  const [compileError, setCompileError] = createSignal(null);
  const [runId, setRunId] = createSignal(null);
  const [runData, setRunData] = createSignal(null);
  const [isRunning, setIsRunning] = createSignal(false);
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
  return ssr(_tmpl$23, ssrHydrationKey(), ssrAttribute("value", escape(name(), true), false), `px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all ${hasActiveInput() ? "bg-purple-600 hover:bg-purple-500 shadow-md ring-2 ring-purple-500/50" : "bg-[#2a2a3a] text-[#5b5b6e] cursor-not-allowed"}`, ssrAttribute("title", hasActiveInput() ? "Insert {{ form.variable }} at cursor" : "Select an input field first", false), ssrAttribute("disabled", isNew || isRunning(), true), isRunning() ? _tmpl$24[0] + ssrHydrationKey() + _tmpl$24[1] : _tmpl$25[0] + ssrHydrationKey() + _tmpl$25[1], ssrAttribute("value", escape(serverAddress(), true), false), ssrAttribute("checked", useTls(), true), ssrAttribute("value", escape(schedule(), true), false), `flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${authType() === "grpc" ? "bg-blue-600 text-white shadow-lg" : "text-[#8b8b9e] hover:text-white"}`, `flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${authType() === "rest" ? "bg-blue-600 text-white shadow-lg" : "text-[#8b8b9e] hover:text-white"}`, `flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${authType() === "static" ? "bg-blue-600 text-white shadow-lg" : "text-[#8b8b9e] hover:text-white"}`, escape(createComponent(Show, {
    get when() {
      return authType() === "grpc";
    },
    get children() {
      return [ssr(_tmpl$8, ssrHydrationKey(), ssrAttribute("value", escape(authService(), true), false), escape(createComponent(For, {
        get each() {
          return parsedProto()?.services || [];
        },
        children: (svc) => ssr(_tmpl$26, ssrHydrationKey() + ssrAttribute("value", escape(svc.fullName, true), false), escape(svc.fullName))
      }))), createComponent(Show, {
        get when() {
          return authService();
        },
        get children() {
          return [ssr(_tmpl$9, ssrHydrationKey(), ssrAttribute("value", escape(authMethod(), true), false), escape(createComponent(For, {
            get each() {
              return parsedProto()?.services.find((s) => s.fullName === authService())?.methods || [];
            },
            children: (m) => ssr(_tmpl$26, ssrHydrationKey() + ssrAttribute("value", escape(m.name, true), false), escape(m.name))
          }))), ssr(_tmpl$0, ssrHydrationKey(), ssrAttribute("value", escape(authRequestTemplate(), true), false))];
        }
      })];
    }
  })), escape(createComponent(Show, {
    get when() {
      return authType() === "rest";
    },
    get children() {
      return ssr(_tmpl$12, ssrHydrationKey(), ssrAttribute("value", escape(authUrl(), true), false), ssrAttribute("value", escape(authRestMethod(), true), false), ssrAttribute("value", escape(authScheme(), true), false), escape(createComponent(Show, {
        get when() {
          return authScheme() === "basic";
        },
        get children() {
          return ssr(_tmpl$1, ssrHydrationKey(), ssrAttribute("value", escape(authUsername(), true), false), ssrAttribute("value", escape(authPassword(), true), false));
        }
      })), escape(createComponent(Show, {
        get when() {
          return authScheme() === "bearer";
        },
        get children() {
          return ssr(_tmpl$10, ssrHydrationKey(), ssrAttribute("value", escape(bearerToken(), true), false));
        }
      })), escape(createComponent(Show, {
        get when() {
          return authRestMethod() !== "GET";
        },
        get children() {
          return ssr(_tmpl$11, ssrHydrationKey(), ssrAttribute("value", escape(authRestBody(), true), false));
        }
      })));
    }
  })), escape(createComponent(Show, {
    get when() {
      return authType() === "static";
    },
    get children() {
      return ssr(_tmpl$13, ssrHydrationKey(), ssrAttribute("value", escape(bearerToken(), true), false));
    }
  })), escape(createComponent(Show, {
    get when() {
      return authType() !== "static";
    },
    get children() {
      return [ssr(_tmpl$14, ssrHydrationKey(), ssrAttribute("value", escape(authTokenPath(), true), false)), ssr(_tmpl$16, ssrHydrationKey(), ssrAttribute("disabled", isTestingAuth() || authType() === "grpc" && !authMethod() || authType() === "rest" && !authUrl(), true), escape(createComponent(Show, {
        get when() {
          return isTestingAuth();
        },
        get children() {
          return ssr(_tmpl$15, ssrHydrationKey());
        }
      })))];
    }
  })), escape(createComponent(Show, {
    get when() {
      return authTestResult();
    },
    get children() {
      return ssr(_tmpl$17, ssrHydrationKey(), `mt-2 rounded p-2 text-[10px] ${authTestResult().success ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`, authTestResult().success ? "✓ Success" : "✗ Error", authTestResult().success ? ssr(_tmpl$27, ssrHydrationKey(), escape(authTestResult().token)) : ssr(_tmpl$28, ssrHydrationKey(), escape(authTestResult().error)));
    }
  })), escape(createComponent(Show, {
    get when() {
      return savedProtos() && savedProtos().length > 0;
    },
    get children() {
      return ssr(_tmpl$18, ssrHydrationKey(), escape(createComponent(For, {
        get each() {
          return savedProtos();
        },
        children: (p) => ssr(_tmpl$26, ssrHydrationKey() + ssrAttribute("value", escape(p.id, true), false), escape(p.name))
      })));
    }
  })), ssrAttribute("value", escape(protoContent(), true), false), escape(createComponent(Show, {
    get when() {
      return compileError();
    },
    get children() {
      return ssr(_tmpl$19, ssrHydrationKey(), escape(compileError()));
    }
  })), escape(createComponent(Show, {
    get when() {
      return runData();
    },
    get children() {
      return ssr(_tmpl$20, ssrHydrationKey(), `card p-5 border ${runData().status === "completed" ? "border-emerald-500/30" : runData().status === "failed" ? "border-red-500/30" : "border-blue-500/30"}`, `px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${runData().status === "completed" ? "bg-emerald-500/20 text-emerald-400" : runData().status === "failed" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"}`, escape(runData().status), escape(createComponent(For, {
        get each() {
          return runData().logs;
        },
        children: (log) => ssr(_tmpl$33, ssrHydrationKey(), escape(log.stepId), escape(createComponent(Show, {
          get when() {
            return log.stepType && log.stepType !== "grpc";
          },
          get children() {
            return ssr(_tmpl$29, ssrHydrationKey(), escape(log.stepType));
          }
        })), `text-xs ${log.status === "success" ? "text-emerald-400" : "text-red-400"}`, escape(log.status.toUpperCase()), log.latencyMs ? `(${escape(log.latencyMs)}ms)` : "", escape(createComponent(Show, {
          get when() {
            return !log.stepType || log.stepType === "grpc" || log.stepType === "database" || log.stepType === "rest";
          },
          get children() {
            return ssr(_tmpl$30, ssrHydrationKey(), escape(JSON.stringify(log.request, null, 2)), `text-xs font-mono overflow-x-auto bg-[#151520] p-2 rounded ${log.error ? "text-red-300" : "text-emerald-300"}`, escape(log.error) || escape(JSON.stringify(log.response, null, 2)));
          }
        })), escape(createComponent(Show, {
          get when() {
            return log.stepType === "table";
          },
          get children() {
            return ssr(_tmpl$31, ssrHydrationKey(), escape(createComponent(LogTable, {
              get data() {
                return log.response;
              },
              get columns() {
                return log.meta?.columns;
              }
            })));
          }
        })), escape(createComponent(Show, {
          get when() {
            return log.stepType === "chart";
          },
          get children() {
            return ssr(_tmpl$32, ssrHydrationKey(), escape(createComponent(LogChart, {
              get data() {
                return log.response;
              },
              get xKey() {
                return log.meta?.xKey;
              },
              get yKey() {
                return log.meta?.yKey;
              },
              get chartType() {
                return log.meta?.chartType;
              }
            })));
          }
        })))
      })));
    }
  })), escape(createComponent(Show, {
    get when() {
      return showAddStepMenu();
    },
    get children() {
      return ssr(_tmpl$21, ssrHydrationKey());
    }
  })), escape(createComponent(For, {
    each: steps,
    children: (step, index) => ssr(_tmpl$50, ssrHydrationKey(), escape(index()) + 1, ssrAttribute("value", step.type === "chart" ? escape(step.chartType, true) || "bar" : escape(step.type, true) || "grpc", false), ssrAttribute("value", escape(step.id, true), false), escape(createComponent(Show, {
      get when() {
        return !step.type || step.type === "grpc";
      },
      get children() {
        return [ssr(_tmpl$36, ssrHydrationKey(), ssrAttribute("value", escape(step.serviceName, true) || "", false), ssrAttribute("disabled", !step.serviceName, true), escape(createComponent(Show, {
          get when() {
            return savedProtos() && savedProtos().length > 0;
          },
          get children() {
            return ssr(_tmpl$34, ssrHydrationKey(), escape(createComponent(For, {
              get each() {
                return savedProtos();
              },
              children: (p) => ssr(_tmpl$51, ssrHydrationKey(), `PROTO:${escape(p.id, true)}`, escape(p.name))
            })));
          }
        })), escape(createComponent(Show, {
          get when() {
            return parsedProto()?.services && parsedProto().services.length > 0;
          },
          get children() {
            return ssr(_tmpl$35, ssrHydrationKey(), escape(createComponent(For, {
              get each() {
                return parsedProto()?.services || [];
              },
              children: (svc) => ssr(_tmpl$52, ssrHydrationKey() + ssrAttribute("value", escape(svc.fullName, true), false), ssrAttribute("selected", step.serviceName === svc.fullName, true), escape(svc.fullName))
            })));
          }
        })), ssrAttribute("disabled", !step.serviceName, true) + ssrAttribute("value", escape(step.methodName, true) || "", false), escape(createComponent(For, {
          get each() {
            return parsedProto()?.services.find((s) => s.fullName === step.serviceName)?.methods || [];
          },
          children: (m) => ssr(_tmpl$53, ssrHydrationKey() + ssrAttribute("value", escape(m.name, true), false), ssrAttribute("selected", step.methodName === m.name, true), escape(m.name), escape(m.requestType), escape(m.responseType))
        }))), ssr(_tmpl$39, ssrHydrationKey(), escape(createComponent(Show, {
          get when() {
            return step.serverAddress;
          },
          get children() {
            return ssr(_tmpl$37, ssrHydrationKey());
          }
        })), `w-full rounded-lg border p-2.5 text-sm transition-all focus:outline-none placeholder:text-[#3a3a4e] ${step.serverAddress ? "border-blue-500/40 bg-[#1e1e2e] text-blue-100" : "border-[#2a2a3a] bg-[#1a1a26] text-[#8b8b9e] focus:border-blue-500/30"}`, `Fallback: ${escape(serverAddress(), true) || "None"}`, ssrAttribute("value", escape(step.serverAddress, true) || "", false), escape(createComponent(Show, {
          get when() {
            return !step.serverAddress;
          },
          get children() {
            return ssr(_tmpl$38, ssrHydrationKey());
          }
        }))), ssr(_tmpl$40, ssrHydrationKey(), ssrAttribute("checked", step.useTls ?? useTls(), true), step.useTls ?? useTls() ? "Secure" : "Insecure"), ssr(_tmpl$41, ssrHydrationKey(), ssrAttribute("value", escape(step.requestBodyTemplate, true), false)), ssr(_tmpl$42, ssrHydrationKey(), ssrAttribute("value", escape(step.headersTemplate, true) || "{}", false))];
      }
    })), escape(createComponent(Show, {
      get when() {
        return step.type === "rest";
      },
      get children() {
        return ssr(_tmpl$44, ssrHydrationKey(), ssrAttribute("value", escape(step.restUrl, true) || "", false), ssrAttribute("value", escape(step.restMethod, true) || "GET", false), escape(createComponent(Show, {
          get when() {
            return step.restMethod !== "GET" && step.restMethod !== "DELETE";
          },
          get children() {
            return ssr(_tmpl$43, ssrHydrationKey(), ssrAttribute("value", escape(step.requestBodyTemplate, true) || "", false));
          }
        })), ssrAttribute("value", escape(step.headersTemplate, true) || "{}", false));
      }
    })), escape(createComponent(Show, {
      get when() {
        return step.type === "database";
      },
      get children() {
        return ssr(_tmpl$45, ssrHydrationKey(), ssrAttribute("value", escape(step.databaseName, true) || "", false), ssrAttribute("value", escape(step.requestBodyTemplate, true) || "", false));
      }
    })), escape(createComponent(Show, {
      get when() {
        return step.type === "table" || step.type === "chart";
      },
      get children() {
        return ssr(_tmpl$49, ssrHydrationKey(), ssrAttribute("value", escape(step.requestBodyTemplate, true) || "", false), escape(createComponent(For, {
          get each() {
            return steps.slice(0, index()).filter((s) => !s.type || s.type === "grpc");
          },
          children: (s) => ssr(_tmpl$54, ssrHydrationKey(), `{{ steps.${escape(s.id, true)}.response }}`, escape(s.id), s.methodName ? ` (${escape(s.methodName)})` : "")
        })), ssrAttribute("value", escape(step.dataPath, true) || "", false), escape(createComponent(Show, {
          get when() {
            return step.type === "chart";
          },
          get children() {
            return ssr(_tmpl$47, ssrHydrationKey(), ssrAttribute("value", escape(step.xKey, true) || "", false), ssrAttribute("value", escape(step.yKey, true) || "", false), escape(createComponent(Show, {
              get when() {
                return step.xKey || step.yKey;
              },
              get children() {
                return ssr(_tmpl$46, ssrHydrationKey(), escape(step.xKey) || "index", escape(step.yKey) || "value");
              }
            })));
          }
        })), escape(createComponent(Show, {
          get when() {
            return step.type === "table";
          },
          get children() {
            return ssr(_tmpl$48, ssrHydrationKey(), escape(createComponent(For, {
              get each() {
                return step.columns || [];
              },
              children: (col, ci) => ssr(_tmpl$55, ssrHydrationKey(), ssrAttribute("value", escape(col, true), false))
            })));
          }
        })));
      }
    })), escape(createComponent(Show, {
      get when() {
        return (step.type === "table" || step.type === "chart") && runData();
      },
      get children() {
        return (() => {
          const log = (runData()?.logs || []).find((l) => l.stepId === step.id);
          const data = Array.isArray(log?.response) ? log.response : log?.response ? [log.response] : [];
          log?.meta || {};
          return ssr(_tmpl$62, ssrHydrationKey(), `mt-4 pt-4 border-t ${step.type === "table" ? "border-emerald-500/20" : "border-purple-500/20"}`, `text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${step.type === "table" ? "text-emerald-400" : "text-purple-400"}`, escape(createComponent(Show, {
            get when() {
              return step.type === "table";
            },
            get children() {
              return [ssr(_tmpl$56, ssrHydrationKey()), ssr(_tmpl$57, ssrHydrationKey())];
            }
          })), escape(createComponent(Show, {
            get when() {
              return step.type === "chart";
            },
            get children() {
              return [ssr(_tmpl$58, ssrHydrationKey()), ssr(_tmpl$59, ssrHydrationKey()), ssr(_tmpl$60, ssrHydrationKey())];
            }
          })), escape(data.length), data.length !== 1 ? "s" : "", escape(createComponent(Show, {
            get when() {
              return data.length === 0;
            },
            get children() {
              return ssr(_tmpl$61, ssrHydrationKey());
            }
          })), escape(createComponent(Show, {
            get when() {
              return data.length > 0;
            },
            get children() {
              return [createComponent(Show, {
                get when() {
                  return step.type === "table";
                },
                get children() {
                  return createComponent(LogTable, {
                    data,
                    get columns() {
                      return step.columns;
                    }
                  });
                }
              }), createComponent(Show, {
                get when() {
                  return step.type === "chart";
                },
                get children() {
                  return createComponent(LogChart, {
                    data,
                    get xKey() {
                      return step.xKey;
                    },
                    get yKey() {
                      return step.yKey;
                    },
                    get chartType() {
                      return step.chartType || "bar";
                    }
                  });
                }
              })];
            }
          })));
        })();
      }
    })))
  })), escape(createComponent(Show, {
    get when() {
      return steps.length === 0;
    },
    get children() {
      return ssr(_tmpl$22, ssrHydrationKey());
    }
  })));
}
export {
  WorkflowBuilder as default,
  id$$
};
//# sourceMappingURL=_id_-5unSkUAR.js.map
