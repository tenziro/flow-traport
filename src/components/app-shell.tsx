"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconRisk, IconTeam, IconToday } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * 레이아웃 셸 (PRD §7.3).
 *
 * 주요 내비게이션은 **상단 바**에 둔다. 예전에는 ≥1024px에서 좌측 사이드바
 * (beUI bounce-sidebar)였는데, 화면이 세로로 긴 목록 위주라 좌측 240px을 항상
 * 내주는 게 아까웠다. 상단으로 올리면서 본문 폭이 그만큼 넓어진다.
 *
 * 상단 바는 2행이다. 1행은 브랜드·사용자, 2행은 메뉴 탭바(underline).
 * 한 행에 다 넣으면 브랜드와 메뉴가 같은 무게로 보여서 지금 어느 화면인지가
 * 묻힌다 — 행을 나누면 탭바 하나만 훑어도 위치가 읽힌다.
 *
 * 폭은 fluid다 — `max-w-*` 없이 화면을 꽉 쓴다. 카드가 목록 위주라 넓어지면 한 행에
 * 담기는 정보가 늘고, 좌우 여백만 `px-4 → sm:px-6 → lg:px-8`로 벌려 잡아준다.
 *
 * <1024px는 그대로 상단 앱바 + 하단 탭이다 — 엄지가 닿는 곳에 두는 편이 낫다.
 * 현재 위치는 색·굵기·인디케이터 3중으로 표시하고, 아이콘과 텍스트 라벨을 항상 함께 낸다.
 */
const NAV = [
  { href: "/", label: "오늘", Icon: IconToday },
  { href: "/risk", label: "리스크", Icon: IconRisk },
  { href: "/team", label: "팀", Icon: IconTeam },
] as const;

export function AppShell({
  user,
  children,
}: {
  user: { fullname: string; divisionName: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const activeHref = NAV.find(({ href }) => isActive(href))?.href ?? "/";

  return (
    <div className="flex min-h-dvh flex-col">
      {/* 상단 바 — 1행: 브랜드 · 사용자 / 2행: 메뉴 탭바(≥1024px)
          배경은 반투명 + 블러. 스크롤하면 본문이 아래로 비쳐서 고정된 바라는 게 읽힌다.
          블러는 통과하는 색이 있어야 보인다. 이 앱은 배경이 근검정이라 alpha를 55%까지
          열고 saturate로 색을 끌어올려야 유리판처럼 읽힌다 (70%/blur만으로는 안 보였다). */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/55 backdrop-blur-2xl backdrop-saturate-200">
        <div className="flex h-14 w-full items-center gap-4 px-4 sm:px-6 lg:px-8">
          <span className="shrink-0 text-base font-semibold">flow 콕핏</span>

          <span className="ml-auto min-w-0 text-right text-xs">
            <span className="block truncate font-medium">{user.fullname}</span>
            <span className="block truncate text-muted-foreground">{user.divisionName}</span>
          </span>
          <SignOut label="로그아웃" />
        </div>

        <TopNav activeHref={activeHref} />
      </header>

      <main className="w-full flex-1 px-4 py-6 pb-20 sm:px-6 lg:px-8 lg:pb-6">
        {children}
      </main>

      {/* 모바일 하단 탭 */}
      <nav
        aria-label="주요"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-200 ease-out",
                active ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" />}
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * 메뉴 탭바 (≥1024px). beUI Tabs(underline)의 layoutId 밑줄 패턴을 `<Link>`에
 * 얹었다 — Tabs 자체는 `<button>`이라 프리페치도 새 탭 열기도 안 된다.
 * 주요 내비게이션에서 그건 포기할 게 아니다.
 */
function TopNav({ activeHref }: { activeHref: string }) {
  return (
    // layoutRoot: 헤더가 sticky다. layoutId는 페이지 좌표로 측정하므로 스코프를
    // 여기로 좁히지 않으면 스크롤 오프셋이 이동으로 재생된다 (beUI Tabs와 같은 이유).
    <motion.nav
      layoutRoot
      aria-label="주요"
      className="hidden w-full items-center gap-1 px-4 sm:px-6 lg:flex lg:px-8"
    >
      {NAV.map(({ href, label, Icon }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // -mb-px: 밑줄을 헤더의 border-b 위에 겹쳐 앉힌다 (선이 두 겹으로 안 보인다)
              "relative -mb-px inline-flex min-h-11 items-center gap-1.5 px-3 pt-1 pb-2.5 text-sm transition-colors",
              active
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={16} />
            {label}
            {active && (
              <motion.span
                layoutId="top-nav-active"
                transition={{ type: "spring", stiffness: 170, damping: 24, mass: 1.2 }}
                className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
              />
            )}
          </Link>
        );
      })}
    </motion.nav>
  );
}

/** 로그아웃은 POST로만. GET이면 링크 프리페치가 세션을 날릴 수 있다. */
function SignOut({ label }: { label: string }) {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="min-h-9 cursor-pointer rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {label}
      </button>
    </form>
  );
}
