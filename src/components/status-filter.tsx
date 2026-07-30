import Link from "next/link";
import { STATUS_TONE } from "@/components/status-pill";
import { cn } from "@/lib/utils";

/**
 * 카드 안 목록을 상태로 거른다. 카드마다 쿼리 키가 달라서 서로 간섭하지 않는다
 * (`/?focus=진행&overdue=요청`). URL에 남으니 걸러 둔 화면을 그대로 공유할 수 있고,
 * 뒤로 가기로 필터가 풀린다.
 *
 * 서버 컴포넌트다. `<Link>` 하나로 되는 일에 클라이언트 상태를 만들지 않는다.
 */
export function StatusFilter({
  base,
  param,
  params,
  counts,
  anchor,
}: {
  base: string;
  /** 이 카드가 쓰는 쿼리 키. */
  param: string;
  /** 지금 URL의 쿼리 전부. 다른 카드 필터를 지우지 않으려면 통째로 받아야 한다. */
  params: Record<string, string | undefined>;
  counts: readonly { status: string; count: number }[];
  /** 필터를 누르면 돌아올 카드. 없으면 목록이 화면 밖에 있는데 맨 위로 튄다. */
  anchor: string;
}) {
  // 상태가 한 종류뿐이면 거를 게 없다. 칩 두 개를 놓아 봐야 누를 이유가 없다.
  if (counts.length < 2) return null;

  const current = params[param];
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  const href = (status?: string) => {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) q.set(key, value);
    if (status) q.set(param, status);
    else q.delete(param);
    const query = q.toString();
    return `${base}${query ? `?${query}` : ""}#${anchor}`;
  };

  return (
    <div role="group" aria-label="상태로 거르기" className="flex flex-wrap items-center gap-1">
      <Chip href={href()} active={!current}>
        전체 {total}
      </Chip>
      {counts.map(({ status, count }) => (
        <Chip key={status} href={href(status)} active={current === status} status={status}>
          {status} {count}
        </Chip>
      ))}
    </div>
  );
}

/**
 * 칩 겉모양. 링크 칩(이 파일)과 버튼 칩(`project-task-filter.tsx`)이 같은 모양을 쓴다 —
 * 클래스를 두 벌 두면 한쪽만 고쳐져서 화면마다 다른 칩이 된다.
 *
 * `status`를 안 주면(= "전체" 칩) 켜졌을 때 회색 면이다.
 */
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

function Chip({
  href,
  active,
  status,
  children,
}: {
  href: string;
  active: boolean;
  /** 주면 상태 색 점이 붙는다. "전체" 칩에는 없다. */
  status?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={statusChipClass(active, status)}
    >
      {status && <StatusDot status={status} />}
      {children}
    </Link>
  );
}

/** 상태별 건수. 데이터에 나온 순서를 지킨다 — flow 커스텀 상태라 정렬 기준이 따로 없다. */
export function countStatuses(
  tasks: readonly { status: string }[],
): { status: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const task of tasks) tally.set(task.status, (tally.get(task.status) ?? 0) + 1);
  return [...tally].map(([status, count]) => ({ status, count }));
}
