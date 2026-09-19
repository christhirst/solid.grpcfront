import { ssr, ssrHydrationKey, escape, createComponent, ssrAttribute } from "solid-js/web";
import { onMount, createEffect, onCleanup, For, Show } from "solid-js";
import "gridstack";
var _tmpl$ = ["<div", ' class="', '">', "</div>"], _tmpl$2 = ["<div", ' class="grid-stack-drag-handle flex items-center justify-between px-3 py-1.5 bg-[#181824] border-b border-[#2a2a3a] text-xs text-[#8b8b9e] select-none shrink-0"><div class="flex items-center gap-2 font-medium truncate"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-purple-400"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg><span class="text-white font-semibold truncate">', '</span><span class="text-[10px] text-[#5b5b6e] font-mono shrink-0">(<!--$-->', "<!--/-->×<!--$-->", '<!--/-->)</span></div><span class="text-[10px] uppercase font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded shrink-0">', "</span></div>"], _tmpl$3 = ["<div", ' class="grid-stack-item"', '><div class="grid-stack-item-content"><!--$-->', '<!--/--><div class="p-2 sm:p-2.5 flex-1 flex flex-col justify-center overflow-hidden">', "</div></div></div>"];
function getDefaultWidgetDimensions(widgetType) {
  switch (widgetType) {
    case "table":
      return {
        w: 12,
        h: 5,
        minW: 4,
        minH: 3
      };
    case "chart":
      return {
        w: 6,
        h: 4,
        minW: 3,
        minH: 3
      };
    case "form":
      return {
        w: 6,
        h: 4,
        minW: 3,
        minH: 2
      };
    case "news":
      return {
        w: 6,
        h: 3,
        minW: 3,
        minH: 2
      };
    case "toggle":
      return {
        w: 3,
        h: 1,
        minW: 1,
        minH: 1
      };
    case "infographic":
      return {
        w: 12,
        h: 5,
        minW: 4,
        minH: 3
      };
    case "button":
    default:
      return {
        w: 3,
        h: 1,
        minW: 1,
        minH: 1
      };
  }
}
function DashboardGrid(props) {
  onMount(() => {
  });
  createEffect(() => {
    props.isStatic;
    props.dashboardId;
  });
  onCleanup(() => {
  });
  return ssr(_tmpl$, ssrHydrationKey(), `grid-stack w-full ${escape(props.class, true) || ""}`, escape(createComponent(For, {
    get each() {
      return props.buttons || [];
    },
    children: (btn) => {
      const dims = getDefaultWidgetDimensions(btn.widgetType);
      const w = () => typeof btn.w === "number" ? btn.w : dims.w;
      const h = () => typeof btn.h === "number" ? btn.h : dims.h;
      const minW = () => {
        if (btn.widgetType === "button" || btn.widgetType === "toggle" || !btn.widgetType) return 1;
        return typeof btn.minW === "number" ? Math.min(btn.minW, dims.minW) : dims.minW;
      };
      const minH = () => {
        if (btn.widgetType === "button" || btn.widgetType === "toggle" || !btn.widgetType) return 1;
        return typeof btn.minH === "number" ? Math.min(btn.minH, dims.minH) : dims.minH;
      };
      return ssr(_tmpl$3, ssrHydrationKey(), ssrAttribute("gs-id", escape(btn.id, true), false) + ssrAttribute("gs-x", typeof btn.x === "number" ? escape(btn.x, true) : escape(void 0, true), false) + ssrAttribute("gs-y", typeof btn.y === "number" ? escape(btn.y, true) : escape(void 0, true), false) + ssrAttribute("gs-w", escape(w(), true), false) + ssrAttribute("gs-h", escape(h(), true), false) + ssrAttribute("gs-min-w", escape(minW(), true), false) + ssrAttribute("gs-min-h", escape(minH(), true), false), escape(createComponent(Show, {
        get when() {
          return !props.isStatic;
        },
        get children() {
          return ssr(_tmpl$2, ssrHydrationKey(), escape(btn.label) || "Widget", escape(w()), escape(h()), escape(btn.widgetType) || "button");
        }
      })), escape(props.renderWidget(btn)));
    }
  })));
}
export {
  DashboardGrid as D,
  getDefaultWidgetDimensions as g
};
//# sourceMappingURL=DashboardGrid-B4n-WQG5.js.map
