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
 *
 * 카드 머리에 아이콘 칩이 없다 — 오늘 화면 카드와 달리 여기는 사람 이름으로 시작한다.
 * 대신 부하 막대는 모든 카드가 갖는다. 카드 안쪽 간격도 실제와 같은 `gap-2`다.
 *
 * 오늘 일정 띠는 안 그린다 — 일정이 있는 사람 카드에만 서고 높이도 건수를 따라간다
 * (오늘 화면 골격이 같은 띠를 안 그리는 것과 같은 이유다).
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      {/* 머리 오른쪽 끝에 `마크다운으로 복사` 단추가 있다 */}
      <HeadSkeleton action="button" />
      <TabBarSkeleton className="max-w-lg" />
      <KpiRowSkeleton count={4} />
      <div className="grid grid-cols-1 items-start gap-4 2xl:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <PanelSkeleton key={i} className="gap-2" icon={false} meter>
            <TaskRowsSkeleton count={2} />
          </PanelSkeleton>
        ))}
      </div>
    </div>
  );
}
