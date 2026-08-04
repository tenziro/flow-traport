"use client";

import { type ThreadComment } from "@/app/(app)/actions";
import { IconHistory, IconLastComment, IconSubTask } from "@/components/icons";
import { LinkedText } from "@/components/linked-text";
import { cn, fmtDateTime } from "@/lib/utils";

/** 답글을 달 대상. `id`는 flow의 댓글 번호(`colabo_remark_srno`)다. */
export type ReplyTarget = { id: string; from: string };

/**
 * 댓글 줄들. 멘션 상세 모달(`MentionDetail`)과 업무 상세 모달(`TaskThread`)이 같이 쓴다 —
 * 같은 댓글이 자리마다 다르게 생기면 같은 것인지 알아보는 데 시간이 든다.
 *
 * **답글은 부모 바로 아래, 한 칸 들여쓰고 말풍선 앞에 `↳`가 선다** (`reply` — `toThread`).
 * 업무 표의 하위 업무와 같은 표시다 (`IconSubTask` — `TaskTable`) — 세로선은 폭이 좁아지면
 * 흐려지는데 화살표는 폭과 무관하고, 같은 "무엇에 딸린 것"을 두 화면이 같은 모양으로 말한다.
 */
export function CommentRows({
  comments,
  onReply,
  replyingTo,
}: {
  comments: ThreadComment[];
  /** 주면 사람 댓글에 `답글` 버튼이 붙는다. 시스템 기록에는 안 붙인다 — 답할 상대가 없다. */
  onReply?: (target: ReplyTarget) => void;
  /** 지금 답글을 달고 있는 댓글. 입력칸이 어느 말에 붙는지 목록에서도 보인다. */
  replyingTo?: string;
}) {
  return (
    <ul className="space-y-2.5">
      {comments.map((comment) => {
        // 나를 부른 줄 (`ThreadComment.called`). 스레드 전량을 펼쳐 두면 내가 왜 불렸는지가
        // 스무 줄 사이에 묻혀서, 그 줄만 면과 아이콘 색을 올린다.
        const called = comment.called ?? false;
        return (
        <li
          key={comment.id}
          className={cn(
            "flex gap-2",
            // 나를 부른 줄. 여백을 음수로 되돌려서 면만 넓어지고 글자는 제자리에 있는다 —
            // 강조된 줄에서 글이 밀리면 목록의 왼쪽 끝이 들쭉날쭉해진다
            called && "-mx-2 rounded-md bg-primary/5 px-2 py-1.5",
            // 답글은 한 칸 들여선다. 강조된 줄은 여백이 음수라 그만큼 더 준다 —
            // 답글 두 줄이 강조 여부에 따라 서로 어긋나 보이면 계단이 두 개가 된다
            comment.reply && (called ? "pl-7" : "pl-5"),
          )}
        >
          {/* 답글 표시. 말풍선 앞에 서서 "이건 위 말에 붙은 답"을 말한다 */}
          {comment.reply && (
            <>
              <span className="sr-only">답글 </span>
              <IconSubTask size={14} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
            </>
          )}
          {/* 시스템 기록은 되감기, 사람 댓글은 말풍선. 색까지 다르게 둔다 —
              아이콘만으로는 촘촘한 목록에서 둘이 섞여 보였다 */}
          {comment.system ? (
            <IconHistory size={13} className="mt-0.5 shrink-0 text-muted-foreground/60" />
          ) : (
            <IconLastComment
              size={14}
              className={cn("mt-0.5 shrink-0", called ? "text-primary" : "text-muted-foreground")}
            />
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
              {/* 면과 아이콘 색만으로는 색을 못 가리는 사람에게 아무 표시가 없다 */}
              {called && <span className="font-medium text-primary">나를 부름</span>}
              {comment.system && <span className="text-muted-foreground/70">기록</span>}
              <span className="text-muted-foreground">{fmtDateTime(comment.at)}</span>
              {/* 이름·시각과 같은 줄이다. 줄을 하나 더 쓰면 댓글 스무 개에 빈 줄이 스무 개고,
                  hover에 숨기면 만질 수 있는지를 만져 봐야 안다 */}
              {onReply && !comment.system && (
                <button
                  type="button"
                  onClick={() => onReply({ id: comment.id, from: comment.from })}
                  className={cn(
                    "cursor-pointer font-medium transition-colors hover:text-primary",
                    replyingTo === comment.id ? "text-primary" : "text-muted-foreground/70",
                  )}
                >
                  답글
                </button>
              )}
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
              {/* 본문과 같이 주소를 새 창 링크로 낸다 (`LinkedText`) — 업무에 붙는 주소는
                  본문보다 댓글로 더 자주 온다 */}
              <LinkedText text={comment.body} />
            </p>
          </div>
        </li>
        );
      })}
    </ul>
  );
}
