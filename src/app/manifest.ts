import type { MetadataRoute } from 'next';

/**
 * PWA 매니페스트. 파일 컨벤션이라 Next가 `/manifest.webmanifest`로 내고 `<link>`까지
 * 알아서 넣는다 — `metadata.manifest`에 손으로 적을 필요가 없다.
 *
 * 홈 화면에 얹어두고 바로 여는 용도까지다. 서비스 워커·오프라인 캐시는 넣지 않았다.
 * 이 앱은 열 때마다 flow에서 새로 읽어야 의미가 있어서, 캐시된 화면은 틀린 화면이다.
 *
 * 색은 `globals.css`의 `--background` 어두운 쪽(#0a0b09)과 같은 값이다. 매니페스트는
 * CSS 변수를 못 읽어서 두 곳에 적히고, 밝기 두 벌을 담을 자리도 없다 (`theme_color`는
 * 하나뿐이다). 홈 화면에 얹고 여는 순간의 스플래시만 늘 어둡다 — 이 앱의 원래 얼굴이다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'flow Cockpit',
    short_name: 'flow Cockpit',
    description: 'flow 업무를 위험도순으로 모아 보는 사내 대시보드',
    lang: 'ko',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0b09',
    theme_color: '#0a0b09',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      // maskable은 큰 것 하나면 된다 (안드로이드가 줄여 쓴다). 로고가 검은 정사각을 꽉
      // 채우고 흰 삼각형이 가운데 있어서 원형으로 깎여도 삼각형은 남는다 —
      // 오른쪽 글로우 끝만 잘린다.
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
