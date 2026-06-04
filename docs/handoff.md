# Jobible BizEng 상세 인계 및 작업 로그

이 문서는 `agents.md`에서 분리한 날짜별 상세 인계 기록이다.

사용 기준:

- 새 세션의 기본 방향은 먼저 `agents.md`를 따른다.
- 최근 작업 상태, 디버깅 기록, 배포 후 확인 사항이 필요할 때 이 문서의 최신 섹션부터 확인한다.
- 제품의 장기 기준이나 MVP 범위가 바뀌면 `agents.md`에도 반영한다.

---

## 17. 모바일/PWA 점검 및 패턴 날짜 보정 (2026-05-21)

모바일 실제 확인 중 발견된 클릭 불안정, PWA 상단 침범, 패턴 날짜 중복 가능성을 점검하고 수정했다.

수정 내용:

- iOS 설치형 PWA에서 콘텐츠가 상태바 영역까지 올라가지 않도록 전역 safe-area 처리를 추가했다.
- `appleWebApp.statusBarStyle`은 `black-translucent`에서 `black`으로 변경했다.
- 모바일 터치 안정성을 위해 주요 링크, 하단 내비게이션, 뒤로가기, 작은 액션 버튼에 최소 44px 터치 영역을 적용했다.
- 하단 고정 내비게이션은 safe-area bottom을 반영하도록 변경했다.
- 로그인 화면에 PWA 설치 안내 컴포넌트를 추가했다.
  - Chrome/Android처럼 `beforeinstallprompt`를 지원하면 `설치` 버튼을 보여준다.
  - iOS Safari처럼 설치 버튼 API가 없는 경우에는 공유 버튼 → 홈 화면에 추가 안내를 보여준다.
- `/api/patterns/daily`는 브라우저/PWA 캐시가 어제 응답을 재사용하지 않도록 `Cache-Control: no-store`를 명시한다.
- 클라이언트에서 패턴 데이터를 불러오는 fetch도 `cache: "no-store"`로 변경했다.
- 패턴 주제 선택 로직을 서버 로컬 시간이 아니라 KST 날짜 문자열 기준으로 변경했다.
- 기존 UTC/서버 로컬 시간 기준으로 잘못 저장된 오늘 캐시가 있으면, 수동 수정본이 아닌 경우 오늘 KST 기준 주제와 비교해 자동 재생성하도록 보정했다.

확인 결과:

- Turso `daily_patterns`에는 2026-05-20과 2026-05-21 모두 `daily_pattern_set`이 저장되어 있었다.
- 두 날짜의 JSON 해시는 서로 달랐으므로 완전히 같은 데이터는 아니었다.
- 다만 두 날짜의 topic이 모두 `Risk Management + Stakeholder Communication`으로 같았다.
- 원인은 기존 `topicForToday()`가 KST가 아니라 서버 로컬 시간 기준으로 주제를 고른 점으로 판단한다.

검증:

- `npm run lint` 통과
- `npm run build` 통과

남은 확인:

- 실제 iPhone/Safari 또는 설치형 PWA에서 상단 safe-area와 하단 내비게이션 터치감을 다시 확인한다.
- 배포 후 기존 서비스워커 캐시 때문에 이전 화면이 남으면 앱을 한 번 새로고침하거나 재설치 후 확인한다.

추가 보정:

- 설치형 PWA에서 스크롤된 콘텐츠가 iOS 상태바 아래로 지나가며 시계/배터리 영역과 겹치는 문제가 남아 있었다.
- `body`의 top padding만으로는 문서가 스크롤될 때 중간 콘텐츠가 상태바 뒤로 보이는 현상을 막지 못한다.
- `body::before`에 `env(safe-area-inset-top)` 높이의 fixed overlay를 추가해 상단 safe-area를 항상 앱 배경색으로 가리도록 보정했다.

## 18. 모바일 화면 전환 피드백 보강 (2026-05-21)

