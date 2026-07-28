# 개발 진행 상황

버전 0.9.4 · 2026-07-28 기준. 로드맵 정의는 [PRD.md](PRD.md) §11에 있다.

## 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| 0 | flow API·MCP 실측, 인증 경로 확정 | 완료 |
| 1 | 오늘 화면 (읽기 전용) | 완료 |
| 2 | 쓰기 액션 (상태·댓글·업무 생성) | 완료 (알림 읽음 제외) |
| 3 | 리스크 보드 | 완료 |
| 4 | 팀 화면 | 완료 |

기능은 다 붙었다. **아직 실제로 쓰기 도구를 한 번도 호출하지 않았다** — 검증 안 된
가정이 하나 남아 있다 ([bug-report.md](bug-report.md) BUG-005).

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
| [src/lib/auth.ts](../src/lib/auth.ts) | OAuth 2.1 + PKCE, AES-256-GCM 세션 봉인 (Web Crypto만) |
| [src/proxy.ts](../src/proxy.ts) | 로그인 게이트 + 액세스 토큰 자동 갱신 |
| [src/app/api/auth/](../src/app/api/auth/) | login / callback / logout |

토큰은 브라우저에 절대 나가지 않는다. `httpOnly` 봉인 쿠키에만 둔다 (PRD §8.1).
로그인 직후 이메일 도메인이 `@traport.com`인지 확인하고, 아니면 세션을 만들지 않는다.

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

**폰트는 SUIT 하나다.** [public/fonts/SUIT/](../public/fonts/SUIT/) 9단 굵기를
`@font-face`로 넣고 `--font-sans`에 물렸다. Fira Code는 완전히 뺐다 — 코드 폰트를 쓸 자리가
화면에 없다. `layout.tsx`의 `<link>`는 일부러다 (lint 경고 1건은 그 대가다).

> 정리할 것: `pretendard` npm 의존성과 `public/fonts/pretendard/`(92개 파일)가 아직 남아
> 있다. `src/`에서 참조하는 곳은 없다. 지우기 전에 확인이 필요해서 손대지 않았다.

**beUI 컴포넌트로 갈아탄 것** ([src/components/motion/](../src/components/motion/)):

| 자리 | 컴포넌트 |
|------|----------|
| 모든 버튼 | `motion/button` |
| 폼 입력 4곳 | `motion/input` |
| 상태 드롭다운 | `motion/select` |
| 부서 탭 | `motion/tabs` (Segment) |
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

## 검증

```
npx tsc --noEmit   # clean
npm run lint       # 0 error / 2 warning (아래 참고)
npm test           # 62/62
npm run build      # 8 라우트 + proxy
```

남아 있는 warning 2건은 손대지 않았다.

- [layout.tsx:23](../src/app/layout.tsx) `no-css-tags` — SUIT 9단 굵기 `@font-face`를
  일부러 `<link>`로 넣었다
- [motion/select.tsx:401](../src/components/motion/select.tsx) `react-hooks/exhaustive-deps` —
  beUI에서 가져온 코드다

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
> import 하지 않는다. `pretendard` npm 의존성과 `public/fonts/pretendard/`(92개 파일)도
> SUIT으로 갈아탄 뒤로 안 쓴다.
