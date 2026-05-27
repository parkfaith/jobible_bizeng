import Link from "next/link";
import { desc, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyPatterns } from "@/lib/db/schema";
import {
  DAILY_PATTERN_SET_TYPE,
  WEEKLY_SUMMARY_SET_TYPE,
  getKstDate,
  type DailyPatternSet,
  type WeeklySummarySet,
} from "@/lib/pattern-set";

export const dynamic = "force-dynamic";

type ReviewItem =
  | { kind: "daily"; id: number; date: string; data: DailyPatternSet }
  | { kind: "weekly"; id: number; date: string; data: WeeklySummarySet };

export default async function ReviewPage() {
  const rows = await db
    .select()
    .from(dailyPatterns)
    .where(or(eq(dailyPatterns.patternType, DAILY_PATTERN_SET_TYPE), eq(dailyPatterns.patternType, WEEKLY_SUMMARY_SET_TYPE)))
    .orderBy(desc(dailyPatterns.date))
    .limit(60);

  const items: ReviewItem[] = rows.map((row) => {
    if (row.patternType === WEEKLY_SUMMARY_SET_TYPE) {
      return {
        kind: "weekly",
        id: row.id,
        date: row.date,
        data: JSON.parse(row.content) as WeeklySummarySet,
      };
    }
    return {
      kind: "daily",
      id: row.id,
      date: row.date,
      data: JSON.parse(row.content) as DailyPatternSet,
    };
  });

  const dailyDateSet = new Set(
    items.filter((i) => i.kind === "daily").map((i) => i.date)
  );
  const weeklyDateSet = new Set(
    items.filter((i) => i.kind === "weekly").map((i) => i.date)
  );

  const todayKst = getKstDate();
  const monthDays = buildMonthDays(dailyDateSet, weeklyDateSet, todayKst);

  const dailyCount = dailyDateSet.size;
  const weeklyCount = weeklyDateSet.size;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-7 bottom-safe">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/" className="tap-target flex items-center justify-center text-slate-400 text-2xl leading-none">
          ←
        </Link>
        <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl shrink-0">
          🗓️
        </div>
        <div>
          <p className="text-slate-400 text-xs">패턴 복습</p>
          <h1 className="text-white font-bold text-lg">학습 캘린더</h1>
        </div>
      </div>

      <section className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white text-sm font-semibold">{formatMonth(todayKst)}</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-slate-500 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />
              일별 {dailyCount}
            </span>
            <span className="flex items-center gap-1 text-slate-500 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-300 inline-block" />
              주간 {weeklyCount}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <p key={day} className="text-center text-slate-500 text-[11px]">
              {day}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {monthDays.map((day, index) =>
            day ? (
              <div
                key={day.date}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center border ${
                  day.hasWeekly
                    ? "bg-emerald-500/15 border-emerald-500/30 text-white"
                    : day.hasPattern
                    ? "bg-amber-500/15 border-amber-500/30 text-white"
                    : "bg-slate-900 border-slate-800 text-slate-600"
                }`}
              >
                <span className="text-xs font-medium">{day.label}</span>
                {day.hasWeekly && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-300" />}
                {!day.hasWeekly && day.hasPattern && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-300" />}
              </div>
            ) : (
              <div key={`empty-${index}`} className="aspect-square" />
            )
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-slate-300 text-sm font-semibold">복습 목록</h2>
          <Link href="/patterns" className="tap-target flex items-center text-indigo-400 text-xs">
            오늘 패턴
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-center">
            <p className="text-slate-300 text-sm font-medium">아직 저장된 패턴이 없습니다</p>
            <p className="text-slate-500 text-xs mt-1">오늘의 패턴이 생성되면 이곳에 쌓입니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((item) =>
              item.kind === "weekly" ? (
                <WeeklyReviewCard key={item.id} item={item} />
              ) : (
                <DailyReviewCard key={item.id} item={item} />
              )
            )}
          </div>
        )}
      </section>

      <nav className="bottom-nav fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around pt-3">
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
        <Link href="/review" className="tap-target flex flex-col items-center justify-center gap-1 text-indigo-400">
          <span className="text-xl">🗓️</span>
          <span className="text-xs">복습</span>
        </Link>
        <Link href="/stats" className="tap-target flex flex-col items-center justify-center gap-1 text-slate-500">
          <span className="text-xl">📊</span>
          <span className="text-xs">통계</span>
        </Link>
      </nav>
    </main>
  );
}

function DailyReviewCard({ item }: { item: Extract<ReviewItem, { kind: "daily" }> }) {
  return (
    <details className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-lg shrink-0">
            📌
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-slate-500 text-xs">{formatDate(item.date)}</p>
            <p className="text-white text-sm font-semibold line-clamp-1">{item.data.topic}</p>
            <p className="text-slate-400 text-xs line-clamp-2 mt-1">{item.data.exercise.question}</p>
          </div>
        </div>
      </summary>
      <div className="mt-4 border-t border-slate-700 pt-3 flex flex-col gap-2">
        {item.data.patterns.map((pattern, index) => (
          <p key={pattern.sentence} className="text-slate-200 text-sm leading-relaxed">
            <span className="text-amber-300 text-xs font-semibold mr-2">{index + 1}</span>
            {pattern.sentence}
          </p>
        ))}
      </div>
    </details>
  );
}

function WeeklyReviewCard({ item }: { item: Extract<ReviewItem, { kind: "weekly" }> }) {
  return (
    <details className="bg-slate-800 border border-emerald-800/40 rounded-2xl p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-lg shrink-0">
            📋
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-emerald-400 text-xs font-medium">주간 요약 — {formatDate(item.date)}</p>
            <p className="text-white text-sm font-semibold line-clamp-1">
              {item.data.weekStart} ~ {item.data.weekEnd}
            </p>
            <p className="text-slate-400 text-xs line-clamp-2 mt-1">{item.data.rehearsalQuestion}</p>
          </div>
        </div>
      </summary>
      <div className="mt-4 border-t border-slate-700 pt-3 flex flex-col gap-3">
        <div>
          <p className="text-slate-500 text-xs mb-2">이번 주 핵심 패턴</p>
          {item.data.corePatterns.map((p, i) => (
            <p key={i} className="text-slate-200 text-sm leading-relaxed mb-1">
              <span className="text-emerald-300 text-xs font-semibold mr-2">{i + 1}</span>
              {p.sentence}
            </p>
          ))}
        </div>
        <div className="bg-amber-950/60 border border-amber-800/40 rounded-xl px-3 py-2.5">
          <p className="text-amber-400 text-xs font-medium mb-1">고칠 점</p>
          <p className="text-amber-100 text-sm leading-relaxed">{item.data.fixThis}</p>
        </div>
        <Link
          href={`/practice?source=weekly&date=${item.date}`}
          className="tap-target block w-full py-3 rounded-xl bg-emerald-700 text-white text-center text-sm font-semibold"
        >
          리허설 다시 하기
        </Link>
      </div>
    </details>
  );
}

function buildMonthDays(
  dailyDateSet: Set<string>,
  weeklyDateSet: Set<string>,
  todayKst: string
) {
  const year = parseInt(todayKst.slice(0, 4), 10);
  const month = parseInt(todayKst.slice(5, 7), 10) - 1;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Array<{
    date: string;
    label: number;
    hasPattern: boolean;
    hasWeekly: boolean;
  } | null> = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) days.push(null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({
      date,
      label: day,
      hasPattern: dailyDateSet.has(date),
      hasWeekly: weeklyDateSet.has(date),
    });
  }

  return days;
}

function formatMonth(kstDateStr: string) {
  const [year, month] = kstDateStr.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
