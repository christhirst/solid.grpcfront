import { A } from "@solidjs/router";

export default function NotFound() {
  return (
    <main class="relative min-h-screen">
      <div class="mesh-gradient" />
      <div class="grain-overlay" />

      <div class="relative z-10 mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <div class="fade-in-up delay-1">
          <p class="text-8xl font-black gradient-text">404</p>
        </div>
        <div class="fade-in-up delay-2">
          <h1 class="mt-4 text-2xl font-bold text-white">Page not found</h1>
          <p class="mt-2 text-[#8b8b9e]">The page you're looking for doesn't exist or has been moved.</p>
        </div>
        <div class="fade-in-up delay-3 mt-8">
          <A href="/" class="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Dashboard
          </A>
        </div>
      </div>
    </main>
  );
}
