/**
 * flow REST — MCP로 못 가져오는 것만 (PRD §5.1.1 하이브리드, §13 확장 후보).
 *
 * flow 접근의 기본은 MCP다(`mcp.ts`). 집계 한 번에 화면 하나가 서는 도구들이 거기 있고,
 * REST로 같은 화면을 만들면 호출이 178~470회로 늘어난다(PRD §5.1.1). REST는 **MCP에 길이
 * 없는 것**만 맡는다:
 *
 * - **멘션 댓글 본문**: `flow_get_my_worklist`가 주는 멘션에는 본문이 없고(발신자·시각·제목뿐),
 *   MCP `flow_list_alarms`는 서버측 스키마 검증이 `alarmType: null`에서 터진다
 *   (docs/bug-report.md BUG-001). REST 알림은 `content`와 `postId`·`replyId`를 함께 준다.
 * - **`taskSrno` → `postId`**: `resolvePostId` 주석 참고. `flow_list_project_items`는
 *   `postId`만 주고 `taskId`가 응답에 아예 없어서 두 ID를 이어 붙일 수 없다 (실측).
 * - **전체 댓글 스레드**: 게시글 상세(`flow_get_post`)는 14건 중 2건만 준다.
 *   `GET /user/comments/{postId}`는 14건 전부 준다 (api-spec §13, PRD §13 A1).
 * - **알림 읽음 처리**: MCP `flow_mark_alarm_read`가 알림 ID를 요구하는데 워크리스트 멘션에
 *   ID가 없다. REST 알림은 `alarmId`를 준다 (PRD §13 A2).
 * - **업무 단일 필드 수정**: `flow_update_task`는 상태만 바꾼다. 마감일·우선순위·담당자는
 *   REST에만 길이 있다 (api-spec §6.4, PRD §13 A4).
 * - **부서원 일정**: `userId`가 `/user/*`에 남은 유일한 타인 조회 파라미터다 (PRD §13 B3).
 *
 * 인증은 `x-flow-api-key`다. 세션 OAuth 토큰은 못 쓴다 — `Authorization: Bearer`로 보내면
 * 401이고(실측), 애초에 그 토큰은 `resource=https://flow.team/ai/mcp`로 발급되어 REST와
 * audience가 다르다 (bug-report BUG-004).
 *
 * **API Key는 소유자 한 명 기준이다** (알림 응답의 `receiverId`가 소유자로 고정된다).
 * 그래서 `mergeMentionComments`에서 `receiverId`가 **지금 로그인한 사람**과 같은 것만
 * 받아들인다 — 남의 멘션이 새는 경로를 남기지 않는다.
 *
 * 키는 두 출처다 (`get`). 로그인할 때 **자기 키를 등록한 사람**은 소유자가 자기 자신이라
 * 이 파일 전체가 자기 기준으로 돌고, 등록하지 않은 사람은 환경변수의 공용 키로 돈다 —
 * 그때는 알림이 0건이 되어 본문 없는 화면이 뜨고, `resolvePostId`는 공용 키 소유자가
 * 멤버인 프로젝트에서만 답을 준다. 키 등록을 권하는 이유가 이것이다.
 */

import { DAY_MS, kstYmd } from "@/lib/aggregate/date";
import { getApiKey } from "@/lib/auth";
import type { FlowSearchEmployeesData } from "@/lib/flow/types";
import type { TaskPriority } from "@/lib/task-priority";

const BASE = process.env.FLOW_API_BASE ?? "https://api.flow.team";

/** 알림·업무 목록의 한 페이지 크기. 알림은 `size`, 업무는 `pageSize`로 이름이 다르다. */
const SIZE = 100;

/** api-spec §7.1 `Alarm`. 화면에 쓰는 것만 적었다. */
export interface MentionAlarm {
  /** 알림 고유 번호. 읽음 처리(`markAlarmRead`)가 이걸 요구한다. */
  alarmId: string;
  /** 수신자 — API Key 발급자로 고정된다. 로그인한 사람과 같은지 반드시 확인한다. */
  receiverId: string;
  /** 이 업무가 속한 프로젝트. 워크리스트 멘션에는 없어서 화면의 프로젝트명이 여기서 나온다. */
  projectId: string;
  postId: string;
  /** 댓글 ID. `-1`이면 게시글 본문 멘션. */
  remarkId: string;
  /** 답글 ID. `-1`이 아니면 이 댓글은 다른 댓글에 달린 답글이다. */
  replyId: string;
  registerId: string;
  registerName: string;
  /** `YYYYMMDDHHmmss` */
  registeredDateTime: string;
  /** 댓글 본문. 서버가 ~120자로 잘라 준다 (전문은 flow에서). */
  content?: string | null;
  /** 알림 문구 (`"김플로님이 회원님을 언급했습니다."`). `null`로 오는 경우가 있다. */
  message?: string | null;
  /** `"N"`이면 아직 안 읽은 알림이다. */
  readYn?: string;
}

/** 조인 대상 — 멘션 한 줄. `queries.ts`의 `WorklistMention`이 이걸 만족한다. */
export interface MentionRow {
  /** flow user_id. */
  from: string;
  /** `YYYYMMDDHHmmss` */
  at: string;
  /** 멘션된 댓글 본문(미리보기). 알림 조회가 실패하면 undefined. */
  content?: string;
  /** 다른 댓글에 달린 답글이면 true. 화면에서 한 단 들여쓴다. */
  isReply?: boolean;
  /** 프로젝트 id. 알림 조회가 실패하면 undefined 그대로다. */
  projectId?: string;
  /** 알림 id. 읽음 처리에 쓴다 — 알림 조회가 실패하면 undefined다. */
  id?: string;
  /** 아직 안 읽은 멘션. 알림의 `readYn`에서 온다. */
  unread?: boolean;
  /** 게시글 id. 전체 댓글 스레드(`listComments`)를 부를 때 쓴다. */
  postId?: string;
  /** 업무 상태 라벨. 워크리스트도 알림도 안 줘서 게시글 상세로 채운다 (BUG-028). */
  status?: string;
}

interface Envelope<T> {
  response?: {
    success?: boolean;
    data?: T;
    /** flow가 실패 사유를 여기 넣는다 (`error`가 아닌 경우도 있다 — 둘 다 본다). */
    message?: string;
    error?: { code: string; message: string };
  };
}

/**
 * REST 실패. `reason`은 **flow가 준 문장 그대로**다 — 쓰기 실패는 사유가 곧 다음 행동이라
 * ("동일한 업무 마감일로 변경할 수 없습니다.") 호출부가 이걸 사용자에게 그대로 보여 준다.
 */
export class FlowRestError extends Error {
  constructor(
    what: string,
    readonly status: number,
    readonly reason: string,
  ) {
    super(`${what} 실패 (${status}): ${reason}`);
    this.name = "FlowRestError";
  }
}

