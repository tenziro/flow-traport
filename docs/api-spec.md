# flow REST API 스펙 (`/user/*` 네임스페이스)

> **표기 규칙**
> - 표기 없음 = **확인된 사실**. flow 공식 개발자 문서(`https://api.flow.team/docs`)의 스펙 원본에서 그대로 추출했거나, 인증 없는 실제 호출로 응답을 직접 관측한 내용.
> - `(추정)` = 문서에 정의가 없어 다른 근거(실제 응답 관측, 유사 API 패턴, 네이밍 규칙)로 추론한 내용. **구현 시 반드시 런타임 검증 필요.**
> - `(관측)` = 공식 문서에는 없지만 인증된 실제 flow 워크스페이스 응답에서 직접 확인한 값. 문서보다 실제에 가깝지만 표본이 적음.
>
> **v4.0.0 (2026-08-04)**: 이 문서가 **유일한 데이터 계약**이 됐다. flow MCP를 전부 걷어냈다
> (PRD §5.1). 본문에 남은 MCP 언급은 그때 대조군으로 쓴 **기록**이다 — 지금 부르는 경로가
> 아니다. 실제 호출 순서는 §12를 본다.
>
> **v4.1.0 (2026-08-04)**: 화면이 §6.1 응답에서 실제로 꺼내 쓰는 컬럼을 표로 박았다
> (§6.1 "앱이 꺼내 쓰는 값"). 우선순위(`PRIORITY`)가 그 응답에 있는데 안 읽고 모달이 따로
> 받아 오던 것을 이번에 걷었다 — 업무 한 건당 REST 1회가 줄었다.

## 0. 수집 방법과 신뢰도 근거

`https://api.flow.team/docs` 는 SvelteKit SPA다. SSR HTML에는 엔드포인트 목록만 있고, 파라미터/응답 스키마는 클라이언트 번들 안에 객체 리터럴로 들어 있다 (`__data.json` 은 `null`). 따라서:

1. `_app/immutable/nodes/{18,19,21,23,24,25,26}.*.js` 및 `chunks/*.js` 를 내려받아 Node ESM + Proxy 스텁으로 평가 → **44개 엔드포인트의 스펙 객체를 원문 그대로 복원**했다. 표의 타입/필수/기본값/제약/예시는 모두 이 원본에서 나온 값이다.
2. 인증 없이 실제 엔드포인트를 호출해 에러 봉투를 직접 관측했다 (읽기만, 쓰기 호출 없음).
3. 문서에 스키마가 비어 있는 배열(`columns[]`, `tasks[]` 원본 등)은 읽기 전용 교차 확인으로 실제 레코드 형태를 관측했고 `(관측)` 으로 표기했다.

> **누락 정정 `(2026-07-28 오후)`**: 위 1번으로 복원한 44개는 **7개 도메인**(employees ·
> divisions · projects · posts · alarms · calendars · search)뿐이었다. 포털에는 **3개 도메인
> 12개 엔드포인트가 더 있다** — comments(2) · drive(3) · wiki(7). 번들 노드 번호를
> `{18,19,21,23,24,25,26}` 로 짚어 그 밖의 노드를 안 봤기 때문이다. 세 도메인은 §13~15 에
> 적었고, 전부 인증된 실제 호출로 200을 확인했다. 이 누락 하나가 BUG-012 의 결론을 틀리게
> 만들었다 (§6.3).

`/user/*` 스펙은 포털이 v1 스펙을 변환해 만든다. 변환기는 `https://api.flow.team/v1/` → `https://api.flow.team/user/` 로 경로를 바꾸고 `userId` / `registerId` 파라미터를 제거한다. 즉 **`/user/*` 계열에는 `userId` 를 넘기지 않으며, 서버가 인증 주체를 사용자로 사용한다** (예외: `GET /user/calendars/events` 의 선택적 `userId`, `GET /user/employees/{userId}`).

---

## 1. 공통 규약

### 1.1 Base URL

```
https://api.flow.team
```

### 1.2 인증

| 방식 | 헤더 | 관측된 실패 응답 |
|---|---|---|
| API Key | `x-flow-api-key: <key>` | `401` / `UNAUTHORIZED_ERROR` / `API Key 정보가 올바르지 않습니다.` |
| OAuth Bearer | `Authorization: Bearer <token>` | `401` / `INVALID_TOKEN` / `OAuth 토큰이 올바르지 않거나 만료되었습니다.` |

두 방식은 **서로 다른 검증 경로**를 탄다 (에러 코드가 다름). 헤더를 아무것도 안 보내면 API Key 경로의 `UNAUTHORIZED_ERROR` 가 돌아온다. 공식 문서의 모든 `/user/*` 설명문은 `x-flow-api-key` 기준으로 작성되어 있다.

### 1.3 응답 봉투

모든 응답은 `response` 키로 한 겹 감싸져 있다. 문서의 응답 스키마 표(`success`/`code`/`message`/`data`)는 이 `response` **안쪽**을 가리킨다.

```jsonc
// 성공
{ "response": { "success": true, "code": 200, "message": "success", "data": { /* ... */ } } }

// 실패 (실제 관측값)
{ "response": { "success": false, "code": 401, "message": "DetailedError",
  "error": { "code": "UNAUTHORIZED_ERROR", "message": "API Key 정보가 올바르지 않습니다." } } }
```

> **주의**: PRD 및 사전 조사 메모에 적힌 `{ data: [...], meta: {...} }` 형태는 **사실이 아니다.** flow 는 `meta` 를 쓰지 않는다.

### 1.4 페이지네이션

`page` / `limit` 이 아니라 **커서 방식**이다.

| 항목 | 값 |
|---|---|
| 요청 파라미터 | `cursor` (0-based), 크기 파라미터는 엔드포인트마다 `pageSize` 또는 `size` 또는 고정 |
| 응답 필드 | `hasNext: boolean`, `lastCursor: number` (더 없으면 `-1`) |
| `cursor` 의미 | **오프셋이 아니라 페이지 인덱스** — `pageSize` 단위로 증가한다 (`(관측)`: `pageSize=15&cursor=1` 이 16~30번째가 아니라 2페이지를 반환) |

다음 페이지 요청은 응답의 `lastCursor` 를 그대로 `cursor` 에 넣는 것이 안전하다.

### 1.5 날짜/시간 포맷

| 포맷 | 길이 | 사용처 |
|---|---|---|
| `YYYYMMDDHHmmss` | 14 | `registeredDateTime`, `editedDateTime`, `eventStartDateTime`, `startDateTime` 등 모든 일시 |
| `YYYYMMDD` | 8 | 업무 시작일/마감일 (`startDate`, `endDate`, `END_DT`) |

타임존 정보는 값 자체에 없다. 캘린더 일정만 `timezone` / `gmtTime` 을 별도 필드로 준다. 나머지는 워크스페이스 로컬 타임 `(추정)`.

### 1.6 에러 카탈로그

| HTTP | code | 의미 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 요청 형식 오류 |
| 401 | `UNAUTHORIZED_ERROR` | 인증 정보 누락/무효 (API Key 경로) |
| 401 | `INVALID_TOKEN` | OAuth 토큰 무효/만료 `(관측)` — 문서 카탈로그에는 없음 |
| 403 | `FORBIDDEN_ERROR` | 리소스 접근 권한 없음 |
| 404 | `NOT_FOUND_ERROR` | 리소스 없음 |
| 409 | `ALREADY_EXIST_ERROR` | 이미 존재 |
| 412 | `PRECONDITION_FAILED_ERROR` | 선행조건 불만족 |
| 412 | `NOT_EXIST_ERROR` / `NOT_EXISTS_ERROR` | 수정·삭제 대상 없음 (문서 내에서 두 철자가 혼용됨) |
| 412 | `REACHED_MAX_ERROR` | 생성 한도 도달 |
| 429 | `RATE_LIMIT_EXCEEDED_ERROR` | 사용량 초과 — **분당 120회** `(관측 2026-07-28)`. 메시지가 상한을 알려 준다: `요청이 너무 많습니다. (분당 최대 요청가능 횟수: 120)` |
| 500 | `INTERNAL_SERVER_ERROR` | 내부 오류 |
| 500 | `SQL_EXECUTION_ERROR` | DB 쿼리 실패 |
| - | `BETA_API_ACCESS_DENIED_ERROR` | `해당 API는 준비 중 입니다.` — **`/user/*` 는 베타이므로 계정/플랜에 따라 이게 나올 수 있다** |
| - | `OPEN_GATE_API_ERROR` | 내부 OpenGate 호출 실패 |

전 엔드포인트 공통 `VALIDATION_ERROR` 메시지 템플릿: `잘못된 {fieldName} 형식입니다.`, `{fieldName} 은(는) 필수 값입니다.`, `{fieldName} 형식은 {values} 입니다.`, `{fieldName} 최대 길이는 {length} 입니다.` 등. 플랜 관련: `403 FORBIDDEN_ERROR / 이용기관이 구독중인 플랜으로 이용할 수 없는 기능입니다.`

관측된 404 봉투:
```json
{"response":{"success":false,"code":404,"message":"error","error":{"code":"NOT_FOUND_ERROR","message":"요청받은 리소스를 찾을 수 없습니다."}}}
```

### 1.7 스칼라 타입 주의

응답의 거의 모든 스칼라는 **문자열**이다. `postId`, `projectId`, `taskId`, `remarkCount`, `subTaskCount`, `progress` 전부 `"40001"`, `"2"` 같은 문자열. 예외적으로 `hasNext`(boolean), `lastCursor`(number), `code`(number)만 원시 타입이다.

---

## 2. 업무(Task) 데이터 모델 — 이 프로젝트의 핵심

**flow 업무의 마감일/상태/담당자/우선순위/진행률은 업무 객체의 평면 필드가 아니다.** 프로젝트마다 정의된 **컬럼(column)** 의 값으로 저장된다. 컬럼은 `columnSrno` 로 식별하고, 기본 컬럼은 `defaultColumnType` 으로 의미를 판별한다.

### 2.1 기본 컬럼 대응표 `(관측)`

`GET /user/projects/{projectId}/columns` 응답에서 확인. `columnSrno` 는 기본 컬럼에 한해 전 프로젝트 공통으로 고정되어 있다 `(추정 — 관측한 프로젝트들에서 모두 동일했으나 전역 보장은 문서화되지 않음)`. **구현에서는 `columnSrno` 하드코딩 대신 `defaultColumnType` 으로 조회하는 것이 안전하다.**

| `columnSrno` | `defaultColumnType` | 의미 | 값 형태 |
|---|---|---|---|
| 0 | `SECTION` | 섹션 | 섹션 ID |
| 1 | `WORKER_ID` | **담당자** | 사용자 ID 목록 |
| 2 | `RGSR_ID` | 등록자 | 사용자 ID |
| 3 | `RGSN_DTTM` | 등록일시 | `YYYYMMDDHHmmss` |
| 4 | `EDTR_DTTM` | **최종수정일시** | `YYYYMMDDHHmmss` |
| 5 | `TASK_NUM` | 업무 번호 | 숫자 문자열 |
| 6 | `TASK_NM` | 업무명 | 문자열 |
| 7 | `PRIORITY` | **우선순위** | `low`/`normal`/`high`/`urgent` 계열 |
| 8 | `PROGRESS` | **진행률** | `"0"`~`"100"` |
| 9 | `STTS` | **상태 (기본 체계)** | 코드 `"0"`~`"4"`. `optionName`이 **항상 빈 문자열**이다 (§6.1) |
| 10 | `START_DT` | 시작일 | `YYYYMMDD` |
| 11 | `END_DT` | **마감일** | `YYYYMMDD` |
| 12 | `STATUS` | **상태 (커스텀 체계)** | `optionSrno` (숫자 문자열). `optionName`에 라벨이 온다 |

> **상태 컬럼이 둘이다** `(관측 2026-07-28)`. 같은 "상태"가 프로젝트에 따라 `STTS`(9) 또는 `STATUS`(12)로 온다. 표본 8개 프로젝트 중 **7개가 `STTS`**, 1개만 `STATUS`였다. 한쪽만 읽으면 나머지 프로젝트의 상태가 통째로 빈칸이 된다. 코드→라벨 대응표는 §6.1 끝.

`columnType` 값 집합: `TEXT | CHECKBOX | OPTION | NUMBER | DATE | FORMULA | STATUS | ...` (커스텀 컬럼 생성 API 기준 앞 6개, `STATUS` 는 기본 상태 컬럼에서 관측).

### 2.2 원본(raw) 업무 레코드 `(관측)`

`GET /user/posts/{postId}` 의 `tasks[]` 같은 "원본 목록"은 내부 OpenGate 레코드를 그대로 노출하며 **대문자 스네이크 케이스**다. 실제 관측한 한 건:

```jsonc
{
  "TASK_SRNO": "43985649",       // 업무 ID (= taskId)
  "TASK_NUM": "720344",
  "TASK_NM": "P10-이슈관리",
  "SECTION_SRNO": "803900", "SECTION_NAME": "PMS",
  "STTS": "0",                   // legacy 상태 코드
  "START_DT": "", "END_DT": "",  // 미설정 시 빈 문자열 (null 아님)
  "PROGRESS": "", "PRIORITY": "",
  "WORKER_REC": [],              // 담당자 목록 (아이템 형태 미관측)
  "DRAW_SUBTASK_YN": "Y",
  "JIRA_YN": null, "JIRA_ISSUE_TYPE_NM": null,
  "IS_START_ALL_DAY": null, "IS_END_ALL_DAY": null,
  "SR_VAL": null, "CUSTOM_COLUMN_DATA_RECORD": null,
  "TASK_COLUMN_REC": [
    {
      "COLUMN_SRNO": "12", "COLUMN_TYPE": "STATUS", "DEFAULT_COLUMN_TYPE": "STATUS",
      "COLUMN_DATA_REC": [
        {
          "CUSTOM_COLUMN_DATA": "901659",       // = optionSrno
          "CUSTOM_COLUMN_DATA_SRNO": "8942221",
          "OPTION_NAME": "대기", "OPTION_COLOR": "Multi06", "OPTION_CATEGORY": "0",
          "COLUMN_TYPE": "STATUS", "USER_NM": "", "PRFL_PHTG": ""
        }
      ]
    }
    // ... columnSrno 1,4,7,8,10,11 등이 같은 구조로 이어짐
  ]
}
```

