import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        // 원본(shadcn)에 있던 `overflow-hidden`을 뺐다. 카드 안에 Select가 있으면
        // 드롭다운이 `absolute`라 카드 높이·라운드에서 잘린다 (BUG-014). 배경은
        // `rounded-lg`가 알아서 자르고, 이미지 모서리는 아래 `*:[img:...]` 규칙이 직접
        // 깎는다 — 클리핑이 하던 일이 애초에 없다.
        //
        // `rounded-xl`(--radius + 4px)이던 것을 `rounded-lg`(--radius)로 내렸다. 카드가
        // 버튼·배지보다 더 둥글면 같은 화면에서 두 개의 모서리 곡률이 경쟁한다.
        //
        // 안쪽 여백은 16/12 → 20/16(v1.7.0). 본문 패딩 32, 카드 패딩 16, 섹션 간격 24가
        // 사실상 한 급이라 화면 전체가 같은 밀도로 촘촘했다 — 답답하게 읽히던 원인이다.
        // 세 급이 20 → 32 → 40으로 벌어져야 "카드 안 / 카드 사이 / 구획 사이"가 구분된다.
        "group/card flex flex-col gap-(--card-spacing) rounded-lg bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(5)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-lg px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

// 원본(shadcn)은 `<div>`였다. 카드 제목은 화면에서 이미 제목으로 읽히는데 목차에는 안
// 잡혀서, 읽어 주는 쪽에는 페이지 `h1` 하나 다음이 곧장 본문이었다 — 카드 여덟 개를 제목으로
// 건너뛸 방법이 없었다. 쓰는 자리가 전부 `h1` 바로 아래 한 단이라 `h2`로 고정한다.
function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn(
        // 카드 제목은 bold(700)다. medium이던 때는 바로 아래 상태 필터·본문 줄과 굵기
        // 차이가 얇아서 카드 경계가 제목으로 안 읽혔다. 안에 붙는 건수는 `font-normal`을
        // 따로 갖고 있어서 같이 굵어지지 않는다.
        "font-heading text-base leading-snug font-bold group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-lg border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
