import { useLocation } from "@solidjs/router";
import { createResource, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { signIn, signOut } from "@auth/solid-start/client";

const fetchSession = async () => {
  if (isServer) return null;
  const res = await fetch("/api/auth/session");
  const session = await res.json();
  return Object.keys(session).length > 0 ? session : null;
};


export default function Nav() {
  const [session] = createResource(fetchSession);
  const location = useLocation();
  const active = (path: string) =>
    path === location.pathname
      ? "text-white"
      : "text-[#8b8b9e] hover:text-white";

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

        {/* Navigation Links */}
        <ul class="flex items-center gap-1">
          <li>
            <a
              href="/"
              class={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${active("/")}`}
            >
              Home
            </a>
          </li>
          <li>
            <a
              href="/dashboards"
              class={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${active("/dashboards")}`}
            >
              Dashboards
            </a>
          </li>
          <li>
            <a
              href="/workflows"
              class={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${active("/workflows")}`}
            >
              Workflows
            </a>
          </li>
          <li>
            <a
              href="/protos"
              class={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${active("/protos")}`}
            >
              Protos
            </a>
          </li>
          <li>
            <a
              href="/grpc"
              class={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${active("/grpc")}`}
            >
              gRPC Client
            </a>
          </li>
          <li>
            <a
              href="/about"
              class={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${active("/about")}`}
            >
              About
            </a>
          </li>
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
            {(s) => (
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <Show
                    when={s().user?.image}
                    fallback={
                      <div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-400">
                        {s().user?.name?.[0]?.toUpperCase() || "?"}
                      </div>
                    }
                  >
                    <img
                      src={s().user?.image}
                      alt="Profile"
                      class="h-8 w-8 rounded-full border border-[#1e1e2e]"
                    />
                  </Show>
                  <span class="text-sm font-medium text-white hidden sm:block">
                    {s().user?.name}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  class="rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-1.5 text-xs font-medium text-[#8b8b9e] transition-colors duration-200 hover:text-white"
                >
                  Logout
                </button>
              </div>
            )}
          </Show>
        </div>
      </div>
    </nav>
  );
}
