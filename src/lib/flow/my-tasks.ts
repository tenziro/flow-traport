/**
 * 내 업무 화면 데이터 (PRD §6.5).
 *
 * 오늘 화면은 내 업무 중 **16건**만 띄운다 — 워크리스트가 임박·지연만 주기 때문이다.
 * 실측(2026-07-28)으로 내가 담당인 업무는 38개 프로젝트에 걸쳐 880건이고, 그중 864건은
 * 어느 화면에도 없었다. 이 파일이 그 864건을 데려온다.
 *
 * 길은 REST 하나뿐이다. MCP `flow_list_projects_by_participant`는 프로젝트를 1개만 주고,
 * `flow_list_project_items`는 담당자·마감일·업무 ID를 안 준다 (PRD §6.5 실측표).
 * `flow_list_projects`는 서버측 스키마 검증에서 터진다 (bug-report BUG-007) — 그래서
 * 프로젝트 목록도 REST `listProjects`로 받는다.
 *
 * 호출은 프로젝트 수만큼이다(실측 59회 + 목록 1회). REST 분당 상한이 120회라 화면 한 번이
 * 절반을 쓴다 — `listMyTasks`가 응답마다 60초 캐시를 걸고, 여기서는 동시 10으로 묶는다.
 */

import { diffDays, parseFlowDeadline } from "@/lib/aggregate/date";
import { getSession } from "@/lib/auth";
import { type WorklistTask } from "@/lib/flow/queries";
import { flowPostUrl, flowProjectUrl } from "@/lib/flow/urls";
import { listMyTasks, listProjects, type MyTask } from "@/lib/flow/rest";

/**
 * 화면 한 줄. `depth`가 0보다 크면 하위 업무고, 그만큼 들여쓴다 (PRD §13 D1).
 *
 * `WorklistTask`에 넣지 않는 이유: 그 타입은 오늘·팀 화면이 같이 쓰는데 계층은 이 화면만 그린다.
 */
export type MyTaskRow = WorklistTask & { depth: number };

/** 프로젝트 한 개의 내 업무. */
export interface MyTasksProject {
  projectId: string;
  name: string;
  /** 안 끝난 업무. 부모 바로 아래에 자식이 붙고, 형제끼리는 마감 지난 것 → 임박한 것 → 마감일 없는 것 순. */
  open: MyTaskRow[];
  /** 끝난 업무. 최근 마감 순. 화면에서 접어 두고 읽기만 한다. */
  done: WorklistTask[];
}

export interface MyTasksData {
  /** 조회 기준 시각. 렌더 중 `Date.now()`를 부르지 않으려고 찍어 내려보낸다. */
  now: number;
  /** 내 업무 전체 건수. */
  total: number;
  /** 그중 안 끝난 건수. */
  open: number;
  /** 담당 업무가 있는 프로젝트. 안 끝난 건수 내림차순. */
  projects: MyTasksProject[];
  /**
   * 담당 업무가 0건인 프로젝트. 실측 59개 중 21개다 — 탭 한 칸에 이름과 flow 링크만 낸다.
   * 여기서 할 일은 flow로 가서 찾는 것뿐이라 링크가 곧 그 칸의 내용이다.
   */
  quiet: { name: string; link: string }[];
  /** 페이지 상한(300건)에 걸려 다 못 받은 프로젝트 이름. */
  truncated: string[];
  /** 조회가 실패한 프로젝트 이름. 나머지는 그대로 보여 주고 이것만 밝힌다. */
  failed: string[];
}

/** `buildMyTasks` 입력 — 프로젝트 한 개의 조회 결과. */
export interface ProjectTasks {
  projectId: string;
  name: string;
  tasks: MyTask[];
}

/** 프로젝트를 몇 개씩 동시에 훑을지. */
const CONCURRENCY = 10;

/**
 * 안 끝난 업무 정렬. 마감일 있는 것이 먼저고, 그 안에서 많이 지난 것부터다
 * (`daysLeft`는 음수가 지남). 마감일 없는 720건이 앞을 다 차지하면 지난 업무가 안 보인다.
 */
const byUrgency = (a: WorklistTask, b: WorklistTask) =>
  (a.endDate ? 0 : 1) - (b.endDate ? 0 : 1) || a.daysLeft - b.daysLeft;

/** 끝난 업무는 최근 마감 순. 마감일 없는 것은 뒤로 간다(빈 문자열이 가장 작다). */
const byRecent = (a: WorklistTask, b: WorklistTask) => b.endDate.localeCompare(a.endDate);

/** 화면 한 줄로 바꾼다. `TaskItem`이 오늘·팀 화면에서 쓰는 모양 그대로다. */
function toRow(row: ProjectTasks, task: MyTask, now: number): WorklistTask {
  const deadline = parseFlowDeadline(task.endDate);
  return {
    taskSrno: Number(task.taskId),
    title: task.title,
    status: task.status,
    project: row.name,
    endDate: task.endDate,
    // 마지막 댓글을 나중에 불러오는 데 쓴다 (`LastComment`). 여기서 미리 부르지 않는다 —
    // 업무 한 줄에 REST 한 번이라 951줄이면 951번이고, 분당 상한이 120번이다.
    postId: task.postId,
    // 마감일이 없으면 0이다. 그 줄에는 D-DAY 배지를 안 그린다 (task-item.tsx).
    daysLeft: deadline === null ? 0 : diffDays(now, deadline),
    link: flowPostUrl(row.projectId, task.postId),
  };
}

/** 들여쓰기 단계 상한. flow는 3단까지 만들 수 있고, 그 이상은 같은 칸에 둔다. */
const MAX_DEPTH = 2;

