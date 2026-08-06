/**
 * 오늘·팀·리스크 화면 데이터 (PRD §6.1~6.3).
 *
 * 전부 REST 한 갈래에서 나온다. 프로젝트 목록을 받아 프로젝트마다 **담당자 필터**로 업무를
 * 긁고(`listWorkerTasks`), 임박·밀림·방치는 `classifyTasks`가, 포커스 점수는 `scoreFocus`가
 * 만든다 (`lib/aggregate/*`).
 *
 * 예전에는 MCP가 이 셋을 완성된 형태로 줬다. 그런데 방치된 업무는 **건수만** 오고 목록이
 * 없어서 활동 창을 180일로 넓혀 워크리스트를 한 번 더 부르는 우회가 있었고, 그래도 180일이
 * 그 도구의 상한이라 그보다 오래된 건 영영 목록으로 못 왔다. REST는 `EDTR_DTTM`(마지막 수정)을
 * 업무마다 주므로 우리가 직접 가른다 — 창의 상한이 없어졌고 화면이 건수와 목록을 맞출 수 있다.
 *
 * 대가는 호출 수다. 화면 하나가 프로젝트 수만큼(실측 59회) 부르고 분당 상한이 120회라,
 * 업무 조회에 5분 데이터 캐시를 건다 (`listWorkerTasks`의 `TASK_TTL`). 오늘 화면과 내 업무
 * 화면이 **같은 URL**을 부르는 게 그래서 의도다 — 두 화면이 캐시 한 칸을 나눠 쓴다.
 * 그래도 상한에 걸리는 프로젝트는 생긴다. 조용히 빠지지 않게 `collectTasks`가 실패한 이름을
 * 그대로 내고, 화면이 그걸 적는다.
 */

import { classifyTasks, rollupProjects, scoreFocus } from "@/lib/aggregate";
import type { ClassifiedTask } from "@/lib/aggregate/classifyTasks";
import type { ProjectRollup, StandupMember } from "@/lib/aggregate/rollupProjects";
import type { Task } from "@/lib/aggregate/types";
import { DAY_MS, kstYmd } from "@/lib/aggregate/date";
import { getSession } from "@/lib/auth";
import {
  getPostBrief,
  isChangeLog,
  lastHumanComment,
  listComments,
  listDivisions,
  listEmployees,
  listEvents,
  listMentionAlarms,
  listProjects,
  listTaskAlarms,
  listWorkerTasks,
  type FlowDivision,
  type FlowEmployee,
  type FlowEvent,
  type FlowTask,
  type MentionAlarm,
  type MentionRow,
} from "./rest";
import { flowPostUrl } from "./urls";

export interface WorklistTask {
  taskSrno: number;
  title: string;
  status: string;
  project: string;
  /** YYYYMMDD */
  endDate: string;
  /** 등록일 `YYYYMMDD`. 없으면 빈 문자열이 아니라 undefined다 — 열을 아예 안 그린다. */
  regDate?: string;
  /** 등록자 실명. 이름뿐이다 — 부서·직급·사진은 flow가 안 준다 (`authorOf`). */
  author?: string;
  /**
   * 마지막 수정 `YYYYMMDDHHmmss`. 방치 판정의 재료인데(`classifyTasks`) 화면에는 안 보였다 —
   * 방치 표가 "왜 방치인지"를 말하려면 이 값이 필요하다. 없으면 undefined다.
   */
  editDate?: string;
  /** `low`\|`normal`\|`high`\|`urgent`. 미설정이면 undefined — 표는 높음·긴급만 그린다. */
  priority?: string;
  /** 음수면 지남 */
  daysLeft: number;
  link: string;
  /** 댓글 API가 요구하는 게시글 ID (`colabo_commt_srno`). */
  postId?: string;
}

/** 멘션 한 줄. 본문·읽음은 알림에서, 업무명·링크·상태는 게시글 상세에서 온다. */
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

