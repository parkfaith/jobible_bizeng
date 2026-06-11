export const maxDuration = 60;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jobPostings } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export interface JdSummary {
  company: string;
  position: string;
  mustHave: string[];
  niceToHave: string[];
  responsibilities: string[];
  interviewAnglesEn: string[];
  summaryKo: string;
}

const asStr = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const asStrArray = (v: unknown): string[] =>
  Array.isArray(v) ? (v as unknown[]).filter((s): s is string => typeof s === "string") : [];

export async function GET() {
  const rows = await db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.status, "active"))
    .orderBy(desc(jobPostings.id));

  return NextResponse.json(
    rows.map((row) => {
      let summaryKo = "";
      try {
        summaryKo = (JSON.parse(row.summaryJson) as JdSummary).summaryKo ?? "";
      } catch {
        // 손상된 summaryJson은 요약 없이 반환
      }
      return {
        id: row.id,
        company: row.company,
        position: row.position,
        summaryKo,
        createdAt: row.createdAt,
      };
    })
  );
}

export async function POST(req: Request) {
  const { rawText, company, position } = (await req.json()) as {
    rawText?: string;
    company?: string;
    position?: string;
  };

  if (!rawText?.trim()) {
    return NextResponse.json({ error: "채용공고 텍스트를 입력해 주세요." }, { status: 400 });
  }
  if (rawText.length > 15000) {
    return NextResponse.json({ error: "공고가 너무 깁니다. 핵심 부분만 붙여넣어 주세요." }, { status: 413 });
  }

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
          content: `You are an expert career coach analyzing a job posting for a senior Korean AI/IT leader preparing for an English interview.

Extract the posting into JSON with this exact shape:
{
  "company": "company name (use the user-provided value if the posting doesn't say)",
  "position": "job title",
  "mustHave": ["핵심 필수 요구사항, 최대 5개 (영어)"],
  "niceToHave": ["우대사항, 최대 3개 (영어)"],
  "responsibilities": ["주요 업무, 최대 4개 (영어)"],
  "interviewAnglesEn": ["3-5 specific angles an interviewer for THIS role would probe, in English"],
  "summaryKo": "이 포지션이 어떤 사람을 찾는지 한국어 3문장 요약"
}`,
        },
        {
          role: "user",
          content: `${company ? `Company (user-provided): ${company}\n` : ""}${position ? `Position (user-provided): ${position}\n` : ""}\nJob posting:\n\n${rawText}`,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    console.error("JD analysis failed", await res.text());
    return NextResponse.json({ error: "공고 분석에 실패했습니다." }, { status: res.status });
  }

  const data = await res.json();
  let summary: JdSummary;
  try {
    const raw = JSON.parse(data.choices[0].message.content) as Record<string, unknown>;
    summary = {
      company: asStr(raw.company, company ?? "Unknown"),
      position: asStr(raw.position, position ?? "Unknown"),
      mustHave: asStrArray(raw.mustHave),
      niceToHave: asStrArray(raw.niceToHave),
      responsibilities: asStrArray(raw.responsibilities),
      interviewAnglesEn: asStrArray(raw.interviewAnglesEn),
      summaryKo: asStr(raw.summaryKo),
    };
  } catch {
    console.error("JD summary JSON parse failed", data.choices?.[0]?.message?.content);
    return NextResponse.json({ error: "공고 분석 결과 처리에 실패했습니다." }, { status: 500 });
  }

  const inserted = await db
    .insert(jobPostings)
    .values({
      company: company?.trim() || summary.company,
      position: position?.trim() || summary.position,
      rawText,
      summaryJson: JSON.stringify(summary),
    })
    .returning();

  return NextResponse.json(
    {
      id: inserted[0].id,
      company: inserted[0].company,
      position: inserted[0].position,
      summary,
      createdAt: inserted[0].createdAt,
    },
    { status: 201 }
  );
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.update(jobPostings).set({ status: "archived" }).where(eq(jobPostings.id, id));
  return NextResponse.json({ ok: true });
}
