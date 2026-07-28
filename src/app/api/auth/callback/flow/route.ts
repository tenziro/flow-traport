import { type NextRequest, NextResponse } from "next/server";
import {
  type FlowProfile,
  type PkceState,
  type Session,
  PKCE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  cookieOptions,
  exchangeCode,
  isTraport,
  seal,
  unseal,
} from "@/lib/auth";
import { createFlowMcp } from "@/lib/flow/mcp";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  if (params.get("error")) {
    return deny(req, params.get("error_description") || params.get("error")!);
  }

  const code = params.get("code");
  const pkce = await unseal<PkceState>(req.cookies.get(PKCE_COOKIE)?.value ?? "");
  // state 불일치 = CSRF 또는 만료된 로그인 시도. 어느 쪽이든 진행하지 않는다.
  if (!code || !pkce || pkce.state !== params.get("state")) {
    return deny(req, "로그인 요청이 만료됐어요. 다시 시도해주세요.");
  }

  let session: Session;
  try {
    const token = await exchangeCode(code, pkce.verifier);
    const profile = await createFlowMcp(token.access_token).call<FlowProfile>("flow_get_my_profile");

    // PRD §8.1 — 트래포트 소속이 아니면 세션을 만들지 않는다.
    if (!isTraport(profile)) return deny(req, "트래포트 계정으로 로그인할 수 있어요.");

    session = {
      ...profile,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    };
  } catch (e) {
    return deny(req, e instanceof Error ? e.message : "로그인하지 못했어요. 다시 시도해주세요.");
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(SESSION_COOKIE, await seal(session), cookieOptions(SESSION_MAX_AGE));
  res.cookies.delete(PKCE_COOKIE);
  return res;
}

function deny(req: NextRequest, message: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", message);
  const res = NextResponse.redirect(url);
  res.cookies.delete(PKCE_COOKIE);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
