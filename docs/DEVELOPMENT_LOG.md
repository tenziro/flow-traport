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
| `/tasks` (내 업무) | 담당 업무 전량(실측 951건)을 프로젝트 아코디언으로. 세 무리를 탭으로 갈랐고 완료는 안에서 다시 접는다. 하위 업무는 상위 업무 아래로 들여쓴다 | 운영 |

### 화면 안 기능

- **업무 바꾸기 모달** — 상태·마감일·우선순위·담당자를 flow로 나가지 않고 고친다.
  담당자는 여러 명을 켠다.
- **댓글** — 멘션 댓글 전문을 읽고 그 자리에서 남긴다.
- **업무 소식(종)** — 알림을 전체·안 읽음·읽음으로 나눠 보고, 한 줄을 누르면 flow 문서로
  가면서 읽음이 된다.
- **빠른 검색(⌘K)** — 프로젝트와 글을 찾아 flow 문서로 넘어간다.
- **좌측 레일** — 브랜드·검색·메뉴·계정을 화면 왼쪽 한 줄에 세운다. 접기 단추(또는 ⌘B)로
  68px 아이콘 띠가 되고, 접어 둔 상태는 쿠키(`sidebar`)에 남는다. 좁은 화면에는 레일이
  없다 — 하단 탭 세 개가 대신한다.
- **계정** — 레일 발에 이름·부서·로그인한 이메일을 낸다. 마우스를 올리면(또는 Enter)
  로그아웃이 든 팝오버가 옆으로 열린다. 좁은 화면은 헤더의 로그아웃 단추 하나뿐이다.
- **화면 밝기** — 밝게·어둡게·기기 설정 세 갈래 라디오. 첫 HTML에 박아서 번쩍임이 없다.
- **업데이트 로그** — 푸터 버튼 → 모달에서 버전별로 접어 본다.
- **골격(스켈레톤)** — 화면 넷이 각자 `loading.tsx`를 갖는다. 틀은 실제 클래스를 그대로 쓰고
  글자 자리만 회색 막대라 내용이 도착할 때 배치가 안 튄다 (PRD §7.4.1). 스레드 댓글·참여자·
  검색 결과처럼 화면 안에서 기다리는 자리도 같은 규칙이다.

### 데이터

- flow **MCP**가 주 통로다. 로그인 사용자의 OAuth 토큰으로 부른다.
- flow **REST**는 MCP에 없는 것만 채운다 (게시글 상세·검색·상태 컬럼 등, Tier A·B).
  분당 120회 제한.
- 개인 **API 키**는 암호화해 쿠키에 둔다. 공용 키로는 남의 멘션이 섞여 보인다.

### 플랫폼

- Next.js 16 App Router · React 19 · Tailwind v4 · Motion · beUI(vendoring) · Reicon.
- 색은 `globals.css`의 `light-dark()` 토큰 한 벌. 컴포넌트에 raw hex 금지 (PRD §7.1).
- 유닛 테스트는 `node:test`. 현재 106건.

---

## 변경 이력

### 2026-07-31 — 하위 업무를 상위 업무 아래로 접었다 (v1.3.0)

