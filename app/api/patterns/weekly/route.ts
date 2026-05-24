export const maxDuration = 60;

import { NextResponse } from "next/server";
import { and, eq, gte, like, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyPatterns, profile } from "@/lib/db/schema";
import {
  DAILY_PATTERN_SET_TYPE,
  WEEKLY_SUMMARY_SET_TYPE,
  type DailyPatternSet,
  type WeeklySummarySet,
  WEEKLY_SUMMARY_SET_SCHEMA,
  getWeekSaturdayDate,
  getWeekRange,
  isWeekendKst,
} from "@/lib/pattern-set";

function extractResponseText(data: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  if (typeof data.output_text === "string") return data.output_text;
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

async function generateWeeklySummary(satDate: string): Promise<WeeklySummarySet> {
  const { start, end } = getWeekRange(satDate);

  const profiles = await db.select().from(profile).limit(1);
  const userProfile = profiles[0];
  const targetPosition = userProfile?.targetPosition ?? "AI Director";
  const currentRole = userProfile?.currentRole ?? "senior AI/IT leader";
  const yearsExp = userProfile?.yearsExp ?? 20;

  // Fetch this week's daily pattern sets
  const weekRows = await db
    .select()
    .from(dailyPatterns)
    .where(
      and(
        gte(dailyPatterns.date, start),
        lte(dailyPatterns.date, end),
        eq(dailyPatterns.patternType, DAILY_PATTERN_SET_TYPE)
      )
    )
    .orderBy(dailyPatterns.date);

  const weekPatterns = weekRows.map((row) => ({
    date: row.date,
    data: JSON.parse(row.content) as DailyPatternSet,
  }));

  const weekSummaryForPrompt =
    weekPatterns.length > 0
      ? weekPatterns
          .map(
            (w) =>
              `[${w.date}] Topic: ${w.data.topic}\n` +
              `Patterns: ${w.data.patterns.map((p) => p.sentence).join(" | ")}\n` +
              `Question: ${w.data.exercise.question}`
          )
          .join("\n\n")
      : `No daily patterns this week. Generate content based on target position: ${targetPosition}.`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL ?? "gpt-4o",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `Create a weekend interview answer summary for a senior Korean AI/IT leader.

Candidate context:
- Target position: ${targetPosition}
- Current role: ${currentRole}
- Experience: ${yearsExp} years
- Week range: ${start} to ${end}

This week's daily patterns:
${weekSummaryForPrompt}

=== FIELD-BY-FIELD INSTRUCTIONS ===

weekStart: "${start}"
weekEnd: "${end}"

corePatterns (exactly 3):
- Select or synthesize the 3 most important, reusable interview sentences from this week.
- sentence: Complete, interview-ready English sentence. Senior leader tone.
- from: Short label like "Day 1 topic" or the topic name it came from.

keyQuestions (exactly 3):
- Real interview questions that cover this week's themes.
- Each question should be answerable using this week's patterns.

fixThis (1 item):
- The single most important improvement area for Korean senior leaders based on this week's content.
- Write in Korean. Specific and actionable — not generic advice.
- Format: "이번 주 고칠 점: [구체적인 지적]. [짧은 수정 예시 또는 이유]"

readySentences (exactly 5):
- 5 English sentences the candidate can use immediately in a real interview.
- Each sentence should be polished, concise, and cover a different aspect of this week's topics.

rehearsalQuestion (1 item):
- A single English interview question that synthesizes this week's key themes.
- Answerable in about 30–60 seconds.
- Should feel like a real question from an AI Director hiring panel.

answerStructure (exactly 4 steps):
- A 30-second answer structure for the rehearsalQuestion.
- Labels must be exactly: Situation, Action, Execution, Result
- Each sentence should be directly speakable English using this week's vocabulary.

=== STYLE RULES ===
- Korean text: direct and practical. No academic or encouraging tone.
- English text: senior leader register. Calm, structured, credible.
- No generic school English. Every sentence should pass a real interview.`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Generate the weekend summary for the week of ${start} to ${end}.`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "weekly_summary_set",
          strict: true,
          schema: WEEKLY_SUMMARY_SET_SCHEMA,
        },
      },
      temperature: 0.5,
    }),
  });

  if (!res.ok) {
    console.error("OpenAI weekly summary generation failed", await res.text());
    throw new Error("OpenAI weekly summary generation failed");
  }

  const data = await res.json();
  const text = extractResponseText(data);
  if (!text) throw new Error("OpenAI response did not include output text");

  const content = JSON.parse(text) as Omit<WeeklySummarySet, "source">;
  return { ...content, source: "openai" };
}

async function getCachedWeeklySummary(satDate: string): Promise<WeeklySummarySet | null> {
  const rows = await db
    .select()
    .from(dailyPatterns)
    .where(
      and(eq(dailyPatterns.date, satDate), eq(dailyPatterns.patternType, WEEKLY_SUMMARY_SET_TYPE))
    )
    .limit(1);

  if (rows.length === 0) return null;
  return JSON.parse(rows[0].content) as WeeklySummarySet;
}

async function upsertWeeklySummary(satDate: string, content: WeeklySummarySet) {
  const existing = await db
    .select()
    .from(dailyPatterns)
    .where(
      and(eq(dailyPatterns.date, satDate), eq(dailyPatterns.patternType, WEEKLY_SUMMARY_SET_TYPE))
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(dailyPatterns)
      .set({ content: JSON.stringify(content) })
      .where(eq(dailyPatterns.id, existing[0].id));
  } else {
    await db.insert(dailyPatterns).values({
      date: satDate,
      patternType: WEEKLY_SUMMARY_SET_TYPE,
      content: JSON.stringify(content),
    });
  }
}

async function weeklyRegenCount(satDate: string): Promise<number> {
  const rows = await db
    .select()
    .from(dailyPatterns)
    .where(
      and(
        eq(dailyPatterns.date, satDate),
        like(dailyPatterns.patternType, "weekly_summary_regen_%")
      )
    );
  return rows.length;
}

async function recordWeeklyRegen(satDate: string) {
  const count = await weeklyRegenCount(satDate);
  await db.insert(dailyPatterns).values({
    date: satDate,
    patternType: `weekly_summary_regen_${count + 1}`,
    content: JSON.stringify({ createdAt: new Date().toISOString() }),
  });
}

export async function GET() {
  const satDate = getWeekSaturdayDate();

  const cached = await getCachedWeeklySummary(satDate);
  if (cached) {
    return NextResponse.json(cached, { headers: { "Cache-Control": "no-store" } });
  }

  // Only auto-generate on weekends; on weekdays return 404 with hint
  if (!isWeekendKst()) {
    return NextResponse.json(
      { error: "주말에만 주간 요약이 제공됩니다.", weekdayHint: true },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const generated = await generateWeeklySummary(satDate);
    await upsertWeeklySummary(satDate, generated);
    return NextResponse.json(generated, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("weekly summary generation failed", error);
    return NextResponse.json(
      { error: "주간 요약을 생성하지 못했습니다." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST() {
  if (!isWeekendKst()) {
    return NextResponse.json(
      { error: "주말에만 주간 요약을 생성할 수 있습니다." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const satDate = getWeekSaturdayDate();

  try {
    const count = await weeklyRegenCount(satDate);
    if (count >= 2) {
      return NextResponse.json(
        { error: "이번 주말 재생성 횟수를 초과했습니다." },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }
    const generated = await generateWeeklySummary(satDate);
    await upsertWeeklySummary(satDate, generated);
    await recordWeeklyRegen(satDate);
    return NextResponse.json(generated, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("weekly summary regeneration failed", error);
    return NextResponse.json(
      { error: "주간 요약을 재생성하지 못했습니다." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
