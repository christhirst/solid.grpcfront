import { onMount, createEffect } from "solid-js";
import { isServer } from "solid-js/web";

export interface InfographicWidgetProps {
  syntax?: string;
  data?: any;
  editable?: boolean;
  height?: string;
}

export default function InfographicWidget(props: InfographicWidgetProps) {
  let containerRef!: HTMLDivElement;
  let instance: any = null;

  const getSyntax = () => {
    // Prefer explicit syntax prop; if data is a string, treat it as syntax
    if (props.syntax) return props.syntax;
    if (typeof props.data === "string") return props.data;
    return "";
  };

  onMount(async () => {
    if (isServer) return;
    try {
      const mod = await import("@antv/infographic");
      const Infographic = mod.Infographic || (mod as any).default;
      instance = new Infographic({
        container: containerRef,
        width: "100%",
        height: props.height || "400px",
        editable: props.editable || false,
      });
      const syntax = getSyntax();
      if (syntax) instance.render(syntax);
    } catch (e) {
      console.error("[InfographicWidget] Failed to load @antv/infographic:", e);
      if (containerRef) {
        containerRef.innerHTML = `<div style="padding:16px;color:#f87171;font-size:12px;border:1px solid rgba(248,113,113,0.2);border-radius:8px;background:rgba(248,113,113,0.05)">Failed to load infographic engine: ${String(e)}</div>`;
      }
    }
  });

  createEffect(() => {
    const syntax = getSyntax();
    if (instance && syntax) {
      try {
        instance.render(syntax);
      } catch (e) {
        console.error("[InfographicWidget] Render error:", e);
      }
    }
  });

  return (
    <div
      class="w-full rounded-xl border border-[#2a2a3a] bg-[#0d0f17] overflow-hidden"
      style={`min-height:${props.height || "300px"}`}
    >
      <div ref={containerRef} style="width:100%;min-height:inherit" />
    </div>
  );
}