모바일에서 버튼이나 카드형 링크를 눌렀을 때 화면 전환이 느리면 클릭이 안 된 것으로 오해할 수 있어 전역 진행 표시를 추가했다.

수정 내용:

- `components/RouteProgress.tsx`를 추가했다.
- 내부 링크 클릭을 감지해 상단 진행바와 `화면을 여는 중...` 안내를 표시한다.
- 화면 경로가 바뀌면 진행 표시를 자동으로 닫는다.
- 비정상적으로 오래 남는 경우를 막기 위해 fallback timeout을 둔다.
- `app/loading.tsx`를 추가해 Next.js 라우트 로딩 중 전체 로딩 화면을 표시한다.
- `app/layout.tsx`에 `RouteProgress`를 전역으로 연결했다.

## 19. 현재 인계 상태 (2026-05-21, 최종 업데이트)

다른 컴퓨터에서 이어갈 때 기준:

- 현재 원격 `master` 최신 커밋: `b5d774d improve pattern generation quality and fix review timezone bug`
- GitHub 푸시 완료. Vercel 자동배포가 이 커밋 기준으로 트리거되어 있다.
- 작업 트리는 clean 상태다 (`git status` 확인).
- `linkedin-assets/`는 로컬 마케팅/LinkedIn용 파일이므로 Git 추적 제외 상태 유지.

### 오늘(2026-05-21) 한 작업 전체 요약

**오전/회사 작업 (커밋 5개)**

1. iOS 설치형 PWA 상태바 safe-area overlay 보정 (`body::before` fixed)
2. 로그인 화면에 Jobible BizEng 로고 교체
3. PWA 설치 안내(`PwaInstallPrompt`)를 로그인 화면으로 이동
4. 화면 전환 로딩 피드백 추가 (`RouteProgress`, `loading.tsx`)
5. agents.md 인계 메모 작성

**집 작업 (커밋 1개)**

6. 오늘의 패턴 자동 생성 품질 개선:
   - TOPICS를 5개 → 10개 행동형 문구로 확장 (10일 순환)
   - 시스템 프롬프트 필드별 지시문 구체화:
     - `usagePointKo`: 구체적 실전 상황 3개 콤마 구분
     - `shadowing.tipKo`: 강세/연음/핵심단어 형식 고정
     - `exercise.structure`: Situation/Action/Execution/Result 레이블 고정
     - `miniFocusKo`: 퀵 드릴 지시문 + 수행 목표
   - `review/page.tsx` 캘린더 타임존 버그 수정 (UTC → KST)
   - `CLAUDE.md` 폴더 구조 현행화

### 다른 컴퓨터에서 시작할 때

```bash
git pull origin master
# npm install은 package.json 변경이 있을 때만
# .env.local 없으면 .env.example 참고해서 생성
npm run dev
```

### 배포 상태

- Vercel Hobby 플랜, GitHub `master` 브랜치 자동배포 연결됨
- 배포 후 `/patterns` 화면에서 "다시 생성" 버튼으로 새 프롬프트 결과 확인 가능

### 다음 작업 후보

우선순위 순:

1. **모바일 실기기 테스트** — Vercel 배포 URL에서 iPhone/Safari 또는 설치형 PWA로 아래 항목 확인:
   - 로그인 화면 로고 + PWA 설치 안내
   - 상단 상태바 침범 여부 (safe-area overlay)
   - 화면 전환 로딩 표시
   - `/patterns` 화면에서 새 패턴 생성 품질 체감
   - 실전 면접 Realtime 연결
   - 면접 종료 후 종합 피드백
   - 답변 노트 저장
2. **프로필 수정 화면** (`/profile`) — 온보딩 이후 목표 포지션, 프로젝트 등 수정 기능
3. **iOS Safari 마이크 권한 플로우** 테스트

## 20. 모바일 터치 안정성 점검 (2026-05-23)

