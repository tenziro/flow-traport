'use client';

import {
  BouncyAccordion,
  type BouncyAccordionItem,
} from '@/components/motion/bouncy-accordion';
import { IconChangelog } from '@/components/icons';
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
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              <IconChangelog size={13} aria-hidden />
              업데이트 로그
            </button>
          </CenterMorphModalTrigger>

          <CenterMorphModalContent ariaLabel="업데이트 로그" className="max-w-lg">
            {/* 제목 줄에 구분선을 둔다. 아래가 스크롤 박스라 목록을 내리면 행 카드가 제목
                바로 밑까지 올라오는데, 선이 없으면 제목에 겹쳐 읽힌다 (스크롤 박스의
                `p-3` 위쪽 여백은 내용과 같이 밀려 올라가서 못 막는다) — news-bell.tsx와
                같은 처리다. */}
            <h2 className="border-b border-border pt-5 pr-12 pb-4 pl-5 text-base font-semibold">
              업데이트 로그
            </h2>
            {/* 컴포넌트는 패널이 아니라 오버레이를 스크롤한다. 줄이 쌓이면 패널이 화면보다
                길어져 펼침 애니메이션이 무너지므로 안쪽에서 스크롤한다 — news-bell.tsx와
                같은 값이다. */}
            <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-3">
              {/* 아코디언 기본 글자는 제목·본문 다 15px이다. 업데이트 로그는 읽고 나가는
                  곳이라 이 앱의 본문 치수(제목 14px · 내용 13px)로 한 급씩 내린다 —
                  같은 모달 안 제목(`text-base`)과의 차이도 그만큼 벌어져 세 층이 갈린다 */}
              <BouncyAccordion
                items={ITEMS}
                defaultValue={CHANGELOG[0].version}
                classNames={{ title: 'text-sm', description: 'text-[13px] leading-relaxed' }}
              />
            </div>
          </CenterMorphModalContent>
        </CenterMorphModal>
      </div>
    </footer>
  );
}
