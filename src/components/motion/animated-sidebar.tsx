"use client";
// beui.dev/components/motion/animated-sidebar
//
// 원본은 28개를 내보내는 조립형 셸이다(Provider·Inset·Header·Footer·Group·Menu·MenuSub·
// 모바일 시트). 이 앱의 주요 메뉴는 세 개고 하위 메뉴가 없어서, 폭이 접히는 레일과 그
// 상태를 셸이 나눠 쓰는 데 필요한 조각만 남겼다.
//
// 살린 것 — 폭을 스프링으로 morph 하는 `motion.aside`(240px ↔ 68px), 라벨의 비대칭
//   트랜지션(들어올 때 0.2s + 0.08s 늦게 / 나갈 때 0.12s), 현재 항목 알약의 `layoutId`
//   글라이드, `⌘B` 토글, Provider·Trigger·머리 슬롯.
// 버린 것 — 모바일 시트 전체(포털·포커스 트랩·스크롤 잠금·`useSyncExternalStore`). 좁은
//   화면은 하단 탭이 맡는다(`app-shell.tsx`). 중첩 메뉴(MenuSub·Chevron), Group·
//   GroupLabel·Footer 슬롯, `variant`(floating·inset)·`side="right"`·
//   `collapsible="offcanvas"`, 드래그 레일, 호버 알약(`SharedLayoutBg`) — 항목이 셋이라
//   쓸 자리가 없다.
// 고친 것 —
//   1. 배열 API 대신 `<SidebarLink>`·`<SidebarButton>` 슬롯을 받는다 (이 저장소의
//      vendoring 관례).
//   2. 접힘 상태를 쿠키에 남긴다 (`lib/sidebar.ts`). 서버가 첫 HTML에서 폭을 맞게 그려야
//      화면이 240px로 그려졌다 68px로 접히지 않는다.
//   3. 원본은 접힘 상태의 라벨에 `aria-hidden`을 걸었다. 아이콘은 이미 `aria-hidden`이라
//      그러면 링크에 이름이 남지 않는다 — 투명하게만 두고 접근성 트리에는 남긴다.
//   4. 데스크톱 경계는 `md:`(768px)가 아니라 `lg:`(1024px)다 — 이 앱의 기준이다.
//   5. 레일이 화면 전체 높이를 쓴다. 브랜드는 레일 머리에 있고 접기 단추는 본문 헤더에
//      있어서, 상태가 레일 밖에서도 필요하다 — 그래서 Provider와 Trigger를 살렸다.
//   6. 현재 항목 알약을 `bg-accent`에서 파란 알약 + 파란 글자로 바꿨다
//      (v1.7.0). 원본의 회색 알약은 밝은 화면에서 흰 레일과 4% 차이라 어디에 있는지가
//      한눈에 안 잡혔다. 좁은 화면 하단 탭이 이미 `text-primary`를 쓰고 있어서, 색을
//      맞추면 두 크기의 메뉴가 "지금 여기"를 같은 방식으로 말한다.
//   7. 그 알약 색을 토큰으로 뽑았다 (`--primary-bg` / `--primary-bg-foreground`).
//      `bg-primary/10`은 어두운 화면에서 근검정 위 10%짜리 파랑이라 알약이 있는지조차
//      안 보였다. 어둡게만 25%로 올리고 글자도 같이 밝힌다 — 면만 밝히면 브랜드 파랑이
//      그 위에서 AA에 못 미친다 (globals.css의 토큰 주석).

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { IconSidebar } from "@/components/icons";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

/** 펼침 240px / 접힘 68px. 68px은 아이콘 20px이 좌우 여백 24px 사이에 정확히 앉는 폭이다. */
const WIDTH = { open: "15rem", collapsed: "4.25rem" } as const;

/**
 * 폭 하나가 변하는 면이라 살짝 덜 감쇠된 스프링이 낫다 — 안쪽 내용이 늘어나거나 줄어들지
 * 않고 폭만 자리를 잡는다 (beUI 원본 값).
 */
const MORPH = { type: "spring", stiffness: 380, damping: 28, mass: 0.75 } as const;

