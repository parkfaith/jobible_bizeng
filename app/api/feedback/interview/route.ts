import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbacks, profile } from "@/lib/db/schema";

interface Turn {
  role: "ai" | "user";
  text: string;
}

export async function POST(req: Request) {
  const { turns, sessionId }: { turns: Turn[]; sessionId?: number } = await req.json();

  if (!turns || turns.length < 2) {
    return NextResponse.json({ error: "Not enough conversation data" }, { status: 400 });
  }

  if (turns.length > 20) {
    return NextResponse.json({ error: "Too many interview turns" }, { status: 413 });
  }

  const totalChars = turns.reduce((sum, t) => sum + t.text.length, 0);
  if (totalChars > 12000) {
    return NextResponse.json({ error: "Conversation transcript is too long" }, { status: 413 });
  }

  const profiles = await db.select().from(profile).limit(1);
  const userProfile = profiles[0];
  const profileCtx = userProfile
    ? `Candidate targeting: ${userProfile.targetPosition}. Role: ${userProfile.currentRole}, ${userProfile.yearsExp}yr exp.`
    : "Senior AI/IT leader targeting Director-level foreign company role.";

  const conversationText = turns
    .map((t) => `${t.role === "ai" ? "Interviewer" : "Candidate"}: ${t.text}`)
    .join("\n");

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
          content: `You are a professional interview coach reviewing a mock interview for a senior AI leader.
${profileCtx}

Analyze the full interview transcript and return JSON with this exact shape:
{
  "bestAnswer": {
    "question": "...",
    "answer": "...",
    "reasonKo": "이 답변이 가장 좋았던 이유 (한국어, 2문장)"
  },
  "worstAnswer": {
    "question": "...",
    "answer": "...",
    "reasonKo": "이 답변이 가장 위험했던 이유 (한국어, 2문장)"
  },
  "nextFocusKo": "다음 연습에서 반드시 고쳐야 할 딱 한 가지 (한국어, 1-2문장)",
  "improvementSentences": ["...", "...", "..."]
}

improvementSentences: exactly 3 English sentences the candidate can immediately use in their next interview. Make them specific, executive-sounding, and directly based on the candidate's weak answers.`,
        },
        {
          role: "user",
          content: `Full interview transcript:\n\n${conversationText}`,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    console.error("interview feedback generation failed", await res.text());
    return NextResponse.json(
      { error: "Failed to generate interview feedback" },
      { status: res.status }
    );
  }

  const data = await res.json();
  let feedback: ReturnType<typeof JSON.parse>;
  try {
    feedback = JSON.parse(data.choices[0].message.content);
  } catch {
    console.error("interview feedback JSON parse failed", data.choices?.[0]?.message?.content);
    return NextResponse.json({ error: "Failed to parse interview feedback" }, { status: 500 });
  }

  if (sessionId) {
    try {
      await db.insert(feedbacks).values({
        sessionId,
        feedbackKo: feedback.nextFocusKo ?? "",
        bestAnswer: JSON.stringify(feedback.bestAnswer),
        worstAnswer: JSON.stringify(feedback.worstAnswer),
        nextFocus: feedback.nextFocusKo,
        keyExpressions: JSON.stringify(feedback.improvementSentences ?? []),
      });
    } catch (err) {
      console.error("interview feedback DB save failed", err);
    }
  }

  return NextResponse.json(feedback);
}
