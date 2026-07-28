"use client";
// beui.dev/components/motion/number
//
// 오늘 화면 요약 카드의 건수(마감 임박 / 밀리는 업무 / 답 기다리는 멘션 /
// 방치된 업무)가 자리마다 굴러 올라간다.
//
// beUI 원본에서 한 군데 고쳤다: `armed`를 state + effect로 두던 걸 파생값으로 바꿨다.
// 원본은 effect 안에서 `setArmed(true)`를 동기 호출하는데 이 프로젝트 eslint가
// `react-hooks/set-state-in-effect`로 막는다. `useInView`가 `once: true`라 한 번
// true가 되면 되돌아오지 않으므로 `!startOnView || inView`로 그대로 대체된다.
//
// ⚠ `format` prop은 함수라 서버 컴포넌트에서 넘길 수 없다. 천단위 구분이 필요하면
// `locale`을 쓴다 (여기 건수는 한두 자리라 둘 다 안 쓴다).

import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export interface NumberTickerProps {
  value: number;
  /** Digits to pad to (left). */
  pad?: number;
  /** Per-digit roll duration in seconds. */
  duration?: number;
  /** Stagger between digits. */
  stagger?: number;
  /** Render only after the element enters the viewport. */
  startOnView?: boolean;
  prefix?: string;
  suffix?: string;
  /** Add a small blur during digit rolls. */
  blur?: boolean;
  className?: string;
  digitClassName?: string;
  /** Insert locale group separators (commas). Server-component safe. */
  locale?: boolean;
  /** Custom formatter. Client-only — server components must use `locale` instead. */
  format?: (value: number) => string;
}

const DIGITS = Array.from({ length: 10 }, (_, n) => n);

export function NumberTicker({
  value,
  pad,
  duration = 0.9,
  stagger = 0.04,
  startOnView = true,
  prefix,
  suffix,
  blur = false,
  className,
  digitClassName,
  locale,
  format,
}: NumberTickerProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.6 });
  const armed = !startOnView || inView;

  const text = useMemo(() => {
    const rounded = Math.round(value);
    const formatted = format
      ? format(rounded)
      : locale
        ? rounded.toLocaleString()
        : rounded.toString();
    return pad ? formatted.padStart(pad, "0") : formatted;
  }, [value, pad, format, locale]);
  const glyphs = useMemo(() => {
    const chars = text.split("");
    // Key by place value (position from the right): a changing digit keeps its
    // identity and rolls to the new value instead of remounting and replaying
    // from 0. Growing numbers add glyphs on the left without re-keying the
    // ones, tens, hundreds already on screen.
    return chars.map((char, i) => ({ char, id: `g-${chars.length - 1 - i}` }));
  }, [text]);
  const readableText = `${prefix ?? ""}${text}${suffix ?? ""}`;

  // Stagger is an entrance flourish. Once the reveal has played, value
  // changes roll every digit immediately — a per-digit delay on live updates
  // reads as lag.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!armed || entered) return;
    const total = (duration + glyphs.length * stagger) * 1000;
    const t = window.setTimeout(() => setEntered(true), total);
    return () => window.clearTimeout(t);
  }, [armed, entered, duration, stagger, glyphs.length]);

  return (
    <span
      ref={containerRef}
      className={cn("inline-flex items-baseline tabular-nums", className)}
    >
      <span className="sr-only">{readableText}</span>
      <span aria-hidden="true" className="inline-flex items-baseline">
        {prefix ? <span>{prefix}</span> : null}
        {glyphs.map(({ char, id }, i) => {
          const isDigit = /\d/.test(char);
          if (!isDigit) {
            return (
              <span key={id} className="inline-block">
                {char}
              </span>
            );
          }
          const digit = Number(char);
          return (
            <Digit
              key={id}
              digit={armed ? digit : 0}
              delay={entered ? 0 : i * stagger}
              duration={duration}
              blur={blur}
              className={digitClassName}
            />
          );
        })}
        {suffix ? <span>{suffix}</span> : null}
      </span>
    </span>
  );
}

function Digit({
  digit,
  delay,
  duration,
  blur,
  className,
}: {
  digit: number;
  delay: number;
  duration: number;
  blur: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const columnRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduce || !blur || !columnRef.current || !Number.isFinite(digit)) {
      return;
    }

    const node = columnRef.current;
    const controls = animate(
      node,
      { filter: ["blur(10px)", "blur(0px)"] },
      {
        duration: Math.min(duration * 0.75, 0.32),
        delay,
        ease: EASE_OUT,
      },
    );

    return () => {
      controls.stop();
      node.style.filter = "blur(0px)";
    };
  }, [blur, delay, digit, duration, reduce]);

  return (
    <span className={cn("relative inline-block", className)}>
      {/*
       * 베이스라인 기준점. 굴러가는 열은 `overflow-hidden`이라 그것만 두면 인라인
       * 베이스라인이 **박스 아래 끝**으로 잡힌다 (CSS 규칙). 그러면 옆에 붙는 단위
       * 텍스트("/ 31")보다 숫자가 한참 위로 뜬다. 안 보이는 숫자 하나를 흐름에 남겨
       * 두면 일반 텍스트와 똑같은 베이스라인이 생긴다.
       *
       * 폭도 이 글자가 정한다 — 루트에 `tabular-nums`가 걸려 있어서 어느 숫자든 자폭이
       * 같다. 전에는 `1ch`로 박아 뒀는데 `ch`는 tabular 자폭이 아니라 비례 `0`의 자폭이다.
       */}
      <span className="invisible">{digit}</span>
      {/* 창 높이 = 위 글자의 줄 높이. 아래 행이 이 높이의 10%라 정확히 한 칸씩 구른다. */}
      <span className="absolute inset-0 overflow-hidden">
        <motion.span
          ref={columnRef}
          initial={{ y: 0 }}
          animate={{ y: `-${digit * 10}%` }}
          transition={reduce ? { duration: 0 } : { duration, delay, ease: EASE_OUT }}
          className="absolute inset-x-0 top-0 flex h-[1000%] flex-col will-change-[transform,filter]"
        >
          {DIGITS.map((n) => (
            <span key={n} className="h-[10%] shrink-0">
              {n}
            </span>
          ))}
        </motion.span>
      </span>
    </span>
  );
}
