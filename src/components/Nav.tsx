import { createSignal, createMemo, onMount, onCleanup, Show, For } from "solid-js";
import { isServer } from "solid-js/web";
import { signIn, signOut } from "@auth/solid-start/client";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

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

const publicLinks = ["/library", "/", "/about"];
const authenticatedLinks = [
  "/library",
  "/",
  "/dashboards",
  "/workflows",
  "/TrustedCA",
  "/connections",
  "/protos",
  "/database",
  "/requests",
  "/about",
];

const linkLabel = (path: string) => {
  switch (path) {
    case "/":
      return "Home";
    case "/library":
      return "Library";
    case "/dashboards":
      return "Dashboards";
    case "/workflows":
      return "Workflows";
    case "/TrustedCA":
      return "Trusted CAs";
    case "/connections":
      return "Connections";
    case "/protos":
      return "Protos";
    case "/database":
      return "Database";
    case "/requests":
      return "Requests";
    case "/about":
      return "About";
    default:
      return path.replace("/", "").charAt(0).toUpperCase() + path.replace("/", "").slice(1);
  }
};

export default function Nav() {
  // Do not serialize an anonymous SSR result: it briefly replaces an active
  // browser session after every native navigation. Keep this state client-only.
  const [session, setSession] = createSignal<any | null | undefined>(undefined);
  const [mobileOpen, setMobileOpen] = createSignal(false);
  const [dbStatus, setDbStatus] = createSignal<"checking" | "connected" | "disconnected">("checking");
  const [dbError, setDbError] = createSignal<string | null>(null);
  const [currentPath, setCurrentPath] = createSignal("");

  const checkDbHealth = async () => {
    if (isServer) return;
    try {
      const res = await fetch("/api/health");
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.status === "ok") {
        setDbStatus("connected");
        setDbError(null);
      } else {
        setDbStatus("disconnected");
        setDbError(json.error || json.message || "Database unreachable");
      }
    } catch (err: any) {
      setDbStatus("disconnected");
      setDbError(err?.message || "Health check failed");
    }
  };

  onMount(async () => {
    setCurrentPath(window.location.pathname);
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    onCleanup(() => window.removeEventListener("popstate", onPopState));

    setSession(await fetchSession());
    checkDbHealth();
    const interval = setInterval(checkDbHealth, 30000);
    onCleanup(() => clearInterval(interval));
  });

  const visibleLinks = createMemo(() => (session() ? authenticatedLinks : publicLinks));

  // Use a simpler active check that doesn't rely on useLocation to avoid router context issues
  const active = (path: string) => {
    return currentPath() === path
      ? "text-white bg-zinc-800/80 font-semibold shadow-sm"
      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50";
  };

  const activeMobile = (path: string) => {
    return currentPath() === path
      ? "text-purple-400 font-semibold"
      : "text-zinc-500 hover:text-zinc-300";
  };

  return (
    <>
    <nav class="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-xl">
      <div class="mx-auto flex max-w-7xl 2xl:max-w-[90rem] items-center justify-between px-4 sm:px-6 py-3.5">
        {/* Logo */}
        <a href="/" class="flex items-center gap-3 group shrink-0">
          <div class="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20 transition-transform group-hover:scale-105">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <span class="text-lg font-bold tracking-tight text-white">
            Solid<span class="gradient-text">Flow</span>
          </span>
        </a>

        {/* Desktop Navigation Links */}
        <ul class="hidden lg:flex items-center gap-1">
          <For each={visibleLinks()}>
            {(path) => (
              <li>
                <a
                  href={path}
                  rel="external"
                  class={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${active(path)}`}
                >
                  {linkLabel(path)}
                </a>
              </li>
            )}
          </For>
        </ul>

        {/* Right Corner (Status + Auth) */}
        <div class="flex items-center gap-3">
          <Show
            when={dbStatus() === "connected"}
            fallback={
              <Show
                when={dbStatus() === "disconnected"}
                fallback={
                  <Badge variant="secondary" class="gap-1.5 px-3 py-1 hidden sm:inline-flex text-zinc-400">
                    <span class="h-2 w-2 rounded-full bg-zinc-500 animate-pulse"></span>
                    <span>Checking DB</span>
                  </Badge>
                }
              >
                <Badge
                  variant="destructive"
                  class="gap-1.5 px-3 py-1 hidden sm:inline-flex cursor-pointer bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  title={dbError() || "SurrealDB is unreachable. Check SURREALDB_URL in .env"}
                  onClick={() => checkDbHealth()}
                >
                  <span class="relative flex h-2 w-2">
                    <span class="h-2 w-2 rounded-full bg-rose-500"></span>
                  </span>
                  <span>DB Disconnected</span>
                </Badge>
              </Show>
            }
          >
            <Badge variant="success" class="gap-1.5 px-3 py-1 hidden sm:inline-flex">
              <span class="relative flex h-2 w-2">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>Live</span>
            </Badge>
          </Show>

          <div class="hidden sm:block">
            <Show
              when={session() !== undefined}
              fallback={<div class="h-8 w-20" aria-label="Checking session" />}
            >
              <Show
                when={session()}
                fallback={
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => signIn("oidc", { callbackUrl: typeof window !== "undefined" ? window.location.href : "/" })}
                  >
                    Log In
                  </Button>
                }
              >
                <div class="flex items-center gap-2.5">
                  <Badge variant="secondary" class="font-mono text-sm text-zinc-300">
                    {session()?.user?.sub || "No Subject"}
                  </Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => signOut()}
                  >
                    Logout
                  </Button>
                </div>
              </Show>
            </Show>
          </div>

          {/* Mobile hamburger */}
          <button
            class="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen())}
            aria-label="Toggle menu"
          >
            <Show when={!mobileOpen()} fallback={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            }>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </Show>
          </button>
        </div>
      </div>

      {/* Mobile slide-out menu */}
      <Show when={mobileOpen()}>
        <div class="lg:hidden border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl">
          <div class="px-4 py-4 space-y-1">
            <For each={visibleLinks()}>
              {(path) => (
                <a
                  href={path}
                  rel="external"
                  onClick={() => setMobileOpen(false)}
                  class={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${active(path)}`}
                >
                  {linkLabel(path)}
                </a>
              )}
            </For>
            <div class="pt-3 mt-3 border-t border-zinc-800/60 sm:hidden">
              <Show
                when={session() !== undefined}
                fallback={<div class="h-8" aria-label="Checking session" />}
              >
                <Show
                  when={session()}
                  fallback={
                    <Button
                      variant="primary"
                      size="sm"
                      class="w-full justify-center"
                      onClick={() => signIn("oidc", { callbackUrl: typeof window !== "undefined" ? window.location.href : "/" })}
                    >
                      Log In
                    </Button>
                  }
                >
                  <div class="flex flex-col gap-2">
                    <Badge variant="secondary" class="font-mono text-sm text-zinc-300 justify-center">
                      {session()?.user?.sub || "No Subject"}
                    </Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      class="w-full justify-center"
                      onClick={() => signOut()}
                    >
                      Logout
                    </Button>
                  </div>
                </Show>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </nav>
      {/* Mobile bottom navigation - smartphones only */}
      <div class="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 sm:hidden">
        <div class="flex items-center justify-around py-2 px-2">
          <a
            href="/library"
            rel="external"
            class={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${activeMobile('/library')}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Library
          </a>
          <a
            href="/"
            rel="external"
            class={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${activeMobile('/')}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Home
          </a>
          <a
            href="/about"
            rel="external"
            class={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${activeMobile('/about')}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            About
          </a>
        </div>
      </div>
    </>
  );
}
