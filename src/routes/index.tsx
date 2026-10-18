export default function Home() {
  return (
    <main class="relative min-h-screen">
      <div class="mesh-gradient" />
      <div class="grain-overlay" />

      <div class="relative z-10 mx-auto max-w-7xl 2xl:max-w-[90rem] px-4 sm:px-6 py-24 sm:py-32 text-center">
        <div class="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-3xl bg-zinc-900/60 p-1.5 shadow-2xl ring-1 ring-zinc-800 backdrop-blur-xl">
          <img src="/favicon.svg" alt="SolidFlow Logo" class="h-full w-full object-contain" />
        </div>
        <h1 class="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
          Solid<span class="gradient-text">Flow</span>
        </h1>
        <p class="mt-6 text-lg text-[#8b8b9e]">Your workspace is ready.</p>
      </div>
    </main>
  );
}