하단 네비게이션과 상단 뒤로가기 버튼이 몇 번 눌러야 반응하는 문제가 보고되어 터치 관련 전역 CSS와 라우트 전환 피드백을 점검했다.

분석:

- 화면을 가리는 명시적인 모달/팝업은 없었다.
- `* { touch-action: manipulation; }`가 모든 요소에 적용되어 있어, iOS Safari/PWA에서 스크롤 영역과 고정 하단 메뉴의 터치 판정에 불필요하게 개입할 수 있었다.
- safe-area 상태바 보정용 `body::before`가 `z-index: 2147483647`로 앱 전체 최상위 레이어에 올라와 있었다. `pointer-events: none`이긴 하지만, 모바일 Safari/PWA의 터치 hit-test 문제를 피하려면 이렇게 높은 z-index를 유지할 이유가 없었다.
- `RouteProgress`는 문서의 일반 click bubble 단계에서 링크 클릭을 감지했는데, Next.js `Link`가 먼저 처리하면 전환 피드백이 늦거나 누락될 수 있었다.

수정:

- 전역 `*`의 `touch-action: manipulation`을 제거하고, `button`, `a`, `summary`에만 유지했다.
- safe-area 보정용 `body::before`의 z-index를 낮췄다.
- `.bottom-nav`는 `z-index: 100`, `pointer-events: auto`, `translateZ(0)`를 명시해 모바일에서 별도 합성 레이어로 안정적으로 탭되게 했다.
- `.bottom-nav a`에도 `pointer-events: auto`를 명시했다.
- `RouteProgress`의 링크 감지를 capture 단계로 변경해 첫 탭 직후 화면 전환 피드백이 더 안정적으로 뜨게 했다.

검증 필요:

- 실제 iPhone Safari 또는 설치형 PWA에서 하단 네비게이션 5개 메뉴와 상단 뒤로가기 버튼을 반복 탭해 반응성을 확인한다.
- 특히 `/notes`, `/review`, `/stats`처럼 서버 데이터를 읽는 화면에서 첫 탭 후 전환 피드백이 바로 보이는지 확인한다.

## 21. 현재 인계 상태 (2026-05-25, 최종 업데이트)

다른 컴퓨터에서 이어갈 때 기준:

- 최신 `master` 커밋: `b5df67e docs: update CLAUDE.md — add Vercel auto-deploy note`
- GitHub 푸시 완료 → Vercel 자동배포 완료 (GitHub master 푸시 = 배포 완료, 별도 작업 불필요)
- 작업 트리는 clean 상태

### 배포 방식 확인

GitHub `master` 브랜치에 푸시하면 Vercel에서 자동으로 프로덕션 배포된다. 앞으로 별도 배포 명령은 필요하지 않다.

### 다른 컴퓨터에서 시작할 때

외장하드에 코드가 있으므로 `git pull`이 아니라 해당 경로에서 바로 실행한다.

```bash
# .env.local 없으면 .env.example 참고해서 생성
npm install   # package.json 변경이 있을 때만
npm run dev
```

### 2026-05-24~25 작업 전체 요약

**주말 요약 콘텐츠 (Weekly Summary)**

- `WeeklySummarySet` 타입, `WEEKLY_SUMMARY_SET_SCHEMA` — `lib/pattern-set.ts`
- `/api/patterns/weekly` — GET(캐시 조회/자동생성, `?date=YYYY-MM-DD` 히스토리 조회), POST(재생성 주 2회 제한)
- `WeeklySummaryCard`, `WeeklySummaryFetcher` 신규 컴포넌트
- 홈 화면: 평일→패턴 카드, 주말→주간 요약 카드
- `/patterns`: 평일→DailyView, 주말→WeeklyView
- `/review`: 에메랄드 점으로 주간 요약 표시, `WeeklyReviewCard`
- `/practice?source=weekly`: 리허설 질문 + 30초 답변 구조로 연습
- 캐시 키: 토요일 KST 날짜 (`daily_patterns` 테이블, `patternType="weekly_summary_set"`)

