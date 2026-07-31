import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMembers } from './members';

/** 응답 한 칸. 시험에 안 쓰는 필드는 빈 문자열로 둔다. */
const person = (
  fullname: string,
  divisionCode: string,
  divisionName: string,
  responsibility: string,
  over: { phoneNumber?: string; profileImagePath?: string; slogan?: string } = {},
) => ({
  fullname,
  divisionCode,
  divisionName,
  responsibility,
  email: `${fullname}@traport.com`,
  phoneNumber: '',
  profileImagePath: '',
  slogan: '',
  ...over,
});

const names = (data: ReturnType<typeof buildMembers>, division: string) =>
  data.divisions.find((d) => d.name === division)?.members.map((m) => m.name);

describe('구성원 줄 세우기', () => {
  it('부서는 flow가 매긴 코드 순 — 이름 순이면 회사가 정한 순서가 뒤집힌다', () => {
    const data = buildMembers([
      person('가', '3', '경영지원팀', '사원'),
      person('나', '1', '플랫폼개발팀', '사원'),
      person('다', '2', '기획운영팀', '사원'),
    ]);

    assert.deepEqual(
      data.divisions.map((d) => d.name),
      ['플랫폼개발팀', '기획운영팀', '경영지원팀'],
    );
    assert.equal(data.total, 3);
  });

  it('한 부서 안에서는 직책 서열이 이름보다 먼저다', () => {
    const data = buildMembers([
      person('하사원', '1', '플랫폼개발팀', '사원'),
      person('가대리', '1', '플랫폼개발팀', '대리'),
      person('타부장', '1', '플랫폼개발팀', '부장'),
    ]);

    assert.deepEqual(names(data, '플랫폼개발팀'), ['타부장', '가대리', '하사원']);
  });

  it('서열에 없는 직책은 맨 뒤로 — 지어낸 자리에 끼우지 않는다', () => {
    const data = buildMembers([
      person('가', '1', '플랫폼개발팀', '컨설턴트'),
      person('나', '1', '플랫폼개발팀', '사원'),
    ]);

    assert.deepEqual(names(data, '플랫폼개발팀'), ['나', '가']);
  });

  it('직책이 같으면 이름 순', () => {
    const data = buildMembers([
      person('다', '1', '플랫폼개발팀', '과장'),
      person('가', '1', '플랫폼개발팀', '과장'),
      person('나', '1', '플랫폼개발팀', '과장'),
    ]);

    assert.deepEqual(names(data, '플랫폼개발팀'), ['가', '나', '다']);
  });

  it('사번·기관 ID가 아니라 화면에 낼 여섯 칸만 넘긴다', () => {
    const data = buildMembers([
      person('가', '1', '플랫폼개발팀', '부장', {
        phoneNumber: '010-0000-0000',
        slogan: '업무시간 내에는 회사 연락처로',
      }),
    ]);

    assert.deepEqual(data.divisions[0].members[0], {
      name: '가',
      title: '부장',
      email: '가@traport.com',
      phone: '010-0000-0000',
      photo: '',
      slogan: '업무시간 내에는 회사 연락처로',
    });
  });
});
