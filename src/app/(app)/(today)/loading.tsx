import {
  HeadSkeleton,
  KpiRowSkeleton,
  PanelSkeleton,
  TaskRowsSkeleton,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * 오늘 화면 골격 (PRD §7.4 — 300ms 넘으면 스피너가 아니라 골격).
 *
 * MCP 왕복이 느려서 이게 없으면 메뉴를 눌러도 이전 화면이 그대로 남아 있었다 — 눌렸는지조차
 * 안 보였다. 셸(상단 바·왼쪽 레일)은 즉시 서고 본문만 이 골격으로 채운다.
 *
 * 이 파일은 오늘 화면 것이다. 예전에는 네 화면이 제목 + 카드 3장짜리 한 골격을 같이 썼는데,
 * 화면마다 단 수와 칸 폭이 달라서 실제 화면이 도착할 때마다 배치가 한 번 튀었다. 지금은
 * 화면마다 자기 골격을 갖는다 (`risk/`, `team/`, `tasks/loading.tsx`).
 *
 * 오늘 화면이 `(today)` 무리 안에 있는 이유가 이 파일이다. `(app)/loading.tsx`에 두면 그
 * 골격이 자식 경로(리스크·팀·내 업무)의 **부모** 경계가 되어, 그 화면들을 열 때 오늘 화면
 * 골격이 먼저 한 번 깜빡이고 나서 자기 골격으로 바뀌었다 — 실측으로 `/risk` 응답 안에
 * 골격 두 벌이 같이 들어 있었다. 무리를 하나 두면 넷이 같은 깊이의 형제가 되어 각자
 * 자기 것만 그린다. 무리 이름은 URL에 안 나온다 — 주소는 그대로 `/`다.
 *
 * 오늘 화면의 4단을 그대로 비운다 — KPI 4칸 → 포커스·방치 8:4 → 밀림·멘션 8:4 → 오늘 일정 8칸.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <HeadSkeleton className="mb-6" />
      <KpiRowSkeleton count={4} meter />

      {/* 실제 화면과 같은 12칸 격자에 8:4다. 폭이 다르면 카드 경계가 옮겨 앉는다 */}
      <div className="mb-6 grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <PanelSkeleton chips className="xl:col-span-8">
          <TaskRowsSkeleton count={5} />
        </PanelSkeleton>
        <PanelSkeleton className="xl:col-span-4">
          <TaskRowsSkeleton count={3} />
        </PanelSkeleton>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <PanelSkeleton chips className="xl:col-span-8">
          <TaskRowsSkeleton count={4} />
        </PanelSkeleton>
        <PanelSkeleton className="xl:col-span-4">
          <TaskRowsSkeleton count={3} />
        </PanelSkeleton>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <PanelSkeleton className="xl:col-span-8">
          {/* 일정 줄은 시각이 폭 고정으로 앞에 선다 (76px) */}
          <ul className="space-y-2">
            {[0, 1].map((i) => (
              <li key={i} className="flex items-start gap-2">
                <Skeleton className="h-3.5 w-[76px] shrink-0" />
                <Skeleton className="h-3.5 w-1/3" />
              </li>
            ))}
          </ul>
        </PanelSkeleton>
      </div>
    </div>
  );
}
