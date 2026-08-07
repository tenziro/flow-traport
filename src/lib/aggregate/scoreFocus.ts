/**
 * 오늘의 포커스 스코어링 (PRD §6.1.3).
 *
 * 가중 신호: 마감 긴박도 · 최근 멘션/댓글 수(열기) · 우선순위 · 진행률(마무리각).
 * 가중치는 아래 상수 하나가 전부다. 사용자 설정 UI는 만들지 않는다 (§12 Q5).
 */

import { classifyTasks } from './classifyTasks';
import type { ClassifiedTask, ClassifyOptions } from './classifyTasks';
import { toEpochMs } from './date';
import type { NowInput } from './date';
import type { Task, TaskPriority } from './types';

/** 각 신호를 0~1로 정규화한 뒤 곱하는 배점. 합 = 100점 만점. */
export const FOCUS_WEIGHTS = {
  /** 마감 긴박도 — 무엇을 먼저 하냐는 결국 마감이 정한다. 최대 배점. */
  deadline: 40,
  /** 열기(최근 멘션/댓글) — 사람이 기다리고 있다는 뜻이라 마감 다음으로 세다. */
  heat: 25,
  /** 우선순위 — 사람이 붙인 라벨. 신호이긴 하나 관리가 잘 안 되므로 중간. */
  priority: 20,
  /** 진행률 — 마무리각. 순위를 뒤집기보다 동점을 가르는 역할이라 가장 낮다. */
  progress: 15,
} as const;

/** 멘션이 이 수를 넘어가면 더 급해지지 않는다 — 한 태스크가 목록을 독점하는 걸 막는다. */
export const HEAT_CAP = 5;

/** 지연이 이 일수를 넘으면 긴박도는 더 오르지 않는다(이미 최대치). */
export const OVERDUE_SATURATION_DAYS = 3;

const PRIORITY_SCORE: Record<TaskPriority, number> = {
  urgent: 1,
  high: 0.66,
  normal: 0.33,
  low: 0,
};

/** 태스크 id → 최근 멘션/댓글 건수. `groupMentions()` 결과로 만들면 된다. */
export type FocusSignals = Record<string, number> | Map<string, number>;

export interface FocusOptions extends ClassifyOptions {
  /** 상위 N개. 기본 5 — 실제 화면은 `FOCUS_CHECK`를 넘겨 쓴다 (PRD §6.1). */
  limit?: number;
}

export interface FocusItem {
  task: Task;
  /** 0~100. */
  score: number;
  /** 사람이 읽을 수 있는 추천 이유. 실제로 점수에 기여한 신호만. */
  reasons: string[];
  /** 점수 산출에 쓴 분류 결과 — UI가 배지를 그릴 때 재계산하지 않도록. */
  classified: ClassifiedTask;
  /** 신호별 기여 점수(디버깅·툴팁용). */
  breakdown: Record<keyof typeof FOCUS_WEIGHTS, number>;
}

const readSignal = (signals: FocusSignals, id: string): number =>
  (signals instanceof Map ? signals.get(id) : signals[id]) ?? 0;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 지금 손대야 할 업무 상위 N개를 점수 + 추천 이유와 함께 반환한다.
 *
 * 후보에서 빼는 것:
 *  - 완료된 업무
 *  - 방치(overdueStale) — 30일간 아무도 안 건드린 업무를 오늘의 포커스에 올리면
 *    액션 리스트가 죽은 업무로 오염된다. 방치 목록은 별도 접힌 블록에서 다룬다 (PRD §6.1).
 *
 * `피드백`·`보류`는 **빼지 않고 마감 점수만 깎는다** (`STATUS_WEIGHT`). 빼면 마감이 한참 지난
 * 피드백 업무가 아무 화면에도 안 나온다. 순위만 내리면 오늘 할 일이 위에 서고 그것들은 아래에
 * 남는다. 피드백 중에서도 **마지막 댓글이 내 것인 업무**는 여기서가 아니라 호출부에서
 * 내려간다 — 댓글 조회가 필요해서다 (`queries.ts` `pickFocus`).
 */
export function scoreFocus(
  tasks: readonly Task[],
  signals: FocusSignals,
  now: NowInput,
  opts: FocusOptions = {},
): FocusItem[] {
  const { limit = 5, ...classifyOpts } = opts;
  const nowMs = toEpochMs(now);
  const horizon = classifyOpts.imminentDays ?? 7;
  const classified = classifyTasks(tasks, nowMs, classifyOpts);

  const candidates = [
    ...classified.overdueActive,
    ...classified.imminent,
    ...classified.normal.filter((c) => !c.done),
  ];

  return candidates
    .map((c): FocusItem => {
      const { task, overdueDays, daysUntilDue } = c;
      const reasons: string[] = [];

      // 1. 마감 긴박도
      let deadline = 0;
      if (c.category === 'overdueActive') {
        deadline = Math.min(1, 0.7 + (0.3 * Math.min(overdueDays, OVERDUE_SATURATION_DAYS)) / OVERDUE_SATURATION_DAYS);
        reasons.push(`마감 ${overdueDays}일 지남`);
      } else if (daysUntilDue != null && daysUntilDue >= 0) {
        deadline = Math.max(0, 1 - daysUntilDue / (horizon + 1));
        if (daysUntilDue === 0) reasons.push('오늘 마감');
        else if (deadline > 0) reasons.push(`마감 ${daysUntilDue}일 남음`);
      }

      // 피드백·보류는 마감을 덜 세게 본다 — 마감이 지난 게 내가 늦어서가 아니다. 깎는 건
      // 마감 하나뿐이다: 열기(사람이 묻고 있다)와 우선순위는 상태와 무관하게 그대로 유효하다.
      if (c.weight < 1 && deadline > 0) {
        deadline *= c.weight;
        reasons.push(`${task.status} 상태 — 마감을 ${Math.round(c.weight * 100)}%만 센다`);
      }

      // 2. 열기 — 나를 기다리는 사람 수
      const mentions = readSignal(signals, task.id);
      const heat = Math.min(mentions, HEAT_CAP) / HEAT_CAP;
      if (mentions > 0) reasons.push(`최근 멘션/댓글 ${mentions}건`);

      // 3. 우선순위
      const priority = PRIORITY_SCORE[task.priority ?? 'normal'] ?? PRIORITY_SCORE.normal;
      if (task.priority === 'urgent') reasons.push('우선순위 긴급');
      else if (task.priority === 'high') reasons.push('우선순위 높음');

      // 4. 마무리각
      const pct = typeof task.progress === 'number' ? Math.min(Math.max(task.progress, 0), 100) : 0;
      const progress = pct / 100;
      if (pct >= 70) reasons.push(`진행률 ${pct}% — 마무리 단계`);

      const breakdown = {
        deadline: deadline * FOCUS_WEIGHTS.deadline,
        heat: heat * FOCUS_WEIGHTS.heat,
        priority: priority * FOCUS_WEIGHTS.priority,
        progress: progress * FOCUS_WEIGHTS.progress,
      };
      const score = round1(
        breakdown.deadline + breakdown.heat + breakdown.priority + breakdown.progress,
      );

      return {
        task,
        score,
        reasons: reasons.length ? reasons : ['진행 중'],
        classified: c,
        breakdown: {
          deadline: round1(breakdown.deadline),
          heat: round1(breakdown.heat),
          priority: round1(breakdown.priority),
          progress: round1(breakdown.progress),
        },
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.classified.deadlineMs ?? Infinity) - (b.classified.deadlineMs ?? Infinity) ||
        a.task.id.localeCompare(b.task.id),
    )
    .slice(0, limit);
}