**비즈니스 영어 4개 시나리오**

- `lib/scenarios.ts` 신규: `ScenarioId`, `Scenario`, `buildSystemPrompt()`, `getOpeningInstruction()`
- 시나리오: `interview` / `executive_briefing` (CFO) / `cross_functional` (Head of Ops) / `global_team` (시니어 팀원)
- 각 시나리오별 Realtime 시스템 프롬프트 — 면접 중 코칭 없이 캐릭터 유지
- `/practice/interview`: 시나리오 선택 stage 추가 (2×2 그리드), 시나리오별 브리핑 화면

**주 3회 세션 가드레일**

- `lib/constants.ts`: `WEEKLY_SESSION_LIMIT = 3`
- `/api/realtime-token`: 토큰 발급 전 이번 주 면접 세션 수 체크, 초과 시 429 반환
- `/api/sessions?week=interview`: 주간 면접 횟수 조회 엔드포인트 신규
- 시나리오 선택 화면: "이번 주 N/3회 사용" 표시, 초과 시 카드 비활성화

**한국어 해석 tap-to-reveal**

- `RevealKo` 컴포넌트 신규 (`components/RevealKo.tsx`)
  - 기본: "해석 보기 ▾" 버튼만 표시
  - 탭 시: 한국어 번역 펼침 / 다시 탭 시 "접기 ▴"로 숨김
  - `text` prop이 없으면(구형 캐시 데이터) 렌더링 안 함
- `DailyPatternSet` 신규 필드: `exercise.questionKo`, `exercise.structure[].sentenceKo`
  - 기존 `meaningKo`(패턴 문장 번역)도 항상 표시 → tap-to-reveal로 전환
- `WeeklySummarySet` 신규 필드: `corePatterns[].sentenceKo`, `keyQuestionsKo[]`, `readySentencesKo[]`, `rehearsalQuestionKo`, `answerStructure[].sentenceKo`
- 적용 위치: `PatternSetCard`, `WeeklySummaryCard`, `/patterns` DailyView, `/patterns` WeeklyView
- **주의**: 기존 캐시 데이터는 Ko 필드가 없으므로 "해석 보기" 버튼이 안 보임. `/patterns`에서 "다시 생성"을 누르면 번역 포함 데이터로 교체됨

**기타 수정**

- 로그인 성공 후 전체 화면 로딩 오버레이 (`navigating` 상태, 스피너 + "홈 화면을 여는 중...")
- Next.js 개발 모드 N 아이콘 제거 (`devIndicators: false` in `next.config.ts`)
- `WEEKLY_SESSION_LIMIT`을 route 파일 export에서 `lib/constants.ts`로 이동 (Next.js route 파일은 HTTP 핸들러만 export 가능)
- Codex 코드리뷰 반영: weekly GET에 `?date=` 파라미터 + `isDateString()` 유효성 검사 추가

### 새로 생긴 파일

| 파일 | 역할 |
|---|---|
| `lib/scenarios.ts` | 4개 시나리오 정의 + Realtime 시스템 프롬프트 |
| `lib/constants.ts` | 공유 상수 (`WEEKLY_SESSION_LIMIT = 3`) |
| `app/api/patterns/weekly/route.ts` | 주간 요약 GET/POST API |
| `components/RevealKo.tsx` | 한국어 해석 tap-to-reveal 컴포넌트 |
| `components/WeeklySummaryCard.tsx` | 홈 화면 주간 요약 카드 |
| `components/WeeklySummaryFetcher.tsx` | 주간 요약 클라이언트 fetcher |

### 다음 작업 후보

