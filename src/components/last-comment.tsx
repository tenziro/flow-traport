"use client";

import { useEffect, useRef, useState } from "react";
import { loadLastComment } from "@/app/(app)/actions";
import { IconLastComment } from "@/components/icons";

/**
 * 업무 한 줄에 붙는 마지막 댓글. 오늘 화면의 포커스 업무가 쓰던 자리를 그대로 쓴다.
 *
 * 두 가지로 온다:
 * - `text` — 이미 받아 둔 값 (오늘·팀 화면. `flow_suggest_my_focus` 픽에서 빌린다)
 * - `postId` — **화면에 들어올 때** 불러온다 (내 업무 화면. 951줄을 미리 채울 수 없다)
 *
 * 화면에 들어오는지로 판단하는 이유: 프로젝트 카드가 `<details>`라 접힌 줄은 그려져 있어도
 * 화면에 없다. `useEffect`로 바로 부르면 접힌 951줄이 전부 요청을 쏜다. `IntersectionObserver`는
 * 접힌 줄을 절대 통과시키지 않으므로, 사용자가 펼쳐서 눈으로 지나간 줄만 부른다.
 *
 * ponytail: 요청을 줄 세우지 않는다. 한 번에 나가는 수는 화면에 보이는 줄 수(대여섯)로
 * 저절로 묶이고, 응답은 5분 캐시라 같은 줄을 다시 지나가도 안 부른다. 그래도 분당 120회에
 * 걸리면 그 줄만 댓글 없이 남는다 — 줄 세우기는 그때 넣으면 된다.
 */
export function LastComment({ text, postId }: { text?: string; postId?: string }) {
  const [body, setBody] = useState(text);
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // 이미 값이 있거나 부를 길이 없으면 지켜볼 이유가 없다.
    if (body !== undefined || !postId) return;
    const el = anchor.current;
    if (!el) return;

    let done = false;
    const observer = new IntersectionObserver((entries) => {
      if (done || !entries.some((entry) => entry.isIntersecting)) return;
      done = true;
      observer.disconnect();
      // 없으면 빈 문자열로 둔다 — `undefined`로 두면 다시 부를 대상이 된다.
      loadLastComment(postId).then((got) => setBody(got?.body ?? ""));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [body, postId]);

  // 자리를 미리 비워 두지 않는다. 댓글 없는 업무가 많아서(실측 대부분) 빈 줄이 쌓이면
  // 목록 높이가 들쭉날쭉해진다. 지켜볼 점만 남기고 값이 오면 그때 자란다.
  //
  // 높이는 0이 아니라 1px에 음수 마진으로 상쇄한다. 넓이·높이가 0인 요소를 화면에
  // 들어왔다고 볼지는 브라우저마다 다르다 — 실제 크기를 주고 자리만 없앤다.
  if (!body) return <span ref={anchor} aria-hidden className="-mb-px block h-px" />;

  return (
    <p className="mt-1.5 flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
      {/* 아이콘 칸 높이를 글줄 한 줄(`1lh`)로 잡고 그 안에서 중앙에 둔다 (`TaskItem`과 같다) */}
      <span className="flex h-[1lh] shrink-0 items-center">
        <IconLastComment size={13} />
      </span>
      {/* `wrap-anywhere` — 댓글에 섞여 오는 링크는 띄어쓰기가 없다 (BUG-025) */}
      <span className="line-clamp-2 wrap-anywhere">{body}</span>
    </p>
  );
}
