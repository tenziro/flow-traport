# 개발 진행 상황

버전 0.22.0 · 2026-07-29 기준. 로드맵 정의는 [PRD.md](PRD.md) §11에 있다.

## 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| 0 | flow API·MCP 실측, 인증 경로 확정 | 완료 |
| 1 | 오늘 화면 (읽기 전용) | 완료 |
| 2 | 쓰기 액션 (상태·댓글·업무 생성) | 완료 |
| 3 | 리스크 보드 | 완료 |
| 4 | 팀 화면 | 완료 |
| 5 | REST 확장 (Tier A·B) | 완료 (Tier C는 안 한다) |
| 6 | 내 업무 화면 (`/tasks`) | **설계만** — PRD §6.5, 구현 전 |

기능은 다 붙었다. **아직 실제로 쓰기 도구를 한 번도 호출하지 않았다** — 검증 안 된
가정이 하나 남아 있다 ([bug-report.md](bug-report.md) BUG-005).

Phase 2에서 빠져 있던 알림 읽음 처리는 v0.15.0에서 REST 경로로 붙었다 (Tier A2).

---

## Phase 0 — 조사 (완료)

MCP 45종·쓰기 18종 노출 확인, OAuth 2.1 DCR + PKCE 흐름 실측, REST `/user/*`가
**인증 주체 고정**이라 회사 단위 대시보드를 만들 수 없다는 것 확인. 그 결과 데이터 경로가
REST → **MCP**로 뒤집혔다 (PRD §5.1, §5.2). REST 스펙은 [api-spec.md](api-spec.md)에
참고용으로 남겼다.

## Phase 1 — 오늘 화면 (완료)

### 인증

| 파일 | 역할 |
|------|------|
| [src/lib/auth.ts](../src/lib/auth.ts) | OAuth 2.1 + PKCE, AES-256-GCM 세션 봉인 (Web Crypto만), 개인 API 키 쿠키 |
| [src/proxy.ts](../src/proxy.ts) | 로그인 게이트 + 액세스 토큰 자동 갱신 |
| [src/app/api/auth/](../src/app/api/auth/) | login / callback / logout |
| [src/app/login/](../src/app/login/) | 로그인 화면 + 개인 API 키 등록 (최초 1회 모달) |

