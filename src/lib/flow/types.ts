/**
 * flow REST API (`/user/*`) 응답 타입.
 *
 * 출처: https://api.flow.team/docs 의 스펙 원본 + 인증 없는 실제 호출 관측.
 * 상세 근거와 파라미터 스펙은 `docs/api-spec.md` 참고.
 *
 * 규칙:
 * - 주석 없는 필드 = 공식 스펙에 정의된 확인된 필드.
 * - `@추정` 주석 = 문서에 정의가 없어 추론한 것. 런타임 검증 필요.
 * - `@관측` 주석 = 문서에 없지만 실제 응답에서 확인한 것.
 * - 스칼라는 거의 전부 문자열이다. `postId`, `progress`, `remarkCount` 모두 `"40001"`, `"80"` 형태.
 *   원시 타입인 것은 `hasNext`(boolean), `lastCursor`(number), `code`(number) 뿐.
 * - 미설정 값은 `null` 이 아니라 빈 문자열 `""` 로 온다. optional chaining/`??` 대신 falsy 체크.
 *
 * 의존성 없음 (pure type module).
 */

/* ────────────────────────────────────────────────────────────────────────────
 * 공통 봉투 / 페이지네이션 / 에러
 * ──────────────────────────────────────────────────────────────────────────── */

/** 모든 응답은 `response` 키로 한 겹 감싸져 있다. */
export interface FlowEnvelope<TData> {
  response: FlowSuccess<TData> | FlowFailure;
}

export interface FlowSuccess<TData> {
  success: true;
  /** HTTP status code */
  code: number;
  message: string;
  data: TData;
}

export interface FlowFailure {
  success: false;
  code: number;
  /** 관측값: `"DetailedError"`, `"invalid_token"`, `"error"`. 사람이 읽는 메시지가 아니다. */
  message: string;
  error: FlowErrorDetail;
}

export interface FlowErrorDetail {
  code: FlowErrorCode;
  message: string;
}

export type FlowErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED_ERROR'
  /** @관측 OAuth Bearer 경로 전용. 공식 에러 카탈로그에는 없다. */
  | 'INVALID_TOKEN'
  | 'FORBIDDEN_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'ALREADY_EXIST_ERROR'
  | 'PRECONDITION_FAILED_ERROR'
  | 'NOT_EXIST_ERROR'
  /** 문서 내에서 `NOT_EXIST_ERROR` 와 철자가 혼용된다. 둘 다 처리할 것. */
  | 'NOT_EXISTS_ERROR'
  | 'REACHED_MAX_ERROR'
  | 'RATE_LIMIT_EXCEEDED_ERROR'
  | 'INTERNAL_SERVER_ERROR'
  | 'SQL_EXECUTION_ERROR'
  /** `/user/*` 는 베타다. 플랜/계정에 따라 이게 돌아올 수 있다. */
  | 'BETA_API_ACCESS_DENIED_ERROR'
  | 'OPEN_GATE_API_ERROR';

/**
 * 커서 페이지네이션.
 * `cursor` 는 오프셋이 아니라 **페이지 인덱스**다 (`pageSize` 단위로 1씩 증가).
 * 다음 요청에는 응답의 `lastCursor` 를 그대로 넘긴다. 더 없으면 `-1`.
 */
export interface CursorPage {
  hasNext: boolean;
  lastCursor: number;
}

/** `YYYYMMDDHHmmss` (14자). 미설정이면 `""`. 타임존 정보 없음(워크스페이스 로컬 @추정). */
export type FlowDateTime = string;

/** `YYYYMMDD` (8자). 미설정이면 `""`. */
export type FlowDate = string;

/** `"Y"` | `"N"` 플래그. 일부 필드는 `""` 도 온다. */
export type YN = string;

/* ────────────────────────────────────────────────────────────────────────────
 * Employees / Divisions
 * ──────────────────────────────────────────────────────────────────────────── */

/** `GET /user/employees/me`, `GET /user/employees/{userId}` 의 `data`. */
export interface FlowEmployee {
  /** 이용기관 ID. 예 `"BFLOW_000000001234"` */
  inttId: string;
  /** 사용자 ID. 이메일 형태 */
  userId: string;
  fullname: string;
  /** @deprecated 스펙에 "삭제예정" 명시. `divisionCode` 를 쓸 것. */
  divisionId: string;
  divisionCode: string;
  divisionName: string;
  /** 직책 */
  responsibility: string;
  cellPhoneNumber: string;
  companyPhoneNumber: string;
  email: string;
}

