"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Stage =
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

export default function InterviewPage() {
  const [stage, setStage] = useState<Stage>("connecting");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [liveAiText, setLiveAiText] = useState("");
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Keep ref in sync for use inside callbacks
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const addTurn = useCallback((role: "ai" | "user", text: string) => {
    setTurns((prev) => [...prev, { role, text }]);
  }, []);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const endInterview = useCallback(async () => {
    setStage("ending");
    if (timerRef.current) clearInterval(timerRef.current);

    // Close WebRTC
    dcRef.current?.close();
    pcRef.current?.close();
    audioRef.current?.pause();

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
      const session = await sessionRes.json();
      fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: session.id,
          status: "completed",
          endedAt: new Date().toISOString(),
        }),
      });

      const res = await fetch("/api/feedback/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: allTurns }),
      });
      const fb = await res.json();
      setFeedback(fb);
      setStage("feedback");
    } catch {
      setErrorMsg("피드백 생성 중 오류가 발생했습니다.");
      setStage("error");
    }
  }, []);

  // WebRTC setup
  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        // 1. Get ephemeral token
        const tokenRes = await fetch("/api/realtime-token", { method: "POST" });
        if (!tokenRes.ok) throw new Error("토큰 발급 실패");
        const tokenData = await tokenRes.json();
        const ephemeralKey: string = tokenData.client_secret?.value;
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
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // 5. Data channel
        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.onmessage = (e) => {
          const event = JSON.parse(e.data);
          handleRealtimeEvent(event);
        };

        // 6. SDP offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 7. Send offer to OpenAI
        const sdpRes = await fetch(
          "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ephemeralKey}`,
              "Content-Type": "application/sdp",
            },
            body: offer.sdp,
          }
        );
        if (!sdpRes.ok) throw new Error("SDP exchange failed");
        const answerSdp = await sdpRes.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

        if (!cancelled) {
          setStage("interviewing");
          timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "연결 오류가 발생했습니다.");
          setStage("error");
        }
      }
    }

    let liveAiBuffer = "";

    function handleRealtimeEvent(event: { type: string; [key: string]: unknown }) {
      switch (event.type) {
        case "response.audio_transcript.delta": {
          const delta = (event.delta as string) ?? "";
          liveAiBuffer += delta;
          setLiveAiText(liveAiBuffer);
          setAiSpeaking(true);
          break;
        }
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, liveAiText]);

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
              "{feedback.bestAnswer.answer}"
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
              "{feedback.worstAnswer.answer}"
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
                  "{s}"
                </div>
              ))}
            </div>
          </div>

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
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs font-medium">LIVE</span>
          <span className="text-slate-500 text-xs font-mono ml-1">{formatTime(elapsedSec)}</span>
        </div>
        <p className="text-slate-400 text-xs">
          질문 {questionCount}/6
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
