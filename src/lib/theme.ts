/**
 * 화면 밝기 (PRD §7.1).
 *
 * 고른 값은 쿠키에 둔다. `localStorage`였다면 서버가 첫 HTML을 그릴 때 알 수 없어서
 * 화면이 한 번 어두웠다 밝아진다 — 쿠키는 요청에 실려 오니 `<html>` 클래스를 처음부터
 * 맞게 박을 수 있다 (`app/layout.tsx`).
 *
 * `system`은 클래스를 안 붙인다. 그러면 `globals.css`의 `color-scheme: light dark`가
 * 그대로라 기기 설정을 따른다 — 기기가 바뀌는 걸 지켜보는 코드가 필요 없다.
 */
export type Theme = "light" | "dark" | "system";

/** 민감한 값이 아니라 httpOnly가 아니다 — 브라우저에서 바로 쓴다 (`theme-toggle.tsx`). */
export const THEME_COOKIE = "theme";

/** 쿠키 값 → 테마. 모르는 값은 기기 설정으로 떨어진다. */
export function toTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
