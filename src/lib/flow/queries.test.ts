import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { collectTasks } from './queries';

/**
 * 프로젝트 훑기(`collectTasks`)의 일 나누기만 본다. 이 자리가 화면 대기 시간의 대부분이라
 * (실측 63회·4.5초) 순서와 동시성이 어긋나면 바로 눈에 띈다.
 */
describe('프로젝트 훑기', () => {
  /**
   * `/user/projects` 하나와 프로젝트별 업무 조회에 답한다. `delay`는 프로젝트 이름 → 지연(ms).
   * 동시에 몇 개가 떠 있었는지도 같이 재 둔다.
   */
  const stub = (names: string[], delay: Record<string, number> = {}) => {
    process.env.FLOW_API_KEY = 'test-key';
    const seen = { peak: 0, live: 0 };
    const ids = new Map(names.map((name, i) => [String(1000 + i), name]));

    globalThis.fetch = (async (url: string) => {
      if (url.includes('/user/projects')) {
        return {
          ok: true,
          json: async () => ({
            response: {
              success: true,
              data: { projects: [...ids].map(([projectId, title]) => ({ projectId, title })) },
            },
          }),
        };
      }

      const projectId = url.match(/\/projects\/(\d+)\//)?.[1] ?? '';
      const name = ids.get(projectId) ?? '';
      seen.peak = Math.max(seen.peak, ++seen.live);
      await new Promise((r) => setTimeout(r, delay[name] ?? 0));
      seen.live--;

      if (name.startsWith('막힌')) return { ok: false, json: async () => ({}) };
      return {
        ok: true,
        json: async () => ({
          response: {
            success: true,
            data: { tasks: [{ taskId: name, title: name }], hasNext: false, lastCursor: -1 },
          },
        }),
      };
    }) as unknown as typeof fetch;

    return seen;
  };

  it('먼저 부른 프로젝트가 늦게 와도 그 자리를 지킨다', async () => {
    // 맨 앞이 제일 느리다. 도착 순으로 담으면 맨 뒤로 밀린다 — 마감일이 같은 업무들의
    // 순서가 새로 고칠 때마다 바뀌는 게 그 증상이다.
    stub(['가', '나', '다'], { 가: 40 });
    const { rows } = await collectTasks(['jongseok.lee@traport.com']);
    assert.deepEqual(
      rows.map((r) => r.name),
      ['가', '나', '다'],
    );
  });

  it('한 프로젝트가 막혀도 나머지는 오고, 막힌 이름이 남는다', async () => {
    stub(['가', '막힌나', '다']);
    const { rows, failed } = await collectTasks(['jongseok.lee@traport.com']);
    assert.deepEqual(
      rows.map((r) => r.name),
      ['가', '다'],
    );
    assert.deepEqual(failed, ['막힌나']);
  });

  it('열 개까지만 동시에 돈다 — 분당 120회 상한을 이 숫자로 지킨다', async () => {
    const names = Array.from({ length: 25 }, (_, i) => `p${i}`);
    const seen = stub(
      names,
      Object.fromEntries(names.map((n) => [n, 5])),
    );
    await collectTasks(['jongseok.lee@traport.com']);
    assert.equal(seen.peak, 10);
  });
});
