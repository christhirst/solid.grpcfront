import { ssr, ssrHydrationKey, escape, createComponent, ssrAttribute, ssrStyleProperty, isServer } from "solid-js/web";
import { createSignal, createResource, Show, For } from "solid-js";
var _tmpl$ = ["<button", ' class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-px hover:shadow-indigo-500/40"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>New Schema</button>'], _tmpl$2 = ["<div", ' class="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">', "</div>"], _tmpl$3 = ["<div", ' class="card p-6 fade-in-up delay-2 mb-6"><h2 class="text-lg font-bold text-white mb-4">', "</h2><!--$-->", '<!--/--><div class="space-y-4"><div><label class="block text-xs font-medium text-[#5a5a6e] mb-1.5">Schema Name</label><input type="text"', ' class="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. User Service API"></div><div><label class="block text-xs font-medium text-[#5a5a6e] mb-1.5">Proto Definition</label><div class="', '"><div class="absolute right-3 top-3 pointer-events-none"><span class="text-[10px] font-bold tracking-widest text-[#5a5a6e] uppercase opacity-60">', "</span></div><textarea", ' class="w-full min-h-[300px] rounded-lg bg-transparent p-4 text-sm text-[#c8c8d8] font-mono focus:outline-none transition-colors" style="', `" spellcheck="false" placeholder="syntax = 'proto3';"></textarea></div></div><div class="flex justify-end gap-3 pt-4 border-t border-[#1e1e2e]"><button`, ' class="rounded-lg px-4 py-2 text-sm font-medium text-[#8b8b9e] hover:bg-[#1e1e2e] hover:text-white transition-colors">Cancel</button><button', ' class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-2 text-sm font-semibold text-white shadow-md hover:shadow-indigo-500/25 transition-all">', "</button></div></div></div>"], _tmpl$4 = ["<div", ' class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between fade-in-up delay-2"><div class="relative w-full sm:max-w-md"><svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a6e]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg><input class="w-full rounded-xl border border-[#1e1e2e] bg-[#12121a] py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#5a5a6e] focus:border-blue-500" placeholder="Search schemas..."></div><div class="text-sm text-[#8b8b9e]">', "</div></div>"], _tmpl$5 = ["<div", ' class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 fade-in-up delay-2">', "</div>"], _tmpl$6 = ["<main", ' class="relative min-h-screen"><div class="mesh-gradient"></div><div class="grain-overlay"></div><div class="relative z-10 mx-auto max-w-5xl px-6 py-8"><div class="flex items-center justify-between mb-8 fade-in-up delay-1"><div><div class="flex items-center gap-3 mb-2"><div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg></div><h1 class="text-2xl font-bold tracking-tight text-white">Proto Library</h1></div><p class="text-sm text-[#8b8b9e]">Manage reusable .proto schemas for the gRPC Client and Workflows.</p></div><!--$-->', "<!--/--></div><!--$-->", "<!--/--><!--$-->", "<!--/--></div></main>"], _tmpl$7 = ["<div", ' class="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#1e1e2e] bg-[#12121a]/50 py-16"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2a2a3e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-4"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg><h3 class="text-lg font-medium text-white mb-2">No Proto Schemas Found</h3><p class="text-[#5a5a6e] text-center max-w-sm">Store your commonly used `.proto` files here to easily access them across the gRPC Client and Workflows.</p></div>'], _tmpl$8 = ["<div", ' class="card p-5 group cursor-pointer hover:border-indigo-500/50 transition-colors flex flex-col h-[200px]"><div class="flex items-start justify-between mb-3"><div class="flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg><h3 class="font-semibold text-white truncate max-w-[180px]">', '</h3></div><button class="p-1 rounded bg-[#1e1e2e] text-[#5a5a6e] opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 hover:bg-red-500/10"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div><div class="relative flex-1 bg-[#12121a] rounded-lg border border-[#1e1e2e] p-3 overflow-hidden"><pre class="text-[10px] text-[#5a5a6e] font-mono leading-relaxed pointer-events-none">', '</pre><div class="absolute inset-0 bg-gradient-to-t from-[#12121a] via-[#12121a]/50 to-transparent pointer-events-none"></div></div><div class="mt-3 text-[10px] font-medium text-[#5a5a6e] truncate">Updated: <!--$-->', "<!--/--></div></div>"];
const id$$ = "src/routes/protos/index.tsx?pick=default&pick=$css";
const fetchProtos = async (q) => {
  try {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/protos${params}` : `/api/protos${params}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.success) {
      return json.data;
    }
  } catch (e) {
    console.error("Failed to fetch protos:", e);
  }
  return [];
};
function Protos() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [protos, {
    refetch
  }] = createResource(() => searchQuery(), fetchProtos);
  const [editingProto, setEditingProto] = createSignal(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal(null);
  const [isDragging, setIsDragging] = createSignal(false);
  return ssr(_tmpl$6, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return !editingProto();
    },
    get children() {
      return ssr(_tmpl$, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return editingProto();
    },
    get children() {
      return ssr(_tmpl$3, ssrHydrationKey(), editingProto()?.id ? "Edit Proto Schema" : "Create Proto Schema", escape(createComponent(Show, {
        get when() {
          return errorMsg();
        },
        get children() {
          return ssr(_tmpl$2, ssrHydrationKey(), escape(errorMsg()));
        }
      })), ssrAttribute("value", escape(editingProto()?.name, true) || "", false), `relative rounded-lg border-2 transition-colors ${isDragging() ? "border-indigo-500 bg-indigo-500/5 border-dashed" : "border-[#1e1e2e] border-solid"}`, isDragging() ? "Drop to upload" : "Drag .proto here", ssrAttribute("value", escape(editingProto()?.content, true) || "", false), ssrStyleProperty("background-color:", "transparent"), ssrAttribute("disabled", isSaving(), true), ssrAttribute("disabled", isSaving(), true), isSaving() ? "Saving..." : "Save Schema");
    }
  })), escape(createComponent(Show, {
    get when() {
      return !editingProto();
    },
    get children() {
      return [ssr(_tmpl$4, ssrHydrationKey(), escape(createComponent(Show, {
        get when() {
          return !protos.loading;
        },
        fallback: "Searching...",
        get children() {
          return [protos()?.length || 0, " schema", (protos()?.length || 0) !== 1 ? "s" : ""];
        }
      }))), ssr(_tmpl$5, ssrHydrationKey(), escape(createComponent(Show, {
        get when() {
          return protos()?.length;
        },
        get fallback() {
          return ssr(_tmpl$7, ssrHydrationKey());
        },
        get children() {
          return createComponent(For, {
            get each() {
              return protos();
            },
            children: (proto) => ssr(_tmpl$8, ssrHydrationKey(), escape(proto.name), escape((proto.content || "").substring(0, 300)) + ((proto.content || "").length > 300 ? "..." : ""), escape(new Date(proto.updated_at).toLocaleString()))
          });
        }
      })))];
    }
  })));
}
export {
  Protos as default,
  id$$
};
//# sourceMappingURL=index-CRbc-Zf9.js.map
