"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { loadProjectPanel, type ProjectPanelResult } from "@/app/(app)/actions";
import { Meter } from "@/components/meter";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskModal } from "@/components/use-task-modal";
import type { ProjectBrief, ProjectPost } from "@/lib/flow/rest";
import { fmtDate } from "@/lib/utils";

/**
 * 내 업무 카드를 펼쳤을 때 업무 표 오른쪽에 서는 **참여자** 칸 (PRD §6.5).
 *
 * 설명·공개 여부·개설 정보는 여기가 아니라 접힌 카드의 요약 줄이 낸다 (`tasks/page.tsx`) —
 * 카드 하나가 같은 말을 두 번 하지 않는다. 펼친 카드에서 궁금한 건 "누구와 하는 일인가"다.
 *
 * 겉모습은 **옆 업무 표와 한 벌**이다 — 같은 `border border-border`에 같은 `text-sm`이고,
 * 안쪽은 표의 줄처럼 경계선으로 나뉜다. 크기가 다르면 한 카드 안에서 두 개의 표처럼 읽히고,
 * 그러면 어느 쪽이 본문인지 흐려진다.
 *
 * 참여자는 **임직원과 외부 두 무리**다. 실측으로 90명 중 77명이 고객사라 섞어 놓으면 우리 팀이
 * 누군지 안 보인다. 무리를 색으로만 가르지 않는다 — 각 무리에 이름표 줄이 서고 막대에도
 * 글자 수치가 붙는다.
 *
 * ponytail: 조상 `<details>`가 열리는지를 DOM으로 엿본다. 카드(`tasks/page.tsx`)를 클라이언트
 * 컴포넌트로 돌리면 표·막대·끝낸 업무 줄까지 다 끌려오는데, 여기 필요한 건 "열렸나" 하나다.
 * `<details>`는 닫혀 있어도 안쪽이 마운트돼서 `useEffect`만으로는 못 미룬다.
 */
export function ProjectPanel({
  projectId,
  project,
  brief,
}: {
  projectId: string;
  /** 프로젝트명. 글 모달의 머리가 쓴다. */
  project: string;
  brief?: ProjectBrief;
}) {
  const ref = useRef<HTMLElement>(null);
  const [got, setGot] = useState<ProjectPanelResult | null>(null);
  const post = useTaskModal();

  useEffect(() => {
    const box = ref.current?.closest("details");
    if (!box) return;
    let live = true;
    const load = () => {
      if (!box.open) return;
      box.removeEventListener("toggle", load);
      loadProjectPanel(projectId).then((result) => live && setGot(result));
    };
    load(); // 이미 열려 있으면 기다릴 것 없다
    box.addEventListener("toggle", load);
    return () => {
      live = false;
      box.removeEventListener("toggle", load);
    };
  }, [projectId]);

  const staff = got?.participants?.filter((p) => !p.outside) ?? [];
  const outside = got?.participants?.filter((p) => p.outside) ?? [];
  const known = staff.length + outside.length;
  // 수는 API 값이 먼저다 — 이름을 못 얻은 사람까지 세는 유일한 값이다 (api-spec §5.3)
  const count = brief?.count || known;
  const outCount = Math.min(brief?.outside ?? outside.length, count);
  const inCount = count - outCount;

  return (
    <aside
      ref={ref}
      aria-label="참여자와 글"
      className="shrink-0 overflow-hidden rounded-lg border border-border text-sm lg:w-64"
    >
      {!got ? (
        <div className="space-y-2 p-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : !got.ok ? (
        <p className="p-3 text-muted-foreground">{got.message}</p>
      ) : (
        <>
          <div className="border-b border-border px-3 py-2.5">
            <p className="font-medium">참여자 {count}명</p>
            {/* 두 무리의 비율. 우리 팀만 색을 주고 나머지는 회색이다 — 이 화면에서 궁금한
                건 "이 판에 우리가 몇 명인가"다. 색만으로 가르지 않고 아래에 수치를 적는다 */}
            <Meter
              className="mt-2"
              segments={[
                { value: inCount, label: `임직원 ${inCount}명`, className: "bg-primary" },
                {
                  value: outCount,
                  label: `외부 ${outCount}명`,
                  className: "bg-muted-foreground/40",
                },
              ]}
            />
            <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>임직원 {inCount}명</span>
              <span>외부 {outCount}명</span>
            </p>
            {/* 수와 목록이 어긋나는 게 정상이라 그 사실을 적는다 — 실측 90명 중 36명 */}
            {known > 0 && known < count && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                이름을 아는 사람은 {known}명이에요.
              </p>
            )}
          </div>

          {/* 원판 색이 위 막대와 짝이다 — 우리 팀은 파랑, 외부는 회색 */}
          <Names title="임직원" people={staff} tone="bg-primary/10 text-primary" />
          <Names title="외부" people={outside} />
          <Posts
            posts={got.posts ?? []}
            onOpen={(p) =>
              post.open({
                projectId,
                postId: p.postId,
                title: p.title,
                project,
                url: p.url,
                isPost: true,
              })
            }
          />
          {post.modal}
        </>
      )}
    </aside>
  );
}

