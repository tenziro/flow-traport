import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // 원본(shadcn)의 `bg-muted`를 바꿨다. `--muted`(#f5f5f5)와 페이지 배경
      // `--background`(#fafafa)가 밝은 화면에서 거의 같은 색이라, 카드 밖에 놓인 골격
      // (화면 제목·탭 자리)이 보이지 않았다. `--secondary`도 `--muted`와 같은 값이라
      // 탭 껍데기 위에서도 마찬가지였다 (globals.css).
      //
      // 본문색 8%는 세 면(#fafafa 배경 · #ffffff 카드 · #f5f5f5 탭) 위에서 다 보이고
      // 어두운 화면에서도 같은 규칙 하나로 밝아진다.
      className={cn("animate-pulse rounded-md bg-foreground/8", className)}
      {...props}
    />
  )
}

export { Skeleton }
