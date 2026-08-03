import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ── flow 날짜 문자열 표시 ─────────────────────────────────────────────────
 * flow는 날짜를 `YYYYMMDD`(8자리) 또는 `YYYYMMDDHHmmss`(14자리) 문자열로 준다.
 * 형식이 어긋나면 원본을 그대로 낸다 — 화면에서 빈 자리를 만들지 않는다.
 */

/** `20260727151600` → `07.27 15:16` */
export function fmtDateTime(value: string): string {
  return /^\d{14}$/.test(value)
    ? `${value.slice(4, 6)}.${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`
    : value;
}

/** `20260727151600` → `15:16`. 날짜가 소제목으로 이미 확정된 자리(일정 목록)에 쓴다. */
export function fmtTime(value: string): string {
  return /^\d{14}$/.test(value) ? `${value.slice(8, 10)}:${value.slice(10, 12)}` : value;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * `20260803…` → `8.3 (월)`. 나의 일정의 날짜 소제목이다. 8자리·14자리를 다 받는다.
 *
 * 요일은 `Date.UTC`로 뽑는다. 넘어온 `YYYYMMDD`는 이미 KST 달력 일자라, 지역 시간대로
 * 다시 해석하면 UTC로 도는 서버에서 하루가 밀린다.
 */
export function fmtDayLabel(value: string): string {
  const ymd = value.slice(0, 8);
  if (!/^\d{8}$/.test(ymd)) return value;
  const [y, m, d] = [+ymd.slice(0, 4), +ymd.slice(4, 6), +ymd.slice(6, 8)];
  return `${m}.${d} (${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

/** `20260430` → `2026-04-30` */
export function fmtDate(value: string): string {
  return /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
    : value;
}
