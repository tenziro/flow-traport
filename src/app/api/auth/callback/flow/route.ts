import { type NextRequest, NextResponse } from "next/server";
import {
  type FlowProfile,
  type PkceState,
  type Session,
  API_KEY_COOKIE,
  PKCE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  cookieOptions,
  exchangeCode,
  getApiKey,
  isTraport,
  seal,
  unseal,
} from "@/lib/auth";
import { createFlowMcp } from "@/lib/flow/mcp";
import { getMe } from "@/lib/flow/rest";

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

    /*
     * API 키 소유자와 로그인한 사람이 같은지 본다 (PRD §13 B6).
     *
     * 둘은 출처가 다르다 — 세션은 OAuth 토큰에서, REST는 봉인 쿠키의 개인 키에서 온다.
     * 어긋나면 화면은 **키 주인의 데이터**를 로그인한 사람 이름 아래에 그린다. 남의 멘션과
     * 남의 프로젝트가 자기 것으로 보이고, 쓰기는 남의 이름으로 나간다.
     *
     * 그래서 여기서 막는다. 확인이 안 되면 통과시키지 않는다.
     *
     * 쿠키를 먼저 꺼내 그 키를 **명시로** 넘긴다. 인자 없이 `getMe()`를 부르면 키가 없을 때
     * 서버 공용 키(`FLOW_API_KEY`)로 떨어져서 엉뚱한 사람을 소유자로 답한다.
     */
    const apiKey = await getApiKey();
    if (!apiKey) return deny(req, "flow API 키를 먼저 등록해주세요.");

    const owner = await getMe(apiKey).then((me) => me.userId).catch(() => null);
    if (!owner) {
      return deny(req, "등록한 API 키를 flow가 확인해주지 않았어요. 다시 등록해주세요.");
    }
    if (owner.toLowerCase() !== profile.userId.toLowerCase()) {
      // 봉인 쿠키를 같이 지운다. 로그인 화면에는 등록한 키를 갈아 끼우는 자리가 없어서
      // (login/page.tsx) 키를 남겨 두면 모달이 안 뜨고 같은 오류만 반복된다.
      return deny(req, "등록한 API 키가 다른 사람 키예요. 자기 키로 다시 등록해주세요.", true);
    }

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

function deny(req: NextRequest, message: string, clearKey = false) {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", message);
  const res = NextResponse.redirect(url);
  res.cookies.delete(PKCE_COOKIE);
  res.cookies.delete(SESSION_COOKIE);
  // 기본은 남긴다. 만료된 로그인 시도나 일시적 실패로 멀쩡한 키를 지우면 다시 발급받아야 한다.
  if (clearKey) res.cookies.delete(API_KEY_COOKIE);
  return res;
}
