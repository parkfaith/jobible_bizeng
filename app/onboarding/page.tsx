"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form state
  const [targetPosition, setTargetPosition] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [projects, setProjects] = useState<Project[]>([emptyProject()]);
  const [topConcern, setTopConcern] = useState("");
  const [focusAreas, setFocusAreas] = useState<FocusKey[]>([]);

  const totalSteps = 4;

  function updateProject(idx: number, field: keyof Project, value: string) {
    setProjects((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  function addProject() {
    if (projects.length < 2) setProjects((prev) => [...prev, emptyProject()]);
  }

  function toggleFocus(key: FocusKey) {
    setFocusAreas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSubmit() {
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

  function canNext() {
    if (step === 1) return targetPosition.trim() && currentRole.trim() && yearsExp;
    if (step === 2) return projects[0].name.trim() && projects[0].role.trim();
    if (step === 3) return topConcern.trim();
    if (step === 4) return focusAreas.length > 0;
    return false;
  }

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col max-w-md mx-auto px-4 pt-10 pb-10">
      {/* Progress bar */}
      <div className="flex gap-1 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i < step ? "bg-indigo-500" : "bg-slate-700"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-white text-xl font-bold mb-1">목표 포지션을 알려주세요</h2>
            <p className="text-slate-400 text-sm">면접 질문의 방향을 잡는 데 사용합니다</p>
          </div>
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
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-white text-xl font-bold mb-1">대표 프로젝트를 입력해 주세요</h2>
            <p className="text-slate-400 text-sm">AI가 경력을 지어내지 않도록 실제 사실만 짧게</p>
          </div>
          {projects.map((p, idx) => (
            <div key={idx} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col gap-3">
              {projects.length > 1 && (
                <p className="text-slate-400 text-xs font-medium">프로젝트 {idx + 1}</p>
              )}
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
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-white text-xl font-bold mb-1">가장 걱정되는 면접 상황은?</h2>
            <p className="text-slate-400 text-sm">솔직하게 적어주세요. AI 코치가 집중적으로 도와드립니다</p>
          </div>
          <textarea
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm resize-none focus:outline-none focus:border-indigo-500"
            rows={4}
            placeholder="예: 리더십 경험을 영어로 설명할 때 말이 길어지고 핵심이 없어져요. 특히 '왜 그 결정을 했는가'를 설명할 때 자신이 없습니다."
            value={topConcern}
            onChange={(e) => setTopConcern(e.target.value)}
          />
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-white text-xl font-bold mb-1">어떤 부분을 집중 연습할까요?</h2>
            <p className="text-slate-400 text-sm">복수 선택 가능합니다</p>
          </div>
          <div className="flex flex-col gap-3">
            {FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => toggleFocus(opt.key)}
                className={`w-full text-left px-5 py-4 rounded-xl border text-base font-medium transition-colors ${
                  focusAreas.includes(opt.key)
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-auto pt-10 flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 py-4 rounded-xl bg-slate-800 text-slate-300 font-semibold text-base border border-slate-700"
          >
            이전
          </button>
        )}
        {step < totalSteps ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canNext() || saving}
            className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base disabled:opacity-40"
          >
            {saving ? "저장 중..." : "시작하기"}
          </button>
        )}
      </div>
    </main>
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
