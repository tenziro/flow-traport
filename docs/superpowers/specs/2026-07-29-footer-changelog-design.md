# 푸터와 업데이트 로그 설계

2026-07-29

## 배경

무엇이 언제 바뀌었는지 화면에서 알 방법이 없다. 개발 기록은 `docs/progress.md`에 78KB
쌓여 있지만 개발자용 서술이라 그대로 보여 줄 수 없고, 버전 순서도 섞여 있다
(v0.20.2 절 다음이 v0.15.0이다).

페이지 바닥에 푸터를 두고, 왼쪽에는 이게 무엇인지, 오른쪽에는 무엇이 바뀌었는지 놓는다.
로그는 `CenterMorphModal` 안에서 `BouncyAccordion`으로 버전별로 접어 둔다.

## 결정 사항

| 무엇 | 어떻게 | 왜 |
|---|---|---|
| 데이터 자리 | `src/lib/changelog.ts` 상수 배열 | 파서가 없어도 되고, 타입이 어긋나면 빌드가 막는다 |
| 상류 문서 | `docs/DEVELOPMENT_LOG.md` 신규 | CLAUDE.md 34~45행이 필수로 지정했다 |
| 부트스트랩 | 버전 16개 전부 | 두 문서가 처음부터 열려 있다 |
| 화면에 나가는 것 | 12건 + 이번 배포 | 화면 변화가 없는 배포 4건은 뺀다 |
| 왼쪽 | 한 줄 소개 + 현재 버전 | 오른쪽 로그 버튼과 짝이 맞는다 |
| 보이는 화면 | 로그인 뒤 전역, `≥768px` | 로그인 화면은 정렬된 한 장이라 손대지 않는다 |
| 목록 범위 | 전부, 안쪽 스크롤 | 열두 줄이면 스크롤 한 번으로 끝난다 |
| 파일 수 | 2개 신규 (데이터 + 컴포넌트) | 푸터 20줄 + 모달 40줄이면 나눌 이유가 없다 |

## 사전 조사에서 나온 사실

버전 **16개**(v0.9.3 ~ v0.20.2)를 찾았다. git log에는 10개뿐이다 — 한 커밋이 여러 버전
분량을 담고 있다. `35dc4d2` 하나가 v0.16~v0.19 네 버전이고, `6d8e9c6` 하나가
v0.20.0·v0.20.1 두 버전이다. **git log만 보면 버전 개수를 과소평가한다.**

날짜는 07-28에 6개(v0.9.3~v0.14.0), 07-29에 10개(v0.14.1~v0.20.2)다.

화면에 보이는 변화가 없어서 `changelog.ts`에서 빼는 4건:

| 버전 | 사정 |
|---|---|
| v0.20.1 | `progress.md`가 스스로 "문서만, 구현 전"이라고 적어 뒀다 |
| v0.18.1 | `progress.md`에 소제목도 커밋도 없이 한 문장으로만 언급된다 |
| v0.14.1 | flow REST 조사 단계. 화면 변화 없음 |
| v0.12.5 | 안 쓰는 글꼴 의존성·Vim 스왑 파일 정리 |

`docs/progress.md` 3행 배너가 `버전 0.20.1 · 2026-07-29 기준`에 멈춰 있다. 본문에는
v0.20.2 절이 이미 있다. 이번 작업에서 함께 고친다.

---

## §1 데이터

### `src/lib/changelog.ts` (신규)

```ts
/**
 * 사용자에게 보여 줄 배포 기록 (푸터 → 업데이트 로그).
 *
 * 상세 개발 기록은 docs/DEVELOPMENT_LOG.md다. 이쪽은 그것을 사용자 말로 옮긴 것이라
 * 항목 수가 더 적다 — 화면에 보이는 변화가 없는 배포는 넣지 않는다.
 */

/** 한 번의 배포. */
export interface Release {
  /** `0.20.2` — 접두 v 없이 둔다. 화면에서 붙인다. */
  version: string;
  /** 아코디언 행에 버전과 나란히 놓이는 한 줄. 행이 `truncate`라 20자 안. */
  title: string;
  /** 펼쳤을 때 나오는 본문. 2~4문장. */
  body: string;
}

/**
 * 최신순. 맨 앞이 현재 버전이다 — 푸터의 버전 표기도 여기서 읽는다.
 *
 * package.json 버전과 맨 앞이 같아야 한다. 어긋나면 화면이 거짓말을 하므로
 * `changelog.test.ts`가 막는다.
 *
 * 지금 빠진 것: v0.20.1(문서만) · v0.18.1(근거 없음) · v0.14.1(조사만) · v0.12.5(파일 정리).
 */
export const CHANGELOG: readonly Release[] = [
  /* §1.1의 13건 */
];
```

