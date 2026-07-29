"use client";

import { useActionState, useState } from "react";
import { createTask, type ActionResult } from "@/app/(app)/actions";
import { DateField } from "@/components/date-field";
import { IconAdd, IconNormal } from "@/components/icons";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { cn } from "@/lib/utils";

/**
 * 프로젝트에 업무 추가 (PRD §6.1.4).
 *
 * PRD는 "모달 확인 필수"라고 했다. 모달 대신 **접힌 폼 + 확인 단계**로 만든다 —
 * 리스크 카드 안에서 어느 프로젝트에 넣는지 보이는 채로 쓰는 게, 맥락을 가리는
 * 모달보다 오히려 안전하다. 확인이라는 요구(§8.1)는 두 번 누르기로 그대로 지킨다.
 *
 * 접기는 beUI BouncyAccordion. `<details>`와 달리 JS가 필요하지만, 열고 닫을 때
 * 높이가 스프링으로 따라와서 카드 안에서 폼이 튀어나오는 느낌이 사라진다.
 */

/** beUI Input 기본 치수(h-11 rounded-full text-base)를 이 앱의 촘촘한 행에 맞춘다. */
const DENSE = {
  field: "h-8 rounded-lg bg-background",
  input: "text-sm",
} as const;

export function NewTaskForm({ projectId, project, path }: {
  projectId: string;
  project: string;
  path: string;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createTask, null);
  const [title, setTitle] = useState("");
  const [endDate, setEndDate] = useState("");
  const [confirming, setConfirming] = useState(false);

  return (
    <BouncyAccordion
      className="mt-3 border-t border-border pt-3"
      classNames={{
        // 이미 Card 안이다 — 배경을 지워 카드 안 카드를 만들지 않는다.
        // `overflow-visible`이 짤림의 핵심이다 (task-actions.tsx와 같은 이유, BUG-009).
        item: "overflow-visible bg-transparent",
        trigger: "min-h-7 gap-1.5 px-0",
        icon: "h-4 w-4",
        title: "text-xs font-normal text-muted-foreground",
        chevron: "h-4 w-4",
        // 좌우 패딩을 끈다. 폼 왼쪽이 헤더에 맞고, 음수 마진 때와 달리 내용이
        // 행 폭을 넘지 않아 오른쪽이 잘리지 않는다.
        body: "px-0 pb-3",
        description: "text-sm text-foreground",
      }}
      items={[
        {
          id: `new-task-${projectId}`,
          icon: <IconAdd size={14} />,
          title: "이 프로젝트에 업무 추가하기",
          description: (
            <form action={action} className="space-y-2">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="path" value={path} />

              <div className="flex flex-wrap gap-2">
                <label className="sr-only" htmlFor={`new-title-${projectId}`}>
                  업무명
                </label>
                <Input
                  id={`new-title-${projectId}`}
                  name="title"
                  value={title}
                  onChange={(next) => {
                    setTitle(next);
                    setConfirming(false);
                  }}
                  placeholder="무슨 업무인가요?"
                  maxLength={200}
                  className="min-w-0 flex-1"
                  classNames={DENSE}
                />
                <span id={`new-end-${projectId}`} className="sr-only">
                  마감일
                </span>
                {/* 옆 업무명 입력과 같은 높이(32px)다. 모서리만 pill인데, 달력이 뜨는
                    자리라 네모난 입력보다 눌러야 할 것으로 읽힌다 */}
                <DateField
                  name="endDate"
                  value={endDate}
                  onChange={setEndDate}
                  aria-labelledby={`new-end-${projectId}`}
                  placeholder="마감일"
                  className="w-36"
                />
              </div>

              <label className="sr-only" htmlFor={`new-body-${projectId}`}>
                업무 내용
              </label>
              {/* beUI에 textarea가 없다. 여러 줄 입력은 네이티브로 두고, 테두리·여백만
                  옆 Input과 맞춘다. */}
              <textarea
                id={`new-body-${projectId}`}
                name="contents"
                rows={2}
                placeholder="내용 (비워두면 업무명이 들어가요)"
                maxLength={2000}
                className="w-full rounded-lg border border-border bg-background px-3.5 py-1.5 text-sm placeholder:text-muted-foreground/60"
              />

              {confirming ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-warning-foreground">
                    {project}에 &lsquo;요청&rsquo; 상태로 만들까요?
                  </span>
                  <Button type="submit" size="sm" disabled={pending}>
                    {pending ? "만드는 중…" : "네, 만들게요"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                    취소
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!title.trim()}
                  onClick={() => setConfirming(true)}
                >
                  <IconAdd size={13} />
                  업무 만들기
                </Button>
              )}

              {result && (
                <p
                  role="status"
                  className={cn(
                    "flex items-start gap-1 text-xs",
                    result.ok ? "text-success-foreground" : "text-danger-foreground",
                  )}
                >
                  {result.ok && <IconNormal size={13} className="mt-0.5 shrink-0" />}
                  <span className="min-w-0 flex-1 break-words">{result.message}</span>
                </p>
              )}
            </form>
          ),
        },
      ]}
    />
  );
}
