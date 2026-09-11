import { ssr, ssrHydrationKey, escape, createComponent } from "solid-js/web";
import { A } from "./components-CudbSkEV.js";
import "solid-js";
import "../../entry-server.js";
import "pathe";
import "radix3";
import "seroval";
import "seroval-plugins/web";
import "h3";
import "solid-js/web/storage";
import "cookie-es";
var _tmpl$ = ["<svg", ' width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>'], _tmpl$2 = ["<main", ` class="relative min-h-screen"><div class="mesh-gradient"></div><div class="grain-overlay"></div><div class="relative z-10 mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-6 text-center"><div class="fade-in-up delay-1"><p class="text-8xl font-black gradient-text">404</p></div><div class="fade-in-up delay-2"><h1 class="mt-4 text-2xl font-bold text-white">Page not found</h1><p class="mt-2 text-[#8b8b9e]">The page you're looking for doesn't exist or has been moved.</p></div><div class="fade-in-up delay-3 mt-8">`, "</div></div></main>"];
const id$$ = "src/routes/[...404].tsx?pick=default&pick=$css";
function NotFound() {
  return ssr(_tmpl$2, ssrHydrationKey(), escape(createComponent(A, {
    href: "/",
    "class": "btn-primary",
    get children() {
      return [ssr(_tmpl$, ssrHydrationKey()), "Back to Dashboard"];
    }
  })));
}
export {
  NotFound as default,
  id$$
};
//# sourceMappingURL=_...404_-R2HCm90c.js.map
