import { DoneTaskRow } from "@/components/done-task-row";
import { EmptyState } from "@/components/empty-state";
import { FlowLink } from "@/components/flow-link";
import { IconChevronDown, IconMyTasks, IconNormal, IconRisk } from "@/components/icons";
import { Kpi } from "@/components/kpi";
import { Meter } from "@/components/meter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { ProjectTaskFilter } from "@/components/project-task-filter";
import { StatHint } from "@/components/stat-hint";
import { TaskItem } from "@/components/task-item";
import { Card, CardContent } from "@/components/ui/card";
import { loadMyTasks, type MyTasksData, type MyTasksProject } from "@/lib/flow/my-tasks";

export const metadata = { title: "내 업무 · flow Cockpit" };

/** 쓰기 액션 후 다시 그릴 경로. */
const PATH = "/tasks";

/**
 * 내 업무 (PRD §6.5).
 *
 * 오늘 화면은 임박·지연만 띄운다 — 실측으로 내 업무 880건 중 16건이다. 이 화면은 나머지
 * 864건이 있는 곳이고, 그래서 목록이 아니라 **프로젝트 아코디언**이다. 880줄을 한 번에
 * 펼치면 아무것도 못 찾는다. 기본은 다 접혀 있고, 접힌 줄에 안 끝난 건수와 진행 막대만 낸다.
 */
