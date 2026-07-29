'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * 지표 한 칸에 기준을 달아 준다 — 팀 멤버 카드와 리스크 프로젝트 줄의 `아이콘 + N건`.
 *
 * 아이콘 세 개가 무엇을 세는지는 화면 맨 위 요약 카드에만 적혀 있어서, 목록을
 * 스크롤해 내려오면 단서가 사라진다.
 *
 * `asChild`라 넘긴 자식이 그대로 트리거다 — 감싸는 요소가 하나도 안 늘어서 호출부의
 * flex 배치가 그대로 유지된다. 자식을 `<button>`으로 바꾸지 않는 이유는 탭 순서다.
 * 멤버 카드가 열 장이면 탭 정지점이 서른 개 늘어나는데, 낭독은 이미 자식 안의
 * `sr-only`가 맡고 있다. 그래서 이건 마우스 전용 힌트다.
 *
 * `TooltipProvider`를 안에 둔다 — 호출부가 셸을 손댈 일이 없다. 칸 사이를 옮길 때
 * 지연이 매번 다시 붙지만, 카드 머리의 세 칸에서는 눈에 띄지 않는다.
 */
export function StatHint({
  hint,
  children,
}: {
  /** `밀리는 업무 — 마감이 지났어요` 처럼 `이름 — 기준` 한 줄. */
  hint: string;
  /** 트리거가 될 단일 요소. */
  children: React.ReactElement;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