/**
 * REST는 모든 응답을 `response.data`로 한 겹 싼다. 그 겹을 벗기고 실패는 던진다.
 *
 * 키는 **개인 키 → 환경변수** 순이다. 이 한 줄이 이 파일의 모든 호출을 덮는다 —
 * 로그인한 사람이 자기 키를 등록해 뒀으면 전부 그 사람 기준으로 돌고, 없으면 예전처럼
 * 발급자 키로 돈다(파일 상단 주석의 열화 그대로).
 *
 * `apiKey`를 직접 넘기는 건 **등록 직전 검증**용이다 (`app/login/actions.ts`). 그때는
 * 아직 쿠키에 넣기 전이라 쿠키에서 읽을 수 없다.
 *
 * 쓰기(PATCH) 응답은 `data`가 아예 없다 (api-spec §6.4) — 그래서 `data` 유무는 여기서
 * 따지지 않고, 필요한 쪽(`get`)에서만 본다.
 */
async function call<T>(
  path: string,
  what: string,
  init?: { method?: string; body?: unknown; apiKey?: string; revalidate?: number },
): Promise<T | null> {
  // `cookies()`는 요청 스코프 밖에서 던진다. 이 파일을 요청 없이 직접 부르는 곳이
  // 단위 테스트라, 그때는 쿠키를 건너뛰고 환경변수로 간다.
  const key = init?.apiKey ?? (await getApiKey().catch(() => null)) ?? process.env.FLOW_API_KEY;
  if (!key) throw new Error("FLOW_API_KEY 없음");

  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "x-flow-api-key": key,
      ...(init?.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    // 기본은 매번 새로 받는다. `revalidate`를 준 호출만 Next 데이터 캐시에 올린다 —
    // URL에 조회 대상(`userId` 등)이 들어 있는 호출만 그렇게 한다. 안 그러면 캐시 한 칸을
    // 여러 사람이 나눠 쓴다.
    ...(init?.revalidate === undefined
      ? { cache: "no-store" as const }
      : { next: { revalidate: init.revalidate } }),
  });
  const body = ((await res.json()) as Envelope<T>).response;
  if (!res.ok || !body?.success) {
    throw new FlowRestError(what, res.status, body?.error?.message ?? body?.message ?? "");
  }
  return body.data ?? null;
}

/** 읽기 전용 래퍼. `data`가 비어 있으면 조회가 실패한 것으로 본다. */
async function get<T>(
  path: string,
  what: string,
  apiKey?: string,
  /** 초. 주면 그 시간만큼 Next 데이터 캐시에 남는다. */
  revalidate?: number,
): Promise<T> {
  const data = await call<T>(path, what, { apiKey, revalidate });
  if (!data) throw new Error(`${what} 실패 — 응답이 비어 있어요`);
  return data;
}

/* ── 알림 (api-spec §7.1~7.3, PRD §13 A2·A3·A5·B1·B2) ─────────────────── */

interface AlarmPage {
  alarms?: MentionAlarm[];
  hasNext?: boolean;
  lastCursor?: number;
}

/**
 * 커서 루프 상한. 100건 × 10 = 1,000건에서 멈춘다. 알림에는 날짜 필터가 없어서
 * (api-spec §7.1) 이 상한이 없으면 활동량 많은 계정에서 수천 건을 긁는다.
 */
const MAX_PAGES = 10;

/**
 * 알림 목록. `days`를 주면 **그 창을 덮을 때까지 커서로 이어 받는다** (BUG-019).
 *
 * 예전에는 첫 100건만 보고 끝냈는데 실측에서 이미 `hasNext: true`가 떠 있었다 —
 * 넘치는 멘션은 본문이 조용히 비었다. 페이지의 마지막 알림이 창 밖으로 나가면 멈춘다.
 * 알림이 최신순으로 오는 걸 전제로 하고, 혹시 순서가 반대여도 `MAX_PAGES`에서 멈춘다.
 *
 * `days`를 안 주면 첫 페이지 한 장이다 — 인박스처럼 "최근 것만" 보는 화면은 그걸로 족하다.
 */
export async function listAlarms(
  filters: string,
  opts: { days?: number; readYn?: "Y" | "N"; now?: number } = {},
): Promise<MentionAlarm[]> {
  const floor =
    opts.days === undefined
      ? null
      : `${kstYmd((opts.now ?? Date.now()) - opts.days * DAY_MS)}000000`;

  const out: MentionAlarm[] = [];
  let cursor: number | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ filters, size: String(SIZE) });
    if (opts.readYn) query.set("readYn", opts.readYn);
    if (cursor !== undefined) query.set("cursor", String(cursor));

    // `alarms`가 두 번 중첩된다 — 오타가 아니다 (api-spec §7.1).
    const { alarms } = await get<{ alarms?: AlarmPage }>(`/user/alarms?${query}`, "알림 조회");
    const rows = alarms?.alarms ?? [];
    out.push(...rows);

    if (floor === null || !alarms?.hasNext || alarms.lastCursor === undefined) break;
    // 14자리 문자열이라 사전순 비교가 곧 시각 비교다.
    if ((rows.at(-1)?.registeredDateTime ?? "") < floor) break;
    cursor = alarms.lastCursor;
  }

  return out;
}

/**
 * 멘션 알림. 실패하면 던진다 — 호출부가 본문 없이 화면을 세우면 된다.
 *
 * 창을 90일로 잡는다. 워크리스트 멘션이 어느 시점까지 거슬러 오는지는 flow가 밝히지
 * 않아서, 실측 창(최근 14일 28건)보다 넉넉하게 두고 커서로 덮는다.
 */
export const listMentionAlarms = () => listAlarms("MENTION", { days: 90 });

/**
 * 담당 업무·내가 올린 글 알림 (PRD §13 B1·B2). 첫 페이지 한 장만 본다 —
 * "최근에 무슨 일이 있었나"를 보는 카드라 최신 100건이면 충분하다.
 *
 * 알림은 이름도 링크도 안 준다 (`postId`·`projectId`뿐). 업무명과 딥링크는 `getPostBrief`,
 * 프로젝트명은 `listProjects`로 `loadNews`가 풀어 붙인다.
 */
export const listTaskAlarms = () => listAlarms("WORKER,REGISTRANT");

/** 알림 한 건 읽음 처리. 전용 벌크 API가 없어서 그룹은 호출부가 병렬로 쏜다. */
export async function markAlarmRead(alarmId: string): Promise<void> {
  await call("/user/alarms/read", "알림 읽음 처리", { method: "PATCH", body: { alarmId } });
}

/** 알림 전체 읽음 처리. `projectId`를 주면 그 프로젝트만. */
export async function markAllAlarmsRead(projectId?: string): Promise<void> {
  await call("/user/alarms/read/all", "알림 전체 읽음 처리", {
    method: "PATCH",
    body: projectId ? { projectId } : {},
  });
}

/* ── 내 정보 (api-spec §3.1, PRD §13 B6) ───────────────────────────────── */

/** api-spec §3.1. 키 소유자 확인에 쓰는 것만 적었다. */
export interface FlowMe {
  userId: string;
  fullname: string;
  email: string;
  divisionName: string;
}

/**
 * API Key 소유자. **키가 누구 것인지 알아내는 유일한 길이다.**
 *
 * 키를 등록할 때(`app/login/actions.ts`)와 로그인할 때(OAuth 콜백) 이걸 불러
 * `userId`가 로그인한 사람과 같은지 본다. 다르면 남의 알림·업무가 보이는 화면이 된다.
 */
