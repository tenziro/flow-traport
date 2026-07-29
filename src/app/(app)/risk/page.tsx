import { DeptTabs } from '@/components/dept-tabs';
import { EmptyState } from '@/components/empty-state';
import { FlowLink } from '@/components/flow-link';
import {
  IconChevronDown,
  IconDelay,
  IconImminent,
  IconProject,
  IconRisk,
} from '@/components/icons';
import { Kpi } from '@/components/kpi';
import { Meter } from '@/components/meter';
import { NewTaskForm } from '@/components/new-task-form';
import { StaleScan } from '@/components/stale-scan';
import { StatHint } from '@/components/stat-hint';
import { StatusPill } from '@/components/status-pill';
import { TaskActions } from '@/components/task-actions';
import { Card, CardContent } from '@/components/ui/card';
import {
  RISK_GRADE_LABEL,
  type ProjectRollup,
  type RiskTask,
} from '@/lib/aggregate';
import { loadRisk } from '@/lib/flow/queries';
import { cn } from '@/lib/utils';

export const metadata = { title: '리스크 · flow Cockpit' };

/**
 * 위험도는 카드 테두리에 싣는다. `Card`가 이미 `ring-1`로 테두리를 그리므로
 * ring 색만 갈아끼운다 — 전에는 여기서 `border`를 덧대서 1px 간격으로 선이
 * 두 겹 보였다 (`cn`의 tailwind-merge가 ring 색 충돌을 정리해준다).
 */
const GRADE = {
  danger: {
    dot: 'bg-danger',
    text: 'text-danger-foreground',
    ring: 'ring-danger/40',
  },
  warning: {
    dot: 'bg-warning',
    text: 'text-warning-foreground',
    ring: 'ring-warning/30',
  },
  normal: {
    dot: 'bg-neutral',
    text: 'text-neutral-foreground',
    ring: 'ring-foreground/10',
  },
} as const;

