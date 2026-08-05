import assert from "node:assert/strict";
import { test } from "node:test";
import { DAY_MS, kstYmd } from "./aggregate/date";
import { fmtDate, fmtDateTime, fmtDayLabel, fmtTime, hexColor, splitLinks } from "./utils";
import { EVENT_WINDOW_DAYS } from "./flow/queries";

/* fmtDate · fmtDateTime — 값 칸의 날짜 (등록일·마감일·마지막 수정) */

test("fmtDate·fmtDateTime: 날짜 부분이 글자까지 같다", () => {
  // 한 표에 나란히 서는 값들이다. 앞 10자가 어긋나면 같은 종류로 안 읽힌다.
  assert.equal(fmtDate("20260727"), "2026-07-27");
  assert.equal(fmtDateTime("20260727151600"), "2026-07-27 15:16");
  assert.equal(fmtDateTime("20260727151600").slice(0, 10), fmtDate("20260727"));
});

test("fmtDate: 14자리도 받아서 앞 8자리만 쓴다", () => {
  assert.equal(fmtDate("20260727151600"), "2026-07-27");
});

test("fmtDate·fmtDateTime: 형식이 어긋나면 원본을 그대로 낸다", () => {
  // flow는 값이 없으면 `null`이 아니라 `""`로 준다.
  assert.equal(fmtDate(""), "");
  assert.equal(fmtDateTime(""), "");
  assert.equal(fmtDate("2026-07-27"), "2026-07-27");
  assert.equal(fmtDate("202607"), "202607");
  assert.equal(fmtDateTime("20260727"), "20260727");
});

test("fmtTime: 시각만 내는 자리는 이 규칙 밖이다", () => {
  assert.equal(fmtTime("20260727151600"), "15:16");
});

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

/* splitLinks — 업무 본문의 주소를 새 창 링크로 */

test("splitLinks: 주소가 없으면 글 하나다", () => {
  assert.deepEqual(splitLinks("링크 없는 본문"), [{ text: "링크 없는 본문" }]);
  assert.deepEqual(splitLinks(""), []);
});

test("splitLinks: 글 사이의 주소를 조각으로 가른다", () => {
  assert.deepEqual(splitLinks("확인: https://flow.team/x 부탁해요"), [
    { text: "확인: " },
    { text: "https://flow.team/x", url: "https://flow.team/x" },
    { text: " 부탁해요" },
  ]);
});

test("splitLinks: 끝에 붙은 문장부호와 닫는 괄호는 주소가 아니다", () => {
  // 그대로 두면 마침표·괄호가 주소에 실려 404가 된다.
  assert.deepEqual(splitLinks("(https://a.io/b)"), [
    { text: "(" },
    { text: "https://a.io/b", url: "https://a.io/b" },
    { text: ")" },
  ]);
  assert.deepEqual(splitLinks("https://a.io/b."), [
    { text: "https://a.io/b", url: "https://a.io/b" },
    { text: "." },
  ]);
});

test("splitLinks: 주소에 붙은 조사는 주소가 아니다", () => {
  assert.deepEqual(splitLinks("http://a.io에서 봐요"), [
    { text: "http://a.io", url: "http://a.io" },
    { text: "에서 봐요" },
  ]);
});

test("splitLinks: 스킴이 없으면 링크가 아니다", () => {
  // 도메인처럼 보이는 파일명(`설계.v2.zip`)까지 링크로 만들면 눌러도 갈 곳이 없다.
  assert.deepEqual(splitLinks("www.flow.team 과 설계.v2.zip"), [
    { text: "www.flow.team 과 설계.v2.zip" },
  ]);
});

test("splitLinks: 한 본문에 주소가 여럿이면 다 가른다", () => {
  assert.deepEqual(splitLinks("https://a.io\nhttps://b.io"), [
    { text: "https://a.io", url: "https://a.io" },
    { text: "\n" },
    { text: "https://b.io", url: "https://b.io" },
  ]);
});

test("splitLinks: 부른 사람은 이름만 남기고 조각으로 가른다", () => {
  // `@`와 대괄호는 flow 안에서만 뜻이 있는 표시라 화면에 안 낸다 — 대신 굵기와 색이 붙는다.
  assert.deepEqual(splitLinks("@[서동조] 확인 부탁드립니다"), [
    { text: "서동조", mention: true },
    { text: " 확인 부탁드립니다" },
  ]);
  assert.deepEqual(splitLinks("@[이종석] @[장혜진] 회의 잡을게요"), [
    { text: "이종석", mention: true },
    { text: " " },
    { text: "장혜진", mention: true },
    { text: " 회의 잡을게요" },
  ]);
});

test("splitLinks: 부른 사람과 주소가 한 줄에 있어도 각자 조각이다", () => {
  assert.deepEqual(splitLinks("@[서동조] https://a.io 봐주세요"), [
    { text: "서동조", mention: true },
    { text: " " },
    { text: "https://a.io", url: "https://a.io" },
    { text: " 봐주세요" },
  ]);
});

test("splitLinks: 표시가 없는 @나 대괄호는 그냥 글이다", () => {
  // 메일 주소와 대괄호 목록이 본문에 그대로 온다.
  assert.deepEqual(splitLinks("jslee@traport.com 으로 보냈어요 [완료]"), [
    { text: "jslee@traport.com 으로 보냈어요 [완료]" },
  ]);
});

/* 일정 창 — 오늘을 1일째로 세서 오늘 + 엿새 */

test("일정 창은 오늘부터 이레다", () => {
  assert.equal(EVENT_WINDOW_DAYS, 7);

  // 2026-08-03(월) 00:00 KST 기준. 끝은 8월 9일(일)이지 8월 10일이 아니다.
  const monday = Date.UTC(2026, 7, 2, 15, 0, 0);
  assert.equal(kstYmd(monday), "20260803");
  assert.equal(kstYmd(monday + (EVENT_WINDOW_DAYS - 1) * DAY_MS), "20260809");
});