export const getMe = (apiKey?: string) => get<FlowMe>("/user/employees/me", "내 정보 조회", apiKey);

/** 구성원 목록 스캔 상한. 100명 × 3 = 300명. */
const EMPLOYEE_MAX_PAGES = 3;

/**
 * 한 부서의 **이름 → userId** (api-spec §3.2). 팀원 일정 조회가 `userId`를 요구하는데
 * 스탠드업은 이름만 준다 (PRD §13 B3).
 *
 * ponytail: 부서 필터가 없어서 전사 목록을 받아 `divisionName`으로 고른다. 300명에서 끊는다 —
 * 더 큰 회사에서는 뒷쪽 부서원의 일정이 빠지고, 그때 `GET /user/divisions` 기준 조회를
 * 찾아보면 된다.
 */
export async function listEmployeeIds(divisionName: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  let cursor = 0;

  for (let page = 0; page < EMPLOYEE_MAX_PAGES; page++) {
    const data = await get<{
      employees?: { userId: string; fullname: string; divisionName: string }[];
      hasNext?: boolean;
      lastCursor?: number;
    }>(`/user/employees?cursor=${cursor}`, "구성원 조회");

    for (const e of data.employees ?? []) {
      // 동명이인은 먼저 나온 쪽이 이긴다 — 스탠드업도 이름으로만 주니 구분할 재료가 없다.
      if (e.divisionName === divisionName && !ids.has(e.fullname)) ids.set(e.fullname, e.userId);
    }

    if (!data.hasNext || data.lastCursor === undefined) break;
    cursor = data.lastCursor;
  }

  return ids;
}

/**
 * 전사 구성원 명단 (api-spec §9.3). 구성원 화면(PRD §6.6)이 이 한 번으로 선다.
 *
 * 위의 `/user/employees`(§3.2)가 아니라 §9.3인 이유는 **사진**이다 — `profileImagePath`가
 * §9.3에만 있다.
 *
 * `searchWord`는 **세션 값만** 넘긴다 (계정 블록이 자기 사진 한 장을 받을 때). 요청에서 받은
 * 문자열을 그대로 흘리면 남의 이름으로 명단을 훑는 손잡이가 된다 — 공용 API 키라 검색은 통한다
 * (PRD §8.1, §6.6 개인정보). 구성원 화면은 인자 없이 부르고 전량을 받는다.
 *
 * 검색어는 **이름**만 걸린다 — 이메일을 넣으면 0명이 온다 (실측). 그래서 이름으로 찾고 받은
 * 줄에서 이메일로 고른다 (`loadMyAccount`).
 *
 * ponytail: 100명에서 끊는다. 지금 13명이라 남는다 — 넘치면 `hasNext`가 참으로 오고,
 * 그때 `listEmployeeIds`처럼 커서를 돌면 된다.
 */
export const searchEmployees = (sessionSearchWord?: string) =>
  get<FlowSearchEmployeesData>(
    `/user/search/employees?pageSize=${SIZE}` +
      (sessionSearchWord ? `&searchWord=${encodeURIComponent(sessionSearchWord)}` : ""),
    "구성원 명단 조회",
  );

/* ── 댓글 (api-spec §13, PRD §13 A1·B4) ───────────────────────────────── */

/** api-spec §13.1 `Comment`. 화면에 쓰는 것만 적었다. */
export interface FlowComment {
  commentId: string;
  /** 본문. `@[이름](id)` 마크업이 그대로 온다 — `stripMentions`로 벗긴다. */
  contents: string;
  /**
   * 변경 로그 표시. **truthy 여부로 판정하면 안 된다** — `isChangeLog`를 쓴다 (BUG-035).
   * 변경 로그면 `describeSystemComment`로 읽는다.
   */
  systemCode?: string | null;
  registerId: string;
  registerName: string;
  /** `YYYYMMDDHHmmss` */
  registeredDateTime: string;
}

/**
 * 게시글 댓글 전량 (PRD §13 A1).
 *
 * `flow_get_post`의 `remarks`는 같은 게시글에서 14건 중 2건만 줬다 (api-spec §13.1).
 * 여기는 14건이 다 온다.
 *
 * **답글은 안 온다** (실측 2026-08-03, api-spec §13.1). 이건 최상위 댓글만 주는 목록이다 —
 * 게시글 79974281은 댓글 2건인데 그중 하나의 `REPLY_CNT`가 3이고, 그 답글 셋은 응답에 없다.
 * 답글 id(알림의 `replyId`)는 댓글 id와 자리수부터 다른 별개 공간이고, 답글을 읽는 경로는
 * `/user/*`에 없다 (경로·쿼리 후보 11개 전부 404 또는 `VALIDATION_ERROR`). 그래서 화면의
 * 스레드에는 답글이 없고, 답글 계층을 아는 자리는 알림뿐이다 (`MentionAlarm.replyId`).
 *
 * ponytail: 첫 페이지만 본다. `hasNext`·`lastCursor`는 오는데 커서 파라미터 이름이
 * 문서화되지 않았다 — 한 게시글의 댓글이 한 페이지를 넘기면 그때 확인하면 된다.
 */
export async function listComments(postId: string, ttl?: number): Promise<FlowComment[]> {
  const data = await get<{ comments?: FlowComment[] }>(
    `/user/comments/${postId}`,
    "댓글 조회",
    undefined,
    ttl,
  );
  return data.comments ?? [];
}

/**
 * `systemCode`가 **업무 변경 로그**인지 (BUG-035).
 *
 * 변경 로그는 항상 `코드^^값` 꼴이다 (`S45^^대기^^진행`, `S41^^'이종석'`, 항목 구분자 `@$%`).
 * 값 없이 코드만 오는 `S13`·`S14`·`S20`은 **사람이 쓴 댓글**이다 — 실측 148건 중 56건이
 * 그것이라, truthy로 걸러 내면 사람 말 38%가 조용히 사라진다.
 */
export const isChangeLog = (systemCode?: string | null) => Boolean(systemCode?.includes("^^"));

/**
 * 목록에서 **사람이 쓴 마지막 댓글**. 피드백 업무에 내가 마지막으로 답했는지 볼 때 쓴다
 * (`answeredByMe` — queries.ts).
 *
 * 응답은 오래된 것부터 온다 — 뒤에서 찾는다. 변경 로그(`담당자를 바꿨어요` 같은 기록)는
 * 건너뛴다: 실측 15건 중 7건이 그것이라 그냥 최신 한 건을 집으면 대부분의 줄이 로그로 채워진다.
 */
export function lastHumanComment(comments: FlowComment[]): FlowComment | null {
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];
    if (!isChangeLog(comment.systemCode)) return comment;
  }
  return null;
}

/**
 * `@[서동조](djseo7)` → `서동조`. 알림은 걷어서 주는데 댓글 API는 안 걷는다.
 *
 * `@`까지 뗀다. 여기서 이름을 부르는 건 flow 안에서 알림을 보내는 동작이라 우리 화면에서는
 * 누를 데도 없는 표시고, 한 댓글에 서너 명이 불려 있으면 `@`가 줄머리를 채워 본문이 안 읽힌다.
 */
