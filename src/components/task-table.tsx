"use client";

import { useCallback, useMemo, useState } from "react";
import { DDay } from "@/components/d-day";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { Table, type TableColumn } from "@/components/motion/table";
import { countStatuses, StatusDot, statusChipClass } from "@/components/status-filter";
import { StatusPill } from "@/components/status-pill";
import { descIdOf, TaskDetailModal } from "@/components/task-detail-modal";
import { diffDays, parseFlowDeadline } from "@/lib/aggregate/date";
import type { FocusPick, WorklistTask } from "@/lib/flow/queries";
import { cn, fmtDate } from "@/lib/utils";

/**
 * 표 한 줄. 오늘·팀·내 업무·리스크 네 화면이 같은 줄을 쓴다 — 같은 업무를 화면마다 다른
 * 생김새로 보면 같은 것인지 알아보는 데 시간이 든다.
 *
 * `projectId`는 줄마다 다르다: 오늘·팀은 프로젝트 이름으로 해소하고(못 찾으면 null),
 * 내 업무·리스크는 카드가 이미 알고 있다. 그래서 표가 아니라 줄이 들고 온다.
 */
export type TaskTableRow = (FocusPick | WorklistTask) & {
  /** null이면 이름을 못 찾은 것 — 그 줄의 쓰기 줄을 감춘다. */
  projectId?: string | null;
  /** 포커스 목록만 준다. 정렬을 바꿔도 안 흔들리게 처음 순서로 미리 박아 온다. */
  rank?: number;
  /** 하위 업무 들여쓰기 단계 (내 업무 화면). */
  depth?: number;
};

/** 줄 높이. 44px면 제목 한 줄 + 상태 배지가 세로 가운데에 든다. */
const ROW_HEIGHT = 44;

/**
 * 하위 업무 들여쓰기. `my-tasks.ts`가 3단까지 준다. 표 안이라 세로선은 안 그린다 —
 * 칸 경계선과 겹쳐서 선이 두 겹으로 읽혔다.
 */
const INDENT = ["", "pl-3", "pl-6"];

/**
 * 업무 표 (PRD §6.1). 업무명 · 프로젝트 · 진행상태 · 등록일 · 마감일 다섯 칸이고,
 * 업무명을 누르면 상세 모달이 열린다.
 *
 * 업무명이 첫 칸이다. 프로젝트를 앞에 두면 같은 프로젝트 이름이 줄마다 반복되는 칸을 먼저
 * 읽고 나서야 업무명에 닿는다 — 찾는 것은 업무이고, 프로젝트는 그 업무가 어디 것인지다.
 *
 * 칸 폭을 %로 준다. beUI 표는 `table-layout: fixed` + `min-w-full`이라 px 합이 컨테이너보다
 * 넓으면 가로 스크롤 대신 비율대로 눌린다 — 어차피 눌릴 값이면 처음부터 비율로 적는 게 맞고,
 * 그래야 남는 폭을 먹는 채움 칸이 0이 된다.
 *
 * 모달은 표 전체에 **하나**다. 줄마다 하나씩 두면 열 줄에 모달 열 개가 DOM에 깔린다.
 */