/** `GET /user/employees` 의 `data`. 페이지 크기 100 고정. */
export interface FlowEmployeeListData extends CursorPage {
  employees: FlowEmployee[];
}

/** `GET /user/divisions` 의 `data`. 페이지네이션 없음 — 전체 반환. */
export interface FlowDivisionListData {
  divisions: FlowDivision[];
}

export interface FlowDivision {
  divisionCode: string;
  upperDivisionCode: string;
  divisionName: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Projects
 * ──────────────────────────────────────────────────────────────────────────── */

export interface FlowProjectSummary {
  projectId: string;
  title: string;
  /** 예 `"https://flow.team/main.act?projectId=123000"` */
  projectUrl: string;
}

/**
 * `GET /user/projects/participants` 의 `data`.
 * 파라미터가 전혀 없고 페이지네이션도 없다. 참여 프로젝트 전량을 1회에 반환.
 */
export interface FlowParticipatingProjectsData {
  projects: FlowProjectSummary[];
}

/** `GET /user/projects` 의 `data`. 페이지 크기 500 고정. */
export interface FlowProjectListData extends CursorPage {
  projects: FlowProjectSummary[];
}

/** `GET /user/projects/{projectId}/participants` 의 `data`. */
export interface FlowProjectParticipantsData {
  participants: FlowProjectParticipant[];
}

export interface FlowProjectParticipant {
  inttId: string;
  userId: string;
  name: string;
}

/**
 * 업무 컬럼의 의미를 식별하는 키. `columnSrno` 하드코딩보다 이쪽이 안전하다.
 *
 * 관측된 `columnSrno` 대응 (@추정: 전 프로젝트 공통으로 보이나 문서 보장 없음)
 *   0 SECTION · 1 WORKER_ID · 2 RGSR_ID · 3 RGSN_DTTM · 4 EDTR_DTTM · 5 TASK_NUM
 *   6 TASK_NM · 7 PRIORITY · 8 PROGRESS · 10 START_DT · 11 END_DT · 12 STATUS
 */
export type FlowDefaultColumnType =
  | 'SECTION'
  | 'WORKER_ID'
  | 'RGSR_ID'
  | 'RGSN_DTTM'
  /** 최종수정일시 */
  | 'EDTR_DTTM'
  | 'TASK_NUM'
  | 'TASK_NM'
  | 'PRIORITY'
  /** 진행률 `"0"`~`"100"` */
  | 'PROGRESS'
  | 'START_DT'
  /** 마감일 `YYYYMMDD` */
  | 'END_DT'
  /** 상태. 값은 `optionSrno` */
  | 'STATUS'
  /** 커스텀 컬럼은 빈 문자열 */
  | '';

/** 커스텀 컬럼 생성 API 기준 + `STATUS` (@관측). 다른 값이 더 있을 수 있다. */
export type FlowColumnType =
  | 'TEXT'
  | 'CHECKBOX'
  | 'OPTION'
  | 'NUMBER'
  | 'DATE'
  | 'FORMULA'
  | 'STATUS'
  | (string & {});

/** `GET /user/projects/{projectId}/columns` 의 `data`. */
export interface FlowProjectColumnsData {
  projectId: string;
  columns: FlowProjectColumn[];
}

export interface FlowProjectColumn {
  columnSrno: string;
  columnName: string;
  /** 다국어 코드. 예 `"dictionary:status"` */
  columnLangCode: string;
  columnType: FlowColumnType;
  columnDescription: string;
  defaultColumnYn: YN;
  defaultColumnType: FlowDefaultColumnType;
  projectId: string;
  multiOptionYn: YN;
  /** 노출 여부 */
  viewYn: YN;
  orderNum: string;
  rgsrId: string;
  rgsnDateTime: FlowDateTime;
  edtrId: string;
  edtrDateTime: FlowDateTime;
}

/** `GET /user/projects/{projectId}/columns/status` 의 `data`. */
export interface FlowStatusColumnData {
  projectId: string;
  /** 상태 컬럼의 `columnSrno` */
  columnSrno: string;
  options: FlowStatusOption[];
}

export interface FlowStatusOption {
  /** 업무의 상태 값(`taskStatus`, `CUSTOM_COLUMN_DATA`)과 대조할 키 */
  optionSrno: string;
  projectId: string;
  columnSrno: string;
  /** 예 `"대기"`, `"진행"`, `"완료"` */
  optionName: string;
  optionLangCode: string;
  /**
   * 옵션 카테고리. 예 `"0"`.
   * @추정 완료/미완료 구분에 쓰이는 것으로 보이나 값 의미가 문서화되어 있지 않다.
   *       완료 판정은 `optionName` 매핑 쪽이 안전하다.
   */
  optionCategory: string;
  /** 소수 문자열. 예 `"1000.0000000000"` */
  optionOrder: string;
  /** 팔레트 토큰. 헥스 아님. 예 `"Multi06"` */
  optionColor: string;
  rgsrId: string;
  rgsnDateTime: FlowDateTime;
  edtrId: string;
  edtrDateTime: FlowDateTime;
}

/**
 * `GET /user/projects/{projectId}` 의 `data`.
 * 내부 OpenGate 원본을 그대로 노출한다 (대문자 스네이크).
 * 대부분의 배열은 아이템 스키마가 문서화되어 있지 않다 — `unknown[]` 으로 둔다.
 * 컬럼 정보가 필요하면 `GET .../columns` 쪽(camelCase)을 쓸 것.
 */
export interface FlowProjectDetailData {
  project: FlowProjectDetailRaw;
}

export interface FlowProjectDetailRaw {
  /** OpenGate 관례상 단건도 1-element 배열로 온다. `[0]` 을 쓴다 (@추정). */
  PROJECT_SETTING?: FlowProjectSettingRaw[];
  /** @추정 `FlowProjectColumn` 의 대문자판 */
  PROJECT_COLUMN_REC?: unknown[];
  OPTION_REC?: unknown[];
  PIN_RECORD?: unknown[];
  TAG_RECORD?: unknown[];
  ALARM_RECORD?: unknown[];
  ALARM_COUNT?: string;
  ALARM_MORE_YN?: YN;
  TASK_REPORT_RECORD?: unknown[];
  CUSTOM_STATUS_TASK_REPORT_RECORD?: unknown[];
  JOIN_APPLY_RECORD?: unknown[];
}

export interface FlowProjectSettingRaw {
  /** 프로젝트 ID */
  COLABO_SRNO: string;
  /** 프로젝트 제목 */
  TTL: string;
  /** 프로젝트 설명 */
  CNTN?: string;
  USE_INTT_ID?: string;
  /** 참여자 수 */
  SENDIENCE_CNT?: string;
  OPEN_YN?: YN;
  /** 예 `"FEED"` */
  HOME_TAB_CODE?: string;
  STATUS?: string;
  RGSN_DTTM?: FlowDateTime;
  RGSR_ID?: string;
  RGSR_NM?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Posts — 게시글
 * ──────────────────────────────────────────────────────────────────────────── */

/** `GET /user/posts/projects/{projectId}` 의 `data`. */
export interface FlowPostListData extends CursorPage {
  projectId: string;
  posts: FlowPostSummary[];
}

export interface FlowPostSummary {
  projectId: string;
  postId: string;
  /** 없으면 `"-1"` */
  remarkSrno: string;
  /**
   * 템플릿 타입.
   * @관측 문서 예시는 `"1"`/`"2"` 지만 실제 업무 게시글은 `"92"` 였다.
   *        타입 상수로 업무를 거르는 로직은 실환경에서 재확인할 것.
   */
  templateType: string;
  registerName: string;
  registeredDateTime: FlowDateTime;
  projectTitle: string;
  title: string;
  content: string;
  htmlContent: string;
  remarkCount: string;
  readYn: YN;
  /** 예 `"FLOW"` */
  sysCode: string;
  /** @관측 문서 예시는 `"ALL"` 이지만 실제로는 `"A"` 였다. */
  rangeType: string;
  colaboGb: string;
  checkedYn: YN;
  publicLinkPermission: string;
  subTaskCount: string;
  /**
   * 업무 상태.
   * @관측 문서 예시는 `"REQUEST"` 지만 업무 2.0 프로젝트에서는 `optionSrno`
   *        숫자 문자열(`"901659"`)이 온다. `FlowStatusOption.optionSrno` 로 해석할 것.
   */
  taskStatus: string;
  scheduleStartDateTime: FlowDateTime;
  scheduleFinishDateTime: FlowDateTime;
  allDayYn: YN;
}

/**
 * `GET /user/posts/{postId}` 의 `data`.
 * 평면 필드는 스펙 확인됨. 하위 배열 10개는 전부 "원본 목록"으로,
 * 아이템 스키마가 스펙에 정의되어 있지 않다.
 */
export interface FlowPostDetailData {
  projectId: string;
  postId: string;
  remarkSrno: string;
  templateType: string;
  title: string;
  content: string;
  commentContent?: string;
  outContent?: string;
  htmlContent: string;
  contentJsonYn: YN;
  registerId: string;
  registerName: string;
  registeredDateTime: FlowDateTime;
  /** 수정 일시. 게시글 단위 "최종 활동" 판정에 가장 쓰기 좋은 필드. */
  editedDateTime: FlowDateTime;
  connectUrl?: string;
  remarkCount: string;
  existYn: YN;
  nextYn: YN;
  totalCount: string;
  sectionCount: string;

