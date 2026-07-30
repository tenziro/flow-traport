import { EmptyState } from '@/components/empty-state';
import { FlowLink } from '@/components/flow-link';
import {
  IconCalendar,
  IconChevronDown,
  IconFocus,
  IconImminent,
  IconLastComment,
  IconMention,
  IconRisk,
  IconStale,
} from '@/components/icons';
import { MentionActions } from '@/components/mention-actions';
import { Meter } from '@/components/meter';
import { NumberTicker } from '@/components/motion/number-ticker';
import { countStatuses, StatusFilter } from '@/components/status-filter';
import { StatusPill } from '@/components/status-pill';
import { TaskItem } from '@/components/task-item';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { groupMentions } from '@/lib/aggregate';
import { loadToday } from '@/lib/flow/queries';
import { cn, fmtDateTime, fmtTime } from '@/lib/utils';

export const metadata = { title: '오늘 · flow Cockpit' };

/**
 * 배치 (관리자 패널 성격에 맞춘 4단):
 *
 * 1. KPI 4칸 — 건수 + 전체 점유율 막대. 숫자만 있으면 크고 작음이 안 읽힌다.
 * 2. 포커스(넓게) + 방치된 업무(좁게) — "먼저 할 것"과 "잊고 있던 것"을 나란히.
 * 3. 밀리는 업무 + 나를 부른 사람들 — 둘 다 "지금 답해야 하는 것"이다.
 * 4. 업무 소식 + 오늘 일정 — 챙길 일은 아니고 알고만 있으면 되는 것들이라 맨 아래다.
 *
 * 2·3·4단은 같은 12칸 격자에 8:4로 얹는다. 세 줄의 세로 경계가 한 줄로 맞아야 화면에
 * 기준선이 하나만 생긴다 — 8:4와 6:6을 섞었을 때는 카드 모서리가 계단처럼 어긋났다.
 *
 * 패널마다 배치를 다르게 두는 게 의도다. 같은 카드가 세로로 반복되면 무엇이 중요한지가
 * 배치로 읽히지 않는다.
 *
 * 업무 줄은 세 패널이 같은 `TaskItem`을 쓴다 (팀 화면도 같다). 같은 업무가 화면마다
 * 다르게 생기면 같은 것인지 알아보는 데 시간이 든다.
 */
