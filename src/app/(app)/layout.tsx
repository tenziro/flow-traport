import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { loadNews } from "@/lib/flow/queries";
import { SIDEBAR_COOKIE, toSidebarOpen } from "@/lib/sidebar";
import { THEME_COOKIE, toTheme } from "@/lib/theme";

/**
 * 로그인한 화면들의 셸. 프록시가 이미 막지만, 여기서도 세션을 확인한다 —
 * 세션이 있어야 사용자 이름을 렌더할 수 있고, 프록시 매처가 바뀌어도 데이터가 새지 않는다.
 *
 * 소식은 여기서 받는다. 오늘 화면에만 있던 카드를 헤더 종으로 올렸으니 (PRD §13 B1·B2)
 * 데이터도 세 화면이 같이 쓰는 자리로 따라 올라온다.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [news, cookieStore] = await Promise.all([loadNews(session.userId), cookies()]);

  return (
    <AppShell
      user={{
        fullname: session.fullname,
        divisionName: session.divisionName,
        email: session.email,
      }}
      news={news}
      theme={toTheme(cookieStore.get(THEME_COOKIE)?.value)}
      sidebarOpen={toSidebarOpen(cookieStore.get(SIDEBAR_COOKIE)?.value)}
    >
      {children}
    </AppShell>
  );
}
