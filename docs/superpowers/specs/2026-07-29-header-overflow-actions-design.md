# 헤더 오버플로 레일 · 타이틀 스윕 설계

**날짜** 2026-07-29
**버전** 0.21.0 → 0.22.0 (추가)

> 처음 쓸 때는 0.20.2 → 0.21.0이었다. 그 사이 화면 톤·모서리 정리가 0.21.0을 먹었고,
> **그 작업이 알약을 다 없앴다**. 아래의 "알약 레일"은 모서리 8px 카드 레일로 읽는다 —
> 트랙 8px(`rounded-lg`), 안쪽 항목 6px(`rounded-md`), 이니셜 원판만 원이다(지름 = 높이).

## 배경

헤더 1행 오른쪽에 검색 · 밝기 3알약 · 알림 종 · 세로선 · 이니셜 원판 · 이름/부서 두 줄 · 세로선 · 로그아웃이 한 줄로 늘어서 있다. 여섯 덩어리다. 지금 배열에는 이유가 있고([app-shell.tsx](../../../src/components/app-shell.tsx) 69~75행 주석) 그 이유는 유효하지만, 덩어리 수 자체가 많아 헤더가 붐빈다.

밝기 · 알림 · 사용자 정보 · 로그아웃을 beUI `overflow-actions` 형태의 레일 하나로 묶는다. 검색은 밖에 남는다.

## 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 목적 | 시각 정리 | 폭 확보나 오조작 방지가 아니라 덩어리 수 줄이기 |
| 이름·부서 | 접힘 안으로 | 헤더에서 가장 넓은 자리를 차지한다. 이니셜 원판만 남는다 |
| 검색(⌘K) | 레일 밖 그대로 | 목적지가 아니라 경유지이고 상태 컨트롤과 성격이 다르다 |
| 밝기 | 순환 버튼 하나 | 레일 항목 하나 = 버튼 하나. 세 갈래 라디오는 레일에 안 맞는다 |
| 알림 | 레일 안, 상시 노출 | 안 읽음 배지가 접히면 신호가 죽는다 |
| 로그아웃 | 접힘 안, 맨 끝 | 자주 쓰지 않고, 알림 종에서 가장 멀어진다 |

## beUI 원본의 제약

`OverflowActionItem`은 `{ id, label, icon?, onClick?, disabled?, ariaLabel? }`이고 내부에서 `<button type="button">`으로 렌더된다. 자식을 받지 못한다. 묶으려는 넷 중 셋이 버튼이 아니다.

| 대상 | 실제 정체 | 항목 API로 안 되는 이유 |
|---|---|---|
| 밝기 | `<fieldset>` + 라디오 3개 | 세 갈래 선택이 버튼 하나로 접히지 않는다 |
| 알림 | Radix `Popover` 트리거 + 배지 | 트리거 엘리먼트를 넘겨야 하는데 `asChild` 자리가 없다. 배지 슬롯도 없다 |
| 이름·부서 | 텍스트 두 줄 | 액션이 아니라 정보다 |
| 로그아웃 | `<form method="post">` 서브밋 | `type="button"` + `onClick`뿐이다 |

토글 원판의 아이콘(`MoreHorizontal` / `X`)도 하드코딩이라 이니셜로 갈아낼 수 없다. `classNames.toggle`로 클래스만 덮을 수 있다.

**따라서 원본을 슬롯 방식으로 고쳐 vendoring한다.** 항목 배열 API로 우회하는 길(배지를 `label` `ReactNode`에 밀어넣고, 팝오버를 `PopoverAnchor` 기반 제어형으로 재작성하고, 로그아웃은 숨은 폼에 `requestSubmit()`을 쏘는 방식)은 코드가 더 늘고 이름·부서가 아무 일도 안 하는 가짜 버튼이 되며, 이니셜 원판을 토글로 만들지 못한다.

---

## 1. 파일과 경계

### 새로 만든다

**`src/components/motion/overflow-actions.tsx`**

beUI 원본을 받아 항목 배열 prop을 슬롯으로 갈아낸다.

```ts
interface OverflowActionsProps {
  /** 접어도 늘 보이는 자리. */
  children: ReactNode;
  /** 토글을 눌렀을 때 벌어지는 자리. */
  overflow: ReactNode;
  /** 토글 원판 안. 없으면 `···` / `X`. */
  toggle?: ReactNode;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  openLabel?: string;
  closeLabel?: string;
  className?: string;
  classNames?: { root?: string; track?: string; overflow?: string; toggle?: string };
}
```

