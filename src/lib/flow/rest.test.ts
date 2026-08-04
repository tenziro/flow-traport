import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getEvent,
  getPostBrief,
  getProjectBrief,
  isChangeLog,
  lastHumanComment,
  listWorkerTasks,
  listParticipants,
  mergeMentionComments,
  repeatLabel,
  resolvePostId,
  mentionsMe,
  stripMentions,
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
    await listWorkerTasks('2236827', ['jongseok.lee@traport.com']);

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

    const { tasks } = await listWorkerTasks('2916576', ['me']);
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

    const { tasks } = await listWorkerTasks('2916576', ['me']);
    assert.equal(tasks[0].status, '배포됨');
    assert.equal(tasks[0].done, true, 'optionCategory 2면 이름이 뭐든 완료다');
  });

  it('우선순위를 같은 응답에서 꺼낸다 — 모달이 따로 부르던 값이다', async () => {
    stub([
      page([
        filterTask([
          NAME_COL,
          { defaultColumnType: 'PRIORITY', columnData: [{ customColumnData: 'urgent' }] },
        ]),
      ]),
    ]);

    const { tasks } = await listWorkerTasks('2916576', ['me']);
    assert.equal(tasks[0].priority, 'urgent');
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

    const { tasks } = await listWorkerTasks('2639815', ['me']);
    assert.deepEqual(tasks, [
      {
        taskId: '42689935',
        postId: '78159339',
        title: 'LGI-REQ-기타-일반-테스트-001',
        endDate: '20260731',
        // 픽스처에 등록일 칸(`RGSN_DTTM`)이 없다 — 표에서는 `—`로 나온다.
        regDate: '',
        // 수정일 칸(`EDTR_DTTM`)도 없다. 이게 비면 그 업무는 방치로 떨어진다 (classifyTasks).
        editDate: '',
        // 등록자 칸(`RGSR_ID`)도 없다. 실제 응답은 100% 채워 오지만 없으면 `—`다.
        author: '',
        // 담당자 칸(`WORKER_ID`)도 없다 — 필터로 걸러 온 업무라 실제로는 항상 온다.
        workers: [],
        status: '완료',
        // 우선순위 칸(`PRIORITY`)도 없다 — 표는 이게 비면 표식을 안 그린다.
        priority: '',
        done: true,
        // 픽스처에 `upTaskId`가 없다 — 필드가 안 오면 최상위로 둔다.
        upTaskId: '-1',
      },
    ]);
  });

  it('등록자는 userName에서 온다 — customColumnData는 로그인 ID다', async () => {
    stub([
      page([
        filterTask([
          NAME_COL,
          {
            defaultColumnType: 'RGSR_ID',
            columnData: [{ customColumnData: 'hong67', userName: '홍성우' }],
          },
        ]),
      ]),
    ]);

    const { tasks } = await listWorkerTasks('2639815', ['me']);
    assert.equal(tasks[0].author, '홍성우');
  });

  it('부모 업무 ID를 그대로 넘긴다 (columns 밖 최상위 필드다 — BUG-034)', async () => {
    stub([page([{ ...filterTask([NAME_COL]), upTaskId: '41200005' }])]);
    const { tasks } = await listWorkerTasks('2709879', ['me']);
    assert.equal(tasks[0].upTaskId, '41200005');
  });

  it('마감일·상태 컬럼이 없으면 빈 값으로 둔다 (실측 880건 중 720건이 마감일이 없다)', async () => {
    stub([page([filterTask([NAME_COL])])]);
    const { tasks } = await listWorkerTasks('2236827', ['me']);
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
    const { tasks, hasMore } = await listWorkerTasks('2236827', ['me']);

    assert.equal(tasks.length, 2);
    assert.equal(hasMore, false);
    assert.match(urls[0], /cursor=0&/);
    assert.match(urls[1], /cursor=1&/);
    assert.doesNotMatch(urls[1], /cursor=100&/, 'cursor는 오프셋이 아니다');
  });

  it('lastCursor가 -1이면 hasNext와 무관하게 멈춘다', async () => {
    const urls = stub([{ response: { success: true, data: { tasks: [], hasNext: true, lastCursor: -1 } } }]);
    await listWorkerTasks('2236827', ['me']);
    assert.equal(urls.length, 1);
  });

  it('상한(3페이지)을 넘기면 hasMore로 알린다 — 조용히 자르지 않는다', async () => {
    const urls = stub([page([filterTask([NAME_COL])], 1)]);
    const { tasks, hasMore } = await listWorkerTasks('2236827', ['me']);

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
      comment('마감일을 바꿨습니다', 'S48^^2026-07-16@$%'),
      comment('담당자를 추가하였습니다', "S41^^'이종석'@$%"),
    ]);
    assert.equal(got?.contents, '마지막 말');
  });

  it('사람 댓글이 없으면 null이다 — 변경 로그를 대신 내지 않는다', () => {
    assert.equal(lastHumanComment([comment('로그', 'S48^^2026-07-16')]), null);
    assert.equal(lastHumanComment([]), null);
  });

  // BUG-035. 실측 148건 중 56건이 `S14`·`S13`·`S20`이었다 — truthy로 걸러 내면 사람 말 38%가 사라진다.
  it('값 없이 코드만 오는 S14·S13·S20은 사람 댓글이다', () => {
    assert.equal(isChangeLog('S14'), false);
    assert.equal(isChangeLog('S13'), false);
    assert.equal(isChangeLog('S20'), false);
    const got = lastHumanComment([
      comment('먼저 한 말'),
      comment('업데이트해서 전달드립니다.', 'S14'),
    ]);
    assert.equal(got?.contents, '업데이트해서 전달드립니다.');
  });

  /**
   * 실측 게시글 82396719 — 마지막 세 말이 전부 답글이었다. 최상위 댓글만 보면 "내가 답글로
   * 답했는데도 안 답한 것"으로 잡혀서, 피드백 업무가 계속 오늘 화면에 남는다.
   */
  it('답글이 더 나중이면 답글을 집는다', () => {
    const got = lastHumanComment([
      {
        ...comment('부모 댓글'),
        registeredDateTime: '20260803192302',
        replies: [
          {
            replyId: '6085136',
            parentCommentId: '부모 댓글',
            contents: '총 6건',
            registerId: 'aiden.0603',
            registerName: '지승용',
            registeredDateTime: '20260803214457',
          },
        ],
      },
    ]);
    assert.equal(got?.contents, '총 6건');
    assert.equal(got?.registerId, 'aiden.0603');
  });

  it('답글이 변경 로그면 답글도 건너뛴다', () => {
    const got = lastHumanComment([
      {
        ...comment('사람 말'),
        replies: [
          {
            replyId: '1',
            parentCommentId: '사람 말',
            contents: '마감일을 바꿨습니다',
            systemCode: 'S48^^2026-07-16@$%',
            registerId: 'bot',
            registerName: '봇',
            registeredDateTime: '20260803214457',
          },
        ],
      },
    ]);
    assert.equal(got?.contents, '사람 말');
  });

  it('값이 붙은 코드는 변경 로그다', () => {
    assert.equal(isChangeLog('S45^^0^^1'), true);
    assert.equal(isChangeLog('S83^^이성우'), true);
    assert.equal(isChangeLog(''), false);
    assert.equal(isChangeLog(null), false);
    assert.equal(isChangeLog(undefined), false);
  });
});

