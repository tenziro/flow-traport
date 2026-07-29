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