export default async function TodayPage({
  searchParams,
}: {
  /** 카드마다 상태 필터를 따로 건다. 키가 달라서 두 카드를 동시에 걸러도 안 섞인다. */
  searchParams: Promise<{ focus?: string; overdue?: string }>;
}) {
  const params = await searchParams;
  const { now, worklist, focus, stale, projectIds, events } = await loadToday();
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

  /**
   * 필터는 **보이는 목록만** 줄인다. 위 KPI와 지연 분포 막대는 전체 그대로다 —
   * 요약까지 같이 줄면 "지금 몇 건인지"를 필터 상태에 따라 다시 세야 한다.
   */
  const shownFocus = params.focus
    ? focus?.filter((p) => p.status === params.focus)
    : focus;
  const shownOverdue = params.overdue
    ? worklist.overdueActive.filter((t) => t.status === params.overdue)
    : worklist.overdueActive;

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
      <header className="rise mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
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
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
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

      {/* `items-start` — 방치된 업무는 길이가 들쭉날쭉하다. 높이를 맞추면 짧은 쪽이 빈 상자가 된다.
          `grid-cols-1`은 좁은 화면에서 반드시 필요하다 — 안 적으면 열이 `auto`라 카드가
          내용 최소폭 아래로 안 줄어든다 (bug-report BUG-025) */}
      <div className="mb-6 grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Card
          id="focus"
          className="rise scroll-mt-32 xl:col-span-8"
          style={{ '--i': 5 } as React.CSSProperties}
        >
          <CardHeader className="gap-2">
            <CardTitle className="flex items-center gap-2">
              <IconFocus size={16} className="text-primary" />
              오늘의 포커스
              {focus && focus.length > 0 && (
                <span className="tabular ml-auto text-xs font-normal text-muted-foreground">
                  점수순 {focus.length}건
                </span>
              )}
            </CardTitle>
            {focus && (
              <StatusFilter
                base="/"
                param="focus"
                params={params}
                counts={countStatuses(focus)}
                anchor="focus"
              />
            )}
          </CardHeader>
          <CardContent className="space-y-0.5">
            {focus === null ? (
              <Unavailable what="포커스 추천" />
            ) : focus.length === 0 ? (
              <EmptyState
                icon={<IconFocus size={18} />}
                title="지금은 급한 업무가 없어요"
                description="담당 업무가 모두 잠잠해요."
              />
            ) : (
              shownFocus?.map((pick) => (
                <TaskItem
                  key={pick.taskSrno}
                  task={pick}
                  // 순위는 필터와 무관하게 전체 기준이다 — 걸러 놓고 1,2,3으로 다시 매기면
                  // 같은 업무의 순위가 필터에 따라 달라진다.
                  rank={focus.indexOf(pick) + 1}
                  top={focus[0].score}
                  projectId={idOf(pick.project)}
                  path="/"
                />
              ))
            )}
          </CardContent>
        </Card>

        {/*
         * 방치된 업무는 워크리스트가 목록 없이 건수만 준다 — 활동 창을 180일로 넓혀
         * 한 번 더 부르고 30일 창과의 차집합으로 만든다 (queries.ts). 그래도 못 가져온
         * 건수는 아래에 그대로 밝힌다.
         */}
        <Card
          className="rise xl:col-span-4"
          style={{ '--i': 6 } as React.CSSProperties}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconStale size={16} className="text-neutral-foreground" />
              방치된 업무
              {counts.overdueStale > 0 && (
                <span className="tabular ml-auto text-xs font-normal text-muted-foreground">
                  {counts.overdueStale}건
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {counts.overdueStale === 0 ? (
              <EmptyState
                icon={<IconStale size={18} />}
                title="방치된 업무가 없어요"
              />
            ) : stale === null ? (
              <Unavailable what="방치된 업무" />
            ) : (
              <>
                {stale.map((task, i) => (
                  <div
                    key={task.taskSrno}
                    className="rise border-b border-border/60 last:border-0"
                    style={{ '--i': 6 + i } as React.CSSProperties}
                  >
                    <TaskItem
                      task={task}
                      projectId={idOf(task.project)}
                      path="/"
                    />
                  </div>
                ))}
                {stale.length < counts.overdueStale && (
                  <p className="tabular px-2 pt-2 text-xs text-muted-foreground">
                    180일 넘게 손 안 댄 {counts.overdueStale - stale.length}건은
                    flow에서 직접 확인해요.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/*
       * 밀리는 업무와 멘션을 한 줄에 세운다. 둘 다 "지금 답해야 하는 것"이라 위아래로
       * 떨어져 있으면 하나를 처리하는 동안 다른 하나가 화면 밖으로 나간다.
       *
       * 칸 나눔은 **위 줄과 같은 8:4**다. 6:6으로 두면 두 줄의 세로 경계가 어긋나서
       * 화면에 기준선이 두 개 생긴다. `items-start` — 높이를 맞추면 짧은 쪽이 빈 상자가 된다.
       */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Card
          id="overdue"
          className="rise scroll-mt-32 xl:col-span-8"
          style={{ '--i': 7 } as React.CSSProperties}
        >
          <CardHeader className="gap-2">
            <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <IconRisk size={16} className="text-danger" />
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
            <StatusFilter
              base="/"
              param="overdue"
              params={params}
              counts={countStatuses(worklist.overdueActive)}
              anchor="overdue"
            />
          </CardHeader>
          <CardContent className="space-y-0.5">
            {worklist.overdueActive.length === 0 ? (
              <EmptyState
                icon={<IconRisk size={18} />}
                title="밀리는 업무가 없어요"
              />
            ) : (
              shownOverdue.map((task, i) => (
                <div
                  key={task.taskSrno}
                  className="rise border-b border-border/60 last:border-0"
                  // 행이 많아서 카드보다 촘촘하게 흘린다
                  style={{ '--i': 8 + i } as React.CSSProperties}
                >
                  <TaskItem
                    task={task}
                    projectId={idOf(task.project)}
                    path="/"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card
          className="rise xl:col-span-4"
          style={{ '--i': 8 } as React.CSSProperties}
        >
          <CardHeader>
            {/* 3분의 1 칸에 제목과 두 건수가 같이 들어간다 — 안 접으면 오른쪽이 잘린다 */}
            <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <IconMention size={16} className="text-primary" />
              나를 부른 사람들
              <span className="tabular ml-auto text-xs font-normal text-muted-foreground">
                업무 {mentions.length}건 · 알림 {counts.mentions}개
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mentions.length === 0 ? (
              <EmptyState
                icon={<IconMention size={18} />}
                title="새로 부른 사람이 없어요"
              />
            ) : (
              // 카드 안에서 다시 단을 나누지 않는다 — 댓글 본문이 더 좁아지면 줄이 잘게 접힌다.
              <div>
                {mentions.map((group) => (
                  // 접기/펼치기는 <details>로. 이것 하나 때문에 클라이언트 컴포넌트를 만들지 않는다.
                  // 여닫는 움직임도 CSS다 (`disclose` — globals.css).
                  <details
                    key={group.taskId}
                    className="disclose group px-2 py-1.5"
                  >
                    <summary className="flex cursor-pointer list-none items-start gap-2 text-sm">
                      {/* 안 읽은 게 남았으면 배지를 꽉 채운다. 옅은 배경(다 읽은 그룹)과
                          나란히 놓였을 때 눈이 먼저 가는 쪽이 아직 답 안 한 쪽이다 */}
                      <span
                        className={cn(
                          'tabular mt-0.5 min-w-8 shrink-0 rounded-md px-1.5 text-center text-xs font-semibold',
                          group.unread > 0
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-primary/15 text-primary',
                        )}
                        title={
                          group.unread > 0
                            ? `알림 ${group.count}개 · 안 읽은 게 ${group.unread}개`
                            : `알림 ${group.count}개`
                        }
                      >
                        {group.count}
                      </span>
                      <span className="min-w-0 flex-1">
                        {/* 크기는 다른 카드의 업무 제목(`text-sm`)과 같게. 여기만 15px이라
                            같은 업무 제목인데 카드마다 다르게 보였다. 댓글 본문(13px)보다는
                            여전히 한 급 크고 진해서 첫 댓글이 제목처럼 읽히지 않는다.
                            두 줄까지 흘리던 것을 한 줄에서 자른다 — 긴 제목만 두 줄이 되니
                            줄 높이가 들쭉날쭉했고, 눌러 펼치면 본문에 제목이 다시 나온다 */}
                        <span className="block truncate text-sm leading-snug font-semibold">
                          {group.title}
                        </span>
                        {/* 다른 카드의 업무 줄과 같은 순서다 — 상태, 프로젝트, 그다음이
                            시각. 상태는 게시글 상세, 프로젝트는 알림에서 각각 풀어 온 값이고
                            (queries.ts), 조회가 실패하면 그 자리만 빠진다.
                            줄을 접지 않는다 (`flex-wrap` 없음) — 접히면 프로젝트명이 제 줄로
                            내려가 어떤 줄은 2단, 어떤 줄은 3단이 됐다. 대신 프로젝트명만
                            줄어들며 잘리고 사람·시각은 끝까지 남는다 */}
                        <span className="tabular mt-1 flex items-center gap-x-2 text-xs text-muted-foreground">
                          {group.status && <StatusPill status={group.status} />}
                          {group.project && (
                            <span className="truncate">{group.project}</span>
                          )}
                          <span className="shrink-0">
                            {group.lastFrom} · {fmtDateTime(group.lastAt)}
                          </span>
                        </span>
                      </span>
                      {/* 펼쳐지는 행이라는 표시. 없으면 정적 행과 구분이 안 됐다 */}
                      <IconChevronDown
                        size={14}
                        className="mt-1 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180"
                      />
                    </summary>
                    {/*
                     * 본문 → 댓글 → 답글 세 단을 서로 다르게 뗀다. 본문 아래는 가로선으로
                     * 한 번 끊고, 댓글마다 말풍선 아이콘을 앞에 세운다 — 업무 줄의 마지막
                     * 댓글과 같은 표시다. 아이콘이 시작 지점을 잡아주니 댓글 사이 경계가
                     * 보인다 (선 하나로 전체를 묶었을 때는 긴 댓글 두 개가 한 개로 읽혔다).
                     */}
                    <div className="mt-2.5 ml-10 border-t border-border pt-2.5">
                      {/* 오래된 것부터 — 대화는 위에서 아래로 읽는다 (그룹 배열은 최신순이다) */}
                      <ul className="space-y-3">
                        {[...group.alarms].reverse().map((alarm, i) => (
                          <li
                            key={`${alarm.at}-${i}`}
                            // 답글은 한 칸 들어간다. 부모 댓글은 알림에 안 와서(나를 부른
                            // 것만 온다) 진짜 트리로는 못 세운다 — 깊이 표시까지가 정직한 선이다.
                            className={cn(
                              'flex gap-2',
                              alarm.isReply && 'ml-5',
                            )}
                          >
                            {/* 답글은 아이콘 색으로도 구분한다. 들여쓰기 20px만으로는 약하다 */}
                            <IconLastComment
                              size={14}
                              className={cn(
                                'mt-0.5 shrink-0',
                                alarm.isReply
                                  ? 'text-primary'
                                  : 'text-muted-foreground',
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="tabular flex flex-wrap items-baseline gap-x-1.5 text-xs">
                                {/* 이름은 본문색으로. 시각과 같은 회색이면 누가 썼는지가 안 걸린다 */}
                                <span className="font-medium text-foreground">
                                  {alarm.from}
                                </span>
                                {/* 답글이 첫 줄에 오면 들여쓰기만으로는 이유를 알 수 없다 */}
                                {alarm.isReply && (
                                  <span className="text-primary">답글</span>
                                )}
                                {/* 그룹 알약은 "몇 개 남았나"만 알려준다. 세 개 중 어느
                                    줄이 안 읽은 것인지는 여기서만 읽힌다 (PRD §13 A5) */}
                                {alarm.unread && (
                                  <span className="rounded bg-primary/15 px-1 text-[11px] text-primary">
                                    안 읽음
                                  </span>
                                )}
                                <span className="text-muted-foreground">
                                  {fmtDateTime(alarm.at)}
                                </span>
                              </p>
                              {alarm.content && (
                                // 줄바꿈은 살린다 — 댓글이 목록 형태로 오는 경우가 많다.
                                // 폭은 열 끝까지. 2단 격자 안이라 이미 화면 절반이다.
                                // `wrap-anywhere` — 댓글에 링크가 섞여 온다. 띄어쓰기가 없어서
                                // 안 끊으면 그 한 덩어리가 카드 최소폭이 된다 (BUG-025).
                                <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line wrap-anywhere">
                                  {alarm.content}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                      {/*
                       * 읽음 처리와 전체 스레드 (PRD §13 A1·A2). 위 목록은 나를 부른
                       * 댓글만이라 앞뒤 맥락이 없다 — 필요한 사람이 눌러서 받는다.
                       */}
                      <MentionActions
                        alarmIds={group.alarms.flatMap((alarm) =>
                          alarm.unread && alarm.id ? [alarm.id] : [],
                        )}
                        unread={group.unread}
                        postId={group.postId}
                        path="/"
                      />
                      <FlowLink href={group.link} className="mt-3" />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/*
       * 4단. 위 세 단은 "내가 해야 하는 것"이고 이 줄은 "알고만 있으면 되는 것"이다 —
       * 섞어 놓으면 챙길 일 건수를 셀 때 이 둘까지 세게 된다.
       *
       * 예전에는 여기가 업무 소식 + 오늘 일정 8:4였다. 소식은 헤더 종으로 올라갔고
       * (news-bell.tsx), 남은 일정 하나가 폭을 다 쓰면 시각 열 옆이 허허벌판이라
       * 위 카드들과 같은 8칸에 세워 왼쪽 경계선을 유지한다.
       */}
      <div className="mt-6 grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        {/* 오늘 일정 (PRD §13 B3). 캘린더는 REST에만 있다 — MCP로는 못 가져왔다 */}
        <Card
          className="rise xl:col-span-8"
          style={{ '--i': 9 } as React.CSSProperties}
        >
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <IconCalendar size={16} className="text-primary" />
              오늘 일정
              {events && events.length > 0 && (
                <span className="tabular ml-auto text-xs font-normal text-muted-foreground">
                  {events.length}건
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events === null ? (
              <Unavailable what="오늘 일정" />
            ) : events.length === 0 ? (
              <EmptyState
                icon={<IconCalendar size={18} />}
                title="오늘은 일정이 없어요"
              />
            ) : (
              <ul className="space-y-2">
                {events.map((event) => (
                  <li key={event.eventSrno} className="flex items-start gap-2">
                    {/* 시각을 폭 고정으로 앞에 세운다 — 일정 이름 길이가 달라도 시각이
                        한 줄로 맞아서 하루 흐름이 위아래로 읽힌다 */}
                    <span className="tabular mt-0.5 w-[76px] shrink-0 text-xs text-muted-foreground">
                      {event.allDayYn === 'Y'
                        ? '종일'
                        : `${fmtTime(event.eventStartDateTime)}–${fmtTime(event.eventFinishDateTime)}`}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] leading-snug">
                      {event.eventName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/* ── 조각들 ───────────────────────────────────────────────────────────── */

const TONE = {
  danger: 'text-danger-foreground',
  warning: 'text-warning-foreground',
  primary: 'text-primary',
  neutral: 'text-neutral-foreground',
} as const;

/** 점유율 막대 색. 텍스트 색(`TONE`)은 AA용으로 밝혀둔 값이라 막대에는 원본 토큰을 쓴다. */
const BAR = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  primary: 'bg-primary',
  neutral: 'bg-neutral',
} as const;

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
  tone: keyof typeof TONE;
  note: string;
  i: number;
}) {
  const share = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <Card
      size="sm"
      className="rise gap-2"
      style={{ '--i': i } as React.CSSProperties}
    >
      <CardContent className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon size={13} className={TONE[tone]} />
          <span className="truncate">{label}</span>
          <span className="tabular ml-auto shrink-0">{share}%</span>
        </p>
        {/* 자리마다 굴러 올라간다 (beUI NumberTicker). 건수가 바뀌면 바뀐 자리만 다시 구른다. */}
        <p className="flex items-baseline gap-1">
          <span
            className={cn(
              'tabular text-[28px] leading-none font-semibold',
              TONE[tone],
            )}
          >
            <NumberTicker value={value} />
          </span>
          <span className="tabular text-xs text-muted-foreground">
            / {total}건
          </span>
        </p>
        <Meter
          total={total}
          segments={[{ value, label, className: BAR[tone] }]}
        />
        <p className="text-[11px] leading-snug text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
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

