# 오류와 처리 방법

발견 순서대로 쌓는다. 해결되면 상태만 바꾸고 지우지 않는다 — 같은 함정에 두 번 빠지지 않기 위해서다.

| ID | 대상 | 상태 |
|----|------|------|
| [BUG-001](#bug-001) | flow MCP `flow_list_alarms` | 열림 (flow 서버측) |
| [BUG-002](#bug-002) | Turbopack + `.js` 확장자 import | 해결 |
| [BUG-003](#bug-003) | Next 16 `middleware.ts` 폐기 | 해결 |
| [BUG-004](#bug-004) | OAuth `resource` 파라미터 누락 | 해결 |
| [BUG-005](#bug-005) | `taskSrno` vs 쓰기 도구 `taskId` | 해결 |
| [BUG-006](#bug-006) | 세션 봉인 변조 테스트 flaky | 해결 |
| [BUG-007](#bug-007) | flow MCP `flow_list_projects` | 우회함 (flow 서버측) |
| [BUG-008](#bug-008) | `"use server"` 모듈의 상수 export 소실 | 해결 |
| [BUG-009](#bug-009) | 아코디언 본문 `-mx-5`로 UI 잘림 | 해결 |
| [BUG-010](#bug-010) | 헤더 블러가 눈에 안 보였다 | 해결 |
| [BUG-011](#bug-011) | `flow_collect_project_chain` 권한 오류 | 우회함 (flow 측) |
| [BUG-012](#bug-012) | `/user/posts` 가 댓글 14건 중 2건만 준다 | 우회 경로 확보 (`/user/comments`) |
| [BUG-013](#bug-013) | REST 인증 헤더를 틀리고 `.catch()`가 삼켰다 | 해결 |
| [BUG-014](#bug-014) | Select 드롭다운이 조상 `overflow-hidden`에 잘렸다 | 해결 |
| [BUG-016](#bug-016) | 로그인 게이트가 아이콘·매니페스트를 튕겼다 | 해결 |
| [BUG-015](#bug-015) | NumberTicker 숫자가 옆 단위 텍스트보다 위로 떴다 | 해결 |
| [BUG-017](#bug-017) | 배포 후 로그인 버튼이 500 (환경변수 0개 + localhost redirect_uri) | 해결 |
| [BUG-018](#bug-018) | `cookies()`를 REST 헬퍼에 넣자 단위 테스트가 죽었다 | 해결 |
| [BUG-019](#bug-019) | 멘션 알림을 첫 100건만 받아 조용히 잘린다 | 해결 |
| [BUG-020](#bug-020) | Notification Stack이 펼치면서 헤더를 덮었다 | 해결 |
| [BUG-021](#bug-021) | `document.cookie` 대입을 React 컴파일러가 막았다 | 해결 |
| [BUG-022](#bug-022) | "알림으로는 딥링크를 못 만든다"를 문서 네 곳에 잘못 적었다 | 해결 |
| [BUG-023](#bug-023) | 알림 카드가 레이어 뒷판 밖으로 삐져 나왔다 (그리드 트랙) | 해결 |
| [BUG-024](#bug-024) | 소식을 눌러도 그 글로 안 갔다 — 조립한 딥링크가 로그인에서 대상을 잃는다 | 해결 |
| [BUG-025](#bug-025) | 모바일에서 카드가 화면 폭 아래로 안 줄어든다 (그리드 트랙 — BUG-023 재발) | 해결 |
| [BUG-026](#bug-026) | 바꾸기 모달 안에서 달력이 패널 뒤로 들어갔다 | 해결 |
| [BUG-027](#bug-027) | 저장한 뒤 다시 `변경`을 누르면 옛 값이 보이고 `저장`이 켜져 있다 | 해결 |
| [BUG-028](#bug-028) | 나를 부른 사람들 17줄 중 12줄에 상태 배지가 없었다 | 해결 |
| [BUG-029](#bug-029) | `useReducedMotion()`으로 렌더를 갈랐더니 hydration이 어긋났다 (3곳) | 해결 |
| [BUG-030](#bug-030) | 업무 필터 API의 `cursor`가 오프셋이 아니라 페이지 번호였다 (271건 유실) | 해결 |
| [BUG-031](#bug-031) | 골격이 안 보였다 — `bg-muted`가 밝은 화면 배경과 같은 색이다 | 해결 |
| [BUG-032](#bug-032) | 리스크·팀·내 업무를 열면 오늘 화면 골격이 먼저 깜빡였다 (부모 `loading.tsx`) | 해결 |
| [BUG-033](#bug-033) | 멘션 본문 아래 댓글 골격이 버튼 너비로 눌렸다 (`flex` 항목 안의 비율 폭) | 해결 |

---

## BUG-001

**`flow_list_alarms`가 서버측 스키마 검증에서 죽는다** — 2026-07-27 확인, 열림

인자 없이 호출하거나 `size: "5"`로 호출해도 같다.

```
{"code":"TOOL_EXECUTION_FAILED","message":"[
  { \"expected\": \"string\", \"code\": \"invalid_type\",
    \"path\": [\"alarms\",\"alarms\",0,\"message\"],
    \"message\": \"Invalid input: expected string, received null\" },
  { ... \"path\": [\"alarms\",\"alarms\",0,\"alarmType\"] ... }
]"}
```

flow 서버가 자기 응답을 자기 스키마로 검증하다 실패한다. `message`와 `alarmType`이 실제로는
nullable인데 스키마가 `string` 필수로 잡혀 있다. 우리 쪽에서 고칠 수 있는 게 없다.

**처리**: 오늘 화면의 멘션은 `flow_get_my_worklist.mentions`로 받는다. 같은 데이터를
`{from, title, at, link}`로 주고, 스키마 오류도 없다 (PRD §6.1.2).

**남은 문제**: Phase 2 "알림 읽음 처리"(`flow_mark_alarm_read`)는 알림 ID가 필요한데,
worklist의 멘션에는 ID가 없다. Phase 2 시작 전에 flow에 문의한다 (PRD §12 Q11).

> **07-28 추가**: worklist의 멘션에는 **댓글 본문도 없다**(`{from, title, at, link}` 뿐).
> 그래서 이 도구의 REST 원본인 `GET /user/alarms`를 직접 부른다
> ([rest.ts](../src/lib/flow/rest.ts)) — 스키마 검증 계층이 없으니 `alarmType: null`이
> 문제가 안 된다. 같은 응답에 `alarmId`도 있어서 **읽음 처리 경로도 이제 열려 있다**
> (아직 안 붙였다).
>
> **07-28 오후 — flow 수정을 기다릴 필요가 없어졌다.** 읽음 처리 쓰기 경로까지 REST에 다 있다:
> `PATCH /user/alarms/read` (단건) · `PATCH /user/alarms/read/all` (전체, `projectId` 선택).
> `readYn=N` 필터도 동작한다(실측 — 이 계정은 미확인 멘션 0건). PRD §13 A2·A5로 옮겼고,
> **PRD Q11(수정 일정 문의)은 그래서 닫았다.** 이 도구 자체는 여전히 죽어 있다.
>
> `alarmType` 값도 다시 봤다: 스펙의 `"MENTION"`이 아니라 **`""` 또는 `"E"`**로 온다.
> 종류 판별은 `filters` 파라미터로만 해야 한다 (PRD Q14).

---

## BUG-002

**Turbopack이 `./date.js` 같은 확장자 붙은 상대 import를 못 찾는다** — 해결

`src/lib/aggregate/*.ts`가 NodeNext 스타일로 `from './date.js'`를 쓰고 있었다. `tsc`
(`moduleResolution: bundler`)와 `tsx --test`는 통과하는데 `next build`만 깨졌다.

```
The export groupMentions was not found in module .../src/lib/aggregate/index.ts
The module has no exports at all.
```

**처리**: `src/lib/**`의 내부 상대 import에서 `.js`를 전부 뗐다. `moduleResolution: bundler`라
확장자 없이도 tsc·tsx·Turbopack 모두 해석한다.

**교훈**: `tsc --noEmit`이 통과해도 번들러는 별개다. `next build`까지 돌려야 끝난 것이다.

---

## BUG-003

**Next 16이 `middleware.ts`를 폐기했다** — 해결

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

**처리**: `src/middleware.ts` → `src/proxy.ts`, export 이름 `middleware` → `proxy`.
`config.matcher`는 그대로 동작한다.

---

## BUG-004

**flow OAuth가 `resource` 없이는 인가 요청을 거부한다** — 해결

```
{"error":"invalid_request","error_description":"resource parameter is required (RFC 8707)"}
```

게다가 아무 값이나 받지 않는다. **등록된 MCP 서버만** 허용하고, 지금 통과하는 값은
`https://flow.team/ai/mcp` 하나다. 이 토큰으로 REST(`api.flow.team`)를 부르면 400
`INVALID_REQUEST`가 온다 — audience 불일치다.

**처리**: `authorize`·`token`(code/refresh) 요청 전부에 `resource=https://flow.team/ai/mcp`를
넣는다 (`src/lib/auth.ts`). 데이터 접근은 MCP로 일원화 (PRD §5.1).

---

## BUG-005

**`taskSrno`와 쓰기 도구의 `taskId`가 같은 ID인지 확인 못 했다** — 해결 (2026-07-28)

워크리스트·스탠드업은 업무를 `taskSrno`(예: `45446268`)로 준다. `flow_update_task`는
`taskId`를, `flow_create_comment`는 `postId`를 요구한다. 어느 쪽이 `taskSrno`와 같은
공간인지 확인하지 못한 채 **둘 다에 `taskSrno`를 넘겼다.** 상태 변경은 맞았고 댓글은 틀렸다.

댓글 쪽이 사용자 화면에서 404로 터졌다:

```
{"code":"INTERNAL_FLOW_UPSTREAM_ERROR",
 "message":"flow-ai 호출 실패 (404). {\"statusCode\":404,
   \"message\":\"삭제되었거나 존재하지 않는 콘텐츠입니다.\",\"error\":\"Not Found\"}"}
```

### 판정 결과

| 도구 | 요구 필드 | `taskSrno`를 그대로 넘겨도 되는가 |
|------|-----------|--------------------------------|
| `flow_update_task` | `taskId` (= raw `TASK_SRNO`) | **된다.** 게시글 `76673279`의 시스템 댓글 `'요청' → '피드백' 상태를 변경하였습니다.`(이종석, `20260728134026`)가 성공 증거다 |
| `flow_create_comment` | `postId` (= `colabo_commt_srno`) | **안 된다.** 다른 ID 공간이다 |

실측 대응: 업무 `taskSrno 41679745` ↔ 게시글 `postId 76673279` (프로젝트 `2236827`).

### 막힌 경로들 (전부 실측)

- `flow_get_post(postId).tasks[].TASK_SRNO` — 대응은 보이지만 **방향이 반대다**(postId를 이미 알아야 한다).
- `flow_list_project_items` — 응답이 `posts[]`이고 `taskId` 필드가 **아예 없다**. api-spec §6.2 엔드포인트를 감싼 것으로 보인다.
- `flow_search` — 게시글 제목·본문만 인덱싱한다. `TASK_NM`은 안 걸린다 (`Q004 보안이슈로 인한 DB 분리`로 확인).
- 게시글 제목으로 역추적 — 한 게시글이 업무 행을 최대 50개(`subTaskCount:"50"`) 물고 각 행의 `TASK_NM`이 제목과 다르다. 제목 중복도 실재한다(`LGI-REQ-기타-일반-테스트-001`이 서로 다른 두 postId).
- tinyUrl(`https://flow.team/l/…`) → `302 signin.act?postlink=…` (웹 세션 필요), `flow_collect_project_chain({link})` → 400 권한 오류 (BUG-011).

### 처리

REST 업무 필터 API(api-spec §6.1)가 한 응답에 `taskId`와 `postId`를 **같이** 준다 —
MCP에는 이 조합을 주는 도구가 없다.

```
GET /user/posts/projects/{projectId}/tasks/filter?pageSize=100&searchWord={업무명}
→ data.tasks[] = [{ taskId, postId, ... }]
```

`searchWord`가 `TASK_NM`을 **서버측에서** 검색한다 — 프로젝트 `2236827`의 업무 600건+가
2건으로 줄었다. 이걸 `src/lib/flow/rest.ts`의 `resolvePostId(projectId, taskSrno, title)`로
싸서 `createComment`가 MCP를 부르기 전에 ID를 바꾼다. 최종 판정은 항상 `taskId` 일치다 —
같은 이름의 업무가 여럿이라 이름으로는 못 고른다.

못 찾으면 `이 업무는 flow에서 댓글을 남겨주세요.`를 낸다. 폼 바로 위에 flow 링크가 있다.
회귀 방어는 `src/lib/flow/rest.test.ts`의 `taskSrno를 postId로 바꾸기` 4건.

**남은 구멍**: 같은 이름의 업무가 100개를 넘으면 첫 페이지에서 못 찾는다. REST 키는 발급자
한 명에게 묶여 있어(`rest.ts` 상단) 발급자가 접근 못 하는 프로젝트도 해소가 안 된다.
새는 경로는 아니다 — 댓글 자체는 로그인한 사람의 MCP 토큰으로 나가 flow가 권한을 다시 본다.

---

## BUG-006

**세션 봉인 변조 테스트가 가끔 통과했다** — 해결

`auth.test.ts`의 "변조·쓰레기 입력은 던지지 않고 null"이 열 번에 한두 번 실패했다.
변조 방식이 base64url **마지막 글자**를 바꾸는 거였는데, 마지막 글자는 패딩 비트를 물고
있어서 다른 글자로 바꿔도 **같은 바이트로 디코드된다**. 그러면 GCM 태그가 멀쩡하니
`unseal`이 정상 값을 돌려주고 assert가 깨진다.

**처리**: 항상 유효 비트인 **첫 글자**를 바꾼다. 10회 연속 통과 확인.
암호화 코드는 멀쩡했다 — 테스트가 틀렸다.

---

## BUG-007

**`flow_list_projects`가 flow 서버에서 자기 응답 스키마 검증에 실패한다** — 우회함 (원인은 flow 측)

```
{"code":"TOOL_EXECUTION_FAILED","message":"[{
  \"expected\": \"object\", \"code\": \"invalid_type\",
  \"path\": [\"projects\"],
  \"message\": \"Invalid input: expected object, received array\" }]"}
```

**07-27에는 됐다** (프로젝트 59건 실측). 07-28 아침부터 실패한다. 입력 스키마에 `projects`
같은 인자가 아예 없으므로(`cursor` 하나뿐) **출력 검증**이다 — flow가 자기가 만든 응답을
자기 스키마로 거르다 떨어뜨린다. BUG-001(`flow_list_alarms`)과 같은 부류.

**우리 코드가 아니라는 근거**: 우리 앱과 무관한 별도 MCP 클라이언트(Claude Code)로 같은
토큰 없이 호출해도 **동일한 에러**가 온다.

### 이게 왜 화면을 죽였나 (이쪽은 우리 잘못)

`projectId`는 모든 쓰기 도구의 필수 인자인데 워크리스트·스탠드업이 안 준다. 그래서 이
도구로 이름→ID 맵을 만든다. 오늘 화면은 `.catch()`가 있어 버텼지만 **리스크 화면에는
없어서 500이 났다.** "한 도구 때문에 화면 전체를 날리지 않는다"는 원칙을 한쪽에만 적용했다.

### 처리

1. `loadRisk`에도 `.catch(() => null)`. 이제 ID를 못 구하면 쓰기 UI만 사라지고 화면은 선다.
2. **대체 경로** [src/lib/flow/search.ts](../src/lib/flow/search.ts) — `flow_search_project`는
   멀쩡하다. 화면에 실제로 뜨는 프로젝트 이름만 골라 하나씩 검색한다 (한 부서 스탠드업에
   뜨는 프로젝트는 한 자릿수다. 플랫폼개발팀은 1개).
   - 검색 결과 제목에는 매칭 구간이 `!#!…!#!`로 감싸여 온다. 걷어내고 비교한다.
   - **정확히 같은 제목만 채택.** "삼성전기 사업추진 관리"처럼 비슷하기만 한 건 버린다 —
     엉뚱한 프로젝트에 업무를 만드느니 쓰기 버튼이 안 보이는 게 낫다.
3. `flow_list_projects`가 살아나면 자동으로 1순위로 돌아간다. 지울 코드는 없다.

**flow에 알릴 것**: 이 도구는 지금 아무도 못 쓴다.

### 07-28 추가 — 검색만으로는 못 메우는 구멍

07-28 오후에도 여전히 같은 에러다(재확인). 그런데 2번 대체 경로에는 한계가 있다:
**이름으로 검색하므로 이름을 모르는 프로젝트는 못 푼다.** 멘션 알림은 프로젝트 이름 없이
`projectId`만 주기 때문에, 멘션 줄의 프로젝트명이 14건 중 7건만 떴다.

그래서 죽은 MCP 호출을 **REST 전량 목록**으로 갈았다 — `GET /user/projects`
(api-spec §5.2, 페이지 크기 500 고정, 실측 59개 = MCP가 살아 있을 때와 같은 개수).
`listProjects()` in [rest.ts](../src/lib/flow/rest.ts). 프로젝트명 14/14가 됐다.

두 출처를 겹쳐 쓴다 ([queries.ts](../src/lib/flow/queries.ts) `projectIdMap`). REST는 API Key
발급자 기준이라 다른 사람이 로그인하면 그 사람 프로젝트가 아니므로, 로그인한 사람 권한으로
도는 검색 결과를 위에 덮는다 — 겹치는 이름은 항상 검색 쪽이 이긴다. 호출은 REST 한 번만
늘었다(검색은 원래도 매번 돌았다).

> 이름이 같은 다른 프로젝트가 두 계정에 걸쳐 있으면 남의 ID를 집을 수 있다. 그때도 쓰기는
> 로그인한 사람 토큰으로 나가서 flow가 권한을 다시 보므로 실패로 끝난다 — 엉뚱한 곳에
> 쓰이지는 않는다. 실측 59개에 이름 중복은 없다.

---

## BUG-008

**상태 드롭다운에 항목이 하나도 없었다** — 해결

`TASK_STATUS`(요청/진행/피드백/완료/보류)를 `app/(app)/actions.ts`에서 export 하고
클라이언트 컴포넌트 `task-actions.tsx`에서 import 했다. 그런데 그 파일은 `"use server"`다.
**Next는 서버 액션 모듈에서 함수가 아닌 export를 클라이언트 번들에서 지운다.** 그래서
브라우저에는 `{}`로 도착했고, `Object.entries(TASK_STATUS).map(...)`이 항목 0개를 그렸다.

빌드도 타입 검사도 통과한다. 런타임에만 조용히 빈다.

```
role="option" 개수: 0   ← 고치기 전
role="option" 개수: 5   ← 고친 후
```

확인 문구도 같이 깨져 있었다 — `TASK_STATUS[picked]`가 `undefined`라서
"undefined(으)로 바꿀까요?"가 떴다.

**처리**: 상태 맵을 평범한 모듈 [src/lib/task-status.ts](../src/lib/task-status.ts)로 옮겼다.
키는 `FlowLegacyTaskStatus`(`lib/flow/types.ts`)로 묶어서 flow enum과 어긋나면 타입이 잡는다.
`actions.ts`도 여기서 import 한다 — 정의는 한 군데만 둔다.

**교훈**: `"use server"` 파일에서는 **async 함수와 타입만** 내보낸다. 상수·객체는 평범한 모듈로.

---

## BUG-009

**업무 상세를 펼치면 아래쪽 UI가 잘려 보였다** — 해결

**두 번에 걸쳐 고쳤다. 1차 진단이 틀렸다** — 기록으로 남긴다.

### 1차 (부분 해결)

본문에 `-mx-5`를 줘서 컴포넌트 자체 좌우 패딩(`px-5`)을 상쇄하고 있었다. 음수 마진으로
내용이 행보다 40px 넓어졌고, 그만큼 오른쪽이 잘렸다. 패딩을 `classNames.body`로 덮어서
음수 마진을 없앴다.

```
classNames={{ body: "px-0 pb-3", description: "text-sm text-foreground" }}
```

벤더링한 컴포넌트가 `cn("px-5 pb-5", classNames?.body)`로 병합하므로 뒤에 온 `px-0`이 이긴다.
**그런데도 잘림이 남았다.** 오히려 `px-0`으로 내용을 끝까지 붙이는 바람에 진짜 원인이
더 눈에 띄게 됐다.

### 2차 (진짜 원인)

행 컨테이너 자체가 `overflow-hidden` + **애니메이션되는 `border-radius: 28px`**이다
([bouncy-accordion.tsx:188](../src/components/motion/bouncy-accordion.tsx)).
우리는 `classNames.item`에 `bg-transparent`를 줘서 배경을 지웠고, 그래서 라운드가 **안
보인다**. 하지만 **`overflow-hidden`은 그대로 살아 있어서 네 모서리 곡선이 계속 내용을
잘라낸다.** 보이지 않는 모서리가 자르고 있었다.

계산이 스크린샷과 맞는다. 트리거의 코멘트 아이콘(`h-4 w-4`, `min-h-7` 안에서 수직 중앙 →
상단 6px)의 왼쪽 클리핑 경계는

```
x = 28 - √(28² − (28 − 6)²) = 28 − 17.3 = 10.7px
```

아이콘 폭이 16px이니 왼쪽 2/3가 먹힌다 — 말풍선이 `⌐)`처럼 보인 이유다. 하단도 같다:
`pb-3`(12px) 위치에서 5px가 물린다.

**처리**: `classNames.item`에 `overflow-visible`을 추가했다. `tailwind-merge`가 `overflow`
그룹 충돌을 정리해서 원본의 `overflow-hidden`을 이긴다.

```
item: "overflow-visible bg-transparent"
```

높이 애니메이션 클리핑은 별도 래퍼([254행](../src/components/motion/bouncy-accordion.tsx))가
담당하고 그쪽엔 라운드가 없어서 영향이 없다. 적용 2곳:
[task-actions.tsx](../src/components/task-actions.tsx),
[new-task-form.tsx](../src/components/new-task-form.tsx).

**교훈**: **투명 배경은 `overflow-hidden`을 끄지 않는다.** 라운드가 안 보인다고 클리핑도
없어졌다고 생각하면 안 된다. 그리고 "고쳤다"를 스크린샷 없이 말하지 말 것 — 1차에서
증상이 남아 있는데 해결로 적었다.

---

## BUG-010

**헤더 블러가 적용됐는데 눈에 안 보였다** — 해결

`backdrop-blur-md`를 걸었지만 헤더 배경이 `bg-card`(불투명 `#141613`)였다. **불투명 배경
뒤에는 흐릴 것이 없다.** 필터는 정상 동작했고, 볼 게 없었을 뿐이다.

**처리**: 배경을 반투명으로 내리고 블러·채도를 올렸다.

```
bg-card/55 backdrop-blur-2xl backdrop-saturate-200
```

다크 테마는 배경 대비가 낮아서 블러가 잘 안 보인다. `saturate`를 함께 올려야 스크롤되는
콘텐츠 색이 헤더에 번져 효과가 읽힌다.

---

## BUG-011

**`flow_collect_project_chain`이 모든 입력에서 권한 오류를 낸다** — 우회함 (원인은 flow 측)

```
{"code":"INTERNAL_FLOW_UPSTREAM_ERROR",
 "message":"... 해당 프로젝트에 접근 권한이 없습니다."}
```

`link`(tinyUrl) 2종·`postId` 셋 다 같다. 정작 그 프로젝트는 `flow_get_my_worklist`에
내 업무로 뜨는 것이다 — 실제로 권한이 없을 수가 없다. 도구 설명이 약속하는 "댓글 트리
수집"과 "tinyUrl 해석"을 둘 다 못 쓴다.

**우회 시도도 막혔다**: tinyUrl을 직접 풀어보려 했지만 `https://flow.team/l/{code}`는
`302 → /signin.act?...&postlink={code}`로 간다. **웹 세션 쿠키가 필요하고 API 베어러
토큰으로는 안 된다.**

**처리**: 멘션 댓글 본문은 REST `GET /user/alarms`로 받는다 ([rest.ts](../src/lib/flow/rest.ts),
api-spec §7.1). 이쪽은 `content`·`postId`·`replyId`를 한 번에 준다.

---

## BUG-012

**`GET /user/posts/{postId}`가 댓글 14건 중 2건만 준다** — 열림 (flow 측)

게시글 81211887이 `remarkCount: "14"`를 보고하는데 `remarks` 배열에는 2건만 있다.
더 받을 손잡이가 없다:

| 필드 | 값 | 기대 |
|---|---|---|
| `nextYn` | `"N"` | 12건 남았는데 "다음 없음" |
| `totalCount` | `"0"` | 총 건수 0 |
| `remarkSrno` | `""` | 커서로 쓸 값이 비어 있음 |

`?remarkSrno=` · `?cursor=` 를 붙이면 `VALIDATION_ERROR / unrecognized_keys`.

**영향**: **"전체 계층 댓글 스레드"는 flow API로 만들 수 없다.** 우리가 낼 수 있는 최대치는
알림이 주는 "나를 멘션한 댓글" 전부 + `replyId`로 판정한 답글 한 단 들여쓰기다. 부모 댓글은
나를 멘션하지 않았으면 알림에 오지 않으므로 진짜 트리로는 못 세운다 — 화면 주석에 이 한계를
적어 뒀다 ([page.tsx](<../src/app/(app)/page.tsx>)).

전문이 필요하면 flow 링크로 보낸다. 흉내내지 않는다.

### 07-28 오후 정정 — 위 "만들 수 없다"는 틀렸다. 전용 엔드포인트가 있다

`GET /user/comments/{postId}`. **같은 게시글 81211887에서 14건 전부 왔다.**

```
GET /user/comments/81211887  → 200
  hasNext: false, lastCursor: 13, comments: 14건
```

**왜 못 찾았나**: [api-spec.md](api-spec.md) §0의 번들 복원이 노드 번호를 `{18,19,21,23,24,25,26}`
으로 좁게 짚어서 **3개 도메인 12개 엔드포인트를 통째로 빼먹었다** — comments(2) · drive(3) ·
wiki(7). 그래서 "게시글 상세의 `remarks`가 유일한 경로"라고 단정했고, 그 단정 위에 "만들 수
없다"를 얹었다. 엔드포인트 목록을 다 세지 않고 스키마 복원으로 넘어간 게 원인이다.

**처리**: api-spec §13에 실측 스키마를 적었다. 구현은 PRD §13 A1 / Phase 5로 옮겼다.
`remarks`가 2건만 오는 것은 여전히 flow 측 문제지만, **우회로가 있으므로 화면을 막지 않는다.**

**구현 전 알아야 하는 두 가지** (실측):

| 관측 | 내용 |
|---|---|
| `systemCode` | 14건 중 **10건이 시스템 자동 댓글**이다(담당자·마감일·우선순위 변경 로그). 안 거르면 "마지막 댓글"이 `담당자를 '서동조','김승호'로 추가하였습니다`가 된다. truthy면 버린다 |
| `contents` | `@[이름](id)` 멘션 마크업이 **그대로** 온다. 알림 API(`content`)는 걷어서 주는데 이쪽은 안 걷는다 — 표시 전에 벗겨야 한다 |

**교훈**: BUG-013과 같은 부류다. 그때는 추측을 "미검증"으로 적었고, 이번엔 **불완전한 목록
위에서 "불가능"을 단정했다.** "이 API로는 안 된다"를 쓰기 전에 **엔드포인트 목록이 전수인지**
먼저 확인할 것.

---

## BUG-013

**멘션 댓글 본문이 하나도 안 붙었다 — 인증 헤더를 틀렸고 `.catch()`가 조용히 삼켰다** — 해결

`rest.ts`가 `Authorization: Bearer <세션 액세스 토큰>`으로 알림을 조회했다. 실측:

| 헤더 | 결과 |
|------|------|
| `Authorization: Bearer <API Key>` | `401` |
| `x-flow-api-key: <API Key>` | `200` + 알림 100건 |

api-spec §1.2에 이미 적혀 있었다 — "공식 문서의 모든 `/user/*` 설명문은 `x-flow-api-key`
기준". 읽고도 Bearer를 썼다.

**진단이 늦어진 이유가 더 문제다.** 호출부가 `.catch(() => null)`이라 401이 흔적 없이
사라졌다. 화면은 "본문 없는 정상 화면"과 구분이 안 됐고, 나는 원인을 audience 불일치
(BUG-004)로 **추측**해서 "검증 못 했다"고 문서에 적었다. 실제로는 헤더 하나였고,
`curl` 한 번으로 5초 만에 판정할 수 있었다.

**처리**

1. 헤더를 `x-flow-api-key`로 바꿨다. 인증 주체는 API Key 발급자로 고정된다.
2. **유출 방어선**: API Key는 발급자 한 명의 알림만 준다(`receiverId` 고정). 그래서
   `mergeMentionComments(mentions, alarms, me)`가 `receiverId !== me`인 알림을 버린다.
   다른 사람이 로그인하면 붙는 알림이 0건 → 본문 없는 지금 화면이 뜬다.
   테스트 2건으로 박아 뒀다 (`rest.test.ts`).
3. **실데이터로 확인했다.** 워크리스트 멘션 4건 ↔ 알림 100건 조인 → 4/4 본문·실명·답글
   플래그 정상, 다른 사용자로는 0건.

**교훈**: `.catch()`로 흘리는 보조 데이터는 **실패했는지 알 수 없다**. 화면이 정상으로
보이는 실패는 가장 늦게 발견된다. 새 외부 호출은 붙이기 전에 `curl`로 한 번 때려보고,
추측을 문서에 "미검증"으로 적기 전에 검증할 수 있는 방법이 진짜 없는지 먼저 볼 것.

---

## BUG-014

**상태 Select 드롭다운이 잘렸다 — 클리핑 조상이 두 개 더 있었다** — 해결

BUG-009로 아코디언 **행**의 클리핑은 껐는데 드롭다운은 여전히 잘렸다. 원인이 하나가 아니었다.

드롭다운 패널은 portal이 아니라 `absolute`다
([select.tsx:363](../src/components/motion/select.tsx)). `absolute`는 조상의
`overflow`를 벗어나지 못한다. 위로 올라가며 자르는 조상이 둘이었다.

| 조상 | 왜 자르나 |
|------|-----------|
| 아코디언 높이 애니메이션 래퍼 | `height`를 0↔실측값으로 애니메이션하려면 `overflow-hidden`이 **필요하다** |
| `ui/card.tsx` | shadcn 원본이 `overflow-hidden rounded-xl`을 달고 있다 |

**portal을 안 쓴 이유** — 두 가지가 막는다. (1) 조상에 Framer Motion transform이 걸려
있어서 `position: fixed`도 containing block에 갇힌다. (2) 조건부 portal은 닫힐 때
`SelectItem`을 언마운트해서 라벨 등록이 날아간다 (select.tsx:310 주석: 패널만
애니메이션하고 아이템은 계속 마운트해 둔다). 조상 쪽을 고치는 게 훨씬 작다.

**처리 1 — 아코디언 래퍼**: 애니메이션 중에는 자르고, **다 열린 뒤에만** 푼다.

```tsx
const [settledOpen, setSettledOpen] = useState<boolean | null>(null);
const settled = settledOpen === open;   // open이 바뀌는 순간 저절로 false
...
onLayoutAnimationComplete={() => setSettledOpen(open)}
style={{ overflow: open && settled ? "visible" : "hidden" }}
```

"안착한 상태"를 저장하면 리셋 로직이 필요 없다 — `open`이 뒤집히면 `settled`가 즉시
false가 된다. 콜백이 안 오는 경우에도 계속 잘린 상태로 남을 뿐이라 안전하다.

**처리 2 — `Card`**: 기본 클래스에서 `overflow-hidden`을 뺐다
([card.tsx:15](../src/components/ui/card.tsx)). 호출부 3곳에 `overflow-visible`을
붙이는 대신 공유 컴포넌트 한 줄을 고쳤다 — 앞으로 추가되는 카드도 자동으로 안 잘린다.
빼도 잃는 게 없다: 배경은 `rounded-xl`이 알아서 자르고(배경은 border-radius를 따른다),
이미지 모서리는 같은 클래스의 `*:[img:first-child]:rounded-t-xl`이 직접 깎는다. 이 앱
카드에는 이미지도 없다.

**교훈**: portal 없는 `absolute` 팝오버는 **조상 전체 사슬**을 봐야 한다. 하나 껐다고
끝이 아니다. 그리고 애니메이션에 꼭 필요한 클리핑은 지우는 게 아니라 **애니메이션이
끝난 뒤 푸는** 게 맞다.

---

## BUG-015

**NumberTicker 숫자가 옆 단위 텍스트보다 위로 떴다** — 해결

KPI 칸의 큰 숫자와 `/ 31`이 `items-baseline` 한 줄에 있는데 숫자가 5~6px 위로 떠 있었다.

원인은 CSS 인라인 베이스라인 규칙이다. 굴러가는 숫자 열은 `overflow: hidden`으로 창을
만드는데, **`overflow`가 `visible`이 아닌 `inline-block`의 베이스라인은 글자 베이스라인이
아니라 박스의 아래 마진 끝**이다 (CSS 2.1 §10.8.1). 게다가 창 안에서 숫자를 `items-center`로
가운데 정렬해 뒀으니, 잉크가 박스 바닥에서 `(1.1em − 자획높이) / 2`만큼 더 올라가 있었다.
28px 기준 약 5.6px — 화면에서 보인 그 값이다.

**처리**: 창 안에 안 보이는 숫자 하나를 흐름에 남겨 베이스라인을 만들었다
([number-ticker.tsx](../src/components/motion/number-ticker.tsx)).

```tsx
<span className="relative inline-block">
  <span className="invisible">{digit}</span>          {/* 베이스라인·폭 기준점 */}
  <span className="absolute inset-0 overflow-hidden"> {/* 창 = 위 글자의 줄 높이 */}
    <motion.span animate={{ y: `-${digit * 10}%` }} className="... h-[1000%] flex-col">
      {DIGITS.map((n) => <span key={n} className="h-[10%] shrink-0">{n}</span>)}
    </motion.span>
  </span>
</span>
```

곁들여 고친 것 둘.

- **행 높이를 `em`에서 `%`로 바꿨다.** 열이 창의 1000%, 행이 그 10% = 정확히 창 하나다.
  `1.1em`으로 박아 두면 `leading-*`이 다른 자리에 쓸 때 글자가 어긋난다.
- **셀 폭 `1ch`를 지웠다.** `ch`는 tabular 자폭이 아니라 **비례 `0`의 자폭**이다. 기준점
  글자가 폭을 정하게 두면 되고, 루트에 `tabular-nums`가 걸려 있어 어느 숫자든 같은 폭이다.

**교훈**: `overflow-hidden`을 인라인 요소에 걸면 베이스라인이 조용히 바뀐다. 클리핑이
필요하면 **클리핑하는 박스를 `absolute`로 띄우고, 흐름에는 베이스라인용 요소를 남긴다.**

---

## BUG-016

**로그인 게이트가 아이콘·매니페스트를 `/login`으로 튕겼다** — 해결

PWA 아이콘과 매니페스트를 넣은 직후 `next start`로 실측했더니 이랬다.

| 경로 | 응답 |
|------|------|
| `/favicon.ico` | 200 |
| `/apple-icon.png` | **307 → /login** |
| `/icon-192.png` | **307 → /login** |
| `/manifest.webmanifest` | **307 → /login** (본문이 `/login` 문자열) |

원인은 [proxy.ts](../src/proxy.ts) matcher가 예외를 **이름으로** 적어둔 것이다.

```
"/((?!login|api/auth|_next/static|_next/image|fonts|favicon.ico).*)"
```

`favicon.ico` 하나만 이름으로 빠져 있었으니, 그때까지는 우연히 아무 문제가 없었다. 에셋을
하나 더 넣는 순간 게이트가 그걸 보호 대상으로 보고 리다이렉트했다. 브라우저는 매니페스트를
읽을 수 없으니 **PWA 설치가 아예 안 된다.**

**처리**: 예외를 이름에서 **확장자**로 바꿨다.

```
"/((?!login|api/auth|_next/static|_next/image|fonts|.*\\.(?:ico|png|jpg|svg|webmanifest)$).*)"
```

아이콘과 매니페스트는 비밀이 아니라서 게이트 뒤에 둘 이유가 없고, 앞으로 에셋을 더 넣어도
이 줄을 고칠 일이 없다. `favicon.ico`는 확장자 규칙에 흡수돼서 목록에서 뺐다.

검증은 `next start` + `curl`로 했다 — 에셋 6개 전부 200, 보호 경로(`/`, `/risk`, `/team`)는
그대로 307이다.

**교훈**: 인증 게이트의 예외를 파일 이름으로 적으면, 다음에 에셋을 넣는 사람이 조용히
밟는다. 게이트는 **무엇을 지키는지**로 적어야 한다 — 정적 에셋은 지킬 대상이 아니다.

---

## BUG-017

**Vercel 배포 후 로그인 버튼이 500** — 2026-07-28, 해결

첫 배포 직후 `flow.tenziro.net`의 "flow로 로그인"을 누르면 본문 없는 500이었다.

```
GET https://flow.tenziro.net/api/auth/login  → 500, content-length: 0
```

벽이 **두 개** 겹쳐 있었다.

**1) Vercel 프로젝트에 환경변수가 0개** — `vercel env ls`가 빈 목록이었다.
[login/route.ts](../src/app/api/auth/login/route.ts)는 `authorizeUrl()`을 부르고, 그게
[auth.ts](../src/lib/auth.ts)의 `env("FLOW_CLIENT_ID")`에서 던진다. 이 라우트에는
`try`/`catch`가 없어서 그대로 500이 된다. `.env.local`은 커밋 대상이 아니니 배포에는
안 따라간다 — 배포는 **환경변수 설정이 별도 단계**다.

콜백 라우트는 같은 실수를 해도 500이 안 난다. 거기는 `deny()`로 감싸여 있어서 로그인
화면에 사유가 뜬다. 두 라우트의 차이가 "빈 500 vs 읽을 수 있는 메시지"를 갈랐다.

**2) OAuth 클라이언트에 localhost redirect_uri만 등록돼 있었다.** 1번만 고치면 다음
벽에서 막힌다 — 확인하려고 프로덕션 주소로 authorize를 직접 쳐 봤다.

```
GET /authorize?...&redirect_uri=https://flow.tenziro.net/api/auth/callback/flow
→ 400  invalid_request  "Invalid redirect URI. The redirect URI provided does not
                         match any registered URI for this client."
```

기존 `client_id`는 개발 중 `http://localhost:3000/api/auth/callback/flow`로 DCR 등록한
것이다. redirect_uri는 **클라이언트에 박혀서** 환경변수만 바꿔 되는 값이 아니다.

**처리**

- flow OAuth `/register`(DCR, 승인 불필요)로 **프로덕션 전용 클라이언트**를 새로 발급 →
  `redirect_uris: ["https://flow.tenziro.net/api/auth/callback/flow"]`, 201.
  로컬 개발용 자격증명(`.env.local`)은 손대지 않았다 — dev/prod 자격증명 분리.
- Vercel Production 환경변수 6개 설정: `FLOW_OAUTH_ISSUER` `FLOW_API_BASE`
  `FLOW_API_KEY` `FLOW_CLIENT_ID` `FLOW_CLIENT_SECRET` `FLOW_REDIRECT_URI`.
  `SESSION_SECRET`은 프로덕션용으로 **새로 생성**했다 (32바이트 랜덤) — 로컬 키와 같은
  값을 쓰면 로컬에서 만든 세션 쿠키가 프로덕션에서 그대로 풀린다.
- 재배포. **환경변수는 새 배포에만 적용된다** — 값만 넣고 기다려도 안 고쳐진다.

**검증**

```
GET /api/auth/login                → 307  location: .../authorize?...redirect_uri=https%3A%2F%2Fflow.tenziro.net%2F...
GET (그 authorize URL)             → 302  location: https://flow.team/oauth/flow_login.act?...
```

400이 아니라 flow.team 로그인 화면까지 간다. 그 뒤(계정 입력 → 콜백 → 토큰 교환)는 실제
flow 자격증명이 필요해서 curl로는 못 넘어간다.

**교훈**: `client_secret` 만료(2026-10-26)에 프로덕션 클라이언트가 하나 더 늘었다.
그리고 OAuth 앱의 배포는 "환경변수 옮기기"가 아니다 — **도메인이 자격증명에 박힌다.**
도메인을 바꾸면 DCR을 다시 해야 한다.

---

## BUG-018

**`cookies()`를 REST 헬퍼에 넣자 단위 테스트 4건이 죽었다** — 2026-07-28, 해결

개인 API 키를 지원하려고 [rest.ts](../src/lib/flow/rest.ts) `get()`에 쿠키 조회를 한 줄
넣었다. 키 해소 순서는 인자 → 쿠키 → 환경변수다.

```
const key = apiKey ?? (await getApiKey()) ?? process.env.FLOW_API_KEY;
```

`resolvePostId` 테스트 4건이 이렇게 터졌다.

```
`cookies` was called outside a request scope.
  throwForMissingRequestStore (next/src/server/app-render/work-unit-async-storage.external.ts:415)
  getApiKey (src/lib/auth.ts:153)
  get (src/lib/flow/rest.ts:84)
```

**원인**: `next/headers`의 `cookies()`는 요청 AsyncLocalStorage에 의존한다. 테스트는
`resolvePostId`를 요청 없이 직접 부르고 `fetch`만 목으로 바꾸므로 저장소가 비어 있다.
쿠키가 환경변수보다 **먼저** 오기 때문에 환경변수를 세팅해 둬도 그 앞에서 던졌다.

**처리**: 쿠키 조회에만 `.catch(() => null)`을 붙여 요청 밖에서는 다음 후보(환경변수)로
넘어가게 했다. `unseal`은 이미 실패를 null로 돌려주므로, 이 catch가 삼키는 것은 "요청
스코프가 없다" 한 가지다.

```
const key = apiKey ?? (await getApiKey().catch(() => null)) ?? process.env.FLOW_API_KEY;
```

**교훈**: 요청 스코프에 의존하는 API(`cookies()` `headers()`)를 순수 헬퍼에 심으면 그
헬퍼를 부르는 모든 경로가 요청 안이라고 가정하는 셈이다. 단위 테스트는 그 가정 밖에 있다.

---

## BUG-019

**멘션 알림을 첫 100건만 받는다 — `hasNext`가 이미 켜져 있다** — 2026-07-28 확인, **해결** (v0.15.0)

`listMentionAlarms()`가 `size=100` 한 페이지만 본다 ([rest.ts](../src/lib/flow/rest.ts) `SIZE`).
실측:

```
GET /user/alarms?filters=MENTION&size=100  → 100건, hasNext: true   ← 이미 잘려 있다
GET /user/alarms?filters=WORKER&size=100   → 100건, hasNext: true
GET /user/alarms?filters=REGISTRANT&size=100 → 85건, hasNext: false
```

`size`의 상한이 100이고(api-spec §7.1) **알림 API에는 날짜 필터가 없다.** 그래서 받는 건
항상 "최신 100건"이다.

**지금 왜 화면이 멀쩡해 보이나**: 조인 대상인 워크리스트 멘션이 최근 14일 28건이고, 그 28건이
최신 100건 안에 들어 있다. 겹치니까 4/4가 붙었다 (BUG-013 검증). 활동량이 늘어 최근 14일
멘션이 100건 밖으로 밀리면 **본문만 조용히 비고 행은 그대로 뜬다** — BUG-013과 똑같은
"정상으로 보이는 실패"다.

**처리 (v0.15.0)**: `listAlarms(filters, { days })`가 `lastCursor`로 커서 루프를 돈다. 종료
조건 셋 — `hasNext: false`, **페이지의 마지막 알림이 `days` 창 밖으로 나갈 때**, `MAX_PAGES`
10장. 둘째가 없으면 알림 전량을 긁는다(계정당 수천 건일 수 있다). 셋째는 알림이 최신순으로
온다는 전제가 틀렸을 때의 안전판이다. `days`를 안 주면 첫 페이지 한 장이다 — 헤더 소식처럼
"최근 것만" 보는 곳은 그걸로 족하다. PRD §13 A3.

**교훈**: `hasNext`를 안 보고 첫 페이지만 쓰는 코드는 "지금은 맞다"일 뿐이다. `ponytail:`
주석으로 상한을 밝혀 뒀더라도(`rest.ts`의 `listProjects`처럼) 상한이 **이미 넘었는지**는
따로 확인해야 한다. `listProjects`는 59 < 500으로 안 넘었고, 이쪽은 넘었다.

---

## BUG-020

**beUI Notification Stack이 펼치면서 헤더를 덮었다** — 2026-07-29, 해결

헤더 알림 종의 레이어로 넣었더니, 펼칠 때 카드가 **위로** 자라 헤더와 종을 가렸다.

원인은 원본 레이아웃이다. 이 컴포넌트는 크기를 두 겹으로 만든다 — 안 보이는 스페이서 한 장이
버튼의 접힘 크기를 정하고, 실제 카드는 그 위에 `absolute`로 얹힌다. 그 레이어가 `bottom-0`이라
장수가 늘면 아래가 고정된 채 위로 밀린다. 알림 목록이 화면 **아래**에서 뜨는 원래 용례(토스트
스택)에는 맞는 방향이다.

**처리**: 적용본에서 `bottom-0` → `top-0` 한 곳. 접힘 높이는 위 스페이서가 정하니 접혀 있을 때
생김새는 그대로다. → **v0.18.0에서 이 컴포넌트는 지웠다** (PRD §6.1.5 구조). 아래 교훈은 다른
떠 있는 컴포넌트를 가져올 때 그대로 유효하다.

**교훈**: 떠 있는 컴포넌트를 가져올 때는 **앵커 변(邊)**을 먼저 본다. 원본이 어느 쪽에
붙어 있었는지가 성장 방향을 정하고, 그건 스크린샷으로만 드러난다.

같이 밟은 것 둘:

- 팝오버 표면을 끄지 않으면 **카드 안 카드**가 된다. 스택이 제 뒷판을 그리기 때문에
  `PopoverContent`에서 `bg`·`border`·`shadow`·`ring`·`p`를 다 지웠다.
- 스택은 `aria-label`을 붙인 `<button>` 하나다. **라벨이 이기니 안쪽 카드 글자가 스크린
  리더에 안 읽힌다** — 같은 내용을 `sr-only` 목록으로 한 번 더 뒀다. 눈에 보이는 컴포넌트가
  버튼 하나로 접혀 있으면 항상 이걸 확인해야 한다.
  → **v0.16.0에서 `sr-only` 목록은 지웠다.** 카드를 링크로 바꾸면서 바깥 `<button>`을 벗겼고
  (버튼 안에 링크를 못 넣는다), 원인 자체가 없어졌다. 복제본이 아니라 구조가 답이었다.

---

## BUG-021

**`document.cookie`에 대입했더니 React 컴파일러 린트가 막았다** — 2026-07-29, 해결

밝기 토글 클릭 핸들러를 컴포넌트 안에 쓰자:

```
Error: react-hooks/immutability
  Modifying a variable defined outside a component or hook is not allowed
  theme-toggle.tsx:34
```

`document`가 모듈 밖 값이라, 컴포넌트 본문 안에서 그 속성에 대입하는 걸 순수하지 않은 렌더로
본다. 핸들러 안이라 실행 시점은 렌더가 아니지만 정적으로는 구분되지 않는다.

**처리**: DOM·쿠키 쓰기를 모듈 스코프 함수(`apply(next)`)로 올리고 핸들러에서 부른다. 규칙을
피한 게 아니라 제자리를 찾은 것이다 — 이건 렌더가 아니라 클릭이 하는 일이다.

**교훈**: `document`·`window`·`localStorage`에 **쓰는** 코드는 컴포넌트 본문 밖에 둔다.
읽기는 걸리지 않는다.

---

## BUG-022

**"알림으로는 flow 딥링크를 못 만든다"를 코드 주석과 문서 네 곳에 잘못 적었다** — 2026-07-29, 해결

v0.15.0에서 헤더 알림 종을 붙이면서 소식 줄에 링크를 안 달았다. 근거로 적은 문장이 틀렸다:

> flow 딥링크는 MCP 워크리스트·스탠드업에서만 오는 불투명한 단축 URL이라 알림 응답으로는 만들 수 없다.

원인은 **두 가지 링크를 하나로 본 것**이다.

| | 워크리스트 `link` | 게시글 딥링크 |
|---|---|---|
| 형태 | `https://flow.team/l/QBJyf` | `https://flow.team/main.act?projectId=…&postId=…` |
| 출처 | flow가 만들어 준 단축 URL | `flow_search` 결과의 `url` 필드 |
| 우리가 만들 수 있나 | **못 만든다** (해시가 서버에만 있다) | **만든다** (id 두 개면 끝) |

앞의 것만 보고 "딥링크는 못 만든다"로 일반화했고, 그 문장이 `news-bell.tsx` · `rest.ts` ·
PRD §6.1.5 · progress.md 네 곳에 그대로 굳었다. 알림 응답에는 `projectId`와 `postId`가 처음부터
둘 다 있었다.

**처리**: `flowPostUrl(projectId, postId)`를 [queries.ts](../src/lib/flow/queries.ts)에 두고
`TaskNews.url`로 내려보낸다 (v0.16.0). 네 곳의 문장은 고쳤다.

**교훈**: "이 API는 X를 안 준다"고 적기 전에, **다른 API가 X를 어떤 모양으로 주는지** 한 번
본다. 형식만 확인되면 재료가 이미 손에 있는 경우가 있다. 못 한다는 결론은 할 수 있다는 결론보다
검증을 더 받아야 한다 — 틀려도 아무 데서도 안 터지고 그대로 굳는다.

---

## BUG-023

**알림 카드가 레이어 뒷판 밖으로 삐져 나왔다** — 2026-07-29, 해결

소식 카드를 네 줄(프로젝트명·업무명·내용·작성자)로 세우자 카드가 뒷판보다 넓어졌다. 실측:
뒷판 352px, 그리드 컨테이너 328px, **카드 347px** — 오른쪽으로 19px 샜다.

원인은 **그리드 트랙이 카드 min-content까지 벌어진 것**이다. 스택은 카드를 `grid gap-1`의
한 열에 겹쳐 쌓는데, 열 크기를 안 정하면 `auto` = `minmax(auto, max-content)`이고 그
`auto` 최소값이 **아이템의 min-content**다. 새로 넣은 업무명 줄이 `truncate`(=
`white-space: nowrap`)라 min-content가 **제목 전문 길이(313px)** 였고, 트랙이 거기까지
벌어졌다. 컨테이너 폭이 정해져 있어도 그리드 트랙은 그걸 넘긴다.

`min-width: 0`을 카드에 걸어도 안 잡힌다 (347px 그대로) — 이미 벌어진 트랙이 아이템을
늘리는 것이라 아이템 쪽 최소값을 풀어도 소용없다. 트랙 자체를 못 박아야 한다:

```
grid-cols-[minmax(0,1fr)]   // 328px — 뒷판 안에 들어온다
```

**처리**: 스택 컨테이너에 `grid-cols-[minmax(0,1fr)]`. 카드 여섯 장 전부 328px, 넘침 0px로
확인했다. → **v0.18.0에서 스택 자체를 물리면서**(PRD §6.1.5 구조) 목록이 평범한 `<ul>`이
됐고, 이 처리도 같이 없어졌다. 재발 여지가 없다는 뜻이 아니라 **그리드가 아니어서** 없는
것이다 — 다시 그리드로 쌓을 일이 생기면 아래 교훈이 그대로 적용된다.

**교훈**: 말줄임(`truncate`)은 `overflow: hidden`으로 **보이는 걸** 자르지만 min-content는
줄이지 않는다. 그리드 아이템 안에 nowrap 줄을 넣을 때는 트랙을 `minmax(0,…)`로 못 박는다 —
플렉스에서 `min-w-0`을 챙기는 것과 같은 이유고, 그리드에서는 아이템이 아니라 **트랙**에 건다.

---

## BUG-024

**소식을 눌러도 그 글로 안 갔다 — 조립한 딥링크가 로그인 화면에서 대상을 잃는다** — 2026-07-29, 해결

헤더 소식 카드를 누르면 새 탭이 flow **메인 화면**에서 멈췄다. BUG-022에서 "알림으로도 딥링크를
만들 수 있다"고 정정하며 넣은 `https://flow.team/main.act?projectId={projectId}&postId={postId}`
그대로였고, 형식 자체는 `flow_search`가 돌려주는 `url`과 같았다. 그래서 더 안 의심했다.

빠진 건 **세션이 없을 때 무슨 일이 일어나는가**였다. 로그인 안 된 브라우저로 직접 열어 보면
갈라진다:

| 여는 URL | 튕겨 간 곳 | 대상 |
| --- | --- | --- |
| `main.act?projectId=2639815&postId=82010144` | `signin.act?why=no-session&from=ssr-helper` | **없다** |
| `flow.team/l/Qmcn5` | `signin.act?meta=no&postlink=Qmcn5` | `postlink`로 **남는다** |

`main.act`의 쿼리는 로그인 리다이렉트에 실려 가지 않는다. 로그인 뒤에는 갈 곳을 모르니 메인에
떨군다. flow가 만든 짧은 링크 `/l/{code}`는 코드를 `postlink`로 옮겨 실어서 로그인 뒤 그 글을
연다. 소식을 여는 사람 상당수가 flow 세션이 없는 상태라 실사용에서는 거의 항상 이쪽이었다.

**처리**: 업무명 때문에 이미 부르고 있던 `GET /user/posts/{postId}` 응답의 `connectUrl`을 쓴다
(`getPostBrief`, [rest.ts](../src/lib/flow/rest.ts)). 호출은 늘지 않는다. 조립한 URL은
`connectUrl`이 비었을 때의 대비로만 남겼다 (`queries.ts`의 `flowPostUrl`).

**교훈**: 링크는 **로그인된 창에서만** 확인하면 절반만 본 것이다. 인증이 필요한 대상으로 가는
링크는 세션 없는 창에서 한 번 더 열어 봐야 한다 — 로그인 리다이렉트가 대상을 들고 가는지는
URL 형식이 맞는지와 별개 문제다. BUG-022는 "형식이 맞다"까지만 확인하고 닫혔다.

---

## BUG-025

**모바일에서 카드가 화면 폭 아래로 안 줄어든다** — 2026-07-29, 해결

오늘 화면의 밀리는 업무·나를 부른 사람들 두 카드가 좁은 화면에서 폭을 안 줄이고 오른쪽으로
샜다. 오른쪽 끝의 펼침 화살표가 화면 밖으로 나가고, 문서 전체에 가로 스크롤이 생긴다.

**BUG-023과 같은 원인이다.** 두 카드를 얹은 격자를 `grid items-start gap-3 xl:grid-cols-12`로
적어 뒀는데, `xl` 아래에서는 열 크기를 **아무도 안 정한다** → `auto` = `minmax(auto, max-content)`,
그 `auto` 최소값이 **아이템의 min-content**다. 카드 min-content가 화면보다 넓으면 트랙이
거기까지 벌어진다. 컨테이너 폭이 정해져 있어도 그리드 트랙은 그걸 넘긴다.

390px 화면 실측 — 멘션 한 줄을 펼친 상태:

| | 폭 |
| --- | --- |
| 화면 | 390px |
| 문서 `scrollWidth` | **443px** |
| 카드 두 장 (같은 트랙이라 같이) | **428px** |
| 넘침을 만든 댓글 `<p>` min-content | 318px |

min-content를 318px로 만든 건 **댓글에 섞여 온 링크**였다. 띄어쓰기가 없어서 끊을 자리가
없고, 한국어 본문은 글자마다 끊기니 그 링크 한 덩어리가 그대로 최소폭이 된다. 접혀 있을 때는
`::details-content`가 `content-visibility: hidden`이라 크롬에서는 안 드러나는데, 이 의사 요소를
모르는 브라우저에서는 접힌 내용도 계산에 들어간다 — 사용자가 본 화면이 그쪽이다.

**처리** — 둘 다 필요하다:

1. 격자에 `grid-cols-1`. 툴윈드 `grid-cols-1`은 `repeat(1, minmax(0, 1fr))`이라 트랙 최소값이
   0이 된다. 트랙이 `auto`가 아니게 되면 **아이템의 자동 최소 크기도 0**이라 `min-w-0`을 카드마다
   붙일 필요가 없다. 오늘 화면 세 곳과 팀 화면 한 곳 (`xl:grid-cols-12` / `md:grid-cols-2`처럼
   큰 화면만 적어 둔 격자가 전부 같은 함정이었다).
2. 자유 입력 본문에 `wrap-anywhere`(`overflow-wrap: anywhere`). 1번만 하면 카드는 줄지만 링크가
   카드 밖으로 나가 잘린다 — 뒤에 오는 말까지 안 보인다. 댓글 본문(오늘 화면 멘션·`thread-view`)과
   업무 줄 마지막 댓글(`task-item`) 세 곳.

390px·320px에서 접힘/펼침, 바꾸기 모달 열림, 1440px 8:4 유지까지 넘침 0px로 확인했다.

**교훈**: BUG-023의 교훈을 남겨 뒀는데 같은 함정에 또 빠졌다. 교훈이 "스택 컨테이너"에 대해
적혀 있어서 **반응형 격자의 기본 상태**에는 안 읽혔다. `md:`·`xl:`로 열 수를 적을 때 **기본
상태에도 열 수를 적는다** — 안 적은 건 1열이 아니라 `auto` 1열이고, 그 둘은 다르다.

---

## BUG-026

**바꾸기 모달 안에서 달력이 패널 뒤로 들어갔다** — 2026-07-29, 해결

업무 바꾸기를 `center-morph-modal`로 옮기고 마감일 `변경`을 누르면 달력이 안 보였다. 팝오버는
Portal로 `body`에 나가는데(BUG-009에서 그렇게 바꿨다) 모달 래퍼가 `z-[100]`이고 shadcn
`PopoverContent`의 기본값이 `z-50`이다. 같은 쌓임 문맥에서 겨루니 달력이 아래로 깔린다
(Radix Popper 래퍼는 `z-index: auto`라 Content의 값이 그대로 참가한다).

**처리**: `PopoverContent`에 `z-[110]`. 모달 레이어보다 위라는 뜻이고, 주석에 `z-[100]`이
어디 값인지 적어 뒀다 ([date-field.tsx](../src/components/date-field.tsx)).

**교훈**: Portal로 빼는 것과 위로 올리는 것은 다른 문제다. 잘림은 Portal이 풀지만, 새로 붙은
자리에서 누구와 겨루는지는 `z-index`가 정한다.

---

## BUG-027

**저장한 뒤 다시 `변경`을 누르면 옛 값이 보이고 `저장`이 켜져 있다** — 2026-07-29, 해결

마감일을 `2026-08-01`로 저장한 다음 같은 줄의 `변경`을 다시 누르면 `2026-07-31 →`이 떴다.
그대로 `저장`을 누르면 flow가 *"동일한 종료일로 변경할 수 없습니다"*로 거절한다. 두 가지가 겹쳤다:

1. **지금 값이 부모 prop이다.** 저장은 서버에서 끝났지만 목록을 다시 그리기 전이라 `now`가 옛것이다.
2. **고른 값이 살아 있다.** 성공 후 `picked`를 안 비워서 줄을 다시 열면 `저장`이 켜진 채였고,
   보내는 값이 지금 값과 같았다.

**처리**: 성공하면 보낸 표시 문구를 `saved`에 남기고 `const current = saved || now`를 지금 값으로
쓴다. 그리고 `useSave`의 `edit()`이 — `cancel()`만이 아니라 — `reset()`을 부른다. 여는 것도
비우는 자리다 ([task-actions.tsx](../src/components/task-actions.tsx)).

**교훈**: 서버 액션이 성공한 직후의 화면은 **서버는 새것, 부모 prop은 옛것**인 중간 상태다.
그 줄에서 값을 다시 보여줘야 하면 방금 보낸 값을 직접 들고 있어야 한다.

---

## BUG-028

**나를 부른 사람들 17줄 중 12줄에 상태 배지가 없었다** — 2026-07-29, 해결

멘션 카드의 상태 배지가 대부분 빈 자리였다. 링크가 안 맞는 줄 알았는데 **조인 키는 멀쩡했다** —
겹치는 세 건(`QBJyf`·`Qjm79`·`QjFHM`)은 바이트까지 같았다. 원인은 **모집단**이다.

화면은 상태를 이미 받아 둔 네 목록(임박·밀림·포커스·방치)에서 링크로 찾아 빌렸다. 그 네 목록은
전부 워크리스트 계열이라 **담당(worker) + 공개 + 진행률 100% 미만**만 들어 있다. 멘션은 내가
담당이 아니고 **관계자로만 걸린** 업무에도 온다 — 그런 줄은 어느 목록에도 없어서 구조적으로
못 찾는다. 실측 17개 그룹 중 5개만 맞았다 (71% 미스).

**처리**: 빌리는 걸 지우고 게시글 상세에서 직접 읽는다. 알림이 `postId`를 이미 주고
`getPostBrief`가 부르는 엔드포인트가 그 `/user/posts/{postId}`라 새로 뚫을 길이 없었다 —
`status`만 하나 더 꺼낸다 ([rest.ts](../src/lib/flow/rest.ts),
[queries.ts](../src/lib/flow/queries.ts)). 17개 그룹 전부 상태가 붙는다.

**함정 하나**: 평평한 `tasks[0].STTS`를 읽으면 안 된다. 커스텀 상태(`STATUS`) 컬럼을 쓰는
프로젝트에서도 이 필드가 오는데 **안 쓰는 컬럼이라 항상 `"0"`**이다. postId 80754103
(`Q020 Extranet 운영`)은 실제 `진행`인데 평평한 값은 `'0'`(대기)였다. 그래서
`TASK_COLUMN_REC`의 `STATUS.OPTION_NAME`을 먼저 보고, 없을 때만 `STTS` 코드 맵으로 내려간다.

**남은 것**(이 수정에 묶지 않았다): `listStaleTasks`는 `STTS` 코드를 라벨로 못 바꿔서
방치 목록에 숫자가 그대로 나올 수 있고 `완료` 걸러내기도 그때 안 먹는다. `STATUS_TONE`에
`대기` 키가 없어서 대기 배지는 회색으로 뜬다 — 다른 카드도 전부터 그랬다.

**교훈**: 배지가 비었을 때 먼저 의심할 건 키가 아니라 **모집단**이다. "이미 받아 둔 데이터에서
빌린다"는 그 데이터의 필터가 곧 커버리지 상한이라는 뜻이다 — 빌려 오는 코드를 쓸 때 그 목록이
무엇을 **빼고** 있는지 한 줄 적어 두면 다음 사람이 이 계산을 다시 하지 않는다.

---

## BUG-029

**`useReducedMotion()`으로 렌더를 갈랐더니 hydration이 어긋났다 (3곳)** — 2026-07-29, 해결

콘솔에 두 종류가 떴다. 하나는 계정 레일 토글과 beUI `Button`의 `tabindex="0"`이 서버 HTML에만
있다는 것, 하나는 헤더 브랜드의 `--chromatic-sweep`이 서버 `-14%` / 클라이언트 `114%`라는 것.
서로 다른 증상인데 **뿌리가 하나**다.

`useReducedMotion()`은 서버에서 `false`를 주고, 줄임 모드 클라이언트에서 `true`를 준다. 그래서
이 값으로 **렌더 결과**가 갈리면 첫 HTML과 첫 클라이언트 렌더가 반드시 다르다. 훅은 mount 뒤에나
맞는다.

`tabindex` 쪽은 한 다리를 더 건넌다. `whileTap={reduce ? undefined : {…}}`는 스스로는 아무 속성도
안 만드는데, motion이 `whileTap`·`onTap`·`onTapStart` 중 **하나라도 있고** `props.tabIndex`가
`undefined`면 `tabIndex={0}`을 대신 심는다
(`framer-motion/dist/es/render/html/use-props.mjs:48-51`). prop을 지우는 분기가 곧 속성을 지우는
분기였다.

**처리**: 세 곳 다 분기를 없애고 **값으로 껐다**.

- `whileTap={{ scale: reduce ? 1 : 0.96 }}` — prop은 늘 있고 배율만 1이다
  ([button/base.tsx](../src/components/motion/button/base.tsx)). 같은 고침이 있던
  `motion/overflow-actions.tsx`는 v1.0.0에서 지워졌다 — 상단 바가 좌측 레일로 바뀌면서
  계정 레일 자체가 없어졌다. 교훈은 그대로 남는다.
- `ChromaticTextReveal`의 `initial`·`style`은 분기를 지우고 시작 값으로 고정했다. 같은 파일
  `transition`이 이미 줄임 모드에서 네 값 모두 `duration: 0`으로 떨어뜨리므로 결과는 같다 —
  분기가 애초에 겹치는 일을 하고 있었다 ([chromatic-text-reveal.tsx](../src/components/motion/chromatic-text-reveal.tsx)).

Playwright로 줄임·보통 두 모드에서 다시 읽어 콘솔 오류 0건, 두 모드 모두 최종 `114%`를 확인했다.

**교훈**: **환경을 읽는 훅으로 렌더를 가르지 말 것.** `useReducedMotion`·`useMediaQuery`·
`useHoverCapable` 같은 것들은 서버에 답이 없어서 기본값을 준다. 끌 때는 prop을 지우는 게 아니라
효과가 없는 값(배율 1, `duration: 0`)을 넣는다 — 렌더 트리는 양쪽에서 같고, 결과만 달라진다.

---

## BUG-030

**업무 필터 API의 `cursor`가 오프셋이 아니라 페이지 번호였다 (271건 유실)** — 2026-07-30, 해결

내 업무 화면을 만들면서 59개 프로젝트를 훑었더니 680건이 나왔다. 그런데 한 프로젝트는 flow에서
236건인데 딱 **100건**만 잡혔다 — `pageSize`와 정확히 같은 숫자다. 페이지가 한 장도 더 안 넘어간
것이다.

`/user/posts/projects/{id}/tasks/filter`는 `cursor`를 **페이지 번호**로 받는다(0, 1, 2…).
오프셋인 줄 알고 `cursor=100`을 보내면 **101번째 페이지**를 달라는 뜻이 되고, 서버는 조용히
`tasks: []` + `hasNext: false`를 준다. 오류도 없고 경고도 없어서 "더 없구나"로 읽힌다.
같은 요청을 `cursor=1`로 보내면 진짜 두 번째 페이지가 온다. 응답의 `lastCursor`가 다음 페이지
번호이고, 끝이면 `-1`이다.

**처리**: `page * SIZE` 계산을 버리고 **응답의 `lastCursor`를 그대로 따라간다**
([rest.ts](../src/lib/flow/rest.ts)). `listMyTasks`는 처음부터 그렇게 짰고,
`listStaleTasks`도 같은 계산을 하고 있어서 함께 고쳤다 — 방치 목록도 첫 100건만 보고 있었다.
고친 뒤 실측 전량이 680건 → **951건**이 됐다. 페이징 테스트는 URL을 붙잡아
`cursor=1`이 나가고 `cursor=100`은 안 나가는 것까지 확인한다
([rest.test.ts](../src/lib/flow/rest.test.ts)).

**교훈**: **빈 페이지로 끝나는 페이징은 성공과 구별되지 않는다.** 마지막 페이지 크기가
`pageSize`와 정확히 같으면 거의 항상 잘린 것이다 — 그 숫자를 의심 신호로 삼는다. 그리고 커서는
직접 계산하지 말고 서버가 준 값을 되돌려 주는 게 맞다. 계산하면 의미를 추측하게 되고, 추측이
틀려도 API는 조용하다.

---

## BUG-031

**골격이 안 보였다 — `bg-muted`가 밝은 화면 배경과 같은 색이다** — 2026-07-30, 해결

화면마다 스켈레톤을 만들기 전에 `Skeleton` 한 개를 띄워 봤는데 아무것도 안 보였다. 클래스는
붙어 있고 `animate-pulse`도 돌고 있었다. 색을 재 보니 이렇다.

| 토큰 | 밝게 | 어둡게 |
| --- | --- | --- |
| `--background` | `#fafafa` | `#0d1526` |
| `--muted` | `#f5f5f5` | `#222d42` |
| `--secondary` | `#f5f5f5` | `#222d42` |

shadcn 기본값이 `bg-muted`인데 밝은 화면에서 `#f5f5f5` 대 `#fafafa`다 — 명도 차이가 2%다.
카드(`#ffffff`) 안에서는 겨우 보이고, 카드 밖 본문에서는 안 보인다. 탭바가 `bg-secondary`라
그 위에서는 아예 같은 색이다. `--muted`와 `--secondary`가 같은 값인 것도 이때 알았다.

**처리**: 골격 기본색을 `bg-foreground/8`로 바꿨다 ([skeleton.tsx](../src/components/ui/skeleton.tsx)).
글자색의 8%라 배경·카드·탭바 세 바닥과 밝게·어둡게 양쪽에서 규칙 하나로 보인다. 실측으로
프로덕션 HTML에 64번 실리고 네 화면 전부에서 막대가 눈에 남는다.

**교훈**: **토큰 이름이 다르다고 색이 다른 게 아니다.** 회색 위에 회색을 얹는 UI(골격·구분선·
비활성)는 값을 직접 대조해 보고 정한다. 그리고 남이 만든 기본값(`bg-muted`)은 그쪽 팔레트를
전제한 것이라 우리 팔레트에서 같은 뜻이 아니다.

---

## BUG-032

**리스크·팀·내 업무를 열면 오늘 화면 골격이 먼저 깜빡였다 (부모 `loading.tsx`)** — 2026-07-30, 해결

화면마다 자기 골격을 만들고 확인하는데, `/risk` 응답 안에 골격이 **두 벌** 들어 있었다. 오늘
화면의 일정 칸(`w-[76px]`)까지 리스크 화면 HTML에 있었다.

`app/(app)/loading.tsx`는 그 세그먼트의 Suspense 경계이면서 **자식 세그먼트 전부의 부모
경계**다. `/risk`를 열면 `(app)` 경계가 먼저 서고(= 오늘 화면 골격), 그 안에서 `risk` 경계가
자기 골격으로 바꾼다. 오늘 화면 것을 `(app)`에 둔 게 원인이었다 — 그 자리는 "네 화면이 함께
쓰는 골격" 자리다.

**처리**: 오늘 화면의 `page.tsx`와 `loading.tsx`를 라우트 그룹 `(app)/(today)/`로 옮겼다
(`git mv`). 무리 이름은 URL에 안 나와서 주소는 그대로 `/`고, 네 화면이 같은 깊이의 형제가 되어
각자 자기 골격만 그린다. 실측으로 네 화면 모두 골격 트리 1개, 일정 칸은 `/`에만 있다.

**교훈**: **`loading.tsx`는 그 화면 것이 아니라 그 세그먼트 아래 전부의 것이다.** 화면마다 다른
골격을 두려면 화면을 형제로 만들어야 한다 — 라우트 그룹이 URL을 건드리지 않고 그것을 한다.
파일을 옮긴 뒤 `.next/types`가 낡아 없는 경로를 가리키므로 빌드를 한 번 돌린다(아래 "자주 밟는 것들").

---

## BUG-033

**멘션 본문 아래 댓글 골격이 버튼 너비로 눌렸다 (`flex` 항목 안의 비율 폭)** — 2026-07-31, 해결

`ThreadView`는 `댓글 다 보기`를 누르면 기다리는 동안 `CommentRowsSkeleton`을 세운다. 업무 카드
쪽(`task-actions.tsx`)은 제대로 나오는데 멘션 카드 쪽(`mention-actions.tsx`)은 없는 것처럼 보였다.

멘션 카드에서 `ThreadView`의 `<form>`은 `flex flex-wrap items-center gap-1.5` 안의 항목이었다.
폭을 안 정한 flex 항목은 `max-content`로 줄어드는데, **비율 폭(`w-full`·`w-2/3`)은 그 계산에 0으로
들어간다** — 그래서 항목 폭은 버튼 글자와 `w-32` 막대만으로 정해지고, 정작 `w-full` 막대가 그
130px에 맞춰졌다. 헤드리스 크롬으로 두 배치를 나란히 찍어 실측: 눌린 쪽 약 130px, 고친 쪽 약 570px.

**처리**: `<ThreadView postId={postId} className="basis-full" />` — 그 줄에서 혼자 한 줄을 쓴다.
`flex-wrap` 안이라 읽음 버튼은 왼쪽에 그대로 있고, 골격과 도착한 댓글은 본문 아래 전폭에 앉는다.

**교훈**: **골격의 비율 폭은 부모가 폭을 정해 줄 때만 뜻이 있다.** 같은 컴포넌트가 한 곳에서 되고
다른 곳에서 안 보이면 컴포넌트가 아니라 **앉은 자리**를 본다 — `flex`/`inline-block`/`float`처럼
shrink-to-fit으로 크기가 정해지는 부모 안에서는 `w-full`이 화면 폭이 아니라 형제 글자 폭이 된다.

---

## 개발 중 자주 밟는 것들

**dev 서버가 500만 뱉는다** — 죽은 `next-server` 프로세스가 3000 포트를 잡고 있는 경우다.
`lsof -ti:3000 | xargs kill` 후 재시작.

**라우트 그룹으로 파일을 옮긴 뒤 없는 경로 타입 오류** — `.next/types`가 낡았다. `rm -rf .next/types`.

**리프레시 토큰 만료** — flow 리프레시 토큰은 오래 못 간다(`invalid_grant`). 로컬에서 세션이
필요하면 브라우저로 다시 로그인해야 한다.

