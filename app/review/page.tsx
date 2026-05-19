import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyPatterns } from "@/lib/db/schema";
import { DAILY_PATTERN_SET_TYPE, type DailyPatternSet } from "@/lib/pattern-set";

export const dynamic = "force-dynamic";

interface PatternReviewItem {
  id: number;
  date: string;
  data: DailyPatternSet;
}

export default async function ReviewPage() {
  const rows = await db
    .select()
    .from(dailyPatterns)
    .where(eq(dailyPatterns.patternType, DAILY_PATTERN_SET_TYPE))
    .orderBy(desc(dailyPatterns.date))
    .limit(60);

  const items: PatternReviewItem[] = rows.map((row) => ({
    id: row.id,
    date: row.date,
    data: JSON.parse(row.content) as DailyPatternSet,
  }));
  const dateSet = new Set(items.map((item) => item.date));
  const monthDays = buildMonthDays(dateSet);

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-7 pb-24">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/" className="text-slate-400 text-2xl leading-none">
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
          <p className="text-white text-sm font-semibold">{formatMonth(new Date())}</p>
          <p className="text-slate-500 text-xs">저장 {items.length}일</p>
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
                  day.hasPattern
                    ? "bg-amber-500/15 border-amber-500/30 text-white"
                    : "bg-slate-900 border-slate-800 text-slate-600"
                }`}
              >
                <span className="text-xs font-medium">{day.label}</span>
                {day.hasPattern && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-300" />}
              </div>
            ) : (
              <div key={`empty-${index}`} className="aspect-square" />
            )
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-slate-300 text-sm font-semibold">최근 복습 패턴</h2>
          <Link href="/patterns" className="text-indigo-400 text-xs">
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
            {items.map((item) => (
              <details
                key={item.id}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-lg shrink-0">
                      📌
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-500 text-xs">{formatDate(item.date)}</p>
                      <p className="text-white text-sm font-semibold line-clamp-1">
                        {item.data.topic}
                      </p>
                      <p className="text-slate-400 text-xs line-clamp-2 mt-1">
                        {item.data.exercise.question}
                      </p>
                    </div>
                  </div>
                </summary>
                <div className="mt-4 border-t border-slate-700 pt-3 flex flex-col gap-2">
                  {item.data.patterns.map((pattern, index) => (
                    <p key={pattern.sentence} className="text-slate-200 text-sm leading-relaxed">
                      <span className="text-amber-300 text-xs font-semibold mr-2">
                        {index + 1}
                      </span>
                      {pattern.sentence}
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around py-3">
        <Link href="/" className="flex flex-col items-center gap-1 text-slate-500">
          <span className="text-xl">🏠</span>
          <span className="text-xs">홈</span>
        </Link>
        <Link href="/practice/interview" className="flex flex-col items-center gap-1 text-slate-500">
          <span className="text-xl">🎙️</span>
          <span className="text-xs">면접</span>
        </Link>
        <Link href="/notes" className="flex flex-col items-center gap-1 text-slate-500">
          <span className="text-xl">📓</span>
          <span className="text-xs">답변 노트</span>
        </Link>
        <Link href="/stats" className="flex flex-col items-center gap-1 text-slate-500">
          <span className="text-xl">📊</span>
          <span className="text-xs">통계</span>
        </Link>
      </nav>
    </main>
  );
}

function buildMonthDays(dateSet: Set<string>) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Array<{ date: string; label: number; hasPattern: boolean } | null> = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) days.push(null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({ date, label: day, hasPattern: dateSet.has(date) });
  }

  return days;
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
