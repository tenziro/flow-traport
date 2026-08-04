"use client";

import { useCallback, useState } from "react";
import { IconInfo, IconOpen } from "@/components/icons";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { MorphingModal } from "@/components/motion/morphing-modal";
import { signIn } from "./actions";

/** flow 개인 API 키 발급 화면. 모달과 로그인 화면 두 곳에서 같은 곳을 가리킨다. */
const ISSUE_URL = "https://api.flow.team/account/api-keys";

/**
 * 로그인 버튼 + 최초 1회 API 키 모달.
 *
 * **키가 곧 로그인이다** — 소유자를 flow에 물어 그 사람으로 세션을 연다 (`actions.ts`).
 * 그래서 키를 건너뛰는 길이 없다. 반쪽으로 서는 상태를 만들지 않는다.
 *
 * 키를 이미 등록한 사람(`hasKey`)에게는 모달을 띄우지 않는다 — 누르면 그 키로 바로 들어간다.
 * 그 키가 죽어 있으면 그때 모달이 열려 새 키를 받는다.
 *
 * 넘길 때 `window.location`을 쓴다. 서버 액션이 세션 쿠키를 새로 심었으므로 라우터 캐시를
 * 들고 이동하면 안 된다 — 브라우저가 첫 화면을 새로 받아야 한다.
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
    const result = await signIn(form);
    // 성공이면 `busy`를 풀지 않는다 — 이 자리에서 페이지가 떠난다.
    if (result.ok) return window.location.assign("/");
    setError(result.message);
    setBusy(false);
    // 등록해 둔 키로 들어가려다 막혔으면 새 키를 받아야 한다.
    if (!form.get("apiKey")) setOpen(true);
  }

  return (
    <>
      {hasKey ? (
        // 등록해 둔 키로 바로 들어간다. 폼에 입력이 없어서 서버가 쿠키의 키를 쓴다.
        <form action={submit}>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "확인하는 중…" : "flow로 로그인"}
          </Button>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </form>
      ) : (
        <Button type="button" size="lg" className="w-full" onClick={() => setOpen(true)}>
          flow로 로그인
        </Button>
      )}

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
            이 키가 로그인이에요. 키 주인이 누구인지 flow에 물어보고 그 사람으로 들어가요.
            키는 암호화해서 이 브라우저에만 두고, flow 밖으로 보내지 않아요.
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
