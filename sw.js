// 서비스 워커 캐시 버전 및 이름 정의
const CACHE_NAME = "air-traffic-v1";

// 오프라인에서도 작동할 수 있도록 캐싱할 정적 자산 목록
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// 서비스 워커 설치 단계 (자산 사전 캐싱)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] 정적 자산 캐싱 완료");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // 새로운 서비스 워커가 대기하지 않고 즉시 활성화되도록 설정
  self.skipWaiting();
});

// 서비스 워커 활성화 단계 (이전 캐시 정리)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] 이전 캐시 삭제:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  // 활성화된 즉시 모든 클라이언트를 제어
  self.clients.claim();
});

// 네트워크 요청 가로채기 (Fetch)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 실시간 API 호출(/api/)은 캐시하지 않고 항상 네트워크를 통해 최신 데이터 요청
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 그 외 정적 자산은 캐시 우선, 캐시에 없으면 네트워크로 조회
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // 네트워크 연결이 끊긴 경우 기본 index.html 반환
        if (event.request.headers.get("accept").includes("text/html")) {
          return caches.match("/index.html");
        }
      });
    })
  );
});