**날짜 필드를 두지 않는다.** 16개 배포가 이틀 안에 다 있어서 날짜를 붙이면 열세 줄이
전부 `07-28`이나 `07-29`가 된다. 정보가 아니라 잡음이다. 날짜는
`DEVELOPMENT_LOG.md`에만 둔다.

**`package.json`을 임포트하지 않는다.** 클라이언트 번들에 파일 전체가 들린다. 대신
`CHANGELOG[0].version`을 쓰고, 둘이 어긋나지 않게 테스트로 묶는다(§4).

### §1.1 문구 13건

맨 앞 항목의 버전은 구현 순서가 정한다 — 푸터가 먼저 나가면 `0.21.0`, 헤더 레일
(`2026-07-29-header-overflow-actions-design.md`)이 먼저 나가면 `0.22.0`이다.

```ts
export const CHANGELOG: readonly Release[] = [
  {
    version: '0.21.0',
    title: '업데이트 로그 추가',
    body: '무엇이 언제 바뀌었는지 화면에서 알 방법이 없었어요. 이제 페이지 아래쪽 푸터에서 버전별로 무엇이 달라졌는지 봐요. 지금 쓰는 버전도 푸터 왼쪽에 함께 나와요.',
  },
  {
    version: '0.20.2',
    title: '멘션에 업무 상태 표시',
    body: '전에는 나를 부른 사람들 목록에서 업무 상태가 빠진 줄이 많았어요. 이제 글 정보를 함께 확인해서 상태를 채워요. 프로젝트마다 다르게 부르는 상태 이름도 다른 화면과 같은 말로 맞췄어요.',
  },
  {
    version: '0.20.0',
    title: '업무 바꾸기 화면 정리',
    body: '업무 상태나 마감일을 고칠 때 선택 상자 네 개가 한꺼번에 펼쳐져서 지금 값이 무엇인지 보기 어려웠어요. 이제 바꾸려고 누른 항목만 입력 상자로 바뀌고 나머지는 글자로 남아요. 좁은 화면에서 업무 카드가 화면 밖으로 넘치던 것도 함께 고쳤어요.',
  },
  {
    version: '0.19.0',
    title: '빠른 검색',
    body: '지난 프로젝트나 글을 다시 찾으려면 flow로 돌아가야 했어요. 이제 어느 화면에서든 단축키로 검색창을 열고 프로젝트와 글을 바로 찾아요. 찾은 글을 고르면 flow 문서로 곧장 넘어가요.',
  },
  {
    version: '0.18.0',
    title: '업무 소식 목록 정비',
    body: '소식을 펼치고 접는 버튼을 없애고 전체·안 읽음·읽음 탭으로 나눴어요. 목록만 스크롤되게 해서 탭과 전체 읽음 버튼은 늘 눌러요. 한 번에 보여 주는 개수도 늘려서 읽은 소식까지 넉넉히 봐요.',
  },
  {
    version: '0.17.0',
    title: '소식 한 줄에 제목',
    body: '전에는 소식에 “아무개님의 댓글 등록”이라고만 나와서 무슨 일인지 알기 어려웠어요. 이제 프로젝트 이름, 업무 이름, 내용, 작성자를 나눠 보여줘요.',
  },
  {
    version: '0.16.0',
    title: '소식에서 바로 이동',
    body: '전에는 소식을 눌러도 그 자리에 머물렀어요. 이제 한 줄이 그대로 flow 문서로 가는 링크가 되고, 누르는 순간 읽음으로 바뀌어요.',
  },
  {
    version: '0.15.0',
    title: '댓글 전문과 화면 밝기',
    body: '댓글 전체 내용과 오늘 일정을 화면에서 바로 봐요. 업무 마감일과 담당자도 flow로 나가지 않고 고쳐요. 화면 밝기는 밝게·어둡게·기기 설정 가운데서 골라요.',
  },
  {
    version: '0.14.0',
    title: '공유 링크 미리보기',
    body: '전에는 슬랙이나 카카오톡에 링크를 붙이면 주소만 나왔어요. 이제 로고와 화면 색이 담긴 미리보기 카드가 함께 떠요.',
  },
  {
    version: '0.13.0',
    title: '개인 flow 키 등록',
    body: '공용 키로 로그인하면 다른 사람의 멘션과 댓글이 섞여 보였어요. 이제 처음 로그인할 때 자기 flow API 키를 한 번 등록해요. 등록한 키는 암호화해서 보관하니 다시 넣을 일은 거의 없어요.',
  },
  {
    version: '0.12.4',
    title: '로그인 화면 새 단장',
    body: '로그인 화면을 사진과 입력 칸으로 나누고 로고·제목·설명·버튼이 차례로 나타나게 했어요. 나를 부른 사람들 목록에는 업무 상태와 프로젝트 이름을 넣었어요. 접고 펼치는 목록도 자연스럽게 움직여요.',
  },
  {
    version: '0.9.4',
    title: '헤더 사용자 영역 정리',
    body: '오른쪽 위 이름과 로그아웃이 같은 색·같은 크기라 어디를 눌러야 할지 헷갈렸어요. 이름 앞에 동그란 이니셜을 넣고, 로그아웃은 아이콘과 함께 눌러야 할 자리로 보이게 바꿨어요.',
  },
  {
    version: '0.9.3',
    title: 'flow Cockpit 첫 공개',
    body: 'flow에 흩어진 업무 가운데 지금 챙길 것만 모아 보는 오늘 화면을 처음 열었어요. 업무 상태 바꾸기, 댓글 남기기, 업무 만들기를 flow로 나가지 않고 화면 안에서 해요. 어느 프로젝트가 위험한지 보여 주는 리스크 보드와 팀원 현황을 보는 팀 화면도 함께 열었어요.',
  },
];
```

