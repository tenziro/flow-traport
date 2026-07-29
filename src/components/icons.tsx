/**
 * 아이콘 격리 모듈 — Reicon (https://reicon.dev).
 *
 * 앱의 나머지 코드는 `reicon-react`를 직접 import 하지 않는다. 전부 여기를 거쳐
 * 앱 의미(오늘/리스크/방치…)로 부른다. 아이콘셋을 바꿔도 고칠 파일은 여기 하나다.
 *
 * props: `size`(기본 24) / `weight`("Outline" | "Filled") / `color` / `strokeWidth`.
 */
export {
  CalendarCheck as IconToday,
  AlertTriangle as IconRisk,
  Users as IconTeam,
  Folder as IconProject,
  Clock as IconImminent,
  Hourglass as IconDelay,
  MoonSleep as IconStale,
  CheckCircle as IconNormal,
  Inbox as IconInbox,
  AtSign as IconMention,
  RecordCircle as IconDot,
  Target as IconFocus,
  Comment as IconComment,
  ChatLine as IconLastComment,
  ArrowUpRight as IconOpen,
  InfoCircle as IconInfo,
  Loader as IconLoader,
  X as IconClose,
  Add as IconAdd,
  ChevronDown as IconChevronDown,
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
  Check as IconCheck,
  Logout as IconSignOut,
  Calendar as IconCalendar,
  BellRing as IconNews,
  Magnifier as IconSearch,
  Flag as IconPriority,
  User as IconWorker,
  Sun as IconLight,
  Moon as IconDark,
  Monitor as IconSystem,
} from "reicon-react";

export type { IconProps } from "reicon-react";