  // ── 이하 "원본 목록". 대문자 스네이크 OpenGate 레코드 (@관측) ──
  remarks: unknown[];
  attachments: unknown[];
  imageAttachments: unknown[];
  todos: unknown[];
  schedules: unknown[];
  /** @관측 아이템은 `FlowRawTask` 형태 */
  tasks: FlowRawTask[];
  /** @추정 `FlowRawTask` 와 동일 형태 */
  subTasks: FlowRawTask[];
  /** @추정 `FlowRawTask` 와 동일 형태 */
  upLinkTasks: FlowRawTask[];
  votes: unknown[];
  projectColumns: unknown[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tasks — 업무
 *
 * flow 업무의 마감일/상태/담당자/우선순위/진행률은 평면 필드가 아니라
 * 프로젝트 컬럼(column)의 값으로 저장된다. 값을 읽는 경로가 두 개 공존한다:
 *   (a) 원본 레코드의 평면 필드 (`END_DT`, `PROGRESS`, `STTS`, `WORKER_REC`)
 *   (b) `TASK_COLUMN_REC[].COLUMN_DATA_REC[].CUSTOM_COLUMN_DATA`
 * 업무 2.0 프로젝트에서는 (b)가 정본이고 (a)는 비어 있을 수 있다 (@추정).
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * `GET /user/posts/{postId}` 의 `tasks[]` 아이템. (@관측 — 스펙에 정의 없음)
 * 미설정 값은 `null` 이 아니라 `""` 로 온다.
 */
export interface FlowRawTask {
  /** 업무 ID (= `taskId`) */
  TASK_SRNO: string;
  TASK_NUM?: string;
  /** 업무명 */
  TASK_NM?: string;
  SECTION_SRNO?: string;
  SECTION_NAME?: string;
  /** legacy 상태 코드. 예 `"0"` */
  STTS?: string;
  /** 시작일 `YYYYMMDD`. 미설정 `""` */
  START_DT?: FlowDate;
  /** 마감일 `YYYYMMDD`. 미설정 `""` */
  END_DT?: FlowDate;
  /** 진행률 `"0"`~`"100"`. 미설정 `""` */
  PROGRESS?: string;
  /** 우선순위. 미설정 `""` */
  PRIORITY?: string;
  /**
   * 담당자 목록.
   * @추정 아이템 형태 미관측 (샘플 업무가 모두 담당자 미지정이었다).
   *        `{ USER_ID, USER_NM, PRFL_PHTG }` 형태로 추정. 런타임 검증 필요.
   */
  WORKER_REC?: FlowRawWorker[];
  TASK_COLUMN_REC?: FlowTaskColumnRec[];
  DRAW_SUBTASK_YN?: YN;
  JIRA_YN?: string | null;
  JIRA_ISSUE_TYPE_NM?: string | null;
  IS_START_ALL_DAY?: string | null;
  IS_END_ALL_DAY?: string | null;
  SR_VAL?: string | null;
  CUSTOM_COLUMN_DATA_RECORD?: unknown | null;
}

/** @추정 전체가 추정. 실제 담당자가 지정된 업무로 검증 필요. */
export interface FlowRawWorker {
  USER_ID?: string;
  USER_NM?: string;
  PRFL_PHTG?: string;
  [key: string]: unknown;
}

/** @관측 원본 업무의 컬럼 값 컨테이너. */
export interface FlowTaskColumnRec {
  COLUMN_SRNO: string;
  COLUMN_TYPE: FlowColumnType;
  DEFAULT_COLUMN_TYPE: FlowDefaultColumnType;
  COLUMN_DATA_REC?: FlowColumnDataRec[];
}

/** @관측 컬럼의 실제 값 한 건. 컬럼 타입에 따라 채워지는 필드가 다르다. */
export interface FlowColumnDataRec {
  /**
   * 실제 값. 컬럼 타입에 따라 의미가 달라진다:
   * STATUS → `optionSrno` / END_DT·START_DT → `YYYYMMDD` /
   * PROGRESS → `"0"`~`"100"` / EDTR_DTTM → `YYYYMMDDHHmmss` / WORKER_ID → 사용자 ID
   */
  CUSTOM_COLUMN_DATA?: string;
  CUSTOM_COLUMN_DATA_SRNO?: string;
  COLUMN_TYPE?: FlowColumnType;
  /** STATUS/OPTION 컬럼일 때 */
  OPTION_NAME?: string;
  OPTION_COLOR?: string;
  OPTION_CATEGORY?: string;
  /** WORKER_ID 컬럼일 때 (@추정) */
  USER_NM?: string;
  PRFL_PHTG?: string;
  [key: string]: unknown;
}

/**
 * `GET /user/posts/projects/{projectId}/tasks/filter` 의 `filterRecords` 아이템.
 * 배열을 JSON 문자열로 직렬화한 뒤 URL 인코딩해서 query 로 넘긴다.
 */
export interface FlowTaskFilterRecord {
  /** 필터링할 컬럼의 `columnSrno` */
  COLUMN_SRNO: string;
  /**
   * 필터 연산자.
   * 문서에 명시된 값은 `"IN"` 뿐이고, 나머지 연산자 집합은 공개되어 있지 않다.
   * 날짜 범위 필터가 서버에서 가능한지 확인 불가 — 클라이언트 필터링 권장.
   */
  OPERATOR_TYPE: 'IN' | (string & {});
  /** 값. 여러 개는 콤마 구분 */
  FILTER_DATA: string;
}

/** `GET /user/posts/projects/{projectId}/tasks/filter` 의 `data`. */
export interface FlowTaskFilterData extends CursorPage {
  /** 응답 모드. 예 `"TREE"` */
  mode: string;
  tasks: FlowFilteredTask[];
  /** 그룹 집계 "원본" 목록. 아이템 스키마 문서화 안 됨. */
  groupAggregates: unknown[];
}

export interface FlowFilteredTask {
  taskId: string;
  orderNumber: string;
  /** 최상위 업무는 `"-1"` */
  upTaskId: string;
  subTaskCount: string;
  postId: string;
  projectId: string;
  projectTitle: string;
  sectionId: string;
  /** 예 `"ALL"` */
  editAuthType: string;
  managerYn: YN;
  /** 업무 내용 = 사실상 업무 제목 */
  content: string;
  upTaskName?: string;
  /** 필터에 직접 걸린 항목인지 (하위 업무 때문에 딸려온 것과 구분) */
  directlyFilteredYn: YN;
  hasFilteredSubtaskYn: YN;
  backgroundColor?: string;
  /** 업무 링크. 빈 문자열일 수 있다. */
  connectUrl?: string;
  postViewAuthYn: YN;
  /**
   * 업무 컬럼 목록 — 마감일/상태/진행률/담당자가 전부 여기 들어 있다.
   *
   * @추정 **스펙에 아이템 정의가 비어 있다.** 두 가지 형태가 가능하다:
   *   1. 형제 필드와 같은 camelCase (`FlowFilteredTaskColumn`) — 가능성 높음.
   *      같은 응답의 다른 필드가 전부 camelCase 변환되어 있고
   *      `groupAggregates` 만 "원본"이라 명시되어 있다.
   *   2. 원본 그대로 대문자 (`FlowTaskColumnRec`) — `GET /user/posts/{postId}` 에서 관측된 형태.
   *
   * 인증된 호출 1회로 확정 가능. 그때까지는 두 형태를 모두 받는 방어적 파서를 쓸 것.
   */
  columns: Array<FlowFilteredTaskColumn | FlowTaskColumnRec>;
}

/**
 * @추정 전체가 추정. `FlowFilteredTask.columns[]` 의 camelCase 후보 형태.
 *        필드명·중첩 구조 모두 검증되지 않았다.
 */
export interface FlowFilteredTaskColumn {
  columnSrno?: string;
  columnType?: FlowColumnType;
  defaultColumnType?: FlowDefaultColumnType;
  /** 단일 값 형태일 경우 */
  value?: string;
  /** 다중 값(담당자, 다중 옵션) 형태일 경우 */
  dataList?: unknown[];
  [key: string]: unknown;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Posts — 쓰기 요청/응답 (이 프로젝트에서는 미사용, 참조용)
 * ──────────────────────────────────────────────────────────────────────────── */

export type FlowLegacyTaskStatus = 'request' | 'progress' | 'feedback' | 'complete' | 'hold';
export type FlowTaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type FlowViewPermission = 'all' | 'admin';

export interface FlowFileInput {
  /** 1~100자. `\ / : * ? " < > |` 불가 */
  fileName: string;
  /** base64 */
  fileContents: string;
}

/** `POST /user/posts/projects/{projectId}/tasks` 의 body. */
export interface FlowCreateTaskBody {
  /** 1~200 */
  title: string;
  /** 1~10000 */
  contents: string;
  /** 생성 시에는 legacy enum 만 받는다. `optionSrno` 는 생성 후 상태 수정 API로. */
  status: FlowLegacyTaskStatus;
  priority?: FlowTaskPriority;
  startDate?: FlowDate;
  endDate?: FlowDate;
  workers?: Array<{ workerId: string }>;
  files?: FlowFileInput[];
  imageFiles?: FlowFileInput[];
  viewPermission?: FlowViewPermission;
}

export interface FlowCreateTaskData {
  projectId: string;
  postId: string;
  taskId: string;
  tinyUrl: string;
}

/** 게시글/일정/할일 생성 공통 응답. */
export interface FlowCreatePostData {
  projectId: string;
  postId: string;
  tinyUrl: string;
}

/**
 * `PATCH /user/posts/projects/{projectId}/tasks/{taskId}/status` 의 body.
 * `status` 와 `optionSrno` 는 **동시에 보낼 수 없다** (둘 중 하나만).
 */
export type FlowUpdateTaskStatusBody =
  | { status: FlowLegacyTaskStatus; optionSrno?: never }
  | { optionSrno: string; status?: never };

/** `POST /user/posts/projects/{projectId}/tasks/{taskId}/subtasks` 의 `data`. */
export interface FlowCreateSubtaskData {
  subtask: {
    taskId: string;
    postId?: string;
    taskNumber?: string;
    orderNumber?: string;
    parentTaskId: string;
    parentPostId?: string;
    projectId: string;
    title: string;
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Alarms
 * ──────────────────────────────────────────────────────────────────────────── */

export type FlowAlarmFilter = 'MENTION' | 'REGISTRANT' | 'WORKER';

/**
 * `GET /user/alarms` 의 `data`.
 * `alarms` 가 두 번 중첩된다 (`data.alarms.alarms`). 오타가 아니다.
 */
export interface FlowAlarmListData {
  alarms: FlowAlarmPage;
}

export interface FlowAlarmPage extends CursorPage {
  alarms: FlowAlarm[];
}

export interface FlowAlarm {
  alarmId: string;
  projectId: string;
  /** 알림이 가리키는 게시글. `taskId` 는 주지 않는다. */
  postId: string;
  /** 없으면 `"-1"` */
  remarkId: string;
  /** 없으면 `"-1"` */
  replyId: string;
  receiverId: string;
  registerId: string;
  registerName: string;
  registeredDateTime: FlowDateTime;
  /** 예 `"김플로님이 회원님을 언급했습니다."` */
  message?: string;
  content?: string;
  readYn: YN;
  /** 예 `"MENTION"`. @추정 `FlowAlarmFilter` 와 같은 값 집합으로 보이나 확정되지 않음. */
  alarmType?: string;
  mentionYn: YN;
  registrantYn: YN;
  workerYn: YN;
}

/** `PATCH /user/alarms/read`, `PATCH /user/alarms/read/all` 의 `data` (빈 객체). */
export type FlowAlarmReadData = Record<string, never>;

/* ────────────────────────────────────────────────────────────────────────────
 * Calendars
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * `GET /user/calendars` 의 `data`.
 * @추정 스펙에는 `editableCalendars` 아이템만 전체 필드가 정의되어 있고
 *        나머지 두 배열은 `calendarSrno` 만 정의되어 있으나, 셋 다 같은 형태로 보인다.
 */
export interface FlowCalendarListData {
  editableCalendars: FlowCalendar[];
  viewOnlyCalendars: FlowCalendar[];
  projectCalendars: FlowCalendar[];
}

export interface FlowCalendar {
  calendarSrno: string;
  calendarName: string;
  /** 예 `"PERSONAL"` */
  calendarType: string;
  customCalendarName: string;
  /** 예 `"ADMIN"` */
  userPermission: string;
  calendarVisibilityYn: YN;
  /** `#` 없는 헥스. 예 `"4F8EF7"` */
  calendarColor: string;
  /** 예 `"OWNER"` */
  calendarRole: string;
  /** 연결된 프로젝트 ID. 개인 캘린더는 `""` */
  colaboSrno: string;
  rgsrId: string;
}

/**
 * `GET /user/calendars/default` 의 `data`.
 * @추정 `calendarId` 예시(`"flow-calendar-user01"`)가 `calendarSrno` 의 숫자 형식과 달라
 *        별개 식별자로 보인다. 상호 변환 가능 여부 불명.
 */
export interface FlowDefaultCalendarData {
  calendarId: string;
}

/** `GET /user/calendars/events` 의 `data`. */
export interface FlowCalendarEventListData extends CursorPage {
  events: FlowCalendarEvent[];
}

export interface FlowCalendarEvent {
  eventSrno: string;
  calendarSrno: string;
  eventName: string;
  eventBody: string;
  eventStartDateTime: FlowDateTime;
  eventFinishDateTime: FlowDateTime;
  allDayYn: YN;
  privateYn: YN;
  publicYn: YN;
  publicNameYn: YN;
  /** 예 `"GMT+09:00"` */
  gmtTime: string;
  /** 예 `"Asia/Seoul"` */
  timezone: string;
  repeatSrno: string;
  repeatInstanceId: string;
  attendanceStatus: string;
  attendanceInfo: string;
  calendarName: string;
  customCalendarName: string;
  calendarRole: string;
  calendarColor: string;
  eventColor: string;
  /** 협업 일련번호 = projectId. 프로젝트 일정이 아니면 `""` */
  colaboSrno: string;
  /** @추정 협업 댓글 일련번호 = postId */
  colaboCommtSrno: string;
}

/** `GET /user/calendars/events/{eventSrno}` 의 `data`. */
export interface FlowCalendarEventDetailData {
  event: FlowCalendarEventDetail;
}

export interface FlowCalendarEventDetail extends FlowCalendarEvent {
  location: string;
  /** 예 `"37.5665,126.9780"` */
  locationCoordinates: string;
  locationUrl: string;
  calendarOwner: string;
  calendarType: string;
  userPermission: string;
  vcSrno: string;
  contentModifiability: YN;
  rgsrId: string;
  rgsrNm: string;
  rgsnDateTime: FlowDateTime;
  prflPhtg: string;
  originSrno: string;
  attendances: FlowEventAttendance[];
  notifications: FlowEventNotification[];
  repeatEvents: FlowEventRepeat[];
  attachments: FlowEventAttachment[];
  vcRecords: FlowEventVideoConference[];
}

export interface FlowEventAttendance {
  /** 예 `"ID"` */
  attendanceType: string;
  attendanceInfo: string;
  /** 예 `"ACCEPT"` */
  attendanceStatus: string;
  attendanceName: string;
  attendanceProfile: string;
}

export interface FlowEventNotification {
  notificationSrno: string;
  /** 예 `"CHATBOT"` */
  notificationType: string;
  /** 분 단위 (@추정) */
  notificationTime: string;
}

export interface FlowEventRepeat {
  repeatSrno: string;
  /** 예 `"WEEKLY"` */
  repeatType: string;
  repeatPeriod: string;
  repeatCount: string;
  /** 예 `"MO,WE,FR"` */
  repeatDays: string;
  endDateTime: FlowDateTime;
}

export interface FlowEventAttachment {
  atchSrno: string;
  fileDownUrl: string;
  fileNm: string;
  fileSize: string;
  randKey: string;
  imgPath: string;
  thumImgPath: string;
}

export interface FlowEventVideoConference {
  vcSrno: string;
  vcTtl: string;
  /** 예 `"GOOGLE_MEET"` */
  videoOrg: string;
  vcStartDateTime: FlowDateTime;
  vcEndDateTime: FlowDateTime;
  vcRgsnDateTime: FlowDateTime;
}

/** `GET /user/calendars/subscribables` 의 `data`. */
export interface FlowSubscribableCalendarData extends CursorPage {
  calendars: FlowSubscribableCalendar[];
}

export interface FlowSubscribableCalendar {
  calendarName: string;
  calendarSrno: string;
  calendarType: string;
  /** 구독 시 부여되는 권한. 예 `"DETAIL_VIEWER"` */
  calendarPermission: string;
  userId: string;
  fullname: string;
  responsibility: string;
  profileImagePath: string;
  email: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Search
 *
 * 검색 API는 커서가 아니라 `score` + `pageTargetId` 쌍으로 페이징한다.
 * 필드명도 다른 API와 다르다 (`ttl`, `commtTtl` — 내부 컬럼명 그대로).
 * ──────────────────────────────────────────────────────────────────────────── */

export type FlowSearchOrderType = 'SCORE' | 'LATEST' | 'OLDEST';

export interface FlowSearchPage {
  hasNext: boolean;
  /** 다음 페이지 요청에 그대로 재사용 */
  score: string;
  /** 다음 페이지 요청에 그대로 재사용 */
  pageTargetId: string;
}

/** `GET /user/search/posts` 의 `data`. */
export interface FlowSearchPostsData extends FlowSearchPage {
  posts: FlowSearchPost[];
}

export interface FlowSearchPost {
  /** 프로젝트 제목 (게시글 제목이 아니다) */
  ttl: string;
  /** 게시글 제목 */
  commtTtl: string;
  content: string;
  templateType: string;
  projectId: string;
  postId: string;
  remarkSrno: string;
  replySrno: string;
  registerId: string;
  registerName: string;
  registeredDateTime: FlowDateTime;
  /** 예 `"REQUEST"`. 업무 2.0 프로젝트에서 무엇이 오는지는 미검증 (@추정) */
  taskState: string;
}

/** `GET /user/search/projects` 의 `data`. */
export interface FlowSearchProjectsData extends FlowSearchPage {
  projects: FlowSearchProject[];
}

export interface FlowSearchProject {
  projectId: string;
  /** 프로젝트 제목 */
  ttl: string;
  homeTabCode: string;
  /** `#` 없는 헥스 */
  backgroundColorCode: string;
  importantYn: YN;
  participantCount: string;
  editedDateTime: FlowDateTime;
  participants: Array<{ userId: string; userName: string }>;
}

/** `GET /user/search/employees` 의 `data`. */
export interface FlowSearchEmployeesData extends CursorPage {
  employees: FlowSearchEmployee[];
}

export interface FlowSearchEmployee {
  flowUserYn: YN;
  portalId: string;
  channelId: string;
  institutionId: string;
  userId: string;
  profileImagePath: string;
  fullname: string;
  responsibility: string;
  responsibilityName: string;
  companyName: string;
  divisionName: string;
  phoneNumber: string;
  phoneCountryCode: string;
  companyPhoneNumber: string;
  email: string;
  /** 예 `"1"`. 값 의미 미문서화 (@추정 재직/휴직 등) */
  status: string;
  bookmarkYn: YN;
  loginYn: YN;
  dayoffName: string;
  chargeJobName: string;
  employeeNumber: string;
  divisionCode: string;
  groupCode: string;
}

/** `GET /user/search/events` 의 `data`. */
export interface FlowSearchEventsData extends CursorPage {
  events: FlowSearchEvent[];
}

export interface FlowSearchEvent {
  calendarName: string;
  customCalendarName: string;
  calendarRole: string;
  eventSrno: string;
  calendarSrno: string;
  eventName: string;
  eventStartDateTime: FlowDateTime;
  eventFinishDateTime: FlowDateTime;
  allDayYn: YN;
  timezone: string;
  gmtTime: string;
  calendarColor: string;
  eventColor: string;
  publicYn: YN;
  publicNameYn: YN;
  privateYn: YN;
  attendanceSrno: string;
  attendanceInfo: string;
  attendanceStatus: string;
  originSrno: string;
}
