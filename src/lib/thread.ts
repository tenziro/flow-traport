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

/**
 * flow 멘션 마크업. **REST로 올려도 flow가 프로필 앵커로 풀어 준다** — 게시글 82343667에
 * `@[이종석](jongseok.lee@traport.com)`을 `POST /user/comments`로 올리고 상세의 `CNTN`을
 * 다시 받아 확인했다 (`<a … profile-data='…IDNT_ID…'>이종석</a>`, 실측 2026-08-06).
 * flow 화면에서 직접 쓴 멘션과 같은 결과다.
 *
 * 그전에는 답글을 `@이름` 평문으로 보냈는데, 그건 flow가 멘션으로 안 읽어서 **상대에게
 * 알림이 가지 않았다** — 답글 기능의 절반이 비어 있었다.
 *
 * 괄호 안은 flow user_id다. 사내 계정은 그게 메일 주소고(`jongseok.lee@traport.com`)
 * 타사 계정은 짧은 id다(`ymh0510`) — 둘 다 그대로 넣는다.
 */
export const mentionMarkup = (name: string, userId: string) => `@[${name}](${userId})`;

/**
 * 답글로 보낼 한 줄. 상대를 앞에서 부르고 쓴 글을 잇는다 (`createComment`).
 *
 * **이미 부른 글이면 안 붙인다.** 자동완성으로 답할 상대를 직접 골라 쓰면 본문에 한 번,
 * 앞에 한 번 — 같은 멘션이 두 번 나갔다. `userId`가 없으면 부를 방법이 `@이름` 평문뿐이라
 * 알림은 안 가지만 누구에게 한 말인지는 남는다.
 */
export function withCall(content: string, name: string, userId: string) {
  if (!name) return content;
  const call = userId ? mentionMarkup(name, userId) : `@${name}`;
  return content.includes(call) ? content : `${call} ${content}`;
}

/** `splitPicked`의 한 조각. `person`이 있으면 고른 사람 이름이다. */
export type Picked = { name: string; userId: string };

/**
 * 쓴 글을 **고른 사람 이름**과 나머지 글로 가른다. 입력칸의 강조 그리기(`CommentForm`)와
 * 보낼 때의 마크업 변환(`toMentions`)이 같이 쓴다 — 화면에 굵게 나온 자리와 실제로 부르는
 * 자리가 갈리면 안 된다.
 *
 * 왼쪽부터 훑으면서 **긴 이름을 먼저** 맞춘다. `김민`이 먼저 걸리면 `김민수`가 반쪽만 먹힌다.
 * 맞은 자리는 통째로 건너뛰므로 이미 잡은 이름 안에서 짧은 이름이 다시 걸리지 않는다.
 */
export function splitPicked(text: string, picked: readonly Picked[]) {
  const names = [...picked].sort((a, b) => b.name.length - a.name.length);
  const parts: { text: string; person?: Picked }[] = [];
  let plain = "";
  for (let i = 0; i < text.length; ) {
    const hit = names.find((p) => p.name && text.startsWith(p.name, i));
    if (!hit) {
      plain += text[i];
      i += 1;
      continue;
    }
    if (plain) parts.push({ text: plain });
    plain = "";
    parts.push({ text: hit.name, person: hit });
    i += hit.name.length;
  }
  if (plain) parts.push({ text: plain });
  return parts;
}

/**
 * 쓴 글의 이름 → 멘션 마크업. **고른 사람만 바꾼다** — 손으로 친 이름은 그대로 둔다.
 *
 * 입력칸에는 마크업을 안 담는다. `@[이종석](jongseok.lee@traport.com)`은 38자라 이름 하나가
 * 칸을 다 먹는다. 화면에는 댓글 목록과 같은 모양(이름만, 굵게, 포인트색 — `LinkedText`)으로
 * 두고 보낼 때 여기서 바꾼다.
 */
export function toMentions(text: string, picked: readonly Picked[]) {
  return splitPicked(text, picked)
    .map((p) => (p.person ? mentionMarkup(p.person.name, p.person.userId) : p.text))
    .join("");
}
