import { createMemo, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";
import get from "lodash.get";
import { getTimelineThemeColors, subscribeToThemeChanges } from "~/lib/theme";
import { normalizeDataArray } from "./dataHelpers";

const TIMELINE_IMPORTANCE_COLOR: Record<number, string> = {
  1: "#4a5273",
  2: "#2dd4bf",
  3: "#6c63ff",
  4: "#f59e0b",
  5: "#f472b6",
};

export interface DashTimelineProps {
  data: any[];
  xKey?: string;
  yKey?: string;
  height?: string;
}

export function DashTimeline(props: DashTimelineProps) {
  let vpRef!: HTMLDivElement;
  let canvasRef!: HTMLDivElement;

  const rows = createMemo(() => normalizeDataArray(props.data));
  const events = createMemo(() =>
    rows().map((row, i) => {
      const xk = props.xKey || "year";
      const yk = props.yKey || "header";
      const rawYear = row && typeof row === "object" ? get(row, xk) : row;
      const header = row && typeof row === "object" ? get(row, yk) : String(row);
      const text = row && typeof row === "object" ? get(row, "text") || get(row, "description") || "" : "";
      const imp = row && typeof row === "object" ? Number(get(row, "importance") || get(row, "rating") || 3) : 3;
      const link = row && typeof row === "object" ? get(row, "link") || get(row, "url") || "" : "";
      const date = row && typeof row === "object" ? get(row, "date") || String(rawYear) : String(rawYear);
      const year = Number(rawYear) || i;
      return {
        year,
        header: String(header || "Event"),
        text: String(text),
        importance: Math.min(5, Math.max(1, imp)),
        link: String(link),
        date: String(date),
      };
    })
  );

  let scale = 1;
  let offsetX = 0;
  const BASE_PX = 80;
  const AXIS_Y = 140;

  const yearToX = (y: number) => y * BASE_PX;

  const applyTransform = () => {
    if (!canvasRef) return;
    canvasRef.style.transform = `scale(${scale}) translate(${offsetX}px,0)`;
  };

  const render = () => {
    if (isServer || !canvasRef || !vpRef) return;
    const themeColors = getTimelineThemeColors();
    while (canvasRef.children.length > 1) canvasRef.removeChild(canvasRef.lastChild!);

    const evs = events();
    if (!evs.length) return;

    const years = evs.map((e) => e.year);
    const minY = Math.min(...years);
    const maxY = Math.max(...years);
    const pad = 200;
    const canvasL = yearToX(minY) - pad;
    const canvasR = yearToX(maxY) + pad;
    const canvasW = Math.max(canvasR - canvasL, 600);

    canvasRef.style.width = canvasW + "px";
    canvasRef.style.height = vpRef.clientHeight + "px";

    const axis = canvasRef.querySelector(".tl-axis") as HTMLElement;
    if (axis) {
      axis.style.top = AXIS_Y + "px";
      axis.style.width = canvasW + "px";
    }

    const cx = (year: number) => yearToX(year) - canvasL;

    const range = maxY - minY;
    const interval = range > 2000 ? 500 : range > 500 ? 100 : range > 100 ? 50 : 10;
    for (let y = Math.floor(minY / interval) * interval - interval; y <= maxY + interval; y += interval) {
      const tick = document.createElement("div");
      tick.className = "tl-tick";
      tick.style.cssText = `position:absolute;left:${cx(y)}px;top:${AXIS_Y - 10}px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none;`;
      tick.innerHTML = `<div style="width:1px;height:10px;background:${themeColors.tick}"></div><div style="font-size:9px;color:${themeColors.hint};margin-top:2px;white-space:nowrap">${y < 0 ? Math.abs(y) + " BCE" : y === 0 ? "0" : y + " CE"}</div>`;
      canvasRef.appendChild(tick);
    }

    const sorted = [...evs].sort((a, b) => a.year - b.year);
    sorted.forEach((ev, i) => {
      const above = i % 2 === 0;
      const x = cx(ev.year);
      const color = TIMELINE_IMPORTANCE_COLOR[ev.importance] || "#6c63ff";
      const stemH = ev.importance * 20 + 20;
      const node = document.createElement("div");
      node.style.cssText = `position:absolute;left:${x}px;${above ? `bottom:${vpRef.clientHeight - AXIS_Y}px` : `top:${AXIS_Y}px`};transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;cursor:pointer;`;

      const stemEl = document.createElement("div");
      stemEl.style.cssText = `width:2px;height:${stemH}px;background:linear-gradient(${above ? "to top" : "to bottom"},${color},transparent);flex-shrink:0;order:${above ? 0 : 1}`;

      const dot = document.createElement("div");
      dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};flex-shrink:0;order:${above ? 1 : 2};transition:transform 0.15s`;

      const label = document.createElement("div");
      label.style.cssText = `position:absolute;${above ? `bottom:${stemH + 12}px` : `top:${stemH + 12}px`};left:50%;transform:translateX(-50%);background:${themeColors.panel};border:1px solid ${themeColors.border};border-radius:8px;padding:6px 10px;width:160px;font-size:10px;color:${themeColors.text};pointer-events:none;opacity:0;transition:opacity 0.2s;z-index:10;box-shadow:0 4px 16px rgba(0,0,0,0.18);`;
      label.innerHTML = `<div style="font-size:9px;font-weight:700;color:${color};margin-bottom:3px">${ev.date}</div><div style="font-weight:600;margin-bottom:4px;line-height:1.3">${ev.header}</div>${ev.text ? `<div style="font-size:9px;color:${themeColors.muted};line-height:1.5;margin-bottom:4px">${ev.text.slice(0, 120)}${ev.text.length > 120 ? "…" : ""}</div>` : ""}${ev.link ? `<a href="${ev.link}" target="_blank" style="font-size:9px;color:#a78bfa;text-decoration:none">→ Link</a>` : ""}`;

      node.addEventListener("mouseenter", () => {
        dot.style.transform = "scale(1.6)";
        label.style.opacity = "1";
      });
      node.addEventListener("mouseleave", () => {
        dot.style.transform = "scale(1)";
        label.style.opacity = "0";
      });

      node.appendChild(above ? stemEl : dot);
      node.appendChild(above ? dot : stemEl);
      node.appendChild(label);
      canvasRef.appendChild(node);
    });

    applyTransform();
  };

  onMount(() => {
    if (isServer) return;
    const evs = events();
    if (vpRef && evs.length) {
      const years = evs.map((e) => e.year);
      const minY = Math.min(...years);
      const maxY = Math.max(...years);
      const canvasL = yearToX(minY) - 200;
      const mid = yearToX((minY + maxY) / 2) - canvasL;
      offsetX = vpRef.clientWidth / (2 * scale) - mid;
    }
    render();

    const unsubscribeTheme = subscribeToThemeChanges(render);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.min(8, Math.max(0.05, scale * factor));
      const pivot = (e.clientX - vpRef.getBoundingClientRect().left) / scale - offsetX;
      scale = newScale;
      offsetX = (e.clientX - vpRef.getBoundingClientRect().left) / scale - pivot;
      render();
    };

    let panning = false;
    let panStart = 0;
    let panOX = 0;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      panning = true;
      panStart = e.clientX;
      panOX = offsetX;
      vpRef.style.cursor = "grabbing";
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!panning) return;
      offsetX = panOX + (e.clientX - panStart) / scale;
      applyTransform();
    };
    const onMouseUp = () => {
      panning = false;
      if (vpRef) vpRef.style.cursor = "grab";
    };

    vpRef.addEventListener("wheel", onWheel, { passive: false });
    vpRef.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    onCleanup(() => {
      unsubscribeTheme();
      vpRef?.removeEventListener("wheel", onWheel);
      vpRef?.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    });
  });

  return (
    <div
      style={`position:relative;height:${props.height || "300px"};background:var(--theme-chart-canvas);border-radius:10px;overflow:hidden;border:1px solid var(--theme-timeline-border)`}
    >
      <div ref={vpRef} style="width:100%;height:100%;overflow:hidden;cursor:grab;position:relative">
        <div ref={canvasRef} class="tl-canvas" style="position:absolute;transform-origin:0 0">
          <div
            class="tl-axis"
            style="position:absolute;left:0;height:2px;background:linear-gradient(90deg,transparent,#6c63ff 5%,#6c63ff 95%,transparent);box-shadow:0 0 12px rgba(108,99,255,0.4)"
          ></div>
        </div>
      </div>
      <div style="position:absolute;bottom:6px;right:10px;font-size:9px;color:var(--theme-timeline-hint);pointer-events:none">
        Scroll to zoom · Drag to pan
      </div>
    </div>
  );
}

export default DashTimeline;
