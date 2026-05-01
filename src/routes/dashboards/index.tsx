import { Show, For, Suspense } from "solid-js";
import { A, cache, createAsync } from "@solidjs/router";
import { getDb } from "~/lib/db";

// Define a server function to fetch dashboards directly from DB
const getDashboards = cache(async () => {
  "use server";
  try {
    const db = await getDb();
    const result = await db.query("SELECT * FROM dashboard ORDER BY updated_at DESC");
    const data = (result[0] as any[]) || [];
    return data.map((w: any) => ({ 
      ...w, 
      id: w.id?.toString().replace(/[⟨⟩]/g, "") 
    }));
  } catch (e) {
    console.error("[SSR] Failed to fetch dashboards:", e);
    return [];
  }
}, "dashboards");

export default function Dashboards() {
  const dashboards = createAsync(() => getDashboards());

  const deleteDashboard = async (id: string, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch(`/api/dashboards/${id.replace("dashboard:", "")}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
         // In SolidStart 2.0 with createAsync, we would usually use revalidate
         // but for now, we'll just reload or let the user refresh if needed.
         window.location.reload();
      }
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <main class="mx-auto max-w-7xl px-6 py-12">
      <div class="mb-8 flex items-center justify-between">
        <h1 class="text-3xl font-extrabold tracking-tight text-white">Dashboards</h1>
        <A href="/dashboards/new" class="btn-primary flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Dashboard
        </A>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Suspense fallback={<div class="col-span-full text-center py-12 text-[#8b8b9e]">Loading dashboards...</div>}>
          <Show when={dashboards()?.length === 0}>
            <div class="col-span-full rounded-xl border border-dashed border-[#2a2a3a] py-16 text-center bg-[#0a0a0f]/50">
              <h3 class="mb-2 font-bold text-white">No dashboards yet</h3>
              <p class="text-[#8b8b9e] text-sm max-w-md mx-auto">Create a dashboard to securely expose your workflows as simple buttons to external users.</p>
            </div>
          </Show>

          <For each={dashboards()}>
            {(d) => (
              <A href={`/dashboards/${d.id.replace("dashboard:", "")}`} class="card card-hover group p-6 flex flex-col h-full border-l-4 border-l-purple-500">
                <div class="flex justify-between items-start mb-4">
                  <h3 class="font-bold text-lg text-white truncate group-hover:text-purple-400 transition-colors">
                    {d.name || "Untitled Dashboard"}
                  </h3>
                  <Show when={d.isPublic}>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PUBLIC</span>
                  </Show>
                </div>
                
                <div class="text-xs text-[#8b8b9e] mb-auto">
                  {d.buttons?.length || 0} buttons configured
                </div>
                
                <div class="mt-6 flex items-center justify-between border-t border-[#2a2a3a] pt-4">
                  <div class="text-[10px] text-[#5b5b6e]">
                    {new Date(d.updated_at).toLocaleDateString()}
                  </div>
                  <div class="flex gap-2">
                    <Show when={d.isPublic}>
                      <A href={`/p/${d.id.replace("dashboard:", "")}`} target="_blank" onClick={(e: Event) => e.stopPropagation()} class="text-[#8b8b9e] hover:text-blue-400 p-1" title="View Public Board">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </A>
                    </Show>
                    <button onClick={(e) => deleteDashboard(d.id, e)} class="text-[#8b8b9e] hover:text-red-400 p-1" title="Delete">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              </A>
            )}
          </For>
        </Suspense>
      </div>
    </main>
  );
}
