"use client";
// beui.dev/components/motion/text-animation

import {
  type MotionStyle,
  motion,
  type UseInViewOptions,
  useInView,
  useReducedMotion,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EASE_IN_OUT, EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

const CHROMATIC_PALETTE = [
  "#60a5fa",
  "#818cf8",
  "#c084fc",
  "#fb7185",
  "#fbbf24",
];

/**
 * 이 앱의 스윕 색. 새 색을 만들지 않고 `globals.css`의 차트 팔레트를 빌린다 — beUI 기본값은
 * 파랑~보라인데 이 앱에 없는 색이다. 로그인 제목과 헤더 브랜드가 같이 쓴다.
 */
export const SWEEP_CHART = [
  "var(--chart-4)",
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-2)",
];

const TRAIL_HALF_WIDTH = 14;
const REVEAL_START = `-${TRAIL_HALF_WIDTH}%`;
const REVEAL_FINISH = `${100 + TRAIL_HALF_WIDTH}%`;

export type ChromaticTextRevealProps = {
  /** Sentence fragment that remains fixed while the final word changes. */
  prefix: string;
  /** Words revealed one after another after the fixed prefix. */
  words: string[];
  /** Colors used along the moving chromatic edge. */
  colors?: string[];
  /** Final text color after the sweep passes. */
  foregroundColor?: string;
  /** Sweep duration in seconds. */
  duration?: number;
  /** Delay before the first sweep, in seconds. */
  delay?: number;
  /** Rest after a word finishes revealing, in seconds. */
  pauseDuration?: number;
  /**
   * 마지막 어절이 끝난 뒤 처음부터 다시. 초 단위. 없으면 한 번만 흐른다.
   *
   * 원본에 없던 prop이다. 반복 장치가 어절을 갈아치우는 방식이라 어절이 하나면 갈 곳이
   * 없어서 `scheduleNextWord`가 즉시 빠져나갔다 — 헤더 브랜드(`flow Cockpit`)는 어절이
   * 하나인데 주기적으로 흘러야 한다. `words={['Cockpit','Cockpit']}`로 우회할 수 있지만
   * 왜 두 번 적었는지를 나중에 해독해야 한다.
   */
  repeatDelay?: number;
  /** Returns to the first word after the final word. */
  loop?: boolean;
  /** Starts when the text enters the viewport. */
  startOnView?: boolean;
  /** Only starts on the first viewport entry. */
  once?: boolean;
  /** IntersectionObserver root margin used by the viewport trigger. */
  inViewMargin?: UseInViewOptions["margin"];
  className?: string;
};

function composeChromaticGradient(colors: string[], foregroundColor: string) {
  const palette = colors.length > 0 ? colors : CHROMATIC_PALETTE;
  const colorStops = palette.map((color, index) => {
    const offset =
      palette.length === 1
        ? 0
        : -TRAIL_HALF_WIDTH +
          (index / (palette.length - 1)) * TRAIL_HALF_WIDTH * 2;
    const operator = offset < 0 ? "-" : "+";
    const distance = Number(Math.abs(offset).toFixed(2));
    return `${color} calc(var(--chromatic-sweep) ${operator} ${distance}%)`;
  });

  return `linear-gradient(90deg, ${foregroundColor} 0%, ${foregroundColor} calc(var(--chromatic-sweep) - ${TRAIL_HALF_WIDTH}%), ${colorStops.join(", ")}, transparent calc(var(--chromatic-sweep) + ${TRAIL_HALF_WIDTH}%), transparent 100%)`;
}

