"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import type { Division } from "@/lib/flow/queries";

/**
 * 부서 전환 — beUI Tabs(segment). 활성 칸이 layoutId 스프링으로 미끄러진다.
 *
 * `pill`이 아니라 `segment`다. 둘의 차이는 모서리뿐인데(알약 vs 8px 사각), 이 탭은 카드
 * 위에 놓이는 컨트롤이라 카드와 같은 모서리를 갖는 편이 한 덩어리로 읽힌다.
 *
 * 탭은 `<button>`이라 그 자체로는 URL이 생기지 않는다. 부서별 화면을 링크로
 * 공유할 수 있어야 하므로 `onValueChange`에서 `?dept=`를 직접 밀어 넣는다 —
 * 링크 칩이던 이전 구현의 공유 가능성을 그대로 지킨다.
 */
export function DeptTabs({
  base,
  divisions,
  current,
}: {
  base: string;
  divisions: Division[];
  current: string;
}) {
  const router = useRouter();

  return (
    <Tabs
      value={current}
      onValueChange={(dept) => router.push(`${base}?dept=${encodeURIComponent(dept)}`)}
      variant="segment"
      className="mb-6"
    >
      <TabsList aria-label="부서" className="flex-wrap bg-secondary">
        {divisions.map(({ divisionCode, divisionName }) => (
          <TabsTrigger key={divisionCode} value={divisionName} className="min-h-8">
            {divisionName}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
