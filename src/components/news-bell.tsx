"use client";

import { IconNews } from "@/components/icons";
import { NotificationStack } from "@/components/motion/notification-stack";
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
 * 레이어 안은 beUI Notification Stack이다 — 접혀 있을 땐 카드가 겹쳐 쌓인 한 장으로 보이고,
 * 올리거나 누르면 펼쳐진다.
 *
 * 알림이 주는 건 프로젝트 id·문구·등록자·시각뿐이다. 업무명도 링크도 없어서 (rest.ts)
 * 여기서 낼 수 있는 것도 딱 그만큼이다 — 없는 걸 지어내지 않는다.
 */
export function NewsBell({ news }: { news: TaskNews[] | null }) {
  const unread = news?.filter((n) => n.unread).length ?? 0;

  return (
    <Popover>
      <PopoverTrigger
        title="업무 소식"
        className="relative flex min-h-9 cursor-pointer items-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-open:text-foreground"
      >
        <IconNews size={18} />
        <span className="sr-only">
          업무 소식{unread > 0 && ` — 안 읽은 소식 ${unread}건`}
        </span>
        {/* 안 읽은 것만 배지로 센다. 다 읽은 줄까지 세면 배지가 늘 켜져 있어서 신호가 죽는다 */}
        {unread > 0 && (
          <span className="tabular absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground">
            {unread}
          </span>
        )}
      </PopoverTrigger>
      {/* 팝오버 표면을 끈다 — 스택이 제 뒷판을 그린다. 안 끄면 카드 안 카드가 된다.
          펼치면 스택이 이 상자 아래로 자란다 (notification-stack.tsx) */}
      <PopoverContent
        aria-label="업무 소식"
        align="end"
        className="w-auto border-0 bg-transparent p-0 shadow-none ring-0"
      >
        <NotificationStack
          items={(news ?? []).map((item) => ({
            id: item.id,
            title: item.message,
            description: [item.project, item.from].filter(Boolean).join(" · "),
            trailing: <span className="tabular">{fmtDateTime(item.at)}</span>,
          }))}
          maxVisible={6}
          collapsedLabel="업무 소식"
          expandedLabel="접기"
          emptyLabel={news === null ? "소식을 못 가져왔어요" : "새 소식이 없어요"}
          className="w-[min(22rem,calc(100vw-2rem))]"
          classNames={{
            surface: cn(
              "bg-popover shadow-md ring-1 ring-foreground/10",
              news === null && "text-danger-foreground",
            ),
            title: "line-clamp-3 font-normal",
          }}
        />
        {/* 스택은 `aria-label`을 붙인 버튼 하나다 — 라벨이 이기니 안쪽 카드 글자는
            스크린 리더에 안 읽힌다. 눈으로 보는 쪽은 위 스택, 읽어 주는 쪽은 이 목록이다. */}
        <ul className="sr-only">
          {news?.map((item) => (
            <li key={item.id}>
              {[item.project, item.from, fmtDateTime(item.at), item.unread && "안 읽음"]
                .filter(Boolean)
                .join(" · ")}
              {" — "}
              {item.message}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
