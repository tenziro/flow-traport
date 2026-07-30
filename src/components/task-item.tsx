import { FlowLink } from "@/components/flow-link";
import { IconCalendar, IconComment, IconMention } from "@/components/icons";
import { LastComment } from "@/components/last-comment";
import { Meter } from "@/components/meter";
import { StatusPill } from "@/components/status-pill";
import { TaskActions } from "@/components/task-actions";
import type { FocusPick, WorklistTask } from "@/lib/flow/queries";
import { cn, fmtDate } from "@/lib/utils";

/**
 * 업무 한 줄. 오늘 화면(포커스 · 밀리는 업무 · 방치된 업무)과 팀 화면이 같은 모양을 쓴다 —
 * 같은 업무를 화면마다 다른 생김새로 보면 같은 것인지 알아보는 데 시간이 든다.
 *
 * 점수 막대·추천 이유·댓글 수는 **포커스 응답에만** 있다 (`FocusPick`). 워크리스트와
 * 스탠드업은 제목·상태·프로젝트·기한만 준다 — 없는 자리는 그냥 안 그린다.
 */
export function TaskItem({
  task,
  rank,
  top,
  projectId,
  path,
}: {
  task: FocusPick | WorklistTask;
  /** 포커스 목록에서만 준다. 밀리는 업무·팀 화면은 순위가 없다. */
  rank?: number;
  /** 1위 점수. 점수는 절대값에 의미가 없어서 1위 대비 몇 %인지로 보여준다. */
  top?: number;
  projectId: string | null;
  /** 쓰기 액션 후 다시 그릴 경로. 화면마다 다르다. */
  path: string;
}) {
  const pick = "score" in task ? task : null;

  // 줄 전체에 hover 배경을 두지 않는다 — 줄 자체는 누를 수 없고 링크와 액션 버튼이 안에
  // 따로 있다. 배경이 따라 바뀌면 줄을 누를 수 있는 것으로 읽힌다.
  return (
    <div className="flex gap-3 px-2 py-2">
      {/* 라임은 1위 한 곳에만 쓴다. 다섯 칸을 다 채우면 "지금 이거"가 안 읽힌다 */}
      {rank !== undefined && (
        <span
          className={cn(
            "tabular mt-0.5 size-6 shrink-0 rounded-md text-center text-sm leading-6 font-semibold",
            rank === 1
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground",
          )}
        >
          {rank}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {/* 제목 굵기는 `나를 부른 사람들`과 같은 semibold. medium이던 때는 바로 아래
            메타 줄과 굵기 차이가 얇아서 제목이 덜 걸렸다.
            한 줄에서 자르는 것도 그 카드와 같다 — 긴 제목이 두세 줄로 흘러 줄 높이가
            제목 길이에 따라 달라졌다. 전문은 `flow에서 보기`로 넘어가면 나온다 */}
        <p className="flex items-start gap-2 text-sm font-semibold">
          <span className="min-w-0 flex-1 truncate">{task.title}</span>
          {/* 마감일이 없으면 남은 일수가 없다. 내 업무 화면의 880건 중 720건이 그런데,
              무조건 그리면 그 줄이 전부 `D-DAY`로 보인다 */}
          {task.endDate ? <DDay days={task.daysLeft} /> : null}
        </p>
        <p className="tabular mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <StatusPill status={task.status} />
          <span className="truncate">{task.project}</span>
          {/* 마감일 (PRD §13 A4). 오른쪽 D-DAY 배지는 남은 일수만 말한다 — 며칠인지는
              날짜를 봐야 알고, 그 값은 워크리스트에 이미 들어 있다.
              우선순위·담당자는 여기 없다: 업무 한 줄에 REST 한 번이라 행마다 미리 부르면
              화면 한 번에 스무 번이다. 그 둘은 편집 패널을 열 때 온다 (task-actions.tsx) */}
          {task.endDate && (
            <span className="flex items-center gap-1">
              <IconCalendar size={11} />
              <span className="sr-only">마감일 </span>
              {fmtDate(task.endDate)}
            </span>
          )}
          {/* 댓글·멘션 건수는 응답에 있는데 안 쓰고 있었다. 얼마나 시끄러운 업무인지가 여기서 읽힌다 */}
          {pick && pick.comments > 0 && (
            <span className="flex items-center gap-1">
              <IconComment size={11} />
              <span className="sr-only">댓글 </span>
              {pick.comments}개
            </span>
          )}
          {pick && pick.mentions > 0 && (
            <span className="flex items-center gap-1">
              <IconMention size={11} />
              <span className="sr-only">피드백 </span>
              {pick.mentions}개
            </span>
          )}
        </p>
        {/* 점수 막대 — 1위와 2위가 붙어 있는지, 1위만 튀는지가 순위 숫자로는 안 보인다 */}
        {pick && top !== undefined && (
          <Meter
            total={top}
            className="mt-1.5"
            segments={[
              {
                value: pick.score,
                label: `위험 점수 ${Math.round(pick.score)}`,
                className: rank === 1 ? "bg-primary" : "bg-neutral",
              },
            ]}
          />
        )}
        {pick && pick.reasons.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {pick.reasons.map((reason) => (
              <li
                key={reason}
                className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground"
              >
                {withUnit(reason)}
              </li>
            ))}
          </ul>
        )}
        {/* 말풍선 한 줄. 오늘·팀 화면은 포커스 픽에서 빌린 값이 이미 있고(`lastComment`),
            내 업무 화면은 `postId`만 넘겨 화면에 들어올 때 불러온다 (`LastComment`) */}
        <LastComment text={task.lastComment} postId={"postId" in task ? task.postId : undefined} />

        <FlowLink href={task.link} className="mt-1.5" />
        <TaskActions
          projectId={projectId}
          taskId={task.taskSrno}
          title={task.title}
          status={task.status}
          endDate={task.endDate}
          path={path}
        />
      </div>
    </div>
  );
}

/** 마감까지 남은 일수. 색만으로 의미를 전달하지 않으려고 D+/D- 부호를 항상 붙인다. */
function DDay({ days }: { days: number }) {
  const label = days < 0 ? `D+${-days}` : days === 0 ? "D-DAY" : `D-${days}`;
  return (
    <span
      className={cn(
        "tabular shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold",
        days < 0
          ? "bg-danger-bg text-danger-foreground"
          : days <= 2
            ? "bg-warning-bg text-warning-foreground"
            : "bg-neutral-bg text-neutral-foreground",
      )}
    >
      {label}
    </span>
  );
}

/**
 * 추천 이유에 단위를 붙인다 (`댓글 3` → `댓글 3개`). 문구는 flow 서버가 만들어 준다.
 *
 * ponytail: 댓글·멘션 두 낱말 뒤만 잡는다. 모든 숫자에 붙이면 `마감 12일 지남`처럼
 * 이미 단위가 있는 문구까지 망가진다.
 */
function withUnit(reason: string): string {
  return reason.replace(/(댓글|멘션)\s*(\d+)/g, "$1 $2개");
}
