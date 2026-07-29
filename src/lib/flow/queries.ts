/**
 * 오늘 화면 데이터 (PRD §6.1). flow MCP 실측 응답 그대로를 타입으로 박았다.
 *
 * MCP가 이미 임박/밀림/방치를 분류해서 준다 → `lib/aggregate/classifyTasks`는 여기서 쓰지 않는다.
 * (worklist 응답에 progress·lastActivityAt이 없어서 재분류할 재료 자체가 없다.)
 * 우리가 하는 집계는 멘션 접기(`groupMentions`) 하나뿐이다.
 */

import { rollupProjects, type ProjectRollup, type StandupMember } from "@/lib/aggregate";
import { kstYmd } from "@/lib/aggregate/date";
import { getSession } from "@/lib/auth";
import { createFlowMcp, type FlowMcp } from "./mcp";
import {
  getPostBrief,
  listEmployeeIds,
  listEvents,
  listMentionAlarms,
  listProjects,
  listTaskAlarms,
  mergeMentionComments,
  type FlowEvent,
  type MentionAlarm,
  type MentionRow,
} from "./rest";
import { searchProjectIds } from "./search";

export interface WorklistTask {
  taskSrno: number;
  title: string;
  status: string;
  project: string;
  /** YYYYMMDD */
  endDate: string;
  /** 음수면 지남 */
  daysLeft: number;
  link: string;
  /** 워크리스트 응답에는 없다. `flow_suggest_my_focus` 픽에서 빌려 붙인다 (`loadToday`). */
  lastComment?: string;
}

/** 워크리스트가 주는 건 발신자·시각·제목뿐이다. 댓글 본문은 `MentionRow`쪽 — 알림 REST에서 붙인다. */
export interface WorklistMention extends MentionRow {
  title: string;
  link: string;
}

export interface Worklist {
  user: { id: string; name: string };
  counts: { imminent: number; overdueActive: number; overdueStale: number; mentions: number };
  imminent: WorklistTask[];
  overdueActive: WorklistTask[];
  mentions: WorklistMention[];
}

export interface FocusPick {
  taskSrno: number;
  title: string;
  project: string;
  status: string;
  endDate: string;
  daysLeft: number;
  score: number;
  reasons: string[];
  comments: number;
  mentions: number;
  lastComment?: string;
  link: string;
}

/** 담당 업무·내가 올린 글에 붙은 알림 한 줄 (PRD §13 B1·B2). */
export interface TaskNews {
  id: string;
  projectId: string;
  postId: string;
  /** 알림을 만든 사람 실명. */
  from: string;
  /** `YYYYMMDDHHmmss` */
  at: string;
  /** 카드에 낼 한 줄. 댓글 본문이 있으면 본문, 없으면 flow 알림 문구. */
  message: string;
  unread: boolean;
  /** flow 게시글 딥링크 (`flowPostUrl`). */
  url: string;
  /** 프로젝트명. 알림은 id만 줘서 따로 풀어 붙인다 — 못 풀면 없다. */
  project?: string;
  /** 업무명(게시글 제목). 이것도 알림이 안 줘서 따로 풀어 붙인다 — 못 풀면 없다. */
  title?: string;
}

/**
 * flow 게시글 딥링크.
 *
 * `flow_search`가 결과마다 돌려주는 `url`이 이 형식이다 — 우리가 지어낸 규칙이 아니다.
 * 알림은 `projectId`와 `postId`를 둘 다 줘서 호출 하나 없이 만든다. (워크리스트의
 * `link`는 flow가 만든 단축 URL이라 이렇게 못 만든다 — 그건 그대로 쓴다.)
 */
export const flowPostUrl = (projectId: string, postId: string) =>
  `https://flow.team/main.act?projectId=${encodeURIComponent(projectId)}&postId=${encodeURIComponent(postId)}`;

export interface TodayData {
  /** 조회 기준 시각. 렌더 중 `Date.now()`를 부르지 않으려고 여기서 찍어 내려보낸다. */
  now: number;
  worklist: Worklist;
  /** MCP 계약이 깨지면 null. 워크리스트만으로도 화면은 선다. */
  focus: FocusPick[] | null;
  /** 방치된 업무. 워크리스트가 목록 없이 건수만 줘서 따로 만들어 낸다 (`staleTasks`). */
  stale: WorklistTask[] | null;
  /** 오늘 일정. 실패하면 null — 카드가 빠진다. */
  events: FlowEvent[] | null;
  /** 프로젝트 이름 → projectId. 워크리스트가 projectId를 안 줘서 쓰기 액션에 필요하다. */
  projectIds: ReadonlyMap<string, string>;
}

