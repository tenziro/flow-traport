"use client";

import Image from "next/image";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";
import { IconCheck, IconClose, IconInbox, IconSearch } from "@/components/icons";
import { Button } from "@/components/motion/button/base";
import { Skeleton } from "@/components/ui/skeleton";
import type { Participant } from "@/lib/flow/rest";
import { cn } from "@/lib/utils";

/**
 * 담당자 고르기 모달 (PRD §6.1.4).
 *
 * 다섯 줄 중 담당자만 레이어가 아니라 모달이다. 후보가 프로젝트에 따라 3~41명이라 값 아래
 * 레이어에 담을 수 없고, 켜고 끄기를 여러 번 한 뒤 한 번에 저장해야 한다 — flow 쓰기가
 * 덮어쓰기라서 켜다 만 상태로 나가면 남의 담당까지 떨어진다.
 *
 * 왼쪽은 그 프로젝트에서 고를 수 있는 사람 전부 + 이름 찾기, 오른쪽은 지금 켠 사람이다.
 * 왼쪽은 **구성원과 외부인 두 무리**로 갈라 세운다 (`Group`).
 * 켠 사람을 따로 보여 주는 이유는 왼쪽 목록이 41줄까지 가기 때문이다 — 스크롤을 내리면
 * 위에서 켠 사람이 화면에서 사라진다.
 *
 * 한 줄에 **얼굴·이름·직책·부서**가 선다 — 댓글의 부를 사람 목록과 같은 표현이다
 * (`task-actions.tsx`). 참여자 조회 자체는 이름과 id뿐이지만(api-spec §5.4) 전사 명단에서
 * 맞춰 붙인 값이 이미 실려 온다 (`participantsOf`) — 여기서 더 부를 것이 없다. 41줄에서
 * 동명이인을 가르는 게 직책·부서고, 얼굴은 이름보다 빨리 찾힌다.
 *
 * `MorphingModal`을 겹치지 않는다 — 그건 표의 한 행에서 자라나는 모달이고(공유 레이아웃
 * 애니메이션), 여는 자리가 없는 이 모달까지 그 틀에 넣으면 어디서 자라야 할지가 없다.
 * 라딕스 `Dialog`는 초점 가두기·`aria-modal`·Portal·Escape를 다 갖고 있다.
 */
