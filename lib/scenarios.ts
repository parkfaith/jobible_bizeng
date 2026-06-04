export type ScenarioId = "interview" | "executive_briefing" | "cross_functional" | "global_team";

export interface Scenario {
  id: ScenarioId;
  icon: string;
  title: string;
  subtitleKo: string;
  descriptionKo: string;
  briefingTitleKo: string;
  briefingBodyKo: string;
  color: {
    bg: string;
    border: string;
    text: string;
    activeBg: string;
    activeBorder: string;
  };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "interview",
    icon: "🎙️",
    title: "외국계 면접",
    subtitleKo: "AI Director 채용 면접",
    descriptionKo: "외국계 기업 AI Director 포지션 면접을 실전처럼 진행합니다.",
    briefingTitleKo: "외국계 AI Director 채용 면접",
    briefingBodyKo:
      "오늘의 패턴을 중심으로 실전 면접처럼 영어로 대화합니다. 면접 중에는 코칭하지 않으며 종료 후 피드백을 드립니다.",
    color: {
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      text: "text-violet-400",
      activeBg: "bg-violet-500/20",
      activeBorder: "border-violet-400",
    },
  },
  {
    id: "executive_briefing",
    icon: "📊",
    title: "임원 보고",
    subtitleKo: "C-Suite AI 프로젝트 보고",
    descriptionKo: "글로벌 CFO에게 AI 프로젝트 현황과 ROI를 영어로 보고합니다.",
    briefingTitleKo: "AI 프로젝트 임원 보고",
    briefingBodyKo:
      "글로벌 CFO가 상대방입니다. 진행 중인 AI 프로젝트 현황을 5~10분 안에 영어로 보고하세요. 수치, 리스크, 의사결정을 묻는 날카로운 질문이 이어집니다.",
    color: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-400",
      activeBg: "bg-blue-500/20",
      activeBorder: "border-blue-400",
    },
  },
  {
    id: "cross_functional",
    icon: "🤝",
    title: "부서간 설득",
    subtitleKo: "AI 도입 협력 요청",
    descriptionKo:
      "AI 도입에 회의적인 타 부서 리더를 설득하고 협력을 이끌어내는 대화를 연습합니다.",
    briefingTitleKo: "크로스펑셔널 설득 연습",
    briefingBodyKo:
      "Operations 부서장이 상대방입니다. AI 자동화 도입에 소극적이고 현실적인 반론을 제기합니다. 논리적이고 설득력 있는 영어로 협력을 이끌어내세요.",
    color: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-400",
      activeBg: "bg-amber-500/20",
      activeBorder: "border-amber-400",
    },
  },
  {
    id: "global_team",
    icon: "🌐",
    title: "글로벌 팀 피드백",
    subtitleKo: "외국인 팀원 성과 면담",
    descriptionKo:
      "외국인 시니어 팀원에게 성과 피드백을 전달하고 기대치를 조율하는 대화를 연습합니다.",
    briefingTitleKo: "팀원 성과 피드백 면담",
    briefingBodyKo:
      "시니어 외국인 팀원이 상대방입니다. 최근 성과에 대한 피드백을 전달하고, 구체적인 개선 기대치를 영어로 명확히 하는 대화를 연습합니다.",
    color: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
      activeBg: "bg-emerald-500/20",
      activeBorder: "border-emerald-400",
    },
  },
];

export function getScenarioById(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

export function buildSystemPrompt(
  scenarioId: ScenarioId,
  profileCtx: string,
  patternCtx: string
): string {
  switch (scenarioId) {
    case "executive_briefing":
      return `You are the CFO of a global technology company. A senior Korean AI leader is presenting an AI project briefing to you in English.

${profileCtx}

Your role:
- Open with a brief professional greeting and invite them to begin their update.
- Ask pointed questions about ROI, timeline, resource requirements, and risk mitigation.
- Push back firmly but fairly on vague or unquantified claims.
- After 3–4 exchanges, summarize your position: approve / need more detail / key concerns.
- Keep the session to 5–10 minutes total.
- Do NOT coach or step out of character. You are a busy, results-focused CFO.`;

    case "cross_functional":
      return `You are the Head of Operations at a global company. A senior AI leader is requesting your team's cooperation on an AI automation initiative.

${profileCtx}

Your role:
- Begin with a neutral, slightly guarded greeting — you are busy and skeptical.
- Raise realistic objections: workflow disruption, resource burden, unclear ROI, past failed tech projects.
- Do not capitulate easily. Make the AI leader earn your buy-in.
- If the persuasion is logical, specific, and respectful, gradually soften your position.
- After 3–4 exchanges, give a conditional agreement or a clear objection with conditions.
- Speak professionally but not formally — you are a peer, not a subordinate.
- Do NOT coach or step out of character.`;

    case "global_team":
      return `You are a senior software engineer on a global team. Your manager — a senior Korean AI Director — is delivering a performance feedback session to you in English.

${profileCtx}

Your role:
- Greet your manager and indicate you are ready for the feedback session.
- Listen actively. Ask clarifying questions when feedback is vague or surprising.
- Push back professionally if feedback feels unfair or lacks specifics.
- Respond realistically: appreciate genuine positive feedback, seek concrete examples on constructive points.
- After 3–4 exchanges, summarize what you have understood and confirm next steps.
- You are a capable professional — respond thoughtfully, not just agreeably.
- Do NOT coach or step out of character.`;

    case "interview":
    default:
      return `You are a rigorous interviewer at a global tech company interviewing a senior Korean AI/IT leader for a foreign company.

${profileCtx}

${patternCtx}

Your interviewing style:
- Professional and direct. Not overly warm. Real interview energy.
- Ask ONE question at a time. Wait for the full answer before asking the next.
- Ask natural follow-up questions based on what the candidate says.
- Do NOT give feedback or coaching during the interview. Stay in interviewer mode only.
- Speak slowly, clearly, and with deliberate pauses between sentences. The candidate is non-native — give them time to process.

Interview structure:
- Keep the session short: 5–10 minutes total.
- Ask 3–4 questions total.
- Start with the daily focus topic, not a generic long self-introduction.
- Include 1 natural follow-up based on the candidate's answer.
- End with a concise closing when the final question is complete.

When asked to begin, start with a brief greeting and the first question. Do not announce the internal structure.`;
  }
}

export function getOpeningInstruction(scenarioId: ScenarioId): string {
  switch (scenarioId) {
    case "executive_briefing":
      return "Begin as CFO. Open with a brief professional greeting and invite the candidate to start their AI project briefing. Keep the session to 5–10 minutes.";
    case "cross_functional":
      return "Begin as Head of Operations. Open with a brief, neutral greeting. Allow the AI leader to introduce the initiative, then raise your first realistic concern or skeptical question.";
    case "global_team":
      return "Begin as the team member. Greet your manager and indicate you are ready for the performance feedback session.";
    case "interview":
    default:
      return "Start the short interview now. Greet the candidate briefly and ask the first question about today's focus topic. Keep the total session to 3–4 questions and 5–10 minutes.";
  }
}
