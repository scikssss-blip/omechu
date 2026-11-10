// 오메추 서비스 워커 — 앱 화면만 캐시하고, Supabase 등 외부 요청은 건드리지 않음
const CACHE = 'omechu-v1';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/pocha.js', '/pocha-chars.js', '/pocha.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // 같은 사이트의 GET 요청만 처리 (Supabase·CDN·이미지 외부 링크는 통과)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // 네트워크 우선, 실패하면 캐시 (오프라인 대비)
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
  );
});
