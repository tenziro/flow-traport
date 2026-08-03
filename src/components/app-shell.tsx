'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { FlowLink } from '@/components/flow-link';
import {
  IconAttending,
  IconCalendar,
  IconChevronRight,
  IconClose,
  IconComment,
  IconMyTasks,
  IconRepeat,
  IconRisk,
  IconSearch,
  IconSignOut,
  IconTeam,
  IconToday,
  IconWorker,
} from '@/components/icons';
import {
  AnimatedSidebar,
  SidebarButton,
  SidebarLabel,
  SidebarLink,
  SidebarProvider,
  SidebarSection,
  SidebarTrigger,
} from '@/components/motion/animated-sidebar';
import { BottomSheet } from '@/components/motion/bottom-sheet';
import {
  ChromaticTextReveal,
  SWEEP_CHART,
} from '@/components/motion/chromatic-text-reveal';
import { Drawer } from '@/components/motion/drawer';
import { NewsBell } from '@/components/news-bell';
import { SearchProvider, useSearchOpen } from '@/components/search-palette';
import { SiteFooter } from '@/components/site-footer';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { TaskNews } from '@/lib/flow/queries';
import type { FlowEvent } from '@/lib/flow/rest';
import { flowProjectUrl } from '@/lib/flow/urls';
import type { Theme } from '@/lib/theme';
import { cn, fmtDayLabel, fmtTime, hexColor } from '@/lib/utils';

/**
 * 레이아웃 셸 (PRD §7.3).
 *
 * ≥1024px는 **좌측 레일 + 본문 헤더**다. 레일이 화면을 위에서 아래까지 쓰고 머리에 브랜드,
 * 가운데 검색·메뉴, 발에 계정을 품는다 (beUI animated-sidebar —
 * `motion/animated-sidebar.tsx`). 헤더는 본문 칸 위에만 있고 접기 단추와 지금 있는 화면
 * 이름, 밝기·소식을 든다.
 *
 * 한동안 메뉴를 상단 2행째 탭바에 뒀다. 좌측 240px을 항상 내주는 게 아까웠기 때문인데,
 * 접히는 레일이면 그 240px이 필요할 때만 나간다 — 접으면 68px이고 라벨만 사라진다.
 * 브랜드와 검색까지 레일로 내리면 헤더는 한 줄로 줄고 세로 자리를 한 행(44px) 돌려받는다.
 *
 * 폭은 fluid다 — `max-w-*` 없이 화면을 꽉 쓴다. 카드가 목록 위주라 넓어지면 한 행에
 * 담기는 정보가 늘고, 좌우 여백만 `px-4 → sm:px-6 → lg:px-10`으로 벌려 잡아준다.
 *
 * <1024px는 상단 앱바 + 하단 탭이다 — 엄지가 닿는 곳에 두는 편이 낫다. 레일은 여기서 아예
 * 렌더되지 않는다: 원본의 모바일 시트를 들이면 같은 메뉴로 가는 길이 둘이 된다. 레일이
 * 없는 만큼 검색은 헤더가 대신 들고, 브랜드는 푸터와 탭 제목에 맡긴다.
 * 현재 위치는 색·굵기·인디케이터 3중으로 표시하고, 아이콘과 텍스트 라벨을 항상 함께 낸다.
 */
const NAV = [
  { href: '/', label: '오늘', Icon: IconToday },
  { href: '/tasks', label: '내 업무', Icon: IconMyTasks },
  { href: '/risk', label: '리스크', Icon: IconRisk },
  { href: '/team', label: '팀', Icon: IconTeam },
  { href: '/members', label: '구성원', Icon: IconWorker },
] as const;

/** 세션이 준 나 (lib/auth.ts). 레일 발의 계정 줄이 그대로 낸다. */
type User = {
  fullname: string;
  divisionName: string;
  email: string;
  /** flow 프로필 사진. 세션에 없어서 따로 받아 온다 (lib/flow/members.ts). 없으면 빈 문자열. */
  photo: string;
  /** flow에 적어 둔 상태 메시지. 없으면 빈 문자열 — 팝오버가 그 자리에 없다고 적는다. */
  slogan: string;
};

