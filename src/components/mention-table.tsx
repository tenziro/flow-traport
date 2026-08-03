"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FlowLink } from "@/components/flow-link";
import { IconLastComment } from "@/components/icons";
import { MentionActions } from "@/components/mention-actions";
import { Button } from "@/components/motion/button/base";
import {
  CenterMorphModal,
  CenterMorphModalClose,
  CenterMorphModalContent,
} from "@/components/motion/center-morph-modal";
import { Table, type TableColumn } from "@/components/motion/table";
import { StatusPill } from "@/components/status-pill";
import type { MentionGroup } from "@/lib/aggregate";
import { cn, fmtDateTime } from "@/lib/utils";

/** 표 한 줄. 프로젝트명은 알림에 없어서(`projectId`만 온다) 화면이 붙여 준다. */
export type MentionTableRow = MentionGroup & { project?: string };

/** 업무 표와 같은 줄 높이. 두 표가 나란히 있어서 다르면 줄이 어긋나 보인다. */
const ROW_HEIGHT = 44;

/**
 * 나를 부른 사람들 표 (PRD §6.1.2).
 *
 * **이 표만 열이 다르다.** 업무 표는 프로젝트·업무명·상태·마감일인데, 여기서 알아야 하는 건
 * "누가 뭐라고 불렀나"다 — 부른 사람과 마지막 말이 그 자리를 차지한다. 표 겉모양·줄 높이·
 * 업무명을 눌러 모달을 여는 방식은 업무 표와 같다.
 */
export function MentionTable({
  rows,
  path,
  maxRows = 8,
}: {
  rows: readonly MentionTableRow[];
  /** 읽음 처리 후 다시 그릴 경로. */
  path: string;
  maxRows?: number;
}) {
  /** 열려 있는 그룹. 모달이 접히는 동안 내용이 남아야 해서 닫을 때 비우지 않는다. */
  const [opened, setOpened] = useState<MentionTableRow | null>(null);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);

  /** `useCallback`이 필수다 — 이유는 `task-table.tsx`의 같은 자리 주석에 있다. */
  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) trigger.current?.focus();
  }, []);

  const columns = useMemo<TableColumn<MentionTableRow>[]>(
    () => [
      {
        key: "title",
        header: "업무명",
        sortable: true,
        width: "30%",
        cell: (row) => (
          <button
            type="button"
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setOpened(row);
              setOpen(true);
            }}
            // 번호와 업무명 묶는 방식은 업무 표와 같다 (`TaskTable`)
            className="flex w-full cursor-pointer items-center gap-1.5 text-left font-medium transition-colors hover:text-primary"
            title={
              row.unread > 0
                ? `알림 ${row.count}개 · 안 읽은 게 ${row.unread}개`
                : `알림 ${row.count}개`
            }
          >
            {/* 안 읽은 게 남았으면 배지를 꽉 채운다. 옅은 배경(다 읽은 줄)과 나란히
                놓였을 때 눈이 먼저 가는 쪽이 아직 답 안 한 쪽이다 */}
            <span
              className={cn(
                "tabular inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1 text-xs font-semibold",
                row.unread > 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/15 text-primary",
              )}
            >
              {row.count}
            </span>
            <span className="min-w-0 truncate">{row.title}</span>
          </button>
        ),
      },
      {
        key: "project",
        header: "프로젝트",
        sortable: true,
        width: "16%",
        // 업무 표와 같이 업무명보다 한 톤 흐리다 (`TaskTable`)
        cell: (row) => <span className="text-muted-foreground">{row.project ?? "—"}</span>,
      },
      { key: "lastFrom", header: "부른 사람", sortable: true, width: "14%" },
      {
        key: "lastComment",
        header: "마지막 말",
        width: "26%",
        // 알림 조회가 실패하면 본문이 없다 — 그 자리만 비운다.
        cell: (row) => (
          <span className="text-muted-foreground">{row.alarms[0]?.content ?? "—"}</span>
        ),
      },
      {
        key: "lastAt",
        header: "시각",
        sortable: true,
        width: "14%",
        cell: (row) => <span className="tabular">{fmtDateTime(row.lastAt)}</span>,
      },
    ],
    [],
  );

  return (
    <div>
      <Table
        data={rows as MentionTableRow[]}
        columns={columns}
        getRowId={(row) => row.taskId}
        rowHeight={ROW_HEIGHT}
        // 업무 표와 같이 칸 폭을 끌어 바꿀 수 있다 (`TaskTable`)
        resizable
        // 머리 줄이 스크롤 칸 안에 있어서(sticky) 높이에 한 줄 더 얹어야 한다.
        height={
          rows.length === 0
            ? ROW_HEIGHT + 120
            : ROW_HEIGHT * (1 + Math.min(rows.length, maxRows))
        }
        emptyState="새로 부른 사람이 없어요"
        className="rounded-lg"
      />

      <CenterMorphModal open={open} onOpenChange={onOpenChange}>
        {opened && <MentionDetail group={opened} path={path} />}
      </CenterMorphModal>
    </div>
  );
}

