import { createSignal, createMemo, createEffect, onMount, onCleanup, Show, For } from "solid-js";
import { isServer } from "solid-js/web";
import { signIn, signOut } from "@auth/solid-start/client";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { applyTheme, readStoredTheme, type ThemeMode } from "~/lib/theme";
import UserNamespaceSettings from "~/components/UserNamespaceSettings";

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

const configLinks = [
  { path: "/TrustedCA", label: "Trusted CAs" },
  { path: "/connections", label: "Connections" },
  { path: "/protos", label: "Protos" },
  { path: "/database", label: "Database" },
];

const publicNavLinks = ["/library", "/about"];

const linkLabel = (path: string) => {
  switch (path) {
    case "/library":
      return "Library";
    case "/dashboards":
      return "Dashboards";
    case "/workflows":
      return "Workflows";
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
  const [theme, setTheme] = createSignal<ThemeMode>("dark");
  const [dbStatus, setDbStatus] = createSignal<"checking" | "connected" | "disconnected">("checking");
  const [dbError, setDbError] = createSignal<string | null>(null);
  const [currentPath, setCurrentPath] = createSignal("");
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [namespace, setNamespace] = createSignal("");
  const [configOpen, setConfigOpen] = createSignal(false);
  const [mobileConfigOpen, setMobileConfigOpen] = createSignal(false);
  let configDropdownRef: HTMLLIElement | undefined;

  const isConfigActive = createMemo(() => configLinks.some((l) => currentPath() === l.path));

  createEffect(() => {
    if (isConfigActive()) setMobileConfigOpen(true);
  });

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
    const savedTheme = readStoredTheme();
    setTheme(savedTheme);
    applyTheme(savedTheme, false);
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    onCleanup(() => window.removeEventListener("popstate", onPopState));

    const onDocClick = (e: MouseEvent) => {
      if (configDropdownRef && !configDropdownRef.contains(e.target as Node)) {
        setConfigOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfigOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    });

    const openSettings = () => { if (session()) setSettingsOpen(true); };
    window.addEventListener("open-user-settings", openSettings);
    onCleanup(() => window.removeEventListener("open-user-settings", openSettings));

    setSession(await fetchSession());
    if (session()) {
      fetch("/api/user/profile").then((r) => r.json()).then((json) => {
        if (json.success) setNamespace(json.data.namespace || "");
      }).catch(() => {});
    }
    checkDbHealth();
    const interval = setInterval(checkDbHealth, 30000);
    onCleanup(() => clearInterval(interval));
  });

  const toggleTheme = () => {
    const nextTheme = theme() === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

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
        {/* Logo / Home */}
        <a href="/" class="flex items-center gap-3 group shrink-0" aria-label="Home">
          <div class="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20 transition-transform group-hover:scale-105">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          </div>
          <span class="text-lg font-bold tracking-tight text-white">
            Ho<span class="gradient-text">me</span>
          </span>
        </a>

        {/* Desktop Navigation Links */}
        <ul class="hidden lg:flex items-center gap-1">
          <Show
            when={session()}
            fallback={
              <For each={publicNavLinks}>
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
            }
          >
            <li>
              <a
                href="/library"
                rel="external"
                class={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${active("/library")}`}
              >
                Library
              </a>
            </li>
            <li>
              <a
                href="/dashboards"
                rel="external"
                class={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${active("/dashboards")}`}
              >
                Dashboards
              </a>
            </li>
            <li>
              <a
                href="/workflows"
                rel="external"
                class={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${active("/workflows")}`}
              >
                Workflows
              </a>
            </li>
            <li>
              <a
                href="/requests"
                rel="external"
                class={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${active("/requests")}`}
              >
                Requests
              </a>
            </li>
            {/* Config dropdown */}
            <li class="relative" ref={configDropdownRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfigOpen(!configOpen());
                }}
                class={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 inline-flex items-center gap-1.5 ${
                  isConfigActive() || configOpen()
                    ? "text-white bg-zinc-800/80 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
                aria-expanded={configOpen()}
                aria-haspopup="true"
              >
                <span>Config</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class={`transition-transform duration-200 ${configOpen() ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <Show when={configOpen()}>
                <div class="absolute left-0 top-full mt-1.5 w-44 rounded-xl border border-zinc-800/90 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-xl z-50">
                  <For each={configLinks}>
                    {(item) => (
                      <a
                        href={item.path}
                        rel="external"
                        onClick={() => setConfigOpen(false)}
                        class={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${active(item.path)}`}
                      >
                        {item.label}
                      </a>
                    )}
                  </For>
                </div>
              </Show>
            </li>
            <li>
              <a
                href="/about"
                rel="external"
                class={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${active("/about")}`}
              >
                About
              </a>
            </li>
          </Show>
        </ul>

        {/* Right Corner (Status + Auth) */}
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme() === "dark" ? "light" : "dark"} theme`}
            aria-pressed={theme() === "light"}
            title={`Switch to ${theme() === "dark" ? "light" : "dark"} theme`}
            class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-zinc-700/70 bg-zinc-900/70 px-2.5 text-zinc-200 shadow-sm backdrop-blur-md transition-colors hover:bg-zinc-800/80 hover:text-white sm:px-3"
          >
            <Show when={theme() === "dark"} fallback={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path></svg>
            }>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"></path></svg>
            </Show>
            <span class="hidden sm:inline text-xs font-medium">{theme() === "dark" ? "Light" : "Dark"}</span>
          </button>
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
                  variant="secondary"
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
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSettingsOpen(true)} aria-label="Open user settings" title="User settings · Namespace" class="max-w-40">
                    <span class="truncate">{namespace() ? `@${namespace()}` : session()?.user?.name || session()?.user?.sub || "User settings"}</span>
                  </Button>
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
            <Show
              when={session()}
              fallback={
                <For each={publicNavLinks}>
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
              }
            >
              <a
                href="/library"
                rel="external"
                onClick={() => setMobileOpen(false)}
                class={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${active("/library")}`}
              >
                Library
              </a>
              <a
                href="/dashboards"
                rel="external"
                onClick={() => setMobileOpen(false)}
                class={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${active("/dashboards")}`}
              >
                Dashboards
              </a>
              <a
                href="/workflows"
                rel="external"
                onClick={() => setMobileOpen(false)}
                class={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${active("/workflows")}`}
              >
                Workflows
              </a>
              <a
                href="/requests"
                rel="external"
                onClick={() => setMobileOpen(false)}
                class={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${active("/requests")}`}
              >
                Requests
              </a>
              {/* Mobile Config Accordion */}
              <div class="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-2 my-1">
                <button
                  type="button"
                  onClick={() => setMobileConfigOpen(!mobileConfigOpen())}
                  class="flex w-full items-center justify-between px-2 py-1.5 text-sm font-medium text-zinc-300 hover:text-white"
                >
                  <span class={isConfigActive() ? "text-purple-400 font-semibold" : ""}>Config</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class={`transition-transform duration-200 ${mobileConfigOpen() ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <Show when={mobileConfigOpen()}>
                  <div class="mt-1 space-y-1 pl-2 border-l border-zinc-800 ml-2">
                    <For each={configLinks}>
                      {(item) => (
                        <a
                          href={item.path}
                          rel="external"
                          onClick={() => {
                            setMobileOpen(false);
                            setMobileConfigOpen(false);
                          }}
                          class={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${active(item.path)}`}
                        >
                          {item.label}
                        </a>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              <a
                href="/about"
                rel="external"
                onClick={() => setMobileOpen(false)}
                class={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${active("/about")}`}
              >
                About
              </a>
            </Show>
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
                    <Button type="button" variant="secondary" onClick={() => setSettingsOpen(true)} aria-label="Open user settings">
                      {namespace() ? `@${namespace()}` : session()?.user?.name || session()?.user?.sub || "User settings"}
                    </Button>
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
      <Show when={settingsOpen()}>
        <UserNamespaceSettings onClose={() => setSettingsOpen(false)} onSaved={setNamespace} />
      </Show>
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
