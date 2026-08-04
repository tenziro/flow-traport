"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
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
import { TASK_STATUS } from "@/lib/task-status";
import { TASK_PRIORITY, type TaskPriority } from "@/lib/task-priority";
import { DateMenu } from "@/components/date-field";
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconChevronDown,
  IconComment,
  IconLastComment,
  IconLoader,
  IconMinus,
  IconNormal,
  IconSiren,
} from "@/components/icons";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { type ReplyTarget } from "@/components/thread-view";
import { StatusPill } from "@/components/status-pill";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WorkerPicker } from "@/components/worker-picker";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";

/**
 * 업무 상세 모달의 쓰기 줄 (PRD §6.1.4, §13 A4).
 *
 * **지금 값이 곧 버튼이다.** 상태·마감일·우선순위는 값 글자를 누르면 그 아래로 목록이나
 * 달력이 열리고, 고른 즉시 저장된다. 레이어 밖을 누르면 접히고 값은 그대로다.
 *
 * 예전에는 줄마다 `변경`이 있고 고른 뒤 `저장`을 또 눌러야 했다 — 값 하나 바꾸는 데 세 번을
 * 누르고, 누른 줄만 컨트롤로 커져서 다섯 줄이 통째로 흔들렸다. 셋 다 되돌리기가 한 번 더
 * 고르는 것뿐이라(§8.1의 "확인 또는 실행 취소" 중 실행 취소) 확인 단계를 뺐다.
 *
 * 담당자만 `변경`을 남긴다. 여럿을 켜고 끄는 일은 한 번 누르기로 끝나지 않고, flow 쓰기가
 * 덮어쓰기라서 잘못 저장하면 남의 담당까지 떨어진다 — 목록·검색·고른 사람을 한 화면에 놓는
 * 별도 모달로 받고 `확인`으로 맺는다 (`worker-picker.tsx`).
 *
 * 등록일은 읽기다. flow에 등록일을 바꾸는 경로가 없다 — 사람이 정하는 값이 아니라 글이
 * 생길 때 시스템이 찍는 값이다 (`RGSN_DTTM` — api-spec §6.4에 쓰기 경로가 없다).
 *
 * 댓글도 확인 단계를 두지 않는다. 내용을 직접 타이핑하는 것 자체가 확인이고, 댓글은
 * 파괴적이지 않다 (§8.1의 "확인 또는 실행 취소" 중 확인에 해당).
 *
 * 넷 다 REST로 나간다. 쓰기는 개인 API 키가 있어야 한다 — 없으면 서버가 거절하고
 * 키를 등록하라고 답한다 (`restRun` — actions.ts).
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
 * 값 글자가 곧 트리거다 (상태·마감일·우선순위).
 *
 * 네모나 밑줄을 두르지 않는다 — 다섯 줄 중 셋에 테두리가 생기면 읽는 자리가 입력 폼으로
 * 보인다. 대신 좌우 여백을 넓혀 두고 그만큼 음수 여백으로 당겨서, 값 시작점은 등록일 줄과
 * 맞은 채로 호버·포커스에서만 그 자리가 바닥색으로 드러난다.
 */
const PICK =
  "-mx-1.5 flex h-8 max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-md px-1.5 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60";

/**
 * 상태·등록일·마감일·우선순위·담당자 다섯 줄 (PRD §6.1.4).
 *
 * 담당자는 워크리스트에 없다. **이 덩어리가 붙을 때 한 번만** 부른다 — 업무 한 줄에
 * REST 한 번이라, 표의 모든 행이 미리 부르면 열 줄에 열 번이다. 상세 모달이 열릴 때만
 * 붙으니 실제로는 보고 있는 업무 하나만 부른다.
 *
 * 우선순위는 이제 목록 응답에 있어서(`FlowTask.priority`) 그 조회를 안 기다린다 — 값이
 * 있는 줄은 모달이 열리는 첫 그림부터 값이 서 있다.
 */
