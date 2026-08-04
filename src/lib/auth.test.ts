import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.SESSION_SECRET ??= 'test-secret';

import { isTraport, seal, unseal } from './auth';

describe('세션 봉인', () => {
  it('봉인한 값이 그대로 돌아온다', async () => {
    const session = { userId: 'a@traport.com', fullname: '이종석' };
    assert.deepEqual(await unseal(await seal(session)), session);
  });

  // ★ 이 쿠키에 API 키가 들어간다 (`sealKey`). 평문이 새면 그게 곧 계정 탈취다.
  it('평문이 쿠키에 남지 않는다', async () => {
    assert.ok(!(await seal('super-secret-key')).includes('super-secret-key'));
  });

  it('같은 값이라도 매번 다른 문자열이 된다 (IV 재사용 금지)', async () => {
    assert.notEqual(await seal({ a: 1 }), await seal({ a: 1 }));
  });

  it('변조·쓰레기 입력은 던지지 않고 null', async () => {
    const sealed = await seal({ a: 1 });
    // 맨 뒷글자는 base64url 패딩 비트를 물고 있어서 바꿔도 같은 바이트로 디코드될 수 있다.
    // (그래서 이 테스트가 가끔 통과했다.) 항상 유효 비트인 첫 글자를 건드린다.
    const tampered = (sealed[0] === 'A' ? 'B' : 'A') + sealed.slice(1);
    assert.equal(await unseal(tampered), null);
    assert.equal(await unseal('not-base64!!'), null);
    assert.equal(await unseal(''), null);
  });
});

describe('회사 검증', () => {
  const profile = (email: string, userId = email) =>
    ({ email, userId, fullname: '', divisionCode: '', divisionName: '', responsibility: '' });

  it('트래포트 계정만 통과한다', () => {
    assert.ok(isTraport(profile('jongseok.lee@traport.com')));
    assert.ok(isTraport(profile('JongSeok.Lee@Traport.COM')));
    assert.ok(!isTraport(profile('someone@other.com')));
    // 도메인이 부분 일치하는 위장 주소
    assert.ok(!isTraport(profile('attacker@nottraport.com')));
    assert.ok(!isTraport(profile('attacker@traport.com.evil.io')));
  });

  it('email이 비면 userId로 판정한다', () => {
    assert.ok(isTraport(profile('', 'jongseok.lee@traport.com')));
  });
});
