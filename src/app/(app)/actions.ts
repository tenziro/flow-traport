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
import { FlowMcpError } from "@/lib/flow/mcp";
import { flowMcp } from "@/lib/flow/queries";
import { resolvePostId } from "@/lib/flow/rest";
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
