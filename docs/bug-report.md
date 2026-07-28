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
| [BUG-012](#bug-012) | `/user/posts` 가 댓글 14건 중 2건만 준다 | 열림 (flow 측) |
| [BUG-013](#bug-013) | REST 인증 헤더를 틀리고 `.catch()`가 삼켰다 | 해결 |
| [BUG-014](#bug-014) | Select 드롭다운이 조상 `overflow-hidden`에 잘렸다 | 해결 |
| [BUG-015](#bug-015) | NumberTicker 숫자가 옆 단위 텍스트보다 위로 떴다 | 해결 |

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

## 개발 중 자주 밟는 것들

**dev 서버가 500만 뱉는다** — 죽은 `next-server` 프로세스가 3000 포트를 잡고 있는 경우다.
`lsof -ti:3000 | xargs kill` 후 재시작.

**라우트 그룹으로 파일을 옮긴 뒤 없는 경로 타입 오류** — `.next/types`가 낡았다. `rm -rf .next/types`.

**리프레시 토큰 만료** — flow 리프레시 토큰은 오래 못 간다(`invalid_grant`). 로컬에서 세션이
필요하면 브라우저로 다시 로그인해야 한다.
