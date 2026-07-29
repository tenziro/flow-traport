# 개발 이력

flow Cockpit의 개발 기록이다. 아래 두 부분으로 나뉜다.

- **기능 현황** — 지금 무엇이 있는지. 큰 기능이 들어오면 해당 절을 갱신한다.
- **변경 이력** — 무엇이 언제 어떻게 바뀌었는지. 최신이 맨 위다.

사용자에게 보여 줄 요약은 `src/lib/changelog.ts`다. 이 문서가 상류고 그쪽이 하류다 —
여기 적힌 것 중 화면에 보이는 변화만 사용자 말로 옮긴다.

유형 태그: `기능` 새로 생긴 것 · `수정` 잘못된 것을 바로잡음 · `개선` 되던 것을 더 낫게 ·
`문서` 문서만 · `인프라` 빌드·의존성·설정.

---

## 기능 현황

### 화면

| 경로 | 무엇 | 상태 |
|------|------|------|
| `/login` | flow OAuth 로그인 + 개인 API 키 등록 모달 | 운영 |
| `/` (오늘) | 임박·밀림·포커스·방치 업무, 나를 부른 사람들, 오늘 일정, 요약 카드 4칸 | 운영 |
| `/risk` | 프로젝트별 위험도 보드, 프로젝트에 업무 추가 | 운영 |
| `/team` | 부서 탭, 팀원별 업무 현황, 팀 일정 | 운영 |
| `/tasks` (내 업무) | PRD §6.5 설계만 있음 | Phase 6 예정 |

### 화면 안 기능

- **업무 바꾸기 모달** — 상태·마감일·우선순위·담당자를 flow로 나가지 않고 고친다.
  담당자는 여러 명을 켠다.
- **댓글** — 멘션 댓글 전문을 읽고 그 자리에서 남긴다.
- **업무 소식(종)** — 알림을 전체·안 읽음·읽음으로 나눠 보고, 한 줄을 누르면 flow 문서로
  가면서 읽음이 된다.
- **빠른 검색(⌘K)** — 프로젝트와 글을 찾아 flow 문서로 넘어간다.
- **화면 밝기** — 밝게·어둡게·기기 설정 세 갈래. 첫 HTML에 박아서 번쩍임이 없다.
- **업데이트 로그** — 푸터 버튼 → 모달에서 버전별로 접어 본다.

### 데이터

- flow **MCP**가 주 통로다. 로그인 사용자의 OAuth 토큰으로 부른다.
- flow **REST**는 MCP에 없는 것만 채운다 (게시글 상세·검색·상태 컬럼 등, Tier A·B).
  분당 120회 제한.
- 개인 **API 키**는 암호화해 쿠키에 둔다. 공용 키로는 남의 멘션이 섞여 보인다.

### 플랫폼

- Next.js 16 App Router · React 19 · Tailwind v4 · Motion · beUI(vendoring) · Reicon.
- 색은 `globals.css`의 `light-dark()` 토큰 한 벌. 컴포넌트에 raw hex 금지 (PRD §7.1).
- 유닛 테스트는 `node:test`. 현재 84건.

---

## 변경 이력

### 2026-07-29 — 화면 톤·모서리·간격 정리 (v0.21.0)

`개선` 두 밝기의 색을 다시 잡고, 알약 모양을 걷어내 모서리를 카드 기준 8px 한 계열로
맞췄다. 카드 사이·제목 아래 간격도 넓혔다. 업무 소식은 업무명이 제목 자리로 올라오고
목록 맨 아래에 전체 건수가 붙는다.

- **밝게** = 흰색·검정·무채색 회색. 회색에 색기가 있으면 흰 카드와 나란히 놓일 때 그
  기울기가 얼룩으로 보인다. 강조 자리는 검정이 맡는다.
- **어둡게** = 짙은 남색 표면 3단(배경 `#151c2c` < 카드 `#1c2537` < 팝오버 `#222d42`) +
  파랑 액센트. 카드가 배경 위에 떠 있는 게 그림자 없이 읽힌다.
- 두 테마가 같은 액센트를 쓰지 않는다. 어둡게의 파랑을 흰 바탕에 그대로 올리면 대비가
  3:1대로 떨어지고, 읽히는 데까지 내리면 남색으로 탁해진다.
- 상태색(위험·주의·완료·요청·보류)만은 양쪽 다 유색이다. 거기서는 색이 정보를 나른다.
- `--radius`를 8px로 두고 카드를 `rounded-lg`로 내렸다. 배지·탭·입력·버튼의
  `rounded-full`은 `rounded-md`(6px)로. 지름=높이인 원형(점·아바타·카운터 배지)은 그대로다.
