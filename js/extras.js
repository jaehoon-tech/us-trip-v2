// 부가 기능: 시계/현지시각, 지금 일정, 환율, 팁 계산기, 영수증(내 기기), 드래그 정렬, 항공 링크
// ?now=2026-12-26T14:00 를 주소에 붙이면 그 시각으로 테스트할 수 있어요
const Clock = {
  off: (() => { const m = /[?&]now=([^&]+)/.exec(location.search); const d = m && new Date(decodeURIComponent(m[1])); return d && !isNaN(d) ? d.getTime() - Date.now() : 0; })(),
  now() { return new Date(Date.now() + this.off); },
  fmt(tz) { return new Intl.DateTimeFormat('ko-KR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(this.now()); },
  init() {
    $('clock-row').innerHTML = `
      <span class="ck">🇰🇷 한국 <b data-tz="Asia/Seoul"></b></span>
      <span class="ck">🇺🇸 서부 <b data-tz="America/Los_Angeles"></b><i>샌프란·LV·LA · 한국보다 17h 느림</i></span>
      <span class="ck">⛰️ 산악 <b data-tz="America/Phoenix"></b><i>자이언·카납·그랜드캐니언 · 서부+1h</i></span>`;
    this.tick(); setInterval(() => this.tick(), 20000);
  },
  tick() { document.querySelectorAll('[data-tz]').forEach(el => el.textContent = this.fmt(el.dataset.tz)); }
};

// 지금/다음 일정
const Live = {
  toMin(t) { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; },
  update() {
    document.querySelectorAll('.timeline-item.now, .timeline-item.next').forEach(e => e.classList.remove('now', 'next'));
    document.querySelectorAll('.live-badge').forEach(e => e.remove());
    const box = $('live-card'), t = Schedule.todayDay();
    if (!t) { box.style.display = 'none'; return; }
    const d = Clock.now(), mins = d.getHours() * 60 + d.getMinutes();
    const places = Store.getPlaces(t);
    let cur = -1, nxt = -1;
    places.forEach((p, i) => { const m = this.toMin(p.time); if (m == null) return; if (m <= mins) cur = i; else if (nxt < 0) nxt = i; });
    const items = document.querySelectorAll(`#card-day-${t} .timeline-item`);
    const mark = (i, cls, txt) => { const el = items[i]; if (!el) return; el.classList.add(cls); const b = document.createElement('span'); b.className = 'live-badge ' + cls; b.textContent = txt; const ti = el.querySelector('.timeline-title'); ti && ti.prepend(b); };
    if (cur >= 0) mark(cur, 'now', '지금');
    if (nxt >= 0) mark(nxt, 'next', '다음');
    const line = (label, p) => p ? `<div><b>${label}</b> ${p.time ? esc(p.time) + ' ' : ''}${esc(p.name)}</div>` : '';
    let left = '';
    if (nxt >= 0) { const n = this.toMin(places[nxt].time) - mins; left = `<div class="live-left">⏳ ${n >= 60 ? Math.floor(n / 60) + '시간 ' : ''}${n % 60}분 후</div>`; }
    box.innerHTML = `<div class="live-title">📍 오늘 · ${esc(Store.dayText(t))}</div>${line('지금', places[cur])}${line('다음', places[nxt])}${left}` + (cur < 0 && nxt < 0 ? '<div>시간이 지정된 일정이 없어요</div>' : '');
    box.style.display = 'block';
  }
};

// 환율 (open.er-api.com, 키 불필요)
const Fx = {
  rate: LS.get('usTripFx', {}).rate || null,
  async load() {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      const j = await r.json();
      if (j.result === 'success' && j.rates && j.rates.KRW) { this.rate = Math.round(j.rates.KRW * 10) / 10; LS.set('usTripFx', { rate: this.rate, ts: Date.now() }); }
    } catch (e) { /* 오프라인이면 저장된 값 사용 */ }
    Expense.render();
  }
};

// 팁 계산기
const Tip = {
  pct: 18,
  init() {
    const upd = () => {
      const a = parseFloat($('tip-amt').value) || 0, n = Math.max(1, parseInt($('tip-n').value) || 1);
      const tip = a * this.pct / 100, tot = a + tip;
      $('tip-res').innerHTML = a ? `팁 <b>$${tip.toFixed(2)}</b> · 합계 <b>$${tot.toFixed(2)}</b> · 1인당 <b>$${(tot / n).toFixed(2)}</b> <small>(≈${Math.round(tot / n * Expense.rate()).toLocaleString()}원)</small>` : '금액을 입력하면 계산돼요';
    };
    $('tip-amt').oninput = upd; $('tip-n').oninput = upd;
    $('tip-pcts').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; this.pct = Number(b.dataset.p); $('tip-pcts').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); upd(); };
    upd();
  }
};

