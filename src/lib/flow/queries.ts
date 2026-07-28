/**
 * 오늘 화면 데이터 (PRD §6.1). flow MCP 실측 응답 그대로를 타입으로 박았다.
 *
 * MCP가 이미 임박/밀림/방치를 분류해서 준다 → `lib/aggregate/classifyTasks`는 여기서 쓰지 않는다.
 * (worklist 응답에 progress·lastActivityAt이 없어서 재분류할 재료 자체가 없다.)
 * 우리가 하는 집계는 멘션 접기(`groupMentions`) 하나뿐이다.
 */

import { rollupProjects, type ProjectRollup, type StandupMember } from "@/lib/aggregate";
import { getSession } from "@/lib/auth";
import { createFlowMcp, type FlowMcp } from "./mcp";
import { listMentionAlarms, listProjects, mergeMentionComments, type MentionRow } from "./rest";
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

export interface TodayData {
  /** 조회 기준 시각. 렌더 중 `Date.now()`를 부르지 않으려고 여기서 찍어 내려보낸다. */
  now: number;
  worklist: Worklist;
  /** MCP 계약이 깨지면 null. 워크리스트만으로도 화면은 선다. */
  focus: FocusPick[] | null;
  /** 방치된 업무. 워크리스트가 목록 없이 건수만 줘서 따로 만들어 낸다 (`staleTasks`). */
  stale: WorklistTask[] | null;
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
  const [worklist, picks, wide, alarms] = await Promise.all([
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
  const mentions = alarms
    ? mergeMentionComments(worklist.mentions, alarms, worklist.user.id)
    : worklist.mentions;
  return {
    now,
    worklist: {
      ...worklist,
      mentions,
      overdueActive: withLastComment(worklist.overdueActive, picks),
    },
    focus,
    stale,
    projectIds,
  };
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

  // 스탠드업이 나온 다음에 부른다 — 이름 목록이 여기서 나온다.
  const projectIds = await projectIdMap(
    mcp,
    standup.members.flatMap((m) => projectNames([...m.imminent, ...m.blocked])),
  );

  return { now, dept: target, divisions, standup, projectIds };
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
