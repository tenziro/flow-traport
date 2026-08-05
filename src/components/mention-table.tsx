"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadTaskPost, type TaskPostResult } from "@/app/(app)/actions";
import { DetailHeader } from "@/components/detail-header";
import { FlowLink } from "@/components/flow-link";
import { IconLastComment } from "@/components/icons";
import { LinkedText } from "@/components/linked-text";
import { MentionActions } from "@/components/mention-actions";
import { Button } from "@/components/motion/button/base";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { Table, type TableColumn } from "@/components/motion/table";
import { CommentRowsSkeleton } from "@/components/skeletons";
import { StatusPill } from "@/components/status-pill";
import { CommentList } from "@/components/thread-view";
import type { MentionGroup } from "@/lib/aggregate";
import { SHOWN } from "@/lib/thread";
import { cn, fmtDateTime } from "@/lib/utils";

/** 표 한 줄. 프로젝트명은 알림에 없어서(`projectId`만 온다) 화면이 붙여 준다. */
export type MentionTableRow = MentionGroup & { project?: string };

/** 업무 표와 같은 줄 높이. 두 표가 나란히 있어서 다르면 줄이 어긋나 보인다. */
const ROW_HEIGHT = 44;

/**
 * 나를 부른 사람들 표 (PRD §6.1.2).
 *
 * **이 표만 열이 다르다.** 업무 표는 프로젝트·업무명·상태·마감일인데, 여기서 알아야 하는 건
 * "누가 언제 불렀나"다 — 부른 사람과 시각이 그 자리를 차지한다. 표 겉모양·줄 높이·
 * 업무명을 눌러 모달을 여는 방식은 업무 표와 같다.
 *
 * 댓글 본문은 줄에 안 낸다. 한 줄에 잘려 들어간 120자는 무슨 말인지 알기에는 모자라고
 * 훑기에는 길어서, 업무명 옆 말풍선 숫자로 "몇 마디 있나"만 알리고 본문은 모달에서 읽는다.
 */
export function MentionTable({
  rows,
  path,
  maxRows = 8,
}: {
  rows: readonly MentionTableRow[];
  /** 읽음 처리 후 다시 그릴 경로. */
  path: string;
  maxRows?: number;
}) {
  /** 열려 있는 그룹. 모달이 접히는 동안 내용이 남아야 해서 닫을 때 비우지 않는다. */
  const [opened, setOpened] = useState<MentionTableRow | null>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  const columns = useMemo<TableColumn<MentionTableRow>[]>(
    () => [
      {
        key: "title",
        header: "업무명",
        sortable: true,
        width: "50%",
        cell: (row) => (
          <button
            type="button"
            onClick={() => {
              setOpened(row);
              setOpen(true);
            }}
            // 번호와 업무명 묶는 방식은 업무 표와 같다 (`TaskTable`)
            className="flex w-full cursor-pointer items-center gap-1.5 text-left font-medium transition-colors hover:text-primary"
            title={
              row.unread > 0
                ? `알림 ${row.count}개 · 안 읽은 게 ${row.unread}개`
                : `알림 ${row.count}개`
            }
          >
            <span className="min-w-0 truncate">{row.title}</span>
            {/* 말풍선 + 숫자. 업무명 뒤에 붙는다 — 앞에 두면 줄 번호처럼 읽히고, 알아야 하는
                건 업무명이 먼저다. **면은 두지 않는다** — 칩이 줄마다 서면 표에서 제일 무거운
                게 숫자가 되고, 업무명보다 먼저 읽힌다. 안 읽음/읽음은 색으로만 가른다 */}
            <span
              className={cn(
                "tabular inline-flex shrink-0 items-center gap-1 text-xs font-semibold",
                row.unread > 0 ? "text-primary" : "text-muted-foreground",
              )}
            >
              <IconLastComment size={11} />
              {row.count}
            </span>
          </button>
        ),
      },
      {
        key: "project",
        header: "프로젝트",
        sortable: true,
        width: "18%",
        // 업무 표와 같이 업무명보다 한 톤 흐리다 (`TaskTable`)
        cell: (row) => <span className="text-muted-foreground">{row.project ?? "—"}</span>,
      },
      { key: "lastFrom", header: "부른 사람", sortable: true, width: "16%" },
      {
        key: "lastAt",
        header: "시각",
        sortable: true,
        width: "16%",
        cell: (row) => <span className="tabular">{fmtDateTime(row.lastAt)}</span>,
      },
    ],
    [],
  );

  return (
    <div>
      <Table
        data={rows as MentionTableRow[]}
        columns={columns}
        getRowId={(row) => row.taskId}
        rowHeight={ROW_HEIGHT}
        // 업무 표와 같이 칸 폭을 끌어 바꿀 수 있다 (`TaskTable`)
        resizable
        // 머리 줄이 스크롤 칸 안에 있어서(sticky) 높이에 한 줄 더 얹어야 한다.
        height={
          rows.length === 0
            ? ROW_HEIGHT + 120
            : ROW_HEIGHT * (1 + Math.min(rows.length, maxRows))
        }
        emptyState="새로 부른 사람이 없어요"
        className="rounded-lg"
      />

      {/* 모달 하나를 표가 돌려 쓴다. `viewId`가 업무 번호라 다른 줄을 열면 패널이 높이를
          맞춰 늘었다 줄어든다 — 접히고 다시 펼치지 않는다.
          오른쪽 위 닫기 아이콘은 끈다 — 패널 아래 `닫기` 버튼과 이름이 같아서 화면
          낭독기에 `닫기`가 두 번 읽힌다 (업무 표와 같다) */}
      <MorphingModal
        viewId={open && opened ? opened.taskId : null}
        onClose={close}
        ariaLabel="나를 부른 댓글"
        ariaDescribedBy={opened ? descIdOf(opened) : undefined}
        showCloseButton={false}
        // 업무 표 모달과 같은 폭이다 — 두 표가 나란히 있어서 다르면 어긋나 보인다
        className="max-w-[34rem] lg:max-w-[44rem]"
      >
        {opened && <MentionDetail group={opened} path={path} onClose={close} />}
      </MorphingModal>
    </div>
  );
}

