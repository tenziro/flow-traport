"use client";

import { useActionState } from "react";
import { scanStaleTasks, type StaleResult } from "@/app/(app)/actions";
import { IconStale } from "@/components/icons";
import { Button } from "@/components/motion/button/base";
import { StatusPill } from "@/components/status-pill";
import { cn, fmtDate } from "@/lib/utils";

/**
 * 오래 방치된 업무 스캔 (PRD §13 B5).
 *
 * 오늘 화면의 "방치된 업무"는 **내 담당**만, 그것도 워크리스트 활동 창(180일) 안에서만
 * 센다. 프로젝트 안에 마감이 재작년인 채로 남아 있는 남의 업무는 어디에도 안 뜬다 —
 * 그걸 프로젝트 단위로 훑는 게 이 버튼이다.
 *
 * **누를 때만 부른다.** 프로젝트 하나에 REST 최대 3회(100건 × 3)라, 리스크 화면의
 * 프로젝트 카드 전부가 자동으로 부르면 열 개 프로젝트에 서른 번이다.
 */
export function StaleScan({
  projectId,
  className,
}: {
  projectId: string;
  className?: string;
}) {
  const [result, action, pending] = useActionState<StaleResult | null, FormData>(
    scanStaleTasks,
    null,
  );

  return (
    <div className={cn("space-y-2", className)}>
      {/* 한 번 받아 오면 버튼을 지운다 — 같은 걸 또 받을 이유가 없다 */}
      {!result?.tasks && (
        <form action={action}>
          <input type="hidden" name="projectId" value={projectId} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            disabled={pending}
            className="h-7 px-2"
          >
            <IconStale size={13} />
            {pending ? "훑는 중…" : "180일 넘게 방치된 업무 찾기"}
          </Button>
        </form>
      )}

      {result && !result.tasks && (
        <p
          role="status"
          className={cn(
            "text-xs",
            result.ok ? "text-muted-foreground" : "text-danger-foreground",
          )}
        >
          {result.message}
        </p>
      )}

      {result?.tasks && (
        <>
          <p className="tabular text-xs text-muted-foreground">
            {result.message}
            {/* 상한에 걸렸으면 밝힌다. 조용히 자르면 "이게 전부"로 읽힌다 */}
            {result.hasMore && " 300건까지만 훑었어요."}
          </p>
          <ul className="space-y-2">
            {result.tasks.map((task) => (
              <li key={task.taskId} className="flex items-start gap-2">
                <IconStale
                  size={14}
                  className="mt-0.5 shrink-0 text-neutral-foreground"
                />
                <div className="min-w-0 flex-1">
                  {/* 다른 화면의 업무 제목처럼 한 줄에서 자른다 (task-item.tsx) */}
                  <p className="truncate text-[13px] leading-snug font-medium">
                    {task.title}
                  </p>
                  <p className="tabular mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <StatusPill status={task.status} />
                    <span>마감 {fmtDate(task.endDate)}</span>
                    {/* 담당자가 없는 채로 방치된 업무가 실제로 있다 — 그것도 정보다 */}
                    <span>
                      {task.workers.length > 0
                        ? task.workers.join(", ")
                        : "담당자 없음"}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