export function WorkerPicker({
  open,
  onOpenChange,
  candidates,
  loading,
  picked,
  pending,
  note,
  title = "담당자 변경",
  onToggle,
  onClear,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 그 프로젝트에서 고를 수 있는 사람 전부 (`listParticipants`). */
  candidates: readonly Participant[];
  /** 후보를 부르는 중. */
  loading: boolean;
  /** 지금 켠 userId. 주인은 부모다 — 닫아도 사라지지 않고 실패하면 그대로 다시 보낸다. */
  picked: readonly string[];
  /** 저장 중. */
  pending: boolean;
  /** 아래 줄에 적을 주의. 덮어쓰기라는 사실과 누락된 담당자를 알린다. */
  note?: string;
  /** 머리글. 아직 없는 업무의 담당자를 정할 때는 바꾸는 게 아니다 (`new-task-form.tsx`). */
  title?: string;
  onToggle: (userId: string) => void;
  onClear: () => void;
  onConfirm: () => void;
}) {
  const [word, setWord] = useState("");
  const q = word.trim().toLowerCase();
  /* 화면에 적힌 것으로 찾는다 — 이름·직책·부서 셋 다 줄에 보이는 값이라, 보이는 글자를 쳤는데
     안 걸리면 없는 사람으로 읽힌다. `플랫폼개발팀`으로 팀 사람만 추려 켜는 게 실제 쓰임이다.
     `userId`(이메일)는 안 뒤진다 — 줄에 없는 값이라 왜 걸렸는지가 안 보인다 */
  const shown = q
    ? candidates.filter((p) =>
        [p.name, p.title, p.division].some((v) => v?.toLowerCase().includes(q)),
      )
    : candidates;
  /** 오른쪽 목록. 왼쪽 순서를 그대로 따라간다 — 켠 순서로 쌓으면 같은 사람이 매번 다른 자리다. */
  const chosen = candidates.filter((p) => picked.includes(p.userId));

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        // 찾던 말은 닫을 때 버린다. 남겨 두면 다음에 열었을 때 목록이 잘린 채로 보인다.
        if (!next) setWord("");
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        {/* 업무 상세 모달(`z-[100]` — morphing-modal)보다 위다. 이 덮개가 그 모달의 배경까지
            가려야 한다 — 안 가리면 여기서 밖을 누른 클릭이 그 배경에 닿아 업무 모달까지 닫힌다 */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />
        <DialogPrimitive.Content
          /* Escape는 여기서 멈춘다 — 업무 상세 모달도 `window`에서 Escape를 듣고 있어서,
             그냥 두면 이 모달을 닫으려고 누른 키가 그 모달까지 통째로 닫는다 */
          onEscapeKeyDown={(event) => event.stopPropagation()}
          className="fixed top-1/2 left-1/2 z-[120] flex max-h-[min(30rem,calc(100dvh-4rem))] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in"
        >
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <DialogPrimitive.Title className="text-sm font-bold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="닫기"
              className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <IconClose size={16} aria-hidden />
            </DialogPrimitive.Close>
          </header>

          {/* 좁은 화면에서는 위아래로 쌓는다 — 두 열을 그대로 두면 한 열이 두 글자 폭이다 */}
          <div className="flex min-h-0 flex-1 flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-2 px-3 py-2">
                <IconSearch size={15} aria-hidden className="shrink-0 text-muted-foreground" />
                {/* beUI Input을 쓰지 않는다 — 떠오르는 라벨과 성공 애니메이션이 붙은 필드라
                    찾기줄로 쓰려면 기본값을 계속 덮어야 한다 (search-palette와 같은 이유) */}
                <input
                  value={word}
                  onChange={(event) => setWord(event.target.value)}
                  placeholder="이름 · 직책 · 부서 찾기"
                  aria-label="이름 · 직책 · 부서 찾기"
                  className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5">
                {loading ? (
                  /* 올 것은 이름 줄 묶음이다. 다섯 줄이면 제일 적은 프로젝트(실측 5명)만큼은
                     자리를 잡아서, 도착하는 순간 목록이 뛰지 않는다. 높이는 이름 + 부서
                     두 줄짜리에 맞춘다 */
                  <div className="flex flex-col gap-1" aria-busy="true" aria-label="불러오는 중">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : shown.length === 0 ? (
                  <p className="flex items-center justify-center gap-1.5 p-8 text-center text-xs text-muted-foreground">
                    <IconInbox size={14} aria-hidden />
                    {candidates.length === 0 ? "고를 수 있는 사람이 없어요" : "찾는 이름이 없어요"}
                  </p>
                ) : (
                  <>
                    <Group
                      title="구성원"
                      people={shown.filter((p) => !p.outside)}
                      picked={picked}
                      onToggle={onToggle}
                    />
                    <Group
                      title="외부인"
                      people={shown.filter((p) => p.outside)}
                      picked={picked}
                      onToggle={onToggle}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-xs font-semibold">{picked.length}명 선택</span>
                <button
                  type="button"
                  onClick={onClear}
                  disabled={picked.length === 0}
                  className="cursor-pointer rounded text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                >
                  전체 지우기
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
                {chosen.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">
                    왼쪽에서 담당자를 골라주세요
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {chosen.map((person) => (
                      <li
                        key={person.userId}
                        className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
                      >
                        {/* 켠 사람 쪽은 이름만이다 — 왼쪽에서 이미 가려 낸 사람이라
                            여기서 다시 가릴 일이 없고, 칸이 좁아 두 줄이 되면 오른쪽이
                            왼쪽보다 길어진다 */}
                        <Face person={person} />
                        <span className="min-w-0 flex-1 truncate text-sm">{person.name}</span>
                        <button
                          type="button"
                          aria-label={`${person.name} 빼기`}
                          onClick={() => onToggle(person.userId)}
                          className="shrink-0 cursor-pointer rounded text-muted-foreground transition-colors hover:text-danger-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <IconClose size={14} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
            {note && (
              <span className="mr-auto min-w-0 flex-1 text-xs text-warning-foreground">{note}</span>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              닫기
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={picked.length === 0 || pending}
              onClick={onConfirm}
            >
              {pending ? "저장 중…" : "확인"}
            </Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * 한 무리의 후보들. 없으면 이름표도 안 세운다 — 외부인이 0명인 프로젝트가 있다.
 *
 * **우리 사람과 고객사를 갈라 놓는다.** 실측으로 참여자 90명 중 77명이 고객사라, 섞어 두면
 * 담당을 맡길 우리 팀이 그 사이에 파묻힌다 (참여자 칸과 같은 이유 — `ProjectPanel`).
 *
 * 이름표는 스크롤에 붙어 따라온다(`sticky`). 41줄을 내리는 동안 지금 보는 줄이 어느 무리인지가
 * 위로 사라지면, 고객사 사람을 우리 팀으로 보고 켜기 쉽다. 판 색(`bg-card`)을 그대로 깔아서
 * 아래 줄이 이름표를 뚫고 지나가지 않게 한다.
 */
function Group({
  title,
  people,
  picked,
  onToggle,
}: {
  title: string;
  people: readonly Participant[];
  picked: readonly string[];
  onToggle: (userId: string) => void;
}) {
  if (!people.length) return null;
  return (
    <>
      <p className="sticky top-0 z-10 bg-card px-2 py-1.5 text-xs font-medium text-muted-foreground">
        {title} {people.length}명
      </p>
      <ul>
        {people.map((person) => {
          const on = picked.includes(person.userId);
          return (
            <li key={person.userId}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(person.userId)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  on && "bg-accent",
                )}
              >
                <Face person={person} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm">
                    {person.name}
                    {/* 직책·부서는 동명이인을 가르는 값이다. 없는 사람도 있어서 있을 때만
                        붙인다 (외부인은 명단에 아예 없다) */}
                    {person.title && (
                      <span className="ml-1 text-xs opacity-70">{person.title}</span>
                    )}
                  </span>
                  {person.division && (
                    <span className="mt-0.5 block truncate text-[11px] opacity-60">
                      {person.division}
                    </span>
                  )}
                </span>
                {/* 켬을 배경색만으로 말하지 않는다 */}
                {on && <IconCheck size={14} aria-hidden className="shrink-0 text-primary" />}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * 얼굴 사진. 목록 왼쪽 끝을 맞춰서 41줄을 눈으로 훑을 수 있게 한다.
 *
 * 사진이 없는 사람이 있다 (실측 13명 중 4명) — 그때는 이름 첫 글자 원판이다. 참여자 칸·부를
 * 사람 목록과 같은 표현이다 (`ProjectPanel`·`task-actions.tsx`).
 *
 * 이름을 안 읽는다 — 바로 옆에 글자로 있어서 읽어 주면 두 번 부른다.
 */
function Face({ person }: { person: Participant }) {
  return person.photo ? (
    <Image
      src={person.photo}
      alt=""
      width={28}
      height={28}
      className="size-7 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"
    >
      {person.name.slice(0, 1)}
    </span>
  );
}