export function TaskEditFields({
  projectId,
  taskId,
  title,
  status,
  endDate = "",
  regDate = "",
  priority = "",
  editDate = "",
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
  /** 목록이 아는 우선순위 코드(`high`…). 마감일과 같이 공짜라 REST를 안 기다린다. */
  priority?: string;
  /** 목록이 아는 마지막 수정 `YYYYMMDDHHmmss`. flow에 바꾸는 경로가 없어 읽기만 한다. */
  editDate?: string;
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
  /** 목록 값이 먼저다 — 조회를 기다릴 이유가 없다. 둘 다 없을 때만 "불러오는 중…"으로 간다. */
  const level = priority || fields?.priority || "";

  return (
    /* 줄 사이에 선을 둔다. 결과 문구가 값 열 아래로 접히면 그게 다음 줄의 값처럼
       보였다 — 선이 어느 줄까지가 한 덩어리인지 말한다 */
    <div className="divide-y divide-border/60">
      <StatusField
        projectId={projectId}
        taskId={taskId}
        now={status}
        path={path}
        onSaved={(shown) => onSaved?.({ status: shown })}
      />
      {/* 등록일만 읽기다 — flow에 바꾸는 경로가 없다 (위 주석).
          마감일 위에 둔다 — 업무가 언제 시작해서 언제까지인지가 시간 순서로 읽힌다 */}
      <div className={ROW}>
        <span className={LABEL}>등록일</span>
        <div className={FIELD}>
          <span className="min-w-0 flex-1 truncate text-xs leading-8">
            {created ? fmtDate(created) : restNow("")}
          </span>
        </div>
      </div>
      {/* 마감일은 목록이 이미 알아서 REST를 안 기다린다 — 여기만 `loading`을 안 넘긴다 */}
      <EndDateField
        projectId={projectId}
        taskId={taskId}
        now={dueDate}
        path={path}
        /* 고른 값은 `YYYY-MM-DD`고 표는 flow 형식(`YYYYMMDD`)을 쓴다 */
        onSaved={(shown) => onSaved?.({ endDate: shown.replaceAll("-", "") })}
      />
      <PriorityField
        projectId={projectId}
        taskId={taskId}
        now={level ? (TASK_PRIORITY[level as TaskPriority] ?? level) : restNow("")}
        loading={loading}
        path={path}
      />
      {/* 마지막 수정도 읽기다 — 등록일과 같이 flow에 바꾸는 경로가 없다. 방치 판정이
          이 값 하나로 갈리는데(30일 넘게 안 바뀜) 어디에도 안 보여서, 표에서 "왜 여기
          있지" 싶은 업무를 열면 답이 여기 있게 한다 */}
      {editDate && (
        <div className={ROW}>
          <span className={LABEL}>마지막 수정</span>
          <div className={FIELD}>
            <span className="min-w-0 flex-1 truncate text-xs leading-8">
              {fmtDateTime(editDate)}
            </span>
          </div>
        </div>
      )}
      <WorkerField
        projectId={projectId}
        taskId={taskId}
        now={restNow(fields?.workers.join(", ") ?? "")}
        workers={fields?.workers ?? []}
        loading={loading}
        path={path}
      />
    </div>
  );
}

/** 댓글 폼의 숨은 필드. 다섯 줄은 폼이 아니라 손으로 FormData를 만든다 (`useField`). */
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
 * 한 줄의 즉시 저장. 고른 자리에서 바로 보내고, 성공하면 방금 보낸 값이 지금 값이 된다.
 *
 * `<form>`을 쓰지 않는다 — 폼이면 고르는 것과 보내는 것이 두 동작으로 갈라져서, 숨은
 * input에 코드를 심고 그다음 submit을 부르는 순서를 맞춰야 한다. `useActionState`의 두 번째
 * 값은 그냥 함수라, 누른 자리에서 FormData를 만들어 그대로 넘긴다.
 *
 * `shown`은 화면에 낼 글자다 — 서버로 나가는 코드(`progress`·`high`·userId)는 사람이 읽을
 * 글자가 아니고, 라벨을 훅이 알아내려면 표 넷을 여기로 끌고 와야 한다.
 */
function useField(
  serverAction: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>,
  /** 어느 업무인가. 줄마다 똑같이 필요해서 `save`가 알아서 붙인다. */
  ref: { projectId: string; taskId: number; path: string },
  /** 저장한 값을 행에도 알린다 (BUG-037). 행에 없는 줄(우선순위·담당자)은 안 넘긴다. */
  onSaved?: (shown: string) => void,
) {
  const [saved, setSaved] = useState("");
  const [result, dispatch, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, form) => {
      const next = await serverAction(prev, form);
      if (next.ok) {
        const shown = String(form.get("shown") ?? "");
        setSaved(shown);
        onSaved?.(shown);
      }
      return next;
    },
    null,
  );

  /** 줄마다 다른 필드만 받는다. 값이 배열이면 같은 이름으로 여러 번 싣는다 (담당자). */
  const save = (fields: Record<string, string | string[]>) => {
    const form = new FormData();
    form.set("projectId", ref.projectId);
    form.set("taskId", String(ref.taskId));
    form.set("path", ref.path);
    for (const [name, value] of Object.entries(fields)) {
      if (Array.isArray(value)) value.forEach((one) => form.append(name, one));
      else form.set(name, value);
    }
    dispatch(form);
  };

  return { saved, result, pending, save };
}