원본에서 **살린다** — `SHELL_TRANSITION` 스프링(`stiffness 220 / damping 17 / mass 0.85`), 접힐 때 펼침 그룹이 제자리에 남아 사라지게 하는 `useLayoutEffect` 위치 보정, `AnimatePresence mode="popLayout"`, `useControllableExpanded`, `useReducedMotion`, `useHoverCapable`, blur-in 변이.

원본에서 **버린다** — `OverflowActionItem`, `ActionButton`, `onAction`, `collapseOnAction`, `size`와 그에 딸린 사이즈 클래스 맵 다섯 개(`TRACK_SIZE_CLASS` · `GROUP_GAP_CLASS` · `ACTION_SIZE_CLASS` · `TOGGLE_SIZE_CLASS` · `ICON_SIZE_CLASS`). 크기는 한 종류만 쓰니 상수로 인라인한다. 원본 항목의 `tabIndex={-1}` / `aria-hidden`도 버린다 — 펼침 슬롯은 `AnimatePresence`가 unmount하므로 DOM에 없다.

원본에서 **고친다** — 트랙의 `rounded-full`을 `rounded-lg`(8px)로. v0.21.0에서 앱의 알약을 다 없앴다. 안쪽 항목은 호출부가 각자 `rounded-md`(6px)를 쓴다 — 항목이 슬롯이라 레일이 강제하지 않는다. 토글은 이니셜 원판이라 `rounded-full`을 유지한다(지름 = 높이인 원은 그대로 두는 게 이 앱의 규칙이다).

의존 파일 [src/lib/ease.ts](../../../src/lib/ease.ts)(`EASE_OUT`)와 [src/lib/hooks/use-hover-capable.ts](../../../src/lib/hooks/use-hover-capable.ts)는 이미 프로젝트에 있다. 새로 받을 것이 없다.

### 고친다

**[src/components/app-shell.tsx](../../../src/components/app-shell.tsx)** — 액션 묶음(76~96행)을 레일 한 덩어리로 바꾼다. `SignOut`은 레일 안으로 옮긴다. `SearchPalette`는 레일 밖 왼쪽에 남는다. 세로선 두 개는 사라진다. 브랜드 `<span>`(65~67행)은 `ChromaticTextReveal`로 바뀐다(§3).

**[src/components/theme-toggle.tsx](../../../src/components/theme-toggle.tsx)** — 같은 파일에 `ThemeCycle`을 나란히 둔다. `apply()` · `THEME_COOKIE` · `ONE_YEAR` · `IconLight/IconDark/IconSystem`을 그대로 쓰기 때문에 새 파일을 만들지 않는다. 기존 `ThemeToggle`(라디오 3개)은 지우지 않는다 — 다른 사용처가 있는지 grep으로 확인하고, 없으면 지울지 따로 묻는다.

**[src/lib/theme.ts](../../../src/lib/theme.ts)** — `nextTheme(theme: Theme): Theme` 추가(§5).

**[src/components/motion/chromatic-text-reveal.tsx](../../../src/components/motion/chromatic-text-reveal.tsx)** — `repeatDelay` prop과 `SWEEP_CHART` 색 배열 추가(§3).

**[src/app/login/page.tsx](../../../src/app/login/page.tsx)** — 지역 상수 `SWEEP`을 지우고 `SWEEP_CHART`를 import한다.

### 건드리지 않는다

[news-bell.tsx](../../../src/components/news-bell.tsx) · [search-palette.tsx](../../../src/components/search-palette.tsx) · [ui/popover.tsx](../../../src/components/ui/popover.tsx) · [lib/ease.ts](../../../src/lib/ease.ts) · [lib/hooks/use-hover-capable.ts](../../../src/lib/hooks/use-hover-capable.ts). 알림 종은 지금 코드 그대로 트랙 안에 들어간다.

`PopoverContent`가 `PopoverPrimitive.Portal` 안에 있어서 트랙의 `overflow-hidden`에 잘리지 않는다.

---

## 2. 접힘·펼침

### 순서

```
접힘   [검색]   ( 🔔³ · (이) )

펼침   [검색]   ( 🔔³ · ☀︎ 밝게 · 이종석 / 기획 · ⏎ 로그아웃 · (이) )
```

