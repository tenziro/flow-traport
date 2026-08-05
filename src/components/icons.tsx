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
  Checklist as IconMyTasks,
  AlertTriangle as IconRisk,
  Users as IconTeam,
  Folder as IconProject,
  /** 내 업무의 프로젝트 카드 머리. flow에서 프로젝트 홈 탭이 `FEED`다 (api-spec §5.3) */
  Feed as IconFeed,
  Clock as IconImminent,
  Hourglass as IconDelay,
  MoonSleep as IconStale,
  CheckCircle as IconNormal,
  Inbox as IconInbox,
  AtSign as IconMention,
  RecordCircle as IconDot,
  Target as IconFocus,
  Comment as IconComment,
  Copy as IconCopy,
  ChatLine as IconLastComment,
  ArrowUpRight as IconOpen,
  /** 하위 업무 표시 (↳). 표 안에서 들여쓰기 대신 업무명 앞에 선다. */
  Forward2 as IconSubTask,
  /** 모달의 상위 업무 (⬆). 아래 하위 업무(⬇)와 위아래로 짝을 이룬다. */
  ArrowUpSquare as IconUpTask,
  /** 모달의 하위 업무 (⬇). 표의 `IconSubTask`(↳)와 달리 들여쓰기 구실은 안 한다. */
  ArrowDownSquare as IconDownTask,
  /** 첨부 파일. */
  Paperclip as IconAttach,
  /** 시스템이 남긴 변경 기록. 댓글 목록에서 사람 말(말풍선)과 가른다. */
  History as IconHistory,
  InfoCircle as IconInfo,
  Loader as IconLoader,
  X as IconClose,
  Add as IconAdd,
  ChevronDown as IconChevronDown,
  ChevronLeft as IconChevronLeft,
  ChevronRight as IconChevronRight,
  Check as IconCheck,
  /** 로그아웃. reicon 이름은 `Login4`(문과 화살표)다 — 뜻은 앱 이름 쪽이 정한다. */
  Login4 as IconSignOut,
  /* 표(`motion/table`)가 쓰는 것들. beUI 원본은 lucide를 쓰는데 이 앱은 아이콘셋이
     하나여야 해서 여기서 갈아 끼운다. reicon에 없는 짝은 뜻이 같은 것으로 바꿨다 —
     `GripVertical`(잡이)은 `Menu`, `Arrow*ToLine`(앞/뒤에 끼우기)은 방향 화살표다. */
  /** 표 머리의 정렬 표시 — 아직 안 누른 칸. 누르면 `IconArrowUp`·`IconArrowDown`이 된다. */
  SortV as IconSortV,
  Menu as IconGrip,
  MoreH as IconMoreH,
  More as IconMoreV,
  Trash2 as IconTrash,
  ArrowUp as IconArrowUp,
  ArrowDown as IconArrowDown,
  ArrowLeft as IconArrowLeft,
  ArrowRight as IconArrowRight,
  Calendar as IconCalendar,
  Repeat as IconRepeat,
  UserCheck as IconAttending,
  BellRing as IconNews,
  /** 소식 알림 스위치가 꺼진 자리. 켜지면 `IconNews`로 바뀐다 (`use-news-notify.ts`). */
  BellOff as IconNewsOff,
  Sparkles as IconChangelog,
  Magnifier as IconSearch,
  Flag as IconPriority,
  /* 우선순위 네 단계 표시 — 낮음 ↓ / 보통 — / 높음 ↑ / 긴급 경보등. flow 화면이 쓰는 그림을
     그대로 따른다. 위아래 화살은 표가 쓰는 것과 같아서(`IconArrowUp`·`IconArrowDown`)
     없던 둘만 여기 더한다 (`task-actions.tsx` `PRIORITY_MARK`). */
  Minus as IconMinus,
  Siren as IconSiren,
  User as IconWorker,
  Sun as IconLight,
  Moon as IconDark,
  Monitor as IconSystem,
  SidebarLeft as IconSidebar,
} from "reicon-react";

export type { IconProps } from "reicon-react";
