import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { nextTheme, toTheme } from './theme';

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

describe('밝기 순환', () => {
  it('밝게 → 어둡게 → 기기 설정', () => {
    assert.equal(nextTheme('light'), 'dark');
    assert.equal(nextTheme('dark'), 'system');
    assert.equal(nextTheme('system'), 'light');
  });

  /**
   * 헤더 레일의 밝기 버튼은 이 함수 하나로 세 갈래를 다 돈다. 어느 한 갈래가 자기
   * 자신이나 이미 지난 갈래로 가면 버튼이 두 갈래만 왕복하고 나머지 하나는 못 고른다.
   */
  it('세 번 돌면 제자리다', () => {
    assert.equal(nextTheme(nextTheme(nextTheme('light'))), 'light');
    assert.equal(nextTheme(nextTheme(nextTheme('dark'))), 'dark');
    assert.equal(nextTheme(nextTheme(nextTheme('system'))), 'system');
  });
});
