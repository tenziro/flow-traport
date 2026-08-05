import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { tail } from './thread';

/** `id`로 어느 줄이 남았는지 본다. `r` = 답글, `c` = 나를 부른 줄. */
const rows = (spec: string[]) =>
  spec.map((s) => ({
    id: s.replace(/[rc]/g, ''),
    ...(s.includes('r') && { reply: true }),
    ...(s.includes('c') && { called: true }),
  }));

const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe('접었을 때 남길 댓글 (tail)', () => {
  it('최상위가 둘 이하면 다 남는다', () => {
    assert.deepEqual(ids(tail(rows(['1', '2']))), ['1', '2']);
    assert.deepEqual(ids(tail(rows(['1']))), ['1']);
    assert.deepEqual(ids(tail(rows([]))), []);
  });

  it('최상위 마지막 둘부터 남는다', () => {
    assert.deepEqual(ids(tail(rows(['1', '2', '3', '4']))), ['3', '4']);
  });

  /** 답글은 수에 안 세고 부모를 따라간다 — 부모 없는 `↳` 줄이 첫 줄로 서면 안 된다. */
  it('답글은 부모와 같이 남는다', () => {
    assert.deepEqual(ids(tail(rows(['1', '2', '2r', '2r', '3']))), ['2', '2', '2', '3']);
  });

  /** 멘션 모달이 이 목록을 여는 이유가 "내가 왜 불렸나"다. 그 줄이 접히면 답이 없다. */
  it('나를 부른 줄이 옛것이면 거기까지 편다', () => {
    assert.deepEqual(ids(tail(rows(['1', '2c', '3', '4', '5']))), ['2', '3', '4', '5']);
  });

  it('부른 줄이 답글이면 그 부모부터 편다', () => {
    assert.deepEqual(ids(tail(rows(['1', '2', '2rc', '3', '4', '5']))), ['2', '2', '3', '4', '5']);
  });

  /** 부른 줄이 이미 접힌 자리 안쪽이면 자르는 자리를 뒤로 밀지 않는다. */
  it('부른 줄이 최근이면 평소대로 둘만 남는다', () => {
    assert.deepEqual(ids(tail(rows(['1', '2', '3', '4c']))), ['3', '4']);
  });
});