/** 지금 값 + `변경`. 담당자 줄만 쓴다 — 나머지 셋은 값 자체가 트리거다 (`PICK`). */
function Shown({
  now,
  label,
  disabled,
  onEdit,
}: {
  now: string;
  label: string;
  disabled?: boolean;
  onEdit: () => void;
}) {
  return (
    <>
      {/* 32px 자리를 잡고 그 안에 세운다 — 옆 버튼(28px)과 다른 줄에서 온 값들이
          같은 높이에서 시작해야 다섯 줄의 눈금이 맞는다 */}
      <span className="flex h-8 min-w-0 flex-1 items-center">
        {/* 라벨 열과 같은 `text-xs`다 — 지금 값은 읽고 지나가는 값이고, 이 다섯 줄에서
            제일 크게 읽혀야 하는 건 위 머리의 업무명이다 */}
        <span className="min-w-0 truncate text-xs">{now}</span>
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={`${label} 변경`}
        disabled={disabled}
        onClick={onEdit}
        className="h-7 px-2.5"
      >
        변경
      </Button>
    </>
  );
}

/**
 * 지금 값 옆의 표시. 저장 중에는 도는 표시로 바꾼다.
 *
 * 고른 즉시 레이어가 접히니 저장 중이라고 말할 자리가 여기밖에 없다 — `저장` 버튼이 있던
 * 때는 그 버튼이 `저장 중…`으로 바뀌었다. 화살표는 항상 보인다. 호버로만 알리면 손가락으로
 * 쓰는 화면에서는 누를 수 있는 줄인지 알 수가 없다.
 */
function PickMark({ pending }: { pending: boolean }) {
  return pending ? (
    <IconLoader size={12} aria-label="저장 중" className="shrink-0 animate-spin text-primary" />
  ) : (
    <IconChevronDown size={12} aria-hidden className="shrink-0 text-muted-foreground" />
  );
}

/**
 * 우선순위 네 단계의 표시 — flow 화면이 쓰는 그림을 그대로 따른다 (낮음 ↓ / 보통 — /
 * 높음 ↑ / 긴급 경보등). Cockpit이 다른 그림을 쓰면 같은 값을 두 번 배워야 한다.
 *
 * 색만으로 말하지 않는다 (WCAG 1.4.1). 라벨 글자가 항상 같이 나가고, 모양도 색 없이 단계를
 * 말한다 — 아래·수평·위·경보. 아는 라벨이 아니면(`불러오는 중…`·`아직 없어요`·
 * `지금 값을 못 가져왔어요`) 글자만 낸다. 없는 값에 그림을 붙이면 값이 있는 것처럼 읽힌다.
 */
export const PRIORITY_MARK: Record<string, { Icon: typeof IconArrowDown; tone: string }> = {
  낮음: { Icon: IconArrowDown, tone: "text-muted-foreground" },
  보통: { Icon: IconMinus, tone: "text-success-foreground" },
  높음: { Icon: IconArrowUp, tone: "text-warning-foreground" },
  긴급: { Icon: IconSiren, tone: "text-danger-foreground" },
};

