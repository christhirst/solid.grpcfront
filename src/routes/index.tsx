export default function Home() {
  return (
    <main class="relative min-h-screen">
      <div class="mesh-gradient" />
      <div class="grain-overlay" />

      <div class="relative z-10 mx-auto max-w-7xl 2xl:max-w-[90rem] px-4 sm:px-6 py-24 sm:py-32 text-center">
        <h1 class="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
          Solid<span class="gradient-text">Flow</span>
        </h1>
        <p class="mt-6 text-lg text-[#8b8b9e]">Your workspace is ready.</p>
      </div>
    </main>
  );
}