/** 포커스 한 줄. 업무 줄에 점수·이유·열기를 얹은 것이라 `WorklistTask`를 그대로 넓힌다. */
export interface FocusPick extends WorklistTask {
  score: number;
  reasons: string[];
  comments: number;
  mentions: number;
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

export interface TodayData {
  /** 조회 기준 시각. 렌더 중 `Date.now()`를 부르지 않으려고 여기서 찍어 내려보낸다. */
  now: number;
  worklist: Worklist;
  /** 댓글 조회가 통째로 막히면 null. 나머지 표만으로도 화면은 선다. */
  focus: FocusPick[] | null;
  /** 방치된 업무. 30일 넘게 손 안 댄 밀린 업무다 (`classifyTasks`). */
  stale: WorklistTask[] | null;
  /** 프로젝트 이름 → projectId. 업무 줄은 이름만 들고 있어서 쓰기 액션에 필요하다. */
  projectIds: ReadonlyMap<string, string>;
  /** 페이지 상한(300건)에 걸린 프로젝트 이름. */
  truncated: string[];
  /** 못 읽은 프로젝트 이름 (권한·429). 둘 중 하나라도 있으면 숫자가 실제보다 적다는 뜻이다. */
  failed: string[];
}

/* ── 프로젝트 훑기 ─────────────────────────────────────────────────────── */

/** 프로젝트 한 개의 조회 결과. */
export interface ProjectTasks {
  projectId: string;
  name: string;
  tasks: FlowTask[];
}

/** 프로젝트를 몇 개씩 동시에 훑을지. */
const CONCURRENCY = 10;

/**
 * 프로젝트 전량 × 넘긴 담당자들의 업무 (PRD §6.5). 오늘·내 업무·팀 화면이 전부 여기서 선다.
 *
 * `userIds`는 **반드시 세션이나 부서 명단에서 채운다** (PRD §8.1). 공용 API 키에 남의 ID를
 * 넣으면 그 사람 업무가 그대로 나온다 — 요청에서 받은 값을 여기 넘기면 그게 유출 경로다.
 *
 * 한 프로젝트가 막혀도(권한·429) 나머지는 그대로 보여 준다. 실패한 이름은 `failed`로 내고,
 * 페이지 상한(300건)에 걸린 이름은 `truncated`로 낸다 — 조용히 적게 보이는 게 제일 나쁘다.
 *
 * 10개씩 잘라 돌지 않고 **일꾼 10명이 줄에서 하나씩 집어 간다**. 잘라 돌면 묶음마다 제일 느린
 * 프로젝트를 아홉이 기다리는데, 실측으로 그 대기가 컸다 — 프로젝트 63건에 대기 합계 30.9초,
 * 묶음 방식 실제 11.8초, 일꾼 방식 하한 3.5초.
 *
 * 결과는 **프로젝트 순서 그대로** 담는다. 도착 순으로 밀어 넣으면 마감일이 같은 업무들의
 * 순서가 매번 달라진다 (`classifyTasks`의 정렬이 안정 정렬이라 입력 순서가 그대로 보인다).
 */
export async function collectTasks(
  userIds: readonly string[],
): Promise<{ rows: ProjectTasks[]; truncated: string[]; failed: string[] }> {
  const projects = [...(await listProjects())].map(([name, projectId]) => ({ name, projectId }));

  const out: (ProjectTasks | null)[] = new Array(projects.length).fill(null);
  const flag: ("truncated" | "failed" | null)[] = new Array(projects.length).fill(null);

  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, projects.length) }, async () => {
      // `next++`는 쪼개지지 않는다 — 읽고 더하는 사이에 `await`가 없다.
      for (let i = next++; i < projects.length; i = next++) {
        const p = projects[i];
        const got = await listWorkerTasks(p.projectId, userIds).catch(() => null);
        if (!got) {
          flag[i] = "failed";
          continue;
        }
        if (got.hasMore) flag[i] = "truncated";
        out[i] = { ...p, tasks: got.tasks };
      }
    }),
  );

  return {
    rows: out.filter((row): row is ProjectTasks => row !== null),
    truncated: projects.filter((_, i) => flag[i] === "truncated").map((p) => p.name),
    failed: projects.filter((_, i) => flag[i] === "failed").map((p) => p.name),
  };
}

