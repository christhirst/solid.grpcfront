import { A } from "@solidjs/router";

export default function About() {
  return (
    <main class="relative min-h-screen">
      <div class="mesh-gradient" />
      <div class="grain-overlay" />

      <div class="relative z-10 mx-auto max-w-3xl px-6 py-24">
        <div class="fade-in-up delay-1">
          <h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl">
            About <span class="gradient-text">SolidFlow</span>
          </h1>
        </div>

        <div class="fade-in-up delay-2 mt-8 space-y-6 text-[#8b8b9e] leading-relaxed">
          <p>
            SolidFlow is a modern full-stack application template built with SolidJS and SolidStart. 
            It combines fine-grained reactivity with server-side rendering, real-time data capabilities, 
            and a premium dark-mode interface.
          </p>
          <p>
            Powered by Vite 7, Tailwind CSS 4, Connect-RPC, and Chart.js — everything is wired up 
            and ready for production.
          </p>
        </div>

        <div class="fade-in-up delay-3 mt-10">
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
