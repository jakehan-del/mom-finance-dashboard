const CACHE_NAME = 'mom-finance-v8';
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
  e.waitUntil((async () => {
    // 옛 판 캐시를 전부 지운다
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
    // 열려 있는 화면을 강제로 다시 불러온다.
    // 옛 화면에는 「새 판이 오면 새로고침」 코드가 없어서, 여기서
    // 밀어주지 않으면 사용자가 손으로 껐다 켜야 한다 — 실제로
    // 소솝 개명이 껐다 켜도 안 보이는 일이 있었다.
    const wins = await self.clients.matchAll({ type: 'window' });
    for (const w of wins) {
      try { await w.navigate(w.url); } catch (_) { /* navigate 미지원 브라우저는 다음 열기 때 반영 */ }
    }
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // API 호출은 항상 네트워크
  if (e.request.url.includes('api.anthropic.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 화면(HTML)은 **네트워크 먼저** — 재무 숫자는 매달 바뀌는데
  // 캐시를 먼저 주면 서버를 갱신해도 폰에 옛 화면이 남는다.
  // 캐시는 인터넷이 안 될 때의 대비책으로만 쓴다.
  if (e.request.mode === 'navigate' || e.request.url.includes('index.html')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('./', clone));
        return resp;
      }).catch(() => caches.match('./'))
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
