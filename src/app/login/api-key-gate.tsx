"use client";

import { useCallback, useState } from "react";
import { IconInfo, IconOpen } from "@/components/icons";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { saveApiKey } from "./actions";

/** flow 개인 API 키 발급 화면. 모달과 로그인 화면 두 곳에서 같은 곳을 가리킨다. */
const ISSUE_URL = "https://api.flow.team/account/api-keys";

/** 로그인 시작 경로. 모달을 지나면 결국 여기로 간다. */
const LOGIN_PATH = "/api/auth/login";

/**
 * 로그인 버튼 + 최초 1회 API 키 모달.
 *
 * 키를 이미 등록한 사람(`hasKey`)에게는 모달을 띄우지 않는다 — 버튼이 예전처럼 form GET
 * 하나다. 링크가 아니라 form인 이유는 프리페치로 인증 플로가 먼저 시작되지 않게 하려는
 * 것이고(page.tsx 주석), 그 이유는 모달이 붙어도 그대로다.
 *
 * 키는 **필수다.** 모달을 지나는 길은 하나뿐이고, 유효한 키를 저장한 직후에만 로그인으로
 * 넘어간다. 키를 건너뛰게 두면 멘션 본문이 빈 화면으로 로그인되는데, 사용자는 로그인이
 * 된 줄 알아서 왜 비었는지 못 찾는다 — 앱이 반쪽으로 서는 상태를 만들지 않는다.
 * 닫으면(X·Escape) 모달만 닫히고 로그인 화면에 남는다. 다시 누르면 된다.
 *
 * 넘길 때 `window.location`을 쓴다. `/api/auth/login`은 페이지가 아니라 Route Handler라
 * 라우터 내비게이션으로는 갈 수 없다 — 브라우저가 직접 요청해야 307을 따라간다.
 *
 * `useActionState`를 쓰지 않는다. 그 훅은 결과를 상태로만 주고 콜백이 없어서, 성공을 보고
 * 이동하려면 이펙트에서 결과를 다시 읽어야 한다 — React 19 린트가 막는 모양이다
 * (`react-hooks/set-state-in-effect`). 서버 액션을 직접 await하면 성공 자리에서 바로 넘어간다.
 */
export function ApiKeyGate({ hasKey }: { hasKey: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    const result = await saveApiKey(form);
    // 성공이면 `busy`를 풀지 않는다 — 이 자리에서 페이지가 떠난다.
    if (result.ok) return window.location.assign(LOGIN_PATH);
    setError(result.message);
    setBusy(false);
  }

  if (hasKey) {
    return (
      <form action={LOGIN_PATH} method="get">
        <Button type="submit" size="lg" className="w-full">
          flow로 로그인
        </Button>
      </form>
    );
  }

  return (
    <>
      <Button type="button" size="lg" className="w-full" onClick={() => setOpen(true)}>
        flow로 로그인
      </Button>

      <MorphingModal
        viewId={open ? "api-key" : null}
        onClose={close}
        ariaLabel="flow API 키 등록"
        ariaDescribedBy="api-key-why"
        className="max-w-[24rem]"
      >
        <div className="p-7">
          <p className="text-sm font-medium text-muted-foreground">처음 한 번만</p>

          {/* 닫기 버튼이 우측 상단에 겹쳐 있어서 제목 쪽에서 자리를 비운다 */}
          <h2 className="mt-4 pr-8 text-xl font-medium tracking-tight">
            flow API 키를 등록해요
          </h2>

          <p id="api-key-why" className="mt-3 text-sm leading-relaxed text-muted-foreground">
            멘션 댓글 본문을 읽고 업무에 댓글을 쓰려면 개인 키가 필요해요. 키는 암호화해서
            이 브라우저에만 두고, flow 밖으로 보내지 않아요.
          </p>

          <a
            href={ISSUE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
          >
            flow에서 API 키 발급받기
            <IconOpen size={14} aria-hidden="true" />
          </a>

          <form action={submit} className="mt-6">
            {/* 치수는 beUI 기본값(h-11)을 그대로 쓴다 — 로그인 화면은 촘촘하지 않다.
                입력을 `disabled`로 잠그지 않는다: 잠긴 필드는 FormData에서 빠진다.
                제출 버튼만 잠그면 이중 제출은 막힌다 (new-task-form.tsx와 같은 방식). */}
            <Input
              name="apiKey"
              type="password"
              label="API 키"
              autoComplete="off"
              placeholder="flow에서 복사한 키를 붙여넣어요"
              error={error ?? false}
            />

            {/* 버튼은 하나다. 나가는 길은 우측 상단 닫기(X)와 Escape로 이미 있어서
                같은 일을 하는 버튼을 옆에 더 두지 않는다 */}
            <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy}>
              {busy ? "확인하는 중…" : "등록하고 로그인"}
            </Button>
          </form>

          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <IconInfo size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            키를 등록해야 로그인할 수 있어요. 한 번 등록하면 다시 묻지 않아요.
          </p>
        </div>
      </MorphingModal>
    </>
  );
}
