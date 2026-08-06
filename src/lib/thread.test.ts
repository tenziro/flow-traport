import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { splitPicked, tail, toMentions, withCall } from './thread';

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

describe('보낼 때 이름을 마크업으로 (toMentions)', () => {
  const 종석 = { name: '이종석', userId: 'jongseok.lee@traport.com' };
  const 명호 = { name: '여명호', userId: 'ymh0510' };

  it('고른 사람만 바꾼다', () => {
    assert.equal(
      toMentions('이종석 아무개 확인 부탁드려요', [종석]),
      '@[이종석](jongseok.lee@traport.com) 아무개 확인 부탁드려요',
    );
  });

  it('아무도 안 골랐으면 그대로 둔다', () => {
    assert.equal(toMentions('이종석 확인이요', []), '이종석 확인이요');
  });

  it('여럿을 한 줄에서 다 바꾼다', () => {
    assert.equal(
      toMentions('이종석 여명호', [종석, 명호]),
      '@[이종석](jongseok.lee@traport.com) @[여명호](ymh0510)',
    );
  });

  /** 짧은 이름이 먼저 걸리면 `김민수`가 `@[김민](a)수`로 잘린다. */
  it('긴 이름부터 바꿔서 짧은 이름이 안 먹는다', () => {
    const 민 = { name: '김민', userId: 'a' };
    const 민수 = { name: '김민수', userId: 'b' };
    assert.equal(toMentions('김민수 김민', [민, 민수]), '@[김민수](b) @[김민](a)');
  });

  it('줄바꿈은 그대로 둔다', () => {
    assert.equal(
      toMentions('이종석\n배포 부탁드려요', [종석]),
      '@[이종석](jongseok.lee@traport.com)\n배포 부탁드려요',
    );
  });
});

describe('입력칸의 강조 조각 (splitPicked)', () => {
  const 종석 = { name: '이종석', userId: 'jongseok.lee@traport.com' };

  it('이름만 조각으로 떼고 나머지는 붙여 둔다', () => {
    assert.deepEqual(splitPicked('이종석 확인 부탁', [종석]), [
      { text: '이종석', person: 종석 },
      { text: ' 확인 부탁' },
    ]);
  });

  it('고른 사람이 없으면 통째로 한 조각이다', () => {
    assert.deepEqual(splitPicked('이종석 확인', []), [{ text: '이종석 확인' }]);
  });

  it('빈 글은 조각이 없다', () => {
    assert.deepEqual(splitPicked('', [종석]), []);
  });
});

describe('답글은 상대를 앞에서 부른다 (withCall)', () => {
  const 명호 = ['여명호', 'ymh0510'] as const;

  it('안 부른 글이면 앞에 붙인다', () => {
    assert.equal(withCall('배포 부탁드려요', ...명호), '@[여명호](ymh0510) 배포 부탁드려요');
  });

  /** 자동완성으로 답할 상대를 직접 고르면 본문에 이미 있다 — 또 붙이면 두 번 불린다. */
  it('이미 부른 글이면 안 붙인다', () => {
    const 이미 = '@[여명호](ymh0510) 배포 부탁드려요';
    assert.equal(withCall(이미, ...명호), 이미);
  });

  it('답글이 아니면 그대로 둔다', () => {
    assert.equal(withCall('그냥 댓글', '', ''), '그냥 댓글');
  });

  /** 타사 계정처럼 id를 모르면 평문이다 — 알림은 안 가도 누구에게 한 말인지는 남는다. */
  it('id가 없으면 `@이름` 평문으로 부른다', () => {
    assert.equal(withCall('확인 부탁', '여명호', ''), '@여명호 확인 부탁');
  });
});
