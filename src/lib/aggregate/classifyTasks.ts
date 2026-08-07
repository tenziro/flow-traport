/**
 * 업무 분류 (PRD §6.1.1).
 *
 * 밀림(active)과 방치(stale)를 나누는 게 이 함수의 존재 이유다.
 * 섞으면 액션 리스트가 죽은 업무로 오염된다.
 */

import { diffDays, kstDayIndex, parseFlowDate, parseFlowDeadline, toEpochMs } from './date';
import type { NowInput } from './date';
import type { Task } from './types';

export type TaskCategory = 'imminent' | 'overdueActive' | 'overdueStale' | 'normal';

export interface ClassifyOptions {
  /** 임박 기준. 마감이 now + 이 일수 이내면 임박. 기본 7일. */
  imminentDays?: number;
  /** 방치 기준. 마지막 활동이 이 일수를 넘으면 방치. 기본 30일. */
  staleDays?: number;
  /** 이 라벨(대소문자·공백 무시)이면 완료로 본다. */
  doneStatuses?: string[];
}

export const CLASSIFY_DEFAULTS: Required<ClassifyOptions> = {
  imminentDays: 7,
  staleDays: 30,
  doneStatuses: ['완료', '종료', '취소', 'done', 'closed', 'complete', 'completed'],
};

/**
 * 밀림·임박 1건을 몇 건으로 셀지. 여기 있는 상태는 "마감이 지났지만 **지금 내가 밀고 있는
 * 일**"이 아니라서, 그대로 세면 위험도가 부풀려진다.
 *
 * - `피드백` — 마무리 직전이고 상대 답을 기다리는 중이다. 내 몫은 이미 했다.
 * - `보류` — 누군가 일부러 세워 둔 것이다. 마감이 지난 건 세워 뒀기 때문인데, 그걸 리스크로
 *   세면 세워 두는 결정마다 등급이 올라간다. 피드백보다 더 깎는다 — 피드백은 곧 돌아올
 *   답을 기다리지만 보류는 돌아올 날짜 자체가 없다.
 *
 * **0으로 두지 않는다.** 세워 둔 채 잊히는 일은 실제로 일어난다. 30일간 아무도 안 건드리면
 * 어차피 방치(`overdueStale`)로 넘어가 점수에서 빠지므로, 그 전까지는 작게라도 센다.
 *
 * **건수와 목록에서 빼지도 않는다.** 마감이 지난 건 사실이라 KPI의 밀림 건수와 밀리는 업무
 * 표에는 그대로 남는다 — 무게는 순위와 점수에만 쓴다. 안 보이게 하는 쪽으로 틀리면 일을
 * 놓친다.
 *
 * 라벨 문자열로 맞춘다. flow는 프로젝트마다 상태 이름을 바꿀 수 있어서(커스텀 상태) 코드가
 * 아니라 문자열로 오고, 우리가 아는 라벨은 `STTS_LABEL`의 다섯 개다 (rest.ts).
 */
export const STATUS_WEIGHT: Record<string, number> = {
  피드백: 0.4,
  보류: 0.2,
};

/** 이 업무를 셀 때의 무게. `STATUS_WEIGHT`에 없는 상태는 1 — 그대로 센다. */
export function taskWeight(task: Task): number {
  const status = task.status?.trim();
  return (status ? STATUS_WEIGHT[status] : undefined) ?? 1;
}

export interface ClassifiedTask {
  task: Task;
  category: TaskCategory;
  /** 셀 때의 무게. 상태가 `피드백`·`보류`면 1보다 작다 (`STATUS_WEIGHT`). */
  weight: number;
  /** 완료 판정 결과. `normal`에 섞여 있어도 이 플래그로 걸러낼 수 있다. */
  done: boolean;
  /** 마감 순간(epoch ms). 날짜만 있으면 그날 끝. 없으면 null. */
  deadlineMs: number | null;
  /** 지연 일수(KST 달력 기준). 미지연이면 0. */
  overdueDays: number;
  /** 마감까지 남은 일수. 지났으면 음수, 마감 없으면 null. */
  daysUntilDue: number | null;
  /** 마지막 활동 이후 경과 일수. 활동 기록 없으면 null. */
  daysSinceActivity: number | null;
}

export interface ClassifyResult {
  imminent: ClassifiedTask[];
  overdueActive: ClassifiedTask[];
  overdueStale: ClassifiedTask[];
  normal: ClassifiedTask[];
  counts: Record<TaskCategory, number>;
}

