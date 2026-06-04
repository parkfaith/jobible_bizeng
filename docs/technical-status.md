# Jobible BizEng 기술 구현 및 배포 상태

이 문서는 `agents.md`에서 분리한 상세 기술 상태 기록이다.

사용 기준:

- 새 세션의 기본 제품 방향은 먼저 `agents.md`를 따른다.
- 구현 완료 상태, API 라우트, DB 테이블, 배포 설정, 기술 판단이 필요할 때 이 문서를 확인한다.
- 날짜별 작업 인계와 디버깅 기록은 `docs/handoff.md`를 확인한다.

---

## 14. 기술 구현 — 완료 상태 (2026-05-18)

MVP 기능 구현이 완료되었다. 아래는 현재 코드베이스의 실제 상태이다.

### 구현 완료 현황

**기술 스택 (확정)**

- Framework: Next.js 16 (App Router, Turbopack)
- DB: Turso (libSQL) + Drizzle ORM
- Styling: Tailwind CSS v4
- 음성 면접: OpenAI Realtime API GA (WebRTC, `/v1/realtime/client_secrets` ephemeral token)
- STT: OpenAI Whisper (오늘의 질문 연습용)
- 피드백: GPT-4o
- PWA: `@ducanh2912/next-pwa` + Webpack production build
- 배포: 미정 (Vercel 예정)

**완성된 화면**

- `/` — 홈 (프로필 없으면 `/onboarding` 리다이렉트, 주간 연습 횟수/노트 수 표시)
- `/onboarding` — 4단계 프로필 입력 (목표 포지션, 역할, 프로젝트 1~2개, 걱정 상황, 집중 영역)
- `/practice` — 오늘의 질문 연습 (idle→recording→transcribing→feedback 상태머신)
- `/practice/interview` — 실전 면접 대화 (connecting→interviewing→ending→feedback)
- `/notes` — 답변 노트 (카테고리 필터, 펼치기, inline 수정, 삭제)

**완성된 API Routes**

- `GET /api/questions/daily` — GPT-4o 질문 생성, Turso 일별 캐시
- `POST /api/transcribe` — Whisper STT (webm/mp4 자동 감지)
- `POST /api/feedback` — 4항목 피드백 (한국어) + 개선답변 (영어) + 핵심표현 3개
- `POST /api/feedback/interview` — 실전 면접 종합 피드백 (best/worst/nextFocus/3문장)
- `POST /api/realtime-token` — 프로필 기반 면접관 System Prompt 포함 ephemeral token
- `GET /api/patterns/history` — 날짜별 저장된 패턴세트 복습 목록
- `GET|POST|PATCH /api/sessions` — 연습 세션 기록
- `GET|POST|PATCH|DELETE /api/notes` — 답변 노트 CRUD
- `GET|POST /api/profile` — 프로필 조회/저장

**DB 테이블 (Turso, 이미 적용됨)**

- `profile` — 목표 포지션, 역할, 경력, 프로젝트 JSON, 걱정 상황, 집중 영역
- `practice_sessions` — 모드(daily/interview), 상태, 시작/종료 시각
- `practice_turns` — 질문 텍스트, 사용자 전사, AI 꼬리질문 (세션 FK)
- `feedbacks` — 4항목 점수, 한국어 피드백, 개선 답변, 핵심 표현
- `answer_notes` — 카테고리, 원본/개선/최종 답변, 핵심 표현
- `daily_patterns` — 날짜별 질문 캐시

**환경변수 (.env.local — 절대 커밋 금지)**

- `TURSO_DATABASE_URL` — libsql://... 형식
- `TURSO_AUTH_TOKEN` — Turso JWT 토큰
- `OPENAI_API_KEY` — sk-proj-... 형식
- `OPENAI_TEXT_MODEL` — 선택값, 기본 `gpt-4o`
- `OPENAI_REALTIME_MODEL` — 선택값, 기본 `gpt-realtime`
- `ANTHROPIC_API_KEY` — 현재 미사용, 향후 콘텐츠 품질 비교용

