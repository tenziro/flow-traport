/**
 * 구성원 화면 데이터 (PRD §6.6).
 *
 * 주소록이다 — 업무 데이터는 한 칸도 섞지 않는다. 임박·밀림은 팀 화면(§6.3)이 이미 세고 있고,
 * 같은 숫자를 두 화면에서 그리면 어느 쪽이 맞는지 묻게 된다.
 *
 * REST 한 번(`searchEmployees`)이면 전량이 손에 들어와서 이 파일이 하는 일은 **줄 세우기와
 * 부서 묶기**뿐이다. 이름·번호는 로그에 남기지 않는다 (PRD §6.6 개인정보).
 */

import { searchEmployees } from "@/lib/flow/rest";
import type { FlowSearchEmployee } from "@/lib/flow/types";

/** 직책 서열. 앞일수록 위. 여기 없는 직책은 맨 뒤로 간다 (PRD §6.6). */
const RANKS = ["대표이사", "이사", "상무", "부장", "차장", "과장", "대리", "사원"];

const rankOf = (title: string) => {
  const i = RANKS.indexOf(title);
  return i < 0 ? RANKS.length : i;
};

/**
 * 화면 한 줄. 응답 35개 필드 중 **보여 줄 것만** 옮긴다 — 사번·기관 ID처럼 화면에 갈 이유가
 * 없는 값은 클라이언트까지 내려보내지 않는다.
 *
 * `userId`가 없는 것도 일부러다: 멘션·담당자 필터가 쓰는 키라 이메일과 나란히 두면 헷갈린다
 * (PRD §6.6 한계 ③).
 */
export interface Member {
  name: string;
  /** 직책. 응답의 `responsibility` — `responsibilityName`은 전원 빈 문자열이다. */
  title: string;
  email: string;
  /** 없는 사람이 있다 (13명 중 1명). 빈 문자열이면 줄에서 뺀다. */
  phone: string;
  /** 없는 사람이 있다 (13명 중 4명). 빈 문자열이면 이니셜 원을 그린다. */
  photo: string;
  /** 본인이 적은 한 줄. 있을 때만 아랫줄이 생긴다. */
  slogan: string;
}

export interface MemberDivision {
  name: string;
  members: Member[];
}

export interface MembersData {
  /** `divisionCode` 순. flow가 매긴 순서라 우리가 지어낼 이유가 없다. */
  divisions: MemberDivision[];
  total: number;
}

/**
 * `buildMembers`가 읽는 필드만. 응답은 35개짜리라 전부를 요구하면 테스트가 그걸 다 지어내야 한다.
 */
type EmployeeRow = Pick<
  FlowSearchEmployee,
  | "fullname"
  | "divisionName"
  | "divisionCode"
  | "responsibility"
  | "email"
  | "phoneNumber"
  | "profileImagePath"
  | "slogan"
>;

/** `ttl`은 검색 팔레트가 준다 — 글자마다 명단을 다시 받지 않으려고 캐시를 길게 잡는다. */
export async function loadMembers(ttl?: number): Promise<MembersData> {
  return buildMembers((await searchEmployees(undefined, ttl)).employees);
}

/** 검색 결과 한 줄. 부서가 소제목이 아니라 줄 안에 있어야 어느 팀 사람인지 바로 읽힌다. */
export interface SearchMember extends Member {
  division: string;
}

/**
 * 명단에서 검색어에 걸리는 사람만 (PRD §6.4).
 *
 * **flow에 검색어를 넘기지 않는다.** `/user/search/employees`의 `searchWord`는 공용 API 키로
 * 전 직원을 훑는 손잡이라 요청에서 받은 문자열을 흘리면 안 된다 (api-spec §9.3, PRD §8.1).
 * 어차피 13명짜리 명단이 캐시로 손에 있으니 여기서 고른다 — 호출도 한 번 줄어든다.
 *
 * 이름·부서·직책만 본다. 이메일은 줄에 그리지만 검색 대상에서 뺐다 — 주소로 사람을 찾는 일이
 * 없고, 넣으면 도메인 두 글자에 전원이 걸린다.
 */
