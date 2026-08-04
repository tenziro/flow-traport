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

/**
 * flow가 주는 색(`"D0DA09"`)을 CSS 색으로 바꾼다. 여러 개를 주면 앞에서부터 보고 쓸 만한
 * 첫 번째를 고른다 — 일정 색이 있으면 그걸, 없으면 달력 색이다 (§8.2 `eventColor`는
 * 실측에서 늘 비어 있었다).
 *
 * 6자리 hex가 아니면 null이다. 응답 값을 `style`에 그대로 꽂는 자리라, 형식을 안 보면
 * 남이 적어 넣은 문자열이 인라인 스타일로 들어간다.
 */
export function hexColor(...values: (string | undefined)[]): string | null {
  const hex = values.find((v) => v && /^[0-9a-fA-F]{6}$/.test(v));
  return hex ? `#${hex}` : null;
}

/**
 * 글에 섞여 오는 주소를 찾는다. `http`·`https`만 잡는다 — flow 본문에는 `www.`로 시작하는
 * 말이나 도메인처럼 보이는 파일명(`설계.v2.zip`)도 섞여서, 스킴이 있는 것만 링크로 본다.
 *
 * 한글을 주소에서 뺀 이유는 `https://foo.com에서`처럼 조사가 붙어서 오기 때문이다. 주소에
 * 한글이 그대로 들어오는 경우는 flow에서 본 적이 없다 (퍼센트 인코딩으로 온다).
 */
const LINK = /https?:\/\/[^\s<>"'가-힣]+/g;

/**
 * 글을 글자 조각과 주소 조각으로 가른다 — `url`이 있는 조각이 주소다 (`LinkedText`).
 *
 * 끝에 붙은 문장부호는 주소에서 뗀다. flow 본문은 `(https://…)`나 `https://…. 확인해주세요`
 * 처럼 오는데, 그대로 두면 닫는 괄호와 마침표가 주소에 실려 404가 된다.
 *
 * ponytail: 주소 안에 괄호가 있는 위키 주소는 끝의 `)`를 잃는다. flow 본문에서 본 적이 없어서
 * 여는 괄호를 세지 않는다 — 필요해지면 그때 짝을 맞춘다.
 */
export function splitLinks(text: string): { text: string; url?: string }[] {
  const parts: { text: string; url?: string }[] = [];
  let last = 0;

  for (const match of text.matchAll(LINK)) {
    const url = match[0].replace(/[.,;:!?)\]}'"]+$/, "");
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: url, url });
    last = match.index + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });

  return parts;
}

/** `20260430` → `2026-04-30` */
export function fmtDate(value: string): string {
  return /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`
    : value;
}