describe('댓글에서 부른 이름 걷어 내기', () => {
  it('마크다운을 벗기고 이름만 남긴다 — @도 뗀다', () => {
    assert.equal(stripMentions('@[서동조](djseo7) 확인 부탁드립니다'), '서동조 확인 부탁드립니다');
  });

  it('한 댓글에 여러 명이 불려 있어도 전부 걷는다', () => {
    assert.equal(
      stripMentions('@[이종석](jslee) @[장혜진](wkd41051) 회의 잡을게요'),
      '이종석 장혜진 회의 잡을게요',
    );
  });

  it('부른 이름이 없으면 원문 그대로다', () => {
    assert.equal(stripMentions('오늘 배포합니다'), '오늘 배포합니다');
    assert.equal(stripMentions(''), '');
  });

  it('본문에 섞인 @나 대괄호는 건드리지 않는다 — 이메일과 목록이 그렇게 온다', () => {
    assert.equal(
      stripMentions('jslee@traport.com 으로 보냈어요 [완료]'),
      'jslee@traport.com 으로 보냈어요 [완료]',
    );
  });
});

describe('나를 부른 댓글 가려내기', () => {
  const ME = 'jongseok.lee@traport.com';

  it('괄호 안 id가 나면 부른 것이다 — 대소문자는 안 가린다', () => {
    assert.equal(mentionsMe(`@[이종석](${ME}) 이사님, 확인 부탁드려요`, ME), true);
    assert.equal(mentionsMe(`@[이종석](${ME.toUpperCase()}) 확인이요`, ME), true);
  });

  it('남을 부른 댓글은 아니다 — 내 이름이 본문에 있어도 그렇다', () => {
    assert.equal(mentionsMe('@[장혜진](wkd41051) 이종석 이사님께 전달 부탁해요', ME), false);
  });

  it('전원 호출은 나를 부른 게 아니다', () => {
    assert.equal(mentionsMe('@[ALL](ALL) 오늘 회식입니다', ME), false);
  });

  it('세션이 없으면(빈 id) 아무 줄도 안 잡는다', () => {
    assert.equal(mentionsMe(`@[이종석](${ME}) 확인이요`, ''), false);
  });
});