DOM 순서는 `children(알림) → overflow(밝기 · 이름·부서 · 로그아웃) → toggle(이니셜)`로 beUI 원본과 같다. 레일이 `ml-auto`로 오른쪽에 붙으니 펼칠 때 트랙은 왼쪽으로 자라고 알림 종이 왼쪽으로 밀린다. 종 팝오버를 열어 둔 채 펼치면 팝오버가 어긋날 것 같지만, 이니셜을 누르는 클릭이 팝오버 바깥 클릭이라 Radix가 `onPointerDownOutside`로 팝오버를 먼저 닫는다(`modal=false`). 그 상태가 발생하지 않는다.

Tab 순서가 시각 순서와 그대로 맞는다 — 알림 → 밝기 → 이름·부서 → 로그아웃 → 이니셜.

### 토글은 이니셜 원판

접힘 `bg-muted`, 펼침 `bg-primary text-primary-foreground`. beUI 원본은 늘 `bg-primary`인데 그러면 아바타가 헤더에서 가장 시끄러운 요소가 된다 — 펼친 동안만 강해지게 뒤집는다.

`X`로 갈아치우지 않는다. 아바타가 글자로 바뀌면 그게 누구 자리인지 사라진다. 펼침 상태는 배경색과 `aria-expanded`가 알린다.

### 닫는 길 셋

이니셜 다시 누르기 / `Escape` / 로그아웃(페이지가 떠나면서 자연히).

바깥 클릭으로는 닫지 않는다. 알림 팝오버 안을 누르는 것도 트랙 바깥이라 잘못 닫히고, 레일은 팝오버가 아니라 헤더의 일부여서 열려 있어도 아무것도 가리지 않는다. 코드에 `ponytail:` 주석으로 남긴다.

`Escape`는 알림 팝오버가 열려 있으면 Radix가 먼저 먹는다 — 팝오버 닫기, 다시 눌러 레일 닫기.

### 포커스

펼칠 때 펼침 그룹의 첫 요소(밝기 버튼)로 포커스를 보내고, 접을 때 토글로 되돌린다. 토글이 DOM 마지막이라 그냥 두면 펼친 직후 `Tab`이 새 항목을 건너뛰고 헤더 밖으로 나간다. 마우스로 눌렀을 때는 `:focus-visible`이라 링이 보이지 않아 영향이 없다.

펼침 그룹에 `role="group" aria-label="내 계정"`을 준다. 포커스가 그룹으로 들어갈 때 그룹 이름이 함께 읽혀서, `aria-expanded` 변화를 놓쳐도 무엇이 열렸는지 전달된다.

### 문구

| 자리 | 값 |
|---|---|
| 이니셜 원판 `aria-label` | `내 계정 — 이종석 · 기획` (실제 이름·부서 보간) |
| 이니셜 원판 `title` | `내 계정` |
| 펼침 그룹 `aria-label` | `내 계정` |
| 밝기 버튼 보이는 텍스트 | `밝게` / `어둡게` / `기기 설정` — 지금 갈래 |
| 밝기 버튼 `aria-label` | `화면 밝기 — 밝게. 눌러서 어둡게로 바꿔요` (갈래에 따라 보간) |
| 로그아웃 | `로그아웃` (지금 그대로) |

펼침/접힘 상태는 라벨에 넣지 않고 `aria-expanded`에 맡긴다. 스크린리더가 "확장됨/축소됨"으로 읽으니 라벨에 동작을 겹쳐 쓰면 두 번 읽힌다.

밝기 버튼은 보이는 텍스트가 **지금 갈래**이고 `aria-label`이 **누르면 될 갈래**까지 알려준다. 텍스트만 "밝게"면 눌렀을 때 밝아질 거라고 읽힌다.

### 이름·부서만 배경이 없다

다른 항목은 `bg-background` 칸(`rounded-md`)인데 이름·부서만 배경 없이 텍스트 두 줄로 둔다. 지금 헤더가 세로선으로 만들어 둔 "여기까지는 정보, 여기부터는 누르는 곳"이라는 경계를 배경 유무가 대신한다. 세로선은 사라진다.

---

## 3. 헤더 타이틀 스윕

로그인 화면의 그것은 `ChromaticTextReveal`(beUI Dia Text Animation)이다. 색 띠가 `Cockpit` 위를 왼쪽에서 오른쪽으로 한 번 쓸고 지나가면서 글자가 blur·lift로 자리를 잡는다. 헤더 브랜드와 로그인 제목은 이미 같은 굵기 대비(`medium` ↔ `extrabold`)를 쓴다.

### 어절이 하나면 반복하지 않는다

`scheduleNextWord`가 `words.length < 2`면 즉시 빠져나간다([chromatic-text-reveal.tsx](../../../src/components/motion/chromatic-text-reveal.tsx) 112행). 반복 장치가 어절을 갈아치우는 방식이라 어절이 하나면 갈 곳이 없다. 로그인 화면은 한 번만 흐르면 되니 문제가 없었다.

