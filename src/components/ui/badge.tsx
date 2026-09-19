import { JSX, splitProps } from "solid-js";

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "purple" | "blue" | "amber";
}

export function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ["variant", "class", "children"]);

  const variantClass = () => {
    switch (local.variant) {
      case "secondary":
        return "border-zinc-800 bg-zinc-800 text-zinc-300";
      case "outline":
        return "border-zinc-700/80 bg-transparent text-zinc-300";
      case "success":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
      case "purple":
        return "border-purple-500/30 bg-purple-500/15 text-purple-300";
      case "blue":
        return "border-blue-500/30 bg-blue-500/10 text-blue-300";
      case "amber":
        return "border-amber-500/30 bg-amber-500/10 text-amber-300";
      case "default":
      default:
        return "border-transparent bg-zinc-100 text-zinc-900";
    }
  };

  return (
    <span
      class={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors ${variantClass()} ${local.class || ""}`}
      {...rest}
    >
      {local.children}
    </span>
  );
}
