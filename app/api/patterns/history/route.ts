import { NextResponse } from "next/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyPatterns } from "@/lib/db/schema";
import {
  DAILY_PATTERN_SET_TYPE,
  getKstDate,
  type DailyPatternSet,
} from "@/lib/pattern-set";

export async function GET() {
  const today = getKstDate();
  const rows = await db
    .select()
    .from(dailyPatterns)
    .where(
      and(
        eq(dailyPatterns.patternType, DAILY_PATTERN_SET_TYPE),
        ne(dailyPatterns.date, today)
      )
    )
    .orderBy(desc(dailyPatterns.date))
    .limit(14);

  const history = rows.map((row) => ({
    id: row.id,
    date: row.date,
    data: JSON.parse(row.content) as DailyPatternSet,
  }));

  return NextResponse.json(history);
}
