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
| `/` (오늘) | 임박·밀림·포커스·방치 업무, 나를 부른 사람들, 요약 카드 4칸. 포커스는 내가 답장한 `피드백` 업무를 뺀다 | 운영 |
| `/risk` | 프로젝트별 위험도 보드, 프로젝트에 업무 추가 | 운영 |
| `/team` | 부서 탭, 팀원별 업무 현황, 팀 일정 | 운영 |
| `/tasks` (내 업무) | 담당 업무 전량(실측 951건)을 프로젝트 아코디언으로. 세 무리를 탭으로 갈랐고 완료는 안에서 다시 접는다. 하위 업무는 상위 업무 아래로 들여쓴다 | 운영 |
| `/members` (구성원) | 전 직원 주소록. 부서 탭 + 직책 순 카드 격자, 이메일·번호 복사. 업무 정보는 넣지 않는다 | 운영 |

### 화면 안 기능

- **업무 표** — 오늘·리스크·팀·내 업무 네 화면이 같은 표 한 벌을 쓴다(`TaskTable`).
  업무명·프로젝트·진행상태·마감일 네 칸이고 내 업무 화면만 등록일이 더 붙는다(그 응답에만
  있는 값이다). 리스크는 프로젝트 대신 담당자 칸을 켠다. 칸 이름을 눌러 정렬하고, **칸
  경계를 끌어 폭을 바꾸고**, 표 위 상태 칩으로 화면을 다시 안 부르고 거른다. 나를 부른
  사람들만 칸이 다르다 — 업무명·프로젝트·부른 사람·시각이고, 업무명 옆에 말풍선 + 댓글 수를
  붙인다(안 읽은 게 남았으면 꽉 찬 색).
- **업무 상세 모달** — 표에서 업무명을 누르면 열린다. 추천 이유·점수·**업무 본문**·댓글을
  읽고 상태·마감일·우선순위·담당자를 flow로 나가지 않고 고친다(담당자는 여러 명을 켠다).
- **댓글** — 상세 모달과 멘션 패널에서 전문을 읽고 그 자리에서 남긴다. 모달은 최신 세 개를
  펼쳐 두고 나머지는 갯수 줄 오른쪽 끝 `댓글 다 보기`로 연다 — 댓글의 태반이 상태 변경
  기록이다. 사람 댓글에는 `답글`이 붙어 그 말에 답을 단다. **답글은 남긴 뒤 flow에서
  본다** — flow API가 답글을 돌려주지 않는다(api-spec §13.1).
- **업무 소식(종)** — 알림을 전체·안 읽음·읽음으로 나눠 보고, 한 줄을 누르면 flow 문서로
  가면서 읽음이 된다. **1분마다 스스로 당겨 온다**(`/api/news`) — flow가 알림을 밀어 주지 않아서
  폴링이 유일한 길이다. 탭을 다시 보면 그 자리에서 한 번 더 당긴다. 넓은 화면에서는 종 아래
  팝오버로, **좁은 화면(<1024px)에서는 아래에서 올라오는 바텀시트**로 열린다 — 판 안쪽은 같다.
- **빠른 검색(⌘K)** — 프로젝트와 글을 찾아 flow 문서로 넘어간다.
- **좌측 레일** — 브랜드·검색·메뉴·계정을 화면 왼쪽 한 줄에 세운다. 접기 단추(또는 ⌘B)로
  68px 아이콘 띠가 되고, 접어 둔 상태는 쿠키(`sidebar`)에 남는다. 좁은 화면에는 레일이
  없다 — 하단 탭 다섯 개가 대신한다.
- **계정** — 레일 발에 flow 프로필 사진(없으면 `👋🏻`)과 이름·부서·로그인한 이메일을 낸다.
  마우스를 올리면(또는 Enter) 상태 메시지와 나의 일정·로그아웃이 든 팝오버가 옆으로 열린다.
  좁은 화면은 헤더의 로그아웃 단추 하나뿐이다.
- **나의 일정** — 셸이 어느 화면에서나 낸다. 넓은 화면은 계정 팝오버의 "나의 일정"을 누르면
  오른쪽에서 서랍이 들어오고(건수는 단추에 함께 적힌다), 좁은 화면은 헤더의 달력 단추가
  아래에서 바텀시트를 올린다. 목록은 한 컴포넌트를 같이 써서 껍데기만 폭에 따라 갈린다.
  창은 오늘부터 이레(달력 주가 아니다)고 날짜 소제목으로 하루씩 끊는다.
  줄마다 시각 옆에 달력 색 막대, 반복 일정이면 이름 뒤에 반복 표시, 프로젝트 일정이면
  아래에 flow 링크가 붙는다 — 셋 다 목록 응답에 이미 있는 값이라 호출이 안 늘어난다.
  오늘 화면에만 있던 카드였는데 셸로 올리면서 그 카드는 뺐다.
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
- 유닛 테스트는 `node:test`. 현재 124건.

---

## 변경 이력

### 2026-08-04 — 업무 상세 모달의 가운데만 스크롤한다 (v3.0.1)

`개선` **머리와 바닥을 제자리에 두고 값·이유·본문·댓글만 스크롤한다.** 상세 모달은 열고 나서
값 다섯 줄과 본문·댓글이 뒤이어 도착하는데, 다 차면 패널이 화면보다 길어져서 오버레이가
스크롤했다 — 내려 읽는 동안 업무명(지금 무엇을 보는지)과 오른쪽 아래 `닫기`(나가는 길)가
같이 위로 밀려 사라졌다.

가운데 세 덩어리를 칸 하나로 감쌌다:

```
max-h-[min(60vh,calc(100dvh-16rem))] overflow-y-auto border-b [&>*:last-child]:border-b-0
```

- **`60vh`에 `100dvh - 16rem` 상한을 겹쳤다.** `60vh`만 쓰면 낮은 화면에서 머리+바닥+여백을
  더한 패널이 화면보다 커져 오버레이가 대신 스크롤한다 — 그러면 고정한 의미가 없다.
  16rem은 패널 위아래 여백(4rem) + 머리(약 7.5rem) + 바닥(약 3rem)이다.
- **아래 선을 칸으로 옮겼다.** 덩어리마다 붙은 `border-b`는 내용과 같이 밀려 올라가서 바닥과의
  경계를 못 잡는다. 마지막 덩어리 것만 끈다 — 안 끄면 다 내렸을 때 두 겹으로 보인다.
  어느 덩어리가 마지막인지가 `projectId`·`pick`에 따라 달라서 `[&>*:last-child]`로 잡는다.

BUG-039의 오버레이 스크롤 칸은 그대로 둔다 — 이 상한을 넘기는 낮은 화면에서 여전히 마지막
방어선이다. 마감일 달력은 Portal로 `body`에 나가서(BUG-026) 이 `overflow` 칸에 안 잘린다.

멘션 상세 모달은 그대로 뒀다 — 알림 목록 하나뿐이라 아직 화면을 넘기지 않는다.

- 관련: `src/components/task-detail-modal.tsx`, `src/lib/changelog.ts`, `package.json`,
  `docs/progress.md`

---

### 2026-08-04 — 모달 벤더를 beUI morphing-modal로 갈았다 (v3.0.0)

`구조` **`center-morph-modal.tsx`를 걷고 `morphing-modal.tsx`를 벤더링했다.** beUI에는
두 컴포넌트가 따로 있다 — 이름만 바꾼 게 아니라 다른 부품이다. 상류 `morphing-modal`은
`viewId` 하나로 여닫는 단일 패널이고, 값이 바뀌면 패널이 높이를 맞춰 늘었다 줄면서 안쪽
내용이 블러로 교차한다. 예전 것은 `Modal`/`Trigger`/`Content`/`Close` 네 조각을 조립하는
합성 API에 가운데서 `clip-path`로 펼치는 모션이었다.

