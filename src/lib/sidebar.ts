/**
 * 좌측 사이드바 접힘 (PRD §7.3).
 *
 * 밝기와 같은 이유로 쿠키다 — 서버가 첫 HTML을 그릴 때 폭을 알아야 화면이 240px로 한 번
 * 그려졌다 68px로 접히지 않는다 (`app/(app)/layout.tsx` → `AppShell`).
 *
 * 기본은 펼침이다. 값이 없거나 모르는 값이면 펼친다 — 처음 온 사람에게는 라벨이 보이는 쪽이
 * 낫고, 접는 건 한 번 눌러 보면 알 수 있다.
 */

/** 민감한 값이 아니라 httpOnly가 아니다 — 브라우저에서 바로 쓴다 (`motion/animated-sidebar.tsx`). */
export const SIDEBAR_COOKIE = "sidebar";

/** 쿠키 값 → 펼침 여부. `"0"`만 접힘이다. */
export function toSidebarOpen(value: string | undefined): boolean {
  return value !== "0";
}