/** 업무 한 건 → 집계 레이어 입력. 날짜는 flow 원본 문자열 그대로 넘긴다 (`lib/aggregate/types`). */
function toTask(task: FlowTask, project: ProjectTasks): Task {
  return {
    id: task.taskId,
    title: task.title,
    projectId: project.projectId,
    projectName: project.name,
    due: task.endDate || null,
    // 밀림과 방치를 가르는 유일한 재료다. 이게 비면 그 업무는 방치로 떨어진다.
    lastActivityAt: task.editDate || null,
    status: task.status || null,
    done: task.done,
    url: flowPostUrl(project.projectId, task.postId),
  };
}

/**
 * 분류 결과 한 건 → 화면 한 줄.
 *
 * `regDate`·`author`·`postId`는 집계 타입에 없어서 원본에서 다시 꺼낸다 — 그 셋은 화면
 * 표시용이고 분류에는 안 쓴다.
 */
function toRow(entry: ClassifiedTask, origin: ReadonlyMap<string, FlowTask>): WorklistTask {
  const { task } = entry;
  const flow = origin.get(task.id);
  return {
    taskSrno: Number(task.id),
    title: task.title,
    status: task.status ?? "",
    project: task.projectName ?? "",
    endDate: task.due ?? "",
    regDate: flow?.regDate || undefined,
    author: flow?.author || undefined,
    editDate: flow?.editDate || undefined,
    priority: flow?.priority || undefined,
    // 마감일이 없으면 0이다. 그 줄에는 D-DAY 배지를 안 그린다 (task-table.tsx).
    daysLeft: entry.daysUntilDue ?? 0,
    link: task.url ?? "",
    postId: flow?.postId,
  };
}

/* ── 일정 (PRD §13 B3) ─────────────────────────────────────────────────── */

/** 일정 창의 길이. 오늘을 1일째로 세서 오늘 + 엿새다. */
export const EVENT_WINDOW_DAYS = 7;

/**
 * 나의 일정 (PRD §13 B3). KST 오늘 00:00부터 엿새 뒤 23:59까지다.
 *
 * 이번 주(월~일)가 아니라 **오늘부터 굴러가는 이레**다. 달력 주로 자르면 금요일에 열었을 때
 * 이틀치만 남아서, "다음이 언제냐"를 묻는 자리에서 답이 요일에 따라 얇아진다.
 *
 * 부르는 곳은 셸의 레이아웃 하나다 — 서랍·시트가 어느 화면에서나 같은 이레를 연다
 * (app-shell.tsx). 실패하면 `events`가 null이고, 판이 그렇게 적는다.
 *
 * `today`를 같이 낸다. 목록이 "오늘" 소제목을 붙이는 데 쓰는데, 판에서 `Date.now()`를 읽으면
 * 첫 그림과 어긋나 수화가 깨진다. 창의 시작과 같은 시각에서 뽑아야 자정을 넘는 순간에도
 * 소제목이 창 밖을 가리키지 않는다.
 *
 * ponytail: 첫 페이지 100건까지다 (`listEvents`). 이레면 하루 14건까지 담기니 넘칠 일이
 * 드물지만, 넘치면 뒤쪽이 조용히 잘린다 — 더 늘리려면 `cursor`를 따라가야 한다.
 */
export async function loadWeekEvents(): Promise<{
  today: string;
  events: FlowEvent[] | null;
}> {
  const now = Date.now();
  const today = kstYmd(now);
  const to = kstYmd(now + (EVENT_WINDOW_DAYS - 1) * DAY_MS);
  const events = await listEvents(`${today}000000`, `${to}235959`).catch(() => null);
  return { today, events };
}

/* ── 오늘 화면 (PRD §6.1) ──────────────────────────────────────────────── */