새 컴퓨터에서 시작할 때:

1. `git clone https://github.com/parkfaith/jobible_bizeng.git`
2. `npm install`
3. `.env.local` 파일 생성 후 환경변수 입력 (`.env.example` 참고)
4. `npm run dev`

DB는 Turso 클라우드에 이미 있으므로 `npm run db:push`는 스키마가 변경됐을 때만 실행한다.

### 다음 개선 후보

- 프로필 수정 화면 (`/profile`)
- Vercel 배포
- iOS Safari 마이크 권한 플로우 테스트
- 실전 면접 중 질문 번호 추적 개선
- 오늘의 질문 카테고리 수동 선택 옵션

## 15. 추가 구현 — 오늘의 답변 패턴세트 (2026-05-19)

기존 `오늘의 표현 카드`는 단일 표현 학습에 가까웠으므로, 앱의 핵심 흐름에 맞게 `오늘의 답변 패턴세트`로 확장한다.

방향:

- ChatGPT 스타일의 실전적이고 내용 중심인 패턴세트를 우선한다.
- Claude 스타일의 보기 좋은 정리 구조를 UI와 편집 화면에 흡수한다.
- 두 결과를 사용자에게 동시에 보여주지 않는다.
- 앱 안에서는 하나의 최종 curated 패턴세트만 노출한다.
- 패턴세트는 읽는 콘텐츠가 아니라 `30초 답변 워밍업 -> 말하기 연습 -> 피드백 -> 답변 노트 저장` 흐름의 시작점이다.

현재 구현:

- `GET /api/patterns/daily` — OpenAI Responses API로 오늘의 답변 패턴세트 자동 생성, Turso `daily_patterns`에 `daily_pattern_set`으로 캐시
- `POST /api/patterns/daily` — 오늘의 패턴세트 다시 생성
- `PATCH /api/patterns/daily` — 오늘의 패턴세트 수동 수정 저장
- `/patterns` — 오늘의 답변 패턴세트 상세 보기, 수정, 다시 생성, 말하기 연습 이동
- `/review` — 날짜별 패턴 복습 캘린더와 최근 패턴 목록
- 홈 — `30초 답변 워밍업` 카드로 요약 표시
- `/practice?source=pattern` — 패턴세트 질문과 30초 답변 구조를 참고하며 음성 답변 연습
- `/api/feedback` — 패턴세트 기반 연습 시 오늘의 패턴 활용 여부를 짧게 피드백

Realtime API 메모:

- 예전 Beta 엔드포인트 `/v1/realtime/sessions`와 preview 모델은 사용하지 않는다.
- 현재 구현은 `/v1/realtime/client_secrets`로 ephemeral key를 발급한다.
- 브라우저 WebRTC SDP 교환은 `/v1/realtime/calls`로 수행한다.
- 기본 모델은 `OPENAI_REALTIME_MODEL` 환경변수가 있으면 그 값을 쓰고, 없으면 `gpt-realtime`을 사용한다.
- 실전 면접은 비용 방지를 위해 10분 또는 4개 질문 기준으로 자동 종료한다.
- `/api/patterns/daily`의 다시 생성은 하루 3회로 제한한다.
- OpenAI API 오류 원문은 클라이언트에 그대로 반환하지 않고 서버 로그에만 남긴다.

PWA 메모:

- 앱은 모바일 PWA 설치를 전제로 한다.
- `public/manifest.json`과 `app/layout.tsx`에 앱 이름, 아이콘, apple web app 메타데이터가 설정되어 있다.
- Jobible BizEng 로고 원본은 `public/icons/jobible-bizeng-logo.svg`이다.
- PWA 아이콘은 `public/icons/icon-192.png`, `public/icons/icon-512.png`, maskable 아이콘, `public/apple-touch-icon.png`, `app/favicon.ico`로 생성되어 있다.
- Next.js 16 기본 Turbopack 빌드는 PWA 플러그인의 Webpack 설정과 충돌하므로 `npm run build`는 `next build --webpack`을 사용한다.
- `public/sw.js`와 `public/workbox-*.js`는 빌드 산출물이므로 커밋하지 않고 `.gitignore`에 둔다.

