"use server";

/**
 * 로그인 = 개인 flow API 키 등록 (PRD §5.2, §8.1).
 *
 * 키 하나가 두 가지를 다 한다. flow REST 전부가 `x-flow-api-key`로 돌고(`lib/flow/rest.ts`),
 * 그 키가 누구 것인지는 `/user/employees/me`가 답한다 — 그래서 **키 소유자 = 로그인한 사람**이다.
 *
 * 예전에는 여기서 키만 받고 로그인은 OAuth로 넘겼는데, 그쪽에는 토큰으로 사람을 알아낼 길이
 * 없어서(`lib/auth.ts` 주석) 결국 이 `/me` 응답으로 대조하고 있었다. 한 단계가 통째로 사라진
 * 것뿐이고 검증은 그대로다 — **유효한 키 + 소유자가 `@traport.com`.**
 *
 * 무효한 키를 봉인해 두면 다음부터 조용히 열화된 화면이 뜨는데, 사용자는 키를 넣었다고
 * 믿고 있어서 원인을 못 찾는다. 그래서 넣는 자리에서 한 번 불러 보고 이름을 되읽어 준다.
 *
 * `"use server"` 파일이라 **async 함수와 타입만** 내보낸다 (BUG-008).
 */

import { cookies } from "next/headers";
import {
  type Session,
  API_KEY_COOKIE,
  API_KEY_MAX_AGE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  cookieOptions,
  getApiKey,
  isTraport,
  seal,
} from "@/lib/auth";
import { getMe } from "@/lib/flow/rest";

export interface ApiKeyResult {
  ok: boolean;
  message: string;
}

/**
 * 키를 확인하고 세션을 연다.
 *
 * 폼에 키가 없으면 이미 등록해 둔 키로 그냥 로그인한다 — 키 쿠키는 1년이라 세션(7일)이
 * 끊겨도 다시 붙여 넣을 일이 없다. 그 키가 죽어 있으면 실패 문구가 올라가고, 화면이
 * 키 입력 모달을 다시 연다 (`api-key-gate.tsx`).
 */
export async function signIn(form: FormData): Promise<ApiKeyResult> {
  const typed = String(form.get("apiKey") ?? "").trim();
  const apiKey = typed || (await getApiKey());
  if (!apiKey) return { ok: false, message: "flow에서 발급한 API 키를 넣어주세요." };

  let me;
  try {
    me = await getMe(apiKey);
  } catch {
    // 무효한 키·네트워크 오류를 구분하지 않는다. 어느 쪽이든 사용자가 할 일은 같다.
    // 키 값은 메시지에도 로그에도 남기지 않는다 (PRD §8.1).
    return { ok: false, message: "flow에서 발급한 키가 맞는지 다시 확인해주세요." };
  }

  if (!isTraport(me)) {
    return { ok: false, message: "트래포트 계정으로 발급한 키만 쓸 수 있어요." };
  }

  // 쿠키에는 화면이 쓰는 여섯 줄만 담는다 — `/me`는 휴대폰 번호까지 주는데 우리가 쓰지도
  // 않는 개인정보를 브라우저에 얹어 둘 이유가 없다.
  const session: Session = {
    userId: me.userId,
    fullname: me.fullname,
    divisionCode: me.divisionCode,
    divisionName: me.divisionName,
    responsibility: me.responsibility,
    email: me.email,
  };

  const jar = await cookies();
  jar.set(API_KEY_COOKIE, await seal(apiKey), cookieOptions(API_KEY_MAX_AGE));
  jar.set(SESSION_COOKIE, await seal(session), cookieOptions(SESSION_MAX_AGE));

  // 이름을 되읽어 준다. 남의 키를 잘못 붙여넣었으면 여기서 바로 보인다.
  return { ok: true, message: `${me.fullname || me.userId}님으로 로그인했어요.` };
}