export function TaskTable({
  rows,
  path,
  showProject = true,
  showRegDate = false,
  showOwner = false,
  top,
  maxRows = 8,
  filterable = false,
  emptyState = "볼 업무가 없어요",
}: {
  rows: readonly TaskTableRow[];
  /** 쓰기 액션 후 다시 그릴 경로. 화면마다 다르다. */
  path: string;
  /** 프로젝트 칸. 카드가 이미 한 프로젝트인 화면(내 업무·리스크)은 끈다. */
  showProject?: boolean;
  /** 등록일 칸. 워크리스트·포커스 응답에는 등록일이 없어서 오늘·팀 화면은 끈다. */
  showRegDate?: boolean;
  /** 담당자 칸. 리스크 화면만 쓴다 — 남의 업무가 섞여 있어서 누구 것인지가 정보다. */
  showOwner?: boolean;
  /** 1위 점수. 포커스 표에서 점수 막대의 분모로 쓴다. */
  top?: number;
  /** 스크롤 없이 보여줄 줄 수. 이보다 많으면 표 안에서 스크롤한다. */
  maxRows?: number;
  /** 상태 칩으로 거르기. 상태가 두 종류 이상일 때만 나온다. */
  filterable?: boolean;
  emptyState?: React.ReactNode;
}) {
  /**
   * 방금 바꾼 값 (BUG-037).
   *
   * 저장 액션은 `revalidatePath`로 화면을 다시 그리게 하는데, 페이지 하나를 통째로 다시
   * 그려서 오는 데 실측 6.5초다. 사용자는 그 사이에 "안 바뀐다"고 보고 새로고침한다.
   * 그래서 저장이 성공한 순간 그 줄만 먼저 바꿔 놓고, 서버 값이 도착하면 갈아탄다.
   *
   * `base`가 갈아타는 스위치다. 낙관값을 얹은 시점의 서버 값을 같이 들고 있어서, 서버가
   * 다른 값을 주면(내 저장이 반영됐든 남이 바꿨든) 낙관값을 저절로 버린다.
   */
  const [live, setLive] = useState<Record<number, Live>>({});

  /** 상태 칩. 표 안에서 거른다 — 서버로 다녀오면 951줄 화면이 실측 7초다. */
  const [picked, setPicked] = useState<string | null>(null);
  const counts = useMemo(() => (filterable ? countStatuses(rows) : []), [filterable, rows]);
  const shownRows = useMemo(
    () => (picked ? rows.filter((row) => row.status === picked) : rows),
    [picked, rows],
  );

  /**
   * 열려 있는 업무. 닫을 때 이 값을 비우지 않는다 — 모달이 접히는 동안 내용이 남아 있어야
   * 접히는 게 보인다(`MorphingModal`이 `AnimatePresence`로 내보낸다).
   */
  const [opened, setOpened] = useState<TaskTableRow | null>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  const shownOf = useCallback(
    (task: TaskTableRow) => {
      const patched = live[task.taskSrno];
      return patched?.base === baseOf(task) ? patched : task;
    },
    [live],
  );

  const columns = useMemo<TableColumn<TaskTableRow>[]>(() => {
    const list: TableColumn<TaskTableRow>[] = [];
    list.push({
      key: "title",
      header: "업무명",
      sortable: true,
      // 남는 폭을 다 준다 — 제목이 제일 길고, 잘리면 어느 업무인지 못 알아본다.
      width: titleWidth(showProject, showRegDate, showOwner),
      cell: (row) => (
        <button
          type="button"
          onClick={() => {
            setOpened(row);
            setOpen(true);
          }}
          className={cn(
            // 번호와 업무명을 `flex … items-center`로 묶는다. 글자 기준선에 맞추면(`align-*`)
            // 한글 글자가 자기 줄 안에서 조금 낮게 앉아 번호가 늘 위로 뜬다.
            "flex w-full cursor-pointer items-center gap-1.5 text-left font-medium transition-colors hover:text-primary",
            INDENT[row.depth ?? 0],
          )}
        >
          {/* 라임은 1위 한 곳에만 쓴다. 다섯 칸을 다 채우면 "지금 이거"가 안 읽힌다 */}
          {row.rank !== undefined && (
            <span
              className={cn(
                "tabular inline-flex size-5 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                row.rank === 1
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {row.rank}
            </span>
          )}
          <span className="min-w-0 truncate">{row.title}</span>
        </button>
      ),
    });
    if (showProject) {
      list.push({
        key: "project",
        header: "프로젝트",
        sortable: true,
        width: showRegDate ? "18%" : "20%",
        // 업무명보다 한 톤 흐리다. 같은 프로젝트 이름이 줄마다 반복되는 칸이라 본문색이면
        // 업무명과 같은 무게로 서서 눈이 먼저 그쪽에 걸린다.
        cell: (row) => <span className="text-muted-foreground">{row.project}</span>,
      });
    }
    list.push({
      key: "status",
      header: "진행상태",
      sortable: true,
      width: "13%",
      sortValue: (row) => shownOf(row).status,
      cell: (row) => <StatusPill status={shownOf(row).status} />,
    });
    if (showOwner) {
      list.push({ key: "owner", header: "담당자", sortable: true, width: "13%" });
    }
    if (showRegDate) {
      list.push({
        key: "regDate",
        header: "등록일",
        sortable: true,
        width: "14%",
        cell: (row) => {
          const reg = "regDate" in row ? row.regDate : "";
          return <span className="tabular">{reg ? fmtDate(reg) : "—"}</span>;
        },
      });
    }
    list.push({
      key: "endDate",
      header: "마감일",
      sortable: true,
      width: showRegDate ? "18%" : "20%",
      // 마감일 없는 업무는 맨 뒤로. 내 업무 880건 중 720건이 그래서, 앞에 몰리면 급한 게 안 보인다.
      sortValue: (row) => shownOf(row).endDate || "99999999",
      cell: (row) => {
        const shown = shownOf(row);
        if (!shown.endDate) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="tabular flex items-center gap-1.5">
            {fmtDate(shown.endDate)}
            <DDay days={shown.daysLeft} />
          </span>
        );
      },
    });
    return list;
  }, [showProject, showRegDate, showOwner, shownOf]);

  const openedShown = opened ? shownOf(opened) : null;

  return (
    <div className="space-y-2">
      {counts.length > 1 && (
        <div role="group" aria-label="상태로 거르기" className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            aria-pressed={!picked}
            onClick={() => setPicked(null)}
            className={cn(statusChipClass(!picked), "cursor-pointer")}
          >
            전체 {rows.length}
          </button>
          {counts.map(({ status, count }) => (
            <button
              key={status}
              type="button"
              aria-pressed={picked === status}
              onClick={() => setPicked(picked === status ? null : status)}
              className={cn(statusChipClass(picked === status, status), "cursor-pointer")}
            >
              <StatusDot status={status} />
              {status} {count}
            </button>
          ))}
        </div>
      )}

      <Table
        data={shownRows as TaskTableRow[]}
        columns={columns}
        getRowId={(row) => String(row.taskSrno)}
        rowHeight={ROW_HEIGHT}
        // 칸 경계를 끌어 폭을 바꾼다. 업무명이 사람마다 다르게 길어서 기본 비율로는
        // 누군가는 늘 잘린다 — 한 번 끌면 나머지 칸도 픽셀로 굳고 표가 가로로 넘친다.
        resizable
        // 머리 줄이 스크롤 칸 안에 있어서(sticky) 높이에 한 줄 더 얹어야 한다.
        height={
          shownRows.length === 0
            ? ROW_HEIGHT + 120
            : ROW_HEIGHT * (1 + Math.min(shownRows.length, maxRows))
        }
        emptyState={emptyState}
        className="rounded-lg"
      />

      {/* 모달 하나를 표가 돌려 쓴다. 접히는 동안 내용이 남아야 해서 `opened`는 안 비운다.
          `viewId`가 업무 번호라 다른 줄을 열면 패널이 높이를 맞춰 늘었다 줄어든다.
          오른쪽 위 닫기 아이콘은 끈다 — 패널 아래 `닫기` 버튼과 이름이 같아서 화면
          낭독기에 `닫기`가 두 번 읽힌다. 오른쪽 아래 한 자리로 모은다 (TEXT_GUIDE) */}
      <MorphingModal
        viewId={open && opened ? String(opened.taskSrno) : null}
        onClose={close}
        ariaLabel="업무 상세"
        ariaDescribedBy={opened ? descIdOf(opened) : undefined}
        showCloseButton={false}
        // `lg`부터 넓힌다 — 값 다섯 줄과 댓글이 한 폭을 나눠 쓰는데 34rem에서는 한 줄에
        // 마흔 자쯤이라 본문·댓글이 자주 접힌다. 44rem이면 쉰 자다. `lg` 밑에서 넓히지
        // 않는 것은 768px 화면에서 44rem이 오버레이 여백까지 밀어내기 때문이다
        className="max-w-[34rem] lg:max-w-[44rem]"
      >
        {opened && openedShown && (
          <TaskDetailModal
            task={opened}
            shown={openedShown}
            projectId={opened.projectId ?? null}
            path={path}
            rank={opened.rank}
            top={top}
            onClose={close}
            onSaved={(patch) => setLive((prev) => next(prev, opened, patch))}
          />
        )}
      </MorphingModal>
    </div>
  );
}

/** 낙관값 한 벌. `base`는 이 값을 얹은 시점의 서버 값이다 (위 주석). */
interface Live {
  base: string;
  status: string;
  endDate: string;
  daysLeft: number;
}

const baseOf = (task: { status: string; endDate: string }) => `${task.status}|${task.endDate}`;

/**
 * 방금 저장한 값으로 낙관값을 얹는다. `Date.now()`가 여기 있는 이유는 렌더가 아니라
 * 이벤트 안이어서다 — 렌더에서 부르면 다시 그릴 때마다 값이 달라진다 (react-hooks/purity).
 */
function next(
  live: Record<number, Live>,
  task: TaskTableRow,
  patch: { status?: string; endDate?: string },
): Record<number, Live> {
  const base = baseOf(task);
  const shown = live[task.taskSrno]?.base === base ? live[task.taskSrno] : task;
  const endDate = patch.endDate ?? shown.endDate;
  return {
    ...live,
    [task.taskSrno]: {
      base,
      status: patch.status ?? shown.status,
      endDate,
      // 마감일이 바뀌면 남은 일수도 그 값에서 다시 센다 — 안 그러면 옛 D+가 그대로 남는다.
      daysLeft:
        endDate === shown.endDate
          ? shown.daysLeft
          : diffDays(Date.now(), parseFlowDeadline(endDate) ?? Date.now()),
    },
  };
}

/** 업무명 칸이 남는 폭을 다 먹는다 — 나머지 칸 폭을 100%에서 뺀 값이다. */
function titleWidth(project: boolean, regDate: boolean, owner: boolean): string {
  const rest =
    (project ? (regDate ? 18 : 20) : 0) + 13 + (owner ? 13 : 0) + (regDate ? 14 : 0) + (regDate ? 18 : 20);
  return `${100 - rest}%`;
}
