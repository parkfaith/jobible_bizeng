"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { key: "all", label: "전체" },
  { key: "intro", label: "자기소개" },
  { key: "career", label: "경력 설명" },
  { key: "leadership", label: "리더십" },
  { key: "tech", label: "기술 프로젝트" },
  { key: "failure", label: "실패/갈등" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

interface Note {
  id: number;
  category: string;
  questionText: string;
  originalAnswer: string | null;
  improvedAnswer: string | null;
  finalAnswer: string | null;
  keyExpressions: string | null;
  updatedAt: string | null;
}

interface EditState {
  finalAnswer: string;
  keyExpressions: string[];
}

export default function NotesClient({ initialNotes }: { initialNotes: Note[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ finalAnswer: "", keyExpressions: [] });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filtered =
    activeCategory === "all"
      ? notes
      : notes.filter((n) => n.category === activeCategory);

  function startEdit(note: Note) {
    let exprs: string[] = [];
    try {
      exprs = note.keyExpressions ? JSON.parse(note.keyExpressions) : [];
    } catch {
      exprs = [];
    }
    setEditState({ finalAnswer: note.finalAnswer ?? note.improvedAnswer ?? "", keyExpressions: exprs });
    setEditingId(note.id);
    setExpandedId(note.id);
  }

  async function saveEdit(note: Note) {
    setSaving(true);
    const res = await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: note.id,
        finalAnswer: editState.finalAnswer,
        keyExpressions: editState.keyExpressions,
      }),
    });
    const updated = await res.json();
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, ...updated } : n)));
    setEditingId(null);
    setSaving(false);
  }

  async function deleteNote(id: number) {
    setDeletingId(id);
    await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (expandedId === id) setExpandedId(null);
    setDeletingId(null);
    router.refresh();
  }

  function updateKeyExpression(i: number, value: string) {
    setEditState((prev) => {
      const next = [...prev.keyExpressions];
      next[i] = value;
      return { ...prev, keyExpressions: next };
    });
  }

  const CATEGORY_LABEL: Record<string, string> = {
    intro: "자기소개",
    career: "경력 설명",
    leadership: "리더십",
    tech: "기술 프로젝트",
    failure: "실패/갈등",
  };

  return (
    <>
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.key
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
            }`}
          >
            {cat.label}
            {cat.key !== "all" && (
              <span className="ml-1.5 text-xs opacity-60">
                {notes.filter((n) => n.category === cat.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20">
          <span className="text-4xl">📓</span>
          <p className="text-slate-400 text-sm font-medium">저장된 답변이 없어요</p>
          <p className="text-slate-600 text-xs text-center">
            면접 연습 후 좋은 답변을 저장해 두세요
          </p>
        </div>
      )}

      {/* Notes list */}
      <div className="flex flex-col gap-3 pb-4">
        {filtered.map((note) => {
          const isExpanded = expandedId === note.id;
          const isEditing = editingId === note.id;
          const exprs: string[] = (() => {
            try {
              return note.keyExpressions ? JSON.parse(note.keyExpressions) : [];
            } catch {
              return [];
            }
          })();

          return (
            <div
              key={note.id}
              className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden"
            >
              {/* Card header — always visible */}
              <button
                className="w-full text-left px-4 pt-4 pb-3"
                onClick={() => {
                  if (editingId === note.id) return;
                  setExpandedId(isExpanded ? null : note.id);
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                    {CATEGORY_LABEL[note.category] ?? note.category}
                  </span>
                  <span className="text-slate-600 text-xs ml-auto">
                    {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString("ko-KR") : ""}
                  </span>
                </div>
                <p className="text-white text-sm font-medium leading-snug line-clamp-2">
                  {note.questionText}
                </p>
                {!isExpanded && (note.finalAnswer || note.improvedAnswer) && (
                  <p className="text-slate-400 text-xs mt-1.5 line-clamp-1">
                    {note.finalAnswer ?? note.improvedAnswer}
                  </p>
                )}
              </button>

              {/* Expanded view */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-700 pt-3 flex flex-col gap-3">
                  {/* Original answer */}
                  {note.originalAnswer && (
                    <div>
                      <p className="text-slate-500 text-xs mb-1">내 원래 답변</p>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {note.originalAnswer}
                      </p>
                    </div>
                  )}

                  {/* Improved answer */}
                  {note.improvedAnswer && note.improvedAnswer !== note.finalAnswer && (
                    <div>
                      <p className="text-slate-500 text-xs mb-1">개선된 답변</p>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {note.improvedAnswer}
                      </p>
                    </div>
                  )}

                  {/* Final answer — editable */}
                  <div>
                    <p className="text-indigo-300 text-xs mb-1 font-medium">최종 암기용 답변</p>
                    {isEditing ? (
                      <textarea
                        className="w-full bg-slate-900 border border-indigo-500 rounded-xl px-3 py-2 text-white text-sm resize-none focus:outline-none"
                        rows={4}
                        value={editState.finalAnswer}
                        onChange={(e) =>
                          setEditState((prev) => ({ ...prev, finalAnswer: e.target.value }))
                        }
                      />
                    ) : (
                      <p className="text-white text-sm leading-relaxed">
                        {note.finalAnswer ?? note.improvedAnswer ?? "—"}
                      </p>
                    )}
                  </div>

                  {/* Key expressions — editable */}
                  {(exprs.length > 0 || isEditing) && (
                    <div>
                      <p className="text-slate-400 text-xs mb-1.5 font-medium">핵심 표현</p>
                      <div className="flex flex-col gap-1.5">
                        {(isEditing ? editState.keyExpressions : exprs).map((expr, i) => (
                          <div key={i}>
                            {isEditing ? (
                              <input
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                                value={expr}
                                onChange={(e) => updateKeyExpression(i, e.target.value)}
                              />
                            ) : (
                              <div className="bg-slate-700 rounded-lg px-3 py-2 text-white text-sm">
                                "{expr}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => saveEdit(note)}
                          disabled={saving}
                          className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
                        >
                          {saving ? "저장 중..." : "저장"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(note)}
                          className="flex-1 py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600 transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          disabled={deletingId === note.id}
                          className="py-2.5 px-4 rounded-xl bg-slate-700 text-red-400 text-sm font-medium hover:bg-red-900/30 transition-colors disabled:opacity-50"
                        >
                          {deletingId === note.id ? "..." : "삭제"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
