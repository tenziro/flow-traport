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

/**
 * 예외는 로그인 경로와 정적 에셋뿐이다.
 *
 * 에셋은 이름이 아니라 **확장자**로 뺀다. 전에는 `favicon.ico` 하나만 이름으로 적혀 있어서
 * 아이콘·매니페스트를 추가한 순간 전부 `/login`으로 튕겼다 (307). 아이콘과 매니페스트는
 * 비밀이 아니고, 앞으로 에셋을 더 넣어도 이 줄을 고칠 일이 없다.
 */
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|fonts|.*\\.(?:ico|png|jpg|svg|webmanifest)$).*)",
  ],
};
