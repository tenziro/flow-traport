import {
  IconFocus,
  IconImminent,
  IconMention,
  IconRisk,
  IconStale,
} from '@/components/icons';
import { KPI_TONE, type KpiTone } from '@/components/kpi';
import { MentionTable } from '@/components/mention-table';
import { Meter } from '@/components/meter';
import { NumberTicker } from '@/components/motion/number-ticker';
import { TaskTable } from '@/components/task-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { groupMentions } from '@/lib/aggregate';
import { loadToday } from '@/lib/flow/queries';
import { cn } from '@/lib/utils';

export const metadata = { title: '오늘 · flow Cockpit' };

/**
 * 배치:
 *
 * 1. KPI 4칸 — 건수 + 전체 점유율 막대. 숫자만 있으면 크고 작음이 안 읽힌다.
 * 2. 표 네 개를 한 단으로 쌓는다 — 급한 순서다: 포커스 → 밀리는 업무 → 나를 부른
 *    사람들 → 방치된 업무.
 *
 * 한때 4단이 더 있었다. "알고만 있으면 되는 것들" 자리로 업무 소식과 오늘 일정을 뒀는데,
 * 소식은 헤더 종으로(news-bell.tsx), 일정은 계정 팝오버의 서랍으로 올라갔다
 * (app-shell.tsx, v1.6.0). 둘 다 이 화면에서만 보이던 것이라 다른 화면에서는 없는
 * 기능이었다 — 셸로 올리니 어디서나 같은 자리에 있고, 이 화면은 챙길 일만 남는다.
 *
 * **8:4 2단을 접었다.** 업무를 표로 바꾸면서다 — 표는 칸 폭이 고정 비율이라 12칸 중 4칸에
 * 넣으면 다섯 칸이 다 눌려 업무명이 열 글자에서 잘린다. 한 단으로 쌓으니 어느 표든
 * 같은 폭이고, 급한 순서가 곧 읽는 순서가 된다.
 *
 * 업무 줄은 네 패널이 같은 `TaskTable`을 쓴다 (팀·내 업무·리스크 화면도 같다). 같은 업무가
 * 화면마다 다르게 생기면 같은 것인지 알아보는 데 시간이 든다.
 */
