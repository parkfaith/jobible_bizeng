import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyPatterns, profile } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getKstDate } from "@/lib/pattern-set";

const CATEGORIES = ["intro", "career", "leadership", "tech", "failure"] as const;

// Rotates category by day of year so each day feels fresh
function todayCategory() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return CATEGORIES[dayOfYear % CATEGORIES.length];
}

export async function GET() {
  const today = getKstDate();

  const cached = await db
    .select()
    .from(dailyPatterns)
    .where(and(eq(dailyPatterns.date, today), eq(dailyPatterns.patternType, "daily_question")))
    .limit(1);

  if (cached.length > 0) {
    return NextResponse.json(JSON.parse(cached[0].content));
  }

  const profiles = await db.select().from(profile).limit(1);
  const userProfile = profiles[0];

  const category = todayCategory();

  const categoryPrompts: Record<string, string> = {
    intro: "Generate a self-introduction interview question for a senior AI leader applying to a foreign company.",
    career: "Generate a career background question focusing on major accomplishments and leadership impact.",
    leadership: "Generate a leadership experience question that tests decision-making and team management.",
    tech: "Generate a technical project question about AI/ML implementation and business impact.",
    failure: "Generate a behavioral question about handling failure, conflict, or a difficult situation.",
  };

  const profileContext = userProfile
    ? `The candidate is targeting: ${userProfile.targetPosition}. Current role: ${userProfile.currentRole} with ${userProfile.yearsExp} years experience.`
    : "The candidate is a senior AI/IT leader with 20+ years experience targeting a Director-level position.";

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
          content: `You are a rigorous interviewer at a global tech company hiring senior AI leaders.
${profileContext}
Generate ONE realistic interview question and return JSON with this exact shape:
{
  "question": "...",
  "category": "${category}",
  "hint": "A brief tip (in Korean) on how to structure the answer, e.g. STAR method or key points to cover. 1-2 sentences max."
}
The question must be in English. The hint must be in Korean.`,
        },
        {
          role: "user",
          content: categoryPrompts[category],
        },
      ],
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    console.error("daily question generation failed", await res.text());
    return NextResponse.json({ error: "Failed to generate daily question" }, { status: res.status });
  }

  const data = await res.json();
  const content = JSON.parse(data.choices[0].message.content);

  await db.insert(dailyPatterns).values({
    date: today,
    patternType: "daily_question",
    content: JSON.stringify(content),
  });

  return NextResponse.json(content);
}
