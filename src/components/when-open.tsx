"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 조상 `<details>`가 **열릴 때까지 안쪽을 안 그린다** (BUG-045).
 *
 * `<details>`는 닫혀 있어도 안쪽이 마운트된다 — 브라우저는 그리지 않지만 React는 다 만든다.
 * 내 업무 화면은 카드가 40장이고 카드마다 업무 표가 하나씩이라, 전부 접힌 첫 화면에서도
 * 표 60개와 DOM 12,000줄이 생겼다. 그 12,000줄을 만드는 동안 메인 스레드가 잠기고
 * (실측 4배 감속에서 737ms, 한 덩이 최장 377ms) 힙이 120MB까지 오른다. 사무용 노트북이면
 * 그 몇 배라 화면이 멈춘 것처럼 보인다.
 *
 * 한 번 열리면 계속 남는다. 다시 접었다 펴는 건 자주 하는 일이라 그때마다 표를 새로 만들면
 * 스크롤 위치도 정렬도 날아간다 — 비싼 건 **첫 화면에 40장을 한꺼번에 만드는 것**이지
 * 한 장을 들고 있는 게 아니다.
 *
 * ponytail: 참여자 칸(`project-panel.tsx`)이 이미 같은 방식으로 조상 `<details>`를 엿본다.
 * 카드를 클라이언트 컴포넌트로 돌리면 표·막대·끝낸 업무 줄까지 다 끌려온다.
 */
export function WhenOpen({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const box = ref.current?.closest("details");
    // 접는 상자 밖이면 미룰 게 없다 — 안 그러면 영영 안 그린다
    if (!box) {
      setOpen(true);
      return;
    }
    const sync = () => {
      if (!box.open) return;
      box.removeEventListener("toggle", sync);
      setOpen(true);
    };
    sync(); // 이미 열려 있으면 기다릴 것 없다
    box.addEventListener("toggle", sync);
    return () => box.removeEventListener("toggle", sync);
  }, []);

  return <div ref={ref}>{open ? children : null}</div>;
}
