import { CollectNotice } from '@/components/collect-notice';
import { DeptTabs } from '@/components/dept-tabs';
import { EmptyState } from '@/components/empty-state';
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
import { TaskTable } from '@/components/task-table';
import { WhenOpen } from '@/components/when-open';
import { Card, CardContent } from '@/components/ui/card';
import { RISK_GRADE_LABEL, type ProjectRollup } from '@/lib/aggregate';
import { loadRisk } from '@/lib/flow/queries';
import { cn } from '@/lib/utils';

export const metadata = { title: '리스크 · flow Cockpit' };

/**
 * 쓰기 액션이 다시 그릴 경로. **쿼리스트링은 붙이지 않는다** — `revalidatePath`는 받은
 * 문자열을 경로로만 보고 `?dept=…`가 붙으면 맞는 항목이 없어서 캐시를 하나도 안 비운다
 * (BUG-036). 부서는 URL에 그대로 있어서 다시 그려도 보고 있던 부서가 유지된다.
 */
const PATH = '/risk';

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
  const { dept, divisions, rollups, unresolved, truncated, failed } =
    await loadRisk(picked);

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
      <header className="rise mb-6">
        <h1 className="text-xl font-semibold tracking-tight">리스크</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {dept}이 물고 있는 프로젝트를 위험도순으로 세웠어요. 목록이 아니라
          순위예요.
        </p>
      </header>

      <DeptTabs base="/risk" divisions={divisions} current={dept} />

      <section
        aria-label="부서 요약"
        className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        <Kpi
          i={1}
          label="프로젝트"
          value={rollups.length}
          unit="개"
          Icon={IconProject}
          tone="primary"
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
            <RollupCard key={rollup.name} rollup={rollup} top={top} i={6 + i} />
          ))}
        </div>
      )}

      {/*
       * 잠잠한 쪽은 카드 밖이다 — 여는 줄에 면을 깔면 그 자체가 카드로 보여서 위험
       * 카드들과 같은 무게가 된다. 맨바닥의 한 줄로 두고, 펼치면 그때 카드가 나온다.
       *
       * 안쪽 카드도 각자 `<details>`라 group에 이름을 붙인다 — 이름 없는 `group`은 가장
       * 가까운 것만 잡지 않아서 바깥이 열리면 안쪽 셰브론까지 같이 돌아간다.
       */}
      {rollups.length > 0 && calm.length > 0 && (
        <details
          className="disclose rise group/calm mt-4"
          style={{ '--i': 6 + risky.length } as React.CSSProperties}
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            잠잠한 프로젝트 {calm.length}개도 볼까요?
            <IconChevronDown
              size={14}
              className="shrink-0 transition-transform duration-300 group-open/calm:rotate-180"
            />
          </summary>
          <div className="mt-4 space-y-4">
            {calm.map((rollup) => (
              <RollupCard key={rollup.name} rollup={rollup} top={top} />
            ))}
          </div>
        </details>
      )}

      {unresolved > 0 && (
        <p className="mt-6 text-xs text-muted-foreground">
          프로젝트 {unresolved}개는 flow에서 이름을 찾지 못해 상태 변경과 댓글을
          막아뒀어요.
        </p>
      )}

      {/* 위 등급 분포와 점수는 가져온 것만 센 값이다 — 못 가져온 프로젝트를 밝혀야
          "위험 0개"가 진짜 0개인지 알 수 있다 */}
      <CollectNotice truncated={truncated} failed={failed} />
    </>
  );
}

function RollupCard({
  rollup,
  top,
  i,
}: {
  rollup: ProjectRollup;
  /** 1위 점수. 점수 절대값은 의미가 없어서 1위 대비 길이로만 쓴다. */
  top: number;
  /** 등장 순서. 접혀 있는 잠잠한 쪽은 안 준다 — 펼칠 때 한 번에 나온다. */
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
            <span className="min-w-0 flex-1">
              {/* 베이스라인이 아니라 가운데로 맞춘다. 등급 라벨(12px)과 프로젝트명(16px)을
                같은 베이스라인에 세우면 크기 차이만큼 작은 쪽이 위로 뜬다 — 두 글자의
                한가운데끼리 만나야 한 덩어리로 읽힌다. 줄바꿈되는 폭에서는 각 줄 안에서
                가운데라 좁은 화면도 그대로 맞는다 */}
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={cn('text-xs font-semibold', grade.text)}>
                  {/* 점은 등급 글자 **안에** 둔다. 형제로 빼면 줄 전체를 기준으로 서서
                    옆의 프로젝트명(16px)이 정한 줄 높이를 따라가고, 12px짜리 등급 글자와는
                    어긋난다. 글자 안에서는 기본 정렬(베이스라인)이 곧 글자 한가운데다 —
                    8px 점의 아래가 베이스라인에 닿으면 점 중심이 「위험」 글자 중심과
                    0.4px 안에서 만난다 (`align-middle`은 라틴 x-height 기준이라 오히려
                    1.6px 내려간다). */}
                  <span
                    className={cn(
                      'mr-3 inline-block size-2 rounded-full',
                      grade.dot,
                    )}
                  />
                  {RISK_GRADE_LABEL[rollup.grade]}
                </span>
                {/* 카드의 제목이라 본문(14px)보다 한 급 크다 — `내 업무`의 프로젝트 카드
                  제목과 같은 크기다. 한 줄에서 자르는 건 그대로다: 긴 이름이 두세 줄로
                  흘러 등급 점과 오른쪽 건수 사이가 벌어졌다 */}
                <span className="min-w-0 flex-1 basis-full truncate text-base font-bold sm:basis-auto">
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

          {/* 카드가 이미 한 프로젝트라 프로젝트 칸을 끄고, 그 자리에 담당자를 세운다 —
            여기는 남의 업무가 섞여 있어서 누구 것인지가 정보다.
            급함은 마감일 칸의 D+/D- 배지가 말한다 (밀림/임박 아이콘이 하던 일이다) */}
          <div className="mt-3 border-t border-border pt-3">
            {/* 카드를 펼쳐야 표를 만든다 (BUG-045) — 내 업무 화면과 같은 이유다 */}
            <WhenOpen>
              <TaskTable
                rows={rollup.tasks.map((task) => ({
                  ...task,
                  projectId: rollup.projectId,
                }))}
                path={PATH}
                showProject={false}
                showOwner
                emptyState="밀리거나 임박한 업무가 없어요"
              />
            </WhenOpen>
          </div>

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
                path={PATH}
              />
            </>
          )}
        </details>
      </CardContent>
    </Card>
  );
}