1. **iOS 실기기 테스트** — iPhone/Safari 또는 설치형 PWA에서 전체 흐름 확인
2. **프로필 수정 화면** (`/profile`) — 온보딩 이후 목표 포지션, 프로젝트 등 수정 기능
3. **기존 캐시 데이터 Ko 필드 보완** — `/patterns`에서 "다시 생성" 으로 번역 포함 데이터 교체

## 22. 현재 인계 상태 (2026-05-28, 최종 업데이트)

다른 컴퓨터에서 이어갈 때 기준:

- GitHub `master` 푸시 = Vercel 자동배포 완료 (별도 작업 불필요)
- 작업 트리는 clean 상태

### 2026-05-27~28 작업 전체 요약

**TTS 기능 추가 (커밋 `91986a5`)**

- `app/api/tts/route.ts` 신규: OpenAI `tts-1` 모델, `nova` 음성, 속도 0.85, 텍스트 500자 제한, 응답 `Cache-Control: max-age=86400`
- 적용 위치: `/patterns` DailyView 패턴 문장, WeeklyView 핵심 패턴 문장, 홈 `PatternSetCard`
- `practice/page.tsx` 언마운트 시 MediaRecorder 정리 + fetch abort 추가
- `review/page.tsx` 주별 date 파라미터 practice 페이지로 전달

**소스 정리 (커밋 `a810999`)**

레거시 expressions 기능 완전 삭제:
- 삭제: `app/expressions/page.tsx`, `app/api/expressions/daily/route.ts`, `components/ExpressionCard.tsx`, `components/ExpressionCardFetcher.tsx`
- `app/patterns/page.tsx`에서 `/expressions` 링크 제거

**Codex 코드리뷰 반영 (커밋 `8392cac`, `최신 커밋`)**

- **P1 (iOS Safari TTS 재생 정책 대응)**: `idle → preparing → ready → playing` 4상태 머신으로 설계 변경.
  - 캐시 미스: 첫 탭 → TTS 음성 다운로드(preparing) → 준비 완료(ready, ▶ 표시) → 두 번째 탭에서 `audio.play()` 직접 호출. 두 번째 탭이 신규 사용자 제스처이므로 iOS Safari 자동재생 정책을 준수.
  - 캐시 히트: 첫 탭의 사용자 제스처 안에서 `await` 없이 `audio.play()` 직접 호출. 즉시 재생.
  - **실기기 검증 필요**: iPhone/Safari 또는 설치형 PWA에서 캐시 없는 패턴 첫 탭 흐름을 확인한 뒤 이 문서에 결과 기록 필요.
- **P2 (경쟁 상태 제거)**: 모듈 레벨 `activeFetchCtrl` (AbortController) + `activeSetState` 콜백. 다른 버튼 클릭 시 이전 버튼 fetch abort + UI idle 리셋. 준비 중 동일 버튼 재탭 무시. 취소된 요청 결과는 캐시에 저장하지 않음.
- **P3 (문서 현행화)**: agents.md 16절 라우트 목록 수정, CLAUDE.md DB patternType 값 수정.

**SpeakButton 상태별 UI**

| 상태 | 아이콘 | 의미 |
|---|---|---|
| idle | 🔊 | 탭하면 다운로드 시작 |
| preparing | 스피너 | TTS 음성 다운로드 중 |
| ready | ▶ (초록) | 준비 완료, 탭하면 재생 |
| playing | ⏹ (노랑) | 재생 중, 탭하면 중단 |
| error | ⚠ (빨강) | 실패, 1.5초 후 idle 복귀 |

**blob URL 캐시**

- 세션 캐시: text → objectURL, FIFO 30개 상한, 초과 시 `URL.revokeObjectURL()` 해제

### 다음 작업 후보

1. **iOS 실기기 TTS 테스트** — iPhone/Safari 또는 설치형 PWA에서 아래 흐름 확인 후 결과 기록:
   - 캐시 없는 패턴 첫 탭: preparing → ready → 두 번째 탭 → 재생
   - 캐시 있는 패턴 첫 탭: 즉시 재생
   - 다른 패턴 버튼 연속 탭: 이전 버튼 중단 + UI 리셋 확인