/** 라벨은 들어올 때 늦게 시작하고 천천히, 나갈 때 바로 빠진다 — 폭이 먼저 자리를 잡는다. */
const LABEL_IN = { duration: 0.2, delay: 0.08, ease: EASE_OUT } as const;
const LABEL_OUT = { duration: 0.12, ease: EASE_OUT } as const;
const LABEL_REDUCED = { duration: 0.16, ease: EASE_OUT } as const;

/** 1년. 밝기 쿠키와 같은 수명이다 (`theme-toggle.tsx`). */
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * 다음 요청의 첫 HTML을 위해 남긴다. 컴포넌트 밖인 이유는 React 컴파일러 때문이다 —
 * 렌더 함수 안에서 `document.cookie`에 대입하면 렌더가 순수하지 않다고 잡는다.
 */
function remember(open: boolean) {
  document.cookie = `${SIDEBAR_COOKIE}=${open ? "1" : "0"}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

const SidebarCtx = createContext<{
  open: boolean;
  reduce: boolean;
  toggle: () => void;
} | null>(null);

function useSidebar() {
  const ctx = useContext(SidebarCtx);
  if (!ctx) throw new Error("사이드바 조각은 <SidebarProvider> 안에서만 쓴다");
  return ctx;
}

/**
 * 접힘 상태의 주인. 레일은 왼쪽이고 접기 단추는 본문 헤더라 셸 전체를 감싼다.
 */
export function SidebarProvider({
  /** 쿠키에 남아 있던 접힘 상태. 서버가 준다 (`lib/sidebar.ts`). */
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion() ?? false;

  const toggle = useCallback(() => {
    setOpen(!open);
    remember(!open);
  }, [open]);

  // ⌘B(mac) / Ctrl+B. beUI 원본의 조합키다. 접기 단추의 `title`에 적어 둔다 —
  // 단축키만 두면 있는 줄 모른다 (검색의 `⌘K`와 같은 이유).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "b" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <SidebarCtx.Provider value={{ open, reduce, toggle }}>{children}</SidebarCtx.Provider>
  );
}

/**
 * 접기 단추. 본문 헤더 왼쪽 끝에 둔다 — 레일 안에 두면 접힌 뒤 그 단추가 아이콘만 남은
 * 메뉴들과 섞여서 어느 것이 메뉴인지 흐려진다.
 */
export function SidebarTrigger() {
  const { open, toggle } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggle}
      title={`메뉴 ${open ? "접기" : "펼치기"} (⌘B)`}
      aria-expanded={open}
      // 좁은 화면에는 접을 레일이 없다
      className="hidden size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:grid"
    >
      <span
        aria-hidden
        className={cn(
          "grid place-items-center transition-transform duration-200",
          !open && "rotate-180",
        )}
      >
        <IconSidebar size={18} />
      </span>
      <span className="sr-only">{`메뉴 ${open ? "접기" : "펼치기"}`}</span>
    </button>
  );
}

/**
 * 레일. 화면 왼쪽을 위에서 아래까지 쓴다 — 머리에 브랜드가 있어서 본문 헤더와 눈높이가
 * 맞는다.
 */
export function AnimatedSidebar({
  /** 레일 머리 (브랜드). 스크롤되는 목록 밖이라 항상 보인다. */
  brand,
  /** 레일 발 (계정). 메뉴가 아니라 목록 바깥에 둔다 — 나브의 항목으로 읽히면 안 된다. */
  footer,
  ariaLabel,
  children,
}: {
  brand: React.ReactNode;
  footer: React.ReactNode;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const { open, reduce } = useSidebar();

  return (
    <motion.aside
      initial={false}
      data-state={open ? "expanded" : "collapsed"}
      animate={{ width: open ? WIDTH.open : WIDTH.collapsed }}
      transition={reduce ? { duration: 0 } : MORPH}
      // 하단 탭이 있는 좁은 화면에는 나오지 않는다. 접히는 동안 240px짜리 내용이 새지
      // 않도록 여기서 자른다
      className="sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-border will-change-[width] lg:flex"
    >
      {/* 헤더와 같은 56px. 두 줄의 눈높이가 맞아야 경계선이 한 줄로 읽힌다.
          여백이 `px-6`인 것은 목록 쪽 여백을 합친 값이기 때문이다 (판 `px-3` + 줄 `px-3`) —
          그래야 로고가 메뉴 아이콘과 같은 열에 서고, 접힌 68px에서도 가운데 남는다 */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-6">{brand}</div>

      {/* layoutRoot: 이 판은 화면에 고정돼 있다. `layoutId`는 페이지 좌표로 재기 때문에
          스코프를 여기로 좁히지 않으면 스크롤 오프셋이 알약의 이동으로 재생된다 */}
      <motion.nav
        layoutRoot
        aria-label={ariaLabel}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-4"
      >
        {children}
      </motion.nav>

      {/* 좌우 `px-2`는 안의 줄이 `px-3`을 갖기 때문이다 — 8 + 12 = 20에서 시작하는 28px
          원판의 중심이 접힌 68px 레일의 중심(34px)에 온다.
          위아래 `py-4`는 이 칸을 81px로 만들어 페이지 푸터와 높이를 맞춘다 (`site-footer.tsx`
          = pt-6 + 두 줄 32px + pb-6 + 선). 그래야 두 경계선이 한 줄로 이어진다 */}
      <div className="shrink-0 border-t border-border px-2 py-4">{footer}</div>
    </motion.aside>
  );
}

/**
 * 메뉴 한 줄. 현재 위치는 색·굵기·알약 3중으로 표시한다 — 알약은 `layoutId`로 다음 항목까지
 * 미끄러진다 (상단 탭바의 밑줄과 같은 장치였다).
 */
export function SidebarLink({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  active: boolean;
  children: React.ReactNode;
}) {
  const { reduce } = useSidebar();

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-10 shrink-0 items-center gap-3 overflow-hidden rounded-lg px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "font-semibold text-primary-bg-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
          className="absolute inset-0 rounded-lg bg-primary-bg"
        />
      )}
      <span aria-hidden className="relative z-10 grid size-5 shrink-0 place-items-center">
        {icon}
      </span>
      <SidebarLabel>{children}</SidebarLabel>
    </Link>
  );
}

/** 링크와 같은 치수의 단추. 이동이 아니라 레이어를 여는 줄(검색)이 쓴다. */
export function SidebarButton({
  icon,
  title,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex min-h-10 shrink-0 cursor-pointer items-center gap-3 overflow-hidden rounded-lg px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden className="grid size-5 shrink-0 place-items-center">
        {icon}
      </span>
      <SidebarLabel>{children}</SidebarLabel>
    </button>
  );
}

/**
 * 메뉴 묶음의 이름. 검색 같은 도구 줄과 화면으로 가는 줄을 갈라 놓는다 — 넷을 한 줄기로
 * 늘어놓으면 검색이 화면 목록의 첫 항목처럼 읽힌다.
 *
 * 접히면 `SidebarLabel`과 같은 방식으로 투명해진다. 68px 레일에는 글자가 안 들어가는데,
 * 자리는 그대로 남아서 그 빈 칸이 묶음의 경계 노릇을 한다 — 선을 하나 더 긋지 않는다.
 */
export function SidebarSection({ children }: { children: React.ReactNode }) {
  const { open, reduce } = useSidebar();

  return (
    <motion.p
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      transition={reduce ? LABEL_REDUCED : open ? LABEL_IN : LABEL_OUT}
      // 위 `mt-3`이 묶음 사이 간격이다 (판의 `gap-1`에 더해진다). 아래는 첫 줄과 붙여 둔다
      className="mt-3 shrink-0 truncate px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground"
    >
      {children}
    </motion.p>
  );
}

/** 접히면 사라지는 글자. 투명해지기만 하고 이름은 남는다 (파일 머리 3번). */
export function SidebarLabel({ children }: { children: React.ReactNode }) {
  const { open, reduce } = useSidebar();

  return (
    <motion.span
      initial={false}
      animate={{ opacity: open ? 1 : 0, x: open ? 0 : -4 }}
      transition={reduce ? LABEL_REDUCED : open ? LABEL_IN : LABEL_OUT}
      className={cn(
        "relative z-10 min-w-0 flex-1 truncate text-left",
        !open && "pointer-events-none",
      )}
    >
      {children}
    </motion.span>
  );
}
