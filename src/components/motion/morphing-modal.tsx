"use client";
// beui.dev/components/motion/morphing-modal
//
// 원본은 `viewId` 하나로 여닫는 단일 패널이다. 안쪽 화면을 갈아탈 때 높이가 늘었다 줄고
// 내용이 블러로 교차한다. beUI 원본에서 고친 것은 일곱이다.
//
// 1. **`document.body`로 포털한다.** 원본은 제자리에 렌더한다. 이 앱의 모달은 표 줄 안에서
//    열리고 그 표는 가상 스크롤이라 조상에 `transform`이 걸린다 — `position: fixed`가
//    조상의 변형 기준으로 잡혀서 화면에 안 맞는다. 마운트 감지는 `useSyncExternalStore`다
//    (`useEffect`에서 setState는 React 19 린트가 막는다 — `react-hooks/set-state-in-effect`).
// 2. **초점을 가두고 되돌린다.** 원본에 없다. 이 앱의 모달에는 API 키 입력·댓글 입력·달력이
//    들어서, 초점이 뒤 화면으로 새면 안 보이는 곳을 타이핑한다. 열 때의
//    `document.activeElement`를 기억해 닫을 때 그리로 돌린다 — 트리거를 따로 안 넘긴다.
// 3. **Escape로 닫는다** (`dismissible`). 원본은 배경 누르기만 준다.
// 4. **`role="dialog"` · `aria-modal` · `aria-label`.** 원본에는 이름이 없어서 낭독기가
//    "대화상자"라고만 읽는다. `ariaLabel`을 필수로 받는다.
// 5. **긴 내용을 스크롤한다.** 원본은 `items-center`만 걸어서 화면보다 긴 내용이 위아래로
//    잘려 나가고 스크롤 자체가 없다(BUG-039). `overflow-y-auto` 칸 안에 `min-h-full`을 쓴
//    열 방향 flex를 넣어 짧을 때는 가운데, 길 때는 위에서부터 자라게 했다 — flexbox +
//    overflow에서 `items-center`만으로는 위로 넘친 만큼이 스크롤 범위 밖에 남는다.
// 6. **`z-[80]` → `z-[100]`, `rounded-3xl` → `rounded-lg`, 안쪽 `p-5` 제거.**
//    `z-[100]`은 달력 팝오버(`z-[110]` — date-field.tsx)가 기준으로 삼는 값이다.
//    모서리는 이 앱의 카드 기준 8px이다. 패딩은 호출자가 갖는다 — 경계선이 패널 폭 끝까지
//    닿아야 머리·값·댓글이 갈린다.
// 7. **`placement`를 뺐다.** 아래 붙는 패널은 `bottom-sheet.tsx`가 따로 있다 — 한 가지를
//    두 군데서 하는 길을 안 만든다. 항상 가운데다.
//
// 닫기 아이콘은 `lucide-react`의 `X`가 아니라 이 앱의 `IconClose`(reicon)다. `lucide-react`는
// 의존성에 없다 (icons.tsx 주석). 높이 모프·블러 교차·스프링은 원본 그대로다.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "@/components/icons";
import { EASE_OUT, SPRING_PANEL } from "@/lib/ease";
import { cn } from "@/lib/utils";

export interface MorphingModalProps {
  /** 지금 보이는 화면. `null`이면 닫는다. 값이 바뀌면 패널이 높이를 맞춰 늘었다 줄어든다. */
  viewId: string | null;
  onClose: () => void;
  children: ReactNode;
  /** 낭독기가 읽을 이름. */
  ariaLabel: string;
  /** 모달 안 설명 요소의 id. */
  ariaDescribedBy?: string;
  /** Escape·배경 누르기로 닫는다. 기본 true. */
  dismissible?: boolean;
  /** 패널 오른쪽 위에 닫기 아이콘을 그린다. 기본 true. */
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

function getFocusableElements(root: HTMLElement | null) {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.tabIndex >= 0,
  );
}

/**
 * 마운트 감지 — 포털 대상이 `document.body`라 서버 렌더에서는 반드시 null이어야 한다.
 * 구독할 외부 상태가 없어서 구독 함수는 빈 정리만 준다.
 */
const NEVER_CHANGES = () => () => {};
const ON_CLIENT = () => true;
const ON_SERVER = () => false;

