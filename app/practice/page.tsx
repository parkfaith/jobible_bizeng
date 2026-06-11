"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import type { DailyPatternSet, WeeklySummarySet } from "@/lib/pattern-set";

type Stage = "loading" | "idle" | "recording" | "transcribing" | "feedback";

interface DailyQuestion {
  question: string;
  category: string;
  hint: string;
}

interface Feedback {
  contentScore: number;
  structureScore: number;
  englishScore: number;
  leadershipScore: number;
  feedbackKo: string;
  improvedAnswerEn: string;
  keyExpressions: string[];
  patternUsageKo?: string;
  progressKo?: string;
}

interface NoteData {
  id: number;
  category: string;
  questionText: string;
  originalAnswer: string | null;
  improvedAnswer: string | null;
  finalAnswer: string | null;
}

interface Attempt {
  feedbackId: number;
  contentScore: number | null;
  structureScore: number | null;
  englishScore: number | null;
  leadershipScore: number | null;
  feedbackKo: string;
  improvedAnswerEn: string | null;
  createdAt: string | null;
  transcript: string | null;
}

const SCORE_LABELS = [
  { key: "contentScore", label: "내용" },
  { key: "structureScore", label: "구조" },
  { key: "englishScore", label: "영어" },
  { key: "leadershipScore", label: "리더십 톤" },
] as const;

