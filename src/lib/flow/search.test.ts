import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FlowMcp } from './mcp';
import { searchKeywords, searchProjectIds, splitHighlight, stripHighlight } from './search';

/** 2026-07-28 실측. 스탠드업이 주는 이름과 검색이 주는 제목이 이 한 쌍이다. */
const NAME = '[비즈플레이]B2603-삼성전기-출장예약 구축';
const HIT = { data: { projectId: '2916576', title: '[!#!비즈플레이!#!]!#!B2603!#!-!#!삼성전기!#!-!#!출장예약!#! !#!구축!#!' } };
const OTHER = { data: { projectId: '2705835', title: '!#!삼성전기!#! 사업추진 관리' } };

const fakeMcp = (results: unknown[]): FlowMcp =>
  ({ call: async () => ({ results }) }) as unknown as FlowMcp;

describe('프로젝트 이름으로 ID 찾기', () => {
  it('하이라이트 마커를 걷어내면 스탠드업의 이름과 정확히 같아진다', () => {
    assert.equal(stripHighlight(HIT.data.title), NAME);
  });

  it('기호를 털고 두 글자 이상만 키워드로 쓴다', () => {
    assert.deepEqual(searchKeywords(NAME), ['비즈플레이', 'B2603', '삼성전기', '출장예약', '구축']);
  });

  it('키워드가 안 나오는 이름은 검색하지 않는다', async () => {
    assert.deepEqual(searchKeywords('A-B'), []);
    assert.equal((await searchProjectIds(fakeMcp([HIT]), ['A-B'])).size, 0);
  });

  it('제목이 정확히 같은 결과만 채택한다', async () => {
    const found = await searchProjectIds(fakeMcp([HIT, OTHER]), [NAME]);
    assert.equal(found.get(NAME), '2916576');
  });

  // ★ 안전 장치. 비슷한 이름만 걸리면 ID를 만들어내지 않는다 —
  //   엉뚱한 프로젝트에 업무를 만드느니 쓰기 버튼이 안 보이는 게 낫다.
  it('비슷하기만 한 결과는 버린다', async () => {
    const found = await searchProjectIds(fakeMcp([OTHER]), [NAME]);
    assert.equal(found.size, 0);
  });

  it('검색이 실패해도 던지지 않는다', async () => {
    const dead = { call: async () => { throw new Error('flow 죽음'); } } as unknown as FlowMcp;
    assert.equal((await searchProjectIds(dead, [NAME])).size, 0);
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
