"use client";

import { useSyncExternalStore } from "react";

/**
 * 좁은 화면의 경계 — Tailwind `lg`(1024px) 아래다.
 *
 * 이 앱이 "모바일"이라고 부르는 폭이 여기다 (PRD §7.3): 좌측 레일이 사라지고 상단 앱바 +
 * 하단 탭이 서는 구간이라, 레이어도 같은 선에서 갈라져야 한다. 폭을 새로 정하지 않고 셸이
 * 쓰는 `lg:hidden`과 같은 선을 쓴다 — 두 개를 따로 두면 어느 날 한쪽만 움직인다.
 */
const NARROW = "(max-width: 1023.98px)";

/**
 * 지금 좁은 화면인가. 서버에서는 **항상 false**다 — 요청에서 화면 폭을 알 방법이 없다.
 *
 * 그래서 이 값으로 여닫는 것만 가른다. 첫 그림에 보이는 것(단추·글자)을 이걸로 바꾸면 좁은
 * 화면에서 넓은 화면 모양이 한 번 그려지고 나서 바뀐다 — 그 번쩍임은 CSS(`lg:`)가 막을 수
 * 있는 것이라 여기로 가져오지 않는다.
 *
 * `useEffect` + `useState`가 아니라 `useSyncExternalStore`인 것은 이게 바로 "밖에 있는 값을
 * 구독하는" 자리라서다 — 이펙트로 하면 첫 그림 뒤에 한 번 더 그리고, 린트도 이펙트 안의
 * setState를 막는다 (center-morph-modal.tsx의 `mounted`와 같은 이유).
 */
export function useNarrowScreen() {
  return useSyncExternalStore(subscribe, isNarrow, ON_SERVER);
}

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const isNarrow = () => window.matchMedia(NARROW).matches;
const ON_SERVER = () => false;
