import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyTasks, isTaskDone } from './classifyTasks';
import { DAY_MS, KST_OFFSET_MS, diffDays, kstYmd, parseFlowDate, parseFlowDeadline, toEpochMs } from './date';
import { groupMentions } from './groupMentions';
import { rollupProjects } from './rollupProjects';
import type { StandupMember, StandupTask } from './rollupProjects';
import { FOCUS_WEIGHTS, scoreFocus } from './scoreFocus';
import { RISK_GRADE_LABEL, scoreProjectRisk } from './scoreProjectRisk';
import type { Alarm, Project, Task } from './types';

/** 실측 기준 시각: 2026-07-27 15:30 KST. */
const NOW = '20260727153000';
const NOW_MS = parseFlowDate(NOW)!;

const pad = (n: number) => String(n).padStart(2, '0');

/** now 기준 상대 일자 → `YYYYMMDD` (KST 달력). */
function day(offset: number): string {
  const d = new Date(NOW_MS + KST_OFFSET_MS + offset * DAY_MS);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}
const at = (offset: number, hhmmss = '120000') => day(offset) + hhmmss;

const task = (t: Partial<Task> & { id: string }): Task => ({ title: `task ${t.id}`, ...t });

// ---------------------------------------------------------------------------
// date
// ---------------------------------------------------------------------------

describe('date (KST 고정 파싱)', () => {
  it('8자리는 그날 00:00 KST', () => {
    // 2026-07-27 00:00 +09:00 === 2026-07-26 15:00 UTC
    assert.equal(parseFlowDate('20260727'), Date.UTC(2026, 6, 26, 15, 0, 0));
  });

  it('14자리는 초 단위까지 KST', () => {
    assert.equal(parseFlowDate('20260727151600'), Date.UTC(2026, 6, 27, 6, 16, 0));
  });

  it('로컬 타임존과 무관하다 (Date.UTC 기반)', () => {
    // 이 단언이 TZ=UTC / TZ=Pacific/Kiritimati 어느 쪽에서도 같아야 한다.
    assert.equal(parseFlowDate('20260101')! % DAY_MS, (15 * 60 * 60 * 1000) % DAY_MS);
  });

  it('잘못된 입력은 null', () => {
    for (const bad of ['', '2026072', '202607271516', 'abc', '20260231', '20261301', null, undefined]) {
      assert.equal(parseFlowDate(bad as string), null, `expected null for ${String(bad)}`);
    }
  });

  it('날짜만 있는 마감은 그날 마지막 순간', () => {
    assert.equal(parseFlowDeadline('20260727'), parseFlowDate('20260727')! + DAY_MS - 1);
    assert.equal(parseFlowDeadline('20260727090000'), parseFlowDate('20260727090000'));
  });

  it('diffDays는 KST 달력 일수', () => {
    assert.equal(diffDays(parseFlowDate('20260727235959')!, parseFlowDate('20260728000000')!), 1);
    assert.equal(diffDays(parseFlowDate('20260727000000')!, parseFlowDate('20260727235959')!), 0);
  });

  it('toEpochMs는 number/Date/flow 문자열을 모두 받는다', () => {
    assert.equal(toEpochMs(NOW_MS), NOW_MS);
    assert.equal(toEpochMs(new Date(NOW_MS)), NOW_MS);
    assert.equal(toEpochMs(NOW), NOW_MS);
    assert.throws(() => toEpochMs('nope'));
  });

  it('kstYmd는 UTC가 아니라 KST 달력 날짜를 준다', () => {
    assert.equal(kstYmd(NOW_MS), '20260727');
    // UTC로는 아직 7/26 15:00이지만 KST로는 이미 7/27이다 — 오늘 일정 조회가 하루 밀리는 지점.
    assert.equal(kstYmd(parseFlowDate('20260727003000')!), '20260727');
    assert.equal(kstYmd(parseFlowDate('20260727235959')!), '20260727');
    assert.equal(kstYmd(parseFlowDate('20260101000000')!), '20260101');
  });
});

// ---------------------------------------------------------------------------
// classifyTasks
// ---------------------------------------------------------------------------

