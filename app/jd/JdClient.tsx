"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface JdListItem {
  id: number;
  company: string;
  position: string;
  summaryKo: string;
  createdAt: string | null;
}

export default function JdClient({ initialPostings }: { initialPostings: JdListItem[] }) {
  const router = useRouter();
  const [postings, setPostings] = useState<JdListItem[]>(initialPostings);
  const [rawText, setRawText] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function analyze() {
    if (!rawText.trim() || analyzing) return;
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          company: company.trim() || undefined,
          position: position.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "분석에 실패했습니다.");
      setPostings((prev) => [
        {
          id: body.id,
          company: body.company,
          position: body.position,
          summaryKo: body.summary?.summaryKo ?? "",
          createdAt: body.createdAt,
        },
        ...prev,
      ]);
      setRawText("");
      setCompany("");
      setPosition("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function archive(id: number) {
    setDeletingId(id);
    try {
      await fetch(`/api/jd?id=${id}`, { method: "DELETE" });
      setPostings((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 등록 폼 */}
      <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <p className="text-slate-300 text-sm font-semibold mb-3">새 공고 등록</p>
        <div className="flex gap-2 mb-2">
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="회사명 (선택)"
            className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
          />
          <input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="포지션 (선택)"
            className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500"
          />
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={7}
          placeholder="채용공고 내용을 붙여넣으세요 (요구사항·주요 업무 중심)"
          className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-sky-500"
        />
        {error && <p className="text-red-300 text-xs mt-2 leading-relaxed">{error}</p>}
        <button
          onClick={analyze}
          disabled={!rawText.trim() || analyzing}
          className={`w-full mt-3 py-3.5 rounded-xl font-semibold text-sm transition-colors ${
            analyzing || !rawText.trim()
              ? "bg-slate-700 text-slate-400"
              : "bg-sky-600 text-white hover:bg-sky-500"
          }`}
        >
          {analyzing ? "분석 중..." : "분석하고 저장"}
        </button>
      </section>

      {/* 저장된 공고 */}
      {postings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <span className="text-4xl">📋</span>
          <p className="text-slate-400 text-sm font-medium">등록된 공고가 없어요</p>
          <p className="text-slate-600 text-xs text-center">
            지원할 공고를 등록하면 그 포지션 기준으로
            <br />
            맞춤 모의면접을 진행합니다
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {postings.map((jd) => (
            <div key={jd.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-white text-sm font-semibold">{jd.position}</p>
                  <p className="text-sky-300 text-xs mt-0.5">{jd.company}</p>
                </div>
                <button
                  onClick={() => archive(jd.id)}
                  disabled={deletingId === jd.id}
                  className="tap-target text-slate-500 text-xs shrink-0 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  {deletingId === jd.id ? "..." : "삭제"}
                </button>
              </div>
              {jd.summaryKo && (
                <p className="text-slate-300 text-xs leading-relaxed mb-3">{jd.summaryKo}</p>
              )}
              <Link
                href={`/practice/interview?jdId=${jd.id}`}
                className="w-full min-h-11 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold text-center flex items-center justify-center hover:bg-sky-500 transition-colors"
              >
                🎙️ 이 공고로 면접 보기
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
