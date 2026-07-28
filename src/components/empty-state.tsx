/**
 * 카드 안이 비었을 때 (PRD §7.1).
 *
 * 점선 테두리와 `bg-card`를 뺐다 — 호출부 다섯 곳 중 넷이 이미 `Card` 안이라
 * 카드 안에 카드가 하나 더 생겼다. 비었다는 건 여백과 아이콘으로 충분히 읽힌다.
 *
 * 아이콘은 맨 위에 원형 판을 깔고 얹는다. 그냥 두면 제목 글자와 크기가 비슷해서
 * 제목의 앞머리처럼 보였다 — 원형 판이 있어야 이 칸의 상태를 가리키는 표지로 읽힌다.
 * 색은 항상 muted다. 카드 제목의 빨강·노랑을 여기까지 끌고 오면 비어 있는 게
 * 문제처럼 보이는데, 대개는 좋은 소식이다.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  /** 카드 제목과 **같은** 아이콘을 넘긴다. 어느 칸이 비었는지가 아이콘으로 먼저 읽힌다. */
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-4 py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-prose text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
