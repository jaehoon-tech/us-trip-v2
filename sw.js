// 서비스워커: 오프라인에서도 일정/예약/정산이 열리게 캐시
// 앱 파일을 바꿨다면 VERSION 숫자를 올려주세요 (옛 캐시 정리)
const VERSION = 'v10';
const CACHE = 'us-trip-' + VERSION;
const SHELL = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'img/4man_trip.jpg', 'data/trip.json',
  'js/config.js', 'js/util.js', 'js/theme.js', 'js/store.js', 'js/shared.js', 'js/weather.js', 'js/checklist.js', 'js/bookings.js', 'js/edit.js',
  'js/expense.js', 'js/extras.js', 'js/schedule.js', 'js/map.js', 'js/app.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('us-trip-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // 지도/날씨/GitHub API 는 건드리지 않음
  // 네트워크 우선(최신 반영, 브라우저 HTTP 캐시 무시) + 3초 안에 못 받으면 저장본 사용 → 산속 약한 신호에서도 빠르게 열림
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    const net = fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; });
    if (!cached) return net.catch(() => caches.match('index.html'));
    return Promise.race([net.catch(() => cached), new Promise(res => setTimeout(() => res(cached), 3000))]);
  })());
});
