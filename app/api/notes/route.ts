import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { answerNotes } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));

  if (id) {
    const note = await db.select().from(answerNotes).where(eq(answerNotes.id, id)).limit(1);
    if (!note[0]) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    return NextResponse.json(note[0]);
  }

  const notes = await db
    .select()
    .from(answerNotes)
    .orderBy(desc(answerNotes.updatedAt));
  return NextResponse.json(notes);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { category, questionText, originalAnswer, improvedAnswer, finalAnswer, keyExpressions } =
    body;

  const inserted = await db
    .insert(answerNotes)
    .values({
      category,
      questionText,
      originalAnswer,
      improvedAnswer,
      finalAnswer,
      keyExpressions: keyExpressions ? JSON.stringify(keyExpressions) : null,
    })
    .returning();

  return NextResponse.json(inserted[0], { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (updates.keyExpressions) {
    updates.keyExpressions = JSON.stringify(updates.keyExpressions);
  }

  const updated = await db
    .update(answerNotes)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(eq(answerNotes.id, id))
    .returning();

  return NextResponse.json(updated[0]);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));

  await db.delete(answerNotes).where(eq(answerNotes.id, id));
  return NextResponse.json({ ok: true });
}
