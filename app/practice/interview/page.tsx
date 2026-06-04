"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DailyPatternSet } from "@/lib/pattern-set";
import {
  SCENARIOS,
  getScenarioById,
  getOpeningInstruction,
  type ScenarioId,
} from "@/lib/scenarios";
import { WEEKLY_SESSION_LIMIT } from "@/lib/constants";

type Stage =
  | "scenario_select"
  | "briefing"
  | "connecting"
  | "ready"
  | "interviewing"
  | "ending"
  | "feedback"
  | "error";

interface Turn {
  role: "ai" | "user";
  text: string;
}

interface InterviewFeedback {
  bestAnswer: { question: string; questionKo?: string; answer: string; answerKo?: string; reasonKo: string };
  worstAnswer: { question: string; questionKo?: string; answer: string; answerKo?: string; reasonKo: string };
  nextFocusKo: string;
  improvementSentences: string[];
  improvementSentencesKo?: string[];
  qa?: { q: string; qKo: string; a: string; aKo: string }[];
}

const MAX_INTERVIEW_SECONDS = 10 * 60;
const MAX_INTERVIEW_QUESTIONS = 6;

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 rounded-xl px-3 py-3">
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="text-white text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

export default function InterviewPage() {
  const [stage, setStage] = useState<Stage>("scenario_select");
  const [selectedScenarioId, setSelectedScenarioId] = useState<ScenarioId>("interview");
  const [weeklyCount, setWeeklyCount] = useState<number | null>(null);
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
  const [dcReady, setDcReady] = useState(false);
  const [showBestKo, setShowBestKo] = useState(false);
  const [showWorstKo, setShowWorstKo] = useState(false);
  const [shownSentencesKo, setShownSentencesKo] = useState<Set<number>>(new Set());
  const [showFullConversation, setShowFullConversation] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null); // iOS 전환 시 재연결용
  const connectedRef = useRef(false); // 연결 확립 여부 (cleanup 가드)
  const turnsRef = useRef<Turn[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const selectedScenarioRef = useRef<ScenarioId>("interview");

  // Fetch today's pattern and weekly count on mount
  useEffect(() => {
    fetch("/api/patterns/daily", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => { if (!body.error) setPatternSet(body); })
      .catch(() => {});

    fetch("/api/sessions?week=interview")
      .then((res) => res.json())
      .then((body) => { if (typeof body.count === "number") setWeeklyCount(body.count); })
      .catch(() => {});
  }, []);

  useEffect(() => { turnsRef.current = turns; }, [turns]);
  useEffect(() => { selectedScenarioRef.current = selectedScenarioId; }, [selectedScenarioId]);

  const addTurn = useCallback((role: "ai" | "user", text: string) => {
    setTurns((prev) => [...prev, { role, text }]);
  }, []);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  function selectScenarioAndBrief(id: ScenarioId) {
    setSelectedScenarioId(id);
    selectedScenarioRef.current = id;
    setStage("briefing");
  }

  function startInterview() {
    // iOS Safari 오디오 잠금 해제 — 사용자 제스처 컨텍스트에서 미리 play() 호출
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    setTurns([]);
    setFeedback(null);
    setErrorMsg("");
    setSavedNote(false);
    setSavingNote(false);
    setSaveNoteError("");
    setElapsedSec(0);
    connectedRef.current = false;
    setDcReady(false);
    setStage("connecting");
  }

  const endInterview = useCallback(async () => {
    connectedRef.current = false;
    setStage("ending");
    if (timerRef.current) clearInterval(timerRef.current);

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
      const sessionRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "interview" }),
      });
      if (!sessionRes.ok) throw new Error("면접 세션 저장에 실패했습니다.");
      const session = await sessionRes.json();
      const sessionId: number = session.id;

      const res = await fetch("/api/feedback/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: allTurns, sessionId }),
      });
      if (!res.ok) throw new Error("면접 피드백 생성에 실패했습니다.");
      const fb = await res.json();
      setFeedback(fb);
      setStage("feedback");

      fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, status: "completed", endedAt: new Date().toISOString() }),
      });
    } catch {
      setErrorMsg("피드백 생성 중 오류가 발생했습니다.");
      setStage("error");
    }
  }, []);

  const endInterviewRef = useRef(endInterview);
  useEffect(() => { endInterviewRef.current = endInterview; }, [endInterview]);

  function startActualInterview() {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return;
    dc.send(JSON.stringify({
      type: "response.create",
      response: { instructions: getOpeningInstruction(selectedScenarioRef.current) },
    }));
    setStage("interviewing");
  }

  // WebRTC setup
  useEffect(() => {
    if (stage !== "connecting") return;
    let cancelled = false;

    async function connect() {
      try {
        const tokenRes = await fetch("/api/realtime-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: selectedScenarioRef.current }),
        });

        if (tokenRes.status === 429) {
          const body = await tokenRes.json();
          setErrorMsg(body.message ?? "이번 주 세션 한도를 초과했습니다.");
          setStage("error");
          return;
        }
        if (!tokenRes.ok) throw new Error("토큰 발급 실패");

        const tokenData = await tokenRes.json();
        const ephemeralKey: string =
          tokenData.client_secret?.value ?? tokenData.value ?? tokenData.session?.client_secret?.value;
        if (!ephemeralKey) throw new Error("ephemeral key 없음");

        if (cancelled) return;

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // iOS Safari: new Audio()는 DOM 밖 생성이라 자동재생 차단됨
        // JSX의 <audio ref={audioRef}> 엘리먼트를 직접 사용
        pc.ontrack = (e) => {
          remoteStreamRef.current = e.streams[0];
          if (audioRef.current) {
            audioRef.current.srcObject = e.streams[0];
            audioRef.current.play().catch(() => {});
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          return;
        }

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.onmessage = (e) => {
          const event = JSON.parse(e.data);
          handleRealtimeEvent(event);
        };
        dc.onopen = () => {
          setDcReady(true);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

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
          connectedRef.current = true;
          setStage("ready");
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
        case "input_audio_buffer.speech_started":
          setUserSpeaking(true);
          break;
        case "input_audio_buffer.speech_stopped":
          setUserSpeaking(false);
          break;
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
      // 연결이 확립된 경우(interviewing)는 타이머 전용 effect가 정리
      // 연결 시도 중 stage가 바뀐 경우(취소/오류)에만 여기서 정리
      if (!connectedRef.current) {
        dcRef.current?.close();
        pcRef.current?.close();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (audioRef.current) {
          audioRef.current.srcObject = null;
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // connecting→ready/interviewing 전환 시 audio 엘리먼트가 리마운트되므로 srcObject 재연결
  useEffect(() => {
    if ((stage === "ready" || stage === "interviewing") && audioRef.current && remoteStreamRef.current) {
      audioRef.current.srcObject = remoteStreamRef.current;
      audioRef.current.play().catch(() => {});
    }
  }, [stage]);

  // 타이머: interviewing 단계에서만 시작 — stage 변경 시 cleanup이 자동 정리
  useEffect(() => {
    if (stage !== "interviewing") return;
    timerRef.current = setInterval(
      () => setElapsedSec((s) => {
        const next = s + 1;
        if (next >= MAX_INTERVIEW_SECONDS) {
          window.setTimeout(() => endInterviewRef.current(), 0);
        }
        return next;
      }),
      1000
    );
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [stage]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, liveAiText]);

  useEffect(() => {
    if (stage !== "interviewing") return;
    const userTurnCount = turns.filter((t) => t.role === "user").length;
    if (userTurnCount >= MAX_INTERVIEW_QUESTIONS) {
      const id = window.setTimeout(() => endInterviewRef.current(), 2500);
      return () => window.clearTimeout(id);
    }
  }, [stage, turns]);

  const isLimitReached = weeklyCount !== null && weeklyCount >= WEEKLY_SESSION_LIMIT;

  // ── SCENARIO SELECT ───────────────────────────────────────────────────────
  if (stage === "scenario_select") {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-7 bottom-safe">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="tap-target flex items-center justify-center text-slate-400 text-2xl leading-none">←</Link>
          <div className="w-11 h-11 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-2xl shrink-0">
            🎙️
          </div>
          <div>
            <p className="text-slate-400 text-xs">비즈니스 영어 훈련</p>
            <h1 className="text-white font-bold text-lg">어떤 상황을 연습할까요?</h1>
          </div>
        </div>

        {isLimitReached && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-2xl px-4 py-3 mb-4">
            <p className="text-amber-300 text-sm font-semibold">이번 주 {WEEKLY_SESSION_LIMIT}회 완료</p>
            <p className="text-amber-200/70 text-xs mt-1">
              다음 주 월요일부터 다시 이용할 수 있습니다.
            </p>
          </div>
        )}

        {weeklyCount !== null && !isLimitReached && (
          <p className="text-slate-500 text-xs text-right mb-3">
            이번 주 {weeklyCount}/{WEEKLY_SESSION_LIMIT}회 사용
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => selectScenarioAndBrief(scenario.id)}
              disabled={isLimitReached}
              className={`flex flex-col items-start gap-2 rounded-2xl p-4 border text-left transition-all active:scale-[0.98] disabled:opacity-40 ${scenario.color.bg} ${scenario.color.border}`}
            >
              <span className="text-3xl">{scenario.icon}</span>
              <div>
                <p className={`text-sm font-bold ${scenario.color.text}`}>{scenario.title}</p>
                <p className="text-slate-300 text-xs mt-0.5 leading-snug">{scenario.subtitleKo}</p>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">{scenario.descriptionKo}</p>
            </button>
          ))}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
          <p className="text-slate-400 text-xs font-medium mb-2">공통 진행 방식</p>
          <div className="grid grid-cols-2 gap-2">
            <InfoPill label="시간" value="5~10분" />
            <InfoPill label="언어" value="영어 음성" />
            <InfoPill label="턴수" value="5~6회" />
            <InfoPill label="피드백" value="종료 후" />
          </div>
        </div>
      </main>
    );
  }

  // ── BRIEFING ──────────────────────────────────────────────────────────────
  if (stage === "briefing") {
    const scenario = getScenarioById(selectedScenarioId);
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-7 bottom-safe">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setStage("scenario_select")}
            className="tap-target flex items-center justify-center text-slate-400 text-2xl leading-none"
          >
            ←
          </button>
          <div className={`w-11 h-11 rounded-2xl ${scenario.color.bg} ${scenario.color.border} border flex items-center justify-center text-2xl shrink-0`}>
            {scenario.icon}
          </div>
          <div>
            <p className={`text-xs font-medium ${scenario.color.text}`}>{scenario.subtitleKo}</p>
            <h1 className="text-white font-bold text-lg">{scenario.briefingTitleKo}</h1>
          </div>
        </div>

        <section className={`${scenario.color.bg} border ${scenario.color.border} rounded-2xl p-5 mb-4`}>
          <p className={`text-xs font-medium mb-2 ${scenario.color.text}`}>오늘의 연습 상황</p>
          <p className="text-white text-sm leading-relaxed">{scenario.briefingBodyKo}</p>
        </section>

        {selectedScenarioId === "interview" && patternSet && (
          <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-4">
            <p className="text-slate-400 text-xs mb-2">오늘의 패턴 주제</p>
            <p className="text-white text-sm font-semibold mb-2">{patternSet.topic}</p>
            <p className="text-slate-300 text-sm leading-relaxed">{patternSet.exercise.question}</p>
          </section>
        )}

        <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-5">
          <p className="text-slate-300 text-sm font-semibold mb-3">진행 방식</p>
          <div className="grid grid-cols-2 gap-2">
            <InfoPill label="시간" value="5~10분" />
            <InfoPill label="턴수" value="5~6회" />
            <InfoPill label="입력" value="영어 음성" />
            <InfoPill label="피드백" value="종료 후" />
          </div>
        </section>

        <button
          onClick={startInterview}
          className={`tap-target mt-auto w-full rounded-xl text-white font-semibold text-base active:scale-[0.99] py-4 ${
            selectedScenarioId === "interview"
              ? "bg-indigo-600"
              : selectedScenarioId === "executive_briefing"
              ? "bg-blue-700"
              : selectedScenarioId === "cross_functional"
              ? "bg-amber-700"
              : "bg-emerald-700"
          }`}
        >
          시작
        </button>
        <p className="text-slate-500 text-xs text-center mt-3">
          이어폰을 착용하면 주변 소음 인식이 줄어듭니다.
        </p>
      </main>
    );
  }

  // ── CONNECTING ────────────────────────────────────────────────────────────
  if (stage === "connecting") {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-5 px-4">
        {/* iOS Safari: DOM에 실제 audio 엘리먼트 필요 — new Audio()는 자동재생 차단됨 */}
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
        <div className="w-14 h-14 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-white font-semibold text-lg">연결 중...</p>
        <p className="text-slate-400 text-sm text-center">마이크 권한 요청이 뜨면 허용해 주세요</p>
      </main>
    );
  }

  // ── READY ────────────────────────────────────────────────────────────────
  if (stage === "ready") {
    const scenario = getScenarioById(selectedScenarioId);
    const btnColor =
      selectedScenarioId === "interview" ? "bg-indigo-600"
      : selectedScenarioId === "executive_briefing" ? "bg-blue-700"
      : selectedScenarioId === "cross_functional" ? "bg-amber-700"
      : "bg-emerald-700";

    return (
      <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-7 pb-10">
        <audio ref={audioRef} autoPlay playsInline className="hidden" />

        <div className="flex items-center gap-3 mb-8">
          <div className={`w-11 h-11 rounded-2xl ${scenario.color.bg} ${scenario.color.border} border flex items-center justify-center text-2xl shrink-0`}>
            {scenario.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-green-400 text-xs font-medium">연결됨</p>
            </div>
            <h1 className="text-white font-bold text-lg">{scenario.briefingTitleKo}</h1>
          </div>
        </div>

        <div className={`${scenario.color.bg} border ${scenario.color.border} rounded-2xl p-5 mb-4`}>
          <p className={`text-xs font-medium mb-2 ${scenario.color.text}`}>오늘의 상황</p>
          <p className="text-white text-sm leading-relaxed">{scenario.briefingBodyKo}</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 mb-8">
          <p className="text-slate-400 text-sm text-center leading-relaxed">
            준비가 되면 아래 버튼을 누르세요.<br />
            <span className="text-slate-500 text-xs">버튼을 누르는 순간 상대방이 먼저 말을 겁니다.</span>
          </p>
        </div>

        <button
          onClick={startActualInterview}
          disabled={!dcReady}
          className={`tap-target mt-auto w-full rounded-xl font-semibold text-base py-5 active:scale-[0.99] transition-all ${
            dcReady
              ? `${btnColor} text-white`
              : "bg-slate-700 text-slate-400"
          }`}
        >
          {dcReady ? "면접 시작" : "준비 중..."}
        </button>
        <p className="text-slate-500 text-xs text-center mt-3">
          이어폰을 착용하면 주변 소음 인식이 줄어듭니다.
        </p>
      </main>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-5 px-4 text-center">
        <span className="text-5xl">⚠️</span>
        <p className="text-white font-semibold text-lg">오류</p>
        <p className="text-slate-400 text-sm">{errorMsg}</p>
        <Link
          href="/"
          className="tap-target mt-4 bg-slate-800 text-slate-300 px-6 rounded-xl text-sm font-semibold border border-slate-700 flex items-center py-3"
        >
          홈으로 돌아가기
        </Link>
      </main>
    );
  }

  // ── ENDING ────────────────────────────────────────────────────────────────
  if (stage === "ending") {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-5 px-4">
        <div className="w-14 h-14 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-white font-semibold text-lg">피드백 분석 중...</p>
        <p className="text-slate-400 text-sm">대화 전체를 검토하고 있습니다</p>
      </main>
    );
  }

  // ── FEEDBACK ─────────────────────────────────────────────────────────────
  if (stage === "feedback" && feedback) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-6 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="tap-target flex items-center justify-center text-slate-400 text-2xl leading-none">←</Link>
          <div className="w-11 h-11 rounded-2xl bg-green-500/15 border border-green-500/30 flex items-center justify-center text-2xl shrink-0">
            🧾
          </div>
          <div>
            <p className="text-slate-400 text-xs">세션 종료</p>
            <h1 className="text-white font-bold text-lg">종합 피드백</h1>
          </div>
          <span className="ml-auto text-slate-500 text-xs font-mono">{formatTime(elapsedSec)}</span>
        </div>

        <div className="flex flex-col gap-4">
          {/* Best Answer */}
          <div className="bg-slate-800 border border-green-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-400 text-lg">✓</span>
              <p className="text-green-400 text-sm font-semibold">가장 좋았던 답변</p>
            </div>
            <p className="text-slate-400 text-xs mb-0.5">{feedback.bestAnswer.question}</p>
            {showBestKo && feedback.bestAnswer.questionKo && (
              <p className="text-slate-500 text-xs mb-2 italic">{feedback.bestAnswer.questionKo}</p>
            )}
            <p className="text-white text-sm leading-relaxed mt-2 mb-2">{feedback.bestAnswer.answer}</p>
            {showBestKo && feedback.bestAnswer.answerKo && (
              <p className="text-green-200/70 text-xs leading-relaxed italic">{feedback.bestAnswer.answerKo}</p>
            )}
            {(feedback.bestAnswer.questionKo || feedback.bestAnswer.answerKo) && (
              <button
                onClick={() => setShowBestKo(!showBestKo)}
                className="mt-2 text-slate-500 text-xs underline underline-offset-2"
              >
                {showBestKo ? "한국어 닫기" : "한국어로 보기"}
              </button>
            )}
            <p className="text-slate-300 text-xs leading-relaxed border-t border-slate-700 pt-3 mt-3">
              {feedback.bestAnswer.reasonKo}
            </p>
          </div>

          {/* Worst Answer */}
          <div className="bg-slate-800 border border-orange-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-orange-400 text-lg">△</span>
              <p className="text-orange-400 text-sm font-semibold">가장 위험했던 답변</p>
            </div>
            <p className="text-slate-400 text-xs mb-0.5">{feedback.worstAnswer.question}</p>
            {showWorstKo && feedback.worstAnswer.questionKo && (
              <p className="text-slate-500 text-xs mb-2 italic">{feedback.worstAnswer.questionKo}</p>
            )}
            <p className="text-white text-sm leading-relaxed mt-2 mb-2">{feedback.worstAnswer.answer}</p>
            {showWorstKo && feedback.worstAnswer.answerKo && (
              <p className="text-orange-200/70 text-xs leading-relaxed italic">{feedback.worstAnswer.answerKo}</p>
            )}
            {(feedback.worstAnswer.questionKo || feedback.worstAnswer.answerKo) && (
              <button
                onClick={() => setShowWorstKo(!showWorstKo)}
                className="mt-2 text-slate-500 text-xs underline underline-offset-2"
              >
                {showWorstKo ? "한국어 닫기" : "한국어로 보기"}
              </button>
            )}
            <p className="text-slate-300 text-xs leading-relaxed border-t border-slate-700 pt-3 mt-3">
              {feedback.worstAnswer.reasonKo}
            </p>
          </div>

          {/* Next Focus */}
          <div className="bg-indigo-950 border border-indigo-800 rounded-2xl p-5">
            <p className="text-indigo-300 text-sm font-semibold mb-2">다음에 반드시 고칠 것</p>
            <p className="text-white text-sm leading-relaxed">{feedback.nextFocusKo}</p>
          </div>

          {/* Improvement Sentences */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <p className="text-slate-300 text-sm font-semibold mb-3">바로 쓸 수 있는 문장</p>
            <div className="flex flex-col gap-2">
              {feedback.improvementSentences.map((s, i) => (
                <div key={i} className="bg-slate-700 rounded-xl px-4 py-3">
                  <p className="text-white text-sm">{s}</p>
                  {feedback.improvementSentencesKo?.[i] && (
                    <>
                      <button
                        onClick={() =>
                          setShownSentencesKo((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          })
                        }
                        className="mt-1.5 text-slate-500 text-xs underline underline-offset-2"
                      >
                        {shownSentencesKo.has(i) ? "한국어 닫기" : "한국어로 보기"}
                      </button>
                      {shownSentencesKo.has(i) && (
                        <p className="text-slate-300 text-xs mt-2 leading-relaxed italic">
                          {feedback.improvementSentencesKo![i]}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Full Conversation Review */}
          {feedback.qa && feedback.qa.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <button
                onClick={() => setShowFullConversation(!showFullConversation)}
                className="flex items-center justify-between w-full"
              >
                <p className="text-slate-300 text-sm font-semibold">전체 대화 복기</p>
                <span className="text-slate-400 text-xs">
                  {showFullConversation ? "▲ 접기" : `▼ ${feedback.qa.length}문항 보기`}
                </span>
              </button>
              {showFullConversation && (
                <div className="mt-4 flex flex-col gap-5">
                  {feedback.qa.map((pair, i) => (
                    <div key={i} className={i > 0 ? "border-t border-slate-700 pt-4" : ""}>
                      <div className="mb-3">
                        <p className="text-slate-500 text-xs font-medium mb-1">Q{i + 1}</p>
                        <p className="text-slate-300 text-sm">{pair.q}</p>
                        {pair.qKo && (
                          <p className="text-slate-500 text-xs mt-1 italic">{pair.qKo}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs font-medium mb-1">내 답변</p>
                        <p className="text-white text-sm leading-relaxed">{pair.a}</p>
                        {pair.aKo && (
                          <p className="text-slate-400 text-xs mt-1.5 italic leading-relaxed">{pair.aKo}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {saveNoteError && (
            <p className="text-red-300 text-xs leading-relaxed -mb-2">{saveNoteError}</p>
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
                if (!res.ok) throw new Error("note save failed");
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
            {savedNote ? "답변 노트 저장됨 ✓" : savingNote ? "저장 중..." : "핵심 표현 노트에 저장"}
          </button>

          <Link
            href="/"
            className="tap-target w-full rounded-xl bg-slate-800 text-slate-300 font-semibold text-base border border-slate-700 text-center flex items-center justify-center py-4"
          >
            홈으로
          </Link>
        </div>
      </main>
    );
  }

  // ── INTERVIEWING ──────────────────────────────────────────────────────────
  const userTurnCount = turns.filter((t) => t.role === "user").length;
  const scenario = getScenarioById(selectedScenarioId);

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto">
      {/* iOS Safari: connecting→interviewing 전환 시 리마운트되므로 srcObject는 useEffect로 재연결 */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2 flex-1">
          <span className={`w-8 h-8 rounded-xl ${scenario.color.bg} ${scenario.color.border} border flex items-center justify-center text-base`}>
            {scenario.icon}
          </span>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs font-medium">LIVE</span>
          <span className="text-slate-500 text-xs font-mono ml-1">{formatTime(elapsedSec)}</span>
        </div>
        <p className="text-slate-400 text-xs">
          {userTurnCount}/{MAX_INTERVIEW_QUESTIONS} 답변
        </p>
        <button
          onClick={endInterview}
          className="tap-target bg-slate-800 text-slate-300 text-xs px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors"
        >
          종료
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {turns.map((turn, i) => (
          <div key={i} className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                turn.role === "ai"
                  ? "bg-slate-800 text-white rounded-tl-sm"
                  : "bg-indigo-600 text-white rounded-tr-sm"
              }`}
            >
              {turn.role === "ai" && (
                <p className="text-slate-400 text-xs mb-1 font-medium">{scenario.subtitleKo}</p>
              )}
              {turn.text}
            </div>
          </div>
        ))}

        {liveAiText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white leading-relaxed">
              <p className="text-slate-400 text-xs mb-1 font-medium">{scenario.subtitleKo}</p>
              {liveAiText}
              <span className="inline-block w-1 h-4 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      <div className="px-4 pb-6 pt-3 border-t border-slate-800">
        {aiSpeaking && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="flex gap-1 items-end h-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-indigo-400 rounded-full animate-pulse"
                  style={{ height: `${8 + (i % 3) * 6}px`, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <p className="text-indigo-300 text-sm">상대방이 말하는 중...</p>
          </div>
        )}

        {userSpeaking && !aiSpeaking && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="flex gap-1 items-end h-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-green-400 rounded-full animate-pulse"
                  style={{ height: `${8 + (i % 3) * 6}px`, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <p className="text-green-300 text-sm">답변 중...</p>
          </div>
        )}

        {!aiSpeaking && !userSpeaking && (
          <p className="text-center text-slate-500 text-sm py-4">
            이어폰을 착용하고 영어로 말해 주세요
          </p>
        )}
      </div>
    </main>
  );
}