- 모달 패널 30px → 8px. clip-path의 `round`도 같이 내렸다 — 안 맞추면 모서리에서 테두리가
  잘려 실루엣만 남아 테두리가 두 겹으로 보인다. 업데이트 로그 아코디언도 28px → 8px.
- 관련: `src/app/globals.css`, `src/app/layout.tsx`(theme-color), `src/components/ui/card.tsx`,
  `ui/badge.tsx`, `motion/button/base.tsx`, `motion/input.tsx`, `motion/animated-badge.tsx`,
  `motion/center-morph-modal.tsx`, `motion/bouncy-accordion.tsx`, `motion/tabs.tsx`,
  `dept-tabs.tsx`, `news-bell.tsx`, `status-pill.tsx`, `status-filter.tsx`, `task-item.tsx`,
  `task-actions.tsx`, `theme-toggle.tsx`, `date-field.tsx`, `new-task-form.tsx`,
  `site-footer.tsx`, `app-shell.tsx`, `app/(app)/page.tsx`, `risk/page.tsx`, `team/page.tsx`

### 2026-07-29 — 상태·우선순위도 pill로 고른다

`개선` 바꾸기 모달의 드롭다운을 걷어냈다. 후보가 다섯·넷인데 목록을 접어 두면 무엇을
고를 수 있는지 알려면 한 번 더 눌러야 했다. 담당자만 여럿이라 `checkbox`, 상태·우선순위는
`radio`다. 마감일만 pill이 아니다 — 후보가 365개다.

- 관련: `src/components/task-actions.tsx`

### 2026-07-29 — 바꾸기 모달 네 줄을 펼치면 아래로 쌓는다

`개선` 한 줄을 나눠 쓰던 때는 지금 값 글자 수만큼 컨트롤이 오른쪽으로 밀려서 세 줄이
저마다 다른 x에서 고르기를 시작했다. 이제 어느 줄을 펼쳐도 지금 값·컨트롤·저장이 같은
자리에 온다.

- 관련: `src/components/task-actions.tsx`

### 2026-07-29 — 바꾸기 모달 정돈과 담당자 여러 명

`수정` 담당자를 여러 명 켠다. flow API는 처음부터 배열을 받았는데 서버 액션이 한 명으로
좁히고 있어서, 이 화면에서 담당자를 건드릴 때마다 공동 담당이 조용히 떨어졌다. 머리·본문·
바닥을 경계선으로 가르고 `닫기`를 바닥 오른쪽으로 옮겼다.

- 관련: `src/components/task-actions.tsx`, `src/app/(app)/actions.ts`,
  `src/components/ui/calendar.tsx`

### 2026-07-29 — 카드 지표 힌트를 radix tooltip으로

`개선` `title` 속성 대신 저장소에 이미 있던 `ui/tooltip.tsx`를 쓴다. native tooltip은
지연을 못 정하고 모양도 브라우저가 정해서 다른 힌트와 안 맞았다. `asChild`로 기존 span을
트리거로 써서 탭 정지점을 늘리지 않는다.

- 관련: `src/components/stat-hint.tsx`, `src/app/(app)/risk/page.tsx`, `team/page.tsx`

### 2026-07-29 — 푸터와 업데이트 로그 모달

`기능` 페이지 바닥에 푸터를 두고 왼쪽에 제품명·현재 버전·한 줄 소개, 오른쪽에 업데이트
로그 버튼을 놓았다. 로그는 `CenterMorphModal` 안에서 `BouncyAccordion`으로 버전별로 접힌다.
데이터는 `src/lib/changelog.ts` 상수 배열이고, 맨 앞이 `package.json` 버전과 어긋나면
테스트가 막는다 — 푸터의 버전 표기가 거짓말을 할 수 없다.

- 768px 미만은 하단 탭과 자리를 다퉈 감춘다. 탭바를 피하는 `pb-20`을 `main`에서 `footer`로
  옮겼다.
- 모달 제목 줄에 구분선을 뒀다. 아래가 스크롤 박스라 목록을 내리면 행이 제목 밑까지
  올라오는데, 스크롤 박스의 위쪽 패딩은 내용과 같이 밀려 올라가서 그 겹침을 못 막는다.
- 관련: `src/components/site-footer.tsx`, `src/lib/changelog.ts`,
  `src/lib/changelog.test.ts`, `src/components/app-shell.tsx`

