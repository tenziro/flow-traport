import { CopyButton } from '@/components/copy-button';
import { DeptTabs } from '@/components/dept-tabs';
import { EmptyState } from '@/components/empty-state';
import {
  IconCalendar,
  IconImminent,
  IconRisk,
  IconStale,
  IconTeam,
} from '@/components/icons';
import { Kpi } from '@/components/kpi';
import { Meter } from '@/components/meter';
import { TaskItem } from '@/components/task-item';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StandupMember, StandupTask } from '@/lib/aggregate';
import type { FlowEvent } from '@/lib/flow/rest';
import { loadTeam } from '@/lib/flow/queries';
import { fmtTime } from '@/lib/utils';

export const metadata = { title: '팀 · flow Cockpit' };

/** 급한 것만 센다. 방치는 목록이 없어서(건수만 온다) 부하 비교에 넣지 않는다. */
const urgent = (m: StandupMember) => m.blocked.length + m.imminent.length;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>;
}) {
  const { dept: picked } = await searchParams;
  const { dept, divisions, standup, projectIds, events } = await loadTeam(picked);
  const { counts, members } = standup;
  /** 스탠드업은 projectId를 안 준다 — 프로젝트 이름으로 해소한다 (queries.ts). */
  const idOf = (project: string) => projectIds.get(project) ?? null;
  /** 쓰기 액션 후 지금 보고 있는 부서로 되돌아와야 한다. */
  const path = `/team?dept=${encodeURIComponent(dept)}`;

  /**
   * 많이 물고 있는 사람부터. flow가 주는 순서는 조직도 순이라 "누가 막혀 있나"를
   * 찾으려면 카드를 다 읽어야 했다 — 관리자 화면에서는 정렬이 곧 답이다.
   * 밀림이 같으면 임박이 많은 쪽, 그다음 방치가 많은 쪽.
   */
  const ranked = [...members].sort(
    (a, b) =>
      b.blocked.length - a.blocked.length ||
      b.imminent.length - a.imminent.length ||
      b.staleCount - a.staleCount,
  );
  /** 부하 막대의 분모. 팀에서 가장 많이 물고 있는 사람이 100%다. */
  const peak = Math.max(...ranked.map(urgent), 1);
  const stale = members.reduce((sum, m) => sum + m.staleCount, 0);

  return (
    <>
      <header className="rise mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">팀</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {dept} · 많이 물고 있는 사람부터 세웠어요. 누가 무엇에 막혀 있는지
            보여줘요.
          </p>
        </div>
        <CopyButton text={toMarkdown(dept, ranked)} label="마크다운으로 복사" />
      </header>

      <DeptTabs base="/team" divisions={divisions} current={dept} />

      <section
        aria-label="부서 요약"
        className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        <Kpi
          i={1}
          label="인원"
          value={counts.members}
          unit="명"
          Icon={IconTeam}
        />
        <Kpi
          i={2}
          label="밀리는 업무"
          value={counts.blocked}
          unit="건"
          Icon={IconRisk}
          tone="danger"
          note={
            ranked[0] && ranked[0].blocked.length > 0
              ? `최다 ${ranked[0].name}`
              : undefined
          }
        />
        <Kpi
          i={3}
          label="마감 임박"
          value={counts.imminent}
          unit="건"
          Icon={IconImminent}
          tone="warning"
          note="7일 안에 마감해요"
        />
        <Kpi
          i={4}
          label="방치된 업무"
          value={stale}
          unit="건"
          Icon={IconStale}
          tone="neutral"
          note="30일 넘게 손 안 댄 업무예요"
        />
      </section>

      {/*
       * 3단까지만. 업무 줄이 오늘 화면과 같은 `TaskItem`이 되면서 한 줄에 상태 배지·
       * 프로젝트·flow 링크·액션이 다 들어간다 — 4단으로 쪼개면 그게 줄줄이 접힌다.
       */}
      {/* `grid-cols-1` — 안 적으면 좁은 화면 열이 `auto`라 카드가 내용 최소폭 아래로
          안 줄어든다 (bug-report BUG-025) */}
      <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-3">
        {ranked.map((member, i) => (
          <MemberCard
            key={member.name}
            member={member}
            peak={peak}
            i={5 + i}
            idOf={idOf}
            path={path}
            events={events.get(member.name) ?? []}
          />
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        &lsquo;어제 끝낸 일&rsquo;은 아직 없어요. 지금 막힌 것과 곧 마감할 것만
        모았어요.
      </p>
    </>
  );
}

function MemberCard({
  member,
  peak,
  i,
  idOf,
  path,
  events,
}: {
  member: StandupMember;
  /** 팀 최대 부하. 막대를 이 값 기준으로 그려야 사람끼리 비교가 된다. */
  peak: number;
  i: number;
  idOf: (project: string) => string | null;
  path: string;
  /**
   * 오늘 일정 (PRD §13 B3). 비어 있을 수 있는 이유가 둘이다 — 일정이 없거나, 이름으로
   * 사번을 못 찾았거나. 그래서 "일정 없어요"라고 적지 않고 그냥 아무것도 안 그린다.
   */
  events: readonly FlowEvent[];
}) {
  /** 밀림 먼저, 그다음 임박. 마감 배지(D+/D-)가 이미 둘을 갈라 놓는다. */
  const tasks = [...member.blocked, ...member.imminent];
  const quiet = tasks.length === 0;

  return (
    <Card className="rise gap-2" style={{ '--i': i } as React.CSSProperties}>
      <CardHeader className="gap-1.5">
        <CardTitle className="flex flex-wrap items-baseline gap-x-2">
          {member.name}
          {member.role && (
            <span className="text-xs font-normal text-muted-foreground">
              {member.role}
            </span>
          )}
          {/* 아이콘 세 개가 뭘 세는지는 요약 카드에만 적혀 있어서 카드를 스크롤해 내려오면
              단서가 사라진다. `title`로 기준을 붙인다 — 화면 낭독은 `sr-only`가 맡는다.
              news-bell.tsx의 종 아이콘과 같은 방식이다. */}
          <span className="tabular ml-auto flex shrink-0 items-center gap-2.5 text-xs font-normal text-muted-foreground">
            <span
              className="flex items-center gap-1"
              title="밀리는 업무 — 마감이 지났어요"
            >
              <IconRisk size={12} className="text-danger" />
              <span className="sr-only">밀리는 업무 </span>
              {member.blocked.length}건
            </span>
            <span
              className="flex items-center gap-1"
              title="마감 임박 — 7일 안에 마감해요"
            >
              <IconImminent size={12} className="text-warning" />
              <span className="sr-only">마감 임박 </span>
              {member.imminent.length}건
            </span>
            {member.staleCount > 0 && (
              <span
                className="flex items-center gap-1"
                title="방치된 업무 — 30일 넘게 손 안 댔어요"
              >
                <IconStale size={12} />
                <span className="sr-only">방치된 업무 </span>
                {member.staleCount}건
              </span>
            )}
          </span>
        </CardTitle>
        {/* 부하 막대. 팀 최대 대비라서 카드를 나란히 놓으면 누가 몰려 있는지가 보인다 */}
        <Meter
          total={peak}
          segments={[
            {
              value: member.blocked.length,
              label: '밀림',
              className: 'bg-danger',
            },
            {
              value: member.imminent.length,
              label: '임박',
              className: 'bg-warning',
            },
          ]}
        />
        {/*
         * 오늘 일정은 업무가 아니라 "이 사람이 지금 자리에 있나"다. 그래서 업무 줄 위,
         * 부하 막대 바로 밑에 둔다 — 밀림 3건인 사람이 종일 외부 미팅이면 그게 먼저 읽혀야 한다.
         * 카드가 3분의 1 칸이라 일정 이름은 한 줄로 자른다.
         */}
        {events.length > 0 && (
          <ul className="space-y-0.5 border-t border-border/60 pt-1.5">
            {events.map((event) => (
              <li
                key={event.eventSrno}
                className="tabular flex items-start gap-1.5 text-xs"
              >
                <IconCalendar
                  size={12}
                  className="mt-0.5 shrink-0 text-primary"
                />
                <span className="shrink-0 text-muted-foreground">
                  {event.allDayYn === 'Y'
                    ? '종일'
                    : fmtTime(event.eventStartDateTime)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {event.eventName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardHeader>
      <CardContent className="space-y-0.5">
        {quiet ? (
          /*
           * 오늘 화면 빈 칸과 같은 모양으로 (empty-state.tsx). 왼쪽에 붙은 한 줄짜리
           * 문장은 그 위 업무 줄과 구분이 안 돼서 "이 사람은 비었다"가 늦게 읽혔다.
           * 방치가 남아 있으면 아이콘도 그쪽을 가리킨다 — 이 카드에 유일하게 남은 할 일이다.
           */
          <EmptyState
            icon={
              member.staleCount > 0 ? (
                <IconStale size={18} />
              ) : (
                <IconImminent size={18} />
              )
            }
            title="급한 업무가 없어요"
            /*
             * 설명은 늘 붙인다. 방치가 있는 카드에만 두 줄이고 없으면 한 줄이라, 카드를
             * 나란히 놓으면 빈 칸 높이가 서로 달라서 줄이 안 맞았다. 그리고 "급한"의
             * 기준(마감 지남·임박)이 요약 카드에만 적혀 있어서 여기서 한 번 더 말해 준다.
             */
            description={
              member.staleCount > 0
                ? `오래 방치된 업무 ${member.staleCount}건은 flow에서 확인해주세요.`
                : '맡은 업무가 모두 일정 안에 있어요.'
            }
          />
        ) : (
          <>
            {tasks.map((task) => (
              <div
                key={task.taskSrno}
                className="border-b border-border/60 last:border-0"
              >
                <TaskItem
                  task={task}
                  projectId={idOf(task.project)}
                  path={path}
                />
              </div>
            ))}
            {member.staleCount > 0 && (
              <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <IconStale size={12} />
                방치 {member.staleCount}건은 flow에서 확인해주세요.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** 주간회의에 그대로 붙여넣을 마크다운. 링크까지 넣어야 회의 중에 바로 열 수 있다. */
function toMarkdown(dept: string, members: readonly StandupMember[]): string {
  const lines = [`## ${dept} 현황`, ''];

  for (const m of members) {
    const bits = [`임박 ${m.imminent.length}`, `밀림 ${m.blocked.length}`];
    if (m.staleCount > 0) bits.push(`방치 ${m.staleCount}`);
    lines.push(`### ${m.name} (${bits.join(' · ')})`);

    if (m.blocked.length === 0 && m.imminent.length === 0) {
      lines.push('- 급한 업무 없음');
    } else {
      for (const t of m.blocked) lines.push(`- 🔴 ${line(t)}`);
      for (const t of m.imminent) lines.push(`- 🟡 ${line(t)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function line(task: StandupTask): string {
  const when =
    task.daysLeft < 0 ? `${-task.daysLeft}일 지남` : `${task.daysLeft}일 남음`;
  return `[${task.title}](${task.link}) — ${task.project} · ${when}`;
}
