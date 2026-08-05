"use client";
// beui.dev/components/motion/tabs
//
// beUI 원본에서 두 군데 더했다:
// 1. `TabsList`에 `aria-label` 통과. `role="tablist"`는 접근 가능한 이름이 있어야 하는데
//    원본은 넘길 구멍이 없었다 (select.tsx의 `aria-labelledby`와 같은 이유의 최소 개조).
// 2. `TabsSelect` — 좁은 화면에서 칩 줄 대신 서는 고르개. 원본에 없는 컴포넌트지만 탭
//    상태를 그대로 쓰는 게 핵심이라 컨텍스트가 있는 여기 산다 (아래 주석).
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/motion/select";
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

/**
 * 폰에서 칩 줄을 대신하는 고르개 (`sm` 아래에서만 선다). `TabsList`에는 `max-sm:hidden`을
 * 붙여 짝을 맞춘다.
 *
 * 칸이 셋만 돼도 폰에서 칩 줄이 두 줄로 접히고, 접힌 둘째 줄은 목록의 첫 줄처럼 보인다 —
 * 고르는 것과 고른 결과가 붙어 버린다. 한 줄짜리 고르개면 높이가 칸 수와 무관하다.
 *
 * 목록은 beUI `Select`가 그린다 (브라우저 기본 목록이 아니다). 폰에서만 OS 위젯이
 * 튀어나오지 않고, 열고 닫히는 모양이 이 앱의 다른 레이어와 같다.
 *
 * 고르면 탭 상태를 그대로 바꾼다 — 컨트롤한테 따로 알릴 게 없다. 주소를 미는 화면
 * (`dept-tabs.tsx`)은 `Tabs`의 `onValueChange`가 이미 그 일을 하고 있어서 여기서도 같이
 * 밀린다.
 *
 * 칸 이름은 넘겨받는다. `TabsTrigger`의 자식은 건수 `<span>`이 섞인 JSX라 그대로는 고르개
 * 한 줄에 못 들어간다 (`SelectItem`은 문자열 자식만 이름으로 등록한다).
 */
export function TabsSelect({
  options,
  "aria-label": ariaLabel,
  className,
}: {
  options: { value: string; label: string }[];
  /** 스크린 리더가 읽을 이름. 짝인 `TabsList`의 `aria-label`과 같은 말로 둔다. */
  "aria-label": string;
  className?: string;
}) {
  const { value, setValue } = useTabs();
  // 트리거 id는 `Select` 안에서 만들어져서 바깥 `<label htmlFor>`로 못 묶는다 —
  // 컴포넌트가 열어 둔 `aria-labelledby`에 숨은 이름표를 물린다 (select.tsx 3번).
  const labelId = useId();

  return (
    <Select value={value} onValueChange={setValue} className={cn("sm:hidden", className)}>
      <span id={labelId} className="sr-only">
        {ariaLabel}
      </span>
      {/* 8px — 카드·칩과 같은 모서리다 (`--radius`). beUI 기본은 12라 이 고르개만 혼자
          둥글었다. 트리거와 목록에 같은 값을 준다 (select.tsx 4번) */}
      <SelectTrigger aria-labelledby={labelId} radius={8} className="font-medium">
        <SelectValue />
      </SelectTrigger>
      <SelectContent radius={8}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
