/**
 * 부서 스탠드업 → 프로젝트 위험도 롤업 (PRD §6.2).
 *
 * 팀 화면이 이미 부서원 전원의 업무를 받아 두었다 (`loadTeam`). 그걸 프로젝트 이름으로 다시
 * 묶으면 순위표가 나온다 — 리스크 화면이 프로젝트를 따로 조회하지 않는 이유다.
 *
 * 범위는 "선택한 부서가 담당한 업무"다. 회사 전체 프로젝트 리스크가 아니다.
 * 실무에서 필요한 건 어차피 우리 팀이 물고 있는 리스크라 이 범위를 v1 기준으로 잡는다.
 */

import { RISK_WEIGHTS, gradeOf, type RiskGrade } from './scoreProjectRisk';

/** 스탠드업/워크리스트가 주는 업무 1건. 두 도구의 응답 형태가 같다. */
export interface StandupTask {
  taskSrno: number;
  title: string;
  /** flow 커스텀 상태 라벨 ("진행", "피드백" 등). */
  status: string;
  /** 프로젝트 이름. 스탠드업은 projectId를 주지 않는다 — 이름으로 해소한다. */
  project: string;
  /** YYYYMMDD */
  endDate: string;
  /** 음수면 지남 */
  daysLeft: number;
  link: string;
}

export interface StandupMember {
  name: string;
  role: string;
  imminent: StandupTask[];
  blocked: StandupTask[];
  /** 방치(30일 무활동) 건수. 목록은 주지 않는다. */
  staleCount: number;
}

export interface RiskTask extends StandupTask {
  /** 담당자 이름. 스탠드업이 멤버별로 주므로 여기서 붙인다. */
  owner: string;
  kind: 'imminent' | 'blocked';
}

export interface ProjectRollup {
  name: string;
  /** 프로젝트 목록에서 이름으로 해소한 값. 못 찾으면 null → 쓰기 액션을 감춘다. */
  projectId: string | null;
  score: number;
  grade: RiskGrade;
  imminent: number;
  blocked: number;
  /** 밀림 업무 중 최장 지연 일수. 밀림이 없으면 0. */
  maxDelayDays: number;
  /** 이 프로젝트에 걸린 부서원 이름. */
  owners: string[];
  /** 지연 큰 순 → 마감 가까운 순. */
  tasks: RiskTask[];
}

const capped = (value: number, w: { per: number; cap: number }) => Math.min(value, w.cap) * w.per;

/**
 * 멤버별 업무를 프로젝트 단위로 묶어 위험 점수 내림차순으로 반환한다.
 *
 * 점수는 `RISK_WEIGHTS`를 그대로 쓰되 `recentActivity` 항은 뺀다 —
 * 스탠드업 응답에 마지막 활동 시각이 없다. 어차피 동점 tiebreaker였다.
 */
export function rollupProjects(
  members: readonly StandupMember[],
  projectIdByName: ReadonlyMap<string, string> = new Map(),
): ProjectRollup[] {
  const byProject = new Map<string, RiskTask[]>();

  for (const member of members) {
    const push = (task: StandupTask, kind: RiskTask['kind']) => {
      const list = byProject.get(task.project) ?? [];
      list.push({ ...task, owner: member.name, kind });
      byProject.set(task.project, list);
    };
    for (const task of member.blocked) push(task, 'blocked');
    for (const task of member.imminent) push(task, 'imminent');
  }

  return [...byProject.entries()]
    .map(([name, tasks]): ProjectRollup => {
      const blocked = tasks.filter((t) => t.kind === 'blocked').length;
      const imminent = tasks.length - blocked;
      const maxDelayDays = tasks.reduce((max, t) => Math.max(max, -t.daysLeft), 0);
      const score =
        Math.round(
          (capped(blocked, RISK_WEIGHTS.overdueActive) +
            capped(imminent, RISK_WEIGHTS.imminent) +
            capped(maxDelayDays, RISK_WEIGHTS.maxDelayDays)) *
            10,
        ) / 10;

      return {
        name,
        projectId: projectIdByName.get(name) ?? null,
        score,
        grade: gradeOf(score),
        imminent,
        blocked,
        maxDelayDays,
        owners: [...new Set(tasks.map((t) => t.owner))].sort((a, b) => a.localeCompare(b)),
        tasks: tasks.sort((a, b) => a.daysLeft - b.daysLeft || a.title.localeCompare(b.title)),
      };
    })
    .sort((a, b) => b.score - a.score || b.blocked - a.blocked || a.name.localeCompare(b.name));
}
