/**
 * flow 날짜 문자열 파싱 — KST(UTC+9) 고정.
 *
 * flow는 날짜를 `YYYYMMDD`(8자리), 일시를 `YYYYMMDDHHmm`(12자리) 또는
 * `YYYYMMDDHHmmss`(14자리) 문자열로 준다. 마감일(`END_DT`)은 초를 뗀 12자리로 오는 경우가
 * 섞여 있어서 초는 선택으로 둔다 — 12자리를 못 읽으면 그 업무는 마감이 없는 것처럼 보인다.
 * `new Date("20260727")` 같은 암묵 파싱은 런타임/로케일마다 결과가 달라지므로 쓰지 않는다.
 * 모든 파싱은 자릿수를 직접 잘라 `Date.UTC` + 고정 오프셋으로 계산한다.
 */

export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 86_400_000;

/** 기준 시각 인자로 받을 수 있는 형태. `Date.now()`는 이 레이어에서 절대 호출하지 않는다. */
export type NowInput = number | Date | string;

const FLOW_DATE_RE = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?$/;

/**
 * `YYYYMMDD` / `YYYYMMDDHHmm` / `YYYYMMDDHHmmss` → epoch ms.
 * 8자리는 그날 00:00:00 KST. 형식 불일치·존재하지 않는 날짜(20260231)는 null.
 */
export function parseFlowDate(value: string | null | undefined): number | null {
  if (value == null) return null;
  const m = FLOW_DATE_RE.exec(String(value).trim());
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
  const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - KST_OFFSET_MS;
  // 20260231 같은 오버플로 롤오버를 걸러낸다.
  const back = new Date(ms + KST_OFFSET_MS);
  if (
    back.getUTCFullYear() !== +y ||
    back.getUTCMonth() !== +mo - 1 ||
    back.getUTCDate() !== +d
  ) {
    return null;
  }
  return ms;
}

/**
 * 마감 시각 = "그 시점까지는 아직 안 늦은" 마지막 순간.
 * 날짜만 주어지면(8자리) 그날 23:59:59.999 KST — 오늘이 마감인 업무는 오늘 중엔 지연이 아니다.
 * 14자리는 그 시각 그대로.
 */
export function parseFlowDeadline(value: string | null | undefined): number | null {
  const ms = parseFlowDate(value);
  if (ms == null) return null;
  return String(value).trim().length === 8 ? ms + DAY_MS - 1 : ms;
}

/** KST 기준 달력 일자 인덱스(1970-01-01 KST = 0). 일수 차이 계산의 기준. */
export function kstDayIndex(ms: number): number {
  return Math.floor((ms + KST_OFFSET_MS) / DAY_MS);
}

/** epoch ms → KST 달력 일자의 `YYYYMMDD`. flow에 날짜 범위를 넘길 때 쓴다. */
export function kstYmd(ms: number): string {
  const d = new Date(ms + KST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}

/** KST 달력 일수 차이 (to - from). 같은 날이면 0, 어제→오늘이면 1. */
export function diffDays(fromMs: number, toMs: number): number {
  return kstDayIndex(toMs) - kstDayIndex(fromMs);
}

/** 기준 시각 정규화. flow 문자열도 허용한다. */
export function toEpochMs(now: NowInput): number {
  if (typeof now === 'number') return now;
  if (now instanceof Date) return now.getTime();
  const ms = parseFlowDate(now);
  if (ms == null) throw new TypeError(`invalid flow datetime: ${now}`);
  return ms;
}
