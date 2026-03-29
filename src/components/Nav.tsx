import { useLocation } from "@solidjs/router";

export default function Nav() {
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
              Dashboard
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

        {/* Status indicator */}
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 rounded-full bg-[#10b981]/10 px-3 py-1.5">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span class="text-xs font-medium text-emerald-400">Live</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