핵심:
- **값을 읽는 두 경로가 공존한다.** 평면 필드(`END_DT`, `PROGRESS`, `PRIORITY`, `STTS`, `WORKER_REC`)와 컬럼 배열(`TASK_COLUMN_REC[].COLUMN_DATA_REC[].CUSTOM_COLUMN_DATA`). 업무 2.0 프로젝트에서는 컬럼 배열이 정본이고 평면 필드는 비어 있을 수 있다 `(추정)`.
- **미설정 값은 `null` 이 아니라 빈 문자열 `""`** 이다. falsy 체크로 통일해야 한다.
- **완료 판정은 `optionCategory == "2"` 다** `(실측 2026-07-29 — 아래 추정을 정정한다)`. 원래 이 자리에는 "`optionCategory` 대신 `GET /user/projects/{id}/columns/status` 로 옵션 목록을 받아 매핑하는 편이 안전하다"고 적혀 있었는데 **반대였다**: `STTS` 프로젝트는 그 엔드포인트가 옵션을 하나도 주지 않고(§5.6), 두 상태 체계가 공통으로 주는 필드가 `optionCategory` 하나뿐이다. 코드 대응표는 §6.1 끝.
- `WORKER_REC[]` 의 **아이템 형태는 관측하지 못했다** (샘플 업무 모두 담당자 미지정). `[{ USER_ID, USER_NM, PRFL_PHTG }]` 형태 `(추정)`.
- **`tasks[]` 가 비어 있다는 게 곧 "이 글은 업무가 아니다" 다** `(실측 2026-08-06 — 알림 100건이 가리키는 글 25개)`. 공지·회의록·일정은 `tasks: []` 로 오고, 업무는 늘 한 건이 들어 있다. **`postId` 하나로 업무 여부와 `TASK_SRNO` 를 동시에 얻는 유일한 경로다** — 업무 목록 필터(§6.1)를 업무명으로 뒤져 `postId` 로 골라내는 우회는 검색이 빗나가면 업무를 "업무 아님" 으로 잘못 판정한다 (bug-report BUG-048).

### 2.3 PRD 집계 로직 → 필드 매핑

| PRD 개념 | 필드 |
|---|---|
| 마감일 | `END_DT` (raw) / `defaultColumnType="END_DT"` 컬럼값, `YYYYMMDD` |
| 상태 | `defaultColumnType="STATUS"`(커스텀, `optionName`에 라벨) 또는 `="STTS"`(기본, 코드만). **둘 다 봐야 한다** — 표본 8개 중 7개가 `STTS`였다 (§2.1) |
| 진행률 | `PROGRESS` (raw) / `defaultColumnType="PROGRESS"` 컬럼값, `"0"`~`"100"` |
| 최종수정일시 | `EDTR_DTTM` 컬럼값 (`columnSrno=4`), `YYYYMMDDHHmmss`. 게시글 단위로는 `GET /user/posts/{postId}` 의 평면 필드 `editedDateTime` 이 훨씬 쓰기 쉽다 |
| 담당자 | `WORKER_REC[]` (raw) / `defaultColumnType="WORKER_ID"` 컬럼값 |
| 우선순위 | `PRIORITY` (raw) / `defaultColumnType="PRIORITY"` 컬럼값 |
| 프로젝트 참조 | `projectId` + `projectTitle` (필터 API는 둘 다 준다) |
| 업무 링크 | `connectUrl` (필터 API, 빈 문자열일 수 있음) / 생성 API 응답의 `tinyUrl` |

---

## 3. Employees API

### 3.1 `GET /user/employees/me` — 내 정보

파라미터 없음.

**응답 `data`**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `inttId` | string | ✓ | 이용기관 ID (`BFLOW_000000001234`) |
| `userId` | string | ✓ | 사용자 ID (이메일 형태) |
| `fullname` | string | ✓ | 이름 |
| `divisionId` | string | ✓ | 부서코드 — **삭제 예정. 쓰지 말 것** |
| `divisionCode` | string | ✓ | 부서코드 |
| `divisionName` | string | ✓ | 부서명 |
| `responsibility` | string | ✓ | 직책 |
| `cellPhoneNumber` | string | ✓ | 휴대폰 |
| `companyPhoneNumber` | string | ✓ | 회사 전화 |
| `email` | string | ✓ | 이메일 |

### 3.2 `GET /user/employees` — 구성원 목록

**Query**

| 이름 | 타입 | 필수 | 기본 | 제약 |
|---|---|---|---|---|
| `cursor` | string | | `0` | 숫자. **페이지 크기 100 고정** |

**응답 `data`**: `{ hasNext: boolean, lastCursor: number, employees: Employee[] }` — `Employee` 는 3.1과 동일.

### 3.3 `GET /user/employees/{userId}` — 특정 구성원

**Path**: `userId` (string, 필수, 1~100자, 알파벳/숫자/`-`/`_`/`@`/`.`)
**응답 `data`**: 3.1과 동일한 단일 객체.

---

## 4. Divisions API

### 4.1 `GET /user/divisions` — 부서 목록

파라미터 없음.

**응답 `data.divisions[]`**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `divisionCode` | string | ✓ | 부서코드 |
| `upperDivisionCode` | string | ✓ | 상위 부서코드 |
| `divisionName` | string | ✓ | 부서명 |

페이지네이션 없음 — 전체를 한 번에 반환. 트리는 `upperDivisionCode` 로 클라이언트에서 조립.

---

## 5. Projects API

### 5.1 `GET /user/projects/participants` — 내가 참여 중인 프로젝트

**파라미터가 전혀 없다** (path 0개, query 0개). 페이지네이션도 없다.

> 문서 산문에는 `userId` 를 넣으라는 오래된 서술이 남아 있으나, 실제 스펙 정의상 파라미터는 0개다.

> **정정 (실측)**: 이 엔드포인트는 "내 프로젝트 전체"가 **아니다.** API Key 소유자 기준 **1개**만 반환한다. 같은 계정으로 5.2 `GET /user/projects` 는 **59개**(`lastCursor: 58`), MCP `flow_list_projects` 도 59개다. PRD의 "59개 프로젝트 전량 조회"는 **5.2**를 써야 한다. `participants` 가 무엇을 기준으로 1개만 거르는지는 확인하지 못했다.
>
> **재확인 (2026-07-29)**: MCP 래퍼 `flow_list_projects_by_participant`에 내 `userId`를 명시해도 같은 **1개**다. 래퍼 문제가 아니라 엔드포인트 자체다. PRD §6.5의 "참여 프로젝트 목록"도 `flow_list_projects`로 간다.

**응답 `data.projects[]`**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `projectId` | string | ✓ | 프로젝트 ID |
| `title` | string | ✓ | 프로젝트 이름 |
| `projectUrl` | string | ✓ | `https://flow.team/main.act?projectId=123000` |

**에러 추가**: `NOT_EXISTS_ERROR / {userId} 은(는) 존재하지 않는 사용자입니다.`

### 5.2 `GET /user/projects` — 프로젝트 목록 ⭐

**Query**: `cursor` (string, 기본 `0`, **페이지 크기 500 고정**)
**응답 `data`**: `{ hasNext, lastCursor, projects: [{ projectId, title, projectUrl }] }`

**실측**: 파라미터 없이 호출하면 59개, `hasNext: false`, `lastCursor: 58`. MCP `flow_list_projects` 와 개수가 일치한다. **"내 프로젝트" 목록은 5.1이 아니라 이쪽이다.**

### 5.3 `GET /user/projects/{projectId}` — 프로젝트 상세

**Path**: `projectId` (string, 필수, 숫자, 1~15자)

**응답 `data.project`** — 내부 OpenGate 원본이 그대로 노출된다 (대문자 스네이크).

| 필드 | 타입 | 설명 |
|---|---|---|
| `PROJECT_SETTING` | array | 프로젝트 기본 설정 (아래 참조) |
| `PROJECT_COLUMN_REC` | array | 프로젝트 업무 컬럼 목록 — **아이템 스키마 문서화 안 됨.** `GET .../columns` 의 대문자판 `(추정)` |
| `OPTION_REC` | array | 컬럼 옵션 목록 — 아이템 스키마 없음 |
| `PIN_RECORD` | array | 상단 고정 글 — 아이템 스키마 없음 |
| `TAG_RECORD` | array | 태그 — 아이템 스키마 없음 |
| `ALARM_RECORD` | array | 알림 — 아이템 스키마 없음 |
| `ALARM_COUNT` | string | 알림 수 |
| `ALARM_MORE_YN` | string | 알림 추가 조회 가능 여부 |
| `TASK_REPORT_RECORD` | array | 업무 리포트 — 아이템 스키마 없음. **실측은 전부 `null`** (아래) |
| `CUSTOM_STATUS_TASK_REPORT_RECORD` | array | 커스텀 상태 업무 리포트 — 아이템 스키마 없음. **실측은 전부 `null`** (아래) |
| `JOIN_APPLY_RECORD` | array | 참여 신청 — 아이템 스키마 없음. 실측은 `null` |

`PROJECT_SETTING[]` 아이템: `COLABO_SRNO`*(프로젝트 ID), `TTL`*(제목), `CNTN`(설명), `USE_INTT_ID`(이용기관 ID), `SENDIENCE_CNT`(참여자 수), `OPEN_YN`, `HOME_TAB_CODE`(예 `FEED`), `STATUS`, `RGSN_DTTM`, `RGSR_ID`, `RGSR_NM`.

> **왜 배열인가**: OpenGate 관례상 단건도 1-element 배열로 감싼다. `PROJECT_SETTING[0]` 을 쓰면 된다 `(추정 → 실측 확인 2026-08-04)`.

> **진행 단계 같은 "프로젝트 상태"는 이 API에 없다** `(실측 2026-08-04, 59개 전량)`.
> `PROJECT_SETTING`의 키를 A~Z 전부 훑고 `data.project`의 다른 덩어리까지 열어 본 결과다:
>
> | 후보 | 실측 결과 |
> |---|---|
> | `STATUS` | 키는 59개 전부에 있는데 **값이 전량 빈 문자열** |
> | `TASK_REPORT_RECORD` | 59개 전량 **`null`** (`typeof null === "object"`라 타입만 보면 객체로 보인다) |
> | `CUSTOM_STATUS_TASK_REPORT_RECORD` | 59개 전량 **`null`**. 곁의 `TASK_REPORT_VIEW_YN`이 `N`이다 |
> | `HIDDEN_YN` · `OFFICIAL_YN` · `DISABLE_YN` · `DISABLE_DTTM` | 앞 셋은 59개 모두 `N`, 마지막은 전량 빈 문자열 — 값이 안 갈려서 구별에 못 쓴다 |
>
> **값이 갈리는 상태성 필드는 둘뿐이다**: `OPEN_YN`(`N` 56 / `Y` 3, 공개 프로젝트)과
> `IMPT_YN`(`Y` 14 / `N` 45, 중요 표시). 내 업무 화면은 이 둘만 내고, 나머지 자리는
> `RGSR_NM`·`RGSN_DTTM`(개설자·개설일)로 채운다 — 이 둘은 59개 모두 채워져 있다.
>
> 같은 실측(59개 전량)에서 확인한 채움률:
>
> | 필드 | 채움 | 값 |
> |---|---|---|
> | `CNTN` (설명) | 7/59 | 여러 줄 평문, 24~72자. 없으면 화면이 그 줄을 안 그린다 |
> | `SENDIENCE_CNT` (참여자 수) | 59/59 | 숫자 문자열, 6~656 |
> | `OUT_SENDIENCE_CNT` (외부 참여자 수) | 59/59 | 숫자 문자열. **§5.3 표에 없는 필드다** |
> | `OPEN_YN` (공개 여부) | 59/59 | `N` 56 / `Y` 3 |
> | `IMPT_YN` (중요 표시) | 59/59 | `Y` 14 / `N` 45 |
> | `RGSR_NM` / `RGSN_DTTM` | 59/59 | 이름 / 14자리 |
> | `MNGR_DSNC` (관리자 여부) | 59/59 | `N` 53 / `Y` 6 |
> | `JNNG_ATHZ_YN` (참여 승인) | 59/59 | `N` 45 / `Y` 14 |
>
> `SENDIENCE_CNT`는 **이름을 알 수 있는 사람 수보다 크다** — 90명짜리 프로젝트에서 §5.4 +
> §6.1로 모을 수 있는 이름이 36명이다. 화면은 수를 이 필드로, 목록을 그 36명으로 내고 그
> 차이를 문구로 적는다. 구현은 `rest.ts getProjectBrief`다.
>
> **캐시 10분**(`PROJECT_TTL`): 내 업무 화면이 **접힌 카드마다** 이걸 부른다(실측 38장).
> 업무 수집이 이미 60회를 쓰므로(59 + 목록 1) 첫 조회가 98회고 분당 상한이 120회다.
> 캐시 덕에 새로 고쳐도 다시 안 부른다.

### 5.4 `GET /user/projects/{projectId}/participants` — 프로젝트 참여자

**Path**: `projectId` (string, 필수, 숫자, 1~15자)
**응답 `data.participants[]`**: `inttId`*, `userId`*, `name`*
**에러 추가**: `NOT_EXISTS_ERROR / 프로젝트가 존재하지 않습니다.`

> **이 목록은 "참여자 전원"이 아니다 — 우리 기관 사람만이다** `(실측 2026-08-04)`. 프로젝트
> 4곳 모두 5~7명이고 전원 `@traport.com`, `inttId`도 하나(우리 테넌트)다. MCP
> `flow_list_project_participants`도 **같은 목록**을 준다. 잘린 게 아니다: `pageSize=100` ·
> `lastCursor=0` · `page=2`를 붙여도 수가 그대로고 응답에 `hasNext`·`lastCursor`도 없다.
>
> 같은 프로젝트 업무(§6.1)의 실제 담당자는 3~41명이고 **그중 2~33명이 이 목록에 없다.**
> 담당자 후보를 이 목록만으로 만들면 고객사 담당자를 고를 수가 없다.
>
> **후보를 채우는 방법**: §6.1 응답의 `WORKER_ID`·`RGSR_ID` 컬럼에서 `{customColumnData,
> userName}`을 긁어 `userId`로 합친다. **`customColumnData`가 곧 `workerId`다** — 우리 기관
> 사람은 이 값이 여기 `userId`와 같은 이메일(20~25자)이고, 타사 사용자는 6~10자 로그인 ID나
> 타사 이메일(`naver.com` 등)이다. §6.4 `worker` PATCH가 받는 형식(`1~100자,
> 소문자/숫자/-_@.`)이고, 업무를 맡거나 낸 사람은 참여자라 `프로젝트에 참여하지 않은 사용자를
> 담당자로 지정할 수 없습니다`에 걸리지 않는다. 구현은 `rest.ts listParticipants`다.
>
> 타사 사용자의 부서·직급·사진은 여전히 못 온다 (§6.1의 등록자 표와 같은 사정).
>
> **임직원/외부 가르기** `(실측 2026-08-04, 5개 프로젝트)`: 이 API가 준 사람은 전원
> `@traport.com`이고, §6.1에서 긁어 온 7~42명은 **한 명도** `@traport.com`이 아니었다. 그래도
> 출처가 아니라 `userId` 도메인으로 가른다 (`Participant.outside`) — 이 API가 언젠가 외부
> 사람을 주기 시작해도 판정이 안 틀린다. 내 업무 카드의 참여자 목록이 이 값으로 두 무리를 만든다.
>
> **얼굴 사진은 여기 없다.** 내 업무 카드는 전사 명단(§9.3)의 `profileImagePath`를 **이메일로**
> 맞춰 붙인다 (`loadProjectPanel`) — 이름으로 맞추면 동명이인에서 틀린다. 명단이 13명 한 번에
> 오고 10분 캐시라 호출이 늘지 않는다. 타사 사용자는 그 명단에 없어서 사진이 안 붙는다 — 위에
> 적은 대로 애초에 못 오는 값이다.

