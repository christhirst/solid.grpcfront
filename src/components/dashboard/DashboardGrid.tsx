import { onMount, onCleanup, For, Show, JSX, createEffect } from "solid-js";
import { isServer } from "solid-js/web";
import type { GridStack as GridStackType } from "gridstack";

export function getDefaultWidgetDimensions(widgetType?: string) {
  switch (widgetType) {
    case "table":
      return { w: 12, h: 5, minW: 4, minH: 3 };
    case "chart":
      return { w: 6, h: 4, minW: 3, minH: 3 };
    case "form":
      return { w: 6, h: 4, minW: 3, minH: 2 };
    case "news":
      return { w: 6, h: 3, minW: 3, minH: 2 };
    case "toggle":
      return { w: 3, h: 1, minW: 1, minH: 1 };
    case "infographic":
      return { w: 12, h: 5, minW: 4, minH: 3 };
    case "button":
    default:
      return { w: 3, h: 1, minW: 1, minH: 1 };
  }
}

export interface DashboardGridProps {
  buttons: any[];
  isStatic: boolean;
  dashboardId?: string;
  onLayoutChange?: (layout: Array<{ id: string; x: number; y: number; w: number; h: number }>) => void;
  renderWidget: (btn: any) => JSX.Element;
  class?: string;
}

export default function DashboardGrid(props: DashboardGridProps) {
  let containerRef!: HTMLDivElement;
  let gridInstance: any = null;

  const initGrid = async () => {
    if (isServer || !containerRef) return;
    const { GridStack } = await import("gridstack");
    if (!containerRef) return;
    if (gridInstance) {
      try {
        gridInstance.destroy(false);
      } catch {}
      gridInstance = null;
    }

    gridInstance = GridStack.init(
      {
        column: 12,
        cellHeight: 70,
        margin: 10,
        columnOpts: {
          breakpoints: [
            { w: 640, c: 1 },
            { w: 768, c: 4 },
            { w: 1024, c: 6 },
            { w: Infinity, c: 12 }
          ]
        },
        animate: true,
        float: true,
        staticGrid: props.isStatic,
        handle: props.isStatic ? undefined : ".grid-stack-drag-handle",
        resizable: {
          handles: props.isStatic ? "" : "all",
        },
      },
      containerRef
    );

    gridInstance.on("resizestop", () => {
      window.dispatchEvent(new Event("resize"));
    });

    if (!props.isStatic && props.onLayoutChange) {
      const handleLayoutChange = () => {
        if (!gridInstance || !props.onLayoutChange) return;
        const current = gridInstance.save(false);
        const mapped = (current || []).map((node: any) => ({
          id: node.id,
          x: node.x,
          y: node.y,
          w: node.w,
          h: node.h,
        }));
        props.onLayoutChange(mapped);
      };

      gridInstance.on("change", handleLayoutChange);
      gridInstance.on("dragstop", handleLayoutChange);
      gridInstance.on("resizestop", handleLayoutChange);
    }
  };

  onMount(() => {
    initGrid();
  });

  // Reinitialize if static mode changes
  createEffect(() => {
    const _static = props.isStatic;
    const _dashId = props.dashboardId;
    if (!isServer && containerRef) {
      // Small timeout to allow Solid's DOM reconciliation before GridStack indexes items
      setTimeout(() => {
        initGrid();
      }, 20);
    }
  });

  onCleanup(() => {
    if (gridInstance) {
      try {
        gridInstance.destroy(false);
      } catch {}
      gridInstance = null;
    }
  });

  return (
    <div class={`grid-stack w-full ${props.class || ""}`} ref={containerRef}>
      <For each={props.buttons || []}>
        {(btn) => {
          const dims = getDefaultWidgetDimensions(btn.widgetType);
          const w = () => (typeof btn.w === "number" ? btn.w : dims.w);
          const h = () => (typeof btn.h === "number" ? btn.h : dims.h);
          const minW = () => {
            if (btn.widgetType === "button" || btn.widgetType === "toggle" || !btn.widgetType) return 1;
            return typeof btn.minW === "number" ? Math.min(btn.minW, dims.minW) : dims.minW;
          };
          const minH = () => {
            if (btn.widgetType === "button" || btn.widgetType === "toggle" || !btn.widgetType) return 1;
            return typeof btn.minH === "number" ? Math.min(btn.minH, dims.minH) : dims.minH;
          };

          return (
            <div
              class="grid-stack-item"
              gs-id={btn.id}
              gs-x={typeof btn.x === "number" ? btn.x : undefined}
              gs-y={typeof btn.y === "number" ? btn.y : undefined}
              gs-w={w()}
              gs-h={h()}
              gs-min-w={minW()}
              gs-min-h={minH()}
            >
              <div class="grid-stack-item-content">
                <Show when={!props.isStatic}>
                  <div class="grid-stack-drag-handle flex items-center justify-between px-3 py-1.5 bg-[#181824] border-b border-[#2a2a3a] text-xs text-[#8b8b9e] select-none shrink-0">
                    <div class="flex items-center gap-2 font-medium truncate">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-purple-400">
                        <circle cx="9" cy="12" r="1"></circle>
                        <circle cx="9" cy="5" r="1"></circle>
                        <circle cx="9" cy="19" r="1"></circle>
                        <circle cx="15" cy="12" r="1"></circle>
                        <circle cx="15" cy="5" r="1"></circle>
                        <circle cx="15" cy="19" r="1"></circle>
                      </svg>
                      <span class="text-white font-semibold truncate">{btn.label || "Widget"}</span>
                      <span class="text-[10px] text-[#5b5b6e] font-mono shrink-0">
                        ({w()}×{h()})
                      </span>
                    </div>
                    <span class="text-[10px] uppercase font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded shrink-0">
                      {btn.widgetType || "button"}
                    </span>
                  </div>
                </Show>

                <div class="p-2 sm:p-2.5 flex-1 flex flex-col justify-center overflow-hidden">
                  {props.renderWidget(btn)}
                </div>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
