import { JSX, splitProps } from "solid-js";

export function TabsList(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div
      class={`inline-flex items-center justify-center rounded-xl bg-zinc-900/80 p-1 border border-zinc-800 text-zinc-400 ${local.class || ""}`}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export interface TabsTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function TabsTrigger(props: TabsTriggerProps) {
  const [local, rest] = splitProps(props, ["active", "class", "children"]);
  return (
    <button
      type="button"
      class={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50 select-none ${
        local.active
          ? "bg-purple-600 text-white shadow-sm shadow-purple-500/20"
          : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
      } ${local.class || ""}`}
      {...rest}
    >
      {local.children}
    </button>
  );
}
