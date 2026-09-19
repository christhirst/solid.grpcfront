import { isServer, ssr, ssrHydrationKey, escape, createComponent, ssrAttribute } from "solid-js/web";
import { createSignal, createResource, createMemo, onMount, onCleanup, Show, For, Suspense } from "solid-js";
import { D as DashboardGrid, g as getDefaultWidgetDimensions } from "./DashboardGrid-B4n-WQG5.js";
import { C as Card, I as Input, a as CardHeader, b as CardTitle, c as CardDescription, d as CardContent, e as CardFooter } from "./input-CptRrWy_.js";
import { u as useNavigate, B as Badge, a as Button } from "../../entry-server.js";
import "gridstack";
import "pathe";
import "radix3";
import "seroval";
import "seroval-plugins/web";
import "@auth/solid-start/client";
import "h3";
import "solid-js/web/storage";
import "cookie-es";
var _tmpl$4 = ["<span", ' class="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse"></span>'], _tmpl$5 = ["<svg", ' width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>'], _tmpl$6 = ["<svg", ' width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"></path><path d="M3 21v-5h5"></path><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"></path><path d="M21 3v5h-5"></path></svg>'], _tmpl$7 = ["<svg", ' width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>'], _tmpl$8 = ["<a", ' href="/dashboards">', "</a>"], _tmpl$9 = ["<div", ' class="flex flex-col gap-6 border-b border-zinc-800/80 p-6 lg:flex-row lg:items-center lg:justify-between"><div><div class="mb-2">', '</div><h1 class="text-4xl font-extrabold tracking-tight text-white">Dashboard Library</h1><p class="mt-2 max-w-2xl text-base leading-6 text-zinc-400">Explore and preview published dashboards arranged by their creators.</p></div><div class="flex items-center gap-3"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div></div>"], _tmpl$0 = ["<button", ' type="button" class="rounded-lg px-2 py-2 text-xs font-medium text-zinc-500 hover:text-white transition-colors shrink-0">Clear</button>'], _tmpl$1 = ["<div", ' class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 border-t border-zinc-800/60 pt-3 mt-1 px-5"><span class="text-xs font-semibold uppercase tracking-wide text-zinc-500 shrink-0 mr-1">Tags:</span><!--$-->', "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$10 = ["<div", ' class="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-950/40"><div class="flex-1 flex flex-col sm:flex-row gap-3"><div class="relative flex-1"><svg class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg><!--$-->', '<!--/--></div><div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">', "</div></div><!--$-->", '<!--/--><div class="flex items-center gap-3 shrink-0 p-5 pt-3"><label class="text-sm text-zinc-400">Sort by:</label><select', ' class="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none transition-colors"><option value="updated">Recently Updated</option><option value="widgets">Most Widgets</option><option value="name">Name (A-Z)</option></select><!--$-->', "<!--/--></div></div>"], _tmpl$11 = ["<main", ' class="mx-auto max-w-7xl 2xl:max-w-[90rem] px-4 py-8 sm:px-6 lg:py-10"><!--$-->', "<!--/--><!--$-->", "<!--/--></main>"], _tmpl$12 = ["<button", ' type="button" class="', '">', "</button>"], _tmpl$13 = ["<div", ' class="col-span-full rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">', "</div>"], _tmpl$14 = ["<div", ' class="col-span-full rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 p-12 text-center"><p class="text-base font-semibold text-white">No matching dashboards found</p><p class="mt-1 text-sm text-zinc-400">Try adjusting your search terms or widget filter.</p></div>'], _tmpl$15 = ["<div", '><div class="mb-5 flex items-center justify-between"><h2 class="text-lg font-bold text-white tracking-tight flex items-center gap-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>All Published Dashboards</h2><span class="text-xs text-zinc-500 font-mono"><!--$-->', "<!--/--> <!--$-->", '<!--/--> available</span></div><div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 transition-all duration-300">', "</div></div>"], _tmpl$16 = ["<div", ' class="col-span-full py-12 text-center text-zinc-400">Loading published library...</div>'], _tmpl$17 = ["<div", ' class="flex items-start justify-between gap-3"><div class="min-w-0"><!--$-->', "<!--/--><!--$-->", "<!--/--></div><!--$-->", "<!--/--></div>"], _tmpl$18 = ["<p", ' class="text-sm text-zinc-300 leading-relaxed line-clamp-4">', "</p>"], _tmpl$19 = ["<div", ' class="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 min-h-[90px] max-h-[140px] overflow-hidden flex flex-col">', "</div>"], _tmpl$20 = ["<div", ' class="flex flex-wrap gap-1.5 pt-1">', "</div>"], _tmpl$21 = ["<div", ' class="flex flex-wrap gap-1.5 pt-1"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"], _tmpl$22 = ["<svg", ' width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>'], _tmpl$23 = ["<span", ">Maximize</span>"], _tmpl$24 = ["<a", ' href="', '" target="_blank" class="font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors"><span>Open Public View</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>'], _tmpl$25 = ["<div", ' class="flex items-center justify-center h-full min-h-[60px] text-xs text-zinc-500 italic">No description provided</div>'], _tmpl$26 = ["<span", ">Minimize (Esc)</span>"], _tmpl$27 = ["<svg", ' width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'], _tmpl$28 = ["<a", ' href="', '" class="hidden sm:inline-flex">', "</a>"], _tmpl$29 = ["<span", ">Open Public View</span>"], _tmpl$30 = ["<svg", ' width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>'], _tmpl$31 = ["<div", ' class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-900/60 p-5 sm:p-6"><div class="flex items-center gap-3"><span class="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-purple-600/20 text-purple-400 font-bold text-lg border border-purple-500/30">⛶</span><div><div class="flex items-center gap-2"><h2 class="text-2xl font-extrabold text-white tracking-tight">', "</h2><!--$-->", "<!--/--><!--$-->", '<!--/--></div><p class="text-xs text-zinc-400 mt-1">Updated <!--$-->', "<!--/--> • <!--$-->", '<!--/--> widgets arranged by owner</p></div></div><div class="flex items-center gap-2.5"><!--$-->', "<!--/--><!--$-->", '<!--/--><a href="', '" target="_blank">', "</a></div></div>"], _tmpl$32 = ["<div", ' class="p-6 bg-zinc-950/70 min-h-[420px]">', "</div>"], _tmpl$33 = ["<div", ' class="w-full">', "</div>"], _tmpl$34 = ["<div", ' class="py-20 text-center text-zinc-500 text-sm italic">This dashboard has no widgets configured yet.</div>'], _tmpl$35 = ["<div", ' class="text-xs text-purple-300 font-medium">📈 <!--$-->', "<!--/--> Chart • <!--$-->", "<!--/--></div>"], _tmpl$36 = ["<div", ' class="text-xs text-emerald-300 font-medium">📋 Dynamic Table Grid • <!--$-->', "<!--/--></div>"], _tmpl$37 = ["<div", ' class="text-xs text-blue-300 font-medium">📰 Live Streaming Feed & Alert Rules</div>'], _tmpl$38 = ["<div", ' class="text-xs text-cyan-300 font-medium">🎚️ Active/Inactive State Switch</div>'], _tmpl$39 = ["<div", ' class="text-xs text-zinc-300 font-medium">⚡ Interactive Trigger Action</div>'], _tmpl$40 = ["<div", ' class="text-xs text-amber-300 font-medium">📝 Input Form (<!--$-->', "<!--/--> fields)</div>"], _tmpl$41 = ["<div", ' class="flex flex-col h-full justify-between gap-3"><div class="flex items-center justify-between pb-2 border-b border-zinc-800"><div class="flex items-center gap-2"><span class="text-lg">', '</span><span class="font-bold text-white text-sm">', '</span></div><span class="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">', '</span></div><div class="flex-1 flex items-center justify-center py-4 text-center"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", '<!--/--></div><div class="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400"><span>Dimensions: <!--$-->', "<!--/--> × <!--$-->", '<!--/--></span><a href="', '" target="_blank" class="text-purple-400 hover:text-purple-300 font-semibold">Interact ↗</a></div></div>'];
const dashboardId = (id) => id.replace("dashboard:", "");
const formatDate = (value) => {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
};
function DashboardLibrary() {
  useNavigate();
  const [search, setSearch] = createSignal("");
  const [widgetFilter, setWidgetFilter] = createSignal("all");
  const [sortBy, setSortBy] = createSignal("updated");
  const [maximizedId, setMaximizedId] = createSignal(null);
  const [error, setError] = createSignal("");
  const [session, setSession] = createSignal(null);
  const [selectedTags, setSelectedTags] = createSignal([]);
  const [dashboards, {
    refetch
  }] = createResource(async () => {
    setError("");
    try {
      const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3e3}/api/dashboards?published=true` : `/api/dashboards?published=true`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load library");
      return (json.data || []).filter((d) => d.isPublic);
    } catch (e) {
      console.error("[Dashboard Library] Fetch error:", e);
      setError(e.message);
      return [];
    }
  });
  const allTags = createMemo(() => {
    const tagSet = /* @__PURE__ */ new Set();
    for (const d of dashboards() || []) {
      for (const tag of d.tags || []) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].sort();
  });
  const filteredDashboards = createMemo(() => {
    let list = [...dashboards() || []];
    const q = search().toLowerCase().trim();
    const tag = widgetFilter();
    const sTags = selectedTags();
    if (q) {
      list = list.filter((d) => {
        const nameMatch = (d.name || "").toLowerCase().includes(q);
        const descMatch = (d.description || "").toLowerCase().includes(q);
        const tagMatch = (d.tags || []).some((t) => t.toLowerCase().includes(q));
        const widgetMatch = (d.buttons || []).some((b) => (b.label || "").toLowerCase().includes(q) || (b.widgetType || "").toLowerCase().includes(q));
        return nameMatch || descMatch || tagMatch || widgetMatch;
      });
    }
    if (tag !== "all") {
      list = list.filter((d) => (d.buttons || []).some((b) => (b.widgetType || "button") === tag));
    }
    if (sTags.length > 0) {
      list = list.filter((d) => sTags.every((st) => (d.tags || []).includes(st)));
    }
    if (sortBy() === "updated") {
      list.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
    } else if (sortBy() === "widgets") {
      list.sort((a, b) => (b.buttons?.length || 0) - (a.buttons?.length || 0));
    } else if (sortBy() === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return list;
  });
  const maximizedDashboard = createMemo(() => {
    const id = maximizedId();
    if (!id) return null;
    return (dashboards() || []).find((d) => d.id === id) || null;
  });
  onMount(() => {
    if (isServer) return;
    fetch("/api/auth/session").then((r) => r.ok ? r.json() : null).then((s) => setSession(s && Object.keys(s).length > 0 ? s : null)).catch(() => setSession(null));
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && maximizedId()) {
        setMaximizedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });
  const widgetKindCounts = (buttons = []) => {
    const counts = {};
    for (const b of buttons) {
      const type = b.widgetType || "button";
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  };
  return ssr(_tmpl$11, ssrHydrationKey(), escape(createComponent(Card, {
    "class": "mb-8 overflow-hidden bg-zinc-950/80 border-zinc-800/80",
    get children() {
      return [ssr(_tmpl$9, ssrHydrationKey(), escape(createComponent(Badge, {
        variant: "purple",
        "class": "gap-1.5",
        get children() {
          return [ssr(_tmpl$4, ssrHydrationKey()), "Public Dashboard Library"];
        }
      })), escape(createComponent(Show, {
        get when() {
          return maximizedId();
        },
        get children() {
          return createComponent(Button, {
            variant: "secondary",
            size: "sm",
            onClick: () => setMaximizedId(null),
            "class": "flex items-center gap-1.5",
            get children() {
              return [ssr(_tmpl$5, ssrHydrationKey()), "Minimize (Esc)"];
            }
          });
        }
      })), escape(createComponent(Button, {
        variant: "secondary",
        size: "sm",
        onClick: () => refetch(),
        get disabled() {
          return dashboards.loading;
        },
        get children() {
          return [ssr(_tmpl$6, ssrHydrationKey()), "Refresh"];
        }
      })), escape(createComponent(Show, {
        get when() {
          return session();
        },
        get children() {
          return ssr(_tmpl$8, ssrHydrationKey(), escape(createComponent(Button, {
            variant: "primary",
            size: "sm",
            get children() {
              return [ssr(_tmpl$7, ssrHydrationKey()), "Dashboard Manager"];
            }
          })));
        }
      }))), ssr(_tmpl$10, ssrHydrationKey(), escape(createComponent(Input, {
        type: "text",
        get value() {
          return search();
        },
        onInput: (e) => setSearch(e.currentTarget.value),
        placeholder: "Search by dashboard name or widget...",
        "class": "pl-10"
      })), escape(createComponent(For, {
        each: [{
          id: "all",
          label: "All"
        }, {
          id: "chart",
          label: "Charts"
        }, {
          id: "table",
          label: "Tables"
        }, {
          id: "news",
          label: "Alerts"
        }, {
          id: "button",
          label: "Buttons"
        }, {
          id: "form",
          label: "Forms"
        }, {
          id: "toggle",
          label: "Toggles"
        }],
        children: (chip) => ssr(_tmpl$12, ssrHydrationKey(), `rounded-lg px-3 py-2 text-sm font-semibold transition-all shrink-0 select-none ${widgetFilter() === chip.id ? "bg-purple-600 text-white shadow-md shadow-purple-500/20" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800/80"}`, escape(chip.label))
      })), escape(createComponent(Show, {
        get when() {
          return allTags().length > 0;
        },
        get children() {
          return ssr(_tmpl$1, ssrHydrationKey(), escape(createComponent(For, {
            get each() {
              return allTags();
            },
            children: (tag) => ssr(_tmpl$12, ssrHydrationKey(), `rounded-lg px-3 py-2 text-sm font-semibold transition-all shrink-0 select-none ${selectedTags().includes(tag) ? "bg-purple-600 text-white shadow-md shadow-purple-500/20" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-800/80"}`, escape(tag))
          })), escape(createComponent(Show, {
            get when() {
              return selectedTags().length > 0;
            },
            get children() {
              return ssr(_tmpl$0, ssrHydrationKey());
            }
          })));
        }
      })), ssrAttribute("value", escape(sortBy(), true), false), escape(createComponent(Badge, {
        variant: "purple",
        get children() {
          return [filteredDashboards().length, " ", filteredDashboards().length === 1 ? "board" : "boards"];
        }
      })))];
    }
  })), escape(createComponent(Show, {
    get when() {
      return maximizedDashboard();
    },
    get fallback() {
      return ssr(_tmpl$15, ssrHydrationKey(), escape(filteredDashboards().length), filteredDashboards().length === 1 ? "dashboard" : "dashboards", escape(createComponent(Suspense, {
        get fallback() {
          return ssr(_tmpl$16, ssrHydrationKey());
        },
        get children() {
          return [createComponent(Show, {
            get when() {
              return error();
            },
            get children() {
              return ssr(_tmpl$13, ssrHydrationKey(), escape(error()));
            }
          }), createComponent(Show, {
            get when() {
              return !dashboards.loading && filteredDashboards().length === 0;
            },
            get children() {
              return ssr(_tmpl$14, ssrHydrationKey());
            }
          }), createComponent(For, {
            get each() {
              return filteredDashboards();
            },
            children: (d) => {
              const counts = widgetKindCounts(d.buttons || []);
              return createComponent(Card, {
                "class": "flex flex-col justify-between h-full border border-zinc-800/80 bg-zinc-950/75 hover:border-purple-500/50 hover:bg-zinc-900/60 transition-all duration-200",
                get children() {
                  return [createComponent(CardHeader, {
                    "class": "p-5 pb-3",
                    get children() {
                      return ssr(_tmpl$17, ssrHydrationKey(), escape(createComponent(CardTitle, {
                        "class": "truncate text-base font-bold text-white transition-colors hover:text-purple-300",
                        get children() {
                          return d.name || "Untitled Dashboard";
                        }
                      })), escape(createComponent(CardDescription, {
                        "class": "mt-1",
                        get children() {
                          return ["Updated ", formatDate(d.updated_at || d.created_at), " • ", d.buttons?.length || 0, " widgets"];
                        }
                      })), escape(createComponent(Badge, {
                        variant: "success",
                        "class": "shrink-0",
                        children: "Published"
                      })));
                    }
                  }), createComponent(CardContent, {
                    "class": "p-5 pt-0 pb-3 flex-1 flex flex-col justify-between gap-3",
                    get children() {
                      return [ssr(_tmpl$19, ssrHydrationKey(), escape(createComponent(Show, {
                        get when() {
                          return d.description;
                        },
                        get fallback() {
                          return ssr(_tmpl$25, ssrHydrationKey());
                        },
                        get children() {
                          return ssr(_tmpl$18, ssrHydrationKey(), escape(d.description));
                        }
                      }))), createComponent(Show, {
                        get when() {
                          return d.tags && d.tags.length > 0;
                        },
                        get children() {
                          return ssr(_tmpl$20, ssrHydrationKey(), escape(createComponent(For, {
                            get each() {
                              return d.tags;
                            },
                            children: (tag) => createComponent(Badge, {
                              variant: "purple",
                              children: tag
                            })
                          })));
                        }
                      }), ssr(_tmpl$21, ssrHydrationKey(), escape(createComponent(Show, {
                        get when() {
                          return counts.chart;
                        },
                        get children() {
                          return createComponent(Badge, {
                            variant: "purple",
                            get children() {
                              return ["📊 ", counts.chart, " ", counts.chart === 1 ? "Chart" : "Charts"];
                            }
                          });
                        }
                      })), escape(createComponent(Show, {
                        get when() {
                          return counts.table;
                        },
                        get children() {
                          return createComponent(Badge, {
                            variant: "success",
                            get children() {
                              return ["📋 ", counts.table, " ", counts.table === 1 ? "Table" : "Tables"];
                            }
                          });
                        }
                      })), escape(createComponent(Show, {
                        get when() {
                          return counts.news;
                        },
                        get children() {
                          return createComponent(Badge, {
                            variant: "blue",
                            get children() {
                              return ["📰 ", counts.news, " ", counts.news === 1 ? "Feed" : "Feeds"];
                            }
                          });
                        }
                      })), escape(createComponent(Show, {
                        get when() {
                          return counts.button;
                        },
                        get children() {
                          return createComponent(Badge, {
                            variant: "secondary",
                            get children() {
                              return ["⚡ ", counts.button, " ", counts.button === 1 ? "Button" : "Buttons"];
                            }
                          });
                        }
                      })), escape(createComponent(Show, {
                        get when() {
                          return counts.form;
                        },
                        get children() {
                          return createComponent(Badge, {
                            variant: "amber",
                            get children() {
                              return ["📝 ", counts.form, " ", counts.form === 1 ? "Form" : "Forms"];
                            }
                          });
                        }
                      })), escape(createComponent(Show, {
                        get when() {
                          return counts.toggle;
                        },
                        get children() {
                          return createComponent(Badge, {
                            variant: "outline",
                            get children() {
                              return ["🎚️ ", counts.toggle, " ", counts.toggle === 1 ? "Toggle" : "Toggles"];
                            }
                          });
                        }
                      })))];
                    }
                  }), createComponent(CardFooter, {
                    "class": "p-4 pt-3 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between text-xs",
                    get children() {
                      return [createComponent(Button, {
                        variant: "secondary",
                        size: "sm",
                        onClick: () => {
                          setMaximizedId(d.id);
                          window.scrollTo({
                            top: 0,
                            behavior: "smooth"
                          });
                        },
                        "class": "text-xs flex items-center gap-1.5",
                        title: "Maximize dashboard over whole width",
                        get children() {
                          return [ssr(_tmpl$22, ssrHydrationKey()), ssr(_tmpl$23, ssrHydrationKey())];
                        }
                      }), ssr(_tmpl$24, ssrHydrationKey(), `/p/${escape(dashboardId(d.id), true)}`)];
                    }
                  })];
                }
              });
            }
          })];
        }
      })));
    },
    children: (dash) => (
      /* Maximized Dashboard (Viewable Over the Whole Width) */
      ssr(_tmpl$33, ssrHydrationKey(), escape(createComponent(Card, {
        "class": "overflow-hidden border-purple-500/40 bg-zinc-950/90 shadow-2xl",
        get children() {
          return [ssr(_tmpl$31, ssrHydrationKey(), escape(dash().name) || "Untitled Dashboard", escape(createComponent(Badge, {
            variant: "purple",
            children: "Maximized"
          })), escape(createComponent(Badge, {
            variant: "success",
            children: "Published"
          })), escape(formatDate(dash().updated_at || dash().created_at)), escape(dash().buttons?.length) || 0, escape(createComponent(Button, {
            variant: "secondary",
            size: "sm",
            onClick: () => setMaximizedId(null),
            title: "Restore Grid View (Esc)",
            "class": "flex items-center gap-1.5",
            get children() {
              return [ssr(_tmpl$5, ssrHydrationKey()), ssr(_tmpl$26, ssrHydrationKey())];
            }
          })), escape(createComponent(Show, {
            get when() {
              return session();
            },
            get children() {
              return ssr(_tmpl$28, ssrHydrationKey(), `/dashboards/${escape(dashboardId(dash().id), true)}`, escape(createComponent(Button, {
                variant: "outline",
                size: "sm",
                "class": "flex items-center gap-1.5",
                get children() {
                  return [ssr(_tmpl$27, ssrHydrationKey()), "Edit & Arrange"];
                }
              })));
            }
          })), `/p/${escape(dashboardId(dash().id), true)}`, escape(createComponent(Button, {
            variant: "primary",
            size: "sm",
            "class": "flex items-center gap-1.5",
            get children() {
              return [ssr(_tmpl$29, ssrHydrationKey()), ssr(_tmpl$30, ssrHydrationKey())];
            }
          }))), ssr(_tmpl$32, ssrHydrationKey(), escape(createComponent(Show, {
            get when() {
              return (dash().buttons || []).length > 0;
            },
            get fallback() {
              return ssr(_tmpl$34, ssrHydrationKey());
            },
            get children() {
              return createComponent(DashboardGrid, {
                get buttons() {
                  return dash().buttons || [];
                },
                isStatic: true,
                get dashboardId() {
                  return dashboardId(dash().id);
                },
                renderWidget: (btn) => ssr(_tmpl$41, ssrHydrationKey(), btn.widgetType === "chart" ? "📊" : btn.widgetType === "table" ? "📋" : btn.widgetType === "news" ? "📰" : btn.widgetType === "toggle" ? "🎚️" : "⚡", escape(btn.label) || "Widget", escape(btn.widgetType) || "button", escape(createComponent(Show, {
                  get when() {
                    return btn.widgetType === "chart";
                  },
                  get children() {
                    return ssr(_tmpl$35, ssrHydrationKey(), btn.chartType ? escape(btn.chartType.toUpperCase()) : "BAR", btn.workflowId ? "Linked to Workflow" : "Configured");
                  }
                })), escape(createComponent(Show, {
                  get when() {
                    return btn.widgetType === "table";
                  },
                  get children() {
                    return ssr(_tmpl$36, ssrHydrationKey(), btn.columns ? `${escape(btn.columns.split(",").length)} Columns` : "Auto Columns");
                  }
                })), escape(createComponent(Show, {
                  get when() {
                    return btn.widgetType === "news";
                  },
                  get children() {
                    return ssr(_tmpl$37, ssrHydrationKey());
                  }
                })), escape(createComponent(Show, {
                  get when() {
                    return btn.widgetType === "toggle";
                  },
                  get children() {
                    return ssr(_tmpl$38, ssrHydrationKey());
                  }
                })), escape(createComponent(Show, {
                  get when() {
                    return btn.widgetType === "button" || !btn.widgetType;
                  },
                  get children() {
                    return ssr(_tmpl$39, ssrHydrationKey());
                  }
                })), escape(createComponent(Show, {
                  get when() {
                    return btn.widgetType === "form";
                  },
                  get children() {
                    return ssr(_tmpl$40, ssrHydrationKey(), escape(btn.formConfig?.length) || 0);
                  }
                })), escape(btn.w) || escape(getDefaultWidgetDimensions(btn.widgetType).w), escape(btn.h) || escape(getDefaultWidgetDimensions(btn.widgetType).h), `/p/${escape(dashboardId(dash().id), true)}`)
              });
            }
          })))];
        }
      })))
    )
  })));
}
const id$$ = "src/routes/library.tsx?pick=default&pick=$css";
function LibraryRoute() {
  return createComponent(DashboardLibrary, {});
}
export {
  LibraryRoute as default,
  id$$
};
//# sourceMappingURL=library-Bki2gWb9.js.map
