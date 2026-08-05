"use client";

import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { searchFlow, searchMorePosts, type SearchResult } from "@/app/(app)/actions";
import { IconInbox, IconLoader, IconRisk, IconSearch } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaskModal } from "@/components/use-task-modal";
import { splitHighlight, stripHighlight } from "@/lib/flow/search";
import { cn, fmtDateTime, fmtDayLabel, fmtTime, hexColor } from "@/lib/utils";

/**
 * 검색 팔레트 (PRD §6.4).
 *
 * 화면 셋은 모두 "지금 챙길 일"만 보여 준다 — 지난달 문서를 다시 찾는 길이 없어서 그것만
 * flow로 나가야 했다. 네 번째 화면을 만들지 않고 레이어로 얹은 이유는 검색이 목적지가 아니라
 * 경유지이기 때문이다. `⌘K`로 어디서든 열린다.
 *
 * 결과는 네 갈래다 — 프로젝트 · 업무·글 · 구성원 · 일정 (api-spec §9.1~9.4). 맞은 자리는
 * flow가 `!#!…!#!`로 표시해 준 것을 그대로 그린다 — 형태소는 flow가 알고 우리는 모른다.
 *
 * **갈래마다 가는 곳이 다르다.** 검색은 경유지라, 그 갈래의 답이 있는 데까지만 데려다준다:
 *
 * | 갈래 | 누르면 | 왜 |
 * |---|---|---|
 * | 업무 · 글 | **이 화면에서 업무 상세 모달** (`useTaskModal`) | 상태·마감일을 여기서 바로 고친다 |
 * | 구성원 | `/members?dept=` — 그 사람의 부서 탭 | 사진·번호·복사 단추가 거기 있다 (§6.6) |
 * | 프로젝트 | flow (새 탭) | 프로젝트 화면이 우리에게 없다 |
 * | 일정 | 안 눌린다 | 나갈 링크 자체가 없다 (`searchEvents`) |
 *
 * 업무가 아닌 글(공지·회의록)은 모달로 못 연다. 그 줄만 flow 링크로 되돌린다 — 알림 목록과
 * 같은 처지고 같은 훅을 쓴다 (news-bell.tsx).
 *
 * 검색 결과 자체는 읽기 전용이다. 내 담당이 아닌 문서까지 포함하므로 목록에서 손을 대면
 * 화면 셋이 쥐고 있는 범위가 흐려진다 — 고치려면 그 업무를 열고 들어가야 한다.
 *
 * 갈래마다 몇 줄씩만 세운다 — 네 갈래가 한 화면에 들어와야 고를 수 있다. 업무·글만 아래에
 * `더 보기`를 단다: 찾던 것이 글일 때는 그 여섯 줄이 상위 여섯일 뿐이라 정작 원한 게 그 아래에
 * 있다. 나머지 셋은 안 단다 — 프로젝트·구성원은 이름으로 찾는 것이라 상위 넷에서 갈리고,
 * 일정은 애초에 누를 수 없는 줄이다.
 *
 * ponytail: `더 보기`는 한 단계뿐이다. 상위 서른 줄에도 없으면 검색어를 고치는 게 빠르다.
 */
const DEBOUNCE_MS = 300;

/** 결과 갈래. `all`은 칩에만 있고 데이터에는 없다. */
type Scope = "all" | "projects" | "posts" | "members" | "events";

const SearchCtx = createContext<(() => void) | null>(null);

/** 검색을 여는 길. 트리거는 화면 폭에 따라 두 자리에 있어서 여는 쪽만 나눠 쓴다. */
export function useSearchOpen() {
  const open = useContext(SearchCtx);
  if (!open) throw new Error("검색 트리거는 <SearchProvider> 안에서만 쓴다");
  return open;
}

