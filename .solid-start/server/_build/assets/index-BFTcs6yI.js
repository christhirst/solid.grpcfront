import { ssr, ssrHydrationKey, ssrAttribute, escape, createComponent, isServer } from "solid-js/web";
import { createSignal, createResource, Show, For } from "solid-js";
var _tmpl$ = ["<svg", ' class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$2 = ["<p", ' class="mt-2 text-sm text-red-500">', "</p>"], _tmpl$3 = ["<div", ' class="flex justify-center p-8"><svg class="animate-spin h-8 w-8 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>'], _tmpl$4 = ["<div", ' class="rounded-xl border border-dashed border-[#2a2a3a] py-16 text-center bg-[#0a0a0f]/50"><p class="text-[#8b8b9e]">No databases found in the current namespace.</p></div>'], _tmpl$5 = ["<main", ' class="mx-auto max-w-5xl px-6 py-12 text-white"><div class="mb-8 flex items-center justify-between"><h1 class="text-3xl font-extrabold tracking-tight">Database Management</h1></div><div class="mb-10 rounded-xl border border-[#2a2a3a] bg-[#1e1e2e] p-6 shadow-lg relative"><h2 class="mb-4 text-lg font-bold text-white flex items-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12H3"></path><path d="M21 6H3"></path><path d="M21 18H3"></path></svg>Create New Database</h2><div class="flex items-center gap-4"><input type="text" class="flex-1 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-3 text-sm text-white focus:border-blue-500 focus:outline-none placeholder:text-[#5b5b6e]" placeholder="e.g. analytics_db"', "", "><button", ' class="btn-primary min-w-[120px] flex items-center justify-center gap-2 disabled:opacity-50">', "</button></div><!--$-->", '<!--/--></div><div><h2 class="mb-4 text-xl font-bold flex items-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>Available Databases</h2><!--$-->', "<!--/--><!--$-->", '<!--/--><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">', "</div></div></main>"], _tmpl$6 = ["<a", ' href="', '" target="_self" class="card p-6 border-t-4 border-t-blue-500 hover:-translate-y-1 transition-transform group cursor-pointer"><div class="flex items-center justify-between mb-2"><h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">', '</h3><svg class="text-[#8b8b9e] group-hover:translate-x-1 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></div><p class="text-sm text-[#5b5b6e]">Click to view tables and data</p></a>'];
const id$$ = "src/routes/database/index.tsx?pick=default&pick=$css";
function DatabaseOverview() {
  const [newDbName, setNewDbName] = createSignal("");
  const [isCreating, setIsCreating] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal("");
  const fetchDatabases = async () => {
    try {
      const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/database` : "/api/database";
      const res = await fetch(url);
      const text = await res.text();
      console.log("Database fetch response:", res.status, text);
      const json = JSON.parse(text);
      return json.success ? json.data : [];
    } catch (e) {
      console.error("Database fetch failed:", e);
      return [];
    }
  };
  const [databases, {
    refetch
  }] = createResource(fetchDatabases);
  return ssr(_tmpl$5, ssrHydrationKey(), ssrAttribute("value", escape(newDbName(), true), false), ssrAttribute("disabled", isCreating(), true), ssrAttribute("disabled", isCreating() || !newDbName().trim(), true), escape(createComponent(Show, {
    get when() {
      return isCreating();
    },
    fallback: "Create",
    get children() {
      return [ssr(_tmpl$, ssrHydrationKey()), "Creating..."];
    }
  })), escape(createComponent(Show, {
    get when() {
      return errorMsg();
    },
    get children() {
      return ssr(_tmpl$2, ssrHydrationKey(), escape(errorMsg()));
    }
  })), escape(createComponent(Show, {
    get when() {
      return databases.loading;
    },
    get children() {
      return ssr(_tmpl$3, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return !databases.loading && databases()?.length === 0;
    },
    get children() {
      return ssr(_tmpl$4, ssrHydrationKey());
    }
  })), escape(createComponent(For, {
    get each() {
      return databases();
    },
    children: (db) => ssr(_tmpl$6, ssrHydrationKey(), `/database/${escape(db, true)}`, escape(db))
  })));
}
export {
  DatabaseOverview as default,
  id$$
};
//# sourceMappingURL=index-BFTcs6yI.js.map
