import {
  HeadSkeleton,
  KpiRowSkeleton,
  PanelSkeleton,
  TabBarSkeleton,
  TaskRowsSkeleton,
} from "@/components/skeletons";

/**
 * 팀 화면 골격 (PRD §7.4).
 *
 * 멤버 카드는 리스크의 프로젝트 카드와 달리 처음부터 펼쳐져 있다 — 누가 무엇에 막혀 있는지가
 * 이 화면의 본문이라 접어 두지 않는다. 그래서 카드마다 업무 두 줄까지 비운다.
 *
 * 격자는 실제와 같은 1단(아주 넓은 화면만 2단)이다 — 업무 줄이 표가 되면서 3단을 접었다
 * (page.tsx). 네 장을 세우면 2단 화면에서 두 줄이 채워진다.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <HeadSkeleton />
      <TabBarSkeleton className="max-w-lg" />
      <KpiRowSkeleton count={4} />
      <div className="grid grid-cols-1 items-start gap-4 2xl:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <PanelSkeleton key={i}>
            <TaskRowsSkeleton count={2} />
          </PanelSkeleton>
        ))}
      </div>
    </div>
  );
}
