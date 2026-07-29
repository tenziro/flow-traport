import { type NextRequest, NextResponse } from "next/server";
import { flowPostUrl } from "@/lib/flow/queries";
import { getPostBrief } from "@/lib/flow/rest";

/**
 * 게시글 딥링크 해소 (PRD §6.4).
 *
 * 검색 결과는 `postId`만 준다. 로그인 화면을 건너 살아남는 링크(`connectUrl`)는 게시글
 * 상세에만 있어서(BUG-024), 검색 결과 여덟 줄을 미리 풀면 검색 한 번에 REST 여덟 번이다.
 * **눌린 것만** 여기서 한 번 풀고 302로 보낸다.
 *
 * 프록시가 로그인 게이트라 세션 없이는 이 경로에 못 들어온다 (`proxy.ts` matcher).
 *
 * `projectId`는 대비용이다 — `connectUrl`이 없거나 조회가 실패하면 조립한 URL로 보낸다.
 * 그 URL은 flow 세션이 없으면 대상을 잃지만, 아무 데도 못 가는 것보다 낫다.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const projectId = req.nextUrl.searchParams.get("projectId") ?? "";

  // ID는 숫자다. 검증하지 않으면 경로가 flow API 호출에 그대로 들어간다.
  if (!/^\d+$/.test(postId) || !/^\d*$/.test(projectId)) {
    return new NextResponse("잘못된 주소예요.", { status: 400 });
  }

  const url = await getPostBrief(postId)
    .then((brief) => brief.url)
    .catch(() => null);
  const fallback = projectId ? flowPostUrl(projectId, postId) : "https://flow.team/";

  return NextResponse.redirect(url ?? fallback, { status: 302 });
}
