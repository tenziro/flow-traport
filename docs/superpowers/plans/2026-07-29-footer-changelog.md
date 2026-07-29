# 푸터와 업데이트 로그 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 페이지 바닥에 푸터를 두고, 오른쪽 `업데이트 로그` 버튼으로 버전별 변경 내용을 모달 안 아코디언에 보여준다.

**Architecture:** 데이터는 `src/lib/changelog.ts`의 상수 배열 하나다. 파서도 빌드 스텝도 없다. `src/components/site-footer.tsx`가 그 배열을 읽어 왼쪽에는 제품명·현재 버전·한 줄 소개를, 오른쪽에는 기존 `CenterMorphModal` + `BouncyAccordion` 조합을 낸다. 두 모션 컴포넌트는 이미 저장소에 있고 수정하지 않는다. `app-shell.tsx`는 임포트 한 줄, 렌더 한 줄, 여백 클래스 한 곳만 바뀐다. 상류 개발 기록은 `docs/DEVELOPMENT_LOG.md`에 따로 쌓는다 (CLAUDE.md 필수 지정).

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Tailwind v4 · motion/react · `tsx --test` (node:test)

**설계 근거:** [2026-07-29-footer-changelog-design.md](../specs/2026-07-29-footer-changelog-design.md)

## Global Constraints

- **버전은 `0.21.0`이다** — 추가라서 minor. `package.json`과 `CHANGELOG[0].version` 양쪽에 같은 값이 들어간다. Task 1의 첫 테스트가 이 일치를 강제한다.
- **화면에 나가는 문구만 해요체다** (`docs/TEXT_GUIDE.md`). 코드 주석과 `docs/**` 개발 문서는 **하다체** — 이 저장소의 실제 관행이고 CLAUDE.md가 "기존 패턴을 따를 것"이라고 한다. 기존 주석을 해요체로 고치지 않는다.
- **`버튼`을 쓴다.** `단추`는 쓰지 않는다 (코드베이스가 이미 37곳에서 `버튼`이다).
- **이모지 금지.** 아이콘은 `src/components/icons.tsx`만 거친다. 이번 작업은 아이콘을 하나도 추가하지 않는다 — Reicon `history`는 반시계 화살표라 "되돌리기"로 읽힌다.
- **`src/components/motion/center-morph-modal.tsx`와 `src/components/motion/bouncy-accordion.tsx`를 수정하지 않는다.** 벤더링한 beUI 코드다.
- **새 의존성을 추가하지 않는다.** jsdom·testing-library 도입은 범위 밖이다.
- **검증 3종이 다 통과해야 한다**: `npx tsc --noEmit` clean · `npm run lint` 0 error · `npm test` 전부 통과. (`motion/select.tsx:409`의 `react-hooks/exhaustive-deps` warning 1건은 기존 것이라 그대로 남는다.)
- **비밀 정보는 `.env`에만.** 이번 작업에는 비밀 정보가 없다.
- 주석과 문서는 한국어로 쓴다.

---

## Task 1: 배포 기록 데이터와 유닛 테스트

**Files:**
- Create: `src/lib/changelog.ts`
- Test: `src/lib/changelog.test.ts`

**Interfaces:**
- Consumes: `package.json`의 `version` 필드 (현재 `0.20.3`)
- Produces:
  - `export interface Release { version: string; title: string; body: string }`
  - `export const CHANGELOG: readonly Release[]` — 최신순 정렬. Task 2가 `CHANGELOG[0].version`과 `CHANGELOG.map(...)`을 쓴다. Task 4가 배열 맨 앞에 항목 하나를 더한다.

이 태스크에서는 **맨 앞이 `0.20.3`인 13건**을 넣는다. `0.21.0` 항목은 Task 4에서 `package.json` 버전 올림과 **같이** 들어간다 — 지금 넣으면 첫 테스트가 `package.json`(`0.20.3`)과 어긋나 실패한다.

`src/lib/*.test.ts`는 `npm test` 글롭에 이미 들어 있다. `package.json`을 고칠 일이 없다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/changelog.test.ts`:

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

- [ ] **Step 2: 돌려서 실패를 본다**

Run: `npm test 2>&1 | tail -20`

Expected: FAIL. `Cannot find module '.../src/lib/changelog'` (또는 `ERR_MODULE_NOT_FOUND`)로 `changelog.test.ts` 파일 단위가 죽는다.

- [ ] **Step 3: `src/lib/changelog.ts`를 만든다**

```ts
/**
 * 사용자에게 보여 줄 배포 기록 (푸터 → 업데이트 로그).
 *
 * 상세 개발 기록은 docs/DEVELOPMENT_LOG.md다. 이쪽은 그것을 사용자 말로 옮긴 것이라
 * 항목 수가 더 적다 — 화면에 보이는 변화가 없는 배포는 넣지 않는다.
 */

