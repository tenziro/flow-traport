import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { CHANGELOG } from './changelog';

const pkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string };

describe('업데이트 로그', () => {
  /**
   * 푸터가 `CHANGELOG[0].version`을 현재 버전으로 표시한다. package.json과 어긋나면
   * 화면이 거짓말을 한다 — 사람이 기억해서 맞출 일이 아니라 여기서 막는다.
   */
  it('맨 앞이 package.json 버전이다', () => {
    assert.equal(CHANGELOG[0].version, pkg.version);
  });

  /** 버전이 아코디언 행의 `id`가 된다. 겹치면 두 행이 같이 펼쳐진다. */
  it('버전이 겹치지 않는다', () => {
    const versions = CHANGELOG.map((r) => r.version);
    assert.equal(new Set(versions).size, versions.length);
  });

  it('최신순이다', () => {
    const rank = (v: string) => v.split('.').map(Number);
    for (let i = 1; i < CHANGELOG.length; i += 1) {
      const a = rank(CHANGELOG[i - 1].version);
      const b = rank(CHANGELOG[i].version);
      assert.ok(
        a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))),
        `${CHANGELOG[i - 1].version}이 ${CHANGELOG[i].version}보다 앞에 있다`,
      );
    }
  });

  /** 행 제목은 `truncate`다. 길면 소리 없이 잘린다. */
  it('제목이 20자를 넘지 않는다', () => {
    for (const r of CHANGELOG) {
      assert.ok(r.title.length <= 20, `v${r.version}: ${r.title}`);
    }
  });
});
