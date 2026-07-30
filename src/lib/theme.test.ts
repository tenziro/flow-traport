import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toTheme } from './theme';

describe('화면 밝기 쿠키 읽기', () => {
  it('아는 값 두 개만 그대로 쓴다', () => {
    assert.equal(toTheme('light'), 'light');
    assert.equal(toTheme('dark'), 'dark');
  });

  it('없거나 모르는 값은 기기 설정이다', () => {
    assert.equal(toTheme(undefined), 'system');
    assert.equal(toTheme(''), 'system');
    assert.equal(toTheme('system'), 'system');
  });

  /**
   * 이 값은 `<html class>`로 들어간다. 쿠키는 브라우저에서 쓰는 것이라 아무 문자열이나
   * 올 수 있으니, 아는 두 개 말고는 무엇이든 `system`으로 떨어져야 한다.
   */
  it('클래스 자리를 노린 값도 기기 설정이다', () => {
    assert.equal(toTheme('dark bg-red-500'), 'system');
    assert.equal(toTheme('" onload="x'), 'system');
  });
});
