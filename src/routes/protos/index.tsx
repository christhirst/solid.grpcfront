import { createSignal, createResource, For, Show } from "solid-js";
import { isServer } from "solid-js/web";

export interface ProtoFile {
  id: string;
  name: string;
  content: string;
  updated_at: string;
}

const fetchProtos = async () => {
  const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/protos` : "/api/protos";
  const res = await fetch(url);
  const json = await res.json();
  if (json.success) {
    return json.data as ProtoFile[];
  }
  return [];
};

export default function Protos() {
  const [protos, { refetch }] = createResource(fetchProtos);
  const [editingProto, setEditingProto] = createSignal<Partial<ProtoFile> | null>(null);
  const [isSaving, setIsSaving] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
  const [isDragging, setIsDragging] = createSignal(false);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setEditingProto((prev) => ({
        ...prev,
        content,
        // Auto-fill name based on filename if it's currently generic
        name: prev?.name && prev.name !== "New Proto Schema" ? prev.name : file.name.replace(".proto", "")
      }));
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files[0];
    if (file && (file.name.endsWith(".proto") || file.type === "text/plain")) {
      handleFileUpload(file);
    }
  };

  const startCreate = () => {
    setEditingProto({ name: "New Proto Schema", content: "syntax = \"proto3\";\n\npackage example;\n\n" });
    setErrorMsg(null);
  };

  const startEdit = (proto: ProtoFile) => {
    setEditingProto({ ...proto });
    setErrorMsg(null);
  };

  const cancelEdit = () => {
    setEditingProto(null);
    setErrorMsg(null);
  };

  const saveProto = async () => {
    const p = editingProto();
    if (!p || !p.name || !p.content) {
      setErrorMsg("Name and content are required.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const isUpdate = !!p.id;
      const url = isUpdate && p.id ? `/api/protos/${p.id.split(":")[1] || p.id}` : "/api/protos";
      const method = isUpdate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      
      if (data.success) {
        setEditingProto(null);
        refetch();
      } else {
        setErrorMsg(data.error || "Failed to save proto");
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProto = async (id: string, e: Event) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this proto?")) return;
    
    try {
      await fetch(`/api/protos/${id.split(":")[1] || id}`, { method: "DELETE" });
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main class="relative min-h-screen">
      <div class="mesh-gradient" />
      <div class="grain-overlay" />

      <div class="relative z-10 mx-auto max-w-5xl px-6 py-8">
        <div class="flex items-center justify-between mb-8 fade-in-up delay-1">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                </svg>
              </div>
              <h1 class="text-2xl font-bold tracking-tight text-white">Proto Library</h1>
            </div>
            <p class="text-sm text-[#8b8b9e]">Manage reusable .proto schemas for the gRPC Client and Workflows.</p>
          </div>
          
          <Show when={!editingProto()}>
            <button
              onClick={startCreate}
              class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-px hover:shadow-indigo-500/40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Schema
            </button>
          </Show>
        </div>

        <Show when={editingProto()}>
          <div class="card p-6 fade-in-up delay-2 mb-6">
            <h2 class="text-lg font-bold text-white mb-4">
              {editingProto()?.id ? "Edit Proto Schema" : "Create Proto Schema"}
            </h2>
            
            <Show when={errorMsg()}>
              <div class="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {errorMsg()}
              </div>
            </Show>

            <div class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-[#5a5a6e] mb-1.5">Schema Name</label>
                <input
                  type="text"
                  value={editingProto()?.name || ""}
                  onInput={(e) => setEditingProto({ ...editingProto()!, name: e.currentTarget.value })}
                  class="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g. User Service API"
                />
              </div>

              <div>
                <label class="block text-xs font-medium text-[#5a5a6e] mb-1.5">Proto Definition</label>
              <div
                class={`relative rounded-lg border-2 transition-colors ${
                  isDragging() ? "border-indigo-500 bg-indigo-500/5 border-dashed" : "border-[#1e1e2e] border-solid"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div class="absolute right-3 top-3 pointer-events-none">
                  <span class="text-[10px] font-bold tracking-widest text-[#5a5a6e] uppercase opacity-60">
                    {isDragging() ? "Drop to upload" : "Drag .proto here"}
                  </span>
                </div>
                <textarea
                  value={editingProto()?.content || ""}
                  onInput={(e) => setEditingProto({ ...editingProto()!, content: e.currentTarget.value })}
                  class="w-full min-h-[300px] rounded-lg bg-transparent p-4 text-sm text-[#c8c8d8] font-mono focus:outline-none transition-colors"
                  style={{ "background-color": "transparent" }}
                  spellcheck={false}
                  placeholder="syntax = 'proto3';"
                />
              </div>
              </div>

              <div class="flex justify-end gap-3 pt-4 border-t border-[#1e1e2e]">
                <button
                  onClick={cancelEdit}
                  disabled={isSaving()}
                  class="rounded-lg px-4 py-2 text-sm font-medium text-[#8b8b9e] hover:bg-[#1e1e2e] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProto}
                  disabled={isSaving()}
                  class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-2 text-sm font-semibold text-white shadow-md hover:shadow-indigo-500/25 transition-all"
                >
                  {isSaving() ? "Saving..." : "Save Schema"}
                </button>
              </div>
            </div>
          </div>
        </Show>

        <Show when={!editingProto()}>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 fade-in-up delay-2">
            <Show
              when={protos()?.length}
              fallback={
                <div class="col-span-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#1e1e2e] bg-[#12121a]/50 py-16">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2a2a3e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-4">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                  <h3 class="text-lg font-medium text-white mb-2">No Proto Schemas Found</h3>
                  <p class="text-[#5a5a6e] text-center max-w-sm">
                    Store your commonly used `.proto` files here to easily access them across the gRPC Client and Workflows.
                  </p>
                </div>
              }
            >
              <For each={protos()}>
                {(proto) => (
                  <div class="card p-5 group cursor-pointer hover:border-indigo-500/50 transition-colors flex flex-col h-[200px]" onClick={() => startEdit(proto)}>
                    <div class="flex items-start justify-between mb-3">
                      <div class="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <h3 class="font-semibold text-white truncate max-w-[180px]">{proto.name}</h3>
                      </div>
                      <button
                        onClick={(e) => deleteProto(proto.id, e)}
                        class="p-1 rounded bg-[#1e1e2e] text-[#5a5a6e] opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 hover:bg-red-500/10"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 6h18" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                    
                    <div class="relative flex-1 bg-[#12121a] rounded-lg border border-[#1e1e2e] p-3 overflow-hidden">
                      <pre class="text-[10px] text-[#5a5a6e] font-mono leading-relaxed pointer-events-none">
                        {(proto.content || "").substring(0, 300) + ((proto.content || "").length > 300 ? "..." : "")}
                      </pre>
                      <div class="absolute inset-0 bg-gradient-to-t from-[#12121a] via-[#12121a]/50 to-transparent pointer-events-none" />
                    </div>

                    <div class="mt-3 text-[10px] font-medium text-[#5a5a6e] truncate">
                      Updated: {new Date(proto.updated_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </Show>
      </div>
    </main>
  );
}
