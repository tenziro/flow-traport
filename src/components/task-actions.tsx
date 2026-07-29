"use client";

import { useActionState, useState } from "react";
import {
  createComment,
  loadParticipants,
  loadTaskFields,
  updateTaskEndDate,
  updateTaskPriority,
  updateTaskStatus,
  updateTaskWorker,
  type ActionResult,
} from "@/app/(app)/actions";
import type { TaskFields } from "@/lib/flow/rest";
import { TASK_STATUS, type TaskStatus } from "@/lib/task-status";
import { TASK_PRIORITY, type TaskPriority } from "@/lib/task-priority";
import { DateField, TRIGGER_PILL } from "@/components/date-field";
import {
  IconComment,
  IconNormal,
  IconPriority,
  IconWorker,
} from "@/components/icons";
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
import { ThreadView } from "@/components/thread-view";
import { cn, fmtDate } from "@/lib/utils";

/**
 * 업무 행에 붙는 쓰기 액션 (PRD §6.1.4, §13 A4).
 *
 * 두 칸으로 나눈다: **바꾸기**(상태·마감일·우선순위·담당자)와 **댓글**(남기기·전량 보기).
 * 다섯 폼을 한 칸에 세로로 쌓으면 무엇이 무엇인지 읽는 데 시간이 든다.
 *
 * 확인 단계는 버튼 두 번 누르기로 만든다 — 값을 고르면 "바꿀까요?"가 뜨고, 거기서 한 번
 * 더 눌러야 flow로 나간다. 모달을 띄우지 않는다: 업무가 수십 줄인 화면에서 모달은 어느
 * 행을 건드리는지 오히려 흐려진다.
 *
 * 댓글은 확인 단계를 두지 않는다. 내용을 직접 타이핑하는 것 자체가 확인이고,
 * 댓글은 파괴적이지 않다 (§8.1의 "확인 또는 실행 취소" 중 확인에 해당).
 *
 * 상태만 MCP로 나가고 나머지 셋은 REST다. REST 쓰기는 개인 API 키가 있어야 한다 —
 * 없으면 서버가 거절하고 키를 등록하라고 답한다 (`restRun` — actions.ts).
 */

/* ── 행 눈금 ───────────────────────────────────────────────────────────────
 * 네 줄이 라벨 열과 컨트롤 열을 같이 쓴다. 라벨을 컨트롤의 형제로 그냥 두면 글자 수가
 * 다른 만큼(상태 2자 · 우선순위 4자) 컨트롤 시작점이 줄마다 어긋나고, 넘친 확인 문구가
 * 라벨 밑(x=0)까지 되감긴다. 열을 고정하면 네 줄의 왼쪽 끝과 오른쪽 끝이 같이 맞는다.
 */