/**
 * 멘션 상세 모달. 표 줄은 마지막 말 한 줄만 보여주니, 앞뒤 대화는 여기서 읽는다.
 *
 * 알림은 **나를 부른 댓글만** 준다 — 부모 댓글은 안 와서 진짜 트리로는 못 세운다.
 * 답글은 한 칸 들여쓰기와 아이콘 색까지가 정직한 선이다.
 */
function MentionDetail({ group, path }: { group: MentionTableRow; path: string }) {
  const descId = `mention-detail-${group.taskId}`;

  return (
    <CenterMorphModalContent
      ariaLabel="나를 부른 댓글"
      ariaDescribedBy={descId}
      showCloseButton={false}
      className="max-w-[34rem]"
    >
      <div className="border-b border-border px-5 pt-5 pb-4">
        <p className="truncate text-xs text-muted-foreground">{group.project ?? "프로젝트 미확인"}</p>
        <h2 id={descId} className="mt-1 text-base font-semibold">
          {group.title}
        </h2>
        <div className="tabular mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {group.status && <StatusPill status={group.status} />}
          <span>알림 {group.count}개</span>
          {group.unread > 0 && (
            <span className="rounded bg-primary/15 px-1 text-primary">안 읽음 {group.unread}개</span>
          )}
        </div>
      </div>

      <div className="border-b border-border px-5 py-4">
        {/* 오래된 것부터 — 대화는 위에서 아래로 읽는다 (그룹 배열은 최신순이다) */}
        <ul className="space-y-3">
          {[...group.alarms].reverse().map((alarm, i) => (
            <li key={`${alarm.at}-${i}`} className={cn("flex gap-2", alarm.isReply && "ml-5")}>
              <IconLastComment
                size={14}
                className={cn(
                  "mt-0.5 shrink-0",
                  alarm.isReply ? "text-primary" : "text-muted-foreground",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="tabular flex flex-wrap items-baseline gap-x-1.5 text-xs">
                  {/* 이름은 본문색으로. 시각과 같은 회색이면 누가 썼는지가 안 걸린다 */}
                  <span className="font-medium text-foreground">{alarm.from}</span>
                  {alarm.isReply && <span className="text-primary">답글</span>}
                  {alarm.unread && (
                    <span className="rounded bg-primary/15 px-1 text-[11px] text-primary">
                      안 읽음
                    </span>
                  )}
                  <span className="text-muted-foreground">{fmtDateTime(alarm.at)}</span>
                </p>
                {alarm.content && (
                  // 줄바꿈은 살린다 — 댓글이 목록 형태로 오는 경우가 많다.
                  // `wrap-anywhere` — 링크가 섞여 와서 안 끊으면 그 덩어리가 최소폭이 된다.
                  <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line wrap-anywhere">
                    {alarm.content}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
        {/* 읽음 처리와 전체 스레드 (PRD §13 A1·A2) */}
        <MentionActions
          alarmIds={group.alarms.flatMap((alarm) => (alarm.unread && alarm.id ? [alarm.id] : []))}
          unread={group.unread}
          postId={group.postId}
          path={path}
        />
      </div>

      <div className="flex items-center justify-between px-5 py-3">
        <FlowLink href={group.link} />
        <CenterMorphModalClose>
          <Button type="button" size="sm" variant="ghost">
            닫기
          </Button>
        </CenterMorphModalClose>
      </div>
    </CenterMorphModalContent>
  );
}