export default async function TodayPage() {
  const { now, worklist, focus, stale, projectIds } = await loadToday();
  const { counts } = worklist;
  /** 워크리스트는 projectId를 안 준다 — 프로젝트 이름으로 해소한다 (queries.ts). */
  const idOf = (project: string) => projectIds.get(project) ?? null;
  /** 반대 방향. 멘션 알림은 프로젝트 이름 없이 id만 준다 (rest.ts). */
  const nameOf = new Map([...projectIds].map(([name, id]) => [id, name]));
  /** 멘션 줄에 프로젝트명을 얹는다. 상태는 `loadToday`가 이미 붙여 준다. */
  const mentions = groupMentions(worklist.mentions).map((group) => ({
    ...group,
    project: group.projectId ? nameOf.get(group.projectId) : undefined,
  }));

  /** 표 줄에 프로젝트 id를 얹는다 — 상세 모달의 쓰기 줄이 이걸 알아야 열린다. */
  const withId = <T extends { project: string }>(task: T) => ({
    ...task,
    projectId: idOf(task.project),
  });

  /** KPI 4칸의 분모. 각 칸이 "챙길 일 전체 중 얼마"인지 막대로 보여준다. */
  const load =
    counts.imminent +
    counts.overdueActive +
    mentions.length +
    counts.overdueStale;

  /**
   * 지연을 3단으로 쪼갠다. 밀림을 한 덩어리로 세면 3일 밀린 10건과 30일 밀린 10건이
   * 같은 숫자로 보인다 — 관리자 화면에서 제일 알아야 하는 게 그 차이다.
   */
  const late = worklist.overdueActive.map((t) => -t.daysLeft);
  const delay = [
    {
      label: '3일 이하',
      value: late.filter((d) => d <= 3).length,
      className: 'bg-neutral',
    },
    {
      label: '4~7일',
      value: late.filter((d) => d >= 4 && d <= 7).length,
      className: 'bg-warning',
    },
    {
      label: '8일 이상',
      value: late.filter((d) => d >= 8).length,
      className: 'bg-danger',
    },
  ];

  return (
    <>
      <header className="rise mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {worklist.user.name}님, 오늘 챙길 건 이거예요
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {fmtToday(now)} · 담당 업무와 나를 부른 사람만 모았어요.
          </p>
        </div>
        <p className="tabular text-xs text-muted-foreground">
          챙길 일{' '}
          <span className="text-sm font-semibold text-foreground">{load}</span>
          건
        </p>
      </header>

      {/* KPI는 한 줄로 세운다. 2×2로 접으면 4칸이 두 덩어리로 보여서 순위가 안 읽힌다 */}
      <section
        aria-label="요약"
        className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        <Stat
          i={1}
          label="마감 임박"
          value={counts.imminent}
          total={load}
          Icon={IconImminent}
          tone="warning"
          note="7일 안에 마감해요"
        />
        <Stat
          i={2}
          label="밀리는 업무"
          value={counts.overdueActive}
          total={load}
          Icon={IconRisk}
          tone="danger"
          note={
            delay[2].value > 0
              ? `8일 이상 밀린 게 ${delay[2].value}건이에요`
              : '마감이 지났어요'
          }
        />
        <Stat
          i={3}
          label="답 기다리는 멘션"
          value={mentions.length}
          total={load}
          Icon={IconMention}
          tone="primary"
          note={`알림 ${counts.mentions}개를 업무 단위로 접었어요`}
        />
        <Stat
          i={4}
          label="방치된 업무"
          value={counts.overdueStale}
          total={load}
          Icon={IconStale}
          tone="neutral"
          note="30일 넘게 손 안 댄 업무예요"
        />
      </section>

      {/* 표 네 개를 한 단으로 쌓는다. 어느 표든 폭이 같아서 같은 업무가 같은 자리에 온다 */}
      <div className="space-y-4">
        <Card className="rise" style={{ '--i': 5 } as React.CSSProperties}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TitleMark Icon={IconFocus} tone="primary" />
              오늘의 포커스
              {focus && focus.length > 0 && (
                <span className="tabular ml-auto text-xs font-normal text-muted-foreground">
                  점수순 {focus.length}건
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {focus === null ? (
              <Unavailable what="포커스 추천" />
            ) : (
              <TaskTable
                rows={focus.map((pick, i) => ({ ...withId(pick), rank: i + 1 }))}
                path="/"
                filterable
                // 1위 점수. 상세 모달의 점수 막대가 이걸 분모로 쓴다.
                top={focus[0]?.score}
                emptyState="지금은 급한 업무가 없어요"
              />
            )}
          </CardContent>
        </Card>

        <Card className="rise" style={{ '--i': 6 } as React.CSSProperties}>
          <CardHeader className="gap-2">
            <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <TitleMark Icon={IconRisk} tone="danger" />
              밀리는 업무
              <span className="tabular text-xs font-normal text-muted-foreground">
                {counts.overdueActive}건
              </span>
              {counts.overdueActive > 0 && (
                <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
                  {delay.map((bucket) => (
                    <Legend key={bucket.label} dot={bucket.className}>
                      {bucket.label} {bucket.value}건
                    </Legend>
                  ))}
                </span>
              )}
            </CardTitle>
            {/* 지연 분포. 붉은 칸이 길면 건수가 적어도 먼저 봐야 하는 화면이다 */}
            <Meter segments={delay} />
          </CardHeader>
          <CardContent>
            <TaskTable
              rows={worklist.overdueActive.map(withId)}
              path="/"
              filterable
              emptyState="밀리는 업무가 없어요"
            />
          </CardContent>
        </Card>

        <Card className="rise" style={{ '--i': 7 } as React.CSSProperties}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <TitleMark Icon={IconMention} tone="primary" />
              나를 부른 사람들
              <span className="tabular ml-auto text-xs font-normal text-muted-foreground">
                업무 {mentions.length}건 · 알림 {counts.mentions}개
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 이 표만 열이 다르다 — 알아야 하는 게 "누가 뭐라고 불렀나"다 */}
            <MentionTable rows={mentions} path="/" />
          </CardContent>
        </Card>

        {/*
         * 방치된 업무는 워크리스트가 목록 없이 건수만 준다 — 활동 창을 180일로 넓혀
         * 한 번 더 부르고 30일 창과의 차집합으로 만든다 (queries.ts). 그래도 못 가져온
         * 건수는 아래에 그대로 밝힌다.
         */}
        <Card className="rise" style={{ '--i': 8 } as React.CSSProperties}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TitleMark Icon={IconStale} tone="neutral" />
              방치된 업무
              {counts.overdueStale > 0 && (
                <span className="tabular ml-auto text-xs font-normal text-muted-foreground">
                  {counts.overdueStale}건
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 0건이면 조회가 실패했는지 물을 것도 없다 — 없다고 그대로 적는다 */}
            {stale === null && counts.overdueStale > 0 ? (
              <Unavailable what="방치된 업무" />
            ) : (
              <>
                <TaskTable
                  rows={(stale ?? []).map(withId)}
                  path="/"
                  filterable
                  emptyState="방치된 업무가 없어요"
                />
                {stale && stale.length < counts.overdueStale && (
                  <p className="tabular mt-2 text-xs text-muted-foreground">
                    180일 넘게 손 안 댄 {counts.overdueStale - stale.length}건은
                    flow에서 직접 확인해요.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/* ── 조각들 ───────────────────────────────────────────────────────────── */


function Stat({
  label,
  value,
  total,
  Icon,
  tone,
  note,
  i,
}: {
  label: string;
  value: number;
  total: number;
  Icon: typeof IconRisk;
  tone: KpiTone;
  note: string;
  i: number;
}) {
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  const t = KPI_TONE[tone];

  return (
    <Card
      size="sm"
      className={cn('rise gap-2 bg-linear-to-b', t.face)}
      style={{ '--i': i } as React.CSSProperties}
    >
      <CardContent className="space-y-1.5">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              'grid size-6 shrink-0 place-items-center rounded-md',
              t.chip,
            )}
          >
            <Icon size={14} />
          </span>
          <span className="truncate">{label}</span>
          <span className="tabular ml-auto shrink-0">{share}%</span>
        </p>
        {/* 자리마다 굴러 올라간다 (beUI NumberTicker). 건수가 바뀌면 바뀐 자리만 다시 구른다. */}
        <p className="flex items-baseline gap-1">
          <span
            className={cn(
              'tabular text-[28px] leading-none font-semibold',
              t.text,
            )}
          >
            <NumberTicker value={value} />
          </span>
          <span className="tabular text-xs text-muted-foreground">
            / {total}건
          </span>
        </p>
        <Meter total={total} segments={[{ value, label, className: t.bar }]} />
        <p className="text-[11px] leading-snug text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

/**
 * 카드 제목 앞 표지. KPI 아이콘 칩(`Kpi`, `Stat`)과 같은 모양·같은 톤이라
 * 위 요약과 아래 카드가 같은 색 언어로 읽힌다 — 빨강 칩이 붙은 요약을 누르면
 * 빨강 칩이 붙은 카드가 나온다.
 */
function TitleMark({
  Icon,
  tone,
}: {
  Icon: typeof IconRisk;
  tone: KpiTone;
}) {
  return (
    <span
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-md',
        KPI_TONE[tone].chip,
      )}
    >
      <Icon size={16} />
    </span>
  );
}

/** 분포 막대의 색 하나가 무엇인지. 색만으로 의미를 전달하지 않으려고 건수를 같이 낸다. */
function Legend({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <span className="tabular flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
      <span className={cn('size-1.5 rounded-full', dot)} />
      {children}
    </span>
  );
}

function Unavailable({ what }: { what: string }) {
  return (
    <p className="py-2 text-sm text-muted-foreground">
      flow가 잠시 답을 주지 않았어요. 새로고침하면 {what}을 다시 불러와요.
    </p>
  );
}

/* ── 표시용 포맷 ──────────────────────────────────────────────────────── */

function fmtToday(nowMs: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(nowMs);
}

