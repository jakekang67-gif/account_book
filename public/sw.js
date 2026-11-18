/* AI 챗가계부 — 설치 가능 PWA용 최소 서비스 워커 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
