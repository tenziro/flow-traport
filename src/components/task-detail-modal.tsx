"use client";

import { FlowLink } from "@/components/flow-link";
import { IconComment, IconMention } from "@/components/icons";
import { Meter } from "@/components/meter";
import { Button } from "@/components/motion/button/base";
import { StatusPill } from "@/components/status-pill";
import { TaskEditFields } from "@/components/task-actions";
import { TaskThread } from "@/components/task-thread";
import type { FocusPick, WorklistTask } from "@/lib/flow/queries";
import { DDay } from "@/components/d-day";

/** 모달 제목의 id. 패널(`aria-describedby`)과 제목이 같은 값을 봐야 한다. */
export const descIdOf = (task: { taskSrno: number }) => `task-detail-${task.taskSrno}`;

/**
 * 업무 상세 모달 (PRD §6.1.4). 표에서 업무명을 누르면 이게 열린다.
 *
 * flow의 업무 상세와 같은 순서로 덩어리를 나눈다: 어느 업무인지(머리) → 누가 냈는지(등록자) →
 * 지금 값(다섯 줄) → 왜 골랐는지(포커스만) → 본문 → 댓글. 표가 업무명·프로젝트·상태·마감일만
 * 보여주니 나머지는 다 여기 있다.
 *
 * 본문·댓글이 맨 아래인 이유는 그 둘만 열고 나서 도착한다는 것이다 (`TaskThread`) —
 * 위에 두면 값과 이유가 도착하는 순간 아래로 밀린다.
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
  onClose,
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
  onClose: () => void;
  onSaved?: (patch: { status?: string; endDate?: string }) => void;
}) {
  const pick = "score" in task ? task : null;
  const regDate = "regDate" in task ? (task.regDate ?? "") : "";
  const author = "author" in task ? (task.author ?? "") : "";
  const descId = descIdOf(task);

  return (
    /* 패널 패딩을 안 주고 덩어리마다 각자 갖는다 — 경계선이 패널 폭 끝까지 닿아야
       머리·값·이유·댓글이 갈린다 */
    <>
      {/* 머리 — 어느 프로젝트의 어느 업무인지가 먼저다. 표가 뒤로 가려도 대상이 남는다 */}
      <div className="border-b border-border">
        {/* 프로젝트명과 업무번호는 한 줄로 묶고 선으로 갈랐다 — 둘 다 "이게 어느 업무인가"를
            가리키는 딱지고, 업무명은 그 안의 내용이다. 번호가 오른쪽 끝인 것은 왼쪽에서
            읽히는 이름과 부딪히지 않게 하려는 것이다. 배경 칩을 뗀 것도 같은 이유다:
            선이 이미 갈라 주는데 면까지 두면 머리에서 제일 무거운 게 번호가 된다.
            선은 패널 폭 끝까지 닿는다 — 여백은 이 줄이 갖고 선은 감싼 칸이 그린다.
            안쪽으로 물린 선은 덩어리를 가르는 게 아니라 밑줄로 읽힌다 */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-2.5">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{task.project}</p>
          {/* 업무번호는 flow에서 사람끼리 업무를 가리킬 때 쓰는 번호다 */}
          <span className="tabular shrink-0 text-[11px] text-muted-foreground">
            업무번호 {task.taskSrno}
          </span>
        </div>
        <div className="px-5 pt-3 pb-4">
          <h2 id={descId} className="text-base font-semibold">
            {task.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill status={shown.status} />
            {shown.endDate ? <DDay days={shown.daysLeft} /> : null}
            {rank !== undefined && (
              <span className="text-xs text-muted-foreground">오늘 포커스 {rank}순위</span>
            )}
          </div>
        </div>
      </div>

      {/* 머리와 바닥은 제자리에 두고 가운데만 스크롤한다. 값·이유·본문·댓글이 다 도착하면
          패널이 화면보다 길어지는데, 그때 업무명과 `닫기`가 같이 밀려 올라가면 지금 무엇을
          보고 있는지와 나가는 길이 한꺼번에 사라진다.

          높이는 `60vh`지만 화면이 낮으면 `100dvh - 16rem`이 이긴다 — 16rem은 패널 위아래
          여백(4rem) + 머리(약 7.5rem) + 바닥(약 3rem)이다. 이 상한이 없으면 낮은 화면에서
          패널이 화면보다 커져 오버레이가 대신 스크롤하고, 그러면 머리·바닥이 다시 밀린다.

          아래 선은 칸이 갖는다 — 덩어리마다 붙은 `border-b`는 내용과 같이 밀려 올라가서
          바닥과의 경계를 못 잡는다. 마지막 덩어리 것만 끈다(두 겹으로 보인다).

          `bg-card`(라이트 #ffffff)로 패널 면(`bg-background` — #fafafa)보다 한 단 올린다.
          읽는 자리와 머리·바닥을 면으로 갈라서, 스크롤이 어디서 시작하고 끝나는지가
          선 하나에만 걸리지 않는다. 다크에서도 같은 방향이다 (#1c2537 vs #151c2c) */}
      <div className="max-h-[min(60vh,calc(100dvh-16rem))] overflow-y-auto border-b border-border bg-card [&>*:last-child]:border-b-0">
        {/* 등록자 — 아래 다섯 줄과 섞지 않고 자기 덩어리를 갖는다. 그 다섯은 지금 값이고
            바꿀 수 있는 값인데, 등록자는 이 업무가 생긴 자리라 성격이 다르다.
            원판은 이름 첫 글자다 — flow는 이 컬럼에서 사진을 안 준다(`profilePhoto`가 늘
            빈 문자열). 부서·직급도 없다: 등록자 대부분이 타사 사용자고 구성원 명단(§9.3)은
            우리 기관 13명뿐이다 (실측 686건 중 5건만 명단에 있다) */}
        {author && (
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-3">
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs"
            >
              {author.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">등록자</p>
              <p className="truncate text-xs font-medium">{author}</p>
            </div>
          </div>
        )}

        {/* 값 — 상태·등록일·마감일·우선순위·담당자 다섯 줄 */}
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

        {/* 본문 + 댓글 — 열 때 부른다. 두 덩어리가 한 왕복에서 나와서 한 컴포넌트다 */}
        {projectId && (
          <TaskThread
            projectId={projectId}
            taskId={task.taskSrno}
            title={task.title}
            postId={"postId" in task ? task.postId : undefined}
            path={path}
          />
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-3">
        <FlowLink href={task.link} />
        {/* `취소`가 아니라 `닫기`다 — 하던 일이 취소된다고 읽힌다 (TEXT_GUIDE) */}
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
    </>
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