/**
 * 팔레트의 주인. 트리거를 품지 않고 여는 함수만 내려 준다 — 넓은 화면에서는 사이드바의
 * 검색 줄이, 좁은 화면에서는 헤더의 아이콘 단추가 트리거다 (`app-shell.tsx`).
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [pending, startTransition] = useTransition();
  /**
   * `더 보기`가 받아 온 업무·글. 있으면 첫 여섯 줄을 **대신한다** — 이어 붙이지 않는다.
   * 같은 검색어를 크게 다시 부른 것이라 앞 여섯이 그대로 다시 들어 있다.
   *
   * 실패도 여기 담긴다(`ok: false` + 사유). `posts`가 없으면 단추는 그대로 남아서 다시 눌린다.
   */
  const [more, setMore] = useState<SearchResult | null>(null);
  const [loadingMore, startMore] = useTransition();
  /** 닫을 때 돌려줄 초점. `⌘K`로 열면 트리거를 누른 적이 없어서 여기서 기억해 둔다. */
  const opener = useRef<HTMLElement | null>(null);
  /** 화살표 이동이 훑을 범위. 입력줄과 칩은 여기 밖이라 안 걸린다. */
  const list = useRef<HTMLDivElement>(null);

  // 레이어는 닫는다 — 모달이 그 위에 겹치면 뒤에 남은 결과가 배경으로 어른거린다.
  const task = useTaskModal(() => setOpen(false));

  const openSearch = useCallback(() => {
    opener.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  // ⌘K(mac) / Ctrl+K. 단축키만 두면 있는 줄 모르니 트리거의 `title`에 이 조합을 적어 둔다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      openSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch]);

  // 타이핑이 멎으면 부른다. 글자마다 부르면 검색 세 번이 매 입력마다 나간다.
  // 비우는 것도 타이머 안에서 한다 — 이펙트 본문에서 바로 setState 하면 렌더가 겹친다.
  useEffect(() => {
    const q = word.trim();
    const timer = setTimeout(() => {
      if (q.length < 2) return setResult(null);
      startTransition(async () => setResult(await searchFlow(q)));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [word]);

  /**
   * `↑`·`↓`로 결과를 훑는다. 줄 목록을 상태로 따로 들지 않고 DOM에서 센다 — 갈래가 넷이고
   * 칩으로 접히기까지 해서, 그리는 순서를 두 군데에 적으면 둘이 어긋난다. 초점이 결과 줄에
   * 가 있으면 `Enter`는 브라우저가 알아서 연다.
   */
  const move = (dir: 1 | -1) => {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>("[data-row]") ?? [])];
    if (!rows.length) return;
    const at = rows.findIndex((row) => row === document.activeElement);
    // 목록 밖(입력줄)에 있으면 `at`이 -1이라 ↓는 첫 줄로, ↑는 마지막 줄로 간다.
    rows[(at + dir + rows.length) % rows.length].focus();
  };

  const projects = result?.projects ?? [];
  const posts = more?.posts ?? result?.posts ?? [];
  const members = result?.members ?? [];
  const events = result?.events ?? [];
  const counts = {
    projects: projects.length,
    posts: posts.length,
    members: members.length,
    events: events.length,
  };
  const total = counts.projects + counts.posts + counts.members + counts.events;
  const shows = (key: Exclude<Scope, "all">) => scope === "all" || scope === key;

  return (
    <SearchCtx.Provider value={openSearch}>
      {children}

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out" />
          {/* 화면 위쪽 1/10에 띄운다 — 가운데 정렬은 결과가 늘어날 때 입력줄이 아래로 밀린다 */}
          <DialogPrimitive.Content
            aria-label="검색"
            // 라딕스는 마지막에 붙은 트리거로 초점을 돌린다. 트리거가 둘이라 넓은 화면에서
            // 닫으면 보이지 않는 쪽(좁은 화면용 단추)으로 가 버린다 — 열기 직전 자리로 되돌린다
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              opener.current?.focus();
            }}
            // 레이어 전체에서 받는다. 초점이 입력줄에 있든 결과 줄에 있든 같은 키가 듣는다.
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              e.preventDefault();
              move(e.key === "ArrowDown" ? 1 : -1);
            }}
            className="fixed top-[10vh] left-1/2 z-30 flex max-h-[min(34rem,78vh)] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out"
          >
            <DialogPrimitive.Title className="sr-only">
              프로젝트 · 글 · 구성원 · 일정 검색
            </DialogPrimitive.Title>

            <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4">
              {pending ? (
                <IconLoader size={18} aria-hidden className="shrink-0 animate-spin text-primary" />
              ) : (
                <IconSearch size={18} aria-hidden className="shrink-0 text-muted-foreground" />
              )}
              {/* beUI Input을 쓰지 않는다 — 떠오르는 라벨과 성공 애니메이션이 붙은 필드라
                  검색줄로 쓰려면 기본값을 계속 덮어야 한다 */}
              <input
                autoFocus
                type="search"
                value={word}
                onChange={(e) => {
                  setWord(e.target.value);
                  // 지난 검색에서 좁혀 둔 갈래를 새 검색어에 물려주지 않는다 — 결과가 있는데도
                  // 빈 목록이 뜬다. 더 받아 둔 글도 같이 버린다 — 앞 검색어의 서른 줄이다.
                  setScope("all");
                  setMore(null);
                }}
                placeholder="프로젝트 · 업무 · 구성원 · 일정 찾기"
                aria-label="검색어"
                className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
              />
              <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
                esc
              </kbd>
            </div>

            {/* 갈래 칩. 이미 받아 둔 결과를 가리기만 한다 — 다시 묻지 않는다. 걸린 갈래가
                하나뿐이면 고를 것이 없어서 줄 자체를 안 세운다 */}
            {Object.values(counts).filter(Boolean).length > 1 && (
              <div
                role="group"
                aria-label="갈래 좁히기"
                className="flex shrink-0 flex-wrap gap-1.5 border-b border-border px-3 py-2.5"
              >
                <Chip active={scope === "all"} count={total} onClick={() => setScope("all")}>
                  전체
                </Chip>
                <Chip
                  active={scope === "projects"}
                  count={counts.projects}
                  onClick={() => setScope("projects")}
                >
                  프로젝트
                </Chip>
                <Chip
                  active={scope === "posts"}
                  count={counts.posts}
                  onClick={() => setScope("posts")}
                >
                  업무 · 글
                </Chip>
                <Chip
                  active={scope === "members"}
                  count={counts.members}
                  onClick={() => setScope("members")}
                >
                  구성원
                </Chip>
                <Chip
                  active={scope === "events"}
                  count={counts.events}
                  onClick={() => setScope("events")}
                >
                  일정
                </Chip>
              </div>
            )}

            {/* 넷 중 일부만 못 왔을 때. 결과가 있으면 빈 상태 문구가 안 뜨므로 여기서 밝힌다 —
                안 밝히면 그 갈래에 결과가 "없는" 것으로 읽힌다 */}
            {total > 0 && result?.missing && (
              <p className="flex shrink-0 items-center gap-1.5 border-b border-border bg-secondary px-4 py-2 text-xs text-muted-foreground">
                <IconRisk size={12} aria-hidden className="shrink-0" />
                {result.missing} 쪽은 지금 못 가져왔어요.
              </p>
            )}

            {pending && total === 0 ? (
              /* 찾는 동안 결과 줄과 같은 모양을 세운다. `찾고 있어요` 한 줄이던 자리인데,
                 글자만 있으면 레이어 높이가 결과가 올 때 열 배로 뛰었다 — 세 줄을 미리
                 세우면 그만큼은 이미 자리를 잡고 있다. 도는 표시는 입력줄 왼쪽에 있다.
                 이미 결과가 떠 있는 채로 다시 찾을 때는 이 골격을 세우지 않는다 — 있던
                 결과를 지우고 회색 줄로 바꾸는 건 뒤로 가는 것이다 */
              <div className="p-2">
                <Skeleton className="mx-2.5 mt-2 mb-1 h-3 w-16" />
                <ul>
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex flex-col gap-1 px-2.5 py-2.5">
                      <span className="flex items-baseline justify-between gap-3">
                        <Skeleton className={i % 2 ? "h-4 w-1/3" : "h-4 w-1/2"} />
                        <Skeleton className="h-3 w-20 shrink-0" />
                      </span>
                      <Skeleton className="h-3 w-2/5" />
                      <Skeleton className="h-3.5 w-full" />
                    </li>
                  ))}
                </ul>
              </div>
            ) : total === 0 ? (
              <p className="flex items-center justify-center gap-2 p-10 text-sm font-medium text-muted-foreground">
                <IconInbox size={16} aria-hidden />
                {/* 결과가 없을 때 할 말은 액션이 들고 온다 — 실패면 그 사유를, 빈 결과면
                    다음에 할 일이다 (actions.ts) */}
                {result?.message ?? "두 글자 이상 적으면 찾아드려요"}
              </p>
            ) : (
              <div ref={list} className="overflow-y-auto p-2">
                {shows("projects") && projects.length > 0 && (
                  <>
                    <Group>프로젝트</Group>
                    <ul>
                      {projects.map((p) => (
                        <li key={p.projectId}>
                          {/* 프로젝트에는 짧은 링크가 없다. 이 URL은 flow 세션이 없으면 대상을
                              잃는다 — 초대 URL(`INVT_URL`)은 남을 들이는 링크라 쓰지 않는다 */}
                          <Row href={`https://flow.team/main.act?projectId=${p.projectId}`}>
                            <span className="flex min-w-0 items-baseline justify-between gap-3">
                              <span className="truncate text-sm font-bold">
                                <Hit text={p.title} />
                              </span>
                              <span className="tabular shrink-0 text-xs text-muted-foreground">
                                {p.participantCount}명
                              </span>
                            </span>
                          </Row>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {shows("posts") && posts.length > 0 && (
                  <>
                    <Group>업무 · 글</Group>
                    <ul>
                      {posts.map((post) => {
                        /* 딥링크는 눌린 순간 푼다 (`/api/go`) — 결과 여섯 줄을 미리 풀면
                           검색 한 번에 REST 여섯 번이다. 모달을 못 여는 줄이 돌아갈 자리이자,
                           모달 발의 `flow에서 보기`가 쓸 주소이기도 하다 */
                        const away = `/api/go/${post.postId}?projectId=${post.projectId}`;
                        const stuck = task.failed === post.postId;
                        const body = (
                          <>
                            <span className="flex min-w-0 items-baseline justify-between gap-3">
                              <span className="truncate text-sm font-bold">
                                {/* 제목 없는 글이 있다. 본문 첫 줄로 대신하지 않는다 — 아래
                                    발췌에 이미 있어서 같은 문장이 두 번 나온다 */}
                                {post.title ? <Hit text={post.title} /> : "제목 없는 글"}
                              </span>
                              <span className="tabular shrink-0 text-xs text-muted-foreground">
                                {/* 여는 동안 날짜 자리가 진행을 말한다 — 목록이 그대로 있는
                                    채로 한 박자 기다리게 되는데, 아무 반응이 없으면 안 눌린
                                    줄 알고 또 누른다 (news-bell과 같다) */}
                                {task.opening === post.postId ? "여는 중…" : fmtDateTime(post.at)}
                              </span>
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              <Hit text={post.project} />
                              {post.registerName && ` · ${post.registerName}`}
                            </span>
                            {post.content && (
                              <span className="line-clamp-2 text-[13px]">
                                <Hit text={post.content} />
                              </span>
                            )}
                            {stuck && (
                              <span className="text-xs text-danger-foreground">
                                여기서는 못 열어요 — 한 번 더 누르면 flow에서 열려요
                              </span>
                            )}
                          </>
                        );

                        return (
                          <li key={post.postId}>
                            {stuck ? (
                              <Row href={away}>{body}</Row>
                            ) : (
                              <Row
                                busy={task.opening === post.postId}
                                onClick={() =>
                                  task.open({
                                    projectId: post.projectId,
                                    postId: post.postId,
                                    // 하이라이트 마커가 붙은 채로 넘기면 업무명이 안 맞는다.
                                    title: stripHighlight(post.title),
                                    project: stripHighlight(post.project),
                                    url: away,
                                  })
                                }
                              >
                                {body}
                              </Row>
                            )}
                          </li>
                        );
                      })}

                      {/* flow가 `hasNext`로 답한 경우에만 세운다 — 줄 수로 짐작하면 딱 여섯
                          건인 검색에도 단추가 붙어서, 눌러 봐야 같은 여섯 줄이다 */}
                      {result?.hasMorePosts && !more?.posts && (
                        <li className="px-2.5 pt-1 pb-1.5">
                          <button
                            type="button"
                            data-row
                            disabled={loadingMore}
                            aria-busy={loadingMore}
                            onClick={() =>
                              startMore(async () => {
                                const next = await searchMorePosts(word);
                                setMore(next);
                                // 서른 줄이 오면 나머지 셋이 그 아래로 묻힌다. 갈래를 같이
                                // 좁혀 두면 목록이 글만 남고, 되돌리는 건 칩 한 번이다.
                                if (next.posts?.length) setScope("posts");
                              })
                            }
                            className="w-full rounded-lg border border-border px-2.5 py-2 text-center text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                          >
                            {loadingMore ? "찾는 중…" : "업무 · 글 더 보기"}
                          </button>
                          {more?.message && (
                            <p className="mt-1.5 text-center text-xs text-danger-foreground">
                              {more.message}
                            </p>
                          )}
                        </li>
                      )}
                    </ul>
                  </>
                )}

                {shows("members") && members.length > 0 && (
                  <>
                    <Group>구성원</Group>
                    <ul>
                      {members.map((m) => (
                        <li key={m.email}>
                          {/* 얼굴은 안 붙인다 — 네 갈래의 줄 모양이 같아야 화살표가 어디로 갈지
                              예측된다. 사진·번호·복사 단추는 구성원 화면에 있어서 그리로 보낸다.
                              전체 13명 격자가 아니라 **그 사람의 부서 탭**이다 — 방금 고른
                              사람을 다시 눈으로 찾게 하지 않는다 (§6.6) */}
                          <Row
                            to={`/members?dept=${encodeURIComponent(m.division)}`}
                            onClick={() => setOpen(false)}
                          >
                            <span className="flex min-w-0 items-baseline justify-between gap-3">
                              <span className="truncate text-sm font-bold">{m.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {m.division}
                              </span>
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {m.title && `${m.title} · `}
                              {m.email}
                            </span>
                          </Row>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {shows("events") && events.length > 0 && (
                  <>
                    <Group>일정</Group>
                    <ul>
                      {events.map((e) => {
                        const color = hexColor(e.eventColor, e.calendarColor);
                        return (
                          // 누를 수 없는 줄이다 — 검색 응답에 프로젝트도 글도 없어서 나갈 곳이
                          // 없다 (`searchEvents`). "그게 언제였지"는 이 줄에서 이미 끝난다
                          <li key={e.eventSrno} className="flex min-w-0 gap-2.5 px-2.5 py-2.5">
                            <span
                              aria-hidden
                              className="w-0.5 shrink-0 self-stretch rounded-full bg-border"
                              style={color ? { background: color } : undefined}
                            />
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="flex min-w-0 items-baseline justify-between gap-3">
                                <span className="truncate text-sm font-bold">
                                  <Hit text={e.eventName} />
                                </span>
                                <span className="tabular shrink-0 text-xs text-muted-foreground">
                                  {eventWhen(e)}
                                </span>
                              </span>
                              {e.calendarName && (
                                <span className="truncate text-xs text-muted-foreground">
                                  {e.calendarName}
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* 키 안내. 화살표 이동은 눌러 보기 전에는 있는 줄 모른다 */}
            {total > 0 && (
              <p className="hidden shrink-0 items-center gap-1.5 border-t border-border px-4 py-2 text-[11px] text-muted-foreground sm:flex">
                <Key>↑</Key>
                <Key>↓</Key>
                <span className="mr-1.5">이동</span>
                <Key>↵</Key>
                열기
                <span className="tabular ml-auto">{total}건</span>
              </p>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* 레이어 밖이다 — 검색이 닫히면서 같이 사라지면 안 된다 */}
      {task.modal}
    </SearchCtx.Provider>
  );
}

/** `20260812…` → `8.12 (수) 14:00`. 종일이면 시각 대신 그 말을, 여러 날이면 끝나는 날을 적는다. */
function eventWhen(event: { start: string; finish: string; allDayYn: string }): string {
  const day = fmtDayLabel(event.start);
  if (event.allDayYn === "Y") return `${day} 종일`;
  // 창이 아홉 달이라 같은 달이 두 번 오지 않는다 — 연도 없이도 어느 날인지 헷갈리지 않는다.
  if (event.start.slice(0, 8) !== event.finish.slice(0, 8)) {
    return `${day} → ${fmtDayLabel(event.finish)}`;
  }
  return `${day} ${fmtTime(event.start)}`;
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground">{children}</p>
  );
}

/** 갈래 칩. 걸린 게 없는 갈래는 눌러 봐야 빈 목록이라 아예 막는다. */
function Chip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={count === 0}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground enabled:hover:bg-accent",
      )}
    >
      {children}
      {/* 골라진 칩은 글자색이 반전되므로 색이 아니라 투명도로 낮춘다 (`/members`와 같다) */}
      <span className="tabular ml-1.5 opacity-70">{count}</span>
    </button>
  );
}

/** 안내줄의 키 한 칸. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex size-5 items-center justify-center rounded border border-border font-medium text-foreground">
      {children}
    </kbd>
  );
}

/**
 * 결과 한 줄. 소식 카드와 같은 치수·같은 호버다 (news-bell.tsx).
 *
 * 가는 곳이 셋이라 껍데기도 셋인데 **모양은 하나다** — 화살표로 훑을 때 줄마다 높이나 여백이
 * 달라지면 어디까지 왔는지 놓친다. `href`·`to`·`onClick` 중 하나만 준다.
 *
 * `data-row`가 화살표 이동이 세는 표식이다 — 붙은 줄만 훑는다. 셋 다 `Enter`는 브라우저가
 * 알아서 처리한다 (링크는 따라가고 단추는 눌린다).
 */
function Row({
  href,
  to,
  onClick,
  busy,
  children,
}: {
  /** flow로 나가는 주소. 새 탭이다. */
  href?: string;
  /** 앱 안의 경로. `Link`라 껍데기를 다시 세우지 않는다. */
  to?: string;
  /** 단추 모드의 동작. `to`와 같이 주면 떠나기 전에 부른다 (레이어를 닫는 자리다). */
  onClick?: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const shape =
    "flex w-full min-w-0 flex-col gap-1 rounded-lg px-2.5 py-2.5 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50";

  if (to) {
    return (
      <Link data-row href={to} onClick={onClick} className={shape}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a data-row href={href} target="_blank" rel="noreferrer noopener" className={shape}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" data-row aria-busy={busy} onClick={onClick} className={shape}>
      {children}
    </button>
  );
}

/** flow가 표시해 준 맞은 자리. 마커를 지우지 않고 쪼개서 그린다 (`splitHighlight`). */
function Hit({ text }: { text: string }) {
  return (
    <>
      {splitHighlight(text).map((part, i) =>
        // 같은 문자열에서 갈라진 조각이라 순서가 곧 신원이다 — 인덱스가 키로 맞다.
        part.hit ? (
          <mark key={i} className="rounded-sm bg-primary/20 px-0.5 font-semibold text-foreground">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
