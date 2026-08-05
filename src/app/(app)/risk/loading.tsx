import {
  HeadSkeleton,
  KpiRowSkeleton,
  RollupCardsSkeleton,
  TabBarSkeleton,
} from "@/components/skeletons";

/**
 * 리스크 화면 골격 (PRD §7.4).
 *
 * 부서 탭을 누를 때마다 이 골격이 선다 — 부서 하나가 프로젝트 수십 개를 물고 있어서
 * 왕복이 길고, 그동안 이전 부서의 카드가 남아 있으면 바뀐 줄 모른다.
 *
 * 프로젝트 카드는 기본이 접힌 상태다. 접힌 한 장이 내는 건 등급 · 이름 · 통계 한 줄,
 * 점수 막대, 담당자 한 줄 — 세 줄이고 골격도 그 셋만 비운다 (`RollupCardsSkeleton`).
 * 카드 앞의 등급 분포 줄도 같은 부품이 그린다: 실제 화면에서 둘은 같이 서고 같이 사라진다.
 *
 * 잠잠한 프로젝트를 여는 줄은 안 그린다 — 잠잠한 게 하나도 없으면 그 줄이 아예 없다.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <HeadSkeleton />
      <TabBarSkeleton className="max-w-lg" />
      <KpiRowSkeleton count={4} />
      <RollupCardsSkeleton count={4} />
    </div>
  );
}