describe('classifyTasks', () => {
  it('빈 배열', () => {
    const r = classifyTasks([], NOW);
    assert.deepEqual(r.counts, { imminent: 0, overdueActive: 0, overdueStale: 0, normal: 0 });
    assert.deepEqual(r.imminent, []);
  });

  it('마감일 없으면 normal', () => {
    const r = classifyTasks([task({ id: 'a', lastActivityAt: at(-1) })], NOW);
    assert.equal(r.counts.normal, 1);
    assert.equal(r.normal[0].daysUntilDue, null);
    assert.equal(r.normal[0].deadlineMs, null);
  });

  it('오늘이 마감(날짜만)이면 지연이 아니라 임박', () => {
    const r = classifyTasks([task({ id: 'a', due: day(0) })], NOW);
    assert.equal(r.counts.imminent, 1);
    assert.equal(r.imminent[0].daysUntilDue, 0);
    assert.equal(r.imminent[0].overdueDays, 0);
  });

  it('오늘 마감이어도 시각이 지나 있으면 밀림', () => {
    const r = classifyTasks([task({ id: 'a', due: at(0, '090000'), lastActivityAt: at(-1) })], NOW);
    assert.equal(r.counts.overdueActive, 1);
    assert.equal(r.overdueActive[0].overdueDays, 0);
  });

  it('임박 경계: +7일 포함, +8일 제외', () => {
    const r = classifyTasks([task({ id: 'in', due: day(7) }), task({ id: 'out', due: day(8) })], NOW);
    assert.deepEqual(r.imminent.map((c) => c.task.id), ['in']);
    assert.deepEqual(r.normal.map((c) => c.task.id), ['out']);
  });

  it('30일 활동 경계: 30일 전=밀림, 31일 전=방치, 활동 없음=방치', () => {
    const r = classifyTasks(
      [
        task({ id: 'active30', due: day(-5), lastActivityAt: at(-30) }),
        task({ id: 'stale31', due: day(-5), lastActivityAt: at(-31) }),
        task({ id: 'noActivity', due: day(-5) }),
      ],
      NOW,
    );
    assert.deepEqual(r.overdueActive.map((c) => c.task.id), ['active30']);
    assert.deepEqual(r.overdueStale.map((c) => c.task.id).sort(), ['noActivity', 'stale31']);
  });

  it('진행률 100 / 완료 상태는 밀림에 들어가지 않는다', () => {
    const r = classifyTasks(
      [
        task({ id: 'p100', due: day(-10), progress: 100, lastActivityAt: at(-1) }),
        task({ id: 'statusDone', due: day(-10), status: ' 완료 ', lastActivityAt: at(-1) }),
        task({ id: 'closed', due: day(-10), status: 'Closed', lastActivityAt: at(-1) }),
      ],
      NOW,
    );
    assert.equal(r.counts.overdueActive, 0);
    assert.equal(r.counts.normal, 3);
    assert.ok(r.normal.every((c) => c.done));
  });

  it('done 플래그가 progress/status보다 우선', () => {
    assert.equal(isTaskDone(task({ id: 'x', progress: 100, done: false })), false);
    assert.equal(isTaskDone(task({ id: 'x', progress: 0, done: true })), true);
    const r = classifyTasks([task({ id: 'x', due: day(-3), progress: 100, done: false, lastActivityAt: at(-1) })], NOW);
    assert.equal(r.counts.overdueActive, 1);
  });

  it('임계값을 opts로 조정할 수 있다', () => {
    const tasks = [
      task({ id: 'due5', due: day(5) }),
      task({ id: 'old20', due: day(-2), lastActivityAt: at(-20) }),
    ];
    const r = classifyTasks(tasks, NOW, { imminentDays: 3, staleDays: 14 });
    assert.equal(r.counts.imminent, 0);
    assert.equal(r.counts.normal, 1);
    assert.equal(r.counts.overdueStale, 1);
  });

  it('밀림은 지연 일수 내림차순', () => {
    const r = classifyTasks(
      [
        task({ id: 'd3', due: day(-3), lastActivityAt: at(-1) }),
        task({ id: 'd24', due: day(-24), lastActivityAt: at(-1) }),
        task({ id: 'd10', due: day(-10), lastActivityAt: at(-1) }),
      ],
      NOW,
    );
    assert.deepEqual(r.overdueActive.map((c) => c.overdueDays), [24, 10, 3]);
  });
});

// ---------------------------------------------------------------------------
// groupMentions — 실측 28건
// ---------------------------------------------------------------------------

