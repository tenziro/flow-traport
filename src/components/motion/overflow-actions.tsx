"use client";
// beui.dev/components/blocks/overflow-actions
//
// 원본은 항목을 배열 prop(`primaryActions` / `overflowActions`)으로 받아 안에서
// `<button type="button">`으로 렌더한다. **여기서는 슬롯으로 갈아냈다.** 헤더에 묶는 넷 중
// 셋이 버튼이 아니다 — 밝기는 `<fieldset>`+라디오였고(지금은 순환 버튼), 알림은 Radix
// 팝오버 트리거 + 배지, 로그아웃은 `<form method="post">` 서브밋, 이름·부서는 액션이 아니라
// 텍스트다. 항목 API는 `{ id, label, icon, onClick }`뿐이라 이 넷 중 하나도 못 담는다.
// 토글 아이콘(`MoreHorizontal`/`X`)도 하드코딩이라 이니셜 원판으로 갈 수 없었다.
//
// 살린 것 — `SHELL_TRANSITION` 스프링, 접힐 때 펼침 그룹을 제자리에 남기는 `useLayoutEffect`
// 위치 보정, `AnimatePresence mode="popLayout"`, `useControllableExpanded`,
// `useReducedMotion`, `useHoverCapable`, blur-in 변이.
//
// 버린 것 — `OverflowActionItem`·`ActionButton`·`onAction`·`collapseOnAction`·`size`와
// 사이즈 클래스 맵 다섯 개. 이 앱은 한 크기만 쓴다. 원본 항목의 `tabIndex={-1}`도 버렸다 —
// 펼침 슬롯은 `AnimatePresence`가 unmount하므로 접히면 DOM에 없다.
//
// 고친 것 — 트랙의 `rounded-full` → `rounded-lg`(8px). v0.21.0에서 앱의 알약을 다 없앴다.
// 안쪽 항목의 모서리는 강제하지 않는다(슬롯이라 호출부가 정한다). 토글은 이니셜 원판이라
// `rounded-full`을 유지한다 — 지름이 높이와 같은 원은 그대로 두는 게 이 앱의 규칙이다.

import {
  AnimatePresence,
  motion,
  type Transition,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useHoverCapable } from "@/lib/hooks/use-hover-capable";
import { cn } from "@/lib/utils";

export interface OverflowActionsProps {
  /** 접어도 늘 보이는 자리. */
  children: ReactNode;
  /** 토글을 눌렀을 때 벌어지는 자리. */
  overflow: ReactNode;
  /** 토글 원판 안. */
  toggle: ReactNode;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /**
   * 토글의 접근성 이름. 원본은 `openLabel`/`closeLabel` 두 개였는데 하나로 합쳤다 —
   * 펼침·접힘은 `aria-expanded`가 "확장됨/축소됨"으로 읽어 주므로 라벨에 또 쓰면 두 번
   * 읽힌다.
   */
  label: string;
  /** 펼침 그룹의 이름. 포커스가 그룹으로 들어갈 때 함께 읽힌다. */
  overflowLabel: string;
  className?: string;
  classNames?: { root?: string; track?: string; overflow?: string; toggle?: string };
}

// 앱 기본 스프링보다 무르다 — 펼침 그룹이 들고 날 때 토글에 붙어 있는 것처럼 보여야 한다.
const SHELL_TRANSITION: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 17,
  mass: 0.85,
};

const OVERFLOW_VARIANTS: Variants = {
  hidden: { opacity: 0, filter: "blur(4px)" },
  visible: { opacity: 1, filter: "blur(0px)" },
  exit: { opacity: 0, filter: "blur(4px)" },
};

function useControllableExpanded({
  expanded,
  defaultExpanded,
  onExpandedChange,
}: {
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded ?? false);
  const isControlled = expanded !== undefined;
  const value = expanded ?? internalExpanded;

  const setValue = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalExpanded(next);
      onExpandedChange?.(next);
    },
    [isControlled, onExpandedChange],
  );

  return [value, setValue] as const;
}

