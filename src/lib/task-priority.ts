/**
 * flow REST가 받는 우선순위 네 개 (api-spec §6.4) → 화면 라벨.
 *
 * `rest.ts`가 아니라 여기 두는 이유는 `task-status.ts`와 같다: 이 표를 클라이언트
 * 컴포넌트(`task-actions.tsx`)의 드롭다운이 읽는데, `rest.ts`는 쿠키(`next/headers`)를
 * 만지므로 클라이언트에서 import 할 수 없다. `actions.ts`("use server")도 안 된다 —
 * 함수가 아닌 export가 클라이언트 번들에서 지워져 `{}`로 도착한다 (bug-report BUG-008).
 *
 * 네 라벨이 모두 받침으로 끝나서 조사는 항상 `으로`다 (낮음으로 / 보통으로 / 높음으로 /
 * 긴급으로). 문구에 `(으)로`를 쓰지 않아도 되는 건 그 덕분이다.
 */
export const TASK_PRIORITY = {
  low: "낮음",
  normal: "보통",
  high: "높음",
  urgent: "긴급",
} as const;

export type TaskPriority = keyof typeof TASK_PRIORITY;
