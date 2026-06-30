import Link from "next/link";
import { db } from "@/lib/db";
import { feedbacks, practiceSessions } from "@/lib/db/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function avg(arr: number[]) {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function scoreTrend(scores: number[]): "up" | "flat" | "down" {
  if (scores.length < 4) return "flat";
  const half = Math.floor(scores.length / 2);
  const recent = avg(scores.slice(0, half));
  const older = avg(scores.slice(half));
  if (recent > older + 0.2) return "up";
  if (recent < older - 0.2) return "down";
  return "flat";
}

function ScoreRow({
  label,
  score,
  t,
}: {
  label: string;
  score: number;
  t: "up" | "flat" | "down";
}) {
  const filled = Math.round(score);
  const icon = { up: "↑", flat: "→", down: "↓" }[t];
  const color = { up: "text-green-400", flat: "text-slate-500", down: "text-orange-400" }[t];
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 text-xs w-16 shrink-0">{label}</span>
      <div className="flex gap-1 flex-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`h-2 flex-1 rounded-full ${n <= filled ? "bg-indigo-500" : "bg-slate-700"}`}
          />
        ))}
      </div>
      <span className="text-slate-300 text-xs w-8 text-right font-mono">
        {score.toFixed(1)}
      </span>
      <span className={`text-sm w-4 font-bold ${color}`}>{icon}</span>
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export default async function StatsPage() {
  // 연습 피드백 (점수 있는 것 = daily practice)
  const dailyRows = await db
    .select({
      id: feedbacks.id,
      contentScore: feedbacks.contentScore,
      structureScore: feedbacks.structureScore,
      englishScore: feedbacks.englishScore,
      leadershipScore: feedbacks.leadershipScore,
      feedbackKo: feedbacks.feedbackKo,
      createdAt: feedbacks.createdAt,
    })
    .from(feedbacks)
    .innerJoin(practiceSessions, eq(feedbacks.sessionId, practiceSessions.id))
    .where(isNotNull(feedbacks.contentScore))
    .orderBy(desc(feedbacks.createdAt))
    .limit(20);

  // 실전 면접 피드백
  const interviewRows = await db
    .select({
      id: feedbacks.id,
      bestAnswer: feedbacks.bestAnswer,
      worstAnswer: feedbacks.worstAnswer,
      nextFocus: feedbacks.nextFocus,
      keyExpressions: feedbacks.keyExpressions,
      createdAt: feedbacks.createdAt,
    })
    .from(feedbacks)
    .innerJoin(practiceSessions, eq(feedbacks.sessionId, practiceSessions.id))
    .where(isNotNull(feedbacks.bestAnswer))
    .orderBy(desc(feedbacks.createdAt))
    .limit(5);

  // 총 세션 수
  const [dailyCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(practiceSessions)
    .where(and(eq(practiceSessions.status, "completed"), eq(practiceSessions.mode, "daily")));
  const [interviewCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(practiceSessions)
    .where(and(eq(practiceSessions.status, "completed"), eq(practiceSessions.mode, "interview")));

  // 점수 추출
  const content = dailyRows.map((r) => r.contentScore ?? 0).filter(Boolean);
  const structure = dailyRows.map((r) => r.structureScore ?? 0).filter(Boolean);
  const english = dailyRows.map((r) => r.englishScore ?? 0).filter(Boolean);
  const leadership = dailyRows.map((r) => r.leadershipScore ?? 0).filter(Boolean);

  const hasData = dailyRows.length > 0;
  const hasTrend = dailyRows.length >= 4;

  const SCORE_META = [
    { label: "내용", scores: content },
    { label: "구조", scores: structure },
    { label: "영어", scores: english },
    { label: "리더십 톤", scores: leadership },
  ];

  return (
    <div className="app-shell flex flex-col max-w-md mx-auto bg-slate-950">
      <main className="app-scroll px-4 pt-7 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/" className="tap-target flex items-center justify-center text-slate-400 text-2xl leading-none">
          ←
        </Link>
        <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-2xl shrink-0">
          📊
        </div>
        <div>
          <p className="text-slate-400 text-xs">성장 기록</p>
          <h1 className="text-white font-bold text-lg">나의 통계</h1>
        </div>
      </div>

      {/* 총 연습 횟수 */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
          <p className="text-slate-400 text-xs mb-1">질문 연습</p>
          <p className="text-white text-3xl font-bold">{Number(dailyCount?.count ?? 0)}<span className="text-slate-500 text-base font-normal ml-1">회</span></p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
          <p className="text-slate-400 text-xs mb-1">실전 면접</p>
          <p className="text-white text-3xl font-bold">{Number(interviewCount?.count ?? 0)}<span className="text-slate-500 text-base font-normal ml-1">회</span></p>
        </div>
      </div>

      {/* 평균 점수 */}
      <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-300 text-sm font-semibold">평균 점수</p>
          {hasData && (
            <p className="text-slate-500 text-xs">최근 {dailyRows.length}회 기준</p>
          )}
        </div>

        {hasData ? (
          <div className="flex flex-col gap-3">
            {SCORE_META.map(({ label, scores }) => (
              <ScoreRow
                key={label}
                label={label}
                score={avg(scores)}
                t={hasTrend ? scoreTrend(scores) : "flat"}
              />
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-4">
            질문 연습을 완료하면 점수가 쌓입니다
          </p>
        )}

        {hasData && !hasTrend && (
          <p className="text-slate-600 text-xs mt-4 text-center">
            4회 이상 연습하면 추이(↑↓)가 표시됩니다
          </p>
        )}
      </section>

      {/* 최근 연습 기록 */}
      <section className="mb-5">
        <h2 className="text-slate-400 text-xs font-medium mb-3">최근 질문 연습</h2>

        {dailyRows.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-center">
            <p className="text-slate-500 text-sm">아직 연습 기록이 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {dailyRows.slice(0, 10).map((row) => {
              const scores = [row.contentScore, row.structureScore, row.englishScore, row.leadershipScore];
              const scoreAvg = avg(scores.filter((s): s is number => s !== null));
              return (
                <details key={row.id} className="bg-slate-800 border border-slate-700 rounded-2xl">
                  <summary className="cursor-pointer list-none px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {scores.map((s, i) => (
                          <div
                            key={i}
                            className="flex flex-col gap-0.5"
                            title={["내용", "구조", "영어", "리더십"][i]}
                          >
                            {[5, 4, 3, 2, 1].map((n) => (
                              <div
                                key={n}
                                className={`w-1.5 h-1 rounded-full ${
                                  (s ?? 0) >= n ? "bg-indigo-400" : "bg-slate-700"
                                }`}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-500 text-xs">{formatDate(row.createdAt)}</p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${
                        scoreAvg >= 4 ? "text-green-400" : scoreAvg >= 3 ? "text-indigo-400" : "text-orange-400"
                      }`}>
                        {scoreAvg.toFixed(1)}
                      </span>
                    </div>
                  </summary>
                  <div className="px-4 pb-4 pt-2 border-t border-slate-700">
                    <div className="flex flex-col gap-2 mb-3">
                      {[
                        { label: "내용", s: row.contentScore },
                        { label: "구조", s: row.structureScore },
                        { label: "영어", s: row.englishScore },
                        { label: "리더십 톤", s: row.leadershipScore },
                      ].map(({ label, s }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs w-16">{label}</span>
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map((n) => (
                              <div key={n} className={`h-1.5 w-5 rounded-full ${n <= (s ?? 0) ? "bg-indigo-500" : "bg-slate-700"}`} />
                            ))}
                          </div>
                          <span className="text-slate-400 text-xs">{s ?? "-"}</span>
                        </div>
                      ))}
                    </div>
                    {row.feedbackKo && (
                      <p className="text-slate-400 text-xs leading-relaxed">{row.feedbackKo}</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      {/* 최근 실전 면접 */}
      <section className="mb-5">
        <h2 className="text-slate-400 text-xs font-medium mb-3">최근 실전 면접</h2>

        {interviewRows.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-center">
            <p className="text-slate-500 text-sm">아직 면접 기록이 없습니다</p>
            <Link
              href="/practice/interview"
              className="inline-block mt-3 text-indigo-400 text-xs"
            >
              첫 실전 면접 시작하기 →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {interviewRows.map((row) => {
              type AnswerItem = { question?: string; answer?: string; reasonKo?: string };
              let best: AnswerItem = {};
              let worst: AnswerItem = {};
              let expressions: string[] = [];
              try { if (row.bestAnswer) best = JSON.parse(row.bestAnswer); } catch { /* ignore */ }
              try { if (row.worstAnswer) worst = JSON.parse(row.worstAnswer); } catch { /* ignore */ }
              try { if (row.keyExpressions) expressions = JSON.parse(row.keyExpressions); } catch { /* ignore */ }
              const nextFocus = row.nextFocus ?? "";
              return (
                <details key={row.id} className="bg-slate-800 border border-indigo-900 rounded-2xl">
                  <summary className="cursor-pointer list-none px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-indigo-400 text-base">🎙️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-500 text-xs">{formatDate(row.createdAt)}</p>
                        {best.question && (
                          <p className="text-slate-300 text-sm line-clamp-1 mt-0.5">
                            {best.question}
                          </p>
                        )}
                      </div>
                    </div>
                  </summary>
                  <div className="px-4 pb-4 pt-2 border-t border-slate-700 flex flex-col gap-4">
                    {best.answer && (
                      <div>
                        <p className="text-green-400 text-xs font-semibold mb-1">가장 좋았던 답변</p>
                        <p className="text-slate-400 text-xs mb-1">{best.question}</p>
                        <p className="text-slate-200 text-sm leading-relaxed">{best.answer}</p>
                        {best.reasonKo && (
                          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{best.reasonKo}</p>
                        )}
                      </div>
                    )}
                    {worst.answer && (
                      <div>
                        <p className="text-red-400 text-xs font-semibold mb-1">가장 위험했던 답변</p>
                        <p className="text-slate-400 text-xs mb-1">{worst.question}</p>
                        <p className="text-slate-200 text-sm leading-relaxed">{worst.answer}</p>
                        {worst.reasonKo && (
                          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{worst.reasonKo}</p>
                        )}
                      </div>
                    )}
                    {nextFocus && (
                      <div className="bg-orange-950/50 border border-orange-800/40 rounded-xl px-3 py-2.5">
                        <p className="text-orange-400 text-xs font-semibold mb-1">다음에 반드시 고칠 것</p>
                        <p className="text-orange-100 text-sm leading-relaxed">{nextFocus}</p>
                      </div>
                    )}
                    {expressions.length > 0 && (
                      <div>
                        <p className="text-indigo-400 text-xs font-semibold mb-2">바로 쓸 수 있는 표현</p>
                        <div className="flex flex-col gap-1.5">
                          {expressions.map((expr, i) => (
                            <p key={i} className="text-slate-200 text-sm leading-relaxed">
                              <span className="text-indigo-400 text-xs font-semibold mr-1.5">{i + 1}</span>
                              {expr}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      </main>

      {/* Bottom Nav — flex item (not fixed) to avoid iOS touch-event swallowing */}
      <nav className="bottom-nav shrink-0 bg-slate-900 border-t border-slate-800 flex justify-around pt-3">
        <Link href="/" className="tap-target flex flex-col items-center justify-center gap-1 text-slate-500">
          <span className="text-xl">🏠</span>
          <span className="text-xs">홈</span>
        </Link>
        <Link href="/practice/interview" className="tap-target flex flex-col items-center justify-center gap-1 text-slate-500">
          <span className="text-xl">🎙️</span>
          <span className="text-xs">면접</span>
        </Link>
        <Link href="/notes" className="tap-target flex flex-col items-center justify-center gap-1 text-slate-500">
          <span className="text-xl">📓</span>
          <span className="text-xs">답변 노트</span>
        </Link>
        <Link href="/review" className="tap-target flex flex-col items-center justify-center gap-1 text-slate-500">
          <span className="text-xl">🗓️</span>
          <span className="text-xs">복습</span>
        </Link>
        <Link href="/stats" className="tap-target flex flex-col items-center justify-center gap-1 text-indigo-400">
          <span className="text-xl">📊</span>
          <span className="text-xs">통계</span>
        </Link>
      </nav>
    </div>
  );
}
