"use client";

import { useState } from "react";
import Link from "next/link";

interface Example {
  situation: string;
  sentence: string;
}

interface Mistake {
  wrong: string;
  correct: string;
  tipKo?: string;
}

export interface ExpressionData {
  pattern: string;
  patternMeaning: string;
  whenToUse: string[];
  examples: Example[];
  commonMistakes: Mistake[];
  practicePrompt: string;
}

export default function ExpressionCard({ data }: { data: ExpressionData }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(data.practicePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full text-left px-5 py-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-amber-400">오늘의 표현</span>
          <div className="flex items-center gap-2">
            <Link
              href="/expressions"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              수정
            </Link>
            <span className="text-slate-500 text-lg">{expanded ? "∧" : "∨"}</span>
          </div>
        </div>
        <p className="text-white font-semibold text-base">{data.pattern}</p>
        <p className="text-slate-400 text-xs mt-0.5">{data.patternMeaning}</p>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-700 px-5 py-4 flex flex-col gap-5">
          {/* When to use */}
          <div>
            <p className="text-slate-400 text-xs font-medium mb-2">사용 시기</p>
            <div className="flex flex-col gap-1">
              {data.whenToUse.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-amber-400 text-xs mt-0.5">•</span>
                  <span className="text-slate-300 text-sm">{w}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Examples */}
          <div>
            <p className="text-slate-400 text-xs font-medium mb-2">예문</p>
            <div className="flex flex-col gap-3">
              {data.examples.map((ex, i) => (
                <div key={i} className="bg-slate-900 rounded-xl p-3">
                  <p className="text-slate-500 text-xs mb-1">{ex.situation}</p>
                  <p className="text-white text-sm leading-relaxed">{ex.sentence}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Common mistakes */}
          {data.commonMistakes.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs font-medium mb-2">자주 틀리는 표현</p>
              <div className="flex flex-col gap-2">
                {data.commonMistakes.map((m, i) => (
                  <div key={i} className="bg-slate-900 rounded-xl p-3 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-red-400 text-xs w-4 shrink-0">✗</span>
                      <span className="text-red-300 text-sm line-through opacity-70">
                        {m.wrong}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 text-xs w-4 shrink-0">✓</span>
                      <span className="text-green-300 text-sm">{m.correct}</span>
                    </div>
                    {m.tipKo && (
                      <p className="text-slate-500 text-xs pl-6">{m.tipKo}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Practice prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-xs font-medium">ChatGPT 연습 프롬프트</p>
              <button
                onClick={copyPrompt}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {copied ? "복사됨 ✓" : "복사"}
              </button>
            </div>
            <div className="bg-slate-900 rounded-xl p-3">
              <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                {data.practicePrompt}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
