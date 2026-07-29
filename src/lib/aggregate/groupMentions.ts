/**
 * 멘션 접기 (PRD §6.1.2) — 핵심 차별점.
 *
 * flow 기본 알림함은 같은 태스크에서 다섯 번 불려도 다섯 줄이다.
 * 태스크 단위로 접으면 작성자 계정 실측 기준 28건 → 14행.
 */

import { parseFlowDate } from './date';
import type { Alarm } from './types';

export interface MentionGroup {
  /** 그룹 키. `alarm.taskId`가 있으면 그것, 없으면 `alarm.link`. */
  taskId: string;
  /** 가장 최근 알림의 제목(trim). */
  title: string;
  /** 이 태스크의 알림 건수. */
  count: number;
  /** 마지막 발언자. */
  lastFrom: string;
  /** 마지막 알림 시각 — flow 원본 문자열. */
  lastAt: string;
  /** 정렬·표시용 epoch ms. 파싱 불가면 null. */
  lastAtMs: number | null;
  /** 태스크 딥링크. */
  link: string;
  /** 프로젝트 id. 알림 조회가 실패했으면 undefined — 화면에서 프로젝트명이 빠진다. */
  projectId?: string;
  /** 이 중 아직 안 읽은 건수 (PRD §13 A5). 0이면 화면이 강조를 뺀다. */
  unread: number;
  /** 게시글 id. 전체 댓글 스레드를 열 때 쓴다 (PRD §13 A1). */
  postId?: string;
  /** 행 펼침용 원본 알림 — 최신순. 읽음 처리도 이 배열 전체를 한 번에. */
  alarms: Alarm[];
}

/** 제목이 아니라 태스크 식별자로 묶는다 — 제목에는 뒤쪽 공백 등 표기 흔들림이 있다. */
const keyOf = (alarm: Alarm): string => alarm.taskId?.trim() || alarm.link.trim();

/**
 * 동일 태스크의 알림을 한 행으로 병합한다. 정렬은 마지막 알림 시각 내림차순.
 *
 * 시각을 파싱할 수 없는 알림은 그룹 안에서 가장 오래된 것으로 취급하고, 그룹 전체가
 * 그렇다면 맨 뒤로 밀린다(버리지 않는다 — 건수는 맞아야 한다).
 */
export function groupMentions(alarms: readonly Alarm[]): MentionGroup[] {
  const groups = new Map<string, Alarm[]>();
  for (const alarm of alarms) {
    const key = keyOf(alarm);
    const bucket = groups.get(key);
    if (bucket) bucket.push(alarm);
    else groups.set(key, [alarm]);
  }

  // ponytail: 파싱 실패 = -1. flow 날짜는 항상 1970 이후라 실제 값과 충돌하지 않는다.
  const at = (a: Alarm) => parseFlowDate(a.at) ?? -1;

  return [...groups.entries()]
    .map(([taskId, bucket]): MentionGroup => {
      const sorted = [...bucket].sort((a, b) => at(b) - at(a));
      const latest = sorted[0];
      const latestMs = at(latest);
      return {
        taskId,
        title: latest.title.trim(),
        count: sorted.length,
        lastFrom: latest.from,
        lastAt: latest.at,
        lastAtMs: latestMs >= 0 ? latestMs : null,
        link: latest.link,
        // 같은 태스크의 알림이라 프로젝트도 같다. 붙은 것 중 아무거나 — 알림 조인이
        // 어긋난 건은 projectId가 비어 있어서 최신 것만 보면 놓친다.
        projectId: sorted.find((a) => a.projectId)?.projectId,
        unread: sorted.filter((a) => a.unread).length,
        postId: sorted.find((a) => a.postId)?.postId,
        alarms: sorted,
      };
    })
    .sort(
      (a, b) =>
        (b.lastAtMs ?? -1) - (a.lastAtMs ?? -1) ||
        b.count - a.count ||
        a.title.localeCompare(b.title),
    );
}
