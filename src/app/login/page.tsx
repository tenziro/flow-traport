import { Button } from "@/components/motion/button/base";
import { IconInfo } from "@/components/icons";

export const metadata = { title: "로그인 · flow 콕핏" };

/**
 * 로그인 화면. 입력 필드가 없다 — flow OAuth로 넘길 뿐이다 (PRD §5.2).
 * 링크가 아니라 form GET인 이유: 프리페치로 인증 플로가 먼저 시작되지 않게.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">flow 콕핏</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          flow 업무를 위험도순으로 모아 봐요. 트래포트 계정으로 로그인할 수 있어요.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <IconInfo size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <form action="/api/auth/login" method="get" className="mt-6">
          <Button type="submit" size="lg" className="w-full">
            flow로 로그인
          </Button>
        </form>
      </div>
    </main>
  );
}
