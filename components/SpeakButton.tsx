"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Module-level singletons — shared across all SpeakButton instances on the page
let activeAudio: HTMLAudioElement | null = null;
let activeFetchCtrl: AbortController | null = null;
// setState of the currently preparing/ready/playing button, to reset its UI when another takes over
let activeSetState: ((s: State) => void) | null = null;

function stopActive() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
  if (activeFetchCtrl) {
    activeFetchCtrl.abort();
    activeFetchCtrl = null;
  }
  activeSetState?.("idle");
  activeSetState = null;
}

// Session-level blob URL cache: text → objectURL (FIFO, max 30 entries)
const audioCache = new Map<string, string>();
const CACHE_MAX = 30;

function setCached(text: string, url: string) {
  if (audioCache.size >= CACHE_MAX) {
    const oldest = audioCache.keys().next().value!;
    URL.revokeObjectURL(audioCache.get(oldest)!);
    audioCache.delete(oldest);
  }
  audioCache.set(text, url);
}

// State machine:
//   idle ──tap (cache hit) ──────────────────────► playing ──end/stop──► idle
//   idle ──tap (cache miss)──► preparing ──done──► ready ──tap──────────► playing
//   any ──error──► error ──1.5 s──► idle
type State = "idle" | "preparing" | "ready" | "playing" | "error";

export default function SpeakButton({ text }: { text: string }) {
  const [state, setState] = useState<State>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      if (activeSetState === setState) {
        activeFetchCtrl?.abort();
        activeFetchCtrl = null;
        activeSetState = null;
        activeAudio = null;
      }
    };
  }, []);

  const handleClick = useCallback(() => {
    // Playing: toggle off
    if (state === "playing") {
      stopActive();
      return;
    }

    // Preparing: ignore duplicate taps while fetch is in flight
    if (state === "preparing") return;

    // Ready: play directly from this user gesture (no await before audio.play())
    // iOS Safari safe — audio.play() is called synchronously within the event handler.
    if (state === "ready") {
      const url = audioCache.get(text);
      if (!url) { setState("idle"); return; }

      if (activeSetState !== setState) stopActive();

      const audio = new Audio(url);
      audioRef.current = audio;
      activeAudio = audio;
      activeSetState = setState;

      const onError = () => {
        if (activeSetState === setState) { activeAudio = null; activeSetState = null; }
        setState("error");
        setTimeout(() => setState((s) => (s === "error" ? "idle" : s)), 1500);
      };
      audio.onended = () => {
        if (activeSetState === setState) { activeAudio = null; activeSetState = null; }
        setState("idle");
      };
      audio.onerror = onError;
      audio.play().catch(onError); // synchronous within user gesture ✓
      setState("playing");
      return;
    }

    // Idle / Error: stop whatever is active and start a new flow
    stopActive();

    const cached = audioCache.get(text);
    if (cached) {
      // Cache hit — play directly within this user gesture (no await, iOS Safari safe)
      const audio = new Audio(cached);
      audioRef.current = audio;
      activeAudio = audio;
      activeSetState = setState;

      const onError = () => {
        if (activeSetState === setState) { activeAudio = null; activeSetState = null; }
        setState("error");
        setTimeout(() => setState((s) => (s === "error" ? "idle" : s)), 1500);
      };
      audio.onended = () => {
        if (activeSetState === setState) { activeAudio = null; activeSetState = null; }
        setState("idle");
      };
      audio.onerror = onError;
      audio.play().catch(onError); // synchronous within user gesture ✓
      setState("playing");
      return;
    }

    // Cache miss — fetch TTS then surface "ready" so the user's next tap plays
    // from a fresh user gesture, satisfying iOS Safari's autoplay policy.
    setState("preparing");

    const ctrl = new AbortController();
    activeFetchCtrl = ctrl;
    activeSetState = setState;

    void (async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: ctrl.signal,
        });

        if (!res.ok) throw new Error("tts failed");

        const blob = await res.blob();

        // Abort may have been called between the last await and here
        if (ctrl.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        setCached(text, url);
        if (activeFetchCtrl === ctrl) activeFetchCtrl = null;

        // Only update UI if this button is still the active one
        if (activeSetState === setState) setState("ready");
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        if (activeFetchCtrl === ctrl) activeFetchCtrl = null;
        if (activeSetState === setState) {
          activeSetState = null;
          setState("error");
          setTimeout(() => setState((s) => (s === "error" ? "idle" : s)), 1500);
        }
      }
    })();
  }, [text, state]);

  return (
    <button
      onClick={handleClick}
      aria-label={
        state === "playing" ? "재생 중단" :
        state === "ready" ? "탭해서 재생" :
        "문장 듣기"
      }
      className="tap-target shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
    >
      {state === "preparing" ? (
        <span className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
      ) : state === "ready" ? (
        <span className="text-emerald-400 text-[13px] leading-none">▶</span>
      ) : state === "playing" ? (
        <span className="text-amber-400 text-[13px] leading-none">⏹</span>
      ) : state === "error" ? (
        <span className="text-red-400 text-[13px] leading-none">⚠</span>
      ) : (
        <span className="text-slate-300 text-[13px] leading-none">🔊</span>
      )}
    </button>
  );
}
