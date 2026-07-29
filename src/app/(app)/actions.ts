"use server";

/**
 * 쓰기 액션 (PRD §6.1.4, §8.1).
 *
 * 원칙 셋:
 * - 파괴적 액션 없음. 상태 변경과 댓글 두 가지뿐이다. 삭제는 v1에 넣지 않는다.
 * - 모든 쓰기는 **확인 단계**를 거친다 (§8.1). 실행 취소 대신 확인을 택했다 —
 *   되돌리기는 이전 상태를 정확히 알아야 하는데, flow 커스텀 상태 라벨과 API enum이
 *   1:1이 아니다. 잘못 되돌리느니 누르기 전에 한 번 묻는 게 안전하다.
 * - 업무 제목·본문은 로그에 남기지 않는다. 고객사명이 그대로 들어 있다 (§8.1).
 *
 * ID 공간이 둘이다 (docs/bug-report.md BUG-005):
 * - `flow_update_task.taskId` = 워크리스트가 주는 `taskSrno` 그대로. 실측으로 확인했다.
 * - `flow_create_comment.postId` = `colabo_commt_srno`. **`taskSrno`가 아니다** —
 *   `resolvePostId`로 바꿔서 넘긴다.
 */

import { revalidatePath } from "next/cache";
import { DAY_MS, kstYmd } from "@/lib/aggregate/date";
import { getApiKey } from "@/lib/auth";
import { FlowMcpError } from "@/lib/flow/mcp";
import { flowMcp } from "@/lib/flow/queries";
import {
  describeSystemComment,
  FlowRestError,
  getTaskFields,
  listComments,
  listParticipants,
  listStaleTasks,
  markAlarmRead,
  markAllAlarmsRead,
  resolvePostId,
  searchPosts,
  searchProjects,
  setTaskEndDate,
  setTaskPriority,
  setTaskWorkers,
  stripMentions,
  type Participant,
  type SearchPost,
  type SearchProject,
  type StaleTask,
  type TaskFields,
} from "@/lib/flow/rest";
import { TASK_PRIORITY, type TaskPriority } from "@/lib/task-priority";
import { TASK_STATUS, type TaskStatus } from "@/lib/task-status";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const isStatus = (v: unknown): v is TaskStatus =>
  typeof v === "string" && v in TASK_STATUS;

export async function updateTaskStatus(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const projectId = String(form.get("projectId") ?? "");
  const taskId = String(form.get("taskId") ?? "");
  const status = form.get("status");

  if (!projectId || !taskId) return { ok: false, message: "업무를 찾지 못했어요." };
  if (!isStatus(status)) return { ok: false, message: "바꿀 상태를 골라주세요." };

  return run(
    async (mcp) => {
      await mcp.call("flow_update_task", { projectId, taskId, status });
      return `${TASK_STATUS[status]}(으)로 바꿨어요.`;
    },
    form.get("path"),
  );
}

export async function createComment(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const projectId = String(form.get("projectId") ?? "");
  const taskId = String(form.get("taskId") ?? "");
  const title = String(form.get("title") ?? "");
  const content = String(form.get("content") ?? "").trim();

  if (!projectId || !taskId) return { ok: false, message: "업무를 찾지 못했어요." };
  if (!content) return { ok: false, message: "댓글 내용을 적어주세요." };

  // 댓글은 `postId`를 받는다. 워크리스트가 주는 `taskSrno`를 그대로 넘기면 404다 (rest.ts).
  // ponytail: 조회가 실패한 사유는 삼킨다 — 사용자가 할 수 있는 일은 flow에서 남기는 것뿐이고,
  // flow 링크가 이 폼 바로 위에 있다.
  const postId = await resolvePostId(projectId, taskId, title).catch(() => null);
  if (!postId) return { ok: false, message: "이 업무는 flow에서 댓글을 남겨주세요." };

  return run(
    async (mcp) => {
      await mcp.call("flow_create_comment", { projectId, postId, content });
      return "댓글을 남겼어요.";
    },
    form.get("path"),
  );
}