/** 한 번의 배포. */
export interface Release {
  /** `0.20.3` — 접두 v 없이 둔다. 화면에서 붙인다. */
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
 * 날짜 필드를 두지 않는다. 배포가 이틀 안에 다 있어서 날짜를 붙이면 모든 줄이
 * `07-28`이나 `07-29`가 된다 — 정보가 아니라 잡음이다. 날짜는 DEVELOPMENT_LOG.md에만 둔다.
 *
 * 빠진 것: v0.20.1(문서만) · v0.18.1(근거 없음) · v0.14.1(조사만) · v0.12.5(파일 정리).
 * 화면에 보이는 변화가 없다.
 */
export const CHANGELOG: readonly Release[] = [
  {
    version: '0.20.3',
    title: '요약 카드 모양 통일',
    body: '오늘·리스크·팀 화면 맨 위 요약 카드가 화면마다 조금씩 달랐어요. 이제 세 화면 모두 이름 앞에 그림이 붙고 숫자 크기도 같아요. 업무 줄과 멘션 줄에 마우스를 올릴 때 배경이 바뀌던 것도 없앴어요.',
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

- [ ] **Step 4: 돌려서 통과를 본다**

Run: `npm test 2>&1 | tail -12`

Expected: PASS. `# tests 84` / `# suites 16` / `# fail 0`. (이 태스크 전에는 80/15였다.)

- [ ] **Step 5: 타입·린트 검사**

Run: `npx tsc --noEmit && npm run lint`

Expected: `tsc` 출력 없음. `lint`는 error 0, warning 1 (`motion/select.tsx:409` — 기존 것).

`tsconfig.json`에 `noUncheckedIndexedAccess`가 없어서 `CHANGELOG[0]`이 `Release | undefined`가 아니라 `Release`로 좁혀진다. `CHANGELOG[0].version`이 그대로 컴파일된다.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/changelog.ts src/lib/changelog.test.ts
git commit -m "$(cat <<'EOF'
업데이트 로그 데이터 13건

화면에 보이는 변화가 없는 배포 4건(v0.20.1·v0.18.1·v0.14.1·v0.12.5)은 뺐다.
package.json 버전과 맨 앞 항목이 어긋나면 테스트가 막는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 푸터 컴포넌트와 셸 배선

**Files:**
- Create: `src/components/site-footer.tsx`
- Modify: `src/components/app-shell.tsx` (임포트 블록 6~12행 · `<main>` 102행 · `</main>` 뒤 105행)
- Test: 없음 — 아래 "손 확인"이 게이트다

**Interfaces:**
- Consumes: `CHANGELOG` · `Release` (Task 1) · `CenterMorphModal` / `CenterMorphModalContent` / `CenterMorphModalTrigger` (`@/components/motion/center-morph-modal`, 기존) · `BouncyAccordion` / `BouncyAccordionItem` (`@/components/motion/bouncy-accordion`, 기존)
- Produces: `export function SiteFooter(): JSX.Element` — 인자 없음. `app-shell.tsx`만 쓴다.

유닛 테스트를 쓸 수 없다. `npm test`는 `tsx --test`로 `src/lib/**`만 돌고 jsdom도 testing-library도 없다. 도입은 범위 밖이라 손으로 확인한다 (Step 6).

- [ ] **Step 1: `src/components/site-footer.tsx`를 만든다**

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
            {/* 컴포넌트는 패널이 아니라 오버레이를 스크롤한다. 줄이 쌓이면 패널이 화면보다
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

바꾸는 기본값 셋과 이유:

| 무엇 | 기본 | 이 화면 | 왜 |
|---|---|---|---|
| 패널 폭 | `max-w-[26rem]` (416px) | `max-w-lg` (512px) | 본문 2~4문장에 416px은 좁다 |
| 스크롤 | 오버레이 (`center-morph-modal.tsx:311`) | 안쪽 `max-h-[min(28rem,60vh)]` | 패널이 화면보다 길면 펼침 애니메이션이 무너진다 |
| 제목 여백 | — | `pr-12` | 닫기 버튼이 `right-4 top-4`에 절대 배치다 |

`<footer>`에 `aria-label`을 붙이지 않는다 — `contentinfo` 랜드마크가 한 페이지에 하나뿐일 때는 이름이 필요 없다. 닫기 버튼 라벨은 컴포넌트 기본값이 이미 `닫기`라 손대지 않는다. 행 배경 `bg-card`도 그대로 둔다 — 패널이 `bg-background`라 두 색이 달라서 행이 카드로 읽힌다.

- [ ] **Step 2: `app-shell.tsx`에 임포트를 더한다**

12행 `import { cn } from '@/lib/utils';` **앞**, 9행 `import { ThemeToggle } ...` 뒤에 넣는다 (알파벳 순서: `search-palette` → `site-footer` → `theme-toggle`이므로 `SearchPalette` 다음 줄):

```diff
 import { SearchPalette } from '@/components/search-palette';
+import { SiteFooter } from '@/components/site-footer';
 import { ThemeToggle } from '@/components/theme-toggle';
```

- [ ] **Step 3: `<main>` 여백을 옮기고 `<SiteFooter />`를 넣는다**

하단 탭이 `lg:hidden`이라 768~1024px에서는 푸터와 탭바가 함께 있다. 지금은 `<main>`이 `pb-20`으로 탭바를 피하는데, 푸터가 `main` 뒤에 오면 가려지는 쪽이 푸터가 된다. 여백을 옮긴다.

```diff
-      <main className="w-full flex-1 px-4 py-6 pb-20 sm:px-6 lg:px-8 lg:pb-6">
+      <main className="w-full flex-1 px-4 py-6 pb-20 sm:px-6 md:pb-6 lg:px-8">
         {children}
       </main>
 
+      <SiteFooter />
+
       {/* 모바일 하단 탭 */}
```

| 폭 | `<main>` | `<footer>` | 하단 탭 |
|---|---|---|---|
| `<768` | `pb-20` | 없음 | 있음 |
| `768~1024` | `pb-6` | `pb-20` | 있음 |
| `≥1024` | `pb-6` | `pb-6` | 없음 |

`pb-20`은 80px, 하단 탭은 `min-h-14`(56px) + `env(safe-area-inset-bottom)`이다. `main`이 이미 쓰던 값과 같아서 여유도 같다.

- [ ] **Step 4: 타입·린트 검사**

Run: `npx tsc --noEmit && npm run lint`

Expected: `tsc` 출력 없음. `lint`는 error 0, warning 1 (기존).

- [ ] **Step 5: 빌드**

Run: `npm run build 2>&1 | tail -25`

Expected: 성공. 라우트 수는 그대로 10개 + proxy — 푸터는 라우트를 만들지 않는다.

- [ ] **Step 6: 손으로 확인한다**

`npm run dev`로 띄우고 로그인한 화면에서 11개를 본다. 각 항목 결과를 기록한다.

1. `≥1024` 푸터 보임 · 하단 탭 없음
2. `768~1024` 스크롤 바닥에서 푸터가 하단 탭에 가리지 않음
3. `<768` 푸터 안 보임 · `main`의 `pb-20` 유지
4. 버튼 누르면 패널이 화면 안에서 펼쳐짐 (밖으로 넘치지 않음)
5. 최신 버전이 펼쳐진 채로 열리고 포커스가 그 행에 있음
6. Tab이 모달 안에서 순환 · Escape로 닫힘 · 닫으면 포커스가 버튼으로 복귀
7. 배경 클릭으로 닫힘
8. 열두 줄에서 안쪽 스크롤 · 행을 펼친 뒤에도
9. 밝게·어둡게 둘 다에서 행(`bg-card`)이 패널(`bg-background`)과 구분됨
10. `prefers-reduced-motion`에서 펼침·아코디언 모션이 죽음
11. 가로 스크롤 없음 (PRD §7.4)

5·6·7·10은 `CenterMorphModal`이 이미 갖고 있는 동작이라 회귀 확인이다. 5의 포커스는 `getFocusableElements`가 `tabIndex >= 0`만 세서 `tabIndex={-1}`인 배경 버튼을 건너뛰고 첫 아코디언 트리거로 간다.

- [ ] **Step 7: 커밋**

```bash
git add src/components/site-footer.tsx src/components/app-shell.tsx
git commit -m "$(cat <<'EOF'
푸터와 업데이트 로그 모달

왼쪽은 제품명·현재 버전·한 줄 소개, 오른쪽은 업데이트 로그 버튼이다.
768px 미만은 하단 탭과 자리를 다퉈 감춘다. 탭바를 피하는 pb-20을 main에서
footer로 옮겼다 — 푸터가 main 뒤에 오면서 가려지는 쪽이 푸터가 됐다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `docs/DEVELOPMENT_LOG.md` 신규 17건

**Files:**
- Create: `docs/DEVELOPMENT_LOG.md`

**Interfaces:**
- Consumes: 없음 (문서만)
- Produces: 없음. Task 4가 이 파일의 "변경 이력" 맨 위에 항목 하나를 더한다.

CLAUDE.md가 필수로 지정한 문서다. 형식은 CLAUDE.md 38행 그대로 — `### YYYY-MM-DD — 제목` + 유형 태그(`기능`/`수정`/`개선`/`문서`/`인프라`) + 한두 문장 요약 + 관련 파일. **어투는 하다체다.**

`v0.9.3`은 89개 파일·22,861줄이 든 최초 통합 커밋이다. `progress.md`가 `07-28`로만 적어 둔 세부 수정 다수가 실제로 여기 들어 있고, 각 컴포넌트 파일의 최초 생성 커밋으로 확인했지만 버전 태그가 아니라 정황 증거다 — 항목에 그 사실을 남긴다.

- [ ] **Step 1: 파일 전체를 쓴다**

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

- 빠른 검색(⌘K) · 업무 소식 종 · 밝기 세 갈래 · 개인 flow API 키 등록

## 변경 이력

### 2026-07-29 — 요약 카드 세 화면 정렬 (v0.20.3)

`개선` 리스크·팀 화면 맨 위 요약 카드가 오늘 화면과 달랐다 — 라벨 앞 아이콘이 없고 숫자가
24px로 4px 작았다. `Kpi`에 `Icon`을 필수 prop으로 넣고 값 크기를 `text-[28px]`로 올렸다.
`Stat`(오늘)과는 합치지 않았다 — 그쪽은 점유율 막대가 붙어서 안 쓰는 prop이 절반이 된다.
Reicon `Folder`·`Hourglass`를 `IconProject`·`IconDelay`로 새로 들였다. 업무 줄과 멘션 줄의
hover 배경도 뺐다 — 커서와 화살표가 이미 신호라 배경까지 바꿀 필요가 없다.
관련: `src/components/kpi.tsx`, `src/components/icons.tsx`, `src/app/(app)/risk/page.tsx`, `src/app/(app)/team/page.tsx`, `src/components/task-item.tsx`, `src/app/(app)/page.tsx`

### 2026-07-29 — 멘션 줄 상태 배지 (v0.20.2)

`수정` 멘션 목록 17줄 중 12줄에서 상태 배지가 비어 있었다. 링크가 틀린 게 아니라
**모집단이 달랐다** — 워크리스트 네 목록에는 담당·공개·진행률 100 미만만 있고, 관계자로만
걸린 업무는 어디에도 없다. 알림이 이미 주는 `postId`로 게시글을 조회해 `status`를 꺼내
17/17로 채웠다 (BUG-028).
관련: `src/lib/flow/rest.ts`, `src/lib/flow/queries.ts`, `src/lib/aggregate/groupMentions.ts`

### 2026-07-29 — 내 업무 화면 PRD (v0.20.1)

`문서` 오늘 화면이 보여 주는 내 담당 업무가 16건인데 실제는 880건(38개 프로젝트)이었다.
경로 셋을 실측해 REST `tasks/filter`만 남기고 설계를 PRD §6.5에 썼다. 코드는 없다 —
Phase 6이다. 실측 중에 문서 셋을 정정했다 (REST 분당 120회 · 완료 판정 · 상태 컬럼 둘).
관련: `docs/PRD.md`, `docs/api-spec.md`

### 2026-07-29 — 업무 바꾸기 모달·모바일 카드 폭 (v0.20.0)

`개선` 편집 패널이 셀렉트 넷을 행 안에 펼쳐 놔서 지금 값을 보려면 고르는 UI를 마주해야
했다. `업무 바꾸기` 모달로 옮기고 `변경`을 누른 줄만 컨트롤이 되게 갈랐다. 390px에서 카드가
화면을 넘던 것은 카드가 아니라 격자 열 문제라 `grid-cols-1`을 붙였다 (BUG-025~027).
관련: `src/components/task-actions.tsx`, `src/components/date-field.tsx`, `src/app/(app)/page.tsx`

### 2026-07-29 — 검색 팔레트 ⌘K (v0.19.0)

`기능` 화면 셋이 전부 "지금 챙길 일"이라 지난 문서를 다시 찾는 길이 없었다. 네 번째 화면을
만들지 않고 레이어로 얹었다 — 검색은 목적지가 아니라 경유지다. REST 검색 둘을 병렬로 부르고,
글 링크는 누른 것만 `/api/go/[postId]`에서 해소한다. MCP `flow_search`에는 게시글 제목 필드가
없어서 REST만 쓸 수 있었다.
관련: `src/components/search-palette.tsx`, `src/lib/flow/search.ts`, `src/app/api/go/[postId]/route.ts`

### 2026-07-29 — 알림 탭 모양 분리 (v0.18.1)

`개선` 알림 레이어 탭은 `underline`, 부서 전환은 `pill`로 갈랐다. 좁은 레이어에 채운 블록이
들어가면 목록보다 헤더가 무거웠고, 부서는 개수가 많아 알약이 개별 항목으로 읽힌다.
관련: `src/components/news-bell.tsx`, `src/components/dept-tabs.tsx`

### 2026-07-29 — 소식 레이어 재설계 (v0.18.0)

`개선` 접기 버튼과 "업무소식" 라벨을 걷어내고 위를 전체·안 읽음·읽음 탭으로 바꿨다. 남은
게 카드 목록 하나여서 beUI Notification Stack도 같이 지웠다 — 팝오버가 포커스를 안쪽에 넣어
스택이 늘 펼친 상태였고 겹쳐 쌓인 모습은 보이지도 않았다. 상한을 6에서 12로 올렸고, 딥링크는
게시글 상세의 `connectUrl`로 갈아탔다 (BUG-024).
관련: `src/components/news-bell.tsx`

### 2026-07-29 — 소식 줄에 제목·프로젝트 (v0.17.0)

`개선` 한 줄이 `"아무개님의 댓글 등록"` 한 문장이라 무슨 일인지 알 수 없었다. 프로젝트명 ·
업무명 · 내용 · 작성자 네 줄로 세웠다. 알림이 이름을 하나도 안 줘서 `postId`를 중복 제거한
뒤 게시글 상세를 병렬로 부른다 (실제 데이터에서 6건 → 2~3건).
관련: `src/lib/flow/rest.ts`, `src/lib/flow/queries.ts`

### 2026-07-29 — 소식 줄 딥링크·읽음 처리 (v0.16.0)

`기능` v0.15.0에서 "알림 응답으로는 딥링크를 못 만든다"고 적은 게 틀렸다. 못 만드는 건
워크리스트의 불투명한 `link`고, 알림은 `projectId`·`postId`를 다 줘서 호출 하나 없이 만든다.
카드를 `<a>`로 바꾸고 누른 순간 읽음 처리가 붙는다.
관련: `src/lib/flow/queries.ts`, `src/components/news-bell.tsx`

### 2026-07-29 — REST 확장 Tier A·B, 밝기 세 갈래 (v0.15.0)

`기능` MCP에 길이 없는 곳에만 REST를 넣었다 — 전체 댓글 스레드, 알림 읽음 처리와 커서
페이징, 마감일·우선순위·담당자 수정, 업무 소식 종, 오늘 일정, 180일 초과 방치 업무, 키
소유자 검증. 화면 밝기는 `light-dark()` 토큰 한 벌 + 쿠키로 밝게·어둡게·기기 설정 세
갈래를 뒀다.
관련: `src/lib/flow/rest.ts`, `src/components/news-bell.tsx`, `src/lib/theme.ts`, `src/app/(app)/actions.ts`

### 2026-07-29 — flow REST 확장 범위 조사 (v0.14.1)

`문서` 개인 API 키를 받기 시작해 REST 배제 근거가 절반 사라져서 다시 봤다. 전환은 아니라는
결론이다 — 워크리스트 한 화면이 REST로 178~470회, MCP로 1회다. api-spec이 comments · drive ·
wiki 3개 도메인을 빼먹고 있던 것을 찾았다 (BUG-012).
관련: `docs/api-spec.md`, `docs/PRD.md`

### 2026-07-28 — og 공유 카드 (v0.14.0)

`기능` 슬랙·카카오톡에 링크를 붙이면 주소만 나왔다. `metadataBase`·`openGraph`·`twitter`를
넣고 1200×630 카드를 만들었다. Satori가 woff2를 안 읽어 한글이 두부가 돼서 카드는 브라우저로
찍었다.
관련: `src/app/layout.tsx`, `public/og.png`

### 2026-07-28 — 개인 flow API 키 등록 모달 (v0.13.0)

`기능` 공용 API 키로는 멘션 본문이 비고 댓글이 막히고 소유자 프로젝트 이름이 응답에 실렸다.
로그인할 때 각자 자기 키를 한 번 등록하게 해서 셋을 한 번에 덮었다. DB는 여전히 없다 — 키는
AES-256-GCM 봉인 쿠키(`fc_key`, 1년)에 들어간다.
관련: `src/app/login/api-key-gate.tsx`, `src/app/login/actions.ts`, `src/lib/auth.ts`, `src/lib/flow/rest.ts`

### 2026-07-28 — 안 쓰는 의존성·스왑 파일 정리 (v0.12.5)

`인프라` `pretendard` 의존성과 `src/lib/flow/`에 v0.9.x 때 섞여 들어간 Vim 스왑 파일 둘을
지웠다. 서체는 SUIT 하나다.
관련: `package.json`, `.gitignore`

### 2026-07-28 — 로그인 화면·pill 컨트롤·접기 애니메이션 (v0.12.4)

`개선` 로그인 화면을 사진과 폼으로 이등분하고 로고 → 제목 → 설명 → 버튼 순서로 등장하게
했다. 멘션 줄에 상태·프로젝트명을 붙이고, 상태·댓글 줄을 같은 높이 pill 한 벌로 맞췄다.
`<details>` 여닫힘에는 `::details-content` + `interpolate-size`로 움직임을 넣었다.
관련: `src/app/login/page.tsx`, `src/components/motion/chromatic-text-reveal.tsx`, `src/components/task-actions.tsx`, `src/app/globals.css`

### 2026-07-28 — 헤더 사용자 영역 정리 (v0.9.4)

`개선` 부서명과 `로그아웃`이 같은 색(muted)·같은 크기(`text-xs`)라 어디부터 누르는 곳인지
구분이 안 됐다. 이름 앞에 원판 이니셜을 넣어 두 줄 텍스트의 높이 기준점을 만들고, 정보와
액션 사이에 세로선을 두고, 로그아웃을 아이콘 + 호버 면으로 바꿨다.
관련: `src/components/app-shell.tsx`, `src/components/icons.tsx`

### 2026-07-28 — flow 콕핏 첫 배포 (v0.9.3)

`기능` 오늘·리스크·팀 화면과 flow OAuth 로그인, 상태 바꾸기·댓글·업무 생성 쓰기 액션을 한
번에 열었다. 89개 파일 22,861줄이 든 최초 통합 커밋이다 — `progress.md`가 `07-28`로만 적어
둔 세부 수정(파비콘·PWA 아이콘, 리스크 카드 정렬, 업무 제목 통일, 폰트 출렁임, 카드 제목
굵기 등) 다수가 실제로 여기 들어 있다. 각 컴포넌트 파일의 최초 생성 커밋으로 확인했지만
버전 태그가 아니라 정황 증거다.
관련: `src/app/(app)/page.tsx`, `src/app/(app)/risk/page.tsx`, `src/app/(app)/team/page.tsx`, `src/lib/flow/mcp.ts`
```

"기능 현황 → 공통"에 `업데이트 로그`가 아직 없다. Task 4에서 더한다 — 이 태스크 시점에는 푸터가 배포된 버전이 아니다.

- [ ] **Step 2: 상대 링크가 맞는지 확인한다**

Run: `ls docs/progress.md && grep -c '^### 2026-07-2' docs/DEVELOPMENT_LOG.md`

Expected: `docs/progress.md` 존재. grep 결과 `16`.

- [ ] **Step 3: 커밋**

```bash
git add docs/DEVELOPMENT_LOG.md
git commit -m "$(cat <<'EOF'
개발 이력 문서 신규 — 17개 버전

CLAUDE.md가 필수로 지정한 문서다. git log에는 커밋이 10개뿐인데 버전은 17개다 —
35dc4d2 하나가 v0.16~v0.19 네 버전이고 6d8e9c6 하나가 v0.20.0·v0.20.1 두 버전이다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: v0.21.0 배포 마감 — 버전과 문서

**Files:**
- Modify: `src/lib/changelog.ts` (배열 맨 앞)
- Modify: `package.json` (`version`)
- Modify: `docs/DEVELOPMENT_LOG.md` ("변경 이력" 맨 위 + "기능 현황 → 공통")
- Modify: `docs/progress.md` (3행 배너 · `## 검증` 앞 새 절 · 974행 테스트 수)
- Modify: `docs/PRD.md` (§7.3 끝, 746행 뒤)

**Interfaces:**
- Consumes: `CHANGELOG` (Task 1) · `SiteFooter` (Task 2) · `docs/DEVELOPMENT_LOG.md` (Task 3)
- Produces: 없음 (마감 태스크)

버전을 먼저 `changelog.ts`에 넣으면 Task 1의 첫 테스트가 `package.json`과 어긋나 실패한다. 그 실패를 보고 `package.json`을 올린다 — 테스트가 두 값을 묶는 게 이 순서로 확인된다.

- [ ] **Step 1: `changelog.ts` 배열 맨 앞에 항목을 넣는다**

`export const CHANGELOG: readonly Release[] = [` 바로 다음에:

```ts
  {
    version: '0.21.0',
    title: '업데이트 로그 추가',
    body: '무엇이 언제 바뀌었는지 화면에서 알 방법이 없었어요. 이제 페이지 아래쪽 푸터에서 버전별로 무엇이 달라졌는지 봐요. 지금 쓰는 버전도 푸터 왼쪽에 함께 나와요.',
  },
```

- [ ] **Step 2: 돌려서 실패를 본다**

Run: `npm test 2>&1 | grep -A6 '맨 앞이 package.json'`

Expected: FAIL. `AssertionError: Expected values to be strictly equal: '0.21.0' !== '0.20.3'`

- [ ] **Step 3: `package.json` 버전을 올린다**

```diff
-  "version": "0.20.3",
+  "version": "0.21.0",
```

- [ ] **Step 4: 돌려서 통과를 본다**

Run: `npm test 2>&1 | tail -12`

Expected: PASS. `# tests 84` / `# fail 0`.

- [ ] **Step 5: `docs/DEVELOPMENT_LOG.md`를 갱신한다**

"기능 현황 → 공통" 줄 끝에 항목을 더한다:

```diff
-- 빠른 검색(⌘K) · 업무 소식 종 · 밝기 세 갈래 · 개인 flow API 키 등록
+- 빠른 검색(⌘K) · 업무 소식 종 · 밝기 세 갈래 · 개인 flow API 키 등록 · 업데이트 로그
```

`## 변경 이력` 바로 다음, `### 2026-07-29 — 멘션 줄 상태 배지 (v0.20.2)` **앞**에:

```markdown
### 2026-07-29 — 푸터와 업데이트 로그 (v0.21.0)

`기능` 무엇이 언제 바뀌었는지 화면에서 알 방법이 없었다. 768px 이상에서 푸터를 두고, 오른쪽
`업데이트 로그` 버튼에 Center Morph Modal + Bouncy Accordion으로 버전별 기록을 붙였다.
데이터는 `src/lib/changelog.ts` 상수 배열이고, `package.json` 버전과 맨 앞 항목이 어긋나면
유닛 테스트가 막는다. 하단 탭을 피하는 `pb-20`은 `main`에서 `footer`로 옮겼다.
관련: `src/lib/changelog.ts`, `src/components/site-footer.tsx`, `src/components/app-shell.tsx`
```

- [ ] **Step 6: `docs/progress.md` 3행 배너를 고친다**

```diff
-버전 0.20.3 · 2026-07-29 기준. 로드맵 정의는 [PRD.md](PRD.md) §11에 있다.
+버전 0.21.0 · 2026-07-29 기준. 로드맵 정의는 [PRD.md](PRD.md) §11에 있다.
```

- [ ] **Step 7: `docs/progress.md`에 이번 작업 절을 넣는다**

`## 검증`(969행) **바로 앞**에 `##` 레벨로 넣는다. Phase 5 안이 아니다 — 푸터는 Phase 어디에도 속하지 않는다.

```markdown
## 푸터와 업데이트 로그 (v0.21.0)

무엇이 언제 바뀌었는지 화면에서 알 방법이 없었다. 개발 기록은 이 문서에 78KB 쌓여 있지만
개발자용 서술이라 그대로 보여 줄 수 없고, 버전 순서도 섞여 있다 (v0.20.2 절 다음이
v0.15.0이다). 설계는
[specs/2026-07-29-footer-changelog-design.md](superpowers/specs/2026-07-29-footer-changelog-design.md).

| 붙은 것 | 어디 |
|---|---|
| 사용자용 배포 기록 14건 (`Release[]`) | [changelog.ts](../src/lib/changelog.ts) |
| 푸터 — 왼쪽 제품명·버전·한 줄 소개, 오른쪽 로그 버튼 | [site-footer.tsx](../src/components/site-footer.tsx) |
| 모달 + 아코디언 | 같은 파일. beUI [center-morph-modal](../src/components/motion/center-morph-modal.tsx) · [bouncy-accordion](../src/components/motion/bouncy-accordion.tsx) 그대로 |
| 상세 개발 이력 18건 | [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) |

**버전을 셋 이상으로 늘리지 않았다.** 화면 표기(`CHANGELOG[0].version`)와 `package.json`
둘이고, 어긋나면 [changelog.test.ts](../src/lib/changelog.test.ts)가 막는다. `package.json`을
클라이언트에서 임포트하면 파일 전체가 번들에 실려서 상수 쪽을 읽고 테스트로 묶었다.

**날짜 필드는 두지 않았다.** 18개 배포가 이틀 안에 다 있어서 붙이면 모든 줄이 `07-28`이나
`07-29`가 된다 — 정보가 아니라 잡음이다. 날짜는 `DEVELOPMENT_LOG.md`에만 있다.

**모달은 패널이 아니라 오버레이를 스크롤한다** (`center-morph-modal.tsx:311`). 열네 줄이면
패널이 화면보다 길어져 `clip-path` 펼침이 무너지므로 안쪽에 `max-h-[min(28rem,60vh)]`을
뒀다 — [news-bell.tsx](../src/components/news-bell.tsx)와 같은 값이다.

**여백을 `main`에서 `footer`로 옮겼다.** 하단 탭이 `lg:hidden`이라 768~1024px에서는 푸터와
탭바가 함께 있다. 푸터가 `main` 뒤에 오면 가려지는 쪽이 푸터가 된다
([app-shell.tsx](../src/components/app-shell.tsx)).

| 폭 | `<main>` | `<footer>` | 하단 탭 |
|---|---|---|---|
| `<768` | `pb-20` | 없음 | 있음 |
| `768~1024` | `pb-6` | `pb-20` | 있음 |
| `≥1024` | `pb-6` | `pb-6` | 없음 |

**아이콘은 안 넣었다.** Reicon에 `history`가 있지만 반시계 화살표라 "되돌리기"로 읽혀
업데이트 로그와 어긋난다. 아코디언 동시 펼침도 안 했다 — `BouncyAccordionProps.value`가
`string | null`이라 컴포넌트를 고쳐야 한다.

컴포넌트 테스트는 못 한다. `npm test`는 `tsx --test`로 `src/lib/**`만 돌고 jsdom도
testing-library도 없다. 데이터 불변식 4건만 유닛 테스트로 묶고 화면은 손으로 확인했다.
```

- [ ] **Step 8: `docs/progress.md` 검증 블록의 테스트 수를 고친다**

이번 작업 전 실측이 80이고 4건을 더해 84다.

```diff
 npx tsc --noEmit   # clean
 npm run lint       # 0 error / 1 warning (아래 참고)
-npm test           # 80/80
+npm test           # 84/84
 npm run build      # 10 라우트 + proxy
```

- [ ] **Step 9: `docs/PRD.md` §7.3에 푸터를 더한다**

**먼저 §7.3 전체(728~747행)를 읽는다.** 헤더 레일 스펙(`2026-07-29-header-overflow-actions-design.md`)도 같은 절의 731~733행을 다시 쓴다. 겹치는 줄은 없지만 그쪽이 이미 들어갔다면 지우지 않도록 확인하고 시작한다.

`- 한글 조판: ...` 불릿(745~746행) **뒤**, `### 7.4 인터랙션`(748행) 앞에 넣는다:

```markdown
- ≥768px: 본문 아래 **푸터** — 왼쪽 제품명·현재 버전·한 줄 소개, 오른쪽 `업데이트 로그`
  버튼(Center Morph Modal + Bouncy Accordion). <768px에서는 감춘다 — 하단 탭과 자리를
  다툰다. 768~1024px에서는 푸터가 `pb-20`으로 하단 탭 높이를 비운다 (그 여백을 `main`에서
  옮겼다)
```

- [ ] **Step 10: 검증 3종을 돌린다**

Run: `npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -8 && npm run build 2>&1 | tail -20`

Expected: `tsc` 출력 없음 · `lint` error 0 / warning 1 · `# tests 84` `# fail 0` · 빌드 성공, 라우트 10개 + proxy.

- [ ] **Step 11: 푸터 버전 표기를 눈으로 확인한다**

`npm run dev`로 띄워 푸터 왼쪽이 `flow Cockpit v0.21.0`인지, 모달을 열면 맨 위 행이 `v0.21.0 업데이트 로그 추가`이고 펼쳐진 상태인지 본다.

- [ ] **Step 12: 커밋**

```bash
git add package.json src/lib/changelog.ts docs/DEVELOPMENT_LOG.md docs/progress.md docs/PRD.md
git commit -m "$(cat <<'EOF'
푸터·업데이트 로그 v0.21.0

package.json과 CHANGELOG[0]을 같이 올렸다 — 테스트가 두 값을 묶는다.
progress.md 3행 배너가 v0.20.1에, 검증 블록 테스트 수가 69에 멈춰 있던 것도 고쳤다
(실측 80 + 이번 4건 = 84).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## 범위 밖

- jsdom·testing-library 도입
- 아코디언 동시 펼침 (컴포넌트 수정이 필요하다)
- 푸터에 링크 묶음 (도움말·PRD 등)
- 768px 미만 푸터
- `changelog.ts`를 `DEVELOPMENT_LOG.md`에서 자동 생성하기
- `progress.md`와 `DEVELOPMENT_LOG.md`의 내용 중복 정리 — CLAUDE.md가 둘 다 필수로 지정했다
- `docs/PRD.md` §6.5가 내 업무 화면(`/tasks`)을 `v0.21` 타깃으로 적어 둔 것과 이번 번호가 겹치는 문제 — 별건이다
- `status-pill.tsx`의 `STATUS_TONE`에 `대기` 추가, `listStaleTasks`의 STTS 라벨 매핑 (v0.20.2가 남긴 것)
