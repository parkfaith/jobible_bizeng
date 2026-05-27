"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Stop any currently playing audio when a new one starts
let currentAudio: HTMLAudioElement | null = null;

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
    };
  }, []);

  const handleClick = useCallback(async () => {
    // Stop whatever is playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = "";
      currentAudio = null;
    }

    // If this button is playing, toggle it off
    if (state === "playing") {
      setState("idle");
      return;
    }

    setState("loading");

    try {
      let url = audioCache.get(text);

      if (!url) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) throw new Error("tts failed");

        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        setCached(text, url);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      currentAudio = audio;

      audio.onended = () => {
        setState("idle");
        currentAudio = null;
      };
      audio.onerror = () => {
        setState("idle");
        currentAudio = null;
      };

      await audio.play();
      setState("playing");
    } catch {
      setState("idle");
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
