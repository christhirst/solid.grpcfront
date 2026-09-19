import { JSX, splitProps } from "solid-js";

export function Card(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div
      class={`rounded-2xl border border-zinc-800/80 bg-zinc-950/75 text-zinc-100 shadow-xl backdrop-blur-xl transition-all duration-200 ${local.class || ""}`}
      {...rest}
    >
      {local.children}
    </div>
  );
}

export function CardHeader(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div class={`flex flex-col space-y-1.5 p-6 ${local.class || ""}`} {...rest}>
      {local.children}
    </div>
  );
}

export function CardTitle(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <h3 class={`font-bold tracking-tight text-white ${local.class || ""}`} {...rest}>
      {local.children}
    </h3>
  );
}

export function CardDescription(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <p class={`text-sm text-zinc-400 leading-relaxed ${local.class || ""}`} {...rest}>
      {local.children}
    </p>
  );
}

export function CardContent(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div class={`p-6 pt-0 ${local.class || ""}`} {...rest}>
      {local.children}
    </div>
  );
}

export function CardFooter(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <div class={`flex items-center p-6 pt-0 ${local.class || ""}`} {...rest}>
      {local.children}
    </div>
  );
}
