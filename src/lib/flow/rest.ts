/**
 * flow REST — MCP로 못 가져오는 것만 (api-spec §7.1 알림, §6.1 업무 필터).
 *
 * flow 접근은 원칙적으로 MCP다(`mcp.ts`). REST를 쓰는 두 곳:
 * - **멘션 댓글 본문**: `flow_get_my_worklist`가 주는 멘션에는 본문이 없다(발신자·시각·제목뿐)
 *   이고, MCP `flow_list_alarms`는 서버측 스키마 검증이 `alarmType: null`에서 터진다
 *   (docs/bug-report.md). REST 알림은 `content`와 `postId`·`replyId`를 함께 준다.
 * - **`taskSrno` → `postId`**: `resolvePostId` 주석 참고. `flow_list_project_items`는
 *   `postId`만 주고 `taskId`가 응답에 아예 없어서 두 ID를 이어 붙일 수 없다 (실측).
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

import { getApiKey } from "@/lib/auth";

const BASE = process.env.FLOW_API_BASE ?? "https://api.flow.team";

/** 알림 API는 날짜 필터가 없다. 최대치로 받아서 워크리스트 멘션에 붙인다. */
const SIZE = 100;

/** api-spec §7.1 `Alarm`. 화면에 쓰는 것만 적었다. */
export interface MentionAlarm {
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
}

interface Envelope<T> {
  response?: {
    success?: boolean;
    data?: T;
    error?: { code: string; message: string };
  };
}

/**
 * REST는 모든 응답을 `response.data`로 한 겹 싼다. 그 겹을 벗기고 실패는 던진다.
 *
 * 키는 **개인 키 → 환경변수** 순이다. 이 한 줄이 이 파일의 세 호출을 모두 덮는다 —
 * 로그인한 사람이 자기 키를 등록해 뒀으면 셋 다 그 사람 기준으로 돌고, 없으면 예전처럼
 * 발급자 키로 돈다(파일 상단 주석의 열화 그대로).
 *
 * `apiKey`를 직접 넘기는 건 **등록 직전 검증**용이다 (`app/login/actions.ts`). 그때는
 * 아직 쿠키에 넣기 전이라 쿠키에서 읽을 수 없다.
 */
async function get<T>(path: string, what: string, apiKey?: string): Promise<T> {
  // `cookies()`는 요청 스코프 밖에서 던진다. 이 파일을 요청 없이 직접 부르는 곳이
  // 단위 테스트라, 그때는 쿠키를 건너뛰고 환경변수로 간다.
  const key = apiKey ?? (await getApiKey().catch(() => null)) ?? process.env.FLOW_API_KEY;
  if (!key) throw new Error("FLOW_API_KEY 없음");

  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-flow-api-key": key },
    cache: "no-store",
  });
  const body = ((await res.json()) as Envelope<T>).response;
  if (!res.ok || !body?.success || !body.data) {
    throw new Error(`${what} 실패 (${res.status}): ${body?.error?.message ?? ""}`);
  }
  return body.data;
}

/** 멘션 알림. 실패하면 던진다 — 호출부가 본문 없이 화면을 세우면 된다. */
export async function listMentionAlarms(): Promise<MentionAlarm[]> {
  const data = await get<{ alarms?: { alarms?: MentionAlarm[] } }>(
    `/user/alarms?filters=MENTION&size=${SIZE}`,
    "알림 조회",
  );
  // `alarms`가 두 번 중첩된다 — 오타가 아니다 (api-spec §7.1).
  return data.alarms?.alarms ?? [];
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

/** api-spec §6.1 `tasks[]`. 두 ID를 잇는 데 필요한 두 필드만 적었다. */
interface FilterTask {
  /** raw `TASK_SRNO` — 워크리스트·스탠드업의 `taskSrno`와 같은 값이다. */
  taskId: string;
  /** `colabo_commt_srno` — 댓글 도구가 요구하는 ID다. */
  postId: string;
}

/**
 * `taskSrno` → `postId`. 이 둘은 다른 ID 공간인데 `flow_create_comment`는 `postId`를
 * 요구한다 — `taskSrno`를 그대로 넘기면 flow가 404 "삭제되었거나 존재하지 않는
 * 콘텐츠입니다"를 준다 (docs/bug-report.md BUG-005).
 *
 * 업무명을 `searchWord`로 서버에 넘겨 먼저 줄인다. 프로젝트를 전량 훑으면 페이지가
 * 수십 장이고(실측 한 프로젝트 600건+), 검색을 걸면 같은 실측이 2건으로 준다.
 * 최종 판정은 항상 `taskId` 일치다 — 같은 이름의 업무가 여럿 있어서 이름으로는 못 고른다.
 *
 * 이 조회로 남의 업무가 새지는 않는다. 호출부가 넘기는 `taskSrno`·업무명은 그 사람의
 * 워크리스트에서 나온 것이고, 댓글 자체는 로그인한 사람의 MCP 토큰으로 나가서 flow가
 * 권한을 다시 본다. 여기서 얻는 건 그 업무의 `postId` 하나다.
 *
 * ponytail: 첫 페이지(100건)만 본다. 같은 이름의 업무가 100개를 넘으면 못 찾고,
 * 그때는 화면이 flow 링크로 안내한다.
 */
export async function resolvePostId(
  projectId: string,
  taskSrno: string,
  title: string,
): Promise<string | null> {
  const query = `pageSize=100&searchWord=${encodeURIComponent(title)}`;
  const data = await get<{ tasks?: FilterTask[] }>(
    `/user/posts/projects/${projectId}/tasks/filter?${query}`,
    "업무 조회",
  );
  return data.tasks?.find((t) => t.taskId === taskSrno)?.postId ?? null;
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
    };
  });
}
