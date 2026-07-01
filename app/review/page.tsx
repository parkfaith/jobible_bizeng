import Link from "next/link";
import { and, desc, eq, like, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyPatterns, practiceSessions } from "@/lib/db/schema";
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

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const todayKst = getKstDate();
  const currentMonth = todayKst.slice(0, 7);
  const selectedMonth = isValidMonth(params.month) ? params.month! : currentMonth;

  const rows = await db
    .select()
    .from(dailyPatterns)
    .where(
      and(
        or(
          eq(dailyPatterns.patternType, DAILY_PATTERN_SET_TYPE),
          eq(dailyPatterns.patternType, WEEKLY_SUMMARY_SET_TYPE)
        ),
        like(dailyPatterns.date, `${selectedMonth}-%`)
      )
    )
    .orderBy(desc(dailyPatterns.date));

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

  const dailyDateSet = new Set(items.filter((i) => i.kind === "daily").map((i) => i.date));
  const weeklyDateSet = new Set(items.filter((i) => i.kind === "weekly").map((i) => i.date));

  // 실제 "공부한 날" = 중도포기를 제외한 '오늘의 질문 연습(daily)' 세션이 있는 날 (KST 기준)
  // 면접(interview)은 주 3회 제한 + 토큰 비용으로 아껴 쓰는 리소스라 습관 트래킹에서 제외한다.
  // (면접 기록·성과는 통계 화면에서 별도로 확인)
  const sessionRows = await db
    .select({ startedAt: practiceSessions.startedAt })
    .from(practiceSessions)
    .where(
      and(
        eq(practiceSessions.mode, "daily"),
        ne(practiceSessions.status, "abandoned")
      )
    );

  const studiedDateSet = new Set<string>();
  for (const row of sessionRows) {
    if (!row.startedAt) continue;
    const kstDate = utcSqliteToKstDate(row.startedAt);
    if (kstDate && kstDate.startsWith(`${selectedMonth}-`)) studiedDateSet.add(kstDate);
  }

  const monthDays = buildMonthDays(
    dailyDateSet,
    weeklyDateSet,
    studiedDateSet,
    selectedMonth,
    todayKst
  );
  const studiedCount = studiedDateSet.size;
  const weeklyCount = weeklyDateSet.size;

  const prev = offsetMonth(selectedMonth, -1);
  const next = offsetMonth(selectedMonth, 1);
  const isNextDisabled = selectedMonth >= currentMonth;

  return (
    <div className="app-shell flex flex-col max-w-md mx-auto bg-slate-950">
      <main className="app-scroll px-4 pt-7 pb-4">
      {/* Header */}
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

      {/* Calendar */}
      <section className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-5">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <Link
            href={`/review?month=${prev}`}
            className="tap-target w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700 text-slate-300 text-base font-bold"
          >
            ←
          </Link>
          <p className="text-white text-sm font-semibold">{formatMonth(selectedMonth)}</p>
          {isNextDisabled ? (
            <span className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-900 text-slate-700 text-base font-bold cursor-not-allowed">
              →
            </span>
          ) : (
            <Link
              href={`/review?month=${next}`}
              className="tap-target w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700 text-slate-300 text-base font-bold"
            >
              →
            </Link>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mb-3 justify-end">
          <span className="flex items-center gap-1 text-slate-500 text-xs">
            <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
            공부함 {studiedCount}일
          </span>
          <span className="flex items-center gap-1 text-slate-500 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-300 inline-block" />
            주간 {weeklyCount}
          </span>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <p key={day} className="text-center text-slate-500 text-[11px]">
              {day}
            </p>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1.5">
          {monthDays.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="aspect-square" />;
            // 셀 클릭 시 해당 날짜의 패턴 카드로 스크롤 — 패턴/주간 카드가 있는 날만 링크
            const hasCard = day.hasPattern || day.hasWeekly;
            const base = `aspect-square rounded-xl flex flex-col items-center justify-center border text-xs font-medium transition-colors ${
              day.isToday ? "ring-1 ring-inset ring-indigo-400" : ""
            }`;
            // 색상 우선순위: 공부한 날(세션) > 주간 요약 > 패턴 발급일 > 없음
            const colorClass = day.hasStudied
              ? "bg-indigo-500/20 border-indigo-400/40 text-white"
              : day.hasWeekly
              ? "bg-emerald-500/10 border-emerald-500/25 text-slate-300"
              : day.hasPattern
              ? "bg-slate-800 border-slate-700 text-slate-400"
              : "bg-slate-900 border-slate-800 text-slate-600";

            const marker = day.hasStudied ? (
              <span className="mt-0.5 text-indigo-300 text-[10px] leading-none">✓</span>
            ) : day.hasWeekly ? (
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-300" />
            ) : day.hasPattern ? (
              <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-300" />
            ) : null;

            return hasCard ? (
              <a key={day.date} href={`#date-${day.date}`} className={`${base} ${colorClass} active:opacity-70`}>
                <span>{day.label}</span>
                {marker}
              </a>
            ) : (
              <div key={day.date} className={`${base} ${colorClass}`}>
                <span>{day.label}</span>
                {marker}
              </div>
            );
          })}
        </div>
      </section>

      {/* Review list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-slate-300 text-sm font-semibold">
            {formatMonth(selectedMonth)} 복습 목록
          </h2>
          <Link href="/patterns" className="tap-target flex items-center text-indigo-400 text-xs">
            오늘 패턴
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-center">
            <p className="text-slate-300 text-sm font-medium">이 달에 저장된 패턴이 없습니다</p>
            <p className="text-slate-500 text-xs mt-1">← 버튼으로 다른 달을 확인해 보세요</p>
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
        <Link href="/review" className="tap-target flex flex-col items-center justify-center gap-1 text-indigo-400">
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

function DailyReviewCard({ item }: { item: Extract<ReviewItem, { kind: "daily" }> }) {
  return (
    <details
      id={`date-${item.date}`}
      className="bg-slate-800 border border-slate-700 rounded-2xl p-4 scroll-mt-4"
    >
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
    <details
      id={`date-${item.date}`}
      className="bg-slate-800 border border-emerald-800/40 rounded-2xl p-4 scroll-mt-4"
    >
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

function isValidMonth(month?: string): month is string {
  return !!month && /^\d{4}-\d{2}$/.test(month);
}

function offsetMonth(monthStr: string, delta: number): string {
  const [year, mon] = monthStr.split("-").map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthDays(
  dailyDateSet: Set<string>,
  weeklyDateSet: Set<string>,
  studiedDateSet: Set<string>,
  monthStr: string,
  todayKst: string
) {
  const year = parseInt(monthStr.slice(0, 4), 10);
  const month = parseInt(monthStr.slice(5, 7), 10) - 1;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Array<{
    date: string;
    label: number;
    hasPattern: boolean;
    hasWeekly: boolean;
    hasStudied: boolean;
    isToday: boolean;
  } | null> = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) days.push(null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({
      date,
      label: day,
      hasPattern: dailyDateSet.has(date),
      hasWeekly: weeklyDateSet.has(date),
      hasStudied: studiedDateSet.has(date),
      isToday: date === todayKst,
    });
  }

  return days;
}

// SQLite datetime('now')는 UTC "YYYY-MM-DD HH:MM:SS" 형식 — KST 날짜로 변환한다.
// (밤 늦은 연습이 다음 날로 밀리지 않도록 캘린더 날짜 기준과 맞춘다)
function utcSqliteToKstDate(value: string): string | null {
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const utc = iso.endsWith("Z") ? iso : `${iso}Z`;
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return getKstDate(d);
}

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
