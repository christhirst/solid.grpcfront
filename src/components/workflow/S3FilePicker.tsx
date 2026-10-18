import { createSignal, createMemo, For, Show } from "solid-js";

export interface S3FilePickerProps {
  /** Available saved connections (all or pre-filtered to type === "s3") */
  connections: any[];
  /** Currently selected connection ID (for step mode) */
  connectionId?: string;
  /** Manual override fields (for step mode) */
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  prefix?: string;
  pattern?: string;
  forcePathStyle?: boolean;
  caId?: string;
  acceptInvalidCert?: boolean;
  /** Currently selected object keys in step mode */
  selectedKeys?: string[];
  /** Callback when user toggles/updates selected keys in step mode */
  onChangeSelectedKeys?: (keys: string[]) => void;
  /** Callback when user clicks "Insert URI" or selects a file in quick-insert mode */
  onInsertReference?: (reference: string, item: { s3Uri: string; key: string; name: string; bucket: string }) => void;
  /** Mode: "step" (full browser inside an S3 step) or "quick_insert" (collapsible picker inside HTTP/gRPC steps) */
  mode?: "step" | "quick_insert";
}

export default function S3FilePicker(props: S3FilePickerProps) {
  const s3Connections = createMemo(() =>
    (props.connections || []).filter((c: any) => c.type === "s3")
  );

  const [quickOpen, setQuickOpen] = createSignal(false);
  const [quickConnId, setQuickConnId] = createSignal("");
  const [quickPrefix, setQuickPrefix] = createSignal("");
  const [quickPattern, setQuickPattern] = createSignal("");
  const [insertFormat, setInsertFormat] = createSignal<"s3_uri" | "key" | "filename">("s3_uri");

  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [objects, setObjects] = createSignal<any[]>([]);
  const [resolvedBucket, setResolvedBucket] = createSignal("");
  const [hasLoaded, setHasLoaded] = createSignal(false);
  const [manualKeyInput, setManualKeyInput] = createSignal("");
  const [copiedUri, setCopiedUri] = createSignal<string | null>(null);

  const activeConnectionId = createMemo(() => {
    if (props.mode === "quick_insert") {
      return quickConnId() || s3Connections()[0]?.id || "";
    }
    return props.connectionId || "";
  });

  const activeConnObj = createMemo(() => {
    const id = activeConnectionId();
    if (!id) return null;
    const clean = id.includes(":") ? id.split(":")[1] : id;
    return s3Connections().find((c: any) => {
      const cClean = (c.id || "").includes(":") ? c.id.split(":")[1] : c.id;
      return c.id === id || cClean === clean;
    }) || null;
  });

  const effectiveBucket = createMemo(() => {
    return props.bucket || resolvedBucket() || activeConnObj()?.bucket || "";
  });

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const connId = activeConnectionId() || "adhoc";
      const cleanId = connId.includes(":") ? connId.split(":")[1] : connId;
      const bodyPayload: Record<string, any> = {
        maxKeys: 200,
      };

      if (props.mode === "quick_insert") {
        if (quickPrefix().trim()) bodyPayload.prefix = quickPrefix().trim();
        if (quickPattern().trim()) bodyPayload.pattern = quickPattern().trim();
      } else {
        if (props.endpoint) bodyPayload.endpoint = props.endpoint;
        if (props.region) bodyPayload.region = props.region;
        if (props.bucket) bodyPayload.bucket = props.bucket;
        if (props.accessKeyId) bodyPayload.accessKeyId = props.accessKeyId;
        if (props.secretAccessKey) bodyPayload.secretAccessKey = props.secretAccessKey;
        if (props.prefix !== undefined) bodyPayload.prefix = props.prefix;
        if (props.pattern !== undefined) bodyPayload.pattern = props.pattern;
        if (props.forcePathStyle !== undefined) bodyPayload.forcePathStyle = props.forcePathStyle;
        if (props.caId) bodyPayload.caId = props.caId;
        if (props.acceptInvalidCert !== undefined) bodyPayload.acceptInvalidCert = props.acceptInvalidCert;
      }

      const res = await fetch(`/api/connections/${encodeURIComponent(cleanId)}/s3-objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to list S3 bucket objects");
        setObjects([]);
      } else {
        setObjects(data.objects || []);
        if (data.bucket) setResolvedBucket(data.bucket);
        setHasLoaded(true);
      }
    } catch (err: any) {
      setError(err.message || "Network error browsing S3 bucket");
    } finally {
      setLoading(false);
    }
  };

  const isKeySelected = (key: string) => {
    const list = props.selectedKeys || [];
    return list.includes(key) || list.includes(`s3://${effectiveBucket()}/${key}`);
  };

  const toggleKey = (key: string) => {
    if (!props.onChangeSelectedKeys) return;
    const current = [...(props.selectedKeys || [])];
    const idx = current.findIndex((k) => k === key || k === `s3://${effectiveBucket()}/${key}`);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(key);
    }
    props.onChangeSelectedKeys(current);
  };

  const addManualKey = () => {
    const raw = manualKeyInput().trim();
    if (!raw || !props.onChangeSelectedKeys) return;
    const current = [...(props.selectedKeys || [])];
    if (!current.includes(raw)) {
      current.push(raw);
      props.onChangeSelectedKeys(current);
    }
    setManualKeyInput("");
  };

  const removeSelectedKey = (key: string) => {
    if (!props.onChangeSelectedKeys) return;
    props.onChangeSelectedKeys((props.selectedKeys || []).filter((k) => k !== key));
  };

  const formatReference = (obj: { s3Uri: string; key: string; name: string; bucket: string }) => {
    const fmt = insertFormat();
    if (fmt === "key") return obj.key;
    if (fmt === "filename") return obj.name;
    return obj.s3Uri;
  };

  const handleCopy = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedUri(text);
      setTimeout(() => setCopiedUri(null), 1800);
    }
  };

  return (
    <Show
      when={props.mode === "quick_insert"}
      fallback={
        /* ── STEP MODE (inside S3 Source Step) ── */
        <div class="bg-slate-950/70 border border-amber-500/25 rounded-lg p-3 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span class="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                🪣 S3 Bucket File Browser &amp; Selector
              </span>
              <p class="text-[11px] text-slate-400">
                Browse objects in the bucket to pick specific files, or leave selection empty to dynamically pass all files matching Prefix / Pattern at runtime.
              </p>
            </div>
            <button
              type="button"
              onClick={loadFiles}
              disabled={loading()}
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-colors disabled:opacity-50"
            >
              {loading() ? "Listing Bucket..." : hasLoaded() ? "↻ Refresh Bucket Files" : "🔍 Browse Bucket Files"}
            </button>
          </div>

          {/* Manual filename / key entry (also supports {{ variables }}) */}
          <div class="flex gap-2 items-center">
            <input
              type="text"
              value={manualKeyInput()}
              onInput={(e) => setManualKeyInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addManualKey();
                }
              }}
              placeholder="Add specific file key or s3:// URI (e.g. folder/data.csv or {{ form.filename }})..."
              class="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={addManualKey}
              class="px-2.5 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors"
            >
              + Add File
            </button>
          </div>

          {/* Selected keys pills */}
          <Show when={(props.selectedKeys || []).length > 0}>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-semibold text-amber-400">
                  Selected Files ({(props.selectedKeys || []).length}) — Only these filenames/URIs will be emitted:
                </span>
                <button
                  type="button"
                  onClick={() => props.onChangeSelectedKeys?.([])}
                  class="text-[10px] text-slate-400 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <For each={props.selectedKeys || []}>
                  {(k) => {
                    const displayUri = k.startsWith("s3://")
                      ? k
                      : effectiveBucket()
                        ? `s3://${effectiveBucket()}/${k.replace(/^\/+/, "")}`
                        : k;
                    return (
                      <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-950/60 border border-amber-500/30 text-[11px] font-mono text-amber-200">
                        <span title={displayUri}>{displayUri}</span>
                        <button
                          type="button"
                          onClick={() => removeSelectedKey(k)}
                          class="text-amber-400/70 hover:text-red-400 font-bold leading-none"
                          title="Remove file"
                        >
                          ×
                        </button>
                      </span>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>

          <Show when={error()}>
            <div class="p-2 rounded bg-red-950/50 border border-red-500/30 text-xs text-red-300 font-mono">
              ✗ {error()}
            </div>
          </Show>

          <Show when={hasLoaded()}>
            <div class="border border-slate-800 rounded-lg overflow-hidden">
              <div class="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Bucket: <strong class="text-amber-300 font-mono">{effectiveBucket() || "—"}</strong> ({objects().length} object{objects().length === 1 ? "" : "s"})
                </span>
                <Show when={objects().length > 0 && props.onChangeSelectedKeys}>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => props.onChangeSelectedKeys?.(objects().map((o: any) => o.key))}
                      class="text-[10px] text-amber-400 hover:underline"
                    >
                      Select All
                    </button>
                  </div>
                </Show>
              </div>
              <div class="max-h-52 overflow-y-auto divide-y divide-slate-800/60 bg-slate-950/80">
                <For
                  each={objects()}
                  fallback={
                    <div class="p-3 text-xs text-slate-500 italic text-center">
                      No matching objects found in bucket.
                    </div>
                  }
                >
                  {(obj) => {
                    const checked = () => isKeySelected(obj.key);
                    return (
                      <div
                        onClick={() => toggleKey(obj.key)}
                        class={`px-3 py-1.5 flex items-center justify-between gap-2 text-xs font-mono cursor-pointer transition-colors ${
                          checked() ? "bg-amber-500/15 text-amber-200" : "hover:bg-slate-900/70 text-slate-300"
                        }`}
                      >
                        <div class="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={checked()}
                            onChange={() => {}}
                            class="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                          />
                          <span class="truncate" title={obj.s3Uri}>
                            {obj.s3Uri}
                          </span>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                          <span class="text-[10px] text-slate-500">
                            {obj.size != null ? `${(Number(obj.size) / 1024).toFixed(1)} KB` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(obj.s3Uri);
                            }}
                            class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                            title="Copy s3:// URI"
                          >
                            {copiedUri() === obj.s3Uri ? "✓ Copied" : "Copy URI"}
                          </button>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>
        </div>
      }
    >
      {/* ── QUICK-INSERT MODE (inside gRPC / HTTP REST steps) ── */}
      <div class="mt-2">
        <div class="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              const next = !quickOpen();
              setQuickOpen(next);
              if (next && !hasLoaded() && s3Connections().length > 0) {
                loadFiles();
              }
            }}
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
          >
            <span>🪣 Insert S3 Filename / URI</span>
            <span class="text-[10px] opacity-75">{quickOpen() ? "▲" : "▼"}</span>
          </button>
        </div>

        <Show when={quickOpen()}>
          <div class="mt-2 p-3 rounded-lg bg-slate-950/90 border border-amber-500/30 space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs font-bold text-amber-300">
                🪣 Pick S3 File Reference (Zero-Copy URI / Filename)
              </span>
              <div class="flex items-center gap-1.5 text-[11px]">
                <span class="text-slate-400">Format:</span>
                <select
                  value={insertFormat()}
                  onChange={(e) => setInsertFormat(e.currentTarget.value as any)}
                  class="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-amber-300 font-mono focus:outline-none"
                >
                  <option value="s3_uri">s3://bucket/key</option>
                  <option value="key">folder/file.ext (Key)</option>
                  <option value="filename">file.ext (Filename)</option>
                </select>
              </div>
            </div>

            <Show
              when={s3Connections().length > 0}
              fallback={
                <div class="text-xs text-slate-400 py-1">
                  No saved S3 connections found. Configure an S3 Storage connection in{" "}
                  <a href="/connections" class="text-amber-400 underline hover:text-amber-300">
                    /connections
                  </a>{" "}
                  or add an S3 Source Step upstream.
                </div>
              }
            >
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={activeConnectionId()}
                  onChange={(e) => {
                    setQuickConnId(e.currentTarget.value);
                    loadFiles();
                  }}
                  class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <For each={s3Connections()}>
                    {(conn) => (
                      <option value={conn.id}>
                        🪣 {conn.name} ({conn.bucket})
                      </option>
                    )}
                  </For>
                </select>
                <input
                  type="text"
                  value={quickPrefix()}
                  onInput={(e) => setQuickPrefix(e.currentTarget.value)}
                  placeholder="Prefix (e.g. incoming/)"
                  class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <div class="flex gap-1.5">
                  <input
                    type="text"
                    value={quickPattern()}
                    onInput={(e) => setQuickPattern(e.currentTarget.value)}
                    placeholder="Filter (*.csv)"
                    class="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={loadFiles}
                    disabled={loading()}
                    class="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold shrink-0"
                  >
                    {loading() ? "..." : "List"}
                  </button>
                </div>
              </div>

              <Show when={error()}>
                <div class="p-2 rounded bg-red-950/50 border border-red-500/30 text-xs text-red-300 font-mono">
                  ✗ {error()}
                </div>
              </Show>

              <Show when={hasLoaded()}>
                <div class="max-h-44 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800 rounded bg-slate-950">
                  <For
                    each={objects()}
                    fallback={
                      <div class="p-2.5 text-xs text-slate-500 italic text-center">
                        No objects found in bucket.
                      </div>
                    }
                  >
                    {(obj) => {
                      const formatted = () => formatReference(obj);
                      return (
                        <div class="px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs font-mono hover:bg-slate-900/80">
                          <span class="text-amber-300 truncate" title={obj.s3Uri}>
                            {formatted()}
                          </span>
                          <div class="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopy(formatted())}
                              class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                            >
                              {copiedUri() === formatted() ? "✓ Copied" : "Copy"}
                            </button>
                            <Show when={props.onInsertReference}>
                              <button
                                type="button"
                                onClick={() => props.onInsertReference?.(formatted(), obj)}
                                class="px-2 py-0.5 rounded bg-amber-600/25 hover:bg-amber-600/40 text-[10px] text-amber-200 border border-amber-500/30 font-semibold"
                              >
                                + Insert into Request
                              </button>
                            </Show>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}