export const stripMentions = (contents: string) =>
  contents.replace(/@\[([^\]]*)\]\([^)]*\)/g, "$1");

/** 관측한 시스템 코드 (api-spec §13.1). 전체 코드표는 flow가 공개하지 않았다. */
const SYSTEM_FIELD: Record<string, string> = {
  S41: "담당자를",
  S48: "마감일을",
  S49: "우선순위를",
};

/** 받침에 따라 `으로`/`로`를 고른다. 숫자는 읽는 소리(영·일·이…)의 받침을 본다. */
function ro(value: string): string {
  const last = value.at(-1) ?? "";
  // 영(ㅇ)·삼(ㅁ)·육(ㄱ)만 받침이 있고, 일·칠·팔은 ㄹ이라 `로`다.
  if (last >= "0" && last <= "9") return "036".includes(last) ? "으로" : "로";
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "로";
  const jong = code % 28;
  return jong === 0 || jong === 8 ? "로" : "으로";
}

/**
 * 시스템 댓글을 사람 말로 (PRD §13 B4).
 *
 * `"S41^^'서동조','김승호'@$%S48^^2026-07-16@$%"` → `"담당자를 서동조, 김승호로 바꿨어요 ·
 * 마감일을 2026-07-16으로 바꿨어요"`. 항목 구분자는 `@$%`, 필드 구분자는 `^^`다.
 * 모르는 코드는 버린다 — 남는 게 없으면 뭉뚱그려 한 줄로 낸다.
 */
