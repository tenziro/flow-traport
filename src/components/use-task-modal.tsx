"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { loadNewsTask } from "@/app/(app)/actions";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { descIdOf, TaskDetailModal } from "@/components/task-detail-modal";
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
}

/**
 * `postId`만 아는 자리에서 업무 상세 모달을 연다.
 *
 * 알림 목록(news-bell)과 검색 팔레트가 같은 처지다 — 손에 든 건 게시글 ID인데 모달의 쓰기
 * 줄은 전부 `taskSrno`를 요구한다 (BUG-005, ID 공간이 둘이다). 서버에서 한 번 찾아오고
 * (`loadNewsTask`), 못 찾는 글 — 업무가 아닌 공지·회의록 — 은 `failed`로 알려서 부른 쪽이
 * 그 줄만 flow 링크로 되돌린다.
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
  /** 업무를 못 찾은 `postId`. 그 줄만 flow 링크로 돌아간다. */
  const [failed, setFailed] = useState<string | null>(null);
  /**
   * 열린 업무. 닫는 동안 내용이 남아야 접히는 게 보여서 닫을 때 안 비운다 (task-table과 같다).
   * `projectId`를 같이 든다 — 쓰기 줄이 그 값을 요구하는데 업무 한 줄에는 안 들어 있다.
   */
  const [opened, setOpened] = useState<{ task: WorklistTask; projectId: string } | null>(null);
  const [shown, setShown] = useState(false);

  const open = (input: TaskModalInput) => {
    setOpening(input.postId);
    setFailed(null);
    loadNewsTask(input)
      .catch(() => null)
      .then((result) => {
        setOpening(null);
        if (!result?.task) return setFailed(input.postId);
        onOpen?.();
        setOpened({ task: result.task, projectId: input.projectId });
        setShown(true);
      });
  };

  /* 표가 쓰는 것과 같은 상세 모달이다 (task-table). 여기서 열어도 상태·마감일·우선순위·
     담당자를 바로 고칠 수 있다 — flow로 나갈 일이 없다 */
  const modal = (
    <MorphingModal
      viewId={shown && opened ? String(opened.task.taskSrno) : null}
      onClose={() => setShown(false)}
      ariaLabel="업무 상세"
      ariaDescribedBy={opened ? descIdOf(opened.task) : undefined}
      showCloseButton={false}
      className="max-w-[34rem] lg:max-w-[44rem]"
    >
      {opened && (
        <TaskDetailModal
          task={opened.task}
          shown={opened.task}
          projectId={opened.projectId}
          path={pathname}
          onClose={() => setShown(false)}
          onSaved={(patch) =>
            setOpened((prev) => (prev ? { ...prev, task: patched(prev.task, patch) } : prev))
          }
        />
      )}
    </MorphingModal>
  );

  return { open, opening, failed, modal };
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
