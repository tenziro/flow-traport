import type { IconProps } from "@/components/icons";
import { NumberTicker } from "@/components/motion/number-ticker";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * 요약 한 칸의 색 한 벌. 톤 하나가 네 자리에 같이 깔린다 —
 * 숫자 글자(`text`), 아이콘 칩(`chip`), 카드 면과 테두리(`face`), 점유율 막대(`bar`).
 *
 * v1.7.0에 `face`를 더했다. 그전에는 색이 글자와 막대에만 있어서 요약 넉 장이 전부
 * 같은 흰 상자였고, 급한 숫자와 안 급한 숫자가 훑어서 안 갈렸다.
 *
 * `neutral`도 v4.12.1에 면을 받았다. 한때 비워 뒀다 — "면에 색이 있다 = 지금 볼 것"을
 * 지키려면 평상시 숫자는 흰 상자여야 한다고 봤다. 그런데 `neutral`이 실제로 놓이는 자리는
 * 오늘·팀 화면의 넷째 칸(방치된 업무) 둘뿐이라, 물든 셋 옆에 흰 상자 하나가 남아
 * **덜 그려진 칸**으로 읽혔다. 급하지 않다는 뜻은 면을 빼서가 아니라 무채색으로 낸다 —
 * 넷 중 가장 조용한 면이고, 훑을 때 눈이 마지막에 닿는다.
 *
 * 면은 배경색이 아니라 위→아래로 옅어지는 그러데이션이다. `bg-card`를 덮어쓰지 않아서
 * (background-image는 background-color 위에 얹힌다) 어둡게에서도 카드가 배경보다
 * 한 단 밝게 떠 있는 3단 구조가 그대로 산다.
 */
export const KPI_TONE = {
  danger: {
    text: "text-danger-foreground",
    chip: "bg-danger/12 text-danger",
    face: "from-danger/10 to-danger/0 ring-danger/25",
    bar: "bg-danger",
  },
  warning: {
    text: "text-warning-foreground",
    chip: "bg-warning/15 text-warning",
    face: "from-warning/12 to-warning/0 ring-warning/25",
    bar: "bg-warning",
  },
  primary: {
    text: "text-primary",
    chip: "bg-primary/12 text-primary",
    face: "from-primary/8 to-primary/0 ring-primary/20",
    bar: "bg-primary",
  },
  neutral: {
    text: "text-neutral-foreground",
    chip: "bg-muted text-muted-foreground",
    face: "from-neutral/10 to-neutral/0 ring-neutral/20",
    bar: "bg-neutral",
  },
  /** 완료. `StatusPill`의 `완료`와 `Meter`의 `bg-done` 조각과 같은 보라다. */
  done: {
    text: "text-done-foreground",
    chip: "bg-done/12 text-done",
    face: "from-done/10 to-done/0 ring-done/25",
    bar: "bg-done",
  },
} as const;

export type KpiTone = keyof typeof KPI_TONE;

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
  /** 라벨 앞 글리프. `tone` 색의 칩 위에 얹힌다. */
  Icon: React.ComponentType<IconProps>;
  tone?: KpiTone;
  /** 진입 애니메이션 순서. */
  i?: number;
}) {
  const t = KPI_TONE[tone];

  return (
    <Card
      size="sm"
      className={cn("rise gap-2 bg-linear-to-b", t.face)}
      style={{ "--i": i } as React.CSSProperties}
    >
      <CardContent className="space-y-1.5">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", t.chip)}>
            <Icon size={14} />
          </span>
          <span className="truncate">{label}</span>
        </p>
        <p className="flex items-baseline gap-1">
          <span className={cn("tabular text-[28px] leading-none font-semibold", t.text)}>
            <NumberTicker value={value} />
          </span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </p>
        {note && <p className="text-[11px] leading-snug text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}
