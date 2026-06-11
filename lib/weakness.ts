import { desc, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedbacks } from "@/lib/db/schema";

export const WEAKNESS_TAGS = [
  "structure",
  "conciseness",
  "quantification",
  "specificity",
  "grammar",
  "vocabulary",
  "confidence",
  "leadership_tone",
] as const;

export type WeaknessTag = (typeof WEAKNESS_TAGS)[number];

export interface WeaknessItem {
  tag: string; // WeaknessTag 또는 레거시 행 폴백용 "legacy"
  labelKo: string;
  evidenceKo?: string;
}

const TAG_DESCRIPTION_EN: Record<WeaknessTag, string> = {
  structure: "answer structure — conclusion-first, organized reasoning",
  conciseness: "conciseness — answers run long, the key point arrives late",
  quantification: "quantification — claims lack numbers or measurable impact",
  specificity: "specificity — answers stay abstract with few concrete examples",
  grammar: "grammar accuracy",
  vocabulary: "vocabulary range — relies on basic or repetitive wording",
  confidence: "confident delivery — hedging, weak openings",
  leadership_tone: "executive presence — does not sound like a senior leader",
};

/**
 * 최근 면접 피드백 3건에서 약점을 모은다.
 * rawJson.weaknesses가 없는 레거시 행은 nextFocus 텍스트로 폴백.
 * 여러 세션에서 반복된 태그를 우선해 최대 3개 반환.
 */
export async function getRecentWeaknesses(): Promise<{
  items: WeaknessItem[];
  lastNextFocusKo: string | null;
}> {
  const rows = await db
    .select({
      nextFocus: feedbacks.nextFocus,
      rawJson: feedbacks.rawJson,
    })
    .from(feedbacks)
    .where(isNotNull(feedbacks.bestAnswer))
    .orderBy(desc(feedbacks.id))
    .limit(3);

  const collected: WeaknessItem[] = [];
  for (const row of rows) {
    let parsed: WeaknessItem[] = [];
    if (row.rawJson) {
      try {
        const raw = JSON.parse(row.rawJson) as { weaknesses?: unknown };
        if (Array.isArray(raw.weaknesses)) {
          parsed = raw.weaknesses
            .filter(
              (w): w is WeaknessItem =>
                !!w &&
                typeof w === "object" &&
                typeof (w as WeaknessItem).tag === "string" &&
                typeof (w as WeaknessItem).labelKo === "string"
            )
            .filter((w) => (WEAKNESS_TAGS as readonly string[]).includes(w.tag));
        }
      } catch {
        // 손상된 rawJson은 무시하고 nextFocus 폴백 사용
      }
    }
    if (parsed.length === 0 && row.nextFocus) {
      parsed = [{ tag: "legacy", labelKo: row.nextFocus }];
    }
    collected.push(...parsed);
  }

  // 태그별 등장 횟수 집계 — 반복된 약점 우선, 같은 횟수면 최근 세션 우선
  const byTag = new Map<string, { item: WeaknessItem; count: number; firstIdx: number }>();
  collected.forEach((item, idx) => {
    const existing = byTag.get(item.tag);
    if (existing) {
      existing.count += 1;
    } else {
      byTag.set(item.tag, { item, count: 1, firstIdx: idx });
    }
  });
  const items = [...byTag.values()]
    .sort((a, b) => b.count - a.count || a.firstIdx - b.firstIdx)
    .slice(0, 3)
    .map((e) => e.item);

  return { items, lastNextFocusKo: rows[0]?.nextFocus ?? null };
}

/** 면접관 시스템 프롬프트에 주입할 영어 블록. items가 비면 빈 문자열. */
export function buildWeaknessCtx(items: WeaknessItem[]): string {
  if (items.length === 0) return "";

  const lines = items.map((item) => {
    const desc = TAG_DESCRIPTION_EN[item.tag as WeaknessTag];
    return desc ? `- ${desc}` : `- coach's note (Korean): ${item.labelKo}`;
  });

  return `Known weak areas from the candidate's previous sessions:
${lines.join("\n")}

Include at most ONE question that naturally probes each weak area. Do not reveal that these are known weaknesses and do not mention previous sessions. Keep the interview flow natural.`;
}
