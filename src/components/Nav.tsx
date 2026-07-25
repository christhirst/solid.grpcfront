import { createSignal, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { signIn, signOut } from "@auth/solid-start/client";

const fetchSession = async () => {
  try {
    const res = await fetch("/api/auth/session");
    if (!res.ok) return null;
    const session = await res.json();
    return session && typeof session === "object" && Object.keys(session).length > 0 ? session : null;
  } catch (e) {
    return null;
  }
};


export default function Nav() {
  // Do not serialize an anonymous SSR result: it briefly replaces an active
  // browser session after every native navigation. Keep this state client-only.
  const [session, setSession] = createSignal<any | null | undefined>(undefined);

  onMount(async () => {
    setSession(await fetchSession());
  });
  
  // Use a simpler active check that doesn't rely on useLocation to avoid router context issues
  const active = (path: string) => {
    if (isServer) return "text-[#8b8b9e]";
    return window.location.pathname === path
      ? "text-white"
      : "text-[#8b8b9e] hover:text-white";
  }

  return (
    <nav class="sticky top-0 z-50 border-b border-[#1e1e2e] bg-[#0a0a0f]/90 backdrop-blur-xl">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <a href="/" class="flex items-center gap-3 group">
          <div class="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <span class="text-lg font-bold tracking-tight text-white">
            Solid<span class="gradient-text">Flow</span>
          </span>
        </a>

        {/* Navigation Links - Using explicit native navigation to bypass router interception */}
        <ul class="flex items-center gap-1">
          {["/", "/dashboards", "/workflows", "/TrustedCA", "/connections", "/protos", "/database", "/requests", "/about"].map((path) => (
            <li>
              <a
                href={path}
                rel="external"
                class={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${active(path)}`}
              >
                {path === "/" ? "Home" : path === "/TrustedCA" ? "Trusted CAs" : path.replace("/", "").charAt(0).toUpperCase() + path.replace("/", "").slice(1)}
              </a>
            </li>
          ))}
        </ul>

        {/* Right Corner (Status + Auth) */}
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 rounded-full bg-[#10b981]/10 px-3 py-1.5">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span class="text-xs font-medium text-emerald-400">Live</span>
          </div>

          <Show
            when={session() !== undefined}
            fallback={<div class="h-9 w-20" aria-label="Checking session" />}
          >
            <Show
              when={session()}
              fallback={
                <button
                  onClick={() => signIn("oidc")}
                  class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700"
                >
                  Log In
                </button>
              }
            >
              <div class="flex items-center gap-3">
                <span class="text-sm font-mono text-[#8b8b9e] bg-[#1e1e2e]/50 px-2 py-1 rounded">
                  {session()?.user?.sub || "No Subject"}
                </span>
                <button
                  onClick={() => signOut()}
                  class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700"
                >
                  Logout
                </button>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </nav>
  );
}