`기능` 내 업무 화면이 업무를 한 줄기로만 늘어놓고 있었다. 계층을 포기한 근거(§6.5 한계 ①,
"`upTaskName`이 전부 비어 있다 · `mode=TREE`는 미실측")가 **응답을 덜 읽은 결과**였다
([BUG-034](bug-report.md#bug-034)) — `mode`는 아무 효과가 없고, `columns` 밖 최상위의
`upTaskId`가 부모 `taskId`를 정확히 가리킨다(`-1`이 최상위, 실측 채움률 226/226).

`FilterTask`·`MyTask`에 `upTaskId`를 넣고(필드가 안 오면 `-1`), `my-tasks.ts`의 `nest()`가
프로젝트 안에서 부모→자식 순으로 늘어놓는다. **새 API 호출은 0회다.**

정한 것들:

- **부모는 같은 목록에 있는 것만 인정한다.** 하위 191건 중 부모까지 내 담당인 건 26건뿐이고,
  없는 부모를 받으려면 건당 조회 165회 — 분당 상한이 120회다. 못 찾은 하위 업무는 최상위 줄로 둔다.
- **형제끼리는 기존 마감 순(`byUrgency`)이 남고, 부모가 자기 자식보다 급하지 않아도 부모가 위에 온다.**
  정렬한 배열을 순서대로 훑어 DFS로 다시 늘어놓기 때문에 형제 순서가 저절로 보존된다.
- **상태 칩으로 거르는 중에는 들여쓰기를 푼다.** 걸러진 부모 밑에 들여쓴 줄만 남으면 누구 밑인지
  가리키는 데가 없다.
- **끝난 업무는 평평하게 둔다** — 접혀 있는 목록이라 들여쓰기가 정보가 아니라 잡음이다.
- **`subTaskCount`는 읽지 않는다.** 배지를 안 만들기로 했으니(§13 D1) 읽으면 죽은 필드다.
- 부모 사슬이 고리를 이루면 뿌리가 없어 그 무리가 통째로 빠진다 — 못 걸은 줄은 평평하게 뒤에 붙인다.
  건수가 실제보다 적게 보이는 것이 제일 나쁘다.

실측(프로덕션 빌드 + 임시 세션 쿠키): 화면에 들여쓴 줄 14개. 실데이터로 순서까지 확인했다 —
`[HD현대그룹] 출장관리`에서 `트래포트 요구사항 관리` 아래 4건, `HDKSOE-REQ-연계-외부-트래포트-001`
아래 3건이 붙고 건수는 그대로다(안 끝남 15 + 끝남 22 = 37). 2단(손자)은 실데이터에 아직 없어서
단위 테스트로만 덮었다.

- 관련 파일: `src/lib/flow/rest.ts` · `src/lib/flow/my-tasks.ts` ·
  `src/components/project-task-filter.tsx` · `src/app/(app)/tasks/page.tsx` ·
  `src/lib/flow/my-tasks.test.ts`(4건 추가) · `src/lib/flow/rest.test.ts`(1건 추가) ·
  `src/lib/changelog.ts` · `docs/PRD.md`(§6.5 한계 ①·§13 D1·Phase 8) · `docs/bug-report.md`(BUG-034)

### 2026-07-31 — 구성원 화면 설계와 MCP·API 능력 재점검 (문서만)

`문서` 두 가지를 PRD에 넣었다. 코드 변경은 없다.

**① 구성원 화면 §6.6 (설계).** 사람을 보는 자리가 팀 화면(§6.3)뿐인데 거기엔 연락처가 없다. 전사
규모를 먼저 재서(13명 · 부서 3개 · 직책 8종, `hasNext:false`) 화면 크기를 정했다 — 페이징도 서버
검색도 조직도 트리도 없고 `GET /user/search/employees?pageSize=100` **한 번**이면 끝난다. 필드 채움률
실측이 설계의 대부분을 결정했다: 9종(`responsibilityName`·`chargeJobName`·`partName`·`dayoffName`·
`workingTime`·`employeeNumber`·`extensionNumber`·`groupMemberYn`·`outputSequence`)이 **0/13**이라
스펙대로 그렸으면 빈 칸 화면이 됐다. 사진은 9/13, 휴대폰 12/13, 이메일·부서·직책 13/13. 로드맵에
Phase 7로 넣었다. MCP 구성원 도구는 전화번호를 일부러 빼고 사진도 없어서 이 화면은 REST가 아니면
못 만든다 — 부록 A에 적었다.

**② 능력 재점검 §13 D1~D4.** MCP 45종 중 9종, REST 문서화 56개 중 함수 21개만 쓰고 있어서 나머지를
실측으로 다시 훑었다. 건진 건 하나다: `tasks/filter` 응답 **최상위**에 `upTaskId`(`-1`=최상위, 채움률
226/226)와 `subTaskCount`가 이미 와 있다. §6.5 한계 ①의 "`mode=TREE`는 미실측"은 틀렸고(`TREE`·
`tree`·`FLAT` 셋 다 같은 응답), 계층은 추가 호출 0회로 그릴 수 있다 → BUG-034, Phase 8. 천장도
같이 쟀다 — 하위 191건 중 부모까지 내 목록에 있는 건 26건뿐이라 들여쓰기는 그만큼만 붙인다.
`flow_collect_project_chain`은 참여자인 프로젝트에서도 권한 오류라 3개 중 1개만 열렸고
`flow_collect_dept_chain`은 30일 창에 프로젝트 1개만 봤다(팀은 59개에 붙어 있다) — chain 계열은
못 쓴다(BUG-011 재측정). 나머지(하위 업무 만들기 · 체크리스트 · 일정 만들기 · 댓글 수정 ·
`tinyUrl`)는 수요 근거가 없어 Tier C 대우로 남겼다.

- 관련 파일: `docs/PRD.md`(§6 제목·§6.4·§6.5 한계 ①·신설 §6.6·§11 Phase 7·8·§13 재점검·부록 A) ·
  `docs/bug-report.md`(BUG-034 신설, BUG-011 재측정) · `docs/progress.md`

### 2026-07-31 — 프로젝트 막대에 안 끝난 업무를 칠했다 (v1.2.1)

`개선` 내 업무 화면의 프로젝트 막대가 끝낸 쪽(`bg-done`)만 칠하고 나머지를 트랙(회색)으로
남겨서, 그 회색이 "안 끝난 40건"인지 "아직 안 센 것"인지 구별이 안 됐다. `Meter`에 안 끝난
칸(`bg-warning`)을 더해 막대 전체가 그 프로젝트의 업무 전량이 되게 했다 — 위 `⚠ 40건`과 같은
계열 색이라 숫자와 막대가 한 쌍으로 읽힌다. `Meter`가 원래 여러 칸을 받으므로(팀 화면 밀림·임박
막대와 같은 방식) 세그먼트 하나만 더했고, 읽어 주는 라벨도 두 칸이 된다.

끝낸 업무가 0건인 프로젝트는 전에 세그먼트가 다 걸러져 **막대가 사라졌는데**, 이제 안 끝난
칸으로 꽉 찬 막대가 선다.

실측(프로덕션 빌드 + 임시 세션 쿠키 → 줄 마크업을 실제 CSS로 렌더): 236건 중 40건 프로젝트가
보라 196 + 주황 40 비율로 폭을 다 채운다. 모션(`bar-grow`)이 도는 중에는 막대가 0에서 자라므로
스크린샷은 `--force-prefers-reduced-motion`으로 찍었다.

- 관련 파일: `src/app/(app)/tasks/page.tsx` · `src/lib/changelog.ts` · `docs/PRD.md`(§6.5)

### 2026-07-31 — 멘션 본문 아래 댓글 골격이 눌려 있었다 (v1.2.0)

`수정` 멘션 카드에서 `댓글 다 보기`를 누를 때 세우는 골격이 버튼 너비(약 130px)로 눌려서
없는 것처럼 보였다. `ThreadView`의 `<form>`이 `flex flex-wrap items-center` 안의 항목이라
`max-content`로 줄어들었고, 비율 폭(`w-full`)은 그 계산에 0으로 들어가 정작 막대가 형제
글자 폭에 맞춰졌다. `className="basis-full"`로 그 줄에서 혼자 한 줄을 쓰게 했다 — 읽음
버튼은 왼쪽에 그대로 있고 골격과 도착한 댓글이 본문 아래 전폭에 앉는다. 같은 컴포넌트를
쓰는 업무 카드(`task-actions.tsx`)는 세로 블록 안이라 원래부터 정상이었다.

헤드리스 크롬으로 두 배치를 나란히 찍어 실측했다: 눌린 쪽 약 130px, 고친 쪽 약 570px.

- 관련 파일: `src/components/mention-actions.tsx` · `docs/bug-report.md`([BUG-033](bug-report.md#bug-033)) · `docs/PRD.md`(§7.4.1)

### 2026-07-30 — 끝낸 줄에서 댓글을 빼고, 조용한 프로젝트에 길을 냈다 (v1.2.0)

`개선` 내 업무 화면 두 곳. 끝낸 업무 목록에서 마지막 댓글을 걷어내고, 담당 업무가 없는
프로젝트 줄에 flow 링크를 달았다.

- **끝낸 줄에 댓글을 안 낸다** (`DoneTaskRow`) — 처음엔 "어떻게 끝났는지가 거기 적혀 있다"고
  넣었는데, 실측 818건이 이 목록이라 펼치는 순간 한 줄이 세 줄이 되고 화면이 댓글 벽이 됐다.
  댓글 자리 949개 → **131개**(안 끝난 줄만), HTML 4.60MB → 4.48MB. 어떻게 끝났는지는
  `flow에서 열기`로 본다. 감싸던 `div` 하나가 필요 없어져 한 겹 걷었다.
- **담당 0건 21개에 flow 링크** — 이 탭에서 할 수 있는 일이 flow로 가서 찾는 것뿐인데 이름만
  있어서 막다른 칸이었다. 줄마다 `flow에서 열기`를 둔다. 프로젝트에는 짧은 링크가 없어서
  (상세의 링크성 값은 초대 URL 하나뿐) `flowProjectUrl()`로 `main.act?projectId=`를 만든다.
  `quiet`가 이름 배열이 아니라 `{ name, link }[]`가 됐다.
- 검증: tsc · lint 0 error(기존 경고 1) · 106/106 · build 12 라우트. 실화면(프로덕션 + 임시
  세션 쿠키)에서 조용한 줄 21개에 링크 21개, 탭 건수와 일치.
- 관련: `src/components/done-task-row.tsx`, `src/app/(app)/tasks/page.tsx`,
  `src/lib/flow/my-tasks.ts`, `src/lib/flow/queries.ts`, `src/lib/flow/my-tasks.test.ts`,
  `docs/PRD.md` §6.5

### 2026-07-30 — 업데이트 로그 글자를 한 급 내렸다 (v1.2.0)

`개선` 아코디언 기본 글자가 제목·본문 다 15px이었다. 읽고 나가는 곳이라 앱 본문 치수로
맞춘다 — 제목 14px(`text-sm`) · 내용 13px. 같은 모달 안 제목(`text-base`)과의 차이도 그만큼
벌어져 세 층이 갈린다. 아코디언은 모달 안에서만 그려져 SSR HTML에 없으므로 `cn()`에 값을 넣어
`tailwind-merge`가 벤더 클래스를 실제로 밀어내는지 직접 확인했다.

- 관련: `src/components/site-footer.tsx`

### 2026-07-30 — 화면마다 자기 골격 (v1.2.0)

`개선` 네 화면이 제목 + 카드 3장짜리 골격 하나를 같이 쓰고 있었다. 화면마다 단 수와 칸 폭이
달라서 실제 화면이 도착할 때마다 배치가 한 번 튀었다 — 골격이 막으려던 그 튐이다. **틀은 진짜
클래스를 그대로 쓰고 글자 자리만 회색 막대**로 바꿨다 (PRD §7.4.1).

- **나눠 쓰는 부분 일곱 개** (`skeletons.tsx`) — `HeadSkeleton`·`KpiRowSkeleton`·
  `TabBarSkeleton`·`PanelSkeleton`·`TaskRowsSkeleton`·`SummaryCardsSkeleton`·
  `CommentRowsSkeleton`. 훅이 없어서 서버·클라이언트 양쪽에서 부른다.
- **화면 넷이 각자 `loading.tsx`** — 오늘(4단 8:4 격자) · 리스크(탭 + 요약 카드 4장 순위 칸) ·
  팀(팀원 카드 6장, 펼쳐진 채로 온다) · 내 업무(탭이 KPI **아래**다. 59개를 훑어 가장 오래 기다린다).
- **오늘 화면을 `(today)` 무리로 옮겼다** — `(app)/loading.tsx`는 자식 경로 셋의 **부모**
  경계라서 리스크·팀·내 업무를 열면 오늘 골격이 먼저 깜빡였다 (BUG-032, 실측으로 `/risk`
  응답에 골격 두 벌). 무리 이름은 URL에 안 나온다 — 주소는 그대로 `/`다.
- **골격 색을 `bg-foreground/8`로** — shadcn 기본값 `bg-muted`가 밝은 화면에서 배경과 명도
  차이 2%라 안 보였다 (BUG-031). `--muted`와 `--secondary`가 같은 값인 것도 이때 알았다.
- **화면 안 기다림도 같은 규칙** — 스레드 댓글 3줄 · 참여자 알약 5개 · 검색 결과 3줄. 글자 한
  줄(`찾고 있어요`·`불러오는 중…`)이던 자리인데, 결과가 오면 레이어 높이가 열 배로 뛰거나
  저장 버튼이 손 아래에서 밀렸다. 이미 결과가 떠 있으면 골격을 세우지 않는다 — 있던 결과를
  회색 줄로 바꾸는 건 뒤로 가는 것이다.
- 골격에 `rise`를 안 붙인다. 진짜 카드가 그걸로 올라오는데 골격도 올라오면 모션이 두 번 돈다.
  탭 줄은 알약이 아니라 막대 하나다 — 탭 수(부서 수·안 빈 무리 수)는 서버가 답하기 전에는 모른다.
- 검증: 네 화면 모두 골격 트리 **1개**, 막대 `/` 88 · `/risk` 35 · `/team` 69 · `/tasks` 32,
  오늘 화면 일정 칸(`w-[76px]`)은 `/`에만.
- 관련: `src/components/skeletons.tsx`, `src/components/ui/skeleton.tsx`,
  `src/app/(app)/(today)/loading.tsx`, `src/app/(app)/risk/loading.tsx`,
  `src/app/(app)/team/loading.tsx`, `src/app/(app)/tasks/loading.tsx`,
  `src/components/thread-view.tsx`, `src/components/task-actions.tsx`,
  `src/components/search-palette.tsx`, `docs/PRD.md` §7.4.1

### 2026-07-30 — 내 업무 화면 다듬기: 탭·구분선·마지막 댓글 (v1.2.0)

`개선` 첫 구현을 실화면으로 보고 고친 것들이다.

- **프로젝트 38장을 탭 세 칸으로** — `할 일 있어요 24` / `다 끝냈어요 14` / `내 업무 없어요 21`.
  한 줄기로 늘어서면 볼 것과 안 볼 것이 섞인다. 빈 무리는 탭에서 뺀다.
- **목록 줄에 구분선** — 951줄이 여백만으로 갈리면 한 업무가 어디까지인지 안 보인다. 안 끝난
  목록과 끝낸 목록이 같은 `border-b border-border/60`을 쓴다.
- **안 끝난 줄에 마지막 댓글** (`LastComment`) — 오늘 화면은 포커스 픽 topN 20에서 빌려 붙이는데
  여긴 951줄이라 빌릴 데가 없다. 줄마다 REST 한 번이면 분당 상한(120)을 여덟 배 넘긴다.
  `IntersectionObserver`로 **펼쳐서 눈에 들어온 줄만** 부른다 — 접힌 `<details>` 안의 줄은
  화면에 없어서 통과하지 않는다. 서버 액션 `loadLastComment` + 5분 캐시, `systemCode`가 붙은
  변경 로그는 건너뛴다 (`lastHumanComment` — 실측 15건 중 7건이 그것이다).
- **크기 0인 요소는 화면에 들어왔다고 안 볼 수 있다** — 자리를 미리 비우지 않으려고 지켜볼 점을
  `h-0`으로 뒀더니 한 번도 안 걸렸다. `h-px` + `-mb-px`로 실제 크기를 주고 자리만 상쇄한다.
- 관련: `src/app/(app)/tasks/page.tsx`, `src/components/last-comment.tsx`,
  `src/app/(app)/actions.ts`, `src/lib/flow/rest.ts`, `src/lib/flow/queries.ts`,
  `src/components/task-item.tsx`, `src/lib/flow/rest.test.ts`

### 2026-07-30 — 내 업무 화면 (`/tasks`) (v1.2.0)

`기능` 오늘 화면이 내 담당 업무 951건 중 16건만 보여 준다는 실측에서 나온 화면이다 (PRD §6.5,
Phase 6). 참여 프로젝트 59개를 병렬로 훑어 담당 업무 전량을 받고, 프로젝트 아코디언으로 쌓는다.

- **담당자 필터는 서버에서 걸린다** — `tasks/filter`에
  `filterRecords=[{COLUMN_SRNO:"1"(WORKER_ID), OPERATOR_TYPE:"IN", FILTER_DATA:"<userId>"}]`.
  전량을 받아 걸러 내는 게 아니라 내 것만 온다. 필터 값은 **요청에서 받지 않고**
  `loadMyTasks()`가 세션에서 직접 꺼낸다 — 공용 API 키에 남의 ID를 넣어도 그 사람 업무가
  나오기 때문이다 (실측). 값은 flow 짧은 아이디가 아니라 **이메일**이다.
- **`cursor`가 페이지 번호였다** — 아래 `수정` 항목. 고치기 전 680건이 951건이 됐다.
- **상태 두 체계를 `optionCategory`로 통일** — `STTS`(기본)는 `optionName`이 항상 빈 문자열이라
  코드 표(`0` 대기 … `4` 피드백)로 내려가고, `STATUS`(커스텀)는 `optionName`을 그대로 쓴다.
  두 체계가 공통으로 주는 건 `optionCategory`뿐이라 **완료 판정은 `=== "2"`** 하나로 한다.
- **완료 줄은 읽기 전용** (`DoneTaskRow`) — 818건이 완료다. 프로젝트 안에서 다시 접고,
  펼쳐도 제목·상태·마감일·flow 링크만 낸다. 끝낸 업무에 바꾸기 액션을 달 이유가 없다.
- **프로젝트마다 상태 칩** (`ProjectTaskFilter`) — 안 끝난 것 40건이 대기 10·진행 5·보류
  24·피드백 1로 섞인 프로젝트가 있다. 오늘 화면의 `StatusFilter`와 같은 칩인데 **URL 대신
  `useState`**를 쓴다: 서버가 다시 그리면 프로젝트 59회 훑기(캐시가 식으면 7초) + 3MB
  재전송이고, 카드마다 쿼리 키가 붙어 URL이 38칸이 된다. 업무 줄은 서버에서 그려 `row`로
  넘긴다 — `TaskItem`이 서버 컴포넌트라 쓰기 액션이 그대로 따라온다. 칩 겉모양은
  `statusChipClass`·`StatusDot`으로 두 화면이 나눠 쓴다. 상태가 한 종류인 프로젝트에는
  칩이 없고, 같은 칩을 다시 누르면 풀린다. 실측 38장 중 9장에 칩이 붙는다.
- **KPI 세 칸을 색으로 가른다** — `안 끝난 업무`에 준 `primary`가 밝은 화면에서 `#171717`이라
  세 칸이 다 검게 보였다. `warning`(주의는 맞지만 전부 마감을 넘긴 건 아니다 — `danger`는
  리스크 화면의 `밀리는 업무`가 쓴다)과 `done`(프로젝트 줄 `Meter`의 보라와 같은 색)으로
  바꿨다. `Kpi`의 `TONE`에 `done`을 더했다.
- **`대기` 배지가 회색이던 것** — `STATUS_TONE`에 `요청`은 있고 `대기`가 없었다. 같은 상태
  (`STTS` 0)를 flow가 두 이름으로 부르는데 화면은 `대기`를 쓴다 (api-spec §6.1). 색 없는
  칩이 상태 필터에 섞이면 안 되니 `요청`과 같은 `info`로 채웠다 — BUG-028이 "남은 것"으로
  적어 둔 그 줄이다. 실측 이제 회색으로 떨어지는 상태 0건.
- **마감일 없는 업무에 D-DAY를 안 그린다** — 951건 중 785건에 마감일이 없다. 무조건 그리면
  그 줄이 전부 `D-DAY`로 보였다 (`TaskItem`).
- **딥링크는 조립한다** — 이 응답의 `connectUrl`은 전부 빈 문자열이고 `projectId`·`postId`가
  있어서 `flowPostUrl()`로 만든다. 오늘 화면이 검색으로 `projectId`를 찾는 그 단계가 없다.
- 프로젝트 목록은 MCP `flow_list_projects`가 아니라 REST `listProjects()`다 — 그 MCP 도구는
  서버 런타임에서 죽어 있다 (BUG-007). 담당 0건인 21개는 한 줄로 접고, 3페이지를 넘겨
  잘린 프로젝트나 실패한 프로젝트가 있으면 화면 아래에 이름을 적는다 (실측 둘 다 0개).
- 검증: tsc · lint 0 error(기존 경고 1) · 103/103 · build 12 라우트. 실측 59개 프로젝트
  7.1초 · 951건 · 안 끝난 것 133 · 카드 38장 · 조용한 프로젝트 21개. 60초 캐시가 물리면
  0.21초(첫 로드 2.8초). **951줄이 전부 DOM에 있어 HTML이 3.3MB다** — `<details>`로 접는
  방식의 대가고, 지금 건수에서는 감당한다 (PRD §6.5 한계 ⑤).
- 관련: `src/app/(app)/tasks/page.tsx`, `src/lib/flow/my-tasks.ts`,
  `src/components/done-task-row.tsx`, `src/components/project-task-filter.tsx`,
  `src/lib/flow/rest.ts`, `src/components/task-item.tsx`, `src/components/kpi.tsx`,
  `src/components/status-filter.tsx`, `src/components/status-pill.tsx`,
  `src/components/icons.tsx`, `src/components/app-shell.tsx`,
  `src/lib/flow/my-tasks.test.ts`, `src/lib/flow/rest.test.ts`

### 2026-07-30 — 업무 필터 페이징이 첫 100건만 세고 있었다 (v1.2.0)

`수정` `/user/posts/projects/{id}/tasks/filter`의 `cursor`는 **오프셋이 아니라 페이지
번호**다. `page * pageSize`로 계산해 `cursor=100`을 보내면 서버가 오류 없이
`tasks: []` + `hasNext: false`를 줘서 "더 없구나"로 읽힌다. 236건인 프로젝트가 딱 100건으로
보이던 게 이것이었다 (BUG-030).

- 커서 계산을 버리고 응답의 `lastCursor`를 그대로 되돌려 준다. 끝이면 `-1`이다.
- 같은 계산을 하고 있던 `listStaleTasks`도 함께 고쳤다 — 방치 목록도 첫 100건만 보고 있었다.
- 페이징 테스트는 나가는 URL을 붙잡아 `cursor=1`이 나가고 `cursor=100`은 안 나가는 것,
  `lastCursor: -1`에서 멈추는 것, 3페이지 상한에서 `hasMore`가 서는 것을 확인한다.
- 실측 전량 680건 → **951건**.
- 관련: `src/lib/flow/rest.ts`, `src/lib/flow/rest.test.ts`, `docs/api-spec.md` §6.1

### 2026-07-30 — 계정은 레일 발로, 이름은 한 줄로 (v1.1.0)

`개선` 헤더 오른쪽 끝에 있던 이니셜 원판을 레일 발의 계정 줄로 내렸다. 레일 검색에 `⌘K`를
적고, 목록의 업무명·프로젝트명을 한 줄에서 자른다.

- **계정 줄** — 이름·부서·이메일 세 값을 그대로 낸다. v0.23.0에서 "로그인은 한 계정뿐이라
  확인할 일이 없다"며 뺐던 값인데, 레일 발은 헤더와 달리 폭을 다투지 않는다 — 240px 한
  줄을 두 단으로 쓰면 세 값이 다 들어간다. 접히면 28px 원판만 남고 그 중심이 68px 레일의
  중심(34px)에 온다: 발 칸 `px-2` + 줄 `px-3` = 20에서 시작하는 28px → 중심 34.
- **호버로 여는 팝오버지만 라딕스 `HoverCard`가 아니다.** HoverCard 안은 키보드로 짚을 수
  없어서 로그아웃 같은 단추를 두면 마우스 없는 사람에게는 없는 기능이 된다. `Popover`를
  `onMouseEnter`/`onMouseLeave`로 열고, 트리거와 내용 양쪽에 걸어 8px 틈(`sideOffset`)을
  지나는 120ms 동안은 닫지 않는다. `onOpenAutoFocus`는 **호버로 열렸을 때만** 막는다
  (`byHover` ref) — 클릭·Enter로 열면 초점이 들어가야 로그아웃까지 닿는다.
- **높이 81px.** 계정 칸과 페이지 푸터의 `border-t`가 한 줄로 이어져야 한다. 푸터는
  `pt-6` + 두 줄 32px + `lg:pb-6` + 선 = 81px이라, 발 칸을 `p-2`에서 `px-2 py-4`로 고쳐
  32 + 48 + 1 = 81px을 만들었다 (실측 둘 다 `top` 819 / `h` 81).
- 원판 안은 성 대신 👋🏻다. 이름이 바로 옆에 적혀 있어서 첫 글자를 한 번 더 낼 이유가 없다.
- **레일 검색에 `⌘K`** — 팔레트 안의 `esc` 표시와 같은 `kbd` 모양이다. 줄의 자식을
  `justify-between`으로만 바꿔서 `SidebarButton` API는 안 건드렸다. 접히면 레일 밖으로
  나가 `overflow-hidden`에 잘린다 — 접힘 상태로 갈라 그리지 않는다(BUG-029와 같은 부류의
  hydration 어긋남을 피한다).
- **업무명·프로젝트명 한 줄** — 나를 부른 사람들은 제목이 두 줄까지 흐르고 메타 줄이
  접혀서, 어떤 줄은 2단이고 어떤 줄은 3단이었다. 제목은 `line-clamp-2` → `truncate`,
  메타 줄은 `flex-wrap`을 떼고 프로젝트명만 줄어들게 했다(사람·시각은 `shrink-0`).
  업무 줄·리스크 보드·방치 업무 스캔의 제목과 리스크 보드의 프로젝트명도 같이 잘랐다.
  실측 390px에서 넷 다 한 줄 + 말줄임(제목 278px / 프로젝트 102px).
- **좁은 화면 헤더의 이니셜 원판을 뺐다.** 컨트롤 다섯이 좁은 헤더에 서면 종과 로그아웃
  사이가 좁고, 확인할 계정이 하나뿐이라 원판이 하는 말이 없다. 세로선은 남겨 로그아웃을
  갈라 둔다.
- 검증: tsc · lint 0 error(기존 경고 1) · 86/86 · build 11 라우트. 390px `scrollWidth`
  390, 헤더는 검색·밝기·소식·로그아웃 넷.
- 관련: `src/components/app-shell.tsx`, `src/components/motion/animated-sidebar.tsx`,
  `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/risk/page.tsx`,
  `src/components/task-item.tsx`, `src/components/stale-scan.tsx`

### 2026-07-30 — 메뉴를 좌측 레일로 (v1.0.0)

`구조` 상단 바 2행을 걷고 화면 왼쪽에 레일을 세웠다. 레일이 브랜드·검색·메뉴를 들고, 헤더는
본문 칸 위에만 남아 접기 단추와 지금 있는 화면 이름을 든다 (beUI `animated-sidebar`).

- **`⋯` 계정 레일은 여기서 사라졌다.** v0.22.0에 넣고 v0.23.0에 원본 모양으로 되돌렸던
  `motion/overflow-actions.tsx`를 지웠다 — 헤더에 여섯 덩어리가 늘어서던 문제 자체가
  없어졌다. 밝기는 라디오 판(`ThemeToggle`)으로 돌아왔다.
- **접힘은 쿠키다** (`lib/sidebar.ts` · `sidebar=0|1`). 첫 HTML이 이미 접힌 폭으로
  오므로 펼쳤다 접히는 번쩍임이 없다 — 밝기 쿠키와 같은 방식이다. `⌘B`로도 여닫는다.
- **모바일은 그대로다.** 레일은 `lg` 미만에서 `display:none`이고 하단 탭 세 개가 남는다.
  세 곳(레일·헤더·하단 탭)이 같은 `NAV` 배열을 읽는다.
- 관련: `src/lib/sidebar.ts`(신규), `src/lib/sidebar.test.ts`(신규),
  `src/components/motion/animated-sidebar.tsx`(신규), `src/components/app-shell.tsx`,
  `src/app/(app)/layout.tsx`, `src/components/motion/overflow-actions.tsx`(삭제)

### 2026-07-30 — 계정 레일을 beUI 원본 모양으로 (v0.23.0)

> **v1.0.0에서 이 레일을 걷어냈다.** 상단 바가 없어지면서 묶을 대상 자체가 사라졌다.
> 아래는 그때의 기록이다.


`개선` 레일 토글을 이니셜 원판에서 beUI `overflow-actions` 원본 모양으로 되돌렸다. 이름·부서
두 줄은 뺐고, 레일과 헤더 검색은 알약으로 갈았다.

- **토글** — 늘 `bg-primary`이고 `⋯`(`MoreH`, `Filled`) ↔ `✕`를 blur로 갈아치운다
  (`AnimatePresence mode="popLayout"`). v0.22.0의 이니셜 원판은 되돌린 것이다: 아바타는
  신분 표시라 "누르면 뭔가 나온다"는 말을 못 한다. 접힌 트랙에서 색을 가진 것이 이 원판
  하나뿐이라 이것만 보고 펼칠 데가 있다는 걸 안다. 점 셋은 `Filled`다 — 16px에서 Outline
  링 셋은 점이 아니라 작은 고리로 보인다.
- 원본은 변이 안에 `transition`을 박아 둬서 줄임 모드에서 끌 방법이 없다. 밖으로 빼
  `ICON_TRANSITION`으로 두고 `transition` prop으로 넘긴다. **렌더되는 prop을
  `useReducedMotion()`으로 가르지 않는다** — BUG-029와 같은 hydration 어긋남이 된다.
- **이름·부서 두 줄을 뺐다.** 로그인은 한 계정뿐이라 화면에서 확인할 일이 없는데 펼침 폭의
  절반을 먹었다 (실측 303px → 257px). 이름은 토글 `aria-label`에 남아 스크린 리더로는
  그대로 읽힌다. `toggle` 슬롯 prop도 함께 없앴다 — 아이콘이 하드코딩이라 쓸 데가 없다.
- **알약** — 트랙을 원본 `rounded-full`로 되돌리고 안쪽 항목(종·밝기·로그아웃)과 헤더
  검색도 맞췄다. 검색은 레일 밖이라 테두리를 줘서 트랙과 같은 급으로 보이게 했다.
- **높이는 36px.** 원본 여백(`p-1.5`)대로면 트랙이 50px이고 헤더가 56px이라 알약 하나가
  헤더를 거의 다 먹었다. 여백을 `p-px`로 줄이고 항목을 32px로 낮춰 트랙 36px을 만들었다
  (테두리 2 + 여백 2 + 항목 32). 검색도 `min-h-9`로 같은 36px이다 — `border-box`라
  `min-h-12`는 테두리를 안에 세어 48px이 된다.
- 검증: 접힘 90px / 펼침 251px, 검색·트랙 모두 36px `top` 10px, 토글 32×32
  `rgb(47,111,235)`, 아이콘 `d`가 `⋯`↔`✕`로 바뀌는 것과 나가는 쪽 `blur(3px)` 확인.
  줄임 모드·기본 모드 모두 hydration 오류 0. 86/86 · lint 0 error · build 11 라우트.
- 관련: `src/components/motion/overflow-actions.tsx`, `src/components/app-shell.tsx`,
  `src/components/icons.tsx`, `src/components/search-palette.tsx`,
  `src/components/news-bell.tsx`, `src/components/theme-toggle.tsx`, `docs/PRD.md` §7.3

### 2026-07-30 — 본문이 터져도 셸은 남는다 (v0.23.0)

`기능` `(app)/error.tsx`를 뒀다. 없을 때는 flow 호출 한 번이 실패하면 셸이 그려진 200ms쯤
뒤에 헤더·탭바·푸터까지 사라지고 Next의 기본 오류 화면만 남았다. 이제 본문 자리만 오류
카드로 바뀐다.

- 세 화면이 공유한다 — 같은 이유로 터지므로 화면별로 나누지 않았다. `loading.tsx`와 같은
  자리·같은 이유다.
- 원인은 대개 flow 토큰 만료(MCP 401)지만 **운영 빌드에서 `error.message`는 지워지고
  `digest`만 온다.** 원인으로 갈라 말할 수 없어서 `다시 시도`와 `다시 로그인` 두 길을 함께
  뒀다. 문의용으로 `digest`를 "오류 번호"로 보여 준다.
- `reset()`만으로는 부족하다. 서버 컴포넌트가 던진 것이라 클라이언트에서 다시 그려도 같은
  페이로드를 다시 읽는다 — `router.refresh()`로 서버에 새로 물어야 한다. 실측: 누르면
  `GET /?_rsc=…`가 나간다.
- 레이아웃 자신이 던지는 건 못 받는다. 다만 `(app)/layout.tsx`가 쓰는 건 세션 쿠키와
  `loadNews`(실패하면 `null`)뿐이라 터질 자리가 없다.
- 함께: 라디오 판 `ThemeToggle`을 지웠다. v0.22.0에서 헤더가 `ThemeCycle`로 갈아탄 뒤
  사용처가 없다. `cn` import도 같이 빠졌다.
- 검증은 로컬에서 죽은 토큰으로 세션 쿠키를 만들어 확인했다 (`SESSION_SECRET`으로 봉인,
  `expiresAt`을 미래로 둬서 proxy 갱신을 안 타게). 헤더·탭바·푸터·계정 레일 전부 살아 있고
  본문만 카드로 바뀐다.
- 관련: `src/app/(app)/error.tsx`(신규), `src/components/theme-toggle.tsx`, `docs/PRD.md` §7.4

### 2026-07-29 — 헤더 계정 레일 + 브랜드 스윕 반복 (v0.22.0)

`기능` 밝기·알림·사용자 정보·로그아웃을 beUI `overflow-actions` 한 줄로 묶었다. 아바타
이니셜이 펼침 토글이고, 접으면 알림 종만 남는다. 헤더 브랜드(`flow Cockpit`)는 10초마다
색이 한 번 흐른다.

- `motion/overflow-actions.tsx` — 원본은 항목을 `{id,label,icon,onClick}` 배열로 받는데,
  묶을 넷 중 셋이 버튼이 아니다(라디오 판·Radix 팝오버 트리거·`<form method="post">`).
  **슬롯 방식으로 갈아냈다**: `children`(늘 보임) / `overflow`(펼침) / `toggle`(원판 안).
  살린 것 — 스프링, 접힐 때 나가는 그룹을 제자리에 못 박는 `useLayoutEffect` 위치 보정,
  `AnimatePresence mode="popLayout"`, blur-in. 버린 것 — 항목 API와 크기 맵 다섯 개.
- 밝기는 레일 안에서 라디오 셋이 들어갈 자리가 없어 **순환 버튼**(`ThemeCycle`)을 새로
  뒀다. `lib/theme.ts`에 `nextTheme()`을 추가하고 실패 테스트부터 썼다. 라디오 판
  (`ThemeToggle`)은 지우지 않았다 — 좁은 자리를 위한 다른 모양이다.
- `aria-label`이 "지금 갈래 + 누르면 될 갈래"를 함께 말한다. 조사는 표로 뒀다 —
  "기기 설정"만 받침이 있어서 라벨에 조사를 붙여 조립하면 "기기 설정로"가 된다.
- `ChromaticTextReveal`에 `repeatDelay`를 더했다. 원본 반복 장치는 어절을 갈아치우는
  방식이라 어절이 하나면 갈 곳이 없어 즉시 빠져나갔다 — 별도 `cycle` 카운터를 키에 섞어
  같은 어절도 다시 흐르게 했다. 스윕 색은 `SWEEP_CHART`(차트 팔레트)를 쓴다.
- **hydration 오류 두 건을 뿌리에서 잡았다.** `useReducedMotion()`은 서버에서 false·
  클라이언트에서 true라, 렌더 결과가 이 값으로 갈리면 반드시 어긋난다. `whileTap`을
  지우는 분기는 motion이 `tabIndex={0}`을 서버에만 심게 만들었고(`overflow-actions`,
  `button/base`), `ChromaticTextReveal`의 `initial`·`style` 분기는 시작 스타일을 서버에만
  남겼다. 셋 다 분기를 없애고 값으로 껐다 — `transition`의 `duration: 0`이 이미 같은 일을
  한다. 자세한 것은 `docs/bug-report.md` BUG-029.
- Playwright로 실측: 접힘 90px → 펼침 172(375) / 217(640) / 303(≥1024). Escape 1회는
  팝오버만, 2회에 레일이 접히고 포커스가 이니셜로 돌아온다. 스윕 재시작 10.03초·20.07초.
  줄임 모드에서는 스윕이 114%에 고정되고 반복이 멈추며 레일은 즉시 벌어진다.
- 관련: `src/components/motion/overflow-actions.tsx`(신규), `motion/chromatic-text-reveal.tsx`,
  `motion/button/base.tsx`, `theme-toggle.tsx`, `app-shell.tsx`, `lib/theme.ts`,
  `lib/theme.test.ts`, `app/login/page.tsx`, `docs/PRD.md`

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