const ROW = "flex items-start gap-2";
/** `leading-8`이 컨트롤 높이(32px)와 같아서 라벨이 첫 줄 한가운데에 선다. */
const LABEL = "w-14 shrink-0 text-xs leading-8 text-muted-foreground";
/** 접힘은 여기서 일어난다 — 넘친 확인 문구가 컨트롤 열 안쪽에서 다음 줄로 간다. */
const FIELD = "flex min-w-0 flex-1 flex-wrap items-center gap-2";
/** 네 컨트롤이 같은 폭이라 오른쪽 끝도 맞는다. */
const CONTROL = "w-40";

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
  /*
   * 지금 우선순위·담당자는 워크리스트에 없다. **패널을 열 때 한 번만** 부른다 —
   * 업무 한 줄에 REST 한 번이라, 행마다 미리 부르면 밀리는 업무 열 줄에 열 번이다.
   *
   * ponytail: 실패하면 조용히 접는다. 사용자가 할 일은 그대로 값을 고르는 것뿐이고,
   * 못 불러온 자리는 "지금 …" 없이 "고르기"로 남는다 — 없는 값을 지어내지 않는다.
   */
  const [fields, setFields] = useState<TaskFields | null>(null);
  const [loading, setLoading] = useState(false);

  function onOpen(value: string | null) {
    if (value !== `edit-${taskId}` || fields || loading) return;
    setLoading(true);
    loadTaskFields(projectId, taskId, title)
      .then((r) => setFields(r.fields ?? null))
      .finally(() => setLoading(false));
  }

  // 기본은 접어둔다. 밀리는 업무가 열 줄 넘는 화면에서 폼이 다 펼쳐져 있으면 목록을 못 읽는다.
  return (
    <BouncyAccordion
      className="mt-1"
      onValueChange={onOpen}
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
          id: `edit-${taskId}`,
          icon: <IconPriority size={13} />,
          title: "상태·마감일·우선순위·담당자 바꾸기",
          description: (
            /*
             * 트리거는 [아이콘 16px][간격 6px][제목]이다. 세로선은 아이콘 한가운데(8px)로,
             * 폼 시작점은 제목 시작점(22px)으로 맞춘다 — 선 두께 2px를 빼면 7 + 2 + 13이다.
             * 눈금이 안 맞으면 접기 제목과 그 아래 폼이 서로 다른 열처럼 보인다.
             */
            <div className="ml-[7px] space-y-2 border-l-2 border-border pl-[13px]">
              <StatusForm projectId={projectId} taskId={taskId} current={status} path={path} />
              <EndDateForm
                projectId={projectId}
                taskId={taskId}
                current={fields?.endDate || endDate}
                path={path}
              />
              <PriorityForm
                projectId={projectId}
                taskId={taskId}
                current={fields?.priority ?? ""}
                loading={loading}
                path={path}
              />
              <WorkerForm
                projectId={projectId}
                taskId={taskId}
                current={fields?.workers ?? []}
                loading={loading}
                path={path}
              />
            </div>
          ),
        },
        {
          // 댓글은 따로 뗀다. 위 넷과 한 칸에 넣으면 폼이 다섯 줄이라 어느 게 무엇인지
          // 읽는 데 시간이 든다 — 바꾸는 일과 말하는 일은 애초에 다른 일이다.
          id: `talk-${taskId}`,
          icon: <IconComment size={13} />,
          title: "댓글 보거나 남기기",
          description: (
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
 * 두 번 누르기 확인 (§8.1). 네 폼이 같은 모양을 쓴다 — 줄마다 버튼 높이가 다르면
 * 컨트롤 열이 다시 들쭉날쭉해진다.
 */
function Confirm({
  question,
  pending,
  onCancel,
}: {
  question: string;
  pending: boolean;
  onCancel: () => void;
}) {
  return (
    <>
      <span className="text-xs text-warning-foreground">{question}</span>
      {/* 옆 컨트롤(32px)보다 한 급 낮춘다. 같은 높이에 라임을 채우면 이 줄에서 제일 큰
          덩어리가 되어, 답해야 할 질문보다 답하는 버튼이 먼저 읽힌다 */}
      <Button type="submit" size="sm" disabled={pending} className="h-7 px-2.5">
        {pending ? "바꾸는 중…" : "네, 바꿀게요"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onCancel}
        className="h-7 px-2.5"
      >
        취소
      </Button>
    </>
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
    <form action={action} className={ROW}>
      <TaskRef projectId={projectId} taskId={taskId} path={path} />

      <span id={`status-label-${taskId}`} className={LABEL}>
        상태
      </span>
      <div className={FIELD}>
        {/* beUI Select는 button 기반이라 폼 값을 안 실어준다 — hidden input이 FormData를 채운다 */}
        <input type="hidden" name="status" value={picked} />
        <Select
          value={picked}
          onValueChange={(next) => setPicked(next as TaskStatus)}
          className={CONTROL}
        >
          {/* 옆 댓글 입력·버튼과 같은 pill이다. 반경은 클래스로 못 준다 — 모서리 애니메이션이
              인라인 스타일을 쓴다 (select.tsx `radius`). 좌우 여백은 곡선을 피해 한 칸 넓힌다 */}
          <SelectTrigger
            aria-labelledby={`status-label-${taskId}`}
            radius={16}
            className="h-8 px-3 py-0"
          >
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
          <Confirm
            question={`${TASK_STATUS[picked]}(으)로 바꿀까요?`}
            pending={pending}
            onCancel={() => setPicked("")}
          />
        )}

        <Result result={result} />
      </div>
    </form>
  );
}

/**
 * 마감일 (PRD §13 A4).
 *
 * 달력은 shadcn `Calendar` + `Popover`다 (`date-field.tsx`). 값은 여전히 `YYYY-MM-DD`
 * 문자열이고 서버가 하이픈만 떼서 flow의 `YYYYMMDD`로 만든다.
 */
function EndDateForm({
  projectId,
  taskId,
  current,
  path,
}: {
  projectId: string;
  taskId: number;
  /** 지금 마감일 `YYYYMMDD`. 없으면 빈 문자열이다. */
  current: string;
  path: string;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    updateTaskEndDate,
    null,
  );
  const [picked, setPicked] = useState("");

  return (
    <form action={action} className={ROW}>
      <TaskRef projectId={projectId} taskId={taskId} path={path} />

      <span id={`end-date-label-${taskId}`} className={LABEL}>
        마감일
      </span>
      <div className={FIELD}>
        <DateField
          name="endDate"
          value={picked}
          onChange={setPicked}
          aria-labelledby={`end-date-label-${taskId}`}
          placeholder={current ? `지금 ${fmtDate(current)}` : "날짜 고르기"}
          className={CONTROL}
        />

        {picked && (
          // 고른 날짜가 바로 왼쪽 트리거에 떠 있다 — 문구에서 다시 읽어주지 않는다
          <Confirm
            question="이 날짜로 바꿀까요?"
            pending={pending}
            onCancel={() => setPicked("")}
          />
        )}

        <Result result={result} />
      </div>
    </form>
  );
}