UX 결정:

- 홈의 별도 `오늘의 질문 연습` 카드는 제거한다.
- `오늘의 답변 패턴세트` 안의 질문이 곧 오늘의 질문 연습이다.
- `/practice` 기본 진입도 패턴세트 기반 질문 연습으로 연결한다.
- 순수 일일 질문 생성 API는 남겨두되, 필요할 때 `/practice?source=daily`로만 사용한다.
- 오늘 생성한 패턴세트는 `daily_patterns`에 날짜별로 저장되며, `/review`에서 이전 날짜 패턴을 다시 볼 수 있게 한다.
- 복습은 별도 하단 메뉴 `/review`로 분리한다. `/patterns`는 오늘 패턴 상세와 편집 중심으로 유지한다.
- 답변 노트 카테고리는 고정 분류이므로 가로 스크롤 탭이 아니라 줄바꿈형 그리드로 보여준다.

UX 기준:

- 홈에서는 패턴세트 전체를 길게 보여주지 않고 핵심 표현 3개와 오늘의 질문만 압축 표시한다.
- 상세 화면은 패턴, 의미, 활용 포인트, 자주 틀리는 표현, 쉐도잉, 30초 답변 구조를 제공한다.
- `ChatGPT에 붙여넣기` 흐름은 앱 밖으로 사용자를 보내므로 기본 UX에서 제외한다.
- 실전 면접 중에는 패턴세트를 직접 노출하지 않고, 면접 전 워밍업과 종료 후 피드백에만 연결한다.

## 16. 배포 방향 — Vercel Hobby 1차 배포 판단 (2026-05-20)

현재 판단은 `Vercel Hobby`에 1차 배포해도 된다는 쪽이다.  
다만 무료 플랜의 개인/비상업 사용 제한과 함수 실행 시간/사용량 제한을 전제로 한다.

### 1. Vercel Hobby로 가능한 이유

- 앱은 Next.js App Router 기반이므로 Vercel 배포와 잘 맞는다.
- DB는 Vercel 내부가 아니라 외부 Turso/libSQL을 사용한다.
- OpenAI API 키, Turso 토큰, 앱 비밀번호는 Vercel 환경변수에만 둔다.
- 핵심 음성 면접은 Vercel이 WebSocket 서버나 음성 스트림 중계 서버 역할을 하지 않는다.
- `/api/realtime-token`은 OpenAI Realtime API용 ephemeral token만 발급한다.
- 실제 WebRTC 음성 연결은 브라우저가 OpenAI Realtime API와 직접 연결한다.
- 따라서 Vercel Functions가 WebSocket 서버를 지원하지 않는 제약에는 직접 걸리지 않는다.

### 2. 주의할 점

- Hobby 플랜은 개인/비상업 프로젝트용이다. 혼자 쓰는 MVP나 소규모 개인 테스트에는 적합하지만, 외부 사용자 대상 서비스나 유료화 단계에서는 Pro 전환을 검토한다.
- OpenAI 호출이 들어가는 API 라우트는 응답 시간이 길어질 수 있다.
- 특히 아래 라우트는 Vercel Function 시간 제한을 고려해야 한다.

느릴 수 있는 라우트:

- `app/api/patterns/daily/route.ts`
- `app/api/patterns/weekly/route.ts`
- `app/api/feedback/route.ts`
- `app/api/feedback/interview/route.ts`
- `app/api/transcribe/route.ts`
- `app/api/tts/route.ts`
- `app/api/questions/daily/route.ts`

권장:

- 위 라우트에는 필요하면 `export const maxDuration = 60;`을 명시한다.
- OpenAI API 원문 오류는 클라이언트에 그대로 노출하지 않는다.
- 개인용 앱이라도 Vercel 사용량, OpenAI 사용량, Turso 사용량을 주기적으로 확인한다.

