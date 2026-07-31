"use client";

import { useState } from "react";
import { IconComment, IconNormal } from "@/components/icons";
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
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
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
      {state === "done" ? <IconNormal size={13} /> : <IconComment size={13} />}
      {state === "done" ? "복사했어요" : state === "failed" ? "복사하지 못했어요" : label}
    </Button>
  );
}