function ScoreBar({ score, label, delta }: { score: number; label: string; delta?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400 text-xs w-16 shrink-0">{label}</span>
      <div className="flex gap-1 flex-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`h-2 flex-1 rounded-full ${
              n <= score ? "bg-indigo-500" : "bg-slate-700"
            }`}
          />
        ))}
      </div>
      <span className="text-slate-300 text-xs w-4 text-right">{score}</span>
      {delta !== undefined && (
        <span
          className={`text-xs w-7 text-right font-medium ${
            delta > 0 ? "text-green-400" : delta < 0 ? "text-orange-400" : "text-slate-500"
          }`}
        >
          {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "="}
        </span>
      )}
    </div>
  );
}

function PracticeContent() {
  const searchParams = useSearchParams();
  const source = searchParams.get("source") ?? "pattern";
  const weeklyDate = searchParams.get("date");
  const noteIdParam = Number(searchParams.get("noteId"));
  const isPatternPractice = source === "pattern";
  const isWeeklyPractice = source === "weekly";
  const isNotePractice = source === "note";

  // 마스터 모드인데 noteId가 없는 잘못된 진입 — 렌더에서 파생 (stage는 loading에 머묾)
  const invalidNoteEntry = isNotePractice && !noteIdParam;

  const [stage, setStage] = useState<Stage>("loading");
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [patternSet, setPatternSet] = useState<DailyPatternSet | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummarySet | null>(null);
  const [note, setNote] = useState<NoteData | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [showFinalAnswer, setShowFinalAnswer] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        try {
          if (recorder.state !== "inactive") recorder.stop();
        } catch {
          // The recorder may already be stopping during route transitions.
        }
        recorder.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
      }
      chunksRef.current = [];
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    if (isNotePractice) {
      // noteId가 없으면 렌더 단계에서 invalidNoteEntry로 안내 — effect 내 동기 setState 금지(lint)
      if (!noteIdParam) {
        return () => controller.abort();
      }
      Promise.all([
        fetch(`/api/notes?id=${noteIdParam}`, { cache: "no-store", signal: controller.signal }).then((r) => r.json()),
        fetch(`/api/notes/attempts?noteId=${noteIdParam}`, { cache: "no-store", signal: controller.signal }).then((r) => r.json()),
      ])
        .then(([noteData, attemptsData]) => {
          if (noteData.error) throw new Error(noteData.error);
          setNote(noteData);
          setAttempts(Array.isArray(attemptsData.attempts) ? attemptsData.attempts : []);
          setQuestion({
            question: noteData.questionText,
            category: noteData.category,
            hint: "최종 답변을 떠올리며 보지 않고 말해보세요. 막히면 아래에서 답변을 펼쳐볼 수 있습니다.",
          });
          setStage("idle");
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError("노트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
          setStage("idle");
        });
      return () => controller.abort();
    }

    let endpoint: string;
    if (isWeeklyPractice) {
      const params = new URLSearchParams();
      if (weeklyDate) params.set("date", weeklyDate);
      const query = params.toString();
      endpoint = query ? `/api/patterns/weekly?${query}` : "/api/patterns/weekly";
    }
    else if (isPatternPractice) endpoint = "/api/patterns/daily";
    else endpoint = "/api/questions/daily";

    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        if (isWeeklyPractice) {
          const set = data as WeeklySummarySet;
          setWeeklySummary(set);
          setQuestion({
            question: set.rehearsalQuestion,
            category: "career",
            hint: `${set.answerStructure.map((s) => s.label).join(" → ")} 구조로 30초 안에 말해보세요.`,
          });
        } else if (isPatternPractice) {
          const set = data as DailyPatternSet;
          setPatternSet(set);
          setQuestion({
            question: set.exercise.question,
            category: "career",
            hint: `${set.exercise.structure.map((step) => step.label).join(" → ")} 구조로 30초 안에 말해보세요.`,
          });
        } else {
          setQuestion(data);
        }
        setStage("idle");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("질문을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        setStage("idle");
      });

    return () => controller.abort();
  }, [isPatternPractice, isWeeklyPractice, isNotePractice, noteIdParam, weeklyDate]);

  const startRecording = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = mr;
      mr.start(250);
      setStage("recording");
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      setError("마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }


    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: mediaRecorderRef.current?.mimeType ?? "audio/webm",
      });
      // Stop all tracks to release mic
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());

      setStage("transcribing");
      try {
        // 세션을 먼저 생성해서 피드백 저장에 sessionId를 연결
        const sessionRes = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "daily" }),
        });
        const session = await sessionRes.json();
        const sessionId: number = session.id;

        const form = new FormData();
        form.append("audio", blob);
        const tRes = await fetch("/api/transcribe", { method: "POST", body: form });
        if (!tRes.ok) {
          throw new Error("음성 인식에 실패했습니다.");
        }
        const { transcript: text } = await tRes.json();
        setTranscript(text ?? "");

        if (!text?.trim()) {
          fetch("/api/sessions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: sessionId, status: "abandoned", endedAt: new Date().toISOString() }),
          });
          setError("음성이 인식되지 않았습니다. 다시 시도해 주세요.");
          setStage("idle");
          return;
        }

        const fRes = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question?.question,
            transcript: text,
            category: question?.category,
            patternSet: patternSet ?? (weeklySummary ? { topic: "Weekly Rehearsal", exercise: { question: weeklySummary.rehearsalQuestion, structure: weeklySummary.answerStructure } } : null),
            sessionId,
            noteId: isNotePractice && note ? note.id : undefined,
            // 첫 재도전의 비교 기준은 암기 대상인 최종 답변 — 시도 이력이 생기면 직전 transcript
            previousAnswer: isNotePractice
              ? attempts[0]?.transcript ??
                note?.finalAnswer ??
                note?.improvedAnswer ??
                note?.originalAnswer ??
                undefined
              : undefined,
          }),
        });
        if (!fRes.ok) {
          throw new Error("피드백 생성에 실패했습니다.");
        }
        const fb = await fRes.json();
        setFeedback(fb);
        setStage("feedback");

        // 세션 완료 처리 (fire and forget)
        fetch("/api/sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: sessionId, status: "completed", endedAt: new Date().toISOString() }),
        });
      } catch {
        setError("처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
        setStage("idle");
      }
    };

    mediaRecorderRef.current.stop();
  }, [patternSet, weeklySummary, question, isNotePractice, note, attempts]);

  function retry() {
    setTranscript("");
    setFeedback(null);
    setSaved(false);
    setSaveError("");
    setStage("idle");
  }

  // 마스터 모드: 중복 노트를 만들지 않고 기존 노트의 최종 답변을 갱신
  async function updateFinalAnswer() {
    if (!note || !feedback) return;
    setSaveError("");
    try {
      const res = await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: note.id, finalAnswer: feedback.improvedAnswerEn }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaved(true);
    } catch {
      setSaveError("저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  async function saveToNotes() {
    if (!question || !feedback) return;
    setSaveError("");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: question.category,
          questionText: question.question,
          originalAnswer: transcript,
          improvedAnswer: feedback.improvedAnswerEn,
          finalAnswer: feedback.improvedAnswerEn,
          keyExpressions: feedback.keyExpressions,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaved(true);
    } catch {
      setSaveError("저장에 실패했습니다. 다시 시도해 주세요.");
    }
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // 마스터 모드: 직전 시도 (점수 델타·답변 비교 기준)
  // 시도 이력이 없으면 암기 대상인 최종 답변을 비교 기준으로 사용
  const prevAttempt = isNotePractice ? attempts[0] ?? null : null;
  const prevScores = prevAttempt && prevAttempt.contentScore != null ? prevAttempt : null;
  const previousAnswerText = isNotePractice
    ? prevAttempt?.transcript ??
      note?.finalAnswer ??
      note?.improvedAnswer ??
      note?.originalAnswer ??
      null
    : null;
  const previousAnswerLabel = prevAttempt?.transcript ? "직전 답변" : "기존 최종 답변";

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/" className="tap-target flex items-center justify-center text-slate-400 text-2xl leading-none">
          ←
        </Link>
        <div className="w-11 h-11 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-2xl shrink-0">
          🎙️
        </div>
        <div>
          <p className="text-slate-400 text-xs">
            {isWeeklyPractice
              ? "주말 리허설"
              : isNotePractice
              ? "마스터 모드"
              : isPatternPractice
              ? "패턴 기반 질문 연습"
              : "오늘의 질문 연습"}
          </p>
          <h1 className="text-white font-bold text-base leading-tight">
            {isWeeklyPractice && "이번 주 3분 리허설"}
            {isNotePractice && "핵심 답변 다시 도전"}
            {isPatternPractice && !isWeeklyPractice && "30초 답변 워밍업"}
            {!isPatternPractice && !isWeeklyPractice && !isNotePractice && question?.category === "intro" && "자기소개"}
            {!isPatternPractice && !isWeeklyPractice && !isNotePractice && question?.category === "career" && "경력 설명"}
            {!isPatternPractice && !isWeeklyPractice && !isNotePractice && question?.category === "leadership" && "리더십"}
            {!isPatternPractice && !isWeeklyPractice && !isNotePractice && question?.category === "tech" && "기술 프로젝트"}
            {!isPatternPractice && !isWeeklyPractice && !isNotePractice && question?.category === "failure" && "실패/갈등"}
            {!question?.category && "로딩 중..."}
          </h1>
        </div>
      </div>

      {/* Error */}
      {(invalidNoteEntry || error) && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 mb-4 text-red-300 text-sm">
          {invalidNoteEntry
            ? "노트를 찾을 수 없습니다. 답변 노트에서 다시 시도해 주세요."
            : error}
        </div>
      )}

      {/* Question card */}
      {question && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-xs font-medium">면접 질문</p>
            {isNotePractice && attempts.length > 0 && (
              <p className="text-indigo-300 text-xs">{attempts.length + 1}번째 도전</p>
            )}
          </div>
          <p className="text-white text-base leading-relaxed">{question.question}</p>
          {stage === "idle" && question.hint && (
            <p className="text-indigo-300 text-xs mt-3 pt-3 border-t border-slate-700">
              💡 {question.hint}
            </p>
          )}
        </div>
      )}

      {/* 마스터 모드: 최종 답변 — 기본 접힘 (암기 회상 유도) */}
      {isNotePractice && note?.finalAnswer && (stage === "idle" || stage === "recording") && (
        <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-5 mb-4">
          <button
            onClick={() => setShowFinalAnswer(!showFinalAnswer)}
            className="flex items-center justify-between w-full"
          >
            <p className="text-indigo-300 text-xs font-medium">내 최종 답변</p>
            <span className="text-slate-400 text-xs">{showFinalAnswer ? "▲ 접기" : "▼ 보기"}</span>
          </button>
          {showFinalAnswer && (
            <p className="text-white text-sm leading-relaxed mt-3">{note.finalAnswer}</p>
          )}
        </div>
      )}

      {patternSet && !isWeeklyPractice && (stage === "idle" || stage === "recording") && (
        <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-indigo-300 text-xs font-medium">오늘 써볼 답변 프레임</p>
              <p className="text-white text-sm font-semibold mt-0.5">{patternSet.topic}</p>
            </div>
            <Link href="/patterns" className="tap-target flex items-center text-indigo-300 text-xs shrink-0">
              전체 보기
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {patternSet.exercise.structure.map((step) => (
              <p key={step.label} className="text-slate-100 text-sm leading-relaxed">
                <span className="text-indigo-300 text-xs font-semibold mr-2">
                  {step.label}
                </span>{" "}
                {step.sentence}
              </p>
            ))}
          </div>
          <p className="text-slate-400 text-xs leading-relaxed mt-3 border-t border-indigo-800 pt-3">
            {patternSet.miniFocusKo}
          </p>
        </div>
      )}

      {weeklySummary && isWeeklyPractice && (stage === "idle" || stage === "recording") && (
        <div className="bg-emerald-950/60 border border-emerald-800/50 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-emerald-300 text-xs font-medium">이번 주 30초 답변 구조</p>
              <p className="text-white text-sm font-semibold mt-0.5">
                {weeklySummary.weekStart} ~ {weeklySummary.weekEnd}
              </p>
            </div>
            <Link href="/patterns" className="tap-target flex items-center text-emerald-300 text-xs shrink-0">
              전체 보기
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {weeklySummary.answerStructure.map((step) => (
              <p key={step.label} className="text-slate-100 text-sm leading-relaxed">
                <span className="text-emerald-300 text-xs font-semibold mr-2">
                  {step.label}
                </span>{" "}
                {step.sentence}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      {(stage === "transcribing" || stage === "feedback") && transcript && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-4">
          <p className="text-slate-500 text-xs mb-2">내 답변 (음성 인식)</p>
          <p className="text-slate-300 text-sm leading-relaxed">{transcript}</p>
        </div>
      )}

      {/* Feedback */}
      {stage === "feedback" && feedback && (
        <div className="flex flex-col gap-4 mb-6">
          {/* Scores */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-300 text-sm font-semibold">평가</p>
              {prevScores && <p className="text-slate-500 text-xs">직전 시도 대비</p>}
            </div>
            <div className="flex flex-col gap-3">
              {SCORE_LABELS.map(({ key, label }) => (
                <ScoreBar
                  key={key}
                  score={feedback[key]}
                  label={label}
                  delta={prevScores ? feedback[key] - (prevScores[key] ?? 0) : undefined}
                />
              ))}
            </div>
          </div>

          {/* 마스터 모드: 직전 시도 대비 진전 */}
          {feedback.progressKo && (
            <div className="bg-slate-800 border border-indigo-800 rounded-2xl p-5">
              <p className="text-indigo-300 text-sm font-semibold mb-2">📈 직전 시도 대비 진전</p>
              <p className="text-white text-sm leading-relaxed">{feedback.progressKo}</p>
            </div>
          )}

          {/* 마스터 모드: 직전 답변 vs 이번 답변 */}
          {isNotePractice && previousAnswerText && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <p className="text-slate-300 text-sm font-semibold mb-3">{previousAnswerLabel} vs 이번 답변</p>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-slate-500 text-xs mb-1">{previousAnswerLabel}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">{previousAnswerText}</p>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-indigo-300 text-xs mb-1">이번 답변</p>
                  <p className="text-white text-sm leading-relaxed">{transcript}</p>
                </div>
              </div>
            </div>
          )}

          {/* Korean feedback */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <p className="text-slate-300 text-sm font-semibold mb-3">코칭 피드백</p>
            <p className="text-slate-200 text-sm leading-relaxed">{feedback.feedbackKo}</p>
            {feedback.patternUsageKo && (
              <p className="text-amber-200 text-xs leading-relaxed mt-3 border-t border-slate-700 pt-3">
                {feedback.patternUsageKo}
              </p>
            )}
          </div>

          {/* Improved answer */}
          <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-5">
            <p className="text-indigo-300 text-sm font-semibold mb-3">개선된 답변</p>
            <p className="text-white text-sm leading-relaxed">{feedback.improvedAnswerEn}</p>
          </div>

          {/* Key expressions */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <p className="text-slate-300 text-sm font-semibold mb-3">바로 쓸 수 있는 표현</p>
            <div className="flex flex-col gap-2">
              {feedback.keyExpressions.map((expr, i) => (
                <div
                  key={i}
                  className="bg-slate-700 rounded-xl px-4 py-3 text-white text-sm"
                >
                  {expr}
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          {saveError && (
            <p className="text-red-300 text-xs leading-relaxed">{saveError}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={retry}
              className="flex-1 py-4 rounded-xl bg-slate-800 text-slate-300 font-semibold text-sm border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              다시 말하기
            </button>
            <button
              onClick={isNotePractice ? updateFinalAnswer : saveToNotes}
              disabled={saved}
              className={`flex-1 py-4 rounded-xl font-semibold text-sm transition-colors ${
                saved
                  ? "bg-green-800 text-green-300 border border-green-700"
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              }`}
            >
              {saved
                ? isNotePractice
                  ? "최종 답변 업데이트됨 ✓"
                  : "저장됨 ✓"
                : isNotePractice
                ? "최종 답변으로 업데이트"
                : "답변 노트 저장"}
            </button>
          </div>
        </div>
      )}

      {/* Mic area */}
      {(stage === "idle" || stage === "recording") && (
        <div className="sticky bottom-0 -mx-4 flex flex-col items-center gap-4 mt-4 bg-slate-950/95 px-4 pb-safe pt-4 backdrop-blur">
          {stage === "recording" && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-sm font-mono">{formatTime(recordingSeconds)}</span>
              <span className="text-slate-500 text-xs">녹음 중</span>
            </div>
          )}

          <button
            onClick={stage === "idle" ? startRecording : stopRecording}
            className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-lg transition-all active:scale-95 ${
              stage === "recording"
                ? "bg-red-600 hover:bg-red-500 shadow-red-900 animate-pulse"
                : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900"
            }`}
          >
            {stage === "recording" ? "⏹" : "🎙️"}
          </button>

          <p className="text-slate-400 text-sm">
            {stage === "recording" ? "탭하면 중지하고 분석합니다" : "탭하면 녹음 시작"}
          </p>
        </div>
      )}

      {/* Transcribing spinner */}
      {stage === "transcribing" && (
        <div className="flex flex-col items-center gap-4 mt-8">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">음성 인식 중...</p>
        </div>
      )}

      {/* Loading spinner */}
      {stage === "loading" && !invalidNoteEntry && (
        <div className="flex flex-col items-center gap-4 mt-16">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-slate-500 text-sm">오늘의 질문을 준비하는 중...</p>
        </div>
      )}
    </main>
  );
}

export default function PracticePage() {
  return (
    <Suspense>
      <PracticeContent />
    </Suspense>
  );
}
