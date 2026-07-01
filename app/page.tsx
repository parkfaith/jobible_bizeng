import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { db } from "@/lib/db";
import { profile, practiceSessions, answerNotes, dailyPatterns } from "@/lib/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import PatternSetCard from "@/components/PatternSetCard";
import PatternSetFetcher from "@/components/PatternSetFetcher";
import WeeklySummaryCard from "@/components/WeeklySummaryCard";
import WeeklySummaryFetcher from "@/components/WeeklySummaryFetcher";
import {
  DAILY_PATTERN_SET_TYPE,
  WEEKLY_SUMMARY_SET_TYPE,
  getKstDate,
  isWeekendKst,
  getWeekSaturdayDate,
  type DailyPatternSet,
  type WeeklySummarySet,
} from "@/lib/pattern-set";

export default async function HomePage() {
  const profileRow = await db.select().from(profile).limit(1);
  if (profileRow.length === 0) redirect("/onboarding");

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekSessions = await db
    .select({ count: sql<number>`count(*)` })
    .from(practiceSessions)
    .where(gte(practiceSessions.startedAt, weekAgo.toISOString()));
  const weekCount = Number(weekSessions[0]?.count ?? 0);

  const noteCount = await db.select({ count: sql<number>`count(*)` }).from(answerNotes);
  const totalNotes = Number(noteCount[0]?.count ?? 0);

  const recentNotes = await db
    .select()
    .from(answerNotes)
    .orderBy(desc(answerNotes.updatedAt))
    .limit(2);

  const today = getKstDate();
  const weekend = isWeekendKst();

  let patternSet: DailyPatternSet | null = null;
  let weeklySummary: WeeklySummarySet | null = null;

  if (weekend) {
    const satDate = getWeekSaturdayDate();
    const weeklyRow = await db
      .select()
      .from(dailyPatterns)
      .where(and(eq(dailyPatterns.date, satDate), eq(dailyPatterns.patternType, WEEKLY_SUMMARY_SET_TYPE)))
      .limit(1);
    weeklySummary = weeklyRow[0]
      ? (JSON.parse(weeklyRow[0].content) as WeeklySummarySet)
      : null;
  } else {
    const patternSetRow = await db
      .select()
      .from(dailyPatterns)
      .where(and(eq(dailyPatterns.date, today), eq(dailyPatterns.patternType, DAILY_PATTERN_SET_TYPE)))
      .limit(1);
    patternSet = patternSetRow[0]
      ? (JSON.parse(patternSetRow[0].content) as DailyPatternSet)
      : null;
  }

  const CATEGORY_LABEL: Record<string, string> = {
    intro: "자기소개",
    career: "경력 설명",
    leadership: "리더십",
    tech: "기술 프로젝트",
    failure: "실패/갈등",
  };

  return (
    <div className="app-shell flex flex-col max-w-md mx-auto bg-slate-950">
      <main className="app-scroll px-4 pt-8 pb-4">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Image
          src="/icons/jobible-bizeng-logo.svg"
          alt="Jobible BizEng"
          width={48}
          height={48}
          className="rounded-2xl shrink-0"
        />
        <div className="flex-1">
          <p className="text-white font-bold text-lg tracking-tight">Jobible BizEng</p>
          <p className="text-slate-500 text-xs">AI 면접 코치</p>
        </div>
        <Link
          href="/profile"
          className="tap-target w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-lg shrink-0"
          title="프로필 수정"
        >
          ⚙️
        </Link>
      </div>

      {/* Primary CTA — 실전 면접 */}
      <Link
        href="/practice/interview"
        className="block w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-2xl px-4 py-4 mb-4 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-indigo-500 rounded-xl flex items-center justify-center text-2xl shrink-0">
            🎙️
          </div>
          <div>
            <p className="text-indigo-200 text-sm font-medium">AI 면접관과 함께</p>
            <p className="text-white text-lg font-bold">음성 실전 면접 시작</p>
            <p className="text-indigo-300 text-xs mt-1">3~4개 질문 · 5~10분</p>
          </div>
        </div>
      </Link>
      {/* Daily warm-up / Weekend summary */}
      <div className="mb-4">
        {weekend ? (
          weeklySummary ? (
            <WeeklySummaryCard data={weeklySummary} />
          ) : (
            <WeeklySummaryFetcher />
          )
        ) : patternSet ? (
          <PatternSetCard data={patternSet} />
        ) : (
          <PatternSetFetcher />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs">이번 주 연습</p>
          <p className="text-white text-2xl font-bold mt-1">{weekCount}회</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs">저장된 답변</p>
          <p className="text-white text-2xl font-bold mt-1">{totalNotes}개</p>
        </div>
      </div>

      {/* Recent Notes */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-slate-300 text-sm font-semibold">최근 저장한 답변</h2>
        <Link href="/notes" className="tap-target flex items-center px-2 -mr-2 text-indigo-400 text-xs">
          전체 보기
        </Link>
      </div>

      {recentNotes.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 text-center">
          <p className="text-slate-500 text-sm">아직 저장된 답변이 없어요</p>
          <p className="text-slate-600 text-xs mt-1">면접 연습 후 좋은 답변을 저장해 보세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {recentNotes.map((note) => (
            <Link
              key={note.id}
              href="/notes"
              className="tap-target bg-slate-800 rounded-xl p-4 border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                  {CATEGORY_LABEL[note.category] ?? note.category}
                </span>
              </div>
              <p className="text-white text-sm font-medium line-clamp-1">{note.questionText}</p>
              {note.finalAnswer && (
                <p className="text-slate-400 text-xs mt-1 line-clamp-2">{note.finalAnswer}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      </main>

      {/* Bottom Nav — flex item (not fixed) to avoid iOS touch-event swallowing */}
      <nav className="bottom-nav shrink-0 bg-slate-900 border-t border-slate-800 flex justify-around pt-3">
        <Link href="/" className="tap-target flex flex-col items-center justify-center gap-1 text-indigo-400">
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
          <span className="text-xs">학습</span>
        </Link>
        <Link href="/stats" className="tap-target flex flex-col items-center justify-center gap-1 text-slate-500">
          <span className="text-xl">📊</span>
          <span className="text-xs">통계</span>
        </Link>
      </nav>
    </div>
  );
}
