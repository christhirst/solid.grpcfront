import { APIEvent } from "@solidjs/start/server";

export function GET(event: APIEvent) {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

export default function Home() {
  return (
    <main class="relative min-h-screen">
      <div class="mesh-gradient" />
      <div class="grain-overlay" />

      <div class="relative z-10 mx-auto max-w-7xl px-6 py-24 text-center">
        <h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Solid<span class="gradient-text">Flow</span>
        </h1>
        <p class="mt-4 text-[#8b8b9e]">Your workspace is ready.</p>
      </div>
    </main>
  );
}
