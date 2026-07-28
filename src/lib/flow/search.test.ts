import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FlowMcp } from './mcp';
import { searchKeywords, searchProjectIds, stripHighlight } from './search';

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
