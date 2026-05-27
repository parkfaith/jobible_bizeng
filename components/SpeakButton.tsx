"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Module-level singletons shared across all SpeakButton instances
let activeAudio: HTMLAudioElement | null = null;
let activeFetchCtrl: AbortController | null = null;
// Callback to reset the currently loading/playing button's UI to idle
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

// Session-level cache: text → blob URL (FIFO, max 30 entries)
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

// Minimal silent WAV — played synchronously on user tap to unlock iOS Safari
// audio context before the async TTS fetch begins.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

type State = "idle" | "loading" | "playing";

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
      // Clean up module-level references if this instance is the active one
      if (activeSetState === setState) {
        activeFetchCtrl?.abort();
        activeFetchCtrl = null;
        activeSetState = null;
        activeAudio = null;
      }
    };
  }, []);

  const handleClick = useCallback(async () => {
    // Ignore extra taps while already loading (prevents duplicate fetches)
    if (state === "loading") return;

    // Toggle off if this button is currently playing
    if (state === "playing") {
      stopActive();
      return;
    }

    // Stop any other button that is loading or playing
    stopActive();

    setState("loading");

    // Unlock iOS Safari audio context synchronously from user gesture,
    // before any await. Without this, audio.play() after a network fetch
    // is rejected as not originating from a user gesture.
    new Audio(SILENT_WAV).play().catch(() => {});

    const ctrl = new AbortController();
    activeFetchCtrl = ctrl;
    activeSetState = setState;

    try {
      let url = audioCache.get(text);

      if (!url) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: ctrl.signal,
        });

        if (!res.ok) throw new Error("tts failed");

        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        setCached(text, url);
      }

      // Fetch complete — clear fetch controller, keep setState registration
      if (activeFetchCtrl === ctrl) activeFetchCtrl = null;

      const audio = new Audio(url);
      audioRef.current = audio;
      activeAudio = audio;

      audio.onended = () => {
        if (activeSetState === setState) {
          activeSetState = null;
          activeAudio = null;
        }
        setState("idle");
      };
      audio.onerror = () => {
        if (activeSetState === setState) {
          activeSetState = null;
          activeAudio = null;
        }
        setState("idle");
      };

      await audio.play();
      setState("playing");
    } catch (err) {
      // AbortError: stopActive() was called by another button — state already reset
      if ((err as { name?: string }).name !== "AbortError") {
        setState("idle");
      }
      if (activeFetchCtrl === ctrl) activeFetchCtrl = null;
      if (activeSetState === setState) activeSetState = null;
    }
  }, [text, state]);

  return (
    <button
      onClick={handleClick}
      aria-label={state === "playing" ? "재생 중단" : "문장 듣기"}
      className="tap-target shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
    >
      {state === "loading" ? (
        <span className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
      ) : state === "playing" ? (
        <span className="text-amber-400 text-[13px] leading-none">⏹</span>
      ) : (
        <span className="text-slate-300 text-[13px] leading-none">🔊</span>
      )}
    </button>
  );
}
