"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { loadProjectPanel, type ProjectPanelResult } from "@/app/(app)/actions";
import { IconLastComment } from "@/components/icons";
import { Meter } from "@/components/meter";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskModal } from "@/components/use-task-modal";
import type { ProjectBrief, ProjectPost } from "@/lib/flow/rest";
import { fmtDate } from "@/lib/utils";

/**
 * 내 업무 카드를 펼쳤을 때 붙는 **참여자 칸 + 업무 아닌 글**, 그리고 둘과 업무 표의 배치
 * (PRD §6.5).
 *
 * 설명·공개 여부·개설 정보는 여기가 아니라 접힌 카드의 요약 줄이 낸다 (`tasks/page.tsx`) —
 * 카드 하나가 같은 말을 두 번 하지 않는다. 펼친 카드에서 궁금한 건 "누구와 하는 일인가"다.
 *
 * **업무 표를 `children`으로 받아 배치까지 여기서 한다.** 두 곁가지가 한 번의 조회에서
 * 같이 오는데(`loadProjectPanel`) 놓일 자리는 서로 반대편이다 — 참여자는 오른쪽, 글은 표
 * 바로 아래다. 배치를 부모가 쥐면 그 데이터를 부모까지 끌어올려야 하고, 그러려면 카드
 * 전체가 클라이언트 컴포넌트가 된다. 표를 여기로 넘기는 편이 싸다.
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
  children,
}: {
  projectId: string;
  /** 프로젝트명. 글 모달의 머리가 쓴다. */
  project: string;
  brief?: ProjectBrief;
  /** 업무 표. 서버에서 그려진 채로 온다 — 여기서는 자리만 잡는다. */
  children: React.ReactNode;
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
    // 업무 표 왼쪽, 참여자 오른쪽. 좁은 화면에서는 표 아래로 내려간다 — 참여자 목록은
    // 업무를 볼 때 곁눈으로 보는 것이라 표를 밀어내면 안 된다
    <div className="mt-3 flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        {children}
        <Posts
          posts={got?.ok ? (got.posts ?? []) : []}
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
      </div>
      <aside
        ref={ref}
        aria-label="참여자"
        /*
         * 넓은 화면에서는 왼쪽 열 높이만큼 늘어난다 (flex 기본 `stretch`).
         *
         * 바닥값 480px은 **실측에서 나온 수**다. 머리 칸이 99px, 무리 머리가 28px, 이름 한 줄이
         * 28px이라 두 무리에 다섯 줄씩 보이려면 `99 + 2 × (28 + 16 + 5 × 28) = 467`이다.
         * 256px이었을 때는 무리마다 50px, 곧 한 줄 반이라 이름이 가운데서 잘렸다 — 업무가 한두
         * 건인 프로젝트에서 왼쪽 열이 그만큼 짧다.
         */
        className="relative shrink-0 overflow-hidden rounded-lg border border-border text-sm lg:min-h-120 lg:w-64"
      >
        {/* 넓은 화면에서 **칸에서 떼어 낸다**(`absolute`). 안 떼면 이름이 많은 프로젝트에서
            참여자 목록이 카드 높이를 밀어 올린다 — 실측으로 왼쪽 열 900px에 목록이 972px을
            요구했다. 높이를 정하는 건 업무 표 쪽이고 이 칸은 받은 높이를 채우기만 한다.
            좁은 화면에서는 흐름 그대로다 — 표 아래에 서니 나눠 가질 높이가 없다 */}
        <div className="flex flex-col lg:absolute lg:inset-0">
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
              <div className="shrink-0 border-b border-border px-3 py-2.5">
                <p className="font-medium">참여자 {count}명</p>
                {/* 두 무리의 비율. 우리 팀만 색을 주고 나머지는 회색이다 — 이 화면에서 궁금한
                    건 "이 판에 우리가 몇 명인가"다. 색만으로 가르지 않고 아래에 수치를 적는다 */}
                <Meter
                  className="mt-2"
                  segments={[
                    {
                      value: inCount,
                      label: `임직원 ${inCount}명`,
                      className: "bg-primary",
                    },
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
              <Names
                title="임직원"
                people={staff}
                tone="bg-primary/10 text-primary"
              />
              <Names title="외부" people={outside} />
            </>
          )}
        </div>
      </aside>
      {post.modal}
    </div>
  );
}