function PriorityMark({ label }: { label: string }) {
  const mark = PRIORITY_MARK[label];

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {mark && <mark.Icon size={13} aria-hidden className={cn("shrink-0", mark.tone)} />}
      <span className="min-w-0 truncate text-xs">{label}</span>
    </span>
  );
}

/**
 * 값 아래로 열리는 고르기 레이어 (상태·우선순위). 누르면 즉시 저장하고 접힌다.
 *
 * 지금 값도 목록에 남긴다 — 빼면 줄마다 후보 수가 달라져서 위치로 값을 기억할 수 없다.
 * 대신 체크로 표시하고, 그걸 다시 누르면 저장하지 않고 접기만 한다. flow가 같은 값으로의
 * 변경을 400으로 거절하기 때문에, 보내 봐야 이 줄에 빨간 문구만 남는다.
 *
 * beUI `Select`가 아니다 — 목록이 `absolute`로 붙어서, clip-path로 자기 네모를 잘라내는
 * 이 모달 패널 밖으로 자라면 그대로 사라진다 (bug-report BUG-009). 라딕스 팝오버는 Portal로
 * 나간다.
 *
 * ponytail: 화살표 키 이동은 없다 — `Tab`이 후보 넷·다섯을 그대로 훑고 `Enter`가 고른다.
 * 그래서 `role="menu"`도 안 붙인다. 메뉴라고 알리면 화살표로 움직일 수 있다는 뜻이 되고,
 * 그걸 믿은 사람은 목록 안에서 아무 데도 못 간다.
 */