export function ChromaticTextReveal({
  prefix,
  words,
  colors = CHROMATIC_PALETTE,
  foregroundColor = "var(--foreground)",
  duration = 1.2,
  delay = 0,
  pauseDuration = 0.8,
  repeatDelay,
  loop = true,
  startOnView = true,
  once = true,
  inViewMargin,
  className,
}: ChromaticTextRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | null>(null);
  const [wordIndex, setWordIndex] = useState(0);
  // `repeatDelay`용 카운터. 어절 순환과 별개로 키에 섞여서, 어절이 하나여도 키가 바뀌어
  // 스윕이 처음부터 다시 흐른다.
  const [cycle, setCycle] = useState(0);
  const reduceMotion = useReducedMotion();
  const isInView = useInView(ref, {
    once,
    margin: inViewMargin,
    amount: 0.4,
  });
  const shouldReveal = !startOnView || isInView || reduceMotion;
  const backgroundImage = composeChromaticGradient(colors, foregroundColor);
  const hasWords = words.length > 0;
  const activeIndex = hasWords ? wordIndex % words.length : 0;
  const activeWord = words[activeIndex] ?? "";
  const sizingWords = Array.from(new Set(words));

  const clearPendingWord = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleNextWord = useCallback(() => {
    clearPendingWord();
    if (reduceMotion || !shouldReveal) return;

    const isLastWord = activeIndex === words.length - 1;

    // 갈 어절이 남았으면 다음 어절로 넘어간다 (원본 그대로).
    if (words.length > 1 && !(isLastWord && !loop)) {
      timerRef.current = window.setTimeout(() => {
        setWordIndex((index) => (index + 1) % words.length);
      }, pauseDuration * 1000);
      return;
    }

    // 여기부터는 갈 어절이 없다. `repeatDelay`가 있으면 처음부터 다시 흐른다.
    if (repeatDelay === undefined || !isLastWord) return;

    timerRef.current = window.setTimeout(() => {
      setCycle((n) => n + 1);
      setWordIndex(0);
    }, repeatDelay * 1000);
  }, [
    activeIndex,
    clearPendingWord,
    loop,
    pauseDuration,
    reduceMotion,
    repeatDelay,
    shouldReveal,
    words.length,
  ]);

  useEffect(() => clearPendingWord, [clearPendingWord]);

  return (
    <span ref={ref} className={cn("inline-flex items-baseline", className)}>
      <span className="whitespace-nowrap">
        {prefix}
        {hasWords ? " " : null}
      </span>
      {hasWords ? (
        <span className="relative inline-grid">
          {sizingWords.map((word) => (
            <span
              key={word}
              aria-hidden
              className="invisible col-start-1 row-start-1 whitespace-nowrap"
            >
              {word}
            </span>
          ))}
          {/* Moving a clipped text gradient defines this effect. Paint
              containment bounds that deliberate repaint to the active word. */}
          <motion.span
            key={`${activeWord}-${activeIndex}-${cycle}`}
            aria-hidden
            // 원본은 `reduceMotion ? false : {…}`였다. `useReducedMotion()`은 서버에서
            // false·클라이언트에서 true라 이 자리에서 갈리면 서버 HTML에만 시작 스타일이
            // 붙어 hydration이 어긋난다. 아래 `transition`이 이미 줄임 모드에서 네 값 모두
            // `duration: 0`으로 떨어뜨리므로 분기가 없어도 결과는 같다.
            initial={{
              opacity: 0.56,
              filter: "blur(6px)",
              transform: "translateY(5px)",
            }}
            animate={{
              "--chromatic-sweep": shouldReveal
                ? REVEAL_FINISH
                : REVEAL_START,
              opacity: 1,
              filter: "blur(0px)",
              transform: "translateY(0px)",
            }}
            transition={{
              "--chromatic-sweep": reduceMotion
                ? { duration: 0 }
                : { duration, delay, ease: EASE_IN_OUT },
              opacity: reduceMotion
                ? { duration: 0 }
                : { duration: 0.28, ease: EASE_OUT },
              filter: reduceMotion
                ? { duration: 0 }
                : { duration: 0.36, ease: EASE_OUT },
              transform: reduceMotion
                ? { duration: 0 }
                : { duration: 0.36, ease: EASE_OUT },
            }}
            onAnimationComplete={scheduleNextWord}
            className="absolute start-0 top-0 whitespace-nowrap bg-clip-text text-transparent [background-image:var(--chromatic-gradient)] [contain:paint]"
            style={{
              // 여기도 분기를 뺐다 (`initial` 설명과 같은 이유). 줄임 모드에서는 위
              // `animate`가 `REVEAL_FINISH`를 0초로 얹는다.
              "--chromatic-sweep": REVEAL_START,
              "--chromatic-gradient": backgroundImage,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
            } as MotionStyle}
          >
            {activeWord}
          </motion.span>
          <span className="sr-only">{activeWord}</span>
        </span>
      ) : null}
    </span>
  );
}
