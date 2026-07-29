"use client";

import { useState } from "react";
import { IconDark, IconLight, IconSystem } from "@/components/icons";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * 밝기 고르기 — 밝게 · 어둡게 · 기기 설정.
 *
 * 라디오 버튼 세 개다. `<button>` 세 개로 만들면 좌우 화살표 이동과 그룹 이름을 직접
 * 붙여야 하는데, 라디오는 브라우저가 이미 그렇게 다룬다 — 입력은 숨기고 라벨만 칠했다.
 *
 * 서버를 거치지 않는다. 클래스는 그 자리에서 갈아끼우고, 쿠키는 **다음 요청**의 첫
 * HTML을 위해 남긴다. 서버 액션으로 돌리면 색이 바뀌기까지 왕복 한 번이 걸린다.
 */
const OPTIONS = [
  { value: "light", label: "밝게", Icon: IconLight },
  { value: "dark", label: "어둡게", Icon: IconDark },
  { value: "system", label: "기기 설정", Icon: IconSystem },
] as const satisfies readonly { value: Theme; label: string; Icon: typeof IconLight }[];

/** 1년. 그 사이 한 번도 안 바꿨다면 다시 물어봐도 될 만큼 지난 값이다. */
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * 문서에 바로 반영한다. 컴포넌트 밖인 이유는 React 컴파일러 때문이다 — 렌더 함수 안에서
 * 바깥 값(`document.cookie`)에 대입하면 렌더가 순수하지 않다고 잡는다. 실제로도 이건
 * 렌더가 아니라 클릭이 하는 일이다.
 */
function apply(next: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (next !== "system") root.classList.add(next);
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

export function ThemeToggle({ theme: initial }: { theme: Theme }) {
  const [theme, setTheme] = useState(initial);

  function pick(next: Theme) {
    setTheme(next);
    apply(next);
  }

  return (
    <fieldset className="flex shrink-0 items-center gap-0.5 rounded-full bg-muted p-0.5">
      <legend className="sr-only">화면 밝기</legend>
      {OPTIONS.map(({ value, label, Icon }) => {
        const on = theme === value;
        return (
          <label
            key={value}
            title={label}
            className={cn(
              "flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              // 밝게에서는 판(`muted`)과 알약(`background`)의 차이가 얇다 — 그림자가
              // 그 경계를 대신한다. 어둡게에서는 그림자가 안 보이지만 두 색 차이가 크다.
              on
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={on}
              onChange={() => pick(value)}
              className="sr-only"
            />
            <Icon size={14} />
            <span className="sr-only">{label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
