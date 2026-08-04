import Image from 'next/image';
import { IconOpen } from '@/components/icons';
import {
  ChromaticTextReveal,
  SWEEP_CHART,
} from '@/components/motion/chromatic-text-reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { getApiKey } from '@/lib/auth';
import { ApiKeyGate } from './api-key-gate';

export const metadata = { title: '로그인 · flow Cockpit' };

/**
 * 로그인 화면. 아이디·비밀번호를 받지 않는다 — 받는 건 개인 flow API 키 하나이고,
 * 그 키가 곧 로그인이다 (PRD §5.2, `ApiKeyGate`). 최초 1회만 모달로 묻는다.
 *
 * 화면을 반으로 갈라 왼쪽에 사진, 오른쪽에 폼을 둔다. 누를 것이 버튼 하나뿐인 화면이라
 * 가운데 카드 하나로는 넓은 모니터에서 텅 비어 보였다. 사진은 밝고 앱은 어두워서, 두 면의
 * 대비가 그대로 경계선 역할을 한다 — 사이에 선을 긋지 않았다.
 *
 * <1024px는 위아래로 쌓고 화면을 사진 1 : 폼 2로 나눈다. 사진 높이를 고정값으로 박으면
 * 작은 화면에서는 사진이 화면을 다 먹고 큰 화면에서는 띠처럼 남는다.
 * DOM 순서가 사진 → 폼이라 순서를 뒤집는 `order-*`가 필요 없다.
 */
export default async function LoginPage() {
  // 키를 이미 등록했으면 모달을 띄우지 않는다. 쿠키 하나 읽는 것이라 렌더를 안 붙잡는다.
  const hasKey = (await getApiKey()) !== null;

  return (
    <main className="grid min-h-dvh grid-rows-[1fr_2fr] lg:grid-cols-2 lg:grid-rows-1">
      {/* 사진 — 모바일에서는 위, ≥1024px에서는 왼쪽. 장식이라 `alt`는 비운다.
          자를 위치는 손대지 않았다 (기본 center) — 모바일에서는 모니터가, 넓은 화면에서는
          책상 전체가 가운데 온다. LCP 요소라 `priority`로 미룸 없이 받는다. */}
      <div className="relative">
        <Image
          src="/login-bg.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {/* 모바일은 위로 붙인다 — 사진 아래 두 칸을 다 쓰는 영역에서 가운데를 잡으면 폼이 처진다 */}
      <div className="flex items-start justify-center px-6 py-10 lg:items-center lg:px-12">
        <div className="w-full max-w-sm">
          {/*
           * 로고 → 제목 → 설명 → 버튼 순으로 한 번 흐른다. 다른 화면은 `--i`로 45ms
           * 격자를 쓰지만(globals.css `.rise`) 여기는 요소가 넷뿐이라 그 격자가 너무
           * 촘촘하다 — 박자를 초로 직접 적는다. `rise`의 `backwards`가 지연 중에도
           * `from`을 유지해서 늦게 시작하는 버튼이 먼저 보였다 사라지지 않는다.
           * `prefers-reduced-motion`이면 globals.css가 지연까지 지운다.
           *
           * 박자는 0 → 0.4 → 1.0 → 1.5초. `rise`가 0.5초짜리라 간격을 그보다 좁히면
           * 앞 요소가 아직 올라오는 중에 다음이 시작해서 둘이 한 덩어리로 보인다 —
           * 처음에 0.25초로 뒀다가 로고와 `flow`가 같이 뜨는 것처럼 읽혀 벌렸다.
           */}
          {/* 로고는 검은 정사각 이미지다. 라운드를 줘야 앱 아이콘처럼 읽힌다 */}
          <Image
            src="/logo.jpg"
            alt=""
            width={44}
            height={44}
            className="rise rounded-xl"
          />

          {/* 제목 위로 색이 한 번 쓸고 지나간다 (beUI Dia Text Animation). 고정 어절
              `flow` 뒤의 `Cockpit`이 쓸리는 자리다 — 앱 이름에 색이 얹힌다.
              고정 어절은 컴포넌트가 움직이지 않아서, 제목 전체를 `rise`로 올린 다음
              색을 흘린다. 안 그러면 `flow`만 로고보다 먼저 떠 있다.
              `prefers-reduced-motion`이면 컴포넌트가 스윕을 건너뛰고 글자만 남긴다. */}
          <h1
            className="rise mt-5 text-2xl font-medium tracking-tight"
            style={{ animationDelay: '0.4s' }}
          >
            <ChromaticTextReveal
              prefix="flow"
              words={['Cockpit']}
              colors={SWEEP_CHART}
              startOnView={false}
              delay={0.7}
              duration={0.9}
              // 굵기를 `Cockpit`에만 얹는다. 컴포넌트는 [고정 어절][쓸리는 어절] 두 칸을
              // 내놓는데 뒤 칸이 쓸리는 자리다 — 글자 폭을 재는 숨은 span까지 같이 굵어져야
              // 칸이 안 좁아진다. 헤더 브랜드와 같은 대비(medium ↔ extrabold)
              className="[&>span:last-child]:font-extrabold"
            />
          </h1>

          {/* 두 문장을 낱말 단위로 흘려 넣는다 (beUI Text Reveal). 배열로 주면 줄마다
              블록이라 전에 쓰던 `<br />`이 필요 없다 — 문장이 흐르다 "수 있어요."만
              다음 줄에 남는 일도 그대로 막힌다. 14px 글자에 기본 blur(12)는 너무
              뭉개져서 6으로, 뜀폭도 20%로 줄였다. */}
          <TextReveal
            as="p"
            text={[
              'flow 업무를 위험도순으로 모아 봐요.',
              '트래포트 계정으로 로그인할 수 있어요.',
            ]}
            delay={1}
            stagger={0.05}
            blur={6}
            yOffset="20%"
            className="mt-1.5 text-sm text-muted-foreground"
          />

          {/* 마지막 박자. 설명의 마지막 낱말이 자리를 잡을 때 버튼이 올라온다 — 낱말이
              다 앉기를 기다리면 누를 것이 2초 넘게 안 보인다 */}
          <div className="rise mt-7" style={{ animationDelay: '1.5s' }}>
            <ApiKeyGate hasKey={hasKey} />

            {/* 발급 링크는 모달 안에도 있지만 버튼 아래에도 둔다 — 모달을 열기 전에
                "키가 뭔지" 보러 갈 수 있어야 한다. 키를 이미 등록한 사람에게도 그대로
                남긴다: 지우면 두 상태에서 버튼 아래 높이가 달라진다.
                ponytail: 등록한 키를 갈아 끼우는 화면은 없다. flow가 키를 만료시키지
                않아서 지금은 필요 없고, 필요해지면 이 링크 옆에 하나 붙이면 된다. */}
            <p className="mt-4 text-center text-xs text-muted-foreground">
              <a
                href="https://api.flow.team/account/api-keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                API 키 발급받기
                <IconOpen size={12} aria-hidden="true" />
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