/** 모달 제목의 id. 패널(`aria-describedby`)과 제목이 같은 값을 봐야 한다. */
const descIdOf = (group: MentionTableRow) => `mention-detail-${group.taskId}`;

/**
 * 멘션 상세 모달. 표 줄은 마지막 말 한 줄만 보여주니, 앞뒤 대화는 여기서 읽는다.
 *
 * **본문도 같이 낸다** (v4.9.0 — `loadTaskPost`). 부른 이유는 댓글에 있지만 무슨 일인지는
 * 본문에 있다 — 업무 상세 모달에서 읽던 글을 여기서만 못 읽을 이유가 없다. 본문과 댓글이
 * 한 왕복에서 같이 와서 호출 수는 그대로다.
 *
 * **열면 바로 스레드 전량을 부르고, 접는 건 화면에서만 한다** (v4.2.0 · v4.9.0). 알림은
 * 나를 부른 댓글만 주는데 부른 이유는 대개 그 앞뒤 말에 있다 — 그래서 받는 건 전량이다.
 * 다만 실측 14건 중 10건이 시스템 기록이라 그대로 쌓으면 사람이 남긴 말이 묻혀서, 업무 상세
 * 모달과 같이 최신 두 줄만 펴고 나머지는 `댓글 다 보기`다 (`CommentList`). **나를 부른 줄은
 * 접히지 않고**, 면과 아이콘 색도 올라간다 (`ThreadComment.called` — 본문의 멘션 마크업으로
 * 서버가 표시한다).
 *
 * 못 가져오면 **알림 목록으로 돌아간다.** 알림은 이미 손에 있어서 공짜고, 스레드 한 번
 * 실패했다고 모달이 비면 표에서 보이던 것보다 못한 화면이 된다.
 */
