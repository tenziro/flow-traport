"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { IconRisk } from "@/components/icons";
import { Button } from "@/components/motion/button/base";
import { Card, CardContent } from "@/components/ui/card";

/**
 * 본문이 터졌을 때 (세 화면 공유).
 *
 * 이게 없으면 flow 호출 한 번이 실패할 때 트리 **전체**가 날아갔다 — 셸이 먼저 그려진
 * 200ms쯤 뒤에 헤더·푸터까지 사라지고 Next의 기본 오류 화면만 남았다. 여기 있으면
 * 레이아웃은 서고 본문 자리만 이 카드로 바뀐다. `loading.tsx`와 같은 자리, 같은 이유다.
 * 레이아웃 자신이 던지는 건 못 받지만, 레이아웃이 쓰는 건 세션 쿠키와 `loadNews`(실패하면
 * `null`)뿐이라 터질 자리가 없다.
 *
 * 원인은 대개 flow 토큰 만료(MCP 401)라 고치는 길은 다시 로그인이다. 그런데 운영 빌드에서
 * `error.message`는 지워지고 `digest`만 온다 — 원인으로 갈라 말할 수 없으니 두 길을 다
 * 열어 둔다.
 *
 * ponytail: 화면별로 나누지 않는다. 세 화면이 같은 이유로 터진다.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <Card>
      <CardContent>
        <EmptyState
          icon={<IconRisk size={18} className="text-danger" />}
          title="화면을 다시 불러와 주세요"
          description="flow에서 정보를 받아오다 멈췄어요. 다시 시도하면 대개 풀려요. 그래도 같으면 로그인을 새로 하면 돼요."
          action={
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  // `reset()`만으로는 부족하다. 서버 컴포넌트가 던진 것이라 클라이언트에서
                  // 다시 그려도 같은 페이로드를 다시 읽는다 — 서버에 새로 물어야 한다.
                  router.refresh();
                  reset();
                }}
              >
                다시 시도
              </Button>
              {/* `/api/auth/login`은 페이지가 아니라 Route Handler라 라우터로는 못 간다.
                  브라우저가 직접 요청해야 307을 따라간다 (`login/api-key-gate.tsx`와 같다). */}
              <form action="/api/auth/login" method="get">
                <Button type="submit" size="sm" variant="secondary">
                  다시 로그인
                </Button>
              </form>
              {error.digest ? (
                <p className="tabular w-full text-xs text-muted-foreground">
                  오류 번호 {error.digest}
                </p>
              ) : null}
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
