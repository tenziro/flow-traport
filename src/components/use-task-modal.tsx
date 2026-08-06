"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { loadNewsTask } from "@/app/(app)/actions";
import { DetailHeader } from "@/components/detail-header";
import { FlowLink } from "@/components/flow-link";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { Button } from "@/components/motion/button/base";
import { descIdOf, TaskDetailModal } from "@/components/task-detail-modal";
import { TaskThread } from "@/components/task-thread";
import { diffDays, parseFlowDeadline } from "@/lib/aggregate/date";
import type { WorklistTask } from "@/lib/flow/queries";

/** 여는 쪽이 손에 든 값. `loadNewsTask`가 요구하는 것과 같다. */
export interface TaskModalInput {
  projectId: string;
  postId: string;
  /** 업무명. 없으면 찾을 방법이 없어서 곧장 실패로 떨어진다. */
  title?: string;
  /** 프로젝트명. 모달 머리에 그대로 쓴다. */
  project?: string;
  /** flow로 나갈 주소. 모달 발의 `flow에서 보기`가 쓴다. */
  url?: string;
  /**
   * 부른 쪽이 이미 업무가 아닌 걸 안다 — 프로젝트의 글 목록(`listProjectPosts`)이 업무를
   * 걸러 내고 주는 줄이다. 찾아 봐야 늘 `notTask`라 그 왕복을 건너뛴다.
   */
  isPost?: boolean;
}

/** 업무 모달이 열렸는지, 글 모달이 열렸는지. 둘이 같은 껍데기(`MorphingModal`)를 쓴다. */
type View =
  | { kind: "task"; task: WorklistTask; projectId: string }
  | { kind: "post"; input: TaskModalInput };

/**
 * `postId`만 아는 자리에서 상세 모달을 연다.
 *
 * 알림 목록(news-bell)과 검색 팔레트가 같은 처지다 — 손에 든 건 게시글 ID인데 업무 모달의
 * 쓰기 줄은 전부 `taskSrno`를 요구한다 (BUG-005, ID 공간이 둘이다). 서버에서 한 번 찾아온다
 * (`loadNewsTask`).
 *
 * **업무가 아닌 글도 여기서 연다** (v4.16.0). 공지·회의록·일정은 업무 목록에 없어서 예전에는
 * flow 링크로 되돌렸는데, 읽는 데 필요한 건 글 번호 하나뿐이었다 — 본문·첨부·댓글이 전부
 * `loadTaskPost`로 온다. 없는 것은 고칠 값(상태·마감일·담당자)뿐이라 그 줄만 빼면 된다.
 *
 * REST가 아예 실패한 것은 여전히 `failed`다. 그때는 다시 눌러 볼 일이라 flow 링크로 되돌린다 —
 * 업무가 아닌 것과 갈라야 한다 (`notTask`).
 *
 * **실패한 자리에서 우리가 `window.open`을 부르지 않는다.** 사용자 제스처에서 한 박자 떨어져
 * 있어서 브라우저가 팝업으로 보고 막는다. 사람이 직접 누른 링크는 안 막힌다.
 *
 * `onOpen`은 부른 쪽이 자기 껍데기를 닫는 자리다 — 알림 팝오버든 검색 레이어든, 모달이 그 위에
 * 겹치면 뒤에 남은 목록이 배경으로 어른거린다.
 */
