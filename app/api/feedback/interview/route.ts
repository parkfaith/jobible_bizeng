export const maxDuration = 60;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { feedbacks, profile } from "@/lib/db/schema";
import { WEAKNESS_TAGS, getRecentWeaknesses } from "@/lib/weakness";

interface Turn {
  role: "ai" | "user";
  text: string;
}

const WEAKNESS_TAG_SET = new Set<string>(WEAKNESS_TAGS);

function normalizeFeedback(raw: Record<string, unknown>) {
  const asStr = (v: unknown, fallback = "") =>
    typeof v === "string" ? v : fallback;
  const asStrArray = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).filter((s): s is string => typeof s === "string") : [];
  const asObj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};

  const best = asObj(raw?.bestAnswer);
  const worst = asObj(raw?.worstAnswer);

  return {
    bestAnswer: {
      question: asStr(best.question),
      questionKo: asStr(best.questionKo),
      answer: asStr(best.answer),
      answerKo: asStr(best.answerKo),
      reasonKo: asStr(best.reasonKo),
    },
    worstAnswer: {
      question: asStr(worst.question),
      questionKo: asStr(worst.questionKo),
      answer: asStr(worst.answer),
      answerKo: asStr(worst.answerKo),
      reasonKo: asStr(worst.reasonKo),
    },
    nextFocusKo: asStr(raw?.nextFocusKo),
    improvementSentences: asStrArray(raw?.improvementSentences),
    improvementSentencesKo: asStrArray(raw?.improvementSentencesKo),
    qa: Array.isArray(raw?.qa)
      ? (raw.qa as unknown[]).filter((item) => item && typeof item === "object")
      : [],
    weaknesses: Array.isArray(raw?.weaknesses)
      ? (raw.weaknesses as unknown[])
          .map((w) => asObj(w))
          .filter((w) => typeof w.tag === "string" && WEAKNESS_TAG_SET.has(w.tag as string))
          .map((w) => ({
            tag: asStr(w.tag),
            labelKo: asStr(w.labelKo),
            evidenceKo: asStr(w.evidenceKo),
          }))
          .slice(0, 3)
      : [],
    previousFocusReviewKo: asStr(raw?.previousFocusReviewKo),
  };
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

  // 직전 면접의 "다음에 고칠 것"을 가져와 이번 면접에서 개선됐는지 평가하게 한다
  let lastNextFocusKo: string | null = null;
  try {
    ({ lastNextFocusKo } = await getRecentWeaknesses());
  } catch (err) {
    console.error("previous focus load failed", err);
  }

  const previousFocusPrompt = lastNextFocusKo
    ? `\nThe coach's focus point from the candidate's PREVIOUS session was: "${lastNextFocusKo}"
Add this field to the JSON:
  "previousFocusReviewKo": "지난번 지적사항이 이번 면접에서 개선됐는지 평가 (한국어, 2문장 — 무엇이 나아졌고 무엇이 남았는지 구체적으로)"\n`
    : "";

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
    "question": "the interviewer's question verbatim",
    "questionKo": "질문의 자연스러운 한국어 번역",
    "answer": "the candidate's answer verbatim",
    "answerKo": "답변의 자연스러운 한국어 번역",
    "reasonKo": "이 답변이 가장 좋았던 이유 (한국어, 2문장)"
  },
  "worstAnswer": {
    "question": "the interviewer's question verbatim",
    "questionKo": "질문의 자연스러운 한국어 번역",
    "answer": "the candidate's answer verbatim",
    "answerKo": "답변의 자연스러운 한국어 번역",
    "reasonKo": "이 답변이 가장 위험했던 이유 (한국어, 2문장)"
  },
  "nextFocusKo": "다음 연습에서 반드시 고쳐야 할 딱 한 가지 (한국어, 1-2문장)",
  "improvementSentences": ["...", "...", "..."],
  "improvementSentencesKo": ["개선문장1 한국어 번역", "개선문장2 한국어 번역", "개선문장3 한국어 번역"],
  "qa": [
    { "q": "Interviewer question in English", "qKo": "질문 한국어 번역", "a": "Candidate answer in English", "aKo": "답변 한국어 번역" }
  ],
  "weaknesses": [
    { "tag": "one of: ${WEAKNESS_TAGS.join(" | ")}", "labelKo": "약점을 한국어 한 줄로", "evidenceKo": "이번 대화에서의 근거 1문장 (한국어)" }
  ]
}
${previousFocusPrompt}
improvementSentences: exactly 3 English sentences the candidate can immediately use in their next interview. Make them specific, executive-sounding, and directly based on the candidate's weak answers.
improvementSentencesKo: natural Korean translations of the 3 improvement sentences above.
qa: extract ALL main question-answer pairs from the transcript as structured objects. Skip pure greetings and session-closing remarks. Include Korean translations for both questions and answers.
weaknesses: the 2-3 most important recurring weak points in this interview. The "tag" MUST be exactly one of the listed enum values.`,
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
  let feedback: ReturnType<typeof normalizeFeedback>;
  try {
    const raw = JSON.parse(data.choices[0].message.content) as Record<string, unknown>;
    feedback = normalizeFeedback(raw);
  } catch {
    console.error("interview feedback JSON parse failed", data.choices?.[0]?.message?.content);
    return NextResponse.json({ error: "Failed to parse interview feedback" }, { status: 500 });
  }

  if (sessionId) {
    try {
      await db.insert(feedbacks).values({
        sessionId,
        feedbackKo: feedback.nextFocusKo,
        bestAnswer: JSON.stringify(feedback.bestAnswer),
        worstAnswer: JSON.stringify(feedback.worstAnswer),
        nextFocus: feedback.nextFocusKo,
        keyExpressions: JSON.stringify(feedback.improvementSentences),
        rawJson: JSON.stringify(feedback),
      });
    } catch (err) {
      console.error("interview feedback DB save failed", err);
    }
  }

  return NextResponse.json(feedback);
}
