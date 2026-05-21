"use client";

import { useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("jb_install_prompt_dismissed") === "1";
  });

  const isIos = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setStandalone(isStandalone());
    };

    const onAppInstalled = () => {
      setStandalone(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (standalone || dismissed) return null;
  if (!installEvent && !isIos) return null;

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstallEvent(null);
      setStandalone(true);
    }
  }

  function close() {
    window.localStorage.setItem("jb_install_prompt_dismissed", "1");
    setDismissed(true);
  }

  return (
    <section className="mb-4 rounded-2xl border border-emerald-700 bg-emerald-950/60 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-lg">
          ⬇
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-100">Jobible BizEng 설치</p>
          <p className="mt-0.5 text-xs leading-relaxed text-emerald-300">
            {installEvent
              ? "브라우저에서 앱처럼 열 수 있습니다."
              : "공유 버튼을 누른 뒤 홈 화면에 추가를 선택하세요."}
          </p>
        </div>
        {installEvent && (
          <button
            type="button"
            onClick={install}
            className="tap-target rounded-xl bg-emerald-500 px-3 text-sm font-semibold text-slate-950"
          >
            설치
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="설치 안내 닫기"
          className="tap-target rounded-xl px-2 text-lg text-emerald-300"
        >
          ×
        </button>
      </div>
    </section>
  );
}
