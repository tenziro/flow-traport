import { cn } from '@/lib/utils';

/**
 * 업무 상태 배지. 색은 flow 화면이 쓰는 것을 그대로 따른다 — Cockpit에서 다른 색을 쓰면
 * 같은 상태를 두 번 배워야 한다.
 *
 * flow는 프로젝트마다 상태 라벨을 바꿀 수 있어서(커스텀 상태) 응답이 문자열로 온다.
 * 아는 라벨이면 색을 입히고 모르면 회색이다 — 추측해서 칠하지 않는다.
 *
 * 색만으로 의미를 전달하지 않는다 (WCAG 1.4.1). 라벨 글자가 항상 같이 나가고,
 * 점은 그 위에 얹는 표시일 뿐이다.
 */
export const STATUS_TONE = {
  요청: {
    chip: 'bg-info-bg text-info-foreground',
    dot: 'bg-info',
    text: 'text-info-foreground',
  },
  /**
   * `요청`과 같은 상태(`STTS` 코드 0)를 flow가 부르는 다른 이름이다 — 시스템 기록은 `요청`,
   * MCP 워크리스트는 `대기`다 (api-spec §6.1). 화면은 `대기`를 쓰는데 이 표에 키가 없어서
   * 그 배지만 회색이었다 (BUG-028의 "남은 것"). 색은 `요청`과 같아야 한다.
   */
  대기: {
    chip: 'bg-info-bg text-info-foreground',
    dot: 'bg-info',
    text: 'text-info-foreground',
  },
  진행: {
    chip: 'bg-success-bg text-success-foreground',
    dot: 'bg-success',
    text: 'text-success-foreground',
  },
  피드백: {
    chip: 'bg-danger-bg text-danger-foreground',
    dot: 'bg-danger',
    text: 'text-danger-foreground',
  },
  완료: {
    chip: 'bg-done-bg text-done-foreground',
    dot: 'bg-done',
    text: 'text-done-foreground',
  },
  보류: {
    chip: 'bg-neutral-bg text-neutral-foreground',
    dot: 'bg-neutral',
    text: 'text-neutral-foreground',
  },
} as const;

const UNKNOWN = {
  chip: 'bg-secondary text-muted-foreground',
  dot: 'bg-neutral',
};

export function StatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = STATUS_TONE[status as keyof typeof STATUS_TONE] ?? UNKNOWN;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs',
        tone.chip,
        className,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', tone.dot)} />
      {status}
    </span>
  );
}