// ---------------------------------------------------------------------------
// 담당자 후보 — 참여자 목록 + 업무에 이름이 있는 사람 (PRD §13 A4)
// ---------------------------------------------------------------------------

describe('프로젝트 겉면 읽기', () => {
  const stub = (setting: unknown) => {
    process.env.FLOW_API_KEY = 'test-key';
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        response: { success: true, data: { project: { PROJECT_SETTING: setting } } },
      }),
    })) as unknown as typeof fetch;
  };

  it('건수는 문자열로 오고 숫자로 낸다', async () => {
    stub([
      {
        CNTN: ' 1차 7월 오픈 ',
        SENDIENCE_CNT: '90',
        OUT_SENDIENCE_CNT: '77',
        OPEN_YN: 'Y',
        IMPT_YN: 'Y',
        RGSR_NM: '우창민',
        RGSN_DTTM: '20250922170857',
      },
    ]);

    assert.deepEqual(await getProjectBrief('2639815'), {
      desc: '1차 7월 오픈',
      count: 90,
      outside: 77,
      open: true,
      important: true,
      owner: '우창민',
      opened: '20250922170857',
    });
  });

  it('설정이 통째로 비어도 0과 빈 문자열로 낸다 — 화면이 그 줄을 안 그린다', async () => {
    stub([]);
    assert.deepEqual(await getProjectBrief('2639815'), {
      desc: '',
      count: 0,
      outside: 0,
      open: false,
      important: false,
      owner: '',
      opened: '',
    });
  });

  // `Y`만 참이다 — flow는 `N`을 주지만 값이 비어 오는 필드가 흔해서(`STATUS`가 그렇다)
  // 빈 문자열이 공개나 중요로 새지 않는지 못박아 둔다
  it('공개·중요는 `Y`일 때만 참이다', async () => {
    stub([{ OPEN_YN: '', IMPT_YN: 'N' }]);
    const brief = await getProjectBrief('2639815');
    assert.equal(brief.open, false);
    assert.equal(brief.important, false);
  });
});

