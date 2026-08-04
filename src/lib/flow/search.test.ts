import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { splitHighlight, stripHighlight } from './search';

/** 2026-07-28 실측. 프로젝트 이름과 검색이 주는 제목이 이 한 쌍이다. */
const NAME = '[비즈플레이]B2603-삼성전기-출장예약 구축';
const TITLE = '[!#!비즈플레이!#!]!#!B2603!#!-!#!삼성전기!#!-!#!출장예약!#! !#!구축!#!';

describe('하이라이트 걷어내기', () => {
  it('마커를 걷어내면 원래 이름과 정확히 같아진다', () => {
    assert.equal(stripHighlight(TITLE), NAME);
  });
});

describe('하이라이트 쪼개기 (검색 팔레트)', () => {
  it('홀수 번째 조각이 맞은 구간이다', () => {
    assert.deepEqual(splitHighlight('[bzp!#!출장!#!] 금융채널'), [
      { text: '[bzp', hit: false },
      { text: '출장', hit: true },
      { text: '] 금융채널', hit: false },
    ]);
  });

  it('맨 앞이 맞아도 빈 조각을 만들지 않는다', () => {
    assert.deepEqual(splitHighlight('!#!출장!#! 예약'), [
      { text: '출장', hit: true },
      { text: ' 예약', hit: false },
    ]);
  });

  // ★ 강조가 하나도 없는 응답이 흔하다 (본문 발췌가 잘려서 마커가 안 들어오는 경우).
  //   그때도 글자는 그대로 나와야 한다.
  it('마커가 없으면 통째로 한 조각이다', () => {
    assert.deepEqual(splitHighlight('예약 화면 QA'), [{ text: '예약 화면 QA', hit: false }]);
    assert.deepEqual(splitHighlight(''), []);
  });

  it('쪼갠 글자를 다시 이으면 마커만 지운 것과 같다', () => {
    const raw = '[!#!비즈플레이!#!]!#!B2603!#!-!#!삼성전기!#!';
    assert.equal(
      splitHighlight(raw).map((p) => p.text).join(''),
      stripHighlight(raw),
    );
  });
});
