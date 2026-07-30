"use client";

import { useState } from "react";
import { countStatuses, statusChipClass, StatusDot } from "@/components/status-filter";

/** 업무 한 줄. `row`는 서버에서 이미 그려진 `TaskItem`이다. */
export interface FilterableTask {
  /** `taskSrno`. */
  key: number;
  status: string;
  row: React.ReactNode;
}

/**
 * 프로젝트 카드 안 목록을 상태로 거른다 (PRD §6.5).
 *
 * **오늘 화면의 `StatusFilter`와 달리 URL을 쓰지 않는다.** 그쪽은 목록이 16줄이라 서버가
 * 다시 그려도 싸다. 이 화면은 951줄에 카드가 38장이라 칩 한 번이 프로젝트 59회 훑기(60초
 * 캐시가 식었으면 7초)와 3MB 재전송이 된다. 카드마다 쿼리 키가 붙어 URL이 38칸이 되는 것도
 * 덤이다. 대신 걸러 둔 화면은 공유되지 않고 뒤로 가기로 풀리지도 않는다 — 그 값으로 산다.
 *
 * 업무 줄을 여기서 만들지 않고 `row`로 받는 이유: `TaskItem`은 서버 컴포넌트다. 서버에서
 * 그려 넘기면 쓰기 액션이 그대로 따라온다.
 */
export function ProjectTaskFilter({ items }: { items: FilterableTask[] }) {
  const [picked, setPicked] = useState<string | null>(null);

  const counts = countStatuses(items);
  // 없는 상태가 골라져 있으면(= 방금 상태를 바꿨다) 거르지 않는다. 빈 목록보다 낫다.
  const shown = counts.some((c) => c.status === picked)
    ? items.filter((item) => item.status === picked)
    : items;

  return (
    <div className="mt-3 border-t border-border pt-3">
      {/* 상태가 한 종류뿐이면 거를 게 없다 (`StatusFilter`와 같은 규칙) */}
      {counts.length > 1 && (
        <div role="group" aria-label="상태로 거르기" className="mb-3 flex flex-wrap gap-1">
          <button
            type="button"
            aria-pressed={picked === null}
            onClick={() => setPicked(null)}
            className={statusChipClass(picked === null)}
          >
            전체 {items.length}
          </button>
          {counts.map(({ status, count }) => (
            <button
              key={status}
              type="button"
              aria-pressed={picked === status}
              // 같은 칩을 다시 누르면 풀린다 — "전체"까지 손이 가지 않아도 된다
              onClick={() => setPicked((prev) => (prev === status ? null : status))}
              className={statusChipClass(picked === status, status)}
            >
              <StatusDot status={status} />
              {status} {count}
            </button>
          ))}
        </div>
      )}

      {/* 줄 사이는 여백이 아니라 선으로 끊는다 — 한 프로젝트에 24줄까지 붙는데 여백만으로는
          제목·상태·마감일·댓글이 여러 줄인 업무가 어디서 끝나는지 안 보였다. 오늘·팀 화면의
          목록과 같은 방법이다 (`border-b border-border/60 last:border-0`). `TaskItem`이
          자기 `py-2`를 가지고 있어서 여백은 거의 없앤다 — 안 그러면 선이 줄과 떨어져 뜬다 */}
      <ul className="space-y-0.5">
        {shown.map((item) => (
          <li key={item.key} className="border-b border-border/60 last:border-0">
            {item.row}
          </li>
        ))}
      </ul>
    </div>
  );
}