describe('담당자 후보 모으기', () => {
  /** URL마다 다른 응답이 필요하다 — 참여자 조회와 업무 조회를 같이 부른다. */
  const stub = (participants: unknown, tasks: unknown[]) => {
    process.env.FLOW_API_KEY = 'test-key';
    globalThis.fetch = (async (url: string) => ({
      ok: true,
      json: async () => ({
        response: {
          success: true,
          data: url.includes('/participants') ? { participants } : { tasks },
        },
      }),
    })) as unknown as typeof fetch;
  };

  const worker = (userId: string, userName: string) => ({
    defaultColumnType: 'WORKER_ID',
    columnData: [{ customColumnData: userId, userName }],
  });

  it('참여자 목록에 없는 담당자도 후보가 된다 — 참여자 API는 우리 기관 사람만 준다', async () => {
    stub([{ userId: 'jongseok.lee@traport.com', name: '이종석' }], [
      filterTask([NAME_COL, worker('hong67', '홍성우')]),
    ]);

    const people = await listParticipants('2639815');
    assert.deepEqual(people, [
      // 우리 기관 사람이 먼저다
      { userId: 'jongseok.lee@traport.com', name: '이종석' },
      // 타사 담당자의 `customColumnData`가 곧 `workerId`다 (로그인 ID꼴)
      { userId: 'hong67', name: '홍성우', outside: true },
    ]);
  });

  it('우리 기관 사람이 아니면 외부로 표시한다 — 내 업무 카드가 이걸로 목록을 가른다', async () => {
    stub(
      [
        { userId: 'jongseok.lee@traport.com', name: '이종석' },
        // 참여자 API가 언젠가 외부 사람을 주더라도 출처가 아니라 id로 가른다
        { userId: 'park99', name: '박다솜' },
      ],
      [],
    );

    const people = await listParticipants('2639815');
    assert.deepEqual(
      people.map((p) => [p.name, p.outside ?? false]),
      [
        ['이종석', false],
        ['박다솜', true],
      ],
    );
  });

  it('같은 사람이 여러 업무에 있어도 한 번만, 등록자도 후보다', async () => {
    stub([], [
      filterTask([NAME_COL, worker('hong67', '홍성우')]),
      filterTask([
        NAME_COL,
        worker('hong67', '홍성우'),
        { defaultColumnType: 'RGSR_ID', columnData: [{ customColumnData: 'kim12', userName: '김가영' }] },
      ]),
    ]);

    assert.deepEqual(await listParticipants('2639815'), [
      // 이름순이다 — 업무에 나온 순서가 아니다
      { userId: 'kim12', name: '김가영', outside: true },
      { userId: 'hong67', name: '홍성우', outside: true },
    ]);
  });

  it('업무 조회가 죽어도 참여자 목록은 남는다', async () => {
    process.env.FLOW_API_KEY = 'test-key';
    globalThis.fetch = (async (url: string) => ({
      ok: url.includes('/participants'),
      json: async () => ({
        response: url.includes('/participants')
          ? { success: true, data: { participants: [{ userId: 'a@traport.com', name: '이종석' }] } }
          : { success: false, error: { message: '조회 실패' } },
      }),
    })) as unknown as typeof fetch;

    assert.deepEqual(await listParticipants('2639815'), [
      { userId: 'a@traport.com', name: '이종석' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 일정 상세 — 목록에 없는 값만 골라 낸다 (api-spec §8.5, PRD §13 B3)
// ---------------------------------------------------------------------------

describe('반복 주기를 사람 말로', () => {
  it('1주기는 "매주", 여러 주기는 "N주마다"다', () => {
    assert.equal(
      repeatLabel({ repeatType: 'WEEKLY', repeatPeriod: '1', repeatDays: 'FR' }),
      '매주 금요일',
    );
    assert.equal(
      repeatLabel({ repeatType: 'WEEKLY', repeatPeriod: '2', repeatDays: 'MO,FR' }),
      '2주마다 월·금요일',
    );
  });

  it('끝나는 날이 있으면 뒤에 붙인다', () => {
    assert.equal(
      repeatLabel({
        repeatType: 'WEEKLY',
        repeatPeriod: '1',
        repeatDays: 'FR',
        endDateTime: '20260904000000',
      }),
      '매주 금요일 · 2026-09-04까지',
    );
  });

  // 실측에서 `repeatCount`가 늘 비어 있듯 `endDateTime`도 빌 수 있다 — 빈 값이
  // `NaN까지`로 새면 화면에 그대로 뜬다
  it('무기한 반복은 날짜를 안 적는다', () => {
    assert.equal(repeatLabel({ repeatType: 'DAILY', repeatPeriod: '1', endDateTime: '' }), '매일');
  });

  it('반복이 아니거나 모르는 주기면 빈 문자열이다', () => {
    assert.equal(repeatLabel(undefined), '');
    assert.equal(repeatLabel({ repeatType: '' }), '');
    assert.equal(repeatLabel({ repeatType: 'HOURLY', repeatPeriod: '1' }), '');
  });
});

describe('일정 상세 읽기', () => {
  const stub = (event: unknown) => {
    process.env.FLOW_API_KEY = 'test-key';
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ response: { success: true, data: { event } } }),
    })) as unknown as typeof fetch;
  };

  it('설명·장소·참석자·등록자를 골라 낸다', async () => {
    stub({
      eventName: '주간 회의',
      eventBody: '  안건 정리  ',
      location: ' 3층 회의실 ',
      attendances: [
        { attendanceName: '이종석' },
        { attendanceName: ' 장혜진 ' },
        // 이름이 없는 참석자가 섞여 온다 — 빈 칩이 되면 안 된다
        { attendanceName: '' },
      ],
      rgsrNm: '우창민',
      repeatEvents: [{ repeatType: 'WEEKLY', repeatPeriod: '1', repeatDays: 'FR' }],
    });

    assert.deepEqual(await getEvent('123', '20260807090000', '20260807100000'), {
      body: '안건 정리',
      place: '3층 회의실',
      attendees: ['이종석', '장혜진'],
      owner: '우창민',
      repeat: '매주 금요일',
    });
  });

  // 실측 8건 중 설명은 3건, 장소는 1건뿐이다 — 없는 값이 `undefined`로 새면 화면이
  // "undefined"를 그린다
  it('비어 있는 일정은 빈 문자열과 빈 배열로 낸다', async () => {
    stub({ eventName: '휴가' });
    assert.deepEqual(await getEvent('123', '20260807090000', '20260807100000'), {
      body: '',
      place: '',
      attendees: [],
      owner: '',
      repeat: '',
    });
  });

  it('일정이 통째로 없어도 안 깨진다', async () => {
    stub(undefined);
    const detail = await getEvent('123', '20260807090000', '20260807100000');
    assert.deepEqual(detail.attendees, []);
    assert.equal(detail.body, '');
  });
});

describe('게시글 상세에서 관계·첨부 읽기', () => {
  const stub = (data: unknown) => {
    process.env.FLOW_API_KEY = 'test-key';
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ response: { success: true, data } }),
    })) as unknown as typeof fetch;
  };

  it('상위 업무는 그쪽 글로 링크한다 — 이 글이 아니라', async () => {
    stub({
      upLinkTasks: [
        {
          UP_LINK_TASK_NM: ' 상위 업무 ',
          COLABO_SRNO: '2639815',
          COLABO_COMMT_SRNO: '81412845',
        },
      ],
    });
    const brief = await getPostBrief('82393821');
    assert.equal(brief.parent?.name, '상위 업무');
    assert.equal(
      brief.parent?.url,
      'https://flow.team/main.act?projectId=2639815&postId=81412845',
    );
    // 지금 글(82393821)이 아니라 **상위 글**의 번호다. 모달이 이걸로 상위를 펼친다
    assert.equal(brief.parent?.postId, '81412845');
  });

  // 글 번호가 없으면 링크를 못 만든다. 그때 `undefined`가 `href`로 새면 지금 화면으로
  // 되돌아가는 죽은 링크가 된다. 펼치기도 같이 막혀야 한다
  it('프로젝트·글 번호가 없으면 링크 없이 이름만 낸다', async () => {
    stub({ upLinkTasks: [{ UP_LINK_TASK_NM: '상위 업무' }] });
    const brief = await getPostBrief('1');
    assert.equal(brief.parent?.url, '');
    assert.equal(brief.parent?.postId, '');
  });

  it('하위 업무는 상태 칸을 tasks[]와 같은 규칙으로 읽는다', async () => {
    stub({
      subTasks: [
        {
          TASK_NM: '하위 하나',
          PROGRESS: '100',
          COLABO_SRNO: '2694919',
          COLABO_COMMT_SRNO: '82445380',
          // 평평한 `STTS`가 `'0'`(대기)인데 실제로는 `진행`이다 — `tasks[0]`과 같은 함정이다
          ...STATUS_TASK,
        },
        // 진행률이 빈 문자열로 오는 줄이 있다 — `Number('')`는 0이라 "0%"로 새면 안 된다
        { TASK_NM: '하위 둘', PROGRESS: '' },
      ],
    });
    const brief = await getPostBrief('82445380');
    assert.deepEqual(brief.subTasks, [
      {
        name: '하위 하나',
        // 모달이 이 번호 하나로 그 업무를 펼친다
        postId: '82445380',
        url: 'https://flow.team/main.act?projectId=2694919&postId=82445380',
        status: '진행',
        progress: 100,
      },
      { name: '하위 둘', postId: '', url: '', status: null, progress: null },
    ]);
  });

  it('첨부 URL의 겹친 슬래시를 줄이고 이미지는 썸네일을 단다', async () => {
    stub({
      attachments: [
        {
          FILE_NAME: '보고서.pdf',
          FILE_SIZE: '13014262',
          ATCH_URL: 'https://flow.team//FLOW_DOWNLOAD_R001.act?RAND_KEY=k',
        },
      ],
      imageAttachments: [
        {
          ORCP_FILE_NM: '화면.png',
          FILE_SIZE: '20653',
          ATCH_URL: 'https://flow.team/flowImg/a.png',
          THUM_IMG_PATH: 'https://flow.team/flowImg/a_thumb.png',
        },
      ],
    });
    assert.deepEqual((await getPostBrief('1')).files, [
      {
        name: '보고서.pdf',
        size: 13014262,
        url: 'https://flow.team/FLOW_DOWNLOAD_R001.act?RAND_KEY=k',
        thumb: undefined,
      },
      {
        name: '화면.png',
        size: 20653,
        url: 'https://flow.team/flowImg/a.png',
        thumb: 'https://flow.team/flowImg/a_thumb.png',
      },
    ]);
  });

  it('이름이나 주소가 없는 첨부는 버린다 — 빈 줄이 서면 안 된다', async () => {
    stub({ attachments: [{ FILE_SIZE: '10' }, { FILE_NAME: '이름만.txt' }] });
    assert.deepEqual((await getPostBrief('1')).files, []);
  });

  it('관계도 첨부도 없는 글은 빈 값이다', async () => {
    stub({ title: '공지' });
    const brief = await getPostBrief('1');
    assert.equal(brief.parent, null);
    assert.deepEqual(brief.subTasks, []);
    assert.deepEqual(brief.files, []);
  });
});
