import { ssr, ssrHydrationKey, escape, createComponent, ssrAttribute, ssrStyleProperty, isServer } from "solid-js/web";
import { createResource, createSignal, Show, For } from "solid-js";
var _tmpl$ = ["<button", ' class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-px hover:shadow-emerald-500/40"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>New Certificate</button>'], _tmpl$2 = ["<div", ' class="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">', "</div>"], _tmpl$3 = ["<span", ' class="', '">', "</span>"], _tmpl$4 = ["<div", ' class="card p-6 fade-in-up delay-2 mb-6"><h2 class="text-lg font-bold text-white mb-4">', "</h2><!--$-->", '<!--/--><div class="space-y-4"><div><label class="block text-xs font-medium text-[#5a5a6e] mb-1.5">Certificate Name</label><input type="text"', ' class="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors" placeholder="e.g. Internal Root CA"></div><div><div class="flex items-center justify-between mb-1.5"><label class="block text-xs font-medium text-[#5a5a6e]">PEM Content</label><!--$-->', '<!--/--></div><div class="', '"><div class="absolute right-3 top-3 flex items-center gap-2 pointer-events-none"><span class="text-[10px] font-bold tracking-widest text-[#5a5a6e] uppercase opacity-60">', '</span></div><div class="absolute left-3 top-3 pointer-events-auto"><label class="cursor-pointer inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1 hover:bg-emerald-500/20 transition-colors"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>Browse file<input type="file" class="hidden" accept=".pem,.crt,.cer,.ca-bundle,.cert"></label></div><textarea', ' class="w-full min-h-[280px] rounded-lg bg-transparent p-4 pt-10 text-sm text-[#c8c8d8] font-mono focus:outline-none transition-colors" style="', '" spellcheck="false" placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"></textarea></div><p class="mt-1.5 text-[10px] text-[#5a5a6e]">Paste or drop a PEM-encoded CA certificate (root or intermediate). Supports .pem, .crt, .cer formats.</p></div><div class="flex justify-end gap-3 pt-4 border-t border-[#1e1e2e]"><button', ' class="rounded-lg px-4 py-2 text-sm font-medium text-[#8b8b9e] hover:bg-[#1e1e2e] hover:text-white transition-colors">Cancel</button><button', ' class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2 text-sm font-semibold text-white shadow-md hover:shadow-emerald-500/25 transition-all">', "</button></div></div></div>"], _tmpl$5 = ["<div", ' class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 fade-in-up delay-2">', "</div>"], _tmpl$6 = ["<main", ' class="relative min-h-screen"><div class="mesh-gradient"></div><div class="grain-overlay"></div><div class="relative z-10 mx-auto max-w-5xl px-6 py-8"><div class="flex items-center justify-between mb-8 fade-in-up delay-1"><div><div class="flex items-center gap-3 mb-2"><div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div><h1 class="text-2xl font-bold tracking-tight text-white">CA Certificates</h1></div><p class="text-sm text-[#8b8b9e]">Manage trusted CA root certificates for TLS-enabled gRPC workflows.</p></div><!--$-->', "<!--/--></div><!--$-->", "<!--/--><!--$-->", "<!--/--></div></main>"], _tmpl$7 = ["<div", ' class="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#1e1e2e] bg-[#12121a]/50 py-16"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2a2a3e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><h3 class="text-lg font-medium text-white mb-2">No CA Certificates</h3><p class="text-[#5a5a6e] text-center max-w-sm text-sm px-4">Upload your root CA or intermediate CA certificates here to use them in TLS-enabled gRPC workflows.</p></div>'], _tmpl$8 = ["<span", ' class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">PEM</span>'], _tmpl$9 = ["<div", ' class="card p-5 group cursor-pointer hover:border-emerald-500/50 transition-colors flex flex-col h-[200px]"><div class="flex items-start justify-between mb-3"><div class="flex items-center gap-2 min-w-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg><h3 class="font-semibold text-white truncate max-w-[160px]">', '</h3></div><div class="flex items-center gap-1 shrink-0"><!--$-->', '<!--/--><button class="p-1 rounded bg-[#1e1e2e] text-[#5a5a6e] opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 hover:bg-red-500/10"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div></div><div class="relative flex-1 bg-[#12121a] rounded-lg border border-[#1e1e2e] p-3 overflow-hidden"><pre class="text-[10px] text-[#5a5a6e] font-mono leading-relaxed pointer-events-none">', '</pre><div class="absolute inset-0 bg-gradient-to-t from-[#12121a] via-[#12121a]/50 to-transparent pointer-events-none"></div></div><div class="mt-3 text-[10px] font-medium text-[#5a5a6e] truncate">Updated: <!--$-->', "<!--/--></div></div>"];
const fetchCerts = async () => {
  const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/cas` : "/api/cas";
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json.success ? json.data : [];
  } catch {
    return [];
  }
};
function CaCerts() {
  const [certs, {
    refetch
  }] = createResource(fetchCerts);
  const [editing, setEditing] = createSignal(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal(null);
  const [isDragging, setIsDragging] = createSignal(false);
  const isPemValid = (content) => content.trim().startsWith("-----BEGIN");
  return ssr(_tmpl$6, ssrHydrationKey(), escape(createComponent(Show, {
    get when() {
      return !editing();
    },
    get children() {
      return ssr(_tmpl$, ssrHydrationKey());
    }
  })), escape(createComponent(Show, {
    get when() {
      return editing();
    },
    get children() {
      return ssr(_tmpl$4, ssrHydrationKey(), editing()?.id ? "Edit CA Certificate" : "Add CA Certificate", escape(createComponent(Show, {
        get when() {
          return errorMsg();
        },
        get children() {
          return ssr(_tmpl$2, ssrHydrationKey(), escape(errorMsg()));
        }
      })), ssrAttribute("value", escape(editing()?.name, true) || "", false), escape(createComponent(Show, {
        get when() {
          return editing()?.content;
        },
        get children() {
          return ssr(_tmpl$3, ssrHydrationKey(), `text-[10px] font-semibold px-2 py-0.5 rounded-full ${isPemValid(editing().content) ? "bg-emerald-500/10 text-emerald-400" : "bg-yellow-500/10 text-yellow-400"}`, isPemValid(editing().content) ? "✓ Valid PEM" : "⚠ Invalid PEM");
        }
      })), `relative rounded-lg border-2 transition-colors ${isDragging() ? "border-emerald-500 bg-emerald-500/5 border-dashed" : "border-[#1e1e2e] border-solid"}`, isDragging() ? "Drop to upload" : "Drag .pem/.crt here", ssrAttribute("value", escape(editing()?.content, true) || "", false), ssrStyleProperty("background-color:", "transparent"), ssrAttribute("disabled", isSaving(), true), ssrAttribute("disabled", isSaving(), true), isSaving() ? "Saving..." : "Save Certificate");
    }
  })), escape(createComponent(Show, {
    get when() {
      return !editing();
    },
    get children() {
      return ssr(_tmpl$5, ssrHydrationKey(), escape(createComponent(Show, {
        get when() {
          return certs()?.length;
        },
        get fallback() {
          return ssr(_tmpl$7, ssrHydrationKey());
        },
        get children() {
          return createComponent(For, {
            get each() {
              return certs();
            },
            children: (cert) => ssr(_tmpl$9, ssrHydrationKey(), escape(cert.name), escape(createComponent(Show, {
              get when() {
                return cert.content?.trim().startsWith("-----BEGIN");
              },
              get children() {
                return ssr(_tmpl$8, ssrHydrationKey());
              }
            })), escape((cert.content || "").substring(0, 300)) + ((cert.content || "").length > 300 ? "..." : ""), escape(new Date(cert.updated_at).toLocaleString()))
          });
        }
      })));
    }
  })));
}
const id$$ = "src/routes/TrustedCA.tsx?pick=default&pick=$css";
export {
  CaCerts as default,
  id$$
};
//# sourceMappingURL=TrustedCA-DpPvaCb0.js.map