export function AppShell({
  user,
  news,
  events,
  today,
  theme,
  sidebarOpen,
  children,
}: {
  user: User;
  /** 담당 업무·내가 올린 글 소식. 못 가져오면 null — 종은 그대로 있고 안이 빈다. */
  news: TaskNews[] | null;
  /** 나의 일정. 넓은 화면은 계정 팝오버가 여는 서랍이, 좁은 화면은 헤더의 시트가 낸다.
      못 가져오면 null — 판이 그렇게 적는다. */
  events: FlowEvent[] | null;
  /** 오늘의 KST `YYYYMMDD`. 서버가 정해서 내려 준다 — 목록이 `오늘`·`내일` 소제목을 붙이는
      데 쓴다. 클라이언트에서 `Date.now()`를 읽으면 첫 그림과 어긋나 수화가 깨진다. */
  today: string;
  /** 쿠키에 남아 있는 밝기. 토글의 처음 상태다 (lib/theme.ts). */
  theme: Theme;
  /** 쿠키에 남아 있는 사이드바 접힘. 레일의 처음 폭이다 (lib/sidebar.ts). */
  sidebarOpen: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
  const active = NAV.find(({ href }) => isActive(href)) ?? NAV[0];

  return (
    <SearchProvider>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <div className="flex min-h-dvh">
          {/* 메뉴 (≥1024px). 알약은 `layoutId`로 항목 사이를 미끄러진다 — 상단 탭바의
              밑줄이 하던 일을 그대로 옮겨 왔다 */}
          <AnimatedSidebar
            ariaLabel="주요"
            brand={<Brand />}
            footer={<Account user={user} events={events} today={today} />}
          >
            <SidebarSearch />

            {/* 검색은 도구고 아래 넷은 갈 곳이다. 라벨로 갈라 둔다 — `WORKSPACES` 자리인데
                화면에 나오는 글자는 한국어로 쓴다 (docs/TEXT_GUIDE.md) */}
            <SidebarSection>업무 공간</SidebarSection>

            {NAV.map(({ href, label, Icon }) => (
              <SidebarLink
                key={href}
                href={href}
                icon={<Icon size={18} />}
                active={href === active.href}
              >
                {label}
              </SidebarLink>
            ))}
          </AnimatedSidebar>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* 헤더 — 왼쪽은 접기와 지금 있는 화면, 오른쪽은 내 것들.
                배경은 반투명 + 블러. 스크롤하면 본문이 아래로 비쳐서 고정된 바라는 게 읽힌다.
                블러는 통과하는 색이 있어야 보인다. 이 앱은 배경이 근검정이라 alpha를 55%까지
                열고 saturate로 색을 끌어올려야 유리판처럼 읽힌다 (70%/blur만으로는 안 보였다). */}
            <header className="sticky top-0 z-20 border-b border-border bg-card/55 backdrop-blur-2xl backdrop-saturate-200">
              <div className="flex h-14 w-full items-center gap-3 px-4 sm:px-6 lg:px-10">
                <SidebarTrigger />
                <span
                  aria-hidden
                  className="hidden h-5 w-px shrink-0 bg-border lg:block"
                />
                {/* 화면 이름은 제목이 아니다 — 본문에 이미 `h1`이 있어서 여기까지 heading으로
                    올리면 목차에 같은 말이 두 번 걸린다 */}
                <p className="min-w-0 truncate text-sm font-semibold">
                  {active.label}
                </p>

                {/* 밝기·소식은 세 화면 공통이라 셸에 있다. 한 줄로 늘어놓는 대신 `⋯` 원판
                    하나로 묶어 봤지만(v0.22.0) 되돌렸다: 여섯 덩어리가 둘로 줄기는 했어도,
                    늘 쓰는 밝기가 한 번 더 눌러야 나오는 자리로 들어갔다.
                    세로선 뒤의 로그아웃은 좁은 화면만 든다 — 넓은 화면에서는 레일 발이 맡는다
                    (`Account`). 종과 로그아웃이 붙어 있어서 종을 누르려다 로그아웃을 누르던
                    자리도 그래서 넓은 화면에서는 없어졌다. 나의 일정도 같은 짝이다 —
                    좁은 화면에서만 여기 있고 넓은 화면에서는 레일 발의 팝오버가 연다.
                    이니셜 원판은 좁은 화면에서 빼 뒀다. 로그인은 한 계정뿐이라 누구인지 확인할
                    일이 없고, 컨트롤 다섯 개가 좁은 헤더에 들어가면 종과 로그아웃 사이가 좁다 */}
                <div className="ml-auto flex min-w-0 items-center gap-2">
                  <HeaderSearch />
                  <ThemeToggle theme={theme} />
                  <HeaderSchedule events={events} today={today} />
                  <NewsBell news={news} />
                  <span
                    aria-hidden
                    className="h-5 w-px shrink-0 bg-border lg:hidden"
                  />
                  <SignOut />
                </div>
              </div>
            </header>

            {/* 넓은 화면에서 좌우·상하 40px. 헤더도 같은 `lg:px-10`이라 화면 이름과
                본문 `h1`이 한 줄에 선다 */}
            <main className="w-full flex-1 px-4 py-8 pb-20 sm:px-6 md:pb-8 lg:px-10 lg:py-10 lg:pb-10">
              {children}
            </main>

            <SiteFooter />
          </div>

          {/* 모바일 하단 탭 */}
          <nav
            aria-label="주요"
            className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
          >
            {NAV.map(({ href, label, Icon }) => {
              const here = href === active.href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={here ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-200 ease-out',
                    here ? 'font-semibold text-primary' : 'text-muted-foreground',
                  )}
                >
                  {here && (
                    <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" />
                  )}
                  <Icon size={20} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </SidebarProvider>
    </SearchProvider>
  );
}

/**
 * 레일 머리. 이름의 무게 중심은 `Cockpit`이다 — 앞의 `flow`는 올라탄 플랫폼 이름이라
 * 한 급 얇게 둔다. 로그인 화면 제목도 같은 대비를 쓴다.
 *
 * 색 띠가 10초마다 `Cockpit` 위를 한 번 쓸고 지나간다 — 로그인 제목과 같은 장치라 두 화면이
 * 같은 이름을 같은 방식으로 부른다. `startOnView`는 끈다: 레일은 늘 화면에 있어서 뷰포트
 * 진입이라는 사건이 없다.
 */
function Brand() {
  return (
    <>
      {/* 로고는 메뉴 아이콘과 같은 20px 칸이다 — 그 열의 중심이 접힌 68px 레일의 중심이라
          접어도 로고가 가운데 남는다. 검은 정사각 이미지라 라운드를 준다 (로그인 화면과 같다) */}
      <span aria-hidden className="grid size-5 shrink-0 place-items-center">
        <Image src="/logo.jpg" alt="" width={20} height={20} className="rounded" />
      </span>

      <SidebarLabel>
        <span className="text-base font-medium">
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
      </SidebarLabel>
    </>
  );
}

/**
 * 레일 발의 계정. 이름·부서·이메일을 그대로 내고, 마우스를 올리면 나의 일정·로그아웃이 딸린
 * 팝오버가 옆으로 열린다.
 *
 * 팝오버의 "나의 일정"은 오른쪽 서랍을 연다 (motion/drawer.tsx, PRD §13 B3). 오늘부터
 * 이레치를 날짜별로 내는데, 여기 있으면 내 업무·팀·구성원 화면에서도 열린다.
 *
 * 헤더 오른쪽 끝에 있던 이니셜 원판을 여기로 내렸다. 계정은 화면마다 쓰는 물건이 아니라 늘
 * 같은 자리에 있으면 되는 것이라, 브랜드와 메뉴가 있는 레일의 반대쪽 끝이 제자리다. 대신
 * 이름·부서만으로는 어느 계정인지 확실하지 않아서(같은 이름이 둘일 수 있다) 로그인한 이메일을
 * 함께 낸다.
 *
 * 호버로 여는 팝오버지만 라딕스 Popover다 — HoverCard는 키보드로 안을 짚을 수 없어서 그 안에
 * 로그아웃 같은 단추를 두면 마우스 없는 사람에게는 없는 기능이 된다.
 */
function Account({
  user,
  events,
  today,
}: {
  user: User;
  events: FlowEvent[] | null;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  /** 나의 일정 서랍. 팝오버와 함께 열리지 않는다 — 여는 순간 팝오버는 닫는다. */
  const [schedule, setSchedule] = useState(false);
  /** 초점을 옮길지 가르는 값. 호버로 열렸는데 초점까지 따라가면 글자를 읽던 자리를 잃는다. */
  const byHover = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 서랍을 닫을 때 초점을 돌려줄 자리. 서랍을 연 단추는 팝오버와 함께 사라진다. */
  const trigger = useRef<HTMLButtonElement>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    byHover.current = true;
    setOpen(true);
  };

  /** 줄과 팝오버 사이에 8px 틈이 있다. 그 틈을 지나는 동안 닫히지 않게 조금 늦춘다. */
  const hide = () => {
    timer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          byHover.current = false;
          setOpen(next);
        }}
      >
        <PopoverTrigger
          ref={trigger}
          onMouseEnter={show}
          onMouseLeave={hide}
          title="계정"
          className="flex min-h-12 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-lg px-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* 28px 원판. 접히면 이 원판만 남고 중심이 레일 중심에 온다 (animated-sidebar.tsx).
              구성원 화면과 같은 flow 프로필 사진이다 — 접힌 레일에서는 이 원판이 유일한 표시라
              얼굴이 인사하는 손보다 알아보기 쉽다. 사진이 없는 사람은 손을 그대로 쓴다 */}
          {user.photo ? (
            <Image
              src={user.photo}
              alt=""
              width={28}
              height={28}
              className="size-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-sm"
            >
              👋🏻
            </span>
          )}

          <SidebarLabel>
            <span className="block truncate text-sm">
              <span className="font-medium">{user.fullname}</span>
              <span className="ml-1.5 text-[11px] text-muted-foreground">
                {user.divisionName}
              </span>
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {user.email}
            </span>
          </SidebarLabel>

          {/* 접히면 레일 밖으로 나가 잘린다 — 따로 숨기지 않아도 된다 */}
          <IconChevronRight
            size={14}
            aria-hidden
            className="shrink-0 text-muted-foreground"
          />
        </PopoverTrigger>

        <PopoverContent
          side="right"
          align="end"
          sideOffset={8}
          onMouseEnter={show}
          onMouseLeave={hide}
          onOpenAutoFocus={(e) => {
            if (byHover.current) e.preventDefault();
          }}
          className="w-60 gap-2 p-2"
        >
          {/* 줄에 있는 것과 같은 말이지만 여기서는 잘리지 않는다 — 접힌 레일에서는 이쪽이 유일한
              확인 자리다 */}
          <PopoverHeader className="px-1.5 pt-1">
            <PopoverTitle className="truncate">{user.fullname}</PopoverTitle>
            <PopoverDescription className="text-xs">
              {user.divisionName}
            </PopoverDescription>
            <PopoverDescription className="text-xs break-all">
              {user.email}
            </PopoverDescription>

            {/* flow에 적어 둔 상태 메시지. 위 세 줄은 "어느 계정인지"고 이 줄은 내가 쓴 말이라
                선으로 끊는다 — 구성원 카드의 한마디도 선·말풍선·빈 문구까지 같은 모양이다
                (members/page.tsx). 비어 있어도 줄은 남긴다. 여기가 자기 계정을 보는 유일한
                자리라, 없다고 적어 두는 편이 자리가 아예 사라지는 것보다 낫다 — 적을 수 있는
                칸이라는 것도 알게 된다 */}
            <PopoverDescription
              className={cn(
                'mt-1 flex items-start gap-1.5 border-t border-border pt-1.5 text-xs',
                !user.slogan && 'text-muted-foreground/60',
              )}
            >
              {/* 말풍선. 위 세 줄과 달리 이 줄만 "본인이 쓴 말"이라는 표시다 — 선 하나로는
                  무엇이 달라졌는지 말해 주지 않는다. `aria-hidden`인 것은 줄에 붙는 이름표가
                  아니라 성격 표시라서다 */}
              <IconComment size={12} aria-hidden className="mt-0.5 shrink-0" />
              <span>{user.slogan || '상태 메시지가 없어요.'}</span>
            </PopoverDescription>
          </PopoverHeader>

          <span aria-hidden className="h-px bg-border" />

          {/* 나의 일정 (PRD §13 B3). 어느 화면에 있든 열린다 — 일정은 "지금 어디로 갈지"라
              화면을 옮기면서 확인할 일이 잦다. 건수를 단추에 적어 두는 것은 열지 않고도 이레가
              빈지 알기 위해서다 */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSchedule(true);
            }}
            className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md px-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <IconCalendar size={16} aria-hidden />
            나의 일정
            {events && events.length > 0 && (
              <span className="tabular ml-auto text-[11px]">
                {events.length}건
              </span>
            )}
          </button>

          {/* POST인 이유는 `SignOut` 주석에 */}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md px-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <IconSignOut size={16} aria-hidden />
              로그아웃
            </button>
          </form>
        </PopoverContent>
      </Popover>

      {/* 서랍은 팝오버 밖이다 — 팝오버가 닫히면서 같이 사라지면 안 된다. 오른쪽에서 들어오는
          것은 여는 자리가 왼쪽 레일 발이라 왼쪽에서 열면 그 레일을 덮기 때문이다 */}
      <Drawer
        open={schedule}
        onOpenChange={(next) => {
          setSchedule(next);
          // 서랍을 연 단추는 팝오버와 함께 사라졌다. 초점을 계정 줄로 돌려 준다 —
          // 안 돌리면 탭이 문서 맨 앞에서 다시 시작한다
          if (!next) trigger.current?.focus();
        }}
        ariaLabel="나의 일정"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <IconCalendar size={16} aria-hidden className="text-primary" />
          <h2 className="text-sm font-semibold">나의 일정</h2>
          {events && events.length > 0 && (
            <span className="tabular text-xs text-muted-foreground">
              {events.length}건
            </span>
          )}
          <button
            type="button"
            onClick={() => setSchedule(false)}
            aria-label="닫기"
            title="닫기"
            className="ml-auto grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <IconClose size={16} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ScheduleList events={events} today={today} />
        </div>
      </Drawer>
    </>
  );
}

