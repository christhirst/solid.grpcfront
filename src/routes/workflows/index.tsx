import { createSignal, createResource, For, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { A } from "@solidjs/router";

const fetchWorkflows = async () => {
  const url = isServer ? "http://127.0.0.1:3000/api/workflows" : "/api/workflows";
  const res = await fetch(url);
  const json = await res.json();
  if (json.success) {
    return json.data;
  }
  return [];
};

export default function Workflows() {
  const [workflows, { refetch }] = createResource(fetchWorkflows);
  const [isDeleting, setIsDeleting] = createSignal<string | null>(null);

  const deleteWorkflow = async (id: string, e: Event) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this workflow?")) return;
    
    setIsDeleting(id);
    try {
      await fetch(`/api/workflows/${id.split(":")[1] || id}`, { method: "DELETE" });
      refetch();
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <main class="mx-auto max-w-7xl px-6 py-12">
      <div class="mb-10 flex items-end justify-between">
        <div>
          <h1 class="text-4xl font-extrabold tracking-tight text-white mb-2">Workflows</h1>
          <p class="text-[15px] text-[#8b8b9e]">Build, chain, and automate gRPC requests</p>
        </div>
        
        <a href="/workflows/new" target="_self" class="btn-primary hover-lift glow-effect group flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="transition-transform group-hover:scale-110" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Workflow
        </a>
      </div>

      <Show
        when={workflows() && workflows().length > 0}
        fallback={
          <div class="card flex flex-col items-center justify-center p-16 text-center border-dashed border-[#2a2a3a]">
            <div class="mb-6 rounded-full bg-[#1e1e2e] p-6 text-[#5b5b6e]">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-bold text-white">No workflows found</h3>
            <p class="mb-6 max-w-md text-[#8b8b9e]">
              You haven't created any automated gRPC workflows yet. Start building your first flow!
            </p>
            <a href="/workflows/new" target="_self" class="btn-primary">Create Your First Workflow</a>
          </div>
        }
      >
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <For each={workflows()}>
            {(workflow: any) => (
              <a href={`/workflows/${workflow.id.split(":")[1]}`} target="_self" class="card group flex flex-col justify-between p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
                <div>
                  <div class="mb-4 flex items-center justify-between">
                    <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 ring-1 ring-indigo-500/30">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                      </svg>
                    </div>
                    
                    <button 
                      class="text-[#5b5b6e] transition-colors hover:text-red-400"
                      onClick={(e) => deleteWorkflow(workflow.id, e)}
                      disabled={isDeleting() === workflow.id}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                  
                  <h3 class="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">{workflow.name || "Untitled Workflow"}</h3>
                  <p class="mt-2 text-sm text-[#8b8b9e] line-clamp-2">
                    {workflow.steps?.length || 0} steps connected to {workflow.serverAddress}
                  </p>
                </div>
                
                <div class="mt-6 flex items-center justify-between border-t border-[#1e1e2e] pt-4 text-xs text-[#5b5b6e]">
                  <span>Last updated: {new Date(workflow.updated_at || Date.now()).toLocaleDateString()}</span>
                  <span class="flex items-center gap-1 group-hover:text-white transition-colors">
                    Edit Flow
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </span>
                </div>
              </a>
            )}
          </For>
        </div>
      </Show>
    </main>
  );
}
