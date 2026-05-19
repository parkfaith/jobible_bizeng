"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DailyPatternSet } from "@/lib/pattern-set";

type Stage =
  | "briefing"
  | "connecting"
  | "interviewing"
  | "ending"
  | "feedback"
  | "error";

interface Turn {
  role: "ai" | "user";
  text: string;
}

interface InterviewFeedback {
  bestAnswer: { question: string; answer: string; reasonKo: string };
  worstAnswer: { question: string; answer: string; reasonKo: string };
  nextFocusKo: string;
  improvementSentences: string[];
}

const MAX_INTERVIEW_SECONDS = 10 * 60;
const MAX_INTERVIEW_QUESTIONS = 4;

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 rounded-xl px-3 py-3">
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="text-white text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

export default function InterviewPage() {
  const [stage, setStage] = useState<Stage>("briefing");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [patternSet, setPatternSet] = useState<DailyPatternSet | null>(null);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [liveAiText, setLiveAiText] = useState("");
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [savedNote, setSavedNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [saveNoteError, setSaveNoteError] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/patterns/daily")
      .then((res) => res.json())
      .then((body) => {
        if (!body.error) setPatternSet(body);
      })
      .catch(() => setPatternSet(null));
  }, []);

  // Keep ref in sync for use inside callbacks
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const addTurn = useCallback((role: "ai" | "user", text: string) => {
    setTurns((prev) => [...prev, { role, text }]);
  }, []);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  function startInterview() {
    setTurns([]);
    setFeedback(null);
    setErrorMsg("");
    setSavedNote(false);
    setSavingNote(false);
    setSaveNoteError("");
    setElapsedSec(0);
    setStage("connecting");
  }

  const endInterview = useCallback(async () => {
    setStage("ending");
    if (timerRef.current) clearInterval(timerRef.current);

    // Close WebRTC
    dcRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }

    const allTurns = turnsRef.current;
    if (allTurns.length < 2) {
      setErrorMsg("대화 내용이 너무 짧아 피드백을 생성할 수 없습니다.");
      setStage("error");
      return;
    }

    try {
      // Save interview session to DB
      const sessionRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "interview" }),
      });
      if (!sessionRes.ok) {
        throw new Error("면접 세션 저장에 실패했습니다.");
      }
      const session = await sessionRes.json();
      const sessionId: number = session.id;

      const res = await fetch("/api/feedback/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: allTurns, sessionId }),
      });
      if (!res.ok) {
        throw new Error("면접 피드백 생성에 실패했습니다.");
      }
      const fb = await res.json();
      setFeedback(fb);
      setStage("feedback");

      fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sessionId,
          status: "completed",
          endedAt: new Date().toISOString(),
        }),
      });
    } catch {
      setErrorMsg("피드백 생성 중 오류가 발생했습니다.");
      setStage("error");
    }
  }, []);

  const endInterviewRef = useRef(endInterview);

  useEffect(() => {
    endInterviewRef.current = endInterview;
  }, [endInterview]);

  // WebRTC setup
  useEffect(() => {
    if (stage !== "connecting") return;
    let cancelled = false;

    async function connect() {
      try {
        // 1. Get ephemeral token
        const tokenRes = await fetch("/api/realtime-token", { method: "POST" });
        if (!tokenRes.ok) throw new Error("토큰 발급 실패");
        const tokenData = await tokenRes.json();
        const ephemeralKey: string =
          tokenData.value ?? tokenData.client_secret?.value ?? tokenData.session?.client_secret?.value;
        if (!ephemeralKey) throw new Error("ephemeral key 없음");

        if (cancelled) return;

        // 2. Create peer connection
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // 3. Remote audio → play AI voice
        const audio = new Audio();
        audio.autoplay = true;
        audioRef.current = audio;
        pc.ontrack = (e) => {
          audio.srcObject = e.streams[0];
        };

        // 4. Mic track
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          return;
        }

        // 5. Data channel
        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.onmessage = (e) => {
          const event = JSON.parse(e.data);
          handleRealtimeEvent(event);
        };
        dc.onopen = () => {
          dc.send(
            JSON.stringify({
              type: "response.create",
              response: {
                instructions:
                  "Start the short interview now. Greet the candidate briefly and ask the first question about today's focus topic. Keep the total session to 3-4 questions and 5-10 minutes.",
              },
            })
          );
        };

        // 6. SDP offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 7. Send offer to OpenAI
        const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        });
        if (!sdpRes.ok) throw new Error("SDP exchange failed");
        const answerSdp = await sdpRes.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

        if (!cancelled) {
          setStage("interviewing");
          timerRef.current = setInterval(
            () =>
              setElapsedSec((s) => {
                const next = s + 1;
                if (next >= MAX_INTERVIEW_SECONDS) {
                  window.setTimeout(() => endInterviewRef.current(), 0);
                }
                return next;
              }),
            1000
          );
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "";
          const isMicPermissionError =
            message.toLowerCase().includes("permission") ||
            (err instanceof Error && err.name === "NotAllowedError");
          setErrorMsg(
            isMicPermissionError
              ? "마이크 권한이 필요합니다. 브라우저 주소창 또는 설정에서 마이크 사용을 허용한 뒤 다시 시작해 주세요."
              : message || "연결 오류가 발생했습니다."
          );
          setStage("error");
        }
      }
    }

    let liveAiBuffer = "";

    function handleRealtimeEvent(event: { type: string; [key: string]: unknown }) {
      switch (event.type) {
        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta": {
          const delta = (event.delta as string) ?? "";
          liveAiBuffer += delta;
          setLiveAiText(liveAiBuffer);
          setAiSpeaking(true);
          break;
        }
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done": {
          const text = (event.transcript as string) ?? liveAiBuffer;
          if (text.trim()) addTurn("ai", text.trim());
          liveAiBuffer = "";
          setLiveAiText("");
          setAiSpeaking(false);
          break;
        }
        case "input_audio_buffer.speech_started": {
          setUserSpeaking(true);
          break;
        }
        case "input_audio_buffer.speech_stopped": {
          setUserSpeaking(false);
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          const transcript = (event.transcript as string) ?? "";
          if (transcript.trim()) addTurn("user", transcript.trim());
          break;
        }
      }
    }

    connect();
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      dcRef.current?.close();
      pcRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, liveAiText]);

  useEffect(() => {
    if (stage !== "interviewing") return;
    const aiQuestionCount = turns.filter((turn) => turn.role === "ai").length;
    if (aiQuestionCount >= MAX_INTERVIEW_QUESTIONS && turns.some((turn) => turn.role === "user")) {
      const id = window.setTimeout(() => endInterviewRef.current(), 2500);
      return () => window.clearTimeout(id);
    }
  }, [stage, turns]);

  // ── BRIEFING ────────────────────────────────────────────────────────────
  if (stage === "briefing") {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-7 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-slate-400 text-2xl leading-none">←</Link>
          <div className="w-11 h-11 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-2xl shrink-0">
            🎙️
          </div>
          <div>
            <p className="text-slate-400 text-xs">실전 음성 면접</p>
            <h1 className="text-white font-bold text-lg">5~10분 짧은 면접</h1>
          </div>
        </div>

        <section className="bg-indigo-950 border border-indigo-800 rounded-2xl p-5 mb-4">
          <p className="text-indigo-300 text-xs font-medium mb-2">오늘의 면접 유형</p>
          <h2 className="text-white text-xl font-bold leading-tight">
            {patternSet?.topic ?? "Senior AI Leadership Interview"}
          </h2>
          <p className="text-indigo-100 text-sm leading-relaxed mt-3">
            오늘의 답변 패턴을 바탕으로 실제 면접처럼 영어로 대화합니다. 면접 중에는 코칭하지 않고, 종료 후에만 피드백을 제공합니다.
          </p>
        </section>

        <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-4">
          <p className="text-slate-300 text-sm font-semibold mb-3">진행 방식</p>
          <div className="grid grid-cols-2 gap-2">
            <InfoPill label="시간" value="5~10분" />
            <InfoPill label="질문" value="3~4개" />
            <InfoPill label="입력" value="영어 음성" />
            <InfoPill label="피드백" value="종료 후" />
          </div>
        </section>

        {patternSet && (
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-5">
            <p className="text-slate-400 text-xs mb-2">첫 질문 예상 방향</p>
            <p className="text-white text-sm leading-relaxed">{patternSet.exercise.question}</p>
          </section>
        )}

        <button
          onClick={startInterview}
          className="mt-auto w-full py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base active:scale-[0.99]"
        >
          면접 시작
        </button>
        <p className="text-slate-500 text-xs text-center mt-3">
          이어폰을 착용하면 주변 소음 인식이 줄어듭니다.
        </p>
      </main>
    );
  }

  // ── CONNECTING ──────────────────────────────────────────────────────────
  if (stage === "connecting") {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-5 px-4">
        <div className="w-14 h-14 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-white font-semibold text-lg">면접관과 연결 중...</p>
        <p className="text-slate-400 text-sm text-center">
          마이크 권한 요청이 뜨면 허용해 주세요
        </p>
      </main>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-5 px-4 text-center">
        <span className="text-5xl">⚠️</span>
        <p className="text-white font-semibold text-lg">연결 오류</p>
        <p className="text-slate-400 text-sm">{errorMsg}</p>
        <Link
          href="/"
          className="mt-4 bg-slate-800 text-slate-300 px-6 py-3 rounded-xl text-sm font-semibold border border-slate-700"
        >
          홈으로 돌아가기
        </Link>
      </main>
    );
  }

  // ── ENDING ───────────────────────────────────────────────────────────────
  if (stage === "ending") {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-5 px-4">
        <div className="w-14 h-14 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-white font-semibold text-lg">피드백 분석 중...</p>
        <p className="text-slate-400 text-sm">면접 전체를 검토하고 있습니다</p>
      </main>
    );
  }

  // ── FEEDBACK ─────────────────────────────────────────────────────────────
  if (stage === "feedback" && feedback) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-6 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-slate-400 text-2xl leading-none">←</Link>
          <div className="w-11 h-11 rounded-2xl bg-green-500/15 border border-green-500/30 flex items-center justify-center text-2xl shrink-0">
            🧾
          </div>
          <div>
            <p className="text-slate-400 text-xs">면접 종료</p>
            <h1 className="text-white font-bold text-lg">종합 피드백</h1>
          </div>
          <span className="ml-auto text-slate-500 text-xs font-mono">
            {formatTime(elapsedSec)}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {/* Best */}
          <div className="bg-slate-800 border border-green-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-400 text-lg">✓</span>
              <p className="text-green-400 text-sm font-semibold">가장 좋았던 답변</p>
            </div>
            <p className="text-slate-400 text-xs mb-1">{feedback.bestAnswer.question}</p>
            <p className="text-white text-sm leading-relaxed mb-3">
              {feedback.bestAnswer.answer}
            </p>
            <p className="text-slate-300 text-xs leading-relaxed border-t border-slate-700 pt-3">
              {feedback.bestAnswer.reasonKo}
            </p>
          </div>

          {/* Worst */}
          <div className="bg-slate-800 border border-orange-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-orange-400 text-lg">△</span>
              <p className="text-orange-400 text-sm font-semibold">가장 위험했던 답변</p>
            </div>
            <p className="text-slate-400 text-xs mb-1">{feedback.worstAnswer.question}</p>
            <p className="text-white text-sm leading-relaxed mb-3">
              {feedback.worstAnswer.answer}
            </p>
            <p className="text-slate-300 text-xs leading-relaxed border-t border-slate-700 pt-3">
              {feedback.worstAnswer.reasonKo}
            </p>
          </div>

          {/* Next focus */}
          <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-5">
            <p className="text-indigo-300 text-sm font-semibold mb-2">다음에 반드시 고칠 것</p>
            <p className="text-white text-sm leading-relaxed">{feedback.nextFocusKo}</p>
          </div>

          {/* Key sentences */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <p className="text-slate-300 text-sm font-semibold mb-3">
              면접에서 바로 쓸 수 있는 문장
            </p>
            <div className="flex flex-col gap-2">
              {feedback.improvementSentences.map((s, i) => (
                <div key={i} className="bg-slate-700 rounded-xl px-4 py-3 text-white text-sm">
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* 표현 저장 버튼 */}
          {saveNoteError && (
            <p className="text-red-300 text-xs leading-relaxed -mb-2">
              {saveNoteError}
            </p>
          )}
          <button
            onClick={async () => {
              if (!feedback || savedNote || savingNote) return;
              setSavingNote(true);
              setSaveNoteError("");
              try {
                const res = await fetch("/api/notes", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    category: "career",
                    questionText: feedback.bestAnswer.question,
                    originalAnswer: feedback.worstAnswer.answer,
                    improvedAnswer: feedback.bestAnswer.answer,
                    finalAnswer: feedback.bestAnswer.answer,
                    keyExpressions: feedback.improvementSentences,
                  }),
                });
                if (!res.ok) {
                  throw new Error("note save failed");
                }
                setSavedNote(true);
              } catch {
                setSaveNoteError("답변 노트 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
              } finally {
                setSavingNote(false);
              }
            }}
            disabled={savedNote || savingNote}
            className={`w-full py-4 rounded-xl font-semibold text-base transition-colors ${
              savedNote
                ? "bg-green-800 text-green-300 border border-green-700"
                : savingNote
                ? "bg-slate-700 text-slate-400 border border-slate-600"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
            }`}
          >
            {savedNote
              ? "답변 노트 저장됨 ✓"
              : savingNote
              ? "저장 중..."
              : "핵심 표현 노트에 저장"}
          </button>

          <Link
            href="/"
            className="w-full py-4 rounded-xl bg-slate-800 text-slate-300 font-semibold text-base border border-slate-700 text-center"
          >
            홈으로
          </Link>
        </div>
      </main>
    );
  }

  // ── INTERVIEWING ─────────────────────────────────────────────────────────
  const questionCount = turns.filter((t) => t.role === "ai").length;

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2 flex-1">
          <span className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-base">
            🎙️
          </span>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs font-medium">LIVE</span>
          <span className="text-slate-500 text-xs font-mono ml-1">{formatTime(elapsedSec)}</span>
        </div>
        <p className="text-slate-400 text-xs">
          질문 {Math.min(questionCount, MAX_INTERVIEW_QUESTIONS)}/{MAX_INTERVIEW_QUESTIONS}
        </p>
        <button
          onClick={endInterview}
          className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors"
        >
          면접 종료
        </button>
      </div>

      {/* Conversation transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {turns.map((turn, i) => (
          <div
            key={i}
            className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                turn.role === "ai"
                  ? "bg-slate-800 text-white rounded-tl-sm"
                  : "bg-indigo-600 text-white rounded-tr-sm"
              }`}
            >
              {turn.role === "ai" && (
                <p className="text-slate-400 text-xs mb-1 font-medium">면접관</p>
              )}
              {turn.text}
            </div>
          </div>
        ))}

        {/* Live streaming AI text */}
        {liveAiText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white leading-relaxed">
              <p className="text-slate-400 text-xs mb-1 font-medium">면접관</p>
              {liveAiText}
              <span className="inline-block w-1 h-4 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Status bar */}
      <div className="px-4 pb-6 pt-3 border-t border-slate-800">
        {aiSpeaking && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="flex gap-1 items-end h-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-indigo-400 rounded-full animate-pulse"
                  style={{
                    height: `${8 + (i % 3) * 6}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
            <p className="text-indigo-300 text-sm">면접관이 말하는 중...</p>
          </div>
        )}

        {userSpeaking && !aiSpeaking && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="flex gap-1 items-end h-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-green-400 rounded-full animate-pulse"
                  style={{
                    height: `${8 + (i % 3) * 6}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
            <p className="text-green-300 text-sm">답변 중...</p>
          </div>
        )}

        {!aiSpeaking && !userSpeaking && (
          <p className="text-center text-slate-500 text-sm py-4">
            이어폰을 착용하고 영어로 답변해 주세요
          </p>
        )}
      </div>
    </main>
  );
}
