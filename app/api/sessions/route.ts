import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { practiceSessions, practiceTurns, feedbacks } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
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