export function OverflowActions({
  children,
  overflow,
  toggle,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  label,
  overflowLabel,
  className,
  classNames,
}: OverflowActionsProps) {
  const reduce = useReducedMotion();
  const canHover = useHoverCapable();
  const overflowId = useId();
  const overflowRef = useRef<HTMLDivElement>(null);
  const overflowLeftRef = useRef(0);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [isExpanded, setIsExpanded] = useControllableExpanded({
    expanded,
    defaultExpanded,
    onExpandedChange,
  });

  const transition = reduce ? { duration: 0 } : SHELL_TRANSITION;

  useLayoutEffect(() => {
    const node = overflowRef.current;
    if (!node) return;

    if (!isExpanded) {
      // 나가는 그룹을 마지막으로 있던 자리에 못 박는다. 안 하면 트랙이 좁아지는 동안
      // 그룹이 함께 끌려가서 사라지는 게 아니라 빨려 들어가는 것처럼 보인다.
      node.style.left = `${overflowLeftRef.current - node.getBoundingClientRect().left}px`;
      return;
    }

    node.style.left = "";
    overflowLeftRef.current = node.getBoundingClientRect().left;
    // 펼치면 새로 생긴 첫 항목으로 포커스를 보낸다. 토글이 DOM 마지막이라 그냥 두면
    // 펼친 직후 Tab이 새 항목을 다 건너뛰고 헤더 밖으로 나간다.
    node.querySelector<HTMLElement>("button, [href], input, select, textarea")?.focus();
  }, [isExpanded]);

  return (
    <motion.div
      layout
      transition={transition}
      onKeyDown={(event) => {
        // 닫는 길은 셋이다: 토글 다시 누르기 / Escape / 로그아웃(페이지가 떠난다).
        // ponytail: 바깥 클릭으로는 닫지 않는다 — 알림 팝오버 안을 누르는 것도 트랙
        // 바깥이라 잘못 닫히고, 레일은 팝오버가 아니라 헤더의 일부여서 열려 있어도
        // 아무것도 가리지 않는다.
        if (event.key !== "Escape" || !isExpanded) return;
        // 포털 밖에서 온 Escape는 흘려보낸다. 알림 팝오버는 DOM에서는 body로 나가지만
        // React 트리에서는 여기 자식이라 keydown이 그대로 올라온다 — 그냥 받으면 팝오버를
        // 닫는 첫 Escape에 레일까지 같이 접힌다. 팝오버 먼저, 그다음 레일이다.
        if (!event.currentTarget.contains(event.target as Node)) return;
        setIsExpanded(false);
        toggleRef.current?.focus();
      }}
      className={cn("inline-flex", classNames?.root, className)}
    >
      <motion.div
        layout
        transition={transition}
        className={cn(
          "relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-card p-1.5 text-sm",
          classNames?.track,
        )}
      >
        <motion.div layout transition={transition} className="inline-flex items-center gap-1.5">
          {children}
        </motion.div>

        <AnimatePresence mode="popLayout" initial={false}>
          {isExpanded ? (
            <motion.div
              key="overflow"
              ref={overflowRef}
              id={overflowId}
              role="group"
              aria-label={overflowLabel}
              layout
              variants={OVERFLOW_VARIANTS}
              initial={reduce ? { opacity: 0 } : "hidden"}
              animate={reduce ? { opacity: 1 } : "visible"}
              exit={reduce ? { opacity: 0 } : "exit"}
              transition={transition}
              className={cn(
                "relative inline-flex w-max items-center gap-1.5",
                classNames?.overflow,
              )}
            >
              {overflow}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button
          ref={toggleRef}
          type="button"
          layout
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? overflowId : undefined}
          aria-label={label}
          title={overflowLabel}
          onClick={() => setIsExpanded(!isExpanded)}
          // `reduce ? undefined : …`가 아니라 배율을 1로 둔다. motion은 `whileTap`이
          // **있을 때만** `tabIndex={0}`을 심는데(framer-motion `useHTMLProps`),
          // `useReducedMotion()`은 서버에서 false·클라이언트에서 true라 prop이 사라지면
          // 서버 HTML에만 `tabindex`가 붙어 hydration이 어긋난다.
          whileTap={{ scale: reduce ? 1 : 0.96 }}
          whileHover={reduce || !canHover ? undefined : { scale: 1.03 }}
          transition={transition}
          className={cn(
            // 원본은 늘 `bg-primary`인데 그러면 아바타가 헤더에서 가장 시끄러운 요소가 된다.
            // 펼친 동안만 강해지게 뒤집었다.
            // 트랙 안의 다른 칸과 같은 36px다. 원판만 32px로 두면 한 줄에서 혼자 작아 보인다.
            "relative inline-grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-xs font-semibold outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isExpanded ? "bg-primary text-primary-foreground" : "bg-muted",
            classNames?.toggle,
          )}
        >
          {/* 원본은 여기서 `MoreHorizontal` ↔ `X`를 blur로 갈아치웠다. 이 앱의 토글은
              이니셜 원판이고 펼쳐도 같은 글자라 갈아칠 게 없다 — 같은 글자를 다시
              흐리게 넣었다 빼면 누를 때마다 한 번 깜빡이는 것으로만 보인다. */}
          {toggle}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