export async function createTask(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const projectId = String(form.get("projectId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const contents = String(form.get("contents") ?? "").trim() || title;
  const endDate = String(form.get("endDate") ?? "").replaceAll("-", "");

  if (!projectId) return { ok: false, message: "프로젝트를 찾지 못했어요." };
  if (!title) return { ok: false, message: "업무명을 적어주세요." };
  if (endDate && !/^\d{8}$/.test(endDate)) return { ok: false, message: "마감일을 다시 골라주세요." };

  return run(
    async (mcp) => {
      // 새 업무는 항상 "요청"으로 넣는다. 시작도 안 한 일을 진행으로 넣으면
      // 워크리스트와 스탠드업 신호가 통째로 왜곡된다 (flow_add_tasks 도구 주의사항).
      await mcp.call("flow_create_task", {
        projectId,
        title,
        contents,
        status: "request",
        ...(endDate ? { endDate } : {}),
      });
      return "업무를 만들었어요.";
    },
    form.get("path"),
  );
}

/* ── REST 쓰기 (PRD §13 A2·A4) ────────────────────────────────────────── */

/** 알림 읽음 처리 (PRD §13 A2). `alarmIds`가 비어 있으면 프로젝트 전체를 읽음으로 만든다. */
export async function markMentionsRead(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const ids = String(form.get("alarmIds") ?? "").split(",").filter(Boolean);
  const projectId = String(form.get("projectId") ?? "");

  if (!ids.length && !projectId) return { ok: false, message: "읽음으로 만들 알림을 찾지 못했어요." };

  return restRun(async () => {
    // 벌크 API가 알림 단위로는 없다 — 그룹의 알림을 한꺼번에 쏜다.
    if (ids.length) await Promise.all(ids.map(markAlarmRead));
    else await markAllAlarmsRead(projectId);
    return ids.length ? `${ids.length}건을 읽음으로 만들었어요.` : "이 프로젝트 알림을 다 읽음으로 만들었어요.";
  }, form.get("path"));
}

export async function updateTaskEndDate(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const projectId = String(form.get("projectId") ?? "");
  const taskId = String(form.get("taskId") ?? "");
  const endDate = String(form.get("endDate") ?? "").replaceAll("-", "");

  if (!projectId || !taskId) return { ok: false, message: "업무를 찾지 못했어요." };
  if (!/^\d{8}$/.test(endDate)) return { ok: false, message: "마감일을 골라주세요." };

  return restRun(async () => {
    await setTaskEndDate(projectId, taskId, endDate);
    return `마감일을 ${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6)}로 바꿨어요.`;
  }, form.get("path"));
}

export async function updateTaskPriority(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const projectId = String(form.get("projectId") ?? "");
  const taskId = String(form.get("taskId") ?? "");
  const priority = form.get("priority");

  if (!projectId || !taskId) return { ok: false, message: "업무를 찾지 못했어요." };
  if (typeof priority !== "string" || !(priority in TASK_PRIORITY)) {
    return { ok: false, message: "바꿀 우선순위를 골라주세요." };
  }

  return restRun(async () => {
    await setTaskPriority(projectId, taskId, priority as TaskPriority);
    return `우선순위를 ${TASK_PRIORITY[priority as TaskPriority]}으로 바꿨어요.`;
  }, form.get("path"));
}

/**
 * 담당자 교체 (PRD §13 A4).
 *
 * ponytail: 한 명으로 덮는다. flow API는 배열을 받지만 화면에서 여럿을 고르게 하면
 * 이 행 하나가 폼이 되어버린다 — 공동 담당이 필요하면 flow에서 하면 된다.
 * 덮어쓰기라는 걸 확인 문구에 그대로 적는다.
 */
export async function updateTaskWorker(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const projectId = String(form.get("projectId") ?? "");
  const taskId = String(form.get("taskId") ?? "");
  const workerId = String(form.get("workerId") ?? "").trim();
  const workerName = String(form.get("workerName") ?? "").trim();

  if (!projectId || !taskId) return { ok: false, message: "업무를 찾지 못했어요." };
  if (!workerId) return { ok: false, message: "담당자를 골라주세요." };

  return restRun(async () => {
    await setTaskWorkers(projectId, taskId, [workerId]);
    return `담당자를 ${workerName || workerId}(으)로 바꿨어요.`;
  }, form.get("path"));
}

/* ── REST 읽기 — 눌러야 부른다 (PRD §13 A1·B4·B5) ─────────────────────── */

/** 스레드 한 줄. 시스템 로그와 사람 댓글을 같은 모양으로 낸다. */
export interface ThreadComment {
  id: string;
  from: string;
  /** `YYYYMMDDHHmmss` */
  at: string;
  body: string;
  /** flow가 남긴 업무 변경 기록이면 true. 화면에서 흐리게 낸다 (PRD §13 B4). */
  system: boolean;
}

export interface ThreadResult extends ActionResult {
  comments?: ThreadComment[];
}

/**
 * 전체 댓글 스레드 (PRD §13 A1). **누를 때만 부른다** — 화면을 열 때 다 부르면
 * 업무 한 줄에 REST 한 번씩이라 열 줄이면 열 번이다.
 *
 * `postId`를 이미 아는 곳(멘션 알림)은 그대로 넘기고, 모르는 곳(업무 행)은 `taskId`+업무명으로
 * 해소한다 (`resolvePostId` — BUG-005).
 */
export async function loadThread(
  _prev: ThreadResult | null,
  form: FormData,
): Promise<ThreadResult> {
  const known = String(form.get("postId") ?? "");
  const projectId = String(form.get("projectId") ?? "");
  const taskId = String(form.get("taskId") ?? "");
  const title = String(form.get("title") ?? "");

  try {
    const postId = known || (projectId && taskId ? await resolvePostId(projectId, taskId, title) : null);
    if (!postId) return { ok: false, message: "이 업무의 댓글은 flow에서 볼 수 있어요." };

    const comments = await listComments(postId);
    if (!comments.length) return { ok: true, message: "아직 댓글이 없어요." };

    return {
      ok: true,
      message: `댓글 ${comments.length}건을 가져왔어요.`,
      comments: comments
        .map((c) => ({
          id: c.commentId,
          from: c.registerName || c.registerId,
          at: c.registeredDateTime,
          // 시스템 댓글이 사람 댓글보다 많다 (실측 14건 중 10건). 버리지 않고 업무 이력으로 읽는다.
          body: c.systemCode ? describeSystemComment(c.systemCode) : stripMentions(c.contents),
          system: Boolean(c.systemCode),
        }))
        // 위에서 아래로 읽는 대화다 — 오래된 것부터 쌓는다.
        .sort((a, b) => a.at.localeCompare(b.at)),
    };
  } catch (error) {
    return { ok: false, message: reasonOf(error) };
  }
}

export interface ParticipantResult extends ActionResult {
  participants?: Participant[];
}

/** 담당자 후보. 프로젝트마다 한 번, 누를 때만 부른다. */
export async function loadParticipants(
  _prev: ParticipantResult | null,
  form: FormData,
): Promise<ParticipantResult> {
  const projectId = String(form.get("projectId") ?? "");
  if (!projectId) return { ok: false, message: "프로젝트를 찾지 못했어요." };

  try {
    const participants = await listParticipants(projectId);
    if (!participants.length) return { ok: false, message: "참여자를 찾지 못했어요." };
    return { ok: true, message: `참여자 ${participants.length}명이에요.`, participants };
  } catch (error) {
    return { ok: false, message: reasonOf(error) };
  }
}

export interface TaskFieldsResult extends ActionResult {
  fields?: TaskFields;
}

/**
 * 업무의 지금 마감일·우선순위·담당자 (PRD §13 A4).
 *
 * **패널을 열 때만 부른다.** 워크리스트는 이 셋 중 마감일만 준다 — 나머지는 업무 한 줄에
 * REST 한 번이라, 화면을 열 때 미리 부르면 밀리는 업무 열 줄에 열 번이다.
 *
 * 값이 비어 있으면 빈 문자열로 온다 (`null`이 아니다 — api-spec §2.2). 없는 값을
 * "지금 보통"처럼 적으면 거짓이라, 화면은 빈 값을 그대로 빈 값으로 다룬다.
 */
export async function loadTaskFields(
  projectId: string,
  taskId: number,
  title: string,
): Promise<TaskFieldsResult> {
  if (!projectId || !taskId) return { ok: false, message: "업무를 찾지 못했어요." };

  try {
    const fields = await getTaskFields(projectId, String(taskId), title);
    if (!fields) return { ok: false, message: "지금 값을 찾지 못했어요." };
    return { ok: true, message: "지금 값을 가져왔어요.", fields };
  } catch (error) {
    return { ok: false, message: reasonOf(error) };
  }
}

export interface StaleResult extends ActionResult {
  tasks?: StaleTask[];
  /** 상한(300건)에 걸려 못 본 업무가 남았으면 true. */
  hasMore?: boolean;
}

/** 오래 방치된 업무 스캔 (PRD §13 B5). 기본 180일 — 워크리스트 도구의 상한과 같다. */
export async function scanStaleTasks(
  _prev: StaleResult | null,
  form: FormData,
): Promise<StaleResult> {
  const projectId = String(form.get("projectId") ?? "");
  const days = Number(form.get("days") ?? 180) || 180;
  if (!projectId) return { ok: false, message: "프로젝트를 찾지 못했어요." };

  try {
    const before = kstYmd(Date.now() - days * DAY_MS);
    const { tasks, hasMore } = await listStaleTasks(projectId, before);
    return {
      ok: true,
      message: tasks.length
        ? `마감일이 ${days}일 넘게 지난 업무가 ${tasks.length}건이에요.`
        : `마감일이 ${days}일 넘게 지난 업무는 없어요.`,
      tasks,
      hasMore,
    };
  } catch (error) {
    return { ok: false, message: reasonOf(error) };
  }
}

export interface SearchResult extends ActionResult {
  projects?: SearchProject[];
  posts?: SearchPost[];
}

/** 검색어 길이 상한. flow가 100자까지 받는다 (api-spec §9.1). */
const SEARCH_MAX = 100;
/** 프로젝트 · 글 각각 몇 줄까지 볼지. 합쳐서 한 화면에 담기는 수다 (PRD §6.4). */
const SEARCH_SIZE = { projects: 5, posts: 8 } as const;

/**
 * 검색 팔레트 (PRD §6.4). 프로젝트와 글을 병렬로 찾는다.
 *
 * 두 글자부터 받는다 — flow는 한 글자도 받지만 결과가 수천이라 고를 수가 없다.
 * 입력을 그대로 URL에 넣는 자리라 길이를 여기서 자른다.
 *
 * ponytail: 한쪽이 실패하면 둘 다 실패로 낸다. 같은 키로 같은 서버를 부르는 두 호출이라
 * 하나만 죽는 경우가 사실상 없고, 반쪽 결과를 전체인 척 보여 주는 게 더 위험하다.
 */
export async function searchFlow(word: string): Promise<SearchResult> {
  const searchWord = word.trim().slice(0, SEARCH_MAX);
  if (searchWord.length < 2) return { ok: false, message: "두 글자 이상 적어주세요." };

  try {
    const [projects, posts] = await Promise.all([
      searchProjects(searchWord, SEARCH_SIZE.projects),
      searchPosts(searchWord, SEARCH_SIZE.posts),
    ]);
    return {
      ok: true,
      // 결과가 있으면 화면이 목록만 그린다 — 이 문구는 빈 결과에서만 읽힌다.
      message: projects.length + posts.length ? "" : "다른 말로 찾아보세요.",
      projects,
      posts,
    };
  } catch (error) {
    return { ok: false, message: reasonOf(error) };
  }
}

/** 공통 실행부 — 성공하면 해당 경로를 다시 불러오고, 실패하면 flow가 준 사유를 그대로 낸다. */
async function run(
  fn: (mcp: Awaited<ReturnType<typeof flowMcp>>) => Promise<string>,
  path: FormDataEntryValue | null,
): Promise<ActionResult> {
  try {
    const message = await fn(await flowMcp());
    revalidatePath(typeof path === "string" && path.startsWith("/") ? path : "/risk");
    return { ok: true, message };
  } catch (error) {
    // flow가 준 사유를 숨기지 않는다. 사용자가 다음에 뭘 할지 판단할 재료다.
    const reason = error instanceof FlowMcpError ? error.message : "";
    return { ok: false, message: reason || "flow가 받아주지 않았어요. 잠시 뒤 다시 해주세요." };
  }
}

/**
 * REST 쓰기 공통부. **개인 키가 없으면 아예 막는다** — 공용 환경변수 키로 나가면 변경이
 * 남의 이름으로 기록된다 (rest.ts 상단 주석). 읽기는 그래도 화면이 서지만 쓰기는 안 된다.
 */
async function restRun(
  fn: () => Promise<string>,
  path: FormDataEntryValue | null,
): Promise<ActionResult> {
  if (!(await getApiKey())) {
    return { ok: false, message: "flow API 키를 등록하면 여기서 바꿀 수 있어요." };
  }
  try {
    const message = await fn();
    revalidatePath(typeof path === "string" && path.startsWith("/") ? path : "/risk");
    return { ok: true, message };
  } catch (error) {
    return { ok: false, message: reasonOf(error) };
  }
}

/** flow가 준 사유를 그대로. 없으면 사용자가 할 수 있는 다음 행동을 알려준다. */
const reasonOf = (error: unknown) =>
  (error instanceof FlowRestError && error.reason) ||
  "flow가 받아주지 않았어요. 잠시 뒤 다시 해주세요.";
