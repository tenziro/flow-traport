# flow REST API 스펙 (`/user/*` 네임스페이스)

> **표기 규칙**
> - 표기 없음 = **확인된 사실**. flow 공식 개발자 문서(`https://api.flow.team/docs`)의 스펙 원본에서 그대로 추출했거나, 인증 없는 실제 호출로 응답을 직접 관측한 내용.
> - `(추정)` = 문서에 정의가 없어 다른 근거(실제 응답 관측, 유사 API 패턴, 네이밍 규칙)로 추론한 내용. **구현 시 반드시 런타임 검증 필요.**
> - `(관측)` = 공식 문서에는 없지만 인증된 실제 flow 워크스페이스 응답에서 직접 확인한 값. 문서보다 실제에 가깝지만 표본이 적음.

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
| `TASK_REPORT_RECORD` | array | 업무 리포트 — 아이템 스키마 없음 |
| `CUSTOM_STATUS_TASK_REPORT_RECORD` | array | 커스텀 상태 업무 리포트 — 아이템 스키마 없음 |
| `JOIN_APPLY_RECORD` | array | 참여 신청 — 아이템 스키마 없음 |

`PROJECT_SETTING[]` 아이템: `COLABO_SRNO`*(프로젝트 ID), `TTL`*(제목), `CNTN`(설명), `USE_INTT_ID`(이용기관 ID), `SENDIENCE_CNT`(참여자 수), `OPEN_YN`, `HOME_TAB_CODE`(예 `FEED`), `STATUS`, `RGSN_DTTM`, `RGSR_ID`, `RGSR_NM`.

> **왜 배열인가**: OpenGate 관례상 단건도 1-element 배열로 감싼다. `PROJECT_SETTING[0]` 을 쓰면 된다 `(추정)`.

### 5.4 `GET /user/projects/{projectId}/participants` — 프로젝트 참여자

**Path**: `projectId` (string, 필수, 숫자, 1~15자)
**응답 `data.participants[]`**: `inttId`*, `userId`*, `name`*
**에러 추가**: `NOT_EXISTS_ERROR / 프로젝트가 존재하지 않습니다.`

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
| `cursor` | string | | `0` | 0 이상 숫자. 0-based 페이지 커서 |
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
| `defaultColumnType` | `"END_DT"` | **의미를 정하는 필드.** 실측: `WORKER_ID`(담당자) · `TASK_NM`(업무명) · `STTS`(상태) · `END_DT`(마감일) · `RGSR_ID`(등록자) |
| `columnData` | | 값 배열. 담당자처럼 여러 명이면 원소가 여럿이다 |

`columnData[]` 아이템:

| 필드 | 예시 | 설명 |
|---|---|---|
| `customColumnData` | `"20260430"` | **실제 값.** 마감일은 `YYYYMMDD`, 상태는 코드(`"4"`), 담당자는 이메일/아이디, 업무명은 문자열 |
| `userName` | `"이종석"` | `USER` 컬럼일 때 실명 |
| `profilePhoto` | `https://flow.team/flowImg/…` | `USER` 컬럼일 때 프로필 |
| `optionName` | `"PAST"` | `DATE`에서 `PAST`면 마감 지남 |
| `optionCategory` | `"1"` | `STTS`에서 상태 그룹 |
| `optionColor` · `customColumnDataId` · `columnType` | `""` | 실측에서 대부분 비어 있다 |

