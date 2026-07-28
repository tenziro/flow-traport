import { type NextRequest, NextResponse } from "next/server";
import {
  type Session,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  cookieOptions,
  isExpired,
  refreshTokens,
  seal,
  unseal,
} from "@/lib/auth";

/**
 * 로그인 게이트 + 액세스 토큰 갱신.
 *
 * 갱신을 여기서 하는 이유: 페이지 렌더 중에는 쿠키를 쓸 수 없다. 프록시는 쓸 수 있고,
 * 요청 쿠키까지 같이 바꿔주면 같은 요청의 렌더가 새 토큰을 본다.
 */
export async function proxy(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  const session = raw ? await unseal<Session>(raw) : null;
  if (!session) return toLogin(req);
  if (!isExpired(session)) return NextResponse.next();
  if (!session.refreshToken) return toLogin(req);

  let sealed: string;
  try {
    const token = await refreshTokens(session.refreshToken);
    sealed = await seal({
      ...session,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? session.refreshToken,
      expiresAt: Date.now() + token.expires_in * 1000,
    } satisfies Session);
  } catch {
    return toLogin(req);
  }

  req.cookies.set(SESSION_COOKIE, sealed);
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set(SESSION_COOKIE, sealed, cookieOptions(SESSION_MAX_AGE));
  return res;
}

function toLogin(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|fonts|favicon.ico).*)"],
};