/** 우선순위 (PRD §13 A4). 네 라벨이 다 받침으로 끝나서 조사는 `으로` 하나면 된다. */
function PriorityForm({
  projectId,
  taskId,
  current,
  loading,
  path,
}: {
  projectId: string;
  taskId: number;
  /** 지금 우선순위 코드. 없거나 아직 못 불러왔으면 빈 문자열이다. */
  current: string;
  loading: boolean;
  path: string;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    updateTaskPriority,
    null,
  );
  const [picked, setPicked] = useState<TaskPriority | "">("");
  const now = TASK_PRIORITY[current as TaskPriority];

  return (
    <form action={action} className={ROW}>
      <TaskRef projectId={projectId} taskId={taskId} path={path} />

      <span id={`priority-label-${taskId}`} className={LABEL}>
        우선순위
      </span>
      <div className={FIELD}>
        {/* beUI Select는 button 기반이라 폼 값을 안 실어준다 — hidden input이 FormData를 채운다 */}
        <input type="hidden" name="priority" value={picked} />
        <Select
          value={picked}
          onValueChange={(next) => setPicked(next as TaskPriority)}
          className={CONTROL}
        >
          <SelectTrigger
            aria-labelledby={`priority-label-${taskId}`}
            radius={16}
            className="h-8 px-3 py-0"
          >
            {/* 지금 값은 패널을 열 때 REST로 온다. 못 불러왔으면 "지금 보통"처럼
                지어내지 않고 고르라고만 한다 */}
            <SelectValue placeholder={now ? `지금 ${now}` : loading ? "불러오는 중…" : "고르기"} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TASK_PRIORITY).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {picked && (
          <Confirm
            question={`${TASK_PRIORITY[picked]}으로 바꿀까요?`}
            pending={pending}
            onCancel={() => setPicked("")}
          />
        )}

        <Result result={result} />
      </div>
    </form>
  );
}

/**
 * 담당자 (PRD §13 A4).
 *
 * 후보 목록은 **누를 때만 부른다.** 프로젝트 참여자 조회가 업무 행마다 한 번씩이라,
 * 펼치기만 해도 부르면 밀리는 업무 열 줄에 열 번이다.
 *
 * 폼이 두 개인 이유: 후보를 부르는 것과 담당자를 바꾸는 것은 서버 액션이 다르고,
 * form 안에 form은 못 넣는다. 후보가 도착하면 첫 폼을 두 번째 폼으로 갈아탄다.
 */
function WorkerForm({
  projectId,
  taskId,
  current,
  loading,
  path,
}: {
  projectId: string;
  taskId: number;
  /** 지금 담당자 실명. 없거나 아직 못 불러왔으면 빈 배열이다. */
  current: string[];
  loading: boolean;
  path: string;
}) {
  const [list, loadAction, listLoading] = useActionState(loadParticipants, null);
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    updateTaskWorker,
    null,
  );
  const [picked, setPicked] = useState("");
  const pickedName = list?.participants?.find((p) => p.userId === picked)?.name ?? "";
  const now = current.join(", ");

  return (
    <div className={ROW}>
      <span id={`worker-label-${taskId}`} className={LABEL}>
        담당자
      </span>

      <div className={FIELD}>
        {list?.participants ? (
          <form action={action} className={FIELD}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="taskId" value={taskId} />
            <input type="hidden" name="path" value={path} />
            <input type="hidden" name="workerId" value={picked} />
            {/* 이름은 성공 문구용이다 — 서버가 id로만 답하면 "누구로 바꿨는지"를 못 적는다 */}
            <input type="hidden" name="workerName" value={pickedName} />
            <Select value={picked} onValueChange={setPicked} className={CONTROL}>
              <SelectTrigger
                aria-labelledby={`worker-label-${taskId}`}
                radius={16}
                className="h-8 px-3 py-0"
              >
                <SelectValue
                  placeholder={now ? `지금 ${now}` : `참여자 ${list.participants.length}명`}
                />
              </SelectTrigger>
              <SelectContent>
                {list.participants.map((person) => (
                  <SelectItem key={person.userId} value={person.userId}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {picked && (
              // 덮어쓰기라는 걸 그대로 적는다. flow는 담당자를 여럿 둘 수 있는데
              // 여기서 바꾸면 한 명만 남는다
              <Confirm
                question={`${pickedName} 혼자 담당이 돼요. 바꿀까요?`}
                pending={pending}
                onCancel={() => setPicked("")}
              />
            )}

            <Result result={result} />
          </form>
        ) : (
          <form action={loadAction}>
            <input type="hidden" name="projectId" value={projectId} />
            {/* 후보를 부르기 전에도 지금 담당자는 보여준다. 셀렉트와 같은 pill·같은 폭이라
                후보가 도착해 셀렉트로 갈아타도 열이 안 흔들린다 */}
            <button
              type="submit"
              aria-labelledby={`worker-label-${taskId}`}
              disabled={listLoading}
              className={cn(TRIGGER_PILL, CONTROL, !now && "text-muted-foreground")}
            >
              <IconWorker size={13} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {listLoading || loading ? "불러오는 중…" : now ? `지금 ${now}` : "참여자 고르기"}
              </span>
            </button>
          </form>
        )}

        {/* 후보를 못 불러온 경우. 위 폼은 그대로 버튼이라 다시 누를 수 있다 */}
        {list && !list.participants && <Result result={list} />}
      </div>
    </div>
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
