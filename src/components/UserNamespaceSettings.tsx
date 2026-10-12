import { createSignal, onMount, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { NAMESPACE_MAX_LENGTH, urlPartError } from "~/lib/dashboard/publicUrl";

export default function UserNamespaceSettings(props: { onClose: () => void; onSaved: (namespace: string) => void }) {
  let dialog!: HTMLDialogElement;
  let namespaceInput!: HTMLInputElement;
  const [namespace, setNamespace] = createSignal("");
  const [original, setOriginal] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");

  onMount(async () => {
    dialog.showModal();
    try {
      const response = await fetch("/api/user/profile");
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to load your settings.");
      setNamespace(json.data.namespace || "");
      setOriginal(json.data.namespace || "");
      setLoading(false);
      namespaceInput.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your settings.");
    }
  });

  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    if (loading() || saving()) return;
    const validation = urlPartError(namespace(), "Namespace");
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namespace: namespace() }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to save your namespace.");
      props.onSaved(json.data.namespace);
      window.dispatchEvent(new CustomEvent("user-namespace-changed", { detail: json.data }));
      dialog.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your namespace.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby="namespace-settings-title" onClose={() => props.onClose()}
      onCancel={(event) => { if (saving()) event.preventDefault(); }}
      class="fixed m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-6 text-white shadow-2xl backdrop:bg-black/70">
      <form onSubmit={save} class="space-y-5">
        <div>
          <h2 id="namespace-settings-title" class="text-xl font-bold">User settings</h2>
          <p class="mt-1 text-sm text-zinc-400">Choose the namespace for your public dashboards.</p>
        </div>
        <div class="space-y-2">
          <label for="user-namespace" class="text-sm font-semibold">Namespace</label>
          <Input ref={namespaceInput} id="user-namespace" autofocus value={namespace()} disabled={loading() || saving()}
            placeholder="my-team" maxLength={NAMESPACE_MAX_LENGTH} autocomplete="off" spellcheck={false}
            aria-describedby="namespace-help" onInput={(event) => { setNamespace(event.currentTarget.value.toLowerCase().trim()); setError(""); }} />
          <p id="namespace-help" class="text-xs text-zinc-400">Lowercase letters, numbers, and hyphens. Must be unique.</p>
          <p class="break-all rounded-lg bg-zinc-900 p-3 font-mono text-xs text-purple-300">/p/{namespace() || "your-namespace"}/dashboard-name</p>
          <Show when={original() && original() !== namespace()}>
            <p class="text-xs text-zinc-400">Changing your namespace updates all your dashboard URLs. Existing ID-based links still work.</p>
          </Show>
        </div>
        <Show when={error()}><p role="alert" class="text-sm text-rose-400">{error()}</p></Show>
        <div class="flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={saving()} onClick={() => dialog.close()}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={loading() || saving()}>{saving() ? "Saving…" : "Save namespace"}</Button>
        </div>
      </form>
    </dialog>
  );
}
