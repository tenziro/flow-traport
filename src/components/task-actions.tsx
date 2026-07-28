"use client";

import { useActionState, useState } from "react";
import {
  createComment,
  updateTaskStatus,
  type ActionResult,
} from "@/app/(app)/actions";
import { TASK_STATUS, type TaskStatus } from "@/lib/task-status";
import { IconComment, IconNormal } from "@/components/icons";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
import { STATUS_TONE } from "@/components/status-pill";
import { cn } from "@/lib/utils";

/**
 * 업무 행에 붙는 쓰기 액션 (PRD §6.1.4).
 *
 * 확인 단계는 버튼 두 번 누르기로 만든다 — 상태를 고르면 "정말 바꿀까요?"가 뜨고,
 * 거기서 한 번 더 눌러야 flow로 나간다. 모달을 띄우지 않는다: 업무가 수십 줄인 화면에서
 * 모달은 어느 행을 건드리는지 오히려 흐려진다.
 *
 * 댓글은 확인 단계를 두지 않는다. 내용을 직접 타이핑하는 것 자체가 확인이고,
 * 댓글은 파괴적이지 않다 (§8.1의 "확인 또는 실행 취소" 중 확인에 해당).
 */
export function TaskActions({
  projectId,
  taskId,
  title,
  status,
  path,
}: {
  /** null이면 프로젝트 ID를 해소하지 못한 것 — 액션 자체를 감춘다. */
  projectId: string | null;
  taskId: number;
  /** 업무명. 댓글이 `taskSrno`를 `postId`로 바꿀 때 검색어로 쓴다 (`resolvePostId`). */
  title: string;
  /** flow 커스텀 상태 라벨. 현재 상태를 다시 고르면 flow가 400을 준다. */
  status: string;
  /** 성공 후 다시 불러올 경로. */
  path: string;
}) {
  if (!projectId) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        이 프로젝트는 flow에서 열어야 바꿀 수 있어요.
      </p>
    );
  }
  // 기본은 접어둔다. 밀리는 업무가 열 줄 넘는 화면에서 폼이 다 펼쳐져 있으면 목록을 못 읽는다.
  return (
    <BouncyAccordion
      className="mt-1"
      classNames={{
        // 업무 행은 이미 Card 안이다 — 배경을 지워 카드 안 카드를 만들지 않는다.
        // `overflow-visible`이 짤림의 핵심이다: 원본은 `overflow-hidden` + 28px 라운드라
        // 배경이 투명해도 네 모서리가 내용을 계속 잘라낸다 (bug-report BUG-009).
        item: "overflow-visible bg-transparent",
        trigger: "min-h-7 gap-1.5 px-0",
        icon: "h-4 w-4",
        title: "text-xs font-normal text-muted-foreground",
        chevron: "h-4 w-4",
        // 좌우 패딩을 끈다. 폼 왼쪽이 헤더에 맞고, 음수 마진 때와 달리 내용이
        // 행 폭을 넘지 않아 오른쪽이 잘리지 않는다.
        //
        // 위는 띄운다. 원본은 0이라 제목 바로 아래에 폼이 붙었다 — 트리거가 세로 가운데
        // 정렬이라 남는 6px이 전부였다. 폼 두 줄 간격(8px)보다 넓어야 제목이 두 줄을
        // 묶는 머리로 읽힌다.
        body: "px-0 pt-2 pb-3",
        description: "text-sm text-foreground",
      }}
      items={[
        {
          id: `actions-${taskId}`,
          icon: <IconComment size={13} />,
          title: "상태 바꾸거나 댓글 남기기",
          description: (
            /*
             * 트리거는 [아이콘 16px][간격 6px][제목]이다. 세로선은 아이콘 한가운데(8px)로,
             * 폼 시작점은 제목 시작점(22px)으로 맞춘다 — 선 두께 2px를 빼면 7 + 2 + 13이다.
             * 눈금이 안 맞으면 접기 제목과 그 아래 폼이 서로 다른 열처럼 보인다.
             */
            <div className="ml-[7px] space-y-2 border-l-2 border-border pl-[13px]">
              <StatusForm projectId={projectId} taskId={taskId} current={status} path={path} />
              <CommentForm projectId={projectId} taskId={taskId} title={title} path={path} />
            </div>
          ),
        },
      ]}
    />
  );
}

function StatusForm({
  projectId,
  taskId,
  current,
  path,
}: {
  projectId: string;
  taskId: number;
  current: string;
  path: string;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    updateTaskStatus,
    null,
  );
  const [picked, setPicked] = useState<TaskStatus | "">("");

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="path" value={path} />

      <span id={`status-label-${taskId}`} className="text-xs text-muted-foreground">
        상태 바꾸기
      </span>
      {/* beUI Select는 button 기반이라 폼 값을 안 실어준다 — hidden input이 FormData를 채운다 */}
      <input type="hidden" name="status" value={picked} />
      <Select
        value={picked}
        onValueChange={(next) => setPicked(next as TaskStatus)}
        className="w-32"
      >
        <SelectTrigger aria-labelledby={`status-label-${taskId}`} className="h-8 px-2.5 py-0">
          <SelectValue placeholder={`지금 ${current}`} />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TASK_STATUS).map(([value, label]) => (
            // 목록도 배지와 같은 색을 쓴다. children은 문자열이어야 한다 — beUI Select가
            // 트리거에 띄울 라벨을 children이 문자열일 때만 가져간다 (아니면 value가 뜬다).
            <SelectItem
              key={value}
              value={value}
              className={STATUS_TONE[label as keyof typeof STATUS_TONE]?.text}
            >
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {picked && (
        <>
          <span className="text-xs text-warning-foreground">
            {TASK_STATUS[picked]}(으)로 바꿀까요?
          </span>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "바꾸는 중…" : "네, 바꿀게요"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPicked("")}>
            취소
          </Button>
        </>
      )}

      <Result result={result} />
    </form>
  );
}

function CommentForm({
  projectId,
  taskId,
  title,
  path,
}: {
  projectId: string;
  taskId: number;
  title: string;
  path: string;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    createComment,
    null,
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={taskId} />
      {/* 업무명은 `postId`를 찾는 검색어다 — 서버가 이걸로 프로젝트 업무를 줄인다 (rest.ts) */}
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="path" value={path} />

      <label className="sr-only" htmlFor={`comment-${taskId}`}>
        댓글
      </label>
      {/* beUI Input 기본 치수(h-11 rounded-full text-base)를 촘촘한 행에 맞춘다. */}
      <Input
        id={`comment-${taskId}`}
        name="content"
        placeholder="댓글 남기기"
        maxLength={2000}
        className="min-w-0 flex-1"
        classNames={{ field: "h-8 rounded-lg bg-background", input: "text-sm" }}
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        <IconComment size={13} />
        {pending ? "보내는 중…" : "남기기"}
      </Button>

      <Result result={result} />
    </form>
  );
}

/** 결과는 화면에서 지우지 않는다. 실패 사유를 읽고 다음 행동을 정해야 한다. */
function Result({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={cn(
        "flex w-full items-start gap-1 text-xs",
        result.ok ? "text-success-foreground" : "text-danger-foreground",
      )}
    >
      {result.ok && <IconNormal size={13} className="mt-0.5 shrink-0" />}
      <span className="min-w-0 flex-1 break-words">{result.message}</span>
    </p>
  );
}
