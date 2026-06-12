"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!navigating) return;

    const timeout = window.setTimeout(() => {
      setNavigating(false);
      setLoading(false);
      setError("홈 화면 이동이 지연되고 있습니다. 다시 시도해 주세요.");
    }, 12000);

    return () => window.clearTimeout(timeout);
  }, [navigating]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setNavigating(true);
        router.replace("/");
        return;
      } else {
        const data = await res.json();
        setError(data.error ?? "로그인에 실패했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    }
    setLoading(false);
  }

  if (navigating) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 gap-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">홈 화면을 여는 중...</p>
      </div>
    );
  }

  return (
    <main className="min-h-full bg-slate-950 flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/icons/jobible-bizeng-logo.svg"
            alt="Jobible BizEng"
            width={64}
            height={64}
            priority
            className="mb-4 rounded-2xl"
          />
          <h1 className="text-white text-2xl font-bold">Jobible BizEng</h1>
          <p className="text-slate-500 text-sm mt-1">영어 면접 코치</p>
        </div>

        <PwaInstallPrompt />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-slate-400 text-xs font-medium block mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoFocus
              autoComplete="current-password"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-base focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base disabled:opacity-50 active:scale-[0.99] transition-all"
          >
            {loading ? "확인 중..." : "시작하기"}
          </button>
        </form>
      </div>
    </main>
  );
}
