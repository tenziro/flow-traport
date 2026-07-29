"use client";

import { useActionState } from "react";
import { loadThread, type ThreadResult } from "@/app/(app)/actions";
import { IconLastComment, IconOpen } from "@/components/icons";
import { Button } from "@/components/motion/button/base";
import { cn, fmtDateTime } from "@/lib/utils";

/**
 * 전체 댓글 스레드 (PRD §13 A1·B4).
 *
 * **누를 때만 부른다.** 게시글 상세(`flow_get_post`)는 14건 중 2건만 주고, 전량은
 * `GET /user/comments/{postId}`에만 있다 (api-spec §13.1) — 그런데 그건 게시글 하나에
 * 호출 하나다. 화면을 열 때 다 부르면 업무 열 줄에 열 번이라, 필요한 사람이 눌러서 받는다.
 *
 * `postId`를 아는 자리(멘션 알림)는 그대로 넘기고, 모르는 자리(업무 행)는 업무 ID와
 * 업무명으로 서버가 해소한다 (`resolvePostId` — BUG-005).
 *
 * 시스템 댓글도 버리지 않는다. 실측 14건 중 10건이 시스템 댓글(담당자·마감일·우선순위 변경
 * 기록)이었고, 그게 곧 이 업무의 활동 이력이다 (PRD §13 B4). 사람 댓글과 색으로 구분한다.
 */
export function ThreadView({
  postId,
  projectId,
  taskId,
  title,
  className,
}: {
  /** 아는 경우. 멘션 알림은 `postId`를 준다. */
  postId?: string;
  /** 모르는 경우. 업무 행은 이 셋으로 서버가 `postId`를 찾는다. */
  projectId?: string;
  taskId?: string | number;
  title?: string;
  className?: string;
}) {
  const [result, action, pending] = useActionState<ThreadResult | null, FormData>(
    loadThread,
    null,
  );

  return (
    <form action={action} className={className}>
      {postId && <input type="hidden" name="postId" value={postId} />}
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      {taskId !== undefined && <input type="hidden" name="taskId" value={taskId} />}
      {title && <input type="hidden" name="title" value={title} />}

      {/* 한 번 받아 오면 버튼을 지운다 — 같은 걸 또 받을 이유가 없다 */}
      {!result?.comments && (
        <Button type="submit" size="sm" variant="ghost" disabled={pending} className="h-7 px-2">
          <IconLastComment size={13} />
          {pending ? "가져오는 중…" : "댓글 다 보기"}
        </Button>
      )}

      {result && !result.comments && (
        <p
          role="status"
          className={cn(
            "mt-1 text-xs",
            result.ok ? "text-muted-foreground" : "text-danger-foreground",
          )}
        >
          {result.message}
        </p>
      )}

      {result?.comments && (
        <>
          <p className="tabular mb-2 text-xs text-muted-foreground">{result.message}</p>
          <ul className="space-y-2.5">
            {result.comments.map((comment) => (
              <li key={comment.id} className="flex gap-2">
                {/* 시스템 기록은 화살표, 사람 댓글은 말풍선. 색까지 다르게 둔다 —
                    아이콘만으로는 촘촘한 목록에서 둘이 섞여 보였다 */}
                {comment.system ? (
                  <IconOpen size={13} className="mt-0.5 shrink-0 text-muted-foreground/60" />
                ) : (
                  <IconLastComment size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="tabular flex flex-wrap items-baseline gap-x-1.5 text-xs">
                    <span
                      className={cn(
                        "font-medium",
                        comment.system ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {comment.from}
                    </span>
                    {comment.system && <span className="text-muted-foreground/70">기록</span>}
                    <span className="text-muted-foreground">{fmtDateTime(comment.at)}</span>
                  </p>
                  {/* 줄바꿈은 살린다 — 댓글이 목록 형태로 오는 경우가 많다.
                      `wrap-anywhere` — 링크는 띄어쓰기가 없어서 안 끊으면 그 한 덩어리가
                      카드 최소폭이 되고 좁은 화면에서 카드가 화면을 넘는다 (BUG-025) */}
                  <p
                    className={cn(
                      "mt-0.5 text-[13px] leading-relaxed whitespace-pre-line wrap-anywhere",
                      comment.system && "text-muted-foreground",
                    )}
                  >
                    {comment.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </form>
  );
}
