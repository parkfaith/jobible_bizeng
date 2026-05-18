# Jobible BizEng — CLAUDE.md

새 세션을 시작할 때 이 파일과 `agents.md`를 반드시 먼저 읽는다.  
기획 방향과 결정 이유는 `agents.md`에 있다. 이 파일은 코드 작업에 필요한 기술 컨텍스트만 담는다.

## 프로젝트 한 줄 요약

외국계 이직을 준비하는 시니어 AI/IT 리더(ryanPark, 50세)를 위한 **모바일 웹 영어 면접 코치**.  
핵심 기능: OpenAI Realtime API WebRTC 기반 AI 면접관과의 음성 실전 면접.

## 기술 스택

- **Framework**: Next.js 16 (App Router, Turbopack)
- **DB**: Turso (libSQL) + Drizzle ORM — `lib/db/schema.ts`, `lib/db/index.ts`
- **Styling**: Tailwind CSS v4
- **음성 면접**: OpenAI Realtime API (WebRTC, ephemeral token 방식)
- **STT**: OpenAI Whisper-1
- **피드백 생성**: GPT-4o (`gpt-4o`)

## 폴더 구조

```
app/
  page.tsx                    # 홈 (force-dynamic, 서버 컴포넌트)
  onboarding/page.tsx         # 4단계 프로필 입력 (클라이언트)
  practice/
    page.tsx                  # 오늘의 질문 연습 (클라이언트)
    interview/page.tsx        # 실전 면접 대화 WebRTC (클라이언트)
  notes/
    page.tsx                  # 답변 노트 (force-dynamic, 서버 컴포넌트)
    NotesClient.tsx           # 필터·수정·삭제 (클라이언트)
  api/
    profile/route.ts          # GET, POST (upsert)
    sessions/route.ts         # GET, POST, PATCH
    questions/daily/route.ts  # GET — GPT-4o 생성 + Turso 일별 캐시
    transcribe/route.ts       # POST — Whisper STT
    feedback/route.ts         # POST — 4항목 피드백
    feedback/interview/route.ts  # POST — 실전 면접 종합 피드백
    realtime-token/route.ts   # POST — ephemeral token 발급
    notes/route.ts            # GET, POST, PATCH, DELETE
lib/
  db/
    schema.ts                 # 6개 테이블 정의
    index.ts                  # Turso 클라이언트 + Drizzle
```

## 환경변수 (.env.local)

```
TURSO_DATABASE_URL=libsql://...turso.io
TURSO_AUTH_TOKEN=eyJ...
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=         # 현재 미사용
```

`.env.example`에 키 이름만 있는 템플릿이 있다. `.env.local`은 절대 커밋하지 않는다.

## 자주 쓰는 명령어

```bash
npm run dev          # 개발 서버 (localhost:3000)
npm run build        # 빌드 + 타입 체크
npm run db:push      # 스키마 변경 시 Turso에 적용
npm run db:studio    # Drizzle Studio (DB 브라우저)
```

## 작업 규칙

- 기획이 바뀌면 `agents.md`를 먼저 업데이트한다.
- UI는 항상 모바일 기준으로 설계한다 (max-w-md, 큰 터치 영역).
- 서버 컴포넌트에서 DB 직접 조회, 클라이언트 컴포넌트에서 API Routes 호출.
- API 비밀 키는 서버 사이드(`app/api/`)에서만 사용한다. 클라이언트에 노출하지 않는다.
- 면접 중에는 타이핑 UI를 두지 않는다. 음성만 사용한다.
- 피드백은 한국어로, 개선 답변과 핵심 표현은 영어로 제공한다.
- AI 코치 말투: 친절한 선생님이 아니라 실전 면접 코치. 과도한 칭찬 없음.

## DB 스키마 요약

| 테이블 | 역할 |
|---|---|
| `profile` | 사용자 목표·경력·프로젝트 (1행) |
| `practice_sessions` | 연습 세션 (daily / interview) |
| `practice_turns` | 질문-답변 턴 기록 |
| `feedbacks` | 4항목 점수 + 피드백 텍스트 |
| `answer_notes` | 최종 암기용 답변 + 핵심 표현 |
| `daily_patterns` | 오늘의 질문 캐시 (날짜별 1행) |

## 현재 상태 (2026-05-18)

MVP 4개 Phase 전체 완료. 배포 전 단계.  
다음 작업 후보: 프로필 수정 화면, Vercel 배포, iOS 테스트.