export function pickMembers(data: MembersData, word: string, size: number): SearchMember[] {
  const q = word.trim().toLowerCase();
  const found: SearchMember[] = [];

  for (const division of data.divisions) {
    for (const member of division.members) {
      if (found.length >= size) return found;
      const hit = [member.name, member.title, division.name].some((v) =>
        v.toLowerCase().includes(q),
      );
      if (hit) found.push({ ...member, division: division.name });
    }
  }
  return found;
}

/** 세션에 없어서 flow에 한 번 더 물어야 하는 내 정보. 둘 다 없을 수 있다. */
export interface MyAccount {
  photo: string;
  slogan: string;
}

/**
 * 로그인한 사람의 사진과 한마디. 왼쪽 레일 발의 계정 블록(§7.3)이 쓴다.
 *
 * 세션에는 둘 다 없다 — `/user/employees/me`가 이름·부서·직책·이메일만 준다 (api-spec §3.1).
 * 사진과 한마디는 §9.3에만 있어서 여기로 한 번 더 묻는다. 검색어가 **세션 이름**이라 한두 줄만
 * 온다 — 사진 한 장 때문에 전사 명단을 받아 오지 않는다.
 *
 * 찾을 때는 이름이 아니라 **이메일**로 고른다. 검색어가 이름이라 동명이인이 같이 오는데,
 * 그때 먼저 온 줄을 쓰면 남의 얼굴이 내 계정에 붙는다. (검색어에 이메일을 넣으면 0명이다 —
 * §9.3 검색은 이름만 본다.)
 *
 * 실패하면 둘 다 빈 문자열이다. 이 호출은 셸에서 일어나므로 던지면 모든 화면이 같이 넘어진다 —
 * 사진 한 장이 그럴 값은 아니다. 계정 블록은 비면 인사하는 손을 그대로 쓰고, 한마디 줄에는
 * 없다고 적어 둔다 (app-shell.tsx).
 *
 * 10분 캐시를 건다. 셸이라 **화면을 넘길 때마다** 도는 호출인데(실측 100ms) 내 사진과 한마디가
 * 그 사이에 바뀌지는 않는다.
 */
const ACCOUNT_TTL = 600;

export async function loadMyAccount(fullname: string, email: string): Promise<MyAccount> {
  try {
    const { employees } = await searchEmployees(fullname, ACCOUNT_TTL);
    const me = employees.find((e) => e.email === email);
    return { photo: me?.profileImagePath ?? "", slogan: me?.slogan ?? "" };
  } catch {
    return { photo: "", slogan: "" };
  }
}

/** 줄 세우고 부서로 묶는다. 호출과 갈라 둔 건 이 규칙만 따로 시험하려고다. */
export function buildMembers(employees: EmployeeRow[]): MembersData {
  const sorted = [...employees].sort(
    (a, b) =>
      // 부서 순서는 flow의 `divisionCode`를 그대로 쓴다 (1 플랫폼개발팀 · 2 기획운영팀 · 3 경영지원팀).
      a.divisionCode.localeCompare(b.divisionCode, undefined, { numeric: true }) ||
      rankOf(a.responsibility) - rankOf(b.responsibility) ||
      a.fullname.localeCompare(b.fullname, "ko"),
  );

  // 부서 순으로 정렬해 뒀으니 넣는 순서가 곧 부서 순서다.
  const byDivision = new Map<string, Member[]>();
  for (const e of sorted) {
    const list = byDivision.get(e.divisionName) ?? [];
    list.push({
      name: e.fullname,
      title: e.responsibility,
      email: e.email,
      phone: e.phoneNumber,
      photo: e.profileImagePath,
      slogan: e.slogan ?? "",
    });
    byDivision.set(e.divisionName, list);
  }

  return {
    divisions: [...byDivision].map(([name, members]) => ({ name, members })),
    total: employees.length,
  };
}
