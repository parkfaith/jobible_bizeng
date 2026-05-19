import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyPatterns, profile } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  DAILY_PATTERN_SET_TYPE,
  getKstDate,
  type DailyPatternSet,
} from "@/lib/pattern-set";

export async function POST() {
  const profiles = await db.select().from(profile).limit(1);
  const userProfile = profiles[0];

  const profileCtx = userProfile
    ? `The candidate is targeting: ${userProfile.targetPosition}. Current role: ${userProfile.currentRole} with ${userProfile.yearsExp} years of experience. Their main concern: "${userProfile.topConcern}".`
    : "The candidate is a senior AI/IT leader with 20+ years experience targeting a Director-level role at a global company.";

  const today = getKstDate();
  const patternRows = await db
    .select()
    .from(dailyPatterns)
    .where(and(eq(dailyPatterns.date, today), eq(dailyPatterns.patternType, DAILY_PATTERN_SET_TYPE)))
    .limit(1);
  const patternSet = patternRows[0]
    ? (JSON.parse(patternRows[0].content) as DailyPatternSet)
    : null;
  const patternCtx = patternSet
    ? `Today's interview focus:
- Topic: ${patternSet.topic}
- Opening question theme: ${patternSet.exercise.question}
- Useful answer frame: ${patternSet.exercise.structure
        .map((step) => `${step.label}: ${step.sentence}`)
        .join(" | ")}

Use this topic as the main thread of the interview. Ask realistic follow-up questions around this focus.`
    : "No daily pattern set is available, so use a general senior AI leadership interview flow.";

  const instructions = `You are a rigorous interviewer at a global tech company interviewing a senior Korean AI/IT leader for a foreign company.

${profileCtx}

${patternCtx}

Your interviewing style:
- Professional and direct. Not overly warm. Real interview energy.
- Ask ONE question at a time. Wait for the full answer before asking the next.
- Ask natural follow-up questions based on what the candidate says. Don't follow a rigid script.
- Do NOT give feedback or coaching during the interview. Stay in interviewer mode only.
- Speak in clear, moderately-paced English so the candidate can follow.

Interview structure:
- Keep the session short: 5–10 minutes total.
- Ask 3–4 questions total.
- Start with the daily focus topic, not a generic long self-introduction.
- Include 1 natural follow-up question based on the candidate's answer.
- End with a concise closing when the final question is complete.

When the client asks you to begin, start with a brief greeting and the first question. Do not announce the internal structure.`;

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime",
        instructions,
        output_modalities: ["audio"],
        audio: {
          input: {
            transcription: {
              model: "gpt-4o-transcribe",
              language: "en",
            },
            turn_detection: {
              type: "server_vad",
              silence_duration_ms: 800,
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            voice: "marin",
            speed: 0.95,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    console.error("Realtime client secret request failed", await res.text());
    return NextResponse.json(
      { error: "Failed to create realtime session" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
