'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconRisk, IconSignOut, IconTeam, IconToday } from '@/components/icons';
import { NewsBell } from '@/components/news-bell';
import { ThemeToggle } from '@/components/theme-toggle';
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
              한 급 얇게 둔다. 로그인 화면 제목도 같은 대비를 쓴다 */}
          <span className="shrink-0 text-base font-medium">
            flow <span className="font-extrabold">Cockpit</span>
          </span>

          {/* 사용자 · 로그아웃
              전에는 이름·부서 두 줄이 `text-right`로 떠 있고 그 옆에 muted 텍스트
              "로그아웃"이 붙어 있었다. 부서명과 버튼이 같은 색·같은 크기라 어디까지가
              정보고 어디부터 누르는 곳인지 구분이 안 됐다. 셋을 이렇게 갈랐다.
              - 이니셜 원판: 두 줄 텍스트의 높이 기준점. 앵커가 없으면 옆 버튼과 중심이 어긋난다.
              - 세로선: 정보와 액션 사이의 경계.
              - 로그아웃: 아이콘 + 호버 면. 누르는 곳이라는 게 색이 아니라 모양으로 읽힌다. */}
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {/* 밝기·소식은 세 화면 공통이라 셸에 있다. 사용자 정보 왼쪽 — 로그아웃과
                붙여 두면 종을 누르려다 로그아웃을 누른다 */}
            <ThemeToggle theme={theme} />
            <NewsBell news={news} />
            <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {user.fullname.slice(0, 1)}
            </span>
            <span className="hidden min-w-0 leading-tight sm:block">
              <span className="block truncate text-xs font-medium">
                {user.fullname}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {user.divisionName}
              </span>
            </span>
            <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
            <SignOut />
          </div>
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
        className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <IconSignOut size={16} />
        <span className="sr-only lg:not-sr-only">로그아웃</span>
      </button>
    </form>
  );
}