/**
 * 업무가 아닌 글 — 공지·회의록·일정 (PRD §6.5).
 *
 * 왼쪽 표는 업무만 세운다. 그런데 프로젝트에는 업무 밖의 글이 같이 쌓이고(실측 25개
 * 프로젝트에 337건), 일정이나 공지가 거기 있다는 걸 이 화면에서는 알 방법이 없었다.
 *
 * **업무 표 바로 아래다.** 참여자 칸 세 번째 자리에 있을 때는 임직원·외부 두 목록(각
 * 최대 208px)에 밀려 화면 밖으로 나갔다 — 92명짜리 프로젝트에서는 스크롤을 두 번 해야
 * 닿았다. 표와 같은 열에 두면 업무를 다 읽은 눈이 그대로 만난다. 옆 칸(사람)이 아니라
 * 표(글)와 같은 종류라 자리도 그쪽이 맞다.
 *
 * 목록 조회가 **최상위 글만** 준다 — 업무 밑에 달린 하위 업무는 안 온다. 그래서 이 칸은
 * 늘 짧고, 표 아래에 붙여도 카드가 길어지지 않는다.
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
    // 업무 표와 같은 테두리·같은 글자 크기다 — 한 열에 위아래로 서니 다르게 생기면
    // 표가 두 개인 것처럼 읽힌다
    <div className="mt-3 overflow-hidden rounded-lg border border-border text-sm">
      <p className="bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        업무 아닌 글 {posts.length}개
      </p>
      {/* 위 업무 표가 12줄에서 스크롤하는 것과 같이 맞춘다 */}
      <ul className="max-h-52 divide-y divide-border overflow-y-auto overscroll-contain">
        {posts.map((p) => (
          <li key={p.postId}>
            {/* 폭이 넓어져서 제목과 딸린 정보가 한 줄에 들어간다 — 좁은 칸에 있을 때는
                두 줄이었다. 제목만 줄어들고(`min-w-0`) 오른쪽 정보는 안 잘린다 */}
            <button
              type="button"
              onClick={() => onOpen(p)}
              className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left outline-none transition-colors hover:bg-secondary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                {/* 안 읽은 글. 점만으로 말하지 않는다 — 읽어 주는 글자가 같이 있다 */}
                {p.unread && (
                  <span className="size-1.5 shrink-0 rounded-full bg-primary">
                    <span className="sr-only">안 읽음</span>
                  </span>
                )}
                <span className="min-w-0 truncate" title={p.title}>
                  {p.title}
                </span>
                {/* 말풍선 + 숫자. `나를 부른 사람들` 표와 같은 표현이다 (`mention-table`) —
                    제목 뒤에 붙고 면은 두지 않는다. 오른쪽 `글 · 등록자 · 날짜` 무리에
                    있을 때는 `댓글 3`이 종류·이름·날짜와 같은 무게로 읽혔는데, 이건
                    그 글에 말이 오갔다는 표시라 제목에 붙는 쪽이 맞다 */}
                {p.comments > 0 && (
                  <span className="tabular inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <IconLastComment size={11} />
                    <span className="sr-only">댓글 </span>
                    {p.comments}
                  </span>
                )}
              </span>
              <span className="tabular flex shrink-0 gap-x-3 text-xs text-muted-foreground">
                <span>{p.kind}</span>
                {p.author && <span>{p.author}</span>}
                {p.date && <span>{fmtDate(p.date)}</span>}
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
    // `flex-1`은 `basis: auto`라 제 내용 높이에서 출발해 남는 자리를 무리끼리 똑같이 나눈다 —
    // 12명과 18명이 각자 제 몫을 갖고, 모자라면 각자 스크롤한다. `min-h-0`이 없으면 flex
    // 항목의 최소 크기가 내용 높이라 줄지 않고 칸 밖으로 샌다
    <div className="flex min-h-0 flex-1 flex-col border-b border-border last:border-b-0">
      <p className="shrink-0 bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {title} {people.length}명
      </p>
      {/* 외부가 실측 최대 42명이다. 좁은 화면에서는 칸 높이가 내용 높이라 나눌 자리가 없어서
          예전처럼 208px에서 끊고(왼쪽 표가 12줄에서 스크롤하는 것과 같다), 넓은 화면에서는
          그 뚜껑을 걷어 칸 높이를 꽉 채운다 */}
      <ul className="max-h-52 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 lg:max-h-none">
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
