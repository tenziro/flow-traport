"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { loadTaskPost, type TaskPostResult } from "@/app/(app)/actions";
import { Attachments } from "@/components/attachments";
import { IconChevronDown, IconDownTask, IconOpen, IconUpTask } from "@/components/icons";
import { LinkedText } from "@/components/linked-text";
import { CommentRowsSkeleton } from "@/components/skeletons";
import { CommentForm, SubtaskForm } from "@/components/task-actions";
import { CommentList, type ReplyTarget } from "@/components/thread-view";
import { Skeleton } from "@/components/ui/skeleton";
import type { PostLink } from "@/lib/flow/rest";
import { SHOWN } from "@/lib/thread";
import { cn } from "@/lib/utils";

/**
 * 상위·하위 업무 한 줄. **줄을 누르면 그 자리에서 펼쳐** 그 업무의 본문·첨부·댓글 수를 낸다.
 *
 * 전에는 이름이 flow 새 창 링크였다. 이 앱의 표는 **내가 담당인** 업무만 열 수 있어서
 * 상위·하위를 보려면 flow까지 나가야 했는데, 그쪽 글 번호(`PostLink.postId`)만 있으면
 * `loadTaskPost`가 그대로 돌아서 여기서 그냥 보여 줄 수 있었다. flow 링크는 펼친 안쪽으로
 * 내렸다 — 요약 줄에 누를 것이 하나뿐이라야 무엇이 열리는지 헷갈리지 않는다.
 *
 * **누를 때 한 번만 부른다.** 여닫는 동안 값이 바뀔 일이 없다 (`asked`).
 *
 * ponytail: 미리보기가 쓰는 건 본문·첨부·댓글 **수**뿐인데 `loadTaskPost`는 댓글 본문까지
 * 받는다(본문 1 + 댓글 1 + 답글 n회). 새 액션을 만들면 1회로 줄지만, 여는 건 사람 손이라
 * 분당 상한(120)에 닿지 않는다. 미리보기에 댓글을 실제로 그리게 되면 그때 값이 다 여기 있다.
 *
 * 펼친 안쪽에 그쪽의 상위·하위는 안 낸다 — 하위 업무를 펼치면 그 상위는 지금 열려 있는
 * 이 업무 자신이다.
 */
function TaskRow({ link, children }: { link: PostLink; children: ReactNode }) {
  const [got, setGot] = useState<TaskPostResult | null>(null);
  const asked = useRef(false);
  const name = link.name || "이름 없는 업무";

  const load = () => {
    if (asked.current) return;
    asked.current = true;
    loadTaskPost({ postId: link.postId }).then(setGot, () =>
      setGot({ ok: false, body: "", message: "자세한 내용을 못 가져왔어요." }),
    );
  };

  const meta = (
    <>
      {link.status && <span className="shrink-0 text-muted-foreground">{link.status}</span>}
      {link.progress !== null && (
        <span className="tabular shrink-0 text-muted-foreground">{link.progress}%</span>
      )}
    </>
  );

  // 글 번호가 없으면 펼칠 것도 없다 — 이름만 둔다 (딥링크도 못 만드는 줄이다).
  if (!link.postId) {
    return (
      <div className="flex items-center gap-2 text-xs">
        {children}
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {meta}
      </div>
    );
  }

  return (
    <details className="disclose group/task" onToggle={(e) => e.currentTarget.open && load()}>
      {/* `-mx-2 px-2`는 누를 자리를 덩어리 폭 끝까지 넓힌다 — 이름이 짧아도 줄 전체가 손잡이다.
          쐐기는 오른쪽 끝이다: 이름이 `flex-1`이라 상태·진행률 길이와 상관없이 자리가 고정된다 */}
      <summary className="-mx-2 flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
        {children}
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {meta}
        <IconChevronDown
          size={12}
          aria-hidden
          className="shrink-0 text-muted-foreground/60 transition-transform duration-300 group-open/task:rotate-180"
        />
      </summary>
      {/* 아이콘(13px)과 틈(8px)만큼 밀어 이름 왼쪽 끝에 맞춘다 */}
      <div className="space-y-2 pt-1.5 pb-1 pl-[21px]">
        {!got ? (
          <Skeleton className="h-3 w-24 rounded-md" />
        ) : !got.ok ? (
          <p role="status" className="text-xs text-danger-foreground">
            {got.message}
          </p>
        ) : (
          <>
            {/* 상위 업무 본문이 길면 미리보기가 모달을 통째로 밀어낸다. 여섯 줄에서 자르고
                나머지는 아래 flow 링크로 보낸다 */}
            <p className="line-clamp-6 text-xs leading-relaxed whitespace-pre-line wrap-anywhere">
              {got.body ? (
                <LinkedText text={got.body} />
              ) : (
                <span className="text-muted-foreground">본문이 없어요.</span>
              )}
            </p>
            {got.files && <Attachments files={got.files} />}
            {/* 서버가 이미 세어 놨다 — 여기서 다시 세면 변경 기록까지 댓글로 잡힌다 */}
            <p className="tabular text-xs text-muted-foreground">{got.message}</p>
          </>
        )}
        {link.url && (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
          >
            flow에서 열기
            <IconOpen size={11} aria-hidden />
            <span className="sr-only">(새 창)</span>
          </a>
        )}
      </div>
    </details>
  );
}