### 5.5 `GET /user/projects/{projectId}/columns` — 프로젝트 업무 컬럼 ⭐

업무 필드 해석의 전제 조건. 프로젝트별로 1회 캐싱해 두면 된다.

**Path**: `projectId` (string, 필수, 숫자, 1~15자)

**응답 `data`**: `{ projectId, columns: Column[] }`

| 필드 | 타입 | 필수 | 예시 | 설명 |
|---|---|---|---|---|
| `columnSrno` | string | ✓ | `"12"` | 컬럼 일련번호 |
| `columnName` | string | ✓ | `"상태"` | 컬럼 이름 |
| `columnLangCode` | string | ✓ | `"dictionary:status"` | 다국어 코드 |
| `columnType` | string | ✓ | `"STATUS"` | 컬럼 타입 |
| `columnDescription` | string | ✓ | `""` | 설명 |
| `defaultColumnYn` | string | ✓ | `"Y"` | 기본 컬럼 여부 |
| `defaultColumnType` | string | ✓ | `"STATUS"` | **기본 컬럼 타입 — 2.1 표의 키** |
| `projectId` | string | ✓ | | |
| `multiOptionYn` | string | ✓ | `"N"` | 복수 옵션 허용 |
| `viewYn` | string | ✓ | `"Y"` | 노출 여부 |
| `orderNum` | string | ✓ | `"1"` | 정렬 순서 |
| `rgsrId` / `rgsnDateTime` / `edtrId` / `edtrDateTime` | string | ✓ | `"system"` / `"20250501123045"` | 감사 필드 |

### 5.6 `GET /user/projects/{projectId}/columns/status` — 상태 컬럼 옵션 ⭐

`optionSrno` → 사람이 읽는 상태명 매핑에 필수.

**Path**: `projectId` (string, 필수, 숫자, 1~15자)

**응답 `data`**: `{ projectId, columnSrno, options: StatusOption[] }`

| 필드 | 타입 | 필수 | 예시 | 설명 |
|---|---|---|---|---|
| `optionSrno` | string | ✓ | `"18304"` | 옵션 일련번호 — 업무의 상태 컬럼 값과 대조 |
| `projectId` / `columnSrno` | string | ✓ | | |
| `optionName` | string | ✓ | `"대기"` | 옵션 이름 |
| `optionLangCode` | string | ✓ | `"system:code.S2791"` | 다국어 코드 |
| `optionCategory` | string | ✓ | `"0"` | 옵션 카테고리. 완료/미완료 구분용 `(추정)` |
| `optionOrder` | string | ✓ | `"1000.0000000000"` | 정렬 순서 (소수 문자열) |
| `optionColor` | string | ✓ | `"Multi06"` | 색상 코드 (헥스 아님, 팔레트 토큰) |
| `rgsrId` / `rgsnDateTime` / `edtrId` / `edtrDateTime` | string | ✓ | | 감사 필드 |

> **`STTS`만 쓰는 프로젝트는 `options`가 빈 배열이다** `(실측 2026-07-29)`. 이 엔드포인트는 커스텀 상태 컬럼(`STATUS`, `columnSrno` 12)의 옵션만 준다. 표본 8개 중 7개가 `STTS`(9) 프로젝트였고 전부 옵션이 0건이었다 — 그쪽 라벨은 여기서 못 얻는다. §6.1 끝의 코드 대응표를 쓴다.

### 5.7 쓰기 계열 (참고 — 이 프로젝트에서는 미사용)

| 메서드 | 경로 | Body 요약 | 응답 `data` |
|---|---|---|---|
| POST | `/user/projects` | `title`*(1~50), `description`(1~10000), `defaultTab`(`feed\|task\|gantt\|calendar\|file`), `postPermission{view:all\|registerAndAdmin, write:all\|admin, edit:all\|register\|registerAndAdmin}`, `commentPermission{write:all\|admin}` | `{ projectId }` |
| POST | `/user/projects/{projectId}/participants` | `participants[]{participantId*}` (최소 1) | `{ projectId }` |
| POST | `/user/projects/{projectId}/groups` | `name`*(1~100), `useYn`(Y\|N), `orderNum` | `{ group: { groupId, name, projectId, orderNum } }` |
| PATCH | `/user/projects/{projectId}/groups/{groupId}` | `name`*, `useYn`, `mode` | `{ group: { groupId, name, projectId } }` |
| POST | `/user/projects/{projectId}/task-columns` | `columnType`*(`TEXT\|CHECKBOX\|OPTION\|NUMBER\|DATE\|FORMULA`), `columnName`*(1~100), `columnDescription`(≤1000), `defaultColumnYn`, `defaultColumnType`, `multiOptionYn`, `orderNum` | `{ column: { columnId, columnName, columnType, columnDescription, projectId } }` |
| PATCH | `/user/projects/{projectId}/task-columns/{columnId}` | `columnType`*, `columnName`*, `columnDescription` | `{ column: {...} }` |

---

## 6. Posts API

### 6.1 `GET /user/posts/projects/{projectId}/tasks/filter` — 프로젝트 내 업무 필터 조회 ⭐⭐

이 프로젝트에서 가장 중요한 엔드포인트.

**Path**

| 이름 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `projectId` | string | ✓ | 숫자, 1~15자 |

**Query**

