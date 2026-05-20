export const maxDuration = 60;

import { NextResponse } from "next/server";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyPatterns, profile } from "@/lib/db/schema";
import {
  DAILY_PATTERN_SET_SCHEMA,
  DAILY_PATTERN_SET_TYPE,
  type DailyPatternSet,
  getKstDate,
} from "@/lib/pattern-set";

const TOPICS = [
  "Risk Management + Stakeholder Communication",
  "AI Project Impact + Executive Reporting",
  "Leadership Decision + Cross-functional Alignment",
  "Technical Trade-off + Business Outcome",
  "Failure Recovery + Client Trust",
] as const;

function topicForToday() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return TOPICS[dayOfYear % TOPICS.length];
}

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

async function generatePatternSet(): Promise<DailyPatternSet> {
  const profiles = await db.select().from(profile).limit(1);
  const userProfile = profiles[0];
  const targetPosition = userProfile?.targetPosition ?? "AI Director";
  const currentRole = userProfile?.currentRole ?? "senior AI/IT leader";
  const yearsExp = userProfile?.yearsExp ?? 20;
  const topConcern = userProfile?.topConcern ?? "speaking in a structured way during interviews";
  const projects = userProfile?.projects
    ? JSON.parse(userProfile.projects)
    : [{ name: "enterprise AI deployment", role: "project lead" }];
  const topic = topicForToday();

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
              text: `Create a daily business English interview pattern set for a senior Korean AI/IT leader.

Use ChatGPT-style substance: practical, interview-ready, and directly usable in a 30-second spoken answer.
Use Claude-style organization: clean sections, concise Korean explanations, and one common Korean-speaker mistake section.

Candidate context:
- Target position: ${targetPosition}
- Current role: ${currentRole}
- Experience: ${yearsExp} years
- Main concern: ${topConcern}
- Representative projects: ${JSON.stringify(projects)}

Content rules:
- Today's topic is "${topic}".
- The audience must be PM / AI global company communication or senior AI leadership interview.
- patterns must be exactly 3 full English sentences, not fragments.
- The 3 pattern sentences should combine into a natural 30-second answer frame.
- shadowing.sentence must be one of the pattern sentences.
- shadowing.links must be connected-speech chunks from the shadowing sentence, such as "kept-stakeholders" or "throughout-the-project".
- shadowing.links must never be URLs, video links, source links, or web references.
- exercise.question must be an English interview question.
- exercise.structure must be exactly 4 steps, similar to Risk / Communication / Adjustment / Result.
- Korean explanations should be direct and useful, not cute or academic.
- Avoid generic school-English examples. Keep it senior, calm, and credible.`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Generate today's pattern set for topic: ${topic}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "daily_pattern_set",
          strict: true,
          schema: DAILY_PATTERN_SET_SCHEMA,
        },
      },
      temperature: 0.5,
    }),
  });

  if (!res.ok) {
    console.error("OpenAI pattern generation failed", await res.text());
    throw new Error("OpenAI pattern generation failed");
  }

  const data = await res.json();
  const text = extractResponseText(data);
  if (!text) throw new Error("OpenAI response did not include output text");

  const content = JSON.parse(text) as Omit<DailyPatternSet, "source">;
  // AI occasionally returns URLs despite the prompt instruction — strip them before persisting
  const cleanLinks = content.shadowing.links.filter((link) => !/^https?:\/\//i.test(link));
  return {
    ...content,
    shadowing: { ...content.shadowing, links: cleanLinks },
    source: "openai",
  };
}

async function upsertTodayPatternSet(content: DailyPatternSet) {
  const today = getKstDate();
  const existing = await db
    .select()
    .from(dailyPatterns)
    .where(and(eq(dailyPatterns.date, today), eq(dailyPatterns.patternType, DAILY_PATTERN_SET_TYPE)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(dailyPatterns)
      .set({ content: JSON.stringify(content) })
      .where(eq(dailyPatterns.id, existing[0].id));
    return;
  }

  await db.insert(dailyPatterns).values({
    date: today,
    patternType: DAILY_PATTERN_SET_TYPE,
    content: JSON.stringify(content),
  });
}

async function todaysRegenerationCount() {
  const today = getKstDate();
  const rows = await db
    .select()
    .from(dailyPatterns)
    .where(and(eq(dailyPatterns.date, today), like(dailyPatterns.patternType, "daily_pattern_regen_%")));
  return rows.length;
}

async function recordRegeneration() {
  const today = getKstDate();
  const count = await todaysRegenerationCount();
  await db.insert(dailyPatterns).values({
    date: today,
    patternType: `daily_pattern_regen_${count + 1}`,
    content: JSON.stringify({ createdAt: new Date().toISOString() }),
  });
}

export async function GET() {
  const today = getKstDate();
  const cached = await db
    .select()
    .from(dailyPatterns)
    .where(and(eq(dailyPatterns.date, today), eq(dailyPatterns.patternType, DAILY_PATTERN_SET_TYPE)))
    .limit(1);

  if (cached.length > 0) {
    return NextResponse.json(JSON.parse(cached[0].content));
  }

  try {
    const generated = await generatePatternSet();
    await upsertTodayPatternSet(generated);
    return NextResponse.json(generated);
  } catch (error) {
    console.error("daily pattern generation failed", error);
    return NextResponse.json(
      { error: "Failed to generate pattern set" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const count = await todaysRegenerationCount();
    if (count >= 3) {
      return NextResponse.json(
        { error: "Daily regeneration limit reached" },
        { status: 429 }
      );
    }
    const generated = await generatePatternSet();
    await upsertTodayPatternSet(generated);
    await recordRegeneration();
    return NextResponse.json(generated);
  } catch (error) {
    console.error("daily pattern regeneration failed", error);
    return NextResponse.json(
      { error: "Failed to regenerate pattern set" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const today = getKstDate();
  const body = (await req.json()) as DailyPatternSet;
  const updated: DailyPatternSet = { ...body, source: "manual" };

  const existing = await db
    .select()
    .from(dailyPatterns)
    .where(and(eq(dailyPatterns.date, today), eq(dailyPatterns.patternType, DAILY_PATTERN_SET_TYPE)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(dailyPatterns).values({
      date: today,
      patternType: DAILY_PATTERN_SET_TYPE,
      content: JSON.stringify(updated),
    });
  } else {
    await db
      .update(dailyPatterns)
      .set({ content: JSON.stringify(updated) })
      .where(eq(dailyPatterns.id, existing[0].id));
  }

  return NextResponse.json(updated);
}