`words={['Cockpit','Cockpit']}`로 우회할 수 있다(`sizingWords`가 `Set`으로 중복을 지워 폭도 안 깨진다). 코드가 0줄이지만 "Cockpit을 왜 두 번 적었나"를 나중에 해독해야 한다. 헤더에서 `setInterval`로 `key`를 갱신하는 길은 10초마다 `IntersectionObserver`를 새로 만들고 버린다.

**`repeatDelay` prop을 추가한다.** 어절 순환과 별도로 `cycle` 카운터를 두고 `motion.span`의 키에 섞는다.

```ts
/** 마지막 어절이 끝난 뒤 처음부터 다시. 초 단위. 없으면 한 번만 흐른다. */
repeatDelay?: number;
```

`scheduleNextWord`의 기존 `reduceMotion` 조기 반환을 그대로 타므로 `prefers-reduced-motion`이면 스윕과 반복이 함께 멈춘다.

### 주기

스윕 0.9초 + 쉼 9.1초 = 10초. `delay`는 0이다. 로그인은 로고 → 제목 → 설명 박자에 맞추려 0.7초를 뒀지만 헤더에는 그 순서가 없다.

### 호출부

```tsx
<span className="shrink-0 text-base font-medium">
  <ChromaticTextReveal
    prefix="flow"
    words={['Cockpit']}
    colors={SWEEP_CHART}
    startOnView={false}
    duration={0.9}
    repeatDelay={9.1}
    className="[&>span:last-child]:font-extrabold"
  />
</span>
```

`className`의 `[&>span:last-child]`는 컴포넌트가 내놓는 두 칸 중 뒤 칸(쓸리는 어절과 폭을 재는 숨은 span)을 함께 굵게 만든다. 숨은 span까지 굵어져야 칸이 좁아지지 않는다.

### 색 배열을 옮긴다

지금 `SWEEP`은 [login/page.tsx](../../../src/app/login/page.tsx) 14행에 지역 상수다(`--chart-4 → --chart-1 → --chart-3 → --chart-2`). 두 화면이 같은 색을 써야 하니 `chromatic-text-reveal.tsx`에 `SWEEP_CHART`로 올리고 양쪽이 import한다. 그 파일에 이미 `CHROMATIC_PALETTE` 기본 팔레트가 있어 같은 종류가 같은 자리에 모인다. 로그인 페이지의 지역 `SWEEP`은 지운다.

스크린리더는 지금과 같이 "flow Cockpit"으로 읽는다 — 컴포넌트가 `prefix` 텍스트와 `sr-only` 어절을 함께 내놓는다.

### 알려진 한계

WCAG 2.2.2는 5초 넘게 자동 반복되는 움직임에 정지 수단을 요구한다. 헤더는 늘 보이는 자리라 10초마다 색이 쓸리면 목록을 읽는 동안 주변시에 걸린다. `prefers-reduced-motion`으로 꺼지지만 그건 OS 설정이고 앱 안의 정지 수단은 아니다.

지시대로 넣는다 — 레이아웃이 움직이지 않고 색만 한 번 지나가는 것이라 2.2.2가 겨냥하는 스크롤·점멸 콘텐츠보다 가볍다. 거슬리면 주기를 늘리거나 첫 진입 1회로 줄인다.

---

## 4. 반응형

새 브레이크포인트를 만들지 않는다. 지금 헤더가 쓰는 두 개를 승계한다.

| 자리 | 규칙 | 근거 |
|---|---|---|
| 이름·부서 | `hidden sm:flex` | 지금 이름·부서가 이미 `hidden sm:block`이다 |
| 밝기·로그아웃 텍스트 라벨 | `sr-only lg:not-sr-only` | 지금 `SignOut`이 이미 이 패턴이다 |

펼친 상태 트랙 폭 어림값(패딩 12 + 항목 + gap 6씩):

```
<640px    알림34 + 밝기32 + 로그아웃32 + 이니셜32   ≈ 166px
640~1024  위 + 이름·부서 144                       ≈ 316px
≥1024     위 + 텍스트 라벨(밝기 68 · 로그아웃 64)   ≈ 448px
```

375px에서 브랜드(≈92) + 좌우 여백(32) + gap(16)이 140px이니 남는 ≈235px에 166px이 들어간다. 640px에서는 ≈500px 중 316px. 1024px 이상은 1행에 브랜드와 레일뿐이라 여유가 크다.

