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
import { IconInfo } from "@/components/icons";

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
    // 아이콘은 첫 줄 글자에 맞춰 세운다 (`mt-0.5`) — 줄이 넘어가도 글이 아이콘 아래로
    // 흘러들지 않게 `items-start`다. 로그인 안내 줄과 같은 모양이라 "이건 안내"가 화면
    // 어디서든 같은 그림으로 읽힌다 (`api-key-gate.tsx`)
    <div className="mt-6 space-y-2 text-xs leading-relaxed text-muted-foreground">
      {truncated.length > 0 && (
        <p className="flex items-start gap-1.5">
          <IconInfo size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{truncated.join(", ")}는 담당 업무가 300건을 넘어서 앞의 300건만 가져왔어요.</span>
        </p>
      )}
      {failed.length > 0 && (
        <p className="flex items-start gap-1.5">
          <IconInfo size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {failed.join(", ")}는 지금 조회가 막혀서 위 숫자에서 빠져 있어요. 잠시 뒤에 새로 고쳐
            보세요.
          </span>
        </p>
      )}
    </div>
  );
}