export async function loadToday(): Promise<TodayData> {
  const session = await getSession();
  if (!session) throw new Error("세션 없음");
  const now = Date.now();

  // 담당자 필터 값은 **여기서** 세션으로 채운다 (PRD §8.1).
  // 멘션은 곁가지라 실패해도 null로 흘린다 — 알림 하나 때문에 화면 전체를 날리지 않는다.
  // 멘션 본문 조회까지 이 줄에 붙인다 — 알림만 있으면 되는 일이라 업무 조회를 기다릴 이유가 없다.
  const [{ rows, truncated, failed }, mentions] = await Promise.all([
    collectTasks([session.userId]),
    listMentionAlarms(MENTION_DAYS)
      .catch(() => null)
      .then((alarms) => myMentions(alarms, session.userId)),
  ]);

  const projectIds = new Map(rows.map((row) => [row.name, row.projectId]));
  const origin = new Map(rows.flatMap((row) => row.tasks.map((t) => [t.taskId, t] as const)));
  const tasks = rows.flatMap((row) => row.tasks.map((t) => toTask(t, row)));

  const classified = classifyTasks(tasks, now);

  return {
    now,
    worklist: {
      user: { id: session.userId, name: session.fullname },
      counts: {
        imminent: classified.counts.imminent,
        overdueActive: classified.counts.overdueActive,
        overdueStale: classified.counts.overdueStale,
        mentions: mentions.length,
      },
      imminent: classified.imminent.map((c) => toRow(c, origin)),
      overdueActive: classified.overdueActive.map((c) => toRow(c, origin)),
      mentions,
    },
    focus: await pickFocus(tasks, mentions, origin, session.userId, now),
    stale: classified.overdueStale.map((c) => toRow(c, origin)),
    projectIds,
    truncated,
    failed,
  };
}

/* ── 오늘의 포커스 (PRD §6.1.3) ────────────────────────────────────────── */

/** 오늘의 포커스에 올리는 줄 수. */
const FOCUS_LIMIT = 5;

/**
 * 5줄을 채우려고 확인해 보는 픽 수. 여기까지만 댓글을 본다 — 픽마다 REST 1회라
 * 상한(분당 120회)에서 이 숫자가 곧 비용이다.
 */
const FOCUS_CHECK = 8;

/** 댓글 응답을 데이터 캐시에 두는 시간(초). 같은 화면을 다시 열어도 안 부른다. */
const FOCUS_COMMENT_TTL = 300;

/**
 * 포커스 5줄. **피드백 상태인데 마지막 댓글을 내가 쓴 업무는 내린다.**
 *
 * 피드백은 "상대 답을 기다리는 중"이라 내가 답을 남긴 뒤에는 내가 할 일이 없는데, 날짜가
 * 바뀌어도 점수가 높아서(마감 지남 + 댓글 열기) 오늘의 포커스에 계속 남아 있었다. 상태가
 * 완료로 넘어가지 않는 업무가 자리를 잡고 앉으면 정작 오늘 할 일이 밀려난다.
 *
 * 그래서 앞 `FOCUS_CHECK`개의 댓글을 받는다. 한 번의 응답이 **댓글 수**(모달의 "댓글 n개")와
 * **마지막 댓글 작성자**를 같이 준다 — 예전에는 게시글을 먼저 찾느라 피드백 픽마다 REST가
 * 2회였는데(`resolvePostId`), 이제 `postId`가 업무 응답에 이미 있어서 1회다.
 *
 * 못 알아내면 남긴다 — 안 보이게 하는 쪽으로 틀리면 일을 놓친다.
 */
async function pickFocus(
  tasks: readonly Task[],
  mentions: readonly WorklistMention[],
  origin: ReadonlyMap<string, FlowTask>,
  me: string,
  now: number,
): Promise<FocusPick[]> {
  // 열기 신호 = 이 업무에 붙은 멘션 수. 멘션은 `postId`로 오고 업무는 `taskId`라 한 번 옮긴다.
  const taskIdByPost = new Map([...origin.values()].map((t) => [t.postId, t.taskId] as const));
  const signals = new Map<string, number>();
  for (const mention of mentions) {
    const taskId = mention.postId && taskIdByPost.get(mention.postId);
    if (taskId) signals.set(taskId, (signals.get(taskId) ?? 0) + 1);
  }

  const items = scoreFocus(tasks, signals, now, { limit: FOCUS_CHECK });
  const threads = await Promise.all(
    items.map((item) => {
      const postId = origin.get(item.task.id)?.postId;
      return postId ? listComments(postId, FOCUS_COMMENT_TTL).catch(() => null) : null;
    }),
  );

  return items
    .flatMap((item, i) => {
      const comments = threads[i];
      const last = comments && lastHumanComment(comments);
      if (item.task.status === "피드백" && last?.registerId.toLowerCase() === me.toLowerCase()) {
        return [];
      }
      return [
        {
          ...toRow(item.classified, origin),
          score: item.score,
          reasons: item.reasons,
          // 변경 로그는 뺀다 — 실측 14건 중 10건이 그것이라, 세면 "댓글 10개"가 사람 말이
          // 하나도 없는 업무를 대화가 오간 업무처럼 보이게 한다.
          comments: (comments ?? []).filter((c) => !isChangeLog(c.systemCode)).length,
          mentions: signals.get(item.task.id) ?? 0,
        },
      ];
    })
    .slice(0, FOCUS_LIMIT);
}

