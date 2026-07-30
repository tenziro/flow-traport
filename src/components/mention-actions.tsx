"use client";

import { useActionState } from "react";
import { markMentionsRead, type ActionResult } from "@/app/(app)/actions";
import { IconCheck, IconNormal } from "@/components/icons";
import { Button } from "@/components/motion/button/base";
import { ThreadView } from "@/components/thread-view";
import { cn } from "@/lib/utils";

/**
 * 멘션 그룹 아래에 붙는 두 가지 (PRD §13 A1·A2).
 *
 * - **읽음으로 만들기**: 워크리스트 멘션에는 알림 ID가 없어서 예전에는 flow로 넘어가야 했다.
 *   REST 알림이 `alarmId`를 주면서 여기서 처리할 수 있게 됐다 (api-spec §7.2).
 * - **댓글 다 보기**: 알림은 나를 부른 댓글만 준다. 앞뒤 맥락은 스레드 전량에 있다.
 *
 * 읽음 처리는 **확인 단계를 두지 않는다.** PRD §8.1의 원칙에서 이것만 빼는 이유는, 확인을
 * 두는 근거가 "되돌릴 때 이전 상태를 몰라서"인데 읽음의 이전 상태는 정확히 안 읽음 하나고,
 * 잃는 데이터도 없기 때문이다(멘션 줄은 그대로 남고 강조만 빠진다). 알림 세 건마다 두 번씩
 * 누르게 만들면 아무도 안 쓴다.
 */
export function MentionActions({
  alarmIds,
  unread,
  postId,
  path,
}: {
  /** 이 그룹의 알림 ID 전량. 비어 있으면 읽음 버튼을 감춘다 (알림 조인이 어긋난 그룹). */
  alarmIds: string[];
  /** 안 읽은 건수. 0이면 이미 다 읽은 그룹이라 버튼이 필요 없다. */
  unread: number;
  /** 스레드 전량을 부를 때 쓴다. 없으면 스레드 버튼을 감춘다. */
  postId?: string;
  path: string;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    markMentionsRead,
    null,
  );

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {unread > 0 && alarmIds.length > 0 && !result?.ok && (
          <form action={action}>
            <input type="hidden" name="alarmIds" value={alarmIds.join(",")} />
            <input type="hidden" name="path" value={path} />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              disabled={pending}
              className="h-7 px-2"
            >
              <IconCheck size={13} />
              {pending ? "처리하는 중…" : `${unread}건 읽음으로`}
            </Button>
          </form>
        )}
        {/* 이 줄에서 혼자 한 줄을 쓴다 (`basis-full`). 버튼 옆에 끼면 폭이 버튼 너비로
            줄어드는데, 기다리는 동안 세우는 골격은 폭을 비율로 잡아서(`w-full`) 기댈 폭이
            없으면 막대가 사라진다 — 도착할 댓글도 본문 아래 전폭으로 앉을 자리가 맞다 */}
        {postId && <ThreadView postId={postId} className="basis-full" />}
      </div>

      {result && (
        <p
          role="status"
          className={cn(
            "flex items-start gap-1 text-xs",
            result.ok ? "text-success-foreground" : "text-danger-foreground",
          )}
        >
          {result.ok && <IconNormal size={13} className="mt-0.5 shrink-0" />}
          <span className="min-w-0 flex-1 break-words">{result.message}</span>
        </p>
      )}
    </div>
  );
}
