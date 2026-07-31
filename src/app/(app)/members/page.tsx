import Image from "next/image";
import { CopyButton } from "@/components/copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { loadMembers, type Member, type MemberDivision } from "@/lib/flow/members";

export const metadata = { title: "구성원 · flow Cockpit" };

/**
 * 구성원 (PRD §6.6).
 *
 * 주소록이다 — "그 사람에게 어떻게 연락하나" 하나만 답한다. 임박·밀림은 팀 화면(§6.3)이
 * 이미 세고 있어서, 같은 숫자를 여기서 또 그리면 어느 쪽이 맞는지 묻게 된다.
 *
 * 부서 탭은 서버에 다시 묻지 않는다. 전량이 이미 한 번의 호출로 손에 있고 13줄에 공유할
 * 상태도 없어서 `Tabs`가 칸만 바꿔 준다 — URL에 담지 않는 이유다.
 *
 * 조직도는 안 그린다. 부서 3개의 `upperDivisionCode`가 전부 빈 문자열이라 세울 계층이 없다
 * (실측). 부서는 목록을 나누는 소제목까지다.
 */
export default async function MembersPage() {
  const { divisions, total } = await loadMembers();

  return (
    <>
      <header className="rise mb-4">
        <h1 className="text-xl font-semibold tracking-tight">구성원</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          구성원 {total}명 · 부서 {divisions.length}개예요. 이메일과 번호는 눌러서 바로 복사해요.
        </p>
      </header>

      <Tabs defaultValue="all" variant="segment">
        <TabsList aria-label="부서 보기" className="mb-4 flex-wrap bg-secondary">
          <TabsTrigger value="all" className="min-h-8">
            전체
            {/* 골라진 칸은 글자색이 반전되므로 색이 아니라 투명도로 낮춘다 (`/tasks`와 같다) */}
            <span className="tabular ml-1.5 opacity-70">{total}</span>
          </TabsTrigger>
          {divisions.map(({ name, members }) => (
            <TabsTrigger key={name} value={name} className="min-h-8">
              {name}
              <span className="tabular ml-1.5 opacity-70">{members.length}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <DivisionList divisions={divisions} />
        </TabsContent>
        {divisions.map((division) => (
          <TabsContent key={division.name} value={division.name}>
            <DivisionList divisions={[division]} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

/**
 * 부서 묶음. 한 부서만 넘어와도 소제목은 남긴다 — 그게 그 목록의 이름이다.
 *
 * 부서를 카드로 싸지 않는다. 사람이 카드라서 부서까지 카드면 테두리가 두 겹으로 겹친다 —
 * 소제목 한 줄이면 무리를 나누는 데 충분하다.
 */
function DivisionList({ divisions }: { divisions: MemberDivision[] }) {
  return (
    <div className="space-y-6">
      {divisions.map(({ name, members }, i) => (
        <section key={name} className="rise" style={{ "--i": i } as React.CSSProperties}>
          <h2 className="mb-2 text-sm font-semibold">
            {name}
            <span className="tabular ml-1.5 font-normal text-muted-foreground">
              {members.length}
            </span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((member) => (
              <MemberCard key={member.email} member={member} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * 한 사람 = 한 장.
 *
 * 연락처는 값 하나에 복사 단추 하나로 줄을 나눈다. 한 줄에 이메일·번호·단추 둘을 몰아넣으면
 * 어느 단추가 어느 값을 집는지 자리로만 알 수 있는데, 여기서는 같은 줄에 있는 게 그 값이다.
 *
 * 높이는 내용에 맡긴다. 한 행을 같은 높이로 늘리면 한마디가 없는 카드에 빈 칸이 생기고,
 * 그 빈 칸이 "정보가 빠진 사람"처럼 보인다 — 카드가 짧게 끝나는 건 그렇게 안 읽힌다.
 */
function MemberCard({ member }: { member: Member }) {
  const { name, title, email, phone, photo, slogan } = member;

  return (
    <li>
      <Card size="sm" className="gap-2.5">
        <CardContent className="flex items-center gap-2.5">
          <Avatar name={name} photo={photo} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{title}</p>
          </div>
        </CardContent>

        {/* `mailto:`·`tel:`은 모바일에서 바로 연결되지만 데스크톱에서는 아무 일도 안 하는
            경우가 있다. 그래서 값 자체를 링크로 두고 오른쪽에 복사 단추를 붙인다 */}
        <CardContent className="space-y-1">
          <div className="flex items-center gap-2">
            <a
              href={`mailto:${email}`}
              className="truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {email}
            </a>
            <CopyButton text={email} label="복사" className="ml-auto shrink-0" />
          </div>
          {/* 번호가 없는 사람이 있다 (13명 중 1명) — 빈 줄을 남기지 않는다 */}
          {phone && (
            <div className="flex items-center gap-2">
              <a
                href={`tel:${phone}`}
                className="tabular truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                {phone}
              </a>
              <CopyButton text={phone} label="복사" className="ml-auto shrink-0" />
            </div>
          )}
        </CardContent>

        {/* 본인이 적은 한 줄. 두 명뿐인데 그 두 줄이 연락 방법에 대한 본인 말이라 주소록에 맞는다 */}
        {slogan && (
          <CardContent className="border-t border-border pt-2.5 text-xs text-muted-foreground">
            {slogan}
          </CardContent>
        )}
      </Card>
    </li>
  );
}

/**
 * 36px 원판. 사진이 있는 사람은 9/13명이고, 없는 자리를 회색 실루엣으로 두면 나머지 넷이
 * "정보가 없는 사람"처럼 보인다. 계정 블록(§7.3)과 같은 원판에 첫 글자를 넣는다.
 *
 * `alt`가 빈 것은 일부러다 — 이름이 바로 옆에 글자로 있어서 읽어 주면 두 번 부른다.
 */
function Avatar({ name, photo }: { name: string; photo: string }) {
  return photo ? (
    <Image
      src={photo}
      alt=""
      width={36}
      height={36}
      className="size-9 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm"
    >
      {name.slice(0, 1)}
    </span>
  );
}