| 걷은 것 | 대신 |
| --- | --- |
| `CenterMorphModal` 컨텍스트 + `Trigger` + `Close` | 호출자가 `useState`로 여닫는다. `viewId`가 `null`이면 닫힌 것 |
| 트리거 DOM을 ref로 넘겨 초점을 되돌리던 길 | 열 때의 `document.activeElement`를 기억한다 — 표 두 곳에서 `trigger` ref 뭉치가 사라졌다 |
| `clip-path` 가운데 펼침 | 상류 `layout` + `SPRING_PANEL` 높이 모프 |
| `placement` prop | 아래 붙는 패널은 `bottom-sheet.tsx`가 따로 있다 |

상류에 없는 것 일곱 개(포털·초점 가두기·Escape·`role="dialog"`·긴 내용 스크롤·`z-[100]`과
모서리·`placement` 제거)는 손으로 다시 넣고 새 파일 머리 주석에 **벤더 이탈 1~7**로 적었다.
BUG-039의 스크롤 칸은 그대로 옮겨 왔다(이탈 5).

호출처 다섯 곳을 다시 짰다. `task-detail-modal.tsx`·`mention-table.tsx`의 상세 덩어리는
패널 태그를 벗고 조각(`<>…</>`)이 됐고 `onClose`를 prop으로 받는다 — 패널 속성
(`ariaLabel`·`ariaDescribedBy`·`showCloseButton`·`className`)은 모달을 들고 있는 표로 올라갔다.
`aria-describedby`가 제목 id와 같은 값을 봐야 해서 두 파일이 `descIdOf`를 내보낸다.
`api-key-gate.tsx`·`site-footer.tsx`는 `Trigger` 대신 자기 버튼과 `useState`를 갖는다.

`z-[100]`·모서리 8px은 그대로라 달력 팝오버(`z-[110]` — BUG-026)와 `--radius` 짝은 안 건드렸다.
파일 이름을 가리키던 주석 여섯 곳(`date-field.tsx`, `motion/bottom-sheet.tsx`,
`motion/drawer.tsx`, `motion/bouncy-accordion.tsx`, `lib/hooks/use-narrow-screen.ts`)을 새
이름으로 옮겼다.

> **렌더 중 ref 쓰기는 React 19 린트가 막는다.** `onClose`를 이펙트 의존성에서 빼려고
> `latest.current = { onClose, dismissible }`를 렌더 본문에 뒀더니
> `Cannot access refs during render`가 났다. 값을 싣는 이펙트를 하나 따로 뒀다 — 키 이벤트는
> 렌더보다 늦게 오니 하는 일은 같다.

- 관련: `src/components/motion/morphing-modal.tsx`(신규),
  `src/components/motion/center-morph-modal.tsx`(삭제), `src/components/task-table.tsx`,
  `src/components/task-detail-modal.tsx`, `src/components/mention-table.tsx`,
  `src/app/login/api-key-gate.tsx`, `src/components/site-footer.tsx`,
  `src/components/date-field.tsx`, `src/components/motion/bottom-sheet.tsx`,
  `src/components/motion/drawer.tsx`, `src/components/motion/bouncy-accordion.tsx`,
  `src/lib/hooks/use-narrow-screen.ts`, `docs/PRD.md`, `docs/bug-report.md`,
  `docs/progress.md`, `src/lib/changelog.ts`, `package.json`

---

### 2026-08-03 — 답글 남기기, 멘션 표 말풍선 숫자, 긴 모달 잘림 (v2.2.0)

`기능` **댓글에 답글을 남긴다.** 사람 댓글 줄마다 `답글`이 붙고(시스템 기록에는 안 붙인다 —
답할 상대가 없다), 누르면 입력칸이 그 댓글에 붙는다: 위에 "○○님에게 답글" 한 줄과
`그만두기`, 커서도 입력칸으로 옮긴다(목록 위쪽에서 누르면 입력칸을 다시 찾아 눌러야 했다).
`createComment`가 `replyToRemarkId`를 받아 `flow_create_comment`로 넘긴다.

> **답글은 쓸 수만 있고 읽을 수는 없다** (실측 2026-08-03, api-spec §13.1·§13.2).
> `GET /user/comments/{postId}`는 **최상위 댓글만** 준다 — 게시글 79974281은 `remarkCount` 2에
> 목록도 2건인데 그중 하나의 `REPLY_CNT`가 `"3"`이고 그 답글 셋은 응답에 없다. 답글을 읽는
> 경로도 없다(경로 후보 6종 → 404, 쿼리 후보 5종 → `VALIDATION_ERROR`, **후보 11개 전패**).
> 그래서 (1) 성공 문구가 "답글은 flow에서 볼 수 있어요"까지 말하고, (2) **모달 스레드에는
> 들여쓸 답글이 없다** — 들여쓰기는 알림이 부모·답글을 갈라 주는 멘션 상세 모달에만 있다
> (`MentionDetail`, `MentionAlarm.replyId`).

`개선` **`@[이름](id)`에서 `@`까지 뗀다** (`stripMentions`). 전에는 `@이름`으로 남겼는데,
flow에서 이름을 부르는 건 알림을 보내는 동작이라 우리 화면에서는 누를 데도 없는 표시다.
한 댓글에 서너 명이 불려 있으면 `@`가 줄머리를 채워 본문이 안 읽혔다. 이 함수 하나가
모달·멘션·업무 줄 세 자리를 다 지나서 한 곳만 고쳤다.

`개선` **나를 부른 사람들 표에서 `마지막 말` 칸을 걷고 업무명 옆에 말풍선 + 숫자를 뒀다.**
한 줄에 잘려 들어간 120자는 무슨 말인지 알기에는 모자라고 훑기에는 길다 — 몇 마디 있나만
알리고 본문은 모달에서 읽는다. 칩은 업무명 **뒤**다(앞에 두면 줄 번호처럼 읽힌다). 안 읽은
게 남았으면 꽉 채우고 다 읽었으면 옅게 — 나란히 놓였을 때 눈이 먼저 가는 쪽이 아직 답
안 한 쪽이다. 걷은 26%를 나눠 폭 합계를 100%로 맞췄다(업무명 50 · 프로젝트 18 · 부른 사람
16 · 시각 16).

`개선` **`댓글 다 보기`를 댓글 갯수와 같은 줄 오른쪽 끝으로 옮겼다.** 둘 다 "이 목록이
전부냐"에 대한 답이라 같은 줄에서 읽힌다 — 아래 줄에 따로 두면 목록의 첫 줄처럼 보였다.

`수정` **내용이 긴 모달이 위아래로 잘렸다.** 벤더(`center-morph-modal.tsx`)가 스크롤 칸에
`items-center`를 걸어서, 내용이 화면보다 길면 위로 넘친 만큼이 스크롤 범위 밖에 남아
**끝까지 못 올라갔다**(flexbox + overflow의 알려진 동작). 안쪽에 `min-h-full`을 쓴 열 방향
flex를 넣어 짧을 때는 가운데, 길 때는 위에서부터 자라게 했다 — 벤더 이탈 #4로 적었다.
호출자마다 높이를 재는 대신 칸 하나를 고쳐서 앱의 모든 모달이 같이 낫는다.

`개선` **죽은 `LastComment` 덩어리를 걷었다.** v2.0.0에서 내 업무 화면이 `TaskTable`로 바뀌고
댓글이 모달 스레드로 옮겨 가면서 `last-comment.tsx`를 부르는 곳이 없어졌는데, 그 아래로
매달린 것들이 그대로 남아 있었다 — 서버 액션 `loadLastComment`, 조인 함수 `withLastComment`,
`WorklistTask.lastComment` · `FocusPick.lastComment` 필드, 그리고 **아무도 안 읽는 값을
채우려고 포커스 도구에서 15개를 더 받던 `topN: 20`**. 화면에 안 나오는 값을 위해 오늘 화면이
매번 픽 20개를 받고 그 20개의 프로젝트 이름을 다 풀고 있었다. `topN`을 `FOCUS_CHECK`(8)로
내렸다 — 포커스 5개를 채우는 데 실제로 필요한 수다. `lastHumanComment`는 남긴다:
피드백 업무에 내가 마지막으로 답했는지 보는 `answeredByMe`가 아직 쓴다.

