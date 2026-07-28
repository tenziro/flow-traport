import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";

/**
 * 로그인한 화면들의 셸. 프록시가 이미 막지만, 여기서도 세션을 확인한다 —
 * 세션이 있어야 사용자 이름을 렌더할 수 있고, 프록시 매처가 바뀌어도 데이터가 새지 않는다.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AppShell user={{ fullname: session.fullname, divisionName: session.divisionName }}>
      {children}
    </AppShell>
  );
}