문구 판정 근거 (`docs/TEXT_GUIDE.md`):

- **해요체** — 열세 건 전부.
- **과거 문제를 여는 첫 문장** — `전에는 ~했어요`로 연다. `~할 수 없어요` 꼴은 쓰지
  않는다(판정표 3번). 지난 상태를 사실로 적는 것과 지금 못 하는 일을 알리는 것은 다르다.
- **`버튼`** — 코드베이스가 이미 37곳에서 쓰는 말이다. `단추`는 쓰지 않는다.
- **실측 수치를 넣지 않는다** — 조사 초안의 "멘션 17건 모두에"는 작성자 계정 값이라
  남의 화면에서 틀린다.
- **내부 용어를 넣지 않는다** — `STTS`, `워크리스트`, `Radix`, `벤더링` 같은 말은 없다.
- **제목 20자 이하** — 가장 긴 것이 `flow Cockpit 첫 공개`(17자)다.

`tsconfig.json`에 `noUncheckedIndexedAccess`가 없다(`strict`만 켜져 있다). `CHANGELOG[0]`이
`Release | undefined`가 아니라 `Release`로 좁혀지므로 `CHANGELOG[0].version`을 그대로 쓴다.

### `docs/DEVELOPMENT_LOG.md` (신규)

**어투는 `하다체`다.** `docs/progress.md`와 코드 주석이 전부 그렇다. `TEXT_GUIDE.md`가
개발 문서까지 적용 대상으로 적어 두었지만 이 코드베이스의 실제 관행은 하다체이고,
CLAUDE.md 18행이 "기존 패턴을 따를 것"이라고 한다. 화면에 나가는 `changelog.ts`의
`title`·`body`만 해요체다. **기존 주석을 해요체로 고치지 않는다.**

형식은 CLAUDE.md 38행 그대로다.