export function MorphingModal({
  viewId,
  onClose,
  children,
  ariaLabel,
  ariaDescribedBy,
  dismissible = true,
  showCloseButton = true,
  closeButtonLabel = "닫기",
  className,
  backdropClassName,
}: MorphingModalProps) {
  const open = viewId !== null;
  const reduce = useReducedMotion() ?? false;
  const mounted = useSyncExternalStore(NEVER_CHANGES, ON_CLIENT, ON_SERVER);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const enterY = reduce ? 0 : 20;
  const enterScale = reduce ? 1 : 0.97;

  /**
   * 몸통 스크롤 잠금 + 초점 가두기·복귀 + Escape. 벤더 이탈 2·3·5.
   *
   * `onClose`·`dismissible`을 아래 이펙트 의존성에 안 넣는다. 넣으면 호출자가 매 렌더 새
   * 함수를 주는 순간 이펙트가 다시 돌아 열려 있는 동안 초점이 첫 컨트롤로 끌려간다 —
   * 댓글을 쓰는 중에 커서가 튄다. 최신 값은 ref에 따로 실어 두고 이벤트에서 읽는다
   * (렌더 중 ref 쓰기는 React 19 린트가 막는다 — `Cannot access refs during render`).
   */
  const latest = useRef({ onClose, dismissible });
  useEffect(() => {
    latest.current = { onClose, dismissible };
  }, [onClose, dismissible]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const restoreTo = document.activeElement as HTMLElement | null;

    const focusFrame = requestAnimationFrame(() => {
      const [firstFocusable] = getFocusableElements(overlayRef.current);
      (firstFocusable ?? panelRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && latest.current.dismissible) {
        event.preventDefault();
        latest.current.onClose();
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
      restoreTo?.focus();
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={overlayRef}
      aria-hidden={!open}
      inert={!open}
      className={cn("fixed inset-0 z-[100]", open ? "pointer-events-auto" : "pointer-events-none")}
    >
      <motion.button
        type="button"
        aria-label="닫기"
        tabIndex={-1}
        disabled={!dismissible}
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: reduce ? 0.1 : 0.2, ease: EASE_OUT }}
        onClick={onClose}
        className={cn(
          "absolute inset-0 cursor-default bg-background/10 backdrop-blur-sm",
          open ? "pointer-events-auto" : "pointer-events-none",
          backdropClassName,
        )}
      />

      {/* 벤더 이탈 5 — 원본은 `items-center`만이라 긴 내용이 스크롤 범위 밖에 남는다 */}
      <div className="pointer-events-none absolute inset-0 overflow-y-auto overscroll-contain px-4">
        <div className="flex min-h-full w-full flex-col items-center justify-center py-8">
          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                key="panel"
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                aria-describedby={ariaDescribedBy}
                tabIndex={-1}
                layout
                initial={{ opacity: 0, y: enterY, scale: enterScale }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: enterY,
                  scale: reduce ? 1 : 0.98,
                  transition: { duration: 0.18, ease: EASE_OUT },
                }}
                transition={SPRING_PANEL}
                className={cn(
                  "pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-lg border border-border bg-background shadow-2xl will-change-transform",
                  className,
                )}
              >
                <motion.div layout="position">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={viewId}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={
                        reduce
                          ? { opacity: 1, transition: { duration: 0.18, ease: EASE_OUT } }
                          : {
                              opacity: 1,
                              y: 0,
                              filter: "blur(0px)",
                              transition: { duration: 0.24, ease: EASE_OUT },
                            }
                      }
                      exit={
                        reduce
                          ? { opacity: 0, transition: { duration: 0.14, ease: EASE_OUT } }
                          : {
                              opacity: 0,
                              y: -8,
                              filter: "blur(4px)",
                              transition: { duration: 0.16, ease: EASE_OUT },
                            }
                      }
                    >
                      {children}
                    </motion.div>
                  </AnimatePresence>
                </motion.div>

                {showCloseButton ? (
                  <motion.button
                    type="button"
                    aria-label={closeButtonLabel}
                    onClick={onClose}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{
                      opacity: 0,
                      scale: reduce ? 1 : 0.88,
                      transition: { duration: 0.1, ease: EASE_OUT },
                    }}
                    transition={{
                      delay: reduce ? 0 : 0.12,
                      duration: reduce ? 0.12 : 0.2,
                      ease: EASE_OUT,
                    }}
                    className="absolute top-4 right-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <IconClose size={16} aria-hidden="true" />
                  </motion.button>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>,
    document.body,
  );
}