/* ── 멘션 (PRD §6.1, §13 A5) ──────────────────────────────────────────── */

/**
 * 멘션을 얼마나 거슬러 볼지(일). "나를 부른 사람들"은 최근 자리다.
 *
 * 30일이었다. 그런데 `days`는 결국 **알림 페이지를 몇 장 넘길지**만 정한다 (한 장 100건) —
 * 실측으로 7일도 30일도 최신 20줄이 글자 하나까지 같았고 (2026-08-04), 30일 쪽만 페이지를
 * 두 배로 넘겼다. 같은 화면에 호출만 두 배면 이레가 맞다.
 */
const MENTION_DAYS = 7;

/**
 * 멘션 줄 수 상한. 이 수가 곧 게시글 상세 호출 수의 상한이다 (분당 120회).
 * 화면은 이걸 업무 단위로 다시 접는다 (`groupMentions`) — 실측 20줄이 업무 12건이라
 * 12줄이면 접힌 뒤 카드 수가 사실상 같다.
 */
const MENTION_LIMIT = 12;

/** 게시글 상세를 데이터 캐시에 두는 시간(초). 헤더 종이 같은 글을 또 부른다 (`NEWS_BRIEF_TTL`). */
const MENTION_BRIEF_TTL = 300;

/**
 * 내 멘션 알림 → 화면 줄 (BUG-028).
 *
 * `receiverId`가 로그인한 사람과 다른 건 **버린다** — API Key가 발급자 한 명에게 묶여 있어서
 * (rest.ts 상단 주석), 이 필터가 남의 멘션이 새는 걸 막는다. `taskNews`와 같은 방어선이다.
 *
 * 알림은 업무명도 상태도 안 준다 — 게시글 상세에서 셋(제목·링크·상태)을 한 번에 받는다.
 * `postId`를 중복 제거하고 병렬로 부른다: 같은 업무에 멘션이 여러 개 달리는 게 흔해서
 * 실측 17건이 게시글 12개였다. 실패는 삼킨다 — 그 줄만 제목이 비고 링크는 우리가 조립한다.
 */
async function myMentions(
  alarms: readonly MentionAlarm[] | null,
  me: string,
): Promise<WorklistMention[]> {
  if (!alarms) return [];

  const mine = alarms
    .filter((a) => a.receiverId.toLowerCase() === me.toLowerCase())
    .sort((a, b) => b.registeredDateTime.localeCompare(a.registeredDateTime))
    .slice(0, MENTION_LIMIT);
  if (!mine.length) return [];

  const briefs = new Map(
    await Promise.all(
      [...new Set(mine.map((a) => a.postId))].map(
        async (postId) =>
          [postId, await getPostBrief(postId, MENTION_BRIEF_TTL).catch(() => null)] as const,
      ),
    ),
  );

  return mine.map((a) => {
    const brief = briefs.get(a.postId);
    return {
      // 실명이 있으면 실명이다 — `djseo7`보다 `서동조`가 읽힌다.
      from: a.registerName || a.registerId,
      at: a.registeredDateTime,
      content: a.content?.trim() || undefined,
      isReply: a.replyId !== "-1",
      projectId: a.projectId || undefined,
      id: a.alarmId || undefined,
      // flow가 `readYn`을 안 주면 "안 읽었다"고 단정하지 않는다 — 읽음 표시가 헛돌면
      // 눌러도 화면이 그대로라 사용자가 고장으로 읽는다.
      unread: a.readYn === "N",
      postId: a.postId,
      status: brief?.status ?? undefined,
      title: brief?.title ?? "제목 없는 업무",
      // flow가 만든 짧은 링크가 있으면 그걸 쓴다 — 로그인 화면을 건너서도 대상을 지킨다.
      link: brief?.url ?? flowPostUrl(a.projectId, a.postId),
    };
  });
}

