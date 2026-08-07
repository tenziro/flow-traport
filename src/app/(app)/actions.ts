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
 * - 업무 변경(`PATCH .../tasks/{taskId}/...`)은 목록이 주는 `taskSrno` 그대로다.
 * - 댓글(`POST /user/comments/{postId}`)은 `colabo_commt_srno`다. **`taskSrno`가 아니다** —
 *   `resolvePostId`로 바꿔서 넘긴다.
 */

import { revalidatePath } from "next/cache";
import { DAY_MS, diffDays, kstYmd, parseFlowDeadline } from "@/lib/aggregate/date";
import { getApiKey, getSession } from "@/lib/auth";
import { loadMembers, pickMembers, type SearchMember } from "@/lib/flow/members";
import type { WorklistTask } from "@/lib/flow/queries";
import {
  createComment as createFlowComment,
  createSubtask as createFlowSubtask,
  createTask as createFlowTask,
  describeSystemComment,
  FlowRestError,
  getEvent,
  getPostBrief,
  getTaskFields,
  isChangeLog,
  listComments,
  listParticipants,
  listProjectPosts,
  listReplies,
  listStaleTasks,
  markAlarmRead,
  markAllAlarmsRead,
  maskMentions,
  mentionsMe,
  resolvePostId,
  searchEmployees,
  searchEvents,
  searchPosts,
  searchProjects,
  setTaskEndDate,
  setTaskPriority,
  setTaskStartDate,
  setTaskStatus,
  setTaskWorkers,
  type EventDetail,
  type FlowComment,
  type Participant,
  type PostFile,
  type PostLink,
  type ProjectPost,
  type SearchEvent,
  type SearchPost,
  type SearchProject,
  type StaleTask,
  type TaskFields,
} from "@/lib/flow/rest";
import { flowPostUrl } from "@/lib/flow/urls";
import { TASK_PRIORITY, type TaskPriority } from "@/lib/task-priority";
import { TASK_STATUS, type TaskStatus } from "@/lib/task-status";
import { withCall } from "@/lib/thread";

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

  return restRun(async () => {
    await setTaskStatus(projectId, taskId, status);
    return `${TASK_STATUS[status]}(으)로 바꿨어요.`;
  }, form.get("path"));
}

/**
 * 댓글 남기기 (PRD §13 A3).
 *
 * **REST에는 답글이 없다.** `POST /user/comments/{postId}`는 `contents` 하나만 받고
 * `replyToRemarkId`를 얹으면 거절한다 (`createComment` — 2026-08-04 실측). 그래서 답글은
 * 상대를 앞에서 부른 **최상위 댓글**로 보낸다 — 스레드로 묶이지는 않지만 누구에게 하는
 * 말인지는 남고, 무엇보다 목록에 보인다. 예전 답글은 남겨도 읽는 경로가 없어서 화면에서
 * 사라졌다 (`listComments` 주석).
 *
 * **부를 때는 멘션 마크업을 쓴다** (`mentionMarkup` — 실측 2026-08-06). 예전에는 `@이름`
 * 평문이었는데 flow가 그걸 멘션으로 안 읽어서 **상대에게 알림이 가지 않았다** — 답을 남겨도
 * 상대는 답이 온 걸 몰랐다. `replyToId`가 없으면(옛 화면) 평문으로 떨어진다.
 */
export async function createComment(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const projectId = String(form.get("projectId") ?? "");
  const taskId = String(form.get("taskId") ?? "");
  const title = String(form.get("title") ?? "");
  const content = String(form.get("content") ?? "").trim();
  const replyTo = String(form.get("replyToName") ?? "").trim();
  const replyToId = String(form.get("replyToId") ?? "").trim();
  /** 이미 아는 글 번호. 업무가 아닌 글(공지·회의록)에는 `taskId`가 아예 없다. */
  const known = String(form.get("postId") ?? "").trim();

  if (!known && (!projectId || !taskId)) return { ok: false, message: "업무를 찾지 못했어요." };
  if (!content) return { ok: false, message: "댓글 내용을 적어주세요." };

  // 댓글은 `postId`를 받는다. 워크리스트가 주는 `taskSrno`를 그대로 넘기면 404다 (rest.ts).
  // ponytail: 조회가 실패한 사유는 삼킨다 — 사용자가 할 수 있는 일은 flow에서 남기는 것뿐이고,
  // flow 링크가 이 폼 바로 위에 있다.
  const postId = known || (await resolvePostId(projectId, taskId, title).catch(() => null));
  if (!postId) return { ok: false, message: "이 업무는 flow에서 댓글을 남겨주세요." };

  return restRun(async () => {
    // 답글은 상대를 앞에서 부른 최상위 댓글로 나간다 — REST에 답글 쓰기가 없다
    // (`createFlowComment` 주석). 이미 부른 글이면 또 안 붙인다 (`withCall`).
    await createFlowComment(postId, withCall(content, replyTo, replyToId));
    return replyTo ? `${replyTo}님에게 답했어요.` : "댓글을 남겼어요.";
  }, form.get("path"));
}

