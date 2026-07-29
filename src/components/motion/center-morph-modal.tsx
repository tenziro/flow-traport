"use client";
// beui.dev/components/motion/center-morph-modal
//
// beUI 원본에서 고친 것은 셋이다.
// 1. 닫기 아이콘을 `lucide-react`의 `X`에서 이 앱의 `IconClose`(reicon)로 바꿨다.
//    `lucide-react`는 의존성에 없다 (icons.tsx 주석).
// 2. 마운트 감지를 `useEffect(() => setMounted(true))`에서 `useSyncExternalStore`로
//    바꿨다 (`mounted`). 원본 패턴이 React 19 린트에 걸린다 — 아래 주석 참고.
// 3. 패널 모서리를 `rounded-[30px]` → `rounded-lg`. 이 앱의 모서리는 카드 기준 8px이고,
//    모달은 화면에서 가장 큰 면인데 그 면만 30px이면 안에 든 카드·버튼과 계열이 어긋난다.
// 나머지 구조·모션·포커스 트랩은 그대로 둔다.

import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { IconClose } from "@/components/icons";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

type CenterMorphModalContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerId: string;
  contentId: string;
};

const CenterMorphModalContext =
  createContext<CenterMorphModalContextValue | null>(null);

function useCenterMorphModalContext(component: string) {
  const context = useContext(CenterMorphModalContext);
  if (!context) {
    throw new Error(`${component} must be used within <CenterMorphModal>`);
  }
  return context;
}

export interface CenterMorphModalProps {
  children: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Initial state when used uncontrolled. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * A modal whose full-size surface unfolds outward from its exact center.
 * Supports controlled and uncontrolled state through composable primitives.
 */
export function CenterMorphModal({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
}: CenterMorphModalProps) {
  const id = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  const value = useMemo<CenterMorphModalContextValue>(
    () => ({
      open,
      setOpen,
      triggerId: `${id}-trigger`,
      contentId: `${id}-content`,
    }),
    [id, open, setOpen],
  );

  return (
    <CenterMorphModalContext.Provider value={value}>
      {children}
    </CenterMorphModalContext.Provider>
  );
}

export interface CenterMorphModalTriggerProps {
  children: ReactElement;
}

/** Wraps one interactive element and opens or closes the modal. */
export function CenterMorphModalTrigger({
  children,
}: CenterMorphModalTriggerProps) {
  const context = useCenterMorphModalContext("CenterMorphModalTrigger");
  if (!isValidElement(children)) return children;

  const child = children as ReactElement<Record<string, unknown>>;
  const childOnClick = child.props.onClick as
    | ((event: React.MouseEvent<HTMLElement>) => void)
    | undefined;

  return cloneElement(child, {
    id: context.triggerId,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      childOnClick?.(event);
      if (!event.defaultPrevented) context.setOpen(!context.open);
    },
    "aria-haspopup": "dialog",
    "aria-expanded": context.open,
    "aria-controls": context.open ? context.contentId : undefined,
  });
}

export interface CenterMorphModalCloseProps {
  children: ReactElement;
}

/** Wraps one interactive element and closes the modal. */
export function CenterMorphModalClose({
  children,
}: CenterMorphModalCloseProps) {
  const context = useCenterMorphModalContext("CenterMorphModalClose");
  if (!isValidElement(children)) return children;

  const child = children as ReactElement<Record<string, unknown>>;
  const childOnClick = child.props.onClick as
    | ((event: React.MouseEvent<HTMLElement>) => void)
    | undefined;

  return cloneElement(child, {
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      childOnClick?.(event);
      if (!event.defaultPrevented) context.setOpen(false);
    },
  });
}

export interface CenterMorphModalContentProps {
  children: ReactNode;
  /** Accessible name announced by screen readers. */
  ariaLabel: string;
  /** Optional id of descriptive content inside the modal. */
  ariaDescribedBy?: string;
  /** Close on Escape or backdrop press. Default true. */
  dismissible?: boolean;
  /** Render the close control inside the panel's top-right corner. Default true. */
  showCloseButton?: boolean;
  closeButtonLabel?: string;
  className?: string;
  backdropClassName?: string;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// 이 8px은 `--radius`와 같은 값이다 — 여기서 CSS 변수를 못 쓴다. Motion이 clip-path 문자열을
// 숫자로 풀어서 보간하기 때문에 `var(--radius)`를 넣으면 애니메이션이 서고, 값이 패널의
// `rounded-lg`와 어긋나면 모서리에서 테두리가 잘려 나간다 — 잘린 자리에 큰 반지름의 실루엣만
// 남아서 테두리가 두 겹으로 보였다.
const CENTER_FOLDED_CLIP = "inset(48% 48% 48% 48% round 8px)";
const CENTER_OPEN_CLIP = "inset(0% 0% 0% 0% round 8px)";

// Complex clip-path strings can snap when a spring resolves its final distance.
// Keep the radius constant so the whole duration reads as surface unfolding,
// rather than finishing early and spending its last frames rounding corners.
const CENTER_UNFOLD_EASE = [0.2, 0, 0.2, 1] as const;
const CENTER_UNFOLD_TRANSITION = {
  duration: 0.43,
  ease: CENTER_UNFOLD_EASE,
} as const;

function getFocusableElements(root: HTMLElement | null) {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.tabIndex >= 0);
}

