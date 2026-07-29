import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import localFont from 'next/font/local';
import { THEME_COOKIE, toTheme } from '@/lib/theme';
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

const TITLE = 'flow Cockpit';
const DESCRIPTION = 'flow 업무를 위험도순으로 모아 보는 사내 대시보드';

/**
 * 공유 카드가 가리킬 절대 주소.
 *
 * og:image·og:url은 상대 경로가 안 된다 — 크롤러가 우리 문서를 떠난 뒤에 이미지를 받으러
 * 오기 때문이다. `metadataBase`를 주면 Next가 상대 경로를 이걸로 채워준다.
 *
 * 도메인을 새 환경변수로 또 받지 않고 `FLOW_REDIRECT_URI`에서 origin만 떼어 쓴다. 그 값은
 * flow OAuth 클라이언트에 등록한 주소와 한 글자도 다를 수 없어서(§4.1) 이 앱이 실제로
 * 서 있는 주소의 유일한 진실이다. 없으면(로컬·테스트) 개발 서버로 떨어진다.
 */
const ORIGIN = new URL(
  process.env.FLOW_REDIRECT_URI ?? 'http://localhost:3000',
).origin;

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false }, // PRD §8.1 — 사내 전용

  // 검색에는 안 걸리게 두면서 공유 카드는 만든다. 서로 다른 일이다 — robots는 색인을
  // 막고, og는 슬랙·카카오톡에 붙여넣은 링크가 어떻게 펼쳐질지를 정한다.
  openGraph: {
    type: 'website',
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    locale: 'ko_KR',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'flow Cockpit — flow 업무를 위험도순으로 모아 봐요.',
      },
    ],
  },

  // 트위터는 og를 대부분 물려받지만 카드 크기는 자기 태그로만 정한다. 안 적으면
  // 1200×630 이미지가 작은 정사각형으로 잘린다.
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 모바일 주소창 색. `globals.css`의 `--background` 두 값과 같다 — 여기서는 CSS 변수를
  // 읽을 수 없어서 직접 적는다. 안 적으면 화면 위에 반대 색 주소창이 남는다.
  //
  // ponytail: 이건 앱에서 고른 밝기가 아니라 **기기 설정**을 따른다. 메타 태그에 미디어
  // 쿼리 말고는 조건을 걸 수단이 없다. 기기는 어두운데 앱만 밝게 쓰는 경우 주소창만
  // 어둡게 남는다 — 거슬리면 `<meta name="theme-color">`를 클라이언트에서 갈아끼워야 한다.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafbf7' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0b09' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 첫 HTML에 밝기를 박는다. 브라우저에서 고치면 화면이 한 번 번쩍인다 (lib/theme.ts).
  const theme = toTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="ko"
      className={`${suit.variable} h-full antialiased ${theme === 'system' ? '' : theme}`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
