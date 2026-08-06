"use client";

import Image from "next/image";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { loadTaskPost, type TaskPostResult } from "@/app/(app)/actions";
import {
  IconAttach,
  IconChevronDown,
  IconDownTask,
  IconOpen,
  IconUpTask,
  IconVideo,
} from "@/components/icons";
import { ImageViewer } from "@/components/image-viewer";
import { LinkedText } from "@/components/linked-text";
import { CommentRowsSkeleton } from "@/components/skeletons";
import { CommentForm, SubtaskForm } from "@/components/task-actions";
import { CommentList, type ReplyTarget } from "@/components/thread-view";
import { Skeleton } from "@/components/ui/skeleton";
import type { PostFile, PostLink } from "@/lib/flow/rest";
import { SHOWN } from "@/lib/thread";
import { cn } from "@/lib/utils";

/** 파일 크기. 1MB 밑은 KB로 — 소수점 아래를 읽을 사람이 없다. */
const fmtSize = (bytes: number) =>
  bytes >= 1 << 20
    ? `${(bytes / (1 << 20)).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;

/**
 * 동영상 확장자. `ts`(MPEG 전송 스트림)는 뺐다 — 이 팀 첨부에서는 TypeScript 파일일
 * 확률이 훨씬 높아서, 맞히는 것보다 틀리게 재생 아이콘을 다는 손해가 크다.
 */
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|wmv|mkv|flv|mpe?g|ogv|m2ts|3gp)$/i;

/**
 * 첨부 한 줄 (이름 + 크기). 이 업무의 첨부와 펼친 상위·하위 업무의 첨부가 같이 쓴다.
 *
 * **동영상은 아이콘만 바꾸고 여기서 재생하지는 않는다.** flow 첨부의 `ATCH_URL`
 * (`FLOW_DOWNLOAD_R001.act`)은 flow 로그인 세션을 요구하는데 그 `JSESSIONID`에는
 * `SameSite` 속성이 없다 — 즉 `Lax`라, 다른 출처의 하위 리소스 요청에는 쿠키가 안 붙는다.
 * `<video src>`로 걸면 파일 대신 빈 HTML 1091바이트가 온다. 우회로도 다 막혀 있다:
 * 서버가 대신 받아 오는 프록시도 같은 응답이고(API 키는 `api.flow.team`용이라 여기선
 * 무효), `fetch`로 받아 blob으로 담는 길은 `access-control-allow-origin`이 없어서 끊긴다.
 * 쿠키가 붙는 건 **최상위 이동**뿐이라 새 창으로 보낸다.
 *
 * ponytail: flow가 첨부에 서명 URL이나 인증 없는 경로를 열어 주면 그때 이미지 뷰어와
 * 같은 `<dialog>` 모달을 붙이면 된다. 그전에는 어떤 코드를 써도 빈 플레이어가 뜬다.
 */
function FileRow({ file }: { file: PostFile }) {
  const video = VIDEO_EXT.test(file.name);
  const Icon = video ? IconVideo : IconAttach;

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-2 text-xs transition-colors hover:text-primary/80"
    >
      <Icon size={13} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-primary underline underline-offset-2">{file.name}</span>
      {file.size > 0 && (
        <span className="tabular shrink-0 text-muted-foreground">{fmtSize(file.size)}</span>
      )}
      {/* 재생 아이콘을 달면 그 자리에서 재생될 것처럼 읽힌다. 어디서 열리는지 먼저 말해 준다 */}
      {video && <span className="shrink-0 text-muted-foreground">flow에서 재생</span>}
      <span className="sr-only"> (새 창)</span>
    </a>
  );
}

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
            {got.files?.map((f) => (
              <FileRow key={f.url} file={f} />
            ))}
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
  /** 뷰어로 크게 보는 이미지의 자리. 비어 있으면 뷰어가 닫힌 것이다. */
  const [viewing, setViewing] = useState<number | null>(null);

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
  /** 썸네일이 있는 첨부 = 이미지다. 격자에 그리는 순서가 뷰어에서 넘기는 순서다. */
  const images = got.files?.filter((f) => f.thumb) ?? [];

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
          {images.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {images.map((f, n) => (
                <li key={f.url}>
                  {/* 전에는 flow 원본으로 나가는 새 창 링크였다. 원본이 썸네일과 같은 호스트라
                      (`flow.team/flowImg/**`) 여기서 크게 보여 줄 수 있었다 — flow 링크는
                      뷰어 안으로 내렸다 (`TaskRow`와 같은 손질이다) */}
                  <button
                    type="button"
                    onClick={() => setViewing(n)}
                    title={f.name}
                    className="block cursor-pointer rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {/* 목록에는 flow가 만든 썸네일을 쓴다. `flow.team/flowImg/**`는 이미
                        허용 호스트다 (`next.config.ts`) */}
                    <Image
                      src={f.thumb as string}
                      alt=""
                      width={72}
                      height={72}
                      className="size-18 rounded-md border border-border object-cover"
                    />
                    <span className="sr-only">{f.name} 크게 보기</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {got.files
            .filter((f) => !f.thumb)
            .map((f) => (
              <FileRow key={f.url} file={f} />
            ))}
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

      {/* 뷰어는 열 때만 붙인다 — 안 붙으면 `<dialog>`도 없어서 키를 가로챌 일이 없다 */}
      {viewing !== null && (
        <ImageViewer files={images} at={viewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
}