| 이름 | 타입 | 필수 | 기본 | 제약 / 설명 |
|---|---|---|---|---|
| `cursor` | string | | `0` | 0 이상 숫자. **페이지 번호다 — 오프셋이 아니다.** 다음 페이지는 응답의 `lastCursor`를 그대로 넣는다. `pageSize`를 곱해서 계산하면(`cursor=100`) 빈 응답 + `hasNext: false`가 조용히 온다 — [BUG-030](bug-report.md#bug-030), 실측 236건 프로젝트가 100건으로 보였다 |
| `pageSize` | string | | `50` | 1~100 |
| `searchWord` | string | | | ≤1000자. 업무 검색어 |
| `upTaskId` | string | | | 숫자. 상위 업무 ID로 한정 |
| `mode` | string | | | ≤100자. 조회 모드. 예 `TREE` |
| `treeModeYn` | string | | | `Y` \| `N` |
| `filterRecords` | string | | | 컬럼 필터 조건 **JSON 배열을 문자열로** 직렬화 후 URL 인코딩 |

`filterRecords` 아이템 스키마:

| 키 | 설명 |
|---|---|
| `COLUMN_SRNO` | 필터링할 업무 컬럼 ID (2.1 표) |
| `OPERATOR_TYPE` | 필터 연산자. 문서에 명시된 값은 `IN` 뿐. 그 외 연산자 집합은 **미공개** |
| `FILTER_DATA` | 값. 여러 개는 콤마 구분 |

예시 (인코딩 전):
```json
[{"COLUMN_SRNO":"12","OPERATOR_TYPE":"IN","FILTER_DATA":"19171,19172"}]
```
조건이 없으면 파라미터를 생략하거나 `[]` 를 보낸다.

> 마감일 범위 필터(예: `END_DT <= 오늘+7일`)를 서버에서 걸 수 있는지는 **확인 불가**. `IN` 외 연산자가 문서화되지 않았다. 안전한 구현은 `filterRecords` 없이 전량 조회 후 클라이언트에서 날짜 비교 `(추정)`.

> **담당자 필터는 서버에서 걸린다** `(실측 2026-07-28)`. 전량을 받아 걸러 내는 게 아니라 딱 그 사람 것만 온다.
> ```json
> [{"COLUMN_SRNO":"1","OPERATOR_TYPE":"IN","FILTER_DATA":"<userId>"}]
> ```
> 59개 프로젝트를 이 필터로 훑어 담당 업무 880건을 받았다 — 동시 10으로 **2.1초**, 100건을 넘는 프로젝트 2개의 커서 페이징까지 64회 4.1초. 프로젝트당 평균 23건. PRD §6.5가 이 경로로 서 있다.
>
> **경고**: API Key 소유자가 아닌 사람의 `userId`를 넣어도 **그 사람 업무가 그대로 온다** (실측으로 확인). 필터 값은 요청에서 받지 말고 서버에서 세션으로 채운다.

> **같은 컬럼에 레코드를 여러 개 주면 OR다** `(실측 2026-08-04)`. 팀 화면이 부서원 8명 ×
> 프로젝트 59개 = 472회 대신 프로젝트당 1회로 끝나는 근거다 (PRD §5.1).
> ```json
> [{"COLUMN_SRNO":"1","OPERATOR_TYPE":"IN","FILTER_DATA":"a@traport.com"},
>  {"COLUMN_SRNO":"1","OPERATOR_TYPE":"IN","FILTER_DATA":"b@traport.com"}]
> ```
> 같은 프로젝트에서 8명 배열은 3건, 나 혼자는 1건이 왔다 — 뒤 레코드가 앞을 덮지 않는다.
> 다른 두 표기는 **쓰면 안 된다**: 콤마로 이어 붙이면(`"a,b"`) 0건이 오고(에러가 아니다 —
> 조용히 빈다), `FILTER_DATA`에 배열을 넣으면 500이다. §6.1 상단 표의 "여러 개는 콤마 구분"은
> `COLUMN_SRNO 12`(상태 `optionSrno`) 기준이고 담당자 컬럼에는 통하지 않는다.

**응답 `data`**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `hasNext` | boolean | ✓ | |
| `lastCursor` | number | ✓ | 없으면 `-1` |
| `mode` | string | ✓ | 응답 모드 (`TREE` 등) |
| `tasks` | array | ✓ | 아래 |
| `groupAggregates` | array | ✓ | 그룹 집계 **원본** 목록 — **아이템 스키마 문서화 안 됨** |

`tasks[]` 아이템:

| 필드 | 타입 | 필수 | 예시 | 설명 |
|---|---|---|---|---|
| `taskId` | string | ✓ | `"321292"` | 업무 ID (= raw `TASK_SRNO`) |
| `orderNumber` | string | ✓ | `"1"` | 정렬 번호 |
| `upTaskId` | string | ✓ | `"-1"` | 상위 업무 ID. 최상위는 `-1` |
| `subTaskCount` | string | ✓ | `"0"` | 하위 업무 수 |
| `postId` | string | ✓ | `"40002"` | 게시글 ID |
| `projectId` | string | ✓ | | |
| `projectTitle` | string | ✓ | | |
| `sectionId` | string | ✓ | `"100"` | 섹션 ID |
| `editAuthType` | string | ✓ | `"ALL"` | 수정 권한 타입 |
| `managerYn` | string | ✓ | `"Y"` | 관리자 여부 |
| `content` | string | ✓ | `"1차 응대 업무"` | 업무 내용. **빈 문자열인 경우가 흔하다** (실측) — 업무명은 `columns[]`의 `TASK_NM`을 봐야 한다 |
| `upTaskName` | string | | `""` | 상위 업무명 |
| `directlyFilteredYn` | string | ✓ | `"Y"` | 직접 필터에 걸린 항목인지 |
| `hasFilteredSubtaskYn` | string | ✓ | `"N"` | 필터된 하위 업무 보유 여부 |
| `backgroundColor` | string | | `"#FFFFFF"` | |
| `connectUrl` | string | | `""` | 업무 링크. **실측 880건 전부 빈 문자열이다** — 게시글 상세(§6.3)가 주는 짧은 링크가 여기엔 없다. `projectId`·`postId`가 응답에 있으니 `main.act?projectId=…&postId=…`로 조립한다 |
| `postViewAuthYn` | string | ✓ | `"Y"` | 게시글 조회 권한 |
| `columns` | array | ✓ | | 업무 컬럼 목록. 아래 (2026-07-28 실측) |

`columns[]` 아이템 — **camelCase다** (문서 공백이었고 두 형태를 추정했는데, 인증 호출로 1번이 확정됐다):

| 필드 | 예시 | 설명 |
|---|---|---|
| `columnId` | `"11"` | 컬럼 ID (2.1 표의 `COLUMN_SRNO`) |
| `columnType` | `"DATE"` | `USER` \| `TEXT` \| `STTS` \| `DATE` \| … |
| `defaultColumnType` | `"END_DT"` | **의미를 정하는 필드.** 실측: `WORKER_ID`(담당자) · `TASK_NM`(업무명) · `STTS`/`STATUS`(상태) · `END_DT`(마감일) · `PRIORITY`(우선순위) · `RGSR_ID`(등록자) · `RGSN_DTTM`(등록일시) · `EDTR_DTTM`(수정일시) · `PROGRESS`(진행률) · `TASK_NUM`(업무번호) |
| `columnData` | | 값 배열. 담당자처럼 여러 명이면 원소가 여럿이다 |

> **`RGSR_ID`(등록자 = 글 작성자)는 `columnType: USER`고 `userName`에 실명이 온다** `(실측
> 2026-08-04, 업무 4,142건 채움률 100%)`. 담당자(`WORKER_ID`)와 형태가 같고, 담당자가 아예 없는
> 프로젝트에도 이 컬럼은 있었다 — 업무를 만든 사람은 늘 있기 때문이다. `customColumnData`는
> 실명이 아니라 로그인 ID다 (6~13자).
>
> **이제 모든 화면이 이 응답 하나로 선다** `(2026-08-04, v4.0.0)`. 오늘·팀·리스크가 쓰던 MCP
> 워크리스트를 걷어내고 넷 다 §6.1로 옮겼으므로, 등록자·등록일은 어느 화면에서나 추가 호출
> 없이 있다. 그래도 열을 켠 건 `/tasks` 내 업무뿐인데 그건 자리 문제다 — 다른 세 화면은 표가
> 좁아서 업무명이 먼저 잘린다.
>
> **이름 말고는 못 붙인다** `(실측 2026-08-04)`:
>
> | 원하는 값 | 결과 |
> |---|---|
> | 사진 | 이 컬럼의 `profilePhoto`는 **늘 빈 문자열**이다 (§6.1 응답에서 관측한 전 건) |
> | 부서·직급 | §9.3 `GET /user/search/employees`에만 있고 그건 **우리 이용기관 13명**이다. 내 업무 686건의 등록자 중 그 명단에 있는 건 **5건**(0.7%) — 나머지는 타사 사용자다. `?projectId=`로 좁혀도 응답은 그대로 13명이고(파라미터 무시), §5.4 참여자 조회는 `inttId`·`userId`·`name`뿐이다 |
> | 회사·부서 (타사 포함) | §13.1 **댓글**에는 `registerCorpName`·`registerDivisionName`이 온다. 업무 등록자에게는 그런 필드가 없다 — §6.3 게시글 상세도 `registerId`·`registerName`까지다 |

> **앱이 이 응답 하나에서 꺼내 쓰는 값** `(v4.1.0)`. 전부 `columns[]`에 이미 들어 있어서
> **추가 호출이 0회**다 — 화면에 값 하나를 더 그리려고 REST를 다시 부르는 자리가 없다.
>
> | `defaultColumnType` | 어디에 쓰나 |
> |---|---|
> | `TASK_NM` | 업무명 (평면 `content`는 빈 문자열인 경우가 흔하다) |
> | `END_DT` | 마감일 · D-DAY 배지 · 임박/밀림 판정 |
> | `STATUS` / `STTS` | 상태 배지 · 상태 칩 필터 · **완료 판정**(`optionCategory == "2"`) |
> | `WORKER_ID` | 담당자 칸 (리스크·팀) |
> | `RGSR_ID` | 등록자 칸 (내 업무) · 모달 딱지 |
> | `RGSN_DTTM` | 등록일 칸 (내 업무) |
> | `EDTR_DTTM` | **방치 판정**(30일 무활동) · 방치된 업무 표의 `마지막 수정` 칸 |
> | `PRIORITY` | 업무명 앞 표식(`높음`·`긴급`만) · 모달 우선순위 줄. **v4.1.0 전에는 안 읽었다** — 모달이 열릴 때마다 같은 값을 `getTaskFields`로 따로 받아 업무 한 건에 REST 1회를 더 썼다 |
>
> 안 읽는 기본 컬럼은 `PROGRESS`·`TASK_NUM`·`START_DT`·`SECTION`이다. 진행률은 상태 배지와
> 같은 말을 두 번 하고, 나머지 셋은 화면에 자리가 없다.

`columnData[]` 아이템:

| 필드 | 예시 | 설명 |
|---|---|---|
| `customColumnData` | `"20260430"` | **실제 값.** 마감일은 `YYYYMMDD`, 상태는 코드(`"4"`), 담당자는 이메일/아이디, 업무명은 문자열 |
| `userName` | `"이종석"` | `USER` 컬럼일 때 실명 |
| `profilePhoto` | `https://flow.team/flowImg/…` | `USER` 컬럼일 때 프로필. **`RGSR_ID`에서는 늘 `""`다** (위 표) |
| `optionName` | `"PAST"` | `DATE`에서 `PAST`면 마감 지남 |
| `optionCategory` | `"1"` | `STTS`에서 상태 그룹 |
| `optionColor` · `customColumnDataId` · `columnType` | `""` | 실측에서 대부분 비어 있다 |

> **상태 코드 대응표** `(실측 2026-07-29 — 위 "아직 없다"를 정정한다)`. `STTS` 컬럼은 `optionName`이 항상 빈 문자열이고 `customColumnData`에 코드만 온다. 코드 의미는 `flow_get_post` 시스템 댓글의 상태 변경 기록으로 확정했다 — `SYS_CODE:"S45^^<이전>^^<이후>"` 형식에 사람 말 문구가 붙어 온다.
>
> | 코드 | 라벨 | `optionCategory` | 근거 |
> |---|---|---|---|
> | `0` | 요청 / **대기** | `"0"` | `S45^^0^^2` = "'요청' → '완료'". **flow가 두 이름을 쓴다** — 시스템 댓글은 `요청`, 업무 목록은 `대기`다. 화면 배지는 **`대기`** 로 쓴다: 사용자가 flow 업무판에서 보는 이름이 그쪽이라, 같은 업무가 두 화면에서 다른 이름이면 안 된다 ([BUG-028](bug-report.md#bug-028)) |
> | `1` | 진행 | `"1"` | 카테고리 |
> | `2` | 완료 | `"2"` | 위 기록의 도착점. 같은 업무 `PROGRESS`가 100이 됐다 |
> | `3` | 보류 | `"3"` | 카테고리 |
> | `4` | 피드백 | `"1"` | `S45^^4^^0` = "'피드백' → '요청'" |
>
> **완료 판정은 `optionCategory == "2"`로 한다.** `STTS`·`STATUS` 두 체계가 공통으로 이 값을 주는 유일한 필드다. §2.1의 `OPTION_CATEGORY` 추정("대기가 0")은 이걸로 확정됐다.

### 6.2 `GET /user/posts/projects/{projectId}` — 프로젝트 게시글 목록

**Path**: `projectId` (string, 필수, 숫자, 1~15자)

**Query**

| 이름 | 타입 | 필수 | 기본 | 제약 |
|---|---|---|---|---|
| `cursor` | string | | `0` | 0 이상 숫자 |
| `pageSize` | string | | `20` | 1~100 |
| `postId` | string | | | 숫자, 1~15자. 특정 게시글 기준 조회 |
| `templateTypes` | string | | | 숫자 콤마 구분, ≤1000자. 예 `1,2,4` |

**응답 `data`**: `{ projectId, hasNext, lastCursor, posts: Post[] }`

`posts[]` 아이템 (전부 문자열, `required` 표시는 스펙 기준):

| 필드 | 예시 | 설명 |
|---|---|---|
| `projectId`, `postId` | `"23277"`, `"40001"` | |
| `remarkSrno` | `"-1"` | 비고 일련번호 |
| `templateType` | 문서 `"1"` / **실제 7종 `(관측)`** | 글 종류 (업무/일정/할일/일반). 아래 표 참고 — **판정에 쓰지 않는다** |
| `registerName` | `"홍길동"` | 작성자 이름 |
| `registeredDateTime` | `"20260509093000"` | 작성일시 |
| `projectTitle`, `title` | | |
| `content`, `htmlContent` | | 본문 / HTML 본문 |
| `remarkCount` | `"2"` | 댓글 수. **최상위만 센다** — 답글은 안 들어간다 (§13.1) |
| `readYn` | `"Y"` | 읽음 여부 |
| `sysCode` | `"FLOW"` | 시스템 코드 |
| `rangeType` | 문서 `"ALL"` / **실제 `"A"` `(관측)`** | 공개 범위 |
| `colaboGb` | `"0"` | 협업 구분값 |
| `checkedYn` | `"N"` | 체크 여부 |
| `publicLinkPermission` | `"N"` | 공개 링크 권한 |
| `subTaskCount` | `"0"` | 하위 업무 수 |
| `taskStatus` | 문서 `"REQUEST"` / **실제 `"901659"` (숫자 optionSrno) `(관측)`** | 업무 상태 |
| `scheduleStartDateTime`, `scheduleFinishDateTime` | `"20260510100000"` | 일정 시작/종료 |
| `allDayYn` | `"N"` | 종일 일정 여부 |

> **`taskStatus` 는 문서 예시(`REQUEST`)를 믿으면 안 된다.** 업무 2.0 프로젝트에서는 `optionSrno` 숫자 문자열이 온다. 5.6으로 해석해야 한다.

> **`templateType` 실측 7종 `(실측 2026-08-06, 프로젝트 59 / 글 3,132건)`**
>
> | 값 | 정체 | 건수 | 무엇으로 확인했나 |
> |---|---|---:|---|
> | `92` | 업무 (2.0) | 2,327 | `taskStatus` 2,327/2,327 채움 |
> | `91` | 일반글 | 540 | 상세의 `todos`·`schedules`·`tasks` 전부 0 |
> | `93` | 일정 | 157 | `scheduleStartDateTime` 157/157 |
> | `4` | 업무 (구) | 75 | `taskStatus` 75/75 채움 |
> | `3` | 일정 (구) | 21 | 상세 `schedules:1` + 시작시각 있음 |
> | `1` | 일반글 (구) | 8 | 상세 배열 전부 0 |
> | `2` | **할일** | 4 | 상세 `todos:7` (예: `BICs연계 인터페이스 할일 목록`) |
>
> 구버전 `1~4`(일반·할일·일정·업무)와 신버전 `91~93`(일반·업무·일정) **두 벌이 섞여서** 온다.
> 할일만 신버전 번호가 없다 — 업무로 흡수된 것으로 보인다.
>
> **이 값으로 업무를 가르지 않는다.** 문서는 `"1"` 하나만 적어 두는데 실제로는 7종이고,
> 목록으로 짜면 종류가 늘 때마다 조용히 새어 나간다 — 실제로 새어 나갔다. 이 표를 처음
> 적었을 때 관측된 건 `92`·`4`·`91`·`93` 넷뿐이었고, 오늘 3,132건을 훑으니 `1`·`2`·`3`
> 33건이 더 나왔다. `templateType in [91, 93]` 같은 화이트리스트였다면 그 33건이 통째로
> 사라졌을 것이다.
>
> **대신 `taskStatus` 가 채워졌는지로 가른다** (`listProjectPosts`). 업무 2,402건은 전부
> 채워 오고 나머지 730건은 전부 빈 문자열이라 **한 건도 안 겹친다**. 새 타입이 생겨도
> 업무가 아니면 자동으로 "업무 아닌 글"에 남는다.
>
> 우리 화면(`ProjectPost.kind`)은 `scheduleStartDateTime` 유무로 `일정`/`글` 둘로만 가른다 —
> 그래서 **할일(`2`)은 `글`로 묶인다.** 3,132건 중 4건이라 따로 세울 값이 없다. 갈라야 한다면
> `templateType` 말고 상세의 `todos` 배열로 봐야 위 취약점을 안 들여온다(대신 글마다 상세를
> 한 번 더 부른다).

> **`readYn` 은 읽어만 진다 — 되돌리는 쓰기가 없다** `(실측 2026-08-06)`. 알림에는 읽음 처리가
> 있지만(§7.2 `PATCH /user/alarms/read`) 게시글에는 그에 해당하는 길이 없다. 상세 조회로도 안
> 바뀐다 — 안 읽은 글 하나를 `GET /user/posts/{postId}` 로 부른 뒤 목록을 다시 받아도 `readYn`
> 이 `"N"` 그대로였다. 짐작할 만한 경로 12개(`PATCH /user/posts/read`, `.../{postId}/read`,
> `POST .../{postId}/view`, `PATCH .../{postId}` 등)를 찔러 전부 `NOT_FOUND_ERROR` 를 받았다.
> **대조군이 신호를 보증한다**: 길이 있고 대상이 없으면 500(`GET /user/posts/1`), 길이 없으면
> 404(`GET /user/nonsense-xyz`)다 — 위 12개는 전부 후자였다.
> 그래서 우리 화면(내 업무의 `업무 아닌 글`)은 **점을 지우지 않는다.** 화면에서만 끄면 flow에는
> 안 읽음으로 남아서, 캐시가 풀리거나 다시 들어오면 점이 되살아난다 — 처리된 척이 제일 나쁘다.

### 6.3 `GET /user/posts/{postId}` — 게시글 상세

**Path**: `postId` (string, 필수, 숫자, 1~15자). `projectId` 는 넘기지 않는다 (서버가 조회).

**응답 `data`** — 평면 필드

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `projectId`, `postId`, `remarkSrno`, `templateType` | string | ✓ | |
| `title`, `content`, `htmlContent` | string | ✓ | |
| `commentContent` | string | | 댓글형 본문 |
| `outContent` | string | | 외부 표시 본문 |
| `contentJsonYn` | string | ✓ | 본문 JSON 여부 |
| `registerId`, `registerName` | string | ✓ | 작성자 |
| `registeredDateTime` | string | ✓ | 작성 일시 |
| `editedDateTime` | string | ✓ | **수정 일시 — 게시글 단위 "최종 활동" 판정에 가장 쓰기 쉬운 필드** |
| `connectUrl` | string | | 연결 URL |
| `remarkCount` | string | ✓ | 댓글 수. **최상위만 센다** — 답글은 안 들어간다 (§13.1) |
| `existYn`, `nextYn`, `totalCount`, `sectionCount` | string | ✓ | |

**응답 `data`** — "원본 목록" 배열 (전부 `required`, **아이템 스키마가 문서에 정의되어 있지 않다**. 2.2처럼 대문자 스네이크 OpenGate 레코드가 온다 `(관측)`):

`remarks`(댓글), `attachments`(첨부), `imageAttachments`(이미지), `todos`(할일), `schedules`(일정), `tasks`(업무), `subTasks`(하위 업무), `upLinkTasks`(상위 연결 업무), `votes`(투표), `projectColumns`(프로젝트 컬럼)

> **`remarks` 로는 댓글 전체를 못 받는다 `(관측 2026-07-28)`.** 게시글 81211887은
> `remarkCount: "14"` 인데 `remarks` 에 **2건**만 왔다. 더 받을 방법이 없다:
> `nextYn: "N"`, `totalCount: "0"`, `remarkSrno: ""` 로 페이징 단서가 전부 비어 있고,
> `?remarkSrno=` · `?cursor=` 를 붙이면 `VALIDATION_ERROR / unrecognized_keys` 가 온다.
>
> **정정 `(관측 2026-07-28 오후)`: "전체 댓글 스레드는 못 만든다"는 틀렸다.** 이 엔드포인트로
> 못 받는 것은 맞지만, **전용 엔드포인트가 따로 있다** — `GET /user/comments/{postId}` (§13).
> 같은 게시글 81211887에서 **14건 전부** 왔다. 이 문서가 §13~15 세 도메인을 놓쳤던 탓이다
> (§0 참고).
>
> **`remarks` 만 아는 게 하나 있다 `(실측 2026-08-03)`: `REPLY_CNT`.** 댓글마다 답글 수가 붙어
> 있어서 "이 댓글에 답글이 몇 개인가"는 여기서만 안다 — §13.1 은 그 필드를 안 주고 답글 본문은
> 어디에도 없다. 다만 **2건 상한이 그대로 걸려서** 게시글의 답글 현황을 알 수는 없다.
> 관측 키 전량: `CNTN` · `COLABO_COMMT_SRNO` · `COLABO_REMARK_SRNO` · `COLABO_SRNO` ·
> `DELETE_YN` · `EDTR_DTTM` · `EMT_CNT` · `EMT_SELF_YN` · `LANG` · `MNGR_DSNC` · `MODIFY_YN` ·
> `PHTG_USE_YN` · `PIN_USE_YN` · `PIN_YN` · `PRFL_PHTG` · `REMARK_ATCH_REC` · `REMARK_CNTN` ·
> `REMARK_IMG_ATCH_REC` · `REPLY_CNT` · `RGSN_DTTM` · `RGSR_ID` · `RGSR_JBCL_NM` · `RGSR_NM` ·
> `SELF_YN` · `SYSTEM_REMARK_YN` · `SYS_CODE`. **부모를 가리키는 필드는 없다.**
>
> **`remarks` 만 아는 게 하나 더 있다 `(실측 2026-08-06)`: 댓글 첨부.**
> `REMARK_ATCH_REC`(일반) · `REMARK_IMG_ATCH_REC`(이미지)에 파일이 실린다 — 아이템 스키마는
> 게시글 첨부(`attachments` · `imageAttachments`)와 같다. **댓글 전량을 주는 §13.1 에는 파일
> 칸이 아예 없어서**, 댓글에 붙은 파일을 아는 자리는 여기뿐이다
> ([BUG-050](bug-report.md#bug-050)). 게시글 82624764 → 댓글 194461322 의
> `REMARK_IMG_ATCH_REC[0]` = `image.png` (`THUM_IMG_PATH` · `ATCH_URL` 둘 다
> `flow.team/flowImg/**`, 로그인 없이 200).
>
> **2건 상한이 여기에도 그대로 걸린다.** 더 받는 손잡이는 없다 — `?pageSize=` · `?remarkSrno=` ·
> `?remarkCount=` · `?size=` · `?replyYn=` · `?remarkYn=` · `?allRemarkYn=` 전부
> `400 VALIDATION_ERROR / unrecognized_keys` 다 `(실측 2026-08-06)`. 그래서 이 화면은
> **최근 두 댓글의 첨부만** 그린다.

> **`title` 이 업무명의 유일한 출처다 `(실측 2026-07-29)`.** 알림(§7.1)은 이름을 하나도 주지
> 않아서 헤더 소식 카드의 업무명이 여기서 나온다 (`getPostBrief`, PRD §6.1.5). 게시글 82010144
> → `title: "[예약 시 동행자 선택 필드] 동행자 필드 위치 개선"`. **제목만 주는 엔드포인트는
> 없다** — 한 줄 때문에 `content`·`htmlContent`·`remarks` 원본까지 딸려 온다.

> **`tasks[0]` 이 업무 상태의 유일한 출처다 `(실측 2026-07-29)`.** 워크리스트도 알림도 상태를
> 안 줘서 멘션 줄의 상태 배지가 여기서 나온다 (`getPostBrief`, [BUG-028](bug-report.md#bug-028)).
> 아이템은 §2.2처럼 **대문자 스네이크**다 — `tasks/filter`(§6.1)의 camelCase와 이름이 다르다:
> `TASK_SRNO` · `STTS` · `TASK_COLUMN_REC[].DEFAULT_COLUMN_TYPE` ·
> `TASK_COLUMN_REC[].COLUMN_DATA_REC[].CUSTOM_COLUMN_DATA` / `OPTION_NAME` / `OPTION_CATEGORY`.
> 업무가 아닌 글(공지·회의록)은 `tasks` 가 빈 배열이다.
>
> **⚠️ 평면 `tasks[0].STTS` 를 읽으면 안 된다 `(실측 2026-07-29)`.** 커스텀 상태(`STATUS`, §2.1)를
> 쓰는 프로젝트에서도 이 필드가 오는데 **안 쓰는 컬럼이라 항상 `"0"`** 이다. 게시글 80754103
> (프로젝트 2916576 `Q020 Extranet 운영`)은 실제 상태가 `진행`인데 평면 값은 `'0'`(대기)이었고,
> `TASK_COLUMN_REC` 의 `STATUS` → `("901661", "진행", "1")` 가 맞는 값이다. 읽는 순서는
> **`TASK_COLUMN_REC` 의 `STATUS.OPTION_NAME` → 없으면 `STTS` 코드 맵**(§6.1 끝)이다.

> **원본 목록 넷이 업무 상세 모달을 채운다 `(실측 2026-08-04, 업무 글 20건)`.** 제목·상태 세 줄
> 때문에 어차피 통째로 받던 응답이라 **REST 호출이 하나도 안 는다** (`getPostBrief`, PRD §6.1.4).
>
> | 배열 | 채움 | 쓰는 키 | 그래서 |
> |---|---|---|---|
> | `upLinkTasks` | **11/20** | `UP_LINK_TASK_NM` · `COLABO_SRNO` · `COLABO_COMMT_SRNO` | 상위 업무 한 줄. **늘 1건**이다 |
> | `imageAttachments` | 6/20 | `ORCP_FILE_NM` · `THUM_IMG_PATH` · `ATCH_URL` · `FILE_SIZE` | 썸네일 격자 |
> | `attachments` | 5/20 | `FILE_NAME` · `ATCH_URL` · `FILE_SIZE` | 파일 이름 + 크기 한 줄 |
> | `subTasks` | 1/20 | `TASK_NM` · `PROGRESS` · `TASK_COLUMN_REC` · `COLABO_*` | 하위 업무 목록 |
>
> - **`COLABO_COMMT_SRNO` 는 그쪽 글 번호다 — 지금 글이 아니다.** 상위·하위 모두 자기
>   `COLABO_SRNO`(프로젝트)와 짝으로 와서 `main.act?projectId=…&postId=…` 를 호출 없이 만든다.
>   20건 전부에서 지금 글 번호와 달랐다.
> - **`subTasks[].STTS` 도 `"0"` 고정이다** — 위의 `tasks[0]` 과 같은 함정이라 상태는 똑같이
>   `TASK_COLUMN_REC` 의 `STATUS` 에서 읽는다. `PROGRESS` 는 빈 문자열로 오는 줄이 있어서
>   `Number("")`(=0)와 갈라야 한다.
> - **`attachments[].ATCH_URL` 은 슬래시가 겹쳐 온다** — `https://flow.team//FLOW_DOWNLOAD_R001.act?RAND_KEY=…`.
>   호스트 뒤를 하나로 줄여도 그대로 200이다(둘 다 확인). `EXTENSION` 은 8건 전부 빈 문자열이라
>   확장자는 `FILE_NAME` 에서 본다.
> - **일반 첨부의 `ATCH_URL` 은 우리 앱에 파일을 안 준다 `(실측 2026-08-06)`** — 맨몸·API 키
>   헤더·`Range` 셋 다 `200 text/html` **1091바이트(전부 빈 줄)**다. `content-disposition` 도
>   `accept-ranges` 도 없다. 세션 쿠키(`JSESSIONID`)를 요구하는데 그 쿠키에 `SameSite` 속성이
>   없어(=`Lax`) **다른 출처의 하위 리소스 요청에는 안 붙는다** — `<video src>`·`<img src>` 로
>   걸면 빈 응답을 받는다. `access-control-allow-origin` 도 없어서 `fetch` 로 받아 blob 으로
>   담는 길도 막힌다. API 키는 `api.flow.team` 용이라 `flow.team` 다운로드 경로에 무효고, 서버
>   프록시도 같은 빈 응답을 받는다. **쿠키가 붙는 건 최상위 이동뿐** — 그래서 첨부는 새 창
>   링크로만 연다 (`FileRow`). `/user/drive/files/search` 도 우리 기관은 비어 있다
>   (`{files:[], total:0}`).
> - **이미지 두 URL 다 로그인 없이 열린다** (`THUM_IMG_PATH`·`ATCH_URL` 모두 200,
>   `content-type: application/octet-stream`). 호스트가 `flow.team/flowImg/**` 라 `next.config.ts`
>   허용 목록에 이미 있다 — 프로필 사진과 같은 자리다.
> - 안 쓰는 것: `todos` · `schedules` · `votes` 는 20건 전부 비었고, `remarkSrno` 도 늘 빈
>   문자열이다.

> **`connectUrl` 은 로그인 화면을 건너 살아남는 링크다 `(실측 2026-07-29)`.** 같은 응답에
> `connectUrl: "https://flow.team/l/Qmcn5"` 가 온다 — flow가 만든 짧은 링크다. 세션이 없을 때
> `/l/{code}` 는 `signin.act?meta=no&postlink=Qmcn5` 로 **대상을 들고** 튕겨서 로그인 뒤 그 글을
> 연다. 우리가 조립한 `main.act?projectId=…&postId=…` 는 `signin.act?why=no-session&from=ssr-helper`
> 로 가서 **대상이 사라진다** ([BUG-024](bug-report.md#bug-024)). 소식 카드는 이 값을 쓴다.

### 6.4 쓰기 계열 (실제 호출하지 않음)

#### `POST /user/posts/projects/{projectId}` — 게시글 등록

Body: `title`*(1~200), `contents`*(1~10000), `files[]{fileName*(≤100, `\ / : * ? " < > |` 금지), fileContents*(base64)}`, `imageFiles[]`(동일), `viewPermission`(`all`\|`admin`, 기본 `all`)
응답 `data`: `{ projectId, postId, tinyUrl }`
추가 에러: `NOT_EXISTS_ERROR / 프로젝트가 존재하지 않습니다.`, `VALIDATION_ERROR / 허용되지 않은 파일 형식입니다.`

#### `POST /user/posts/projects/{projectId}/tasks` — 업무 등록

| Body 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `title` | string | ✓ | 1~200 |
| `contents` | string | ✓ | 1~10000 |
| `status` | string | ✓ | `request` \| `progress` \| `feedback` \| `complete` \| `hold` |
| `priority` | string | | `low` \| `normal` \| `high` \| `urgent` |
| `startDate` | string | | `YYYYMMDD` |
| `endDate` | string | | `YYYYMMDD` |
| `workers[]` | array | | `{ workerId*: 1~100자, 소문자/숫자/`-`/`_`/`@`/`.` }` |
| `files[]`, `imageFiles[]` | array | | 게시글 등록과 동일 |
| `viewPermission` | string | | `all` \| `admin`, 기본 `all` |

응답 `data`: `{ projectId, postId, taskId, tinyUrl }`
추가 에러: `PRECONDITION_FAILED_ERROR / 프로젝트에 참여하지 않은 사용자를 담당자로 지정할 수 없습니다.`, `VALIDATION_ERROR / 종료일은 시작일보다 빠를 수 없습니다.`

> **생성 시 `status` 는 legacy 문자열 enum만 받는다.** 업무 2.0 `optionSrno` 는 생성 API에 못 넣고, 생성 후 상태 수정 API로 바꿔야 한다.

#### `PATCH /user/posts/projects/{projectId}/tasks/{taskId}/status` — 업무 상태 수정

| Body 필드 | 타입 | 제약 |
|---|---|---|
| `status` | string | `request`\|`progress`\|`feedback`\|`complete`\|`hold`. `optionSrno` 와 **동시 전송 불가** |
| `optionSrno` | string | 숫자 1~15자. 업무 2.0 상태 옵션 일련번호. `status` 와 동시 전송 불가, **같은 프로젝트의 상태 컬럼 옵션이어야 함** |

응답: `data` 없음 (`success` / `code` / `message` 만)
추가 에러: `VALIDATION_ERROR / status 또는 optionSrno 중 하나만 입력해야 합니다.`, `VALIDATION_ERROR / 동일한 업무 상태로 변경할 수 없습니다.`, `NOT_EXISTS_ERROR / 업무가 존재하지 않습니다.`, `FORBIDDEN_ERROR / 게시글 접근 권한이 없습니다.`

#### 나머지 업무 단일 필드 수정 — 모두 `data` 없이 응답

| 경로 | Body | 제약 | 추가 에러 |
|---|---|---|---|
| `PATCH .../tasks/{taskId}/start-date` | `startDate` | `YYYYMMDD` | `마감일은 시작일보다 빠를 수 없습니다.`, `동일한 업무 시작일로 변경할 수 없습니다.` |
| `PATCH .../tasks/{taskId}/end-date` | `endDate` | `YYYYMMDD` | `마감일은 시작일보다 빠를 수 없습니다.`, `동일한 업무 마감일로 변경할 수 없습니다.` |
| `PATCH .../tasks/{taskId}/priority` | `priority` | `low\|normal\|high\|urgent` | `동일한 업무 우선순위로 변경할 수 없습니다.` |
| `PATCH .../tasks/{taskId}/worker` | `workers[]{workerId*}` | 1~100자 | `프로젝트에 참여하지 않은 사용자를 담당자로 지정할 수 없습니다.`, `{fieldName} 에 중복된 데이터가 존재합니다.` |

#### `POST /user/posts/projects/{projectId}/tasks/{taskId}/subtasks` — 하위 업무 생성

Body: `title`*, `contents`, `status`(`request\|progress\|complete\|hold\|feedback`), `priority`(`low\|normal\|high\|urgent`), `progress`(`"0"`~`"100"`)
응답 `data.subtask`: `{ taskId*, postId, taskNumber, orderNumber, parentTaskId*, parentPostId, projectId*, title* }`

#### `POST /user/posts/projects/{projectId}/schedules` — 일정 등록

Body: `title`*(1~200), `memo`(1~4000), `isAllDay`* (**boolean**), `startDateTime`*(14), `endDateTime`*(14), `attendance[]{attendanceId*}`, `viewPermission`
응답 `data`: `{ projectId, postId, tinyUrl }`

#### `POST /user/posts/projects/{projectId}/todos` — 할일 등록

Body: `title`*(1~200), `todoList[]`*(1~50개) `{ contents*(1~60), endDate(YYYYMMDD) }`, `viewPermission`
응답 `data`: `{ projectId, postId, tinyUrl }`

---

## 7. Alarms API

### 7.1 `GET /user/alarms` — 알림 목록 ⭐

**Query**

| 이름 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `filters` | string | | `MENTION`, `REGISTRANT`, `WORKER` 중 콤마 조합. 예 `MENTION,WORKER` |
| `readYn` | string | | `Y` \| `N` |
| `cursor` | string | | 0 이상 숫자 |
| `size` | string | | 1~100. (다른 API의 `pageSize` 가 아니라 **`size`**) |

**응답**: `data.alarms.alarms` — **`alarms` 가 두 번 중첩된다.** 오타가 아니다.

`data.alarms`: `{ hasNext: boolean, lastCursor: number, alarms: Alarm[] }`

`Alarm`:

| 필드 | 타입 | 필수 | 예시 | 설명 |
|---|---|---|---|---|
| `alarmId` | string | ✓ | `"900001"` | 알림 고유 번호 |
| `projectId` | string | ✓ | `"317536"` | |
| `postId` | string | ✓ | `"1046747"` | 게시글 ID |
| `remarkId` | string | ✓ | `"-1"` | 댓글 ID, 없으면 `-1` |
| `replyId` | string | ✓ | `"-1"` | 답글 ID, 없으면 `-1` |
| `receiverId` | string | ✓ | | 수신자 ID |
| `registerId` | string | ✓ | | 등록자 ID |
| `registerName` | string | ✓ | `"김플로"` | 등록자 이름 |
| `registeredDateTime` | string | ✓ | `"20260610103000"` | 등록 일시 |
| `message` | string | | `"김플로님이 회원님을 언급했습니다."` | 알림 메시지 |
| `content` | string | | | 알림 본문 |
| `readYn` | string | ✓ | `"N"` | |
| `alarmType` | string | | `"MENTION"` | 알림 유형 |
| `mentionYn` | string | ✓ | `"Y"` | 멘션 알림 여부 |
| `registrantYn` | string | ✓ | `"N"` | 내가 등록한 글 알림 여부 |
| `workerYn` | string | ✓ | `"N"` | 내 담당 업무 알림 여부 |

> PRD의 "멘션 28건 → 고유 업무 14건" 은 `filters=MENTION` 으로 받아 `postId` 기준 dedupe 하면 된다. **업무 ID(`taskId`)가 아니라 `postId` 만 준다는 점**에 주의 — 업무 상세가 필요하면 `postId` → `GET /user/posts/{postId}` 로 한 번 더 가야 한다.

**실측 (2026-07-28)** — 이 API가 **멘션 댓글 본문의 유일한 출처**다 (`src/lib/flow/rest.ts`):

| 관측 | 내용 |
|---|---|
| `alarmType` | 실제로 `null` 이 온다. 스펙은 `string` 이다 — MCP `flow_list_alarms` 가 죽는 원인 ([bug-report.md](bug-report.md) BUG-001) |
| `message` | 마찬가지로 `null` 가능 |
| `content` | 댓글 본문이 들어온다. **서버가 ~120자로 자른다.** `@[이름](id)` 멘션 마크업은 이미 걷혀 있다 — `remarks[].REMARK_CNTN` 보다 깨끗하다 |
| `replyId` | `-1` 이 아니면 그 댓글은 **다른 댓글에 달린 답글**이다. flow API로 얻을 수 있는 유일한 계층 신호다 |
| 날짜 필터 | 없다. `size=100` 으로 받아 워크리스트 멘션에 조인한다 |

> ### ⚠️ `remarkId`·`replyId` 가 **내가 쓴 줄**을 가리키는 알림이 섞여 온다 (실측 2026-08-04)
>
> 멘션 알림 8건 중 1건이 그랬다. 알림은 `registerName: "김동석"` · `registeredDateTime: 20260803162144`
> 인데 `replyId: 6080596` 은 **내가** 15:15:49에 쓴 답글이고 `content` 도 내 글이었다. 그 시각에
> 김동석이 쓴 답글은 스레드에 없다 — 알림의 시각·발신자와 가리키는 줄이 서로 안 맞는다.
>
> 나머지 7건은 전부 **알림 발신자 = 그 줄을 쓴 사람 · 알림 시각 = 그 줄의 시각**이었다.
>
> **그래서 강조는 알림으로 맞추지 않는다.** 스레드에서 "나를 부른 줄"은 댓글 본문의 멘션
> 마크업으로 가른다 (`mentionsMe` — `rest.ts`): 괄호 안 id가 세션의 `userId`와 같으면 나를 부른
> 줄이다 (`@[이종석](jongseok.lee@traport.com)` — `/user/employees/me`의 `userId`와 같은 값).
> 알림으로 맞추면 (1) 위 1건이 내 말에 `나를 부름`을 붙이고, (2) 알림 창(최근 7일·12건 —
> `queries.ts`)을 벗어난 옛 멘션은 아예 강조에서 빠진다. 마크업은 댓글에 영구히 남는다.
> 전원 호출(`@[ALL](ALL)`)은 id가 `ALL`이라 안 걸린다.

> **조인 키는 `registerId` + `registeredDateTime`.** 워크리스트(`flow_get_my_worklist.mentions`)는 `postId` 를 주지 않아서 그걸로는 못 묶는다. 두 응답이 같은 알림 레코드에서 나오므로 1:1로 맞는다. 알림 쪽이 실명(`registerName`)을 주므로 화면 표시도 아이디 대신 실명을 쓴다.

**실측 (2026-07-29)** — `filters=WORKER,REGISTRANT` 응답 필드는 `alarmId` · `alarmType` ·
`content` · `mentionYn` · `message` · `postId` · `projectId` · `readYn` · `receiverId` ·
`registerId` · `registerName` · `registeredDateTime` · `registrantYn` · `remarkId` · `replyId` ·
`workerYn` **이 전부다.** 제목·프로젝트명 같은 이름은 하나도 없다.

| 관측 | 내용 |
|---|---|
| `message` | `"서동조님의 댓글 등록"` 처럼 **`{이름}님의 {행동}` 템플릿**이다. `null` 도 온다 |
| `content` | 실제 본문. 화면에 낼 한 줄은 **`content` 가 먼저고 `message` 가 대타**다 (v0.17) — 이름은 작성자 줄에 이미 있어서 템플릿을 앞세우면 카드가 정보 없이 찬다 |
| 이름 조회 | 프로젝트명은 §5.x `listProjects`, 업무명은 §6.3 `title`. 둘 다 별도 호출이다 |

> **딥링크는 이 응답만으로 만들어진다** (v0.16.0): `https://flow.team/main.act?projectId={projectId}&postId={postId}`. `flow_search` 가 결과마다 `url` 로 돌려주는 형식 그대로다 — 우리가 추측한 규칙이 아니다. 워크리스트의 `link`(`https://flow.team/l/QBJyf`)는 flow 가 만든 단축 URL이라 여전히 못 만든다. 둘을 혼동해서 "알림으로는 링크를 못 만든다"고 적었던 게 [BUG-022](bug-report.md#bug-022).

### 7.2 `PATCH /user/alarms/read` — 알림 단건 읽음

Body: `alarmId`* (string, 숫자)
응답 `data`: `{}` (빈 객체)

### 7.3 `PATCH /user/alarms/read/all` — 알림 전체 읽음

Body: `projectId` (string, 숫자, 선택 — 특정 프로젝트만 처리)
응답 `data`: `{}` (빈 객체)

---

## 8. Calendars API

### 8.1 `GET /user/calendars` — 캘린더 목록

파라미터 없음.

**응답 `data`**: `{ editableCalendars: Calendar[], viewOnlyCalendars: Calendar[], projectCalendars: Calendar[] }`

`Calendar` (문서상 `editableCalendars` 에만 전체 필드가 정의되어 있고 나머지 두 배열은 `calendarSrno` 만 정의되어 있으나, **세 배열 모두 같은 형태** `(추정)`):

| 필드 | 타입 | 예시 | 설명 |
|---|---|---|---|
| `calendarSrno` | string | `"10001"` | 캘린더 일련번호 |
| `calendarName` | string | `"홍길동"` | 캘린더 이름 |
| `calendarType` | string | `"PERSONAL"` | 유형 |
| `customCalendarName` | string | | 사용자 지정 이름 |
| `userPermission` | string | `"ADMIN"` | 사용자 권한 |
| `calendarVisibilityYn` | string | `"Y"` | 공개 여부 |
| `calendarColor` | string | `"4F8EF7"` | 색상 (`#` 없음) |
| `calendarRole` | string | `"OWNER"` | 역할 |
| `colaboSrno` | string | `""` | 연결된 프로젝트 ID |
| `rgsrId` | string | | 등록자 ID |

### 8.2 `GET /user/calendars/events` — 일정 조회 ⭐

**Query**

| 이름 | 타입 | 필수 | 기본 | 제약 |
|---|---|---|---|---|
| `userId` | string | | 인증 주체 | 1~100자. **`/user/*` 중 유일하게 남아 있는 `userId` 파라미터** |
| `startDateTime` | string | ✓ | | `YYYYMMDDHHmmss` (14) |
| `endDateTime` | string | ✓ | | `YYYYMMDDHHmmss` (14) |
| `cursor` | string | | | 0 이상 숫자 |
| `pageSize` | string | | `100` | 1 이상 숫자 |

**응답 `data`**: `{ hasNext, lastCursor, events: Event[] }`

`Event` (전부 `required`, 문자열):
`eventSrno`, `calendarSrno`, `eventName`, `eventBody`, `eventStartDateTime`, `eventFinishDateTime`, `allDayYn`, `privateYn`, `publicYn`, `publicNameYn`, `gmtTime`(`"GMT+09:00"`), `timezone`(`"Asia/Seoul"`), `repeatSrno`, `repeatInstanceId`, `attendanceStatus`, `attendanceInfo`, `calendarName`, `customCalendarName`, `calendarRole`, `calendarColor`, `eventColor`, `colaboSrno`(협업 일련번호 = projectId), `colaboCommtSrno`(협업 댓글 일련번호 = postId `(추정)`)

> **프로젝트 일정 ↔ 게시글 연결**: `colaboSrno` / `colaboCommtSrno` 가 비어 있지 않으면 프로젝트에서 생성된 일정이다.

### 8.3 `GET /user/calendars/default` — 기본 캘린더

파라미터 없음. 응답 `data`: `{ calendarId }` (예 `"flow-calendar-user01"` — 8.1의 숫자 `calendarSrno` 와 형식이 다르다. 별개 식별자로 보임 `(추정)`)

### 8.4 `GET /user/calendars/subscribables` — 구독 가능 캘린더 검색

Query: `searchWord`* (1~100), `cursor`(기본 `0`), `pageSize`(기본 `50`)
응답 `data`: `{ hasNext, lastCursor, calendars: [{ calendarName, calendarSrno, calendarType, calendarPermission, userId, fullname, responsibility, profileImagePath, email }] }`

### 8.5 `GET /user/calendars/events/{eventSrno}` — 일정 상세 ⭐

Path: `eventSrno` (숫자). Query: `eventStartDateTime`, `eventFinishDateTime` (반복 인스턴스 지정용, 14자리)

> **사용처**: 나의 일정 서랍·시트에서 **줄을 펼칠 때만** 부른다 (`getEvent` → `loadEvent` → `EventRow`, v4.5.0). 일정 한 건에 호출 한 번이라 미리 안 받는다.

응답 `data.event` = 8.2의 필드 + `location`, `locationCoordinates`, `locationUrl`, `calendarOwner`, `calendarType`, `userPermission`, `vcSrno`, `contentModifiability`, `rgsrId`, `rgsrNm`, `rgsnDateTime`, `prflPhtg`, `originSrno`, 그리고 아래 배열들:

| 배열 | 아이템 |
|---|---|
| `attendances[]` | `attendanceType`, `attendanceInfo`, `attendanceStatus`, `attendanceName`, `attendanceProfile` |
| `notifications[]` | `notificationSrno`, `notificationType`(`CHATBOT` 등), `notificationTime`(분) |
| `repeatEvents[]` | `repeatSrno`, `repeatType`(`WEEKLY` 등), `repeatPeriod`, `repeatCount`, `repeatDays`(`"MO,WE,FR"`), `endDateTime` |
| `attachments[]` | `atchSrno`, `fileDownUrl`, `fileNm`, `fileSize`, `randKey`, `imgPath`, `thumImgPath` |
| `vcRecords[]` | `vcSrno`, `vcTtl`, `videoOrg`(`GOOGLE_MEET` 등), `vcStartDateTime`, `vcEndDateTime`, `vcRgsnDateTime` |

**실측 채움률** (2026-08-04, ±180일 창의 일정 8건 전량):

| 필드 | 채움 | 비고 |
|---|---|---|
| `attendances[]` | 8/8 | 4~11명. `attendanceName`만 쓴다 — `attendanceProfile`은 `platform.bizplay.co.kr` 호스트라 `next.config.ts` 허용 목록 밖이다 |
| `rgsrNm`·`rgsrId`·`prflPhtg`·`rgsnDateTime` | 8/8 | 만든 사람 |
| `repeatEvents[]` | 5/8 | `WEEKLY` / `repeatPeriod: "1"` / `repeatDays: "FR"` / `endDateTime: "20260904000000"`. **`repeatCount`는 늘 빈 문자열** |
| `eventBody` | 3/8 | **목록(8.2)에서는 8/8 빈 문자열이다** — 설명은 상세에만 있다. 상세를 부르는 주된 이유 |
| `colaboSrno`·`colaboCommtSrno`·`originSrno` | 3/8 | 목록 응답에도 그대로 온다 — 이것만 쓰면 상세를 안 불러도 된다 |
| `location` | 1/8 | `locationUrl`·`locationCoordinates`는 0/8 |
| `notifications[]`·`attachments[]`·`vcRecords[]`·`vcSrno` | 0/8 | 우리 기관이 안 쓴다. `vcRecords`에는 회의 링크 필드 자체가 없다(`vcSrno`/`vcTtl`/`videoOrg`/시각뿐) |
| `eventColor`·`customCalendarName`·`repeatSrno`(최상위)·`attendanceStatus`(최상위) | 0/8 | 최상위 `attendanceStatus`는 상세에서 비어 온다 — **내 참석 응답은 목록(8.2) 값만 믿는다** |

### 8.6 쓰기 계열 (미사용)

`POST /user/calendars/events`, `PATCH /user/calendars/events/{eventSrno}`, `DELETE /user/calendars/events/{eventSrno}`

---

## 9. Search API

> 9.1·9.2는 **검색 팔레트(⌘K)가 실제로 쓰는 두 호출**이다 (PRD §6.4, v0.19).
> 9.3은 **구성원 화면이 쓴다** (PRD §6.6, v1.5.0). 9.4는 참고용이다.

### 9.1 `GET /user/search/posts` — 게시글 검색 ⭐

**Query**

| 이름 | 타입 | 필수 | 기본 | 제약 |
|---|---|---|---|---|
| `searchWord` | string | ✓ | | 1~100자 |
| `startDateTime` | string | | 최근 6개월 시작일 `000000` | `YYYYMMDDHHmmss` |
| `endDateTime` | string | | 오늘 `235959` | `YYYYMMDDHHmmss` |
| `orderType` | string | | `SCORE` | `SCORE` \| `LATEST` \| `OLDEST` |
| `size` | string | | `20` | 1 이상 |
| `score` | string | | | **`pageTargetId` 와 쌍으로만** 사용 (다음 페이지) |
| `pageTargetId` | string | | | `score` 와 쌍 |
| `projectIds` | string | | | 숫자 콤마 |
| `registerIds` / `workerIds` / `participantIds` | string | | | userId 콤마 |
| `templateTypes` | string | | | 0 이상 숫자 콤마. `-1` 불가 |

> 검색은 **커서가 아니라 `score` + `pageTargetId` 조합**으로 페이징한다.

**응답 `data`**: `{ hasNext, score, pageTargetId, posts: [...] }`
`posts[]`: `ttl`(**프로젝트 제목**), `commtTtl`(**게시글 제목**), `content`, `templateType`, `projectId`, `postId`, `remarkSrno`, `replySrno`, `registerId`, `registerName`, `registeredDateTime`, `taskState`

> 필드명이 다른 API와 다르다 (`ttl` / `commtTtl`). 검색 API만 내부 컬럼명을 그대로 쓴다.

> **하이라이트 `(실측 2026-07-29)`**: 맞은 자리를 `!#!…!#!`로 감싸 온다 — `commtTtl`과
> `content` 둘 다다 (`ttl`도 프로젝트명이 걸리면 감싼다). 형태소 단위로 끊겨서
> (`[bzp!#!출장!#!]`) 화면에서 다시 찾을 수 없는 정보다. 그리는 쪽은 이 마커를 쪼개고,
> 안 쓰는 쪽은 `stripHighlight`로 지운다 (`lib/flow/search.ts`).

> **MCP로는 안 된다**: `flow_search`가 주는 `title`은 **프로젝트** 제목이다 (`ttl` 쪽).
> 게시글 제목(`commtTtl`)에 해당하는 필드가 응답에 없다 — 검색 팔레트가 REST를 쓰는 이유다.

### 9.2 `GET /user/search/projects` ⭐

Query: `searchWord`*, `startDateTime`, `endDateTime`, `orderType`, `size`, `score`+`pageTargetId`, `participantIds`
응답 `data.projects[]`: `projectId`, `ttl`, `homeTabCode`, `backgroundColorCode`, `importantYn`, `participantCount`, `editedDateTime`, `participants[]{userId, userName}`

> **프로젝트 딥링크는 없다 `(실측 2026-07-29)`**: 이 응답에도, 상세(§5.3)에도 링크가 없다 —
> 상세의 링크성 값은 `INVT_URL`(`https://flow.team/Invitation/…`, 초대 URL) 하나다. MCP
> `flow_search_project`의 `url`도 `https://flow.team/main.act?projectId=…`를 조립해 준다.
> 그 URL은 세션이 없으면 `signin.act?why=no-session&from=ssr-helper`로 대상을 잃는다
> (게시글의 `connectUrl`에 해당하는 짝이 프로젝트에는 없다 — §6.3, BUG-024).

### 9.3 `GET /user/search/employees`

Query: `searchWord`(≤100), `divisionCode`, `cursor`, `pageSize`(1~100), `roomId`, `keyword`(`type:value` 공백 구분, 예 `user_nm:홍길동 dvsn_nm:개발`), `groupCode`, `employeeType`, `projectId`
응답 `data`: `{ hasNext, lastCursor, employees[] }` — `flowUserYn`, `portalId`, `channelId`, `institutionId`, `userId`, `profileImagePath`, `fullname`, `responsibility`, `responsibilityName`, `companyName`, `divisionName`, `phoneNumber`, `phoneCountryCode`, `companyPhoneNumber`, `email`, `status`, `bookmarkYn`, `loginYn`, `dayoffName`, `chargeJobName`, `employeeNumber`, `divisionCode`, `groupCode`

> **`slogan`이 더 온다 `(관측)`.** 스펙 목록에 없는데 응답에 있다 (2026-07-31, 13명 중 2명이 채움).
> 본인이 적은 한 줄이고 구성원 화면과 계정 팝오버(PRD §7.3)가 쓴다. 스펙에 없으니 선택 필드로
> 다룬다.
>
> **`searchWord`는 이름만 본다 `(관측)`.** 이메일을 넣으면 **0명**이 온다 (2026-07-31, 오류도
> 경고도 없이 빈 배열이다). `이종석` → 1명. 그래서 자기 한 줄만 받을 때도 검색어는 이름을 넣고,
> 받은 줄에서 `email`로 고른다 — 동명이인이 섞여 올 수 있다 (`loadMyAccount`).
>
> **검색어에 요청 값을 넣지 않는다.** 공용 API 키로 부르는 전 직원 검색이라 남의 이름을 넣어도
> 통한다. `searchEmployees(sessionSearchWord?)`의 인자는 **세션 값만** 받는다 (PRD §6.6·§8.1).
>
> **`profileImagePath`의 호스트가 셋이다 `(관측)`** — `lh3.googleusercontent.com`(구글 로그인
> 아바타) · `flow.team` · 회사 서브도메인 `traport.flow.team`. `next/image`로 그리려면 셋 다
> 허용해야 한다.
>
> §3.2 `/user/employees`와 다른 응답이다: 사진은 여기에만 있고, 회사전화는 그쪽이 더 많이 준다.

### 9.4 `GET /user/search/events`

Query: `searchWord`*(2~100), `startDateTime`*, `endDateTime`*, `cursor`, `pageSize`(1~200), `pagingReverse`(`Y`\|`N`, 기본 `N`)
응답 `data`: `{ hasNext, lastCursor, events[] }` — `calendarName`, `customCalendarName`, `calendarRole`, `eventSrno`, `calendarSrno`, `eventName`, `eventStartDateTime`, `eventFinishDateTime`, `allDayYn`, `timezone`, `gmtTime`, `calendarColor`, `eventColor`, `publicYn`, `publicNameYn`, `privateYn`, `attendanceSrno`, `attendanceInfo`, `attendanceStatus`, `originSrno`

> **나갈 링크를 만들 수 없다.** 목록(§8.2)과 달리 `colaboSrno`가 없다 — flow 일정 주소가
> 요구하는 값이라 여기 결과만으로는 URL을 조립하지 못한다. 검색 팔레트의 일정 줄이 안 눌리는
> 정보 줄인 이유다 (PRD §6.4).
>
> **기간이 필수다.** `startDateTime`·`endDateTime`이 없으면 부를 수 없다. 팔레트는 `YYYYMMDDHHmmss`로
> **−90일 000000 ~ +180일 235959**를 넣는다.
>
> **달력 이름은 두 칸이다.** `customCalendarName`이 있으면 그쪽이 사람이 붙인 이름이고, 없으면
> `calendarName`으로 떨어진다. 달력이 하나뿐인 사람은 자기 이름이 온다.

---

## 10. 문서 vs 실제 응답 차이 `(관측)`

인증된 실제 워크스페이스 응답과 공식 문서 예시가 어긋나는 지점. **구현은 실제 쪽을 따라야 한다.**

| 필드 | 문서 예시 | 실제 관측값 | 영향 |
|---|---|---|---|
| `templateType` (업무) | `"1"` / `"2"` | `"92"` | 템플릿 타입으로 업무를 걸러내는 로직이 조용히 0건을 반환한다 |
| `taskStatus` | `"REQUEST"` | `"901659"` (optionSrno) | 문자열 enum 비교가 전부 실패한다. 5.6으로 해석 필요 |
| `rangeType` | `"ALL"` | `"A"` | 공개범위 비교 로직 주의 |
| `cursor` 의미 | 명시 없음 | 오프셋 아님, **페이지 인덱스** | `cursor=pageSize*n` 로 계산하면 2페이지부터 빈 응답이 온다 — 오류도 경고도 없다 ([BUG-030](bug-report.md#bug-030)) |
| 미설정 날짜/수치 | 명시 없음 | `null` 이 아니라 `""` | `?? 기본값` 이 동작하지 않는다. falsy 체크 필요 |

---

## 11. 미확인 사항 정리

| 항목 | 왜 확인 못 했나 | 대응 |
|---|---|---|
| `tasks/filter` 응답의 `columns[]` 아이템 스키마 | 스펙에 `data: []` (빈 정의). 인증 없이는 실제 응답을 볼 수 없음 | 6.1의 두 후보를 모두 파싱하는 방어적 코드 |
| `groupAggregates[]` 아이템 스키마 | 동일 | 사용하지 않음 |
| `WORKER_REC[]` 아이템 스키마 | 관측한 업무들이 모두 담당자 미지정 | `(추정)` 형태로 타입 정의, 런타임 검증 |
| `filterRecords` 의 `OPERATOR_TYPE` 전체 목록 | 문서에 `IN` 만 예시. 다른 연산자 미공개 | 서버 필터 대신 클라이언트 필터 |
| `GET /user/posts/{postId}` 의 10개 "원본 목록" 아이템 스키마 | 스펙에 정의 없음 | `tasks[]` 만 2.2로 관측 확보, 나머지는 `unknown[]` |
| `GET /user/projects/{id}` 의 `PROJECT_COLUMN_REC` 등 8개 배열 | 스펙에 정의 없음 | 5.5 / 5.6 의 camelCase API로 우회 |
| ~~레이트 리밋 수치~~ | **해소.** 429 본문이 임계값을 그대로 적어 준다 — `"분당 최대 요청가능 횟수: 120"` (실측 2026-08-04) | 업무 조회 300초 캐시 + 실패한 프로젝트를 화면에 밝힘 |
| `/user/*` 가 베타 플랜에서 열려 있는지 | 인증 토큰 없이 확인 불가 | `BETA_API_ACCESS_DENIED_ERROR` 를 별도 처리 |
| 응답 타임존 | 문서 언급 없음 | 워크스페이스 로컬(KST) 가정 |

---

## 12. 오늘 화면의 실제 호출 순서 `(관측 2026-08-04, v4.0.0)`

> 이 절은 원래 "REST로 갈 경우"라는 폴백 설계였다. v4.0.0에서 MCP를 전부 걷어내고 이 순서가
> **실제 경로**가 됐다 (PRD §5.1). 아래 숫자는 59개 프로젝트 계정의 실측이다.

```
0. (로그인 시 1회) GET /user/employees/me          → userId·fullname·부서 → 세션 쿠키
1. GET /user/projects                              → 프로젝트 59개 (cursor 페이징, TTL 600초)
2. 프로젝트별 ×59 (동시 10, TTL 300초):
   GET /user/posts/projects/{id}/tasks/filter?pageSize=100
       &filterRecords=[{COLUMN_SRNO:1,OPERATOR_TYPE:IN,FILTER_DATA:<userId>}]
                                                   → 담당 업무. columns[]에서 마감일·상태·
                                                     담당자·등록자·EDTR_DTTM·PRIORITY를 뽑는다
                                                     (§6.1 "앱이 꺼내 쓰는 값")
   (프로젝트 컬럼 매핑 GET .../columns 는 같은 TTL로 캐시 — 실측 왕복 1회/프로젝트)
3. GET /user/alarms?filters=MENTION&days=7&size=100 → 멘션 → receiverId로 내 것만 남김
4. 멘션의 postId 중복 제거 ×≤12: GET /user/posts/{postId}
                                                   → 업무명·짧은 링크·상태
5. 포커스 상위 ≤8: GET /user/comments/{postId}     → 댓글 수 + 마지막 작성자
```

합계 ≈ 1 + 59 + 1 + 12 + 8 = **81회**. 여기에 헤더 알림 종과 일정이 얹혀 분당 상한 120에
바짝 붙는다 — 2단계에 5분 캐시를 거는 이유다. 그래도 넘치면 429로 떨어지는 프로젝트가 생기고,
그건 숨기지 않고 화면 아래에 이름으로 적는다 (`collectTasks`의 `failed`).

**날짜 필터를 서버에 안 건다.** `IN` 외 연산자가 미공개라(§11) 마감일·수정일 비교는 전량을
받아 클라이언트에서 한다. 대신 `EDTR_DTTM`이 업무마다 오므로 "며칠 손 안 댔나"에 상한이 없다.

---

## 13. Comments API `(관측 2026-07-28)` ⭐⭐

§0 의 번들 복원이 놓친 도메인이다. 파라미터 스키마는 번들에서 복원하지 않았고, 아래는 **실제 호출 응답을 직접 관측한 값**이다.

### 13.1 `GET /user/comments/{postId}` — 게시글 댓글 조회

**§6.3 `remarks` 의 한계(14건 중 2건)를 이 엔드포인트가 없앤다.** 같은 게시글에서 14건 전부 왔다.

**Path**: `postId` (숫자)
**Query**: `replyYn` 하나만 받는다 `(정정 2026-08-04)`. 나머지는 붙이는 즉시 `400 VALIDATION_ERROR "잘못된 query 형식입니다."` 다 (`lastCursor` · `cursor` · `size` · `pageSize` · `parentId` · `remarkId` · `replyId` · `depth` 전부). 응답이 `hasNext` / `lastCursor` 를 주지만 §1.4 커서 규약은 안 통한다 — 파라미터 없이 한 번에 다 온다.

> ### ⭐ `replyYn=Y` 가 답글을 같이 준다 `(실측 2026-08-04 — 앞선 기록 정정)`
>
> `GET /user/comments/{postId}?replyYn=Y` 를 부르면 `Comment` 마다 **`replies[]` 가 최대 10건**
> 붙고, 넘치면 `replyHasNext: true` 다. **추가 호출은 0회다.**
>
> ```jsonc
> { "commentId": "193905429", "contents": "…", "replyHasNext": false,
>   "replies": [ { "replyId": "6085136", "parentCommentId": "193905429",
>                  "contents": "총 6건", "registerId": "aiden.0603",
>                  "registeredDateTime": "20260803214457" } ] }
> ```
>
> **`Reply` 필드**: `replyId` · `parentCommentId` · `projectId` · `postId` · `contents` ·
> `registerId` · `registerInttId` · `registerName` · `registeredDateTime` · `editedDateTime` ·
> `encrypted` · `systemCode` · `language`. `Comment` 와 같은 모양인데 작성자 회사·부서
> (`registerCorpName` · `registerDivisionName`)와 `editorId` 가 없다.
>
> **정렬은 `replyId` 오름차순**이라 곧 시각순이다. 앱은 그래도 `registeredDateTime` 으로 다시
> 세운다 — 부모 댓글끼리 시각순, 답글은 자기 부모 바로 뒤 (`toThread`).
>
> **이전 기록(2026-08-03)은 틀렸다.** "답글을 읽는 경로가 없다 · 후보 28개 전패 · `replyYn` 은
> 무반응"이라고 적어 뒀는데, `replyYn=Y` 는 그때도 `200` 이었고 응답에 `replies` 가 실려 있었다 —
> **응답의 새 필드를 안 보고 최상위 키만 비교했다.** 실측 게시글 82396719 는 댓글 4건 중 3건에
> 답글이 달려 있었고, 그 대화가 화면에서 통째로 빠져 있었다 ([BUG-042](bug-report.md#bug-042)).
>
> 아래는 그 잘못된 기록이 남긴, **지금도 유효한 사실**이다.
>
> | 사실 | 상태 |
> |---|---|
> | `replyYn` 없이 부르면 최상위 댓글만 온다 | 유효. `comments` 길이 = `remarkCount` — **둘 다 최상위만 센다** |
> | 답글 **쓰기** 경로는 없다 | 유효. `POST …/replies/{commentId}` 는 `404`, `POST /user/comments/{postId}` Body 는 `{ contents }` 뿐 (§13.2) |
> | `remarkCount` · `remarks[].REPLY_CNT` 는 답글을 안 센다 | 유효 (§8.2) |
> | id 공간이 다르다 | 유효. `commentId`(9자리) ≠ `replyId`(7자리). §7.1 알림의 `remarkId` 는 **부모 댓글** id다 |
> | 알림으로 답글을 복원하는 건 못 쓴다 | 유효하지만 **이제 필요 없다**. (나를 멘션한 답글만 오고, 본문이 정확히 100자에서 잘린다 — 실측 49건 중 20건이 문장 중간) |

**응답 `data`**: `{ hasNext: boolean, lastCursor: number, comments: Comment[] }`

`Comment` — 실측 관측 키 전량:

| 필드 | 예시 | 설명 |
|---|---|---|
| `commentId` | `"191620030"` | 댓글 ID. §7.1 알림의 `remarkId` 와 같은 공간 `(추정)` |
| `projectId` / `postId` | | |
| `contents` | | 본문. **`@[이름](id)` 멘션 마크업이 그대로 온다** — 알림(§7.1 `content`)은 걷어서 주는데 여기는 안 걷는다. 표시 전에 벗겨야 한다 |
| `systemCode` | `"S41^^'서동조','김승호'@$%S48^^2026-07-16@$%S49^^1@$%"` | **`^^` 가 있으면 변경 로그다.** 값 없는 맨 코드(`S13`·`S14`·`S20`)는 사람 댓글이다 — 아래 별도 설명 |
| `registerId` / `registerName` | `"hong67"` / `"홍성우"` | 작성자 |
| `registerInttId` | `"UTLZ_226"` | 작성자 이용기관 — **타사 사용자 판별에 쓸 수 있다** (§3.1 내 `inttId` 와 비교) |
| `registerCorpName` / `registerDivisionName` | `"비즈플레이B2E부문"` / `"BZP사업본부"` | 작성자 회사·부서. 다른 API는 안 준다 |
| `registeredDateTime` / `editedDateTime` | `"20260715193510"` | |
| `registerProfilePhoto` | `""` | |
| `encrypted` | `"Y"` | |
| `editorId` / `editorName` | `null` | **`null` 이 온다** — §10 의 "미설정은 `""`" 규칙에 예외가 있다 |
| `objectContentsName` / `repeatDateTime` / `repeatId` / `language` | `null` | |
| `replies` | `Reply[]` | **`replyYn=Y` 일 때만.** 최대 10건, `replyId` 오름차순 (위 블록) |
| `replyHasNext` | `false` | **`replyYn=Y` 일 때만.** 답글이 10건을 넘으면 참 → §13.3 |

> **⚠️ 이 표에 파일 칸이 없다 `(실측 2026-08-06)`.** 댓글에 첨부가 달려 있어도 이 엔드포인트는
> 그 사실조차 안 준다 — `replyYn=Y` 를 붙여도 `Reply` 쪽에도 없다. 댓글 첨부를 아는 자리는
> §6.3 `remarks[].REMARK_ATCH_REC` · `REMARK_IMG_ATCH_REC` 뿐이고, 거기는 **최신 2건 상한**이
> 걸려 있다 ([BUG-050](bug-report.md#bug-050)). 즉 **댓글 전량과 댓글 첨부를 동시에 받는 길이
> 없다** — 앱은 전량은 여기서, 첨부는 §6.3 에서 받아 댓글 번호로 붙인다.

> **`systemCode` 를 안 거르면 "마지막 댓글"이 사람 말이 아니다.** 실측 14건 중 **10건이 시스템
> 댓글**(담당자·마감일·우선순위 변경 로그)이고 사람 댓글은 4건뿐이었다.
>
> **다만 `truthy` 로 거르면 사람 댓글까지 버린다** (BUG-035). 게시글 6건·댓글 148건을 다시 찍으니
> `systemCode` 가 채워진 것이 56건인데 그중 상당수가 **본문이 있는 사람 댓글**이었다. 갈림길은
> 구분자다 — 변경 로그는 늘 `코드^^값` 꼴이고, 값 없는 맨 코드는 사람 댓글에 붙는 꼬리표다.
>
> | `systemCode` | 정체 | 판별 |
> |---|---|---|
> | `"S48^^2026-07-16@$%"` · `"S45^^0^^1"` | 변경 로그 | `^^` 있음 |
> | `"S13"` · `"S14"` · `"S20"` | 사람 댓글 (본문 있음) | `^^` 없음 |
> | `""` · `null` | 사람 댓글 | — |
>
> 그래서 판별은 `systemCode?.includes("^^")` 다 (`isChangeLog`, `src/lib/flow/rest.ts`).
>
> 반대로 **변경 로그 자체가 업무 변경 이력**이다. 뜻이 확정된 코드: `S41`(담당자 — `S41^^'김동석'@$%`) ·
> `S48`(마감일) · `S49`(우선순위). 값만 찍힌 코드: `S45`(`S45^^0^^1`) · `S47`(`S47^^2026-07-29`) ·
> `S83`(`S83^^이성우` — 상단고정) — **뜻 미확정**이라 표시에 쓰지 않는다. 구분자는 필드 `^^` ·
> 항목 `@$%`. 전체 코드표는 미확인이고, `registeredDateTime` 만 봐도 "최근 활동 시각"으로는 충분하다.

### 13.2 `POST /user/comments/{postId}` — 게시글 댓글 작성 `(실측 2026-08-04 · 멘션 2026-08-06)`

**Body는 `contents` 하나가 전부다.**

```json
{ "contents": "댓글 본문" }
```

| 필드 | 필수 | 설명 |
|---|---|---|
| `contents` | ✅ | 본문. `content`가 아니다 — 오타를 내면 빈 댓글이 달린다 |

**응답 `data`**: `{ projectId, postId, commentId }` — 방금 단 댓글의 번호다. 앱은 이걸 버리고
목록을 통째로 다시 부른다 (`listComments`는 TTL 없이 `no-store`라 항상 새 것이 온다).

경로에 `postId` 하나뿐이라 `projectId`는 필요 없다. 다만 우리 화면이 들고 있는 건 `taskSrno`라
그걸 `postId`로 바꿔서 넘긴다 ([BUG-005](bug-report.md#bug-005) — §6.1 응답의 `postId`를 쓰거나
`resolvePostId`로 푼다).

> **멘션 마크업이 통한다** `(실측 2026-08-06 · 게시글 82343667)`. `contents`에
> `@[이종석](jongseok.lee@traport.com) 본문` 을 그대로 넣어 POST 하면
> (`{"commentId":"194266930"}` 응답) 서버가 이걸 **flow 화면의 멘션과 같은 프로필 앵커로
> 파싱해서 저장한다** — §8.2 `remarks[].CNTN`을 다시 읽으니
> `<a … onClick="fn_profile('jongseok.lee@traport.com');" profile-data='…'>이종석</a> 본문` 이었다.
> flow UI가 직접 단 멘션과 구분되지 않는다.
>
> 괄호 안 id는 **사내 이메일**(`jongseok.lee@traport.com`) 또는 **짧은 flow id**(`ymh0510`)
> 둘 다 받는다 — 같은 게시글에 두 꼴이 섞여 있었다. 앱은 §6.1 참여자 목록의 `userId`를
> 그대로 쓴다 (`mentionMarkup` · `toMentions`, `src/lib/thread.ts`).
>
> **알림 발송은 직접 못 봤다.** 알림 조회(§7.1)의 `receiverId`가 API 키 주인으로 고정이고
> flow는 자기 자신 멘션에 알림을 안 만든다 — 남의 알림함은 관측할 수 없다. 저장 형태가
> flow UI 멘션과 같으니 알림도 같이 갈 것으로 본다 `(추정)`.

> **답글은 못 쓴다** `(v4.0.0 · 재확인 2026-08-06)`. 부모 댓글을 가리키는 필드가 Body에 아예
> 없고, 답글 전용 `POST /user/comments/{postId}/replies/{commentId}` 도 `404 NOT_FOUND_ERROR` 다
> (읽기는 같은 경로로 `200` — §13.3). 그래서 답하기는 **`@[이름](id) 본문` 꼴의 최상위 댓글**로
> 나간다 (`createComment`) — 위 실측 덕에 v4.14.0부터 글자가 아니라 진짜 멘션이다.
>
> 2026-08-06 재확인에서 문 세 개를 다시 밀어 봤다: `POST …/replies/{commentId}` `404` ·
> `POST …/reply/{commentId}` `404` · `POST /user/comments/{postId}` Body에 `replyToRemarkId`를
> 실으면 `400 VALIDATION_ERROR` `unrecognized_keys`. Body가 받는 건 `contents` 하나뿐이다.
>
> 읽기가 열린 v4.2.0부터는 **남긴 답이 목록에 한 층 위로 뜬다** — 남이 flow에서 단 답글은
> 부모 아래 들여쓰여 오는데, 앱이 올린 것은 최상위 댓글이라 맨 아래 붙는다. 대화 자체는
> 안 사라지므로 그대로 둔다. v4.15.1부터는 **답글 쓰는 칸 위에 그 사실을 적는다** — 스레드로
> 붙는다는 기대를 안 만드는 게 사용자가 아는 유일한 방법이다.
>
> 댓글 **수정·삭제**는 REST에 없다. `DELETE /user/comments/{postId}/{commentId}` ·
> `DELETE /user/comments/{commentId}` 둘 다 `404 NOT_FOUND_ERROR` (실측 2026-08-06).
> flow 화면에서 한다.
>
> **`editedDateTime`은 안 고친 댓글에도 온다** — `registeredDateTime`과 **같은 값**이다
> (실측 2026-08-06). "수정됨" 표시는 둘이 다를 때만 낸다 (`toThread`).

### 13.3 `GET /user/comments/{postId}/replies/{commentId}` — 답글 조회 `(실측 2026-08-04)` ⭐

**§13.1 의 `replyYn=Y` 가 답글 10건까지는 이미 준다.** 이 엔드포인트는 그 위, 즉
`replyHasNext: true` 인 댓글의 나머지를 받는 자리다.

**Path**: `postId` · `commentId` (**부모 댓글** id — `replyId` 가 아니다)
**Query**: `cursor` (기본 `0`) · `size` (기본 `100`, `1`~`100`)
**권한**: 부모 댓글이 속한 게시글 단건 조회 권한과 같다. `userId` 는 안 넘긴다 — 서버가
`x-flow-api-key` 의 사용자를 쓴다.

**응답 `data`**: `{ hasNext: boolean, lastCursor: number, replies: Reply[] }` — `Reply` 는
§13.1 의 `replies[]` 와 같은 모양이고 정렬도 같다 (`replyId` 오름차순). `hasNext` 가 참이면
`lastCursor` 를 다음 요청의 `cursor` 로 쓴다 (§1.4 커서 규약 — 여기서는 통한다).

> **앱은 `replyHasNext` 인 댓글에만 부른다** (`fillReplies` — `src/app/(app)/actions.ts`).
> 실측에서 참인 댓글을 아직 못 봐서 보통은 호출이 0회다. 한 장(`size=100`)만 받는다 —
> 댓글 하나에 답글 100건이 넘으면 그때 커서를 돌면 된다.

---

## 14. Drive API `(관측 2026-07-28)`

| 메서드 | 경로 | 용도 |
|---|---|---|
| GET | `/user/drive/files/search` | 파일 통합검색 |
| POST | `/user/drive/files/presigned-put` | 업로드 Presigned URL 발급 |
| POST | `/user/drive/files/finalize` | 업로드 완료 |

### 14.1 `GET /user/drive/files/search`

**Query**: `searchWord` (실측에서 이 이름으로 200). 나머지 미확인.
**응답 `data`**: `{ files: [], total: 0 }` — 봉투는 확인, **아이템 스키마는 미확인**.

> **실측 결과가 0건이다.** `searchWord=요건` · `searchWord=개발` 둘 다 `total: 0`. 엔드포인트는
> 열려 있는데(200, 플랜 오류 아님) 이 계정에서 검색되는 파일이 없다. 검색 범위가 개인 드라이브
> 한정인지, 사내가 flow 드라이브를 안 쓰는지는 구분하지 못했다.

업로드 2종은 프로젝트 비목표(파일 첨부는 flow에서 한다 — PRD §3)라 확인하지 않았다.

---

## 15. Wiki API `(관측 2026-07-28)`

| 메서드 | 경로 | 용도 |
|---|---|---|
| POST | `/user/wiki/document` | 위키 문서 생성 |
| GET | `/user/wiki/document/{docId}` | 위키 문서 콘텐츠 조회 |
| PATCH | `/user/wiki/document/{docId}` | 위키 문서 콘텐츠 수정 |
| PATCH | `/user/wiki/document/{docId}/title` | 위키 문서 제목 수정 |
| GET | `/user/wiki/search` | 위키 문서 검색 |
| GET | `/user/wiki/children` | 최상위 위키 폴더/문서 목록 |
| GET | `/user/wiki/children/{targetId}` | 직속 자식 폴더/문서 목록 |

**위키만 규약이 다르다 — 이게 이 도메인의 가장 중요한 관측이다.**

| 항목 | 다른 도메인 (§1) | 위키 |
|---|---|---|
| 페이지네이션 | `cursor` + `hasNext` / `lastCursor` | **`pagination: { page, limit, total, totalPages, hasMore }`** — `page`/`limit` 방식 |
| 성공 메시지 | `"success"` | `"요청이 성공했습니다."` |
| `children` 응답 | 객체 | **배열 그대로** (`data: []`) |

§1.4 가 "`page`/`limit` 이 아니라 커서"라고 못 박았는데, 위키는 그 예외다. 나중에 붙인 도메인으로 보인다 `(추정)`.

**실측 응답**

```jsonc
// GET /user/wiki/children
{"response":{"success":true,"code":200,"message":"요청이 성공했습니다.","data":[]}}

// GET /user/wiki/search?searchWord=회의
{"response":{"success":true,"code":200,"message":"요청이 성공했습니다.",
  "data":{"documents":[],"tags":[],
          "pagination":{"page":1,"limit":20,"total":0,"totalPages":0,"hasMore":false}}}}
```

> **여기도 0건이다.** 최상위 목록도 검색도 비었다. 문서 아이템 스키마는 그래서 못 봤다.
> 엔드포인트는 200으로 열려 있으니 **플랜 문제는 아니고 콘텐츠가 없는 것**이다 — 사내가 flow
> 위키를 안 쓴다는 신호로 읽는다 (PRD §13 Tier C 근거).
