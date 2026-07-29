/**
 * `flow_list_projects` 대체 경로 — 이름으로 프로젝트 ID 찾기.
 *
 * 2026-07-28부터 flow 서버가 `flow_list_projects`에서 **자기 응답 스키마 검증에 실패**한다
 * (docs/bug-report.md BUG-007). 그 도구가 죽어 있으면 `projectId`를 못 구해 쓰기 액션이
 * 통째로 막히기 때문에, 스탠드업·워크리스트가 주는 **프로젝트 이름**으로 하나씩 검색한다.
 *
 * 이름이 정확히 같은 결과만 채택한다. 비슷한 게 여럿이면 포기하고 비워둔다 —
 * 엉뚱한 프로젝트에 업무를 만드느니 쓰기 버튼이 안 보이는 편이 낫다.
 */

import type { FlowMcp } from "./mcp";

/** flow 검색은 매칭 구간을 `!#!…!#!`로 감싸서 준다. 제목을 비교하기 전에 걷어낸다. */
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

/**
 * 프로젝트 이름 → 검색 키워드. 기호를 털고 두 글자 이상만 남긴다.
 * `flow_search_project`가 최대 8개까지 받는다.
 */
export function searchKeywords(name: string): string[] {
  const words = name.split(/[^0-9A-Za-z가-힣]+/).filter((word) => word.length >= 2);
  return [...new Set(words)].slice(0, 8);
}

interface SearchHit {
  data: { projectId: string; title: string };
}

/**
 * 이름 목록을 ID 맵으로 바꾼다. 못 찾은 이름은 맵에 넣지 않는다 — 호출부가 `null`로 읽는다.
 *
 * ponytail: 이름 하나당 검색 한 번이다. 실측상 한 부서 스탠드업에 뜨는 프로젝트가
 * 한 자릿수라 그냥 병렬로 다 쏜다. 두 자릿수로 늘면 그때 묶는 방법을 찾는다.
 */
export async function searchProjectIds(
  mcp: FlowMcp,
  names: Iterable<string>,
): Promise<Map<string, string>> {
  const found = await Promise.all(
    [...new Set(names)].map(async (name) => {
      const keywords = searchKeywords(name);
      if (keywords.length === 0) return null;

      const res = await mcp
        .call<{ results: SearchHit[] }>("flow_search_project", { keywords, size: 5 })
        .catch(() => null);

      const hit = res?.results.find((r) => stripHighlight(r.data.title) === name);
      return hit ? ([name, hit.data.projectId] as const) : null;
    }),
  );

  return new Map(found.filter((entry) => entry !== null));
}
