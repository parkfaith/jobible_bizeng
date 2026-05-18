import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";

export async function GET() {
  const rows = await db.select().from(profile).limit(1);
  return NextResponse.json(rows[0] ?? null);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { targetPosition, currentRole, yearsExp, projects, topConcern, focusAreas } = body;

  const existing = await db.select().from(profile).limit(1);

  if (existing.length > 0) {
    const updated = await db
      .update(profile)
      .set({
        targetPosition,
        currentRole,
        yearsExp,
        projects: JSON.stringify(projects),
        topConcern,
        focusAreas: JSON.stringify(focusAreas),
      })
      .returning();
    return NextResponse.json(updated[0]);
  }

  const inserted = await db
    .insert(profile)
    .values({
      targetPosition,
      currentRole,
      yearsExp,
      projects: JSON.stringify(projects),
      topConcern,
      focusAreas: JSON.stringify(focusAreas),
    })
    .returning();

  return NextResponse.json(inserted[0], { status: 201 });
}
