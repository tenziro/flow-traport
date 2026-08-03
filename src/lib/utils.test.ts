import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY_MS, kstYmd } from "./aggregate/date";
import { fmtDayLabel } from "./utils";
import { EVENT_WINDOW_DAYS } from "./flow/queries";

/* fmtDayLabel — 나의 일정의 날짜 소제목 */

test("fmtDayLabel: 8자리 · 14자리를 같게 읽는다", () => {
  assert.equal(fmtDayLabel("20260803"), "8.3 (월)");
  assert.equal(fmtDayLabel("20260803091500"), "8.3 (월)");
});

test("fmtDayLabel: 요일이 KST 달력 일자를 따른다", () => {
  // 시간대에 따라 하루가 밀리면 여기가 깨진다. `Date.UTC`로 뽑는 이유다.
  assert.equal(fmtDayLabel("20260809"), "8.9 (일)");
  assert.equal(fmtDayLabel("20260101"), "1.1 (목)");
});

test("fmtDayLabel: 형식이 어긋나면 원본을 그대로 낸다", () => {
  assert.equal(fmtDayLabel(""), "");
  assert.equal(fmtDayLabel("2026-08-03"), "2026-08-03");
});

/* 일정 창 — 오늘을 1일째로 세서 오늘 + 엿새 */

test("일정 창은 오늘부터 이레다", () => {
  assert.equal(EVENT_WINDOW_DAYS, 7);

  // 2026-08-03(월) 00:00 KST 기준. 끝은 8월 9일(일)이지 8월 10일이 아니다.
  const monday = Date.UTC(2026, 7, 2, 15, 0, 0);
  assert.equal(kstYmd(monday), "20260803");
  assert.equal(kstYmd(monday + (EVENT_WINDOW_DAYS - 1) * DAY_MS), "20260809");
});