/**
 * 안 끝난 업무를 부모 → 자식 순으로 늘어놓는다 (PRD §13 D1).
 *
 * 부모는 **같은 목록에 있는 것만** 인정한다. 실측 226건 중 하위 업무가 191건인데 부모까지 내
 * 담당인 건 26건뿐이다 — 없는 부모를 받으려면 건당 조회 165회고 REST 분당 상한이 120회다.
 * 부모를 못 찾은 하위 업무는 최상위 줄로 그린다.
 *
 * 형제 순서는 먼저 걸어 둔 마감 순(`byUrgency`)이 그대로 남는다 — 정렬한 배열을 순서대로 훑기
 * 때문이다. 부모가 자기 자식보다 급하지 않아도 부모가 위에 온다. 계층이 그런 것이다.
 */
function nest(tasks: MyTask[], row: ProjectTasks, now: number): MyTaskRow[] {
  const rows = tasks
    .map((task) => ({ task, row: { ...toRow(row, task, now), depth: 0 } }))
    .sort((a, b) => byUrgency(a.row, b.row));

  const ids = new Set(rows.map((r) => r.task.taskId));
  const kids = new Map<string, typeof rows>();
  const roots: typeof rows = [];
  for (const r of rows) {
    // 자기 자신이 부모로 오는 응답은 못 봤지만, 그게 오면 무한 재귀다.
    const parent = r.task.upTaskId;
    if (parent !== r.task.taskId && ids.has(parent)) {
      const siblings = kids.get(parent);
      if (siblings) siblings.push(r);
      else kids.set(parent, [r]);
    } else {
      roots.push(r);
    }
  }

  const out: MyTaskRow[] = [];
  const walk = (r: (typeof rows)[number], depth: number) => {
    r.row.depth = depth;
    out.push(r.row);
    for (const kid of kids.get(r.task.taskId) ?? []) walk(kid, Math.min(depth + 1, MAX_DEPTH));
  };
  for (const r of roots) walk(r, 0);

  // 부모 사슬이 고리를 이루면 뿌리가 하나도 없어서 그 무리가 통째로 빠진다. **건수가 실제보다
  // 적게 보이는 게 제일 나쁘다** — 못 걸은 줄은 평평하게 뒤에 붙인다.
  if (out.length < rows.length) {
    const drawn = new Set(out);
    for (const r of rows) if (!drawn.has(r.row)) out.push(r.row);
  }
  return out;
}

/** 조회 결과 → 화면 묶음. 순수 함수다 (테스트가 이걸 부른다). */
export function buildMyTasks(
  rows: ProjectTasks[],
  now: number,
): Pick<MyTasksData, "total" | "open" | "projects" | "quiet"> {
  const projects: MyTasksProject[] = [];
  const quiet: MyTasksData["quiet"] = [];

  for (const row of rows) {
    if (row.tasks.length === 0) {
      quiet.push({ name: row.name, link: flowProjectUrl(row.projectId) });
      continue;
    }
    // 끝난 업무는 계층을 안 그린다 — 접어 둔 목록이라 들여쓰기가 정보가 아니라 잡음이다.
    projects.push({
      projectId: row.projectId,
      name: row.name,
      open: nest(
        row.tasks.filter((t) => !t.done),
        row,
        now,
      ),
      done: row.tasks
        .filter((t) => t.done)
        .map((t) => toRow(row, t, now))
        .sort(byRecent),
    });
  }

  // 할 일이 남은 프로젝트가 위로 온다. 같으면 큰 프로젝트, 그다음 이름순 —
  // 같은 순서가 매번 나와야 새로 고칠 때 카드가 뒤바뀌지 않는다.
  projects.sort(
    (a, b) =>
      b.open.length - a.open.length ||
      b.open.length + b.done.length - (a.open.length + a.done.length) ||
      a.name.localeCompare(b.name),
  );

  return {
    total: projects.reduce((sum, p) => sum + p.open.length + p.done.length, 0),
    open: projects.reduce((sum, p) => sum + p.open.length, 0),
    projects,
    quiet,
  };
}

/** 로그인한 사람이 담당인 업무 전량. */
export async function loadMyTasks(): Promise<MyTasksData> {
  const session = await getSession();
  // 필터 값은 **여기서** 세션으로 채운다. 요청에서 받으면 공용 키로도 남의 업무가 나온다.
  if (!session) throw new Error("세션 없음");

  const projects = [...(await listProjects())].map(([name, projectId]) => ({ name, projectId }));

  const rows: ProjectTasks[] = [];
  const truncated: string[] = [];
  const failed: string[] = [];

  // ponytail: 풀 대신 10개씩 잘라 돈다. 느린 프로젝트가 자기 묶음만 붙잡는데,
  // 실측 2.1초라 그 손해를 신경 쓸 이유가 없다.
  for (let i = 0; i < projects.length; i += CONCURRENCY) {
    const batch = await Promise.all(
      projects.slice(i, i + CONCURRENCY).map(async (p) => {
        // 한 프로젝트가 막혀도(권한·429) 나머지 58개는 보여 준다.
        const got = await listMyTasks(p.projectId, session.userId).catch(() => null);
        if (!got) {
          failed.push(p.name);
          return null;
        }
        if (got.hasMore) truncated.push(p.name);
        return { projectId: p.projectId, name: p.name, tasks: got.tasks };
      }),
    );
    for (const row of batch) if (row) rows.push(row);
  }

  const now = Date.now();
  return { now, truncated, failed, ...buildMyTasks(rows, now) };
}