/**
 * 나의 일정 목록. 넓은 화면의 서랍(`Account`)과 좁은 화면의 시트(`HeaderSchedule`)가
 * 같은 것을 쓴다 — 껍데기만 폭에 따라 갈리고 안은 하나다.
 *
 * 시각을 폭 고정으로 앞에 세운다 — 일정 이름 길이가 달라도 시각이 한 줄로 맞아서 하루 흐름이
 * 위아래로 읽힌다. 오늘 화면 카드에 있던 모양 그대로다 (v1.6.0에 이리로 옮겼다).
 *
 * 날짜 소제목으로 하루씩 끊는다 — 시각만 늘어놓으면 이레치가 한 덩어리로 붙어서 `15:16`이
 * 어느 날 세시인지 알 수 없다. 목록은 이미 시작 시각순이라 앞에서부터 접으면 끊긴다
 * (`listEvents`가 정렬해 준다).
 *
 * 시각 옆에 색 막대, 이름 뒤에 참석·반복 표시, 프로젝트 일정이면 아래에 flow 링크가 붙는다.
 * 넷 다 §8.2 목록 응답에 이미 들어 있는 값이라 호출이 더 늘지 않는다. 장소·참석자 명단·회의
 * 링크는 일정마다 상세(§8.5)를 한 번씩 더 불러야 나와서 여기에 안 넣었다.
 *
 * 참석 표시는 `"ATTENDING"`일 때만 그린다. 값 목록이 명세에 없어서(`FlowEvent`) 나머지를
 * 짐작해 적으면 "미정"과 "불참"이 뒤집힌다 — 모르면 안 그리는 편이 낫다. 그래서 불참으로
 * 응답한 일정은 아무 표시 없는 일정과 같아 보인다. 그 값을 한 번 보면 그때 갈라 준다.
 */