**접힌 상태는 어느 폭에서든 ≈84px**이다(패딩 12 + 알림 34 + gap 6 + 이니셜 32). 지금 묶음보다 크게 줄어든다.

숫자는 어림이다. 실제 텍스트 폭은 폰트에 따라 달라지므로 브라우저 확인(§5) 8번에서 네 폭 전부 실측한다.

가로 스크롤은 생기지 않는다(PRD §7.3).

## 모션 감소

레일은 beUI 원본의 `useReducedMotion` 처리를 그대로 쓴다 — 전이를 `{ duration: 0 }`으로 갈아치워 펼침·접힘이 즉시 끝난다. 타이틀 스윕은 §3대로 스윕과 10초 반복이 함께 멈춘다. 포커스 이동은 모션이 아니라 그대로 동작한다.

---

## 5. 테스트

테스트 인프라는 `tsx --test`로 `src/lib/**`만 돌린다. jsdom도 testing-library도 없다 — 컴포넌트 테스트는 지금 구조로 불가능하다.

### 유닛 테스트

밝기 순환 순서를 순수 함수로 뽑아 [src/lib/theme.ts](../../../src/lib/theme.ts)에 두고, 이미 있는 [theme.test.ts](../../../src/lib/theme.test.ts)에 붙인다. 실패하는 테스트를 먼저 쓴다.

```ts
/** 밝게 → 어둡게 → 기기 설정 → 밝게. */
export function nextTheme(theme: Theme): Theme
```

- 세 번 돌리면 제자리로 온다: `nextTheme(nextTheme(nextTheme('light'))) === 'light'`
- 세 갈래를 각각 확인: `light → dark`, `dark → system`, `system → light`
- 알 수 없는 값은 `light`로 떨어진다

### 브라우저 확인

레일 펼침 · 포커스 이동 · 팝오버 클리핑 · 스윕 주기는 DOM이 필요하다. jsdom과 testing-library를 들이면 잡히지만 이 작업의 범위를 넘고, 이 프로젝트는 지금까지 의도적으로 `lib`만 테스트해 왔다. Playwright로 실제 브라우저에서 확인하고 결과를 보고한다.

```
1  접힘 폭이 84px인지 · 지금보다 줄었는지
2  이니셜을 누르면 스프링으로 벌어지는지
3  알림 팝오버가 트랙 `overflow-hidden`에 잘리지 않는지
4  밝기 순환이 세 갈래를 돌고 쿠키가 남는지 · 새로고침 후에도 유지되는지
5  로그아웃이 POST로 나가는지
6  Escape로 접히는지 · 팝오버가 열려 있으면 팝오버가 먼저 닫히는지
7  Tab 순서가 알림 → 밝기 → 이름·부서 → 로그아웃 → 이니셜인지
8  375 / 640 / 1024 / 1440에서 헤더가 넘치지 않는지
9  타이틀 스윕이 10초마다 도는지
10 reduced-motion에서 스윕과 반복이 멈추는지
```

`npm run lint`와 `npm test`(기존 84개)를 함께 돌린다.

---

## 6. 버전과 문서

**0.21.0 → 0.22.0** (추가). 새 컴포넌트 하나와 헤더 재배치이고 아키텍처가 바뀌지 않는다.

- `docs/progress.md` — 이번 작업 섹션 추가
- `docs/PRD.md` §7.3 — 731~733행이 "1행 브랜드·밝기·알림 종·사용자"와 "밝기 토글과 알림 종은 사용자 정보 왼쪽이다. 로그아웃과 붙여 두면 종을 누르려다 로그아웃을 누른다"를 기술한다. 레일에서는 알림이 상시 노출이고 로그아웃이 접힘 안 맨 끝이라 구조적으로 붙지 않으므로, 그 서술을 레일 구성으로 고친다
- `docs/DEVELOPMENT_LOG.md` — "변경 이력" 맨 위에 항목 추가 (`기능`)
- `src/lib/changelog.ts` — 맨 위에 `0.22.0` 항목. `package.json` 버전과 함께 올린다 (안 맞으면 `changelog.test.ts`가 막는다)
- `docs/bug-report.md` — 버그가 아니므로 손대지 않는다

## 범위 밖

- `ThemeToggle`(라디오 3개) 삭제 — 사용처를 확인한 뒤 따로 묻는다
- jsdom · testing-library 도입
- 검색을 레일에 넣기
- 앱 안의 스윕 정지 수단(WCAG 2.2.2)
