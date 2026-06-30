"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MIN_VISIBLE_MS = 250;
const FALLBACK_HIDE_MS = 8000;
const SHOW_DELAY_MS = 80;

// 하단 nav 터치 이슈 격리용 플래그 — NEXT_PUBLIC_DISABLE_ROUTE_PROGRESS=1이면
// 전역 capture click 리스너와 진행바 렌더를 모두 끈다. nav 터치 문제가 이때 사라지면
// RouteProgress가 원인. (현 구현은 preventDefault/stopPropagation을 호출하지 않아 가능성 낮음)
const DISABLED = process.env.NEXT_PUBLIC_DISABLE_ROUTE_PROGRESS === "1";

function isPlainLeftClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export default function RouteProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const shownAtRef = useRef(0);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (DISABLED) return;

    function clearTimers() {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
    }

    function showProgress() {
      clearTimers();
      shownAtRef.current = Date.now();
      setPending(true);
      fallbackTimerRef.current = window.setTimeout(() => setPending(false), FALLBACK_HIDE_MS);
    }

    function handleClick(event: MouseEvent) {
      if (!isPlainLeftClick(event)) return;
      if (event.defaultPrevented) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target || link.hasAttribute("download")) return;

      const nextUrl = new URL(link.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.origin !== currentUrl.origin) return;
      if (nextUrl.href === currentUrl.href) return;

      showTimerRef.current = window.setTimeout(showProgress, SHOW_DELAY_MS);
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("pageshow", clearTimers);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("pageshow", clearTimers);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (!pending) return;

    const elapsed = Date.now() - shownAtRef.current;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
    hideTimerRef.current = window.setTimeout(() => setPending(false), delay);

    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [pathname, pending]);

  if (DISABLED || !pending) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[120]">
      <div className="h-[calc(env(safe-area-inset-top)+3px)] bg-slate-950">
        <div className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden bg-slate-800">
          <div className="h-full w-1/2 animate-route-progress rounded-full bg-indigo-400" />
        </div>
      </div>
      <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs font-medium text-slate-200 shadow-lg shadow-slate-950/40 backdrop-blur">
        <span className="h-3 w-3 rounded-full border-2 border-indigo-300 border-t-transparent animate-spin" />
        화면을 여는 중...
      </div>
    </div>
  );
}
