import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "flow 콕핏",
  description: "flow 업무를 위험도순으로 모아 보는 사내 대시보드",
  robots: { index: false, follow: false }, // PRD §8.1 — 사내 전용
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* SUIT 하나로 끝낸다 (PRD §7.2) — 숫자도 같은 서체를 쓴다.
            9단 굵기 @font-face. 브라우저가 실제 쓰인 weight만 내려받는다 */}
        <link rel="stylesheet" href="/fonts/SUIT/SUIT.css" />
      </head>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
