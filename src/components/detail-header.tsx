import { Children } from "react";

/**
 * 상세 모달 머리. 업무 상세 모달(`TaskDetailModal`)과 멘션 상세 모달(`MentionDetail`)이
 * 같은 것을 쓴다.
 *
 * 둘은 오늘 화면에서 나란히 선 두 표가 여는 모달인데 머리 구성이 서로 달랐다 — 업무 쪽은
 * 프로젝트명·업무번호를 선으로 가른 딱지 줄이 따로 있고, 멘션 쪽은 프로젝트명이 제목 바로
 * 위에 붙어 있었다. 같은 업무를 두 자리에서 다른 모양으로 보면 같은 것인지 알아보는 데
 * 시간이 든다 (`DDay`·`TaskTable`과 같은 이유다).
 *
 * 두 단이다. 위는 **이게 어느 것인가** — 왼쪽 프로젝트명, 오른쪽 식별자. 아래는 제목과
 * 곁줄(`children`)이고, 상태·D-day·건수처럼 모달마다 다른 값이 그 자리에 온다.
 *
 * 선은 패널 폭 끝까지 닿는다 — 여백은 안쪽 줄이 갖고 선은 감싼 칸이 그린다. 안쪽으로 물린
 * 선은 덩어리를 가르는 게 아니라 밑줄로 읽힌다.
 */
export function DetailHeader({
  project,
  badge,
  title,
  titleId,
  children,
}: {
  /** 왼쪽 딱지. 못 풀었으면 부르는 쪽이 대체 문구를 넣는다. */
  project: string;
  /**
   * 오른쪽 딱지 (`업무번호 1234`). **있을 때만 선다** — 멘션은 알림에서 오는데 알림이
   * 업무번호를 안 준다 (`groupMentions`의 키는 링크일 수도 있다). 없는 번호를 게시글
   * 번호로 대신 채우면 flow에서 사람끼리 부르는 번호와 달라서 없느니만 못하다.
   */
  badge?: React.ReactNode;
  title: string;
  /** 패널의 `aria-describedby`가 가리키는 값. */
  titleId: string;
  /**
   * 제목 아래 곁줄. 조건을 부르는 쪽에서 걸어도 된다 — `false`·`null`은 여기서 걸러서
   * 낼 게 하나도 없으면 줄 자체를 안 만든다. 빈 줄이 서면 제목 밑이 그만큼 벌어진다.
   */
  children?: React.ReactNode;
}) {
  const aside = Children.toArray(children);

  return (
    <div className="border-b border-border">
      {/* 프로젝트명과 식별자를 한 줄로 묶고 선으로 갈랐다 — 둘 다 "이게 어느 업무인가"를
          가리키는 딱지고, 제목은 그 안의 내용이다. 번호가 오른쪽 끝인 것은 왼쪽에서 읽히는
          이름과 부딪히지 않게 하려는 것이다. 배경 칩을 뗀 것도 같은 이유다: 선이 이미
          갈라 주는데 면까지 두면 머리에서 제일 무거운 게 번호가 된다 */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-2.5">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{project}</p>
        {badge && (
          <span className="tabular shrink-0 text-[11px] text-muted-foreground">{badge}</span>
        )}
      </div>
      <div className="px-5 pt-3 pb-4">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {aside.length > 0 && (
          <div className="tabular mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {aside}
          </div>
        )}
      </div>
    </div>
  );
}
