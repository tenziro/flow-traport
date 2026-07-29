"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createComment,
  loadParticipants,
  loadTaskFields,
  updateTaskEndDate,
  updateTaskPriority,
  updateTaskStatus,
  updateTaskWorker,
  type ActionResult,
  type ParticipantResult,
} from "@/app/(app)/actions";
import type { Participant, TaskFields } from "@/lib/flow/rest";
import { TASK_STATUS, type TaskStatus } from "@/lib/task-status";
import { TASK_PRIORITY, type TaskPriority } from "@/lib/task-priority";
import { DateField } from "@/components/date-field";
import { IconChevronDown, IconComment, IconNormal, IconPriority } from "@/components/icons";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { Button } from "@/components/motion/button/base";
import {
  CenterMorphModal,
  CenterMorphModalClose,
  CenterMorphModalContent,
  CenterMorphModalTrigger,
} from "@/components/motion/center-morph-modal";
import { Input } from "@/components/motion/input";
import { STATUS_TONE } from "@/components/status-pill";
import { ThreadView } from "@/components/thread-view";
import { cn, fmtDate } from "@/lib/utils";

/**
 * 업무 행에 붙는 쓰기 액션 (PRD §6.1.4, §13 A4).
 *
 * 두 갈래다: **바꾸기**(상태·마감일·우선순위·담당자)는 모달로 열고, **댓글**은 행에서 접힘으로
 * 펼친다. 바꾸는 일과 말하는 일은 애초에 다른 일이다.
 *
 * **읽는 자리와 고치는 자리를 갈랐다.** 예전에는 셀렉트 네 개가 패널에 펼쳐져 있고 지금 값이
 * 그 셀렉트의 placeholder(`지금 진행중`)였다 — 값을 확인하려면 고르는 UI를 마주해야 했고,
 * 하나를 고르면 확인 문구·버튼 둘이 그 줄에 더 붙어 네 줄이 통째로 흔들렸다. 지금은 네 줄이
 * 다 텍스트고, `변경`을 누른 줄만 컨트롤로 바뀐다.
 *
 * 모달이 "어느 업무를 건드리는지 흐린다"던 v0.15의 판단은 머리에 업무명을 적어서 해소한다.
 * 행 안에서 펼치던 때는 밀리는 업무가 열 줄인 화면에서 목록이 통째로 밀려 내려갔다.
 *
 * 확인 단계는 그대로 두 번 누르기다 (§8.1) — `변경`으로 컨트롤을 열고, 고른 뒤 `저장`을
 * 누른다. 예전 "바꿀까요?" 한 줄이 하던 일을 `저장` 버튼이 한다.
 *
 * 댓글은 확인 단계를 두지 않는다. 내용을 직접 타이핑하는 것 자체가 확인이고, 댓글은
 * 파괴적이지 않다 (§8.1의 "확인 또는 실행 취소" 중 확인에 해당).
 *
 * 상태만 MCP로 나가고 나머지 셋은 REST다. REST 쓰기는 개인 API 키가 있어야 한다 —
 * 없으면 서버가 거절하고 키를 등록하라고 답한다 (`restRun` — actions.ts).
 */

/* ── 행 눈금 ───────────────────────────────────────────────────────────────
 * 네 줄이 라벨 열과 값 열을 같이 쓴다. 라벨을 값의 형제로 그냥 두면 글자 수가 다른
 * 만큼(상태 2자 · 우선순위 4자) 값 시작점이 줄마다 어긋나고, 넘친 결과 문구가 라벨
 * 밑(x=0)까지 되감긴다. 열을 고정하면 네 줄의 왼쪽 끝과 오른쪽 끝이 같이 맞는다.
 *
 * `py`는 줄 사이 구분선과 값 사이의 숨이다 — 여백을 부모의 `space-y`로 주면 선이 줄
 * 가장자리가 아니라 여백 한가운데에 떠서 어느 줄에 속한 선인지 안 읽힌다.
 */
