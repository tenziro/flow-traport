'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconRisk, IconSignOut, IconTeam, IconToday } from '@/components/icons';
import {
  ChromaticTextReveal,
  SWEEP_CHART,
} from '@/components/motion/chromatic-text-reveal';
import { OverflowActions } from '@/components/motion/overflow-actions';
import { NewsBell } from '@/components/news-bell';
import { SearchPalette } from '@/components/search-palette';
import { SiteFooter } from '@/components/site-footer';
import { ThemeCycle } from '@/components/theme-toggle';
import type { TaskNews } from '@/lib/flow/queries';
import type { Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

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
  { href: '/', label: '오늘', Icon: IconToday },
  { href: '/risk', label: '리스크', Icon: IconRisk },
  { href: '/team', label: '팀', Icon: IconTeam },
] as const;

export function AppShell({
  user,
  news,
  theme,
  children,
}: {
  user: { fullname: string; divisionName: string };
  /** 담당 업무·내가 올린 글 소식. 못 가져오면 null — 종은 그대로 있고 안이 빈다. */
  news: TaskNews[] | null;
  /** 쿠키에 남아 있는 밝기. 토글의 처음 상태다 (lib/theme.ts). */
  theme: Theme;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
  const activeHref = NAV.find(({ href }) => isActive(href))?.href ?? '/';

  return (
    <div className="flex min-h-dvh flex-col">
      {/* 상단 바 — 1행: 브랜드 · 사용자 / 2행: 메뉴 탭바(≥1024px)
          배경은 반투명 + 블러. 스크롤하면 본문이 아래로 비쳐서 고정된 바라는 게 읽힌다.
          블러는 통과하는 색이 있어야 보인다. 이 앱은 배경이 근검정이라 alpha를 55%까지
          열고 saturate로 색을 끌어올려야 유리판처럼 읽힌다 (70%/blur만으로는 안 보였다). */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/55 backdrop-blur-2xl backdrop-saturate-200">
        <div className="flex h-14 w-full items-center gap-4 px-4 sm:px-6 lg:px-8">
          {/* 이름의 무게 중심은 `Cockpit`이다 — 앞의 `flow`는 올라탄 플랫폼 이름이라
              한 급 얇게 둔다. 로그인 화면 제목도 같은 대비를 쓴다.
              색 띠가 10초마다 `Cockpit` 위를 한 번 쓸고 지나간다 — 로그인 제목과 같은 장치라
              두 화면이 같은 이름을 같은 방식으로 부른다. `startOnView`는 끈다: 헤더는 늘
              화면에 있어서 뷰포트 진입이라는 사건이 없다 */}
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

          {/* 검색은 레일 밖이다 — 목적지가 아니라 경유지이고, 밝기·소식·계정처럼 상태를
              보거나 바꾸는 것과 성격이 다르다 */}
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <SearchPalette />
            <AccountRail user={user} news={news} theme={theme} />
          </div>
        </div>

        <TopNav activeHref={activeHref} />
      </header>

      <main className="w-full flex-1 px-4 py-8 pb-20 sm:px-6 md:pb-8 lg:px-8">
        {children}
      </main>

      <SiteFooter />

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
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-200 ease-out',
                active ? 'font-semibold text-primary' : 'text-muted-foreground',
              )}
            >
              {active && (
                <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" />
              )}
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
            aria-current={active ? 'page' : undefined}
            className={cn(
              // -mb-px: 밑줄을 헤더의 border-b 위에 겹쳐 앉힌다 (선이 두 겹으로 안 보인다)
              'relative -mb-px inline-flex min-h-11 items-center gap-1.5 px-3 pt-1 pb-2.5 text-sm transition-colors',
              active
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon size={16} />
            {label}
            {active && (
              <motion.span
                layoutId="top-nav-active"
                transition={{
                  type: 'spring',
                  stiffness: 170,
                  damping: 24,
                  mass: 1.2,
                }}
                className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
              />
            )}
          </Link>
        );
      })}
    </motion.nav>
  );
}

/**
 * 계정 레일 — 소식 · 밝기 · 이름·부서 · 로그아웃.
 *
 * 전에는 이 넷이 헤더 오른쪽에 세로선 두 개로 갈린 여섯 덩어리로 늘어서 있었다. 배열에는
 * 이유가 있었지만(정보와 액션의 경계) 덩어리 수 자체가 많아 헤더가 붐볐다. 하나로 묶고
 * 이니셜 원판을 펼치기 토글로 쓴다.
 *
 * 접으면 소식 종과 이니셜만 남는다. **소식은 접히지 않는다** — 안 읽음 배지가 접히면
 * 신호가 죽는다. 로그아웃은 접힘 안 맨 끝이다: 자주 쓰지 않고, 그 자리가 종에서 가장 멀다
 * (전에는 나란히 붙어 있어서 종을 누르려다 로그아웃을 누를 수 있었다).
 *
 * 이름·부서만 배경이 없다. 다른 칸은 `bg-background`라, 세로선이 그려 주던 "여기까지는
 * 정보, 여기부터는 누르는 곳"이라는 경계를 배경 유무가 대신한다.
 */
function AccountRail({
  user,
  news,
  theme,
}: {
  user: { fullname: string; divisionName: string };
  news: TaskNews[] | null;
  theme: Theme;
}) {
  return (
    <OverflowActions
      label={`내 계정 — ${user.fullname} · ${user.divisionName}`}
      overflowLabel="내 계정"
      toggle={user.fullname.slice(0, 1)}
      overflow={
        <>
          <ThemeCycle theme={theme} />
          <span className="hidden min-w-0 px-1 leading-tight sm:block">
            <span className="block truncate text-xs font-medium">
              {user.fullname}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {user.divisionName}
            </span>
          </span>
          <SignOut />
        </>
      }
    >
      <NewsBell news={news} />
    </OverflowActions>
  );
}

/**
 * 로그아웃은 POST로만. GET이면 링크 프리페치가 세션을 날릴 수 있다.
 *
 * 좁은 화면에서는 아이콘만 남긴다 — 헤더 오른쪽 끝의 이 아이콘은 관용어라 글자 없이도
 * 읽히고, 대신 `title`과 `sr-only`로 이름을 남겨둔다.
 */
function SignOut() {
  return (
    <form action="/api/auth/logout" method="post" className="shrink-0">
      <button
        type="submit"
        title="로그아웃"
        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconSignOut size={16} />
        <span className="sr-only lg:not-sr-only">로그아웃</span>
      </button>
    </form>
  );
}