export async function createTask(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const projectId = String(form.get("projectId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const contents = String(form.get("contents") ?? "").trim() || title;
  const endDate = String(form.get("endDate") ?? "").replaceAll("-", "");
  const priority = String(form.get("priority") ?? "");
  /** 담당자는 여러 명이다 — 폼이 같은 이름으로 여러 번 싣는다 (`setTaskWorkers`와 같은 모양). */
  const workerIds = form.getAll("workerId").map(String).filter(Boolean);

  if (!projectId) return { ok: false, message: "프로젝트를 찾지 못했어요." };
  if (!title) return { ok: false, message: "업무명을 적어주세요." };
  if (endDate && !/^\d{8}$/.test(endDate)) return { ok: false, message: "마감일을 다시 골라주세요." };
  if (priority && !(priority in TASK_PRIORITY)) {
    return { ok: false, message: "우선순위를 다시 골라주세요." };
  }

  return restRun(async () => {
    // 새 업무는 항상 "요청"으로 넣는다. 시작도 안 한 일을 진행으로 넣으면
    // 워크리스트와 스탠드업 신호가 통째로 왜곡된다.
    await createFlowTask(projectId, {
      title,
      contents,
      status: "request",
      ...(endDate ? { endDate } : {}),
      ...(priority ? { priority: priority as TaskPriority } : {}),
      ...(workerIds.length ? { workerIds } : {}),
    });
    // 담당자를 몇 명 얹었는지 적는다 — 안 넣으면 아무의 워크리스트에도 안 뜨는 업무가 된다.
    return workerIds.length
      ? `업무를 만들고 담당자 ${workerIds.length}명을 넣었어요.`
      : "업무를 만들었어요. 담당자는 아직 없어요.";
  }, form.get("path"));
}

/**
 * 하위 업무 하나 만들기 (api-spec §6.4).
 *
 * 상세 모달이 하위 업무를 보여 주기만 하던 자리에 붙는다. 제목만 받는다 — 만든 뒤 그 업무를
 * 열어 상태·마감일·담당자를 고치면 되고, 쪼개는 순간에 그것까지 정하는 사람은 없다.
 */
export async function createSubtask(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const projectId = String(form.get("projectId") ?? "");
  const taskId = String(form.get("taskId") ?? "");
  const title = String(form.get("title") ?? "").trim();

  if (!projectId || !taskId) return { ok: false, message: "업무를 찾지 못했어요." };
  if (!title) return { ok: false, message: "하위 업무 이름을 적어주세요." };

  return restRun(async () => {
    await createFlowSubtask(projectId, taskId, title);
    return "하위 업무를 만들었어요.";
  }, form.get("path"));
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

export async function updateTaskStartDate(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const projectId = String(form.get("projectId") ?? "");
  const taskId = String(form.get("taskId") ?? "");
  const startDate = String(form.get("startDate") ?? "").replaceAll("-", "");

  if (!projectId || !taskId) return { ok: false, message: "업무를 찾지 못했어요." };
  if (!/^\d{8}$/.test(startDate)) return { ok: false, message: "시작일을 골라주세요." };

  return restRun(async () => {
    await setTaskStartDate(projectId, taskId, startDate);
    return `시작일을 ${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6)}로 바꿨어요.`;
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
 * 여러 명을 받는다 — flow는 공동 담당을 두는데, 한 명으로 덮으면 이 화면에서 담당자를
 * 건드릴 때마다 나머지가 조용히 떨어졌다. 체크한 사람 전원으로 덮는다 (`workerId` 여러 개).
 *
 * 그래도 덮어쓰기다. 안 켠 사람은 담당에서 빠지므로 화면이 그 말을 그대로 적는다.
 */
export async function updateTaskWorker(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const projectId = String(form.get("projectId") ?? "");
  const taskId = String(form.get("taskId") ?? "");
  const workerIds = form.getAll("workerId").map(String).filter(Boolean);
  const workerName = String(form.get("workerName") ?? "").trim();

  if (!projectId || !taskId) return { ok: false, message: "업무를 찾지 못했어요." };
  if (workerIds.length === 0) return { ok: false, message: "담당자를 골라주세요." };

  return restRun(async () => {
    await setTaskWorkers(projectId, taskId, workerIds);
    const who = workerName || workerIds.join(", ");
    // 여럿이면 `(으)로`가 이름 목록 끝에 붙어 안 읽힌다 — 인원으로 맺는다
    return workerIds.length > 1
      ? `담당자를 ${who} ${workerIds.length}명으로 바꿨어요.`
      : `담당자를 ${who}(으)로 바꿨어요.`;
  }, form.get("path"));
}

/* ── REST 읽기 — 눌러야 부른다 (PRD §13 A1·B4·B5) ─────────────────────── */

/** 스레드 한 줄. 시스템 로그와 사람 댓글을 같은 모양으로 낸다. */
export interface ThreadComment {
  id: string;
  from: string;
  /**
   * 작성자 flow user_id. **답글이 진짜 멘션으로 나가는 근거다** — 이름만으로는 마크업을
   * 못 만든다 (`mentionMarkup`). 시스템 기록에도 값은 있지만 쓰는 데가 없다.
   */
  fromId: string;
  /** `YYYYMMDDHHmmss` */
  at: string;
  body: string;
  /** flow에서 고친 댓글. 시각 옆에 `수정됨`을 붙인다. */
  edited?: boolean;
  /** flow가 남긴 업무 변경 기록이면 true. 화면에서 흐리게 낸다 (PRD §13 B4). */
  system: boolean;
  /** 답글이면 true. 바로 위 댓글에 달린 말이라 화면에서 한 칸 들여쓴다. */
  reply?: boolean;
  /**
   * 이 줄이 **나를 불렀으면** true. 그 줄만 도드라지게 낸다 (`CommentRows`) — 멘션 모달과
   * 업무 상세 모달이 같이 쓴다. 스무 줄짜리 스레드에서 내가 할 말이 있는 자리는 여기다.
   */
  called?: boolean;
  /**
   * 이 댓글에 붙은 파일. **최신 댓글 두 개까지만 온다** — 파일이 실리는 자리가 게시글 상세의
   * `remarks[]`뿐이고 그게 두 건만 준다 (`getPostBrief`의 `commentFiles`).
   */
  files?: PostFile[];
}

/**
 * 답글이 10건을 넘는 댓글만 나머지를 마저 받는다 (`replyHasNext` — api-spec §13.3).
 * `listComments`가 이미 10건까지 줬으니 보통은 호출이 0회다 — 실측에서 아직 참인 걸 못 봤다.
 *
 * 한 댓글의 추가분을 못 받아도 스레드는 세운다 — 그 댓글은 처음 10건만 보인다.
 */
async function fillReplies(postId: string, comments: FlowComment[]): Promise<FlowComment[]> {
  const more = comments.filter((c) => c.replyHasNext);
  if (!more.length) return comments;

  const filled = await Promise.all(
    more.map((c) => listReplies(postId, c.commentId).catch(() => c.replies ?? [])),
  );
  const byId = new Map(more.map((c, i) => [c.commentId, filled[i]]));
  return comments.map((c) => {
    const replies = byId.get(c.commentId);
    return replies ? { ...c, replies } : c;
  });
}

/**
 * 댓글 원본 → 화면에 낼 줄. `loadTaskPost`가 쓴다 — 업무 상세 모달과 멘션 모달 둘 다.
 *
 * **정렬은 두 층이다.** 최상위 댓글끼리 시각순으로 세우고, 답글은 자기 부모 바로 뒤에 붙인다
 * (그 안에서는 다시 시각순). 전부 한 줄로 섞어 시각순으로 세우면 답글이 부모에서 떨어져 나가
 * 무엇에 대한 말인지 사라진다 — 답글은 부모보다 한참 뒤에 달리는 게 보통이다.
 *
 * `me`(세션의 `userId`)를 주면 나를 부른 줄에 `called`를 붙인다. 판정은 **본문의 멘션
 * 마크업**이다 — 알림으로 맞추면 알림 창(최근 7일·12건)을 벗어난 옛 멘션이 강조에서 빠지고,
 * flow가 남의 이름으로 보내는 엉뚱한 알림까지 따라 들어온다 (api-spec §7.1).
 */
function toThread(
  comments: FlowComment[],
  me?: string,
  /** 댓글 번호 → 첨부. 게시글 상세가 준 최신 두 건뿐이다 (`getPostBrief`). */
  files: Record<string, PostFile[]> = {},
): ThreadComment[] {
  const line = (
    c: {
      contents: string;
      systemCode?: string | null;
      registerName: string;
      registerId: string;
      registeredDateTime: string;
      editedDateTime?: string;
    },
    id: string,
    reply?: boolean,
  ): ThreadComment => {
    // 변경 로그가 사람 댓글보다 많다 (실측 14건 중 10건). 버리지 않고 업무 이력으로 읽는다.
    // 판정은 `isChangeLog`다 — `systemCode`가 truthy여도 사람 댓글인 코드가 있다 (BUG-035).
    const log = isChangeLog(c.systemCode);
    return {
      id,
      from: c.registerName || c.registerId,
      fromId: c.registerId,
      at: c.registeredDateTime,
      body: log ? describeSystemComment(c.systemCode ?? "") : maskMentions(c.contents),
      system: log,
      // 안 고친 댓글은 두 값이 같다 — 다를 때만 붙인다 (실측 2026-08-06).
      ...(!log && c.editedDateTime && c.editedDateTime !== c.registeredDateTime && { edited: true }),
      ...(reply && { reply: true }),
      // 변경 로그는 제외한다 — 담당자로 내 이름이 박힌 기록까지 "나를 부름"이 된다.
      ...(!log && !!me && mentionsMe(c.contents, me) && { called: true }),
      // 답글에는 안 붙는다 — `remarks[]`가 주는 번호는 최상위 댓글 것뿐이다.
      ...(!reply && files[id]?.length && { files: files[id] }),
    };
  };

  return [...comments]
    // 위에서 아래로 읽는 대화다 — 오래된 것부터 쌓는다.
    .sort((a, b) => a.registeredDateTime.localeCompare(b.registeredDateTime))
    .flatMap((c) => [
      line(c, c.commentId),
      ...[...(c.replies ?? [])]
        .sort((a, b) => a.registeredDateTime.localeCompare(b.registeredDateTime))
        .map((r) => line(r, r.replyId, true)),
    ]);
}

export interface TaskPostResult extends ActionResult {
  /** 게시글 본문. 업무 글은 비어 있는 경우가 흔하다 (api-spec §6.2) — 그때는 빈 문자열이다. */
  body: string;
  comments?: ThreadComment[];
  /** 이 업무를 품은 상위 업무 (실측 11/20). 없으면 `undefined`. */
  parent?: PostLink;
  /** 이 업무에 딸린 하위 업무 (실측 1/20). */
  subTasks?: PostLink[];
  /** 첨부 파일. 이미지 첨부도 같은 목록에 섞이고 그쪽만 `thumb`가 있다 (실측 9/20). */
  files?: PostFile[];
}

/**
 * 상세 모달의 본문 + 댓글 전량 (PRD §6.1.4). **모달을 열 때 한 번** 부른다.
 *
 * 본문은 게시글 상세의 `outContent`다 (`getPostBrief`) — 읽기용 평문이라 그대로 화면에 낼 수
 * 있다. `content`는 본문이 표를 담으면 JSON으로 오고(`contentJsonYn: "Y"`), `htmlContent`는
 * 태그째로 온다. 셋 중 벗길 것이 없는 건 `outContent` 하나다 (2026-08-03 실측).
 *
 * 댓글은 `outContent`와 같은 왕복에 못 담는다 — 게시글 상세의 `remarks`는 14건 중 2건만
 * 준다 (api-spec §6.3). 전량은 `GET /user/comments/{postId}`에만 있어서 둘을 나란히 부른다.
 *
 * ponytail: `postId`를 모르는 줄(오늘·팀 화면)은 `resolvePostId`가 한 번 더 나간다 —
 * 같은 모달의 `loadTaskFields`가 이미 부른 조회와 겹친다. 모달을 여는 건 사람 손이라
 * 분당 상한(120)에 닿지 않고, 겹침을 없애려면 두 덩어리의 로딩을 한 줄로 엮어야 한다.
 */
export async function loadTaskPost(input: {
  /** 아는 경우 (내 업무 화면). 없으면 업무 ID·업무명으로 해소한다. */
  postId?: string;
  /** `postId`를 모를 때만 쓴다. 상위·하위 업무를 펼칠 때는 글 번호만 있고 이 셋은 없다. */
  projectId?: string;
  taskId?: string;
  title?: string;
}): Promise<TaskPostResult> {
  try {
    const postId =
      input.postId ||
      (input.projectId && input.taskId
        ? await resolvePostId(input.projectId, input.taskId, input.title ?? "")
        : "");
    if (!postId) return { ok: false, body: "", message: "이 업무는 flow에서 볼 수 있어요." };

    const [post, comments, session] = await Promise.all([
      // 본문은 곁가지다. 못 가져오면 댓글만 뜬다.
      getPostBrief(postId).catch(() => null),
      listComments(postId).then((list) => fillReplies(postId, list)),
      getSession(),
    ]);

    const rows = toThread(comments, session?.userId, post?.commentFiles);
    // 세는 건 **사람이 남긴 말**만이다. 실측 14건 중 10건이 변경 로그라, 전부 세면 "댓글
    // 14개"를 보고 열었는데 사람 말은 4개인 화면이 된다.
    const said = rows.filter((r) => !r.system).length;
    return {
      ok: true,
      body: post?.body ?? "",
      message: said ? `댓글 ${said}개예요.` : "아직 댓글이 없어요.",
      comments: rows.length ? rows : undefined,
      // 셋 다 같은 왕복에 딸려 온 값이다 — 본문 하나 때문에 이미 받던 응답에 들어 있었다.
      parent: post?.parent ?? undefined,
      subTasks: post?.subTasks?.length ? post.subTasks : undefined,
      files: post?.files.length ? post.files : undefined,
    };
  } catch (error) {
    return { ok: false, body: "", message: reasonOf(error) };
  }
}

export interface NewsTaskResult extends ActionResult {
  task?: WorklistTask;
  /**
   * 업무가 아니어서 못 찾았다 — 공지·회의록·일정이다. 부른 쪽은 이때 **글 모달**을 연다
   * (`useTaskModal`). REST 오류로 실패한 것과 갈라야 한다: 그쪽은 다시 눌러 볼 일이고,
   * 이쪽은 다시 눌러도 영영 업무가 아니다.
   */
  notTask?: boolean;
}

/**
 * 알림 한 줄 → 상세 모달이 그릴 업무 (PRD §6.1.4). 헤더 알림을 누를 때 한 번 부른다.
 *
 * 알림은 `postId`만 준다. 상세 모달은 `taskSrno`를 요구해서(상태·마감일·우선순위 쓰기가 다
 * 그 값을 쓴다) 게시글 상세를 한 번 부른다 — 그 응답의 `tasks[0]`이 업무 번호와 함께
 * **이 글이 업무인지 아닌지**를 같이 말해 준다 (`getPostBrief`).
 *
 * 예전에는 업무명으로 업무 목록을 뒤졌다(`findTaskByPost`). 제목이 안 걸리거나 100건 밖으로
 * 밀린 업무가 **업무가 아닌 글**로 보였고, 그 조회가 한 번 실패하면 화면이 flow 링크로
 * 내보냈다 — 멀쩡한 업무인데도. 판정 재료를 글 자신에게서 받으면 둘 다 안 생긴다.
 *
 * 프로젝트명은 알림 목록이 들고 있는 값을 그대로 받는다 — 게시글 상세에 없는 유일한 값이다.
 *
 * 업무가 아닌 글(공지·회의록·일정)은 `notTask`로 돌려주고 부른 쪽이 **글 모달**을 연다 —
 * 본문·첨부·댓글은 글 번호 하나로 다 읽어 온다 (`loadTaskPost`). 고칠 값이 없을 뿐이지
 * 읽을 것은 업무와 똑같이 있다.
 */
export async function loadNewsTask(input: {
  projectId: string;
  postId: string;
  /** 알림이 푼 업무명. 게시글 상세가 제목을 못 주면 이걸 쓴다. */
  title?: string;
  /** 알림이 푼 프로젝트명. 모달 머리에 그대로 쓴다. */
  project?: string;
  /** 알림이 든 `connectUrl`. 로그인 화면을 건너서도 대상을 지킨다 (BUG-024). */
  url?: string;
}): Promise<NewsTaskResult> {
  try {
    const brief = await getPostBrief(input.postId);
    if (!brief.task) return { ok: false, notTask: true, message: "업무가 아닌 글이에요." };

    const deadline = parseFlowDeadline(brief.task.endDate);
    return {
      ok: true,
      message: "",
      task: {
        taskSrno: Number(brief.task.taskId),
        title: brief.title ?? input.title ?? "제목 없는 업무",
        status: brief.status ?? "",
        project: input.project ?? "",
        endDate: brief.task.endDate,
        regDate: brief.task.regDate,
        author: brief.task.author,
        editDate: brief.task.editDate || undefined,
        priority: brief.task.priority || undefined,
        postId: input.postId,
        daysLeft: deadline === null ? 0 : diffDays(Date.now(), deadline),
        link: input.url || brief.url || flowPostUrl(input.projectId, input.postId),
      },
    };
  } catch (error) {
    return { ok: false, message: reasonOf(error) };
  }
}

export interface ParticipantResult extends ActionResult {
  participants?: Participant[];
}

/** 전사 명단 캐시(초). 얼굴이 바뀌는 일이 드물어서 길게 잡는다 — 카드를 여러 장 열어도 1회다. */
const ROSTER_TTL = 600;

/**
 * 프로젝트 참여자 + 얼굴·직책·부서.
 *
 * 참여자 API(§5.4)는 이름과 id뿐이라 전사 명단(§9.3)에서 이메일로 맞춰 붙인다 — **우리 기관
 * 사람만** 그 명단에 있다. 명단은 10분 캐시라 화면에서 여러 번 불러도 실제 호출은 한 번이고,
 * 실패해도 이름만으로 목록이 선다 (곁가지다).
 */
async function participantsOf(projectId: string): Promise<Participant[]> {
  const [participants, roster] = await Promise.all([
    listParticipants(projectId),
    searchEmployees(undefined, ROSTER_TTL)
      .then((d) => d.employees)
      .catch(() => []),
  ]);

  const by = new Map(roster.map((e) => [e.email.toLowerCase(), e]));
  return participants.map((p) => {
    const found = p.outside ? undefined : by.get(p.userId.toLowerCase());
    return found
      ? {
          ...p,
          photo: found.profileImagePath,
          title: found.responsibility,
          division: found.divisionName,
        }
      : p;
  });
}

/**
 * 담당자 후보이자 댓글에서 부를 사람. 프로젝트마다 한 번, 누를 때만 부른다.
 *
 * 참여자 API가 우리 기관 사람만 줘서 그 프로젝트 업무에 이름이 있는 사람을 더한다
 * (`listParticipants`) — 그래서 REST 두 번이다. 누를 때만 부르는 이유가 여기 있다.
 */
export async function loadParticipants(
  _prev: ParticipantResult | null,
  form: FormData,
): Promise<ParticipantResult> {
  const projectId = String(form.get("projectId") ?? "");
  if (!projectId) return { ok: false, message: "프로젝트를 찾지 못했어요." };

  try {
    const participants = await participantsOf(projectId);
    if (!participants.length) return { ok: false, message: "참여자를 찾지 못했어요." };
    return { ok: true, message: `참여자 ${participants.length}명이에요.`, participants };
  } catch (error) {
    return { ok: false, message: reasonOf(error) };
  }
}

export interface ProjectPanelResult extends ActionResult {
  participants?: Participant[];
  /** 업무가 아닌 글(공지·회의록·일정). 없으면 화면이 그 칸을 안 그린다. */
  posts?: ProjectPost[];
}

/**
 * 내 업무 카드를 펼쳤을 때 오른쪽에 붙는 참여자 목록과 업무 아닌 글 (PRD §6.5).
 *
 * **펼칠 때만 부른다.** 카드 하나에 REST 세 번이고(참여자 목록 + 업무에서 긁기 + 게시글) 화면에
 * 카드가 실측 38개다 — 미리 부르면 114번이라 분당 120번 한도를 화면 하나가 다 먹는다.
 * 겉면(§5.3)은 접힌 카드도 쓰므로 여기가 아니라 `loadMyTasks`가 미리 받아 둔다.
 * 전사 명단은 10분, 게시글은 5분 캐시다.
 *
 * 게시글은 곁가지다 — 그쪽이 죽어도 참여자는 그대로 나온다.
 */
export async function loadProjectPanel(projectId: string): Promise<ProjectPanelResult> {
  if (!projectId) return { ok: false, message: "프로젝트를 찾지 못했어요." };

  try {
    const [participants, posts] = await Promise.all([
      participantsOf(projectId),
      listProjectPosts(projectId).catch(() => []),
    ]);
    return { ok: true, message: "", participants, posts };
  } catch {
    return { ok: false, message: "참여자를 못 가져왔어요." };
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

export interface EventResult extends ActionResult {
  detail?: EventDetail;
}

/**
 * 일정 하나의 설명·장소·참석자·반복 주기 (PRD §13 B3).
 *
 * **펼칠 때만 부른다.** 목록(§8.2)이 이름·시각·색까지 주고 나머지는 상세(§8.5)에만 있는데,
 * 일정 한 건에 REST 한 번이다. 서랍을 열면 그날 일정이 예닐곱 줄이라 미리 받으면 화면 하나가
 * 예닐곱 번을 먹는다 — 실제로 펼치는 줄은 보통 하나다.
 *
 * 시각 둘을 같이 넘기는 이유는 반복 일정 때문이다 (`getEvent`).
 */
export async function loadEvent(
  eventSrno: string,
  startDateTime: string,
  finishDateTime: string,
): Promise<EventResult> {
  if (!eventSrno) return { ok: false, message: "일정을 찾지 못했어요." };

  try {
    return {
      ok: true,
      message: "",
      detail: await getEvent(eventSrno, startDateTime, finishDateTime),
    };
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
  members?: SearchMember[];
  events?: SearchEvent[];
  /** 못 가져온 갈래 이름(`"일정 · 구성원"`). 결과가 있어도 화면이 이 줄을 따로 밝힌다. */
  missing?: string;
  /** flow가 준 `hasNext`. 업무·글 아래 `더 보기`가 나올지 정한다 (`searchMorePosts`). */
  hasMorePosts?: boolean;
}

/** 검색어 길이 상한. flow가 100자까지 받는다 (api-spec §9.1). */
const SEARCH_MAX = 100;
/** 갈래별로 몇 줄까지 볼지. 넷을 합쳐 한 화면에 담기는 수다 (PRD §6.4). */
const SEARCH_SIZE = { projects: 4, posts: 6, members: 4, events: 4 } as const;
/**
 * `더 보기` 한 번에 받는 업무·글 수.
 *
 * 여섯 줄은 네 갈래를 한 화면에 담으려고 좁힌 수라, 정작 찾던 게 글일 때는 그 여섯이 다
 * 스쳐 지나간 것일 수 있다. 서른이면 팔레트 안에서 스크롤로 훑을 만하고, 여기서도 못 찾으면
 * 그건 검색어 문제다.
 */
const SEARCH_MORE = 30;
/**
 * 일정 검색 창. `/user/search/events`는 시작·끝이 **필수**라 여기서 정한다 (api-spec §9.4).
 *
 * 뒤로 석 달은 "지난 그 회의 언제였지", 앞으로 반년은 잡아 둔 일정이다. 더 넓히면 몇 해 전
 * 반복 일정이 상위 네 줄을 채운다.
 */
const EVENT_WINDOW = { back: 90, ahead: 180 } as const;

/**
 * 검색 팔레트 (PRD §6.4). 프로젝트 · 글 · 구성원 · 일정을 한 번에 찾는다.
 *
 * 두 글자부터 받는다 — flow는 한 글자도 받지만 결과가 수천이라 고를 수가 없다.
 * 입력을 그대로 URL에 넣는 자리라 길이를 여기서 자른다.
 *
 * **구성원만 flow에 안 묻는다.** `/user/search/employees`의 `searchWord`는 공용 API 키로
 * 남의 이름을 훑는 손잡이라 요청 값을 넘기지 않는다 (api-spec §9.3, PRD §8.1). 10분 캐시된
 * 전사 명단에서 고른다 (`pickMembers`) — 그래서 REST는 실제로 세 번이다.
 *
 * 갈래마다 따로 실패한다. 둘일 때는 한쪽이 죽으면 둘 다 실패로 냈지만, 넷이 되면서 일정
 * 하나 때문에 프로젝트 검색까지 날리는 게 더 나쁜 거래가 됐다 — 대신 못 가져온 갈래를
 * `missing`에 적어 화면이 밝힌다.
 */
export async function searchFlow(word: string): Promise<SearchResult> {
  const searchWord = word.trim().slice(0, SEARCH_MAX);
  if (searchWord.length < 2) return { ok: false, message: "두 글자 이상 적어주세요." };

  const now = Date.now();
  const [projects, page, members, events] = await Promise.all([
    searchProjects(searchWord, SEARCH_SIZE.projects).catch(() => null),
    searchPosts(searchWord, SEARCH_SIZE.posts).catch(() => null),
    loadMembers(ROSTER_TTL)
      .then((roster) => pickMembers(roster, searchWord, SEARCH_SIZE.members))
      .catch(() => null),
    searchEvents(
      searchWord,
      `${kstYmd(now - EVENT_WINDOW.back * DAY_MS)}000000`,
      `${kstYmd(now + EVENT_WINDOW.ahead * DAY_MS)}235959`,
      SEARCH_SIZE.events,
    ).catch(() => null),
  ]);

  // `page`가 null이면 실패, `page.posts`가 빈 배열이면 성공했는데 0건이다 — 둘을 안 섞는다.
  const posts = page?.posts ?? null;
  const groups = [
    ["프로젝트", projects],
    ["업무 · 글", posts],
    ["구성원", members],
    ["일정", events],
  ] as const;
  const missing = groups.filter(([, rows]) => rows === null).map(([name]) => name);
  const found = groups.reduce((n, [, rows]) => n + (rows?.length ?? 0), 0);

  return {
    ok: missing.length < groups.length,
    // 결과가 있으면 화면이 목록만 그린다 — 이 문구는 빈 결과에서만 읽힌다.
    message: found
      ? ""
      : missing.length
        ? "지금은 못 찾았어요. 잠시 뒤에 다시 해 보세요."
        : "다른 말로 찾아보세요.",
    missing: missing.join(" · "),
    hasMorePosts: page?.hasNext ?? false,
    projects: projects ?? [],
    posts: posts ?? [],
    members: members ?? [],
    events: events ?? [],
  };
}

/**
 * 업무·글만 더. 첫 검색의 여섯 줄이 상위 여섯이라 그 아래를 못 봤을 때 부른다.
 *
 * **다른 세 갈래는 안 건드린다.** 화면이 이미 들고 있는 결과에 이 갈래만 갈아 끼운다 —
 * 넷을 다시 부르면 REST 세 번이 더 나가는데 늘어나는 정보는 글뿐이다.
 *
 * ponytail: 한 단계다. 서른에서 또 `더 보기`를 붙이면 다음은 백이고, 백 줄을 팔레트에서
 * 스크롤할 사람은 없다 — 거기까지 갔으면 검색어가 틀린 것이다.
 */
export async function searchMorePosts(word: string): Promise<SearchResult> {
  const searchWord = word.trim().slice(0, SEARCH_MAX);
  if (searchWord.length < 2) return { ok: false, message: "두 글자 이상 적어주세요." };

  try {
    const { posts } = await searchPosts(searchWord, SEARCH_MORE);
    return { ok: true, message: "", posts };
  } catch (error) {
    return { ok: false, message: reasonOf(error) };
  }
}

/**
 * 쓰기 공통부. 성공하면 해당 경로를 다시 불러오고, 실패하면 flow가 준 사유를 그대로 낸다.
 *
 * **개인 키가 없으면 아예 막는다** — 공용 환경변수 키로 나가면 변경이 남의 이름으로
 * 기록된다 (rest.ts 상단 주석). 읽기는 그래도 화면이 서지만 쓰기는 안 된다.
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
