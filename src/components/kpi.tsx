import type { IconProps } from "@/components/icons";
import { NumberTicker } from "@/components/motion/number-ticker";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONE = {
  danger: "text-danger-foreground",
  warning: "text-warning-foreground",
  primary: "text-primary",
  neutral: "text-neutral-foreground",
} as const;

/**
 * 화면 맨 위 요약 한 칸. `/risk`와 `/team`이 같은 모양을 쓴다.
 *
 * `/`(오늘)의 KPI는 여기 쓰지 않는다 — 그쪽은 전체 대비 점유율 막대가 붙어서 구성이
 * 다르다. 억지로 한 컴포넌트로 합치면 안 쓰는 prop이 절반이 된다.
 */
export function Kpi({
  label,
  value,
  unit,
  note,
  Icon,
  tone = "neutral",
  i = 0,
}: {
  label: string;
  value: number;
  /** `일`, `명` 같은 단위. 없으면 건수다. */
  unit?: string;
  note?: string;
  /** 라벨 앞 글리프. `tone` 색을 따라간다. */
  Icon: React.ComponentType<IconProps>;
  tone?: keyof typeof TONE;
  /** 진입 애니메이션 순서. */
  i?: number;
}) {
  return (
    <Card size="sm" className="rise gap-1.5" style={{ "--i": i } as React.CSSProperties}>
      <CardContent className="space-y-1">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon size={13} className={TONE[tone]} />
          <span className="truncate">{label}</span>
        </p>
        <p className="flex items-baseline gap-1">
          <span className={cn("tabular text-[28px] leading-none font-semibold", TONE[tone])}>
            <NumberTicker value={value} />
          </span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </p>
        {note && <p className="text-[11px] leading-snug text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}
