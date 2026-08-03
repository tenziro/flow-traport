"use client";
// beui.dev/components/motion/drawer
//
// beUI 원본에서 고친 것은 넷이다.
// 1. `<body>`로 포털한다 (`useSyncExternalStore` + `createPortal`). 여는 자리가 좌측 레일인데
//    레일은 `overflow-hidden`에 `will-change:transform`을 걸고 폭을 애니메이션한다 —
//    그 안에서 `position:fixed`는 화면이 아니라 레일을 기준으로 잡힌다. 이 앱의 레이어 셋이
//    모두 같은 이유로 포털한다 (center-morph-modal.tsx·bottom-sheet.tsx).
// 2. 스크림을 `bg-black/40`에서 토큰(`bg-background/40`)으로 바꿨다. 컴포넌트에 색을 직접
//    적지 않는다 (PRD §7.1) — 어두운 화면에서 검정 위에 검정을 덮는 문제도 같이 사라진다.
// 3. 스크림의 읽어 주는 이름을 한국어로 바꿨다. 이 앱의 UI 문구는 전부 한국어다.
// 4. **열 때 패널로 포커스를 넣고 닫을 때 열었던 자리로 되돌린다.** 원본에는 Escape만 있다.
//    포털이 `<body>` 끝에 붙어서, 안 넣으면 여는 단추 **다음 컨트롤**로 탭이 간다.
//    탭 트랩은 두지 않는다 — bottom-sheet.tsx와 같은 선이다.
// 폭(`w-80`)·모션·스크롤 잠금은 그대로 둔다.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useSyncExternalStore, useRef } from "react";
import { createPortal } from "react-dom";
import { EASE_OUT, SPRING_PANEL } from "@/lib/ease";
import { cn } from "@/lib/utils";

/** 마운트 감지 (center-morph-modal.tsx와 같다) — 포털 대상이 `document.body`다. */
const NEVER_CHANGES = () => () => {};
const ON_CLIENT = () => true;
const ON_SERVER = () => false;

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right";
  children: ReactNode;
  /** Class for the panel surface. */
  className?: string;
  /** Class for the backdrop. */
  backdropClassName?: string;
  ariaLabel?: string;
  /** Close when the backdrop is clicked. Default true. */
  dismissable?: boolean;
}

export function Drawer({
  open,
  onOpenChange,
  side = "right",
  children,
  className,
  backdropClassName,
  ariaLabel,
  dismissable = true,
}: DrawerProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const mounted = useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 키보드 몫 (위 주석 4번). `preventScroll`인 것은 미끄러져 들어오는 중에 포커스가
    // 화면을 한 번 당기지 않게 하기 위함이다.
    const opener = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() =>
      panelRef.current?.focus({ preventScroll: true }),
    );

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(frame);
      opener?.focus({ preventScroll: true });
    };
  }, [open, onOpenChange]);

  const offscreen = side === "right" ? "100%" : "-100%";

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="닫기"
            tabIndex={dismissable ? 0 : -1}
            onClick={() => dismissable && onOpenChange(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className={cn(
              "absolute inset-0 h-full w-full cursor-default bg-background/40 backdrop-blur-sm",
              backdropClassName,
            )}
          />
          <motion.aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={reduce ? { opacity: 0 } : { x: offscreen }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: offscreen }}
            transition={reduce ? { duration: 0.2, ease: EASE_OUT } : SPRING_PANEL}
            className={cn(
              "absolute inset-y-0 flex w-80 max-w-[85vw] flex-col bg-background shadow-2xl outline-hidden",
              side === "right" ? "right-0 border-l border-border" : "left-0 border-r border-border",
              className,
            )}
          >
            {children}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
