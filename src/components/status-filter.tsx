import { STATUS_TONE } from "@/components/status-pill";
import { cn } from "@/lib/utils";

/**
 * 상태 칩 세 조각. 칩을 그리는 곳은 `TaskTable` 하나지만, 색 언어는 `StatusPill`과
 * 공유해야 해서(`STATUS_TONE`) 겉모양·점·건수를 여기 모아 둔다.
 *
 * 한때 URL로 거르는 서버 칩(`StatusFilter`)과 클라이언트 칩(`ProjectTaskFilter`) 두 벌이
 * 있었다. 표가 스스로 거르게 되면서 둘 다 없앴다 — 951줄 화면을 서버로 다녀오면 실측 7초다.
 */

/** 칩 겉모양. `status`를 안 주면(= "전체" 칩) 켜졌을 때 회색 면이다. */
export function statusChipClass(active: boolean, status?: string) {
  const tone = status ? STATUS_TONE[status as keyof typeof STATUS_TONE] : undefined;

  return cn(
    "tabular inline-flex min-h-6 items-center gap-1.5 rounded-md px-2 text-xs transition-colors duration-300",
    active ? (tone?.chip ?? "bg-secondary text-foreground") : "text-muted-foreground hover:bg-muted",
  );
}

/**
 * 칩 안 상태 색 점. 모르는 상태면 `null`이다 — 추측해서 칠하지 않는다(`StatusPill`과 같다).
 * 점은 칩이 꺼져 있을 때도 남긴다 — 어느 칩이 어느 색인지가 눌러 보기 전에 보여야 한다.
 */
export function StatusDot({ status }: { status: string }) {
  const tone = STATUS_TONE[status as keyof typeof STATUS_TONE];
  return tone ? <span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} /> : null;
}


/**
 * 칩 차례 — 일이 흘러가는 순서다 (대기 → 진행 → 피드백 → 완료, 보류는 끝).
 *
 * 전에는 데이터에 나온 순서였다. flow 커스텀 상태라 응답에 정렬 기준이 없는데, 그러면
 * 프로젝트마다·화면마다 칩 자리가 달라져서 같은 `진행`을 매번 눈으로 찾아야 했다.
 *
 * `요청`은 `대기`와 같은 상태의 다른 이름이라 같은 자리다 (`STATUS_TONE`의 주석).
 */
const ORDER = ["대기", "요청", "진행", "피드백", "완료", "보류"];

/** 상태별 건수. 아는 상태를 `ORDER`대로 세우고, 모르는 커스텀 상태는 나온 순서대로 뒤에 붙인다. */
export function countStatuses(
  tasks: readonly { status: string }[],
): { status: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const task of tasks) tally.set(task.status, (tally.get(task.status) ?? 0) + 1);
  const rank = (status: string) => {
    const at = ORDER.indexOf(status);
    return at === -1 ? ORDER.length : at;
  };
  // `sort`는 안정 정렬이라 순위가 같은(= 모르는) 상태들끼리는 나온 순서가 유지된다.
  return [...tally]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => rank(a.status) - rank(b.status));
}
