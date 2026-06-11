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
  loading.tsx                 # Next.js 라우트 전환 중 전체 로딩 화면
  layout.tsx                  # 루트 레이아웃 — RouteProgress 전역 포함
  onboarding/page.tsx         # 4단계 프로필 입력 (클라이언트)
  login/page.tsx              # 비밀번호 로그인 + PWA 설치 안내 (클라이언트)
  practice/
    page.tsx                  # 오늘의 질문 연습 + 마스터 모드(?source=note&noteId=N) (클라이언트)
    interview/
      page.tsx                # 실전 면접 대화 WebRTC + JD 면접 진입 (클라이언트)
      FeedbackView.tsx        # 면접 종합 피드백 화면 (클라이언트)
  notes/
    page.tsx                  # 답변 노트 (force-dynamic, 서버 컴포넌트)
    NotesClient.tsx           # 필터·수정·삭제 + 마스터 모드 진입 (클라이언트)
  jd/
    page.tsx                  # 지원 공고 관리 (force-dynamic, 서버 컴포넌트)
    JdClient.tsx              # 공고 붙여넣기·분석·삭제 (클라이언트)
  patterns/page.tsx           # 오늘의 답변 패턴세트 상세·수정·다시 생성 (클라이언트)
  review/page.tsx             # 날짜별 패턴 복습 캘린더 + 최근 패턴 목록 (서버 컴포넌트)
  stats/page.tsx              # 성장 통계 — 연습 횟수·점수 추이·면접 피드백 (서버 컴포넌트)
  api/
    profile/route.ts          # GET, POST (upsert)
    sessions/route.ts         # GET, POST, PATCH
    questions/daily/route.ts  # GET — GPT-4o 생성 + Turso 일별 캐시
    transcribe/route.ts       # POST — Whisper STT
    feedback/route.ts         # POST — 4항목 피드백
    feedback/interview/route.ts  # POST — 실전 면접 종합 피드백
    realtime-token/route.ts   # POST — ephemeral token 발급
    notes/route.ts            # GET(?id=N 단건), POST, PATCH, DELETE
    notes/attempts/route.ts   # GET — 마스터 모드 시도 이력 (noteId 기준)
    jd/route.ts               # POST — 공고 분석·저장, GET — active 목록, DELETE — 아카이브
    patterns/
      daily/route.ts          # GET — 패턴세트 조회/생성, POST — 다시 생성, PATCH — 수동 수정
      history/route.ts        # GET — 날짜별 저장 패턴 목록
    auth/login/route.ts       # POST — 비밀번호 인증
components/
  RouteProgress.tsx           # 화면 전환 중 상단 진행바 + "화면을 여는 중..." (클라이언트)
  PwaInstallPrompt.tsx        # PWA 설치 안내 — Chrome/Android 설치 버튼, iOS 홈 화면 추가 안내
  PatternSetCard.tsx          # 홈 삽입용 패턴세트 요약 카드 (클라이언트)
  PatternSetFetcher.tsx       # 캐시 없을 때 클라이언트에서 패턴 API 호출
  SpeakButton.tsx             # 패턴 문장 TTS 재생 버튼 (클라이언트)
lib/
  pattern-set.ts              # DailyPatternSet 타입, getKstDate(), DAILY_PATTERN_SET_SCHEMA
  weakness.ts                 # 약점 태그 enum, getRecentWeaknesses(), buildWeaknessCtx()
  db/
    schema.ts                 # 7개 테이블 정의
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
| `feedbacks` | 4항목 점수 + 피드백 텍스트 — `noteId`로 마스터 모드 시도 이력 연결, `rawJson`에 약점 태그·JD 커버리지 누적 |
| `answer_notes` | 최종 암기용 답변 + 핵심 표현 |
| `daily_patterns` | 날짜별 패턴 캐시 — `patternType`으로 구분 (`daily_pattern_set` / `weekly_summary_set`) |
| `job_postings` | JD 모드 — 공고 원문 + GPT-4o 요약(summaryJson), soft delete(status) |

## 배포 방식

GitHub `master` 브랜치에 푸시하면 Vercel에서 자동으로 프로덕션 배포된다. 별도 배포 작업 불필요.

## 현재 상태 (2026-06-11)

축적 루프 3종 완료: 약점 추적 루프(과거 피드백 → 다음 면접 반영), 핵심 답변 마스터 모드(같은 질문 재도전 + 점수 델타), JD 모드(채용공고 기반 맞춤 면접 + 커버리지 피드백). 상세는 `agents.md` 14절, `docs/handoff.md` 28절.
하단 nav 뜸 현상을 dvh(동적 뷰포트)로 보정 (실기기 검증 필요).
다음 작업 후보: Codex 코드리뷰 반영, iPhone 실기기 테스트 (마스터 모드·JD 면접·nav 밀착).
