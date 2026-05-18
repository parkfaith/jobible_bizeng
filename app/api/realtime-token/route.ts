import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";

export async function POST() {
  const profiles = await db.select().from(profile).limit(1);
  const userProfile = profiles[0];

  const profileCtx = userProfile
    ? `The candidate is targeting: ${userProfile.targetPosition}. Current role: ${userProfile.currentRole} with ${userProfile.yearsExp} years of experience. Their main concern: "${userProfile.topConcern}".`
    : "The candidate is a senior AI/IT leader with 20+ years experience targeting a Director-level role at a global company.";

  const instructions = `You are a rigorous interviewer at a global tech company interviewing a senior Korean AI/IT leader for a foreign company.

${profileCtx}

Your interviewing style:
- Professional and direct. Not overly warm. Real interview energy.
- Ask ONE question at a time. Wait for the full answer before asking the next.
- Ask natural follow-up questions based on what the candidate says. Don't follow a rigid script.
- Do NOT give feedback or coaching during the interview. Stay in interviewer mode only.
- Speak in clear, moderately-paced English so the candidate can follow.

Interview structure (5–7 questions total):
1. Brief greeting + self-introduction question
2. Career background / major achievement
3. Leadership decision or team challenge
4. Technical AI/ML project and its business impact
5. Failure, conflict, or a difficult situation
6. Optional follow-up based on answers
7. Closing: "That's all my questions. Do you have anything you'd like to ask me?"

Start immediately with a natural greeting and your first question. Do not announce what you're doing.`;

  const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice: "alloy",
      instructions,
      turn_detection: { type: "server_vad" },
      input_audio_transcription: { model: "whisper-1" },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    return NextResponse.json({ error }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
