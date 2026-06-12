"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const FOCUS_OPTIONS = [
  { key: "intro", label: "자기소개" },
  { key: "career", label: "경력 설명" },
  { key: "leadership", label: "리더십" },
  { key: "tech", label: "기술 설명" },
] as const;

type FocusKey = (typeof FOCUS_OPTIONS)[number]["key"];

interface Project {
  name: string;
  role: string;
  problem: string;
  tech: string;
  impact: string;
}

const emptyProject = (): Project => ({
  name: "",
  role: "",
  problem: "",
  tech: "",
  impact: "",
});

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [targetPosition, setTargetPosition] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [projects, setProjects] = useState<Project[]>([emptyProject()]);
  const [topConcern, setTopConcern] = useState("");
  const [focusAreas, setFocusAreas] = useState<FocusKey[]>([]);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (!data) return;
        setTargetPosition(data.targetPosition ?? "");
        setCurrentRole(data.currentRole ?? "");
        setYearsExp(String(data.yearsExp ?? ""));
        const parsed = typeof data.projects === "string" ? JSON.parse(data.projects) : data.projects;
        setProjects(Array.isArray(parsed) && parsed.length > 0 ? parsed : [emptyProject()]);
        setTopConcern(data.topConcern ?? "");
        const fa = typeof data.focusAreas === "string" ? JSON.parse(data.focusAreas) : data.focusAreas;
        setFocusAreas(Array.isArray(fa) ? fa : []);
      })
      .finally(() => setLoading(false));
  }, []);

  function updateProject(idx: number, field: keyof Project, value: string) {
    setProjects((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  function addProject() {
    if (projects.length < 2) setProjects((prev) => [...prev, emptyProject()]);
  }

  function removeProject(idx: number) {
    setProjects((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleFocus(key: FocusKey) {
    setFocusAreas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    if (!targetPosition.trim() || !currentRole.trim() || !yearsExp) return;
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPosition,
          currentRole,
          yearsExp: Number(yearsExp),
          projects,
          topConcern,
          focusAreas,
        }),
      });
      router.push("/");
    } catch {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-full bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <Link
          href="/"
          className="tap-target w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400"
        >
          ←
        </Link>
        <h1 className="text-white text-lg font-bold">프로필 수정</h1>
      </div>

      {/* Section 1 */}
      <Section title="목표 포지션 · 경력">
        <InputField
          label="목표 포지션"
          placeholder="예: AI Director, Head of Engineering"
          value={targetPosition}
          onChange={setTargetPosition}
        />
        <InputField
          label="현재 역할"
          placeholder="예: AI 기술이사, 플랫폼 아키텍트"
          value={currentRole}
          onChange={setCurrentRole}
        />
        <InputField
          label="총 경력 연수"
          placeholder="예: 22"
          value={yearsExp}
          onChange={setYearsExp}
          type="number"
        />
      </Section>

      {/* Section 2 */}
      <Section title="대표 프로젝트">
        <p className="text-slate-500 text-xs -mt-1 mb-3">AI가 경력을 지어내지 않도록 실제 사실만 짧게</p>
        {projects.map((p, idx) => (
          <div key={idx} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3 mb-3">
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-xs font-medium">프로젝트 {idx + 1}</p>
              {idx > 0 && (
                <button
                  onClick={() => removeProject(idx)}
                  className="text-slate-500 text-xs hover:text-red-400 transition-colors"
                >
                  삭제
                </button>
              )}
            </div>
            <InputField label="프로젝트명" placeholder="예: 기업용 LLM 도입 프로젝트" value={p.name} onChange={(v) => updateProject(idx, "name", v)} />
            <InputField label="내 역할" placeholder="예: 프로젝트 총괄 리드" value={p.role} onChange={(v) => updateProject(idx, "role", v)} />
            <InputField label="해결한 문제" placeholder="예: 사내 지식 검색 정확도 40% 향상" value={p.problem} onChange={(v) => updateProject(idx, "problem", v)} />
            <InputField label="기술/방법" placeholder="예: RAG, LangChain, Azure OpenAI" value={p.tech} onChange={(v) => updateProject(idx, "tech", v)} />
            <InputField label="성과/임팩트" placeholder="예: 운영팀 업무 시간 30% 단축" value={p.impact} onChange={(v) => updateProject(idx, "impact", v)} />
          </div>
        ))}
        {projects.length < 2 && (
          <button
            onClick={addProject}
            className="text-indigo-400 text-sm font-medium py-2"
          >
            + 프로젝트 하나 더 추가
          </button>
        )}
      </Section>

      {/* Section 3 */}
      <Section title="가장 걱정되는 면접 상황">
        <textarea
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-indigo-500"
          rows={4}
          placeholder="예: 리더십 경험을 영어로 설명할 때 말이 길어지고 핵심이 없어져요."
          value={topConcern}
          onChange={(e) => setTopConcern(e.target.value)}
        />
      </Section>

      {/* Section 4 */}
      <Section title="집중 연습 영역">
        <div className="flex flex-col gap-3">
          {FOCUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => toggleFocus(opt.key)}
              className={`w-full text-left px-5 py-4 rounded-xl border text-base font-medium transition-colors ${
                focusAreas.includes(opt.key)
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-800 border-slate-700 text-slate-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Save button — sticky bottom (fixed는 iOS 터치 이벤트를 삼켜서 sticky로 전환) */}
      <div className="sticky bottom-0 mt-auto -mx-4 px-4 pb-safe pt-3 bg-slate-950 border-t border-slate-800">
        <button
          onClick={handleSave}
          disabled={!targetPosition.trim() || !currentRole.trim() || !yearsExp || saving}
          className="w-full py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h2 className="text-slate-300 text-sm font-semibold mb-4">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-slate-400 text-xs font-medium">{label}</label>
      <input
        type={type}
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