```markdown
# 개발 이력

상세 서술은 [progress.md](progress.md), 사용자용 요약은 `src/lib/changelog.ts`에 있다.

## 기능 현황

### 화면
- **오늘 (`/`)** — 나를 부른 사람들, 지금 챙길 업무, 오늘 일정. 상태 바꾸기·댓글·업무
  만들기가 화면 안에서 된다
- **리스크 (`/risk`)** — 프로젝트별 위험도 보드
- **팀 (`/team`)** — 팀원 현황
- **내 업무 (`/tasks`)** — 설계만 끝났다. 화면 없음 (PRD §6.5)

### 공통
- 빠른 검색(⌘K) · 업무 소식 종 · 밝기 세 갈래 · 개인 flow API 키 등록 · 업데이트 로그

## 변경 이력

### 2026-07-29 — 멘션 줄 상태 배지 (v0.20.2)
`수정` 멘션 목록에서 업무 상태가 빈 줄이 많았다. 모집단이 달랐던 것이라 알림에 글
정보를 조인해 채웠다 (BUG-028).
관련: `src/lib/aggregate/groupMentions.ts`, `src/components/status-pill.tsx`
```

변경 이력에 넣을 16건은 아래 표를 따른다. 각 항목의 요약은 `progress.md`의 해당 절에서
가져오고, 관련 파일은 커밋의 변경 파일에서 가져온다.

| 날짜 | 버전 | 제목 | 유형 | 커밋 | progress.md |
|---|---|---|---|---|---|
| 2026-07-29 | 0.20.2 | 멘션 줄 상태 배지 | 수정 | `319a8a9` | 919~947 |
| 2026-07-29 | 0.20.1 | 내 업무 화면 PRD | 문서 | `6d8e9c6` | 878~917 |
| 2026-07-29 | 0.20.0 | 업무 바꾸기 모달·모바일 카드 폭 | 개선 | `6d8e9c6` | 834~876 |
| 2026-07-29 | 0.19.0 | 검색 팔레트 ⌘K | 기능 | `35dc4d2` | 801~832 |
| 2026-07-29 | 0.18.1 | 알림 탭 모양 분리 | 개선 | `35dc4d2` | 785~790 |
| 2026-07-29 | 0.18.0 | 소식 레이어 재설계 | 개선 | `35dc4d2` | 770~799 |
| 2026-07-29 | 0.17.0 | 소식 줄에 제목·프로젝트 | 개선 | `35dc4d2` | 749~768 |
| 2026-07-29 | 0.16.0 | 소식 줄 딥링크·읽음 처리 | 기능 | `35dc4d2` | 726~747 |
| 2026-07-29 | 0.15.0 | REST 확장 Tier A·B, 밝기 세 갈래 | 기능 | `96ef056` | 661~725, 949~968 |
| 2026-07-29 | 0.14.1 | flow REST 확장 범위 조사 | 문서 | `96ef056` | 663~696 |
| 2026-07-28 | 0.14.0 | og 공유 카드 | 기능 | `fa17b7f` | 586~604 |
| 2026-07-28 | 0.13.0 | 개인 flow API 키 등록 모달 | 기능 | `6a31a50` | 1056~1101 |
| 2026-07-28 | 0.12.5 | 안 쓰는 의존성·스왑 파일 정리 | 인프라 | `23018dc` | 120~121, 1028 |
| 2026-07-28 | 0.12.4 | 로그인 화면·pill 컨트롤·접기 애니메이션 | 개선 | `a85f948` | 378~585 |
| 2026-07-28 | 0.9.4 | 헤더 사용자 영역 정리 | 개선 | `f5f013b` | 363~377 |
| 2026-07-28 | 0.9.3 | flow 콕핏 첫 배포 | 기능 | `2d20be9` | 1~659 |

v0.9.3은 89개 파일·22,861줄이 든 최초 통합 커밋이다. `progress.md`가 `07-28`로만 적어
둔 세부 수정 다수가 실제로 여기 들어 있다 — 각 컴포넌트 파일의 최초 생성 커밋으로
확인했지만 버전 태그가 아니라 정황 증거다. 이력 항목에 그 사실을 한 줄로 남긴다.

---

## §2 푸터 자리와 여백

### `src/components/app-shell.tsx` 수정 두 곳