### 2026-07-29 — 요약 카드 세 화면 정렬·업무 줄 hover 정리 (v0.20.3)

`개선` 리스크·팀 화면 맨 위 요약 카드가 오늘 화면과 달랐다 — 라벨 앞 아이콘이 없고 숫자가
4px 작았다. `Kpi`에 `Icon`을 필수 prop으로 넣었다(옵션이면 호출부 여덟 곳 중 하나를
빼먹어도 조용히 통과한다). 업무 줄·멘션 줄의 hover 배경도 뺐다 — 줄 자체를 누를 수 없는데
배경이 바뀌면 눌리는 것으로 읽힌다.

- 관련: `src/components/kpi.tsx`, `src/app/(app)/risk/page.tsx`, `team/page.tsx`,
  `src/components/task-item.tsx`, `src/components/icons.tsx`

### 2026-07-29 — 멘션 줄 상태 배지 (v0.20.2)

`수정` 나를 부른 사람들의 상태 배지가 17줄 중 12줄에서 비어 있었다. 조인 키가 아니라
모집단이 문제였다 — 화면이 이미 받아 둔 네 목록은 전부 담당 + 공개 + 진행률 100 미만만
담는데, 멘션은 관계자로만 걸린 업무에도 온다 (BUG-028). 게시글 상세에서 직접 읽어
17/17을 채웠다.

- 평면 `tasks[0].STTS`는 쓰지 않는다: 커스텀 상태 프로젝트에서도 오는데 안 쓰는 컬럼이라
  항상 "0"이다. `TASK_COLUMN_REC`의 `STATUS.OPTION_NAME`을 먼저 본다.
- 남은 것: `STATUS_TONE`에 `대기` 키가 없어 대기 배지는 회색이다. `listStaleTasks`도 STTS
  코드를 라벨로 못 바꾼다.
- 관련: `src/lib/flow/queries.ts`, `src/lib/flow/rest.ts`, `src/components/status-pill.tsx`

### 2026-07-29 — 업무 바꾸기 모달·모바일 카드 폭 (v0.20.0 / v0.20.1)

`기능` 업무 편집을 모달로 올렸다(beUI center-morph-modal). 행 안에서 펼치던 때는 업무가
열 줄인 화면에서 목록이 통째로 밀려 내려갔다. 고르기는 브라우저 기본 select로 뒀다 —
모달 패널이 clip-path로 자기 네모를 잘라서 beUI Select가 안 보인다.

`수정` 모바일에서 카드가 화면을 넘던 것(390px에서 scrollWidth 443)은 카드가 아니라 격자
열이 원인이었다. `xl:grid-cols-12`만 적으면 좁은 화면 열이 `auto`라 내용 최소폭이 화면을
밀어낸다. 격자 넷에 `grid-cols-1`, 댓글 본문 셋에 `wrap-anywhere` (BUG-025).

`문서` 내 업무 화면(`/tasks`) 설계를 PRD §6.5에 썼다. 오늘 화면이 보여 주는 내 담당 업무가
16건인데 실제로는 880건이라는 실측에서 나왔다. 실측이 문서 넷을 정정했다 — REST는 분당
120회, 완료 판정은 `optionCategory == "2"`, 상태 컬럼은 STTS·STATUS 둘, `connectUrl`은
880건 전부 빈 문자열.

- 관련: `src/components/task-actions.tsx`, `src/components/motion/center-morph-modal.tsx`,
  `docs/PRD.md`

### 2026-07-29 — 소식 레이어 재설계 + 검색 팔레트 (v0.16.0 ~ v0.19.0)

`기능` v0.15.0의 소식 종을 네 번에 걸쳐 고쳐 쓰고 검색을 레이어로 얹었다.

- **v0.16.0 소식에서 바로 이동** — v0.15.0에 "알림 응답으로는 딥링크를 못 만든다"고 적은 건
  틀렸다 (BUG-022). 못 만드는 건 워크리스트의 불투명한 단축 URL이고, 게시글 딥링크는 id
  두 개로 조립된다. 카드를 링크로 바꾸면서 beUI 스택 바깥 `<button>`을 벗겼다.
- **v0.17.0 소식 한 줄에 제목** — "아무개님의 댓글 등록"만 나오던 줄에 프로젝트·업무명·내용·
  작성자를 나눠 붙였다.