/**
 * 마운트 감지 — 포털 대상이 `document.body`라 서버 렌더에서는 반드시 null이어야 한다.
 *
 * beUI 원본은 `useEffect(() => setMounted(true), [])`였는데 React 19 린트가 이펙트 안의
 * setState를 막는다(`react-hooks/set-state-in-effect`). 하는 일은 같다 — 서버 스냅샷은
 * false, 클라이언트 스냅샷은 true다. 구독할 외부 상태가 없어서 구독 함수는 빈 정리만 준다.
 */
const NEVER_CHANGES = () => () => {};
const ON_CLIENT = () => true;
const ON_SERVER = () => false;

function PresencePointerGate({
  children,
}: {
  children: (isPresent: boolean) => ReactNode;
}) {
  return children(useIsPresent());
}

export function CenterMorphModalContent({
  children,
  ariaLabel,
  ariaDescribedBy,
  dismissible = true,
  showCloseButton = true,
  closeButtonLabel = "닫기",
  className,
  backdropClassName,
}: CenterMorphModalContentProps) {
  const context = useCenterMorphModalContext("CenterMorphModalContent");
  const reduce = useReducedMotion() ?? false;
  const mounted = useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!context.open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = requestAnimationFrame(() => {
      const [firstFocusable] = getFocusableElements(overlayRef.current);
      (firstFocusable ?? panelRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        context.setOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(overlayRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.getElementById(context.triggerId)?.focus();
    };
  }, [context, dismissible]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {context.open ? (
        <PresencePointerGate>
          {(isPresent) => (
            <div
              ref={overlayRef}
              className="pointer-events-none fixed inset-0 z-[100]"
            >
              <motion.button
                type="button"
                aria-label="닫기"
                tabIndex={-1}
                disabled={!dismissible}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ pointerEvents: isPresent ? "auto" : "none" }}
                transition={{
                  duration: reduce ? 0.1 : 0.28,
                  ease: EASE_OUT,
                }}
                onClick={() => context.setOpen(false)}
                className={cn(
                  "pointer-events-auto absolute inset-0 h-full w-full cursor-default bg-background/10 backdrop-blur-sm",
                  backdropClassName,
                )}
              />

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-y-auto p-4 drop-shadow-2xl">
                {/* Drop-shadow reads the clipped child's alpha, so depth follows the
                    unfolding silhouette without introducing another panel layer. */}
                <div className="flex w-full flex-col items-center py-8">
                  <motion.div
                    ref={panelRef}
                    id={context.contentId}
                    role="dialog"
                    aria-modal="true"
                    aria-label={ariaLabel}
                    aria-describedby={ariaDescribedBy}
                    tabIndex={-1}
                    initial={
                      reduce
                        ? { opacity: 0, clipPath: CENTER_OPEN_CLIP }
                        : { opacity: 1, clipPath: CENTER_FOLDED_CLIP }
                    }
                    animate={{
                      opacity: 1,
                      clipPath: CENTER_OPEN_CLIP,
                    }}
                    exit={
                      reduce
                        ? {
                            opacity: 0,
                            clipPath: CENTER_OPEN_CLIP,
                          }
                        : {
                            opacity: 1,
                            clipPath: CENTER_FOLDED_CLIP,
                          }
                    }
                    style={{ pointerEvents: isPresent ? "auto" : "none" }}
                    transition={
                      reduce
                        ? { duration: 0.14, ease: EASE_OUT }
                        : CENTER_UNFOLD_TRANSITION
                    }
                    className={cn(
                      "pointer-events-auto relative w-full max-w-[26rem] origin-center overflow-hidden rounded-lg border border-border bg-background will-change-[clip-path]",
                      className,
                    )}
                  >
                    {children}

                    {showCloseButton ? (
                      <motion.button
                        type="button"
                        aria-label={closeButtonLabel}
                        onClick={() => context.setOpen(false)}
                        initial={
                          reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{
                          opacity: 0,
                          scale: reduce ? 1 : 0.88,
                          transition: { duration: 0.1, ease: EASE_OUT },
                        }}
                        transition={{
                          delay: reduce ? 0 : 0.16,
                          duration: reduce ? 0.12 : 0.2,
                          ease: EASE_OUT,
                        }}
                        className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <IconClose size={16} aria-hidden="true" />
                      </motion.button>
                    ) : null}
                  </motion.div>
                </div>
              </div>
            </div>
          )}
        </PresencePointerGate>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
