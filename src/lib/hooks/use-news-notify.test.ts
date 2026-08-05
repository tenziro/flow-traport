import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TaskNews } from '../flow/queries';
import { newsAlert } from './use-news-notify';

/** 소식 한 줄. 알림에 안 쓰는 필드는 빈 문자열로 둔다. */
const news = (id: string, over: Partial<TaskNews> = {}): TaskNews => ({
  id,
  projectId: 'p1',
  postId: `post-${id}`,
  from: '이종석',
  at: '20260805120000',
  message: '확인 부탁드려요',
  unread: true,
  url: '',
  project: '비즈플레이',
  title: '결제 연동 점검',
  ...over,
});

describe('소식 알림 한 장 만들기', () => {
  it('없으면 안 띄운다 — 폴링이 새 소식 없이 돌아온 게 보통이다', () => {
    assert.equal(newsAlert([]), null);
  });

  it('한 건이면 업무명이 제목, 보낸 사람과 내용이 본문이다', () => {
    assert.deepEqual(newsAlert([news('a')]), {
      title: '결제 연동 점검',
      body: '이종석 · 확인 부탁드려요',
      tag: 'a',
    });
  });

  it('여러 건이면 건수가 제목이다 — 카드 다섯 장을 쌓지 않는다', () => {
    const alert = newsAlert([news('a'), news('b'), news('c')]);
    assert.equal(alert?.title, '새 소식 3건');
    assert.equal(alert?.body, '결제 연동 점검 · 확인 부탁드려요');
  });

  it('업무명을 못 풀었으면 프로젝트명이 제목이다 — 목록 카드와 같은 규칙', () => {
    assert.equal(newsAlert([news('a', { title: undefined })])?.title, '비즈플레이');
  });

  it('둘 다 없어도 제목은 있어야 한다 — 알림은 제목 없이 못 뜬다', () => {
    const bare = news('a', { title: undefined, project: undefined });
    assert.equal(newsAlert([bare])?.title, '새 소식');
  });

  it('`tag`는 가장 새 알림의 id다 — 탭이 둘이어도 같은 값이라 하나로 겹쳐진다', () => {
    assert.equal(newsAlert([news('newest'), news('older')])?.tag, 'newest');
  });
});
