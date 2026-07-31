import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getPostBrief,
  lastHumanComment,
  listMyTasks,
  mergeMentionComments,
  resolvePostId,
  type FlowComment,
  type MentionAlarm,
  type MentionRow,
} from './rest';

/** 2026-07-28 실측. 워크리스트 멘션 한 줄과 같은 알림의 REST 레코드가 이 한 쌍이다. */
const MENTION: MentionRow & { title: string; link: string } = {
  from: 'wkd41051',
  at: '20260728095149',
  title: '비즈플레이 출장 예약 - 열차(SRT) 좌석 번호 표기 오류',
  link: 'https://flow.team/l/QBJyf',
};

/** 로그인한 사람 = 알림 수신자. 이게 어긋나면 본문이 하나도 안 붙어야 한다. */
const ME = 'jongseok.lee@traport.com';

const ALARM: MentionAlarm = {
  alarmId: '318742901',
  receiverId: ME,
  projectId: '2605313',
  postId: '81938471',
  remarkId: '193042898',
  replyId: '-1',
  registerId: 'wkd41051',
  registerName: '장혜진',
  registeredDateTime: '20260728095149',
  content: '이종석 부장님\n\n17호차는 다음화면이 안눌려서 넘어가지않는다고합니다.',
};

describe('멘션에 댓글 본문 붙이기', () => {
  it('발신자 ID + 시각이 맞으면 본문과 실명이 붙는다', () => {
    const [row] = mergeMentionComments([MENTION], [ALARM], ME);
    assert.equal(row.from, '장혜진');
    assert.equal(row.content, ALARM.content);
    assert.equal(row.isReply, false);
    // 프로젝트는 알림만 준다 — 화면의 프로젝트명이 이 값에서 나온다
    assert.equal(row.projectId, ALARM.projectId);
    // 제목·링크는 그대로 살아 있어야 한다 (워크리스트만 주는 값이다)
    assert.equal(row.title, MENTION.title);
    assert.equal(row.link, MENTION.link);
  });

  it('replyId가 -1이 아니면 답글로 표시한다', () => {
    const [row] = mergeMentionComments([MENTION], [{ ...ALARM, replyId: '6029728' }], ME);
    assert.equal(row.isReply, true);
  });

  it('짝이 없으면 원본 그대로 흘린다 — 건수는 줄지 않는다', () => {
    const rows = mergeMentionComments([MENTION], [{ ...ALARM, registeredDateTime: '20260101000000' }], ME);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].from, 'wkd41051');
    assert.equal(rows[0].content, undefined);
  });

  it('본문이 빈 문자열이면 붙이지 않는다 (빈 줄만 렌더되는 걸 막는다)', () => {
    const [row] = mergeMentionComments([MENTION], [{ ...ALARM, content: '   ' }], ME);
    assert.equal(row.content, undefined);
    assert.equal(row.from, '장혜진');
  });

  // 여기가 유출 방어선이다. API Key는 발급자 한 명의 알림만 주므로, 다른 사람이 로그인하면
  // 본문이 **하나도** 안 붙어야 한다. 이 테스트가 깨지면 남의 멘션이 새는 것이다.
  it('알림 수신자가 로그인한 사람과 다르면 아무것도 붙이지 않는다', () => {
    const [row] = mergeMentionComments([MENTION], [ALARM], 'nayeong@traport.com');
    assert.equal(row.content, undefined);
    assert.equal(row.from, 'wkd41051');
    assert.equal(row.isReply, undefined);
  });

  it('수신자 비교는 대소문자를 가리지 않는다', () => {
    const [row] = mergeMentionComments([MENTION], [ALARM], ME.toUpperCase());
    assert.equal(row.content, ALARM.content);
  });
});

/**
 * 2026-07-28 실측. 업무명 `LGI-REQ-기타-일반-테스트-001`로 검색했을 때 온 두 줄이다.
 * 이름이 같은 업무가 둘이라 **이름으로는 못 고른다** — 이게 이 함수가 있는 이유다.
 */
const FILTER = {
  response: {
    success: true,
    data: {
      hasNext: false,
      tasks: [
        { taskId: '42689935', postId: '78159339' },
        { taskId: '41679745', postId: '76673279' },
      ],
    },
  },
};

