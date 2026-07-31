import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * 구성원 화면의 프로필 사진 (PRD §6.6). 여기 없는 호스트는 `next/image`가 통째로 거부한다.
     *
     * PRD는 구글 한 곳만 적었는데 **실측은 세 곳**이다 (2026-07-31, 사진 있는 9명):
     * 구글 로그인 아바타 · `flow.team` · 회사 서브도메인 `traport.flow.team`.
     * 경로까지 좁혀 둔다 — 호스트만 열면 그 도메인의 아무 이미지나 우리 최적화기를 태울 수 있다.
     */
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/a/**" },
      { protocol: "https", hostname: "flow.team", pathname: "/flowImg/**" },
      { protocol: "https", hostname: "traport.flow.team", pathname: "/flowImg/**" },
    ],
  },
};

export default nextConfig;