/** jongseok.lee@traport.com 계정 2026-07-27 기준 최근 14일 멘션 (PRD §2.1). */
const ALARMS_28: Alarm[] = [
  { from: 'djseo7', title: 'SRT/KTX 통합 일정 및 예약 정책 변경 사항 송부', at: '20260727151600', link: 'https://flow.team/l/QksNd' },
  { from: 'ymh0510', title: 'Q004 보안이슈로 인한 DB 분리', at: '20260727110044', link: 'https://flow.team/l/Qjm79' },
  { from: 'ymh0510', title: 'Q004 보안이슈로 인한 DB 분리', at: '20260727104653', link: 'https://flow.team/l/Qjm79' },
  { from: 'wb1762', title: '[출장계획서] 예약된 이동경로 외 수정 기능', at: '20260724101200', link: 'https://flow.team/l/QhbBI' },
  { from: 'ymh0510', title: 'Q004 보안이슈로 인한 DB 분리', at: '20260722202549', link: 'https://flow.team/l/Qjm79' },
  { from: 'hwchai', title: 'Q004 보안이슈로 인한 DB 분리', at: '20260722160113', link: 'https://flow.team/l/Qjm79' },
  { from: 'hwchai', title: 'Q004 보안이슈로 인한 DB 분리', at: '20260721173004', link: 'https://flow.team/l/Qjm79' },
  { from: 'nayeong', title: '[예약] 임원 구분 관련 API 추가', at: '20260721154004', link: 'https://flow.team/l/Q6PbF' },
  { from: 'ymh0510', title: 'Q018 앱 및 간편결제 지원', at: '20260721145121', link: 'https://flow.team/l/QjFHM' },
  { from: 'djseo7', title: '예약 후 돌아가기 링크', at: '20260721142931', link: 'https://flow.team/l/QjO9K' },
  { from: 'ymh0510', title: 'Q019 제휴숙소 팝업노출', at: '20260720182648', link: 'https://flow.team/l/Q9KEi' },
  { from: 'ymh0510', title: 'Q019 제휴숙소 팝업노출', at: '20260720180823', link: 'https://flow.team/l/Q9KEi' },
  { from: 'ymh0510', title: 'Q019 제휴숙소 팝업노출', at: '20260720174644', link: 'https://flow.team/l/Q9KEi' },
  { from: 'nayeong', title: '[예약] 항공- 도착지 자동 입력 안됨', at: '20260720143111', link: 'https://flow.team/l/QiTrK' },
  { from: 'djseo7', title: 'HD현대그룹 출장관리 오픈 위한 사내 웹 보안 솔루션 허용 요청 현황 공유', at: '20260716203847', link: 'https://flow.team/l/Q85RC' },
  { from: 'ymh0510', title: 'I001-보안이슈로 인한 DB 분리', at: '20260715100923', link: 'https://flow.team/l/Q8Hym' },
  { from: 'ymh0510', title: 'Q022 매핑코드', at: '20260714182406', link: 'https://flow.team/l/QkQ3J' },
  { from: 'ymh0510', title: 'I001-보안이슈로 인한 DB 분리', at: '20260714154234', link: 'https://flow.team/l/Q8Hym' },
  { from: 'woojin8321', title: '[HD현대그룹] 규정 초과 상품 결제로 인한 고객사 안내 필요 건', at: '20260714151116', link: 'https://flow.team/l/Q9GqN' },
  { from: 'ymh0510', title: 'I001-보안이슈로 인한 DB 분리', at: '20260714134924', link: 'https://flow.team/l/Q8Hym' },
  { from: 'ymh0510', title: '[공용복지몰] 출장예약플랫폼 ', at: '20260714094847', link: 'https://flow.team/l/QieNy' },
  { from: 'ymh0510', title: 'Q022 매핑코드', at: '20260714094207', link: 'https://flow.team/l/QkQ3J' },
  { from: 'ymh0510', title: '[공용복지몰] 출장예약플랫폼 ', at: '20260714085102', link: 'https://flow.team/l/QieNy' },
  { from: 'bbbamy', title: '[공용복지몰] 출장예약플랫폼 ', at: '20260714084453', link: 'https://flow.team/l/QieNy' },
  { from: 'nayeong', title: '[예약] 검색 결과 기본 정렬', at: '20260713180319', link: 'https://flow.team/l/QYyug' },
  { from: 'ymh0510', title: '[공용복지몰] 출장예약플랫폼 ', at: '20260713152951', link: 'https://flow.team/l/QieNy' },
  { from: 'ymh0510', title: 'Q018 앱 및 간편결제 지원', at: '20260713142034', link: 'https://flow.team/l/QjFHM' },
  { from: 'ymh0510', title: '[공용복지몰] 출장예약플랫폼 ', at: '20260713134433', link: 'https://flow.team/l/QieNy' },
];