function ScheduleList({
  events,
  today,
}: {
  events: FlowEvent[] | null;
  today: string;
}) {
  if (events === null) {
    return (
      <p className="text-xs text-muted-foreground">
        flow가 잠시 답을 주지 않았어요. 새로고침하면 일정을 다시 불러와요.
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<IconCalendar size={18} />}
        title="앞으로 일주일은 일정이 없어요"
      />
    );
  }

  const days: [string, FlowEvent[]][] = [];
  for (const event of events) {
    const ymd = event.eventStartDateTime.slice(0, 8);
    const last = days.at(-1);
    if (last?.[0] === ymd) last[1].push(event);
    else days.push([ymd, [event]]);
  }

  // 달력이 여럿일 때만 이름을 붙인다. 하나뿐이면 그 이름이 곧 내 이름이라 줄마다 같은 말이
  // 반복될 뿐이고, 색 막대도 전부 같은 색이라 구분할 게 없다. 여럿이면 반대로 색이 뜻을
  // 갖기 시작하니 이름이 그 색의 범례가 된다 (a11y: 색만으로 뜻을 나르지 않는다).
  const named = new Set(events.map((e) => e.calendarName).filter(Boolean)).size > 1;

  return (
    <div className="space-y-4">
      {days.map(([ymd, list]) => (
        <section key={ymd}>
          <h3 className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            {ymd === today && <span className="text-primary">오늘 · </span>}
            {fmtDayLabel(ymd)}
          </h3>
          <ul className="space-y-2">
            {list.map((event) => {
              const color = hexColor(event.eventColor, event.calendarColor);
              const calendar = named ? event.calendarName : undefined;
              return (
                // 세 칸을 격자로 세운다. flex로 두면 시각·색 막대가 이름 줄 위에 걸려서
                // `mt-0.5`·`mt-1` 같은 값을 손으로 맞춰야 하는데, 글자 크기가 바뀌면 그대로
                // 어긋난다. 격자는 `items-center`가 칸마다 세로 가운데를 잡아 준다.
                // 아래 줄(달력 이름·링크)은 `col-start-3`으로 이름 아래에 붙어서 왼쪽 여백을
                // 따로 계산하지 않는다.
                <li
                  key={event.eventSrno}
                  className="grid grid-cols-[76px_3px_1fr] items-center gap-x-2 gap-y-0.5"
                >
                  <span className="tabular text-xs text-muted-foreground">
                    {event.allDayYn === 'Y'
                      ? '종일'
                      : `${fmtTime(event.eventStartDateTime)}–${fmtTime(event.eventFinishDateTime)}`}
                  </span>
                  <span
                    aria-hidden
                    className="h-3 rounded-full bg-border"
                    style={color ? { backgroundColor: color } : undefined}
                  />
                  {/*
                    아이콘의 `align-[-1px]`은 12px 아이콘을 13px 한글 가운데에 앉히는 값이다.
                    `align-middle`은 x-height(로마자 소문자 높이) 기준이라 위아래가 꽉 찬 한글
                    옆에서는 1px쯤 내려앉아 보인다. 둘은 같은 값을 쓴다 — 서로 어긋나면 그게
                    제일 먼저 눈에 띈다.
                  */}
                  <span className="min-w-0 text-[13px] leading-snug">
                    {event.eventName}
                    {event.attendanceStatus === 'ATTENDING' && (
                      <>
                        <IconAttending
                          size={12}
                          aria-hidden
                          className="ml-1 inline align-[-1px] text-muted-foreground"
                        />
                        <span className="sr-only"> (참석해요)</span>
                      </>
                    )}
                    {event.repeatSrno && (
                      <>
                        <IconRepeat
                          size={12}
                          aria-hidden
                          className="ml-1 inline align-[-1px] text-muted-foreground"
                        />
                        <span className="sr-only"> (반복 일정)</span>
                      </>
                    )}
                  </span>
                  {(calendar || event.colaboSrno) && (
                    <span className="col-start-3 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      {calendar}
                      {event.colaboSrno && (
                        <FlowLink
                          href={flowProjectUrl(event.colaboSrno)}
                          className="text-[11px]"
                        />
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * 좁은 화면의 나의 일정. 레일이 없어서 헤더가 대신 든다 — 넓은 화면에서는 레일 발의 팝오버가
 * 서랍을 연다 (`Account`).
 *
 * 서랍이 아니라 바텀시트인 것은 소식 종과 같은 이유다 (news-bell.tsx, v1.5.2). 오른쪽에서
 * 들어오는 320px 판은 390px 화면에서 스크림을 한 뼘만 남기고, 그 판을 여는 단추도 손이 가장 안
 * 닿는 헤더 오른쪽 끝이다. 시트는 아래에서 올라와 엄지가 닿는 곳에 서고 던져서 닫는다.
 *
 * `lg:hidden`이면 충분해서 `useNarrowScreen`은 안 쓴다 — 종처럼 껍데기를 고르는 게 아니라
 * 여기는 좁은 화면 전용 단추 하나다.
 */
function HeaderSchedule({
  events,
  today,
}: {
  events: FlowEvent[] | null;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const count = events?.length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="나의 일정"
        className="flex min-h-9 cursor-pointer items-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
      >
        <IconCalendar size={18} aria-hidden />
        {/* 건수 배지는 안 단다 — 옆의 종이 쓰는 표시라 같은 모양이면 안 읽은 소식으로 읽힌다.
            대신 읽어 주는 이름에 붙여서 화면 낭독으로는 열기 전에 알 수 있다 */}
        <span className="sr-only">나의 일정{count > 0 && ` — ${count}건`}</span>
      </button>

      {/* `max-w-none`·아래 여백은 소식 시트와 같은 이유다 (news-bell.tsx). 여기는 목록 하나뿐이라
          가로지르는 구분선이 없어서 좌우 여백은 시트 기본값을 쓴다 */}
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="나의 일정"
        description={count > 0 ? `${count}건이에요.` : undefined}
        snapPoints={['auto']}
        className="max-w-none"
        bodyClassName="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <ScheduleList events={events} today={today} />
      </BottomSheet>
    </>
  );
}

/**
 * 레일의 검색 줄. `⌘K`로 어디서든 열리지만, 있는 줄 알려면 눌릴 자리가 있어야 한다.
 *
 * 조합키를 줄 끝에 적어 둔다 — 팔레트 안의 `esc` 표시와 같은 모양이다
 * (`search-palette.tsx`). `aria-hidden`인 것은 이 단추의 이름이 "검색"이면 되기 때문이고,
 * 조합키는 `title`이 이미 읽어 준다.
 */
function SidebarSearch() {
  const open = useSearchOpen();

  return (
    <SidebarButton icon={<IconSearch size={18} />} title="검색 (⌘K)" onClick={open}>
      <span className="flex items-center justify-between gap-2">
        검색
        <kbd
          aria-hidden
          className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium"
        >
          ⌘K
        </kbd>
      </span>
    </SidebarButton>
  );
}

/** 좁은 화면의 검색. 레일이 없어서 헤더가 대신 든다 — 넓은 화면에서는 레일 줄이 이 일을 한다. */
function HeaderSearch() {
  const open = useSearchOpen();

  return (
    <button
      type="button"
      onClick={open}
      title="검색"
      className="flex min-h-9 cursor-pointer items-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
    >
      <IconSearch size={18} aria-hidden />
      <span className="sr-only">검색</span>
    </button>
  );
}

/**
 * 좁은 화면의 로그아웃. 레일이 없어서 헤더가 대신 든다 — 넓은 화면에서는 레일 발의 팝오버가
 * 이 일을 한다 (`Account`).
 *
 * POST로만 보낸다. GET이면 링크 프리페치가 세션을 날릴 수 있다. 아이콘만 남기는 것은 헤더
 * 오른쪽 끝의 이 아이콘이 관용어라 글자 없이도 읽히기 때문이고, 이름은 `title`과 `sr-only`로
 * 남는다.
 */
function SignOut() {
  return (
    <form action="/api/auth/logout" method="post" className="shrink-0 lg:hidden">
      <button
        type="submit"
        title="로그아웃"
        className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <IconSignOut size={16} />
        <span className="sr-only">로그아웃</span>
      </button>
    </form>
  );
}
