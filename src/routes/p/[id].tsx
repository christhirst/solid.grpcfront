import { createSignal, For, Show, onMount, createEffect } from "solid-js";
import { useParams } from "@solidjs/router";

export default function PublicDashboard() {
  const params = useParams();

  const [dashboard, setDashboard] = createSignal<any>(undefined); // undefined means loading

  onMount(async () => {
    try {
      const res = await fetch(`/api/dashboards/${params.id}`);
      const json = await res.json();
      if (json.success && json.data.isPublic) {
        setDashboard(json.data);
      } else {
        setDashboard(null); // null means not found/not public
      }
    } catch {
      setDashboard(null);
    }
  });

  createEffect(() => {
    if (dashboard()) {
      document.title = dashboard().name || "Dashboard";
    }
  });

  const [executing, setExecuting] = createSignal<Record<string, "idle" | "running" | "success" | "error">>({});

  const triggerButton = async (btn: any) => {
    if (executing()[btn.id] === "running") return;
    
    setExecuting(prev => ({ ...prev, [btn.id]: "running" }));
    
    try {
      const res = await fetch(`/api/dashboards/${params.id}/trigger/${btn.id}`, { method: "POST" });
      const json = await res.json();
      
      if (json.success) {
        // Just report success that it triggered properly. 
        setExecuting(prev => ({ ...prev, [btn.id]: "success" }));
        setTimeout(() => {
          setExecuting(prev => ({ ...prev, [btn.id]: "idle" }));
        }, 2500); // Resets look after 2.5s
      } else {
        alert("Action failed: " + json.error);
        setExecuting(prev => ({ ...prev, [btn.id]: "error" }));
        setTimeout(() => setExecuting(prev => ({ ...prev, [btn.id]: "idle" })), 2500);
      }
    } catch (e: any) {
      alert("Network or Server error: " + e.message);
      setExecuting(prev => ({ ...prev, [btn.id]: "error" }));
      setTimeout(() => setExecuting(prev => ({ ...prev, [btn.id]: "idle" })), 2500);
    }
  };

  const colorOptions = [
    { value: "blue", class: "bg-blue-600 hover:bg-blue-500 ring-blue-500/50" },
    { value: "red", class: "bg-red-600 hover:bg-red-500 ring-red-500/50" },
    { value: "emerald", class: "bg-emerald-600 hover:bg-emerald-500 ring-emerald-500/50" },
    { value: "purple", class: "bg-purple-600 hover:bg-purple-500 ring-purple-500/50" },
    { value: "slate", class: "bg-slate-700 hover:bg-slate-600 ring-slate-500/50" }
  ];

  return (
    <main class="min-h-screen bg-[#050508] p-6 lg:p-16 flex items-center justify-center font-sans">
      <Show when={dashboard() === null}>
         <div class="text-center">
           <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto mb-4 text-[#8b8b9e]"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
           <h1 class="text-2xl font-bold text-white mb-2">Not Found</h1>
           <p class="text-[#8b8b9e]">This dashboard does not exist or is not public.</p>
         </div>
      </Show>

      <Show when={dashboard() === undefined}>
         <div class="text-center">
           <svg class="animate-spin mx-auto h-8 w-8 text-[#8b8b9e]" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
         </div>
      </Show>

      <Show when={dashboard()}>
        <div class="w-full max-w-lg bg-[#0a0a0f] rounded-3xl border border-[#2a2a3a]/60 shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
          
          <div class="relative pt-12 pb-8 px-8 border-b border-[#2a2a3a]/50 text-center">
            <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>
            <h1 class="text-3xl font-extrabold tracking-tight text-white mb-2">{dashboard().name}</h1>
            <p class="text-[12px] font-bold tracking-widest text-[#5b5b6e] uppercase">Internal Operations</p>
          </div>

          <div class="p-8">
            <div class="flex flex-col gap-4">
              <Show when={dashboard().buttons?.length === 0}>
                <div class="text-center py-10 text-[#5b5b6e] text-sm italic">
                  No actions available right now.
                </div>
              </Show>
              
              <For each={dashboard().buttons || []}>
                {(btn) => {
                  const state = executing()[btn.id] || "idle";
                  const colorConfig = colorOptions.find(c => c.value === (btn.color || "blue"));
                  const baseStyle = colorConfig ? colorConfig.class : "bg-blue-600 hover:bg-blue-500 ring-blue-500/50";
                  
                  let buttonClass = `w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 relative overflow-hidden flex items-center justify-center gap-3 active:scale-[0.98] focus:ring-4 focus:outline-none ${baseStyle}`;
                  
                  if (state === "running") {
                    buttonClass = `w-full py-4 px-6 text-[15px] font-bold text-white/70 rounded-2xl shadow-xl transition-all duration-300 relative overflow-hidden flex items-center justify-center gap-3 bg-slate-800 border-slate-700 cursor-not-allowed`;
                  } else if (state === "success") {
                    buttonClass = `w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 relative overflow-hidden flex items-center justify-center gap-3 bg-emerald-600 ring-4 ring-emerald-500/50`;
                  } else if (state === "error") {
                    buttonClass = `w-full py-4 px-6 text-[15px] font-bold text-white rounded-2xl shadow-xl transition-all duration-300 relative overflow-hidden flex items-center justify-center gap-3 bg-red-600 ring-4 ring-red-500/50`;
                  }

                  return (
                    <button 
                      onClick={() => triggerButton(btn)} 
                      disabled={state !== "idle"}
                      class={buttonClass}
                    >
                      {/* State Icons */}
                      <Show when={state === "idle"}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        <span>{btn.label}</span>
                      </Show>

                      <Show when={state === "running"}>
                        <svg class="animate-spin h-5 w-5 text-purple-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Executing...</span>
                      </Show>

                      <Show when={state === "success"}>
                        <svg class="animate-bounce h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>Success!</span>
                      </Show>

                      <Show when={state === "error"}>
                        <svg class="animate-pulse h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                        <span>Failed</span>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
            
            <div class="mt-8 text-center text-[10px] text-[#5b5b6e]">
              Powered by <span class="font-bold font-mono text-purple-400/80">solid.grpcfront</span>
            </div>
          </div>
        </div>
      </Show>
    </main>
  );
}
