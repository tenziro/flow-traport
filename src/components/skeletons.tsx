import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * 화면 골격의 부품들 (PRD §7.4 — 300ms 넘으면 스피너가 아니라 골격).
 *
 * 규칙 하나만 지킨다: **틀은 진짜, 글자만 회색 막대.** 카드·격자·목록 껍데기는 실제 화면과
 * 같은 컴포넌트(`Card`)와 같은 클래스로 두고 그 안의 글자 자리만 `Skeleton`으로 비운다.
 * 골격을 대충 다른 모양으로 그리면 내용이 도착하는 순간 카드 높이와 칸 수가 달라져 화면이
 * 한 번 튄다 — 그 튐이 골격을 쓰는 이유(무엇이 어디에 올지 미리 보여주기)를 스스로 깬다.
 *
 * `rise` 진입 애니메이션은 붙이지 않는다. 골격은 잠깐 있다 사라지는 것이라 나타나는 동작까지
 * 주면 뒤이어 오는 실제 카드의 `rise`와 겹쳐 같은 자리가 두 번 흐른다.
 *
 * 클라이언트에서도 쓴다 (`thread-view.tsx`). 훅이 없어서 `"use client"`가 필요 없다.
 */

/** 화면 제목 + 설명 한 줄. 아래 여백은 화면마다 달라서 밖에서 준다. */
export function HeadSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("mb-6", className)}>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-full max-w-md" />
    </div>
  );
}

/**
 * 요약 KPI 줄. 실제 `Kpi`와 같은 격자·카드다.
 *
 * `meter`는 오늘 화면 전용이다 — 그쪽 칸에만 전체 대비 점유율 막대가 붙는다 (page.tsx `Stat`).
 */
export function KpiRowSkeleton({
  count,
  meter = false,
}: {
  count: 3 | 4;
  meter?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-10 grid grid-cols-2 gap-4",
        count === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4",
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} size="sm" className="gap-2">
          <CardContent className="space-y-1.5">
            {/* 실제와 같은 아이콘 칩 + 라벨 두 자리다 (`Kpi`, 오늘 화면 `Stat`) */}
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 shrink-0 rounded-md" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <Skeleton className="h-7 w-14" />
            {meter && <Skeleton className="h-1 w-full rounded-full" />}
            <Skeleton className="h-2.5 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * 탭 한 줄 자리 (부서 전환 · 프로젝트 보기).
 *
 * 칸을 하나씩 그리지 않고 줄 하나로 비운다 — 칸 수는 서버가 답을 줘야 안다(부서 수, 비어
 * 있지 않은 무리 수). 모르는 수를 지어 그리면 실제 탭이 도착할 때 칸이 늘거나 줄어든다.
 * 높이는 실제와 같다 (`p-0.5` + 칸 `min-h-8` = 36px).
 */
export function TabBarSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("mb-6 h-9 w-full max-w-xs rounded-lg", className)} />;
}

/**
 * 카드 한 장. 제목 줄은 실제와 같은 세 자리다 — 아이콘, 이름, 오른쪽 건수.
 *
 * `chips`는 제목 아래 상태 필터 줄이다 (오늘 화면의 포커스·밀리는 업무 카드).
 */
export function PanelSkeleton({
  children,
  className,
  chips = false,
}: {
  children: React.ReactNode;
  className?: string;
  chips?: boolean;
}) {
  return (
    <Card className={className}>
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 shrink-0 rounded-md" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        {chips && (
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-6 w-16 rounded-md" />
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * 업무 줄들 (`TaskItem`). 제목 · 상태·프로젝트·마감일 · flow 링크 세 줄에 구분선까지 같다.
 *
 * 줄마다 제목 폭을 번갈아 준다 — 폭이 다 같으면 표처럼 보여서 업무 목록으로 안 읽힌다.
 */
export function TaskRowsSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-0.5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border-b border-border/60 px-2 py-2 last:border-0">
          <Skeleton className={cn("h-4", i % 2 ? "w-1/2" : "w-3/4")} />
          <Skeleton className="mt-1.5 h-3 w-2/5" />
          <Skeleton className="mt-1.5 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * 접힌 요약 카드들 — 이름 한 줄 + 건수 + 진행 막대 + 셰브론.
 *
 * 리스크의 프로젝트 카드와 내 업무의 프로젝트 카드가 같은 모양이다. `rank`는 리스크 화면
 * 전용이다 — 그쪽만 카드 왼쪽에 순위 숫자를 박는다.
 */
export function SummaryCardsSkeleton({
  count,
  rank = false,
}: {
  count: number;
  rank?: boolean;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex items-start gap-3">
            {rank && <Skeleton className="mt-0.5 h-3 w-5 shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <Skeleton className={cn("h-4", i % 2 ? "w-40" : "w-56")} />
                <Skeleton className="ml-auto h-3 w-24 shrink-0" />
              </div>
              <Skeleton className="mt-1.5 h-1 w-full rounded-full" />
            </div>
            <Skeleton className="mt-0.5 size-4 shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * 부서 소제목 + 사람 카드 격자 (구성원 화면 `MemberCard`). 실제와 같은 `size="sm"` 카드다.
 *
 * 원판은 실제와 같은 36px이고 연락처는 두 줄, 그 아래 한마디 칸까지 셋이다 — 카드 높이를 정하는
 * 게 이들이라, 하나라도 빠뜨리면 명단이 도착할 때 격자가 통째로 늘어난다.
 */
export function MemberCardsSkeleton({ count }: { count: number }) {
  return (
    <>
      <Skeleton className="mb-2 h-4 w-28" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <Card key={i} size="sm" className="gap-2.5">
            <CardContent className="flex items-center gap-2.5">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className={cn("h-3.5", i % 2 ? "w-16" : "w-20")} />
                <Skeleton className="h-3 w-10" />
              </div>
            </CardContent>
            {/* 연락처 두 줄. 이름표 폭(`w-11`)과 오른쪽 아이콘 단추(32px)까지 실제와 같다 */}
            <CardContent className="space-y-0.5">
              {[0, 1].map((r) => (
                <div key={r} className="flex h-8 items-center gap-2">
                  <Skeleton className="h-3 w-11 shrink-0" />
                  <Skeleton className={cn("h-3", r ? "w-24" : "flex-1")} />
                  <Skeleton className="ml-auto size-8 shrink-0 rounded-md" />
                </div>
              ))}
            </CardContent>
            {/* 한마디 칸. 이제 없는 사람도 한 줄을 가져서 모든 카드에 있다. 앞의 말풍선 자리까지
                실제와 같다 */}
            <CardContent className="flex items-start gap-1.5 border-t border-border pt-2.5">
              <Skeleton className="mt-0.5 size-3 shrink-0 rounded-sm" />
              <Skeleton className={cn("h-3", i % 3 ? "w-32" : "w-20")} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

/**
 * 댓글 줄들 (`ThreadView`의 한 줄). 아이콘 + 이름·시각 줄 + 본문 두 줄이다.
 *
 * 본문 두 번째 줄은 짧게 준다 — 댓글은 마지막 줄이 덜 차는 게 보통이라 그게 글로 읽힌다.
 */
export function CommentRowsSkeleton({ count }: { count: number }) {
  return (
    <ul className="space-y-2.5">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex gap-2">
          <Skeleton className="mt-0.5 size-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-1 h-3.5 w-full" />
            <Skeleton className={cn("mt-1 h-3.5", i % 2 ? "w-1/2" : "w-2/3")} />
          </div>
        </li>
      ))}
    </ul>
  );
}
