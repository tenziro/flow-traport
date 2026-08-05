"use client";

import { motion } from "motion/react";
import { type PointerEvent as ReactPointerEvent, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconGrip,
  IconMoreH,
  IconSortV,
  IconTrash,
} from "@/components/icons";
import { Checkbox } from "@/components/motion/checkbox";
import { EASE_OUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";
import { TableMenu } from "./table-menu";
import type {
  HeaderCellRefs,
  InsertPosition,
  SortState,
  TableColumn,
} from "./types";
import { alignFlex, alignText, COLUMN_ACTIVE_SHADOW, HEADER_EDGE_SHADOW } from "./utils";

export interface TableHeaderProps<T> {
  columns: TableColumn<T>[];
  rowHeight: number;
  reduce: boolean;
  thRefs: HeaderCellRefs;
  selectable: boolean;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  sort: SortState | null;
  onToggleSort: (key: string) => void;
  resizable: boolean;
  onResizeStart: (key: string, e: ReactPointerEvent) => void;
  onResizeMove: (e: ReactPointerEvent) => void;
  onResizeEnd: (e: ReactPointerEvent) => void;
  reorderable: boolean;
  dragKey: string | null;
  dropIndex: number | null;
  onReorderStart: (key: string, e: ReactPointerEvent) => void;
  onReorderMove: (e: ReactPointerEvent) => void;
  onReorderEnd: (e: ReactPointerEvent) => void;
  onInsertColumn?: (index: number, position: InsertPosition) => void;
  onDeleteColumn?: (columnKey: string, index: number) => void;
  onColumnRename?: (columnKey: string, value: string) => void;
  activeColumn: string | null;
  onColumnActivate?: (key: string) => void;
  onColumnDeactivate?: () => void;
}

/** Column insert / delete menu items shared by the header cell and the portal handle. */
function columnMenuItems<T>(
  column: TableColumn<T>,
  index: number,
  onInsertColumn?: (index: number, position: InsertPosition) => void,
  onDeleteColumn?: (columnKey: string, index: number) => void,
) {
  return [
    ...(onInsertColumn
      ? [
          {
            label: "Insert before",
            icon: <IconArrowLeft />,
            onSelect: () => onInsertColumn(index, "before"),
          },
          {
            label: "Insert after",
            icon: <IconArrowRight />,
            onSelect: () => onInsertColumn(index, "after"),
          },
        ]
      : []),
    ...(onDeleteColumn
      ? [
          {
            label: "Delete column",
            icon: <IconTrash />,
            destructive: true,
            onSelect: () => onDeleteColumn(column.key, index),
          },
        ]
      : []),
  ];
}

/** The ellipse handle, portaled so it can sit on the column's top border without
 * the scroll container clipping it. Straddles the border to bridge hover. */
function ColumnHandle<T>({
  column,
  index,
  thRefs,
  onInsertColumn,
  onDeleteColumn,
  onEnter,
  onLeave,
}: {
  column: TableColumn<T>;
  index: number;
  thRefs: HeaderCellRefs;
  onInsertColumn?: (index: number, position: InsertPosition) => void;
  onDeleteColumn?: (columnKey: string, index: number) => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  useEffect(() => {
    window.addEventListener("scroll", onLeave, true);
    return () => window.removeEventListener("scroll", onLeave, true);
  }, [onLeave]);

  const el = thRefs.current[column.key];
  if (!el || typeof document === "undefined") return null;
  const rect = el.getBoundingClientRect();

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: rect.top,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -50%)",
        zIndex: 40,
      }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <TableMenu
        ariaLabel={`${column.key} column options`}
        triggerClassName="flex h-2 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        trigger={<IconMoreH size={12} />}
        items={columnMenuItems(column, index, onInsertColumn, onDeleteColumn)}
      />
    </div>,
    document.body,
  );
}

