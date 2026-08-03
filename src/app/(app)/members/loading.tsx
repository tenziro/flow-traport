import { HeadSkeleton, MemberCardsSkeleton, TabBarSkeleton } from "@/components/skeletons";

/**
 * 구성원 화면 골격 (PRD §7.4, §6.6).
 *
 * 호출이 하나뿐이라 이 화면은 금방 선다. 그래도 골격을 두는 이유는 **높이**다 — 명단이
 * 도착하면서 화면이 위로 뛰면 그 사이에 눌린 곳이 엉뚱한 자리가 된다.
 *
 * 부서 무리는 하나만 그린다. 부서가 몇 개인지는 서버가 답을 줘야 알고, 모르는 수를 지어
 * 그리면 실제 카드가 도착할 때 칸이 늘거나 줄어든다 (`TabBarSkeleton`과 같은 이유).
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <HeadSkeleton />
      <TabBarSkeleton className="mb-8 max-w-md" />
      <MemberCardsSkeleton count={6} />
    </div>
  );
}
