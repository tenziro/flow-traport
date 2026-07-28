import { cn } from "@/lib/utils";

/**
 * 스택 막대 한 줄. 건수 옆에 "전체 중 얼마"를 얹는다 — 관리자 화면에서 숫자 하나는
 * 비교 대상이 없으면 크고 작음이 읽히지 않는다.
 *
 * 서버 컴포넌트다. 차오르는 애니메이션은 CSS(`.bar-grow`)가 하고 순서만 `--i`로 준다.
 * 화면 리더에게는 막대가 아니라 수치를 읽어준다 — 막대는 눈으로만 쓰는 표현이다.
 *
 * ponytail: 차트 라이브러리를 넣지 않았다. 필요한 건 비율 하나뿐이고 `div` 폭으로 끝난다.
 * 축·툴팁·시계열이 필요해지면 그때 recharts를 붙이는 게 맞다.
 */
export function Meter({
  segments,
  /** 분모. 안 주면 세그먼트 합이 분모다(구성비). 주면 나머지는 트랙으로 남는다(점유율). */
  total,
  className,
}: {
  segments: readonly { value: number; label: string; className: string }[];
  total?: number;
  className?: string;
}) {
  const shown = segments.filter((s) => s.value > 0);
  if (shown.length === 0) return null;

  const sum = segments.reduce((acc, s) => acc + s.value, 0);
  const basis = Math.max(total ?? sum, 1);

  return (
    <div
      role="img"
      aria-label={shown.map((s) => `${s.label} ${s.value}`).join(", ")}
      className={cn("flex h-1 gap-px overflow-hidden rounded-full bg-secondary", className)}
    >
      {shown.map((s, i) => (
        <span
          key={s.label}
          className={cn("bar-grow h-full", s.className)}
          style={{ width: `${(s.value / basis) * 100}%`, "--i": i } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