// 영수증 사진: 이 기기 IndexedDB 에만 저장 (공개 안 됨)
const Receipts = {
  db: null, ids: new Set(),
  open() { return new Promise((res, rej) => { if (this.db) return res(this.db); const r = indexedDB.open('usTripReceipts', 1); r.onupgradeneeded = () => r.result.createObjectStore('r'); r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => rej(r.error); }); },
  async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('r', mode), q = fn(t.objectStore('r')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); },
  async init() { try { const keys = await this.tx('readonly', s => s.getAllKeys()); this.ids = new Set(keys || []); } catch (e) {} },
  has(id) { return this.ids.has(String(id)); },
  async put(id, blob) { await this.tx('readwrite', s => s.put(blob, String(id))); this.ids.add(String(id)); },
  async del(id) { await this.tx('readwrite', s => s.delete(String(id))); this.ids.delete(String(id)); },
  async get(id) { return this.tx('readonly', s => s.get(String(id))); },
  async shrink(file) {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(r, 'image/jpeg', 0.72));
  },
  async show(id) {
    const b = await this.get(id); if (!b) return showToast('사진을 찾지 못했어요');
    const url = URL.createObjectURL(b); $('photo-img').src = url; $('photo-view').style.display = 'flex';
  }
};

// 드래그로 장소 순서 변경 (편집 모드, 손잡이 ⠿)
const Drag = {
  s: null,
  init() {
    document.addEventListener('pointerdown', e => {
      const h = e.target.closest('.drag-h'); if (!h) return;
      e.preventDefault();
      const item = h.closest('.timeline-item');
      this.s = { item, tl: item.parentElement, day: Number(h.dataset.day), pid: e.pointerId, h };
      item.classList.add('dragging'); try { h.setPointerCapture(e.pointerId); } catch (x) {}
    });
    document.addEventListener('pointermove', e => {
      const s = this.s; if (!s) return; e.preventDefault();
      const y = e.clientY, sc = document.querySelector('.tab-view.active'), r = sc.getBoundingClientRect();
      if (y < r.top + 60) sc.scrollTop -= 14; else if (y > r.bottom - 60) sc.scrollTop += 14;
      const sib = [...s.tl.querySelectorAll('.timeline-item')].filter(x => x !== s.item);
      for (const o of sib) { const b = o.getBoundingClientRect(); if (y < b.top + b.height / 2) { s.tl.insertBefore(s.item, o); return; } }
      s.tl.appendChild(s.item);
    }, { passive: false });
    const end = () => {
      const s = this.s; if (!s) return; this.s = null; s.item.classList.remove('dragging');
      const order = [...s.tl.querySelectorAll('.timeline-item')].map(x => x.dataset.pid);
      const day = Store.day(s.day), map = Object.fromEntries(day.places.map(p => [p.id, p]));
      const next = order.map(id => map[id]).filter(Boolean);
      if (next.length === day.places.length && next.some((p, i) => p !== day.places[i])) { day.places = next; Store.save(); }
      Edit.rerender();
    };
    document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  }
};

// 항공편 운항 현황 링크 (FlightAware)
function flightLinks(text) {
  const set = new Set(); String(text || '').replace(/\bUA\s?(\d{2,4})\b/g, (m, n) => set.add(n));
  return [...set].map(n => `<a class="btn-gmap fl" target="_blank" rel="noopener" href="https://www.flightaware.com/live/flight/UAL${n}">🛫 UA${n} 운항현황</a>`).join(' ');
}

// 편집자 등록/해제: 상단 배너를 빠르게 5번 탭 (설치형 앱처럼 주소에 ?edit=1 을 못 붙일 때 사용)
(() => {
  const el = document.getElementById('dday-banner'); if (!el) return;
  let taps = 0, timer;
  el.addEventListener('click', () => {
    taps++; clearTimeout(timer); timer = setTimeout(() => taps = 0, 1500);
    if (taps < 5) return;
    taps = 0;
    const on = localStorage.getItem('usTripEditor') === '1';
    if (on) localStorage.removeItem('usTripEditor'); else localStorage.setItem('usTripEditor', '1');
    showToast(on ? '편집자 모드를 해제했어요' : '✅ 이 기기를 편집자로 등록했어요');
    setTimeout(() => location.reload(), 800);
  });
})();
