"use client";

import { useState } from "react";
import { IconCopy, IconNormal, IconRisk } from "@/components/icons";
import { Button } from "@/components/motion/button/base";

/**
 * 클립보드 복사. 주간회의에 그대로 붙여넣을 마크다운을 넘긴다.
 *
 * ponytail: `navigator.clipboard`가 없거나 거부되면 실패 문구만 낸다.
 * textarea + execCommand 폴백은 만들지 않는다 — 사내에서 https + 최신 브라우저만 쓴다.
 */
export function CopyButton({
  text,
  label,
  iconOnly = false,
  className,
}: {
  text: string;
  /** 단추에 적히는 말. `iconOnly`면 화면에서 사라지고 읽어 주는 이름으로만 남는다. */
  label: string;
  /**
   * 아이콘만. 구성원 카드처럼 한 카드에 단추가 여러 개일 때 쓴다 — 값마다 `복사` 두 글자가
   * 붙으면 그 글자가 값보다 눈에 먼저 든다. 대신 `ghost`로 내려 테두리도 없앤다.
   */
  iconOnly?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  const message =
    state === "done" ? "복사했어요" : state === "failed" ? "복사하지 못했어요" : label;

  return (
    <Button
      type="button"
      size={iconOnly ? "icon" : "sm"}
      variant={iconOnly ? "ghost" : "secondary"}
      // 글자가 없으면 읽어 줄 이름도 없다. 결과 문구를 그대로 이름에 넣어서 성공·실패가
      // 스크린 리더에도 남고, `title`로 눈으로 보는 쪽에도 뜬다.
      aria-label={iconOnly ? message : undefined}
      title={iconOnly ? message : undefined}
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("failed");
        }
      }}
    >
      {state === "done" ? (
        <IconNormal size={13} />
      ) : state === "failed" ? (
        <IconRisk size={13} />
      ) : (
        // 전에는 `IconComment`(말풍선)였다. `복사` 두 글자가 옆에 있어서 아무 그림이나
        // 통했지만, 아이콘만 남으면 그림이 뜻을 다 져야 한다.
        <IconCopy size={13} />
      )}
      {!iconOnly && message}
    </Button>
  );
}
