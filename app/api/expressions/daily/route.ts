import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyPatterns, profile } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

const CATEGORY_FOR_EXPRESSION: Record<string, string> = {
  intro: "self-introduction and career narrative",
  career: "career achievements and impact",
  leadership: "leadership and decision-making",
  tech: "technical projects and AI/ML implementation",
  failure: "handling failure, conflict, and difficult situations",
};

function todayCategory() {
  const categories = ["intro", "career", "leadership", "tech", "failure"] as const;
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return categories[dayOfYear % categories.length];
}

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const cached = await db
    .select()
    .from(dailyPatterns)
    .where(
      and(eq(dailyPatterns.date, today), eq(dailyPatterns.patternType, "daily_expression"))
    )
    .limit(1);

  if (cached.length > 0) {
    return NextResponse.json(JSON.parse(cached[0].content));
  }

  const profiles = await db.select().from(profile).limit(1);
  const userProfile = profiles[0];
  const targetPosition = userProfile?.targetPosition ?? "AI Director";
  const category = todayCategory();
  const topic = CATEGORY_FOR_EXPRESSION[category];

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
          content: `You create concise daily business English expression cards for a senior Korean professional targeting ${targetPosition} at a global company. Today's topic: ${topic}.

Return JSON with this exact shape:
{
  "pattern": "One practical English expression with a blank, e.g. \"I'd like to propose that we ___.\"",
  "patternMeaning": "한국어 뜻 설명 (1줄, 15자 이내)",
  "whenToUse": ["상황1 (한국어)", "상황2", "상황3"],
  "examples": [
    { "situation": "상황 설명 (한국어, 10자 이내)", "sentence": "Full English example sentence." },
    { "situation": "상황 설명", "sentence": "Full English example sentence." },
    { "situation": "면접 활용", "sentence": "Full English example sentence using this in an interview." }
  ],
  "commonMistakes": [
    { "wrong": "Incorrect phrasing", "correct": "Correct phrasing", "tipKo": "이유 (한국어, 20자 이내)" }
  ],
  "practicePrompt": "ChatGPT에 붙여넣을 수 있는 연습 프롬프트. 한국어 설명 + 영어 프롬프트 템플릿 형식으로 작성."
}

Rules:
- pattern must be directly useful in an interview for ${targetPosition}
- examples must be realistic and executive-level
- commonMistakes: 1-2 pairs only
- practicePrompt should start with Korean instruction then the actual English prompt to paste into ChatGPT`,
        },
        {
          role: "user",
          content: `Generate today's expression card. Topic: ${topic}`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }

  const data = await res.json();
  const content = JSON.parse(data.choices[0].message.content);

  await db.insert(dailyPatterns).values({
    date: today,
    patternType: "daily_expression",
    content: JSON.stringify(content),
  });

  return NextResponse.json(content);
}

export async function PATCH(req: Request) {
  const today = new Date().toISOString().slice(0, 10);
  const body = await req.json();

  const existing = await db
    .select()
    .from(dailyPatterns)
    .where(
      and(eq(dailyPatterns.date, today), eq(dailyPatterns.patternType, "daily_expression"))
    )
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "No expression for today" }, { status: 404 });
  }

  const current = JSON.parse(existing[0].content);
  const updated = { ...current, ...body };

  await db
    .update(dailyPatterns)
    .set({ content: JSON.stringify(updated) })
    .where(eq(dailyPatterns.id, existing[0].id));

  return NextResponse.json(updated);
}
