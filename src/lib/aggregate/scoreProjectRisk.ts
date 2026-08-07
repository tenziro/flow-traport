/**
 * 프로젝트 위험도 (PRD §6.2).
 *
 * 위험 점수 = 밀림 건수(가중 최대) + 임박 건수 + 최장 지연 일수 + 최근 활동량.
 * 건수와 지연에는 상태 무게를 곱한다 — `피드백`·`보류`는 한 건을 작게 센다 (`STATUS_WEIGHT`).
 *
 * 실측 분포: 참여 프로젝트 59개 중 밀림 11건이 전부 하나(`[비즈플레이]B2603-삼성전기-출장예약 구축`)에
 * 몰려 있고 나머지 58개는 0건이다. 59개를 나열하는 화면은 소음이므로 순위를 매긴다.
 */

import { classifyTasks } from './classifyTasks';
import type { ClassifiedTask, ClassifyOptions } from './classifyTasks';
import { diffDays, parseFlowDate, toEpochMs } from './date';
import type { NowInput } from './date';
import type { Project } from './types';

/**
 * 신호별 단위 배점과 상한. 상한은 한 신호가 순위를 독점하는 걸 막는다.
 *
 * "1건당"의 건수는 **무게를 곱한 건수**다 — 상태가 `피드백`·`보류`인 업무는 1건을 0.4·0.2건으로
 * 센다 (`STATUS_WEIGHT`). 마감이 지난 게 지금 밀리고 있다는 뜻이 아닌 상태들이다.
 */
export const RISK_WEIGHTS = {
  /** 밀림 1건당. 압도적 최대 — 실제로 리스크는 여기서만 나온다. */
  overdueActive: { per: 10, cap: 12 },
  /** 임박 1건당. 아직 늦지 않았으므로 밀림의 1/3 이하. */
  imminent: { per: 3, cap: 10 },
  /** 최장 지연 1일당. 24일 지연 = 12점 ≈ 밀림 1건 조금 넘는 무게. */
  maxDelayDays: { per: 0.5, cap: 60 },
  /** 최근 활동 태스크 1건당. 사실상 동점 tiebreaker (최대 4점). */
  recentActivity: { per: 0.2, cap: 20 },
} as const;

/** 등급 하한. 밀림 1건 = 10점(주의), 밀림 2건 + 약간의 지연 = 위험. */
export const RISK_THRESHOLDS = { danger: 25, warning: 8 } as const;

export type RiskGrade = 'danger' | 'warning' | 'normal';

export const RISK_GRADE_LABEL: Record<RiskGrade, string> = {
  danger: '위험',
  warning: '주의',
  normal: '정상',
};

export interface ProjectRiskOptions extends ClassifyOptions {
  /** "최근 활동량"의 최근 기준. 기본 7일. */
  activityWindowDays?: number;
}

export interface ProjectRisk {
  project: Project;
  score: number;
  grade: RiskGrade;
  /** 밀림 건수. **무게를 안 곱한 실제 건수다** — 점수만 무게를 쓰고 표시는 사실을 낸다. */
  overdueActive: number;
  /** 방치 건수. 표시는 하되 점수에는 넣지 않는다 — 죽은 업무가 순위를 밀어올리면 안 된다. */
  overdueStale: number;
  imminent: number;
  /** 밀림 업무 중 최장 지연 일수. 밀림이 없으면 0. */
  maxDelayDays: number;
  /** 최근 activityWindowDays일 내 활동이 있은 업무 수. */
  recentActivity: number;
  /** 카드 펼침용 — 지연 큰 순. */
  tasks: ClassifiedTask[];
}

const capped = (value: number, w: { per: number; cap: number }) => Math.min(value, w.cap) * w.per;

/** 건수를 무게로 센다 — 피드백·보류는 한 건이 1건보다 적다 (`STATUS_WEIGHT`). */
const weigh = (tasks: readonly ClassifiedTask[]) => tasks.reduce((sum, t) => sum + t.weight, 0);

export function gradeOf(score: number): RiskGrade {
  if (score >= RISK_THRESHOLDS.danger) return 'danger';
  if (score >= RISK_THRESHOLDS.warning) return 'warning';
  return 'normal';
}

/** 프로젝트를 위험 점수 내림차순으로 정렬해 반환한다. */
export function scoreProjectRisk(
  projects: readonly Project[],
  now: NowInput,
  opts: ProjectRiskOptions = {},
): ProjectRisk[] {
  const { activityWindowDays = 7, ...classifyOpts } = opts;
  const nowMs = toEpochMs(now);

  return projects
    .map((project): ProjectRisk => {
      const c = classifyTasks(project.tasks, nowMs, classifyOpts);
      const maxDelayDays = c.overdueActive.reduce((max, t) => Math.max(max, t.overdueDays), 0);
      // 화면에 내는 `maxDelayDays`는 실제 최장 지연 그대로 두고, 점수만 무게를 곱한 값으로
      // 센다 — 피드백 하나가 24일 밀렸다고 위험 등급이 되면 안 되지만, 24일이라고 적는 건 사실이다.
      const scoredDelay = c.overdueActive.reduce(
        (max, t) => Math.max(max, t.overdueDays * t.weight),
        0,
      );
      const recentActivity = project.tasks.filter((t) => {
        const ms = parseFlowDate(t.lastActivityAt);
        return ms != null && diffDays(ms, nowMs) <= activityWindowDays;
      }).length;

      const score =
        Math.round(
          (capped(weigh(c.overdueActive), RISK_WEIGHTS.overdueActive) +
            capped(weigh(c.imminent), RISK_WEIGHTS.imminent) +
            capped(scoredDelay, RISK_WEIGHTS.maxDelayDays) +
            capped(recentActivity, RISK_WEIGHTS.recentActivity)) *
            10,
        ) / 10;

      return {
        project,
        score,
        grade: gradeOf(score),
        overdueActive: c.counts.overdueActive,
        overdueStale: c.counts.overdueStale,
        imminent: c.counts.imminent,
        maxDelayDays,
        recentActivity,
        tasks: [...c.overdueActive, ...c.imminent, ...c.overdueStale],
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.overdueActive - a.overdueActive ||
        a.project.name.localeCompare(b.project.name),
    );
}
