import { ssr, ssrHydrationKey, escape, createComponent } from "solid-js/web";
import { A } from "./components-DY6vXCQs.js";
import "solid-js";
import "../../entry-server.js";
import "pathe";
import "radix3";
import "seroval";
import "seroval-plugins/web";
import "@auth/solid-start/client";
import "h3";
import "solid-js/web/storage";
import "cookie-es";
var _tmpl$ = ["<svg", ' width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>'], _tmpl$2 = ["<main", ' class="relative min-h-screen"><div class="mesh-gradient"></div><div class="grain-overlay"></div><div class="relative z-10 mx-auto max-w-3xl 2xl:max-w-4xl px-4 sm:px-6 py-24"><div class="fade-in-up delay-1"><h1 class="text-5xl font-extrabold tracking-tight sm:text-6xl">About <span class="gradient-text">SolidFlow</span></h1></div><div class="fade-in-up delay-2 mt-8 space-y-6 text-base text-[#8b8b9e] leading-relaxed"><p>SolidFlow is a modern full-stack application template built with SolidJS and SolidStart. It combines fine-grained reactivity with server-side rendering, real-time data capabilities, and a premium dark-mode interface.</p><p>Powered by Vite 7, Tailwind CSS 4, Connect-RPC, and Chart.js — everything is wired up and ready for production.</p></div><div class="fade-in-up delay-3 mt-10">', "</div></div></main>"];
const id$$ = "src/routes/about.tsx?pick=default&pick=$css";
function About() {
  return ssr(_tmpl$2, ssrHydrationKey(), escape(createComponent(A, {
    href: "/",
    "class": "btn-primary",
    get children() {
      return [ssr(_tmpl$, ssrHydrationKey()), "Back to Dashboard"];
    }
  })));
}
export {
  About as default,
  id$$
};
//# sourceMappingURL=about-Dcj2prDA.js.map
