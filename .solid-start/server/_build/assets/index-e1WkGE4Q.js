import { ssr, ssrHydrationKey, escape, createComponent, ssrAttribute, isServer } from "solid-js/web";
import { createResource, createSignal, createMemo, Show, For } from "solid-js";
var _tmpl$ = ["<div", ' class="flex items-center gap-2"><button class="rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-semibold px-4 py-2.5 text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/5 hover:-translate-y-0.5"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>+ HTTP</button><button class="rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 font-semibold px-4 py-2.5 text-sm flex items-center gap-2 transition-all shadow-lg shadow-purple-500/5 hover:-translate-y-0.5"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>+ gRPC</button><button class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold px-4 py-2.5 text-sm flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/5 hover:-translate-y-0.5"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>+ SurrealDB</button></div>'], _tmpl$2 = ["<div", ' class="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between border-b border-[#2a2a3a]/60 pb-6"><div class="flex items-center gap-2 overflow-x-auto w-full md:w-auto p-1 bg-[#111118] border border-[#2a2a3a] rounded-xl"><button class="', '">All<span class="', '">', '</span></button><button class="', '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>HTTP<span class="', '">', '</span></button><button class="', '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>gRPC<span class="', '">', '</span></button><button class="', '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>SurrealDB<span class="', '">', '</span></button></div><div class="relative w-full md:w-64"><input type="text" placeholder="Search connections..."', ' class="w-full bg-[#111118] border border-[#2a2a3a] rounded-xl px-3.5 py-2 pl-9 text-xs text-white placeholder:text-[#5b5b6e] focus:border-blue-500 focus:outline-none"><svg class="absolute left-3 top-2.5 text-[#5b5b6e]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></div></div>'], _tmpl$3 = ["<div", ' class="', '">', "</div>"], _tmpl$4 = ["<div", ' class="flex p-1 bg-[#151520] border border-[#2a2a3a] rounded-lg"><button class="', '">HTTP</button><button class="', '">gRPC</button><button class="', '">SurrealDB</button></div>'], _tmpl$5 = ["<div", ' class="space-y-4 pt-2 border-t border-[#2a2a3a]/40"><div class="grid grid-cols-1 md:grid-cols-4 gap-4"><div class="md:col-span-3"><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Endpoint / Base URL *</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"', ' placeholder="https://api.example.com/v1"></div><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Method</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', '><option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="DELETE">DELETE</option><option value="PATCH">PATCH</option></select></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Custom Headers (JSON)</label><textarea class="w-full h-20 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-2.5 text-xs font-mono text-purple-300 focus:border-blue-500 focus:outline-none"', ' placeholder="{&quot;Accept&quot;: &quot;application/json&quot;}"></textarea></div><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Trusted CA Certificate</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', '><option value>System Default Root CAs</option><option value="accept_all">Accept All / Insecure (Dev)</option><!--$-->', '<!--/--></select><p class="text-[10px] text-[#5b5b6e] mt-1">Select a custom CA certificate uploaded in /TrustedCA</p></div></div></div>'], _tmpl$6 = ["<div", ' class="flex items-center gap-2"><input type="checkbox" id="acceptInvalidCertCheckbox"', ' class="h-4 w-4 rounded border-[#2a2a3a] bg-[#1e1e2e] text-amber-500 focus:ring-amber-500"><label for="acceptInvalidCertCheckbox" class="text-xs text-amber-400 cursor-pointer">Accept Self-Signed / Invalid Certs</label></div>'], _tmpl$7 = ["<div", '><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">CA Certificate Override</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"', "><option value>System Default Root CAs</option><!--$-->", "<!--/--></select></div>"], _tmpl$8 = ["<div", ' class="space-y-4 pt-2 border-t border-[#2a2a3a]/40"><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Server Address (host:port) *</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"', ' placeholder="localhost:50051 or grpc.example.com:443"></div><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Associated Proto File (Optional)</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', "><option value>None (Generic / Inferred)</option><!--$-->", '<!--/--></select></div></div><div class="p-4 rounded-xl bg-[#111118] border border-[#2a2a3a] space-y-3"><div class="flex items-center justify-between"><div class="flex items-center gap-2"><input type="checkbox" id="useTlsCheckbox"', ' class="h-4 w-4 rounded border-[#2a2a3a] bg-[#1e1e2e] text-blue-600 focus:ring-blue-500"><label for="useTlsCheckbox" class="text-xs font-bold text-white cursor-pointer">Enable TLS / SSL Connection</label></div><!--$-->', "<!--/--></div><!--$-->", '<!--/--></div><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Default gRPC Metadata / Headers (JSON)</label><textarea class="w-full h-16 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-2.5 text-xs font-mono text-purple-300 focus:border-blue-500 focus:outline-none"', ' placeholder="{&quot;x-tenant-id&quot;: &quot;acme&quot;}"></textarea></div></div>'], _tmpl$9 = ["<div", ' class="space-y-4 pt-2 border-t border-[#2a2a3a]/40"><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">SurrealDB Endpoint URL *</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"', ' placeholder="ws://127.0.0.1:8000/rpc or http://localhost:8000"></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Namespace (NS)</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', ' placeholder="solidflow"></div><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Database (DB)</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', ' placeholder="main"></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Username</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', ' placeholder="root"></div><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Password</label><input type="password" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', ' placeholder="Password"></div></div></div>'], _tmpl$0 = ["<button", ' class="', '">Basic</button>'], _tmpl$1 = ["<div", ' class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#2a2a3a]/40"><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Username</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"', '></div><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Password</label><input type="password" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-blue-500 focus:outline-none"', "></div></div>"], _tmpl$10 = ["<div", ' class="pt-2 border-t border-[#2a2a3a]/40"><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Static Bearer Token</label><input type="password" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white font-mono focus:border-blue-500 focus:outline-none"', ' placeholder="eyJhbGciOi..."></div>'], _tmpl$11 = ["<div", ' class="grid grid-cols-1 md:grid-cols-2 gap-3"><div><label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Client ID</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-amber-500 focus:outline-none"', '></div><div><label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Client Secret</label><input type="password" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-amber-500 focus:outline-none"', "></div></div>"], _tmpl$12 = ["<div", '><label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Token Request Bearer Token</label><input type="password" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"', "></div>"], _tmpl$13 = ["<div", ' class="space-y-3 pt-2 border-t border-amber-500/20"><div class="flex items-center gap-2 text-amber-400 text-xs font-bold"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>Pre-request Token Retrieval Configuration</div><div class="grid grid-cols-1 md:grid-cols-4 gap-3"><div class="md:col-span-3"><label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Token Endpoint URL *</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"', ' placeholder="https://auth.example.com/oauth/token"></div><div><label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Method</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-amber-500 focus:outline-none"', '><option value="POST">POST</option><option value="GET">GET</option></select></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-3"><div><label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Token Request Auth Scheme</label><select class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white focus:border-amber-500 focus:outline-none"', '><option value="none">None (Payload only)</option><option value="basic">Basic (Client ID : Client Secret)</option><option value="bearer">Static Bearer Token</option></select></div><div><label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">JSON Token Path</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"', ' placeholder="e.g. access_token or data.token"></div></div><!--$-->', "<!--/--><!--$-->", '<!--/--><div class="grid grid-cols-1 md:grid-cols-2 gap-3"><div><label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Token Request Body (JSON)</label><textarea class="w-full h-20 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-2 text-xs font-mono text-amber-300 focus:border-amber-500 focus:outline-none"', ' placeholder="{&quot;grant_type&quot;: &quot;client_credentials&quot;}"></textarea></div><div><label class="mb-1 block text-[11px] font-medium text-[#8b8b9e]">Token Request Headers (JSON)</label><textarea class="w-full h-20 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-2 text-xs font-mono text-amber-300 focus:border-amber-500 focus:outline-none"', ' placeholder="{&quot;Content-Type&quot;: &quot;application/json&quot;}"></textarea></div></div></div>'], _tmpl$14 = ["<div", ' class="p-4 rounded-xl bg-[#111118] border border-[#2a2a3a] space-y-4"><div class="flex items-center justify-between"><div><h4 class="text-xs font-bold text-white uppercase tracking-wider">Authentication Strategy</h4><p class="text-[11px] text-[#8b8b9e]">Select static credentials or dynamic pre-request OAuth token fetching</p></div><div class="flex p-1 bg-[#151520] border border-[#2a2a3a] rounded-lg"><button class="', '">None</button><!--$-->', '<!--/--><button class="', '">Bearer</button><button class="', '">Pre-request OAuth</button></div></div><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$15 = ["<span", ' class="font-mono text-[10px] lowercase text-[#8b8b9e]"><!--$-->', "<!--/-->ms</span>"], _tmpl$16 = ["<p", ' class="text-xs">', "</p>"], _tmpl$17 = ["<p", ' class="text-xs font-mono break-all text-red-400">', "</p>"], _tmpl$18 = ["<div", ' class="p-2 rounded bg-black/40 border border-emerald-500/20 font-mono text-[11px] break-all"><span class="text-emerald-400 font-bold">Extracted Token:</span> <!--$-->', "<!--/-->...</div>"], _tmpl$19 = ["<div", ' class="p-2 rounded bg-black/40 border border-emerald-500/20 font-mono text-[10px] break-all max-h-32 overflow-y-auto"><span class="text-emerald-400 font-bold">Response:</span> <!--$-->', "<!--/--></div>"], _tmpl$20 = ["<div", ' class="', '"><div class="flex items-center justify-between font-bold uppercase tracking-wider"><span class="flex items-center gap-1.5">', "</span><!--$-->", "<!--/--></div><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$21 = ["<svg", ' class="animate-spin h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$22 = ["<svg", ' class="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$23 = ["<div", ' class="lg:col-span-7 card p-6 space-y-6"><div class="flex items-start justify-between border-b border-[#2a2a3a]/60 pb-4"><div><h2 class="text-xl font-bold text-white mb-1">', '</h2><p class="text-xs text-[#8b8b9e]">Configure protocol settings, credentials, and authentication</p></div><!--$-->', '<!--/--></div><div class="space-y-4"><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Connection Name *</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', ' placeholder="e.g. Stripe API or Production SurrealDB"></div><div><label class="mb-1 block text-xs font-medium text-[#8b8b9e]">Description (Optional)</label><input type="text" class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"', ' placeholder="Brief description of this connection"></div></div><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", '<!--/--><div class="pt-4 border-t border-[#2a2a3a]/60 flex items-center justify-between"><button', ' class="btn-secondary text-xs flex items-center gap-2 disabled:opacity-40">', '</button><div class="flex items-center gap-3"><button class="btn-secondary text-xs">Cancel</button><button', ' class="btn-primary bg-blue-600 hover:bg-blue-500 text-white text-xs disabled:opacity-40 flex items-center gap-2">', "</button></div></div></div></div>"], _tmpl$24 = ["<main", ' class="mx-auto max-w-7xl px-6 py-12"><div class="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 class="text-4xl font-extrabold tracking-tight text-white mb-2">Connections</h1><p class="text-[15px] text-[#8b8b9e]">Manage HTTP, gRPC, and SurrealDB connections with optional pre-request token authentication</p></div><!--$-->', "<!--/--></div><!--$-->", '<!--/--><div class="grid grid-cols-1 lg:grid-cols-12 gap-8"><div', ">", "</div><!--$-->", "<!--/--></div></main>"], _tmpl$25 = ["<div", ' class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><div class="h-44 bg-[#111118]/80 rounded-2xl animate-pulse border border-[#1e1e2e]"></div><div class="h-44 bg-[#111118]/80 rounded-2xl animate-pulse border border-[#1e1e2e]"></div><div class="h-44 bg-[#111118]/80 rounded-2xl animate-pulse border border-[#1e1e2e]"></div></div>'], _tmpl$26 = ["<div", ' class="card flex flex-col items-center justify-center p-16 text-center border-dashed border-[#2a2a3a]"><div class="mb-6 rounded-full bg-[#1e1e2e] p-6 text-[#5b5b6e]"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div><h3 class="mb-2 text-xl font-bold text-white">No connections found</h3><p class="mb-6 max-w-md text-[#8b8b9e] text-sm">', '</p><div class="flex items-center gap-3"><button class="btn-primary">Add HTTP</button><button class="btn-secondary">Add gRPC</button><button class="btn-secondary">Add SurrealDB</button></div></div>'], _tmpl$27 = ["<div", ' class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></div>'], _tmpl$28 = ["<span", ' class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">HTTP</span>'], _tmpl$29 = ["<div", ' class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div>'], _tmpl$30 = ["<span", ' class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">gRPC</span>'], _tmpl$31 = ["<div", ' class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg></div>'], _tmpl$32 = ["<span", ' class="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SurrealDB</span>'], _tmpl$33 = ["<p", ' class="text-xs font-mono text-[#8b8b9e] break-all line-clamp-1 mb-2">', "</p>"], _tmpl$34 = ["<span", ' class="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 flex items-center gap-1"><span class="w-1 h-1 rounded-full bg-amber-400"></span> OAuth Pre-request</span>'], _tmpl$35 = ["<span", ' class="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">Basic Auth</span>'], _tmpl$36 = ["<span", ' class="text-[9px] font-bold px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">Bearer Token</span>'], _tmpl$37 = ["<div", ' class="flex items-center gap-1.5 flex-wrap"><span class="text-[9px] font-bold px-1.5 py-0.5 bg-[#1e1e2e] text-[#8b8b9e] rounded border border-[#2a2a3a] uppercase">', "</span><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$38 = ["<span", ' class="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">OAuth Token</span>'], _tmpl$39 = ["<span", ' class="text-[9px] font-bold px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20">Proto Linked</span>'], _tmpl$40 = ["<div", ' class="flex items-center gap-1.5 flex-wrap"><span class="', '">', "</span><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$41 = ["<div", ' class="flex items-center gap-1.5 flex-wrap"><span class="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-mono">NS: <!--$-->', "<!--/--> / DB: <!--$-->", "<!--/--></span></div>"], _tmpl$42 = ["<span", ' class="text-emerald-400 font-bold flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>✓ Connected (<!--$-->', "<!--/-->ms)</span>"], _tmpl$43 = ["<div", ' class="flex items-center gap-1 text-[10px]">', "</div>"], _tmpl$44 = ["<svg", ' class="animate-spin h-3 w-3 text-blue-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$45 = ["<div", ' class="', '"><div><div class="flex items-start justify-between mb-3"><div class="flex items-center gap-2"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", '<!--/--></div><button class="text-[#5b5b6e] hover:text-red-400 transition-colors p-1"', ' title="Delete Connection"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg></button></div><h3 class="text-base font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">', "</h3><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", '<!--/--></div><div class="mt-4 pt-3 border-t border-[#2a2a3a]/40 flex items-center justify-between"><!--$-->', "<!--/--><button", ' class="px-2.5 py-1 rounded bg-[#1e1e2e] hover:bg-[#2a2a3a] text-[#8b8b9e] hover:text-white text-[10px] font-semibold border border-[#2a2a3a] transition-colors flex items-center gap-1 disabled:opacity-50">', "</button></div></div>"], _tmpl$46 = ["<span", ' class="text-[10px] text-[#5b5b6e]">Click to edit / configure</span>'], _tmpl$47 = ["<span", ' class="text-red-400 font-bold">✗ Failed</span>'], _tmpl$48 = ["<option", "><!--$-->", "<!--/--> (<!--$-->", "<!--/-->)</option>"], _tmpl$49 = ["<svg", ' class="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'], _tmpl$50 = ["<svg", ' class="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'], _tmpl$51 = ["<svg", ' width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'];
const id$$ = "src/routes/connections/index.tsx?pick=default&pick=$css";
const fetchConnections = async () => {
  const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/connections` : "/api/connections";
  const res = await fetch(url);
  const json = await res.json();
  return json.success ? json.data : [];
};
const fetchCas = async () => {
  try {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/cas` : "/api/cas";
    const res = await fetch(url);
    const json = await res.json();
    return json.success ? json.data : [];
  } catch {
    return [];
  }
};
const fetchProtos = async () => {
  try {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/protos` : "/api/protos";
    const res = await fetch(url);
    const json = await res.json();
    return json.success ? json.data : [];
  } catch {
    return [];
  }
};
function Connections() {
  const [connections, {
    refetch
  }] = createResource(fetchConnections);
  const [cas] = createResource(fetchCas);
  const [protos] = createResource(fetchProtos);
  const [activeTab, setActiveTab] = createSignal("all");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedConnection, setSelectedConnection] = createSignal(null);
  const [isEditing, setIsEditing] = createSignal(false);
  const [isNew, setIsNew] = createSignal(false);
  const [connType, setConnType] = createSignal("http");
  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [method, setMethod] = createSignal("GET");
  const [headers, setHeaders] = createSignal("{}");
  const [caId, setCaId] = createSignal("");
  const [authType, setAuthType] = createSignal("none");
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [bearerToken, setBearerToken] = createSignal("");
  const [tokenUrl, setTokenUrl] = createSignal("");
  const [tokenMethod, setTokenMethod] = createSignal("POST");
  const [tokenAuthScheme, setTokenAuthScheme] = createSignal("none");
  const [tokenUsername, setTokenUsername] = createSignal("");
  const [tokenPassword, setTokenPassword] = createSignal("");
  const [tokenBearerToken, setTokenBearerToken] = createSignal("");
  const [tokenBody, setTokenBody] = createSignal("{}");
  const [tokenHeaders, setTokenHeaders] = createSignal("{}");
  const [tokenPath, setTokenPath] = createSignal("access_token");
  const [tokenHeaderName, setTokenHeaderName] = createSignal("Authorization");
  const [tokenHeaderPrefix, setTokenHeaderPrefix] = createSignal("Bearer ");
  const [tokenMetadataKey, setTokenMetadataKey] = createSignal("authorization");
  const [serverAddress, setServerAddress] = createSignal("");
  const [useTls, setUseTls] = createSignal(false);
  const [acceptInvalidCert, setAcceptInvalidCert] = createSignal(false);
  const [protoId, setProtoId] = createSignal("");
  const [grpcMetadata, setGrpcMetadata] = createSignal("{}");
  const [dbUrl, setDbUrl] = createSignal("ws://127.0.0.1:8000/rpc");
  const [dbUsername, setDbUsername] = createSignal("root");
  const [dbPassword, setDbPassword] = createSignal("");
  const [dbNamespace, setDbNamespace] = createSignal("solidflow");
  const [dbDatabase, setDbDatabase] = createSignal("main");
  const [testResult, setTestResult] = createSignal(null);
  const [isTesting, setIsTesting] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(null);
  const [inlineTestingId, setInlineTestingId] = createSignal(null);
  const [cardTestResults, setCardTestResults] = createSignal({});
  const filteredConnections = createMemo(() => {
    const list = connections() || [];
    const tab = activeTab();
    const q = searchQuery().toLowerCase().trim();
    return list.filter((conn) => {
      const type = conn.type || (conn.serverAddress ? "grpc" : conn.namespace || conn.database ? "surrealdb" : "http");
      const matchesTab = tab === "all" || type === tab || tab === "http" && type === "oauth";
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
      const type = c.type || (c.serverAddress ? "grpc" : c.namespace || c.database ? "surrealdb" : "http");
      if (type === "grpc") grpcCount++;
      else if (type === "surrealdb") surrealCount++;
      else httpCount++;
    }
    return {
      all: list.length,
      http: httpCount,
      grpc: grpcCount,
      surrealdb: surrealCount
    };
  });
  return ssr(_tmpl$24, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return !isEditing();
    },
    get children() {
      return ssr(_tmpl$, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return !isEditing();
    },
    get children() {
      return ssr(_tmpl$2, ssrHydrationKey(), `px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab() === "all" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-[#8b8b9e] hover:text-white"}`, `px-1.5 py-0.2 text-[10px] rounded-full ${activeTab() === "all" ? "bg-white/20 text-white" : "bg-[#1e1e2e] text-[#8b8b9e]"}`, escape(connectionCounts().all), `px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab() === "http" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-[#8b8b9e] hover:text-white"}`, `px-1.5 py-0.2 text-[10px] rounded-full ${activeTab() === "http" ? "bg-white/20 text-white" : "bg-[#1e1e2e] text-[#8b8b9e]"}`, escape(connectionCounts().http), `px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab() === "grpc" ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "text-[#8b8b9e] hover:text-white"}`, `px-1.5 py-0.2 text-[10px] rounded-full ${activeTab() === "grpc" ? "bg-white/20 text-white" : "bg-[#1e1e2e] text-[#8b8b9e]"}`, escape(connectionCounts().grpc), `px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab() === "surrealdb" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-[#8b8b9e] hover:text-white"}`, `px-1.5 py-0.2 text-[10px] rounded-full ${activeTab() === "surrealdb" ? "bg-white/20 text-white" : "bg-[#1e1e2e] text-[#8b8b9e]"}`, escape(connectionCounts().surrealdb), ssrAttribute("value", escape(searchQuery(), true), false));
    }
  })), ssrAttribute("class", isEditing() ? "lg:col-span-5 space-y-4" : "lg:col-span-12 space-y-4", false), escape(createComponent(Show, {
    get when() {
      return !connections.loading;
    },
    get fallback() {
      return ssr(_tmpl$25, ssrHydrationKey());
    },
    get children() {
      return createComponent(Show, {
        get when() {
          return filteredConnections().length > 0;
        },
        get fallback() {
          return createComponent(Show, {
            get when() {
              return !isEditing();
            },
            get children() {
              return ssr(_tmpl$26, ssrHydrationKey(), searchQuery() ? `No connections match "${escape(searchQuery())}".` : "Configure HTTP, gRPC, or SurrealDB connections to use across workflows and testing.");
            }
          });
        },
        get children() {
          return ssr(_tmpl$3, ssrHydrationKey(), `grid gap-4 ${isEditing() ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`, escape(createComponent(For, {
            get each() {
              return filteredConnections();
            },
            children: (conn) => {
              const type = conn.type || (conn.serverAddress ? "grpc" : conn.namespace || conn.database ? "surrealdb" : "http");
              const isSelected = () => selectedConnection()?.id === conn.id;
              const cardTest = () => cardTestResults()[conn.id];
              return ssr(_tmpl$45, ssrHydrationKey(), `card p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between group ${isSelected() ? "border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500" : "hover:border-[#3a3a4a] hover:-translate-y-0.5 hover:shadow-xl"}`, escape(createComponent(Show, {
                when: type === "http" || type === "oauth",
                get children() {
                  return [ssr(_tmpl$27, ssrHydrationKey()), ssr(_tmpl$28, ssrHydrationKey())];
                }
              })), escape(createComponent(Show, {
                when: type === "grpc",
                get children() {
                  return [ssr(_tmpl$29, ssrHydrationKey()), ssr(_tmpl$30, ssrHydrationKey())];
                }
              })), escape(createComponent(Show, {
                when: type === "surrealdb",
                get children() {
                  return [ssr(_tmpl$31, ssrHydrationKey()), ssr(_tmpl$32, ssrHydrationKey())];
                }
              })), ssrAttribute("disabled", isDeleting() === conn.id, true), escape(conn.name), escape(createComponent(Show, {
                when: type === "http" || type === "oauth",
                get children() {
                  return [ssr(_tmpl$33, ssrHydrationKey(), escape(conn.url)), ssr(_tmpl$37, ssrHydrationKey(), escape(conn.method) || "GET", escape(createComponent(Show, {
                    get when() {
                      return conn.authType === "oauth" || conn.tokenPath;
                    },
                    get children() {
                      return ssr(_tmpl$34, ssrHydrationKey());
                    }
                  })), escape(createComponent(Show, {
                    get when() {
                      return conn.authType === "basic";
                    },
                    get children() {
                      return ssr(_tmpl$35, ssrHydrationKey());
                    }
                  })), escape(createComponent(Show, {
                    get when() {
                      return conn.authType === "bearer";
                    },
                    get children() {
                      return ssr(_tmpl$36, ssrHydrationKey());
                    }
                  })))];
                }
              })), escape(createComponent(Show, {
                when: type === "grpc",
                get children() {
                  return [ssr(_tmpl$33, ssrHydrationKey(), escape(conn.serverAddress)), ssr(_tmpl$40, ssrHydrationKey(), `text-[9px] font-bold px-1.5 py-0.5 rounded border ${conn.useTls ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-[#1e1e2e] text-[#8b8b9e] border-[#2a2a3a]"}`, conn.useTls ? "TLS" : "Insecure", escape(createComponent(Show, {
                    get when() {
                      return conn.authType === "oauth";
                    },
                    get children() {
                      return ssr(_tmpl$38, ssrHydrationKey());
                    }
                  })), escape(createComponent(Show, {
                    get when() {
                      return conn.protoId;
                    },
                    get children() {
                      return ssr(_tmpl$39, ssrHydrationKey());
                    }
                  })))];
                }
              })), escape(createComponent(Show, {
                when: type === "surrealdb",
                get children() {
                  return [ssr(_tmpl$33, ssrHydrationKey(), escape(conn.url)), ssr(_tmpl$41, ssrHydrationKey(), escape(conn.namespace) || "solidflow", escape(conn.database) || "main")];
                }
              })), escape(createComponent(Show, {
                get when() {
                  return cardTest();
                },
                get fallback() {
                  return ssr(_tmpl$46, ssrHydrationKey());
                },
                get children() {
                  return ssr(_tmpl$43, ssrHydrationKey(), escape(createComponent(Show, {
                    get when() {
                      return cardTest().success;
                    },
                    get fallback() {
                      return ssr(_tmpl$47, ssrHydrationKey());
                    },
                    get children() {
                      return ssr(_tmpl$42, ssrHydrationKey(), escape(cardTest().latencyMs));
                    }
                  })));
                }
              })), ssrAttribute("disabled", inlineTestingId() === conn.id, true), escape(createComponent(Show, {
                get when() {
                  return inlineTestingId() === conn.id;
                },
                fallback: "Test",
                get children() {
                  return [ssr(_tmpl$44, ssrHydrationKey()), "Testing..."];
                }
              })));
            }
          })));
        }
      });
    }
  })), escape(createComponent(Show, {
    get when() {
      return isEditing();
    },
    get children() {
      return ssr(_tmpl$23, ssrHydrationKey(), isNew() ? `New ${escape(connType().toUpperCase())} Connection` : `Edit Connection: ${escape(name()) || "Untitled"}`, escape(createComponent(Show, {
        get when() {
          return isNew();
        },
        get children() {
          return ssr(_tmpl$4, ssrHydrationKey(), `px-3 py-1 text-xs font-bold rounded transition-all ${connType() === "http" ? "bg-blue-600 text-white" : "text-[#8b8b9e] hover:text-white"}`, `px-3 py-1 text-xs font-bold rounded transition-all ${connType() === "grpc" ? "bg-purple-600 text-white" : "text-[#8b8b9e] hover:text-white"}`, `px-3 py-1 text-xs font-bold rounded transition-all ${connType() === "surrealdb" ? "bg-emerald-600 text-white" : "text-[#8b8b9e] hover:text-white"}`);
        }
      })), ssrAttribute("value", escape(name(), true), false), ssrAttribute("value", escape(description(), true), false), escape(createComponent(Show, {
        get when() {
          return connType() === "http";
        },
        get children() {
          return ssr(_tmpl$5, ssrHydrationKey(), ssrAttribute("value", escape(url(), true), false), ssrAttribute("value", escape(method(), true), false), ssrAttribute("value", escape(headers(), true), false), ssrAttribute("value", escape(caId(), true), false), escape(createComponent(For, {
            get each() {
              return cas() || [];
            },
            children: (c) => ssr(_tmpl$48, ssrHydrationKey() + ssrAttribute("value", escape(c.id, true), false), escape(c.name), escape(c.id))
          })));
        }
      })), escape(createComponent(Show, {
        get when() {
          return connType() === "grpc";
        },
        get children() {
          return ssr(_tmpl$8, ssrHydrationKey(), ssrAttribute("value", escape(serverAddress(), true), false), ssrAttribute("value", escape(protoId(), true), false), escape(createComponent(For, {
            get each() {
              return protos() || [];
            },
            children: (p) => ssr(_tmpl$48, ssrHydrationKey() + ssrAttribute("value", escape(p.id, true), false), escape(p.name), escape(p.id))
          })), ssrAttribute("checked", useTls(), true), escape(createComponent(Show, {
            get when() {
              return useTls();
            },
            get children() {
              return ssr(_tmpl$6, ssrHydrationKey(), ssrAttribute("checked", acceptInvalidCert(), true));
            }
          })), escape(createComponent(Show, {
            get when() {
              return useTls();
            },
            get children() {
              return ssr(_tmpl$7, ssrHydrationKey(), ssrAttribute("value", escape(caId(), true), false), escape(createComponent(For, {
                get each() {
                  return cas() || [];
                },
                children: (c) => ssr(_tmpl$48, ssrHydrationKey() + ssrAttribute("value", escape(c.id, true), false), escape(c.name), escape(c.id))
              })));
            }
          })), ssrAttribute("value", escape(grpcMetadata(), true), false));
        }
      })), escape(createComponent(Show, {
        get when() {
          return connType() === "surrealdb";
        },
        get children() {
          return ssr(_tmpl$9, ssrHydrationKey(), ssrAttribute("value", escape(dbUrl(), true), false), ssrAttribute("value", escape(dbNamespace(), true), false), ssrAttribute("value", escape(dbDatabase(), true), false), ssrAttribute("value", escape(dbUsername(), true), false), ssrAttribute("value", escape(dbPassword(), true), false));
        }
      })), escape(createComponent(Show, {
        get when() {
          return connType() === "http" || connType() === "grpc";
        },
        get children() {
          return ssr(_tmpl$14, ssrHydrationKey(), `px-2.5 py-1 text-xs font-bold rounded transition-all ${authType() === "none" ? "bg-blue-600 text-white" : "text-[#8b8b9e] hover:text-white"}`, escape(createComponent(Show, {
            get when() {
              return connType() === "http";
            },
            get children() {
              return ssr(_tmpl$0, ssrHydrationKey(), `px-2.5 py-1 text-xs font-bold rounded transition-all ${authType() === "basic" ? "bg-blue-600 text-white" : "text-[#8b8b9e] hover:text-white"}`);
            }
          })), `px-2.5 py-1 text-xs font-bold rounded transition-all ${authType() === "bearer" ? "bg-blue-600 text-white" : "text-[#8b8b9e] hover:text-white"}`, `px-2.5 py-1 text-xs font-bold rounded transition-all ${authType() === "oauth" ? "bg-amber-600 text-white shadow" : "text-amber-400 hover:text-white"}`, escape(createComponent(Show, {
            get when() {
              return authType() === "basic";
            },
            get children() {
              return ssr(_tmpl$1, ssrHydrationKey(), ssrAttribute("value", escape(username(), true), false), ssrAttribute("value", escape(password(), true), false));
            }
          })), escape(createComponent(Show, {
            get when() {
              return authType() === "bearer";
            },
            get children() {
              return ssr(_tmpl$10, ssrHydrationKey(), ssrAttribute("value", escape(bearerToken(), true), false));
            }
          })), escape(createComponent(Show, {
            get when() {
              return authType() === "oauth";
            },
            get children() {
              return ssr(_tmpl$13, ssrHydrationKey(), ssrAttribute("value", escape(tokenUrl(), true), false), ssrAttribute("value", escape(tokenMethod(), true), false), ssrAttribute("value", escape(tokenAuthScheme(), true), false), ssrAttribute("value", escape(tokenPath(), true), false), escape(createComponent(Show, {
                get when() {
                  return tokenAuthScheme() === "basic";
                },
                get children() {
                  return ssr(_tmpl$11, ssrHydrationKey(), ssrAttribute("value", escape(tokenUsername(), true), false), ssrAttribute("value", escape(tokenPassword(), true), false));
                }
              })), escape(createComponent(Show, {
                get when() {
                  return tokenAuthScheme() === "bearer";
                },
                get children() {
                  return ssr(_tmpl$12, ssrHydrationKey(), ssrAttribute("value", escape(tokenBearerToken(), true), false));
                }
              })), ssrAttribute("value", escape(tokenBody(), true), false), ssrAttribute("value", escape(tokenHeaders(), true), false));
            }
          })));
        }
      })), escape(createComponent(Show, {
        get when() {
          return testResult();
        },
        get children() {
          return ssr(_tmpl$20, ssrHydrationKey(), `p-4 rounded-xl border text-xs space-y-2 ${testResult().success ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300"}`, testResult().success ? escape([ssr(_tmpl$49, ssrHydrationKey()), "Test Succeeded"]) : escape([ssr(_tmpl$50, ssrHydrationKey()), "Test Failed"]), escape(createComponent(Show, {
            get when() {
              return testResult().latencyMs !== void 0;
            },
            get children() {
              return ssr(_tmpl$15, ssrHydrationKey(), escape(testResult().latencyMs));
            }
          })), escape(createComponent(Show, {
            get when() {
              return testResult().message;
            },
            get children() {
              return ssr(_tmpl$16, ssrHydrationKey(), escape(testResult().message));
            }
          })), escape(createComponent(Show, {
            get when() {
              return testResult().error;
            },
            get children() {
              return ssr(_tmpl$17, ssrHydrationKey(), escape(testResult().error));
            }
          })), escape(createComponent(Show, {
            get when() {
              return testResult().token;
            },
            get children() {
              return ssr(_tmpl$18, ssrHydrationKey(), escape(testResult().token.slice(0, 40)));
            }
          })), escape(createComponent(Show, {
            get when() {
              return testResult().response;
            },
            get children() {
              return ssr(_tmpl$19, ssrHydrationKey(), escape(JSON.stringify(testResult().response, null, 2)));
            }
          })));
        }
      })), ssrAttribute("disabled", isTesting(), true), escape(createComponent(Show, {
        get when() {
          return isTesting();
        },
        get fallback() {
          return [ssr(_tmpl$51, ssrHydrationKey()), "Test Connection"];
        },
        get children() {
          return [ssr(_tmpl$21, ssrHydrationKey()), "Testing Connection..."];
        }
      })), ssrAttribute("disabled", isSaving() || !name().trim(), true), escape(createComponent(Show, {
        get when() {
          return isSaving();
        },
        fallback: "Save Connection",
        get children() {
          return [ssr(_tmpl$22, ssrHydrationKey()), "Saving..."];
        }
      })));
    }
  })));
}
export {
  Connections as default,
  id$$
};
//# sourceMappingURL=index-e1WkGE4Q.js.map
