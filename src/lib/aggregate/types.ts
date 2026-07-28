/**
 * 집계 레이어의 입력 도메인 타입.
 *
 * flow API 응답 형태가 아니라 **정규화된** 형태다. `lib/flow/` 어댑터가 여기로 변환한다 (PRD §5.1).
 * 날짜 필드는 flow 원본 문자열 포맷(`YYYYMMDD` / `YYYYMMDDHHmmss`)을 그대로 유지한다.
 */

/** 우선순위. flow 원본 코드가 무엇이든 어댑터가 이 4단계로 정규화한다. */
export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface Task {
  /** 태스크 식별자. 집계 전반의 조인 키. */
  id: string;
  title: string;
  projectId?: string | null;
  projectName?: string | null;
  /** 마감. `YYYYMMDD` 또는 `YYYYMMDDHHmmss`. 없으면 null. */
  due?: string | null;
  /** 마지막 활동(댓글·상태변경 등) 일시. `YYYYMMDDHHmmss`. */
  lastActivityAt?: string | null;
  /** 0~100. */
  progress?: number | null;
  /** flow 상태 컬럼 라벨 원문. */
  status?: string | null;
  /** 어댑터가 완료 여부를 확정할 수 있으면 여기에. 없으면 progress/status로 추론한다. */
  done?: boolean | null;
  priority?: TaskPriority | null;
  /** flow 딥링크. */
  url?: string | null;
}

/** `/user/alarms` 한 건. */
export interface Alarm {
  /** 발신자(멘션한 사람). */
  from: string;
  /** 태스크 제목. 뒤쪽 공백이 붙어 오는 경우가 있어 그룹 키로 쓰지 않는다. */
  title: string;
  /** `YYYYMMDDHHmmss`. */
  at: string;
  /** 태스크 딥링크. taskId가 없을 때의 그룹 키. */
  link: string;
  /** 알림 자체의 id — 읽음 처리(`PATCH /user/alarms/read`)에 쓴다. */
  id?: string | null;
  /** 어댑터가 태스크 id를 알아낼 수 있으면 여기에. 그룹 키 1순위. */
  taskId?: string | null;
  /** 내가 멘션된 댓글 본문. 알림 API만 준다 (`lib/flow/rest.ts`). */
  content?: string;
  /** 다른 댓글에 달린 답글이면 true. 화면에서 한 단 들여쓴다. */
  isReply?: boolean;
}

export interface Project {
  id: string;
  name: string;
  tasks: Task[];
}