/** 로그인 세션의 토큰으로 MCP 클라이언트를 연다. 서버 액션도 이걸 쓴다. */
export async function flowMcp(): Promise<FlowMcp> {
  const session = await getSession();
  if (!session) throw new Error("세션 없음");
  return createFlowMcp(session.accessToken);
}

export async function loadToday(): Promise<TodayData> {
  const mcp = await flowMcp();
  const now = Date.now();

  // ponytail: 보조 데이터는 실패해도 null로 흘린다. flow_list_alarms가 서버측 스키마
  // 오류로 죽는 걸 이미 봤다(docs/bug-report.md) — 한 도구 때문에 화면 전체를 날리지 않는다.
  const today = kstYmd(now);

  const [worklist, picks, wide, alarms, events] = await Promise.all([
    mcp.call<Worklist>("flow_get_my_worklist", { format: "structured" }),
    // 화면에 뿌리는 포커스는 5개인데 20개를 받는다. 나머지 15개는 **마지막 댓글**용이다 —
    // 워크리스트가 댓글 본문을 안 줘서, 밀리는 업무가 포커스 후보에 있으면 거기서 빌려 온다.
    // 호출을 하나 더 붙이는 것보다 이미 부르는 도구의 topN을 올리는 게 싸다.
    mcp
      .call<{ picks: FocusPick[] }>("flow_suggest_my_focus", { format: "structured", topN: 20 })
      .then((r) => r.picks)
      .catch(() => null),
    // 같은 워크리스트를 활동 창만 넓혀서 한 번 더 부른다 — 방치된 업무 목록용 (`staleTasks`).
    mcp
      .call<Worklist>("flow_get_my_worklist", { format: "structured", overdueActiveDays: 180 })
      .catch(() => null),
    // 멘션 댓글 본문은 워크리스트에 없다. 실패하면 본문만 빠지고 행은 그대로 뜬다.
    listMentionAlarms().catch(() => null),
    // 오늘 일정 (PRD §13 B3). KST 하루가 곧 화면의 "오늘"이다.
    listEvents(`${today}000000`, `${today}235959`).catch(() => null),
  ]);

  const focus = picks?.slice(0, 5) ?? null;
  const stale = staleTasks(worklist, wide, picks);

  // 포커스·방치 목록이 정해진 다음이라 이름을 다 모은 뒤에 부른다.
  const projectIds = await projectIdMap(
    mcp,
    projectNames([...worklist.overdueActive, ...(focus ?? []), ...(stale ?? [])]),
  );

  // 알림 수신자가 지금 로그인한 사람과 같은 것만 붙는다 (rest.ts). 워크리스트가 주는
  // `user.id`가 알림의 `receiverId`와 같은 공간이다 — 둘 다 flow user_id다.
  const merged = alarms
    ? mergeMentionComments(worklist.mentions, alarms, worklist.user.id)
    : worklist.mentions;
  const mentions = await withMentionStatus(merged);
  return {
    now,
    worklist: {
      ...worklist,
      mentions,
      overdueActive: withLastComment(worklist.overdueActive, picks),
    },
    focus,
    stale,
    events,
    projectIds,
  };
}

/**
 * 헤더 알림 종에 올릴 소식 (PRD §13 B1·B2).
 *
 * 오늘 화면 카드에 있던 걸 셸로 올렸다 — 세 화면 어디서나 같은 종이 뜬다.
 *
 * 알림은 이름을 하나도 안 준다 (`projectId`·`postId`뿐). 프로젝트명은 전량 목록에서,
 * 업무명과 링크는 게시글 상세에서 풀어 붙인다. 이름 조회는 전부 실패를 삼킨다 — 못 풀면
 * 그 줄만 이름이 빠지고 소식은 그대로 뜬다.
 *
 * ponytail: 게시글 상세는 소식 줄 수(`NEWS_LIMIT`)만큼 붙는다. `postId`가 겹치는 알림은
 * 한 번만 부르고(같은 업무에 댓글이 여러 개 달리는 게 흔해서 실측 12건이 게시글 3~4개였다)
 * 나머지는 병렬이라 왕복 한 번 값이다. 더 무거워지면 응답을 캐시하는 게 다음 수다.
 */