/* ── 헤더 알림 종 (PRD §13 B1·B2) ─────────────────────────────────────── */

/**
 * 헤더 알림 종에 올릴 소식.
 *
 * 알림은 이름을 하나도 안 준다 (`projectId`·`postId`뿐). 프로젝트명은 전량 목록에서,
 * 업무명과 링크는 게시글 상세에서 풀어 붙인다. 이름 조회는 전부 실패를 삼킨다 — 못 풀면
 * 그 줄만 이름이 빠지고 소식은 그대로 뜬다.
 *
 * **종이 1분마다 이걸 다시 부른다** (`/api/news`). 제목·링크는 안 바뀌는 값이라 캐시에
 * 올려서(`NEWS_BRIEF_TTL`) 폴링 한 번이 알림 목록 + 프로젝트 목록 두 번으로 끝난다 —
 * 캐시가 없으면 매분 최대 14번이고 REST 상한이 분당 120번이다.
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
        async (postId) => [postId, await getPostBrief(postId, NEWS_BRIEF_TTL).catch(() => null)] as const,
      ),
    ),
  );
  return news.map((n) => {
    const brief = briefs.get(n.postId);
    return {
      ...n,
      project: nameOf.get(n.projectId),
      title: brief?.title ?? undefined,
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
 * 소식 줄의 **제목·링크**를 데이터 캐시에 두는 시간(초). 게시글 제목과 flow 짧은 링크는
 * 안 바뀌는 값이라 종이 1분마다 폴링해도 5분에 한 번만 게시글 상세를 부른다.
 */
const NEWS_BRIEF_TTL = 300;

/**
 * 담당 업무·내가 올린 글 알림을 카드용 한 줄로 (PRD §13 B1·B2).
 *
 * `receiverId`가 로그인한 사람과 다른 건 **버린다** — API Key가 발급자 한 명에게 묶여 있어서
 * (rest.ts 상단 주석), 이 필터가 남의 알림이 새는 걸 막는다. `myMentions`와 같은 방어선이다.
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

/* ── 리스크 보드 · 팀 (PRD §6.2, §6.3) ────────────────────────────────── */

/** 부서 탭 한 칸 (api-spec §4.1). */
export type Division = FlowDivision;

export interface Standup {
  dept: string;
  counts: { members: number; imminent: number; blocked: number };
  members: StandupMember[];
}

export interface TeamData {
  now: number;
  /** 실제 조회한 부서. 쿼리 없이 들어오면 내 부서. */
  dept: string;
  divisions: Division[];
  standup: Standup;
  /** 프로젝트 이름 → projectId. 업무 줄은 이름만 들고 있어서 쓰기 액션에 필요하다. */
  projectIds: ReadonlyMap<string, string>;
  /** 부서원 이름 → 오늘 일정 (PRD §13 B3). 조회가 실패한 사람은 키가 아예 없다. */
  events: ReadonlyMap<string, FlowEvent[]>;
  /** 페이지 상한(300건)에 걸린 프로젝트 이름. */
  truncated: string[];
  /**
   * 못 읽은 프로젝트 이름 (권한·429). 오늘·내 업무 화면만 이걸 적고 있었고 팀·리스크는
   * `collectTasks`가 준 걸 버렸다 — 부서 전체를 훑는 화면이라 429가 제일 잘 나는 자리인데
   * 거기서만 조용히 적게 보였다 (bug-report BUG-040).
   */
  failed: string[];
}

export interface RiskData extends TeamData {
  rollups: ProjectRollup[];
  /** 이름을 ID로 못 바꾼 프로젝트 수. 그만큼 쓰기 액션이 막힌다. */
  unresolved: number;
}

