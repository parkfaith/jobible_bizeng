"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ExpressionData } from "@/components/ExpressionCard";

type EditableExpression = ExpressionData;

export default function ExpressionsPage() {
  const [data, setData] = useState<EditableExpression | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableExpression | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/expressions/daily")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(data)));
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  async function saveEdit() {
    if (!draft) return;
    setSaving(true);
    const res = await fetch("/api/expressions/daily", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const updated = await res.json();
    setData(updated);
    setDraft(null);
    setEditing(false);
    setSaving(false);
  }

  const d = editing ? draft! : data;

  if (loading || !d) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-slate-400 text-2xl leading-none">←</Link>
        <div className="flex-1">
          <p className="text-amber-400 text-xs font-medium">오늘의 표현</p>
          <h1 className="text-white font-bold text-lg leading-tight">{d.pattern}</h1>
        </div>
        {!editing ? (
          <button
            onClick={startEdit}
            className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700"
          >
            수정
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={cancelEdit}
              className="text-sm text-slate-400 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700"
            >
              취소
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="text-sm text-white px-3 py-1.5 rounded-lg bg-indigo-600 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {/* Pattern + meaning */}
        <Section title="핵심 패턴">
          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                className="field"
                value={draft!.pattern}
                onChange={(e) => setDraft((p) => p && { ...p, pattern: e.target.value })}
                placeholder="패턴 표현"
              />
              <input
                className="field"
                value={draft!.patternMeaning}
                onChange={(e) => setDraft((p) => p && { ...p, patternMeaning: e.target.value })}
                placeholder="한국어 뜻"
              />
            </div>
          ) : (
            <div className="bg-slate-900 rounded-xl p-4">
              <p className="text-white text-base font-semibold">{d.pattern}</p>
              <p className="text-amber-300 text-sm mt-1">{d.patternMeaning}</p>
            </div>
          )}
        </Section>

        {/* When to use */}
        <Section title="사용 시기">
          {editing ? (
            <div className="flex flex-col gap-2">
              {draft!.whenToUse.map((w, i) => (
                <input
                  key={i}
                  className="field"
                  value={w}
                  onChange={(e) =>
                    setDraft((p) => {
                      if (!p) return p;
                      const next = [...p.whenToUse];
                      next[i] = e.target.value;
                      return { ...p, whenToUse: next };
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {d.whenToUse.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span className="text-slate-300 text-sm">{w}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Examples */}
        <Section title="예문 3가지">
          <div className="flex flex-col gap-3">
            {(editing ? draft! : d).examples.map((ex, i) => (
              <div key={i} className="bg-slate-900 rounded-xl p-3">
                {editing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      className="field text-xs"
                      value={draft!.examples[i].situation}
                      placeholder="상황 (한국어)"
                      onChange={(e) =>
                        setDraft((p) => {
                          if (!p) return p;
                          const next = [...p.examples];
                          next[i] = { ...next[i], situation: e.target.value };
                          return { ...p, examples: next };
                        })
                      }
                    />
                    <textarea
                      className="field text-sm resize-none"
                      rows={2}
                      value={draft!.examples[i].sentence}
                      placeholder="영어 예문"
                      onChange={(e) =>
                        setDraft((p) => {
                          if (!p) return p;
                          const next = [...p.examples];
                          next[i] = { ...next[i], sentence: e.target.value };
                          return { ...p, examples: next };
                        })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-slate-500 text-xs mb-1">{ex.situation}</p>
                    <p className="text-white text-sm leading-relaxed">{ex.sentence}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Common mistakes */}
        <Section title="자주 틀리는 표현">
          <div className="flex flex-col gap-2">
            {(editing ? draft! : d).commonMistakes.map((m, i) => (
              <div key={i} className="bg-slate-900 rounded-xl p-3">
                {editing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      className="field text-sm"
                      value={draft!.commonMistakes[i].wrong}
                      placeholder="틀린 표현"
                      onChange={(e) =>
                        setDraft((p) => {
                          if (!p) return p;
                          const next = [...p.commonMistakes];
                          next[i] = { ...next[i], wrong: e.target.value };
                          return { ...p, commonMistakes: next };
                        })
                      }
                    />
                    <input
                      className="field text-sm"
                      value={draft!.commonMistakes[i].correct}
                      placeholder="올바른 표현"
                      onChange={(e) =>
                        setDraft((p) => {
                          if (!p) return p;
                          const next = [...p.commonMistakes];
                          next[i] = { ...next[i], correct: e.target.value };
                          return { ...p, commonMistakes: next };
                        })
                      }
                    />
                    <input
                      className="field text-xs"
                      value={draft!.commonMistakes[i].tipKo ?? ""}
                      placeholder="이유 설명 (한국어)"
                      onChange={(e) =>
                        setDraft((p) => {
                          if (!p) return p;
                          const next = [...p.commonMistakes];
                          next[i] = { ...next[i], tipKo: e.target.value };
                          return { ...p, commonMistakes: next };
                        })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-red-400 text-xs">✗</span>
                      <span className="text-red-300 text-sm line-through opacity-70">{m.wrong}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-green-400 text-xs">✓</span>
                      <span className="text-green-300 text-sm">{m.correct}</span>
                    </div>
                    {m.tipKo && <p className="text-slate-500 text-xs pl-5">{m.tipKo}</p>}
                  </>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Practice prompt */}
        <Section title="ChatGPT 연습 프롬프트">
          {editing ? (
            <textarea
              className="field text-sm resize-none w-full"
              rows={6}
              value={draft!.practicePrompt}
              onChange={(e) => setDraft((p) => p && { ...p, practicePrompt: e.target.value })}
            />
          ) : (
            <div className="bg-slate-900 rounded-xl p-3 relative">
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {d.practicePrompt}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(d.practicePrompt);
                }}
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300"
              >
                복사하기
              </button>
            </div>
          )}
        </Section>
      </div>

      {/* Tailwind field class is set inline via style — apply via globals or just use inline */}
      <style>{`
        .field {
          width: 100%;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: white;
          outline: none;
        }
        .field:focus {
          border-color: #6366f1;
        }
      `}</style>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-slate-400 text-xs font-medium mb-2">{title}</p>
      {children}
    </div>
  );
}