export function useTaskModal(onOpen?: () => void) {
  const pathname = usePathname();
  /** 지금 여는 중인 `postId`. 서버에서 업무를 찾는 동안만 켜진다. */
  const [opening, setOpening] = useState<string | null>(null);
  /** 아예 못 연 `postId`. 그 줄만 flow 링크로 돌아간다. */
  const [failed, setFailed] = useState<string | null>(null);
  /**
   * 열린 것. 닫는 동안 내용이 남아야 접히는 게 보여서 닫을 때 안 비운다 (task-table과 같다).
   * `projectId`를 같이 든다 — 쓰기 줄이 그 값을 요구하는데 업무 한 줄에는 안 들어 있다.
   */
  const [opened, setOpened] = useState<View | null>(null);
  const [shown, setShown] = useState(false);

  const open = (input: TaskModalInput) => {
    setFailed(null);
    // 업무가 아닌 게 확실하면 찾을 것이 없다 — 곧장 글 모달이다.
    if (input.isPost) {
      onOpen?.();
      setOpened({ kind: "post", input });
      return setShown(true);
    }
    setOpening(input.postId);
    loadNewsTask(input)
      .catch(() => null)
      .then((result) => {
        setOpening(null);
        // 업무가 아니면 글 모달이다. REST가 죽은 것만 링크로 되돌린다.
        if (!result?.task && !result?.notTask) return setFailed(input.postId);
        onOpen?.();
        setOpened(
          result.task
            ? { kind: "task", task: result.task, projectId: input.projectId }
            : { kind: "post", input },
        );
        setShown(true);
      });
  };

  /* 표가 쓰는 것과 같은 상세 모달이다 (task-table). 여기서 열어도 상태·마감일·우선순위·
     담당자를 바로 고칠 수 있다 — flow로 나갈 일이 없다 */
  const modal = (
    <MorphingModal
      viewId={shown && opened ? viewIdOf(opened) : null}
      onClose={() => setShown(false)}
      ariaLabel={opened?.kind === "post" ? "글 상세" : "업무 상세"}
      ariaDescribedBy={opened ? viewIdOf(opened) : undefined}
      showCloseButton={false}
      className="max-w-[34rem] lg:max-w-[44rem]"
    >
      {opened?.kind === "task" && (
        <TaskDetailModal
          task={opened.task}
          shown={opened.task}
          projectId={opened.projectId}
          path={pathname}
          onClose={() => setShown(false)}
          onSaved={(patch) =>
            setOpened((prev) =>
              prev?.kind === "task" ? { ...prev, task: patched(prev.task, patch) } : prev,
            )
          }
        />
      )}
      {opened?.kind === "post" && (
        <PostDetail input={opened.input} path={pathname} onClose={() => setShown(false)} />
      )}
    </MorphingModal>
  );

  return { open, opening, failed, modal };
}

/** 모달 제목의 id이자 `MorphingModal`의 키. 업무는 업무번호, 글은 글 번호로 가른다. */
const viewIdOf = (view: View) =>
  view.kind === "task" ? descIdOf(view.task) : `post-detail-${view.input.postId}`;

/**
 * 업무가 아닌 글의 상세 — 공지·회의록·일정 (PRD §6.5).
 *
 * 업무 모달에서 **고치는 줄만 빠진 모양**이다. 글에는 상태도 마감일도 담당자도 없어서 뺄 게
 * 그것뿐이고, 읽는 자리(본문·첨부·댓글)와 댓글 쓰기는 업무와 똑같이 돈다 — 같은 `TaskThread`다.
 *
 * 머리의 오른쪽 딱지는 안 세운다. 업무 모달이 거기 세우는 건 사람끼리 부르는 **업무번호**인데
 * 글에는 그 번호가 없고, 글 번호로 대신 채우면 flow에서 쓰는 번호와 달라 없느니만 못하다
 * (`DetailHeader` 주석).
 */
function PostDetail({
  input,
  path,
  onClose,
}: {
  input: TaskModalInput;
  path: string;
  onClose: () => void;
}) {
  return (
    <>
      <DetailHeader
        project={input.project || "프로젝트를 못 찾았어요"}
        title={input.title || "제목 없는 글"}
        titleId={`post-detail-${input.postId}`}
      >
        <span>업무가 아닌 글이에요</span>
      </DetailHeader>

      {/* 높이 규칙은 업무 모달과 같다 (`TaskDetailModal` 주석) — 머리·바닥은 제자리고
          가운데만 스크롤한다 */}
      <div className="max-h-[min(60vh,calc(100dvh-16rem))] overflow-y-auto overscroll-contain border-b border-border bg-card [&>*:last-child]:border-b-0">
        <TaskThread
          projectId={input.projectId}
          postId={input.postId}
          title={input.title ?? ""}
          path={path}
        />
      </div>

      <div className="flex items-center justify-between px-5 py-3">
        <FlowLink href={input.url ?? ""} />
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
    </>
  );
}

/**
 * 방금 저장한 값을 얹는다. 표와 달리 열려 있는 업무가 하나뿐이라 낙관값도 한 벌이다 —
 * `base` 스위치가 필요 없다 (표는 서버가 다시 그려 주는 줄과 맞대야 해서 든다).
 */
function patched(task: WorklistTask, patch: { status?: string; endDate?: string }): WorklistTask {
  const endDate = patch.endDate ?? task.endDate;
  return {
    ...task,
    status: patch.status ?? task.status,
    endDate,
    // 마감일이 바뀌면 남은 일수도 그 값에서 다시 센다 — 안 그러면 옛 D+가 그대로 남는다.
    daysLeft:
      endDate === task.endDate
        ? task.daysLeft
        : diffDays(Date.now(), parseFlowDeadline(endDate) ?? Date.now()),
  };
}
