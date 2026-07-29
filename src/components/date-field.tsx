"use client";

import { useState } from "react";
import { ko } from "date-fns/locale";
import { IconCalendar } from "@/components/icons";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * 날짜 고르기 — shadcn Calendar(react-day-picker) + Popover.
 *
 * 예전에는 `<input type="date">`였다. 브라우저 기본 달력은 공짜지만 생김새를 브라우저가
 * 정한다 — 사파리·크롬·파이어폭스가 다 다르고, 이 앱의 어두운 pill 사이에서 혼자 흰 네모다.
 * 값은 그대로 `YYYY-MM-DD` 문자열이라 서버 액션은 손대지 않았다.
 *
 * 팝오버는 Portal로 나간다. 접기 패널 안에서 열어도 카드 모서리에 안 잘린다 (BUG-009).
 *
 * **`Date`를 밖으로 흘리지 않는다.** react-day-picker는 로컬 자정 `Date`를 주는데,
 * `toISOString()`을 태우면 UTC로 9시간 당겨져서 한국 오전이 전날로 저장된다.
 * 변환은 아래 두 함수가 로컬 필드로만 한다.
 */

/** 바꾸기 모달의 고르기 칸과 같은 pill (`task-actions.tsx` `Pick`). */
const TRIGGER_PILL =
  "flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50";

/** `YYYY-MM-DD` → 로컬 자정 `Date`. 형식이 어긋나면 undefined. */
function toDate(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

/** 로컬 `Date` → `YYYY-MM-DD`. */
const toValue = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

export function DateField({
  name,
  value,
  onChange,
  placeholder = "날짜 고르기",
  className,
  "aria-labelledby": labelledBy,
}: {
  /** FormData에 실릴 이름. 값은 `YYYY-MM-DD`로 나간다. */
  name: string;
  /** `YYYY-MM-DD`. 빈 문자열이면 아직 안 골랐다는 뜻이다. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-labelledby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* 폼 안이다 — `type="button"`이 없으면 날짜를 고르려다 폼이 나간다 */}
      <PopoverTrigger
        type="button"
        aria-labelledby={labelledBy}
        className={cn("tabular", TRIGGER_PILL, !value && "text-muted-foreground", className)}
      >
        <IconCalendar size={13} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
      </PopoverTrigger>
      {/* 달력 폭에 맞춘다. 기본값(`w-72` + 안쪽 여백)은 7칸짜리 격자보다 넓어 오른쪽이 빈다.
          `z-[110]`은 바꾸기 모달(`z-[100]` — center-morph-modal)보다 위로 올리는 값이다.
          기본 `z-50`이면 모달 안에서 열었을 때 달력이 패널 뒤로 들어간다 */}
      <PopoverContent align="start" className="z-[110] w-auto p-0">
        <Calendar
          mode="single"
          locale={ko}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(date ? toValue(date) : "");
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
      {/* 트리거는 button이라 FormData에 안 들어간다 — 값은 이 hidden이 싣는다 */}
      <input type="hidden" name={name} value={value} />
    </Popover>
  );
}
