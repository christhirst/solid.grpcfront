import { ssrElement, mergeProps, escape } from "solid-js/web";
import { splitProps } from "solid-js";
function Card(props) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return ssrElement("div", mergeProps({
    get ["class"]() {
      return `rounded-2xl border border-zinc-800/80 bg-zinc-950/75 text-zinc-100 shadow-xl backdrop-blur-xl transition-all duration-200 ${local.class || ""}`;
    }
  }, rest), () => escape(local.children), true);
}
function CardHeader(props) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return ssrElement("div", mergeProps({
    get ["class"]() {
      return `flex flex-col space-y-1.5 p-6 ${local.class || ""}`;
    }
  }, rest), () => escape(local.children), true);
}
function CardTitle(props) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return ssrElement("h3", mergeProps({
    get ["class"]() {
      return `font-bold tracking-tight text-white ${local.class || ""}`;
    }
  }, rest), () => escape(local.children), true);
}
function CardDescription(props) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return ssrElement("p", mergeProps({
    get ["class"]() {
      return `text-xs text-zinc-400 leading-relaxed ${local.class || ""}`;
    }
  }, rest), () => escape(local.children), true);
}
function CardContent(props) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return ssrElement("div", mergeProps({
    get ["class"]() {
      return `p-6 pt-0 ${local.class || ""}`;
    }
  }, rest), () => escape(local.children), true);
}
function CardFooter(props) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return ssrElement("div", mergeProps({
    get ["class"]() {
      return `flex items-center p-6 pt-0 ${local.class || ""}`;
    }
  }, rest), () => escape(local.children), true);
}
function Input(props) {
  const [local, rest] = splitProps(props, ["class"]);
  return ssrElement("input", mergeProps({
    get ["class"]() {
      return `flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:border-purple-500/60 disabled:cursor-not-allowed disabled:opacity-50 ${local.class || ""}`;
    }
  }, rest), void 0, true);
}
export {
  Card as C,
  Input as I,
  CardHeader as a,
  CardTitle as b,
  CardDescription as c,
  CardContent as d,
  CardFooter as e
};
//# sourceMappingURL=input-_8DYE3Q5.js.map
