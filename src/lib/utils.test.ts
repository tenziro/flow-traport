import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY_MS, kstYmd } from "./aggregate/date";
import { fmtDayLabel, hexColor } from "./utils";
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

/* hexColor — 일정 색 막대 */

test("hexColor: 앞에 준 값부터 보고 첫 번째로 쓸 만한 것을 고른다", () => {
  assert.equal(hexColor("D0DA09"), "#D0DA09");
  // 실측 응답 모양. 일정 색은 비어 있고 달력 색만 온다.
  assert.equal(hexColor("", "D0DA09"), "#D0DA09");
  assert.equal(hexColor("1D4ED8", "D0DA09"), "#1D4ED8");
});

test("hexColor: 6자리 hex가 아니면 null이다", () => {
  // 응답 값을 style에 그대로 꽂는 자리라, 여기가 뚫리면 인라인 스타일이 주입된다.
  assert.equal(hexColor(), null);
  assert.equal(hexColor("", undefined), null);
  assert.equal(hexColor("#D0DA09"), null);
  assert.equal(hexColor("D0DA0"), null);
  assert.equal(hexColor("red; background: url(x)"), null);
});

/* 일정 창 — 오늘을 1일째로 세서 오늘 + 엿새 */

test("일정 창은 오늘부터 이레다", () => {
  assert.equal(EVENT_WINDOW_DAYS, 7);

  // 2026-08-03(월) 00:00 KST 기준. 끝은 8월 9일(일)이지 8월 10일이 아니다.
  const monday = Date.UTC(2026, 7, 2, 15, 0, 0);
  assert.equal(kstYmd(monday), "20260803");
  assert.equal(kstYmd(monday + (EVENT_WINDOW_DAYS - 1) * DAY_MS), "20260809");
});
