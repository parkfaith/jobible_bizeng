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
  sentenceKo?: string;
}

export interface PatternExercise {
  question: string;
  questionKo?: string;
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
export const WEEKLY_SUMMARY_SET_TYPE = "weekly_summary_set";

export interface WeeklySummarySet {
  weekStart: string;
  weekEnd: string;
  corePatterns: Array<{ sentence: string; sentenceKo?: string; from: string }>;
  keyQuestions: string[];
  keyQuestionsKo?: string[];
  fixThis: string;
  readySentences: string[];
  readySentencesKo?: string[];
  rehearsalQuestion: string;
  rehearsalQuestionKo?: string;
  answerStructure: StructureStep[];
  source: "openai" | "manual";
}

export function getKstDate(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export function isWeekendKst(date = new Date()): boolean {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

// Returns the Saturday date (KST) of the current weekend — used as the cache key
export function getWeekSaturdayDate(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=Sun, 6=Sat
  const offset = day === 6 ? 0 : -1; // Sun → use yesterday (Sat)
  const sat = new Date(kst.getTime() + offset * 86400000);
  return sat.toISOString().slice(0, 10);
}

// Returns Mon–Fri range for the week containing the given Saturday
export function getWeekRange(saturdayDate: string): { start: string; end: string } {
  const [year, month, day] = saturdayDate.split("-").map(Number);
  const sat = new Date(Date.UTC(year, month - 1, day));
  const mon = new Date(sat.getTime() - 5 * 86400000);
  const fri = new Date(sat.getTime() - 1 * 86400000);
  return {
    start: mon.toISOString().slice(0, 10),
    end: fri.toISOString().slice(0, 10),
  };
}

export const WEEKLY_SUMMARY_SET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "weekStart",
    "weekEnd",
    "corePatterns",
    "keyQuestions",
    "keyQuestionsKo",
    "fixThis",
    "readySentences",
    "readySentencesKo",
    "rehearsalQuestion",
    "rehearsalQuestionKo",
    "answerStructure",
  ],
  properties: {
    weekStart: { type: "string" },
    weekEnd: { type: "string" },
    corePatterns: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sentence", "sentenceKo", "from"],
        properties: {
          sentence: { type: "string" },
          sentenceKo: { type: "string" },
          from: { type: "string" },
        },
      },
    },
    keyQuestions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
    keyQuestionsKo: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "string" },
    },
    fixThis: { type: "string" },
    readySentences: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: { type: "string" },
    },
    readySentencesKo: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: { type: "string" },
    },
    rehearsalQuestion: { type: "string" },
    rehearsalQuestionKo: { type: "string" },
    answerStructure: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "sentence", "sentenceKo"],
        properties: {
          label: { type: "string" },
          sentence: { type: "string" },
          sentenceKo: { type: "string" },
        },
      },
    },
  },
} as const;

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
      required: ["question", "questionKo", "structure"],
      properties: {
        question: { type: "string" },
        questionKo: { type: "string" },
        structure: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "sentence", "sentenceKo"],
            properties: {
              label: { type: "string" },
              sentence: { type: "string" },
              sentenceKo: { type: "string" },
            },
          },
        },
      },
    },
    miniFocusKo: { type: "string" },
  },
} as const;
