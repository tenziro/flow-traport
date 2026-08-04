import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMyTasks, type ProjectTasks } from './my-tasks';
import type { FlowTask } from './rest';

/** 2026-07-30 12:00 KST. 마감일 비교 기준이 되는 고정 시각이다. */
const NOW = Date.UTC(2026, 6, 30, 3);

let srno = 1;
const task = (over: Partial<FlowTask> = {}): FlowTask => ({
  taskId: String(srno++),
  postId: '78159339',
  title: '업무',
  endDate: '',
  regDate: '20260701',
  editDate: '20260701120000',
  author: '이종석',
  workers: [{ userId: 'jongseok.lee@traport.com', name: '이종석' }],
  status: '진행',
  priority: '',
  done: false,
  upTaskId: '-1',
  ...over,
});

const project = (name: string, tasks: FlowTask[]): ProjectTasks => ({
  projectId: '2236827',
  name,
  tasks,
});

describe('내 업무 묶기', () => {
  it('완료를 갈라 놓는다 — 접어 둘 목록이 따로 필요하다', () => {
    const { projects, total, open } = buildMyTasks(
      [project('Q020', [task({ done: true }), task(), task({ done: true })])],
      NOW,
    );
    assert.equal(total, 3);
    assert.equal(open, 1);
    assert.equal(projects[0].open.length, 1);
    assert.equal(projects[0].done.length, 2);
  });

  it('안 끝난 업무는 많이 지난 것부터, 마감일 없는 것은 맨 뒤로', () => {
    const { projects } = buildMyTasks(
      [
        project('Q020', [
          task({ title: '마감일 없음' }),
          task({ title: '모레', endDate: '20260801' }),
          task({ title: '어제 지남', endDate: '20260729' }),
          task({ title: '한 달 지남', endDate: '20260630' }),
        ]),
      ],
      NOW,
    );
    assert.deepEqual(
      projects[0].open.map((t) => t.title),
      ['한 달 지남', '어제 지남', '모레', '마감일 없음'],
    );
  });

  it('마감일 없는 업무의 daysLeft는 0이다 — 화면이 이걸로 배지를 뺀다', () => {
    const { projects } = buildMyTasks([project('Q020', [task()])], NOW);
    assert.equal(projects[0].open[0].daysLeft, 0);
    assert.equal(projects[0].open[0].endDate, '');
  });

  it('마감일이 오늘이면 D-DAY(0), 어제면 지남(-1)', () => {
    const { projects } = buildMyTasks(
      [project('Q020', [task({ endDate: '20260730' }), task({ endDate: '20260729' })])],
      NOW,
    );
    assert.deepEqual(
      projects[0].open.map((t) => t.daysLeft),
      [-1, 0],
    );
  });

  it('끝난 업무는 최근 마감 순', () => {
    const { projects } = buildMyTasks(
      [
        project('Q020', [
          task({ title: '3월', endDate: '20260301', done: true }),
          task({ title: '6월', endDate: '20260601', done: true }),
        ]),
      ],
      NOW,
    );
    assert.deepEqual(
      projects[0].done.map((t) => t.title),
      ['6월', '3월'],
    );
  });

  it('프로젝트는 안 끝난 건수 내림차순 — 할 일 남은 곳이 위로 온다', () => {
    const { projects } = buildMyTasks(
      [
        project('A', [task({ done: true }), task({ done: true }), task()]),
        project('B', [task(), task()]),
      ],
      NOW,
    );
    assert.deepEqual(
      projects.map((p) => p.name),
      ['B', 'A'],
    );
  });

  it('안 끝난 건수가 같으면 큰 프로젝트, 그다음 이름순 — 순서가 매번 같아야 한다', () => {
    const { projects } = buildMyTasks(
      [
        project('나', [task()]),
        project('가', [task()]),
        project('다', [task(), task({ done: true })]),
      ],
      NOW,
    );
    assert.deepEqual(
      projects.map((p) => p.name),
      ['다', '가', '나'],
    );
  });

  it('담당 업무가 0건인 프로젝트는 카드 대신 이름과 flow 링크만 모은다 (실측 59개 중 21개)', () => {
    const { projects, quiet, total } = buildMyTasks(
      [project('빈 곳', []), project('Q020', [task()])],
      NOW,
    );
    // 링크가 곧 그 칸의 내용이다 — 이름만 있으면 갈 곳이 없다.
    assert.deepEqual(quiet, [
      { name: '빈 곳', link: 'https://flow.team/main.act?projectId=2236827' },
    ]);
    assert.equal(projects.length, 1);
    assert.equal(total, 1);
  });

  it('하위 업무는 부모 바로 아래로 들어간다 — 부모가 급하지 않아도 위에 온다', () => {
    const parent = task({ title: '부모', endDate: '20260801' });
    const { projects } = buildMyTasks(
      [
        project('Q020', [
          task({ title: '남', endDate: '20260731' }),
          task({ title: '자식2', endDate: '20260630', upTaskId: parent.taskId }),
          parent,
          task({ title: '자식1', endDate: '20260601', upTaskId: parent.taskId }),
        ]),
      ],
      NOW,
    );
    assert.deepEqual(
      projects[0].open.map((t) => [t.title, t.depth]),
      [
        // 마감만 보면 자식1(6/1)이 제일 급하지만 부모가 먼저다. 형제끼리는 마감 순이다.
        ['남', 0],
        ['부모', 0],
        ['자식1', 1],
        ['자식2', 1],
      ],
    );
  });

  it('부모가 내 담당이 아니면 하위 업무도 최상위 줄이다 (실측 191건 중 165건)', () => {
    const { projects } = buildMyTasks(
      [project('Q020', [task({ title: '고아', upTaskId: '99999999' })])],
      NOW,
    );
    assert.deepEqual(
      projects[0].open.map((t) => t.depth),
      [0],
    );
  });

  it('손자는 한 칸 더 들어가고, 끝난 업무는 계층을 안 그린다', () => {
    const a = task({ title: 'A' });
    const b = task({ title: 'B', upTaskId: a.taskId });
    const { projects } = buildMyTasks(
      [
        project('Q020', [
          a,
          b,
          task({ title: 'C', upTaskId: b.taskId }),
          task({ title: '끝난 자식', upTaskId: a.taskId, done: true }),
        ]),
      ],
      NOW,
    );
    assert.deepEqual(
      projects[0].open.map((t) => [t.title, t.depth]),
      [
        ['A', 0],
        ['B', 1],
        ['C', 2],
      ],
    );
    assert.equal(projects[0].done.length, 1);
  });

  it('부모 사슬이 고리를 이뤄도 줄이 사라지지 않는다 — 건수가 적게 보이는 게 제일 나쁘다', () => {
    const x = task({ title: 'X' });
    const y = task({ title: 'Y', upTaskId: x.taskId });
    x.upTaskId = y.taskId;
    const { projects, open } = buildMyTasks([project('Q020', [x, y])], NOW);
    assert.equal(open, 2);
    assert.deepEqual(
      projects[0].open.map((t) => [t.title, t.depth]).sort(),
      [
        ['X', 0],
        ['Y', 0],
      ],
    );
  });

  it('업무 줄은 프로젝트명과 flow 딥링크를 붙여 내려간다 (필터 응답의 connectUrl은 비어 있다)', () => {
    const { projects } = buildMyTasks([project('Q020 Extranet 운영', [task()])], NOW);
    const row = projects[0].open[0];
    assert.equal(row.project, 'Q020 Extranet 운영');
    assert.equal(
      row.link,
      'https://flow.team/main.act?projectId=2236827&postId=78159339',
    );
  });
});
