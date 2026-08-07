"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { markMentionsRead } from "@/app/(app)/actions";
import { IconCheck, IconInbox, IconNews, IconNewsOff } from "@/components/icons";
import { BottomSheet } from "@/components/motion/bottom-sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { StatHint } from "@/components/stat-hint";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTaskModal } from "@/components/use-task-modal";
import type { TaskNews } from "@/lib/flow/queries";
import { useNarrowScreen } from "@/lib/hooks/use-narrow-screen";
import { useNewsNotify } from "@/lib/hooks/use-news-notify";
import { cn, fmtDateTime } from "@/lib/utils";

/**
 * 소식을 다시 당기는 간격(ms). 1분이면 "받자마자"로 읽히고, 폴링 한 번은 REST 두 번이다
 * (제목·링크는 캐시에 있다 — `NEWS_BRIEF_TTL`). 분당 상한 120번 중 2번이다.
 */
const NEWS_POLL_MS = 60_000;

/**
 * 알림 스위치가 상태마다 하는 말. 아이콘 하나뿐인 단추라 `title`이 유일한 설명이고,
 * 화면 낭독기에는 같은 말이 `sr-only`로 간다.
 */
const NOTIFY_HINT = {
  off: "새 소식이 오면 알림 받기",
  on: "새 소식 알림 켜짐 — 누르면 꺼요",
  denied: "브라우저가 이 사이트의 알림을 막아 뒀어요",
  unsupported: "",
} as const;

/** 소식 한 줄의 껍데기. 단추(보통)와 링크(못 연 줄)가 같은 모양이어야 한다. */
const NEWS_ROW =
  "flex w-full min-w-0 flex-col gap-1.5 rounded-lg px-2.5 py-3 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * 헤더 알림 종 (PRD §13 B1·B2).
 *
 * 예전에는 오늘 화면 맨 아래 카드였다. 소식은 "챙길 일"이 아니라 "알고만 있으면 되는 것"이라
 * 화면 한 자리를 늘 차지할 게 아니었고, 리스크·팀 화면에서는 아예 안 보였다. 종으로 올리니
 * 세 화면 어디서나 같은 자리에 있고 안 볼 때는 아이콘 하나로 접힌다.
 *
 * 레이어는 위가 탭(전체·안 읽음·읽음)과 전체 읽음 버튼, 아래가 스크롤되는 소식 목록이다.
 * v0.17까지는 beUI Notification Stack이었는데 접기 버튼을 걷어내자(v0.18) 남는 게 카드 목록
 * 하나여서 스택 자체를 물렸다 — 팝오버를 열면 Radix가 안쪽으로 포커스를 넣어서 스택은 늘
 * 펼친 상태였고, 겹쳐 쌓인 모습은 실제로 보이지도 않았다.
 *
 * **좁은 화면에서는 같은 내용이 바텀시트로 열린다** (v1.1.0, §7.3의 1024px 선). 팝오버는 종
 * 아래에 매달리는데 좁은 화면에서 종은 앱바 오른쪽 끝이라, 폭을 거의 다 쓰는 판이 손이 가장 안
 * 닿는 구석에 붙어 열렸다. 시트는 아래에서 올라와서 엄지가 닿는 곳에 서고, 손잡이를 아래로
 * 밀거나 던져서 닫는다 — 좁은 화면에서 유일하게 닫는 법이던 "빈 곳 누르기"는 판이 화면을 거의
 * 덮고 있을 때 누를 빈 곳이 없다.
 *
 * 판 안쪽(`panel`)은 두 껍데기가 **같은 것을 쓴다**. 컴포넌트로 가르지 않고 변수 하나로 둔 건
 * 탭·읽음 처리·집계를 일곱 개 인자로 넘겨야 하기 때문이다 — 같은 함수 안에 두면 인자가 없다.
 * 열려 있는 껍데기 하나만 실제로 그려진다 (닫힌 팝오버·시트는 자식을 안 붙인다).
 *
 * 한 줄을 누르면 그 글로 가고(새 탭) 그 알림은 읽음이 된다. 링크는 flow가 만들어 준
 * `connectUrl`이다 — 로그인 화면을 건너서도 대상을 지킨다 (queries.ts, BUG-024).
 *
 * 카드 한 장은 업무명 · 프로젝트명 · 내용 · 작성자 네 줄이다. 제목 자리는 업무명이다 —
 * 업무 목록의 한 줄도 업무명이 제목이라, 같은 대상을 두 화면에서 다른 이름으로 부르지 않는다.
 * 둘 다 알림에 없어서 `loadNews`가 풀어 붙인 값이고, 업무명을 못 풀면 프로젝트명이 제목
 * 자리로 올라온다 — 없는 걸 지어내지 않고, 제목 없는 카드도 만들지 않는다.
 *
 * **1분마다 스스로 당겨 온다** (`/api/news`) — flow가 알림을 밀어 주지 않아서 폴링이
 * 유일한 방법이다. 화면을 새로 고치지 않아도 새 소식이 오면 배지가 그때 켜진다.
 */
