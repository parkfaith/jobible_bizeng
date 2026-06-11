import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyPatterns, jobPostings, practiceSessions, profile } from "@/lib/db/schema";
import { and, eq, gte, ne } from "drizzle-orm";
import {
  DAILY_PATTERN_SET_TYPE,
  getKstDate,
  type DailyPatternSet,
} from "@/lib/pattern-set";
import {
  buildSystemPrompt,
  type ScenarioId,
} from "@/lib/scenarios";
import { WEEKLY_SESSION_LIMIT } from "@/lib/constants";
import { buildWeaknessCtx, getRecentWeaknesses } from "@/lib/weakness";

function getWeekMondayUtcIso(): string {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const nowKst = new Date(Date.now() + kstOffsetMs);
  const dayKst = nowKst.getUTCDay();
  const daysFromMonday = dayKst === 0 ? 6 : dayKst - 1;
  const mondayKst = new Date(nowKst.getTime() - daysFromMonday * 86400000);
  const mondayMidnightKst = new Date(
    Date.UTC(mondayKst.getUTCFullYear(), mondayKst.getUTCMonth(), mondayKst.getUTCDate(), 0, 0, 0)
  );
  const mondayMidnightUtc = new Date(mondayMidnightKst.getTime() - kstOffsetMs);
  return mondayMidnightUtc.toISOString();
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { scenario?: string; jdId?: number };
  const scenarioId: ScenarioId = (body.scenario as ScenarioId) ?? "interview";
  const jdId = typeof body.jdId === "number" ? body.jdId : null;

  // ── Weekly session limit guard ────────────────────────────────────────────
  const mondayIso = getWeekMondayUtcIso();
  const weeklySessions = await db
    .select()
    .from(practiceSessions)
    .where(
      and(
        eq(practiceSessions.mode, "interview"),
        gte(practiceSessions.startedAt, mondayIso),
        ne(practiceSessions.status, "abandoned")
      )
    );

  if (weeklySessions.length >= WEEKLY_SESSION_LIMIT) {
    return NextResponse.json(
      {
        error: "weekly_limit_reached",
        message: `이번 주 실전 세션 ${WEEKLY_SESSION_LIMIT}회를 완료했습니다. 다음 주 월요일에 다시 이용할 수 있습니다.`,
        count: weeklySessions.length,
        limit: WEEKLY_SESSION_LIMIT,
      },
      { status: 429 }
    );
  }

  // ── Build prompt context ──────────────────────────────────────────────────
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

Use this topic as the main thread of the interview.`
    : "No daily pattern set is available. Use a general senior AI leadership interview flow.";

  // 면접 시나리오에서만 과거 약점을 주입 — 면접관이 약점 영역을 자연스럽게 검증
  let weaknessCtx = "";
  if (scenarioId === "interview") {
    try {
      const { items } = await getRecentWeaknesses();
      weaknessCtx = buildWeaknessCtx(items);
    } catch (err) {
      console.error("weakness context load failed", err);
    }
  }

  // JD 면접: 오늘의 패턴 대신 실제 공고 요구사항을 면접 축으로 사용
  let jdCtx = "";
  if (scenarioId === "interview" && jdId) {
    const jdRows = await db.select().from(jobPostings).where(eq(jobPostings.id, jdId)).limit(1);
    if (jdRows[0]) {
      try {
        const summary = JSON.parse(jdRows[0].summaryJson) as {
          mustHave?: string[];
          interviewAnglesEn?: string[];
        };
        jdCtx = `This interview is specifically for the ${jdRows[0].position} role at ${jdRows[0].company}.
Key requirements: ${(summary.mustHave ?? []).join("; ")}
Verification angles to probe: ${(summary.interviewAnglesEn ?? []).join("; ")}

Base most of your questions on these requirements and probe for concrete evidence from the candidate's experience. Mention the company and role naturally in your greeting.`;
      } catch {
        console.error("JD summary parse failed", jdId);
      }
    }
  }

  const instructions = buildSystemPrompt(scenarioId, profileCtx, patternCtx, { weaknessCtx, jdCtx });

  // ── Request ephemeral token ───────────────────────────────────────────────
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-mini-realtime-preview",
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
            speed: 0.8,
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