export function describeSystemComment(systemCode: string): string {
  const lines = systemCode
    .split("@$%")
    .filter(Boolean)
    .flatMap((item) => {
      const [code, raw = ""] = item.split("^^");
      const field = SYSTEM_FIELD[code];
      const value = raw.replace(/'/g, "").replace(/,/g, ", ").trim();
      return field && value ? [`${field} ${value}${ro(value)} 바꿨어요`] : [];
    });
  return lines.length ? lines.join(" · ") : "업무 내용을 바꿨어요";
}

/**
 * 프로젝트 이름 → projectId 전량 (api-spec §5.2).
 *
 * MCP `flow_list_projects`가 죽어 있어서(BUG-007) 같은 목록을 REST로 받는다. 개수도 같다
 * (실측 59개). 이게 없으면 이름을 검색으로 하나씩 해소하는 수밖에 없는데(`search.ts`),
 * 검색은 **화면에 이미 뜬 이름**만 풀 수 있어서 멘션 줄의 프로젝트명이 비었다 — 멘션 알림은
 * 이름 없이 `projectId`만 준다.
 *
 * **API Key 소유자 기준 목록이다.** 공용 키로 도는 사람에게는 자기 프로젝트가 아니므로,
 * 호출부는 이 맵 위에 per-user 검색 결과를 덮는다 (`queries.ts`).
 *
 * `apiKey`를 넘기면 그 키로 조회한다 — 키 등록 전 **유효성 검증**에 이 호출을 쓴다
 * (`app/login/actions.ts`). 응답이 오면 유효한 키다.
 *
 * ponytail: 첫 페이지만 본다. 페이지 크기가 500 고정이라 실측 59개가 한 번에 다 온다.
 * 500개를 넘기면 `hasNext`가 켜지고, 그때 `lastCursor`로 이어 받으면 된다.
 */
export async function listProjects(apiKey?: string): Promise<Map<string, string>> {
  const data = await get<{ projects?: { projectId: string; title: string }[] }>(
    "/user/projects",
    "프로젝트 목록 조회",
    apiKey,
  );
  const map = new Map<string, string>();
  // 이름이 겹치면 먼저 나온 쪽이 이긴다 — 실측 59개에 중복이 없다.
  for (const p of data.projects ?? []) if (!map.has(p.title)) map.set(p.title, p.projectId);
  return map;
}

/** api-spec §6.1 `tasks[]`. 화면에 쓰는 것만 적었다. */
interface FilterTask {
  /** raw `TASK_SRNO` — 워크리스트·스탠드업의 `taskSrno`와 같은 값이다. */
  taskId: string;
  /** `colabo_commt_srno` — 댓글 도구가 요구하는 ID다. */
  postId: string;
  /**
   * 부모 업무의 `taskId`. **최상위면 `-1`이다** (빈 문자열이 아니다).
   *
   * `columns` 밖 최상위에 있어서 오래 못 보고 지나갔다 — `upTaskName`이 전부 비어 있는 것만
   * 보고 "계층 정보가 없다"로 닫았다 (bug-report BUG-034). `mode=TREE`는 아무 효과가 없고
   * 계층은 이 필드로 만든다. 실측 226건 채움률 100%.
   */
  upTaskId?: string;
  /**
   * 업무명·마감일·상태·담당자가 **여기 배열로** 들어온다. 평평한 필드가 아니다 —
   * 의미는 `defaultColumnType`이 정한다 (api-spec §2.1).
   */
  columns?: {
    defaultColumnType?: string;
    columnData?: {
      customColumnData?: string;
      userName?: string;
      /** 커스텀 상태(`STATUS`)의 라벨. base 상태(`STTS`)는 항상 빈 문자열이다. */
      optionName?: string;
      /** 상태 그룹. 두 상태 체계가 **공통으로** 주는 값이라 완료 판정을 이걸로 한다. */
      optionCategory?: string;
    }[];
  }[];
}

/** 업무의 한 컬럼 값들. 없는 컬럼이면 빈 배열이다. */
const columnData = (task: FilterTask, type: string) =>
  task.columns?.find((c) => c.defaultColumnType === type)?.columnData ?? [];

/**
 * 등록일 `RGSN_DTTM`. 원본은 `YYYYMMDDHHmmss`인데 앞 8자리만 남긴다 — 화면은 날짜만
 * 쓰고, 그래야 마감일(`YYYYMMDD`)과 같은 모양이라 `fmtDate` 하나로 둘 다 그린다.
 */
const regDateOf = (task: FilterTask) =>
  (columnData(task, "RGSN_DTTM")[0]?.customColumnData ?? "").slice(0, 8);

/**
 * 등록자 실명 `RGSR_ID`. `columnType: USER`라 `userName`에 이름이 온다 — `customColumnData`는
 * 로그인 ID다 (실측 2026-08-04, 업무 4,142건 채움률 100%).
 *
 * **이름 말고는 아무것도 못 붙인다.** 부서·직급·사진은 `/user/search/employees`(§9.3)에만
 * 있고 그건 우리 기관 13명이다 — 내 업무 686건의 등록자 중 그 명단에 있는 건 5건이다.
 * 나머지는 타사 사용자고 flow에 그 사람들의 부서를 주는 경로가 없다. 같은 응답의
 * `profilePhoto`도 이 컬럼에서는 늘 빈 문자열이다.
 */
const authorOf = (task: FilterTask) => columnData(task, "RGSR_ID")[0]?.userName ?? "";

/** 업무 한 건의 현재 값. 워크리스트·스탠드업이 주지 않는 것들이다 (PRD §13 A4). */
export interface TaskFields {
  /** `colabo_commt_srno` — 댓글 도구가 요구하는 ID다 (BUG-005). */
  postId: string;
  /** `YYYYMMDD`. 미설정이면 빈 문자열이다 (`null`이 아니다 — api-spec §2.2). */
  endDate: string;
  /** 등록일 `YYYYMMDD`. 워크리스트·포커스는 이 값을 안 줘서 여기서만 온다. */
  regDate: string;
  /** `low`\|`normal`\|`high`\|`urgent`. 미설정이면 빈 문자열이다. */
  priority: string;
  /** 담당자 실명. 없으면 빈 배열이다. */
  workers: string[];
}

/**
 * 업무 한 건을 찾아 화면에 필요한 값만 꺼낸다.
 *
 * 업무명을 `searchWord`로 서버에 넘겨 먼저 줄인다. 프로젝트를 전량 훑으면 페이지가
 * 수십 장이고(실측 한 프로젝트 600건+), 검색을 걸면 같은 실측이 2건으로 준다.
 * 최종 판정은 항상 `taskId` 일치다 — 같은 이름의 업무가 여럿 있어서 이름으로는 못 고른다.
 *
 * 이 조회로 남의 업무가 새지는 않는다. 호출부가 넘기는 `taskSrno`·업무명은 그 사람의
 * 워크리스트에서 나온 것이고, 쓰기 자체는 flow가 권한을 다시 본다.
 *
 * ponytail: 첫 페이지(100건)만 본다. 같은 이름의 업무가 100개를 넘으면 못 찾고,
 * 그때는 화면이 flow 링크로 안내한다.
 */
export async function getTaskFields(
  projectId: string,
  taskSrno: string,
  title: string,
): Promise<TaskFields | null> {
  const query = `pageSize=100&searchWord=${encodeURIComponent(title)}`;
  const data = await get<{ tasks?: FilterTask[] }>(
    `/user/posts/projects/${projectId}/tasks/filter?${query}`,
    "업무 조회",
  );
  const task = data.tasks?.find((t) => t.taskId === taskSrno);
  if (!task) return null;

  return {
    postId: task.postId,
    endDate: columnData(task, "END_DT")[0]?.customColumnData ?? "",
    regDate: regDateOf(task),
    priority: columnData(task, "PRIORITY")[0]?.customColumnData ?? "",
    workers: columnData(task, "WORKER_ID")
      .map((d) => d.userName || d.customColumnData || "")
      .filter(Boolean),
  };
}

/**
 * `taskSrno` → `postId`. 이 둘은 다른 ID 공간인데 `flow_create_comment`는 `postId`를
 * 요구한다 — `taskSrno`를 그대로 넘기면 flow가 404 "삭제되었거나 존재하지 않는
 * 콘텐츠입니다"를 준다 (docs/bug-report.md BUG-005).
 */
export const resolvePostId = async (projectId: string, taskSrno: string, title: string) =>
  (await getTaskFields(projectId, taskSrno, title))?.postId ?? null;

/**
 * base 상태(`STTS`) 코드 → 배지 라벨. flow는 이 컬럼만 `optionName`을 빈 문자열로 줘서
 * 대응표가 없으면 숫자가 그대로 화면에 나온다 (api-spec §6.1).
 *
 * 코드는 문서에 없다. 업무 상태를 바꿀 때 flow가 남기는 시스템 댓글
 * (`SYS_CODE:"S45^^<이전>^^<이후>"` + 사람이 읽는 문구 `'피드백' → '요청'`)로 맞췄고,
 * `0`은 워크리스트가 같은 업무를 `대기`로 부르는 것까지 확인했다 (2026-07-29 실측).
 * 라벨은 워크리스트·포커스가 쓰는 말을 따른다 — 한 상태를 카드마다 다르게 부르지 않는다.
 */
const STTS_LABEL: Record<string, string> = {
  "0": "대기",
  "1": "진행",
  "2": "완료",
  "3": "보류",
  "4": "피드백",
};

/** api-spec §6.3 `tasks[]`. 게시글 상세는 필터 API와 달리 UPPER_SNAKE로 온다. */
interface PostTask {
  TASK_COLUMN_REC?: {
    DEFAULT_COLUMN_TYPE?: string;
    COLUMN_DATA_REC?: { CUSTOM_COLUMN_DATA?: string; OPTION_NAME?: string }[];
  }[];
}

/**
 * 업무의 상태 라벨. 프로젝트가 커스텀 상태(`STATUS`, api-spec §2.1)를 쓰면 라벨이 그대로
 * 오고, 안 쓰면 base 상태(`STTS`) 코드만 온다 — 그때만 대응표를 쓴다.
 *
 * 평평한 `tasks[0].STTS`는 **못 쓴다**: 커스텀 상태 프로젝트에서도 값이 오는데 안 쓰는
 * 컬럼이라 항상 `"0"`이다. 그걸 읽으면 `진행`인 업무가 `대기`로 보인다 (2026-07-29 실측).
 *
 * 모르는 코드는 버린다 — 배지에 숫자가 뜨는 건 빈 자리보다 나쁘다.
 */
function taskStatus(task?: PostTask): string | null {
  const col = task?.TASK_COLUMN_REC?.find(
    (c) => c.DEFAULT_COLUMN_TYPE === "STATUS" || c.DEFAULT_COLUMN_TYPE === "STTS",
  );
  const cell = col?.COLUMN_DATA_REC?.[0];
  if (!cell) return null;
  const code = cell.CUSTOM_COLUMN_DATA?.trim() ?? "";
  return cell.OPTION_NAME?.trim() || STTS_LABEL[code] || null;
}

/**
 * 게시글 제목(= 업무명)·상태·flow가 만든 짧은 링크. 알림은 `postId`만 줘서 셋 다 여기서만
 * 나온다 (api-spec §6.3).
 *
 * `connectUrl`(`https://flow.team/l/Qmcn5`)은 **로그인 화면을 건너 살아남는 링크**다 —
 * 세션이 없으면 `signin.act?postlink=Qmcn5`로 대상을 들고 가서 로그인 뒤 그 글로 간다.
 * 우리가 만든 `main.act?projectId=…&postId=…`는 그 자리에서 대상을 잃는다 (BUG-024).
 *
 * ponytail: 세 줄 때문에 게시글 상세를 통째로 받는다 — 본문·HTML·댓글 원본까지 딸려 온다.
 * 제목만 주는 엔드포인트가 없다. 부르는 쪽에서 `postId`를 중복 제거하고 병렬로 부르는 게
 * 지금의 상한이다.
 *
 * `ttl`을 주면 그만큼 데이터 캐시에 남는다 — **제목·링크만 쓰는 쪽**이 준다 (`loadNews`).
 * 상태 배지를 쓰는 쪽은 주지 않는다: 남이 상태를 바꾼 게 늦게 보이면 안 된다.
 * 캐시 한 칸을 여러 사람이 나눠 쓰지만 `postId`는 **자기 알림에서 나온 것뿐이라**
 * (`taskNews`가 `receiverId`로 걸러 낸다) 남의 글 제목이 새지 않는다.
 */
export async function getPostBrief(postId: string, ttl?: number) {
  const d = await get<{ title?: string; connectUrl?: string; tasks?: PostTask[] }>(
    `/user/posts/${postId}`,
    "게시글 조회",
    undefined,
    ttl,
  );
  return {
    title: d.title?.trim() || null,
    url: d.connectUrl?.trim() || null,
    // 업무가 아닌 글(공지·회의록)은 `tasks`가 비어 있다 — 그때는 상태가 없다.
    status: taskStatus(d.tasks?.[0]),
  };
}

/* ── 업무 단일 필드 수정 (api-spec §6.4, PRD §13 A4) ───────────────────── */

const taskField = (projectId: string, taskId: string, field: string) =>
  `/user/posts/projects/${projectId}/tasks/${taskId}/${field}`;

/** 마감일. `YYYYMMDD`. 시작일보다 빠르면 flow가 거절하고, 그 사유가 그대로 올라온다. */
export async function setTaskEndDate(projectId: string, taskId: string, endDate: string) {
  await call(taskField(projectId, taskId, "end-date"), "마감일 수정", {
    method: "PATCH",
    body: { endDate },
  });
}

export async function setTaskPriority(
  projectId: string,
  taskId: string,
  priority: TaskPriority,
) {
  await call(taskField(projectId, taskId, "priority"), "우선순위 수정", {
    method: "PATCH",
    body: { priority },
  });
}

/**
 * 담당자 교체. 넘긴 목록으로 **덮는다** — 추가가 아니다.
 * 프로젝트 참여자가 아닌 사람을 넣으면 flow가 거절한다.
 */
export async function setTaskWorkers(projectId: string, taskId: string, workerIds: string[]) {
  await call(taskField(projectId, taskId, "worker"), "담당자 수정", {
    method: "PATCH",
    body: { workers: workerIds.map((workerId) => ({ workerId })) },
  });
}

/** api-spec §5.4. 담당자 후보 목록이다. */
export interface Participant {
  userId: string;
  name: string;
}

export async function listParticipants(projectId: string): Promise<Participant[]> {
  const data = await get<{ participants?: Participant[] }>(
    `/user/projects/${projectId}/participants`,
    "참여자 조회",
  );
  return data.participants ?? [];
}

/* ── 방치된 업무 (api-spec §5.6·§6.1, PRD §13 B5) ─────────────────────── */

/** 프로젝트의 상태 옵션. `optionSrno` → 사람이 읽는 이름 (api-spec §5.6). */
export async function listStatusOptions(projectId: string): Promise<Map<string, string>> {
  const data = await get<{ options?: { optionSrno: string; optionName: string }[] }>(
    `/user/projects/${projectId}/columns/status`,
    "상태 옵션 조회",
  );
  return new Map((data.options ?? []).map((o) => [o.optionSrno, o.optionName]));
}

/** 마감일이 한참 지났는데 아직 안 끝난 업무 한 줄. */
export interface StaleTask {
  taskId: string;
  postId: string;
  title: string;
  /** `YYYYMMDD` */
  endDate: string;
  /** 등록일 `YYYYMMDD`. 없으면 빈 문자열이다. */
  regDate: string;
  /** 상태 이름. 옵션 조회가 실패하면 코드가 그대로 남는다 — 그래도 화면에 보여 준다. */
  status: string;
  /** 담당자 실명. 없으면 빈 배열이다. */
  workers: string[];
}

/** 내가 담당인 업무 한 건 (PRD §6.5). */
export interface MyTask {
  /** raw `TASK_SRNO` — 상태·마감일 바꾸기가 이 값을 요구한다. */
  taskId: string;
  /** `colabo_commt_srno` — flow 딥링크를 이걸로 만든다. */
  postId: string;
  title: string;
  /** `YYYYMMDD`. 미설정이면 빈 문자열 — 실측 880건 중 720건이 그렇다. */
  endDate: string;
  /** 등록일 `YYYYMMDD`. 없으면 빈 문자열이다. */
  regDate: string;
  /** 등록자 실명 (`authorOf`). 이름뿐이다 — 부서·직급·사진은 못 온다. */
  author: string;
  /** 상태 라벨. 못 풀면 빈 문자열이다. */
  status: string;
  /** 완료 상태인가. */
  done: boolean;
  /**
   * 부모 업무의 `taskId`. 최상위면 `-1`이다.
   *
   * 부모가 같은 목록에 없으면 최상위처럼 그린다 — 실측 하위 191건 중 부모까지 내 담당인 건
   * 26건뿐이고, 없는 부모를 받으려면 건당 조회 165회다 (PRD §13 D1).
   */
  upTaskId: string;
}

/** 담당자 필터가 걸리는 컬럼 번호. `WORKER_ID`가 기본 1번이다 (api-spec §6.1). */
const WORKER_COLUMN = "1";

/** 프로젝트당 페이지 상한. 100건 × 3 = 300건. 넘치면 `hasMore`로 알린다. */
const MY_TASKS_MAX_PAGES = 3;

/** 내 업무 응답을 데이터 캐시에 두는 시간(초). REST 분당 120회 중 이 화면 한 번이 ~60회다. */
const MY_TASKS_TTL = 60;

/**
 * 한 프로젝트에서 **내가 담당인** 업무 전부 (PRD §6.5).
 *
 * 담당자 필터는 서버가 적용한다 — `filterRecords`에 `WORKER_ID IN <userId>`를 넣으면 내
 * 업무만 온다. 전량 받아 클라이언트에서 거르는 길도 있지만 한 프로젝트가 600건이라
 * 페이지가 여섯 장이고, 필터를 걸면 같은 프로젝트가 한 장으로 끝난다.
 *
 * `userId`는 **반드시 로그인 세션에서 채운다** (PRD §8.1). 공용 API 키에 남의 ID를 넣으면
 * 그 사람 업무가 그대로 나온다 — 요청에서 받은 값을 여기 넘기면 그게 유출 경로다.
 *
 * 완료 판정은 `optionCategory === "2"`다. 프로젝트가 커스텀 상태(`STATUS`)를 쓰면 라벨이
 * `optionName`으로 오고 base 상태(`STTS`)는 코드만 오는데, 두 체계가 공통으로 주는 값이
 * 이 카테고리 하나뿐이다.
 */
export async function listMyTasks(
  projectId: string,
  userId: string,
): Promise<{ tasks: MyTask[]; hasMore: boolean }> {
  const filter = encodeURIComponent(
    JSON.stringify([{ COLUMN_SRNO: WORKER_COLUMN, OPERATOR_TYPE: "IN", FILTER_DATA: userId }]),
  );

  const tasks: MyTask[] = [];
  let hasMore = false;
  // **`cursor`는 오프셋이 아니라 페이지 번호다** (0, 1, 2…). `cursor=100`을 넣으면 100번째
  // 페이지를 달라는 뜻이라 빈 배열 + `hasNext: false`가 오고, 그러면 2쪽부터 조용히
  // 사라진다 — 실측 236건 프로젝트가 100건으로 보였다 (bug-report BUG-030).
  // 다음 번호는 응답의 `lastCursor`가 준다 (끝이면 `-1`).
  let cursor = 0;

  for (let page = 0; page < MY_TASKS_MAX_PAGES; page++) {
    const data = await get<{ tasks?: FilterTask[]; hasNext?: boolean; lastCursor?: number }>(
      `/user/posts/projects/${projectId}/tasks/filter?pageSize=${SIZE}&cursor=${cursor}&filterRecords=${filter}`,
      "내 업무 조회",
      undefined,
      MY_TASKS_TTL,
    );

    for (const task of data.tasks ?? []) {
      // 커스텀 상태를 먼저 본다. base `STTS`는 커스텀 프로젝트에서 `0`으로 평평하게
      // 와서, 그걸 읽으면 `진행`이 `대기`로 보인다 (BUG-028과 같은 함정).
      const cell = columnData(task, "STATUS")[0] ?? columnData(task, "STTS")[0];
      tasks.push({
        taskId: task.taskId,
        postId: task.postId,
        title: columnData(task, "TASK_NM")[0]?.customColumnData ?? "제목 없는 업무",
        endDate: columnData(task, "END_DT")[0]?.customColumnData ?? "",
        regDate: regDateOf(task),
        author: authorOf(task),
        status: cell?.optionName?.trim() || STTS_LABEL[cell?.customColumnData ?? ""] || "",
        done: cell?.optionCategory === "2",
        upTaskId: task.upTaskId || "-1",
      });
    }

    if (!data.hasNext || data.lastCursor === undefined || data.lastCursor < 0) break;
    if (page === MY_TASKS_MAX_PAGES - 1) hasMore = true;
    cursor = data.lastCursor;
  }

  return { tasks, hasMore };
}

/** 방치 업무 스캔 상한. 100건 × 3 = 300건. 넘치면 `hasMore`로 알린다. */
const STALE_MAX_PAGES = 3;

/**
 * `before`(`YYYYMMDD`)보다 마감일이 이른, 아직 안 끝난 업무 (PRD §13 B5).
 *
 * flow는 마감일 범위 필터를 공개하지 않았다 (`IN` 연산자만 문서화 — api-spec §6.1).
 * 그래서 전량 받아 클라이언트에서 날짜를 비교한다.
 *
 * 완료 판정은 **상태 이름에 "완료"가 들어가는지**로 한다. `optionCategory`로 완료/미완료를
 * 가른다는 건 문서의 추정이라 믿지 않고, 대신 상태 이름을 화면에 같이 띄워 사람이 확인하게 한다.
 */
export async function listStaleTasks(
  projectId: string,
  before: string,
): Promise<{ tasks: StaleTask[]; hasMore: boolean }> {
  // 상태 옵션은 없어도 화면이 선다 — 코드가 그대로 보일 뿐이다.
  const statuses = await listStatusOptions(projectId).catch(() => new Map<string, string>());

  const tasks: StaleTask[] = [];
  let hasMore = false;
  // 페이지 번호다 — 오프셋이 아니다 (`listMyTasks` 주석, bug-report BUG-030).
  let cursor = 0;

  for (let page = 0; page < STALE_MAX_PAGES; page++) {
    const data = await get<{ tasks?: FilterTask[]; hasNext?: boolean; lastCursor?: number }>(
      `/user/posts/projects/${projectId}/tasks/filter?pageSize=${SIZE}&cursor=${cursor}`,
      "업무 조회",
    );

    for (const task of data.tasks ?? []) {
      const endDate = columnData(task, "END_DT")[0]?.customColumnData ?? "";
      if (!endDate || endDate >= before) continue;

      const code = columnData(task, "STTS")[0]?.customColumnData ?? "";
      const status = statuses.get(code) || code;
      if (status.includes("완료")) continue;

      tasks.push({
        taskId: task.taskId,
        postId: task.postId,
        title: columnData(task, "TASK_NM")[0]?.customColumnData ?? "제목 없는 업무",
        endDate,
        regDate: regDateOf(task),
        status,
        workers: columnData(task, "WORKER_ID")
          .map((d) => d.userName || d.customColumnData || "")
          .filter(Boolean),
      });
    }

    if (!data.hasNext || data.lastCursor === undefined || data.lastCursor < 0) break;
    if (page === STALE_MAX_PAGES - 1) hasMore = true;
    cursor = data.lastCursor;
  }

  return { tasks: tasks.sort((a, b) => a.endDate.localeCompare(b.endDate)), hasMore };
}

/* ── 일정 (api-spec §8.2, PRD §13 B3) ─────────────────────────────────── */

/**
 * api-spec §8.2 `Event`. 화면에 쓰는 것만 적었다.
 *
 * 명세는 전부 필수라고 적어 뒀지만 실측(2026-08-03)에선 `eventColor`·`colaboSrno`처럼
 * 빈 문자열로 오는 게 많다. 그래서 앞의 다섯만 필수로 두고 나머지는 optional이다 —
 * 없는 것과 빈 것을 같게 다뤄야 화면이 안 깨진다.
 */
export interface FlowEvent {
  eventSrno: string;
  eventName: string;
  /** `YYYYMMDDHHmmss` */
  eventStartDateTime: string;
  eventFinishDateTime: string;
  /** `"Y"`면 종일 일정이라 시각을 안 보여 준다. */
  allDayYn: string;
  /** 프로젝트에서 만든 일정이면 projectId가 들어 있다. */
  colaboSrno?: string;
  /** 일정에 따로 준 색. `#` 없는 6자리다. 실측에선 늘 비어서 `calendarColor`로 떨어졌다. */
  eventColor?: string;
  /** 달력 색. `#` 없는 6자리(`"D0DA09"`). 일정 색이 없을 때 이걸 쓴다. */
  calendarColor?: string;
  /** 달력 이름. 달력이 하나뿐이면 내 이름이라 화면에 안 쓴다 (`ScheduleList`). */
  calendarName?: string;
  /** 비어 있지 않으면 반복 일정이다. 주기(`WEEKLY`·`FR`…)는 상세 §8.5에만 있다. */
  repeatSrno?: string;
  /**
   * 이 일정에 대한 **내** 참석 응답.
   *
   * 값 목록이 명세 어디에도 없다 — §8.2·§8.5·§9 다 필드 이름만 적혀 있고, MCP 쓰기 도구도
   * 참석 응답을 다루지 않는다. 실측으로 본 건 `"ATTENDING"`(내가 수락)과 `""`(아직 응답 안
   * 함, 또는 참석자가 없는 일정) 둘뿐이다.
   *
   * 그래서 화면은 `"ATTENDING"`만 긍정으로 읽고 나머지는 아무것도 그리지 않는다
   * (`ScheduleList`). 모르는 값을 "불참"으로 오독하는 것보다 안 그리는 편이 낫다.
   *
   * 상세(§8.5)의 최상위 같은 이름 필드는 비어 있고 내 응답은 `attendances[]` 안에만 있다 —
   * 목록과 어긋난다. 목록 응답의 이 필드만 믿는다.
   */
  attendanceStatus?: string;
}

/**
 * 일정 조회 (PRD §13 B3). `userId`를 주면 **그 사람 일정**이다 — `/user/*`에서
 * 타인 조회가 남아 있는 유일한 파라미터다 (api-spec §8.2).
 *
 * 남의 일정이 새는 것처럼 보이지만, flow가 공개 범위를 서버에서 판정한다
 * (`privateYn`·`publicYn`). 비공개 일정은 응답에 오지 않는다.
 *
 * ponytail: 첫 페이지(100건)만 본다. 하루~한 주 창을 보는 화면이라 넘칠 일이 없다.
 */
export async function listEvents(
  startDateTime: string,
  endDateTime: string,
  userId?: string,
): Promise<FlowEvent[]> {
  const query = new URLSearchParams({ startDateTime, endDateTime, pageSize: String(SIZE) });
  if (userId) query.set("userId", userId);

  const data = await get<{ events?: FlowEvent[] }>(
    `/user/calendars/events?${query}`,
    "일정 조회",
  );
  // 시각순으로 세워서 넘긴다. 응답 순서는 보장이 없고, 하루 일정을 뒤죽박죽 늘어놓으면
  // "다음이 뭔지"를 눈으로 다시 정렬해야 한다. 부르는 자리 두 곳이 같은 순서를 쓴다.
  return (data.events ?? []).sort((a, b) =>
    a.eventStartDateTime.localeCompare(b.eventStartDateTime),
  );
}

/* ── 검색 (api-spec §9.1~9.2, PRD §6.4) ───────────────────────────────── */

/**
 * 검색 결과의 글 한 건. **제목·본문에 `!#!…!#!` 하이라이트가 들어 있다** — flow가 맞은
 * 자리를 표시해 준 것이라 그리는 쪽이 쪼개 쓴다 (`splitHighlight`).
 */
export interface SearchPost {
  postId: string;
  projectId: string;
  /** 게시글 제목(`commtTtl`). 제목 없는 글도 있어서 빌 수 있다. */
  title: string;
  /** 본문 발췌(`content`). */
  content: string;
  /** 프로젝트명(`ttl`). 검색 API만 이 이름을 같이 준다. */
  project: string;
  registerName: string;
  /** `YYYYMMDDHHmmss` */
  at: string;
}

export interface SearchProject {
  projectId: string;
  /** 프로젝트명(`ttl`). 하이라이트 포함. */
  title: string;
  participantCount: string;
  /** 마지막 수정 `YYYYMMDDHHmmss` */
  at: string;
}

/**
 * 글 검색. 팔레트가 부르는 두 호출 중 하나다 (PRD §6.4).
 *
 * MCP `flow_search`로는 이걸 못 만든다 — 거기서 오는 `title`은 **프로젝트** 제목이고
 * 게시글 제목에 해당하는 필드가 응답에 없다 (실측 2026-07-29). REST는 `ttl`(프로젝트)과
 * `commtTtl`(게시글)을 둘 다 준다.
 *
 * 딥링크는 여기 없다. 게시글 상세를 따로 불러야 `connectUrl`이 나오는데(`getPostBrief`)
 * 결과 전체를 미리 푸는 건 검색 한 번에 호출 여덟 번이라, 눌린 것만 푼다 (`/api/go`).
 *
 * ponytail: 첫 페이지만 본다. `score`+`pageTargetId`로 다음 장을 받을 수 있지만
 * (api-spec §9.1) 상위 몇 줄이 안 맞으면 검색어를 고치는 게 빠르다.
 */
export async function searchPosts(searchWord: string, size: number): Promise<SearchPost[]> {
  const query = new URLSearchParams({ searchWord, size: String(size) });
  const data = await get<{
    posts?: {
      postId: string;
      projectId: string;
      commtTtl?: string;
      content?: string;
      ttl?: string;
      registerName?: string;
      registeredDateTime?: string;
    }[];
  }>(`/user/search/posts?${query}`, "글 검색");

  return (data.posts ?? []).map((p) => ({
    postId: p.postId,
    projectId: p.projectId,
    title: p.commtTtl?.trim() ?? "",
    content: p.content?.trim() ?? "",
    project: p.ttl?.trim() ?? "",
    registerName: p.registerName ?? "",
    at: p.registeredDateTime ?? "",
  }));
}

/**
 * 프로젝트 검색.
 *
 * 프로젝트에는 딥링크가 없다 — 이 응답에도, 상세에도 없다. 상세의 링크성 값은
 * `INVT_URL`(초대 URL) 하나뿐이라 화면은 `main.act?projectId=`를 조립한다 (MCP도 같은 걸
 * 준다). 세션이 없으면 대상을 잃는 링크고, 게시글의 `connectUrl`에 해당하는 짝이 없다
 * (api-spec §9.2, BUG-024).
 */
export async function searchProjects(
  searchWord: string,
  size: number,
): Promise<SearchProject[]> {
  const query = new URLSearchParams({ searchWord, size: String(size) });
  const data = await get<{
    projects?: { projectId: string; ttl?: string; participantCount?: string; editedDateTime?: string }[];
  }>(`/user/search/projects?${query}`, "프로젝트 검색");

  return (data.projects ?? []).map((p) => ({
    projectId: p.projectId,
    title: p.ttl?.trim() ?? "",
    participantCount: p.participantCount ?? "",
    at: p.editedDateTime ?? "",
  }));
}

/**
 * 워크리스트 멘션에 알림의 댓글 본문을 붙인다.
 *
 * 조인 키는 `발신자 ID + 등록 일시`. 두 응답이 같은 알림 레코드에서 나오므로 1:1로 맞는다
 * (워크리스트는 `postId`를 주지 않아서 그걸로는 못 묶는다).
 * 알림 쪽은 실명을 주므로 `from`도 아이디에서 실명으로 바꾼다 — `djseo7`보다 `서동조`가 읽힌다.
 */
export function mergeMentionComments<T extends MentionRow>(
  mentions: readonly T[],
  alarms: readonly MentionAlarm[],
  /**
   * 지금 로그인한 flow user_id. `receiverId`가 다른 알림은 **버린다** — API Key가 발급자
   * 한 명에게 묶여 있어서(파일 상단 주석), 이 한 줄이 남의 멘션이 새는 걸 막는다.
   */
  me: string,
): T[] {
  const key = (from: string, at: string) => `${from} ${at}`;
  const mine = alarms.filter((a) => a.receiverId.toLowerCase() === me.toLowerCase());
  const byKey = new Map(mine.map((a) => [key(a.registerId, a.registeredDateTime), a]));

  return mentions.map((mention) => {
    const alarm = byKey.get(key(mention.from, mention.at));
    if (!alarm) return mention;
    return {
      ...mention,
      from: alarm.registerName || mention.from,
      content: alarm.content?.trim() || undefined,
      isReply: alarm.replyId !== "-1",
      projectId: alarm.projectId || undefined,
      id: alarm.alarmId || undefined,
      // flow가 `readYn`을 안 주면 "안 읽었다"고 단정하지 않는다 — 읽음 표시가 헛돌면
      // 눌러도 화면이 그대로라 사용자가 고장으로 읽는다.
      unread: alarm.readYn === "N",
      postId: alarm.postId || undefined,
    };
  });
}