/** 이 테스트가 깨지면 댓글이 다시 404를 준다 (BUG-005). */
describe('taskSrno를 postId로 바꾸기', () => {
  const stub = (body: unknown, ok = true) => {
    process.env.FLOW_API_KEY = 'test-key';
    globalThis.fetch = (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
  };

  it('taskId가 맞는 줄의 postId를 준다 — 첫 줄이 아니다', async () => {
    stub(FILTER);
    assert.equal(await resolvePostId('2236827', '41679745', 'LGI-REQ-기타-일반-테스트-001'), '76673279');
  });

  it('taskSrno를 그대로 돌려주지 않는다 (두 ID는 다른 공간이다)', async () => {
    stub(FILTER);
    const postId = await resolvePostId('2236827', '42689935', 'LGI-REQ-기타-일반-테스트-001');
    assert.equal(postId, '78159339');
    assert.notEqual(postId, '42689935');
  });

  it('검색 결과에 없으면 null — 호출부가 flow로 안내한다', async () => {
    stub(FILTER);
    assert.equal(await resolvePostId('2236827', '99999999', '없는 업무'), null);
  });

  it('응답이 실패면 던진다 — null과 구분해야 사유를 삼킨 걸 안다', async () => {
    stub({ response: { success: false, error: { code: '403', message: '권한 없음' } } }, false);
    await assert.rejects(() => resolvePostId('2236827', '41679745', '무엇이든'), /업무 조회 실패/);
  });
});

// ---------------------------------------------------------------------------
// 게시글 상세에서 상태 읽기 — 나를 부른 사람들 줄의 상태 배지 (BUG-028)
// ---------------------------------------------------------------------------

/** `GET /user/posts/{postId}` 한 건. 상태에 관계있는 것만 남겼다 (2026-07-29 실측). */
const post = (task: unknown) => ({
  response: {
    success: true,
    data: { title: '업무 제목', connectUrl: 'https://flow.team/l/Qm2hT', tasks: task ? [task] : [] },
  },
});

/** base 상태만 쓰는 프로젝트 (2639815). `OPTION_NAME`이 빈 문자열이라 코드만 온다. */
const STTS_TASK = {
  STTS: '3',
  TASK_COLUMN_REC: [
    {
      DEFAULT_COLUMN_TYPE: 'STTS',
      COLUMN_DATA_REC: [{ CUSTOM_COLUMN_DATA: '3', OPTION_NAME: '', OPTION_CATEGORY: '3' }],
    },
  ],
};

/**
 * 커스텀 상태를 쓰는 프로젝트 (2916576, `Q020 Extranet 운영`). **여기가 함정이다** —
 * 평평한 `STTS`가 `'0'`으로 오는데 실제 상태는 `진행`이다.
 */
const STATUS_TASK = {
  STTS: '0',
  TASK_COLUMN_REC: [
    {
      DEFAULT_COLUMN_TYPE: 'STATUS',
      COLUMN_DATA_REC: [{ CUSTOM_COLUMN_DATA: '901661', OPTION_NAME: '진행', OPTION_CATEGORY: '1' }],
    },
  ],
};

describe('게시글 상세에서 업무 상태 읽기', () => {
  const stub = (body: unknown, ok = true) => {
    process.env.FLOW_API_KEY = 'test-key';
    globalThis.fetch = (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
  };

  it('커스텀 상태 프로젝트는 라벨을 그대로 쓴다 — 평평한 STTS에 속지 않는다', async () => {
    stub(post(STATUS_TASK));
    const brief = await getPostBrief('80754103');
    assert.equal(brief.status, '진행');
    assert.notEqual(brief.status, '대기', '평평한 STTS "0"을 읽으면 진행이 대기로 보인다');
  });

  it('base 상태 프로젝트는 코드를 라벨로 바꾼다', async () => {
    stub(post(STTS_TASK));
    assert.equal((await getPostBrief('82013056')).status, '보류');
  });

  it('코드 다섯 개가 화면 배지 라벨과 같다 (status-pill.tsx)', async () => {
    for (const [code, label] of [
      ['0', '대기'],
      ['1', '진행'],
      ['2', '완료'],
      ['3', '보류'],
      ['4', '피드백'],
    ]) {
      stub(post({ ...STTS_TASK, TASK_COLUMN_REC: [
        {
          DEFAULT_COLUMN_TYPE: 'STTS',
          COLUMN_DATA_REC: [{ CUSTOM_COLUMN_DATA: code, OPTION_NAME: '', OPTION_CATEGORY: code }],
        },
      ] }));
      assert.equal((await getPostBrief('1')).status, label, `STTS ${code}`);
    }
  });

  it('업무가 아닌 글이면 null — 상태 배지 자리를 비워 둔다', async () => {
    stub(post(null));
    const brief = await getPostBrief('82013056');
    assert.equal(brief.status, null);
    // 제목·링크는 그대로 나와야 한다 (소식 카드가 쓰는 값이다)
    assert.equal(brief.url, 'https://flow.team/l/Qm2hT');
  });

  it('모르는 코드는 버린다 — 숫자가 배지로 보이는 게 빈 자리보다 나쁘다', async () => {
    stub(post({ ...STTS_TASK, TASK_COLUMN_REC: [
      {
        DEFAULT_COLUMN_TYPE: 'STTS',
        COLUMN_DATA_REC: [{ CUSTOM_COLUMN_DATA: '9', OPTION_NAME: '', OPTION_CATEGORY: '9' }],
      },
    ] }));
    assert.equal((await getPostBrief('1')).status, null);
  });
});

// ---------------------------------------------------------------------------
// 내 업무 — 담당자 필터 조회 (PRD §6.5)
// ---------------------------------------------------------------------------

/** 필터 API의 업무 한 건. 컬럼 배열만 다르게 준다 (2026-07-28 실측 형태). */
const filterTask = (
  columns: { defaultColumnType: string; columnData: Record<string, string>[] }[],
) => ({ taskId: '42689935', postId: '78159339', columns });

const NAME_COL = {
  defaultColumnType: 'TASK_NM',
  columnData: [{ customColumnData: 'LGI-REQ-기타-일반-테스트-001' }],
};

describe('내 업무 조회', () => {
  /** 부른 URL을 모아 둔다 — 담당자 필터가 실제로 실려 나가는지는 여기서만 보인다. */
  const stub = (pages: unknown[]) => {
    process.env.FLOW_API_KEY = 'test-key';
    const urls: string[] = [];
    let n = 0;
    globalThis.fetch = (async (url: string) => {
      urls.push(url);
      return { ok: true, json: async () => pages[Math.min(n++, pages.length - 1)] };
    }) as unknown as typeof fetch;
    return urls;
  };
  /** `lastCursor`는 **다음 페이지 번호**다. 끝이면 `-1`이 온다 (2026-07-30 실측). */
  const page = (tasks: unknown[], lastCursor = -1) => ({
    response: { success: true, data: { tasks, hasNext: lastCursor >= 0, lastCursor } },
  });

  it('담당자 필터를 WORKER_ID(1번 컬럼)에 그 사람 ID로 걸어 보낸다', async () => {
    const urls = stub([page([])]);
    await listMyTasks('2236827', 'jongseok.lee@traport.com');

    const filter = new URL(`https://x${urls[0]}`).searchParams.get('filterRecords');
    assert.deepEqual(JSON.parse(filter ?? '[]'), [
      { COLUMN_SRNO: '1', OPERATOR_TYPE: 'IN', FILTER_DATA: 'jongseok.lee@traport.com' },
    ]);
  });

  it('커스텀 상태는 optionName을 라벨로 쓰고, optionCategory 2를 완료로 본다', async () => {
    stub([
      page([
        filterTask([
          NAME_COL,
          {
            defaultColumnType: 'STATUS',
            columnData: [{ customColumnData: '901661', optionName: '진행', optionCategory: '1' }],
          },
          // 커스텀 프로젝트의 base 상태는 평평하게 `0`으로 온다 — 이걸 읽으면 대기가 된다
          {
            defaultColumnType: 'STTS',
            columnData: [{ customColumnData: '0', optionName: '', optionCategory: '0' }],
          },
        ]),
      ]),
    ]);

    const { tasks } = await listMyTasks('2916576', 'me');
    assert.equal(tasks[0].status, '진행');
    assert.equal(tasks[0].done, false);
  });

  it('완료는 상태 이름이 아니라 optionCategory로 가른다 — 이름은 프로젝트마다 다르다', async () => {
    stub([
      page([
        filterTask([
          NAME_COL,
          {
            defaultColumnType: 'STATUS',
            columnData: [{ customColumnData: '901663', optionName: '배포됨', optionCategory: '2' }],
          },
        ]),
      ]),
    ]);

    const { tasks } = await listMyTasks('2916576', 'me');
    assert.equal(tasks[0].status, '배포됨');
    assert.equal(tasks[0].done, true, 'optionCategory 2면 이름이 뭐든 완료다');
  });

  it('base 상태는 코드표로 라벨을 만든다 — optionName이 빈 문자열로 온다', async () => {
    stub([
      page([
        filterTask([
          NAME_COL,
          { defaultColumnType: 'END_DT', columnData: [{ customColumnData: '20260731' }] },
          {
            defaultColumnType: 'STTS',
            columnData: [{ customColumnData: '2', optionName: '', optionCategory: '2' }],
          },
        ]),
      ]),
    ]);

    const { tasks } = await listMyTasks('2639815', 'me');
    assert.deepEqual(tasks, [
      {
        taskId: '42689935',
        postId: '78159339',
        title: 'LGI-REQ-기타-일반-테스트-001',
        endDate: '20260731',
        status: '완료',
        done: true,
        // 픽스처에 `upTaskId`가 없다 — 필드가 안 오면 최상위로 둔다.
        upTaskId: '-1',
      },
    ]);
  });

  it('부모 업무 ID를 그대로 넘긴다 (columns 밖 최상위 필드다 — BUG-034)', async () => {
    stub([page([{ ...filterTask([NAME_COL]), upTaskId: '41200005' }])]);
    const { tasks } = await listMyTasks('2709879', 'me');
    assert.equal(tasks[0].upTaskId, '41200005');
  });

  it('마감일·상태 컬럼이 없으면 빈 값으로 둔다 (실측 880건 중 720건이 마감일이 없다)', async () => {
    stub([page([filterTask([NAME_COL])])]);
    const { tasks } = await listMyTasks('2236827', 'me');
    assert.equal(tasks[0].endDate, '');
    assert.equal(tasks[0].status, '');
    assert.equal(tasks[0].done, false);
  });

  /**
   * `cursor`는 **페이지 번호**다. 오프셋(`page * 100`)을 넣으면 빈 배열이 와서 2쪽부터
   * 조용히 사라진다 — 실측 236건 프로젝트가 100건으로 보였다 (BUG-030).
   */
  it('다음 페이지는 lastCursor가 준 번호로 받는다 — 건수를 곱하지 않는다', async () => {
    const urls = stub([page([filterTask([NAME_COL])], 1), page([filterTask([NAME_COL])])]);
    const { tasks, hasMore } = await listMyTasks('2236827', 'me');

    assert.equal(tasks.length, 2);
    assert.equal(hasMore, false);
    assert.match(urls[0], /cursor=0&/);
    assert.match(urls[1], /cursor=1&/);
    assert.doesNotMatch(urls[1], /cursor=100&/, 'cursor는 오프셋이 아니다');
  });

  it('lastCursor가 -1이면 hasNext와 무관하게 멈춘다', async () => {
    const urls = stub([{ response: { success: true, data: { tasks: [], hasNext: true, lastCursor: -1 } } }]);
    await listMyTasks('2236827', 'me');
    assert.equal(urls.length, 1);
  });

  it('상한(3페이지)을 넘기면 hasMore로 알린다 — 조용히 자르지 않는다', async () => {
    const urls = stub([page([filterTask([NAME_COL])], 1)]);
    const { tasks, hasMore } = await listMyTasks('2236827', 'me');

    assert.equal(urls.length, 3);
    assert.equal(tasks.length, 3);
    assert.equal(hasMore, true);
  });
});

describe('업무 줄에 붙는 마지막 댓글', () => {
  /** 실측 게시글 62760638의 모양 — 사람 댓글과 변경 로그가 섞여 오고 오래된 것부터다. */
  const comment = (contents: string, systemCode?: string): FlowComment => ({
    commentId: contents,
    contents,
    systemCode,
    registerId: 'wkd41051',
    registerName: '장혜진',
    registeredDateTime: '20260728095149',
  });

  it('사람이 쓴 마지막 댓글을 집는다', () => {
    const got = lastHumanComment([comment('첫 말'), comment('마지막 말')]);
    assert.equal(got?.contents, '마지막 말');
  });

  it('뒤에 붙은 변경 로그는 건너뛴다 — 실측 15건 중 7건이 그것이다', () => {
    const got = lastHumanComment([
      comment('마지막 말'),
      comment('S48', 'S48'),
      comment('S41', 'S41'),
    ]);
    assert.equal(got?.contents, '마지막 말');
  });

  it('사람 댓글이 없으면 null이다 — 변경 로그를 대신 내지 않는다', () => {
    assert.equal(lastHumanComment([comment('S48', 'S48')]), null);
    assert.equal(lastHumanComment([]), null);
  });
});
