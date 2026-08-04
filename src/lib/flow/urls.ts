/**
 * flow 딥링크 만드는 자리.
 *
 * `queries.ts`에 있던 것을 떼어 냈다. 거기는 세션·REST를 끌어와서 서버 전용인데, 링크
 * 형식은 판(`app-shell.tsx`의 일정 목록)에서도 쓴다 — 같이 두면 서버 코드가 통째로
 * 브라우저 묶음에 끌려 들어와 빌드가 깨진다. 이 파일은 아무것도 import 하지 않는다.
 */

/**
 * flow 게시글 딥링크.
 *
 * 검색 결과가 줄마다 돌려주는 `url`이 이 형식이다 — 우리가 지어낸 규칙이 아니다.
 * 알림은 `projectId`와 `postId`를 둘 다 줘서 호출 하나 없이 만든다. (워크리스트의
 * `link`는 flow가 만든 단축 URL이라 이렇게 못 만든다 — 그건 그대로 쓴다.)
 */
export const flowPostUrl = (projectId: string, postId: string) =>
  `https://flow.team/main.act?projectId=${encodeURIComponent(projectId)}&postId=${encodeURIComponent(postId)}`;

/**
 * flow 프로젝트 딥링크. 위 형식에서 `postId`만 뺀 것이다 — 프로젝트에는 짧은 링크가 없고
 * 상세 응답의 링크성 값은 `INVT_URL`(초대 URL)뿐이다 (PRD §7 실측).
 */
export const flowProjectUrl = (projectId: string) =>
  `https://flow.team/main.act?projectId=${encodeURIComponent(projectId)}`;
