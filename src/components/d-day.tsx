import { cn } from "@/lib/utils";

/**
 * 마감까지 남은 일수. 색만으로 의미를 전달하지 않으려고 D+/D- 부호를 항상 붙인다.
 *
 * 업무 표와 상세 모달이 같이 쓴다 — 같은 업무의 급함이 두 자리에서 다른 모양이면
 * 같은 것인지 알아보는 데 시간이 든다.
 */
export function DDay({ days }: { days: number }) {
  const label = days < 0 ? `D+${-days}` : days === 0 ? "D-DAY" : `D-${days}`;
  return (
    <span
      className={cn(
        "tabular shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold",
        days < 0
          ? "bg-danger-bg text-danger-foreground"
          : days <= 2
            ? "bg-warning-bg text-warning-foreground"
            : "bg-neutral-bg text-neutral-foreground",
      )}
    >
      {label}
    </span>
  );
}
