/**
 * 못 가져온 프로젝트를 밝히는 줄 (bug-report BUG-040).
 *
 * 화면 하나가 프로젝트 수만큼 REST를 부르는데(실측 59회) 분당 상한이 120회다. 상한에
 * 걸리거나 권한이 없는 프로젝트는 `collectTasks`가 이름만 들고 빠져나오고, 그 이름을
 * 여기서 적는다 — **건수가 실제보다 적게 보이는 게 제일 나쁘다.**
 *
 * 네 화면이 같은 말을 해야 해서 조각 하나로 모았다. 오늘·내 업무 화면은 각자 같은 문장을
 * 들고 있었고 팀·리스크는 아예 없었다 — 부서 전체를 훑어 429가 제일 잘 나는 자리인데
 * 거기서만 조용히 적게 보였다.
 */
export function CollectNotice({
  truncated,
  failed,
}: {
  /** 페이지 상한(300건)에 걸린 프로젝트 이름. */
  truncated: readonly string[];
  /** 조회가 막힌 프로젝트 이름 (권한·429). */
  failed: readonly string[];
}) {
  if (truncated.length === 0 && failed.length === 0) return null;

  return (
    <div className="mt-6 space-y-2 text-xs text-muted-foreground">
      {truncated.length > 0 && (
        <p>{truncated.join(", ")}는 담당 업무가 300건을 넘어서 앞의 300건만 가져왔어요.</p>
      )}
      {failed.length > 0 && (
        <p>
          {failed.join(", ")}는 지금 조회가 막혀서 위 숫자에서 빠져 있어요. 잠시 뒤에 새로 고쳐
          보세요.
        </p>
      )}
    </div>
  );
}
