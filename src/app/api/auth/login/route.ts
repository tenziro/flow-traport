import { NextResponse } from "next/server";
import { PKCE_COOKIE, authorizeUrl, cookieOptions, createPkce, seal } from "@/lib/auth";

/** flow 로그인 시작. state·code_verifier는 봉인 쿠키에 담아 콜백까지 나른다. */
export async function GET() {
  const { state, verifier, challenge } = await createPkce();
  const res = NextResponse.redirect(authorizeUrl(state, challenge));
  res.cookies.set(PKCE_COOKIE, await seal({ state, verifier }), cookieOptions(600));
  return res;
}
