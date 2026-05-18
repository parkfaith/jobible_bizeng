"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

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
}

const SCORE_LABELS = [
  { key: "contentScore", label: "내용" },
  { key: "structureScore", label: "구조" },
  { key: "englishScore", label: "영어" },
  { key: "leadershipScore", label: "리더십 톤" },
] as const;

function ScoreBar({ score, label }: { score: number; label: string }) {
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
    </div>
  );
}

function PracticeContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") ?? "daily";

  const [stage, setStage] = useState<Stage>("loading");
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/questions/daily")
      .then((r) => r.json())
      .then((q) => {
        setQuestion(q);
        setStage("idle");
      })
      .catch(() => setError("질문을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
  }, []);

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
    if (timerRef.current) clearInterval(timerRef.current);

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: mediaRecorderRef.current?.mimeType ?? "audio/webm",
      });
      // Stop all tracks to release mic
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());

      setStage("transcribing");
      try {
        const form = new FormData();
        form.append("audio", blob);
        const tRes = await fetch("/api/transcribe", { method: "POST", body: form });
        const { transcript: text } = await tRes.json();
        setTranscript(text ?? "");

        if (!text?.trim()) {
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
          }),
        });
        const fb = await fRes.json();
        setFeedback(fb);
        setStage("feedback");

        // Record completed session for home screen stats
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "daily" }),
        }).then((r) =>
          r.json().then((session) =>
            fetch("/api/sessions", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: session.id,
                status: "completed",
                endedAt: new Date().toISOString(),
              }),
            })
          )
        );
      } catch {
        setError("처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
        setStage("idle");
      }
    };

    mediaRecorderRef.current.stop();
  }, [question]);

  function retry() {
    setTranscript("");
    setFeedback(null);
    setSaved(false);
    setStage("idle");
  }

  async function saveToNotes() {
    if (!question || !feedback) return;
    await fetch("/api/notes", {
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
    setSaved(true);
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link href="/" className="text-slate-400 text-2xl leading-none">
          ←
        </Link>
        <div>
          <p className="text-slate-400 text-xs">오늘의 질문 연습</p>
          <h1 className="text-white font-bold text-base leading-tight">
            {question?.category === "intro" && "자기소개"}
            {question?.category === "career" && "경력 설명"}
            {question?.category === "leadership" && "리더십"}
            {question?.category === "tech" && "기술 프로젝트"}
            {question?.category === "failure" && "실패/갈등"}
            {!question?.category && "로딩 중..."}
          </h1>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 mb-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Question card */}
      {question && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-4">
          <p className="text-slate-400 text-xs mb-2 font-medium">면접 질문</p>
          <p className="text-white text-base leading-relaxed">{question.question}</p>
          {stage === "idle" && question.hint && (
            <p className="text-indigo-300 text-xs mt-3 pt-3 border-t border-slate-700">
              💡 {question.hint}
            </p>
          )}
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
            <p className="text-slate-300 text-sm font-semibold mb-4">평가</p>
            <div className="flex flex-col gap-3">
              {SCORE_LABELS.map(({ key, label }) => (
                <ScoreBar key={key} score={feedback[key]} label={label} />
              ))}
            </div>
          </div>

          {/* Korean feedback */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <p className="text-slate-300 text-sm font-semibold mb-3">코칭 피드백</p>
            <p className="text-slate-200 text-sm leading-relaxed">{feedback.feedbackKo}</p>
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
                  "{expr}"
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={retry}
              className="flex-1 py-4 rounded-xl bg-slate-800 text-slate-300 font-semibold text-sm border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              다시 말하기
            </button>
            <button
              onClick={saveToNotes}
              disabled={saved}
              className={`flex-1 py-4 rounded-xl font-semibold text-sm transition-colors ${
                saved
                  ? "bg-green-800 text-green-300 border border-green-700"
                  : "bg-indigo-600 text-white hover:bg-indigo-500"
              }`}
            >
              {saved ? "저장됨 ✓" : "답변 노트 저장"}
            </button>
          </div>
        </div>
      )}

      {/* Mic area */}
      {(stage === "idle" || stage === "recording") && (
        <div className="flex flex-col items-center gap-5 mt-4">
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
      {stage === "loading" && (
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