describe('groupMentions', () => {
  it('빈 배열', () => {
    assert.deepEqual(groupMentions([]), []);
  });

  it('★ 실측 28건 → 14행 (PRD G2 / §2.2 발견 2)', () => {
    assert.equal(ALARMS_28.length, 28);
    const groups = groupMentions(ALARMS_28);
    assert.equal(groups.length, 14, '고유 태스크 14개여야 한다');
    assert.equal(
      groups.reduce((sum, g) => sum + g.count, 0),
      28,
      '알림은 하나도 유실되지 않아야 한다',
    );
  });

  it('★ 태스크별 멘션 수가 PRD §2.2 표와 일치', () => {
    const byTitle = Object.fromEntries(groupMentions(ALARMS_28).map((g) => [g.title, g.count]));
    assert.equal(byTitle['Q004 보안이슈로 인한 DB 분리'], 5);
    assert.equal(byTitle['[공용복지몰] 출장예약플랫폼'], 5); // 뒤쪽 공백은 표시에서 trim
    assert.equal(byTitle['I001-보안이슈로 인한 DB 분리'], 3);
    assert.equal(byTitle['Q019 제휴숙소 팝업노출'], 3);
    assert.equal(byTitle['Q018 앱 및 간편결제 지원'], 2);
    assert.equal(byTitle['Q022 매핑코드'], 2);
    const ones = groupMentions(ALARMS_28).filter((g) => g.count === 1);
    assert.equal(ones.length, 8, '나머지 8개는 각 1건');
  });

  it('마지막 알림 시각 내림차순 + 마지막 발언자', () => {
    const groups = groupMentions(ALARMS_28);
    const times = groups.map((g) => g.lastAt);
    assert.deepEqual([...times].sort().reverse(), times);
    assert.equal(groups[0].title, 'SRT/KTX 통합 일정 및 예약 정책 변경 사항 송부');
    const q004 = groups[1];
    assert.equal(q004.title, 'Q004 보안이슈로 인한 DB 분리');
    assert.equal(q004.lastFrom, 'ymh0510');
    assert.equal(q004.lastAt, '20260727110044');
    assert.deepEqual(q004.alarms.map((a) => a.at), [
      '20260727110044',
      '20260727104653',
      '20260722202549',
      '20260722160113',
      '20260721173004',
    ]);
  });

  it('제목이 아니라 link로 묶는다 (뒤쪽 공백 함정)', () => {
    const welfare = groupMentions(ALARMS_28).find((g) => g.taskId === 'https://flow.team/l/QieNy')!;
    assert.equal(welfare.count, 5);
    assert.equal(welfare.title, '[공용복지몰] 출장예약플랫폼');
    // 같은 link · 다른 제목 표기여도 한 행
    const split = groupMentions([
      { from: 'a', title: '제목 ', at: '20260101000000', link: 'L1' },
      { from: 'b', title: '제목', at: '20260102000000', link: 'L1' },
    ]);
    assert.equal(split.length, 1);
    assert.equal(split[0].lastFrom, 'b');
  });

  it('taskId가 있으면 link보다 우선', () => {
    const groups = groupMentions([
      { from: 'a', title: 'T', at: '20260101000000', link: 'L1', taskId: 'T1' },
      { from: 'b', title: 'T', at: '20260102000000', link: 'L2', taskId: 'T1' },
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].taskId, 'T1');
  });

  it('시각 파싱 실패해도 건수는 유지되고 맨 뒤로 간다', () => {
    const groups = groupMentions([
      { from: 'a', title: 'bad', at: '', link: 'L1' },
      { from: 'b', title: 'ok', at: '20260101000000', link: 'L2' },
    ]);
    assert.deepEqual(groups.map((g) => g.title), ['ok', 'bad']);
    assert.equal(groups[1].lastAtMs, null);
  });
});

// ---------------------------------------------------------------------------
// scoreFocus
// ---------------------------------------------------------------------------