### 3. Vercel 환경변수

Vercel Project Settings > Environment Variables에 아래 값을 설정한다.

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_TEXT_MODEL=gpt-4o`
- `OPENAI_REALTIME_MODEL=gpt-realtime`
- `APP_PASSWORD`
- `SESSION_SECRET`
- `ANTHROPIC_API_KEY`는 현재 미사용이며, 향후 콘텐츠 품질 비교 시에만 사용한다.

### 4. Vercel 빌드 설정

- Build Command: `npm run build`
- 현재 `package.json`의 build 스크립트는 `next build --webpack`이다.
- Next.js 16 기본 Turbopack 빌드는 PWA 플러그인의 Webpack 설정과 충돌할 수 있으므로 `--webpack`을 유지한다.
- 개발 서버도 같은 이유로 `npm run dev`가 `next dev --webpack`을 사용한다.
- `middleware.ts`는 사용하지 않는다. Next.js 16 경고 대응으로 인증 보호 로직은 `proxy.ts`에 둔다.

### 5. 배포 후 필수 확인

모바일 실제 기기, 특히 iPhone/Safari 또는 설치형 PWA에서 아래를 확인한다.

1. 로그인
2. 홈 로딩
3. 오늘의 답변 패턴세트 생성
4. 30초 답변 녹음
5. OpenAI 전사
6. 답변 피드백 생성
7. 실전 면접 Realtime 연결
8. 면접 종료 후 종합 피드백
9. 답변 노트 저장
10. 통계 화면 반영
11. PWA 설치와 재접속

### 6. 향후 전환 기준

Vercel Hobby를 유지해도 되는 경우:

- 개인용 MVP
- 사용자 1명 또는 매우 소규모 지인 테스트
- 비상업 사용
- API 호출량이 낮고 사용량 모니터링이 가능한 상태

Pro 또는 별도 백엔드를 검토해야 하는 경우:

- 외부 사용자에게 공개
- 유료화 또는 상업적 사용
- OpenAI 피드백 생성이 60초 제한에 자주 걸림
- 사용량 초과 또는 런타임 로그 부족으로 운영이 어려움
- 서버 측 장시간 작업, 큐, 배치 작업, 오디오 파일 저장이 필요해짐

이전 기획 방향:

현재부터는 기획에서 기술 구현 준비 단계로 넘어간다.  
다만 아직 실제 기능 구현은 시작하지 않고, 기술 선택과 데이터 구조를 먼저 정리한다.

### 1. 저장소 방향

개인용 앱이라도 완전 무DB보다는 경량 DB를 사용하는 것을 추천한다.  
현재 사용자가 기존 사이드프로젝트에서 `Turso`를 사용하고 있으므로, 이 프로젝트도 SQLite 파일 직접 관리보다 `Turso`를 우선 검토한다.

이유:

- 면접 세션 기록이 쌓인다.
- 음성 인식 텍스트와 피드백을 다시 봐야 한다.
- 답변 노트는 저장, 수정, 검색, 분류가 필요하다.
- 매일 제공할 면접영어 패턴 콘텐츠도 캐시하거나 저장할 수 있다.
- Turso는 SQLite/libSQL 계열의 단순함을 유지하면서 모바일 웹/PWA + 개인용 백엔드 구조에 붙이기 좋다.
- 이미 사용 경험이 있으므로 개발 속도와 운영 안정성 면에서 유리하다.

### 2. DB 없이 시작할 경우의 한계

파일 JSON이나 localStorage만으로도 아주 초기 테스트는 가능하다.  
하지만 아래 기능이 들어가면 곧 한계가 온다.

- 날짜별 연습 기록
- 질문별 답변 비교
- 최종 답변 노트 관리
- 콘텐츠 패턴 저장
- 피드백 이력 확인
- 모바일과 PC 간 데이터 이동

따라서 화면만 보는 프로토타입은 무DB로 충분하지만, 실제 개인 사용 MVP는 Turso를 사용한다.

### 3. 초기 데이터 테이블 후보

초기에는 테이블을 많이 만들지 않는다.

- `profile`: 사용자 프로필과 목표 포지션
- `practice_sessions`: 면접 또는 질문 연습 세션
- `practice_turns`: 질문, 사용자 음성 전사, AI 꼬리 질문
- `feedbacks`: 세션 또는 답변별 피드백
- `answer_notes`: 최종 암기용 답변과 핵심 표현
- `daily_patterns`: 매일 생성한 면접영어 패턴 콘텐츠

### 4. 오디오 파일 저장

초기에는 오디오 원본 저장을 필수로 하지 않는다.

우선 저장할 것:

- 질문 텍스트
- 사용자 답변 전사 텍스트
- AI 피드백
- 최종 답변
- 핵심 표현

오디오 파일 저장은 용량, 개인정보, 백업 문제가 있으므로 나중에 결정한다.  
필요하면 파일 스토리지에 오디오를 저장하고 Turso에는 파일 경로나 메타데이터만 저장한다.

### 5. 추천 기술 방향

개인용 모바일 웹/PWA MVP 기준 추천:

- Frontend: 모바일 우선 웹 UI
- Backend: 가벼운 로컬/개인 서버
- DB: Turso 우선
- 음성 면접: OpenAI Realtime API 우선 검토
- 콘텐츠 생성: OpenAI와 Claude API 비교

처음부터 복잡한 클라우드 DB, 로그인, 사용자 관리, 결제, 동기화는 만들지 않는다.

### 6. 모바일에서 Turso 사용 기준

주요 사용 환경은 핸드폰 또는 태블릿이다. 모바일 웹/PWA에서는 기기 안에 DB를 직접 두기보다 백엔드가 Turso에 연결하는 방식을 우선한다.

추천 기준:

- 모바일 브라우저는 직접 DB에 연결하지 않는다.
- 모바일 브라우저는 개인용 백엔드 API를 호출한다.
- 백엔드는 Turso에 연결한다.
- Turso 토큰과 API 키는 백엔드에만 둔다.
- 모바일에는 OpenAI, Claude, Turso 비밀 키를 노출하지 않는다.

대안:

- 네이티브 앱 또는 Capacitor 같은 앱 래퍼를 쓴다면 기기 내부 SQLite/libSQL 사용을 검토할 수 있다.
- 완전 오프라인 PWA를 목표로 한다면 IndexedDB 또는 sqlite-wasm/OPFS 같은 선택지도 있으나, 초기 MVP에는 복잡하다.
- 로컬 개발이나 백업 용도로 순수 SQLite 파일을 병행 사용할 수는 있다.

현재 추천:

- 1차 MVP: 모바일 웹/PWA + 개인용 백엔드 + Turso
- 모바일 기기에는 DB를 직접 두지 않는다.
- 모바일에서는 음성 면접 UI와 결과 조회에 집중한다.
- 데이터 백업과 이전을 고려해 주요 테이블은 단순한 SQL 구조로 유지한다.
## 17. 최근 인계 및 작업 로그

이 문서는 새 세션 시작 시 반드시 읽는 핵심 기준 문서이므로 길게 늘리지 않는다.

상세 작업 이력, 날짜별 인계, 디버깅 기록, 실기기 테스트 체크리스트는 아래 문서를 확인한다.

- `docs/handoff.md`

운영 원칙:

- 제품 방향이나 MVP 범위가 바뀌면 이 `agents.md`의 핵심 섹션을 업데이트한다.
- 날짜별 작업 로그, 장애 원인 분석, 배포 후 확인 사항은 `docs/handoff.md`에 기록한다.
- 새 세션에서는 먼저 이 문서를 읽고, 이어서 최근 작업 맥락이 필요할 때만 `docs/handoff.md`의 최신 섹션을 확인한다.



