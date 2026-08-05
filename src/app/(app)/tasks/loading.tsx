import {
  HeadSkeleton,
  KpiRowSkeleton,
  ProjectCardsSkeleton,
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
 *
 * 카드는 접힌 프로젝트 요약이다 — 이름 한 줄과 참여자·공개 여부·개설 정보 한 줄이고,
 * 건수와 진행 막대는 펼친 뒤 표 위에 있다 (`ProjectCardsSkeleton`).
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <HeadSkeleton className="mb-8" />
      <KpiRowSkeleton count={3} />
      <TabBarSkeleton className="mb-4 max-w-md" />
      <ProjectCardsSkeleton count={5} />
    </div>
  );
}