> **상태 코드 대응표** `(실측 2026-07-29 — 위 "아직 없다"를 정정한다)`. `STTS` 컬럼은 `optionName`이 항상 빈 문자열이고 `customColumnData`에 코드만 온다. 코드 의미는 `flow_get_post` 시스템 댓글의 상태 변경 기록으로 확정했다 — `SYS_CODE:"S45^^<이전>^^<이후>"` 형식에 사람 말 문구가 붙어 온다.
>
> | 코드 | 라벨 | `optionCategory` | 근거 |
> |---|---|---|---|
> | `0` | 요청 / **대기** | `"0"` | `S45^^0^^2` = "'요청' → '완료'". **flow가 두 이름을 쓴다** — 시스템 댓글은 `요청`, MCP 워크리스트는 `대기`다(`flow_get_my_worklist` 설명의 "base 상태(대기/진행)"). 화면 배지는 **`대기`** 로 쓴다: 다른 카드가 전부 MCP 라벨을 그대로 그려서, 같은 업무가 카드마다 다른 이름으로 보이면 안 된다 ([BUG-028](bug-report.md#bug-028)) |
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
| `templateType` | 문서 `"1"` / **실제 `"92"` `(관측)`** | 템플릿 타입 (업무/일정/할일/일반 구분) |
| `registerName` | `"홍길동"` | 작성자 이름 |
| `registeredDateTime` | `"20260509093000"` | 작성일시 |
| `projectTitle`, `title` | | |
| `content`, `htmlContent` | | 본문 / HTML 본문 |
| `remarkCount` | `"2"` | 댓글 수 |
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
| `remarkCount` | string | ✓ | 댓글 수 |
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

### 8.5 `GET /user/calendars/events/{eventSrno}` — 일정 상세

Path: `eventSrno` (숫자). Query: `eventStartDateTime`, `eventFinishDateTime` (반복 인스턴스 지정용, 14자리)

응답 `data.event` = 8.2의 필드 + `location`, `locationCoordinates`, `locationUrl`, `calendarOwner`, `calendarType`, `userPermission`, `vcSrno`, `contentModifiability`, `rgsrId`, `rgsrNm`, `rgsnDateTime`, `prflPhtg`, `originSrno`, 그리고 아래 배열들:

| 배열 | 아이템 |
|---|---|
| `attendances[]` | `attendanceType`, `attendanceInfo`, `attendanceStatus`, `attendanceName`, `attendanceProfile` |
| `notifications[]` | `notificationSrno`, `notificationType`(`CHATBOT` 등), `notificationTime`(분) |
| `repeatEvents[]` | `repeatSrno`, `repeatType`(`WEEKLY` 등), `repeatPeriod`, `repeatCount`, `repeatDays`(`"MO,WE,FR"`), `endDateTime` |
| `attachments[]` | `atchSrno`, `fileDownUrl`, `fileNm`, `fileSize`, `randKey`, `imgPath`, `thumImgPath` |
| `vcRecords[]` | `vcSrno`, `vcTtl`, `videoOrg`(`GOOGLE_MEET` 등), `vcStartDateTime`, `vcEndDateTime`, `vcRgsnDateTime` |

### 8.6 쓰기 계열 (미사용)

`POST /user/calendars/events`, `PATCH /user/calendars/events/{eventSrno}`, `DELETE /user/calendars/events/{eventSrno}`

---

## 9. Search API

> 9.1·9.2는 **검색 팔레트(⌘K)가 실제로 쓰는 두 호출**이다 (PRD §6.4, v0.19). 9.3·9.4는 참고용이다.

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

### 9.4 `GET /user/search/events`

Query: `searchWord`*(2~100), `startDateTime`*, `endDateTime`*, `cursor`, `pageSize`(1~200), `pagingReverse`(`Y`\|`N`, 기본 `N`)
응답 `data`: `{ hasNext, lastCursor, events[] }` — `calendarName`, `customCalendarName`, `calendarRole`, `eventSrno`, `calendarSrno`, `eventName`, `eventStartDateTime`, `eventFinishDateTime`, `allDayYn`, `timezone`, `gmtTime`, `calendarColor`, `eventColor`, `publicYn`, `publicNameYn`, `privateYn`, `attendanceSrno`, `attendanceInfo`, `attendanceStatus`, `originSrno`

---

## 10. 문서 vs 실제 응답 차이 `(관측)`

인증된 실제 워크스페이스 응답과 공식 문서 예시가 어긋나는 지점. **구현은 실제 쪽을 따라야 한다.**

| 필드 | 문서 예시 | 실제 관측값 | 영향 |
|---|---|---|---|
| `templateType` (업무) | `"1"` / `"2"` | `"92"` | 템플릿 타입으로 업무를 걸러내는 로직이 조용히 0건을 반환한다 |
| `taskStatus` | `"REQUEST"` | `"901659"` (optionSrno) | 문자열 enum 비교가 전부 실패한다. 5.6으로 해석 필요 |
| `rangeType` | `"ALL"` | `"A"` | 공개범위 비교 로직 주의 |
| `cursor` 의미 | 명시 없음 | 오프셋 아님, **페이지 인덱스** | `cursor=pageSize*n` 로 계산하면 데이터가 건너뛰어진다 |
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
| 레이트 리밋 수치 | `RATE_LIMIT_EXCEEDED_ERROR` 존재만 확인, 임계값 비공개 | 백오프 재시도 구현 |
| `/user/*` 가 베타 플랜에서 열려 있는지 | 인증 토큰 없이 확인 불가 | `BETA_API_ACCESS_DENIED_ERROR` 를 별도 처리 |
| 응답 타임존 | 문서 언급 없음 | 워크스페이스 로컬(KST) 가정 |

---

## 12. REST로 갈 경우의 호출 순서 `(추정 — 설계 제안)`

> **주의**: v1은 REST를 쓰지 않는다. flow OAuth 토큰이 REST에서 거부되고(400) MCP에서만 통하며, `/user/*` 는 인증 주체 고정이라 타인 조회가 불가능하기 때문이다 (PRD §5.1, §5.2). 아래는 폴백 설계로만 남긴다.

```
1. GET /user/employees/me                          → 내 userId
2. GET /user/projects                              → 프로젝트 전체 (59개, cursor 페이징)
3. 프로젝트별 (캐시 대상):
   GET /user/projects/{id}/columns                 → defaultColumnType → columnSrno 매핑
   GET /user/projects/{id}/columns/status          → optionSrno → 상태명/완료여부
4. 프로젝트별:
   GET /user/posts/projects/{id}/tasks/filter?pageSize=100&cursor=N
                                                   → 업무 전량, columns[] 에서 마감일/상태/진행률 추출
5. GET /user/alarms?filters=MENTION&readYn=N&size=100
                                                   → 멘션 → postId dedupe
6. (필요 시) GET /user/posts/{postId}              → editedDateTime = 최종 활동 시각
```

2단계가 59개 프로젝트를 한 번에 주고, 4단계가 프로젝트 수만큼 병렬 호출이 된다. 레이트 리밋 임계값이 비공개이므로 동시성 제한과 백오프가 필요하다.

---

## 13. Comments API `(관측 2026-07-28)` ⭐⭐

§0 의 번들 복원이 놓친 도메인이다. 파라미터 스키마는 번들에서 복원하지 않았고, 아래는 **실제 호출 응답을 직접 관측한 값**이다.

### 13.1 `GET /user/comments/{postId}` — 게시글 댓글 조회

**§6.3 `remarks` 의 한계(14건 중 2건)를 이 엔드포인트가 없앤다.** 같은 게시글에서 14건 전부 왔다.

**Path**: `postId` (숫자)
**Query**: 미확인. 응답이 `hasNext` / `lastCursor` 를 주므로 §1.4 커서 규약을 따를 것으로 보인다 `(추정)`. 실측에서는 파라미터 없이 14건이 한 번에 왔다.

**응답 `data`**: `{ hasNext: boolean, lastCursor: number, comments: Comment[] }`

`Comment` — 실측 관측 키 전량:

| 필드 | 예시 | 설명 |
|---|---|---|
| `commentId` | `"191620030"` | 댓글 ID. §7.1 알림의 `remarkId` 와 같은 공간 `(추정)` |
| `projectId` / `postId` | | |
| `contents` | | 본문. **`@[이름](id)` 멘션 마크업이 그대로 온다** — 알림(§7.1 `content`)은 걷어서 주는데 여기는 안 걷는다. 표시 전에 벗겨야 한다 |
| `systemCode` | `"S41^^'서동조','김승호'@$%S48^^2026-07-16@$%S49^^1@$%"` | **비어 있지 않으면 시스템 자동 댓글이다.** 아래 별도 설명 |
| `registerId` / `registerName` | `"hong67"` / `"홍성우"` | 작성자 |
| `registerInttId` | `"UTLZ_226"` | 작성자 이용기관 — **타사 사용자 판별에 쓸 수 있다** (§3.1 내 `inttId` 와 비교) |
| `registerCorpName` / `registerDivisionName` | `"비즈플레이B2E부문"` / `"BZP사업본부"` | 작성자 회사·부서. 다른 API는 안 준다 |
| `registeredDateTime` / `editedDateTime` | `"20260715193510"` | |
| `registerProfilePhoto` | `""` | |
| `encrypted` | `"Y"` | |
| `editorId` / `editorName` | `null` | **`null` 이 온다** — §10 의 "미설정은 `""`" 규칙에 예외가 있다 |
| `objectContentsName` / `repeatDateTime` / `repeatId` / `language` | `null` | |

> **`systemCode` 를 안 거르면 "마지막 댓글"이 사람 말이 아니다.** 실측 14건 중 **10건이 시스템
> 댓글**(담당자·마감일·우선순위 변경 로그)이고 사람 댓글은 4건뿐이었다. `systemCode` 가 truthy면
> 버리고 최신 사람 댓글을 골라야 한다.
>
> 반대로 **시스템 댓글 자체가 업무 변경 이력**이다. 관측한 코드: `S41`(담당자 변경) ·
> `S48`(마감일 변경) · `S49`(우선순위 변경). 구분자는 필드 `^^` · 항목 `@$%`. 전체 코드표는
> 미확인이고, `registeredDateTime` 만 봐도 "최근 활동 시각"으로는 충분하다.

### 13.2 `POST /user/comments/{postId}` — 게시글 댓글 작성

Body 스키마 미확인 (**쓰기라서 호출하지 않았다**). MCP `flow_create_comment` 는 `projectId` + `postId` 를 요구하는데 이쪽은 경로에 `postId` 하나다.

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
