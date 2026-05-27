"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DailyPatternSet, WeeklySummarySet } from "@/lib/pattern-set";
import RevealKo from "@/components/RevealKo";
import SpeakButton from "@/components/SpeakButton";

function isWeekendKstClient() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  return day === 0 || day === 6;
}

// ─── Daily Pattern View ───────────────────────────────────────────────────────

export default function PatternsPage() {
  const [isWeekend] = useState(() => isWeekendKstClient());

  if (isWeekend) return <WeeklyView />;
  return <DailyView />;
}

// ─── Weekly Summary View ──────────────────────────────────────────────────────

function WeeklyView() {
  const [data, setData] = useState<WeeklySummarySet | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/patterns/weekly", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) setError("이번 주 요약을 만들지 못했습니다.");
        else setData(body);
      })
      .catch(() => setError("이번 주 요약을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  async function regenerate() {
    setRegenerating(true);
    setError("");
    try {
      const res = await fetch("/api/patterns/weekly", { method: "POST" });
      const updated = await res.json();
      if (updated.error) setError(updated.error);
      else setData(updated);
    } catch {
      setError("다시 생성하지 못했습니다.");
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-white font-semibold">이번 주 요약을 불러오지 못했습니다</p>
        <p className="text-slate-500 text-sm">{error}</p>
        <button
          onClick={regenerate}
          className="bg-emerald-700 text-white px-5 py-3 rounded-xl text-sm font-semibold"
        >
          다시 생성
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-6 bottom-safe">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/" className="tap-target flex items-center justify-center text-slate-400 text-2xl leading-none">
          ←
        </Link>
        <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-2xl shrink-0">
          📋
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-emerald-400 text-xs font-medium">이번 주 면접 답변 요약</p>
          <h1 className="text-white font-bold text-lg leading-tight">
            {data.weekStart} ~ {data.weekEnd}
          </h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-5">
        <Link
          href="/practice?source=weekly"
          className="tap-target flex-1 rounded-xl bg-emerald-700 text-white text-center text-sm font-semibold flex items-center justify-center py-3"
        >
          주말 3분 리허설
        </Link>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="tap-target px-4 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold border border-slate-700 disabled:opacity-50"
        >
          {regenerating ? "생성 중" : "다시 생성"}
        </button>
      </div>

      <div className="flex flex-col gap-5">
        <WeeklySection title="이번 주 핵심 패턴 3개">
          <div className="flex flex-col gap-3">
            {data.corePatterns.map((p, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                <p className="text-emerald-300 text-xs font-semibold mb-2">Pattern #{i + 1} — {p.from}</p>
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-white text-sm leading-relaxed font-medium">{p.sentence}</p>
                  <SpeakButton text={p.sentence} />
                </div>
                <RevealKo text={p.sentenceKo} />
              </div>
            ))}
          </div>
        </WeeklySection>

        <WeeklySection title="이번 주 주요 면접 질문 3개">
          <div className="flex flex-col gap-2">
            {data.keyQuestions.map((q, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                <p className="text-indigo-300 text-xs font-semibold mb-1">Q{i + 1}</p>
                <p className="text-slate-100 text-sm leading-relaxed">{q}</p>
                <RevealKo text={data.keyQuestionsKo?.[i]} />
              </div>
            ))}
          </div>
        </WeeklySection>

        <WeeklySection title="내가 고칠 점">
          <div className="bg-amber-950/60 border border-amber-800/40 rounded-2xl p-4">
            <p className="text-amber-100 text-sm leading-relaxed">{data.fixThis}</p>
          </div>
        </WeeklySection>

        <WeeklySection title="면접에서 바로 쓸 수 있는 문장 5개">
          <div className="flex flex-col gap-2">
            {data.readySentences.map((s, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-white text-sm leading-relaxed">{s}</p>
                  <RevealKo text={data.readySentencesKo?.[i]} />
                </div>
              </div>
            ))}
          </div>
        </WeeklySection>

        <WeeklySection title="주말 3분 리허설">
          <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-4">
            <p className="text-indigo-200 text-xs mb-2">질문</p>
            <p className="text-white text-sm leading-relaxed">{data.rehearsalQuestion}</p>
            <RevealKo text={data.rehearsalQuestionKo} />
            <p className="text-indigo-300 text-xs font-medium mb-2 mt-4">30초 답변 구조</p>
            <div className="flex flex-col gap-2">
              {data.answerStructure.map((step) => (
                <div key={step.label} className="grid grid-cols-[92px_1fr] gap-2 items-start">
                  <span className="text-indigo-300 text-xs font-semibold pt-0.5">{step.label}</span>
                  <div>
                    <span className="text-slate-100 text-sm leading-relaxed">{step.sentence}</span>
                    <RevealKo text={step.sentenceKo} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Link
            href="/practice?source=weekly"
            className="tap-target mt-3 block w-full py-4 rounded-2xl bg-emerald-700 text-white text-center text-sm font-bold hover:bg-emerald-600 transition-colors"
          >
            지금 말해보기 →
          </Link>
        </WeeklySection>

        <WeeklySection title="더 보기">
          <Link
            href="/review"
            className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-2xl p-4"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg shrink-0">
              🗓️
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-300 text-sm font-semibold">지난 패턴 복습하기</p>
              <p className="text-slate-500 text-xs mt-1">날짜별로 쌓인 패턴을 캘린더에서 다시 봅니다.</p>
            </div>
          </Link>
        </WeeklySection>
      </div>
    </main>
  );
}

function WeeklySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-slate-400 text-xs font-medium mb-2">{title}</p>
      {children}
    </section>
  );
}

// ─── Daily Pattern View ───────────────────────────────────────────────────────

function DailyView() {
  const [data, setData] = useState<DailyPatternSet | null>(null);
  const [draft, setDraft] = useState<DailyPatternSet | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/patterns/daily", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => {
        if (body.error) setError("오늘의 패턴을 만들지 못했습니다.");
        else setData(body);
      })
      .catch(() => setError("오늘의 패턴을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  function startEdit() {
    if (!data) return;
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
    try {
      const res = await fetch("/api/patterns/daily", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const updated = await res.json();
      setData(updated);
      setDraft(null);
      setEditing(false);
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    setError("");
    try {
      const res = await fetch("/api/patterns/daily", { method: "POST" });
      const updated = await res.json();
      if (updated.error) setError("다시 생성하지 못했습니다.");
      else setData(updated);
    } catch {
      setError("다시 생성하지 못했습니다.");
    } finally {
      setRegenerating(false);
    }
  }

  const d = editing ? draft : data;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
      </main>
    );
  }

  if (!d) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-white font-semibold">오늘의 답변 패턴을 불러오지 못했습니다</p>
        <p className="text-slate-500 text-sm">{error}</p>
        <button
          onClick={regenerate}
          className="bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-semibold"
        >
          다시 생성
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-6 bottom-safe">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/" className="tap-target flex items-center justify-center text-slate-400 text-2xl leading-none">
          ←
        </Link>
        <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl shrink-0">
          🧭
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-amber-400 text-xs font-medium">오늘의 답변 패턴</p>
          <h1 className="text-white font-bold text-lg leading-tight">{d.topic}</h1>
          <p className="text-slate-500 text-xs mt-0.5">{d.audience}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {editing ? (
          <>
            <button
              onClick={cancelEdit}
              className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold border border-slate-700"
            >
              취소
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        ) : (
          <>
            <Link
              href="/practice?source=pattern"
              className="tap-target flex-1 rounded-xl bg-indigo-600 text-white text-center text-sm font-semibold flex items-center justify-center py-3"
            >
              이 패턴으로 말하기
            </Link>
            <button
              onClick={startEdit}
              className="tap-target px-4 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold border border-slate-700"
            >
              수정
            </button>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="tap-target px-4 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold border border-slate-700 disabled:opacity-50"
            >
              {regenerating ? "생성 중" : "다시 생성"}
            </button>
          </>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <Section title="핵심 패턴 3개">
          <div className="flex flex-col gap-3">
            {d.patterns.map((pattern, index) => (
              <div key={index} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                {editing ? (
                  <div className="flex flex-col gap-2">
                    <Field
                      value={draft!.patterns[index].sentence}
                      onChange={(value) =>
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.patterns];
                          next[index] = { ...next[index], sentence: value };
                          return { ...prev, patterns: next };
                        })
                      }
                    />
                    <Field
                      value={draft!.patterns[index].meaningKo}
                      onChange={(value) =>
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.patterns];
                          next[index] = { ...next[index], meaningKo: value };
                          return { ...prev, patterns: next };
                        })
                      }
                    />
                    <TextField
                      rows={3}
                      value={draft!.patterns[index].usagePointKo}
                      onChange={(value) =>
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.patterns];
                          next[index] = { ...next[index], usagePointKo: value };
                          return { ...prev, patterns: next };
                        })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-amber-300 text-xs font-semibold mb-2">
                      Practical Pattern #{index + 1}
                    </p>
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-white text-sm leading-relaxed font-medium">
                        {pattern.sentence}
                      </p>
                      <SpeakButton text={pattern.sentence} />
                    </div>
                    <RevealKo text={pattern.meaningKo} />
                    <p className="text-slate-300 text-xs leading-relaxed mt-3 border-t border-slate-700 pt-3">
                      {pattern.usagePointKo}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="자주 틀리는 표현">
          <div className="flex flex-col gap-2">
            {d.mistakes.map((mistake, index) => (
              <div key={index} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                {editing ? (
                  <div className="flex flex-col gap-2">
                    <Field
                      value={draft!.mistakes[index].wrong}
                      onChange={(value) =>
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.mistakes];
                          next[index] = { ...next[index], wrong: value };
                          return { ...prev, mistakes: next };
                        })
                      }
                    />
                    <Field
                      value={draft!.mistakes[index].correct}
                      onChange={(value) =>
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.mistakes];
                          next[index] = { ...next[index], correct: value };
                          return { ...prev, mistakes: next };
                        })
                      }
                    />
                    <Field
                      value={draft!.mistakes[index].tipKo}
                      onChange={(value) =>
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const next = [...prev.mistakes];
                          next[index] = { ...next[index], tipKo: value };
                          return { ...prev, mistakes: next };
                        })
                      }
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-red-300 text-sm line-through opacity-75">{mistake.wrong}</p>
                    <p className="text-green-300 text-sm mt-1">{mistake.correct}</p>
                    <p className="text-slate-500 text-xs mt-2">{mistake.tipKo}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title="쉐도잉">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
            {editing ? (
              <div className="flex flex-col gap-2">
                <Field
                  value={draft!.shadowing.sentence}
                  onChange={(value) =>
                    setDraft((prev) =>
                      prev ? { ...prev, shadowing: { ...prev.shadowing, sentence: value } } : prev
                    )
                  }
                />
                {draft!.shadowing.links.map((link, index) => (
                  <Field
                    key={index}
                    value={link}
                    onChange={(value) =>
                      setDraft((prev) => {
                        if (!prev) return prev;
                        const links = [...prev.shadowing.links];
                        links[index] = value;
                        return { ...prev, shadowing: { ...prev.shadowing, links } };
                      })
                    }
                  />
                ))}
                <TextField
                  rows={3}
                  value={draft!.shadowing.tipKo}
                  onChange={(value) =>
                    setDraft((prev) =>
                      prev ? { ...prev, shadowing: { ...prev.shadowing, tipKo: value } } : prev
                    )
                  }
                />
              </div>
            ) : (
              <>
                <p className="text-white text-sm leading-relaxed font-medium">
                  {d.shadowing.sentence}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {getShadowingLinks(d).map((link) => (
                    <span
                      key={link}
                      className="bg-slate-700 text-amber-200 rounded-lg px-2.5 py-1 text-xs"
                    >
                      {link}
                    </span>
                  ))}
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mt-3">{d.shadowing.tipKo}</p>
              </>
            )}
          </div>
        </Section>

        <Section title="30초 답변 구조">
          <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-4">
            {editing ? (
              <div className="flex flex-col gap-2">
                <Field
                  value={draft!.exercise.question}
                  onChange={(value) =>
                    setDraft((prev) =>
                      prev ? { ...prev, exercise: { ...prev.exercise, question: value } } : prev
                    )
                  }
                />
                {draft!.exercise.structure.map((step, index) => (
                  <div key={index} className="grid grid-cols-[92px_1fr] gap-2">
                    <Field
                      value={step.label}
                      onChange={(value) =>
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const structure = [...prev.exercise.structure];
                          structure[index] = { ...structure[index], label: value };
                          return { ...prev, exercise: { ...prev.exercise, structure } };
                        })
                      }
                    />
                    <Field
                      value={step.sentence}
                      onChange={(value) =>
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const structure = [...prev.exercise.structure];
                          structure[index] = { ...structure[index], sentence: value };
                          return { ...prev, exercise: { ...prev.exercise, structure } };
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="text-indigo-200 text-xs mb-2">Question</p>
                <p className="text-white text-sm leading-relaxed">{d.exercise.question}</p>
                <RevealKo text={d.exercise.questionKo} />
                <div className="flex flex-col gap-2 mt-4">
                  {d.exercise.structure.map((step) => (
                    <div key={step.label} className="grid grid-cols-[92px_1fr] gap-2 items-start">
                      <span className="text-indigo-300 text-xs font-semibold pt-0.5">
                        {step.label}
                      </span>
                      <div>
                        <span className="text-slate-100 text-sm leading-relaxed">
                          {step.sentence}
                        </span>
                        <RevealKo text={step.sentenceKo} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Section>

        <Section title="오늘의 포커스">
          {editing ? (
            <TextField
              rows={3}
              value={draft!.miniFocusKo}
              onChange={(value) => setDraft((prev) => (prev ? { ...prev, miniFocusKo: value } : prev))}
            />
          ) : (
            <p className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-slate-200 text-sm leading-relaxed">
              {d.miniFocusKo}
            </p>
          )}
        </Section>

        <Section title="더 보기">
          <div className="flex flex-col gap-2">
            <Link
              href="/review"
              className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-2xl p-4 hover:bg-slate-700 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg shrink-0">
                🗓️
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-slate-300 text-sm font-semibold">지난 패턴 복습하기</p>
                <p className="text-slate-500 text-xs mt-1">날짜별로 쌓인 패턴을 캘린더에서 다시 봅니다.</p>
              </div>
            </Link>
            <Link
              href="/expressions"
              className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-2xl p-4 hover:bg-slate-700 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-lg shrink-0">
                💬
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-slate-300 text-sm font-semibold">오늘의 표현 카드</p>
                <p className="text-slate-500 text-xs mt-1">핵심 비즈니스 영어 표현을 확인하고 수정합니다.</p>
              </div>
            </Link>
          </div>
        </Section>
      </div>
    </main>
  );
}

function getShadowingLinks(data: DailyPatternSet) {
  const links = data.shadowing.links.filter((link) => !/^https?:\/\//i.test(link));
  if (links.length > 0) return links;

  const words = data.shadowing.sentence
    .replace(/[.,!?]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 4) return [];
  return [
    words.slice(Math.min(3, words.length - 3), Math.min(6, words.length)).join("-"),
    words.slice(Math.max(0, words.length - 4)).join("-"),
  ];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-slate-400 text-xs font-medium mb-2">{title}</p>
      {children}
    </section>
  );
}

function Field({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TextField({
  value,
  onChange,
  rows,
}: {
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <textarea
      rows={rows}
      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-indigo-500"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
