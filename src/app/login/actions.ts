"use server";

/**
 * 개인 flow API 키 등록 (로그인 직전).
 *
 * REST 세 호출(`lib/flow/rest.ts`)이 API 키 소유자 기준으로 돌기 때문에, 공용 키로는
 * 멘션 본문이 비고 댓글이 막힌다. 자기 키를 넣으면 셋 다 자기 기준으로 돌아간다.
 *
 * **로그인 전에 받는다.** 그래서 세션이 아직 없고, 키는 세션이 아니라 별도 봉인 쿠키
 * (`API_KEY_COOKIE`)에 넣는다 (`lib/auth.ts` 주석).
 *
 * 검증은 `/user/projects` 한 번이다. 응답이 오면 유효한 키다 — 목록 내용은 버린다.
 * 무효한 키를 봉인해 두면 다음 로그인부터 조용히 열화된 화면이 뜨는데, 사용자는 키를
 * 넣었다고 믿고 있어서 원인을 못 찾는다.
 *
 * `"use server"` 파일이라 **async 함수와 타입만** 내보낸다 (BUG-008).
 */

import { cookies } from "next/headers";
import { API_KEY_COOKIE, API_KEY_MAX_AGE, cookieOptions, seal } from "@/lib/auth";
import { listProjects } from "@/lib/flow/rest";

export interface ApiKeyResult {
  ok: boolean;
  message: string;
}

export async function saveApiKey(form: FormData): Promise<ApiKeyResult> {
  const apiKey = String(form.get("apiKey") ?? "").trim();
  if (!apiKey) return { ok: false, message: "flow에서 발급한 API 키를 넣어주세요." };

  try {
    await listProjects(apiKey);
  } catch {
    // 무효한 키·네트워크 오류를 구분하지 않는다. 어느 쪽이든 사용자가 할 일은 같다.
    // 키 값은 메시지에도 로그에도 남기지 않는다 (PRD §8.1).
    return { ok: false, message: "flow에서 발급한 키가 맞는지 다시 확인해주세요." };
  }

  (await cookies()).set(API_KEY_COOKIE, await seal(apiKey), cookieOptions(API_KEY_MAX_AGE));
  return { ok: true, message: "키를 등록했어요. flow 로그인으로 넘어가요." };
}
