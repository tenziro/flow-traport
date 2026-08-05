/**
 * 알림 전용 서비스 워커 (PRD §13 B1).
 *
 * **캐시는 안 한다.** `fetch` 핸들러가 아예 없어서 이 워커는 네트워크에 끼어들지 않는다 —
 * 매니페스트 주석이 서비스 워커를 안 넣은 이유가 "캐시된 화면은 틀린 화면"인데, 그 이유는
 * 여기 해당하지 않는다. 알림을 띄우려면 워커가 필요할 뿐이다: 안드로이드 크롬과 설치한
 * iOS PWA는 `new Notification()`을 거절하고 `registration.showNotification()`만 받는다.
 *
 * 등록도 알림을 켠 사람에게만 일어난다 (`use-news-notify.ts`) — 안 켠 사람 브라우저에
 * 워커를 심어 둘 이유가 없다.
 *
 * ponytail: 알림을 눌러도 그 업무가 바로 열리지는 않는다. 창을 앞으로 가져올 뿐이다 —
 * 종에 배지가 켜져 있어서 한 번 더 누르면 거기 있다. 업무까지 열려면 알림에 `postId`를
 * 실어 보내고 앱이 그걸 받아 모달을 여는 길(`postMessage`)이 필요하다.
 */

// 새로 배포한 워커가 다음 방문까지 기다리지 않게 한다. 캐시가 없어서 갈아탈 때 잃을 것도 없다.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // 이미 열린 창이 있으면 그걸 앞으로 — 같은 앱을 두 번 열지 않는다.
      const open = wins.find((w) => w.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow("/");
    }),
  );
});
