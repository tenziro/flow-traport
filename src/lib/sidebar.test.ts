import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toSidebarOpen } from './sidebar';

describe('사이드바 접힘 쿠키 읽기', () => {
  it('접힘은 "0" 하나뿐이다', () => {
    assert.equal(toSidebarOpen('0'), false);
  });

  /**
   * 쿠키는 브라우저에서 쓰는 값이라 아무 문자열이나 올 수 있다. 모르는 값이 접힘으로
   * 떨어지면 처음 온 사람이 아이콘만 있는 68px 레일을 만난다 — 펼침이 안전한 쪽이다.
   */
  it('없거나 모르는 값은 펼침이다', () => {
    assert.equal(toSidebarOpen(undefined), true);
    assert.equal(toSidebarOpen(''), true);
    assert.equal(toSidebarOpen('1'), true);
    assert.equal(toSidebarOpen('false'), true);
  });
});
