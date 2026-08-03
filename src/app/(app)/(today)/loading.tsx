import {
  HeadSkeleton,
  KpiRowSkeleton,
  PanelSkeleton,
  TaskRowsSkeleton,
} from "@/components/skeletons";

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
 * 오늘 화면의 2단을 그대로 비운다 — KPI 4칸 → 표 네 개를 한 단으로. 8:4 격자였던 때는
 * 골격도 8:4였는데, 업무가 표가 되면서 화면이 한 단으로 접혔다 (page.tsx).
 *
 * 줄 수는 실제 표의 기본 최대치가 아니라 **자주 나오는 건수**로 잡는다 — 표 높이가
 * `44 × (1 + 줄 수)`로 정해져 있어서 여기 숫자가 곧 카드 높이다.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <HeadSkeleton className="mb-8" />
      <KpiRowSkeleton count={4} meter />

      <div className="space-y-4">
        {/* 포커스 — 상위 5건, 상태 칩 있음 */}
        <PanelSkeleton>
          <TaskRowsSkeleton count={5} chips />
        </PanelSkeleton>
        {/* 밀리는 업무 — 제목 아래 지연 분포 막대가 있는 유일한 카드다 */}
        <PanelSkeleton meter>
          <TaskRowsSkeleton count={4} chips />
        </PanelSkeleton>
        {/* 나를 부른 사람들 — 이 표만 칸이 다섯이고 상태 칩이 없다 */}
        <PanelSkeleton>
          <TaskRowsSkeleton count={3} cols={5} />
        </PanelSkeleton>
        {/* 방치된 업무 */}
        <PanelSkeleton>
          <TaskRowsSkeleton count={3} chips />
        </PanelSkeleton>
      </div>
    </div>
  );
}