describe('scoreFocus', () => {
  it('빈 배열', () => {
    assert.deepEqual(scoreFocus([], {}, NOW), []);
  });

  it('완료·방치 업무는 후보에서 빠진다', () => {
    const tasks = [
      task({ id: 'done', due: day(-1), progress: 100, lastActivityAt: at(0) }),
      task({ id: 'stale', due: day(-40), lastActivityAt: at(-40) }),
      task({ id: 'live', due: day(1), lastActivityAt: at(0) }),
    ];
    assert.deepEqual(scoreFocus(tasks, {}, NOW).map((f) => f.task.id), ['live']);
  });

  it('상위 N개만, 점수 내림차순', () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      task({ id: `t${i}`, due: day(i), lastActivityAt: at(0) }),
    );
    const top = scoreFocus(tasks, {}, NOW);
    assert.equal(top.length, 5);
    assert.deepEqual(top.map((f) => f.task.id), ['t0', 't1', 't2', 't3', 't4']);
    for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].score >= top[i].score);
    assert.equal(scoreFocus(tasks, {}, NOW, { limit: 2 }).length, 2);
  });

  it('네 신호가 모두 점수에 반영된다', () => {
    const t = task({
      id: 'hot',
      due: at(0, '090000'),
      lastActivityAt: at(0),
      priority: 'urgent',
      progress: 90,
    });
    const [item] = scoreFocus([t], { hot: 5 }, NOW);
    assert.equal(item.breakdown.heat, FOCUS_WEIGHTS.heat);
    assert.equal(item.breakdown.priority, FOCUS_WEIGHTS.priority);
    assert.ok(item.breakdown.deadline > 0 && item.breakdown.progress > 0);
    assert.ok(item.score > 80 && item.score <= 100, `score=${item.score}`);
  });

  it('추천 이유가 사람이 읽을 수 있게 나온다', () => {
    const [overdue] = scoreFocus(
      [task({ id: 'a', due: day(-3), lastActivityAt: at(-1), priority: 'high', progress: 80 })],
      { a: 2 },
      NOW,
    );
    assert.deepEqual(overdue.reasons, [
      '마감 3일 지남',
      '최근 멘션/댓글 2건',
      '우선순위 높음',
      '진행률 80% — 마무리 단계',
    ]);
    const [today] = scoreFocus([task({ id: 'b', due: day(0) })], {}, NOW);
    assert.deepEqual(today.reasons, ['오늘 마감']);
    const [none] = scoreFocus([task({ id: 'c' })], {}, NOW);
    assert.deepEqual(none.reasons, ['진행 중']);
  });

  it('멘션은 HEAT_CAP에서 포화 — 한 태스크가 목록을 독점하지 않는다', () => {
    const t = task({ id: 'x' });
    const [five] = scoreFocus([t], { x: 5 }, NOW);
    const [fifty] = scoreFocus([t], { x: 50 }, NOW);
    assert.equal(five.score, fifty.score);
  });

  it('signals는 Map으로도 받는다', () => {
    const [item] = scoreFocus([task({ id: 'x' })], new Map([['x', 3]]), NOW);
    assert.ok(item.breakdown.heat > 0);
  });

  it('마감 지난 업무가 먼 미래 업무보다 위', () => {
    const ranked = scoreFocus(
      [
        task({ id: 'later', due: day(30), priority: 'urgent', progress: 90 }),
        task({ id: 'slipping', due: day(-2), lastActivityAt: at(-1) }),
      ],
      {},
      NOW,
    );
    assert.equal(ranked[0].task.id, 'slipping');
  });
});

// ---------------------------------------------------------------------------
// scoreProjectRisk — 실측 59개 프로젝트 분포
// ---------------------------------------------------------------------------

const HOT_PROJECT = '[비즈플레이]B2603-삼성전기-출장예약 구축';

/**
 * PRD §2.2 발견 1 재현: 참여 프로젝트 59개, 밀림 11건이 전부 한 프로젝트에 몰려 있고
 * 나머지 58개는 0건. 임박 3건은 hot 2 + 다른 프로젝트 1로 흩어 둔다.
 */