export async function loadNews(me: string): Promise<TaskNews[] | null> {
  const [alarms, projects] = await Promise.all([
    listTaskAlarms().catch(() => null),
    listProjects().catch(() => null),
  ]);
  if (!alarms) return null;

  const news = taskNews(alarms, me);
  const nameOf = new Map([...(projects ?? [])].map(([name, id]) => [id, name]));
  const briefs = new Map(
    await Promise.all(
      [...new Set(news.map((n) => n.postId))].map(
        async (postId) => [postId, await getPostBrief(postId).catch(() => null)] as const,
      ),
    ),
  );
  return news.map((n) => {
    const brief = briefs.get(n.postId);
    return {
      ...n,
      project: nameOf.get(n.projectId),
      title: brief?.title ?? undefined,
      // flow가 만든 짧은 링크가 있으면 그걸 쓴다 — 로그인 화면을 건너서도 대상을 지킨다.
      url: brief?.url ?? n.url,
    };
  });
}

/**
 * 헤더 알림 레이어에 올리는 최대 줄 수. 그 아래는 flow 알림함이 할 일이다.
 *
 * 6이었다 — 레이어가 스택으로 펼쳐져 내려와서 그보다 많으면 화면 밖까지 갔다. 목록에 스크롤이
 * 생기고 읽음/안 읽음 탭이 붙어서(v0.18) 6은 탭마다 두세 줄밖에 안 남는다. 12로 올렸다 —
 * 줄 수만큼 게시글 상세가 붙어서(`loadNews`) 여기가 곧 호출 수의 상한이다.
 */
const NEWS_LIMIT = 12;

/**
 * 담당 업무·내가 올린 글 알림을 카드용 한 줄로 (PRD §13 B1·B2).
 *
 * `receiverId`가 로그인한 사람과 다른 건 **버린다** — API Key가 발급자 한 명에게 묶여 있어서
 * (rest.ts 상단 주석), 이 필터가 남의 알림이 새는 걸 막는다. `mergeMentionComments`와 같은
 * 방어선이다.
 */
