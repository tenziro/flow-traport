"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
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
import { IconComment, IconLastComment, IconNormal } from "@/components/icons";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { type ReplyTarget } from "@/components/thread-view";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, fmtDate } from "@/lib/utils";

/**
 * 업무 상세 모달의 쓰기 줄 (PRD §6.1.4, §13 A4).
 *
 * **읽는 자리와 고치는 자리를 갈랐다.** 예전에는 셀렉트 네 개가 패널에 펼쳐져 있고 지금 값이
 * 그 셀렉트의 placeholder(`지금 진행중`)였다 — 값을 확인하려면 고르는 UI를 마주해야 했고,
 * 하나를 고르면 확인 문구·버튼 둘이 그 줄에 더 붙어 네 줄이 통째로 흔들렸다. 지금은 다섯 줄이
 * 다 텍스트고, `변경`을 누른 줄만 컨트롤로 바뀐다.
 *
 * 확인 단계는 두 번 누르기다 (§8.1) — `변경`으로 컨트롤을 열고, 고른 뒤 `저장`을
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
/**
 * 고치는 중의 값 열. 지금 값·컨트롤·저장이 각자 줄을 갖는다.
 *
 * 한 줄을 나눠 쓰던 때는 지금 값 글자 수만큼 컨트롤이 오른쪽으로 밀려서 네 줄이 저마다
 * 다른 x에서 고르기를 시작했고, 후보 칸이 두 개씩 접혀 저장·취소 사이로 끼어들었다.
 * 위아래로 쌓으면 어느 줄을 펼쳐도 같은 모양이다.
 */
const EDITING = "flex min-w-0 flex-1 flex-col items-start gap-2";
/** 고치는 중에도 지금 값은 남긴다 — 무엇에서 무엇으로 바뀌는지가 한 줄에서 읽힌다. */
const FROM = "shrink-0 text-xs leading-8 text-muted-foreground";

/**
 * 상태·마감일·등록일·우선순위·담당자 다섯 줄 (PRD §6.1.4).
 *
 * 우선순위·담당자·등록일은 워크리스트에 없다. **이 덩어리가 붙을 때 한 번만** 부른다 —
 * 업무 한 줄에 REST 한 번이라, 표의 모든 행이 미리 부르면 열 줄에 열 번이다. 상세 모달이
 * 열릴 때만 붙으니 실제로는 보고 있는 업무 하나만 부른다.
 */