임포트를 더하고, `</main>` 뒤 · 모바일 하단 탭 `<nav>` 앞에 한 줄 넣는다.

```tsx
import { SiteFooter } from '@/components/site-footer';
```

```tsx
<SiteFooter />
```

하단 탭이 `lg:hidden`이라 768~1024에서는 푸터와 탭바가 함께 있다. 지금은 `<main>`이
`pb-20`으로 탭바를 피하는데, 푸터가 `main` 뒤에 오면 가려지는 쪽이 푸터가 된다.
여백을 옮긴다.

```diff
- <main className="w-full flex-1 px-4 py-6 pb-20 sm:px-6 lg:px-8 lg:pb-6">
+ <main className="w-full flex-1 px-4 py-6 pb-20 sm:px-6 md:pb-6 lg:px-8">
```

| 폭 | `<main>` | `<footer>` | 하단 탭 |
|---|---|---|---|
| `<768` | `pb-20` | 없음 | 있음 |
| `768~1024` | `pb-6` | `pb-20` | 있음 |
| `≥1024` | `pb-6` | `pb-6` | 없음 |

`pb-20`은 80px, 하단 탭은 `min-h-14`(56px) + `env(safe-area-inset-bottom)`이다. `main`이
이미 쓰고 있는 값과 같으므로 여유도 같다.

### `src/components/site-footer.tsx` (신규)

```tsx
'use client';

import {
  BouncyAccordion,
  type BouncyAccordionItem,
} from '@/components/motion/bouncy-accordion';
import {
  CenterMorphModal,
  CenterMorphModalContent,
  CenterMorphModalTrigger,
} from '@/components/motion/center-morph-modal';
import { CHANGELOG } from '@/lib/changelog';

/** CHANGELOG는 상수라 한 번만 만든다. */
const ITEMS: BouncyAccordionItem[] = CHANGELOG.map((release) => ({
  id: release.version,
  title: (
    <>
      <span className="text-muted-foreground">v{release.version}</span> {release.title}
    </>
  ),
  description: release.body,
}));

/**
 * 페이지 바닥 (≥768px). 왼쪽은 이게 뭔지, 오른쪽은 무엇이 바뀌었는지.
 *
 * `lg` 미만에서는 하단 탭이 화면 바닥에 고정으로 붙어 있어 그 높이만큼 비운다.
 * 768px 미만에서 아예 감추는 것은 탭바와 자리를 다투기 때문이다.
 */
export function SiteFooter() {
  return (
    <footer className="hidden w-full border-t border-border px-4 pt-6 pb-20 sm:px-6 md:block lg:px-8 lg:pb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs">
            <span className="font-medium">flow Cockpit</span>{' '}
            <span className="text-muted-foreground">v{CHANGELOG[0].version}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            flow에 흩어진 업무 중 지금 챙길 것만 모아 봐요.
          </p>
        </div>

        <CenterMorphModal>
          <CenterMorphModalTrigger>
            <button
              type="button"
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              업데이트 로그
            </button>
          </CenterMorphModalTrigger>

          <CenterMorphModalContent ariaLabel="업데이트 로그" className="max-w-lg">
            <h2 className="pl-5 pr-12 pt-5 text-base font-semibold">업데이트 로그</h2>
            {/* 컴포넌트는 패널이 아니라 오버레이를 스크롤한다. 열세 줄이면 패널이 화면보다
                길어져 펼침 애니메이션이 무너지므로 안쪽에서 스크롤한다 — news-bell.tsx와
                같은 값이다. */}
            <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-3">
              <BouncyAccordion items={ITEMS} defaultValue={CHANGELOG[0].version} />
            </div>
          </CenterMorphModalContent>
        </CenterMorphModal>
      </div>
    </footer>
  );
}
```

경계선은 `border-t border-border`로 헤더의 `border-b`와 짝을 맞춘다. `<footer>`는
`contentinfo` 랜드마크라 `aria-label`을 붙이지 않는다 — 한 페이지에 하나뿐일 때는
이름이 필요 없다.

**아이콘을 넣지 않는다.** Reicon에 `history`가 있지만 반시계 화살표라 "되돌리기"로
읽힌다. 업데이트 로그와 어긋난다. `icons.tsx`에 export를 늘리지 않는다.

