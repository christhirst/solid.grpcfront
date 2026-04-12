import { isServer, ssr, ssrHydrationKey, escape, createComponent } from "solid-js/web";
import { createResource, Show, For } from "solid-js";
import { a as useNavigate } from "../../entry-server.js";
import { A } from "./components-CudbSkEV.js";
import "pathe";
import "radix3";
import "seroval";
import "seroval-plugins/web";
import "h3";
import "solid-js/web/storage";
import "cookie-es";
var _tmpl$ = ["<svg", ' width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'], _tmpl$2 = ["<div", ' class="col-span-full rounded-xl border border-dashed border-[#2a2a3a] py-16 text-center bg-[#0a0a0f]/50"><h3 class="mb-2 font-bold text-white">No dashboards yet</h3><p class="text-[#8b8b9e] text-sm max-w-md mx-auto">Create a dashboard to securely expose your workflows as simple buttons to external users.</p></div>'], _tmpl$3 = ["<main", ' class="mx-auto max-w-7xl px-6 py-12"><div class="mb-8 flex items-center justify-between"><h1 class="text-3xl font-extrabold tracking-tight text-white">Dashboards</h1><!--$-->', '<!--/--></div><div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"><!--$-->', "<!--/--><!--$-->", "<!--/--></div></main>"], _tmpl$4 = ["<span", ' class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PUBLIC</span>'], _tmpl$5 = ["<div", ' class="flex justify-between items-start mb-4"><h3 class="font-bold text-lg text-white truncate group-hover:text-purple-400 transition-colors">', "</h3><!--$-->", "<!--/--></div>"], _tmpl$6 = ["<div", ' class="text-xs text-[#8b8b9e] mb-auto"><!--$-->', "<!--/--> buttons configured</div>"], _tmpl$7 = ["<svg", ' width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>'], _tmpl$8 = ["<div", ' class="mt-6 flex items-center justify-between border-t border-[#2a2a3a] pt-4"><div class="text-[10px] text-[#5b5b6e]">', '</div><div class="flex gap-2"><!--$-->', '<!--/--><button class="text-[#8b8b9e] hover:text-red-400 p-1" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div></div>'];
const id$$ = "src/routes/dashboards/index.tsx?pick=default&pick=$css";
function Dashboards() {
  useNavigate();
  const [dashboards, {
    refetch
  }] = createResource(async () => {
    if (isServer) return [];
    try {
      const res = await fetch("/api/dashboards");
      const json = await res.json();
      return json.success ? json.data : [];
    } catch {
      return [];
    }
  });
  return ssr(_tmpl$3, ssrHydrationKey(), escape(createComponent(A, {
    href: "/dashboards/new",
    "class": "btn-primary flex items-center gap-2",
    get children() {
      return [ssr(_tmpl$, ssrHydrationKey()), "New Dashboard"];
    }
  })), escape(createComponent(Show, {
    get when() {
      return !dashboards.loading && dashboards()?.length === 0;
    },
    get children() {
      return ssr(_tmpl$2, ssrHydrationKey());
    }
  })), escape(createComponent(For, {
    get each() {
      return dashboards();
    },
    children: (d) => createComponent(A, {
      get href() {
        return `/dashboards/${d.id.replace("dashboard:", "")}`;
      },
      "class": "card card-hover group p-6 flex flex-col h-full border-l-4 border-l-purple-500",
      get children() {
        return [ssr(_tmpl$5, ssrHydrationKey(), escape(d.name) || "Untitled Dashboard", escape(createComponent(Show, {
          get when() {
            return d.isPublic;
          },
          get children() {
            return ssr(_tmpl$4, ssrHydrationKey());
          }
        }))), ssr(_tmpl$6, ssrHydrationKey(), escape(d.buttons?.length) || 0), ssr(_tmpl$8, ssrHydrationKey(), escape(new Date(d.updated_at).toLocaleDateString()), escape(createComponent(Show, {
          get when() {
            return d.isPublic;
          },
          get children() {
            return createComponent(A, {
              get href() {
                return `/p/${d.id.replace("dashboard:", "")}`;
              },
              target: "_blank",
              onClick: (e) => e.stopPropagation(),
              "class": "text-[#8b8b9e] hover:text-blue-400 p-1",
              title: "View Public Board",
              get children() {
                return ssr(_tmpl$7, ssrHydrationKey());
              }
            });
          }
        })))];
      }
    })
  })));
}
export {
  Dashboards as default,
  id$$
};
//# sourceMappingURL=index-BMUTU14W.js.map
