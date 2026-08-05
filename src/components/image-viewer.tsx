"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconClose, IconOpen } from "@/components/icons";
import type { PostFile } from "@/lib/flow/rest";

/** 둥근 단추 하나. 세 개가 같은 모양이라 클래스를 한 곳에 둔다 (44px — 손가락 최소 크기). */
const BTN =
  "absolute grid size-11 place-items-center rounded-full bg-card/85 text-foreground shadow-sm backdrop-blur-sm transition-colors outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40";

/**
 * 첨부 이미지 뷰어. 썸네일을 누르면 그 자리에서 원본을 크게 본다.
 *
 * **네이티브 `<dialog>`다.** 이 뷰어는 이미 열려 있는 업무 모달 *위*에 떠야 하는데
 * `MorphingModal`을 겹쳐 쓰면 둘이 같이 무너진다: Escape·Tab을 둘 다 `window`에 걸어 둬서
 * Escape 한 번에 둘이 닫히고, 층도 둘 다 `z-[100]`이라 안 갈린다. `showModal()`은 브라우저의
 * top layer라 z-index 다툼이 없고 초점 가두기·뒷배경 비활성이 브라우저 몫이다. 키만 우리가
 * 끊는다 (아래 이펙트).
 *
 * 원본은 썸네일과 **같은 호스트**다 (`flow.team/flowImg/**` — 이미 허용 호스트다). 그래서
 * `next/image`가 그대로 최적화한다: 8MB짜리 5712×4284 사진도 화면 폭에 맞게 줄여 받는다.
 */
export function ImageViewer({
  files,
  at,
  onClose,
}: {
  /** 이미지 첨부만. 배열 순서가 곧 앞뒤로 넘기는 순서다. */
  files: PostFile[];
  /** 처음 볼 장의 자리. */
  at: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [i, setI] = useState(at);
  const last = files.length - 1;
  const file = files[i];

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    /**
     * 업무 모달도 `window`에 Escape·Tab을 걸어 둔다. 여기서 끊지 않으면 Escape 한 번에 둘이
     * 닫히고 Tab이 뒤쪽 모달로 초점을 끌어간다. **잡기 단계**로 걸어서 그쪽(거품 단계)보다
     * 먼저 돈다.
     *
     * 닫기는 브라우저에 안 맡기고 직접 부른다 — 브라우저 몫의 닫기는 `preventDefault`에
     * 취소되는데, 그 `preventDefault`가 여기서는 필요하다.
     */
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        ref.current?.close();
      } else if (event.key === "Tab") {
        event.stopPropagation();
      } else if (event.key === "ArrowLeft") {
        setI((n) => Math.max(0, n - 1));
      } else if (event.key === "ArrowRight") {
        setI((n) => Math.min(last, n + 1));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [last]);

  if (!file) return null;

  /** 사진 **밖**을 눌렀을 때만 닫는다 — 사진·단추를 누르면 대상이 그쪽이라 안 걸린다. */
  const dismiss = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={`첨부 이미지 ${i + 1} / ${files.length}`}
      className="viewer fixed inset-0 m-0 h-dvh w-full max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-background/80 backdrop:backdrop-blur-sm"
    >
      <div onClick={dismiss} className="flex h-full w-full flex-col gap-3 px-4 py-16">
        {/*
         * 사진 칸은 남는 높이를 다 먹고(`flex-1`) 캡션 몫만 남긴다. `min-h-0`이 있어야
         * 줄어든다 — flex 항목의 기본 최소 높이는 내용 크기라 세로로 긴 사진이 칸을
         * 밀어내고 캡션을 화면 밖으로 보낸다.
         */}
        <div onClick={dismiss} className="flex min-h-0 flex-1 items-center justify-center">
          {/* 자리는 `WIDTH`·`HEIGHT`로 미리 잡는다 — 도착할 때 화면이 안 튄다.
              장을 넘기면 `key`로 갈아 끼워서 앞 장이 남아 보이지 않는다 */}
          <Image
            key={file.url}
            src={file.url}
            alt={file.name}
            width={file.w || 1600}
            height={file.h || 1200}
            sizes="90vw"
            className="h-auto max-h-full w-auto max-w-full rounded-md object-contain"
          />
        </div>

        {/* 이름·자리·원본. 배경이 사진이라 면을 깔아야 글씨가 읽힌다 */}
        <p className="mx-auto flex max-w-full items-center gap-2 rounded-md bg-card/85 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          <span className="min-w-0 truncate">{file.name}</span>
          {files.length > 1 && (
            <span className="tabular shrink-0">
              {i + 1}/{files.length}
            </span>
          )}
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex shrink-0 items-center gap-1 text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
          >
            원본 열기
            <IconOpen size={11} aria-hidden />
            <span className="sr-only">(새 창)</span>
          </a>
        </p>
      </div>

      <button
        type="button"
        aria-label="닫기"
        onClick={() => ref.current?.close()}
        className={`${BTN} top-3 right-3`}
      >
        <IconClose size={18} aria-hidden />
      </button>

      {/* 한 장뿐이면 넘길 곳이 없다 */}
      {files.length > 1 && (
        <>
          <button
            type="button"
            aria-label="이전 이미지"
            disabled={i === 0}
            onClick={() => setI((n) => Math.max(0, n - 1))}
            className={`${BTN} top-1/2 left-3 -translate-y-1/2`}
          >
            <IconChevronLeft size={20} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="다음 이미지"
            disabled={i === last}
            onClick={() => setI((n) => Math.min(last, n + 1))}
            className={`${BTN} top-1/2 right-3 -translate-y-1/2`}
          >
            <IconChevronRight size={20} aria-hidden />
          </button>
        </>
      )}
    </dialog>
  );
}
