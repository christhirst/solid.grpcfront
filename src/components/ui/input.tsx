import { JSX, splitProps } from "solid-js";

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {}

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, ["class"]);

  return (
    <input
      class={`flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-base text-white placeholder:text-zinc-500 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:border-purple-500/60 disabled:cursor-not-allowed disabled:opacity-50 ${local.class || ""}`}
      {...rest}
    />
  );
}