export function taskNews(alarms: readonly MentionAlarm[], me: string): TaskNews[] {
  return alarms
    .filter((a) => a.receiverId.toLowerCase() === me.toLowerCase())
    .map((a) => ({
      id: a.alarmId,
      projectId: a.projectId,
      postId: a.postId,
      from: a.registerName || a.registerId,
      at: a.registeredDateTime,
      // 본문이 먼저다. `message`는 `"서동조님의 댓글 등록"` 같은 템플릿이라 이름은 이미
      // 등록자 줄에 있고 내용은 전부 `content`에 있다. 둘 다 비는 알림도 실측에 있었다
      // (`message: null` + `content: ""`, 10건 중 2건) — 그때만 기본 문구로 세운다.
      message: a.content?.trim() || a.message?.trim() || "업무에 새 소식이 있어요",
      unread: a.readYn === "N",
      url: flowPostUrl(a.projectId, a.postId),
    }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, NEWS_LIMIT);
}

/**
 * 방치된 업무 목록. 워크리스트는 건수(`counts.overdueStale`)만 주고 목록은 안 준다 —
 * 활동 창(`overdueActiveDays`, 기본 30일)을 상한인 180일로 넓혀 한 번 더 부르고,
 * 기본 창의 "밀리는 업무"에 없는 것만 골라낸다. 30일은 넘었지만 180일 안에 손댄 업무다.
 *
 * 마지막 댓글은 밀리는 업무와 같은 방식으로 붙인다 (`withLastComment`) — 방치된 업무일수록
 * "왜 멈췄는지"가 마지막 댓글에 적혀 있다.
 *
 * ponytail: 180일까지가 이 도구의 상한이라 그보다 오래 방치된 건 여전히 목록으로 못 온다.
 * 화면에서 `counts.overdueStale`와 목록 수를 비교해 못 가져온 건수를 그대로 밝힌다.
 */
function staleTasks(
  worklist: Worklist,
  wide: Worklist | null,
  picks: FocusPick[] | null,
): WorklistTask[] | null {
  if (!wide) return null;
  const active = new Set(worklist.overdueActive.map((t) => t.taskSrno));
  const stale = wide.overdueActive
    .filter((t) => !active.has(t.taskSrno))
    .sort((a, b) => a.daysLeft - b.daysLeft); // 많이 지난 것부터 (daysLeft는 음수)
  return withLastComment(stale, picks);
}

/**
 * 밀리는 업무·방치된 업무에 마지막 댓글을 붙인다. `taskSrno`로 포커스 픽과 맞춘다.
 *
 * ponytail: 포커스 후보(topN 20) 밖으로 밀린 업무는 댓글 없이 나온다. `resolvePostId`
 * (rest.ts)로 업무마다 `postId`를 얻어 `flow_get_post`를 부를 수는 있지만, 업무 한 줄에
 * REST 1회 + MCP 1회다 — 댓글 하나 더 보려고 화면 열 때마다 수십 번 왕복할 일은 아니다.
 */
function withLastComment(tasks: WorklistTask[], picks: FocusPick[] | null): WorklistTask[] {
  if (!picks) return tasks;
  const byTask = new Map(
    picks.filter((p) => p.lastComment).map((p) => [p.taskSrno, p.lastComment]),
  );
  return tasks.map((t) =>
    byTask.has(t.taskSrno) ? { ...t, lastComment: byTask.get(t.taskSrno) } : t,
  );
}

/**
 * 멘션 줄에 업무 상태를 붙인다 (BUG-028).
 *
 * 워크리스트도 알림도 상태를 안 준다. 전에는 이미 받아 둔 담당 업무 목록에서 링크로 찾아
 * 빌렸는데, 멘션은 **내가 담당이 아닌** 업무에도 온다 — 실측 17건 중 12건이 그 목록에
 * 아예 없어서 배지가 빠졌다. 그래서 게시글 상세에서 직접 읽는다.
 *
 * ponytail: `postId`를 중복 제거하고 병렬로 부른다 (`loadNews`와 같은 방식) — 같은 업무의
 * 멘션이 여러 건이라 실측 17건이 게시글 12개였다. 실패는 삼킨다: 그 줄만 배지가 빠진다.
 * 무거워지면 응답을 캐시하는 게 다음 수다.
 */
async function withMentionStatus(mentions: WorklistMention[]): Promise<WorklistMention[]> {
  const ids = [...new Set(mentions.map((m) => m.postId).filter(Boolean))] as string[];
  if (!ids.length) return mentions;
  const statusOf = new Map(
    await Promise.all(
      ids.map(
        async (postId) =>
          [postId, (await getPostBrief(postId).catch(() => null))?.status ?? undefined] as const,
      ),
    ),
  );
  return mentions.map((m) =>
    m.postId ? { ...m, status: statusOf.get(m.postId) } : m,
  );
}

/** 업무 목록에서 프로젝트 이름만 뽑는다. */
const projectNames = (tasks: readonly { project: string }[]) => tasks.map((t) => t.project);

/* ── 리스크 보드 · 팀 (PRD §6.2, §6.3) ────────────────────────────────── */

export interface Division {
  divisionCode: string;
  divisionName: string;
  upperDivisionCode: string;
}

export interface Standup {
  dept: string;
  counts: { members: number; imminent: number; blocked: number };
  members: StandupMember[];
}

export interface Profile {
  userId: string;
  fullname: string;
  divisionName: string;
  responsibility: string;
  email: string;
}

export interface TeamData {
  now: number;
  /** 실제 조회한 부서. 쿼리 없이 들어오면 내 부서. */
  dept: string;
  divisions: Division[];
  standup: Standup;
  /** 프로젝트 이름 → projectId. 스탠드업이 projectId를 안 줘서 쓰기 액션에 필요하다. */
  projectIds: ReadonlyMap<string, string>;
  /** 부서원 이름 → 오늘 일정 (PRD §13 B3). 조회가 실패한 사람은 키가 아예 없다. */
  events: ReadonlyMap<string, FlowEvent[]>;
}

export interface RiskData extends TeamData {
  rollups: ProjectRollup[];
  /** 이름을 ID로 못 바꾼 프로젝트 수. 그만큼 쓰기 액션이 막힌다. */
  unresolved: number;
}

/**
 * 부서 스탠드업 + 부서 목록. `/team`과 `/risk`가 같은 걸 쓴다.
 *
 * 두 화면 모두 `flow_get_team_standup` 한 번이면 끝난다 — 멤버별 임박/밀림 업무를
 * 통째로 주기 때문이다. 프로젝트 59개를 개별 조회하지 않는다 (`rollupProjects` 주석).
 */
export async function loadTeam(dept?: string): Promise<TeamData> {
  const mcp = await flowMcp();
  const now = Date.now();

  const divisionsP = mcp
    .call<{ divisions: Division[] }>("flow_list_divisions")
    .then((r) => r.divisions);
  const target = dept ?? (await mcp.call<Profile>("flow_get_my_profile")).divisionName;

  const [divisions, standup] = await Promise.all([
    divisionsP,
    mcp.call<Standup>("flow_get_team_standup", { dept: target, format: "structured" }),
  ]);

  // 스탠드업이 나온 다음에 부른다 — 이름·부서원 목록이 여기서 나온다.
  const [projectIds, events] = await Promise.all([
    projectIdMap(
      mcp,
      standup.members.flatMap((m) => projectNames([...m.imminent, ...m.blocked])),
    ),
    memberEvents(standup.members, target, now),
  ]);

  return { now, dept: target, divisions, standup, projectIds, events };
}

/** 팀원 일정 조회 상한. 부서원 20명까지 본다 — 그 위는 화면도 못 읽는다. */
const EVENT_MEMBER_LIMIT = 20;

/**
 * 부서원별 오늘 일정 (PRD §13 B3). 스탠드업은 이름만 주므로 `userId`를 먼저 해소한다.
 *
 * 부서원 한 명에 REST 1회다. 실패한 사람은 맵에서 빠지고 나머지는 그대로 뜬다 —
 * 일정 하나 때문에 팀 화면을 날리지 않는다.
 */
async function memberEvents(
  members: readonly StandupMember[],
  dept: string,
  now: number,
): Promise<Map<string, FlowEvent[]>> {
  const ids = await listEmployeeIds(dept).catch(() => null);
  if (!ids) return new Map();

  const today = kstYmd(now);
  const targets = members.slice(0, EVENT_MEMBER_LIMIT).flatMap((m) => {
    const userId = ids.get(m.name);
    return userId ? [[m.name, userId] as const] : [];
  });

  const results = await Promise.all(
    targets.map(([name, userId]) =>
      listEvents(`${today}000000`, `${today}235959`, userId)
        .then((events) => [name, events] as const)
        .catch(() => null),
    ),
  );
  return new Map(results.filter((r): r is readonly [string, FlowEvent[]] => r !== null));
}

/** 위 스탠드업을 프로젝트 단위로 롤업한다. projectId는 `loadTeam`이 이미 해소해 둔 걸 쓴다. */
export async function loadRisk(dept?: string): Promise<RiskData> {
  const team = await loadTeam(dept);
  const rollups = rollupProjects(team.standup.members, team.projectIds);
  return { ...team, rollups, unresolved: rollups.filter((r) => r.projectId === null).length };
}

/**
 * 프로젝트 이름 → projectId. 스탠드업이 projectId를 주지 않아서 필요하다.
 *
 * 두 출처를 겹친다. REST 전량 목록은 **API Key 발급자 기준**이라 화면에 안 뜬 프로젝트까지
 * 알지만 다른 사람이 로그인하면 그 사람 것이 아니고, 검색은 로그인한 사람 권한으로 돌지만
 * **화면에 뜬 이름**만 풀 수 있다. 그래서 검색 결과를 위에 덮는다 — 겹치는 이름은 항상
 * 로그인한 사람 쪽이 이긴다.
 *
 * 검색은 예전에도 매번 돌았다 (MCP 목록 도구가 죽어 있어서 — BUG-007). 늘어난 건 REST 한 번이다.
 */
async function projectIdMap(mcp: FlowMcp, names: Iterable<string>): Promise<Map<string, string>> {
  const [listed, searched] = await Promise.all([
    listProjects().catch(() => null),
    searchProjectIds(mcp, names),
  ]);
  return new Map([...(listed ?? []), ...searched]);
}