/**
 * 부서 스탠드업 + 부서 목록. `/team`과 `/risk`가 같은 걸 쓴다.
 *
 * 부서원 명단을 먼저 받고(`listEmployees`), 그 사람들 `userId`를 **한 번에** 담당자 필터에
 * 넣는다 — 같은 컬럼의 필터 레코드끼리는 OR라서(`listWorkerTasks`) 여덟 명이든 한 명이든
 * 프로젝트당 조회 1회다. 그다음 업무를 담당자별로 갈라 분류한다.
 *
 * 내 부서는 세션에 이미 있다 — 로그인할 때 `/user/employees/me`로 받아 둔 값이다. 대가:
 * 부서가 바뀐 사람은 세션이 만료될 때까지(7일) 옛 부서로 열린다 — 부서 탭으로 바꿔 볼 수
 * 있고, 다시 로그인하면 갱신된다.
 */
export async function loadTeam(dept?: string): Promise<TeamData> {
  const session = await getSession();
  if (!session) throw new Error("세션 없음");
  const now = Date.now();
  const target = dept ?? session.divisionName;

  // 부서 탭은 곁가지다 — 목록을 못 받아도 지금 부서 화면은 선다.
  const [divisions, employees] = await Promise.all([
    listDivisions().catch(() => [] as Division[]),
    listEmployees(target),
  ]);

  // 일정은 명단만 있으면 받을 수 있다 — 업무 조회(63회)를 기다릴 이유가 없어서 같이 띄운다.
  const [{ rows, truncated, failed }, events] = await Promise.all([
    collectTasks(employees.map((e) => e.userId)),
    memberEvents(employees, now),
  ]);

  const projectIds = new Map(rows.map((row) => [row.name, row.projectId]));
  const origin = new Map(rows.flatMap((row) => row.tasks.map((t) => [t.taskId, t] as const)));

  // 업무를 담당자별로 가른다. 공동 담당이면 같은 업무가 여러 사람 밑에 선다 — flow가 그렇게
  // 걸어 둔 것이고, 스탠드업은 "이 사람이 뭘 물고 있나"를 보는 자리다.
  const members = employees.map((employee): StandupMember => {
    const mine = rows.flatMap((row) =>
      row.tasks
        .filter((t) => t.workers.some((w) => sameUser(w.userId, employee.userId)))
        .map((t) => toTask(t, row)),
    );
    const classified = classifyTasks(mine, now);
    return {
      name: employee.fullname || employee.userId,
      role: employee.responsibility ?? "",
      imminent: classified.imminent.map((c) => toRow(c, origin)),
      blocked: classified.overdueActive.map((c) => toRow(c, origin)),
      staleCount: classified.counts.overdueStale,
    };
  });

  return {
    now,
    dept: target,
    divisions,
    standup: {
      dept: target,
      counts: {
        members: members.length,
        imminent: members.reduce((sum, m) => sum + m.imminent.length, 0),
        blocked: members.reduce((sum, m) => sum + m.blocked.length, 0),
      },
      members,
    },
    projectIds,
    events,
    truncated,
    failed,
  };
}

/** 우리 기관 사람의 `userId`는 이메일이라 대소문자가 섞여 온다. */
const sameUser = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** 팀원 일정 조회 상한. 부서원 20명까지 본다 — 그 위는 화면도 못 읽는다. */
const EVENT_MEMBER_LIMIT = 20;

/**
 * 부서원별 오늘 일정 (PRD §13 B3).
 *
 * 부서원 한 명에 REST 1회다. 실패한 사람은 맵에서 빠지고 나머지는 그대로 뜬다 —
 * 일정 하나 때문에 팀 화면을 날리지 않는다.
 */
async function memberEvents(
  employees: readonly FlowEmployee[],
  now: number,
): Promise<Map<string, FlowEvent[]>> {
  const today = kstYmd(now);
  const results = await Promise.all(
    employees.slice(0, EVENT_MEMBER_LIMIT).map((e) =>
      listEvents(`${today}000000`, `${today}235959`, e.userId)
        .then((events) => [e.fullname || e.userId, events] as const)
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
