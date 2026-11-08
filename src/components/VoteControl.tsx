import { createSignal, createEffect, on, Show } from "solid-js";
import {
  type VoteSummary,
  type VoteValue,
  EMPTY_VOTE_SUMMARY,
  nextVoteValue,
  applyVoteChange,
} from "~/lib/votes";

export interface VoteControlProps {
  endpoint: string;
  votes?: VoteSummary;
  size?: "sm" | "md";
  onChange?: (next: VoteSummary) => void;
}

export default function VoteControl(props: VoteControlProps) {
  const [state, setState] = createSignal<VoteSummary>(props.votes || EMPTY_VOTE_SUMMARY);
  const [busy, setBusy] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  createEffect(
    on(
      () => props.votes,
      (incoming) => {
        if (incoming) setState(incoming);
      },
      { defer: true }
    )
  );

  const canVote = () => state().canVote;
  const isUpvoted = () => state().myVote === 1;
  const isDownvoted = () => state().myVote === -1;

  const handleVote = async (e: MouseEvent, targetDirection: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canVote()) {
      setErrorMessage("Please log in to vote.");
      setTimeout(() => setErrorMessage(null), 2500);
      return;
    }

    if (busy()) return;

    const current = state();
    const nextVal: VoteValue = nextVoteValue(current.myVote, targetDirection);
    const optimistic = applyVoteChange(current, nextVal);

    // Optimistic UI update
    setState(optimistic);
    props.onChange?.(optimistic);
    setBusy(true);
    setErrorMessage(null);

    try {
      const res = await fetch(props.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: nextVal }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        // Rollback on failure
        setState(current);
        props.onChange?.(current);
        setErrorMessage(json?.error || "Vote failed");
        setTimeout(() => setErrorMessage(null), 3000);
      } else if (json?.data) {
        // Server authoritative summary
        setState(json.data);
        props.onChange?.(json.data);
      }
    } catch {
      // Rollback on network error
      setState(current);
      props.onChange?.(current);
      setErrorMessage("Network error");
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setBusy(false);
    }
  };

  const isMd = () => props.size === "md";

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      class="relative inline-flex items-center select-none"
    >
      <div
        class={`inline-flex items-center rounded-lg border backdrop-blur-md transition-all duration-200 ${
          isMd() ? "h-9 px-1 gap-1 border-zinc-700/80 bg-zinc-900/90 text-sm shadow-md" : "h-7 px-0.5 gap-0.5 border-zinc-800/80 bg-zinc-950/80 text-xs"
        }`}
      >
        {/* Upvote Button */}
        <button
          type="button"
          disabled={busy()}
          onClick={(e) => handleVote(e, 1)}
          aria-label="Upvote"
          aria-pressed={isUpvoted()}
          title={canVote() ? (isUpvoted() ? "Remove upvote" : "Upvote") : "Log in to vote"}
          class={`flex items-center justify-center rounded transition-all duration-150 min-h-[44px] min-w-[28px] sm:min-h-0 sm:min-w-0 ${
            isMd() ? "h-7 w-7" : "h-6 w-6"
          } ${
            isUpvoted()
              ? "bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40 shadow-sm"
              : canVote()
                ? "text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 active:scale-95"
                : "text-zinc-600 hover:text-zinc-500 cursor-not-allowed opacity-60"
          }`}
        >
          <svg
            class={isMd() ? "w-3.5 h-3.5" : "w-3 h-3"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width={isUpvoted() ? "3" : "2.5"}
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        {/* Score Display */}
        <span
          class={`font-mono font-bold text-center transition-colors min-w-[1.5rem] px-1 ${
            isMd() ? "text-xs" : "text-[11px]"
          } ${
            state().score > 0
              ? "text-emerald-400"
              : state().score < 0
                ? "text-red-400"
                : "text-zinc-400"
          }`}
          title={`Score: ${state().score} (${state().up} up, ${state().down} down)`}
        >
          {state().score > 0 ? `+${state().score}` : state().score}
        </span>

        {/* Downvote Button */}
        <button
          type="button"
          disabled={busy()}
          onClick={(e) => handleVote(e, -1)}
          aria-label="Downvote"
          aria-pressed={isDownvoted()}
          title={canVote() ? (isDownvoted() ? "Remove downvote" : "Downvote") : "Log in to vote"}
          class={`flex items-center justify-center rounded transition-all duration-150 min-h-[44px] min-w-[28px] sm:min-h-0 sm:min-w-0 ${
            isMd() ? "h-7 w-7" : "h-6 w-6"
          } ${
            isDownvoted()
              ? "bg-red-500/20 text-red-400 font-bold border border-red-500/40 shadow-sm"
              : canVote()
                ? "text-zinc-400 hover:text-red-400 hover:bg-red-500/10 active:scale-95"
                : "text-zinc-600 hover:text-zinc-500 cursor-not-allowed opacity-60"
          }`}
        >
          <svg
            class={isMd() ? "w-3.5 h-3.5" : "w-3 h-3"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width={isDownvoted() ? "3" : "2.5"}
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Floating Error / Login Prompt Tooltip */}
      <Show when={errorMessage()}>
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] text-amber-300 whitespace-nowrap shadow-xl z-50 animate-in fade-in">
          {errorMessage()}
        </div>
      </Show>
    </div>
  );
}
