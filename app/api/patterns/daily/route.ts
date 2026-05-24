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
  "Managing Ambiguity and Driving Alignment",
  "Communicating Risk and Gaining Stakeholder Buy-in",
  "Driving AI Impact and Reporting to Executives",
  "Making Leadership Decisions Across Functions",
  "Balancing Technical Trade-offs with Business Outcomes",
  "Recovering from Failure and Rebuilding Trust",
  "Defining Priorities Under Pressure",
  "Leading Change in a Legacy Organization",
  "Scaling AI from Pilot to Production",
  "Influencing Without Authority",
] as const;

function dayOfYearForKstDate(kstDate: string) {
  const [year, month, day] = kstDate.split("-").map(Number);
  const current = Date.UTC(year, month - 1, day);
  const start = Date.UTC(year, 0, 1);
  return Math.floor((current - start) / 86400000) + 1;
}

function topicForDate(kstDate = getKstDate()) {
  const dayOfYear = dayOfYearForKstDate(kstDate);
  return TOPICS[(dayOfYear - 1) % TOPICS.length];
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
  const today = getKstDate();
  const topic = topicForDate(today);

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
              text: `Create a daily business English interview pattern set for a senior Korean AI/IT leader preparing for a global company interview.

Candidate context:
- Target position: ${targetPosition}
- Current role: ${currentRole}
- Experience: ${yearsExp} years
- Main concern: ${topConcern}
- Representative projects: ${JSON.stringify(projects)}

Today's topic: "${topic}"
Audience: PM / AI global company interview panel, senior AI leadership hiring committee

=== FIELD-BY-FIELD INSTRUCTIONS ===

topic: Use the exact topic string provided above.

audience: One line — who this pattern set is for (e.g. "For AI Director / Global Company Senior Interview").

patterns (exactly 3):
- sentence: A complete, interview-ready English sentence. Not a fragment. Senior, calm, credible tone.
- meaningKo: Korean translation. Direct and natural, not academic.
- usagePointKo: Exactly 3 specific real-world situations as a short comma-separated list (e.g. "요구사항이 불명확한 프로젝트, AI 파일럿 기획 단계, 이해관계자 보고 회의"). Be concrete — avoid vague descriptions like "다양한 상황에서".

The 3 sentences must connect into a natural 30-second spoken answer when read in sequence.

mistakes (1–2 items):
- wrong: What Korean speakers typically say (incorrect or unnatural).
- correct: The better English alternative.
- tipKo: One concise Korean sentence explaining why it sounds more natural.

shadowing:
- sentence: Pick the most phonetically challenging of the 3 pattern sentences.
- links: 2–3 connected-speech chunks from that sentence showing natural linking (e.g. "worked-with-stakeholders", "clarify-priorities"). NEVER include URLs or web links.
- tipKo: Rhythm and stress breakdown. Format strictly as:
  "강세: [STRESSED-syl-la-bles 형식으로 표시] → 연음: [linked-words-example] → 핵심 단어: [word1, word2, word3]"
  Example: "강세: I-WORKED-with-STAKE-hold-ers-to-CLAR-i-fy-pri-OR-i-ties → 연음: worked-with-stakeholders → 핵심 단어: stakeholders, clarify, priorities"

exercise:
- question: A realistic English interview question that would naturally elicit the 3 pattern sentences.
- questionKo: Korean translation of the question. Direct and natural, not academic.
- structure: Exactly 4 steps with these labels in order: Situation, Action, Execution, Result.
  Each step's sentence: directly usable spoken English in the answer.
  Each step's sentenceKo: natural Korean translation of that sentence.

miniFocusKo: A quick-drill instruction. Format: "위 3문장을 소리 내어 3번 읽으세요. 목표: [구체적인 수행 기준 — 예: 머뭇거림 없이 실제 프로젝트 경험처럼 자연스럽게]"

=== STYLE RULES ===
- No generic school-English. Every sentence must sound like a seasoned senior leader speaking in a real interview.
- Korean explanations: direct and useful. Not cute, not encouraging, not academic.
- All 3 pattern sentences must be independently usable AND work together as a sequence.`,
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
    const cachedContent = JSON.parse(cached[0].content) as DailyPatternSet;
    const expectedTopic = topicForDate(today);
    if (cachedContent.source === "manual" || cachedContent.topic === expectedTopic) {
      return NextResponse.json(cachedContent, {
        headers: { "Cache-Control": "no-store" },
      });
    }
  }

  try {
    const generated = await generatePatternSet();
    await upsertTodayPatternSet(generated);
    return NextResponse.json(generated, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("daily pattern generation failed", error);
    return NextResponse.json(
      { error: "Failed to generate pattern set" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST() {
  try {
    const count = await todaysRegenerationCount();
    if (count >= 3) {
      return NextResponse.json(
        { error: "Daily regeneration limit reached" },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }
    const generated = await generatePatternSet();
    await upsertTodayPatternSet(generated);
    await recordRegeneration();
    return NextResponse.json(generated, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("daily pattern regeneration failed", error);
    return NextResponse.json(
      { error: "Failed to regenerate pattern set" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
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

  return NextResponse.json(updated, {
    headers: { "Cache-Control": "no-store" },
  });
}
