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

export async function loadMembers(): Promise<MembersData> {
  return buildMembers((await searchEmployees()).employees);
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
