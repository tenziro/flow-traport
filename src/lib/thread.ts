/**
 * 댓글 목록을 접는 규칙. 업무 상세 모달과 멘션 상세 모달이 같이 쓴다 (`CommentList`).
 *
 * 화면 코드에서 떼어 둔 건 인덱스 계산이라 눈으로 맞다고 보기 어려워서다 — 옆에
 * `thread.test.ts`가 있다.
 */

/** 접힌 채로 보여줄 **최상위** 댓글 수. 이보다 많으면 `댓글 다 보기`로 나머지를 펼친다. */
export const SHOWN = 2;

/** `tail`이 보는 것만. 화면 타입(`ThreadComment`)은 서버 액션 쪽에 있어서 여기서 안 부른다. */
type Foldable = { reply?: boolean; called?: boolean };

/**
 * 접었을 때 남길 줄. 끝에서 최상위 댓글 `SHOWN`개가 시작하는 자리부터 끝까지다.
 *
 * 답글은 수에 안 세고 **부모를 따라간다** — 목록이 `부모 → 그 답글들` 순서라 자르는 자리
 * 하나로 둘 다 된다. 답글까지 세어 자르면 부모 없는 `↳` 줄이 첫 줄로 서서, 화살표가 가리킬
 * 대상이 화면에 없다.
 *
 * **나를 부른 줄은 접히지 않는다** — 있으면 그 줄(답글이면 그 부모)까지 자르는 자리를 앞으로
 * 당긴다. 멘션 모달에서 이 목록을 여는 이유가 "내가 왜 불렸나"인데 그 줄이 접혀 있으면
 * 기본 화면이 질문에 답을 안 한다. 업무 상세 모달도 같은 규칙이다 — 같은 목록이다.
 */
export function tail<T extends Foldable>(comments: T[]): T[] {
  const tops = comments.flatMap((c, i) => (c.reply ? [] : [i]));
  const byCount = tops.length > SHOWN ? tops[tops.length - SHOWN] : 0;
  const called = comments.findIndex((c) => c.called);
  // 부른 줄이 답글이면 그 부모부터 남긴다 — 답만 남으면 무엇에 대한 답인지 사라진다.
  const byCalled = called < 0 ? byCount : (tops.filter((i) => i <= called).pop() ?? 0);
  return comments.slice(Math.min(byCount, byCalled));
}
