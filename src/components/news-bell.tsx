"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { markMentionsRead } from "@/app/(app)/actions";
import { IconCheck, IconInbox, IconNews } from "@/components/icons";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TaskNews } from "@/lib/flow/queries";
import { cn, fmtDateTime } from "@/lib/utils";

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
 * 한 줄을 누르면 그 글로 가고(새 탭) 그 알림은 읽음이 된다. 링크는 flow가 만들어 준
 * `connectUrl`이다 — 로그인 화면을 건너서도 대상을 지킨다 (queries.ts, BUG-024).
 *
 * 카드 한 장은 프로젝트명 · 업무명 · 내용 · 작성자 네 줄이다. 프로젝트명과 업무명은 알림에
 * 없어서 `loadNews`가 풀어 붙인 값이고, 못 풀면 그 줄이 빠진다 — 없는 걸 지어내지 않는다.
 */
export function NewsBell({ news }: { news: TaskNews[] | null }) {
  const unread = news?.filter((n) => n.unread).length ?? 0;
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"all" | "unread" | "read">("all");

  // 새 탭이 열리는 동안 이 탭에서는 읽음 처리만 한다. 액션이 revalidate까지 해서 배지와
  // 점이 그 자리에서 줄어든다 — 그게 처리됐다는 신호다.
  // 이름은 멘션에서 왔지만 하는 일은 `alarmId` 읽음 처리라 그대로 쓴다 (actions.ts).
  const markRead = (...ids: string[]) => {
    if (!ids.length) return;
    const form = new FormData();
    form.set("alarmIds", ids.join(","));
    form.set("path", pathname);
    startTransition(async () => {
      await markMentionsRead(null, form);
    });
  };

  const shown = (news ?? []).filter(
    (n) => tab === "all" || (tab === "unread" ? n.unread : !n.unread),
  );

  return (
    <Popover>
      <PopoverTrigger
        title="업무 소식"
        className="relative flex min-h-9 cursor-pointer items-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-open:text-foreground"
      >
        <IconNews size={18} />
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
          {/* 안 읽은 게 없으면 누를 일이 없어서 끈다. 확인 단계는 두지 않는다 — 이전 상태가
              "안 읽음" 하나고 잃는 데이터가 없다 (PRD §8.1) */}
          <button
            type="button"
            disabled={pending || unread === 0}
            onClick={() => markRead(...(news ?? []).filter((n) => n.unread).map((n) => n.id))}
            className="flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          >
            <IconCheck size={14} aria-hidden />
            전체 읽음
          </button>
        </div>

        {shown.length === 0 ? (
          <p
            className={cn(
              "flex items-center justify-center gap-2 p-8 text-sm font-medium text-muted-foreground",
              news === null && "text-danger-foreground",
            )}
          >
            <IconInbox size={16} aria-hidden />
            {news === null
              ? "소식을 못 가져왔어요"
              : tab === "unread"
                ? "안 읽은 소식이 없어요"
                : tab === "read"
                  ? "읽은 소식이 없어요"
                  : "새 소식이 없어요"}
          </p>
        ) : (
          // 목록만 스크롤한다 — 탭과 전체 읽음은 위에 붙어 있어야 긴 목록에서도 손에 닿는다.
          <ul className="max-h-[min(28rem,60vh)] overflow-y-auto p-2">
            {shown.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={item.unread ? () => markRead(item.id) : undefined}
                  className="flex min-w-0 flex-col gap-1.5 rounded-lg px-2.5 py-3 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex min-w-0 items-start justify-between gap-3">
                    {/* 프로젝트명은 한 줄로 자른다 — `[비즈플레이]B2603-…` 처럼 길어서 안 자르면
                        카드가 프로젝트명으로 찬다. 업무명도 같은 이유로 한 줄이다. */}
                    <span className="truncate text-sm font-bold">
                      {item.unread && (
                        <>
                          {/* 안 읽은 줄에만 점. 눌러서 읽음이 되면 사라진다 */}
                          <span
                            aria-hidden
                            className="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle"
                          />
                          <span className="sr-only">안 읽음 · </span>
                        </>
                      )}
                      {item.project}
                    </span>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">
                      {fmtDateTime(item.at)}
                    </span>
                  </span>
                  {/* 업무명은 게시글 제목을 따로 풀어 온 값이라 없을 수 있다 (queries.ts) */}
                  {item.title && (
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {item.title}
                    </span>
                  )}
                  <span className="line-clamp-2 text-[13px] text-foreground">{item.message}</span>
                  <span className="text-xs text-muted-foreground">{item.from}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