function MentionDetail({
  group,
  path,
  onClose,
}: {
  group: MentionTableRow;
  path: string;
  onClose: () => void;
}) {
  const descId = descIdOf(group);
  const { postId } = group;
  /** 어느 게시글의 결과인지 같이 들고 있는다 — 다른 줄을 열면 앞의 댓글이 잠깐 남는다. */
  const [loaded, setLoaded] = useState<{ postId: string; result: TaskPostResult | null } | null>(
    null,
  );

  // 모달을 열 때 한 번. 다른 줄을 열면 `postId`가 바뀌어 다시 부른다 — 모달 하나를 표가
  // 돌려 써서 컴포넌트가 다시 마운트되지 않는다.
  useEffect(() => {
    if (!postId) return;
    let alive = true;

    loadTaskPost({ postId })
      .catch(() => null)
      .then((result) => {
        if (alive) setLoaded({ postId, result });
      });
    return () => {
      alive = false;
    };
  }, [postId]);

  const post = loaded && loaded.postId === postId ? loaded.result : null;
  /** 아직 오는 중. 실패(`post`가 있는데 `comments`가 없다)와 갈라야 골격을 언제 걷을지 안다. */
  const loading = !!postId && (!loaded || loaded.postId !== postId);

  return (
    <>
      {/* 머리는 업무 상세 모달과 같은 것을 쓴다 (`DetailHeader`) — 같은 표에서 나란히 여는
          두 모달이라 프로젝트명과 제목이 다른 자리에 있으면 줄을 다시 찾아야 한다.
          오른쪽 딱지는 비운다: 알림은 업무번호를 안 준다 (`groupMentions`) */}
      <DetailHeader
        project={group.project ?? "프로젝트 미확인"}
        title={group.title}
        titleId={descId}
      >
        {group.status && <StatusPill status={group.status} />}
        <span>알림 {group.count}개</span>
        {group.unread > 0 && (
          <span className="rounded bg-primary/15 px-1 text-primary">안 읽음 {group.unread}개</span>
        )}
      </DetailHeader>

      {/* 머리와 바닥은 제자리에 두고 알림 목록만 스크롤한다 — 열 몇 번 불린 업무는 패널이
          화면보다 길어지고, 그때 업무명과 `닫기`가 같이 밀려 올라가면 지금 무엇을 보고
          있는지와 나가는 길이 한꺼번에 사라진다. 높이 식은 업무 상세 모달과 같다
          (task-detail-modal.tsx). 아래 선은 이 칸이 이미 갖고 있다.
          면도 업무 상세 모달과 같다 — `bg-card`로 패널보다 한 단 올린다.

          **여백은 이 칸이 아니라 덩어리마다 갖는다** (`TaskThread`와 같다). 여기에 `px-5`를
          두면 본문·댓글을 가르는 선이 양쪽에서 20px씩 물려서, 덩어리를 가르는 선이 아니라
          본문에 그은 밑줄로 읽힌다 */}
      <div className="max-h-[min(60vh,calc(100dvh-16rem))] overflow-y-auto border-b border-border bg-card">
        {/* 본문 — 부른 이유는 댓글에 있지만 무슨 일인지는 본문에 있다. 업무 글은 비어 있는
            경우가 흔해서 (api-spec §6.2) 없으면 덩어리째 뺀다. 모양은 업무 상세 모달과 같다
            (`TaskThread`) — 두 모달에서 같은 글을 읽는다 */}
        {post?.body && (
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs font-semibold text-muted-foreground">본문</p>
            {/* 줄바꿈을 살린다 — 본문이 목록으로 오는 경우가 많다.
                `wrap-anywhere` — 본문에 섞여 오는 링크는 띄어쓰기가 없다 (BUG-025) */}
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line wrap-anywhere">
              <LinkedText text={post.body} />
            </p>
          </div>
        )}

        {/* 댓글 덩어리. 아래 선은 안 그린다 — 감싼 칸이 이미 갖고 있어서 두 겹으로 보인다 */}
        <div className="px-5 py-4">
          {loading ? (
            // 도착하면 이 자리에 글자만 앉는다 — 알림 목록을 먼저 그렸다가 댓글로 갈아 끼우면
            // 같은 말이 자리를 옮겨 다시 서서, 읽던 줄을 눈으로 다시 찾아야 한다
            <>
              <p role="status" className="mb-2 text-xs text-muted-foreground">
                본문과 댓글을 가져오는 중…
              </p>
              {/* 접힌 기본값의 최소 줄 수다 — 도착하면 이 자리에 글자만 앉는다 */}
              <CommentRowsSkeleton count={SHOWN} />
            </>
          ) : post?.comments ? (
            // 접고 펼치는 규칙은 업무 상세 모달과 같다 (`CommentList`) — 최신 두 줄이 기본이고
            // 나머지는 `댓글 다 보기`다. 나를 부른 줄은 접히지 않으니 이 모달의 질문("내가 왜
            // 불렸나")은 펼치지 않아도 답이 나온다 (`tail`)
            <div className="space-y-3">
              <CommentList comments={post.comments} />
            </div>
          ) : (
            <>
              {/* 스레드를 못 가져왔을 때의 자리. 알림은 나를 부른 댓글만이라 앞뒤가 없지만,
                  빈 화면보다는 낫다 */}
              {post && (
                <p role="status" className="mb-2 text-xs text-muted-foreground">
                  {post.message}
                </p>
              )}
              {/* 오래된 것부터 — 대화는 위에서 아래로 읽는다 (그룹 배열은 최신순이다) */}
              <ul className="space-y-3">
                {[...group.alarms].reverse().map((alarm, i) => (
                  <li key={`${alarm.at}-${i}`} className={cn("flex gap-2", alarm.isReply && "ml-5")}>
                    <IconLastComment
                      size={14}
                      className={cn(
                        "mt-0.5 shrink-0",
                        alarm.isReply ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="tabular flex flex-wrap items-baseline gap-x-1.5 text-xs">
                        {/* 이름은 본문색으로. 시각과 같은 회색이면 누가 썼는지가 안 걸린다 */}
                        <span className="font-medium text-foreground">{alarm.from}</span>
                        {alarm.isReply && <span className="text-primary">답글</span>}
                        {alarm.unread && (
                          <span className="rounded bg-primary/15 px-1 text-[11px] text-primary">
                            안 읽음
                          </span>
                        )}
                        <span className="text-muted-foreground">{fmtDateTime(alarm.at)}</span>
                      </p>
                      {alarm.content && (
                        // 줄바꿈은 살린다 — 댓글이 목록 형태로 오는 경우가 많다.
                        // `wrap-anywhere` — 링크가 섞여 와서 안 끊으면 그 덩어리가 최소폭이 된다.
                        <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line wrap-anywhere">
                          {/* 주소는 새 창 링크로 (`LinkedText`) — 알림 내용이 곧 댓글 내용이다 */}
                          <LinkedText text={alarm.content} />
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {/* 읽음 처리 (PRD §13 A2). 스레드는 위에서 이미 펼쳤다 */}
          <MentionActions
            alarmIds={group.alarms.flatMap((alarm) => (alarm.unread && alarm.id ? [alarm.id] : []))}
            unread={group.unread}
            path={path}
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3">
        <FlowLink href={group.link} />
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
    </>
  );
}
