"use client";

import Link from "next/link";
import type { WeeklySummarySet } from "@/lib/pattern-set";
import RevealKo from "@/components/RevealKo";

export default function WeeklySummaryCard({ data }: { data: WeeklySummarySet }) {
  return (
    <section className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-emerald-400 text-xs font-medium">이번 주 면접 답변 요약</p>
            <h2 className="text-white text-base font-bold leading-snug mt-0.5">
              {data.weekStart} ~ {data.weekEnd}
            </h2>
          </div>
          <Link
            href="/patterns"
            className="tap-target shrink-0 text-xs text-slate-400 hover:text-slate-200 px-3 rounded-lg bg-slate-900 flex items-center"
          >
            전체
          </Link>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          <p className="text-slate-400 text-xs font-medium">이번 주 핵심 패턴 3개</p>
          {data.corePatterns.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-slate-100 text-sm leading-relaxed">{p.sentence}</p>
                <RevealKo text={p.sentenceKo} />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-amber-950/60 border border-amber-800/40 rounded-xl px-3 py-2.5 mb-3">
          <p className="text-amber-400 text-xs font-medium mb-1">내가 고칠 점</p>
          <p className="text-amber-100 text-sm leading-relaxed line-clamp-2">{data.fixThis}</p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/practice?source=weekly"
            className="tap-target flex-1 rounded-xl bg-emerald-700 text-white text-center text-sm font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center"
          >
            주말 3분 리허설
          </Link>
          <Link
            href="/patterns"
            className="tap-target px-4 rounded-xl bg-slate-700 text-slate-200 text-sm font-semibold hover:bg-slate-600 transition-colors flex items-center justify-center"
          >
            보기
          </Link>
        </div>
      </div>
    </section>
  );
}