2. **프로필 수정 화면** (`/profile`) — 온보딩 이후 목표 포지션, 프로젝트 등 수정 기능
3. **기존 캐시 데이터 Ko 필드 보완** — `/patterns`에서 "다시 생성"으로 번역 포함 데이터 교체

## 23. 오늘의 패턴 로딩 및 버튼 클릭 점검 (2026-06-02)

오늘의 패턴을 계속 가져오지 못하는 현상과 앱 초기 구동 후 하단 버튼 클릭이 잘 안 되는 듯한 현상을 점검했다.

### 원인 확인

- Turso `daily_patterns`에는 2026-06-02 KST 기준 `daily_pattern_set` 캐시가 없었다.
- OpenAI Responses API 직접 호출 결과 `429 insufficient_quota`가 반환되었다.
- 이후 확인 결과 OpenAI API credit이 1년 만료로 0달러가 된 것이 원인이었다.
- Realtime 음성면접은 아직 실제 사용한 적이 없으므로 이번 credit 소모 원인에서는 제외한다.
- 로컬 테스트 중 Turso 조회가 sandbox/network 조건에서 `fetch failed`로 실패할 수 있음을 확인했다. 기존 `/api/patterns/daily`는 DB 조회 실패가 fallback 전에 500으로 터질 수 있었다.

### 수정 내용

- `app/api/patterns/daily/route.ts`
  - OpenAI 패턴 생성 fetch에 25초 timeout을 추가했다.
  - OpenAI 오류 코드를 서버 로그에 간단히 남기도록 변경했다.
  - DB 캐시 조회, OpenAI 생성, fallback 저장 중 어느 단계가 실패해도 클라이언트에는 최소 비상 패턴을 반환하도록 변경했다.
  - OpenAI/Turso가 실패해도 오늘의 패턴 화면과 홈 카드가 빈 상태로 무너지지 않게 했다.
- `lib/pattern-set.ts`
  - `DailyPatternSet.source`에 `"fallback"`을 추가했다.
- `components/RouteProgress.tsx`
  - 라우트 전환 표시의 z-index를 `2147483646`에서 `120`으로 낮췄다.
  - `pointer-events-none`은 유지했지만, 모바일 Safari/PWA hit-test 부담을 줄이기 위해 과도한 최상위 레이어를 피했다.
- `app/login/page.tsx`
  - 로그인 후 홈 이동 overlay가 12초 이상 지속되면 overlay를 해제하고 재시도 안내를 보여주도록 변경했다.
  - 초기 구동 중 클릭이 안 되는 것처럼 느껴지는 상황을 줄이기 위한 보정이다.

### 검증 결과

- `npm.cmd run lint` 통과
- `npm.cmd run build` 통과
- `next start` 조건에서 `/api/patterns/daily`가 Turso 접근 실패 상황에서도 `200`, `source=fallback`, `patterns=3`을 반환하는 것을 확인했다.
- `next start`의 production 모드에서는 `secure` 쿠키 때문에 HTTP localhost 로그인 세션 재사용이 안 될 수 있다. 실제 Vercel HTTPS에서는 정상 조건이다.

### 집에서 이어서 확인할 것

1. OpenAI credit 복구 후 Vercel 배포 URL에서 `/patterns`의 `다시 생성`을 눌러 `source=openai` 패턴이 정상 생성되는지 확인한다.
2. Vercel logs에서 `/api/patterns/daily`가 더 이상 반복적으로 500을 내지 않는지 확인한다.
3. iPhone Safari 또는 설치형 PWA에서 초기 앱 구동 직후 아래 버튼을 반복 탭해 반응성을 확인한다.
   - 하단 메뉴: 홈, 면접, 답변 노트, 복습, 통계
   - 홈의 `음성 실전 면접 시작`
   - 홈/패턴 카드의 `자세히`, `말하기`
   - `/patterns` 뒤로가기, `이 패턴으로 말하기`, `수정`, `다시 생성`
