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

/**
 * **flow는 우선순위를 숫자 코드로 준다.** 쓸 때는 `low`\|`normal`\|`high`\|`urgent`를 받는데
 * (api-spec §6.4) 읽을 때 오는 `PRIORITY` 컬럼값은 `0`~`3`이고 `optionName`은 늘 비어 있다.
 *
 * 그래서 화면이 `보통` 대신 `1`을, 변경 로그가 `우선순위를 2로 바꿨어요`를 냈다. 표의
 * `높음`·`긴급` 표식과 포커스 점수의 `긴급` 가산도 같은 이유로 한 번도 안 걸렸다.
 *
 * 대응표는 실측이다 `(2026-08-06, 92건)` — 같은 업무의 변경 로그 본문이 코드와 라벨을 같이
 * 들고 있다: `S49^^0` + `main:dictionary.low` · `S49^^1` + `보통` · `S49^^2` + `높음` ·
 * `S49^^3` + `긴급`(flow의 키는 `main:dictionary.argent`로 오타다).
 */
const FLOW_CODE: Record<string, TaskPriority> = {
  "0": "low",
  "1": "normal",
  "2": "high",
  "3": "urgent",
};

/**
 * flow가 준 값 → 우리 키. 숫자 코드(`2`)와 영문 키(`high`)를 다 받는다 — 쓰기가 영문 키를
 * 받으니 언젠가 읽기도 그렇게 올 수 있고, 그때 이 줄이 다시 안 깨진다. 모르는 값은 빈 문자열이다.
 */
export const toPriority = (raw: string): TaskPriority | "" =>
  FLOW_CODE[raw] ?? (raw in TASK_PRIORITY ? (raw as TaskPriority) : "");
