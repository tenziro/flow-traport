import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

/**
 * SUIT 하나로 끝낸다 (PRD §7.2) — 숫자도 같은 서체를 쓴다.
 *
 * `<link rel="stylesheet" href="/fonts/SUIT/SUIT.css">`로 불러오던 것을 `next/font/local`로
 * 바꿨다. 새로고침마다 글자가 한 번 출렁이던 이유가 셋이었다.
 *
 * 1. 교체 전 글자가 다른 폰트로 그려지면서 자리가 밀렸다. `next/font`가 대체 폰트에
 *    SUIT의 자폭·높이를 덮어씌운 face를 같이 만든다 (`suit Fallback`,
 *    `size-adjust: 100.17%` + ascent/descent override). 차지하는 자리가 같으니 바뀌는
 *    순간에도 줄이 안 움직인다 — 출렁임의 본체가 이거였다.
 * 2. `public/`에서 나가는 파일은 `Cache-Control: max-age=0`이다 — 새로고침마다 재검증하니
 *    첫 페인트에 폰트가 준비된 적이 없었다. 이제 `/_next/static/media`에서 `immutable`로
 *    나가서 두 번째 방문부터는 교체 자체가 없다.
 * 3. `@font-face`가 별도 CSS 파일에 있어서 그 CSS를 받고 파싱한 뒤에야 폰트를 찾기
 *    시작했다 (실측 316ms). 이제 문서 CSS 청크에 실리고 `<link rel="preload">`까지
 *    붙어서 66ms에 나간다.
 *
 * 실제로 쓰는 다섯 단만 선언한다 — 한 단이 170KB다(한글 전체 글리프).
 * 700은 카드 제목, 800은 제품 이름(`Cockpit`) 자리다. 안 적으면 `font-bold`가
 * 800으로 떨어져 둘이 같은 굵기로 보인다.
 *
 * preload는 라우트별로 안 갈린다 — 어느 화면이든 다섯 단(834KB)을 다 당겨온다.
 * 첫 방문 한 번의 값이라 그냥 둔다. 사내망이 아닌 데서 무겁게 느껴지면
 * `preload: false`로 끄면 되고, 그러면 화면에 실제로 그려지는 단만 받는다.
 */
const suit = localFont({
  src: [
    { path: '../../public/fonts/SUIT/SUIT-Regular.woff2', weight: '400' },
    { path: '../../public/fonts/SUIT/SUIT-Medium.woff2', weight: '500' },
    { path: '../../public/fonts/SUIT/SUIT-SemiBold.woff2', weight: '600' },
    { path: '../../public/fonts/SUIT/SUIT-Bold.woff2', weight: '700' },
    { path: '../../public/fonts/SUIT/SUIT-ExtraBold.woff2', weight: '800' },
  ],
  display: 'swap',
  variable: '--font-suit',
});

export const metadata: Metadata = {
  title: 'flow Cockpit',
  description: 'flow 업무를 위험도순으로 모아 보는 사내 대시보드',
  robots: { index: false, follow: false }, // PRD §8.1 — 사내 전용
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 모바일 주소창 색. `globals.css`의 `--background`와 같은 값이다 — 여기서는 CSS 변수를
  // 읽을 수 없어서 직접 적는다. 안 적으면 다크 화면 위에 흰 주소창이 남는다.
  themeColor: '#0a0b09',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${suit.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
