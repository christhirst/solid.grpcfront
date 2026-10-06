import { createSignal, Show, onMount, createEffect } from "solid-js";
import { useParams } from "@solidjs/router";
import PublicDashboardView, { loadWorkflowMap } from "~/components/dashboard/PublicDashboardView";

// ─── Main public dashboard page ───────────────────────────────────────────────

export default function PublicDashboard() {
  const params = useParams();

  const [dashboard, setDashboard] = createSignal<any>(undefined);
  // Map workflowId -> full workflow object (for last-step detection)
  const [workflowMap, setWorkflowMap] = createSignal<Record<string, any>>({});
  const [session, setSession] = createSignal<any | null>(null);

  onMount(async () => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setSession(s && Object.keys(s).length > 0 ? s : null))
      .catch(() => setSession(null));

    try {
      const res = await fetch(`/api/dashboards/${params.id}`);
      const json = await res.json();
      if (json.success) {
        const dash = json.data;
        // Allow access if: visibility is "public" (or missing, for backward compat), OR legacy isPublic is true
        const vis = dash.visibility || "public";
        const allowed = vis === "public" || dash.isPublic;
        if (!allowed) {
          setDashboard(null);
          return;
        }
        setDashboard(dash);

        // Fetch each unique workflow referenced by a button
        setWorkflowMap(await loadWorkflowMap(dash.buttons || []));
      } else {
        setDashboard(null);
      }
    } catch {
      setDashboard(null);
    }
  });

  createEffect(() => {
    if (dashboard()) document.title = dashboard().name || "Dashboard";
  });

  return (
    <main class="min-h-screen bg-[#050508] p-3 sm:p-6 lg:p-16 pb-24 sm:pb-6 font-sans">
      <Show when={dashboard() === null}>
        <div class="text-center mt-32">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto mb-4 text-[#8b8b9e]"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <h1 class="text-2xl font-bold text-white mb-2">Not Found</h1>
          <p class="text-[#8b8b9e]">This dashboard does not exist or is not public.</p>
        </div>
      </Show>

      <Show when={dashboard() === undefined}>
        <div class="flex items-center justify-center min-h-screen">
          <svg class="animate-spin h-8 w-8 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
      </Show>

      <Show when={dashboard()}>
        <div class="max-w-7xl 2xl:max-w-[90rem] mx-auto px-4">
          {/* Header */}
          <div class="relative pt-12 pb-8 text-center mb-10">
            <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>
            <div class="flex items-center justify-between mb-4">
              <a href="/library" class="text-sm text-[#8b8b9e] hover:text-white flex items-center gap-1.5 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                <span>Dashboard Library</span>
              </a>
              <Show when={session()}>
                <a href={`/dashboards/${(dashboard()?.id || params.id || "").replace("dashboard:", "")}`} class="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                  <span>Edit & Arrange</span>
                </a>
              </Show>
            </div>
            <h1 class="text-5xl font-extrabold tracking-tight text-white mb-2">{dashboard().name}</h1>
            <p class="text-sm font-bold tracking-widest text-[#5b5b6e] uppercase">Public View • Fixed Layout</p>
          </div>

          {/* Widgets grid (GridStack fixed layout) */}
          <Show when={(dashboard().buttons || []).length === 0}>
            <div class="text-center py-16 text-[#5b5b6e] text-sm italic">No actions available right now.</div>
          </Show>

          <Show when={(dashboard().buttons || []).length > 0}>
            <PublicDashboardView
              dashboardId={params.id!}
              buttons={dashboard().buttons || []}
              workflowMap={workflowMap()}
            />
          </Show>

          <div class="mt-12 text-center text-[10px] text-[#5b5b6e]">
            Powered by <span class="font-bold font-mono text-purple-400/80">solid.grpcfront</span>
          </div>
        </div>
      </Show>



    </main>
  );
}
