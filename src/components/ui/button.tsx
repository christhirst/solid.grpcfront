import { JSX, splitProps } from "solid-js";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["variant", "size", "class", "children"]);

  const variantClass = () => {
    switch (local.variant) {
      case "primary":
        return "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-500/20 border border-purple-500/30";
      case "secondary":
        return "bg-zinc-800 text-zinc-100 hover:bg-zinc-700/90 border border-zinc-700/60 shadow-sm";
      case "outline":
        return "border border-zinc-700/80 bg-transparent text-zinc-200 hover:bg-zinc-800/80 hover:text-white";
      case "ghost":
        return "text-zinc-400 hover:bg-zinc-800/60 hover:text-white";
      case "destructive":
        return "bg-red-600 text-white hover:bg-red-500 shadow-sm";
      case "default":
      default:
        return "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 shadow-sm font-semibold";
    }
  };

  const sizeClass = () => {
    switch (local.size) {
      case "sm":
        return "h-8 rounded-lg px-3 text-sm";
      case "lg":
        return "h-12 rounded-xl px-6 text-base";
      case "icon":
        return "h-9 w-9 p-0 rounded-lg flex items-center justify-center";
      case "default":
      default:
        return "h-10 rounded-lg px-4 py-2 text-sm font-medium";
    }
  };

  return (
    <button
      class={`inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 disabled:pointer-events-none disabled:opacity-50 select-none ${variantClass()} ${sizeClass()} ${local.class || ""}`}
      {...rest}
    >
      {local.children}
    </button>
  );
}
