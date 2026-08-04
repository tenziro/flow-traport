"use client";

import { useCallback, useEffect, useState } from "react";
import { loadTaskPost, type TaskPostResult } from "@/app/(app)/actions";
import { IconLastComment } from "@/components/icons";
import { LinkedText } from "@/components/linked-text";
import { Button } from "@/components/motion/button/base";
import { CommentRowsSkeleton } from "@/components/skeletons";
import { CommentForm } from "@/components/task-actions";
import { CommentRows, type ReplyTarget } from "@/components/thread-view";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** 접힌 채로 보여줄 댓글 수. 이보다 많으면 `댓글 다 보기`로 나머지를 펼친다. */
const SHOWN = 3;

/**
 * 상세 모달의 본문 + 댓글 (PRD §6.1.4).
 *
 * **열 때 한 번 부른다** (`loadTaskPost` — 본문 1회 + 댓글 1회). 전에는 댓글을 `댓글 다 보기`를
 * 눌러야 받았는데, 그건 업무 줄마다 댓글 덩어리가 붙어 있던 때의 규칙이다. 지금은 표에서
 * 업무명을 눌러 여는 자리라 열린 업무가 하나뿐이다 — 여기까지 들어온 사람은 이 업무를 보러
 * 온 것이니 열자마자 채운다.
 *
 * 최신 세 개만 펼쳐 둔다. 실측 14건 중 10건이 시스템 기록(담당자·마감일 변경)이라
 * 전량을 그대로 쌓으면 사람이 남긴 말이 기록 사이에 묻힌다. 나머지는 `댓글 다 보기`다.
 *
 * 순서는 위에서 아래로 읽는 대화 그대로다 — 오래된 것이 위, 최신이 아래, 그 아래가 입력칸이다.
 * 그래서 접었을 때 남는 세 개는 **마지막** 세 개이고, 펼치는 버튼은 목록 위에 붙는다.
 */
export function TaskThread({
  projectId,
  taskId,
  title,
  postId,
  path,
}: {
  projectId: string;
  taskId: number;
  title: string;
  /** 아는 경우 (내 업무 화면). 없으면 서버가 업무 ID·업무명으로 해소한다. */
  postId?: string;
  path: string;
}) {
  const [got, setGot] = useState<TaskPostResult | null>(null);
  const [all, setAll] = useState(false);
  /** 댓글을 남긴 뒤 다시 부르는 스위치. 방금 남긴 말이 목록에 안 보이면 남았는지 알 수 없다. */
  const [reload, setReload] = useState(0);
  /** 답글을 달 댓글. 비어 있으면 입력칸이 일반 댓글이다. */
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  useEffect(() => {
    let live = true;
    loadTaskPost({ projectId, taskId: String(taskId), title, postId }).then((result) => {
      if (live) setGot(result);
    });
    // 모달을 닫는 동안 응답이 오면 사라진 컴포넌트에 값을 넣는다 — 그래서 살아 있는지 본다.
    return () => {
      live = false;
    };
  }, [projectId, taskId, title, postId, reload]);

  const onSaved = useCallback(() => {
    setReload((n) => n + 1);
    // 남긴 뒤에는 일반 댓글로 돌아온다 — 답글 하나 달고 다음 말을 또 그 밑에 붙일 이유는 없다
    setReplyTo(null);
  }, []);
  const cancelReply = useCallback(() => setReplyTo(null), []);

  if (!got) {
    return (
      <div className="space-y-3 border-b border-border px-5 py-4">
        <Skeleton className="h-3 w-12 rounded-md" />
        {/* 도착하면 이 자리에 글자만 앉는다 — 세 줄이 접힌 기본값과 같은 수다 */}
        <CommentRowsSkeleton count={SHOWN} />
      </div>
    );
  }

  const comments = got.comments ?? [];
  const hidden = Math.max(comments.length - SHOWN, 0);

  return (
    <>
      {/* 본문 — 업무 제목만으로는 무슨 일인지 모르는 경우가 많다. 비어 있는 업무 글이 흔해서
          (api-spec §6.2) 없으면 덩어리째 뺀다 */}
      {got.body && (
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground">본문</p>
          {/* 줄바꿈을 살린다 — 본문이 목록으로 오는 경우가 많다.
              `wrap-anywhere` — 본문에 섞여 오는 링크는 띄어쓰기가 없다 (BUG-025) */}
          {/* 이 모달에서 제일 오래 읽는 글이라 값 다섯 줄(text-xs)보다 한 급 크다 */}
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line wrap-anywhere">
            <LinkedText text={got.body} />
          </p>
        </div>
      )}

      <div className="space-y-3 border-b border-border px-5 py-4">
        {/* 갯수와 펼치기를 한 줄 양 끝에 둔다 — 둘 다 "이 목록이 전부냐"에 대한 답이라
            같은 줄에서 읽힌다. 버튼을 아래 줄에 따로 두면 목록의 첫 줄처럼 보였다 */}
        <div className="flex items-center justify-between gap-2">
          <p className="tabular text-xs font-semibold text-muted-foreground">
            댓글{comments.length > 0 && ` ${comments.length}개`}
          </p>
          {hidden > 0 && !all && (
            // `-my-1` — 버튼(h-7)이 줄 높이를 밀어 본문 간격이 어긋나는 걸 막는다
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAll(true)}
              className="-my-1 h-7 px-2"
            >
              <IconLastComment size={13} />
              댓글 다 보기
            </Button>
          )}
        </div>

        {comments.length === 0 ? (
          <p
            role="status"
            className={cn("text-xs", got.ok ? "text-muted-foreground" : "text-danger-foreground")}
          >
            {got.message}
          </p>
        ) : (
          <CommentRows
            comments={all ? comments : comments.slice(-SHOWN)}
            onReply={setReplyTo}
            replyingTo={replyTo?.id}
          />
        )}

        {/* 입력칸은 제일 아래다 — 위의 대화를 읽고 그 끝에 말을 붙이는 순서다 */}
        <CommentForm
          projectId={projectId}
          taskId={taskId}
          title={title}
          path={path}
          replyTo={replyTo}
          onCancelReply={cancelReply}
          onSaved={onSaved}
        />
      </div>
    </>
  );
}