function fixture59(): Project[] {
  const hot: Project = {
    id: 'P-HOT',
    name: HOT_PROJECT,
    tasks: [
      // 밀림 11건 — 최장 지연 24일
      ...Array.from({ length: 11 }, (_, i) =>
        task({
          id: `hot-over-${i}`,
          due: day(-(24 - i * 2)),
          lastActivityAt: at(-(i % 5)),
          projectId: 'P-HOT',
        }),
      ),
      // 임박 2건
      task({ id: 'hot-soon-1', due: day(2), lastActivityAt: at(-1) }),
      task({ id: 'hot-soon-2', due: day(6), lastActivityAt: at(-2) }),
      // 방치 1건 — 점수에는 안 들어간다
      task({ id: 'hot-stale-1', due: day(-90), lastActivityAt: at(-80) }),
    ],
  };

  const rest: Project[] = Array.from({ length: 58 }, (_, i) => ({
    id: `P-${i}`,
    name: `프로젝트 ${String(i).padStart(2, '0')}`,
    tasks: [
      task({ id: `p${i}-a`, due: day(20 + i), lastActivityAt: at(-(i % 12)) }),
      task({ id: `p${i}-b`, progress: 100, due: day(-3), lastActivityAt: at(-1) }),
      // 딱 한 프로젝트만 임박 1건 (실측 임박 3건 = hot 2 + 여기 1)
      ...(i === 0 ? [task({ id: `p${i}-soon`, due: day(4), lastActivityAt: at(-1) })] : []),
      // 방치 2건은 다른 프로젝트에 흩어 둔다 (실측 방치 3건)
      ...(i === 1 || i === 2 ? [task({ id: `p${i}-zombie`, due: day(-120), lastActivityAt: at(-100) })] : []),
    ],
  }));

  return [hot, ...rest];
}

describe('scoreProjectRisk', () => {
  it('빈 배열 / 업무 없는 프로젝트', () => {
    assert.deepEqual(scoreProjectRisk([], NOW), []);
    const [empty] = scoreProjectRisk([{ id: 'e', name: 'empty', tasks: [] }], NOW);
    assert.equal(empty.score, 0);
    assert.equal(empty.grade, 'normal');
  });

  it('★ 실측 분포에서 [비즈플레이]B2603이 1위 · 위험 등급 (PRD §2.2 발견 1)', () => {
    const ranked = scoreProjectRisk(fixture59(), NOW);
    assert.equal(ranked.length, 59);

    const top = ranked[0];
    assert.equal(top.project.name, HOT_PROJECT);
    assert.equal(top.grade, 'danger');
    assert.equal(RISK_GRADE_LABEL[top.grade], '위험');
    assert.equal(top.overdueActive, 11);
    assert.equal(top.imminent, 2);
    assert.equal(top.maxDelayDays, 24);
    assert.equal(top.overdueStale, 1);

    // 2위와 압도적 격차 — 59개 나열 대신 순위가 의미를 갖는다
    assert.ok(top.score > ranked[1].score * 5, `${top.score} vs ${ranked[1].score}`);

    // 전체 밀림 11건이 전부 1위 프로젝트에 있다
    assert.equal(ranked.reduce((s, r) => s + r.overdueActive, 0), 11);
    assert.ok(ranked.slice(1).every((r) => r.overdueActive === 0));

    // G3: 실제 밀림 업무를 가진 프로젝트가 상위 5개에 100% 포함
    const withOverdue = ranked.filter((r) => r.overdueActive > 0).map((r) => r.project.id);
    const top5 = ranked.slice(0, 5).map((r) => r.project.id);
    assert.ok(withOverdue.every((id) => top5.includes(id)));
  });

  it('위험/주의 외에는 정상으로 접힌다', () => {
    const ranked = scoreProjectRisk(fixture59(), NOW);
    assert.equal(ranked.filter((r) => r.grade === 'danger').length, 1);
    assert.ok(ranked.filter((r) => r.grade === 'normal').length >= 57);
  });

  it('방치만 있는 프로젝트는 점수를 올리지 않는다', () => {
    const [zombie] = scoreProjectRisk(
      [{ id: 'z', name: 'zombie', tasks: [task({ id: 'z1', due: day(-200), lastActivityAt: at(-150) })] }],
      NOW,
    );
    assert.equal(zombie.overdueStale, 1);
    assert.equal(zombie.score, 0);
    assert.equal(zombie.grade, 'normal');
  });

  it('밀림 1건이면 주의, 여러 건이면 위험', () => {
    const mk = (n: number): Project => ({
      id: `p${n}`,
      name: `p${n}`,
      tasks: Array.from({ length: n }, (_, i) =>
        task({ id: `t${i}`, due: day(-5), lastActivityAt: at(-1) }),
      ),
    });
    assert.equal(scoreProjectRisk([mk(1)], NOW)[0].grade, 'warning');
    assert.equal(scoreProjectRisk([mk(3)], NOW)[0].grade, 'danger');
  });

  it('밀림 건수가 임박 건수보다 무겁다', () => {
    const overdue: Project = {
      id: 'o',
      name: 'o',
      tasks: [task({ id: 'o1', due: day(-1), lastActivityAt: at(-1) })],
    };
    const imminent: Project = {
      id: 'i',
      name: 'i',
      tasks: Array.from({ length: 3 }, (_, i) => task({ id: `i${i}`, due: day(1), lastActivityAt: at(-1) })),
    };
    const ranked = scoreProjectRisk([imminent, overdue], NOW);
    assert.equal(ranked[0].project.id, 'o');
  });
});

