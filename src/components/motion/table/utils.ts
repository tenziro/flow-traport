import type { ReactNode } from "react";
import type { TableColumn } from "./types";

export const CHECKBOX_PX = 48;
export const CHECKBOX_WIDTH = `${CHECKBOX_PX}px`;

/**
 * 머리 줄 아래 선. `border-b`가 아니라 안쪽 그림자다 — 표가 `border-collapse`라 셀 테두리는
 * 셀이 아니라 **표 격자**가 그린다. 격자는 `sticky`를 따라오지 않아서 줄을 내리면 머리 칸은
 * 붙어 있는데 그 아래 선만 같이 올라가 사라졌다. 그림자는 셀이 자기 상자에 칠하는 것이라
 * 셀과 같이 붙어 있는다.
 *
 * ponytail: 표를 `border-separate`로 바꿔도 같은 자리가 고쳐지지만, 그러면 줄 테두리
 * (`td`의 `border-b`)와 겉테두리까지 다시 계산되는 판이라 벤더 컴포넌트에서 건드릴 자리가
 * 아니다. 머리 한 줄만 그림자로 그린다.
 */
export const HEADER_EDGE_SHADOW = "inset 0 -1px 0 var(--color-border)";

/** Highlights the top edge of the active column's header cell. */
export const COLUMN_ACTIVE_SHADOW = `inset 0 1px 0 var(--color-primary), ${HEADER_EDGE_SHADOW}`;

export function alignFlex(align: TableColumn<unknown>["align"]) {
  if (align === "right") return "justify-end";
  if (align === "center") return "justify-center";
  return "justify-start";
}

export function alignText(align: TableColumn<unknown>["align"]) {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function readCell<T>(row: T, column: TableColumn<T>): ReactNode {
  if (column.cell) return column.cell(row);
  return (row as Record<string, ReactNode>)[column.key];
}

export function readSortValue<T>(
  row: T,
  column: TableColumn<T>,
): string | number {
  if (column.sortValue) return column.sortValue(row);
  return (row as Record<string, string | number>)[column.key];
}