export default async function TasksPage() {
  const { total, open, projects, quiet, truncated, failed } = await loadMyTasks();
  const done = total - open;

  // 빈 무리는 탭에서 뺀다 — 누르면 아무것도 없는 칸을 남겨 두지 않는다
  const tabs = [
    {
      value: "open",
      label: "할 일 있어요",
      count: projects.filter((p) => p.open.length > 0).length,
      pane: <ProjectList projects={projects.filter((p) => p.open.length > 0)} />,
    },
    {
      value: "done",
      label: "다 끝냈어요",
      count: projects.filter((p) => p.open.length === 0).length,
      pane: <ProjectList projects={projects.filter((p) => p.open.length === 0)} />,
    },
    {
      value: "quiet",
      label: "내 업무 없어요",
      count: quiet.length,
      pane: <QuietList projects={quiet} />,
    },
  ].filter((tab) => tab.count > 0);

  return (
    <>
      <header className="rise mb-4">
        <h1 className="text-xl font-semibold tracking-tight">내 업무</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          내가 담당인 업무를 프로젝트별로 모았어요. 오늘 화면에 안 나오는 것까지 전부예요.
        </p>
      </header>

      <section aria-label="요약" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi
          i={1}
          label="내 업무"
          value={total}
          unit="건"
          Icon={IconMyTasks}
          note={`프로젝트 ${projects.length}개`}
        />
        {/* `primary`는 밝은 화면에서 `#171717`이라 본문과 구별이 안 된다 — 세 칸이 다 검게
            보였다. 신호가 있는 두 칸은 실제 색을 가진 토큰으로 준다. `danger`는 아니다:
            안 끝난 것 전부가 마감을 넘긴 게 아니다 (그건 리스크 화면의 `밀리는 업무`다). */}
        <Kpi
          i={2}
          label="안 끝난 업무"
          value={open}
          unit="건"
          Icon={IconRisk}
          tone="warning"
          note="여기부터 보면 돼요"
        />
        <Kpi
          i={3}
          label="끝낸 업무"
          value={done}
          unit="건"
          Icon={IconNormal}
          tone="done"
          note="프로젝트 안에 접어 뒀어요"
        />
      </section>

      {/* 프로젝트 38개가 한 줄기로 늘어서면 "볼 것"과 "안 볼 것"이 섞인다. 세 무리는 성격이
          아예 달라서(할 일이 남음 / 다 끝남 / 내 업무가 없음) 스크롤이 아니라 탭으로 나눈다.
          `projects`는 안 끝난 건수 내림차순이라 두 무리가 앞뒤로 갈린다 (my-tasks.ts) */}
      {tabs.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<IconMyTasks size={18} />}
              title="담당인 업무가 없어요"
              description="flow에서 담당자로 지정되면 여기 모여요."
            />
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={tabs[0].value} variant="segment">
          <TabsList aria-label="프로젝트 보기" className="flex-wrap bg-secondary">
            {tabs.map(({ value, label, count }) => (
              <TabsTrigger key={value} value={value} className="min-h-8">
                {label}
                {/* 골라진 칸은 글자색이 반전되므로 색이 아니라 투명도로 낮춘다 */}
                <span className="tabular ml-1.5 opacity-70">{count}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map(({ value, pane }) => (
            <TabsContent key={value} value={value}>
              {pane}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* 못 가져온 것은 숨기지 않는다 — 건수가 실제보다 적게 보이는 게 제일 나쁘다 */}
      {truncated.length > 0 && (
        <p className="mt-6 text-xs text-muted-foreground">
          {truncated.join(", ")}는 담당 업무가 300건을 넘어서 앞의 300건만 가져왔어요.
        </p>
      )}
      {failed.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {failed.join(", ")}는 지금 조회가 막혀서 빠져 있어요. 잠시 뒤에 새로 고쳐 보세요.
        </p>
      )}
    </>
  );
}

/** 탭 한 칸의 프로젝트 카드 묶음. */
function ProjectList({ projects }: { projects: MyTasksProject[] }) {
  return (
    <div className="space-y-3">
      {projects.map((project, i) => (
        <ProjectCard key={project.projectId} project={project} i={4 + i} />
      ))}
    </div>
  );
}

/**
 * 내 업무가 0건인 프로젝트. 펼칠 것이 없어서 카드를 만들지 않고 이름 한 줄이다.
 *
 * 전에는 화면 맨 아래 접힌 줄이었다. 탭으로 옮기니 "볼까요?" 하고 물을 자리가 아니라
 * 골라서 들어오는 칸이 됐다.
 *
 * 줄마다 flow 링크를 둔다 — 여기 온 사람이 할 수 있는 일이 그것뿐이다. 담당이 없다는 말은
 * Cockpit에 보여 줄 업무가 없다는 뜻이고, 21개 이름만 읽고 나가면 막다른 칸이 된다.
 */
function QuietList({ projects }: { projects: MyTasksData["quiet"] }) {
  return (
    <Card className="rise" style={{ "--i": 4 } as React.CSSProperties}>
      <CardContent>
        <ul className="text-sm text-muted-foreground">
          {projects.map((project) => (
            <li
              key={project.link}
              className="flex items-center gap-2 border-b border-border/60 px-2 py-2 last:border-0"
            >
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              <FlowLink href={project.link} className="shrink-0" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ProjectCard({ project, i }: { project: MyTasksProject; i: number }) {
  const total = project.open.length + project.done.length;

  return (
    <Card className="rise" style={{ "--i": i } as React.CSSProperties}>
      <CardContent>
        {/* 여닫는 움직임은 CSS다 (`disclose` — globals.css) */}
        <details className="disclose group">
          <summary className="flex cursor-pointer list-none items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="min-w-0 flex-1 basis-full truncate font-medium sm:basis-auto">
                  {project.name}
                </span>
                <span className="tabular flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  <StatHint hint="안 끝난 업무 — 상태가 완료가 아니에요">
                    <span className="flex items-center gap-1">
                      {/* 위 `안 끝난 업무` 카드와 같은 색이다 — 같은 숫자를 세는 곳이라
                          색까지 같아야 한 쌍으로 읽힌다. `text-primary`였을 때는 밝은
                          화면에서 `#171717`이라 옆 글자와 구별이 안 됐다 */}
                      <IconRisk size={12} className="text-warning-foreground" />
                      <span className="sr-only">안 끝난 업무 </span>
                      {project.open.length}건
                    </span>
                  </StatHint>
                  <span>전체 {total}건</span>
                </span>
              </span>
              {/*
               * 다 끝난 프로젝트를 펼치지 않고도 알아보려면 비율이 필요하다. 두 칸을 다 칠해서
               * 막대 전체가 이 프로젝트의 업무 전량이 된다 — 끝낸 쪽만 칠하면 남은 회색이
               * "안 끝난 40건"인지 "아직 안 센 것"인지 구별이 안 됐다. 안 끝난 칸은 위
               * `⚠ 40건`과 같은 계열 색이라 숫자와 막대가 한 쌍으로 읽힌다.
               */}
              <Meter
                total={total}
                className="mt-1.5"
                segments={[
                  {
                    value: project.done.length,
                    label: `끝낸 업무 ${project.done.length}건`,
                    className: "bg-done",
                  },
                  {
                    value: project.open.length,
                    label: `안 끝난 업무 ${project.open.length}건`,
                    className: "bg-warning",
                  },
                ]}
              />
            </span>
            <IconChevronDown
              size={16}
              className="mt-0.5 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180"
            />
          </summary>

          {/* 줄은 서버에서 그려 넘긴다 — 거르기만 클라이언트다 (`ProjectTaskFilter` 주석) */}
          {project.open.length > 0 && (
            <ProjectTaskFilter
              items={project.open.map((task) => ({
                key: task.taskSrno,
                status: task.status,
                depth: task.depth,
                row: <TaskItem task={task} projectId={project.projectId} path={PATH} />,
              }))}
            />
          )}

          {project.done.length > 0 && (
            <details className="disclose group/done mt-3 border-t border-border pt-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-2 text-xs text-muted-foreground">
                끝낸 업무 {project.done.length}건
                <IconChevronDown
                  size={12}
                  className="shrink-0 transition-transform duration-300 group-open/done:rotate-180"
                />
              </summary>
              {/* 안 끝난 목록과 같은 구분선 — 한 카드 안에서 두 목록이 다르게 보이면 안 된다 */}
              <ul className="mt-2 space-y-0.5">
                {project.done.map((task) => (
                  <li key={task.taskSrno} className="border-b border-border/60 last:border-0">
                    <DoneTaskRow task={task} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </details>
      </CardContent>
    </Card>
  );
}
