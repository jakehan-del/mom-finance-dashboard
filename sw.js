const CACHE_NAME = 'mom-finance-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // API 호출은 항상 네트워크
  if (e.request.url.includes('api.anthropic.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 화면(HTML)은 **네트워크 먼저** — 재무 숫자는 매달 바뀌는데
  // 캐시를 먼저 주면 자료를 갱신해도 폰에 옛 화면이 계속 남는다.
  // 실제로 v6까지 그랬고, 소솝 개명 배포가 폰에 안 보였다.
  // 캐시는 오프라인일 때의 대비책으로만 쓴다.
  if (e.request.mode === 'navigate' || e.request.url.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return resp;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('./')))
    );
    return;
  }

  // 아이콘·차트 라이브러리는 캐시 먼저 (내용이 안 바뀌는 것들)
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return resp;
    }))
  );
});
