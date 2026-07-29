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

/** `20260727151600` → `15:16`. 날짜가 이미 확정된 자리(오늘 일정)에 쓴다. */
export function fmtTime(value: string): string {
  return /^\d{14}$/.test(value) ? `${value.slice(8, 10)}:${value.slice(10, 12)}` : value;
}

/** `20260430` → `2026-04-30` */
export function fmtDate(value: string): string {
  return /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
    : value;
}