4. 클릭이 여전히 불안정하면 다음 후보를 추가로 본다.
   - service worker가 예전 JS/CSS를 잡고 있는지 확인 후 PWA 재설치 또는 강제 새로고침
   - `RouteProgress` 자체를 임시 비활성화하고 반응 차이 비교
   - 하단 내비게이션을 별도 client component로 분리해 hydration 전후 반응 차이 확인
   - iOS Safari에서 `body::before` safe-area overlay가 실제로 hit-test에 관여하는지 다시 확인

### 현재 주의

- fallback 패턴은 비상용이다. OpenAI credit이 복구되면 `/patterns`에서 `다시 생성`으로 실제 오늘 패턴을 다시 만들어야 한다.
- Realtime 음성면접 비용은 아직 실제 사용 이력이 없으므로 이번 credit 문제의 주요 원인으로 보지 않는다.

## 24. 화면 전체 점검 및 버그 수정 (2026-06-02)

OpenAI credit 복구 확인 후 전체 화면을 점검하고 발견된 문제를 수정했다.

### 수정 내용

**프로필 수정 화면 신규 (`app/profile/page.tsx`)**

- 온보딩 이후 목표 포지션·경력·프로젝트·걱정 상황·집중 영역을 수정할 수 있는 단일 스크롤 폼
- 기존 데이터를 GET /api/profile로 불러와 미리 채움
- 프로젝트 추가(최대 2개)/삭제 지원, 필수 필드 미입력 시 저장 버튼 비활성화
- 홈 헤더 오른쪽에 ⚙️ 버튼 추가 → `/profile` 진입

**복습 화면 캘린더-목록 연동 (`app/review/page.tsx`)**

- `?month=YYYY-MM` 쿼리 파라미터로 선택 월 관리, 기본값은 현재 KST 월
- DB 쿼리를 선택 월만 필터링하도록 변경 (기존: 전체 60개 고정)
- 캘린더 헤더에 ← → 월 이동 버튼 추가, 미래 월 비활성화
- 데이터 있는 날짜 셀을 `<a href="#date-YYYY-MM-DD">` 앵커 링크로 변경, 탭하면 해당 카드로 스크롤
- 오늘 날짜 인디고 링 표시

**통계 화면 버그 수정 (`app/stats/page.tsx`)**

- 실전 면접 카드에서 `worstAnswer`(가장 위험했던 답변)가 DB에 있는데도 미표시 → 추가
- `keyExpressions`(바로 쓸 수 있는 표현 3개)도 미표시 → 추가
- "30초 연습" → "질문 연습"으로 용어 통일

**실전 면접 카운터 버그 수정 (`app/practice/interview/page.tsx`)**

- 헤더의 `N/4` 카운터가 AI 발화(인사말 포함) 기준이어서 면접 시작 직후 `1/4`가 되는 문제
- 사용자 답변 기준으로 변경: `0/4 답변` → 답변할 때마다 증가
- 종료 트리거도 동일하게 사용자 답변 4회 기준으로 수정

**연습 화면 버그 수정 (`app/practice/page.tsx`)**

- `saveToNotes()` 실패 시 에러 처리 없이 "저장됨 ✓"이 표시되는 버그 수정
- 저장 실패 시 빨간 에러 메시지 표시, retry() 시 에러 초기화
- 데이터 로딩 실패 시 `stage`가 "loading"으로 고정되어 스피너+에러가 동시에 보이는 문제 수정 → `setStage("idle")` 호출

### 다음 작업 후보

