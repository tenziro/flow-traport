"use client";

import { useState } from "react";
import { IconDark, IconLight, IconSystem } from "@/components/icons";
import { nextTheme, THEME_COOKIE, type Theme } from "@/lib/theme";
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

/** 갈래 → 라벨·아이콘. `ThemeCycle`이 지금 갈래를 그릴 때 쓴다. */
const BY_VALUE = Object.fromEntries(OPTIONS.map((o) => [o.value, o])) as Record<
  Theme,
  (typeof OPTIONS)[number]
>;

/**
 * 다음 갈래를 부르는 말. 조사까지 적어 둔다 — "기기 설정"만 받침이 있어서 "으로"이고,
 * 라벨에 조사를 붙여 조립하면 "기기 설정로"가 된다. 세 개뿐이라 규칙을 계산할 이유가 없다.
 */
const NEXT_PHRASE: Record<Theme, string> = {
  light: "밝게로",
  dark: "어둡게로",
  system: "기기 설정으로",
};

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
    <fieldset className="flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5">
      <legend className="sr-only">화면 밝기</legend>
      {OPTIONS.map(({ value, label, Icon }) => {
        const on = theme === value;
        return (
          <label
            key={value}
            title={label}
            className={cn(
              // 판이 `rounded-md`(6px)이고 안쪽 여백이 2px이라 칸은 `rounded-sm`(4px)이다
              "flex size-7 cursor-pointer items-center justify-center rounded-sm transition-colors",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              // 밝게에서는 판(`muted`)과 켠 칸(`background`)의 차이가 얇다 — 그림자가
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

/**
 * 같은 일을 버튼 하나로 — 헤더 레일용.
 *
 * 레일의 한 항목은 한 컨트롤이라 라디오 세 개가 들어갈 자리가 없다. 누르면 다음 갈래로
 * 넘어간다 (`nextTheme`). 라디오 판을 대신하는 게 아니라 좁은 자리를 위한 다른 모양이라
 * 위의 `ThemeToggle`은 그대로 둔다.
 *
 * 보이는 텍스트는 **지금 갈래**이고 `aria-label`이 **누르면 될 갈래**까지 알린다. 텍스트만
 * "밝게"면 눌렀을 때 밝아질 거라고 읽힌다. 펼침/접힘처럼 `aria-expanded`에 맡길 상태가
 * 아니라서 라벨이 직접 말해야 한다.
 */
export function ThemeCycle({ theme: initial }: { theme: Theme }) {
  const [theme, setTheme] = useState(initial);
  const { label, Icon } = BY_VALUE[theme];

  return (
    <button
      type="button"
      aria-label={`화면 밝기 — ${label}. 눌러서 ${NEXT_PHRASE[nextTheme(theme)]} 바꿔요`}
      onClick={() => {
        const value = nextTheme(theme);
        setTheme(value);
        apply(value);
      }}
      className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-background px-2.5 font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Icon size={14} />
      {/* 좁은 화면에서는 아이콘만 남긴다 — `SignOut`이 이미 쓰는 패턴이다 */}
      <span className="sr-only text-xs lg:not-sr-only">{label}</span>
    </button>
  );
}
