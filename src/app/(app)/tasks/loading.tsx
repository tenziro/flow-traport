import {
  HeadSkeleton,
  KpiRowSkeleton,
  SummaryCardsSkeleton,
  TabBarSkeleton,
} from "@/components/skeletons";

/**
 * 내 업무 화면 골격 (PRD §7.4, §6.5).
 *
 * 이 화면이 가장 오래 기다린다 — 프로젝트 59개를 훑어 담당 업무를 모은다 (my-tasks.ts).
 * 그래서 골격이 제일 필요한 자리다.
 *
 * 탭 줄은 KPI **아래**다 (실제 화면과 같은 순서). 여백도 실제와 같은 `mb-4` — 탭 칸과
 * 첫 카드 사이가 `TabsContent`의 `mt-4`다.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <HeadSkeleton />
      <KpiRowSkeleton count={3} />
      <TabBarSkeleton className="mb-4 max-w-md" />
      <SummaryCardsSkeleton count={5} />
    </div>
  );
}