1. **iOS 실기기 테스트** — iPhone Safari 또는 설치형 PWA에서 TTS, 터치 반응성, 실전 면접 Realtime 연결 확인
2. **기존 캐시 Ko 필드 보완** — `/patterns`에서 "다시 생성"으로 번역 포함 데이터 교체
3. **실전 면접 추가 개선** — 면접 종료 시 시나리오 정보 저장(현재 미저장), 면접 중 사용자 발화 전사 누락 예외 처리

## 25. 2026-06-04 세션 인계

### 오늘 한 작업

**Codex 작업 내용 파악 및 미커밋 변경사항 정리**

- Codex가 `agents.md` 기술 상세 내용을 `docs/technical-status.md`로 분리한 것 확인 후 커밋
- `agents.md` BOM 문자 제거
- `.gitignore`에 `dev-server.*.log` 추가
- Codex가 추가한 `playwright` devDependency 롤백 (테스트 파일 없이 설치만 된 상태)
- 커밋: `85816b8 refactor: agents.md 문서 분리, 면접 ephemeral key 순서 수정`

**음성 실전 면접 iOS 버그 수정 (커밋 `4826ab6`)**

3가지 버그를 동시 수정했다:

1. **모델명 오류** — `gpt-realtime`은 존재하지 않는 모델명. `gpt-4o-mini-realtime-preview`로 변경 (이후 `dadc939`에서 mini로 재변경)
2. **iOS Safari 오디오 차단** — `new Audio()`는 DOM 밖 생성이라 iOS 자동재생 정책에 차단됨. JSX에 `<audio ref={audioRef} autoPlay playsInline className="hidden" />`을 connecting/interviewing 화면에 실제 렌더링, `startInterview()` 탭 시 `play()`로 iOS 오디오 잠금 해제
3. **useEffect cleanup 버그** — stage가 connecting→interviewing로 전환될 때 cleanup이 RTCPeerConnection을 닫는 버그. `connectedRef`로 가드 추가. connecting→interviewing 전환 시 audio srcObject 재연결 useEffect도 추가

**Realtime 모델 mini로 변경 (커밋 `dadc939`)**

- `gpt-4o-realtime-preview` → `gpt-4o-mini-realtime-preview` (약 4배 저렴)
- 환경변수 `OPENAI_REALTIME_MODEL` 설정 시 override 가능
- 품질 체감 후 부족하면 Vercel 환경변수에 `OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview` 추가해서 전환

### 집에서 이어서 할 것

**필수 확인 (iPhone Safari 또는 설치형 PWA)**

1. 실전 면접 흐름 전체 테스트
   - 시나리오 선택 → 브리핑 → 시작 탭 → "연결 중..." → 면접 진행 → AI 음성 들림 확인
   - 사용자 발화가 텍스트로 표시되는지 확인
   - 4회 답변 후 자동 종료 → 피드백 화면 표시 확인
2. TTS 버튼 테스트 — `/patterns` 화면에서 🔊 탭 → preparing → ready → 재탭 → 재생
3. 하단 메뉴 터치 반응성 — 홈/면접/노트/복습/통계 5개 메뉴

**다음 작업 후보**

1. **iOS 실기기 결과 기록** — 위 테스트 결과를 이 문서에 업데이트
2. **기존 캐시 Ko 필드 보완** — `/patterns`에서 "다시 생성"으로 번역 포함 데이터 교체
3. **실전 면접 추가 개선** — 면접 종료 시 시나리오 정보 저장, 사용자 발화 전사 누락 예외 처리
4. **mini 모델 품질 평가** — 면접 후 품질 부족하면 `OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview`로 전환

### 현재 배포 상태

- GitHub `master` 최신 커밋: `dadc939`
- Vercel 자동배포 완료 (GitHub push = 배포 완료)
- 작업 트리 clean 상태

### 집에서 시작할 때

```bash
# 외장하드 경로에서 바로 실행
# .env.local 있는지 확인 (.env.example 참고)
npm run dev
```