- **v0.18.0 목록 정비** — 접기 버튼을 걷어내고 전체·안 읽음·읽음 탭으로 나눴다. 목록만
  스크롤해서 탭과 전체 읽음은 늘 손에 닿는다. beUI Notification Stack도 이때 물렸다.
- **v0.19.0 빠른 검색(⌘K)** — 프로젝트와 글을 찾아 flow 문서로 넘어간다.
- 관련: `src/components/news-bell.tsx`, `src/lib/flow/queries.ts`

### 2026-07-29 — REST 확장 Tier A·B + 밝기 세 갈래 (v0.15.0)

`기능` MCP에 없는 것을 REST로 채웠다(게시글 상세·검색·상태 컬럼 등). 댓글 전문과 오늘
일정을 화면에서 보고, 업무 마감일·담당자를 flow로 나가지 않고 고친다. 화면 밝기는
밝게·어둡게·기기 설정 세 갈래고, 첫 HTML에 박아서 번쩍임이 없다.

- 관련: `src/lib/flow/rest.ts`, `src/lib/theme.ts`, `src/components/theme-toggle.tsx`

### 2026-07-28 — og 공유 카드 (v0.14.0)

`기능` 슬랙·카카오톡에 링크를 붙이면 주소만 나왔다. 로고와 화면 색이 담긴 1200×630
미리보기 카드를 붙였다. `metadataBase`는 `FLOW_REDIRECT_URI`에서 origin만 떼어 쓴다 —
그 값은 flow OAuth 클라이언트에 등록한 주소와 한 글자도 다를 수 없어서 이 앱이 실제로 서
있는 주소의 유일한 진실이다.

- 관련: `src/app/layout.tsx`, `public/og.png`

### 2026-07-28 — 개인 flow API 키 등록 모달 (v0.13.0)

`기능` 공용 키로 로그인하면 다른 사람의 멘션과 댓글이 섞여 보였다. 처음 로그인할 때 개인
키를 한 번 등록하고, 암호화해서 이 브라우저에만 둔다. 키는 필수다 — 건너뛰게 두면 멘션
본문이 빈 화면으로 로그인되는데 사용자는 로그인이 된 줄 알아서 왜 비었는지 못 찾는다.

- 관련: `src/app/login/api-key-gate.tsx`, `src/app/login/actions.ts`

### 2026-07-28 — 멘션 줄 상태·프로젝트명, pill 컨트롤, 접기 애니메이션 (v0.12.4)

`개선` 로그인 화면을 사진과 입력 칸으로 나누고 로고·제목·설명·버튼이 차례로 나타나게 했다.
나를 부른 사람들 목록에 업무 상태와 프로젝트 이름을 넣고, 접고 펼치는 목록에 스프링을
붙였다.

- 관련: `src/app/login/page.tsx`, `src/components/task-item.tsx`,
  `src/components/motion/bouncy-accordion.tsx`

### 2026-07-28 — 헤더 사용자 영역 정리 (v0.9.4)

`개선` 오른쪽 위 이름과 로그아웃이 같은 색·같은 크기라 어디를 눌러야 할지 헷갈렸다. 이름
앞에 동그란 이니셜을 넣고 로그아웃은 아이콘과 함께 눌러야 할 자리로 보이게 바꿨다.

- 관련: `src/components/app-shell.tsx`

### 2026-07-28 — flow Cockpit 첫 공개 (v0.9.3)

`기능` flow에 흩어진 업무 가운데 지금 챙길 것만 모아 보는 오늘 화면을 열었다. 업무 상태
바꾸기·댓글 남기기·업무 만들기를 화면 안에서 한다. 리스크 보드와 팀 화면도 함께 열었다.
flow OAuth 로그인, MCP 통로, 인증 게이트(`proxy.ts`)가 이때 섰다.

- 관련: `src/app/(app)/`, `src/lib/flow/`, `src/proxy.ts`, `docs/PRD.md`

### 2026-07-27 — 저장소 개설

`인프라` Next.js 16 App Router · React 19 · Tailwind v4 골격.

---

## 화면에 안 나간 배포

`src/lib/changelog.ts`는 화면에 보이는 변화만 담는다. 아래는 그래서 빠진 것들이다.

| 버전 | 무엇 | 왜 안 나가나 |
|------|------|--------------|
| v0.20.1 | 내 업무 화면 PRD | 문서만 |
| v0.18.1 | 소식 개수 조정 | 근거 없이 되돌림 |
| v0.14.1 | flow API 조사 | 조사만 |
| v0.12.5 | pretendard 의존성·Vim 스왑 파일 정리 | 화면 변화 없음 |
