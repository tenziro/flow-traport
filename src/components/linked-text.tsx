import { IconOpen } from "@/components/icons";
import { splitLinks } from "@/lib/utils";

/**
 * 글에 섞여 온 `http`·`https` 주소를 새 창 링크로 바꿔 낸다.
 *
 * 업무 본문(`task-thread.tsx`)과 댓글(`thread-view.tsx`), 멘션 알림 내용
 * (`mention-table.tsx`)이 같이 쓴다 — flow 본문에 붙는 주소는 대개 댓글로 다시 오고,
 * 한쪽만 눌리면 "여기선 왜 안 되냐"가 남는다.
 *
 * 줄은 감싸지 않는다. 자리마다 글자 크기와 색이 달라서(`text-sm`·`text-[13px]`·시스템
 * 기록의 흐린 색) `<p>`는 부르는 쪽에 둔다.
 */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.url ? (
          /* 새 창으로 연다 — Cockpit은 훑어보는 화면이고, 이 자리에서 나가 버리면 읽던
             업무와 댓글이 사라진다 (`FlowLink`와 같은 이유).
             화살표는 "여기서 안 열린다"는 표시다. 새 창은 화면을 바꿔치기하니 말로도
             알린다 — 아이콘은 `aria-hidden`이라 읽어 주지 않는다 */
          <a
            key={i}
            href={part.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
          >
            {part.text}
            <IconOpen size={11} aria-hidden className="ml-0.5 inline align-baseline" />
            <span className="sr-only"> (새 창)</span>
          </a>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