const ROW = "flex items-start gap-2 py-1.5";
/** `leading-8`이 컨트롤 높이(32px)와 같아서 라벨이 첫 줄 한가운데에 선다. */
const LABEL = "w-14 shrink-0 text-xs leading-8 text-muted-foreground";
/** 접힘은 여기서 일어난다 — 넘친 결과 문구가 값 열 안쪽에서 다음 줄로 간다. */
const FIELD = "flex min-w-0 flex-1 flex-wrap items-center gap-2";
/** 네 컨트롤이 같은 폭이라 오른쪽 끝도 맞는다. */
const CONTROL = "w-40";
/** 고치는 중에도 지금 값은 남긴다 — 무엇에서 무엇으로 바뀌는지가 한 줄에서 읽힌다. */
const FROM = "shrink-0 text-xs leading-8 text-muted-foreground";
/** 모달 트리거. 바로 아래 댓글 접힘 트리거와 같은 치수·같은 색이라 둘이 한 벌로 읽힌다. */
const TRIGGER =
  "flex min-h-7 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground";

export function TaskActions(props: {
  /** null이면 프로젝트 ID를 해소하지 못한 것 — 액션 자체를 감춘다. */
  projectId: string | null;
  taskId: number;
  /** 업무명. 댓글이 `taskSrno`를 `postId`로 바꿀 때 검색어로 쓴다 (`resolvePostId`). */
  title: string;
  /** flow 커스텀 상태 라벨. 현재 상태를 다시 고르면 flow가 400을 준다. */
  status: string;
  /** 워크리스트가 주는 마감일 `YYYYMMDD`. 이것만 공짜라 REST를 기다리지 않고 바로 쓴다. */
  endDate?: string;
  /** 성공 후 다시 불러올 경로. */
  path: string;
}) {
  if (!props.projectId) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        이 프로젝트는 flow에서 열어야 바꿀 수 있어요.
      </p>
    );
  }
  return <Panels {...props} projectId={props.projectId} />;
}

