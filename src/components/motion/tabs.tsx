"use client";
// beui.dev/components/motion/tabs
//
// beUI 원본에서 한 군데 더했다: `TabsList`에 `aria-label` 통과. `role="tablist"`는
// 접근 가능한 이름이 있어야 하는데 원본은 넘길 구멍이 없었다 (select.tsx의
// `aria-labelledby`와 같은 이유의 최소 개조).
//
// 한 군데는 바꿨다: 켜진 칸이 들어오는 움직임을 `motion`에서 CSS로 내렸다 — 서버가
// `opacity:0`을 박아서 하이드레이션 전까지 내용이 안 보였다 (`TabsContent` 주석).
//
// 부서 전환(`dept-tabs.tsx`)이 `variant="segment"`, 소식 함(`news-bell.tsx`)이
// `variant="underline"`로 쓴다. `pill`은 남겨 뒀지만 쓰는 곳이 없다 — 이 앱의 모서리는
// 카드 기준 8px이고 알약은 그 계열에서 혼자 튄다.

import { motion, MotionConfig, useReducedMotion, type Transition } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type Variant = "pill" | "underline" | "segment";

type Ctx = {
  value: string;
  setValue: (v: string) => void;
  layoutId: string;
  variant: Variant;
};

const TabsCtx = createContext<Ctx | null>(null);

function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("Tabs.* must be used inside <Tabs>");
  return ctx;
}

// Weighty spring for the active-tab indicator: a touch of overshoot so it
// settles with life instead of snapping.
const transition: Transition = {
  type: "spring",
  stiffness: 170,
  damping: 24,
  mass: 1.2,
};

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  variant = "pill",
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const layoutId = useId();
  const reduce = useReducedMotion();
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const setValue = useCallback(
    (v: string) => {
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [controlled, onValueChange],
  );
  const contextValue = useMemo(
    () => ({ value: current, setValue, layoutId, variant }),
    [current, layoutId, setValue, variant],
  );
  return (
    <MotionConfig transition={reduce ? { duration: 0 } : transition}>
      <TabsCtx.Provider value={contextValue}>
        {/* layoutRoot: the indicator's layoutId measures in page coordinates, so
            inside fixed/scrolled containers it would replay scroll offsets as
            movement. The pill only ever travels within the list, so scoping
            projection to the Tabs wrapper is always correct. */}
        <motion.div layoutRoot className={className}>
          {children}
        </motion.div>
      </TabsCtx.Provider>
    </MotionConfig>
  );
}

const listClasses: Record<Variant, string> = {
  pill: "inline-flex items-center gap-1 rounded-full bg-card p-1",
  underline: "inline-flex items-center gap-1 border-b border-border",
  segment: "inline-flex items-center gap-0 rounded-lg bg-card p-0.5",
};

export function TabsList({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const { variant } = useTabs();
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn(listClasses[variant], className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  indicatorClassName,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  indicatorClassName?: string;
}) {
  const { value: current, setValue, layoutId, variant } = useTabs();
  const active = current === value;

  if (variant === "underline") {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setValue(value)}
        className={cn(
          "relative isolate px-3 pb-2.5 pt-1 -mb-px text-sm font-medium transition-colors min-h-[44px] inline-flex items-center",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        {children}
        {active ? (
        <motion.span
          layoutId={layoutId}
          className={cn(
            "absolute -bottom-px left-0 right-0 h-px bg-primary",
            indicatorClassName,
          )}
        />
        ) : null}
      </button>
    );
  }

  const radius = variant === "pill" ? "rounded-full" : "rounded-md";

  return (
    <div className="relative">
      {active ? (
        <motion.span
          layoutId={layoutId}
          style={{ borderRadius: variant === "pill" ? 9999 : 8 }}
          className={cn(
            "absolute inset-0 bg-primary",
            radius,
            indicatorClassName,
          )}
        />
      ) : null}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setValue(value)}
        className={cn(
          "relative z-10 inline-flex items-center justify-center whitespace-nowrap bg-transparent px-3.5 py-1.5 text-sm font-medium outline-none",
          "transition-colors",
          active
            ? "text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
          radius,
          className,
        )}
      >
        {children}
      </button>
    </div>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { value: current } = useTabs();
  const active = current === value;
  // Inactive panels stay mounted but hidden, so their content (e.g. source
  // code) is present in the server-rendered HTML for crawlers and assistive
  // tech, instead of being dropped from the DOM.
  if (!active) {
    return (
      <div hidden className={className}>
        {children}
      </div>
    );
  }
  /*
   * 들어오는 움직임은 CSS다 (`.pane-in`, globals.css). beUI 원본은 `motion.div`에
   * `initial={{ opacity: 0 }}`을 걸었는데, 그러면 **서버가 `style="opacity:0"`으로
   * 내보내고 하이드레이션이 끝나야 걷힌다.** 내 업무 화면은 이 칸 하나에 DOM이 1만 줄이라
   * 그 사이 몇 초 동안 화면이 비어 보였다 (BUG-044). 키가 바뀌면 요소가 새로 붙어서
   * 애니메이션도 다시 돈다 — 탭을 옮길 때 움직임은 그대로다.
   */
  return (
    <div key={value} className={cn("pane-in mt-4", className)}>
      {children}
    </div>
  );
}
