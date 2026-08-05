"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { TaskNews } from "@/lib/flow/queries";

/**
 * 켜 둔 상태를 남기는 자리. **브라우저 권한과 따로 둔다** — 권한은 한 번 주면 프로그램으로
 * 거둘 수 없어서, 이게 없으면 끄는 단추가 눌러도 아무 일 없는 죽은 단추가 된다.
 */
const KEY = "news-notify";

/** 알림 스위치의 네 자리. `denied`는 브라우저가 막은 것이라 우리가 되돌릴 수 없다. */
export type NotifyState = "unsupported" | "off" | "on" | "denied";

/**
 * 새 소식이 오면 OS 알림을 띄운다 (PRD §13 B1).
 *
 * flow는 알림을 밀어 주지 않는다 — 웹훅도 구독도 없다 (`/api/news`). 그래서 진짜 Web Push가
 * 아니라 **이미 돌고 있는 1분 폴링에 얹는다**: 종이 새로 당겨 온 목록에서 처음 보는 안 읽은
 * 줄을 찾으면 그때 알림을 띄운다.
 *
 * | | 이 방식 | 진짜 Web Push |
 * |---|---|---|
 * | 서버 · 저장소 · VAPID 키 | 없음 | 전부 필요 |
 * | 앱이 열려 있을 때 | 온다 (숨은 탭 · 다른 앱을 보는 중에도) | 온다 |
 * | 브라우저를 닫은 뒤 | **안 온다** | 온다 |
 *
 * ponytail: 브라우저를 닫으면 안 온다. 그 한 칸을 채우려면 서버가 세션 없이 남의 알림을
 * 조회하는 구조(구독 저장소 + 크론)가 필요해서, PRD §8.1의 "대상은 세션에서만 채운다"를
 * 먼저 다시 잡아야 한다.
 *
 * 알림은 **묶어서 하나만** 띄운다. 한 번에 다섯 건이 와도 알림 다섯 개가 아니라 `새 소식 5건`
 * 하나다 — 창 구석에 카드가 쌓이면 그걸 치우는 게 일이 된다. `tag`가 가장 새 알림의 id라
 * 탭을 여러 개 열어 둬도 같은 것 하나로 겹쳐진다.
 *
 * @param seed 서버가 그려 준 첫 목록. 여기 있던 것은 "이미 본 것"이라 알리지 않는다 —
 *   안 그러면 화면을 열자마자 안 읽은 소식 전부가 알림으로 쏟아진다.
 */
export function useNewsNotify(seed: TaskNews[] | null) {
  const state = useSyncExternalStore(subscribe, read, ON_SERVER);
  /** 이미 알린 알림 id. */
  const told = useRef<Set<string>>(new Set(seed?.map((n) => n.id)));
  /**
   * 기준선을 잡았나. `seed`가 `null`이면(서버가 소식을 못 가져왔으면) 아직 못 잡은 것이라,
   * 첫 폴링 결과를 알리지 않고 기억만 한다 — 그것들은 새 소식이 아니라 원래 있던 것이다.
   */
  const seeded = useRef(seed !== null);
  /**
   * 켜져 있나. 상태를 그대로 안 쓰고 ref에 비추는 것은 읽는 쪽이 폴링 타이머 안이기
   * 때문이다 — 상태를 그리로 넘기면 스위치를 누를 때마다 타이머를 다시 세운다.
   */
  const awake = useRef(false);
  useEffect(() => {
    awake.current = state === "on";
  }, [state]);

  // 켠 사람에게만 워커를 심는다. 두 번 불러도 브라우저가 같은 등록을 돌려준다.
  useEffect(() => {
    if (state !== "on") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [state]);

  /**
   * 스위치. 켤 때만 권한을 묻는다 — `requestPermission()`은 사람이 직접 누른 자리에서만
   * 통한다(사파리는 아예 거절한다). 그래서 이 함수는 단추의 `onClick`에서만 불린다.
   */
  const toggle = useCallback(async () => {
    if (state === "unsupported" || state === "denied") return;
    if (state === "off" && Notification.permission !== "granted") {
      // 막혔으면 `read()`가 `denied`를 돌려준다 — 결과를 여기서 따로 안 들고 있는다.
      await Notification.requestPermission();
    }
    localStorage.setItem(KEY, state === "on" ? "off" : "on");
    changed();
  }, [state]);

  /**
   * 방금 당겨 온 목록을 넘긴다. 처음 보는 안 읽은 줄이 있으면 알림 하나를 띄운다.
   *
   * 꺼져 있어도 부른다 — 본 것을 기억하는 일은 계속 해야, 켠 순간 밀린 소식이 한꺼번에
   * 뜨지 않는다.
   */
  const fire = useCallback((rows: TaskNews[]) => {
    const unread = rows.filter((n) => n.unread);
    if (!seeded.current) {
      seeded.current = true;
      for (const n of unread) told.current.add(n.id);
      return;
    }
    const fresh = unread.filter((n) => !told.current.has(n.id));
    for (const n of fresh) told.current.add(n.id);
    const alert = newsAlert(fresh);
    if (!alert || !awake.current || Notification.permission !== "granted") return;

    const { title, ...body } = alert;
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, { ...body, icon: ICON, badge: ICON }))
      .catch(() => {});
  }, []);

  return { state, toggle, fire, awake };
}

const ICON = "/icon-192.png";

/**
 * 처음 보는 소식들을 알림 한 장으로 만든다. 없으면 `null`이다.
 *
 * 여러 건이면 제목이 건수고 본문이 그중 가장 새 것이다 — 다섯 장을 쌓는 대신 한 장으로
 * 묶는다. `tag`는 가장 새 알림의 id다: 탭을 두 개 열어 뒀으면 둘이 같은 묶음을 계산해서
 * 같은 이름이 되고, 브라우저가 하나로 겹쳐 준다.
 */
export function newsAlert(fresh: TaskNews[]): { title: string; body: string; tag: string } | null {
  const first = fresh[0];
  if (!first) return null;
  // 업무명을 못 푼 소식은 프로젝트명이 제목이다 — 목록 카드와 같은 규칙이다 (news-bell).
  // 둘 다 없으면 카드는 제목 줄을 비우면 되지만 알림은 제목 없이 못 뜬다.
  const what = first.title || first.project || "새 소식";
  return {
    title: fresh.length > 1 ? `새 소식 ${fresh.length}건` : what,
    body: fresh.length > 1 ? `${what} · ${first.message}` : `${first.from} · ${first.message}`,
    tag: first.id,
  };
}

/**
 * 스위치 상태는 브라우저에 있는 값(권한 + `localStorage`)이라 `useSyncExternalStore`로
 * 읽는다. 이펙트로 읽어서 `setState` 하면 첫 그림 뒤에 한 번 더 그리고, 린트도 그걸 막는다
 * (`use-narrow-screen.ts`와 같은 이유).
 *
 * 값을 바꾸는 건 우리뿐이라(`toggle`) 구독자에게 직접 알린다 — 들을 이벤트가 따로 없다.
 */
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((tell) => tell());
const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
};

const read = (): NotifyState => {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  return localStorage.getItem(KEY) === "on" ? "on" : "off";
};

// 서버에서는 알 방법이 없다. 스위치는 판을 열어야 보이는 것이라 첫 그림에 없다.
const ON_SERVER = (): NotifyState => "unsupported";