토큰은 브라우저에 절대 나가지 않는다. `httpOnly` 봉인 쿠키에만 둔다 (PRD §8.1).
로그인 직후 이메일 도메인이 `@traport.com`인지 확인하고, 아니면 세션을 만들지 않는다.
로그인을 시작하기 전에 개인 flow API 키를 한 번 받는다 — 이유는 [다중 사용자](#다중-사용자--개인-api-키를-받는다-v0130)에 있다.

### 데이터

[src/lib/flow/queries.ts](../src/lib/flow/queries.ts)가 MCP 응답을 화면 타입으로 옮긴다.

| 블록 | 도구 |
|------|------|
| 상단 요약 · 밀리는 업무 · 멘션 | `flow_get_my_worklist` (`format: structured`) |
| 오늘의 포커스 | `flow_suggest_my_focus` |
| 방치된 업무 | `flow_get_my_worklist` (`overdueActiveDays: 180`) − 기본 30일 창 |

- 보조 도구(포커스·방치)는 실패하면 `null`로 흘린다. 한 도구가 죽어도 화면은 선다 —
  `flow_list_alarms`가 실제로 그렇게 죽는 걸 봤다 ([bug-report.md](bug-report.md) BUG-001).
- **분류는 MCP가 한다.** worklist 응답에 `progress`·`lastActivityAt`이 없어서
  `lib/aggregate/classifyTasks`로 재분류할 재료가 없다. 우리가 하는 집계는 멘션 접기 하나뿐이다.
- `classifyTasks` / `scoreFocus` / `scoreProjectRisk`는 결국 안 썼다. Phase 3에서 쓴 건
  `scoreProjectRisk`의 `RISK_WEIGHTS` · `gradeOf` · `RISK_GRADE_LABEL` 셋뿐이다. 나머지는
  아직 지우지 않았다 — `StatusBadge`가 `classifyTasks`의 `TaskCategory` 타입을 물고 있다.

### 화면

[src/app/(app)/page.tsx](<../src/app/(app)/page.tsx>) — 요약 4칸 · 오늘의 포커스 5건 ·
방치된 업무 · 밀리는 업무 · 나를 부른 사람들(접기).

- 멘션 접기 실측: **28건 → 14행**. 병합 키는 `link` (PRD §6.1.2).
- 접기/펼치기는 `<details>` 네이티브. 이것 때문에 클라이언트 컴포넌트를 만들지 않았다.
- 마감은 `D-2` / `D+24`처럼 부호를 붙인다 — 색 없이도 읽혀야 한다.

#### 멘션 댓글 본문 (07-28 추가)

펼쳐도 발신자·시각만 보이고 **댓글 내용이 하나도 없었다**. 원인은 단순하다 —
`flow_get_my_worklist.mentions`가 `{from, title, at, link}`만 준다. 본문이 응답에 없다.

MCP 경로를 전부 짚어봤고 전부 막혔다:

| 도구 | 결과 |
|------|------|
| `flow_get_post` | 동작하지만 `postId`가 필요하다. worklist는 `taskSrno`만 준다 (다른 ID 공간, BUG-005) |
| `flow_list_alarms` | 서버측 스키마 검증에서 죽는다 (BUG-001) |
| `flow_collect_project_chain` | 모든 입력에서 권한 오류 (BUG-011) |
| `flow_suggest_my_focus` | `lastComment`는 주는데 `postId`가 없다 |
| tinyUrl 직접 해석 | 웹 세션 쿠키가 필요하다 (BUG-011) |

**남은 하나가 REST `GET /user/alarms`다** ([src/lib/flow/rest.ts](../src/lib/flow/rest.ts)).
`content`(댓글 본문)·`registerName`(실명)·`replyId`를 함께 준다. 데이터 경로는 MCP로
일원화했지만(§Phase 0) **알림만 예외**로 뒀다 — 다른 길이 없다.

- 조인 키는 `발신자 ID + 등록 일시`. worklist가 `postId`를 안 줘서 그걸로는 못 묶는다.
- 화면에서 발신자를 **실명**으로 바꾼다 (`djseo7` → `서동조`). 알림 쪽만 실명을 준다.
- `replyId !== "-1"`이면 답글 — 한 칸 들여쓰고 말풍선 아이콘 색을 바꾼다 (아래
  "본문 · 댓글 · 답글 단 나누기").
- 오래된 것부터 위에서 아래로 정렬한다. 대화는 그렇게 읽는다 (`groupMentions`는 최신순으로
  정렬하므로 렌더 직전에 뒤집는다).
- 토큰은 **세션의 OAuth 액세스 토큰**을 쓴다. `.env`의 `FLOW_API_KEY`는 발급자 한 명의
  알림만 돌려줘서, 그걸 쓰면 로그인한 모든 사람에게 같은 사람의 멘션이 보인다.
- 실패하면 `.catch(() => null)`로 흘린다. 본문만 빠지고 행은 그대로 뜬다.

**한계 두 개** (숨기지 않고 화면 주석에 적어 뒀다):

1. **본문은 ~120자에서 서버가 자른다.** 전문은 flow 링크로 보낸다.
2. **진짜 트리는 못 만든다.** 부모 댓글은 나를 멘션하지 않았으면 알림에 안 온다.
   게시글 상세로 받아오는 것도 막혀 있다 — `remarkCount: 14`인데 `remarks`는 2건이고
   페이징 단서가 없다 (BUG-012). 그래서 깊이 표시까지가 정직한 선이다.

### 디자인

다크 단일 테마로 전환했다 (근검정 `#0A0B09` + 라임 `#C7F751`). 토큰만 갈아끼웠고
컴포넌트는 손대지 않았다 — 전부 시맨틱 토큰만 쓰고 있었기 때문이다. PRD §7.1 갱신.
v0.15.0에서 여기에 밝기 두 벌이 붙었다 (아래 [밝기 세 갈래](#밝기-세-갈래-v0150)). 그때도
컴포넌트는 그대로였다 — 같은 이유로.

**폰트는 SUIT 하나다.** [public/fonts/SUIT/](../public/fonts/SUIT/)의 굵기 파일을
`--font-sans`에 물렸다. Fira Code는 완전히 뺐다 — 코드 폰트를 쓸 자리가 화면에 없다.
불러오는 방식은 나중에 `next/font/local`로 바꿨다 (아래 `새로고침할 때 글자가 출렁이던 것`).

`pretendard` 의존성과 `public/fonts/pretendard/`는 지웠다 (07-28). `src/`에서 참조하는
곳이 한 곳도 없었다.

**beUI 컴포넌트로 갈아탄 것** ([src/components/motion/](../src/components/motion/)):

| 자리 | 컴포넌트 |
|------|----------|
| 모든 버튼 | `motion/button` |
| 폼 입력 4곳 | `motion/input` |
| 상태 드롭다운 | `motion/select` |
| 부서 탭 | `motion/tabs` (Pill — v0.18.1까지 Segment) |
| 상단 메뉴 탭바 | `motion/tabs` (Underline) 패턴을 `<Link>`에 이식 |
| 업무 상세 접기 | `motion/bouncy-accordion` |
| 상단 요약 4칸 건수 | `motion/number-ticker` |

메뉴 탭바는 컴포넌트를 그대로 쓰지 않았다 — 탭은 실제 `<Link>`여야 서버 라우팅과 우클릭
새 탭이 동작한다. 밑줄만 `layoutId`로 가져왔다 ([app-shell.tsx](../src/components/app-shell.tsx)).

**레이아웃**: 왼쪽 사이드바를 없애고 상단 2행 헤더로 바꿨다. 1행 브랜드·사용자,
2행 메뉴 탭바. 헤더는 `sticky` + 반투명 블러(BUG-010). 좁은 화면에서는 탭바가 접힌다.

폭은 **fluid**다 (07-28). `max-w-7xl`(1280px) 중앙 정렬을 걷어내고 화면을 꽉 쓴다 —
화면이 목록·카드 위주라 넓어지는 만큼 한 행에 담기는 정보가 늘고, 넓은 모니터에서
좌우로 남던 여백이 없어진다. 대신 좌우 여백을 `px-4 → sm:px-6 → lg:px-8`로 벌려
내용이 화면 끝에 붙지 않게 잡았다. 헤더·탭바·본문 3곳이 같은 규칙을 쓴다.

[loading.tsx](<../src/app/(app)/loading.tsx>)를 뒀다 — MCP 호출이 여러 개라 첫 페인트가 늦다.

#### 데이터 중심 재배치 (07-28)

세 화면이 "숫자 + 목록"이었다. 숫자는 비교 대상이 없으면 크고 작음이 안 읽히고, 목록은
정렬이 없으면 다 읽어야 답이 나온다. 관리자 패널로 쓰려면 둘 다 문제다.

**막대를 추가했다** ([meter.tsx](../src/components/meter.tsx)). 세그먼트 폭만 쓰는 `div`
한 줄이고 서버 컴포넌트다. `total`을 주면 점유율, 안 주면 구성비로 그린다. 화면 리더에는
`role="img"` + 수치를 읽어준다.

> 차트 라이브러리는 넣지 않았다. 필요한 게 비율 하나뿐이다. 축·툴팁·시계열이 필요해지면
> 그때 recharts를 붙이는 게 맞다.

| 화면 | 바뀐 것 |
|------|--------|
| `/` | 3단 배치 — KPI 4칸(전체 점유율 막대 포함) → 포커스(넓게)+방치된 업무(좁게) → 밀리는 업무+멘션(반반) |
| `/risk` | 부서 합계 KPI 4칸 + 등급 분포 막대 한 줄, 카드에 순위 숫자·1위 대비 점수 막대 |
| `/team` | 부서 KPI 4칸, **많이 물고 있는 사람 순으로 정렬**, 카드에 팀 최대 대비 부하 막대, 4단까지 넓힘 |

- `/team` 정렬이 이번 변경에서 제일 크다. flow가 주는 순서는 조직도 순이라 "누가 막혀
  있나"를 찾으려면 카드를 다 읽어야 했다.
- `/risk`·`/team`의 KPI 칸은 [kpi.tsx](../src/components/kpi.tsx)로 공유한다. `/`의 KPI는
  점유율 막대가 붙어 구성이 달라서 그 파일에 합치지 않았다 — 합치면 안 쓰는 prop이 절반이 된다.
- KPI 칸에 심각도별 **색상 왼쪽 보더**를 달았다가 뺐다 (피드백). 막대가 이미 심각도를
  색으로 싣고 있어서 4칸에 색선이 하나씩 더 붙으면 화면이 시끄럽다.
- 큰 숫자가 옆 단위 텍스트보다 5~6px 떠 있던 걸 고쳤다 (BUG-015). `overflow-hidden`이
  걸린 인라인 요소의 베이스라인이 박스 아래 끝으로 잡히는 CSS 규칙 때문이었다.

**진입 모션은 CSS 캐스케이드다** ([globals.css](../src/app/globals.css)). `.rise` /
`.bar-grow`에 `animation-delay: calc(var(--i) * 45ms)`를 물려 카드가 순서대로 올라온다.
IntersectionObserver도, 클라이언트 컴포넌트도 안 만들었다 — 서버 컴포넌트에 클래스와
`--i`만 붙이면 된다. `animation-fill-mode: backwards`가 핵심이다. 없으면 지연 중인 요소가
`from` 상태 대신 최종 상태로 한 번 번쩍인다.

> `prefers-reduced-motion`에서 `animation-delay`도 같이 0으로 지운다. duration만 지우면
> `backwards`로 대기하던 요소가 지연 시간 동안 안 보인다.

한글 조판도 같이 잡았다 — `word-break: keep-all`(없으면 "프로젝/트"처럼 끊긴다) +
`overflow-wrap: break-word`(flow 업무 제목에 영문 코드가 섞여 온다) + 제목에
`text-wrap: balance`.

#### 표기 통일 (07-28, 피드백 반영)

재배치 직후 받은 피드백 넷을 한 번에 정리했다.

| 무엇 | 어떻게 |
|------|--------|
| flow로 나가는 링크 | [flow-link.tsx](../src/components/flow-link.tsx) 하나로 통일 — "flow에서 열기 ↗", 라임, 새 탭 |
| 업무 상태 | [status-pill.tsx](../src/components/status-pill.tsx) 배지 — flow 화면과 같은 색 (PRD §7.1) |
| 건수 단위 | 업무는 **건**, 댓글·피드백·알림·프로젝트는 **개** |
| 댓글 미리보기 | 열 폭을 다 쓰고 `line-clamp-2`로 자른다 |

- 링크는 화면마다 달랐다 — `/`는 라벨 링크, `/risk`는 "열기 ↗", `/team`은 **행 전체가
  링크**였다. 어디를 누르면 flow로 나가는지가 화살표 하나로만 보였다. `/team`의 행 링크를
  풀어서 셋 다 같은 자리·같은 문구로 맞췄다.
  (`/`의 밀리는 업무는 한동안 제목 자체가 링크였는데, 아래 "업무 줄 통합"에서 표를 걷어내며
  이것도 같은 `FlowLink`로 바뀌었다 — 이제 예외가 없다.)
- 아이콘만 있고 숫자만 붙던 자리(🔴 3, 🟡 2)에 `sr-only` 라벨을 같이 넣었다. 화면 리더에는
  "밀리는 업무 3건"으로 읽힌다.
- `/risk`의 "상태 바꾸거나 댓글 남기기"가 아이콘 열까지 밀고 나와 제목과 왼쪽 끝이
  22px 어긋나 있었다. 액션 폼을 아이콘 오른쪽 열 **안으로** 넣어 맞췄다.
- 접기 안쪽 눈금도 맞췄다. 트리거가 `[아이콘 16][간격 6][제목]`이라 세로선은 아이콘
  한가운데(8px), 폼은 제목 시작점(22px)에 와야 한다 — 선 두께 2px를 빼서 `ml-[7px]` +
  `pl-[13px]`. 전에는 선이 0px, 폼이 12px에 있어서 제목과 폼이 다른 열처럼 보였다.
- 접기 안쪽 세로 여백: 제목 아래 14px > 폼 두 줄 사이 8px. 제목이 두 줄을 묶는 머리로
  읽히게 위계를 뒀다.
- 상태 배지 색은 **flow가 쓰는 색을 그대로** 가져왔다. 팔레트에 파랑·보라가 없어서
  `info`·`done` 토큰 둘을 새로 만들었다. 상태 드롭다운 항목도 같은 색으로 칠했다 —
  다만 `SelectItem`의 children은 문자열이어야 해서(트리거 라벨을 거기서 가져간다)
  배지를 넣지 않고 글자색만 준다.

#### 업무 줄 통합 · 상태 필터 (07-28)

**밀리는 업무를 표에서 걷어내고 포커스와 같은 줄 모양으로 바꿨다** (`TaskItem`). 같은
업무가 두 패널에서 다르게 생기면 같은 것인지 알아보는 데 시간이 든다. 순위 숫자는 포커스
에만 붙는다 — 밀리는 업무에는 매길 순위가 없다.

점수 막대·추천 이유·댓글 수는 **포커스 응답에만** 있다(`FocusPick`). 워크리스트는 제목·
상태·프로젝트·기한만 준다. 한 컴포넌트가 `FocusPick | WorklistTask`를 받아 `"score" in
task`로 갈라 없는 자리는 안 그린다 — 없는 데이터를 0으로 채워 넣지 않는다.

**카드마다 상태 필터를 달았다** ([status-filter.tsx](../src/components/status-filter.tsx)).

- 쿼리 키가 카드마다 다르다 (`/?focus=진행&overdue=요청`). 걸러 둔 화면을 그대로 공유할
  수 있고 뒤로 가기로 풀린다. 서버 컴포넌트 + `<Link>`라 클라이언트 상태가 없다.
- 칩은 **데이터에 실제로 있는 상태만** 낸다. flow 커스텀 상태라 고정 목록을 그리면 0건짜리
  칩이 늘어선다. 상태가 한 종류면 필터 자체를 안 그린다.
- 필터는 **보이는 목록만** 줄인다. 위 KPI와 지연 분포 막대는 전체 그대로다 — 요약까지
  같이 줄면 "지금 몇 건인지"를 필터 상태마다 다시 세야 한다.
- 포커스 순위도 전체 기준을 유지한다. 걸러 놓고 1,2,3으로 다시 매기면 같은 업무의 순위가
  필터에 따라 달라진다.
- 필터 링크에 `#focus` / `#overdue` 앵커를 물렸다. 없으면 누를 때마다 맨 위로 튄다.
  sticky 헤더에 가리지 않게 카드에 `scroll-mt-32`를 준다.

**밀리는 업무와 멘션을 한 줄에 세웠다** (`xl:grid-cols-2`). 둘 다 "지금 답해야 하는 것"인데
위아래로 떨어져 있으면 하나를 처리하는 동안 다른 하나가 화면 밖으로 나간다. 멘션 카드
안쪽의 2단은 없앴다 — 카드가 이미 화면 절반이라 댓글 본문이 4분의 1 폭에서 세 줄씩 접힌다.
`items-start`로 카드 높이는 안 맞춘다. 맞추면 짧은 쪽 아래가 빈 상자가 된다.

#### 본문 · 댓글 · 답글 단 나누기 (07-28)

멘션 카드를 펼치면 업무 제목과 댓글이 둘 다 `text-sm`이라 **첫 댓글이 제목처럼** 읽혔다.
댓글 사이는 8px에 구분선이 없어서 긴 댓글 두 개가 한 개로 보였고, 답글은 회색 선 3px
옆에 같은 회색 선을 하나 더 그은 게 전부라 단이 안 나뉘었다.

- **본문**: `text-[15px] font-semibold`로 한 급 올리고, 아래를 가로선으로 끊는다.
- **댓글**: 전체를 세로선 하나로 묶던 것을 **댓글마다 말풍선 아이콘**으로 바꿨다
  (`IconLastComment` = reicon `ChatLine`). 아이콘이 시작 지점을 잡아 주니 경계가 보인다.
  간격도 8 → 12px. 본문은 `text-[13px]`.
- **작성자 이름**은 본문색 `font-medium`. 시각과 같은 회색이면 누가 썼는지가 안 걸린다.
- **답글**: 한 칸(20px) 들여쓰고 아이콘을 `text-primary`로 바꾼다. "답글" 표시는 이름 옆
  으로 옮겼다 — 부모 댓글이 알림에 안 와서 답글이 첫 줄에 오는 경우가 있고, 그때는
  들여쓰기만으로 이유를 알 수 없다.
- 업무 줄(포커스·밀리는 업무)의 **마지막 댓글**도 같은 아이콘을 쓴다. 댓글 표시는 화면
  전체에서 하나다.

#### 밀리는 업무에 마지막 댓글 (07-28)

워크리스트 응답에 댓글 본문이 없다. `flow_suggest_my_focus`는 픽마다 `lastComment`를
주는데 `taskSrno`가 워크리스트와 같은 키다 — **호출을 추가하지 않고** 이미 부르는
포커스 도구의 `topN`을 5 → 20으로 올려 조인 재료로 쓴다 (`withLastComment`).

- 화면에 뿌리는 포커스는 그대로 5개다 (`picks.slice(0, 5)`).
- 포커스 후보 20위 밖으로 밀린 업무는 댓글 없이 나온다. 업무 하나씩 댓글을 받아 올 길이
  지금 없다 — `flow_get_post`는 `postId`를 요구하고(BUG-005),
  `flow_collect_project_chain`은 권한 오류다(BUG-011).
- 포커스 호출이 죽으면 `null`로 흘러 댓글 줄만 빠진다. 밀리는 업무 목록은 그대로 뜬다.

#### 오늘 일정 → 방치된 업무 (07-28)

포커스 옆 좁은 칸을 **오늘 일정에서 방치된 업무로 바꿨다.** 방치는 KPI에 건수만 있었고
목록을 여는 자리가 없었다 — 요약에서 "3건"을 보고 나서 어디로 가야 할지가 막혀 있었다.

목록은 이렇게 만든다 (`staleTasks`). `flow_get_my_worklist`에 `overdueActiveDays`
인자가 있다 — 기본 30일, 상한 180일. 이 값이 `overdueActive`(목록)와
`counts.overdueStale`(건수)를 가르는 기준이다. 그래서 **같은 도구를 180일로 한 번 더
부르고**, 기본 30일 창의 `overdueActive`에 없는 `taskSrno`만 남긴다.

- 180일을 넘게 방치된 건 여전히 목록으로 못 온다 (도구 상한). 목록 수가
  `counts.overdueStale`보다 적으면 카드 아래에 남은 건수를 그대로 밝힌다.
- 두 번째 호출이 죽으면 `null`로 흘러 "flow가 잠시 답을 주지 않았어요"만 뜬다.
- 업무 줄은 포커스·밀리는 업무와 같은 `TaskItem`이다 — 상태 바꾸기·댓글 액션이 그대로 붙는다.
- 정렬은 많이 지난 순(`daysLeft` 오름차순).
- 마지막 댓글도 밀리는 업무와 같은 `withLastComment`로 붙인다. "왜 멈췄는지"가 거기 적혀
  있다. 다만 방치된 업무는 성격상 포커스 후보(topN 20, 상한) 안에 들 확률이 낮다 —
  댓글 없이 나오는 줄이 밀리는 업무보다 많을 수 있다.
- **미검증**: `overdueActiveDays`를 넓히면 그만큼 목록이 늘어난다는 건 스키마 설명 기준이다.
  실측 계정으로 확인하지 못했다.

일정 쪽(`flow_query_events` 호출·`FlowEvent` 타입·`fmtTime`)은 같이 지웠다. 화면에서
쓰는 데가 없어졌다 — 다시 필요하면 별도 카드로 붙이는 게 맞다.

칸 나눔은 아래 줄(밀리는 업무 + 나를 부른 사람들)도 **같은 8:4**로 맞췄다. 아래가 6:6이면
두 줄의 세로 경계가 어긋나 화면에 기준선이 두 개 생긴다. 멘션 카드가 절반 → 3분의 1로
좁아져서 제목 줄은 접히게 뒀다.

#### 추천 이유에 단위 (07-28)

포커스 추천 이유 칩(`댓글 3` → `댓글 3개`). 문구는 flow 서버가 만들어 준다 — 화면에서
`댓글`·`멘션` 뒤 숫자만 잡아 붙인다(`withUnit`). 모든 숫자에 붙이면 `마감 12일 지남`처럼
이미 단위가 있는 문구가 망가진다.

#### 업무 줄을 화면 공용으로 (07-28)

`TaskItem`이 `page.tsx` 안에 있어서 팀 화면은 자기 `TaskLine`을 따로 쓰고 있었다. 같은
업무가 화면마다 다르게 생겨서 같은 것인지 알아보는 데 시간이 든다 —
[task-item.tsx](../src/components/task-item.tsx)로 빼서 오늘·팀이 같이 쓴다.

- 팀 화면 업무 줄에 **상태 배지 · 마감 배지(D+/D-) · 상태 바꾸기 · 댓글**이 붙었다.
  전에는 제목·프로젝트·남은 일수와 flow 링크뿐이라 화면을 옮겨야 손을 댈 수 있었다.
- 밀림/임박을 가르던 앞 아이콘은 뺐다. 마감 배지가 같은 걸 이미 말한다(`D+` 빨강 /
  `D-` 노랑·회색). 목록은 밀림 먼저, 그다음 임박 순.
- `path` prop을 새로 받는다. 쓰기 액션 후 되돌아올 경로가 화면마다 다르다
  (`/` vs `/team?dept=…`).
- 멤버 카드는 2xl에서 4단 → **3단까지**만. 줄 하나에 들어가는 게 늘어서 4단이면 다 접힌다.
- `loadTeam`이 `projectIds`를 같이 해소한다. 쓰기 액션에 필요하다 — `loadRisk`가
  따로 부르던 걸 여기로 올렸다(호출 수는 그대로, `loadRisk`는 12줄 줄었다).

#### 댓글 404 — `taskSrno`를 `postId`로 (07-28)

댓글 남기기가 flow에서 404 `삭제되었거나 존재하지 않는 콘텐츠입니다`로 터졌다.
`createComment`가 워크리스트의 `taskSrno`를 `postId` 자리에 그대로 넘기고 있었다 —
**두 ID는 다른 공간이다** (BUG-005 판정 완료).

- `flow_update_task.taskId` = `taskSrno` 그대로. **맞았다** (실측 성공 기록 확인).
- `flow_create_comment.postId` = `colabo_commt_srno`. **틀렸다.**
- MCP에는 두 ID를 이어 주는 도구가 없다. `flow_list_project_items`는 응답에 `taskId`가
  아예 없고, `flow_search`는 `TASK_NM`을 인덱싱하지 않는다.
- REST 업무 필터(api-spec §6.1)가 한 응답에 `taskId`와 `postId`를 같이 준다 →
  [rest.ts](../src/lib/flow/rest.ts) `resolvePostId`. 업무명을 `searchWord`로 서버에
  넘겨 프로젝트 600건+를 2건으로 줄이고, `taskId` 일치로 고른다.
- 폼이 업무명을 같이 보낸다 (`TaskActions`에 `title` prop 추가). 못 찾으면
  `이 업무는 flow에서 댓글을 남겨주세요.`
- 회귀 테스트 4건 (`rest.test.ts`). 이 테스트가 깨지면 404가 돌아온다.
- 덤으로 §6.1 `columns[]` 스키마를 실측으로 채웠다 (api-spec의 가장 큰 공백이었다).

#### 빈 칸 다시 그리기 (07-28)

[empty-state.tsx](../src/components/empty-state.tsx)가 점선 테두리 + `bg-card`를 두르고
있었다. 호출부 다섯 곳 중 넷이 이미 `Card` 안이라 **카드 안에 카드**가 생겼고,
`py-12`는 3분의 1 칸(`xl:col-span-4`)에서 카드 절반을 빈 상자로 만들었다.

- 테두리·배경을 빼고 `py-12` → `py-8`. 비었다는 건 여백으로 읽힌다.
- 아이콘을 맨 위에 원형 판(`size-10 rounded-full bg-muted`)에 얹었다. 전에는 제목 글자와
  크기가 비슷해서 제목 앞머리처럼 보였다.
- `icon`을 **필수 prop**으로. 다섯 곳이 각자 **카드 제목과 같은 아이콘**을 넘긴다
  (포커스·방치·밀림·멘션·리스크). 하나의 `Inbox`로는 어느 칸이 빈 건지 안 보였다.
- 색은 항상 muted다. 카드 제목의 빨강·노랑을 끌고 오면 비어 있는 게 문제처럼 보이는데,
  대개는 좋은 소식이다.
- 제목 `text-base` → `text-sm`, 설명 `text-sm` → `text-xs`. 빈 칸이 옆의 실제 업무 줄보다
  크게 외치고 있었다.
- `/risk`는 유일하게 카드 밖이라 호출부에서 `Card`로 감쌌다.
- 팀 화면 사람 카드의 `급한 업무가 없어요`도 같은 `EmptyState`로 바꿨다. 전에는 왼쪽에
  붙은 한 줄짜리 문장이라 위 업무 줄과 구분이 안 됐다. 방치가 남아 있으면 아이콘을
  `IconStale`로 바꿔 그쪽을 가리킨다 — 그 카드에 유일하게 남은 할 일이다.

#### 헤더 사용자 영역 (07-28)

[app-shell.tsx](../src/components/app-shell.tsx) 헤더 오른쪽 끝이 이름·부서 두 줄과
`로그아웃` 텍스트를 나란히 붙여놨다. 부서명과 버튼이 **같은 색(muted)·같은 크기(text-xs)**라
어디까지가 정보고 어디부터 누르는 곳인지 구분이 안 됐고, 두 줄 블록 옆에 한 줄 버튼이
붙어 중심선도 어긋났다.

- 이름 첫 글자를 **원판**(`size-8 rounded-full bg-muted`)에 얹었다. 두 줄 텍스트의 높이
  기준점이 생겨야 옆 버튼과 중심이 맞는다.
- 이름·부서를 오른쪽 정렬에서 **왼쪽 정렬**로. 원판 오른쪽 한 열로 묶었다.
- 정보와 액션 사이에 **세로선**(`h-5 w-px bg-border`)을 넣었다.
- 로그아웃은 **아이콘 + 호버 면**(`hover:bg-accent`)으로. 누르는 곳이라는 게 색이 아니라
  모양으로 읽힌다. 라벨은 ≥1024px에서만 글자로 나오고 그 아래에서는 `sr-only` + `title`이다.
- 부서명은 <640px에서 숨긴다 — 브랜드와 부딪히던 자리다.

#### 파비콘 · PWA 아이콘 (07-28)

`public/logo.jpg`(1024×1024) 하나에서 `sips`로 크기별로 잘라 넣었다. ImageMagick 없이
macOS 기본 도구만 썼다.

| 파일 | 크기 | 쓰임 |
|------|------|------|
| `src/app/favicon.ico` | 32 | 브라우저 탭 (Next 기본 로고를 덮었다) |
| `src/app/apple-icon.png` | 180 | iOS 홈 화면 |
| `public/icon-192.png` | 192 | 매니페스트 |
| `public/icon-512.png` | 512 | 매니페스트 · maskable |

- [manifest.ts](../src/app/manifest.ts)를 파일 컨벤션으로 뒀다 — Next가
  `/manifest.webmanifest`로 내고 `<link>`까지 넣는다. `metadata.manifest`는 필요 없다.
- maskable은 512 하나만 선언했다. 로고가 검은 정사각을 꽉 채우고 흰 삼각형이 가운데라
  안드로이드가 원형으로 깎아도 삼각형이 남는다.
- `viewport.themeColor`를 `#0a0b09`로. 안 적으면 다크 화면 위에 흰 주소창이 남는다.
- **서비스 워커는 넣지 않았다.** 이 앱은 열 때마다 flow에서 새로 읽어야 의미가 있어서
  캐시된 화면은 틀린 화면이다. 홈 화면에 얹어 바로 여는 것까지가 목적이다.
- 넣자마자 게이트에 걸려 전부 307로 튕겼다 → BUG-016. matcher 예외를 이름에서 확장자로
  바꿨다. `next start` + `curl`로 에셋 6개 200, 보호 경로 307을 실측했다.

#### 로그인 화면 반 나누기 (07-28)

[login/page.tsx](../src/app/login/page.tsx)를 `public/login-bg.jpg`(1920×2981)로 다시
만들었다. 누를 것이 버튼 하나뿐인 화면이라 가운데 카드 하나로는 넓은 모니터에서 텅 비어
보였다.

- ≥1024px: 화면을 세로로 이등분해 **왼쪽 사진, 오른쪽 폼**(`lg:grid-cols-2`).
- <1024px: 위아래로 쌓고 **사진 1 : 폼 2**(`grid-rows-[1fr_2fr]`). 사진 높이를 고정값으로
  박으면 작은 화면에서는 사진이 화면을 다 먹고 큰 화면에서는 띠처럼 남는다.
- 사진은 밝고 앱은 어두워서 두 면의 대비가 그대로 경계선이다 — 사이에 선을 긋지 않았다.
- `next/image` `fill` + `priority`. LCP 요소라 미룰 이유가 없다. 장식이라 `alt`는 비웠다.
- 로고(`public/logo.jpg`)를 44px 라운드 타일로 얹어 앱 아이콘과 같은 얼굴을 보여준다.
- 설명은 문장마다 줄을 바꾼다(`<br />`). 흐르게 두면 `max-w-sm`에서 "수 있어요."만 다음 줄에
  남았다.
- 폼은 모바일에서 위로 붙인다(`items-start lg:items-center`) — 두 칸을 다 쓰는 영역에서
  가운데를 잡으면 폼이 처진다.

`/login`은 게이트 밖이라 **이 화면은 실제로 눈으로 확인했다**. `next start` +
playwright로 1440×900(사진 왼쪽 절반, 폼 오른쪽 절반)과 390×844(사진 위 1, 폼 아래 2)를
찍어 맞춰봤다.

#### 리스크 카드 두 층의 왼쪽 끝 (07-28)

[risk/page.tsx](../src/app/(app)/risk/page.tsx) `TaskRow`의 아이콘 칸이 헤더의 순위 숫자
칸보다 좁아서, 카드를 펼치면 업무 제목이 헤더의 등급 점보다 10px 왼쪽에서 시작했다.

| 층 | 앞 칸 | 텍스트 시작 |
|----|-------|------------|
| 헤더 (접힘) | 순위 `w-5`(20) + `gap-3`(12) | 32px |
| 업무 줄 (전) | 아이콘 14 + `gap-2`(8) | 22px |
| 업무 줄 (후) | `w-6`(24) 칸 오른쪽 + `gap-2`(8) | 32px |

여백을 10px 밀어 넣는 대신 **앞 칸과 간격의 합을 32px로** 잡았다. 아이콘을 칸 오른쪽에
붙여서 앞에 10px가 들어가고 아이콘–글자는 8px로 좁다 — 아이콘이 제목에 딸린 표시로
읽힌다. 아이콘 크기를 바꿔도 왼쪽 끝은 안 흔들린다.

#### 업무 제목 한 벌로 (07-28)

같은 업무 제목이 카드마다 다르게 보였다. `text-sm font-semibold` 하나로 통일했다.

| 자리 | 전 | 후 |
|------|----|----|
| 나를 부른 사람들 ([page.tsx](../src/app/(app)/page.tsx)) | `text-[15px] font-semibold` | `text-sm font-semibold` |
| 포커스·밀리는·방치된·팀 ([task-item.tsx](../src/components/task-item.tsx)) | `text-sm font-medium` | `text-sm font-semibold` |
| 리스크 카드 안 업무 ([risk/page.tsx](../src/app/(app)/risk/page.tsx)) | `text-sm font-medium` | `text-sm font-semibold` |

댓글 본문은 13px `font-normal`이라 제목이 크기·굵기 두 축으로 앞선다. 롤업 헤더의
**프로젝트 이름**은 업무 제목이 아니라 그대로 `font-medium`이다.

#### 로그인 화면 등장 순서 (07-28)

버튼 하나뿐인 화면이라 들어오는 순간에 읽는 순서를 만들었다. 로고 → 제목 → 설명 →
버튼으로 한 번 흐른다. beUI 텍스트 애니메이션 둘을 새로 들여왔다 —
[chromatic-text-reveal.tsx](../src/components/motion/chromatic-text-reveal.tsx)(Dia)와
[text-reveal.tsx](../src/components/motion/text-reveal.tsx).

| 박자 | 요소 | 시작 | 방식 |
|------|------|------|------|
| 1 | 로고 | 0s | `.rise` |
| 2 | `flow Cockpit` | 0.4s | `.rise` + 0.7s부터 `Cockpit` 위로 색이 한 번 쓸고 감 |
| 3 | 설명 두 줄 | 1.0s | 낱말마다 0.05s씩 흐려진 채 올라옴 |
| 4 | 로그인 버튼 | 1.5s | `.rise` |

간격을 `.rise` 길이(0.5s)보다 좁히면 앞 요소가 아직 올라오는 중에 다음이 시작해서 둘이
한 덩어리로 보인다 — 제목을 0.25s에 뒀을 때 로고와 `flow`가 같이 뜨는 것처럼 읽혀서
0.4s로 벌렸다. 스윕 색은 새로 만들지 않고 `--chart-*` 팔레트를 빌렸다(라임이 띠 가운데).

`prefers-reduced-motion`이면 `globals.css`가 `.rise`의 지연까지 지우고 두 컴포넌트도
스윕·뜀을 건너뛴다 — 0.45초 안에 네 요소가 다 제자리다(측정값 opacity 0.99~1.00).

#### 제품 이름 굵기 (07-28)

`flow Cockpit`에서 이름의 무게 중심은 **`Cockpit`**이다. 앞의 `flow`는 올라탄 플랫폼
이름이라 얇게 둔다 — 로그인 제목과 헤더 브랜드 둘 다 `flow` medium(500) ↔
`Cockpit` extrabold(800)로 맞췄다. SUIT는 굵기마다 실제 파일이 따로 있어서 800도 합성이
아니다 — 900(Heavy)까지 올릴 수 있지만 24px 제목에서 800과 차이가 거의 안 보여 800에서
멈췄다.

로그인 제목은 스윕 컴포넌트가 `[고정 어절][쓸리는 어절]` 두 칸을 내놓아서, 뒤 칸에만
굵기를 얹는다(`[&>span:last-child]:font-bold`). 글자 폭을 재는 숨은 span까지 같이 굵어져야
칸이 안 좁아진다 — 측정값으로 숨은 칸과 보이는 글자가 둘 다 81px다.

#### 새로고침할 때 글자가 출렁이던 것 (07-28)

`<link rel="stylesheet" href="/fonts/SUIT/SUIT.css">`로 폰트를 불러오던 것을
[layout.tsx](../src/app/layout.tsx)의 `next/font/local`로 옮겼다. 원인이 셋이었다.

| 원인 | 전 | 후 |
|------|----|----|
| 대체 폰트가 자리를 다르게 먹음 | 대체 = 시스템 기본 | `suit Fallback`(`size-adjust: 100.17%` + ascent/descent override) |
| 새로고침마다 재검증 | `public/` → `Cache-Control: max-age=0` | `/_next/static/media` → `max-age=31536000, immutable` |
| 폰트를 늦게 찾음 | 별도 CSS 받고 파싱한 뒤 **316ms** | 문서 CSS + `preload`로 **66ms** |

셋 중 본체는 첫 줄이다. 출렁임은 폰트를 늦게 받아서가 아니라 **교체되는 순간 글자가
차지하는 자리가 달라져서** 생긴다. `next/font`가 대체 폰트에 SUIT의 자폭·높이를 덮어쓴
face를 같이 만들어 주니, 같은 문장 폭이 229.08px(SUIT) ↔ 230.68px(대체)로 0.7% 안에
들어온다 — 높이는 24px로 같다.

실측(3Mbps · 지연 60ms):

- 첫 방문: 폰트 요청 66ms 시작 → 2.6s 완료, FCP 564ms. 교체는 여전히 한 번 있지만 자리가
  안 밀린다.
- **새로고침: 전송량 0바이트, 첫 페인트 전에 준비 완료 — 교체 자체가 없다.** 사용자가
  말한 그 동작이다.

쓰는 다섯 단만 등록한다(400·500·600·700·800). 한 단이 170KB(한글 전체 글리프)다.
`preload`는 라우트별로 안 갈려서 어느 화면이든 다섯 단 834KB를 다 당겨온다 — 첫 방문
한 번의 값이라 뒀다. 무겁게 느껴지면 `preload: false`로 끄면 화면에 실제로 그려지는 단만
받는다.

남은 것: [public/fonts/SUIT/SUIT.css](../public/fonts/SUIT/SUIT.css)와 안 쓰는 네 단
(Thin·ExtraLight·Light·Heavy) 파일이 참조 없이 남아 있다.

#### 카드 제목 굵기 (07-28)

`CardTitle`을 medium(500) → **bold(700)**로 올렸다
([ui/card.tsx](../src/components/ui/card.tsx)). 500일 때는 바로 아래 상태 필터·업무 줄과
굵기 차이가 얇아서 카드 경계가 제목으로 안 읽혔다. 제목 안에 붙는 건수(`점수순 12건`)는
`font-normal`을 따로 갖고 있어서 같이 굵어지지 않는다.

700을 폰트 목록에 새로 등록해야 했다. 600·800만 있으면 CSS 굵기 매칭이 700을 800으로
올려버려서 카드 제목과 제품 이름(`Cockpit`)이 같은 굵기로 보인다.

#### 마지막 댓글 아이콘 세로 정렬 (07-28)

`mt-0.5`로 눈대중해 둔 아이콘이 글줄보다 1.25px 높았다. 아이콘을 감싼 칸 높이를 글줄
한 줄(`h-[1lh]`)로 잡고 그 안에서 중앙에 둔다 ([task-item.tsx](../src/components/task-item.tsx)).
`1lh`는 그 요소의 실제 `line-height`라 글자 크기나 leading이 바뀌어도 다시 어긋나지 않는다.
측정값으로 아이콘 중심과 첫 줄 중심이 둘 다 9.75px이고, 댓글이 2줄일 때도 첫 줄 기준을
지킨다 — 블록 전체 중앙에 두면 2줄에서 아이콘이 줄 사이에 낀다.

#### 멘션 줄에 상태 · 프로젝트명 (07-28)

"나를 부른 사람들"의 각 줄이 다른 카드의 업무 줄과 같은 순서로 읽힌다 — 상태, 프로젝트,
그다음이 보낸 사람·시각 ([page.tsx](<../src/app/(app)/page.tsx>)). 둘 다 멘션 응답에 없는
값이라 **호출을 늘리지 않고** 이미 받아 둔 데이터에서 빌려 온다.

- **상태**: 워크리스트 네 목록(마감임박·밀리는·포커스·방치)을 `link`로 조인한다. 링크가
  업무마다 유일해서 키로 쓸 수 있다. 실측 14줄 중 **6줄**에 붙는다 — 나머지는 그 업무가
  네 목록 어디에도 없다. 한 줄 때문에 업무를 다시 조회하면 페이지가 그만큼 늦게 열린다.
- **프로젝트**: 멘션 알림이 이름 없이 `projectId`만 준다. `projectIds` 맵을 뒤집어 쓴다
  ([groupMentions.ts](../src/lib/aggregate/groupMentions.ts)가 그룹에 `projectId`를 실어
  보낸다 — 알림 조인이 어긋난 건은 최신 것만 보면 놓쳐서 붙은 것 중 아무거나 쓴다).
  실측 **14/14**.

프로젝트명은 처음엔 7/14였다. 원인은 이 화면이 아니라 ID 맵이었다 —
`flow_list_projects`(MCP)가 죽어 있어서(BUG-007) 이름 검색만으로 맵을 채웠고, 검색은
**화면에 이미 뜬 이름**만 풀 수 있다. 멘션은 이름이 없으니 한 건도 못 푼다.
그래서 REST 전량 목록(api-spec §5.2, 실측 59개)을 `listProjects()`로 추가하고
([rest.ts](../src/lib/flow/rest.ts)), 두 출처를 겹쳐 쓴다
([queries.ts](../src/lib/flow/queries.ts) `projectIdMap`).

REST 목록은 **API Key 발급자 기준**이라 다른 사람이 로그인하면 그 사람 것이 아니다. 그래서
로그인한 사람 권한으로 도는 검색 결과를 그 위에 덮는다 — 겹치는 이름은 항상 검색 쪽이
이긴다. 검색은 예전에도 매번 돌았으니 늘어난 호출은 REST 한 번이다.

#### 상태 · 댓글 줄을 pill 한 벌로 (07-28)

셀렉트(32px)·댓글 입력(32px)·`남기기` 버튼(32px)이 같은 높이의 pill로 붙고, 확인/취소만
한 급 낮다(28px) ([task-actions.tsx](../src/components/task-actions.tsx)). 확인 버튼이
셀렉트와 같은 32px에 라임을 채우면 이 줄에서 제일 큰 덩어리가 되어, 답해야 할 질문보다
답하는 버튼이 먼저 읽혔다.

셀렉트 반경은 클래스로 못 준다 — 모서리 애니메이션이 `borderRadius`를 인라인으로 쓰고
인라인이 클래스를 이긴다. beUI 쪽에 `radius` prop을 냈다
([motion/select.tsx](../src/components/motion/select.tsx)). `!important`로 이기면 모서리가
녹는 움직임이 죽는다. 실측 셀렉트 `border-radius: 16px`(= 높이 절반), 입력·버튼은
`rounded-full`이다.

#### 접기 · 펼치기에 움직임 (07-28)

`<details>` 여닫힘이 두 방향 다 즉시였다. 열림은 키프레임으로 흉내낼 수 있지만 닫힘은
안 된다 — `open`이 빠지는 프레임에 내용이 렌더 트리에서 사라져서 애니메이션 대상 자체가
없다. `::details-content` + `content-visibility`를 `allow-discrete`로 같이 전환해 닫히는
동안 내용을 남기고, `interpolate-size: allow-keywords`로 `height: 0 → auto` 보간을 연다
(`.disclose` — [globals.css](../src/app/globals.css)).

"나를 부른 사람들"과 `/risk` 두 곳에 붙였다. 실측 높이 변화 — 멘션 24→129→142→144,
닫힘 46→26→24. `/risk` 프로젝트 카드 50→822→1105→1250→1260, 닫힘 671→160→50.
셋 다 지원하지 않는 브라우저에서는 예전처럼 즉시 여닫힌다.

> 미확인 한 가지: 여는 동안 `overflow`를 `hidden`으로 잡아 두려고 넣은 지연
> (`overflow 0.01s 0.34s allow-discrete`)이 실제로는 안 버틴다. 340ms 애니메이션 중
> 120ms 지점에서 이미 `visible`로 측정됐다. 열린 뒤 `visible`(셀렉트 목록이 안 잘린다),
> 닫는 중 `hidden`은 의도대로다.

#### 공유 카드 (og) (07-28)

슬랙·카카오톡에 링크를 붙여넣으면 주소만 나왔다. [layout.tsx](../src/app/layout.tsx)에
`metadataBase` · `openGraph` · `twitter`를 넣고 [public/og.png](../public/og.png)(1200×630)을
만들었다. 실측 14개 태그가 렌더된다.

| 결정 | 이유 |
|------|------|
| 도메인을 `FLOW_REDIRECT_URI`에서 떼어 쓴다 | og:image·og:url은 절대 주소여야 하는데(크롤러가 우리 문서를 떠난 뒤에 온다), 그 값은 flow OAuth에 등록한 주소와 한 글자도 다를 수 없어서 앱이 서 있는 주소의 유일한 진실이다. 환경변수를 새로 안 만든다 |
| `robots: noindex`는 그대로 둔다 | 서로 다른 일이다 — robots는 색인을 막고, og는 붙여넣은 링크가 어떻게 펼쳐질지만 정한다. 사내 전용(PRD §8.1)이면서 공유 카드는 있어야 한다 |
| `twitter.card`를 따로 적는다 | 트위터는 og를 대부분 물려받지만 카드 크기는 자기 태그로만 정한다. 안 적으면 1200×630이 작은 정사각형으로 잘린다 |

카드 이미지는 **브라우저로 찍었다.** Next의 `ImageResponse`(Satori)를 못 썼다 — ttf/otf/woff만
읽고 **woff2를 안 읽는다.** 이 저장소 SUIT는 woff2뿐이라 한글이 전부 두부가 된다. 앱과 같은
토큰(`#0a0b09` · `#f2f4ef` · `#c7f751`, 리스크 4색 막대)으로 HTML 카드를 짜서 1200×630
뷰포트로 스크린샷했다. 로컬 정적 서버를 따로 띄워야 했는데, dev 서버는 `.html`도 로그인
게이트에 걸어서(`proxy.ts` matcher가 `.ico|.png|.jpg|.svg|.webmanifest`만 뺀다) 307이 났다.

104KB. `og.png`는 `.png`라 게이트에 안 걸린다 — 로그인 안 한 크롤러도 받을 수 있다.

### 알려진 구멍

- **180일 넘게 방치된 업무 목록**은 여전히 못 만든다. `overdueActiveDays` 상한이 180이다
  (PRD §12 Q10). 건수만 `counts.overdueStale`로 온다.
- **댓글 `postId` 해소**는 같은 이름의 업무가 100개를 넘으면 첫 페이지에서 못 찾는다.
  REST 키가 발급자 한 명에게 묶여 있어 발급자가 접근 못 하는 프로젝트도 해소되지 않는다.

## Phase 2 — 쓰기 액션 (완료, 알림 읽음 제외)

[src/app/(app)/actions.ts](<../src/app/(app)/actions.ts>) 서버 액션 3개 +
[task-actions.tsx](../src/components/task-actions.tsx) ·
[new-task-form.tsx](../src/components/new-task-form.tsx) 클라이언트 폼.

| 액션 | 도구 | 어디에 |
|------|------|--------|
| 상태 변경 | `flow_update_task` | 오늘·리스크 화면의 모든 업무 행 |
| 댓글 작성 | `flow_create_comment` | 같음 |
| 업무 생성 | `flow_create_task` | 리스크 카드 하단 (프로젝트가 확정된 자리) |

**PRD에서 바뀐 것 셋** (PRD §6.1.4에 반영함):

1. 상태 변경 도구가 `flow_set_statuses`가 아니라 `flow_update_task`다. 전자는 프로젝트의
   상태 컬럼 목록을 통째로 교체한다 — 하나만 주면 나머지 상태가 사라진다.
2. **실행 취소 → 확인 단계.** 되돌리려면 이전 상태를 알아야 하는데 flow 커스텀 라벨과
   API enum이 1:1이 아니다. 잘못 되돌리느니 누르기 전에 묻는다.
3. **알림 읽음은 못 넣었다.** BUG-001로 `flow_list_alarms`가 죽어서 알림 ID를 얻을 경로가
   없다. 워크리스트가 주는 멘션에는 알림 ID가 없다. 흉내내지 않고 뺐다.

**projectId 제약**: 쓰기 도구는 전부 `projectId`를 요구하는데 워크리스트·스탠드업 응답에
없다. `flow_list_projects`(59건)로 이름→ID 맵을 만들어 붙인다. 이름을 못 찾은 프로젝트는
쓰기 UI 대신 "flow에서 열어야 바꿀 수 있어요"를 낸다 — 추측해서 쓰지 않는다.

> **07-28: 그 `flow_list_projects`가 flow 서버에서 죽었다** (BUG-007). 리스크 화면이 500이
> 났고, 원인 둘을 다 고쳤다 — `loadRisk`에 `.catch()`를 넣어 화면이 서게 했고,
> [search.ts](../src/lib/flow/search.ts)로 `flow_search_project` 대체 경로를 뒀다.
> 제목이 정확히 일치하는 결과만 채택한다.

## Phase 3 — 리스크 보드 (완료)

[src/lib/aggregate/rollupProjects.ts](../src/lib/aggregate/rollupProjects.ts) +
[risk/page.tsx](<../src/app/(app)/risk/page.tsx>).

**PRD가 말한 59회 조회를 1회로 줄였다.** `flow_get_team_standup(dept)`이 부서원 전원의
임박·밀림 업무를 통째로 주기 때문에, 프로젝트 이름으로 묶으면 같은 순위표가 나온다.
그래서 계획했던 TTL 60초 캐시도 안 넣었다 — 캐시할 이유가 사라졌다.

대가는 범위다. "선택한 부서가 담당한 업무"이지 회사 전체 프로젝트 리스크가 아니다.
그리고 스탠드업에 `lastActivityAt`이 없어서 점수의 "최근 활동량" 항목은 계산하지 않는다.

## Phase 4 — 팀 화면 (완료)

[team/page.tsx](<../src/app/(app)/team/page.tsx>). `/risk`와 같은 `loadTeam()`을 쓴다.
부서 탭은 링크(`?dept=`)라 각 부서 화면에 URL이 생긴다 — 슬랙에 붙여넣을 수 있다.
마크다운 복사는 `navigator.clipboard` 한 줄 ([copy-button.tsx](../src/components/copy-button.tsx)).

## Phase 5 — REST 확장 (완료 · v0.15.0)

### 조사 (v0.14.1) — REST로 무엇이 더 되는지

**출발점**: v0.13.0에서 개인 API 키를 필수로 받기 시작했으니(그게 원래 REST를 버린 이유였다)
REST 배제 근거의 절반이 사라졌다. 그래서 "MCP → REST 전환이 가능한가"를 다시 봤다.

**결론은 전환이 아니다.** 워크리스트 한 화면을 REST로 재현하면 **178~470회** 호출이고
(프로젝트 59 × 컬럼·상태·업무), MCP는 **1회**다. DB가 없어 요청마다 반복된다. 집계와 타인
조회(팀 화면)는 MCP에 그대로 둔다 — `/user/*`는 여전히 인증 주체 고정이다.
**REST는 MCP에 길이 없는 곳에만 넣는다** (PRD §5.1.1).

**가장 큰 발견 — api-spec이 3개 도메인을 빼먹고 있었다.**

| 도메인 | 엔드포인트 | 실측 |
|---|---|---|
| comments | 2 | `GET /user/comments/{postId}` → 게시글 81211887에서 **댓글 14/14건**. [BUG-012](bug-report.md#bug-012)의 "전체 스레드는 못 만든다"가 **틀렸다** |
| drive | 3 | 200은 오는데 검색 `total: 0` — 콘텐츠가 없다 |
| wiki | 7 | 200, `children`·`search` 0건. **페이징 규약이 다르다** (`page`/`limit`, 다른 도메인은 커서) |

§0의 번들 복원이 노드 번호를 좁게 짚어서 12개를 통째로 놓쳤다. 원인과 교훈은 BUG-012에 적었다.

**같이 드러난 것들** (전부 인증 호출로 확인)

| 관측 | 뜻 |
|---|---|
| `filters=MENTION&size=100` → `hasNext: true` | 우리 알림 조회가 **이미 잘려 있다** → [BUG-019](bug-report.md#bug-019) 신규 |
| `filters=WORKER` 100건+ / `REGISTRANT` 85건 | 지금 화면은 멘션만 본다. 담당 업무·내 글 알림이 통째로 안 보인다 |
| `readYn=N` → 0건 (필터는 동작) | "나를 기다리는 대화"가 **이미 다 읽은 멘션**까지 보여주고 있다 |
| `PATCH /user/alarms/read` 존재 | Phase 2에서 뺀 알림 읽음 처리를 flow 수정([BUG-001](bug-report.md#bug-001)) 없이 붙일 수 있다 → PRD Q11 닫음 |
| 댓글 14건 중 **10건이 `systemCode`** (시스템 자동 댓글) | 안 거르면 "마지막 댓글"이 `담당자를 …추가하였습니다`가 된다. 반대로 이게 업무 변경 이력이다 |
| `/user/employees/me` → `inttId` + `userId` | 트래포트 판정을 이메일 도메인 대신 회사 식별자로. **키 소유자 = 로그인한 사람** 검증도 여기서 된다 |

**착수 순서**는 PRD §13에 Tier A/B/C로 매겼다. 등급 기준은 "새 화면을 여는가"가 아니라
**"지금 반쪽으로 서 있는 곳을 채우는가"**다. 위키·드라이브는 0건 근거를 남기고 Tier C로 뺐다.

### 구현 (v0.15.0) — Tier A 전부 + Tier B 전부

Tier C는 손대지 않았다 (0건 근거는 PRD §13에 그대로).

| # | 붙은 것 | 어디 |
|---|---|---|
| A1 | 전체 댓글 스레드 — `systemCode` 시스템 댓글 제외 + `@[이름](id)` 마크업 제거 | [rest.ts](../src/lib/flow/rest.ts) `listComments` |
| A2·A5 | 알림 읽음 처리 + `readYn=N` 미확인 강조 | 멘션 줄. 읽으면 강조가 그 자리에서 사라진다 |
| A3 | 알림 커서 페이징 — `hasNext` 루프 | [BUG-019](bug-report.md#bug-019) 닫음 |
| A4 | 마감일·우선순위·담당자 수정 | [task-actions.tsx](../src/components/task-actions.tsx) 편집 패널 |
| B1·B2 | 담당 업무·내 글 알림 = **업무 소식** | [news-bell.tsx](../src/components/news-bell.tsx) 헤더 종 |
| B3 | 오늘 일정 | 오늘 화면 4단. 캘린더는 MCP에 길이 없다 |
| B4 | 업무 활동 이력 | A1의 `systemCode`를 버리지 않고 이력으로 읽는다 |
| B5 | 180일 초과 방치 업무 | 리스크 카드를 펼칠 때만 부른다 (전량 조회는 안 한다) |
| B6 | 키 소유자 = 로그인한 사람 검증 | `/user/employees/me`의 `userId` 대조 |

**B6에서 `inttId`는 안 봤다.** 회사 판정을 `BFLOW_300022998467` 비교로 바꾸면 조직 ID가 코드에
박힌다 — flow가 테넌트를 옮기면 정상 사용자가 로그인을 못 하고, 그 값을 아는 사람이 사내에 없어
원인도 안 잡힌다. 이메일 도메인 + 키 소유자 일치 두 겹으로 둔다.

**업무 소식은 카드가 아니라 헤더 종이다** (PRD §6.1.5). 오늘 화면 맨 아래 카드로 먼저 붙였는데
두 가지가 걸렸다 — 챙길 일이 아닌데 화면 한 자리를 늘 차지했고, 리스크·팀 화면에서는 아예 안
보였다. 레이어는 beUI Notification Stack이고 **원본의 성장 방향을 뒤집었다**(위→아래, 안 뒤집으면
헤더를 덮는다). 데이터 경로도 `loadToday` → `loadNews`로 셸에 올라갔다: `listTaskAlarms`를
`loadToday`에서 뺐으니 순증은 `listProjects` 한 번이다 (알림이 `projectId`만 줘서 이름을 잇는다).

알림이 주는 건 프로젝트 id · 문구 · 등록자 · 시각뿐이다. **업무명은 없다** — 붙이려면 `postId`마다
게시글 상세를 한 번씩 더 불러야 한다.

### 소식 한 줄 → 문서 + 읽음 (v0.16.0)

v0.15.0에서는 "알림 응답으로는 딥링크를 못 만든다"고 적고 화살표를 껐다. **틀렸다.** 못 만드는 건
워크리스트의 `link`(flow가 만든 불투명한 단축 URL)고, 게시글 딥링크는 `flow_search`가 결과마다
`url`로 돌려주는 `https://flow.team/main.act?projectId=…&postId=…` 형식이다. 알림은 두 id를 다
줘서 **호출 하나 없이** 만든다.

| 붙은 것 | 어디 |
|---|---|
| `flowPostUrl(projectId, postId)` + `TaskNews.url` | [queries.ts](../src/lib/flow/queries.ts) |
| 카드 = 링크(`item.href`, 새 탭) + 누른 순간 콜백(`item.onSelect`) | `motion/notification-stack.tsx` (v0.18.0에서 삭제) |
| 한 건 읽음 처리 — 멘션과 같은 액션을 그대로 재사용 | [news-bell.tsx](../src/components/news-bell.tsx) → `markMentionsRead` |
| 안 읽은 줄에 점 | 읽으면 점이 사라지고 종 배지도 하나 준다 (`revalidatePath`) |

**스택 구조를 바꿔야 했다.** beUI 원본은 스택 전체가 `<button>` 하나여서 안에 링크를 넣을 수 없다.
바깥을 `<div>`로 벗기고(포커스 이벤트는 올라오니 focus-within 동작은 그대로), 카드를 `<a>`로,
펼치기/접기를 푸터 버튼으로 옮겼다. 손가락으로 쓰는 화면에서는 카드를 누르면 문서로 가버려서
펼칠 자리가 따로 있어야 한다. Escape 처리는 지웠다 — 팝오버가 이미 Escape로 닫는다.

v0.15.0의 `sr-only` 복제 목록도 지웠다. 그건 "버튼 하나라 안쪽 글자가 안 읽힌다"는 문제를
막던 것인데([BUG-020](bug-report.md#bug-020)), 카드가 진짜 링크가 되면서 원인이 사라졌다.
카드 포커스 링은 `inset-ring`이다 — 카드가 `clip-path`로 잘려서 바깥 링은 안 보인다.

### 소식 카드 네 줄 — 업무명 붙이기 (v0.17.0)

한 줄이 `"서동조님의 댓글 등록"` 한 문장이라 **무슨 일인지 알 수 없었다.** 실제 내용은
`content`에 따로 들어 있고 `message`는 그걸 요약한 템플릿이었다. 카드를 네 줄로 세웠다 —
프로젝트명(굵게, 한 줄 말줄임) · 업무명 · 내용(13px, 두 줄 말줄임) · 작성자, 시각은 첫 줄 오른쪽.

| 붙은 것 | 어디 |
|---|---|
| `getPostBrief(postId)` — 게시글 상세에서 `title` | [rest.ts](../src/lib/flow/rest.ts) |
| `postId` 중복 제거 후 병렬 조회 → `TaskNews.title` | [queries.ts](../src/lib/flow/queries.ts) `loadNews` |
| 내용은 `content` 우선, `message`는 대비 | `taskNews()` |

**알림은 이름을 하나도 안 준다.** 실측 응답 필드가 `alarmId · alarmType · content · message ·
postId · projectId · readYn · registerName …`까지다 — 프로젝트명도 업무명도 없다. 프로젝트명은
`listProjects` 한 번으로 되지만 업무명은 `GET /user/posts/{postId}`가 유일한 출처라 소식마다
호출이 붙는다. 같은 업무에 댓글이 여러 개 달리는 게 흔해서 `postId`를 먼저 중복 제거한다 —
실제 데이터에서 6건 → 2~3건이었다. 제목 한 줄 때문에 본문·HTML·댓글 원본까지 딸려 오는 건
이 API의 한계다.

카드가 레이어 밖으로 삐져 나온 건 그리드 트랙 문제였다 ([BUG-023](bug-report.md#bug-023)).

### 소식 레이어 = 탭 + 목록 (v0.18.0)

접기 버튼과 "업무소식" 라벨을 걷어내고 위를 탭으로 바꿨다. 남은 게 카드 목록 하나여서
**beUI Notification Stack도 같이 물렸다** — 팝오버를 열면 Radix가 안쪽으로 포커스를 넣어서
스택은 늘 펼친 상태였고, 겹쳐 쌓인 모습은 실제로 보이지도 않았다. 컴포넌트 파일을 지웠고
목록은 평범한 `<ul>`이다. BUG-023의 `minmax(0,1fr)`도 그리드가 없어지면서 같이 사라졌다.

| 붙은 것 | 어디 |
|---|---|
| 탭 전체 · 안 읽음 · 읽음 — beUI `Tabs` 재사용 (v0.18.1에서 `underline`) | [news-bell.tsx](../src/components/news-bell.tsx) |
| 전체 읽음 버튼 — `markRead(...ids)` 가변인자로 한 건/여러 건 겸용 | 같은 파일. 안 읽은 게 없으면 비활성 |
| 목록만 스크롤 (`max-h-[min(28rem,60vh)]`) | 탭과 버튼은 긴 목록에서도 위에 붙어 있다 |
| 탭별 빈 상태 문구 | "안 읽은 소식이 없어요" / "읽은 소식이 없어요" / "새 소식이 없어요" |
| 상한 6 → 12 | 읽은 것까지 탭으로 나눠 보면 6줄로는 "읽음" 탭이 늘 빈다 |

**탭 모양은 v0.18.1에서 갈랐다** — 알림 레이어는 `underline`, 부서 전환은 `pill`. 좁은 레이어에
채운 블록이 들어가면 목록보다 헤더가 무거웠고, 부서는 개수가 많아 알약이 개별 항목으로 읽힌다.
알림 쪽은 감싼 줄의 아래 패딩을 없애고 탭 자체 `border-b`를 지웠다 — 그래야 밑줄
인디케이터(`-bottom-px`)가 그 줄의 구분선 자리에 정확히 앉는다. beUI의 `underline` 트리거에는
`-mb-px`가 박혀 있어서 `mb-0`으로 눌러야 1px이 안 밀린다 (인디케이터 90~91px = 구분선 90~91px로
확인).

**`PATCH /user/alarms/read/all`은 안 썼다.** 받는 게 선택적 `projectId`뿐이라 **알림 종류를 못
가린다** — 그걸 부르면 오늘 화면 멘션 카드가 근거로 삼는 `MENTION` 알림까지 조용히 지워진다.
지금 화면에 있는 `alarmId`만 기존 액션에 넘긴다 (상한 12건).

**딥링크는 조립을 그만뒀다.** v0.16의 `main.act?projectId=…&postId=…`는 세션이 없으면 로그인
화면에서 대상을 잃었다 — 실사용에서 거의 항상 그랬다. 업무명 때문에 이미 부르는 게시글 상세가
`connectUrl`(`https://flow.team/l/Qmcn5`)을 같이 주고, 그건 `postlink`로 대상을 들고 간다.
호출은 안 늘었다. 근거와 재현은 [BUG-024](bug-report.md#bug-024).

### 검색 팔레트 ⌘K (v0.19.0)

화면 셋은 전부 "지금 챙길 일"이라 지난 문서를 다시 찾는 길이 없었다. 네 번째 화면을 만들지
않고 레이어로 얹었다 — 검색은 목적지가 아니라 경유지다. 설계 근거는 PRD §6.4.

| 붙은 것 | 어디 |
|---|---|
| `⌘K`/`Ctrl+K` + 헤더 버튼(`⌘K` 표기) | [search-palette.tsx](../src/components/search-palette.tsx), [app-shell.tsx](../src/components/app-shell.tsx) |
| REST 검색 둘 병렬 — 프로젝트 5 + 글 8 | `searchProjects`·`searchPosts` ([rest.ts](../src/lib/flow/rest.ts)) → `searchFlow` ([actions.ts](../src/app/(app)/actions.ts)) |
| `!#!…!#!` → `<mark>` | `splitHighlight` ([search.ts](../src/lib/flow/search.ts)) — `stripHighlight`와 같은 마커를 지우지 않고 쪼갠다 |
| 글 링크는 누른 것만 해소 | [api/go/[postId]/route.ts](<../src/app/api/go/[postId]/route.ts>) — `getPostBrief`로 `connectUrl` 받아 302 |
| 두 글자부터 · 300ms 디바운스 | 입력 길이는 100자에서 자른다 (URL에 그대로 들어가는 자리다) |

**MCP로는 만들 수 없는 화면이었다.** `flow_search`가 주는 `title`은 **프로젝트** 제목이고
게시글 제목에 해당하는 필드가 응답에 없다. REST `/user/search/posts`는 `ttl`(프로젝트) ·
`commtTtl`(게시글)을 둘 다 주고 하이라이트도 본문까지 찍어 준다 (실측 2026-07-29, api-spec §9.1).
BUG-022 이후로 붙인 습관대로 가정을 세우기 전에 두 경로를 다 불러 본 게 이 선택을 뒤집었다.

**프로젝트 링크는 한계가 있다.** 프로젝트에는 `connectUrl`에 해당하는 짧은 링크가 없다 —
검색·상세 응답에도, MCP에도 없고, 상세의 링크성 값은 `INVT_URL`(초대 URL) 하나다. `main.act?projectId=`를
조립해 쓰는데 세션이 없으면 `signin.act?why=no-session&from=ssr-helper`로 대상을 잃는다(실측).
초대 URL은 쓰지 않았다 — 그건 남을 들이는 링크다.

**이펙트 본문에서 setState 하면 린트가 막는다** (`react-hooks/set-state-in-effect`, React 19).
검색어가 두 글자 미만일 때 결과를 비우는 줄이 걸려서, 비우는 것도 디바운스 타이머 안으로
옮겼다 — 지우는 게 300ms 늦지만 화면에서는 안 보인다.

확인한 것 (브라우저, 실제 데이터): `⌘K` 열기 → 입력 자동 포커스 → `출장관리` 검색 결과
프로젝트 5 + 글 8, 강조 구간 `<mark>` 렌더, `Esc` 닫기 + 트리거로 포커스 복귀, 밝게/어둡게 둘 다.
`/api/go/79148381` 은 세션 없이 부르면 `/login`으로 튕기고(프록시 게이트), 그 `postId`로
게시글 상세를 부르면 `connectUrl: https://flow.team/l/Q7ccJ` 가 나온다 — 검색의 `postId`와
게시글 상세의 ID 공간이 같다는 확인이다.

### 업무 바꾸기 모달 (v0.20.0)

v0.15의 편집 패널은 셀렉트 네 개를 행 안에 펼쳐 놨다. 지금 값이 그 셀렉트의 placeholder라서
**값을 확인하려면 고르는 UI를 마주해야** 했고, 하나를 고르면 확인 문구와 버튼 둘이 그 줄에 더
붙어 네 줄이 통째로 흔들렸다. 읽는 자리와 고치는 자리를 갈랐다 — 설계 근거는 PRD §6.1.4.

| 붙은 것 | 어디 |
|---|---|
| `업무 바꾸기` 모달 | [task-actions.tsx](../src/components/task-actions.tsx) — beUI [center-morph-modal](../src/components/motion/center-morph-modal.tsx) |
| 네 줄 다 텍스트 → `변경` 누른 줄만 컨트롤 | 같은 파일 `Row` / `useSave` |
| 고르기는 브라우저 기본 `<select>` | 같은 파일 `Pick` — `appearance-none` + 손으로 그린 `IconChevronDown` |
| 달력은 모달 위로 | [date-field.tsx](../src/components/date-field.tsx) — `PopoverContent`에 `z-[110]` |

**beUI `Select`를 쓸 수 없었다.** 모달 패널이 `clip-path`로 자기 네모를 잘라내서, 트리거 밑에
`absolute`로 붙는 목록은 마지막 줄에서 그대로 사라진다. 기본 `<select>` 목록은 브라우저가
띄우니 무엇에도 안 잘리고 폼 값도 스스로 싣는다. 잘림·레이어 재현은 [BUG-026](bug-report.md#bug-026).

**저장한 뒤 다시 `변경`을 누르면 옛 값이 보였다.** 서버가 다시 그려도 `props`로 온 값은
`useState` 초기값이라 안 바뀐다 — `저장`으로 받은 값을 따로 들고 `saved || now`로 읽고,
`변경`·`취소` 둘 다 고른 값을 비우게 했다 ([BUG-027](bug-report.md#bug-027)).

확인한 것 (브라우저): 320px에서 모달이 화면에 들어가고, 두 줄을 동시에 `변경`으로 열면
현재값 → 컨트롤 → `저장`·`취소`로 접혀 내려가며 넘치는 곳이 없다. 1440px에서 네 줄 라벨
왼쪽 경계가 맞고 컨트롤 폭이 같다.

### 모바일에서 카드가 화면을 넘던 것 (v0.20.0)

오늘 화면의 `밀리는 업무` · `나를 부른 사람들`이 390px에서 화면 밖으로 나갔다 (`scrollWidth` 443).
원인은 카드가 아니라 **격자 열**이었다. `xl:grid-cols-12`만 적으면 좁은 화면 열은 `auto`
= `minmax(auto, max-content)`이고, 그 최소값은 **내용 최소폭**이라 열이 화면을 밀어낸다.
[BUG-023](bug-report.md#bug-023)과 같은 기제인데 그때 적어 둔 게 "스택 컨테이너" 이야기라
격자 기본 상태에 적용되는 줄로 안 읽혔다. 이번엔 규칙으로 적었다 — [BUG-025](bug-report.md#bug-025).

| 고친 것 | 왜 |
|---|---|
| 격자 넷에 `grid-cols-1` | `repeat(1, minmax(0,1fr))`이라 열도, 그 안 카드도 0까지 줄어든다 ([page.tsx](<../src/app/(app)/page.tsx>) 셋, [team/page.tsx](<../src/app/(app)/team/page.tsx>) 하나) |
| 댓글 본문 셋에 `wrap-anywhere` | 최소폭을 크게 만든 건 댓글에 섞여 온 링크다. 안 끊으면 열은 줄어도 링크가 카드를 잘라 뒤 글자까지 감춘다 ([page.tsx](<../src/app/(app)/page.tsx>), [thread-view.tsx](../src/components/thread-view.tsx), [task-item.tsx](../src/components/task-item.tsx)) |

`min-w-0`은 안 붙였다 — `grid-cols-1`이 열을 `auto`에서 빼면 격자 항목의 자동 최소 크기도
0이 된다. 한 클래스가 둘을 다 덮는다.

확인한 것 (브라우저, 목업 데이터): 390px 접힘 390 / 펼침 390, 320px 전부 펼쳐도 `scrollWidth`
320이고 넘치는 요소 0개, 1440px에서 두 카드 913 · 451로 8:4 비율 유지.

### 내 업무 화면 설계 (v0.20.1) — 문서만, 구현 전

"내 참여 프로젝트와 프로젝트별 담당 업무 전량"을 볼 화면이 필요하다는 요청. 설계를
[PRD.md](PRD.md) §6.5에 썼다. **코드는 아직 없다** — Phase 6이다.

실측이 화면의 이유를 만들었다.

| 무엇 | 건수 |
|---|---|
| 오늘 화면이 보여 주는 내 담당 업무 | **16건** |
| 실제 내 담당 업무 | **880건** (38개 프로젝트, 21개는 0건) |

`flow_get_my_worklist`는 전체 목록을 주는 도구가 아니다 — `counts` · `imminent` ·
`overdueActive` · `mentions`뿐이고, 그마저 담당·공개·진행률 100 미만으로 좁힌다. 864건이
어느 화면에도 없었다.

**경로를 세 개 시도해서 하나만 남았다.**

| 시도 | 결과 |
|---|---|
| `flow_list_projects_by_participant` | 내 `userId`를 줘도 **1개**만 온다. REST `/user/projects/participants`가 그렇고 래퍼도 같다 |
| `flow_list_project_items(templateType:"task")` | 담당자 · 마감일 · 업무 ID를 **하나도 안 준다** |
| REST `tasks/filter` + `filterRecords` | **된다.** `WORKER_ID IN <내 userId>`가 서버에서 걸려서 딱 내 것만 온다 |

`flow_list_projects` 1회(59개) + 프로젝트별 `tasks/filter` 59회 동시 10 = **2.1초**. 100건을
넘는 프로젝트 2개의 커서 페이징까지 64회 4.1초.

**실측 중에 문서 셋을 정정했다.**

| 정정 | 원래 적혀 있던 것 |
|---|---|
| REST는 **분당 120회**다 | PRD §12 Q3 "rate limit 없음" — 그건 MCP 얘기였다. 59회 훑기를 1분에 세 번 돌려서 `429`를 봤다 |
| 완료 판정 = `optionCategory == "2"` | api-spec §2.2 "`columns/status`로 옵션 목록을 받는 편이 안전하다" — **반대였다.** `STTS` 프로젝트는 그 응답이 옵션을 0건 준다 |
| 상태 컬럼이 **둘**이다 (`STTS` 9 / `STATUS` 12) | api-spec §2.1에 `STTS` 행이 없었다. 표본 8개 중 7개가 `STTS`였고, 이걸 놓쳐서 처음엔 798건이 빈 상태로 보였다 |
| `STTS` 코드 = 0 요청 · 1 진행 · 2 완료 · 3 보류 · 4 피드백 | api-spec §6.1 "대응표는 아직 없다". `flow_get_post` 시스템 기록의 `SYS_CODE:"S45^^0^^2"`("'요청' → '완료'")로 확정했다 — 빈도로 추측하지 않았다 |
| `connectUrl`이 **880건 전부 빈 문자열** | "빈 문자열일 수 있음". `projectId`·`postId`가 응답에 있어서 조립하면 된다 |

**보안**: 공용 API 키에 남의 `userId`를 넣어도 그 사람 업무가 그대로 온다 (실측이 정확히 그
경우였다). 필터 값은 요청에서 받지 않고 서버에서 세션으로 채운다 — PRD §6.5와 api-spec §6.1
양쪽에 박아 뒀다.

### 멘션 줄의 상태 배지 (v0.20.2)

"나를 부른 사람들"의 상태 배지가 17줄 중 12줄에서 비어 있었다. 링크가 안 맞는 게 아니었다 —
**모집단이 달랐다** ([BUG-028](bug-report.md#bug-028)).

화면은 이미 받아 둔 네 목록(임박·밀림·포커스·방치)에서 같은 업무를 링크로 찾아 상태를 빌렸다.
그 네 목록은 전부 워크리스트 계열이라 **담당 + 공개 + 진행률 100 미만**만 들어 있고, 멘션은
내가 **관계자로만 걸린** 업무에도 온다. 그런 줄은 어디에도 없어서 구조적으로 못 찾았다.

| 무엇 | 전 | 후 |
|---|---|---|
| 상태가 붙는 멘션 그룹 | 5 / 17 | **17 / 17** |
| 게시글 조회 | 0회 | 17회 (병렬, `postId` 중복 제거 후) |

새 엔드포인트는 없다. 알림이 이미 `postId`를 주고 `getPostBrief`가 부르는 곳이 그
`/user/posts/{postId}`라 응답에서 `status`만 하나 더 꺼냈다. 대신 오늘 화면 로드가 REST
호출 17회를 더 쓴다 — 분당 120회 안이고, 무거워지면 캐시가 다음 수다.

**함정**: 평면 `tasks[0].STTS`를 읽으면 안 된다. 커스텀 상태(`STATUS`) 프로젝트에서도 이
필드가 오는데 안 쓰는 컬럼이라 **항상 `"0"`** 이다 — `Q020 Extranet 운영`은 실제 `진행`인데
평면 값이 `'0'`(대기)이었다. `TASK_COLUMN_REC`의 `STATUS.OPTION_NAME`을 먼저 보고, 없을 때만
`STTS` 코드 맵으로 내려간다. 구현 전에 재 봤기 때문에 잘못된 라벨을 안 실었다.

**라벨은 `대기`다.** flow가 코드 0을 두 이름으로 부른다 — 시스템 댓글은 `요청`, MCP
워크리스트는 `대기`. 다른 카드가 전부 MCP 라벨을 그리니 같은 업무가 카드마다 다른 이름으로
보이면 안 된다 (api-spec §6.1 표에 적어 뒀다).

남긴 것: `STATUS_TONE`에 `대기` 키가 없어서 대기 배지는 회색이다(모르는 라벨은 칠하지 않는
설계 그대로). `listStaleTasks`도 `STTS` 코드를 라벨로 못 바꾼다 — 둘 다 이 수정에 묶지 않았다.

### 요약 카드 세 화면 정렬 (v0.20.3)

리스크·팀 화면 맨 위 요약 카드가 오늘 화면과 달랐다 — 라벨 앞에 아이콘이 없고 숫자가 24px로
4px 작았다. 세 화면을 나란히 열면 같은 자리의 같은 카드가 다른 물건처럼 보였다.

| 결정 | 이유 |
|---|---|
| `Kpi`에 `Icon`을 **필수** prop으로 | 옵션이면 호출부 한 곳을 빼먹어도 조용히 통과한다. 여덟 칸이 다 아이콘을 받아야 정렬이 성립한다 |
| 아이콘 타입은 `React.ComponentType<IconProps>` | 오늘 화면 `Stat`은 `typeof IconRisk`를 쓰지만 그건 그 파일이 이미 값을 임포트해서다. `kpi.tsx`는 타입만 필요하다 |
| `Stat`과 합치지 않았다 | 오늘 카드는 점유율 막대(`Meter`)와 `share%`가 붙는다. 합치면 안 쓰는 prop이 절반이 된다 ([kpi.tsx](../src/components/kpi.tsx) 주석 그대로) |
| Reicon에서 두 개를 새로 들였다 | 리스크의 `프로젝트`·`최장 지연`은 기존 30개에 맞는 글리프가 없었다 — `Folder`→`IconProject`, `Hourglass`→`IconDelay` |

팀 네 칸은 오늘 화면과 **같은 글리프**로 맞췄다(`IconTeam`·`IconRisk`·`IconImminent`·`IconStale`).
같은 뜻의 카드가 화면마다 다른 그림을 쓰면 정렬한 의미가 없다.

카드 간격(`gap`·`space-y`)은 손대지 않았다. 오늘 카드는 막대가 한 줄 더 들어가서 원래 더 넓다.

**업무 줄의 hover 배경도 뺐다** ([task-item.tsx](../src/components/task-item.tsx)). 줄 자체는
누를 수 없고 flow 링크와 액션 버튼이 줄 안에 따로 있다 — 배경이 따라 바뀌면 줄 전체를 누를 수
있는 것으로 읽힌다. `hover:bg-muted`를 지우면서 그것만 쓰던 `transition-colors
duration-300 ease-out`과 `rounded-lg`도 함께 지웠다. 오늘 화면 멘션 줄(`page.tsx:371`)도 같이
뺐다 — 그쪽은 `<details>`라 눌러서 펼치는 줄이지만, `summary`에 `cursor-pointer`와 열림 화살표가
이미 있어서 배경까지 바꿀 필요가 없다. `disclose group`과 여백만 남겼다.

### 화면 톤·모서리·간격 (v0.21.0)

라임 액센트(`#C7F751`/`#4D7C0F`)를 두 밝기에서 다 뺐다. **밝게는 흰색·검정·무채색 회색**,
**어둡게는 짙은 남색 바탕 + 파랑 액센트**다. 토큰은 여전히 `light-dark()` 한 줄씩이라
[globals.css](../src/app/globals.css) 한 곳만 고쳤다.

| 결정 | 이유 |
|---|---|
| 두 밝기가 **같은 액센트를 쓰지 않는다** | 밝게는 흰 바탕에 검정이 가장 세고, 어둡게는 짙은 남색 바탕에 검정을 못 쓴다. 한 색으로 맞추려면 한쪽이 반드시 흐려진다 |
| 어두운 바탕은 네 단계 | `#151c2c`(바탕) < `#1c2537`(카드) < `#222d42`(팝오버·muted) < `#28334a`(accent) ≈ `#2c3854`(테두리). 카드가 바탕보다 한 단계 밝아야 레이어가 읽힌다 |
| 어둡게 `--ring`은 `--primary`보다 밝다 (`#5b9bff`) | 포커스 링을 `ring-ring/50`으로 깔기 때문에 액센트 값을 그대로 쓰면 절반 투명에서 바탕에 묻힌다 |
| `themeColor` 두 값도 같이 (`#fafafa`/`#151c2c`) | 모바일 주소창은 여기만 읽는다. 안 고치면 바탕만 바뀌고 주소창이 옛 색으로 남는다 |

모서리는 **알약을 다 없애고 카드 기준 8px**로 맞췄다(`--radius: 0.5rem`).

| 단위 | 값 | 대상 |
|---|---|---|
| 카드 | 8px (`rounded-lg`) | Card · 모달 패널 · 아코디언 묶음 첫·끝 행 |
| 안쪽 컨트롤 | 6px (`rounded-md`) | 버튼 · 입력 칸 · 배지 · 탭 트리거 |
| 세그먼트 칸 | 4px (`rounded-sm`) | 부서 탭 안의 칸 |
| 원 | `rounded-full` 유지 | 지름 = 높이인 것들 — 점·아바타·건수 배지·게이지 막대·모달 닫기 |

**Motion 안에서는 `var(--radius)`를 못 쓴다.** clip-path 문자열과 `borderRadius` 숫자 prop을
Motion이 숫자로 풀어서 보간하기 때문에 변수를 넣으면 애니메이션이 선다. 그래서
[center-morph-modal.tsx](../src/components/motion/center-morph-modal.tsx)와
[bouncy-accordion.tsx](../src/components/motion/bouncy-accordion.tsx) 두 곳은 8px을 박아 두고
주석으로 `--radius`와 묶어 뒀다.

그 두 값이 어긋나면 눈에 보인다 — **모달 테두리가 두 겹으로 보인 게 그것이었다**. 패널을
`rounded-lg`(8px)로 바꿨는데 열림 clip이 `round 30px`로 남아서, clip이 8px 모서리를 테두리째
잘라내고 그 자리에 30px 실루엣 호만 남았다. 두 값을 8px로 맞추니 사라졌다. clip-path의 `round`는
그 요소의 border-radius와 **같아야 한다**.

버튼 알약은 호출부가 아니라 vendoring한 [button/base.tsx](../src/components/motion/button/base.tsx)
`SIZE_CLASS`에 있었다 — 네 크기 다 `rounded-md`로 고쳤다. 입력 칸 옆에 서는 버튼이 그 줄에서
혼자 다른 곡률이면(`남기기`) 한 줄로 안 읽힌다.

간격은 카드 사이와 제목 아래를 넓혔고, 업무 소식은 **업무명이 제목 자리로 올라왔다**
(업무 목록의 한 줄도 업무명이 제목이라 같은 대상을 두 화면에서 다르게 부르지 않는다). 안 읽음
점은 제목과 한 줄 flex로 묶어 세로 중앙에 놓았고 — `align-middle`은 글자 상자 기준이라 살짝 떴다 —
목록 맨 아래에 `전체 N건 · 안 읽음 M건`을 붙였다. 이 숫자는 **탭과 무관하게 전체 기준**이다.
"안 읽음" 탭에서 세 건만 보일 때 그게 전체 중 몇 건인지가 여기서 읽힌다. 소식이 0건이면 줄을
안 쓴다 — 위 빈 화면이 이미 말한다.

**실화면은 사용자 브라우저로만 봤다.** 자동화 브라우저 프로필의 flow OAuth 토큰이 만료돼
(`MCP 401 OAUTH_TOKEN_INVALID`) 로컬에서 앱 화면이 안 뜬다 — `/login`만 확인했다. 나머지는
사용자가 보내 준 화면으로 잡았다.

### 밝기 세 갈래 (v0.15.0)

밝게 · 어둡게 · 기기 설정. 팔레트 값과 근거는 PRD §7.1에 있다.

| 결정 | 이유 |
|---|---|
| `light-dark()` 한 줄 / 토큰 하나 | `:root` + `.dark` 두 벌이면 색 하나 고칠 때 두 곳을 고친다. 한 곳 빠뜨리면 한쪽 밝기만 틀린다 |
| 쿠키 (not `localStorage`) | 서버가 첫 HTML에 `<html class="dark">`를 박는다 → 번쩍임 없음, blocking script 없음 |
| `system`은 클래스를 안 붙인다 | `color-scheme: light dark`가 그대로 남아 기기를 따라간다. 기기 변화를 지켜보는 코드가 없다 |
| 라디오 버튼 3개 | `<button>` 3개면 좌우 화살표·그룹 이름을 직접 붙여야 한다. 라디오는 브라우저가 이미 그렇게 다룬다 |

**라임은 v0.21.0에서 사라졌다.** 이 절을 쓸 때는 밝게 쪽만 `#4D7C0F`(4.6:1)로 갈아탄
상태였다 — `#C7F751`이 흰 배경에서 1.5:1이라서다. 지금은 두 밝기 다 라임을 쓰지 않는다
(아래 v0.21.0 절).

Tailwind `dark:` 변인은 블록 형태(`@custom-variant dark { … @slot }`)로 바꿔 **기기 설정 어둡게**
에서도 걸리게 했다. 색은 `light-dark()`가 다 처리하는데, shadcn 컴포넌트가 갖고 들어온 `dark:`
여덟 군데(테두리·호버 농도)가 남아 있어서 지울 수가 없다.

두 곳은 밝기를 못 따라간다: **모바일 주소창**(meta `themeColor`는 media 쿼리만 받는다 — 기기
설정을 따른다)과 **PWA 설치 스플래시**(매니페스트 `theme_color`가 한 칸뿐이라 늘 어둡다).

### 헤더 계정 레일 (v0.22.0)

밝기·알림·이름·부서·로그아웃이 헤더 오른쪽에 나란히 서 있었다. beUI `overflow-actions`로
묶어 **접으면 알림 종만** 남고, 아바타 이니셜을 누르면 나머지가 벌어진다. 검색(⌘K)은 레일
밖이다 — 계정과 상관없고 단축키가 주 통로다.
설계는 [specs/2026-07-29-header-overflow-actions-design.md](superpowers/specs/2026-07-29-header-overflow-actions-design.md).

| 결정 | 이유 |
|---|---|
| 원본 항목 API를 버리고 **슬롯**으로 갈았다 | 묶을 넷 중 셋이 `<button>`이 아니다 — 라디오 판, Radix 팝오버 트리거 + 배지, `<form method="post">` 서브밋. `{id,label,icon,onClick}`으로는 하나도 못 담는다 |
| 밝기는 레일 안에서 **순환 버튼** | 한 칸에 라디오 셋이 안 들어간다. 라디오 판(`ThemeToggle`)은 좁지 않은 자리를 위해 남겼다 |
| `aria-label`이 지금 갈래 + **누르면 될 갈래**를 함께 말한다 | 보이는 글자가 "밝게"면 누르면 밝아질 거라고 읽힌다. 펼침처럼 `aria-expanded`에 맡길 상태가 아니다 |
| 바깥 클릭으로는 **안 닫는다** | 알림 팝오버 안을 누르는 것도 트랙 바깥이라 잘못 닫힌다. 레일은 팝오버가 아니라 헤더의 일부여서 열려 있어도 아무것도 가리지 않는다 |
| Escape는 **포털에서 온 것만** 받는다 | 팝오버는 DOM에서는 body로 나가지만 React 트리에서는 레일의 자식이라 keydown이 그대로 올라온다. 그냥 받으면 팝오버를 닫는 첫 Escape에 레일까지 접힌다 |
| 토글 원판은 트랙의 다른 칸과 같은 36px | 32px로 두면 한 줄에서 혼자 작아 보인다. `bg-primary`는 펼친 동안만 — 늘 칠하면 헤더에서 가장 시끄러운 요소가 된다 |

브라우저 실측 (Playwright, 1280×800):

| 항목 | 값 |
|---|---|
| 접힘 → 펼침 폭 | 90px → 172(375) / 217(640) / 303(≥1024) |
| Escape 1회 | 팝오버만 닫히고 포커스는 종으로 |
| Escape 2회 | 레일 접힘 + 포커스 이니셜로 |
| 브랜드 스윕 재시작 | 10.03초 · 20.07초 (`repeatDelay` 9.1 + `duration` 0.9) |
| 줄임 모드 | 스윕 114% 고정·반복 없음, 레일은 90 → 303px 즉시 |
| 로그아웃 | `POST /api/auth/logout` → `/login` |

검증 중에 hydration 오류 세 곳을 찾아 고쳤다 ([bug-report.md](bug-report.md) BUG-029) —
`useReducedMotion()`으로 렌더를 가르면 서버(false)와 줄임 모드 클라이언트(true)가 반드시
어긋난다.

## 검증

```
npx tsc --noEmit   # clean
npm run lint       # 0 error / 1 warning (아래 참고)
npm test           # 86/86
npm run build      # 11 라우트 + proxy
```

**v0.15.0은 실화면으로 봤다.** 로그인 세션이 여전히 없어서, 셸에 목업 소식 6건을 넣은 임시
라우트를 `/login/preview`에 세워 확인했다 (`proxy.ts` matcher가 `login`으로 시작하는 경로를
공개로 두기 때문에 프록시를 건드리지 않아도 됐다). 확인한 것: 밝게 팔레트, 종 레이어가 **아래로**
자라며 6장 + 푸터가 다 보이는 것, 밝게→어둡게 전환이 새로고침 없이 즉시 되는 것. **확인 후
라우트는 지웠다** — 남기면 목업 헤더가 공개로 배포된다.

**v0.16.0도 같은 방식으로 봤다** (임시 `/login/preview` + 목업 6건, 확인 후 삭제). 확인한 것:
여섯 줄이 다 `<a>`로 나오고 `href`가 `…main.act?projectId=317536&postId=…` 형식인 것, 안 읽은
세 줄에만 점이 있는 것, 접근성 이름이 "안 읽음 · 문구 · 시각 · 프로젝트 · 등록자"로 읽히는 것,
Tab 포커스 링이 카드 안쪽에 제대로 그려지는 것(`clip-path`에 안 잘린다), 푸터가 "6 접기" 버튼인 것.

**아직 못 본 것 둘**: 링크가 실제로 그 문서를 여는지, 읽음 처리 후 배지가 하나 주는지. 로그인
세션이 있어야 한다. URL 형식 자체는 `flow_search` 응답으로 확인한 것이라 추측이 아니다.
→ **앞의 것은 v0.18.0에서 "안 열린다"로 판명됐다** ([BUG-024](bug-report.md#bug-024)). 형식이
맞는 것과 로그인 리다이렉트가 대상을 들고 가는 것은 별개였다.

**v0.17.0·v0.18.0도 임시 `/login/preview` + 목업으로 봤다** (확인 후 삭제). v0.17에서 확인한 것:
네 줄이 순서대로 나오는 것, 프로젝트명·업무명이 한 줄에서 잘리는 것, 내용이 두 줄에서 잘리는 것,
카드 폭 328px로 뒷판(352px) 안에 들어오는 것. v0.18에서 확인한 것: 탭이 목록을 실제로 거르는 것
(전체 6 → 읽음 3), 목록만 스크롤되고 탭·전체 읽음이 위에 붙어 있는 것, 넘침 0px.

남아 있는 warning은 [motion/select.tsx:409](../src/components/motion/select.tsx)의
`react-hooks/exhaustive-deps` 하나다 — beUI에서 가져온 코드라 손대지 않았다.

beUI 컴포넌트를 가져올 때 걸리는 린트 규칙이 하나 더 있다. React 19의
`react-hooks/set-state-in-effect`가 `useEffect(() => setMounted(true), [])` 패턴을 막는다.
[center-morph-modal.tsx](../src/components/motion/center-morph-modal.tsx)에서는
`useSyncExternalStore`(서버 스냅샷 false / 클라이언트 true)로 바꿨다 — 하는 일은 같고
렌더가 한 번 덜 돈다. 포털 대상이 `document.body`라 서버 렌더에서는 null이어야 한다.

**멘션 댓글 본문은 실데이터로 확인했다** (07-28). 한동안 "audience 불일치로 거부될 수
있다"고 적어 뒀는데 **틀린 추측이었다** — 원인은 인증 헤더 하나였고(`Authorization: Bearer`
→ `x-flow-api-key`, BUG-013), 고친 뒤 워크리스트 멘션 4건에 4/4 본문·실명·답글 플래그가
붙는다. `.catch(() => null)`이 401을 삼켜서 화면상 구분이 안 됐던 게 진단을 늦췄다.

**눈으로 못 본 것**: 로컬에 로그인 세션이 없어서 아래 둘은 코드·빌드 산출물로만 확인했다.
실화면 확인이 필요하다.

1. 상태 Select 드롭다운(BUG-014)의 클리핑 해제 — 기하 계산으로만 봤다.
2. 데이터 중심 재배치의 진입 모션·막대 — CSS가 프로덕션 번들에 실렸는지는 확인했다
   (`.rise` · `.bar-grow` · `@keyframes rise` · `keep-all` · `text-wrap:balance` 전부 있고,
   `animation` shorthand 뒤에 `animation-delay` longhand가 살아 있어 지연이 적용된다).
   실제로 순서대로 올라오는지는 못 봤다.
3. 숫자 베이스라인(BUG-015)과 상태 배지 색 — 코드로는 맞지만 실제 렌더는 못 봤다.

> 정리할 것: [src/components/ui/](../src/components/ui/)의 `badge.tsx`·`separator.tsx`·
> `tooltip.tsx`와 [status-badge.tsx](../src/components/status-badge.tsx)는 아무 데서도
> import 하지 않는다. `src/lib/flow/`의 `.mcp.ts.swp`·`.queries.ts.swp`(Vim 임시 파일)도
> v0.9.x 때 섞여 들어간 채 남아 있다.
>
> `pretendard` 의존성은 지웠다 (v0.12.5).

---

## 배포 (Vercel)

프로덕션: **https://flow.tenziro.net** (프로젝트 `ai-tenziro/flow-traport`, 도메인 연결됨).

Production 환경변수 7개가 Vercel에 있다 — `FLOW_OAUTH_ISSUER` `FLOW_API_BASE`
`FLOW_API_KEY` `FLOW_CLIENT_ID` `FLOW_CLIENT_SECRET` `FLOW_REDIRECT_URI` `SESSION_SECRET`.
`.env.local`(로컬 개발)과 **자격증명이 분리돼 있다**:

| | 로컬 | 프로덕션 |
|---|---|---|
| OAuth 클라이언트 | localhost redirect_uri로 DCR 등록 | 별도 DCR 등록 (`flow.tenziro.net`), secret 만료 2026-10-26 |
| `FLOW_REDIRECT_URI` | `http://localhost:3000/api/auth/callback/flow` | `https://flow.tenziro.net/api/auth/callback/flow` |
| `SESSION_SECRET` | 개발용 | 별도 랜덤 32바이트 |

주의할 것 셋 ([bug-report.md](bug-report.md) BUG-017):

1. **환경변수는 새 배포에만 적용된다.** 값을 넣은 뒤 `vercel redeploy`가 필요하다.
2. **도메인을 바꾸면 DCR을 다시 해야 한다.** redirect_uri는 OAuth 클라이언트에 박힌다.
3. **Preview 배포에서는 로그인이 안 된다.** Preview URL이 배포마다 바뀌어 redirect_uri로
   등록할 수 없다. 환경변수도 Production에만 넣었다.

**Preview 배포는 로그인 라우트에서 본문 없는 500이 난다** — 환경변수가 없어서다. 프로덕션의
그 500과 같은 증상이니 진단할 때 착각하지 말 것.

### 다중 사용자 — 개인 API 키를 받는다 (v0.13.0)

`@traport.com` 계정이면 누구나 로그인된다 (`isTraport`). 화면 데이터는 각자의 MCP 토큰으로
가져오므로 자기 업무가 맞게 나온다. 문제는 REST 경로 셋이었다 — **API Key 소유자 한 명**
기준이라 다른 사람이 로그인하면 이렇게 됐다 ([rest.ts](../src/lib/flow/rest.ts) 주석):

| 경로 | 공용 키로 돌 때 |
|------|----------------|
| `listMentionAlarms` | `receiverId` 필터로 0건 → 멘션 행은 뜨지만 **본문이 빈다** |
| `resolvePostId` | 소유자가 멤버가 아닌 프로젝트면 `postId`를 못 얻어 **댓글이 막힌다** |
| `listProjects` | 소유자 프로젝트 이름→ID 맵(실측 59개)이 `projectIds`에 깔려 **응답 페이로드에 실린다** |

**로그인할 때 각자 자기 키를 등록하게 해서 셋을 한 번에 덮었다.** 키가 자기 것이면 소유자가
자기 자신이라 세 경로가 모두 자기 기준으로 돈다. DB는 여전히 없다 (PRD §5.3) — 키는 봉인
쿠키에 들어간다.

| 조각 | 파일 |
|------|------|
| 봉인 쿠키 `fc_key` (1년, httpOnly, AES-256-GCM) | [auth.ts](../src/lib/auth.ts) `API_KEY_COOKIE` |
| 키 해소 한 줄 — 인자 → 쿠키 → 환경변수 | [rest.ts](../src/lib/flow/rest.ts) `get()` |
| 검증·저장 서버 액션 (`/user/projects` 1회) | [login/actions.ts](../src/app/login/actions.ts) |
| 최초 1회 모달 (beUI Center Morph Modal) | [login/api-key-gate.tsx](../src/app/login/api-key-gate.tsx) |
| 키 없으면 인증을 시작하지 않는다 | [api/auth/login/route.ts](../src/app/api/auth/login/route.ts) |

정한 것 넷:

1. **세션이 아니라 별도 쿠키다.** 키를 받는 시점이 로그인 버튼을 누른 직후라 세션이 아직
   없고, 세션은 7일이라 거기 담으면 만료마다 다시 물어야 한다. flow는 키를 만료시키지
   않으니 쿠키만 1년으로 두면 한 번 넣고 끝난다.
2. **키는 필수다.** 건너뛰게 두면 멘션 본문이 빈 화면으로 로그인되는데, 사용자는 로그인이
   된 줄 알아서 원인을 못 찾는다. 화면(모달)과 서버(`/api/auth/login`) 양쪽에서 막는다 —
   주소를 직접 열어도 `/login?error=…`로 되돌아온다.
3. **저장 전에 검증한다.** `/user/projects`를 한 번 불러 응답이 오면 유효한 키다. 무효한
   키를 봉인해 두면 다음 로그인부터 조용히 열화된 화면이 뜬다.
4. **키 값은 메시지에도 로그에도 남기지 않는다** (PRD §8.1). 무효한 키와 네트워크 오류를
   구분하지도 않는다 — 어느 쪽이든 사용자가 할 일은 같다.

실측(로컬, 2026-07-28):

| 확인 | 결과 |
|------|------|
| 키 쿠키 없이 `/api/auth/login` | 307 → `/login?error=flow API 키를 먼저 등록해주세요.` |
| 키 쿠키 있고 `/api/auth/login` | 307 → OAuth `/authorize` (PKCE·resource 그대로) |
| 키 쿠키 있고 `/login` | 모달 없이 form GET 하나 (`aria-haspopup` 없음) |
| 무효한 키 제출 | 필드가 흔들리고 "flow에서 발급한 키가 맞는지 다시 확인해주세요." |

#### 남은 구멍

- `listProjects`의 **이름 누수**는 그대로다. 키를 등록하지 않은 사람은 이제 로그인 자체를
  못 하므로 실사용 경로에서는 안 밟히지만, `get()`의 환경변수 폴백이 살아 있는 한(쿠키가
  1년 뒤 만료되고 세션은 남은 경우) `projectIdMap`이 공용 키 목록을 깔 수 있다. 검색 결과에
  있는 이름만 남기면 닫힌다.
- **등록한 키를 갈아 끼우는 화면이 없다.** flow가 키를 만료시키지 않아서 지금은 필요 없다.
  키를 폐기·재발급하면 쿠키를 지워야 한다.
- **본인 외 계정으로는 아직 로그인해 보지 않았다.** 위 표는 코드 근거와 로컬 실측이고,
  다른 사람의 키로 세 경로가 자기 기준으로 도는지는 실측이 아니다.
