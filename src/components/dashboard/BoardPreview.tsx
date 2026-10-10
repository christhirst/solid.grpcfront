import { For, Show, createResource, onMount } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import PublicDashboardView, { loadWorkflowMap } from "~/components/dashboard/PublicDashboardView";
import BoardNavBar from "~/components/dashboard/BoardNavBar";
import { dashboardId, formatDate, type DashboardSummary } from "~/lib/dashboard/boardTypes";
import type { Slideshow } from "~/lib/dashboard/useSlideshow";

/** Live, read-only render of a board's widgets (charts/tables evaluated like the public view). */
export function BoardLive(props: { dash: DashboardSummary }) {
  const [workflowMap] = createResource(
    () => props.dash.id,
    () => loadWorkflowMap(props.dash.buttons || [])
  );

  return (
    <div class="rounded-xl border border-zinc-800/80 bg-[#050508] p-3 sm:p-5">
      <Show
        when={(props.dash.buttons || []).length > 0}
        fallback={
          <div class="py-16 text-center text-sm italic text-zinc-500">
            This dashboard has no widgets configured yet.
          </div>
        }
      >
        <Show
          when={!workflowMap.loading}
          fallback={
            <div class="space-y-2 py-4">
              <div class="h-6 animate-pulse rounded bg-[#1e1e2e]"></div>
              <div class="h-6 w-4/5 animate-pulse rounded bg-[#1e1e2e]"></div>
              <div class="h-6 w-3/5 animate-pulse rounded bg-[#1e1e2e]"></div>
            </div>
          }
        >
          <PublicDashboardView
            dashboardId={dashboardId(props.dash.id)}
            buttons={props.dash.buttons || []}
            workflowMap={workflowMap() || {}}
            readOnly={true}
          />
        </Show>
      </Show>
    </div>
  );
}

export interface BoardPreviewProps {
  dash: DashboardSummary;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  slideshow: Slideshow;
}

/** Desktop detail pane: public-style header (title, description, tags) + live widgets. */
export default function BoardPreview(props: BoardPreviewProps) {
  let rootRef!: HTMLDivElement;

  // The pane is remounted per board; bring its header into view if the user had scrolled past it.
  onMount(() => {
    if (rootRef && rootRef.getBoundingClientRect().top < 0) {
      rootRef.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  return (
    <Card ref={rootRef} class="scroll-mt-20 overflow-hidden border-purple-500/30 bg-zinc-950/80 shadow-2xl">
      <div class="relative border-b border-zinc-800 p-6 lg:p-8">
        <div class="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>

        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="success">Published</Badge>
          <span class="text-xs text-zinc-500">
            Updated {formatDate(props.dash.updated_at || props.dash.created_at)} • {props.dash.buttons?.length || 0} widgets
          </span>
          <a
            href={`/p/${dashboardId(props.dash.id)}`}
            target="_blank"
            class="ml-auto flex items-center gap-1.5 text-sm font-semibold text-purple-400 transition-colors hover:text-purple-300"
          >
            <span>Open Public View</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </div>

        <h2 class="mt-3 text-3xl font-extrabold tracking-tight text-white xl:text-4xl">
          {props.dash.name || "Untitled Dashboard"}
        </h2>

        <Show when={props.dash.description}>
          <p class="mt-2 max-w-3xl text-base leading-relaxed text-zinc-400">{props.dash.description}</p>
        </Show>

        <Show when={props.dash.tags && props.dash.tags.length > 0}>
          <div class="mt-3 flex flex-wrap gap-1.5">
            <For each={props.dash.tags}>{(tag) => <Badge variant="purple">{tag}</Badge>}</For>
          </div>
        </Show>

        <div class="mt-5">
          <BoardNavBar
            index={props.index}
            total={props.total}
            onPrev={props.onPrev}
            onNext={props.onNext}
            slideshow={props.slideshow}
          />
        </div>
      </div>

      <div class="p-4 lg:p-6">
        <BoardLive dash={props.dash} />
      </div>
    </Card>
  );
}