describe('rollupProjects', () => {
  // 2026-07-27 실측 축약: 플랫폼개발팀 8명 중 이종석에게만 업무가 잡힌다.
  const 이종석: StandupMember = {
    name: '이종석',
    role: '',
    imminent: [
      task(45446268, '고속버스 복합결제', 'HD한국조선해양', '20260729', 2),
      task(44862637, 'To-Be 프로세스 정의서', '삼성전기', '20260731', 4),
      task(45114041, '업무설계 프레임워크', '삼성전기', '20260731', 4),
    ],
    blocked: [
      task(44018963, 'I001-DB 분리', '삼성전기', '20260703', -24),
      task(44148389, 'Q002 제휴숙소', '삼성전기', '20260703', -24),
      task(44825367, 'Q022 매핑코드', '삼성전기', '20260716', -11),
    ],
    staleCount: 3,
  };
  const 이선우: StandupMember = { name: '이선우', role: '', imminent: [], blocked: [], staleCount: 0 };

  function task(
    taskSrno: number,
    title: string,
    project: string,
    endDate: string,
    daysLeft: number,
  ): StandupTask {
    return { taskSrno, title, status: '진행', project, endDate, daysLeft, link: 'https://flow.team/l/x' };
  }

  it('업무 없는 부서는 빈 배열', () => {
    assert.deepEqual(rollupProjects([이선우]), []);
    assert.deepEqual(rollupProjects([]), []);
  });

  it('★ 밀림이 몰린 프로젝트가 1위 · 위험 등급 (PRD §2.2 발견 1)', () => {
    const ranked = rollupProjects([이종석, 이선우]);
    assert.equal(ranked.length, 2);

    const [top, second] = ranked;
    assert.equal(top.name, '삼성전기');
    assert.equal(top.grade, 'danger');
    assert.equal(RISK_GRADE_LABEL[top.grade], '위험');
    assert.equal(top.blocked, 3);
    assert.equal(top.imminent, 2);
    assert.equal(top.maxDelayDays, 24);

    // 임박만 1건인 프로젝트는 순위가 훨씬 아래여야 순위표가 의미를 갖는다
    assert.equal(second.name, 'HD한국조선해양');
    assert.equal(second.blocked, 0);
    assert.ok(top.score > second.score * 5, `${top.score} vs ${second.score}`);
  });

  it('담당자를 모으고, 지연 큰 순으로 정렬한다', () => {
    const 둘째 = { ...이선우, name: '박예은', blocked: [task(1, 'X', '삼성전기', '20260601', -56)] };
    const [top] = rollupProjects([이종석, 둘째]);

    assert.deepEqual(top.owners, ['박예은', '이종석']);
    assert.equal(top.maxDelayDays, 56);
    assert.equal(top.tasks[0].title, 'X'); // 가장 많이 밀린 것부터
    assert.equal(top.tasks.at(-1)?.daysLeft, 4); // 임박이 맨 뒤
    assert.equal(top.tasks[0].owner, '박예은');
  });

  it('프로젝트 이름을 ID로 해소한다. 못 찾으면 null (쓰기 액션 차단용)', () => {
    const ranked = rollupProjects([이종석], new Map([['삼성전기', '2916576']]));
    assert.equal(ranked.find((r) => r.name === '삼성전기')?.projectId, '2916576');
    assert.equal(ranked.find((r) => r.name === 'HD한국조선해양')?.projectId, null);
  });
});
