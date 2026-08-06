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
  /**
   * flow는 같은 상태(`STTS` 코드 0)를 쓰기 enum에서는 `request`, 목록 응답에서는 `대기`로
   * 부른다 (`rest.ts` `STTS_LABEL`). 여기서 `요청`으로 적었더니 **지금 값이 `대기`인 업무는
   * 고르기 목록 어디에도 체크가 안 섰고**, 같은 값인 `요청`을 누르면 flow가 400을 줬다.
   * 화면이 읽는 이름(`대기`)으로 맞춘다 — 한 상태를 자리마다 다르게 부르지 않는다.
   */
  request: "대기",
  progress: "진행",
  feedback: "피드백",
  complete: "완료",
  hold: "보류",
};
