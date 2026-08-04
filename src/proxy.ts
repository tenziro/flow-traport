import { type NextRequest, NextResponse } from "next/server";
import { type Session, SESSION_COOKIE, unseal } from "@/lib/auth";

/**
 * 로그인 게이트.
 *
 * 세션에 자격증명이 없어서 갱신할 것도 없다 — 봉인이 풀리면 통과, 아니면 `/login`이다.
 * 만료는 쿠키 수명(`SESSION_MAX_AGE`)이 브라우저 쪽에서 처리한다.
 */
export async function proxy(req: NextRequest) {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (raw && (await unseal<Session>(raw))) return NextResponse.next();

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