/**
 * 상세 모달의 본문 + 댓글 (PRD §6.1.4).
 *
 * **열 때 한 번 부른다** (`loadTaskPost` — 본문 1회 + 댓글 1회). 전에는 댓글을 `댓글 다 보기`를
 * 눌러야 받았는데, 그건 업무 줄마다 댓글 덩어리가 붙어 있던 때의 규칙이다. 지금은 표에서
 * 업무명을 눌러 여는 자리라 열린 업무가 하나뿐이다 — 여기까지 들어온 사람은 이 업무를 보러
 * 온 것이니 열자마자 채운다.
 *
 * 접고 펼치는 규칙은 `CommentList`에 있다 — 멘션 상세 모달과 같은 목록이다.
 *
 * 순서는 위에서 아래로 읽는 대화 그대로다 — 오래된 것이 위, 최신이 아래, 그 아래가 입력칸이다.
 * 그래서 접었을 때 남는 것은 목록의 **끝**이고, 펼치는 버튼은 목록 위에 붙는다.
 */
export function TaskThread({
  projectId,
  taskId,
  title,
  postId,
  path,
}: {
  projectId: string;
  /**
   * 업무일 때만 있다. **업무가 아닌 글(공지·회의록·일정)에는 이 번호가 없다** — 그때는
   * `postId`만으로 돌고, 쪼갤 대상이 아니라서 하위 업무 칸도 안 선다.
   */
  taskId?: number;
  title: string;
  /** 아는 경우 (내 업무 화면). 없으면 서버가 업무 ID·업무명으로 해소한다. */
  postId?: string;
  path: string;
}) {
  const [got, setGot] = useState<TaskPostResult | null>(null);
  /** 댓글을 남긴 뒤 다시 부르는 스위치. 방금 남긴 말이 목록에 안 보이면 남았는지 알 수 없다. */
  const [reload, setReload] = useState(0);
  /** 답글을 달 댓글. 비어 있으면 입력칸이 일반 댓글이다. */
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  useEffect(() => {
    let live = true;
    loadTaskPost({ projectId, taskId: taskId ? String(taskId) : undefined, title, postId }).then((result) => {
      if (live) setGot(result);
    });
    // 모달을 닫는 동안 응답이 오면 사라진 컴포넌트에 값을 넣는다 — 그래서 살아 있는지 본다.
    return () => {
      live = false;
    };
  }, [projectId, taskId, title, postId, reload]);

  const onSaved = useCallback(() => {
    setReload((n) => n + 1);
    // 남긴 뒤에는 일반 댓글로 돌아온다 — 답글 하나 달고 다음 말을 또 그 밑에 붙일 이유는 없다
    setReplyTo(null);
  }, []);
  const cancelReply = useCallback(() => setReplyTo(null), []);

  if (!got) {
    return (
      <div className="space-y-3 border-b border-border px-5 py-4">
        <Skeleton className="h-3 w-12 rounded-md" />
        {/* 도착하면 이 자리에 글자만 앉는다 — 접힌 기본값의 최소 줄 수다 */}
        <CommentRowsSkeleton count={SHOWN} />
      </div>
    );
  }

  const comments = got.comments ?? [];
  /**
   * 쓰기 칸은 하나다. 답글을 달 때는 이 그대로 목록 안, **답하는 말 바로 아래**로 들어간다
   * (`CommentList.replyForm`) — 두 벌을 두면 어느 칸에 쓰고 있는지가 갈리고, 하나가 답글
   * 대상을 들고 있는 동안 다른 하나에 쓴 글이 일반 댓글로 나간다.
   *
   * 자리를 옮기면 React가 이 컴포넌트를 새로 붙인다 — 쓰다 만 글은 사라지고 커서는
   * 새 자리로 간다 (`CommentForm`의 focus). 답글을 누르는 건 "여기 말고 저기에 쓰겠다"는
   * 뜻이라 그게 맞는 동작이다.
   */
  const form = (
    <CommentForm
      projectId={projectId}
      taskId={taskId}
      postId={postId}
      title={title}
      path={path}
      replyTo={replyTo}
      onCancelReply={cancelReply}
      onSaved={onSaved}
    />
  );

  return (
    <>
      {/* 상위 업무는 본문 위다 — "이 업무가 어디 딸린 것인가"는 내용을 읽기 전에 알아야
          한다. 한 줄뿐이라 위아래 여백도 절반이다 */}
      {got.parent && (
        <div className="border-b border-border px-5 py-2">
          <TaskRow link={got.parent}>
            <IconUpTask size={13} aria-hidden className="shrink-0 text-muted-foreground" />
            <span className="shrink-0 font-semibold text-muted-foreground">상위 업무</span>
          </TaskRow>
        </div>
      )}

      {/* 본문 — 업무 제목만으로는 무슨 일인지 모르는 경우가 많다. 비어 있는 업무 글이 흔해서
          (api-spec §6.2) 없으면 덩어리째 뺀다 */}
      {got.body && (
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground">본문</p>
          {/* 줄바꿈을 살린다 — 본문이 목록으로 오는 경우가 많다.
              `wrap-anywhere` — 본문에 섞여 오는 링크는 띄어쓰기가 없다 (BUG-025) */}
          {/* 이 모달에서 제일 오래 읽는 글이라 값 다섯 줄(text-xs)보다 한 급 크다 */}
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line wrap-anywhere">
            <LinkedText text={got.body} />
          </p>
        </div>
      )}

      {/* 첨부 — 본문이 비고 파일만 붙은 업무가 흔하다. 그때 지금까지는 모달이 텅 비어
          보였다. 이미지는 썸네일로, 나머지는 이름과 크기 한 줄로 낸다 */}
      {got.files && (
        <div className="space-y-2 border-b border-border px-5 py-4">
          <p className="tabular text-xs font-semibold text-muted-foreground">
            첨부 {got.files.length}개
          </p>
          <Attachments files={got.files} />
        </div>
      )}

      {/* 하위 업무는 본문·첨부 뒤다 — 이 업무를 읽고 나서 "그 밑에 뭐가 있나"를 본다.
          하나도 없어도 칸은 남긴다 — 쪼갤 자리는 쪼갤 게 없어 보이는 업무에서 더 필요하다.
          글을 못 읽어 온 경우에만 통째로 뺀다 (그때는 이 업무가 맞는지도 확실하지 않다) */}
      {/* 업무가 아닌 글에는 이 칸을 안 낸다 — 공지를 쪼갤 일은 없고, 쪼갤 대상이 될 업무
          번호도 없다 */}
      {got.ok && taskId !== undefined && (
        <div className="space-y-2 border-b border-border px-5 py-4">
          <p className="tabular text-xs font-semibold text-muted-foreground">
            하위 업무 {got.subTasks?.length ?? 0}개
          </p>
          {got.subTasks && (
            <ul className="space-y-0.5">
              {got.subTasks.map((t) => (
                <li key={t.postId || t.name}>
                  <TaskRow link={t}>
                    <IconDownTask size={13} aria-hidden className="shrink-0 text-muted-foreground" />
                  </TaskRow>
                </li>
              ))}
            </ul>
          )}
          {/* 만든 뒤 목록을 다시 부른다 — 방금 쪼갠 게 위에 안 보이면 됐는지 알 수 없다 */}
          <SubtaskForm projectId={projectId} taskId={taskId} path={path} onSaved={onSaved} />
        </div>
      )}

      <div className="space-y-3 border-b border-border px-5 py-4">
        <CommentList
          comments={comments}
          onReply={setReplyTo}
          replyingTo={replyTo?.id}
          replyForm={form}
          empty={
            <p
              role="status"
              className={cn("text-xs", got.ok ? "text-muted-foreground" : "text-danger-foreground")}
            >
              {got.message}
            </p>
          }
        />

        {/* 새 댓글은 제일 아래다 — 위의 대화를 읽고 그 끝에 말을 붙이는 순서다.
            답글일 때는 이 자리가 비고 칸이 그 말 아래로 올라간다 */}
        {!replyTo && form}
      </div>
    </>
  );
}
