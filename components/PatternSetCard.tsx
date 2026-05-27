"use client";

import Link from "next/link";
import type { DailyPatternSet } from "@/lib/pattern-set";
import RevealKo from "@/components/RevealKo";
import SpeakButton from "@/components/SpeakButton";

export default function PatternSetCard({ data }: { data: DailyPatternSet }) {
  return (
    <section className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-amber-400 text-xs font-medium">30초 답변 워밍업</p>
            <h2 className="text-white text-base font-bold leading-snug mt-0.5">{data.topic}</h2>
          </div>
          <Link
            href="/patterns"
            className="tap-target shrink-0 text-xs text-slate-400 hover:text-slate-200 px-3 rounded-lg bg-slate-900 flex items-center"
          >
            전체
          </Link>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          {data.patterns.map((pattern, index) => (
            <div key={pattern.sentence} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-semibold">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-slate-100 text-sm leading-relaxed">{pattern.sentence}</p>
                  <SpeakButton text={pattern.sentence} />
                </div>
                <RevealKo text={pattern.meaningKo} />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 rounded-xl px-3 py-2.5 mb-3">
          <p className="text-slate-500 text-xs mb-1">오늘의 질문</p>
          <p className="text-slate-200 text-sm leading-relaxed">{data.exercise.question}</p>
          <RevealKo text={data.exercise.questionKo} />
        </div>

        <div className="flex gap-2">
          <Link
            href="/practice?source=pattern"
            className="tap-target flex-1 rounded-xl bg-indigo-600 text-white text-center text-sm font-semibold hover:bg-indigo-500 transition-colors flex items-center justify-center"
          >
            30초 답변 연습
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
