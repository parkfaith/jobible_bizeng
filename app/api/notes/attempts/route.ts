import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbacks, practiceTurns } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const noteId = Number(searchParams.get("noteId"));

  if (!noteId) {
    return NextResponse.json({ error: "noteId is required" }, { status: 400 });
  }

  const rows = await db
    .select({
      feedbackId: feedbacks.id,
      contentScore: feedbacks.contentScore,
      structureScore: feedbacks.structureScore,
      englishScore: feedbacks.englishScore,
      leadershipScore: feedbacks.leadershipScore,
      feedbackKo: feedbacks.feedbackKo,
      improvedAnswerEn: feedbacks.improvedAnswerEn,
      createdAt: feedbacks.createdAt,
      transcript: practiceTurns.userTranscript,
    })
    .from(feedbacks)
    .leftJoin(practiceTurns, eq(feedbacks.turnId, practiceTurns.id))
    .where(eq(feedbacks.noteId, noteId))
    .orderBy(desc(feedbacks.id));

  return NextResponse.json({ attempts: rows });
}