function PickMenu({
  label,
  options,
  now,
  disabled,
  pending,
  onPick,
  render,
}: {
  label: string;
  /** `[코드, 화면에 낼 라벨]`. 상태·우선순위 표를 그대로 받는다. */
  options: [string, string][];
  /** 지금 값 라벨. 트리거에 그리고 체크 자리를 찾는 데 쓴다. */
  now: string;
  disabled?: boolean;
  pending: boolean;
  onPick: (value: string, label: string) => void;
  /**
   * 라벨 하나를 그리는 법. 상태는 배지(`StatusPill`), 우선순위는 아이콘+글자다
   * (`PriorityMark`).
   *
   * 트리거와 목록이 **같은 함수**를 쓴다 — 고른 값은 목록에서 본 그 모양으로 자리에 남는다.
   * 트리거만 따로 그리던 때는 목록이 글자뿐이고 트리거만 배지라, 고르고 나면 방금 누른 것과
   * 다른 것이 켜진 것처럼 보였다.
   */
  render: (label: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled || pending}
        /* 값이 트리거라 그냥 두면 이름이 값뿐이다 — 무슨 값인지, 눌러서 뭐가 되는지 같이 읽힌다 */
        aria-label={`${label} 바꾸기, 지금 ${now}`}
        className={PICK}
      >
        {render(now)}
        <PickMark pending={pending} />
      </PopoverTrigger>
      {/* `z-[110]`은 업무 상세 모달(`z-[100]` — morphing-modal)보다 위로 올리는 값이다.
          기본 `z-50`이면 목록이 패널 뒤로 들어간다. Escape는 여기서 멈춘다 — 모달도
          `window`에서 Escape를 듣고 있어서, 그냥 두면 목록을 접으려고 누른 키가 모달까지
          통째로 닫는다 (라딕스는 문서 캡처 단계에서 받으니 여기서 끊으면 안 넘어간다) */}
      <PopoverContent
        align="start"
        aria-label={label}
        className="z-[110] w-36 gap-0 p-1"
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        {options.map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-current={text === now ? "true" : undefined}
            onClick={() => {
              setOpen(false);
              if (text !== now) onPick(value, text);
            }}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex min-w-0 flex-1 items-center">{render(text)}</span>
            {text === now && <IconCheck size={13} aria-hidden className="shrink-0 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
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
  const { saved, result, pending, save } = useField(
    updateTaskStatus,
    { projectId, taskId, path },
    onSaved,
  );
  /** 저장한 뒤에는 방금 저장한 값이 지금 값이다 — 부모가 준 `now`는 아직 옛것이다. */
  const current = saved || now;

  return (
    <div className={ROW}>
      <span className={LABEL}>상태</span>
      <div className={FIELD}>
        <PickMenu
          label="상태"
          options={Object.entries(TASK_STATUS)}
          now={current}
          pending={pending}
          onPick={(value, label) => save({ status: value, shown: label })}
          /* 상태는 글자가 아니라 배지다 — 값 자체가 색을 갖는 유일한 줄이고(요청·진행·
             피드백·완료·보류), 머리에 있는 배지와 같은 모양이라 이 줄이 그 값을 가리킨다는
             걸 따로 읽지 않아도 된다. 색만으로 말하지 않는다 — 라벨 글자가 같이 나간다.
             고르기 목록도 같은 배지다: 목록에서 색을 보고 고른 사람은 그 색이 자리에 남을
             거라고 읽는다 */
          render={(label) => <StatusPill status={label} />}
        />

        <Result result={result} />
      </div>
    </div>
  );
}

/**
 * 마감일 (PRD §13 A4).
 *
 * 후보가 365개라 목록이 아니라 달력이다 — shadcn `Calendar` + `Popover` (`date-field.tsx`).
 * 값은 `YYYY-MM-DD` 문자열이고 서버가 하이픈만 떼서 flow의 `YYYYMMDD`로 만든다.
 *
 * 이미 골라 둔 날짜를 다시 누르면 저장하지 않고 접기만 한다 — 달력은 같은 날을 다시 누르면
 * 고른 것을 지워서 빈 값을 주는데, 마감일을 지우는 경로는 flow에 없다.
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
  /** 지금 마감일 `YYYYMMDD`. 빈 문자열이면 아직 없다. */
  now: string;
  path: string;
  onSaved: (shown: string) => void;
}) {
  const { saved, result, pending, save } = useField(
    updateTaskEndDate,
    { projectId, taskId, path },
    onSaved,
  );
  /** 달력이 쓰는 `YYYY-MM-DD`. 그대로 화면에 낼 글자이기도 하다. */
  const value = saved || (now ? fmtDate(now) : "");

  return (
    <div className={ROW}>
      <span className={LABEL}>마감일</span>
      <div className={FIELD}>
        <DateMenu
          value={value}
          disabled={pending}
          aria-label={`마감일 바꾸기, 지금 ${value || "없어요"}`}
          className={PICK}
          onPick={(picked) => picked && save({ endDate: picked, shown: picked })}
        >
          <span className="min-w-0 truncate text-xs">{value || "아직 없어요"}</span>
          <PickMark pending={pending} />
        </DateMenu>

        <Result result={result} />
      </div>
    </div>
  );
}

/** 우선순위 (PRD §13 A4). 네 라벨이 다 받침으로 끝나서 조사는 `으로` 하나면 된다. */
function PriorityField({
  projectId,
  taskId,
  now,
  loading,
  path,
}: {
  projectId: string;
  taskId: number;
  now: string;
  /** 지금 값이 아직 안 왔으면 못 누른다 — 무엇이 켜져 있는지 모르는 채로 고르게 된다. */
  loading: boolean;
  path: string;
}) {
  const { saved, result, pending, save } = useField(updateTaskPriority, {
    projectId,
    taskId,
    path,
  });
  const current = saved || now;

  return (
    <div className={ROW}>
      <span className={LABEL}>우선순위</span>
      <div className={FIELD}>
        <PickMenu
          label="우선순위"
          options={Object.entries(TASK_PRIORITY)}
          now={current}
          disabled={loading}
          pending={pending}
          onPick={(value, label) => save({ priority: value, shown: label })}
          render={(label) => <PriorityMark label={label} />}
        />

        <Result result={result} />
      </div>
    </div>
  );
}

/**
 * 담당자 (PRD §13 A4).
 *
 * 여기만 `변경`이 남았다. 담당은 여럿이 나눠 지고 flow 쓰기가 덮어쓰기라, 한 번 누르기로
 * 끝내면 켜다 만 상태가 그대로 저장돼 남의 담당까지 떨어진다 — 고르기는 별도 모달에서
 * 받고 `확인`으로 맺는다 (`worker-picker.tsx`).
 *
 * 후보 목록은 **`변경`을 누를 때만 부른다.** 조회가 업무 한 줄에 REST 두 번이라(참여자 +
 * 그 프로젝트 업무 — `listParticipants`), 모달을 열 때 같이 부르면 상태만 바꾸러 온 사람도
 * 그 값을 치른다.
 *
 * 후보에는 타사 사용자도 있다. flow 참여자 API가 우리 기관 사람만 주는데 실제 담당자는
 * 대부분 고객사 쪽이라, 그 목록만 쓰면 고를 수 있는 사람이 실제의 5분의 1이었다.
 */
function WorkerField({
  projectId,
  taskId,
  now,
  workers,
  loading,
  path,
}: {
  projectId: string;
  taskId: number;
  now: string;
  /** 지금 담당자 실명. 프리체크와 누락 안내가 이걸 후보 목록과 맞춘다. */
  workers: readonly string[];
  /** 지금 담당자가 아직 안 왔으면 못 누른다 — 미리 켤 사람을 모르는 채로 열게 된다. */
  loading: boolean;
  path: string;
}) {
  const [open, setOpen] = useState(false);
  // 저장이 되면 모달을 접는다. 실패면 열어 둔다 — 고른 사람들이 그대로 남아 있어야 사유를
  // 읽고 다시 보낼 수 있다. 접는 자리가 액션 안인 이유: 성공 여부를 아는 자리가 거기다
  // (이펙트에서 `result.ok`를 보고 접으면 React 19 린트가 막는다).
  const { saved, result, pending, save } = useField(
    updateTaskWorker,
    { projectId, taskId, path },
    () => setOpen(false),
  );
  const [picked, setPicked] = useState<string[]>([]);
  const [people, setPeople] = useState<ParticipantResult | null>(null);
  const [asking, startAsk] = useTransition();
  const current = saved || now;
  const candidates = people?.participants ?? [];
  /** 이름은 성공 문구용이다 — 서버가 id로만 답하면 "누구로 바꿨는지"를 못 적는다. */
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
   * 그래서 아무것도 안 바꾸고 `확인`을 누르면 flow가 같은 값이라고 거절하는데, 그 메시지는
   * 이 줄에 그대로 나온다.
   */
  const mine = (list: readonly Participant[]) =>
    list.filter((p) => currentNames.includes(p.name)).map((p) => p.userId);

  /** 열 때마다 지금 담당자로 되돌린다 — 지난번에 고르다 닫은 것이 남아 있으면 안 된다. */
  function edit() {
    setOpen(true);
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
    <div className={ROW}>
      <span className={LABEL}>담당자</span>
      <div className={FIELD}>
        <Shown now={current} label="담당자" disabled={loading} onEdit={edit} />

        {/* 후보를 못 불러온 경우. `변경`을 다시 누르면 한 번 더 부른다 */}
        {people && !people.participants && <Result result={people} />}
        <Result result={result} />
      </div>

      <WorkerPicker
        open={open}
        onOpenChange={setOpen}
        loading={asking}
        candidates={candidates}
        picked={picked}
        pending={pending}
        /* 덮어쓰기라는 걸 그대로 적는다 — 안 켠 사람은 담당에서 빠진다 */
        note={
          missing.length > 0
            ? `참여자 목록에 없는 담당자 ${missing.length}명(${missing.join(", ")}) — 저장하면 담당에서 빠져요.`
            : "켠 사람들만 담당이 돼요."
        }
        onToggle={(userId) =>
          setPicked((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
          )
        }
        onClear={() => setPicked([])}
        onConfirm={() =>
          save({ workerId: picked, workerName: pickedNames, shown: pickedNames })
        }
      />
    </div>
  );
}

/**
 * 댓글·답글 한 줄 남기기. 상세 모달의 댓글 칸이 이걸 쓴다.
 *
 * `replyTo`가 있으면 답글이다. 다만 REST에 답글이 없어서 **`@이름`을 앞에 붙인 최상위
 * 댓글**로 나간다 (`createComment` 주석) — 스레드로 묶이지는 않지만 위 목록에 바로 보인다.
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
      {/* REST에 답글이 없어서 이름만 넘긴다 — 서버가 `@이름`을 앞에 붙인 댓글로 보낸다 */}
      {replyTo && <input type="hidden" name="replyToName" value={replyTo.from} />}

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
