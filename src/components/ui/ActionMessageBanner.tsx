import { Show, splitProps, JSX } from "solid-js";

export interface ActionMessage {
  type: "success" | "error";
  text: string;
}

export interface ActionMessageBannerProps extends JSX.HTMLAttributes<HTMLDivElement> {
  message: ActionMessage | null;
  onClose?: () => void;
}

export function ActionMessageBanner(props: ActionMessageBannerProps) {
  const [local, rest] = splitProps(props, ["message", "onClose", "class"]);

  return (
    <Show when={local.message}>
      {(msg) => (
        <div
          role="status"
          class={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-all duration-200 animate-in fade-in slide-in-from-top-1 ${
            msg().type === "error"
              ? "bg-red-500/10 border-red-500/30 text-red-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          } ${local.class || "mb-6"}`}
          {...rest}
        >
          <span class="flex items-center gap-1.5">
            <span>{msg().type === "error" ? "⚠️" : "✓"}</span>
            <span>{msg().text}</span>
          </span>
          <button
            type="button"
            onClick={() => local.onClose?.()}
            class="text-[11px] opacity-70 hover:opacity-100 ml-3 transition-opacity cursor-pointer p-0.5"
            title="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}
    </Show>
  );
}
