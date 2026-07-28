import type { FlowLegacyTaskStatus } from "@/lib/flow/types";

/**
 * flow_update_task가 받는 상태 enum → 화면 라벨. 커스텀 상태 라벨이 아니라 이 5개 고정이다.
 *
 * `actions.ts`("use server")에 두면 안 된다 — Next가 서버 액션 모듈에서 함수가 아닌
 * export를 클라이언트 번들에서 지워버려서, 클라이언트에서는 `{}`로 도착한다.
 * 실제로 상태 드롭다운이 항목 0개로 그려지던 원인이었다 (bug-report BUG-008).
 */
export type TaskStatus = FlowLegacyTaskStatus;

export const TASK_STATUS: Record<TaskStatus, string> = {
  request: "요청",
  progress: "진행",
  feedback: "피드백",
  complete: "완료",
  hold: "보류",
};
