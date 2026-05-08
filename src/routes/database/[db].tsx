import { createSignal, createResource, Show, For } from "solid-js";
import { useParams, A } from "@solidjs/router";
import { isServer } from "solid-js/web";
import { createSolidTable, getCoreRowModel, flexRender } from "@tanstack/solid-table";

export default function DatabaseViewer() {
  const params = useParams();
  const dbName = params.db;

  const [selectedTable, setSelectedTable] = createSignal<string>("");
  const [jsonInput, setJsonInput] = createSignal("{\n  \n}");
  const [isAdding, setIsAdding] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal("");
  const [copied, setCopied] = createSignal(false);

  const fetchTables = async () => {
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/database/${dbName}/tables` : `/api/database/${dbName}/tables`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      const tables = json.success ? (json.data as string[]) : [];
      if (tables.length > 0 && !selectedTable()) {
        setSelectedTable(tables[0]);
      }
      return tables;
    } catch {
      return [];
    }
  };

  const [tables] = createResource(fetchTables);

  const fetchRecords = async (table: string) => {
    if (!table) return [];
    const url = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}/api/database/${dbName}/${table}` : `/api/database/${dbName}/${table}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json.success ? (json.data as any[]) : [];
    } catch {
      return [];
    }
  };

  // We use createResource with a signal source so it refetches when selectedTable changes
  const [records, { refetch: refetchRecords }] = createResource(selectedTable, fetchRecords);

  const handleAddData = async () => {
    setErrorMsg("");
    let query = jsonInput().trim();
    if (!query) {
      setErrorMsg("Query cannot be empty");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/database/${dbName}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (json.success) {
        setIsAdding(false);
        setJsonInput("");
        refetchRecords(); // Refresh the table
      } else {
        setErrorMsg(json.error || "Failed to execute query");
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const DataGrid = () => {
    const data = () => records() || [];
    
    const effectiveCols = () => {
      const d = data();
      if (!Array.isArray(d) || !d[0] || typeof d[0] !== "object") return [];
      // Use keys of the first record
      return Object.keys(d[0]);
    };

    const table = createSolidTable({
      get data() { return data() },
      get columns() {
        const cols = effectiveCols();
        if (!cols.length) {
          const d = data();
          if (!Array.isArray(d) || !d[0]) return [];
          if (typeof d[0] !== "object") return [{ id: "value", header: "Value", accessorFn: (r: any) => r }];
        }
        return cols.map((k) => ({
          accessorKey: k,
          header: k,
          cell: (info: any) => {
            const v = info.getValue();
            return typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
          },
        }));
      },
      getCoreRowModel: getCoreRowModel(),
    });

    return (
      <div class="overflow-auto max-h-[600px] rounded-xl border border-[#2a2a3a] bg-[#0a0a0f] shadow-lg custom-scrollbar">
        <table class="w-full text-left text-sm text-[#c8c8d8]">
          <thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0 shadow-sm z-10">
            <For each={table.getHeaderGroups()}>
              {(hg) => (
                <tr>
                  <For each={hg.headers}>
                    {(h) => (
                      <th class="px-4 py-3 font-semibold border-b border-[#2a2a3e] whitespace-nowrap uppercase text-xs tracking-wider">
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </thead>
          <tbody class="divide-y divide-[#1e1e2e]">
            <Show when={data().length === 0}>
              <tr>
                <td colSpan={100} class="text-center py-8 text-[#5b5b6e] italic">
                  No records found in {selectedTable()}.
                </td>
              </tr>
            </Show>
            <For each={table.getRowModel().rows}>
              {(row) => (
                <tr class="hover:bg-[#1a1a24]/60 transition-colors">
                  <For each={row.getVisibleCells()}>
                    {(cell) => (
                      <td class="px-4 py-2 border-b border-[#1e1e2e]/50 max-w-[300px] truncate" title={String(cell.getValue() ?? "")}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <main class="mx-auto max-w-7xl px-6 py-12 text-white">
      <div class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <A href="/database" class="text-[#8b8b9e] hover:text-white flex items-center gap-1 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"></path></svg>
            Back
          </A>
          <h1 class="text-3xl font-extrabold tracking-tight">
            Database: <span class="text-blue-400">{dbName}</span>
          </h1>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Tables */}
        <div class="col-span-1 space-y-4">
          <div class="card p-4">
            <h2 class="text-sm font-bold text-[#8b8b9e] uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              Tables
            </h2>
            <Show when={tables.loading}>
              <div class="animate-pulse h-8 bg-[#1e1e2e] rounded w-full mb-2"></div>
              <div class="animate-pulse h-8 bg-[#1e1e2e] rounded w-4/5"></div>
            </Show>
            <div class="flex flex-col gap-1">
              <For each={tables()}>
                {(table) => (
                  <button
                    class={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedTable() === table 
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 translate-x-1" 
                      : "text-white hover:bg-[#1e1e2e] hover:translate-x-1"
                    }`}
                    onClick={() => setSelectedTable(table)}
                  >
                    {table}
                  </button>
                )}
              </For>
              <Show when={!tables.loading && tables()?.length === 0}>
                <p class="text-xs text-[#5b5b6e] italic">No tables created yet. Add data to create one implicitly.</p>
              </Show>
            </div>
            
            {/* Quick manual table selection for purely new setups */}
            <div class="mt-4 pt-4 border-t border-[#2a2a3a]">
              <input
                type="text"
                placeholder="Or type table name..."
                class="w-full rounded-md border border-[#2a2a3a] bg-[#0a0a0f] p-2 text-xs text-white focus:border-blue-500 outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSelectedTable(e.currentTarget.value);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Content: Records & Insert */}
        <div class="col-span-1 lg:col-span-3 space-y-6">
          <Show when={selectedTable()} fallback={
            <div class="rounded-xl border border-dashed border-[#2a2a3a] py-20 text-center bg-[#0a0a0f]/50">
              <p class="text-[#8b8b9e]">Select a table from the sidebar or type a new table name to begin.</p>
            </div>
          }>
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold flex items-center gap-2">
                Table: <span class="text-blue-300 font-mono">{selectedTable()}</span>
              </h2>
              <div class="flex items-center gap-3">
                <button
                  onClick={() => {
                    const data = records() || [];
                    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  class="btn-primary text-sm flex items-center gap-2 bg-[#4b5563] hover:bg-[#374151] shadow-[#4b5563]/20"
                >
                  <Show when={copied()} fallback={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  }>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="text-emerald-400" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </Show>
                  {copied() ? "Copied!" : "Copy All"}
                </button>
                <button
                  onClick={() => setIsAdding(!isAdding())}
                  class="btn-primary text-sm flex items-center gap-2 bg-[#10b981] hover:bg-[#059669] shadow-[#10b981]/20"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  {isAdding() ? "Cancel" : "Add/Execute Record (Raw)"}
                </button>
              </div>
            </div>

            <Show when={isAdding()}>
              <div class="card p-5 border border-[#10b981]/30 bg-[#10b981]/5">
                <h3 class="text-sm font-bold text-[#10b981] mb-2 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
                  New Record (SurrealQL)
                </h3>
                <p class="text-xs text-[#8b8b9e] mb-3">
                  Write native SurrealQL to insert or manipulate records. This allows explicit type casting (like <code>(37.5, -65.8)</code> for geometries, or <code>type:id</code> for nested records). Example: <code>CREATE {selectedTable()} CONTENT {"{ ... }"}</code>
                </p>
                <textarea
                  class="w-full h-40 rounded-lg border border-[#2a2a3a] bg-[#0a0a0f] p-3 text-sm font-mono text-emerald-300 focus:border-[#10b981] outline-none custom-scrollbar"
                  placeholder={`CREATE ${selectedTable()} CONTENT {\n  ... \n};`}
                  value={jsonInput()}
                  onInput={(e) => setJsonInput(e.currentTarget.value)}
                ></textarea>
                <Show when={errorMsg()}>
                  <p class="mt-2 text-xs text-red-500 font-medium">{errorMsg()}</p>
                </Show>
                <div class="mt-3 flex justify-end">
                  <button
                    onClick={handleAddData}
                    disabled={isSubmitting()}
                    class="btn-primary bg-[#10b981] hover:bg-[#059669] text-sm flex items-center gap-2"
                  >
                    <Show when={isSubmitting()} fallback="Execute Query">
                      <svg class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Inserting...
                    </Show>
                  </button>
                </div>
              </div>
            </Show>

            <Show when={records.loading}>
              <div class="flex justify-center p-12">
                <svg class="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </div>
            </Show>
            <Show when={!records.loading && records()}>
              <DataGrid />
            </Show>
          </Show>
        </div>
      </div>
    </main>
  );
}
