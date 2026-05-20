export const maxDuration = 60;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbacks, practiceTurns, profile } from "@/lib/db/schema";

export async function POST(req: Request) {
  const { question, transcript, category, patternSet, sessionId } = await req.json();

  if (!question || !transcript) {
    return NextResponse.json({ error: "Missing question or transcript" }, { status: 400 });
  }

  if (typeof transcript === "string" && transcript.length > 6000) {
    return NextResponse.json({ error: "Transcript is too long" }, { status: 413 });
  }

  const profiles = await db.select().from(profile).limit(1);
  const userProfile = profiles[0];
  const profileCtx = userProfile
    ? `Candidate: ${userProfile.targetPosition}, ${userProfile.currentRole}, ${userProfile.yearsExp} years experience.`
    : "Senior AI leader with 20+ years experience.";
  const patternCtx = patternSet
    ? `Today's practice pattern set:
Topic: ${patternSet.topic}
Target phrases: ${patternSet.patterns?.map((p: { sentence: string }) => p.sentence).join(" / ")}
Answer frame: ${patternSet.exercise?.structure
        ?.map((s: { label: string; sentence: string }) => `${s.label}: ${s.sentence}`)
        .join(" | ")}

Include a short patternUsageKo field explaining whether the candidate naturally used today's answer frame or phrases.`
    : "No daily pattern set was provided. Set patternUsageKo to an empty string.";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a rigorous English interview coach for senior AI/IT leaders targeting global companies.
${profileCtx}
Category: ${category}

Evaluate the candidate's answer and return JSON with this exact shape:
{
  "contentScore": <1-5>,
  "structureScore": <1-5>,
  "englishScore": <1-5>,
  "leadershipScore": <1-5>,
  "feedbackKo": "...",
  "improvedAnswerEn": "...",
  "keyExpressions": ["...", "...", "..."],
  "patternUsageKo": "..."
}

Scoring criteria:
- contentScore: Did they directly answer the question? (1=off-topic, 5=perfectly targeted)
- structureScore: Is there a clear conclusion + evidence + example + result? (1=rambling, 5=STAR-perfect)
- englishScore: Is the English natural and concise for a senior executive? (1=awkward, 5=native-level)
- leadershipScore: Does it sound like a senior leader, not just an executor? (1=no, 5=very yes)

feedbackKo: Korean feedback, 3-4 sentences. Direct and practical. Focus on the most important thing to fix.
improvedAnswerEn: A rewritten, improved English answer (2-4 sentences). Keep the candidate's facts but make it more structured and executive-sounding.
keyExpressions: Exactly 3 English phrases/sentences the candidate can immediately memorize and reuse.

${patternCtx}`,
        },
        {
          role: "user",
          content: `Interview question: "${question}"\n\nCandidate's answer: "${transcript}"`,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    console.error("feedback generation failed", await res.text());
    return NextResponse.json({ error: "Failed to generate feedback" }, { status: res.status });
  }

  const data = await res.json();
  let feedback: ReturnType<typeof JSON.parse>;
  try {
    feedback = JSON.parse(data.choices[0].message.content);
  } catch {
    console.error("feedback JSON parse failed", data.choices?.[0]?.message?.content);
    return NextResponse.json({ error: "Failed to parse feedback response" }, { status: 500 });
  }

  if (sessionId) {
    try {
      const [turn] = await db.insert(practiceTurns).values({
        sessionId,
        turnOrder: 1,
        questionText: question,
        questionCategory: category,
        userTranscript: transcript,
      }).returning();

      await db.insert(feedbacks).values({
        sessionId,
        turnId: turn.id,
        contentScore: feedback.contentScore,
        structureScore: feedback.structureScore,
        englishScore: feedback.englishScore,
        leadershipScore: feedback.leadershipScore,
        feedbackKo: feedback.feedbackKo,
        improvedAnswerEn: feedback.improvedAnswerEn,
        keyExpressions: JSON.stringify(feedback.keyExpressions ?? []),
      });
    } catch (err) {
      console.error("practice feedback DB save failed", err);
    }
  }

  return NextResponse.json(feedback);
}
