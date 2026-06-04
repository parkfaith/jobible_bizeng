import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetPosition: text("target_position").notNull(),
  currentRole: text("current_role").notNull(),
  yearsExp: integer("years_exp").notNull(),
  projects: text("projects").notNull(), // JSON array of { name, role, problem, tech, impact }
  topConcern: text("top_concern").notNull(),
  focusAreas: text("focus_areas").notNull(), // JSON array: ['intro','career','leadership','tech']
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const practiceSessions = sqliteTable("practice_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mode: text("mode", { enum: ["daily", "interview"] }).notNull(),
  status: text("status", { enum: ["in_progress", "completed", "abandoned"] })
    .notNull()
    .default("in_progress"),
  startedAt: text("started_at").default(sql`(datetime('now'))`),
  endedAt: text("ended_at"),
});

export const practiceTurns = sqliteTable("practice_turns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => practiceSessions.id),
  turnOrder: integer("turn_order").notNull(),
  questionText: text("question_text").notNull(),
  questionCategory: text("question_category", {
    enum: ["intro", "career", "leadership", "tech", "failure", "closing"],
  }),
  userTranscript: text("user_transcript"),
  aiFollowup: text("ai_followup"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const feedbacks = sqliteTable("feedbacks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => practiceSessions.id),
  turnId: integer("turn_id").references(() => practiceTurns.id),
  contentScore: integer("content_score"), // 1-5
  structureScore: integer("structure_score"), // 1-5
  englishScore: integer("english_score"), // 1-5
  leadershipScore: integer("leadership_score"), // 1-5
  feedbackKo: text("feedback_ko").notNull(), // 한국어 피드백
  improvedAnswerEn: text("improved_answer_en"), // 영어 개선 답변
  keyExpressions: text("key_expressions"), // JSON array of strings
  bestAnswer: text("best_answer"), // 인터뷰 종료 피드백용
  worstAnswer: text("worst_answer"),
  nextFocus: text("next_focus"),
  rawJson: text("raw_json"), // 전체 구조화 피드백 JSON (qa, 번역 포함)
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const answerNotes = sqliteTable("answer_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category", {
    enum: ["intro", "career", "leadership", "tech", "failure"],
  }).notNull(),
  questionText: text("question_text").notNull(),
  originalAnswer: text("original_answer"),
  improvedAnswer: text("improved_answer"),
  finalAnswer: text("final_answer"), // 최종 암기용
  keyExpressions: text("key_expressions"), // JSON array of strings
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const dailyPatterns = sqliteTable(
  "daily_patterns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    patternType: text("pattern_type").notNull(),
    content: text("content").notNull(), // JSON
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("daily_patterns_date_type_idx").on(t.date, t.patternType)]
);