관련 파일: `src/app/(app)/actions.ts`, `src/lib/flow/rest.ts`, `src/lib/flow/rest.test.ts`,
`src/lib/flow/queries.ts`, `src/lib/flow/my-tasks.ts`, `src/components/last-comment.tsx`(삭제),
`src/components/task-thread.tsx`, `src/components/thread-view.tsx`,
`src/components/task-actions.tsx`, `src/components/mention-table.tsx`,
`src/components/motion/center-morph-modal.tsx`, `docs/api-spec.md`, `docs/PRD.md`

### 2026-08-03 — 상세 모달 본문·댓글, 표 칸 순서·면색·폭 조절 (v2.1.0)

`기능` 상세 모달에 **업무 본문**을 넣고 댓글 덩어리를 다시 짰다 (`task-thread.tsx`,
`loadTaskPost`). 본문은 `flow_get_post`의 `outContent`다 — 실측(postId 81211887)에서
`content`는 `contentJsonYn: "Y"`일 때 JSON이고 `htmlContent`는 태그가 붙어 오는데,
`outContent`만 그대로 낼 수 있는 평문이다. 댓글은 게시글 상세의 `remarks`로는 부족하다
(실측 14건 중 2건만 온다, api-spec §6.3) — `GET /user/comments/{postId}`를 따로 부른다.
두 값을 `Promise.all`로 한 번에 당기고 본문 실패는 삼킨다(`.catch(() => null)`) — 곁가지가
죽어도 댓글은 떠야 한다.

**댓글은 최신 세 개만 펼쳐 두고 나머지는 `댓글 다 보기`로 연다.** 실측 14건 중 10건이 사람
댓글이 아니라 상태·마감일 변경 기록이라, 다 펼치면 모달이 기록 목록이 된다. 감춰지는 쪽이
위(오래된 것)라서 단추도 목록 **위**에 둔다. 입력칸은 제일 아래다 — 위를 읽고 그 끝에 말을
붙이는 순서다. 남기고 나면 목록을 다시 부른다(`CommentForm.onSaved`) — `revalidatePath`가
실측 6.5초라 그동안 방금 남긴 말이 안 보이면 남았는지 알 수 없다(BUG-037과 같은 부류).
멘션 패널과 모달이 같은 줄 모양을 쓰도록 `CommentRows`를 뽑았다.

`개선` **업무명을 첫 칸으로 옮겼다** (`TaskTable`·`MentionTable`). 프로젝트가 앞이면 같은
이름이 줄마다 반복되는 칸을 먼저 읽고 나서야 업무명에 닿는다 — 찾는 것은 업무다. 프로젝트
이름은 `text-muted-foreground`로 한 톤 내렸다. 본문색이면 반복되는 이름이 업무명과 같은
무게로 서서 눈이 먼저 그쪽에 걸린다. 정렬은 그대로다 — `readSortValue`가 `cell`이 아니라
행의 값을 읽는다.

`개선` **번호 배지와 업무명을 `flex … items-center`로 묶었다.** 배지가 `inline-block`에
`align-[-2px]`로 기준선에 매달려 있었는데, 한글 글자가 자기 줄 안에서 조금 낮게 앉아 배지가
늘 위로 떴다 — 픽셀을 세는 대신 두 덩이를 같은 축에 세운다. 업무명은 `min-w-0 truncate`
span으로 감싸야 말줄임이 살아 있다(flex 아이템 기본 `min-width: auto`).

