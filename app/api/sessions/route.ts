import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { practiceSessions } from "@/lib/db/schema";
import { and, desc, eq, gte, ne } from "drizzle-orm";
import { WEEKLY_SESSION_LIMIT } from "@/lib/constants";

function getWeekMondayUtcIso(): string {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const nowKst = new Date(Date.now() + kstOffsetMs);
  const dayKst = nowKst.getUTCDay(); // 0=Sun ... 6=Sat in KST
  const daysFromMonday = dayKst === 0 ? 6 : dayKst - 1;
  // Rewind to Monday midnight KST
  const mondayKst = new Date(nowKst.getTime() - daysFromMonday * 86400000);
  const mondayMidnightKst = new Date(
    Date.UTC(mondayKst.getUTCFullYear(), mondayKst.getUTCMonth(), mondayKst.getUTCDate(), 0, 0, 0)
  );
  // KST midnight → UTC = subtract 9h
  const mondayMidnightUtc = new Date(mondayMidnightKst.getTime() - kstOffsetMs);
  return mondayMidnightUtc.toISOString();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // ?week=interview → return this week's interview session count
  if (searchParams.get("week") === "interview") {
    const mondayIso = getWeekMondayUtcIso();
    const rows = await db
      .select()
      .from(practiceSessions)
      .where(
        and(
          eq(practiceSessions.mode, "interview"),
          gte(practiceSessions.startedAt, mondayIso),
          ne(practiceSessions.status, "abandoned")
        )
      );
    return NextResponse.json({ count: rows.length, limit: WEEKLY_SESSION_LIMIT });
  }

  const sessions = await db
    .select()
    .from(practiceSessions)
    .orderBy(desc(practiceSessions.startedAt))
    .limit(20);
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { mode } = body;

  const inserted = await db
    .insert(practiceSessions)
    .values({ mode })
    .returning();

  return NextResponse.json(inserted[0], { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, status, endedAt } = body;

  const updated = await db
    .update(practiceSessions)
    .set({ status, endedAt })
    .where(eq(practiceSessions.id, id))
    .returning();

  return NextResponse.json(updated[0]);
}