---

## §3 모달과 아코디언

기본값에서 바꾸는 것 셋이다.

| 무엇 | 기본 | 이 화면 | 왜 |
|---|---|---|---|
| 패널 폭 | `max-w-[26rem]` (416px) | `max-w-lg` (512px) | 본문 2~4문장에 416px은 좁다 |
| 스크롤 | 오버레이 (`center-morph-modal.tsx:311`) | 안쪽 `max-h-[min(28rem,60vh)]` | 패널이 화면보다 길면 펼침 애니메이션이 무너진다 |
| 제목 여백 | — | `pr-12` | 닫기 버튼이 `right-4 top-4`에 절대 배치다 |

**한 번에 하나만 펼쳐진다.** `BouncyAccordionProps.value`가 `string | null`이라 컴포넌트
구조가 그렇다. 동시 펼침은 컴포넌트를 고쳐야 해서 하지 않는다.

**`defaultValue={CHANGELOG[0].version}`** — 열면 최신 배포가 이미 펼쳐져 있다. 모달을
여는 이유가 대개 그것이다. 포커스도 그 행에 간다(`getFocusableElements`가 `tabIndex >= 0`만
세므로 `tabIndex={-1}`인 배경 버튼은 건너뛴다).

**행 배경 `bg-card`를 그대로 둔다.** 패널이 `bg-background`라 두 색이 달라서 행이 카드로
읽힌다. 벤더링 주석(`bouncy-accordion.tsx:12~16`)이 말하는 `bg-transparent overflow-visible`
상쇄는 Card *안에* 넣을 때만 필요하다.

**`id`에 점이 들어간다** (`0.20.2`). 컴포넌트는 이 값을 `aria-controls`·`aria-labelledby`
속성값과 `useId` 접두사로만 쓰고 id 선택자로 조회하지 않으므로(`getFocusableElements`는
`querySelectorAll`에 고정 선택자를 쓴다) 문제 없다.

**공짜로 딸려 오는 것** — 포커스 트랩, Escape 닫기, 배경 클릭 닫기, 바디 스크롤 잠금,
닫을 때 트리거로 포커스 복귀, `prefers-reduced-motion` 대응, `aria-haspopup="dialog"`·
`aria-expanded`·`aria-controls` 자동 부착. 닫기 버튼 라벨은 컴포넌트 기본값이 이미
`닫기`라 TEXT_GUIDE 항상 적용 규칙과 맞는다.

### 문구

| 자리 | 문구 |
|---|---|
| 푸터 제품명 | `flow Cockpit` |
| 푸터 버전 | `v{CHANGELOG[0].version}` |
| 푸터 소개 | `flow에 흩어진 업무 중 지금 챙길 것만 모아 봐요.` |
| 버튼 라벨 | `업데이트 로그` |
| 모달 `ariaLabel` | `업데이트 로그` |
| 모달 제목 | `업데이트 로그` |
| 닫기 | `닫기` (컴포넌트 기본값) |

---

## §4 테스트

### 유닛 테스트 — `src/lib/changelog.test.ts` (신규)

`changelog.ts`는 순수 데이터라 jsdom이 필요 없다. `npm test`의 `src/lib/*.test.ts` 글롭에
그냥 걸린다 — `package.json` 수정 없다. 어투와 구조는 `src/lib/theme.test.ts`를 따른다.

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { CHANGELOG } from './changelog';

const pkg = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string };