export function NewsBell({ news }: { news: TaskNews[] | null }) {
  // 서버가 그려 준 값으로 시작해서, 폴링이 가져온 값으로 갈아탄다. 폴링이 한 번이라도
  // 성공하면 그 뒤로는 이쪽이 진실이다 — 읽음 처리는 아래에서 이 목록을 같이 고친다.
  const [live, setLive] = useState(news);
  const items = live ?? news;
  const unread = items?.filter((n) => n.unread).length ?? 0;

  const notify = useNewsNotify(news);
  const { fire, awake } = notify;

  useEffect(() => {
    const pull = async () => {
      // 숨어 있을 때는 보통 쉰다. 알림을 켜 뒀으면 그때가 오히려 알림이 쓸모 있는 때라
      // 계속 당긴다 — 다른 앱을 보는 동안 오는 소식이 알림으로 갈 유일한 길이다.
      if (document.hidden && !awake.current) return;
      const fresh = await fetch("/api/news")
        .then((r) => (r.ok ? (r.json() as Promise<TaskNews[] | null>) : null))
        .catch(() => null);
      // 실패는 조용히 넘긴다 — 다음 분에 다시 부른다.
      if (!fresh) return;
      setLive(fresh);
      fire(fresh);
    };
    const timer = setInterval(pull, NEWS_POLL_MS);
    // 탭을 다시 보면 그 자리에서 한 번 당긴다 — 숨어 있던 동안 건너뛴 몫이다.
    document.addEventListener("visibilitychange", pull);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", pull);
    };
  }, [fire, awake]);
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"all" | "unread" | "read">("all");
  // 여닫는 상태를 우리가 든다 — 껍데기가 둘이라 어느 쪽이 열릴지 여기서 고른다.
  const [open, setOpen] = useState(false);
  const narrow = useNarrowScreen();

  // 목록은 닫는다 — 모달이 그 위에 겹치면 뒤에 남은 목록이 배경으로 어른거린다.
  const task = useTaskModal(() => setOpen(false));

  // 새 탭이 열리는 동안 이 탭에서는 읽음 처리만 한다. 액션이 revalidate까지 해서 배지와
  // 점이 그 자리에서 줄어든다 — 그게 처리됐다는 신호다.
  // 이름은 멘션에서 왔지만 하는 일은 `alarmId` 읽음 처리라 그대로 쓴다 (actions.ts).
  const markRead = (...ids: string[]) => {
    if (!ids.length) return;
    // 배지와 점은 그 자리에서 끈다 — 서버 액션이 다시 그려 주는 값은 우리가 들고 있는
    // 목록(`live`)에 안 덮이고, 다음 폴링까지 최대 1분 동안 점이 남아 있었다.
    setLive((rows) => rows?.map((n) => (ids.includes(n.id) ? { ...n, unread: false } : n)) ?? null);
    const form = new FormData();
    form.set("alarmIds", ids.join(","));
    form.set("path", pathname);
    startTransition(async () => {
      await markMentionsRead(null, form);
    });
  };

  const shown = (items ?? []).filter(
    (n) => tab === "all" || (tab === "unread" ? n.unread : !n.unread),
  );

  /**
   * 한 줄을 누르면 그 업무의 상세 모달이 이 화면에서 열린다 (`useTaskModal`). 읽음 처리는
   * 여는 것과 별개로 여기서 한다 — 업무가 아닌 글이라 모달이 안 열려도 본 건 본 거다.
   */
  const openTask = (item: TaskNews) => {
    if (item.unread) markRead(item.id);
    task.open({
      projectId: item.projectId,
      postId: item.postId,
      title: item.title,
      project: item.project,
      url: item.url,
    });
  };

  const panel = (
    <>
      {/* 아래 패딩이 없다 — 밑줄 인디케이터(`-bottom-px`)가 이 줄의 구분선 위에 그대로 앉는다.
          탭 자체 `border-b`는 지운다. 안 지우면 폭이 짧은 선 하나가 위에 더 그려진다 */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 pt-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} variant="underline">
          <TabsList aria-label="소식 보기" className="border-b-0">
            <TabsTrigger value="all" className="mb-0 min-h-10 px-2.5 py-2 text-xs">
              전체
            </TabsTrigger>
            <TabsTrigger value="unread" className="mb-0 min-h-10 px-2.5 py-2 text-xs">
              안 읽음
            </TabsTrigger>
            <TabsTrigger value="read" className="mb-0 min-h-10 px-2.5 py-2 text-xs">
              읽음
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex shrink-0 items-center gap-0.5">
          {/* 알림 스위치. 브라우저가 못 하는 환경에서는 줄 자체가 없다. 권한을 묻는 건
              여기서만 — 사람이 직접 누른 자리가 아니면 브라우저가 안 받는다.
              막힌 상태(`denied`)도 끄지 않고 흐리게 남긴다: 왜 안 오는지가 여기 적힌다 */}
          {notify.state !== "unsupported" && (
            <StatHint hint={NOTIFY_HINT[notify.state]}>
              <button
                type="button"
                aria-pressed={notify.state === "on"}
                // `disabled`가 아니라 `aria-disabled`다 — 막힌 단추는 포인터 이벤트가 죽어서
                // 툴팁이 안 뜨는데, 하필 그 상태가 설명이 가장 필요한 자리다. 누르는 쪽은
                // `toggle`이 이미 막고 있다
                aria-disabled={notify.state === "denied"}
                onClick={notify.toggle}
                className={cn(
                  "flex min-h-8 shrink-0 items-center rounded-md px-2 transition-colors hover:bg-accent hover:text-foreground",
                  notify.state === "on" ? "text-foreground" : "text-muted-foreground",
                  notify.state === "denied" ? "cursor-default opacity-40" : "cursor-pointer",
                )}
              >
                {notify.state === "on" ? (
                  /* 켜진 종은 채운다. 색만으로는 `text-foreground`와 `muted-foreground`
                     차이라 14px 아이콘 하나에서는 거의 안 갈렸다 — 켜짐/꺼짐은 이 단추가
                     말하는 전부다 */
                  <IconNews size={14} weight="Filled" aria-hidden />
                ) : (
                  <IconNewsOff size={14} aria-hidden />
                )}
                <span className="sr-only">{NOTIFY_HINT[notify.state]}</span>
              </button>
            </StatHint>
          )}
          {/* 안 읽은 게 없으면 누를 일이 없어서 끈다. 확인 단계는 두지 않는다 — 이전 상태가
              "안 읽음" 하나고 잃는 데이터가 없다 (PRD §8.1) */}
          <button
            type="button"
            disabled={pending || unread === 0}
            onClick={() => markRead(...(items ?? []).filter((n) => n.unread).map((n) => n.id))}
            className="flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          >
            <IconCheck size={14} aria-hidden />
            전체 읽음
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <p
          className={cn(
            "flex items-center justify-center gap-2 p-8 text-sm font-medium text-muted-foreground",
            items === null && "text-danger-foreground",
          )}
        >
          <IconInbox size={16} aria-hidden />
          {items === null
            ? "소식을 못 가져왔어요"
            : tab === "unread"
              ? "안 읽은 소식이 없어요"
              : tab === "read"
                ? "읽은 소식이 없어요"
                : "새 소식이 없어요"}
        </p>
      ) : (
        // 목록만 스크롤한다 — 탭과 전체 읽음은 위에 붙어 있어야 긴 목록에서도 손에 닿는다.
        // 이 상한이 시트의 키도 정한다: 시트는 내용 높이만큼만 서므로(`snapPoints=["auto"]`)
        // 목록이 여기서 멈추면 시트도 화면의 4분의 3쯤에서 멈춘다.
        <ul className="max-h-[min(28rem,60vh)] overflow-y-auto overscroll-contain p-2">
          {shown.map((item) => {
            const body = (
              <>
                <span className="flex min-w-0 items-center justify-between gap-3">
                  {/* 점과 제목을 한 줄짜리 flex로 묶는다 — `align-middle`로는 글자 상자
                      기준이라 점이 살짝 위에 떴다. 여기서는 `items-center`가 두 개를
                      같은 세로 중앙에 놓는다. */}
                  <span className="flex min-w-0 items-center gap-1.5">
                    {item.unread && (
                      <>
                        {/* 안 읽은 줄에만 점. 눌러서 읽음이 되면 사라진다 */}
                        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="sr-only">안 읽음 · </span>
                      </>
                    )}
                    {/* 한 줄로 자른다 — `[비즈플레이]B2603-…` 처럼 길어서 안 자르면 카드가
                        제목 한 줄로 찬다. 아래 프로젝트명도 같은 이유로 한 줄이다. */}
                    <span className="truncate text-sm font-bold">
                      {item.title || item.project}
                    </span>
                  </span>
                  {/* 여는 동안 시각 자리가 진행을 말한다 — 목록이 그대로 있는 채로 한 박자
                      기다리게 되는데, 아무 반응이 없으면 안 눌린 줄 알고 또 누른다 */}
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {task.opening === item.postId ? "여는 중…" : fmtDateTime(item.at)}
                  </span>
                </span>
                {/* 업무명이 제목 자리로 올라갔을 때만 프로젝트명이 아래에 붙는다. 업무명을
                    못 풀었으면 프로젝트명이 이미 위에 있어서 같은 값을 두 번 쓰지 않는다. */}
                {item.title && (
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {item.project}
                  </span>
                )}
                <span className="line-clamp-2 text-[13px] text-foreground">{item.message}</span>
                <span className="text-xs text-muted-foreground">{item.from}</span>
                {task.failed === item.postId && (
                  <span className="text-xs text-danger-foreground">
                    여기서는 못 열어요 — 한 번 더 누르면 flow에서 열려요
                  </span>
                )}
              </>
            );

            // 못 연 줄만 링크로 돌아간다. 실패한 자리에서 새 탭을 우리가 열면 브라우저가
            // 팝업으로 보고 막는다 — 사람이 직접 누른 링크는 안 막힌다.
            return (
              <li key={item.id}>
                {task.failed === item.postId ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(NEWS_ROW, "cursor-pointer")}
                  >
                    {body}
                  </a>
                ) : (
                  <button
                    type="button"
                    aria-busy={task.opening === item.postId}
                    onClick={() => openTask(item)}
                    className={cn(NEWS_ROW, "cursor-pointer text-left")}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 목록이 스크롤돼도 이 줄은 아래에 붙어 있다. 숫자는 탭과 무관하게 전체 기준이다 —
          "안 읽음" 탭에서 세 건만 보일 때 그게 전체 중 몇 건인지가 여기서 읽힌다.
          소식이 아예 없거나 못 가져왔으면 `0건`을 적지 않는다 — 위 빈 화면이 이미 말한다. */}
      {!!items?.length && (
        <p className="tabular border-t border-border px-3 py-2 text-xs text-muted-foreground">
          전체 {items.length}건{unread > 0 && ` · 안 읽음 ${unread}건`}
        </p>
      )}
    </>
  );

  return (
    <>
      {/* 좁은 화면에서는 이 팝오버가 열리지 않는다. 종은 여전히 여기 있어야 한다 —
          Radix가 판을 매다는 기준점이고, 껍데기를 갈아도 눌리는 단추는 하나여야 한다 */}
      <Popover open={open && !narrow} onOpenChange={setOpen}>
        <PopoverTrigger
          title="업무 소식"
          className="relative flex min-h-9 cursor-pointer items-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-open:text-foreground"
        >
          {/* 안 읽은 게 있으면 종이 흔들린다 (`bell-ring` — globals.css). 배지는 이미 있지만
              10px 숫자 하나라 헤더를 안 보고 있으면 안 보인다 — 움직임은 곁눈에 걸린다 */}
          <IconNews size={18} className={cn(unread > 0 && "bell-ring")} />
          <span className="sr-only">업무 소식{unread > 0 && ` — 안 읽은 소식 ${unread}건`}</span>
          {/* 안 읽은 것만 배지로 센다. 다 읽은 줄까지 세면 배지가 늘 켜져 있어서 신호가 죽는다 */}
          {unread > 0 && (
            <span className="tabular absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
              {unread}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent
          aria-label="업무 소식"
          align="end"
          className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0"
        >
          {panel}
        </PopoverContent>
      </Popover>

      {/* `max-w-none`은 폭을 화면에 맞추려는 것이다 — 시트 기본값 `max-w-2xl`(672px)로는
          768~1023px에서 양옆에 틈이 생겨서 아래가 잘린 카드처럼 보인다.
          `p-0`은 탭 줄과 집계 줄의 구분선이 시트 폭을 가로지르게 하려는 것이고(팝오버와 같다),
          아래 여백은 홈 인디케이터 몫이다 — 없으면 집계 줄이 그 아래로 들어간다.

          스냅은 둘이다. 열 때는 내용 높이(`auto`)로 서고, 핸들을 끌어 올리면 화면 가득이다 —
          소식이 쌓이면 시트 안쪽만 스크롤하게 되는데 그때 길게 보는 길이 손끝에 있어야 한다.
          내리면 다시 내용 높이, 거기서 더 내리면 닫힌다 */}
      <BottomSheet
        open={open && narrow}
        onOpenChange={setOpen}
        title="업무 소식"
        snapPoints={["auto", 0.92]}
        className="max-w-none"
        bodyClassName="p-0 pb-[env(safe-area-inset-bottom)]"
      >
        {panel}
      </BottomSheet>

      {task.modal}
    </>
  );
}
