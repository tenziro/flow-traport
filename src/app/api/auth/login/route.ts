import { NextResponse } from "next/server";
import {
  PKCE_COOKIE,
  authorizeUrl,
  cookieOptions,
  createPkce,
  getApiKey,
  seal,
} from "@/lib/auth";

/** flow 로그인 시작. state·code_verifier는 봉인 쿠키에 담아 콜백까지 나른다. */
export async function GET(req: Request) {
  // 개인 API 키가 먼저다. 화면(`login/api-key-gate.tsx`)이 모달로 막지만 이 주소를 직접
  // 열면 우회된다 — 키 없이 로그인하면 멘션 본문이 빈 화면이 서기 때문에 여기서도 막는다.
  if (!(await getApiKey())) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", "flow API 키를 먼저 등록해주세요.");
    return NextResponse.redirect(url);
  }

  const { state, verifier, challenge } = await createPkce();
  const res = NextResponse.redirect(authorizeUrl(state, challenge));
  res.cookies.set(PKCE_COOKIE, await seal({ state, verifier }), cookieOptions(600));
  return res;
}