function Panels({
  projectId,
  taskId,
  title,
  status,
  endDate = "",
  path,
}: {
  projectId: string;
  taskId: number;
  title: string;
  status: string;
  endDate?: string;
  path: string;
}) {
  return (
    <div className="mt-1">
      <EditDialog
        projectId={projectId}
        taskId={taskId}
        title={title}
        status={status}
        endDate={endDate}
        path={path}
      />

      {/* 댓글은 행 안에서 펼친다. 남긴 말이 이 업무 아래에 그대로 쌓여 있어야 읽는 일과
          이어진다 — 모달로 띄우면 목록을 가리고 닫으면 사라진다 */}
      <BouncyAccordion
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
          body: "px-0 pt-2 pb-3",
          description: "text-sm text-foreground",
        }}
        items={[
          {
            id: `talk-${taskId}`,
            icon: <IconComment size={13} />,
            title: "댓글 보거나 남기기",
            description: (
              /*
               * 트리거는 [아이콘 16px][간격 6px][제목]이다. 세로선은 아이콘 한가운데(8px)로,
               * 폼 시작점은 제목 시작점(22px)으로 맞춘다 — 선 두께 2px를 빼면 7 + 2 + 13이다.
               */
              <div className="ml-[7px] space-y-2 border-l-2 border-border pl-[13px]">
                <CommentForm projectId={projectId} taskId={taskId} title={title} path={path} />
                {/* 전체 스레드는 눌러야 부른다 (PRD §13 A1). 시스템 댓글까지 같이 와서
                    이 업무의 활동 이력이 된다 (§13 B4) */}
                <ThreadView projectId={projectId} taskId={taskId} title={title} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

/**
 * 바꾸기 모달 (PRD §6.1.4).
 *
 * 지금 우선순위·담당자는 워크리스트에 없다. **모달을 열 때 한 번만** 부른다 — 업무 한 줄에
 * REST 한 번이라, 행마다 미리 부르면 밀리는 업무 열 줄에 열 번이다.
 */
function EditDialog({
  projectId,
  taskId,
  title,
  status,
  endDate,
  path,
}: {
  projectId: string;
  taskId: number;
  title: string;
  status: string;
  endDate: string;
  path: string;
}) {
  const [fields, setFields] = useState<TaskFields | null>(null);
  const [loading, startLoad] = useTransition();
  const [asked, setAsked] = useState(false);

  function onOpenChange(open: boolean) {
    if (!open || asked) return;
    setAsked(true);
    startLoad(async () => {
      const result = await loadTaskFields(projectId, taskId, title);
      setFields(result.fields ?? null);
    });
  }

  /**
   * 못 가져온 것과 값이 빈 것은 다른 말이다. 우선순위가 비어 있는데 "지금 값을 못 가져왔어요"로
   * 적으면 없는 문제를 만들고, 반대면 없는 값을 지어낸다.
   */
  const restNow = (value: string) =>
    loading ? "불러오는 중…" : fields ? value || "아직 없어요" : "지금 값을 못 가져왔어요";
  const dueDate = fields?.endDate || endDate;
  const descId = `edit-desc-${taskId}`;

  return (
    <CenterMorphModal onOpenChange={onOpenChange}>
      <CenterMorphModalTrigger>
        <button type="button" className={TRIGGER}>
          <span aria-hidden className="grid h-4 w-4 shrink-0 place-items-center">
            <IconPriority size={13} />
          </span>
          상태·마감일·우선순위·담당자 바꾸기
        </button>
      </CenterMorphModalTrigger>

      {/* 오른쪽 위 닫기 아이콘은 끈다 — 아래 `닫기` 버튼과 이름이 같아서 화면 낭독기에
          `닫기`가 두 번 읽힌다. 오른쪽 아래 한 자리로 모은다 (TEXT_GUIDE).
          패널 패딩을 안 주고 머리·본문·바닥이 각자 갖는다 — 경계선이 패널 폭 끝까지
          닿아야 세 덩어리가 갈린다 (site-footer.tsx의 업데이트 로그 모달과 같은 구조) */}
      <CenterMorphModalContent
        ariaLabel="업무 바꾸기"
        ariaDescribedBy={descId}
        showCloseButton={false}
        className="max-w-[34rem]"
      >
        <div className="border-b border-border px-5 pt-5 pb-4">
          <h2 className="text-base font-semibold">업무 바꾸기</h2>
          {/* 어느 업무인지를 머리에 적는다 — 목록이 뒤로 가려도 대상이 남는다 */}
          <p id={descId} className="mt-0.5 truncate text-xs text-muted-foreground">
            {title}
          </p>
        </div>

        {/* 줄 사이에 선을 둔다. `변경`을 누른 줄만 컨트롤로 커지는데, 선이 없으면 커진
            줄이 위아래 줄까지 한 덩어리로 읽혔다 — 특히 결과 문구가 값 열 아래로
            접히면 그게 다음 줄의 값처럼 보였다 */}
        <div className="divide-y divide-border/60 px-5 py-1">
          <StatusField projectId={projectId} taskId={taskId} now={status} path={path} />
          <EndDateField
            projectId={projectId}
            taskId={taskId}
            now={dueDate ? fmtDate(dueDate) : "아직 없어요"}
            path={path}
          />
          <PriorityField
            projectId={projectId}
            taskId={taskId}
            now={restNow(TASK_PRIORITY[fields?.priority as TaskPriority] ?? "")}
            path={path}
          />
          <WorkerField
            projectId={projectId}
            taskId={taskId}
            now={restNow(fields?.workers.join(", ") ?? "")}
            workers={fields?.workers ?? []}
            path={path}
          />
        </div>

        <div className="flex justify-end border-t border-border px-5 py-3">
          <CenterMorphModalClose>
            {/* `취소`가 아니라 `닫기`다 — 하던 일이 취소된다고 읽힌다 (TEXT_GUIDE) */}
            <Button type="button" size="sm" variant="ghost">
              닫기
            </Button>
          </CenterMorphModalClose>
        </div>
      </CenterMorphModalContent>
    </CenterMorphModal>
  );
}

/** 네 폼이 같이 쓰는 숨은 필드. 셋 다 어느 폼에서든 똑같이 필요하다. */
function TaskRef({ projectId, taskId, path }: { projectId: string; taskId: number; path: string }) {
  return (
    <>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="path" value={path} />
    </>
  );
}

/**
 * 한 줄의 저장. 성공하면 줄을 닫고 방금 저장한 값을 지금 값으로 보여준다.
 *
 * 값은 폼의 `shown` 필드에서 읽는다 — 네 줄이 보내는 코드(`progress`·`high`·userId)는
 * 화면에 낼 글자가 아니고, 라벨을 훅이 알아내려면 표 넷을 여기로 끌고 와야 한다.
 *
 * 닫는 시점이 액션 안인 이유: 성공 여부를 아는 자리가 여기다. 이펙트에서 `result.ok`를
 * 보고 닫으면 React 19 린트가 막는다 (`react-hooks/set-state-in-effect`).
 */
function useSave(
  serverAction: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>,
  /** 고른 값을 비운다. 줄마다 타입이 달라서 훅이 쥐지 못하고 밖에서 받는다. */
  reset: () => void,
) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState("");
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, form) => {
      const next = await serverAction(prev, form);
      if (next.ok) {
        setSaved(String(form.get("shown") ?? ""));
        setEditing(false);
      }
      return next;
    },
    null,
  );
  return {
    editing,
    saved,
    result,
    action,
    pending,
    // 열 때도 비운다. 저장한 값이 남아 있으면 `저장`이 켜진 채로 열려서 같은 값을 또 보내고,
    // flow는 "동일한 …로 변경할 수 없습니다"로 거절한다.
    edit: () => {
      reset();
      setEditing(true);
    },
    cancel: () => {
      reset();
      setEditing(false);
    },
  };
}

/** 지금 값 + `변경`. 네 줄이 다 이 모양이라 값만 위아래로 훑어 읽힌다. */
function Shown({ now, label, onEdit }: { now: string; label: string; onEdit: () => void }) {
  return (
    <>
      <span className="min-w-0 flex-1 truncate text-sm leading-8">{now}</span>
      {/* 버튼 넷이 다 `변경`이라 이름만으로는 어느 줄인지 안 읽힌다 */}
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={`${label} 변경`}
        onClick={onEdit}
        className="h-7 px-2.5"
      >
        변경
      </Button>
    </>
  );
}

/**
 * 고르기 한 칸. 브라우저 기본 `<select>`다.
 *
 * beUI `Select`를 여기서는 못 쓴다 — 목록이 트리거 밑에 `absolute`로 붙는데 이 모달 패널은
 * clip-path로 자기 네모를 잘라낸다(center-morph-modal). 마지막 줄에서 목록이 패널 밖으로
 * 자라면 그대로 사라진다 — 접힘 패널에서 같은 걸로 잘렸다 (bug-report BUG-009).
 * 기본 `<select>`의 목록은 브라우저가 띄우니 무엇에도 안 잘리고, 폼 값도 스스로 싣는다.
 *
 * 생김새는 같은 줄 날짜 버튼과 같은 pill로 맞춘다 (`date-field.tsx` TRIGGER_PILL).
 * `appearance-none`이 없으면 브라우저가 자기 네모를 그려서 반경이 안 먹는다 — 그래서
 * 화살표도 직접 그린다.
 */
function Pick({
  name,
  labelId,
  value,
  onChange,
  disabled,
  children,
}: {
  name: string;
  labelId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    // `shrink-0`이라야 네 줄의 컨트롤 폭이 같다 — 왼쪽 `지금 값` 글자가 길면 줄어든다.
    <span className={cn("relative shrink-0", CONTROL)}>
      <select
        name={name}
        aria-labelledby={labelId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 w-full appearance-none rounded-full border border-border bg-background pr-8 pl-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
      >
        {children}
      </select>
      <IconChevronDown
        size={13}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}

/**
 * 참여자 한 명 켜기·끄기 (담당자 줄).
 *
 * 폼 값은 체크박스가 스스로 싣는다 — 켠 것만 `workerId`로 나가서 서버가 `getAll`로 받는다.
 * 네모는 그리지 않는다. 참여자가 열 명이면 네모 열 개가 값 열을 채우는데 여기서 읽어야
 * 할 것은 "누가 담당인가" 하나다. 켬은 라임 배경이 말하고, 네모를 숨겨 사라진 키보드
 * 포커스 표시는 `has-[:focus-visible]`로 pill이 대신 받는다.
 */
function Person({
  name,
  value,
  on,
  onToggle,
}: {
  name: string;
  value: string;
  on: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-sm transition-colors select-none has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      <input
        type="checkbox"
        name="workerId"
        value={value}
        checked={on}
        onChange={(event) => onToggle(event.target.checked)}
        className="sr-only"
      />
      {name}
    </label>
  );
}

/**
 * 저장·취소. 네 줄이 같은 높이를 쓴다 — 줄마다 다르면 값 열이 다시 들쭉날쭉해진다.
 *
 * 옆 컨트롤(32px)보다 한 급 낮춘다. 같은 높이에 라임을 채우면 이 줄에서 제일 큰 덩어리가
 * 되어, 고르는 컨트롤보다 저장 버튼이 먼저 읽힌다.
 */
function Save({
  pending,
  disabled,
  note,
  onCancel,
}: {
  pending: boolean;
  /** 아직 아무것도 안 골랐으면 막는다. 빈 값으로 보내면 서버가 거절할 뿐이다. */
  disabled: boolean;
  note?: string;
  onCancel: () => void;
}) {
  return (
    <>
      <Button type="submit" size="sm" disabled={disabled || pending} className="h-7 px-2.5">
        {pending ? "저장 중…" : "저장"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="h-7 px-2.5">
        취소
      </Button>
      {note && <span className="w-full text-xs text-warning-foreground">{note}</span>}
    </>
  );
}

function StatusField({
  projectId,
  taskId,
  now,
  path,
}: {
  projectId: string;
  taskId: number;
  now: string;
  path: string;
}) {
  const [picked, setPicked] = useState<TaskStatus | "">("");
  const { editing, saved, result, action, pending, edit, cancel } = useSave(updateTaskStatus, () =>
    setPicked(""),
  );
  const labelId = `status-label-${taskId}`;
  /** 저장한 뒤에는 방금 저장한 값이 지금 값이다 — 부모가 준 `now`는 아직 옛것이다. */
  const current = saved || now;

  return (
    <form action={action} className={ROW}>
      <TaskRef projectId={projectId} taskId={taskId} path={path} />
      <input type="hidden" name="shown" value={picked ? TASK_STATUS[picked] : ""} />

      <span id={labelId} className={LABEL}>
        상태
      </span>
      <div className={FIELD}>
        {editing ? (
          <>
            <span className={FROM}>{current} →</span>
            <Pick
              name="status"
              labelId={labelId}
              value={picked}
              onChange={(next) => setPicked(next as TaskStatus)}
            >
              <option value="">고르기</option>
              {Object.entries(TASK_STATUS).map(([value, label]) => (
                // 목록도 배지와 같은 색을 쓴다 — 색을 살리는 브라우저에서만 보인다.
                <option
                  key={value}
                  value={value}
                  className={STATUS_TONE[label as keyof typeof STATUS_TONE]?.text}
                >
                  {label}
                </option>
              ))}
            </Pick>
            <Save pending={pending} disabled={!picked} onCancel={cancel} />
          </>
        ) : (
          <Shown now={current} label="상태" onEdit={edit} />
        )}

        <Result result={result} />
      </div>
    </form>
  );
}

/**
 * 마감일 (PRD §13 A4).
 *
 * 달력은 shadcn `Calendar` + `Popover`다 (`date-field.tsx`). 값은 `YYYY-MM-DD` 문자열이고
 * 서버가 하이픈만 떼서 flow의 `YYYYMMDD`로 만든다.
 */
function EndDateField({
  projectId,
  taskId,
  now,
  path,
}: {
  projectId: string;
  taskId: number;
  now: string;
  path: string;
}) {
  const [picked, setPicked] = useState("");
  const { editing, saved, result, action, pending, edit, cancel } = useSave(updateTaskEndDate, () =>
    setPicked(""),
  );
  const labelId = `end-date-label-${taskId}`;
  const current = saved || now;

  return (
    <form action={action} className={ROW}>
      <TaskRef projectId={projectId} taskId={taskId} path={path} />
      {/* 고른 날짜가 그대로 화면에 낼 글자다 (`fmtDate`가 하이픈 형식을 통과시킨다) */}
      <input type="hidden" name="shown" value={picked} />

      <span id={labelId} className={LABEL}>
        마감일
      </span>
      <div className={FIELD}>
        {editing ? (
          <>
            <span className={FROM}>{current} →</span>
            <DateField
              name="endDate"
              value={picked}
              onChange={setPicked}
              aria-labelledby={labelId}
              className={CONTROL}
            />
            <Save pending={pending} disabled={!picked} onCancel={cancel} />
          </>
        ) : (
          <Shown now={current} label="마감일" onEdit={edit} />
        )}

        <Result result={result} />
      </div>
    </form>
  );
}

/** 우선순위 (PRD §13 A4). 네 라벨이 다 받침으로 끝나서 조사는 `으로` 하나면 된다. */
function PriorityField({
  projectId,
  taskId,
  now,
  path,
}: {
  projectId: string;
  taskId: number;
  now: string;
  path: string;
}) {
  const [picked, setPicked] = useState<TaskPriority | "">("");
  const { editing, saved, result, action, pending, edit, cancel } = useSave(
    updateTaskPriority,
    () => setPicked(""),
  );
  const labelId = `priority-label-${taskId}`;
  const current = saved || now;

  return (
    <form action={action} className={ROW}>
      <TaskRef projectId={projectId} taskId={taskId} path={path} />
      <input type="hidden" name="shown" value={picked ? TASK_PRIORITY[picked] : ""} />

      <span id={labelId} className={LABEL}>
        우선순위
      </span>
      <div className={FIELD}>
        {editing ? (
          <>
            <span className={FROM}>{current} →</span>
            <Pick
              name="priority"
              labelId={labelId}
              value={picked}
              onChange={(next) => setPicked(next as TaskPriority)}
            >
              <option value="">고르기</option>
              {Object.entries(TASK_PRIORITY).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Pick>
            <Save pending={pending} disabled={!picked} onCancel={cancel} />
          </>
        ) : (
          <Shown now={current} label="우선순위" onEdit={edit} />
        )}

        <Result result={result} />
      </div>
    </form>
  );
}

/**
 * 담당자 (PRD §13 A4).
 *
 * 후보 목록은 **`변경`을 누를 때만 부른다.** 프로젝트 참여자 조회가 업무 한 줄에 한 번이라,
 * 모달을 열 때 같이 부르면 상태만 바꾸러 온 사람도 그 값을 치른다.
 *
 * 여기만 셋과 컨트롤이 다르다. 여러 명을 고르니까 `<select>`가 아니라 켜고 끄는 pill이다 —
 * `<select multiple>`은 Cmd+클릭을 아는 사람만 여럿을 고를 수 있고, 목록 상자로 렌더돼
 * 같은 줄의 pill 컨트롤들과 안 맞는다. 그래서 `CONTROL`의 고정 폭도 이 줄만 안 쓴다.
 */
function WorkerField({
  projectId,
  taskId,
  now,
  workers,
  path,
}: {
  projectId: string;
  taskId: number;
  now: string;
  /** 지금 담당자 실명. 프리체크와 누락 안내가 이걸 후보 목록과 맞춘다. */
  workers: readonly string[];
  path: string;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const {
    editing,
    saved,
    result,
    action,
    pending,
    edit: openEdit,
    cancel,
  } = useSave(updateTaskWorker, () => setPicked([]));
  const [people, setPeople] = useState<ParticipantResult | null>(null);
  const [asking, startAsk] = useTransition();
  const labelId = `worker-label-${taskId}`;
  const current = saved || now;
  const candidates = people?.participants ?? [];
  const pickedNames = candidates
    .filter((p) => picked.includes(p.userId))
    .map((p) => p.name)
    .join(", ");
  /** 지금 담당자. 저장한 뒤에는 방금 보낸 목록이 정답이다 (`saved`를 우리가 `, `로 이었다). */
  const currentNames = (saved ? saved.split(", ") : workers).filter(Boolean);
  /**
   * 지금 담당자인데 후보 목록에 없는 이름. flow에서 프로젝트 참여자를 빼도 담당은 남기
   * 때문에 생긴다 — 목록에 없으면 userId를 몰라 켤 수가 없고, 그대로 저장하면 담당에서
   * 조용히 빠진다. 그래서 저장 전에 이름을 적어 준다.
   */
  const missing = people
    ? currentNames.filter((name) => !candidates.some((p) => p.name === name))
    : [];

  /**
   * 지금 담당자를 미리 켠다. flow 쓰기가 덮어쓰기라서, 켜 두지 않으면 한 명을 더 붙이려는
   * 사람이 기존 담당자까지 다시 찾아 골라야 한다 — 그러다 빠뜨리면 조용히 떨어진다.
   *
   * 이름으로 맞춘다 (flow는 담당자를 실명으로만 준다 — rest.ts `TaskFields.workers`).
   * 그래서 아무것도 안 바꾸고 저장하면 flow가 같은 값이라고 거절하는데, 그 메시지는
   * 이 줄에 그대로 나온다.
   */
  const mine = (list: readonly Participant[]) =>
    list.filter((p) => currentNames.includes(p.name)).map((p) => p.userId);

  function edit() {
    openEdit();
    if (people?.participants) {
      setPicked(mine(people.participants));
      return;
    }
    if (asking) return;
    const form = new FormData();
    form.set("projectId", projectId);
    startAsk(async () => {
      const next = await loadParticipants(null, form);
      setPeople(next);
      setPicked(mine(next.participants ?? []));
    });
  }

  return (
    <form action={action} className={ROW}>
      <TaskRef projectId={projectId} taskId={taskId} path={path} />
      {/* 이름은 성공 문구용이다 — 서버가 id로만 답하면 "누구로 바꿨는지"를 못 적는다 */}
      <input type="hidden" name="workerName" value={pickedNames} />
      <input type="hidden" name="shown" value={pickedNames} />

      <span id={labelId} className={LABEL}>
        담당자
      </span>
      <div className={FIELD}>
        {editing ? (
          <>
            {/* 담당자 줄만 값 열을 위아래로 쌓는다 (`w-full`이 셋을 각자 줄로 밀어낸다).
                이름 목록·pill 여러 개·저장·취소가 한 줄을 나눠 쓰면 pill이 두 칸씩 접혀
                버튼 사이로 끼어든다 — 담당자가 다섯 명이면 지금 값만으로도 줄이 찬다 */}
            <span className={cn(FROM, "w-full leading-6")}>{current} →</span>
            {asking ? (
              <span className={cn(FROM, "w-full leading-6")}>불러오는 중…</span>
            ) : (
              <div
                role="group"
                aria-labelledby={labelId}
                className="flex w-full flex-wrap gap-1.5"
              >
                {candidates.map((person) => (
                  <Person
                    key={person.userId}
                    name={person.name}
                    on={picked.includes(person.userId)}
                    value={person.userId}
                    onToggle={(on) =>
                      setPicked((prev) =>
                        on
                          ? [...prev, person.userId]
                          : prev.filter((id) => id !== person.userId),
                      )
                    }
                  />
                ))}
              </div>
            )}
            {/* 덮어쓰기라는 걸 그대로 적는다 — 안 켠 사람은 담당에서 빠진다 */}
            <Save
              pending={pending}
              disabled={picked.length === 0}
              note={
                missing.length > 0
                  ? `참여자 목록에 없는 담당자 ${missing.length}명(${missing.join(", ")}) — 저장하면 담당에서 빠져요.`
                  : "켠 사람들만 담당이 돼요."
              }
              onCancel={cancel}
            />
          </>
        ) : (
          <Shown now={current} label="담당자" onEdit={edit} />
        )}

        {/* 후보를 못 불러온 경우. `변경`을 다시 누르면 한 번 더 부른다 */}
        {people && !people.participants && <Result result={people} />}
        <Result result={result} />
      </div>
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
      <TaskRef projectId={projectId} taskId={taskId} path={path} />
      {/* 업무명은 `postId`를 찾는 검색어다 — 서버가 이걸로 프로젝트 업무를 줄인다 (rest.ts) */}
      <input type="hidden" name="title" value={title} />

      <label className="sr-only" htmlFor={`comment-${taskId}`}>
        댓글
      </label>
      {/* beUI Input 기본 치수(h-11 rounded-full text-base)를 촘촘한 행에 맞춘다.
          모서리는 기본값 그대로 pill이다 — 바로 옆 `남기기` 버튼이 pill이라 둘이 한 벌로 붙는다. */}
      <Input
        id={`comment-${taskId}`}
        name="content"
        placeholder="댓글 남기기"
        maxLength={2000}
        className="min-w-0 flex-1"
        classNames={{ field: "h-8 bg-background", input: "text-sm" }}
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
