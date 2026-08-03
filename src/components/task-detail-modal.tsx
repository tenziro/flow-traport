"use client";

import { FlowLink } from "@/components/flow-link";
import { IconComment, IconMention } from "@/components/icons";
import { LastComment } from "@/components/last-comment";
import { Meter } from "@/components/meter";
import { Button } from "@/components/motion/button/base";
import {
  CenterMorphModalClose,
  CenterMorphModalContent,
} from "@/components/motion/center-morph-modal";
import { StatusPill } from "@/components/status-pill";
import { CommentForm, TaskEditFields } from "@/components/task-actions";
import { ThreadView } from "@/components/thread-view";
import type { FocusPick, WorklistTask } from "@/lib/flow/queries";
import { DDay } from "@/components/d-day";

/**
 * 업무 상세 모달 (PRD §6.1.4). 표에서 업무명을 누르면 이게 열린다.
 *
 * flow의 업무 상세와 같은 순서로 덩어리를 나눈다: 어느 업무인지(머리) → 지금 값(다섯 줄) →
 * 왜 골랐는지(포커스만) → 댓글. 표가 프로젝트·상태·마감일만 보여주니 나머지는 다 여기 있다.
 *
 * 열려 있는 동안만 붙는다 — 우선순위·담당자 REST 조회가 `TaskEditFields`에 있어서,
 * 이 덩어리를 행마다 미리 그리면 표 열 줄에 REST 열 번이다.
 */
export function TaskDetailModal({
  task,
  shown,
  projectId,
  path,
  rank,
  top,
  onSaved,
}: {
  task: FocusPick | WorklistTask;
  /** 방금 저장한 값이 얹힌 상태·마감일. 표가 들고 있는 낙관값이다 (BUG-037). */
  shown: { status: string; endDate: string; daysLeft: number };
  /** null이면 프로젝트 ID를 해소하지 못한 것 — 쓰기 줄을 감춘다. */
  projectId: string | null;
  path: string;
  rank?: number;
  top?: number;
  onSaved?: (patch: { status?: string; endDate?: string }) => void;
}) {
  const pick = "score" in task ? task : null;
  const regDate = "regDate" in task ? (task.regDate ?? "") : "";
  const descId = `task-detail-${task.taskSrno}`;

  return (
    /* 오른쪽 위 닫기 아이콘은 끈다 — 아래 `닫기` 버튼과 이름이 같아서 화면 낭독기에
       `닫기`가 두 번 읽힌다. 오른쪽 아래 한 자리로 모은다 (TEXT_GUIDE).
       패널 패딩을 안 주고 덩어리마다 각자 갖는다 — 경계선이 패널 폭 끝까지 닿아야
       머리·값·이유·댓글이 갈린다 */
    <CenterMorphModalContent
      ariaLabel="업무 상세"
      ariaDescribedBy={descId}
      showCloseButton={false}
      className="max-w-[34rem]"
    >
      {/* 머리 — 어느 프로젝트의 어느 업무인지가 먼저다. 표가 뒤로 가려도 대상이 남는다 */}
      <div className="border-b border-border px-5 pt-5 pb-4">
        <p className="truncate text-xs text-muted-foreground">{task.project}</p>
        <div className="mt-1 flex items-start gap-2">
          <h2 id={descId} className="min-w-0 flex-1 text-base font-semibold">
            {task.title}
          </h2>
          {/* 업무번호는 flow에서 사람끼리 업무를 가리킬 때 쓰는 번호다 */}
          <span className="tabular shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
            업무번호 {task.taskSrno}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill status={shown.status} />
          {shown.endDate ? <DDay days={shown.daysLeft} /> : null}
          {rank !== undefined && (
            <span className="text-xs text-muted-foreground">오늘 포커스 {rank}순위</span>
          )}
        </div>
      </div>

      {/* 값 — 상태·마감일·등록일·우선순위·담당자 다섯 줄 */}
      {projectId ? (
        <div className="border-b border-border px-5 py-1">
          <TaskEditFields
            projectId={projectId}
            taskId={task.taskSrno}
            title={task.title}
            status={shown.status}
            endDate={shown.endDate}
            regDate={regDate}
            path={path}
            onSaved={onSaved}
          />
        </div>
      ) : (
        <p className="border-b border-border px-5 py-4 text-xs text-muted-foreground">
          이 프로젝트는 flow에서 열어야 바꿀 수 있어요.
        </p>
      )}

      {/* 왜 골랐는지 — 포커스 응답에만 있다. 점수만 보면 알 수 없고 이유를 같이 읽어야 한다 */}
      {pick && (pick.reasons.length > 0 || pick.comments > 0 || pick.mentions > 0) && (
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground">이 업무를 고른 이유</p>
          {top !== undefined && (
            <Meter
              total={top}
              className="mt-2"
              segments={[
                {
                  value: pick.score,
                  label: `위험 점수 ${Math.round(pick.score)}`,
                  className: rank === 1 ? "bg-primary" : "bg-neutral",
                },
              ]}
            />
          )}
          {pick.reasons.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
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
          <p className="tabular mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {pick.comments > 0 && (
              <span className="flex items-center gap-1">
                <IconComment size={11} />
                <span className="sr-only">댓글 </span>
                {pick.comments}개
              </span>
            )}
            {pick.mentions > 0 && (
              <span className="flex items-center gap-1">
                <IconMention size={11} />
                <span className="sr-only">피드백 </span>
                {pick.mentions}개
              </span>
            )}
          </p>
        </div>
      )}

      {/* 댓글 — 남긴 말이 이 업무 아래에 그대로 쌓여 있어야 읽는 일과 이어진다.
          모달 안이라 접지 않는다: 여기까지 들어온 사람은 이 업무를 보러 온 것이다 */}
      {projectId && (
        <div className="space-y-2 border-b border-border px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground">댓글</p>
          <LastComment
            text={task.lastComment}
            postId={"postId" in task ? task.postId : undefined}
          />
          <CommentForm
            projectId={projectId}
            taskId={task.taskSrno}
            title={task.title}
            path={path}
          />
          {/* 전체 스레드는 눌러야 부른다 (PRD §13 A1). 시스템 댓글까지 같이 와서
              이 업무의 활동 이력이 된다 (§13 B4) */}
          <ThreadView projectId={projectId} taskId={task.taskSrno} title={task.title} />
        </div>
      )}

      <div className="flex items-center justify-between px-5 py-3">
        <FlowLink href={task.link} />
        <CenterMorphModalClose>
          {/* `취소`가 아니라 `닫기`다 — 하던 일이 취소된다고 읽힌다 (TEXT_GUIDE) */}
          <Button type="button" size="sm" variant="ghost">
            닫기
          </Button>
        </CenterMorphModalClose>
      </div>
    </CenterMorphModalContent>
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
