/**
 * flow 검색 결과의 하이라이트 마커 처리.
 *
 * flow는 검색어가 맞은 구간을 `!#!…!#!`로 감싸서 준다. 지울 때와 그릴 때가 달라서 둘 다 있다.
 */

/** 마커를 걷어낸 원문. 제목을 비교하거나 그냥 글자만 필요할 때 쓴다. */
export const stripHighlight = (title: string): string => title.replaceAll("!#!", "");

/**
 * 같은 마커를 **지우지 않고 쪼갠다** — 검색 팔레트가 맞은 자리를 `<mark>`로 그린다 (PRD §6.4).
 *
 * 여는 마커와 닫는 마커가 같은 문자열이라 홀수 번째 조각이 맞은 구간이다. 마커 개수가
 * 홀수로 깨져 오면 마지막 조각이 강조로 남는데, 글자가 사라지지는 않는다.
 */
export const splitHighlight = (text: string): { text: string; hit: boolean }[] =>
  text
    .split("!#!")
    .map((part, i) => ({ text: part, hit: i % 2 === 1 }))
    .filter((part) => part.text !== "");