export function TaskEditFields({
  projectId,
  taskId,
  title,
  status,
  endDate = "",
  regDate = "",
  path,
  onSaved,
}: {
  projectId: string;
  taskId: number;
  /** 업무명. `taskSrno`를 `postId`로 바꿀 때 검색어로 쓴다 (`resolvePostId`). */
  title: string;
  /** flow 커스텀 상태 라벨. 현재 상태를 다시 고르면 flow가 400을 준다. */
  status: string;
  /** 목록이 이미 아는 마감일 `YYYYMMDD`. 공짜라 REST를 기다리지 않고 바로 쓴다. */
  endDate?: string;
  /** 목록이 아는 등록일 `YYYYMMDD`. 오늘·팀 화면은 안 줘서 REST 응답을 기다린다. */
  regDate?: string;
  /** 성공 후 다시 불러올 경로. */
  path: string;
  /**
   * 저장이 성공한 값을 목록에 알린다 (BUG-037). `revalidatePath`는 되지만 페이지 재렌더가
   * 실측 6.5초라, 그 사이 표가 옛 값을 들고 있으면 사용자는 저장이 안 된 줄 안다.
   * 표에 보이는 두 값만 넘긴다 — 우선순위·담당자는 표에 없다.
   */
  onSaved?: (patch: { status?: string; endDate?: string }) => void;
}) {
  const [fields, setFields] = useState<TaskFields | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // `catch`가 필요한 이유는 액션 **요청 자체가 끊길 때**다 (네트워크 끊김·서버 재시작·
    // 세션 만료). 그때 거부가 렌더를 뚫고 나가 오류 경계가 화면을 통째로 가져간다 —
    // 아래 "지금 값을 못 가져왔어요"는 쓰이지도 못한다. 이 조회는 곁가지라 화면을 죽일
    // 자격이 없다. 서버 안에서 난 오류는 액션이 이미 `ok:false`로 싸서 준다 (BUG-038).
    loadTaskFields(projectId, taskId, title)
      .catch(() => null)
      .then((result) => {
        if (!alive) return;
        setFields(result?.fields ?? null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId, taskId, title]);

  /**
   * 못 가져온 것과 값이 빈 것은 다른 말이다. 우선순위가 비어 있는데 "지금 값을 못 가져왔어요"로
   * 적으면 없는 문제를 만들고, 반대면 없는 값을 지어낸다.
   */
  const restNow = (value: string) =>
    loading ? "불러오는 중…" : fields ? value || "아직 없어요" : "지금 값을 못 가져왔어요";
  const dueDate = fields?.endDate || endDate;
  const created = regDate || fields?.regDate || "";

  return (
    /* 줄 사이에 선을 둔다. `변경`을 누른 줄만 컨트롤로 커지는데, 선이 없으면 커진
       줄이 위아래 줄까지 한 덩어리로 읽혔다 — 특히 결과 문구가 값 열 아래로
       접히면 그게 다음 줄의 값처럼 보였다 */
    <div className="divide-y divide-border/60">
      <StatusField
        projectId={projectId}
        taskId={taskId}
        now={status}
        path={path}
        onSaved={(shown) => onSaved?.({ status: shown })}
      />
      <EndDateField
        projectId={projectId}
        taskId={taskId}
        now={dueDate ? fmtDate(dueDate) : "아직 없어요"}
        path={path}
        /* 고른 값은 `YYYY-MM-DD`고 표는 flow 형식(`YYYYMMDD`)을 쓴다 */
        onSaved={(shown) => onSaved?.({ endDate: shown.replaceAll("-", "") })}
      />
      {/* 등록일만 읽기다 — flow가 바꿀 수 있는 값으로 열어 두지 않았다 */}
      <div className={ROW}>
        <span className={LABEL}>등록일</span>
        <div className={FIELD}>
          <span className="min-w-0 flex-1 truncate text-sm leading-8">
            {created ? fmtDate(created) : restNow("")}
          </span>
        </div>
      </div>
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
  /** 저장한 값을 행에도 알린다 (BUG-037). 행에 없는 줄(우선순위·담당자)은 안 넘긴다. */
  onSaved?: (shown: string) => void,
) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState("");
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, form) => {
      const next = await serverAction(prev, form);
      if (next.ok) {
        const shown = String(form.get("shown") ?? "");
        setSaved(shown);
        setEditing(false);
        onSaved?.(shown);
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
 * 고르기 칸 하나. 상태·우선순위·담당자가 같이 쓴다.
 *
 * 폼 값은 input이 스스로 싣는다 — 켠 것만 이름표를 달고 나가서 서버가 그대로 받는다.
 * 담당자는 `checkbox`(여럿), 상태·우선순위는 `radio`(하나)다. 라디오는 켜질 때만 `change`를
 * 주므로 `onPick`은 켜는 쪽만 알면 된다.
 *
 * 체크 네모·라디오 동그라미는 그리지 않는다. 후보가 여섯이면 표식 여섯 개가 값 열을
 * 채우는데 여기서 읽어야 할 것은 "무엇이 켜졌나" 하나다. 켬은 강조 배경이 말하고, 표식을
 * 숨겨 사라진 키보드 포커스 표시는 `has-[:focus-visible]`로 칸이 대신 받는다.
 *
 * 드롭다운으로 돌아가지 않는다. 후보가 넷·다섯인데 목록을 접어 두면 무엇을 고를 수 있는지
 * 알려면 한 번 더 눌러야 하고, beUI `Select`는 목록이 `absolute`로 붙어 clip-path로 자기
 * 네모를 잘라내는 이 모달 패널 밖으로 자라면 그대로 사라진다 (bug-report BUG-009).
 */
function Chip({
  type,
  name,
  value,
  label,
  on,
  onPick,
}: {
  type: "checkbox" | "radio";
  name: string;
  value: string;
  label: string;
  on: boolean;
  onPick: (on: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-sm transition-colors select-none has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={on}
        onChange={(event) => onPick(event.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

/** 후보 칸이 값 열 폭을 다 쓴다 — 다섯 개면 한 줄에 안 든다. */
const CHIPS = "flex w-full flex-wrap gap-1.5";

/**
 * 저장·취소. 네 줄이 같은 높이를 쓴다 — 줄마다 다르면 값 열이 다시 들쭉날쭉해진다.
 *
 * 위 컨트롤(32px)보다 한 급 낮춘다. 같은 높이에 라임을 채우면 이 줄에서 제일 큰 덩어리가
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
    // 값 열이 세로 스택이라 둘을 한 덩어리로 묶는다 — 그냥 두면 각자 줄로 갈라진다.
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" disabled={disabled || pending} className="h-7 px-2.5">
        {pending ? "저장 중…" : "저장"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="h-7 px-2.5">
        취소
      </Button>
      {note && <span className="w-full text-xs text-warning-foreground">{note}</span>}
    </div>
  );
}

function StatusField({
  projectId,
  taskId,
  now,
  path,
  onSaved,
}: {
  projectId: string;
  taskId: number;
  now: string;
  path: string;
  onSaved: (shown: string) => void;
}) {
  const [picked, setPicked] = useState<TaskStatus | "">("");
  const { editing, saved, result, action, pending, edit, cancel } = useSave(
    updateTaskStatus,
    () => setPicked(""),
    onSaved,
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
      <div className={editing ? EDITING : FIELD}>
        {editing ? (
          <>
            <span className={FROM}>{current} →</span>
            <div role="radiogroup" aria-labelledby={labelId} className={CHIPS}>
              {Object.entries(TASK_STATUS).map(([value, label]) => (
                <Chip
                  key={value}
                  type="radio"
                  name="status"
                  value={value}
                  label={label}
                  on={picked === value}
                  onPick={() => setPicked(value as TaskStatus)}
                />
              ))}
            </div>
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
  onSaved,
}: {
  projectId: string;
  taskId: number;
  now: string;
  path: string;
  onSaved: (shown: string) => void;
}) {
  const [picked, setPicked] = useState("");
  const { editing, saved, result, action, pending, edit, cancel } = useSave(
    updateTaskEndDate,
    () => setPicked(""),
    onSaved,
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
      <div className={editing ? EDITING : FIELD}>
        {editing ? (
          <>
            <span className={FROM}>{current} →</span>
            {/* 마감일만 고르기 칸 목록이 아니다 — 후보가 365개다 */}
            <DateField
              name="endDate"
              value={picked}
              onChange={setPicked}
              aria-labelledby={labelId}
              className="w-40"
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
      <div className={editing ? EDITING : FIELD}>
        {editing ? (
          <>
            <span className={FROM}>{current} →</span>
            <div role="radiogroup" aria-labelledby={labelId} className={CHIPS}>
              {Object.entries(TASK_PRIORITY).map(([value, label]) => (
                <Chip
                  key={value}
                  type="radio"
                  name="priority"
                  value={value}
                  label={label}
                  on={picked === value}
                  onPick={() => setPicked(value as TaskPriority)}
                />
              ))}
            </div>
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
 * 고르기 칸은 상태·우선순위와 같은 모양이지만 여기만 `checkbox`다 — 담당은 여럿이 나눠 진다.
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
      <div className={editing ? EDITING : FIELD}>
        {editing ? (
          <>
            <span className={FROM}>{current} →</span>
            {asking ? (
              /* 올 것은 이름 알약 묶음이다 — 글자 한 줄(`불러오는 중…`)을 두면 참여자가
                 도착하는 순간 이 줄이 두세 줄로 벌어져 저장 버튼이 손 아래에서 밀렸다.
                 알약 다섯 개면 실측 참여자 수(4~12명)의 아래쪽만큼은 자리를 잡는다 */
              <div className={CHIPS} aria-busy="true" aria-label="참여자 불러오는 중">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className={i % 2 ? "h-8 w-16" : "h-8 w-20"} />
                ))}
              </div>
            ) : (
              <div role="group" aria-labelledby={labelId} className={CHIPS}>
                {candidates.map((person) => (
                  <Chip
                    key={person.userId}
                    type="checkbox"
                    name="workerId"
                    value={person.userId}
                    label={person.name}
                    on={picked.includes(person.userId)}
                    onPick={(on) =>
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

/**
 * 댓글·답글 한 줄 남기기. 상세 모달의 댓글 칸이 이걸 쓴다.
 *
 * `replyTo`가 있으면 그 댓글에 달리는 답글이다. **남긴 답글은 위 목록에 안 나타난다** —
 * flow API에 답글을 읽는 경로가 없다 (`createComment` 주석). 그래서 성공 문구가 어디서
 * 볼 수 있는지까지 말한다.
 */
export function CommentForm({
  projectId,
  taskId,
  title,
  path,
  replyTo,
  onCancelReply,
  onSaved,
}: {
  projectId: string;
  taskId: number;
  title: string;
  path: string;
  /** 답글을 달 댓글. 없으면 일반 댓글이다. */
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
  /**
   * 남기기가 성공한 뒤. 바로 위 목록을 다시 부르는 데 쓴다 (`TaskThread`) — `revalidatePath`가
   * 도착하는 데 실측 6.5초라, 그동안 방금 남긴 말이 목록에 없으면 남았는지 알 수 없다.
   */
  onSaved?: () => void;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    createComment,
    null,
  );
  const input = useRef<HTMLInputElement>(null);

  // `useActionState` 결과는 다음 제출까지 같은 객체다 — 한 번 남기면 한 번만 부른다.
  useEffect(() => {
    if (result?.ok) onSaved?.();
  }, [result, onSaved]);

  // `답글`은 목록 위쪽에서도 누른다 — 커서를 옮겨 주지 않으면 입력칸을 다시 찾아 눌러야 한다.
  useEffect(() => {
    if (replyTo) input.current?.focus();
  }, [replyTo]);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <TaskRef projectId={projectId} taskId={taskId} path={path} />
      {/* 업무명은 `postId`를 찾는 검색어다 — 서버가 이걸로 프로젝트 업무를 줄인다 (rest.ts) */}
      <input type="hidden" name="title" value={title} />
      {replyTo && <input type="hidden" name="replyToRemarkId" value={replyTo.id} />}

      {/* 누구에게 답하는지 한 줄로 세운다 — 입력칸 하나로 댓글과 답글을 다 받으니
          이 줄이 없으면 지금 어느 쪽인지 알 수 없다. `w-full`로 제 줄을 차지한다 */}
      {replyTo && (
        <p className="flex w-full min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <IconLastComment size={12} className="shrink-0 text-primary" />
          <span className="min-w-0 truncate">
            <span className="font-medium text-foreground">{replyTo.from}</span>님에게 답글
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 cursor-pointer font-medium text-muted-foreground/70 transition-colors hover:text-primary"
          >
            그만두기
          </button>
        </p>
      )}

      <label className="sr-only" htmlFor={`comment-${taskId}`}>
        {replyTo ? "답글" : "댓글"}
      </label>
      {/* beUI Input 기본 치수(h-11 text-base)를 촘촘한 행에 맞춘다. 모서리는 기본값
          그대로다 — 바로 옆 `남기기` 버튼과 같은 계열이라 둘이 한 벌로 붙는다. */}
      <Input
        ref={input}
        id={`comment-${taskId}`}
        name="content"
        placeholder={replyTo ? "답글 남기기" : "댓글 남기기"}
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
