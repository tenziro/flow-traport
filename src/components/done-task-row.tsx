import { FlowLink } from "@/components/flow-link";
import { IconCalendar } from "@/components/icons";
import { StatusPill } from "@/components/status-pill";
import type { WorklistTask } from "@/lib/flow/queries";
import { fmtDate } from "@/lib/utils";

/**
 * 끝난 업무 한 줄 (내 업무 화면). `TaskItem`과 달리 **읽기만** 한다 — 상태·마감일을 바꾸는
 * 패널이 없다. 실측 880건 중 740건이 완료라, 이미 끝난 줄마다 편집 버튼을 달면 화면이
 * 버튼 밭이 되고 되돌릴 일도 거의 없다.
 *
 * D-DAY 배지도 없다. 끝난 업무에 남은 일수는 볼 이유가 없다. 마지막 댓글도 없다 — 끝난
 * 줄에 댓글까지 달면 한 줄이 세 줄이 되고, 실측 818건이 이 목록이라 펼치는 순간 화면이
 * 댓글 벽이 됐다. 어떻게 끝났는지는 `flow에서 열기`로 본다.
 */
export function DoneTaskRow({ task }: { task: WorklistTask }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5 text-xs">
      <span className="min-w-0 flex-1 basis-full truncate text-sm text-muted-foreground sm:basis-auto">
        {task.title}
      </span>
      <StatusPill status={task.status} />
      {task.endDate && (
        <span className="tabular flex shrink-0 items-center gap-1 text-muted-foreground">
          <IconCalendar size={11} />
          <span className="sr-only">마감일 </span>
          {fmtDate(task.endDate)}
        </span>
      )}
      <FlowLink href={task.link} className="shrink-0" />
    </div>
  );
}