describe('업데이트 로그', () => {
  /**
   * 푸터가 `CHANGELOG[0].version`을 현재 버전으로 표시한다. package.json과 어긋나면
   * 화면이 거짓말을 한다 — 사람이 기억해서 맞출 일이 아니라 여기서 막는다.
   */
  it('맨 앞이 package.json 버전이다', () => {
    assert.equal(CHANGELOG[0].version, pkg.version);
  });

  /** 버전이 아코디언 행의 `id`가 된다. 겹치면 두 행이 같이 펼쳐진다. */
  it('버전이 겹치지 않는다', () => {
    const versions = CHANGELOG.map((r) => r.version);
    assert.equal(new Set(versions).size, versions.length);
  });

  it('최신순이다', () => {
    const rank = (v: string) => v.split('.').map(Number);
    for (let i = 1; i < CHANGELOG.length; i += 1) {
      const a = rank(CHANGELOG[i - 1].version);
      const b = rank(CHANGELOG[i].version);
      assert.ok(
        a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]))),
        `${CHANGELOG[i - 1].version}이 ${CHANGELOG[i].version}보다 앞에 있다`,
      );
    }
  });

  /** 행 제목은 `truncate`다. 길면 소리 없이 잘린다. */
  it('제목이 20자를 넘지 않는다', () => {
    for (const r of CHANGELOG) {
      assert.ok(r.title.length <= 20, `v${r.version}: ${r.title}`);
    }
  });
});
```

### 컴포넌트 테스트는 못 한다

`npm test`는 `tsx --test`로 `src/lib/**`만 돈다. jsdom도 testing-library도 없다. 이 건을
위해 들이는 것은 범위 밖이다. 대신 손으로 확인한다.

1. `≥1024` 푸터 보임 · 하단 탭 없음
2. `768~1024` 스크롤 바닥에서 푸터가 하단 탭에 가리지 않음
3. `<768` 푸터 안 보임 · `main`의 `pb-20` 유지
4. 버튼 누르면 패널이 화면 안에서 펼쳐짐 (밖으로 넘치지 않음)
5. 최신 버전이 펼쳐진 채로 열리고 포커스가 그 행에 있음
6. Tab이 모달 안에서 순환 · Escape로 닫힘 · 닫으면 포커스가 버튼으로 복귀
7. 배경 클릭으로 닫힘
8. 열세 줄에서 안쪽 스크롤 · 행을 펼친 뒤에도
9. 밝게·어둡게 둘 다에서 행(`bg-card`)이 패널(`bg-background`)과 구분됨
10. `prefers-reduced-motion`에서 펼침·아코디언 모션이 죽음
11. 가로 스크롤 없음 (PRD §7.4)

`npm run lint`와 `npm test`는 둘 다 통과해야 한다 (CLAUDE.md 21행).

---

## §5 버전과 문서

**버전** — 추가라서 minor다. 푸터를 먼저 구현하면 `0.21.0`, 헤더 레일이 먼저 나가면
`0.22.0`이다. 확정한 번호를 `package.json`과 `CHANGELOG[0].version` 양쪽에 같이 넣는다
(§4의 첫 테스트가 확인한다).

| 파일 | 할 일 |
|---|---|
| `docs/DEVELOPMENT_LOG.md` | 신규. 기능 현황 + 변경 이력 16건 (§1) |
| `docs/progress.md` | 3행 배너가 `v0.20.1`에 멈춰 있음 → 확정 버전으로 고침. 이번 작업 절 추가 |
| `docs/PRD.md` | §7.3에 푸터 한 줄. 지금 PRD에 푸터가 없다 |
| `docs/bug-report.md` | 손대지 않음 — 버그가 아니다 |
| `src/lib/changelog.ts` | 이번 배포 항목을 배열 맨 앞에 |

**PRD §7.3을 헤더 레일 스펙도 고친다.** 그쪽은 731~733행(상단 바 배치)을 다시 쓰고,
이쪽은 절 끝에 푸터를 더한다. 겹치는 줄은 없지만 나중에 구현하는 쪽이 먼저 들어간 변경을
지우지 않도록 §7.3 전체를 읽고 시작한다.

---

## 범위 밖

- jsdom·testing-library 도입
- 아코디언 동시 펼침 (컴포넌트 수정이 필요하다)
- 푸터에 링크 묶음 (도움말·PRD 등)
- 768px 미만 푸터
- `changelog.ts`를 `DEVELOPMENT_LOG.md`에서 자동 생성하기
- `docs/PRD.md` §6.5가 내 업무 화면(`/tasks`)을 `v0.21` 타깃으로 적어 둔 것과 이번 번호가
  겹치는 문제 — 별건이다
- `progress.md`와 `DEVELOPMENT_LOG.md`의 내용 중복 정리 — CLAUDE.md가 둘 다 필수로
  지정했으므로 그대로 둔다
