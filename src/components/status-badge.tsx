import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";
import { IconImminent, IconNormal, IconRisk, IconStale } from "@/components/icons";
import type { TaskCategory } from "@/lib/aggregate";

/**
 * 업무 상태 배지 — beUI `animated-badge` 기반.
 *
 * 색만으로 의미를 전달하지 않는다. 아이콘과 텍스트 라벨이 항상 함께 나간다 (WCAG 1.4.1).
 * 기본 아이콘 대신 업무 의미에 맞는 Reicon 아이콘을 주입한다 (밀림=경고삼각, 방치=달).
 */
const STATUS: Record<
  TaskCategory,
  { label: string; status: AnimatedBadgeStatus; Icon: typeof IconRisk }
> = {
  imminent: { label: "임박", status: "warning", Icon: IconImminent },
  overdueActive: { label: "밀림", status: "danger", Icon: IconRisk },
  overdueStale: { label: "방치", status: "neutral", Icon: IconStale },
  normal: { label: "정상", status: "success", Icon: IconNormal },
};

export function StatusBadge({
  category,
  size = "sm",
  className,
}: {
  category: TaskCategory;
  size?: "sm" | "md";
  className?: string;
}) {
  const { label, status, Icon } = STATUS[category];
  return (
    <AnimatedBadge
      status={status}
      size={size}
      icon={<Icon size={size === "sm" ? 12 : 14} />}
      className={className}
    >
      {label}
    </AnimatedBadge>
  );
}
