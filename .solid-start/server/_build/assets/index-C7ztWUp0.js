import { isServer, ssr, ssrHydrationKey, escape, createComponent, ssrAttribute } from "solid-js/web";
import { createSignal, createResource, Show, For } from "solid-js";
import { a as checkWorkflowConfiguredInDashboards } from "./workflowVariableChecker-CcT-pYzg.js";
var _tmpl$ = ["<div", ' class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">', "</div>"], _tmpl$2 = ["<main", ' class="mx-auto max-w-7xl px-6 py-12"><div class="mb-10 flex items-end justify-between"><div><h1 class="text-4xl font-extrabold tracking-tight text-white mb-2">Workflows</h1><p class="text-[15px] text-[#8b8b9e]">Build, chain, and automate gRPC requests</p></div><a href="/workflows/new" target="_self" class="btn-primary hover-lift glow-effect group flex items-center gap-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="transition-transform group-hover:scale-110" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>New Workflow</a></div><div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div class="relative w-full sm:max-w-md"><svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a6e]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg><input class="w-full rounded-xl border border-[#1e1e2e] bg-[#12121a] py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-[#5a5a6e] focus:border-blue-500" placeholder="Search workflows..."></div><div class="text-sm text-[#8b8b9e]">', "</div></div><!--$-->", "<!--/--></main>"], _tmpl$3 = ["<a", ' href="/workflows/new" target="_self" class="btn-primary">Create Your First Workflow</a>'], _tmpl$4 = ["<div", ' class="card flex flex-col items-center justify-center p-16 text-center border-dashed border-[#2a2a3a]"><div class="mb-6 rounded-full bg-[#1e1e2e] p-6 text-[#5b5b6e]"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div><h3 class="mb-2 text-xl font-bold text-white">', '</h3><p class="mb-6 max-w-md text-[#8b8b9e]">', "</p><!--$-->", "<!--/--></div>"], _tmpl$5 = ["<div", ' class="', '"></div>'], _tmpl$6 = ["<span", ' class="', '">', "</span>"], _tmpl$7 = ["<a", ' href="', '" target="_self" class="card group relative flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 overflow-hidden"><!--$-->', '<!--/--><div><div class="mb-4 flex items-center justify-between relative z-10"><div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 ring-1 ring-indigo-500/30"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></div><div class="flex items-center gap-2"><!--$-->', '<!--/--><span class="', '">', '</span><button class="text-[#5b5b6e] transition-colors hover:text-red-400"', '><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg></button></div></div><h3 class="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">', '</h3><p class="mt-2 text-sm text-[#8b8b9e] line-clamp-2"><!--$-->', "<!--/--> steps connected to <!--$-->", '<!--/--></p></div><div class="mt-6 flex items-center justify-between border-t border-[#1e1e2e] pt-4 text-xs text-[#5b5b6e]"><span>Last updated: <!--$-->', '<!--/--></span><span class="flex items-center gap-1 group-hover:text-white transition-colors">Edit Flow<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></span></div></a>'];
const id$$ = "src/routes/workflows/index.tsx?pick=default&pick=$css";
function Workflows() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [isDeleting, setIsDeleting] = createSignal(null);
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
  const fetchWorkflows = async (q) => {
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/workflows${params}` : `/api/workflows${params}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (e) {
      console.error("fetchWorkflows error:", e);
      return [];
    }
  };
  const [workflows, {
    refetch
  }] = createResource(() => searchQuery(), fetchWorkflows);
  return ssr(_tmpl$2, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return !workflows.loading;
    },
    fallback: "Searching...",
    get children() {
      return [workflows()?.length || 0, " workflow", (workflows()?.length || 0) !== 1 ? "s" : ""];
    }
  })), escape(createComponent(Show, {
    get when() {
      return workflows() && workflows().length > 0;
    },
    get fallback() {
      return ssr(_tmpl$4, ssrHydrationKey(), searchQuery() ? "No matching workflows" : "No workflows found", searchQuery() ? "Try a different search term." : "You haven't created any automated gRPC workflows yet. Start building your first flow!", escape(createComponent(Show, {
        get when() {
          return !searchQuery();
        },
        get children() {
          return ssr(_tmpl$3, ssrHydrationKey());
        }
      })));
    },
    get children() {
      return ssr(_tmpl$, ssrHydrationKey(), escape(createComponent(For, {
        get each() {
          return workflows();
        },
        children: (workflow) => {
          const vStatus = () => checkWorkflowConfiguredInDashboards(workflow, dashboards() || []);
          const rawWfId = () => {
            const idStr = typeof workflow?.id === "string" ? workflow.id : String(workflow?.id || "");
            return idStr.includes(":") ? idStr.split(":")[1] : idStr;
          };
          return ssr(_tmpl$7, ssrHydrationKey(), `/workflows/${escape(rawWfId(), true)}`, escape(createComponent(Show, {
            get when() {
              return vStatus().hasVariables;
            },
            get children() {
              return ssr(_tmpl$5, ssrHydrationKey(), `absolute top-0 left-0 right-0 h-12 rounded-t-2xl pointer-events-none transition-colors border-b ${vStatus().allConfigured ? "bg-emerald-500/20 border-emerald-500/30" : "bg-red-500/20 border-red-500/30"}`);
            }
          })), escape(createComponent(Show, {
            get when() {
              return vStatus().hasVariables;
            },
            get children() {
              return ssr(_tmpl$6, ssrHydrationKey(), `rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${vStatus().allConfigured ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300" : "border-red-500/40 bg-red-500/20 text-red-300"}`, vStatus().allConfigured ? "✓ Vars Configured" : "⚠️ Vars Unconfigured");
            }
          })), `rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${(workflow.visibility || "public") === "public" ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-[#2a2a3a] bg-[#0a0a0f] text-[#8b8b9e]"}`, escape(workflow.visibility) || "public", ssrAttribute("disabled", isDeleting() === workflow.id, true), escape(workflow.name) || "Untitled Workflow", escape(workflow.steps?.length) || 0, escape(workflow.serverAddress), escape(new Date(workflow.updated_at || Date.now()).toISOString().split("T")[0]));
        }
      })));
    }
  })));
}
export {
  Workflows as default,
  id$$
};
//# sourceMappingURL=index-C7ztWUp0.js.map