export default async function RiskPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const { dept: picked } = await searchParams;
  const { dept, divisions, rollups, unresolved } = await loadRisk(picked);

  const risky = rollups.filter((r) => r.grade !== 'normal');
  const calm = rollups.filter((r) => r.grade === 'normal');

  /** 부서 전체 합계. 프로젝트 카드를 하나씩 세지 않고도 규모가 읽혀야 한다. */
  const blocked = rollups.reduce((sum, r) => sum + r.blocked, 0);
  const imminent = rollups.reduce((sum, r) => sum + r.imminent, 0);
  const worst = rollups.reduce((max, r) => Math.max(max, r.maxDelayDays), 0);
  /** 등급 분포. 위험 4개가 전체 4개인지 40개 중 4개인지가 막대로 읽힌다. */
  const grades = [
    {
      label: '위험',
      value: rollups.filter((r) => r.grade === 'danger').length,
      className: 'bg-danger',
    },
    {
      label: '주의',
      value: rollups.filter((r) => r.grade === 'warning').length,
      className: 'bg-warning',
    },
    { label: '잠잠', value: calm.length, className: 'bg-neutral' },
  ];
  /** 점수 막대의 분모. 1위 대비로 그려야 순위 간격이 보인다. */
  const top = rollups[0]?.score ?? 1;

  return (
    <>
      <header className="rise mb-4">
        <h1 className="text-xl font-semibold tracking-tight">리스크</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {dept}이 물고 있는 프로젝트를 위험도순으로 세웠어요. 목록이 아니라
          순위예요.
        </p>
      </header>

      <DeptTabs base="/risk" divisions={divisions} current={dept} />

      <section
        aria-label="부서 요약"
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <Kpi
          i={1}
          label="프로젝트"
          value={rollups.length}
          unit="개"
          Icon={IconProject}
          note={`위험·주의 ${risky.length}개`}
        />
        <Kpi
          i={2}
          label="밀리는 업무"
          value={blocked}
          unit="건"
          Icon={IconRisk}
          tone="danger"
          note="마감이 지났어요"
        />
        <Kpi
          i={3}
          label="마감 임박"
          value={imminent}
          unit="건"
          Icon={IconImminent}
          tone="warning"
          note="7일 안에 마감해요"
        />
        <Kpi
          i={4}
          label="최장 지연"
          value={worst}
          unit="일"
          Icon={IconDelay}
          tone={worst >= 8 ? 'danger' : 'neutral'}
          note={worst > 0 ? '가장 오래 밀린 업무예요' : '밀린 업무가 없어요'}
        />
      </section>

      {rollups.length === 0 ? (
        // 여기만 카드 밖이다 — `EmptyState`는 배경을 안 깔아서(카드 안 카드를 막느라)
        // 페이지 바닥에 그냥 두면 떠 보인다. 아래 롤업 카드와 같은 면을 준다.
        <Card className="rise" style={{ '--i': 5 } as React.CSSProperties}>
          <CardContent>
            <EmptyState
              icon={<IconRisk size={18} />}
              title="위험한 프로젝트가 없어요"
              description={`${dept}에 마감이 임박했거나 밀리는 업무가 잡혀 있지 않아요.`}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 등급 분포 한 줄. 카드를 다 세지 않아도 부서가 지금 어떤 상태인지 읽힌다 */}
          <div
            className="rise flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-card px-4 py-2.5 ring-1 ring-foreground/10"
            style={{ '--i': 5 } as React.CSSProperties}
          >
            <Meter
              segments={grades}
              className="h-1.5 min-w-40 flex-1 basis-full sm:basis-auto"
            />
            {grades.map((grade) => (
              <span
                key={grade.label}
                className="tabular flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  className={cn('size-1.5 rounded-full', grade.className)}
                />
                {grade.label} {grade.value}개
              </span>
            ))}
          </div>

          {risky.map((rollup, i) => (
            <RollupCard
              key={rollup.name}
              rollup={rollup}
              rank={i + 1}
              top={top}
              dept={dept}
              i={6 + i}
            />
          ))}

          {calm.length > 0 && (
            <details
              className="disclose rise group rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              style={{ '--i': 6 + risky.length } as React.CSSProperties}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground">
                잠잠한 프로젝트 {calm.length}개도 볼까요?
                <IconChevronDown
                  size={14}
                  className="shrink-0 transition-transform duration-300 group-open:rotate-180"
                />
              </summary>
              <div className="mt-3 space-y-2">
                {calm.map((rollup, i) => (
                  <RollupCard
                    key={rollup.name}
                    rollup={rollup}
                    rank={risky.length + i + 1}
                    top={top}
                    dept={dept}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {unresolved > 0 && (
        <p className="mt-6 text-xs text-muted-foreground">
          프로젝트 {unresolved}개는 flow에서 이름을 찾지 못해 상태 변경과 댓글을
          막아뒀어요.
        </p>
      )}
    </>
  );
}

function RollupCard({
  rollup,
  rank,
  top,
  dept,
  i,
}: {
  rollup: ProjectRollup;
  rank: number;
  /** 1위 점수. 점수 절대값은 의미가 없어서 1위 대비 길이로만 쓴다. */
  top: number;
  dept: string;
  i?: number;
}) {
  const grade = GRADE[rollup.grade];

  return (
    <Card
      className={cn('rise transition-shadow duration-300', grade.ring)}
      style={
        i === undefined ? undefined : ({ '--i': i } as React.CSSProperties)
      }
    >
      <CardContent>
        {/* 여닫는 움직임은 CSS다 (`disclose` — globals.css) */}
        <details className="disclose group">
          {/* 셰브론은 감싸는 행 밖에 둔다 — 안에 넣으면 flex-wrap이 접힐 때 같이 밀려 내려간다 */}
          <summary className="flex cursor-pointer list-none items-start gap-3">
            {/* 순위를 숫자로 박는다. 카드 순서만으로는 스크롤 중에 몇 번째인지 잃는다 */}
            <span className="tabular mt-0.5 w-5 shrink-0 text-right text-xs text-muted-foreground">
              {rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={cn(
                    'size-2 shrink-0 self-center rounded-full',
                    grade.dot,
                  )}
                />
                <span className={cn('text-xs font-semibold', grade.text)}>
                  {RISK_GRADE_LABEL[rollup.grade]}
                </span>
                <span className="min-w-0 flex-1 basis-full font-medium sm:basis-auto">
                  {rollup.name}
                </span>
                {/* 팀 화면 멤버 카드와 같은 줄이다 — 힌트 문구도 같이 맞춘다 */}
                <span className="tabular flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <StatHint hint="밀리는 업무 — 마감이 지났어요">
                    <span className="flex items-center gap-1">
                      <IconRisk size={12} className="text-danger" />
                      <span className="sr-only">밀리는 업무 </span>
                      {rollup.blocked}건
                    </span>
                  </StatHint>
                  <StatHint hint="마감 임박 — 7일 안에 마감해요">
                    <span className="flex items-center gap-1">
                      <IconImminent size={12} className="text-warning" />
                      <span className="sr-only">마감 임박 </span>
                      {rollup.imminent}건
                    </span>
                  </StatHint>
                  <span>
                    {rollup.maxDelayDays > 0
                      ? `최장 ${rollup.maxDelayDays}일`
                      : '지연 없음'}
                  </span>
                </span>
              </span>
              {/* 점수 막대 — 1위와 붙어 있는지, 혼자 튀는지가 등급 라벨로는 안 보인다 */}
              <Meter
                total={top}
                className="mt-1.5"
                segments={[
                  {
                    value: rollup.score,
                    label: `위험 점수 ${Math.round(rollup.score)}`,
                    className: grade.dot,
                  },
                ]}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                {rollup.owners.join(', ')}
              </span>
            </span>
            <IconChevronDown
              size={16}
              className="mt-0.5 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180"
            />
          </summary>

          <ul className="mt-3 space-y-3 border-t border-border pt-3">
            {rollup.tasks.map((task) => (
              <li key={task.taskSrno}>
                <TaskRow task={task} projectId={rollup.projectId} dept={dept} />
              </li>
            ))}
          </ul>

          {rollup.projectId && (
            <>
              {/*
               * 위 목록은 임박·밀림만이다. 마감이 한참 지난 채로 아무도 안 건드리는
               * 업무는 프로젝트를 직접 훑어야 나온다 (PRD §13 B5) — 눌러야 부른다.
               */}
              <StaleScan
                projectId={rollup.projectId}
                className="mt-3 border-t border-border pt-3"
              />
              <NewTaskForm
                projectId={rollup.projectId}
                project={rollup.name}
                path={`/risk?dept=${encodeURIComponent(dept)}`}
              />
            </>
          )}
        </details>
      </CardContent>
    </Card>
  );
}

function TaskRow({
  task,
  projectId,
  dept,
}: {
  task: RiskTask;
  projectId: string | null;
  dept: string;
}) {
  const late = task.daysLeft < 0;

  return (
    <div className="flex items-start gap-2">
      {/* 앞 칸 + 간격이 **32px**이어야 업무 제목이 헤더의 등급 점과 같은 x에서 시작한다
          (헤더는 순위 `w-5`(20) + `gap-3`(12)). 여기서는 `w-6`(24) + `gap-2`(8)로 쪼개
          아이콘을 칸 오른쪽에 붙였다 — 아이콘 앞에 10px가 들어가고 아이콘과 글자는 8px로
          붙어서, 아이콘이 제목에 딸린 표시로 읽힌다. */}
      <span className="flex w-6 shrink-0 justify-end">
        {late ? (
          <IconRisk size={14} className="mt-1 text-danger" />
        ) : (
          <IconImminent size={14} className="mt-1 text-warning" />
        )}
      </span>
      {/* 아이콘 오른쪽 한 열. 액션 폼까지 이 열 안에 둬야 제목과 왼쪽 끝이 맞는다 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {/* 굵기는 다른 화면의 업무 제목과 같은 semibold (task-item.tsx) */}
            <p className="text-sm font-semibold">{task.title}</p>
            {/* 상태는 글자 대신 배지로 — 한 줄에 이름·상태·기한이 다 있으면 상태가 안 읽힌다 */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusPill status={task.status} />
              <span className="tabular text-xs text-muted-foreground">
                {task.owner} ·{' '}
                {late
                  ? `${-task.daysLeft}일 지났어요`
                  : `${task.daysLeft}일 남았어요`}
              </span>
            </div>
          </div>
          <FlowLink href={task.link} className="shrink-0" />
        </div>
        <TaskActions
          projectId={projectId}
          taskId={task.taskSrno}
          title={task.title}
          status={task.status}
          path={`/risk?dept=${encodeURIComponent(dept)}`}
        />
      </div>
    </div>
  );
}
