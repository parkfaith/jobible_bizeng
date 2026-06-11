"use client";

import { useState } from "react";
import Link from "next/link";

export interface InterviewFeedback {
  bestAnswer: { question: string; questionKo?: string; answer: string; answerKo?: string; reasonKo: string };
  worstAnswer: { question: string; questionKo?: string; answer: string; answerKo?: string; reasonKo: string };
  nextFocusKo: string;
  improvementSentences: string[];
  improvementSentencesKo?: string[];
  qa?: { q: string; qKo: string; a: string; aKo: string }[];
  weaknesses?: { tag: string; labelKo: string; evidenceKo?: string }[];
  previousFocusReviewKo?: string;
  jdCoverage?: { coveredKo: string[]; missedKo: string[]; adviceKo: string };
}

export default function FeedbackView({
  feedback,
  elapsedLabel,
}: {
  feedback: InterviewFeedback;
  elapsedLabel: string;
}) {
  const [savedNote, setSavedNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [saveNoteError, setSaveNoteError] = useState("");
  const [showBestKo, setShowBestKo] = useState(false);
  const [showWorstKo, setShowWorstKo] = useState(false);
  const [shownSentencesKo, setShownSentencesKo] = useState<Set<number>>(new Set());
  const [showFullConversation, setShowFullConversation] = useState(false);

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
        <span className="ml-auto text-slate-500 text-xs font-mono">{elapsedLabel}</span>
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

        {/* Previous Focus Review — 지난번 지적사항이 개선됐는지 */}
        {feedback.previousFocusReviewKo && (
          <div className="bg-slate-800 border border-indigo-800 rounded-2xl p-5">
            <p className="text-indigo-300 text-sm font-semibold mb-2">📌 지난번 지적사항 점검</p>
            <p className="text-white text-sm leading-relaxed">{feedback.previousFocusReviewKo}</p>
          </div>
        )}

        {/* JD Coverage — 공고 요구사항 대비 답변 커버리지 */}
        {feedback.jdCoverage &&
          (feedback.jdCoverage.coveredKo.length > 0 ||
            feedback.jdCoverage.missedKo.length > 0 ||
            feedback.jdCoverage.adviceKo) && (
          <div className="bg-sky-950/60 border border-sky-800 rounded-2xl p-5">
            <p className="text-sky-300 text-sm font-semibold mb-3">📋 공고 요구사항 커버리지</p>
            {feedback.jdCoverage.coveredKo.length > 0 && (
              <div className="mb-3">
                <p className="text-green-400 text-xs font-medium mb-1.5">입증한 요구사항</p>
                <div className="flex flex-col gap-1.5">
                  {feedback.jdCoverage.coveredKo.map((item, i) => (
                    <p key={i} className="text-slate-200 text-sm leading-relaxed">✓ {item}</p>
                  ))}
                </div>
              </div>
            )}
            {feedback.jdCoverage.missedKo.length > 0 && (
              <div className="mb-3">
                <p className="text-orange-400 text-xs font-medium mb-1.5">놓친 요구사항</p>
                <div className="flex flex-col gap-1.5">
                  {feedback.jdCoverage.missedKo.map((item, i) => (
                    <p key={i} className="text-slate-200 text-sm leading-relaxed">△ {item}</p>
                  ))}
                </div>
              </div>
            )}
            {feedback.jdCoverage.adviceKo && (
              <p className="text-sky-200 text-xs leading-relaxed border-t border-sky-800 pt-3">
                {feedback.jdCoverage.adviceKo}
              </p>
            )}
          </div>
        )}

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
            if (savedNote || savingNote) return;
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
