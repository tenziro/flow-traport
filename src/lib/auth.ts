/**
 * flow OAuth 2.1 + 세션 쿠키 (PRD §5.2, §8.1).
 *
 * - Authorization Code + PKCE(S256). AS가 RFC 8707 `resource`를 필수로 요구하고,
 *   등록된 MCP 서버만 값으로 받는다 → `https://flow.team/ai/mcp` 고정.
 * - 토큰은 **브라우저에 절대 노출하지 않는다.** AES-256-GCM으로 봉인한 httpOnly 쿠키에만 둔다.
 * - Web Crypto만 쓴다 (Node / Edge 양쪽에서 동작).
 */

import { cookies } from "next/headers";

const RESOURCE = "https://flow.team/ai/mcp";
export const SESSION_COOKIE = "fc_session";
export const PKCE_COOKIE = "fc_pkce";

/** 회사 검증 (PRD §8.1). MCP 프로필은 inttId를 주지 않아 이메일 도메인으로 판정한다. */
const ALLOWED_DOMAIN = "@traport.com";

export interface FlowProfile {
  userId: string;
  fullname: string;
  divisionCode: string;
  divisionName: string;
  responsibility: string;
  email: string;
}

export interface Session extends FlowProfile {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms */
  expiresAt: number;
}

export interface PkceState {
  state: string;
  verifier: string;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 없음`);
  return v;
}

export function isTraport(profile: FlowProfile): boolean {
  return (profile.email || profile.userId).toLowerCase().endsWith(ALLOWED_DOMAIN);
}

/* ── OAuth ─────────────────────────────────────────────────────────────── */

export async function createPkce(): Promise<PkceState & { challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return {
    state: b64url(crypto.getRandomValues(new Uint8Array(16))),
    verifier,
    challenge: b64url(new Uint8Array(digest)),
  };
}

export function authorizeUrl(state: string, challenge: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env("FLOW_CLIENT_ID"),
    redirect_uri: env("FLOW_REDIRECT_URI"),
    scope: "user",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: RESOURCE,
  });
  return `${env("FLOW_OAUTH_ISSUER")}/authorize?${params}`;
}

export function exchangeCode(code: string, verifier: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: env("FLOW_REDIRECT_URI"),
    code_verifier: verifier,
    resource: RESOURCE,
  });
}

export function refreshTokens(refreshToken: string) {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    resource: RESOURCE,
  });
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const basic = b64(`${env("FLOW_CLIENT_ID")}:${env("FLOW_CLIENT_SECRET")}`);
  const res = await fetch(`${env("FLOW_OAUTH_ISSUER")}/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const json = (await res.json()) as TokenResponse & { error_description?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`토큰 요청 실패 (${res.status}): ${json.error_description ?? json.error ?? ""}`);
  }
  return json;
}

/* ── 세션 쿠키 ─────────────────────────────────────────────────────────── */

/** 만료 60초 전부터는 만료된 것으로 본다. 렌더 도중에 죽는 토큰을 피한다. */
const EXPIRY_MARGIN_MS = 60_000;

/** 세션 쿠키 수명. 액세스 토큰(1시간)은 프록시가 refresh_token으로 갱신한다. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function isExpired(session: Session): boolean {
  return session.expiresAt - EXPIRY_MARGIN_MS <= Date.now();
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  return raw ? unseal<Session>(raw) : null;
}

/** 쿠키 옵션. 토큰이 들어 있으므로 httpOnly는 타협 불가. */
export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/* ── AES-256-GCM 봉인 ──────────────────────────────────────────────────── */

let cachedKey: Promise<CryptoKey> | null = null;

function sealKey(): Promise<CryptoKey> {
  cachedKey ??= (async () => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env("SESSION_SECRET")));
    return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
  })();
  return cachedKey;
}

export async function seal(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await sealKey(),
    new TextEncoder().encode(JSON.stringify(value)),
  );
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), iv.length);
  return b64url(out);
}

/** 변조·키 교체·형식 오류는 전부 null. 호출부는 "로그인 안 됨"으로 처리하면 된다. */
export async function unseal<T>(raw: string): Promise<T | null> {
  try {
    const bytes = fromB64url(raw);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.subarray(0, 12) },
      await sealKey(),
      bytes.subarray(12),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

function b64(s: string): string {
  return btoa(s);
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
