export interface PatternItem {
  sentence: string;
  meaningKo: string;
  usagePointKo: string;
}

export interface PatternMistake {
  wrong: string;
  correct: string;
  tipKo: string;
}

export interface ShadowingTip {
  sentence: string;
  links: string[];
  tipKo: string;
}

export interface StructureStep {
  label: string;
  sentence: string;
}

export interface PatternExercise {
  question: string;
  structure: StructureStep[];
}

export interface DailyPatternSet {
  topic: string;
  audience: string;
  patterns: PatternItem[];
  mistakes: PatternMistake[];
  shadowing: ShadowingTip;
  exercise: PatternExercise;
  miniFocusKo: string;
  source: "openai" | "manual" | "merged";
}

export const DAILY_PATTERN_SET_TYPE = "daily_pattern_set";

export function getKstDate(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export const DAILY_PATTERN_SET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "topic",
    "audience",
    "patterns",
    "mistakes",
    "shadowing",
    "exercise",
    "miniFocusKo",
  ],
  properties: {
    topic: { type: "string" },
    audience: { type: "string" },
    patterns: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sentence", "meaningKo", "usagePointKo"],
        properties: {
          sentence: { type: "string" },
          meaningKo: { type: "string" },
          usagePointKo: { type: "string" },
        },
      },
    },
    mistakes: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["wrong", "correct", "tipKo"],
        properties: {
          wrong: { type: "string" },
          correct: { type: "string" },
          tipKo: { type: "string" },
        },
      },
    },
    shadowing: {
      type: "object",
      additionalProperties: false,
      required: ["sentence", "links", "tipKo"],
      properties: {
        sentence: { type: "string" },
        links: {
          type: "array",
          minItems: 2,
          maxItems: 3,
          items: { type: "string" },
        },
        tipKo: { type: "string" },
      },
    },
    exercise: {
      type: "object",
      additionalProperties: false,
      required: ["question", "structure"],
      properties: {
        question: { type: "string" },
        structure: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "sentence"],
            properties: {
              label: { type: "string" },
              sentence: { type: "string" },
            },
          },
        },
      },
    },
    miniFocusKo: { type: "string" },
  },
} as const;
