"use client";
// beui.dev/components/motion/text-animation

import { motion, type Transition, useInView, useReducedMotion } from "motion/react";
import { useRef, type ElementType, type ReactNode } from "react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

type SplitMode = "word" | "char";

export interface TextRevealProps {
  text: string | string[];
  as?: ElementType;
  className?: string;
  split?: SplitMode;
  stagger?: number;
  delay?: number;
  blur?: number;
  yOffset?: string | number;
  spring?: { stiffness?: number; damping?: number; mass?: number };
  once?: boolean;
  whileInView?: boolean;
  children?: ReactNode;
}

const DEFAULT_SPRING = { stiffness: 140, damping: 26, mass: 1.2 };

export function TextReveal({
  text,
  as: Comp = "span",
  className,
  split = "word",
  stagger = 0.09,
  delay = 0,
  blur = 12,
  yOffset = "40%",
  spring,
  once = true,
  whileInView = false,
  children,
}: TextRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once, amount: 0.4 });
  const reduce = useReducedMotion();
  const shouldAnimate = whileInView ? inView : true;

  const lines = Array.isArray(text) ? text : [text];
  const s = { ...DEFAULT_SPRING, ...spring };

  // beUI 원본은 렌더 중 카운터(`unitIndex`)를 증가시켜 낱말 순번을 매긴다. React Compiler
  // 린트가 그걸 막아서(`react-hooks/immutability`) 줄마다 앞선 낱말 수를 미리 더해 두는
  // 식으로 바꿨다 — 나오는 순번은 원본과 같다.
  const unitsByLine = lines.map((line) => (split === "word" ? line.split(" ") : Array.from(line)));
  const offsets = unitsByLine.map((_, i) =>
    unitsByLine.slice(0, i).reduce((sum, units) => sum + units.length, 0),
  );
  const lineCounts = new Map<string, number>();

  return (
    <Comp ref={ref} className={cn("block", className)}>
      {lines.map((line, lineIndex) => {
        const units = unitsByLine[lineIndex];
        const lineCount = lineCounts.get(line) ?? 0;
        lineCounts.set(line, lineCount + 1);
        const lineKey = `${line}-${lineCount}`;
        const unitCounts = new Map<string, number>();

        return (
          <span key={lineKey} className="block">
            {units.map((unit, i) => {
              const d = delay + (offsets[lineIndex] + i) * stagger;
              const unitCount = unitCounts.get(unit) ?? 0;
              unitCounts.set(unit, unitCount + 1);
              const unitKey = `${unit}-${unitCount}`;
              const initial = reduce
                ? { opacity: 0 }
                : { y: yOffset, opacity: 0, filter: `blur(${blur}px)` };
              const animate = shouldAnimate
                ? reduce
                  ? { opacity: 1 }
                  : { y: 0, opacity: 1, filter: "blur(0px)" }
                : initial;
              const transition: Transition = reduce
                ? { opacity: { duration: 0.25, ease: EASE_OUT, delay: d * 0.3 } }
                : {
                    y: { type: "spring" as const, ...s, delay: d },
                    opacity: { duration: 0.7, ease: EASE_OUT, delay: d },
                    filter: { duration: 0.9, ease: EASE_OUT, delay: d },
                  };
              return (
                <motion.span
                  key={unitKey}
                  initial={initial}
                  animate={animate}
                  transition={transition}
                  className="inline-block will-change-transform"
                >
                  {unit}
                  {split === "word" && i < units.length - 1 ? (
                    <span className="inline-block">&nbsp;</span>
                  ) : null}
                </motion.span>
              );
            })}
          </span>
        );
      })}
      {children}
    </Comp>
  );
}
