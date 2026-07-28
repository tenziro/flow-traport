import { Skeleton } from "@/components/ui/skeleton";

/**
 * 로딩 스켈레톤 (PRD §7.4 — 300ms 넘으면 스피너가 아니라 스켈레톤).
 *
 * 세 화면(오늘·리스크·팀)이 공유한다. MCP 왕복이 느려서 이게 없으면 탭을 눌러도
 * 이전 화면이 그대로 남아 있었다 — 눌렸는지조차 안 보였다. 셸(상단 바)은 즉시
 * 서고 본문만 이 골격으로 채운다.
 *
 * ponytail: 화면별로 모양을 맞추지 않는다. 제목 + 설명 + 카드 3장은 세 화면에
 * 다 맞고 어디서도 틀리지 않는다. 전환 시 레이아웃 점프가 신경 쓰이면 그때
 * 화면별 loading.tsx로 쪼갠다.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
