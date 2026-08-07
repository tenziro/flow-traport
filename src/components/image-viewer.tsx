"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconOpen,
  IconZoomIn,
  IconZoomOut,
} from "@/components/icons";
import type { PostFile } from "@/lib/flow/rest";

/** 둥근 단추 하나. 다섯 개가 같은 모양이라 클래스를 한 곳에 둔다 (44px — 손가락 최소 크기). */
const BTN =
  "absolute grid size-11 place-items-center rounded-full bg-card/85 text-foreground shadow-sm backdrop-blur-sm transition-colors outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40";

/**
 * 배율 칸. 자유 배율(× 1.5씩) 대신 칸으로 둔 건 **읽히는 숫자**를 쓰기 위해서다 —
 * 곱하기로 가면 100 → 150 → 225 → 338%가 되고, 그 숫자는 아무 뜻이 없다.
 *
 * 4배에서 멈춘다. 원본이 화면 폭보다 크면 4배로 이미 원본 픽셀을 넘고, 더 당기면
 * 뭉개진 그림을 크게 볼 뿐이다. 그 위는 `원본 열기`가 낫다.
 */
const ZOOMS = [1, 1.5, 2, 3, 4];

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
  /** 지금 배율의 `ZOOMS` 자리. 0이 화면에 맞춘 상태다. */
  const [z, setZ] = useState(0);
  const last = files.length - 1;
  const lastZ = ZOOMS.length - 1;
  const file = files[i];
  const zoom = ZOOMS[z] ?? 1;

  /**
   * 앞뒤로 넘기기. **배율도 같이 되돌린다** — 앞 장에서 4배로 당겨 둔 채 다음 장이 열리면
   * 화면에 그 사진의 한 귀퉁이만 있어서 무엇이 왔는지 모른다. 넘기기는 "다음 걸 보자"지
   * "같은 데를 보자"가 아니다. 끝에서는 아무것도 안 한다 — 배율만 초기화되면 안 된다.
   */
  const step = useCallback(
    (d: number) => {
      const next = Math.max(0, Math.min(last, i + d));
      if (next === i) return;
      setI(next);
      setZ(0);
    },
    [i, last],
  );

  useEffect(() => {
    /**
     * **정리에서 `close()`를 부르면 안 된다** (BUG-049). `close()`는 `close` 이벤트를 쏘고
     * 그게 `onClose` → 부모의 `setViewing(null)`로 이어져 뷰어가 스스로 언마운트한다.
     * dev의 StrictMode는 붙일 때 이펙트를 한 번 접었다 펴는데, 그 한 번의 정리에 뷰어가
     * 열렸다 바로 사라졌다 — 눌러도 안 열리는 것처럼 보인다.
     *
     * 떼는 건 브라우저 몫이다: 모달 `<dialog>`를 문서에서 지우면 top layer에서 같이 내려가고
     * `close` 이벤트는 안 난다. 이미 열려 있으면 `showModal()`은 그냥 돌아온다(spec).
     */
    ref.current?.showModal();
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
        step(-1);
      } else if (event.key === "ArrowRight") {
        step(1);
      } else if (event.key === "+" || event.key === "=") {
        // `=`도 받는다 — 숫자열의 `+`는 Shift를 눌러야 나오는 자리다
        setZ((n) => Math.min(lastZ, n + 1));
      } else if (event.key === "-") {
        setZ((n) => Math.max(0, n - 1));
      } else if (event.key === "0") {
        setZ(0);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [step, lastZ]);

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
        {/*
         * 당긴 사진은 **여기서 굴려서** 본다 — 끌어서 옮기는 코드를 안 쓴다. 스크롤은
         * 브라우저 몫이라 휠·트랙패드·터치·키보드가 전부 그냥 되고, 손으로 만든 드래그는
         * 그중 하나만 된다. 가운데 맞추기는 `items-center`가 아니라 사진의 `m-auto`다 —
         * flex 정렬은 내용이 칸보다 클 때 위·왼쪽을 잘라 먹어서 당긴 사진의 그쪽 끝에
         * 영영 못 닿는다.
         */}
        <div onClick={dismiss} className="flex min-h-0 flex-1 overflow-auto">
          {/* 자리는 `WIDTH`·`HEIGHT`로 미리 잡는다 — 도착할 때 화면이 안 튄다.
              장을 넘기면 `key`로 갈아 끼워서 앞 장이 남아 보이지 않는다 */}
          <Image
            key={file.url}
            src={file.url}
            alt={file.name}
            width={file.w || 1600}
            height={file.h || 1200}
            /* 배율만큼 큰 그림을 받는다 — 같은 그림을 늘리면 당길수록 뭉개진다.
               `next/image`가 이 값으로 srcset에서 고른다 (100vw를 넘겨도 된다) */
            sizes={`${Math.round(90 * zoom)}vw`}
            /* 배율은 `transform: scale`이 아니라 CSS `zoom`이다 — scale은 자리를 안 넓혀서
               위 칸이 굴러갈 곳이 안 생긴다 */
            style={zoom > 1 ? { zoom } : undefined}
            /* 두 번 누르면 당겼다 놓는다. 뷰어를 처음 여는 사람도 아는 손짓이다 */
            onDoubleClick={() => setZ((n) => (n > 0 ? 0 : 2))}
            className="m-auto h-auto max-h-full w-auto max-w-full rounded-md object-contain"
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
          {/* 화면에 맞춘 상태(100%)에서는 안 적는다 — 늘 있는 숫자는 아무 말도 안 한다.
              `aria-live` — 단추를 눌렀을 때 지금 배율이 소리로도 나가야 한다 */}
          {zoom > 1 && (
            <span aria-live="polite" className="tabular shrink-0 text-foreground">
              {zoom * 100}%
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

      {/* 배율 단추. 닫기와 마주 보는 왼쪽 위다 — 앞뒤로 넘기는 단추(가운데 양옆)와 자리가
          안 겹치고, 사진을 가리는 면적이 위아래 어느 쪽으로도 안 는다 */}
      <button
        type="button"
        aria-label="축소"
        disabled={z === 0}
        onClick={() => setZ((n) => Math.max(0, n - 1))}
        className={`${BTN} top-3 left-3`}
      >
        <IconZoomOut size={18} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="확대"
        disabled={z === lastZ}
        onClick={() => setZ((n) => Math.min(lastZ, n + 1))}
        className={`${BTN} top-3 left-16`}
      >
        <IconZoomIn size={18} aria-hidden />
      </button>

      {/* 한 장뿐이면 넘길 곳이 없다 */}
      {files.length > 1 && (
        <>
          <button
            type="button"
            aria-label="이전 이미지"
            disabled={i === 0}
            onClick={() => step(-1)}
            className={`${BTN} top-1/2 left-3 -translate-y-1/2`}
          >
            <IconChevronLeft size={20} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="다음 이미지"
            disabled={i === last}
            onClick={() => step(1)}
            className={`${BTN} top-1/2 right-3 -translate-y-1/2`}
          >
            <IconChevronRight size={20} aria-hidden />
          </button>
        </>
      )}
    </dialog>
  );
}
