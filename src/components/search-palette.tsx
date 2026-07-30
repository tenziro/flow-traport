"use client";

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
import { searchFlow, type SearchResult } from "@/app/(app)/actions";
import { IconInbox, IconLoader, IconSearch } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { splitHighlight } from "@/lib/flow/search";
import { fmtDateTime } from "@/lib/utils";

/**
 * 검색 팔레트 (PRD §6.4).
 *
 * 화면 셋은 모두 "지금 챙길 일"만 보여 준다 — 지난달 문서를 다시 찾는 길이 없어서 그것만
 * flow로 나가야 했다. 네 번째 화면을 만들지 않고 레이어로 얹은 이유는 검색이 목적지가 아니라
 * 경유지이기 때문이다. `⌘K`로 어디서든 열리고, 찾으면 그 문서로 나가면서 닫힌다.
 *
 * 결과는 프로젝트와 글 두 묶음이다. REST 검색 두 개를 병렬로 부르고(`searchFlow`),
 * 맞은 자리는 flow가 `!#!…!#!`로 표시해 준 것을 그대로 그린다 — 형태소는 flow가 알고
 * 우리는 모른다.
 *
 * 읽기 전용이다. 검색 결과는 내 담당이 아닌 문서까지 포함하므로 여기서 손을 대면 화면 셋이
 * 쥐고 있는 범위가 흐려진다.
 *
 * ponytail: 화살표 키 이동은 없다 — `Tab`이 결과를 그대로 훑고 `Enter`가 연다. 다음 페이지도
 * 없다. 목록이 길어지면 그때 붙인다.
 */
const DEBOUNCE_MS = 300;

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
  const [result, setResult] = useState<SearchResult | null>(null);
  const [pending, startTransition] = useTransition();
  /** 닫을 때 돌려줄 초점. `⌘K`로 열면 트리거를 누른 적이 없어서 여기서 기억해 둔다. */
  const opener = useRef<HTMLElement | null>(null);

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

  // 타이핑이 멎으면 부른다. 글자마다 부르면 검색 두 번이 매 입력마다 나간다.
  // 비우는 것도 타이머 안에서 한다 — 이펙트 본문에서 바로 setState 하면 렌더가 겹친다.
  useEffect(() => {
    const q = word.trim();
    const timer = setTimeout(() => {
      if (q.length < 2) return setResult(null);
      startTransition(async () => setResult(await searchFlow(q)));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [word]);

  const projects = result?.projects ?? [];
  const posts = result?.posts ?? [];

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
            className="fixed top-[10vh] left-1/2 z-30 flex max-h-[min(32rem,75vh)] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out"
          >
            <DialogPrimitive.Title className="sr-only">프로젝트 · 글 검색</DialogPrimitive.Title>

            <div className="flex items-center gap-2.5 border-b border-border px-4">
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
                onChange={(e) => setWord(e.target.value)}
                placeholder="프로젝트명 · 업무명 · 본문으로 찾기"
                aria-label="검색어"
                className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
              />
              <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
                esc
              </kbd>
            </div>

            {pending && projects.length + posts.length === 0 ? (
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
            ) : projects.length + posts.length === 0 ? (
              <p className="flex items-center justify-center gap-2 p-10 text-sm font-medium text-muted-foreground">
                <IconInbox size={16} aria-hidden />
                {/* 결과가 없을 때 할 말은 액션이 들고 온다 — 실패면 flow가 준 사유 그대로,
                    빈 결과면 다음에 할 일이다 (actions.ts) */}
                {result?.message ?? "두 글자 이상 적으면 찾아드려요"}
              </p>
            ) : (
              <div className="overflow-y-auto p-2">
                {projects.length > 0 && (
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

                {posts.length > 0 && (
                  <>
                    <Group>업무 · 글</Group>
                    <ul>
                      {posts.map((post) => (
                        <li key={post.postId}>
                          {/* 딥링크는 눌린 순간 푼다 (`/api/go`) — 결과 여덟 줄을 미리 풀면
                              검색 한 번에 REST 여덟 번이다 */}
                          <Row href={`/api/go/${post.postId}?projectId=${post.projectId}`}>
                            <span className="flex min-w-0 items-baseline justify-between gap-3">
                              <span className="truncate text-sm font-bold">
                                {/* 제목 없는 글이 있다. 본문 첫 줄로 대신하지 않는다 — 아래
                                    발췌에 이미 있어서 같은 문장이 두 번 나온다 */}
                                {post.title ? <Hit text={post.title} /> : "제목 없는 글"}
                              </span>
                              <span className="tabular shrink-0 text-xs text-muted-foreground">
                                {fmtDateTime(post.at)}
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
                          </Row>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </SearchCtx.Provider>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground">{children}</p>
  );
}

/** 결과 한 줄. 소식 카드와 같은 치수·같은 호버다 (news-bell.tsx). */
function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="flex min-w-0 flex-col gap-1 rounded-lg px-2.5 py-2.5 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </a>
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