export function TableHeader<T>({
  columns,
  rowHeight,
  reduce,
  thRefs,
  selectable,
  allSelected,
  someSelected,
  onToggleAll,
  sort,
  onToggleSort,
  resizable,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  reorderable,
  dragKey,
  dropIndex,
  onReorderStart,
  onReorderMove,
  onReorderEnd,
  onInsertColumn,
  onDeleteColumn,
  onColumnRename,
  activeColumn,
  onColumnActivate,
  onColumnDeactivate,
}: TableHeaderProps<T>) {
  const hasColumnMenu = !!(onInsertColumn || onDeleteColumn);
  const activeIndex = columns.findIndex((c) => c.key === activeColumn);
  return (
    <>
      {hasColumnMenu && activeColumn && activeIndex >= 0 ? (
        <ColumnHandle
          column={columns[activeIndex]}
          index={activeIndex}
          thRefs={thRefs}
          onInsertColumn={onInsertColumn}
          onDeleteColumn={onDeleteColumn}
          onEnter={() => onColumnActivate?.(activeColumn)}
          onLeave={() => onColumnDeactivate?.()}
        />
      ) : null}
      <thead>
      <tr style={{ height: rowHeight }}>
        {selectable ? (
          <th
            style={{ boxShadow: HEADER_EDGE_SHADOW }}
            className="sticky top-0 z-10 bg-card"
          >
            <div className="flex items-center justify-center">
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onCheckedChange={onToggleAll}
                aria-label="Select all rows"
                className="size-6"
              />
            </div>
          </th>
        ) : null}
        {columns.map((column, index) => {
          const active = sort?.key === column.key;
          const isDragging = dragKey === column.key;
          const isActive = activeColumn === column.key;
          return (
            <th
              key={column.key}
              ref={(el) => {
                thRefs.current[column.key] = el;
              }}
              onPointerEnter={() => onColumnActivate?.(column.key)}
              onPointerLeave={() => onColumnDeactivate?.()}
              // 위 선은 활성 칸일 때만, 아래 선은 늘. 둘 다 그림자라 한 값에 겹쳐 넣는다 —
              // 하나만 쓰면 활성일 때 아래 선이 지워진다
              style={{ boxShadow: isActive ? COLUMN_ACTIVE_SHADOW : HEADER_EDGE_SHADOW }}
              aria-sort={
                active
                  ? sort?.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : undefined
              }
              data-drop={dragKey ? dropIndex === index : undefined}
              data-dropend={
                dragKey
                  ? dropIndex === columns.length && index === columns.length - 1
                  : undefined
              }
              className={cn(
                "group sticky top-0 z-10 bg-card p-0 font-medium text-muted-foreground",
                "data-[drop=true]:before:absolute data-[drop=true]:before:inset-y-0 data-[drop=true]:before:left-0 data-[drop=true]:before:w-0.5 data-[drop=true]:before:bg-primary",
                "data-[dropend=true]:after:absolute data-[dropend=true]:after:inset-y-0 data-[dropend=true]:after:right-0 data-[dropend=true]:after:w-0.5 data-[dropend=true]:after:bg-primary",
              )}
            >
              <motion.div
                className={cn(
                  "flex h-full items-center",
                  alignFlex(column.align),
                )}
                style={{ height: rowHeight }}
                animate={
                  reduce
                    ? { opacity: isDragging ? 0.5 : 1 }
                    : {
                        scale: isDragging ? 1.04 : 1,
                        opacity: isDragging ? 0.5 : 1,
                      }
                }
                transition={SPRING_PRESS}
              >
                {reorderable ? (
                  <button
                    type="button"
                    aria-label={`Reorder ${column.key} column`}
                    onPointerDown={(e) => onReorderStart(column.key, e)}
                    onPointerMove={onReorderMove}
                    onPointerUp={onReorderEnd}
                    className="flex h-full w-6 cursor-grab touch-none items-center justify-center text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing"
                  >
                    <IconGrip size={14} />
                  </button>
                ) : null}
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => onToggleSort(column.key)}
                    className={cn(
                      "flex h-full min-w-0 flex-1 select-none items-center gap-1 px-4 transition-colors hover:text-foreground",
                      alignFlex(column.align),
                      active && "text-foreground",
                    )}
                  >
                    <span className="truncate">{column.header}</span>
                    {/* 정렬 표시는 세 가지다 — 안 누른 칸은 위아래 화살(`sort-v`)로 "여기서
                        세울 수 있다"만 말하고, 누르면 오름차순 ↑ · 내림차순 ↓ 로 바뀐다.
                        전에는 ∧ 하나를 흐리게 두고 내림차순일 때 180° 돌렸다: 흐린 ∧가
                        "정렬 안 됨"인지 "오름차순인데 흐림"인지 그림만으로는 안 갈렸다.
                        도는 대신 그림이 바뀌니 회전값도 뺀다 */}
                    <motion.span
                      aria-hidden
                      className="inline-flex shrink-0"
                      animate={{ opacity: active ? 1 : 0.35 }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { duration: 0.18, ease: EASE_OUT }
                      }
                    >
                      {!active ? (
                        <IconSortV size={14} />
                      ) : sort?.direction === "desc" ? (
                        <IconArrowDown size={14} />
                      ) : (
                        <IconArrowUp size={14} />
                      )}
                    </motion.span>
                  </button>
                ) : onColumnRename ? (
                  <input
                    value={
                      typeof column.header === "string" ? column.header : ""
                    }
                    aria-label={`Rename ${column.key} column`}
                    size={1}
                    onChange={(e) =>
                      onColumnRename(column.key, e.target.value)
                    }
                    className={cn(
                      "min-w-0 flex-1 truncate appearance-none rounded-md border-0 bg-transparent px-4 font-medium text-muted-foreground outline-none transition-colors focus:bg-muted focus:text-foreground",
                      alignText(column.align),
                    )}
                  />
                ) : (
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate px-4",
                      alignText(column.align),
                    )}
                  >
                    {column.header}
                  </span>
                )}
              </motion.div>
              {resizable ? (
                <button
                  type="button"
                  aria-label={`Resize ${column.key} column`}
                  tabIndex={-1}
                  onPointerDown={(e) => onResizeStart(column.key, e)}
                  onPointerMove={onResizeMove}
                  onPointerUp={onResizeEnd}
                  className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-primary/40"
                />
              ) : null}
            </th>
          );
        })}
        <th
          aria-hidden
          style={{ boxShadow: HEADER_EDGE_SHADOW }}
          className="sticky top-0 z-10 bg-card"
        />
      </tr>
    </thead>
    </>
  );
}