/**
 * 업무가 아닌 글 — 공지·회의록·일정 (PRD §6.5).
 *
 * 왼쪽 표는 업무만 세운다. 그런데 프로젝트에는 업무 밖의 글이 같이 쌓이고(실측 25개
 * 프로젝트에 337건), 일정이나 공지가 거기 있다는 걸 이 화면에서는 알 방법이 없었다.
 *
 * 목록 조회가 **최상위 글만** 준다 — 업무 밑에 달린 하위 업무는 안 온다. 그래서 이 칸은
 * 늘 짧고, 참여자 아래에 붙여도 칸을 밀지 않는다.
 *
 * 제목을 누르면 **이 화면에서 글 모달**이 열린다 (v4.16.0) — 알림에서 여는 것과 같은 모달이라
 * 본문·첨부·댓글을 읽고 댓글도 남긴다. 업무가 아닌 게 이미 확실한 줄이라 서버에서 업무를
 * 찾아보는 왕복은 건너뛴다(`isPost`). 안 읽은 글에는 점이 붙는다 — flow가 읽음 표시를 주는
 * 몇 안 되는 자리다.
 *
 * **점은 우리가 안 지운다.** flow에 게시글 읽음 처리가 없다 — 상세를 봐도 `readYn`이 그대로고,
 * 짐작할 만한 경로 12개가 전부 없는 길이었다 (api-spec §6.2 실측). 화면에서만 끄면 다시
 * 들어왔을 때 점이 되살아나서, 처리된 척만 하고 만다.
 */
function Posts({
  posts,
  onOpen,
}: {
  posts: readonly ProjectPost[];
  onOpen: (post: ProjectPost) => void;
}) {
  if (!posts.length) return null;
  return (
    <div className="border-b border-border last:border-b-0">
      <p className="bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        업무 아닌 글 {posts.length}개
      </p>
      <ul className="max-h-52 overflow-y-auto px-3 py-2">
        {posts.map((p) => (
          <li key={p.postId} className="py-0.5">
            <button
              type="button"
              onClick={() => onOpen(p)}
              className="block w-full cursor-pointer rounded-md text-left outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {/* 안 읽은 글. 점만으로 말하지 않는다 — 읽어 주는 글자가 같이 있다 */}
                {p.unread && (
                  <span className="size-1.5 shrink-0 rounded-full bg-primary">
                    <span className="sr-only">안 읽음</span>
                  </span>
                )}
                <span className="min-w-0 truncate text-xs" title={p.title}>
                  {p.title}
                </span>
              </span>
              <span className="tabular mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                <span>{p.kind}</span>
                {p.author && <span>{p.author}</span>}
                {p.date && <span>{fmtDate(p.date)}</span>}
                {p.comments > 0 && <span>댓글 {p.comments}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 한 무리의 이름들. 없으면 칸을 안 만든다 — 외부가 0명인 프로젝트가 있다.
 *
 * 사람 한 줄은 구성원 화면과 같은 표현이다(얼굴 사진, 없으면 이름 첫 글자 원판) — 폭이
 * 좁아 24px로 줄였다. 얼굴은 **우리 기관 사람만** 붙는다(`loadProjectPanel`), 그래서 사진이
 * 있고 없고가 그 자체로 두 무리를 한 번 더 갈라 준다.
 *
 * 원판과 사진 모두 이름을 안 읽는다(`aria-hidden`·빈 `alt`): 이름이 바로 옆에 글자로 있어서
 * 읽어 주면 두 번 부른다.
 */
function Names({
  title,
  people,
  tone = "bg-muted",
}: {
  title: string;
  people: { userId: string; name: string; photo?: string }[];
  tone?: string;
}) {
  if (!people.length) return null;
  return (
    <div className="border-b border-border last:border-b-0">
      <p className="bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {title} {people.length}명
      </p>
      {/* 외부가 실측 최대 42명이다. 왼쪽 표가 12줄에서 스크롤하는 것과 같이 맞춘다 */}
      <ul className="max-h-52 overflow-y-auto px-3 py-2">
        {people.map((p) => (
          <li key={p.userId} className="flex items-center gap-2 py-0.5">
            {/* 사진이 없는 사람이 있다 (실측 13명 중 4명) — 그때는 이름 첫 글자 원판이다 */}
            {p.photo ? (
              <Image
                src={p.photo}
                alt=""
                width={24}
                height={24}
                className="size-6 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${tone}`}
              >
                {p.name.slice(0, 1)}
              </span>
            )}
            {/* 긴 이름은 자르되 전체를 툴팁으로 남긴다 */}
            <span className="truncate" title={p.name}>
              {p.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
