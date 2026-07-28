import Link from 'next/link';
import { IconOpen } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * flow로 나가는 링크. 문구·색·아이콘을 한 곳에 고정한다 — 화면마다 "열기"·화살표만·행
 * 전체 클릭으로 갈라져 있어서 어디를 누르면 flow로 나가는지가 안 읽혔다.
 *
 * 새 탭으로 연다. Cockpit은 훑어보는 화면이라 flow를 열고 나서 여기로 돌아와야 한다.
 */
export function FlowLink({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        'inline-flex min-h-6 items-center gap-1 text-xs text-primary transition-colors duration-300 hover:underline',
        className,
      )}
    >
      flow에서 열기
      <IconOpen size={12} />
    </Link>
  );
}
