import { createMemo, For, Show } from "solid-js";
import get from "lodash.get";
import { collectObjectKeys, normalizeDataArray } from "./dataHelpers";

export interface DashTableProps {
  data: any[];
  columns?: string[];
  compact?: boolean;
}

export function DashTable(props: DashTableProps) {
  const rows = createMemo(() => normalizeDataArray(props.data));
  const effectiveCols = createMemo(() => {
    const explicit = (props.columns || []).filter(Boolean);
    if (explicit.length) return explicit;
    const keys = collectObjectKeys(rows());
    return keys.length ? keys : ["value"];
  });

  const cellValue = (row: any, key: string) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return key === "value" ? row : undefined;
    return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : get(row, key);
  };

  const formatCell = (value: any) => {
    if (value === undefined || value === null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  };

  return (
    <div
      class={
        props.compact
          ? "overflow-auto max-h-[250px] rounded-xl border border-[#2a2a3a]/60 bg-[#0a0a0f]"
          : "overflow-auto max-h-[400px] rounded-xl border border-[#2a2a3a]/60 bg-[#0a0a0f]"
      }
    >
      <Show when={rows().length > 0} fallback={<div class="p-4 text-xs text-[#5a5a6e]">No table data</div>}>
        <table class="w-full text-left text-xs text-[#c8c8d8]">
          <thead class="bg-[#1a1a24] text-[#8b8b9e] sticky top-0">
            <tr>
              <For each={effectiveCols()}>
                {(col) => (
                  <th
                    class={
                      props.compact
                        ? "px-3 py-2 font-semibold border-b border-[#2a2a3e] whitespace-nowrap uppercase text-[9px] tracking-wider"
                        : "px-4 py-2.5 font-semibold border-b border-[#2a2a3e] whitespace-nowrap uppercase text-[10px] tracking-wider"
                    }
                  >
                    {col}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#1e1e2e]">
            <For each={rows()}>
              {(row) => (
                <tr class="hover:bg-[#1a1a24]/40 transition-colors">
                  <For each={effectiveCols()}>
                    {(col) => {
                      const text = formatCell(cellValue(row, col));
                      return (
                        <td
                          class={
                            props.compact
                              ? "px-3 py-1.5 border-b border-[#1e1e2e]/50 max-w-[150px] truncate"
                              : "px-4 py-2 border-b border-[#1e1e2e]/50 max-w-[200px] truncate"
                          }
                          title={text}
                        >
                          {text}
                        </td>
                      );
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}

export default DashTable;
