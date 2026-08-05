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

/**
 * 화면 제목 + 설명 한 줄. 아래 여백은 화면마다 달라서 밖에서 준다.
 *
 * `action`은 제목 오른쪽에 서는 한 조각이다 — 오늘은 `챙길 일 N건` 한 줄, 팀은
 * `마크다운으로 복사` 단추다. 좁은 화면에서 이 조각이 아래로 접히면서 머리 높이가 한 단
 * 늘어나기 때문에 안 그리면 명단이 도착할 때 그만큼 화면이 내려앉는다.
 */
export function HeadSkeleton({
  className,
  action,
}: {
  className?: string;
  action?: "count" | "button";
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-full max-w-md" />
      </div>
      {action === "count" && <Skeleton className="h-4 w-20 shrink-0" />}
      {action === "button" && <Skeleton className="h-8 w-36 shrink-0 rounded-md" />}
    </div>
  );
}

/**
 * 요약 KPI 줄. 실제 `Kpi`와 같은 격자·카드다.
 *
 * `share`는 오늘 화면 전용이다 — 그쪽 칸(`Stat`)만 세 가지를 더 갖는다: 라벨 오른쪽 끝의
 * 점유율 %, 숫자 옆의 `/ 전체`, 그 밑의 점유율 막대. 리스크·팀·내 업무의 `Kpi`에는 셋 다 없다.
 */
export function KpiRowSkeleton({
  count,
  share = false,
}: {
  count: 3 | 4;
  share?: boolean;
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
            {/* 실제와 같은 아이콘 칩 + 라벨이다 (`Kpi`, 오늘 화면 `Stat`) */}
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 shrink-0 rounded-md" />
              <Skeleton className="h-3.5 w-20" />
              {share && <Skeleton className="ml-auto h-3 w-7 shrink-0" />}
            </div>
            {/* 숫자는 28px 한 줄. 오늘 화면은 그 옆에 `/ 전체`가 붙는다 */}
            <div className="flex h-7 items-center gap-1">
              <Skeleton className="h-7 w-14" />
              {share && <Skeleton className="h-3 w-10" />}
            </div>
            {share && <Skeleton className="h-1 w-full rounded-full" />}
            <Skeleton className="h-2.5 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * 탭 한 줄 자리 (부서 전환 · 프로젝트 보기 · 부서 보기).
 *
 * 칸을 하나씩 그리지 않고 줄 하나로 비운다 — 칸 수는 서버가 답을 줘야 안다(부서 수, 비어
 * 있지 않은 무리 수). 모르는 수를 지어 그리면 실제 탭이 도착할 때 칸이 늘거나 줄어든다.
 *
 * 높이는 어느 쪽이든 36px이다 — `sm` 위는 칩 줄(`p-0.5` + 칸 `min-h-8`), 아래는 고르개
 * (`py-2` + 14px 한 줄)다 (`TabsSelect`). 모서리도 둘 다 8px다. 다만 폭은 다르다: 칩 줄은
 * 내용만큼이고 고르개는 한 줄을 다 쓴다 — 그래서 폰에서는 밖에서 준 `max-w-*`를 푼다.
 */
export function TabBarSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton className={cn("mb-6 h-9 w-full rounded-lg max-sm:max-w-none", className)} />
  );
}

/**
 * 카드 한 장. 제목 줄은 실제와 같은 세 자리다 — 아이콘, 이름, 오른쪽 건수.
 *
 * `icon`은 제목 앞 아이콘 칩이다. 오늘 화면 카드는 갖고(`TitleMark`) 팀 화면 멤버 카드는
 * 사람 이름으로 시작해서 안 갖는다.
 *
 * `meter`는 제목 아래 분포 막대다 — 오늘 화면은 밀리는 업무 카드만, 팀 화면은 모든 멤버
 * 카드가 갖는다(부하 막대).
 */