/** 완료 판정: 명시 플래그 > 진행률 100 > 상태 라벨. */
export function isTaskDone(task: Task, doneStatuses = CLASSIFY_DEFAULTS.doneStatuses): boolean {
  if (typeof task.done === 'boolean') return task.done;
  if (typeof task.progress === 'number' && task.progress >= 100) return true;
  const status = task.status?.trim().toLowerCase();
  if (!status) return false;
  return doneStatuses.some((s) => s.trim().toLowerCase() === status);
}

/**
 * 업무를 임박 / 밀림 / 방치 / 그 외로 나눈다.
 *
 * 판정 순서(먼저 걸리는 쪽이 이긴다):
 *  1. 완료 → `normal` (`done: true`). 액션 대상이 아니다.
 *  2. 마감 없음 → `normal`. 마감이 없으면 지연도 임박도 정의되지 않는다.
 *  3. 마감 지남 → 최근 `staleDays`일 내 활동이 있으면 `overdueActive`, 아니면 `overdueStale`.
 *     활동 기록 자체가 없으면 `overdueStale`(활동 증거 없음 = 방치).
 *  4. 마감이 `imminentDays`일 이내(오늘 마감 포함) → `imminent`.
 *  5. 나머지 → `normal`.
 *
 * 날짜만 있는 마감(`YYYYMMDD`)은 그날 23:59:59.999 KST까지 유효하다. 오늘 마감은 지연이 아니라 임박.
 * 경계는 모두 포함(<=): 정확히 30일 전 활동은 active, 정확히 7일 뒤 마감은 imminent.
 *
 * 상태 `피드백`·`보류`는 분류를 바꾸지 않고 `weight`만 낮게 받는다 (`STATUS_WEIGHT`).
 */
export function classifyTasks(
  tasks: readonly Task[],
  now: NowInput,
  opts: ClassifyOptions = {},
): ClassifyResult {
  const { imminentDays, staleDays, doneStatuses } = { ...CLASSIFY_DEFAULTS, ...opts };
  const nowMs = toEpochMs(now);
  const nowDay = kstDayIndex(nowMs);

  const result: ClassifyResult = {
    imminent: [],
    overdueActive: [],
    overdueStale: [],
    normal: [],
    counts: { imminent: 0, overdueActive: 0, overdueStale: 0, normal: 0 },
  };

  for (const task of tasks) {
    const done = isTaskDone(task, doneStatuses);
    const deadlineMs = parseFlowDeadline(task.due);
    const activityMs = parseFlowDate(task.lastActivityAt);
    const daysSinceActivity = activityMs == null ? null : diffDays(activityMs, nowMs);
    const overdue = !done && deadlineMs != null && deadlineMs < nowMs;
    const dueDay = deadlineMs == null ? null : kstDayIndex(deadlineMs);

    let category: TaskCategory;
    if (done || deadlineMs == null) {
      category = 'normal';
    } else if (overdue) {
      category =
        daysSinceActivity != null && daysSinceActivity <= staleDays
          ? 'overdueActive'
          : 'overdueStale';
    } else if (dueDay! <= nowDay + imminentDays) {
      category = 'imminent';
    } else {
      category = 'normal';
    }

    const entry: ClassifiedTask = {
      task,
      category,
      weight: taskWeight(task),
      done,
      deadlineMs,
      overdueDays: overdue ? nowDay - dueDay! : 0,
      daysUntilDue: dueDay == null ? null : dueDay - nowDay,
      daysSinceActivity,
    };
    result[category].push(entry);
    result.counts[category] += 1;
  }

  // 밀림/방치는 지연이 큰 순, 임박은 마감이 급한 순 (PRD §6.1 "지연 일수 내림차순").
  //
  // 밀림만 무게를 곱한다 — 피드백·보류가 지연 일수만으로 맨 위를 차지하면 정작 지금 밀고 있는
  // 업무가 아래로 내려간다. 곱셈이라 오래 밀린 피드백은 여전히 갓 밀린 진행보다 위에 선다.
  // 표에 나오는 `D+N`은 그대로 실제 지연이다 — 무게는 순서만 정한다.
  const byWeightedDelay = (c: ClassifiedTask) => c.overdueDays * c.weight;
  result.overdueActive.sort(
    (a, b) => byWeightedDelay(b) - byWeightedDelay(a) || b.overdueDays - a.overdueDays,
  );
  result.overdueStale.sort((a, b) => b.overdueDays - a.overdueDays);
  result.imminent.sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0));

  return result;
}
