/**
 * 세션 쿠키 (PRD §5.2, §8.1).
 *
 * **로그인 = 개인 flow API 키 등록이다.** 키를 받아 `GET /user/employees/me`로 소유자를
 * 확인하고(`app/login/actions.ts`), 그 프로필을 봉인해 세션 쿠키에 담는다.
 *
 * OAuth를 걷어낸 이유: 발급받은 토큰으로 사람을 알아낼 길이 REST에 없다. AS 메타데이터에
 * userinfo 엔드포인트가 없고 `openid-configuration`도 404다 — 토큰→신원 변환은 MCP
 * `flow_get_my_profile` 하나뿐이었다 `(실측 2026-08-04)`. 그리고 예전 콜백도 결국
 * "키 소유자와 OAuth 사용자가 같은 사람인가"를 확인했으므로, 검증 강도는 그대로다:
 * **유효한 개인 키 + 그 소유자가 `@traport.com`.**
 *
 * 키와 프로필은 **브라우저에 절대 노출하지 않는다.** AES-256-GCM으로 봉인한 httpOnly
 * 쿠키에만 둔다. Web Crypto만 쓴다 (Node / Edge 양쪽에서 동작).
 */

import { cookies } from "next/headers";

export const SESSION_COOKIE = "fc_session";

/** 회사 검증 (PRD §8.1). 프로필이 inttId를 주긴 하지만 값 대조표가 없어 이메일 도메인으로 판정한다. */
export const ALLOWED_DOMAIN = "@traport.com";

/** `GET /user/employees/me` 응답 중 우리가 쓰는 것 (api-spec §3.1). */
export interface FlowProfile {
  userId: string;
  fullname: string;
  divisionCode: string;
  divisionName: string;
  responsibility: string;
  email: string;
}

/**
 * 세션에 담는 것 = 프로필 그대로다. 자격증명은 여기 없다 — 키는 따로 봉인한
 * `fc_key` 쿠키에 있고(`getApiKey`), 세션은 "누구인가"만 들고 있다.
 */
export type Session = FlowProfile;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 없음`);
  return v;
}

export function isTraport(profile: FlowProfile): boolean {
  return (profile.email || profile.userId).toLowerCase().endsWith(ALLOWED_DOMAIN);
}

/* ── 세션 쿠키 ─────────────────────────────────────────────────────────── */

/** 세션 쿠키 수명. 만료되면 로그인 화면으로 가지만 키 쿠키(1년)는 남아 다시 안 묻는다. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  return raw ? unseal<Session>(raw) : null;
}

/* ── 개인 flow API 키 ──────────────────────────────────────────────────── */

/**
 * REST(`lib/flow/rest.ts`)가 쓰는 개인 API 키. **세션과 따로 둔다.**
 *
 * 같이 담으면 세션 만료(7일)마다 키를 다시 물어야 한다. flow는 키를 만료시키지 않으니
 * 쿠키만 길게 두면 한 번 넣고 끝이고, 로그아웃해도 다시 붙여 넣을 일이 없다 —
 * "한 번 등록하면 다시 묻지 않아요"가 그래서 지켜진다.
 *
 * 봉인은 세션과 같은 AES-256-GCM이다. 키는 그 사람 권한 전체를 여는 장기 자격증명이라
 * `httpOnly`는 타협 불가.
 */
export const API_KEY_COOKIE = "fc_key";

/** 1년. flow가 키를 만료시키지 않아서 세션(7일)에 묶을 이유가 없다. */
export const API_KEY_MAX_AGE = 60 * 60 * 24 * 365;

export async function getApiKey(): Promise<string | null> {
  const raw = (await cookies()).get(API_KEY_COOKIE)?.value;
  return raw ? unseal<string>(raw) : null;
}

/** 쿠키 옵션. 자격증명이 들어 있으므로 httpOnly는 타협 불가. */
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