export function PanelSkeleton({
  children,
  className,
  icon = true,
  meter = false,
}: {
  children: React.ReactNode;
  className?: string;
  icon?: boolean;
  meter?: boolean;
}) {
  return (
    <Card className={className}>
      <CardHeader className="gap-2">
        {/* 줄 높이를 박는다 — 칩이 있으면 칩(28px)이, 없으면 제목 글자(16px × 1.375)가
            줄 높이를 정하는데 회색 막대는 둘 다보다 낮다 */}
        <div className={cn("flex items-center gap-2", icon ? "h-7" : "h-5.5")}>
          {icon && <Skeleton className="size-7 shrink-0 rounded-md" />}
          <Skeleton className="h-4 w-28" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        {meter && <Skeleton className="h-1 w-full rounded-full" />}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * 업무 표 (`TaskTable`·`MentionTable`). 머리 줄 하나 + 줄 `count`개고, 줄 높이 44px와
 * 테두리까지 실제와 같다 — 표는 높이가 `44 × (1 + 줄 수)`로 딱 정해져 있어서 골격이 그
 * 계산을 그대로 따라가면 내용이 도착할 때 한 픽셀도 안 튄다.
 *
 * 줄마다 폭을 번갈아 주지 않는다. 표는 칸 폭이 고정 비율이라 폭이 흔들리면 표로 안 읽힌다 —
 * 업무 목록이 줄이었을 때(`TaskItem`)와 반대다.
 *
 * `chips`는 표 위 상태 칩 줄이다. 상태가 두 종류 이상인 표에만 나오고(오늘 화면의 포커스·
 * 밀리는·방치된 업무), 카드 머리가 아니라 표와 같은 칸에 든다.
 */
export function TaskRowsSkeleton({
  count,
  cols = 4,
  chips = false,
}: {
  count: number;
  /**
   * 칸 수. 넷이 기본이다 — 업무명·프로젝트·진행상태·마감일 (오늘의 포커스·밀리는 업무,
   * 팀 화면). 멘션 표도 넷이다(업무명·프로젝트·부른 사람·시각). 다섯은 칸을 하나 더 켠
   * 표들이다: 방치된 업무는 `마지막 수정`, 내 업무는 `등록자`와 `등록일`을 켜고
   * 프로젝트 칸을 꺼서 역시 다섯이다 (`TaskTable`).
   */
  cols?: 4 | 5;
  chips?: boolean;
}) {
  return (
    <div className="space-y-2">
      {chips && (
        <div className="flex flex-wrap items-center gap-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-md" />
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-border">
        {/* 머리 줄. 실제와 같이 면색 없이 아래 테두리 하나다 */}
        <Cells cols={cols} className="border-border" barClassName="h-3" />
        {Array.from({ length: count }, (_, i) => (
          <Cells key={i} cols={cols} className="border-border/60" barClassName="h-3.5" />
        ))}
      </div>
    </div>
  );
}

/** 표 한 줄. 첫 칸(업무명)이 남는 폭을 다 먹는 것까지 실제와 같다 (`titleWidth`). */
function Cells({
  cols,
  className,
  barClassName,
}: {
  cols: number;
  className: string;
  barClassName: string;
}) {
  return (
    <div className={cn("flex h-11 items-center gap-4 border-b px-4", className)}>
      {Array.from({ length: cols }, (_, i) => (
        <Skeleton key={i} className={cn(barClassName, i === 0 ? "flex-[3]" : "flex-1")} />
      ))}
    </div>
  );
}

/**
 * 리스크 화면의 접힌 프로젝트 카드들 (`RollupCard`) — 앞에 등급 분포 한 줄이 붙는다.
 *
 * 둘을 한 부품으로 묶은 건 실제 화면에서 둘이 같이 서고 같이 사라지기 때문이다 (page.tsx —
 * 둘 다 `rollups.length > 0`일 때만 있다). 카드 사이 간격도 그 줄까지 포함한 `space-y-4`다.
 *
 * 카드 한 장은 세 줄이다: 등급 점·이름·오른쪽 통계 한 줄, 점수 막대, 담당자 한 줄. 한때
 * 카드 왼쪽에 순위 숫자가 있었지만 v4.7.0에 뺐다 — 위에서 아래로 세운 순서가 곧 순위다.
 */
export function RollupCardsSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {/* 등급 분포 줄. 카드와 같은 면이지만 카드가 아니다 — 막대 하나에 이름표 셋이다 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-card px-4 py-2.5 ring-1 ring-foreground/10">
        <Skeleton className="h-1.5 min-w-40 flex-1 basis-full rounded-full sm:basis-auto" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-3 w-14" />
        ))}
      </div>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {/* 세 자리가 실제와 같이 접힌다 — 폰에서는 프로젝트명이 한 줄을 통째로 써서
                  (`basis-full`) 등급·이름·통계가 세 줄로 선다. 줄 높이를 자리마다 박는 건
                  이름만 16px 글자고 나머지 둘은 12px라서다 */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex h-4 shrink-0 items-center">
                  <Skeleton className="h-3 w-12" />
                </div>
                <div className="flex h-6 basis-full items-center sm:basis-auto">
                  <Skeleton className={cn("h-4 w-full", i % 2 ? "sm:w-40" : "sm:w-56")} />
                </div>
                <div className="flex h-4 shrink-0 items-center sm:ml-auto">
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <Skeleton className="mt-1.5 h-1 w-full rounded-full" />
              <div className="mt-1 flex h-4 items-center">
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="mt-0.5 size-4 shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * 내 업무 화면의 접힌 프로젝트 카드들 (`ProjectCard`).
 *
 * 접힌 카드가 내는 건 업무 건수가 아니라 **프로젝트가 어떤 판인지**다 (v4.4.0) — 아이콘과
 * 이름 한 줄, 그 밑에 참여자 수·공개 여부·개설 정보를 가운뎃점으로 이은 한 줄이다. 건수와
 * 진행 막대는 펼친 뒤 표 위로 내려갔다.
 *
 * 설명 줄은 안 그린다 — 실측 59개 중 7개만 채워져 있어서 없는 카드가 훨씬 흔하다.
 */
export function ProjectCardsSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex h-6 items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded-sm" />
                <Skeleton className={cn("h-4", i % 2 ? "w-40" : "w-56")} />
              </div>
              {/* 위 `mt-1`(요약 덩어리) + `mt-2`(잇는 줄) = 12px다 */}
              <div className="mt-3 flex h-4 items-center">
                <Skeleton className="h-3 w-52" />
              </div>
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
 * 댓글 줄들 (`CommentRows`의 한 줄). 아이콘 + 이름·시각 줄 + 본문 두 줄이다.
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
