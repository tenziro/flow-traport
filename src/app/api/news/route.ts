import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadNews } from "@/lib/flow/queries";

/**
 * 헤더 소식 폴링 (PRD §13 B1·B2).
 *
 * flow는 알림을 밀어 주지 않는다 — 웹훅도 구독도 없고 알림 목록 조회 하나뿐이다. 그래서
 * 종이 1분마다 여기를 부른다 (`NewsBell`). 화면을 새로 고치지 않아도 배지가 그때 켜진다.
 *
 * 서버 액션이 아니라 라우트로 둔다 — 액션은 응답에 현재 화면의 RSC를 실어 보낼 수 있어서,
 * 1분마다 오늘 화면(MCP 5회)을 같이 다시 그릴 수 있다. 여기는 소식만 돌려준다.
 *
 * **대상은 세션에서 채운다.** 누구의 소식인지를 요청에서 받으면 남의 알림을 열어 주는
 * 길이 된다 (rest.ts 상단 주석 — 공용 API Key는 넘긴 ID의 것을 그대로 준다).
 * 프록시가 로그인 게이트라 세션 없이는 못 들어오지만, 경계에서 한 번 더 본다.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse("로그인이 필요해요.", { status: 401 });

  // 못 가져오면 `null`이다 — 종은 그때 이전 목록을 그대로 두고 배지를 건드리지 않는다.
  return NextResponse.json(await loadNews(session.userId));
}
