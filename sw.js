// 서비스워커: 오프라인에서도 일정/예약/정산이 열리게 캐시
// 앱 파일을 바꿨다면 VERSION 숫자를 올려주세요 (옛 캐시 정리)
const VERSION = 'v5';
const CACHE = 'us-trip-' + VERSION;
const SHELL = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'img/4man_trip.jpg', 'data/trip.json',
  'js/config.js', 'js/util.js', 'js/theme.js', 'js/store.js', 'js/weather.js', 'js/checklist.js', 'js/bookings.js', 'js/edit.js',
  'js/expense.js', 'js/schedule.js', 'js/map.js', 'js/app.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('us-trip-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // 지도/날씨/GitHub API 는 건드리지 않음
  const isData = url.pathname.endsWith('/data/trip.json');
  if (isData) { // 데이터: 네트워크 우선(최신), 실패 시 캐시
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req)));
    return;
  }
  // 그 외: 캐시 우선 + 뒤에서 갱신
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
