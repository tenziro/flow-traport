import {
  HeadSkeleton,
  KpiRowSkeleton,
  SummaryCardsSkeleton,
  TabBarSkeleton,
} from "@/components/skeletons";

/**
 * 리스크 화면 골격 (PRD §7.4).
 *
 * 부서 탭을 누를 때마다 이 골격이 선다 — 부서 하나가 프로젝트 수십 개를 물고 있어서
 * 왕복이 길고, 그동안 이전 부서의 카드가 남아 있으면 바뀐 줄 모른다.
 *
 * 프로젝트 카드는 기본이 접힌 상태다. 그래서 카드 한 장은 순위 · 이름 · 건수 · 진행 막대
 * 한 줄이고 골격도 그 한 줄만 비운다.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <HeadSkeleton />
      <TabBarSkeleton className="max-w-lg" />
      <KpiRowSkeleton count={4} />
      <SummaryCardsSkeleton count={4} rank />
    </div>
  );
}