`개선` **표에서 회색 면을 걷었다.** 겉테두리 `bg-background`(#fafafa) → `bg-transparent`,
머리 줄 `bg-muted`(#f5f5f5) → `bg-card`. 이 표는 늘 `Card`(`--card` #ffffff) 안에 들어서
원본 색이 카드보다 한 톤 어두운 판으로 읽혔다. 머리 줄만 투명이 아닌 이유는 `sticky`라 —
진짜 투명이면 아래로 지나가는 줄이 머리 줄을 통과해 겹쳐 보인다. 줄 위 `hover:bg-muted/50`은
남긴다(면색이 아니라 손이 어디 있는지 표시다). 골격의 머리 줄도 같이 맞췄다.

`기능` **칸 폭을 끌어서 바꾼다.** beUI 표에 이미 있던 `resizable`을 두 표에 켰다 —
칸 경계를 잡아 끌면 그 칸만 넓어지고 나머지는 픽셀로 굳는다(`useColumnResize`가 첫
드래그에 전 칸을 실측해 스냅샷을 뜬다). 업무명 길이가 사람마다 달라 고정 비율로는 누군가는
늘 잘린다. 손잡이는 `tabIndex={-1}`이라 키보드로는 못 끈다 — 벤더 그대로 뒀다. 폭은 표가
붙어 있는 동안만 남는다(새로 고치면 비율로 돌아간다).

관련 파일: `src/app/(app)/actions.ts`, `src/components/task-thread.tsx`(신규),
`src/components/thread-view.tsx`, `src/components/task-actions.tsx`,
`src/components/task-detail-modal.tsx`, `src/components/task-table.tsx`,
`src/components/mention-table.tsx`, `src/components/skeletons.tsx`,
`src/components/motion/table/index.tsx`, `src/components/motion/table/table-header.tsx`

### 2026-08-03 — 업무 아이템을 표로 (v2.0.0)

`기능` 네 화면의 업무 목록을 **한 벌의 표**로 바꿨다 (`TaskTable`). 칸은 프로젝트 · 업무명 ·
진행상태 · 마감일 넷이고, 내 업무 화면만 **등록일**이 하나 더 붙는다 — 등록일(`RGSN_DTTM`,
`columnSrno 3`)은 REST 필터 응답에만 있고 MCP 워크리스트·포커스 응답에는 없어서, 그 응답을
쓰는 오늘·팀 화면은 칸 자체를 끈다. 빈 칸을 `—`로 늘어놓지 않는다. 리스크 화면은 대신
**담당자** 칸을 켠다(남의 업무가 섞여 있다). 업무명을 누르면 **상세 모달**이 열려 추천
이유·점수·마지막 댓글을 읽고 상태·마감일·우선순위·담당자를 그 자리에서 고친다 — flow의
업무 상세 화면처럼 다섯 구획을 테두리로 끊었다.

표는 beUI `motion/table`을 **통째로** 들여왔다(`@tanstack/react-virtual` + 11개 파일).
원본이 `lucide-react`에서 아이콘을 부르는데 이 프로젝트는 Reicon 한 벌만 쓰므로,
벤더 파일들이 `@/components/icons`에서 부르도록 고치고 없는 아이콘은 뜻이 가까운 Reicon으로
갈아 끼웠다(행 손잡이 → `row-vertical` 등). 벤더 파일에 원본 주소와 고친 곳을 주석으로 남겼다.

**칸 폭을 전부 %로 주고 합을 100%로 맞췄다.** beUI 표는 `<colgroup>` 끝에 남는 폭을 먹는
채움 칸을 두는데, 폭을 안 준 칸이 하나라도 있으면 그 칸과 채움 칸이 남는 폭을 반씩 나눠
가진다 — 업무명이 절반만 받는다. 비율로 적으면 채움 칸이 0이 된다.

**두 화면의 격자를 접었다.** 오늘 화면의 8:4 2단은 한 단(표 넉 장)으로, 팀 화면의 3단은
1단(아주 넓은 화면만 2단)으로 내렸다. 표는 `table-layout: fixed`라 좁은 칸에 넣으면 가로
스크롤이 아니라 비율대로 눌린다 — 12칸 중 4칸에 표를 넣으면 업무명이 열 글자에서 잘렸다.
누가 몰려 있는지는 팀 카드 머리의 부하 막대가 이미 말한다.

**URL 상태 필터 두 벌을 지웠다.** 서버 칩(`StatusFilter`, `?focus=`/`?overdue=`)과
클라이언트 칩(`ProjectTaskFilter`)이 따로 있었는데, 표가 스스로 거르게 되면서 둘 다
없앴다 — 951줄 화면을 서버로 다녀오면 실측 7초다. 색 언어는 `StatusPill`과 공유해야 해서
칩 겉모양·점·건수만 `status-filter.tsx`에 남겼다.

골격도 같이 고쳤다. 세 줄짜리 줄 골격이 표 골격이 되고(머리 줄 + 44px 줄, 높이가
`44 × (1 + 줄 수)`로 실제와 같다) 오늘·팀 골격의 격자도 새 배치를 따라간다 — 안 고치면
골격이 사라지는 순간 화면이 한 번 튀고, 그건 골격을 쓰는 이유를 스스로 깨는 일이다.

메이저를 올린 이유는 화면 넷의 본문 컴포넌트와 배치가 같이 바뀌어서다(구조 변경).

- 관련 파일: `src/components/task-table.tsx`(신규) · `src/components/mention-table.tsx`(신규) ·
  `src/components/task-detail-modal.tsx`(신규) · `src/components/d-day.tsx`(신규) ·
  `src/components/motion/table/`(신규 11개) · `src/components/status-filter.tsx` ·
  `src/components/skeletons.tsx` · `src/components/icons.tsx` ·
  `src/app/(app)/(today)/page.tsx`·`loading.tsx` · `src/app/(app)/risk/page.tsx` ·
  `src/app/(app)/team/page.tsx`·`loading.tsx` · `src/app/(app)/tasks/page.tsx` ·
  `src/lib/flow/rest.ts`(등록일 추출) · `src/lib/flow/queries.ts` · `src/lib/flow/my-tasks.ts` ·
  삭제: `src/components/task-item.tsx` · `src/components/project-task-filter.tsx`

### 2026-08-03 — 나의 일정 줄에 색·반복·프로젝트 링크 (v1.9.0)

`기능` 일정 줄이 시각과 이름 둘만 냈다. **§8.2 목록 응답에 이미 들어 있던** 값 넷을 붙였다 —
시각 옆 달력 색 막대(`eventColor` → `calendarColor`), 이름 뒤 참석 표시(`attendanceStatus`)와
반복 표시(`repeatSrno`), 프로젝트 일정이면 아래에 `FlowLink`(`colaboSrno`).
상세(§8.5)를 안 부르니 호출이 안 늘어난다.

붙이기 전에 실제 응답을 찍었다(MCP `flow_query_events`·`flow_get_event`). 명세는 전 필드를
필수로 적어 뒀지만 `eventColor`·`colaboSrno`·`eventBody`가 빈 문자열로 왔다. 그래서 `FlowEvent`의
새 필드는 전부 optional이고, 색은 일정 색 → 달력 색으로 떨어진다.

달력 이름은 **달력이 여럿일 때만** 적는다. 하나뿐이면 그 이름이 곧 내 이름이라 줄마다 같은 말이
반복되고, 색 막대도 전부 같은 색이라 구분할 게 없다. 여럿이면 반대로 색이 뜻을 갖기 시작하니
이름이 그 색의 범례가 된다 — 색만으로 뜻을 나르지 않기 위한 짝이다.

**참석 상태(`attendanceStatus`)는 값 목록이 명세 어디에도 없다** — §8.2·§8.5·§9 다 필드 이름만
있고, MCP 쓰기 도구도 참석 응답을 다루지 않는다. 실측으로 본 건 `"ATTENDING"`과 `""` 둘뿐이라
`"ATTENDING"`일 때만 그리고 나머지는 아무것도 안 그린다. 모르는 값을 "불참"으로 오독하느니
안 그리는 편이 낫다 — 대신 불참으로 응답한 일정은 무표시 일정과 같아 보인다.

상세(§8.5)의 최상위 `attendanceStatus`는 비어 있고 내 응답은 `attendances[]` 안에만 있다.
목록과 어긋나니 목록 응답의 값만 믿는다.

장소·참석자 명단·회의 링크·반복 주기는 뺐다 — 일정마다 상세를 한 번씩 더 불러야 나온다.

`hexColor`(`utils.ts`)가 `"D0DA09"` → `"#D0DA09"`를 만든다. 응답 값을 `style`에 그대로 꽂는
자리라 6자리 hex가 아니면 null을 내고 막대는 토큰 색으로 남는다.

`flowPostUrl`·`flowProjectUrl`은 `queries.ts`에서 `flow/urls.ts`로 옮겼다. `queries.ts`가
세션·MCP를 끌어와 서버 전용인데 링크 형식을 판에서도 써야 해서, 그대로 두면 서버 코드가
브라우저 묶음에 끌려 들어와 빌드가 깨졌다. 새 파일은 아무것도 import 하지 않는다.

관련 파일: `src/components/app-shell.tsx`, `src/components/icons.tsx`, `src/lib/utils.ts`,
`src/lib/utils.test.ts`, `src/lib/flow/rest.ts`, `src/lib/flow/urls.ts`, `src/lib/flow/queries.ts`,
`src/lib/flow/my-tasks.ts`, `src/app/api/go/[postId]/route.ts`, `src/lib/changelog.ts`

### 2026-08-03 — 일정 창을 하루에서 이레로 (v1.8.0)

`기능` 일정 서랍·시트가 오늘 하루만 냈다. **오늘부터 이레**(`EVENT_WINDOW_DAYS = 7`)로 넓히고
이름을 「나의 일정」으로 바꿨다. 달력 주(월~일)가 아니라 오늘을 첫날로 세는 롤링 이레다 —
달력으로 자르면 금요일에 열었을 때 이틀치만 남아서, "다음이 언제냐"를 묻는 자리에서 답이
요일에 따라 얇아진다.

날짜 소제목으로 하루씩 끊는다. 시각만 늘어놓으면 이레치가 한 덩어리로 붙어서 `15:16`이 어느 날
세시인지 알 수 없다. 소제목은 `fmtDayLabel`이 `8.3 (월)`로 내고, 오늘 줄에만 파란 `오늘 ·`이
앞에 붙는다. 목록이 이미 시작 시각순이라(`listEvents`가 정렬한다) 앞에서부터 접으면 끊긴다.

`today`는 `loadWeekEvents()`가 창의 시작과 같은 시각에서 뽑아 판으로 내려준다. 판에서
`Date.now()`를 읽으면 첫 그림과 어긋나 수화가 깨지고(`react-hooks/purity`도 막는다), 창과 다른
시각에서 뽑으면 자정을 넘는 순간 소제목이 창 밖을 가리킨다.

팀 화면의 부서원 일정(`memberEvents`)은 오늘 하루 그대로다 — 거기는 "이 사람이 지금 자리에
있나"라서 이레가 필요 없고, 사람 수만큼 REST 왕복이 늘어난다.

ponytail: 첫 페이지 100건까지다(`listEvents`가 `hasNext`를 안 본다). 이레면 하루 14건까지
담기니 넘칠 일이 드물지만, 넘치면 뒤쪽이 조용히 잘린다 — 더 늘리려면 `cursor`를 따라가야 한다.

관련 파일: `src/lib/flow/queries.ts`, `src/lib/utils.ts`, `src/lib/utils.test.ts`,
`src/components/app-shell.tsx`, `src/app/(app)/layout.tsx`, `src/lib/changelog.ts`.

### 2026-08-03 — 밝게의 강조색을 파랑으로, 요약에 색 면을 (v1.7.0)

`개선` "화면이 답답하고 너무 단색"이라는 지적을 셋으로 갈라 고쳤다 — 브랜드 색, 색의 면,
여백 등급. 재던 값으로 확인했다: `/tasks` 본문의 유채색 픽셀이 13%→22%(파랑 118→2732),
`/members`가 0%→4%, 본문 패딩 32→40px.

**① 밝게의 `--primary`를 `#171717`(검정)에서 `#1d4ed8`(파랑)으로.** 원인은 토큰이 없어서가
아니었다 — 상태색 여섯 벌이 이미 다 있었다. 밝게의 강조색 자체가 무채색이라 활성 메뉴도
링크도 아이콘도 전부 회색 아니면 검정이었던 것이다. 어둡게가 이미 파랑이라 두 모드가 서로
다른 브랜드처럼 보이기도 했다. 흔한 `#2563eb`를 안 고른 이유는 그게 `--info`(요청 배지)와
바이트까지 같아서다 — 한 단 짙게 잡아 "브랜드 파랑이 상태 파랑보다 무겁다"를 만들었다.
`--ring`·`--chart-1`의 밝게 값도 같이 따라간다.

**② 상태색을 배지 밖으로.** `KPI_TONE`(`kpi.tsx`)을 문자열 지도에서 네 칸 객체
(`text`/`chip`/`face`/`bar`)로 바꿔 요약 카드가 은은한 색 면 + 아이콘 칩을 갖는다. 오늘 화면의
`Stat`과 카드 제목 표지(`TitleMark`)가 같은 지도를 읽어서, 빨강 칩이 붙은 요약을 누르면 빨강
칩이 붙은 카드가 나온다. 두 가지를 일부러 그렇게 뒀다 — `neutral`에는 면이 없다(넉 장을 다
물들이면 물든 게 기본이 돼서 다시 아무 신호도 아니다), 면은 배경색이 아니라
`bg-linear-to-b from-X/10 to-X/0` 그러데이션이다(`background-image`라 `bg-card` 위에 얹혀서
어둡게의 3단 표면 층이 안 무너진다).

**③ 여백을 세 급으로.** 본문 32→40, 카드 안쪽 16/12→20/16, 요약 아래 24→40. 셋이 사실상 한
급이라 화면 전체가 같은 밀도로 촘촘했던 게 "답답하다"의 정체였다. `Card`의
`--card-spacing` 한 곳만 고치면 전 화면이 따라온다. 골격(`skeletons.tsx`)도 같은 수로 맞췄다 —
안 맞추면 내용이 도착할 때 화면이 튄다(§7.4.1).

구조는 안 건드렸다. 레일의 빈 자리를 채우거나 본문 폭을 1200→1440으로 넓히는 건 뺐다 —
지적은 밀도였지 폭이 아니었다.

관련 파일: `src/app/globals.css`, `src/components/kpi.tsx`, `src/components/ui/card.tsx`,
`src/components/app-shell.tsx`, `src/components/motion/animated-sidebar.tsx`,
`src/components/skeletons.tsx`, 화면 다섯의 `page.tsx`·`loading.tsx`, `docs/PRD.md` §7.1.

### 2026-08-03 — 오늘 일정을 셸로 올렸다 (v1.6.0)

`기능` 오늘 일정(§13 B3)을 오늘 화면 밖에서도 연다. 레일 발의 계정 팝오버(§7.3)에 "오늘 일정"
단추를 넣었고, 누르면 오른쪽에서 서랍이 들어온다. 소식(종)처럼 헤더로 올리지 않은 것은 종이
"새 것이 왔다"는 알림이고 일정은 내가 찾아보는 것이라, 늘 보이는 자리를 하나 더 내줄 이유가
없어서다. 대신 건수만 단추에 함께 적어서 열지 않고도 빈 날인지 안다.

**오늘 화면의 4단 일정 카드는 뺐다.** 소식이 종으로 올라갔을 때와 같은 정리다 — 셸에 있는
것을 화면에도 두면 같은 하루가 두 군데서 따로 늙는다. 오늘 화면은 챙길 일(업무·멘션)만 남는
3단이 되고, 일정은 어느 화면에서나 같은 자리에서 열린다.

서랍은 beUI Drawer를 `src/components/motion/drawer.tsx`로 들여왔다. 원본에서 고친 것은 넷이고
파일 머리에 번호로 적어 뒀다. 중요한 둘: ① `<body>`로 포털한다. 여는 자리가 좌측 레일인데 레일은
`overflow-hidden`에 `will-change:transform`을 걸고 폭을 애니메이션해서, 그 안의 `position:fixed`가
화면이 아니라 레일을 기준으로 잡힌다 — 이 앱의 레이어 셋이 모두 같은 이유로 포털한다.
② 열 때 패널로 포커스를 넣고 닫을 때 되돌린다(원본엔 Escape만 있다). 탭 트랩은 두지 않는다 —
bottom-sheet.tsx와 같은 선이다.

서랍이 **오른쪽**인 것은 여는 자리가 왼쪽 레일 발이라서다. 왼쪽에서 열면 방금 누른 그 레일을
덮는다. 마크업을 팝오버 밖에 두는 것도 같은 이유다 — 서랍이 열리는 순간 팝오버는 닫힌다.
서랍을 연 단추는 그때 함께 사라지므로, 닫을 때 초점은 계정 줄(`trigger`)로 따로 돌려준다.
실측으로 확인했다: 안 돌리면 초점이 `body`로 떨어져 탭이 문서 맨 앞에서 다시 시작한다.

데이터는 셸이 받는다 — `loadTodayEvents()`를 `src/lib/flow/queries.ts`에 두고 `(app)/layout.tsx`
하나가 부른다. 처음엔 `loadToday()`도 같은 함수를 불러서 React `cache()`로 감쌌는데, 오늘 화면
카드를 빼면서 부르는 자리가 레이아웃 하나만 남아 `cache()`를 도로 걷었다 — 한 요청에 한 번
부르는 함수에 메모는 껍데기다. 화면이 무엇이든 요청당 REST 왕복은 하나다.

**좁은 화면(<1024px)은 헤더가 든다.** 레일이 없어서 계정 팝오버 자체가 없다. 앱바 오른쪽에
달력 단추를 하나 놓고, 서랍 대신 바텀시트를 올린다 — 소식 종과 같은 이유다(v1.5.2). 오른쪽에서
들어오는 320px 판은 390px 화면에서 스크림을 한 뼘만 남기고, 그 판을 여는 단추도 손이 가장 안
닿는 구석이다. 목록은 `ScheduleList` 하나를 서랍과 시트가 같이 써서 안쪽이 갈리지 않는다.
껍데기 고르기는 `lg:hidden`으로 끝낸다 — 종처럼 판을 갈아 끼우는 게 아니라 좁은 화면 전용 단추
하나라서 `useNarrowScreen`이 필요 없다. 건수 배지는 안 단다: 바로 옆 종이 쓰는 표시라 같은
모양이면 안 읽은 소식으로 읽힌다. 건수는 읽어 주는 이름과 시트 설명에 넣었다.

**확인** (1280×900, `/members`): 서랍 320×900이 오른쪽 끝(x=960)에 붙고, 열면 팝오버는 사라지고
스크림이 깔린다. 초점이 패널 안으로 들어가고 `body`는 잠긴다. Escape·스크림 누르기 둘 다 닫히고
잠금이 풀리며 초점이 계정 줄로 돌아온다. 목록 분기는 일정이 있는 날(8/7)로 잠시 돌려 확인했다 —
`09:00–10:00 | 출장예약 주간회의` 한 줄, 단추 글자는 `오늘 일정 1건`. 일정이 없는 날은
`오늘은 일정이 없어요`. 밝게·어둡게 둘 다 확인, 가로 넘침 없음.

**확인** (390×844, `/members`): 앱바에 다섯 단추(검색·밝기·일정·소식·로그아웃)가 서고 가로
넘침이 없다. 달력 단추를 누르면 시트 390×222가 바닥에 딱 붙어(바닥 틈 0) 손잡이·스크림과 함께
올라오고 `body`가 `fixed`로 잠긴다. Escape로 닫으면 잠금이 `static`으로 풀리고 초점이
`button[오늘 일정]`으로 돌아온다 — 여기는 단추가 안 사라져서 서랍처럼 따로 돌릴 게 없다.
1280으로 넓히면 이 단추는 사라진다(`개수 1, 보임 false` — DOM엔 있고 CSS로 숨는다).
밝게·어둡게 둘 다 확인.

관련 파일: `src/components/motion/drawer.tsx`(새로), `src/components/app-shell.tsx`,
`src/app/(app)/(today)/page.tsx`, `src/app/(app)/(today)/loading.tsx`,
`src/lib/flow/queries.ts`, `src/app/(app)/layout.tsx`, `docs/PRD.md`(§6.1·§7.3·§11),
`docs/progress.md`, `src/lib/changelog.ts`, `package.json`.

### 2026-08-03 — 좁은 화면 소식 레이어를 바텀시트로 (v1.5.2)

`개선` 헤더 알림 종(§6.1.5)의 레이어가 폭에 따라 갈린다. ≥1024px는 그대로 팝오버, <1024px는
아래에서 올라오는 바텀시트다. 팝오버는 종 아래에 매달리는데 좁은 화면에서 종은 앱바 오른쪽 끝
이라, 폭을 거의 다 쓰는 판(`min(24rem, 100vw-2rem)`)이 손이 가장 안 닿는 구석에 붙어 열렸다.
게다가 좁은 화면에서 닫는 유일한 길이 "빈 곳 누르기"인데 판이 화면을 거의 덮고 있으면 누를 빈
곳이 없다. 시트는 엄지가 닿는 아래에 서고 손잡이를 밀거나 던져서 닫는다.

**판 안쪽은 하나다.** 컴포넌트로 가르지 않고 `panel` 변수로 뒀다 — 탭·읽음 처리·집계까지 일곱
값을 인자로 넘겨야 하는데, 같은 함수 안에 두면 넘길 게 없다. 여닫는 상태(`open`)를 종이 들고
`open && narrow` / `open && !narrow`로 껍데기를 고른다. 눌리는 단추는 폭과 무관하게
`PopoverTrigger` 하나로 남긴다: Radix가 판을 매다는 기준점이고, 서버에서는 폭을 알 수 없어
(`useNarrowScreen`이 `false`) 첫 HTML이 두 폭에서 같아야 번쩍임이 없다.

폭 판정은 `useNarrowScreen()`(`src/lib/hooks/use-narrow-screen.ts`) — `matchMedia`를
`useSyncExternalStore`로 구독한다. 이펙트로 하면 첫 그림 뒤에 한 번 더 그리고 React 19 린트가
이펙트 안의 `setState`를 막는다. 선은 셸의 `lg:hidden`과 같은 1024px 하나를 읽는다.

시트는 beUI Bottom Sheet를 `src/components/motion/bottom-sheet.tsx`로 들여왔다. 원본에서 고친
것은 다섯인데(파일 머리에 번호로 적어 뒀다) 중요한 둘은 이렇다. ① 원본에는 Escape·포커스
넣기·포커스 되돌리기가 **없다.** 팝오버를 대신하는 자리라 그게 없으면 좁은 화면에서만 키보드
동작이 나빠진다 — 탭 트랩은 두지 않는다(팝오버도 비모달이라 안 잡는다). ② 스냅 초기화가
이펙트 안의 `setState`라 린트에 걸려서 렌더 중 "직전 렌더와 비교"로 옮겼다. 닫을 때 되돌리면
안 된다: 던져 닫는 순간 높이가 같이 줄면서 나가는 모습이 튄다.

높이는 `snapPoints=["auto"]`다. 목록의 기존 상한(`max-h-[min(28rem,60vh)]`)이 그대로 시트의
키가 되어 실측 390×844에서 586px — 화면의 4분의 3쯤이다. 그래서 92vh 천장에 닿는 일이 없고
레이아웃 값을 새로 정할 것도 없었다. 목록에 `flex-1`은 주지 않는다 — `flex-basis: 0`이면 목록이
시트의 내재 높이에서 빠져서 auto 시트가 납작해진다.

실측(390×844, Chrome): 시트 390×586 + 바닥 0, 목록 448px 스크롤, 포커스가 `dialog`로 들어가고
닫으면 종으로 돌아온다, 손잡이 드래그·Escape·스크림 모두 닫고 `body` 잠금이 풀린다, 가로 넘침
없음, 다크 확인. 1280px에서는 팝오버 384px 그대로. 팝오버를 열어 둔 채 1280 → 900으로 좁히면
시트로 갈린다(둘이 같이 뜨거나 둘 다 사라지는 상태가 없다).

관련 파일: `src/components/news-bell.tsx`, `src/components/motion/bottom-sheet.tsx`(신규),
`src/lib/hooks/use-narrow-screen.ts`(신규), `docs/PRD.md`(§6.1.5·§7.3), `docs/progress.md`,
`src/lib/changelog.ts`, `package.json`.

### 2026-07-31 — 구성원 카드 격자 + 계정 사진·상태 메시지 (v1.5.1)

`개선` 한 사람 = 한 줄이던 `/members` 명단을 한 사람 = 한 장 카드로 바꿨다 (PRD §6.6 결정 표
갱신). 원래 이유였던 "이름이 한 열에 모여야 훑기 빠르다"는 13명에서 성립하지 않았다 — 어느
배치로 깔아도 한 화면에 다 들어온다. 실제로 남은 건 **줄마다 붙은 복사 알약 26개**의 소음이라,
이메일·번호가 각자 줄을 갖고 단추가 그 줄 오른쪽에 하나씩 붙는 카드로 정리했다. 값 하나에 단추
하나라 자리로 짝을 세지 않아도 된다.

카드 높이는 `h-full`로 맞추지 않는다. 한 행을 늘리면 `slogan`이 없는 카드 아래에 빈 칸이
생기고, 그 빈 칸이 "정보가 빠진 사람"처럼 보인다 — 이니셜 원을 쓴 것과 같은 이유다. 부서도
카드로 싸지 않는다(테두리 두 겹). 소제목 + 건수 한 줄이다.

연락처 줄은 `이메일 / 휴대폰` 이름표를 앞에 달았다. 앞서는 형태로만 구분했는데(@ 있으면
이메일) 둘이 나란히 있을 때 그건 읽는 사람이 하는 일이다. 이름표 폭을 `w-11`로 고정해서 값들이
한 열에서 시작한다(실측 좌변 336/336). 복사 단추는 **아이콘만 남긴 `ghost`**다 — 카드마다 둘이라
`복사` 두 글자가 값보다 먼저 눈에 들었다. 글자가 사라진 만큼 그림이 뜻을 다 져야 해서
`IconComment`(말풍선) → `IconCopy`로 바꾸고, 성공·실패 문구는 `aria-label`·`title`로 옮겼다
(누른 뒤 둘 다 "복사했어요", 클립보드 25자 확인).

한마디 칸은 **모두가 갖는다**. 처음엔 적어 둔 2명에게만 뒀는데 그러면 카드 높이가 두 종류가 돼서
격자 아래끝이 들쭉날쭉해진다. 없으면 흐리게 `상태 메시지가 없어요.`를 적는다 — 빈 칸과 달리
"정보가 빠진 사람"으로 읽히지 않고 높이도 173px 하나로 모인다(번호 없는 한 명만 한 줄 짧다).
줄 앞에는 말풍선(`IconComment` 12px, `aria-hidden`)을 붙였다: 위 칸들은 연락처인데 이 줄만 본인이
쓴 말이라, 선 하나로는 무엇이 달라졌는지 말해 주지 않는다. 골격도 이 칸과 아이콘 자리를 갖는다.

계정 블록(레일 발)의 `👋🏻`도 같은 사진으로 바꿨다. 세션에 사진이 없어서 — MCP
`flow_get_my_profile`은 이름·부서·직책·이메일만 준다(실측) — §9.3에 한 번 더 묻는다. 검색어는
**세션 이름**이고, 받은 줄에서 **이메일로** 고른다: 검색어에 이메일을 넣으면 0명이고(실측)
이름으로는 동명이인이 같이 오기 때문이다. 실패하면 빈 문자열이라 셸은 넘어지지 않고 손 그림으로
돌아간다. 같은 호출에 `slogan`이 실려 오니 계정 팝오버에 **상태 메시지** 줄도 붙였다 —
구성원 카드의 한마디와 같은 모양(선 + 말풍선)이고, 비면 같은 문구가 흐리게 남는다.

값: 데스크톱 1280px 카드 3열 · 높이 173px(번호 없는 한 명만 144px) · 375px 1열, 세로 스크롤이
1,500px → 1,900px로 늘었다(카드로 바꾼 유일한 손해). 복사 단추 32×32 · 이름은 `이메일 복사` /
`휴대폰 복사`. 계정 원판 28×28 `object-cover`, 접힌 레일·다크 모드 모두 정상, `/_next/image`
전부 `200`. `npm test` 118/118, `npm run build` 14 라우트.

관련 파일: `src/app/(app)/members/page.tsx`(`DivisionList`·`MemberCard`·`ContactRow`) ·
`src/components/skeletons.tsx`(`MemberRowsSkeleton` → `MemberCardsSkeleton`) ·
`src/app/(app)/members/loading.tsx` · `src/components/copy-button.tsx`(`iconOnly`·`className`) ·
`src/components/icons.tsx`(`IconCopy`) · `src/lib/flow/rest.ts`(`searchEmployees` 검색어) ·
`src/lib/flow/members.ts`(`loadMyAccount`) · `src/app/(app)/layout.tsx` ·
`src/components/app-shell.tsx`(`Account`) · `docs/PRD.md` §6.6 · `docs/api-spec.md` §9.3 ·
`src/lib/changelog.ts` · `package.json`

### 2026-07-31 — 구성원 화면 (v1.5.0)

`기능` 전 직원 주소록 `/members`를 붙였다 (PRD §6.6, Phase 7). REST `GET /user/search/employees`
**한 번**이면 전량이 손에 들어와서 화면은 줄 세우기와 부서 묶기만 한다 — 부서 탭도 서버에 다시
묻지 않고 `Tabs`가 칸만 바꾼다. 정렬은 부서(flow의 `divisionCode` 순) → 직책 서열(대표이사 · 이사 ·
상무 · 부장 · 차장 · 과장 · 대리 · 사원, 없는 직책은 맨 뒤) → 이름이다. 왼쪽 레일 다섯 번째이고
좁은 화면 하단 탭은 4칸 → 5칸이 됐다 (375px에서 한 칸 75px, 실측).

업무 정보는 한 칸도 넣지 않았다. 임박·밀림은 팀 화면(§6.3)이 이미 세고 있어서 같은 숫자를 두
화면에서 그리면 어느 쪽이 맞는지 묻게 된다. 조직도도 안 그린다 — 부서 3개의 `upperDivisionCode`가
전부 빈 문자열이라 세울 계층이 없다.

**설계와 다른 곳이 둘 있었다.** ① PRD는 사진 호스트를 `lh3.googleusercontent.com` 하나로 적었는데
실측은 **셋**이다 (`flow.team` · `traport.flow.team`이 더 있다). `next.config.ts`의 `remotePatterns`에
셋을 다 넣지 않으면 9명 중 4명의 사진이 통째로 막힌다. 경로까지 좁혔다 — 호스트만 열면 그 도메인의
아무 이미지나 우리 최적화기를 태울 수 있다. ② 응답에 스펙에 없는 `slogan`이 온다 (13명 중 2명).
`FlowSearchEmployee`에 선택 필드로 더했다.

개인정보: 명단·번호는 로그에 남기지 않고, 응답을 디스크에 캐시하지 않는다. 이 화면은 세션 `userId`
필터가 없는 유일한 목록인데 — 요청에서 받는 값이 하나도 없어서 남의 것을 지목할 표면 자체가 없다.
`userId`는 화면에 내지 않는다 (이메일과 나란히 두면 멘션·담당자 필터에 잘못 넣게 된다).

검증: 브라우저 실측으로 13명 · 3부서 8·3·2가 탭 숫자와 일치하고, 사진 요청 10건이 전부 200,
1280px·375px 모두 가로 넘침 없음, 하단 탭 5칸 75px. `buildMembers` 단위 테스트 5개 추가
(118/118 통과). tsc·eslint·build 통과.

관련 파일: `src/app/(app)/members/page.tsx`, `src/app/(app)/members/loading.tsx`,
`src/lib/flow/members.ts`, `src/lib/flow/members.test.ts`, `src/lib/flow/rest.ts`,
`src/lib/flow/types.ts`, `src/components/skeletons.tsx`, `src/components/app-shell.tsx`,
`next.config.ts`, `src/lib/changelog.ts`, `package.json`

### 2026-07-31 — 못 가져온 값은 다시 물어본다 (v1.4.2)

`수정` v1.4.1 작업 중에 모달의 우선순위·담당자가 `지금 값을 못 가져왔어요`로 뜬 것을 한 번 보고
쫓았다. **조회는 멀쩡했다** — `getTaskFields`를 직접 3회 + 브라우저에서 새로고침 끼워 3회, 6/6 성공에
257ms다. 결함은 클라이언트가 실패를 다루는 쪽에 둘 있었다 (BUG-038).

**하나**, `asked` 가드가 성공·실패를 안 가려서 **한 번 실패하면 영구히 잠겼다.** 모달을 닫고 다시
열어도 다시 묻지 않아, 그 화면이 살아 있는 동안 계속 같은 문구고 탈출구가 새로고침뿐이었다.

**둘**, 액션 **요청 자체가 끊기면**(네트워크·서버 재시작·세션 만료) `await`가 거부하고 그 거부가
트랜지션을 뚫고 오류 경계까지 올라가 **화면이 통째로 사라졌다.** `loadTaskFields`의 `try/catch`는
서버 안에서 난 오류만 싼다. 정작 그 경우를 위해 둔 `못 가져왔어요`는 쓰이지도 못했다.

**처리**: 로드 한 곳에 `.catch(() => null)`을 붙이고, 값을 못 받았으면 `asked`를 되돌린다. 조회 중에는
`asked`가 참이라 다시 열어도 두 번 부르지 않는다 — 가드는 살아 있고 실패만 안 잠긴다.

검증(브라우저, 쓰기 없음): 차단 중 화면이 오류 경계로 넘어가던 것이 정상 화면 + 모달 안 문구로,
닫고 다시 열기가 `POST 1회 → 300ms 안에 값`으로 바뀌었다. 평상시 257ms는 그대로다.
tsc · lint 0 error · 113/113.

- 관련 파일: `src/components/task-actions.tsx` · `docs/bug-report.md`(BUG-038) ·
  `src/lib/changelog.ts` · `package.json`

### 2026-07-31 — 바꾼 값이 업무 줄에 바로 뜬다 (v1.4.1)

`수정` v1.4.0에서 "남은 가설은 flow 쪽 읽기 지연"으로 남겨 둔 것을 실서버 쓰기로 재현해 닫았다.
**flow는 지연이 없었다. 느린 건 우리 페이지 재렌더였다** (BUG-037).

실측(실제 크롬 + 내 업무 화면, 되돌릴 수 있는 마감일 쓰기 2회): 저장 버튼 → 액션 반환 0.3초,
그런데 **바닥 업무 줄이 바뀌는 건 6.5초 뒤**였다. `revalidatePath`는 정상 작동한다 — 다만 그
결과가 페이지 하나를 통째로 다시 그린 RSC 페이로드라, 내 업무 화면(프로젝트마다 REST)에서는
그게 오는 데 6.5초가 걸린다. 성공 문구조차 그때 함께 나타났다. 사용자는 그 전에 줄을 보고
새로고침한다 — "안 바뀐다"는 사실은 "6.5초 뒤에 바뀐다"였다.

**처리**: 업무 줄이 저장 성공을 직접 받아 자기 상태·마감일·D-Day를 먼저 갈아 끼운다.
`TaskItem`을 클라이언트 컴포넌트로 올리고(자식 넷은 서버 전용 코드가 없어 부르는 데이터가
늘지 않는다), `TaskActions`에 `onSaved` 하나를 뚫어 `useSave`가 성공한 값을 그대로 올린다.
낡은 낙관값이 남지 않게 **얹은 시점의 서버 값(`base`)을 같이 들고 있다** — 서버가 다른 값을
주면(내 저장이 반영됐든 남이 바꿨든) 비교 한 줄로 저절로 버린다. 이펙트가 없다.
마감일이 바뀌면 남은 일수도 `diffDays`로 다시 센다.

같은 측정 재실행: **1.29초**(액션 반환과 같은 시점). 서버 재렌더는 7.8초에 도착해 낙관값을
조용히 대체했다. 되돌리기도 2.04초에 D+92 · 2026-04-30으로 돌아왔다. 우선순위·담당자는 업무
줄에 없어서 넘기지 않는다. 상태(MCP)는 같은 `useSave` 경로라 함께 적용된다 — 브라우저 검증은
마감일(REST)로 했다.

검증: tsc · lint 0 error · 113/113 · build 13 라우트. 쓰기는 테스트 업무
`LGI-REQ-기타-일반-테스트-001` 하나에서만 했고 마감일은 원래 값(2026-04-30)으로 되돌렸다.

- 관련 파일: `src/components/task-item.tsx` · `src/components/task-actions.tsx` ·
  `docs/bug-report.md`(BUG-037) · `src/lib/changelog.ts` · `package.json`

### 2026-07-31 — 답장한 피드백은 포커스에서 빼고, 알림은 스스로 당겨 온다 (v1.4.0)

`기능` `수정` 날짜가 바뀌어도 오늘의 포커스에 같은 업무가 계속 앉아 있었다. 상태가 `피드백`인
업무는 상대가 답을 확인해 `완료`로 넘겨 줄 때까지 남는데, 실제로는 **내가 이미 답을 달아 놓고
기다리는 중**인 경우가 많았다. 그런 줄은 오늘 챙길 일이 아니다.

**포커스 필터** — 상태가 `피드백`이고 **마지막 사람 댓글의 작성자가 나면** 목록에서 뺀다.
`피드백` 픽만, 앞에서 8개까지만 확인한다(`FOCUS_CHECK`) — 픽마다 게시글 ID 해소 + 댓글 조회로
REST 2회가 붙어서, 10개 전부 보면 분당 예산을 그만큼 더 쓴다. 댓글은 300초 캐시다. 확인이
실패하면(권한·해소 실패) **남긴다** — 못 본 것을 숨기지 않는다. 실측: 픽 10건 중 `피드백` 4건에
REST 8회, `Q001 제휴숙소 결제방식`(마지막 댓글=나)이 걸러지고 `Q018`(박인영) · `Q022`(여명호) ·
`보안 미팅 사전 질의서`(안주희)는 남았다.

그 과정에서 판별식 오류를 찾았다 — `systemCode`가 채워졌으면 시스템 댓글로 보고 있었는데
값 없는 맨 코드(`S13`·`S14`·`S20`)는 사람 댓글이다. 실측 148건 중 56건이 그것이라 업무 줄의
"마지막 댓글"이 사람 말 38%를 버리고 있었다 (BUG-035). `isChangeLog`(`^^` 판별)로 고쳤고
멘션 스레드 표시도 같은 함수를 쓴다.

**알림 실시간성** — flow는 알림을 밀어 주지 않는다(웹훅·구독 없음). 그래서 헤더 종이 1분마다
`/api/news`를 당긴다. 서버 액션이 아니라 라우트로 둔 이유는 액션 응답에 현재 화면 RSC가 실려서
오늘 화면(MCP 5회)까지 1분마다 다시 그릴 수 있기 때문이다. 대상은 요청이 아니라 **세션**에서
채운다. 폴링 한 번은 REST 2회다(제목·링크를 300초 캐시로 올렸다). 탭을 다시 보면 그 자리에서
한 번 더 당긴다. 읽음 처리는 눌린 자리에서 배지를 끈다 — 다음 폴링까지 점이 남아 있었다.

**모달 즉시 반영** — 상태·마감일·우선순위·담당자 네 모달의 배선을 훑었다. `path`는 `TaskRef`를
타고 네 폼에 다 닿고, MCP·REST 두 래퍼가 모두 `revalidatePath`를 부른다. 오늘·내 업무 화면은
정상이다. 리스크·팀 화면에서 **쿼리스트링이 붙은 `path`**를 넘겨 `revalidatePath`가 무효 호출이
되고 있던 것을 고쳤다 (BUG-036). 지금 두 화면은 ttl 캐시가 없어 증상이 없었지만 캐시를 하나
붙이는 순간 낡은 값이 남는다. **남은 가설은 flow 쪽 읽기 지연**이고, 확인에는 되돌릴 수 있는
실서버 쓰기 한 번이 필요해서 사용자 승인 전까지 손대지 않았다.

검증: tsc · lint 0 error(기존 경고 1: 벤더 `motion/select.tsx`) · 113/113 · build 13 라우트
(`/api/news` 추가). 포커스 필터는 실 API 데이터로 확인했다(위 실측). 화면 렌더 확인은 못 했다 —
Next 16이 초기 응답으로 골격만 흘려서 curl로는 본문이 안 잡힌다.

- 관련 파일: `src/lib/flow/queries.ts` · `src/lib/flow/rest.ts` · `src/lib/flow/rest.test.ts` ·
  `src/components/news-bell.tsx` · `src/app/api/news/route.ts`(신규) · `src/app/(app)/actions.ts` ·
  `src/app/(app)/risk/page.tsx` · `src/app/(app)/team/page.tsx` · `docs/api-spec.md`(§13.1) ·
  `docs/bug-report.md`(BUG-035·036)

### 2026-07-31 — MCP 전면 대체를 검토하고, 헛도는 프로필 호출을 걷었다

`개선` "MCP를 걷고 REST로 통일하면 이득이 있나"를 도구 9종 단위로 따져 봤다. **전면 대체는
손해다** — 근거 셋을 [PRD §5.1.1 정정](PRD.md#511-정정-2026-07-31)에 적었다. ① `flow_get_my_profile`이
세션을 만드는 유일한 경로라(REST는 OAuth 토큰에 400, API 키로 부르면 **키 소유자**를 답한다)
MCP를 걷으면 "로그인한 사람"이라는 개념이 사라지고 키를 붙여넣은 사람이 곧 신원이 된다.
② 원가 178~470회는 이제 계산이 아니라 실증이다 — 내 업무 화면이 그 방식이고 분당 120회 중
60회를 쓴다. ③ 팀 화면을 막는 건 권한이 아니라 산수다(부서원 6 × 프로젝트 59 = 354회).

건진 것 하나: **`loadTeam`의 `flow_get_my_profile`이 헛돌고 있었다.** 세션에 `divisionName`이
이미 있는데(로그인 콜백이 같은 도구로 받아 둔 값이다) 다시 불러서, 스탠드업 **앞에** MCP 왕복
하나가 직렬로 붙어 있었다. 세션 값으로 바꿨다 — /team·/risk 두 화면에서 사라진다. 대가는
부서가 바뀐 사람이 세션 만료(7일)까지 옛 부서로 열리는 것이고, 부서 탭으로 바꿔 볼 수 있다.
쓰이지 않게 된 `Profile` 인터페이스도 함께 걷었다 (`auth.ts`의 `FlowProfile`과 같은 모양이었다).

검증: tsc · lint 0 error(기존 경고 1) · 111/111 · build 12 라우트. 값이 같은지는 MCP로 직접
확인했다 — `flow_get_my_profile`의 `divisionName`(`플랫폼개발팀`)을 `flow_get_team_standup`의
`dept`로 넣어 멤버 8명 · 임박 5 · 밀림 12가 그대로 왔다. 화면 실측은 못 했다: 임시 세션 쿠키의
`accessToken`이 더미라(REST만 쓰는 /tasks 검증용) /team·/risk는 MCP 401로 오류 카드가 뜬다 —
실화면 확인은 브라우저 로그인이 필요하다.

**버전은 올리지 않았다.** 화면에 보이는 변화가 없어 `changelog.ts`에 넣을 줄이 없다
(그쪽 규칙: 보이는 변화가 없는 배포는 넣지 않는다).

- 관련 파일: `src/lib/flow/queries.ts` · `docs/PRD.md`(§5.1.1 표 한 줄 · 신설 §5.1.1 정정 · §6.3 주석)

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
