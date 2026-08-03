"use client";
// beui.dev/components/motion/bottom-sheet
//
// beUI 원본에서 고친 것은 다섯이다.
// 1. 마운트 감지를 `useEffect(() => setMounted(true))`에서 `useSyncExternalStore`로
//    바꿨다. 원본 패턴이 React 19 린트에 걸린다 — center-morph-modal.tsx와 같은 이유·같은 방식.
// 2. **Escape로 닫고, 열 때 시트로 포커스를 넣고 닫을 때 열었던 자리로 되돌린다.** 원본에는
//    셋 다 없다. 이 시트는 좁은 화면에서 Radix 팝오버를 대신하는 자리라(news-bell.tsx),
//    팝오버가 해 주던 일이 사라지면 같은 기능이 키보드에서만 나빠진다. 탭 트랩은 두지 않는다 —
//    팝오버도 비모달이라 안 잡는다. 여기서만 잡으면 넓은 화면과 좁은 화면이 서로 다르게 움직인다.
// 3. `heightRef`·`onAnimationComplete`를 지웠다. 값을 넣기만 하고 읽는 곳이 없다.
//    스냅 초기화도 이펙트에서 렌더 중 비교로 옮겼다 (1번과 같은 린트).
// 4. `bodyClassName`을 더했다. 본문의 여백을 밖에서 정한다 — 소식 레이어는 탭 줄과 집계 줄의
//    구분선이 시트 폭을 가로질러야 해서 `p-0`이고, 아래 여백은 홈 인디케이터를 피해야 한다.
// 5. 스크림의 읽어 주는 이름을 한국어로 바꿨다. 이 앱의 UI 문구는 전부 한국어다.
// 모서리(`rounded-t-3xl`)는 그대로 둔다 — 이 앱의 `--radius`가 8px이라 3xl이 17.6px이다.

import {
  AnimatePresence,
  motion,
  type PanInfo,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { EASE_DRAWER } from "@/lib/ease";
import { cn } from "@/lib/utils";

// Vaul-style glide: a long, fully-damped tween reads smoother than a spring on
// open — no settle/overshoot, just one clean decel. Same curve drives the
// backdrop fade so the surface and scrim move as one.
const DRAWER = { duration: 0.5, ease: EASE_DRAWER } as const;

/** 마운트 감지 (center-morph-modal.tsx와 같다) — 포털 대상이 `document.body`다. */
const NEVER_CHANGES = () => () => {};
const ON_CLIENT = () => true;
const ON_SERVER = () => false;

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heights (0-1 = fraction of viewport, or "auto"). First entry is default. */
  snapPoints?: (number | "auto")[];
  defaultSnap?: number;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  /** 본문 감싸개의 여백. 기본값은 beUI 원본과 같다. */
  bodyClassName?: string;
  /** Min drag distance (px) past current snap to dismiss. */
  dismissThreshold?: number;
}

export function BottomSheet({
  open,
  onOpenChange,
  snapPoints = [0.5, 0.92],
  defaultSnap = 0,
  title,
  description,
  children,
  className,
  bodyClassName = "px-4 pb-6",
  dismissThreshold = 120,
}: BottomSheetProps) {
  const [snap, setSnap] = useState(defaultSnap);
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const mounted = useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER);

  // 열 때마다 기본 스냅으로 되돌린다. 원본은 이펙트였는데 React 19 린트가 이펙트 안의 setState를
  // 막아서(주석 1번과 같은 규칙) 렌더 중에 맞춘다 — React가 권하는 "직전 렌더와 비교" 방식이다.
  // 닫을 때 되돌리면 안 된다: 아래로 던져 닫는 그 순간 높이가 같이 줄면서 나가는 모습이 튄다.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnap(defaultSnap);
  }

  // Lock background scroll while open. overflow:hidden alone is ignored by
  // iOS Safari — boundary scrolls inside the sheet chain to the page, which
  // scrolls underneath and ends up somewhere else on close. position:fixed
  // is the lock that actually holds; restore the scroll position after.
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // 키보드 몫 (원본에 없다 — 위 주석 2번). 시트로 포커스를 넣는 것은 포털이 `<body>` 끝에
  // 붙어서, 안 넣으면 여는 단추 **다음 컨트롤**로 탭이 가고 시트 안은 건너뛰기 때문이다.
  // `preventScroll`인 것은 미끄러져 올라오는 중에 포커스가 화면을 한 번 당기지 않게 하기 위함이다.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() =>
      sheetRef.current?.focus({ preventScroll: true }),
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      opener?.focus({ preventScroll: true });
    };
  }, [open, onOpenChange]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    // Strong downward fling or large drag → dismiss.
    if (velocity > 600 || offset > dismissThreshold) {
      const smaller = snapPoints.map((_, i) => i).filter((i) => i < snap);
      if (smaller.length && velocity < 800 && offset < dismissThreshold * 1.6) {
        setSnap(smaller[smaller.length - 1]);
      } else {
        onOpenChange(false);
      }
      return;
    }

    // Strong upward fling → next snap.
    if (velocity < -500) {
      setSnap((current) => Math.min(snapPoints.length - 1, current + 1));
      return;
    }

    // Otherwise snap to nearest by current offset.
    setSnap((current) => {
      if (offset > 80 && current > 0) return current - 1;
      if (offset < -80 && current < snapPoints.length - 1) return current + 1;
      return current;
    });
  };

  const snapValue = snapPoints[snap];
  const heightStyle =
    snapValue === "auto" ? { maxHeight: "92vh" } : { height: `${snapValue * 100}vh` };

  // Portal to <body>: an ancestor with backdrop-filter or transform becomes
  // the containing block for fixed descendants, which would position the
  // sheet against that ancestor instead of the viewport.
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="pointer-events-none fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="닫기"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={DRAWER}
            onClick={() => onOpenChange(false)}
            // A dim scrim with a light blur. backdrop-blur is GPU-expensive and
            // re-rasterizes every frame the sheet drags over it; a small radius
            // plus more opacity keeps the glass look without the jank.
            className="pointer-events-auto absolute inset-0 bg-background/40 backdrop-blur-sm"
          />
          <motion.div
            ref={sheetRef}
            tabIndex={-1}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.02, bottom: 0.4 }}
            dragMomentum={false}
            onDragEnd={onDragEnd}
            initial={reduce ? { y: 0, opacity: 0 } : { y: "100%" }}
            animate={reduce ? { y: 0, opacity: 1 } : { y: 0 }}
            exit={reduce ? { y: 0, opacity: 0 } : { y: "100%" }}
            transition={reduce ? { duration: 0.18, ease: EASE_DRAWER } : DRAWER}
            style={heightStyle}
            className={cn(
              "pointer-events-auto absolute bottom-0 left-0 right-0 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-t-3xl outline-hidden will-change-transform",
              "border border-border bg-background shadow-xl",
              className,
            )}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="flex cursor-grab touch-none flex-col items-center px-4 pb-2 pt-3 active:cursor-grabbing"
            >
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
              {title || description ? (
                <div className="mt-3 w-full">
                  {title ? (
                    <h2 className="text-base font-semibold text-foreground">{title}</h2>
                  ) : null}
                  {description ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {/* overscroll-contain stops boundary scrolls from chaining to the page. */}
            <div
              className={cn("flex-1 overflow-y-auto overscroll-contain", bodyClassName)}
            >
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
