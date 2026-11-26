// 실시간 공유: Firebase Firestore REST + 주기적 동기화(폴링). SDK 없이 fetch 만 사용
// 문서 위치: trips/{room}/{expenses|places|checklist}/{id}  ('room'은 우리끼리만 아는 비밀 코드)
// 오프라인이면 큐에 쌓아두었다가 연결되면 자동 업로드
const Shared = {
  COLLS: ['expenses', 'places', 'checklist'],
  enabled: false, base: '', pid: '', key: '', room: '',
  cache: { expenses: {}, places: {}, checklist: {} },
  queue: LS.get('usTripQueue', []),
  me: LS.get('usTripMe', null),
  busy: false, timer: null, lastOk: 0,

  init() {
    const c = (window.CONFIG && CONFIG.FIREBASE) || {};
    const mock = /[?&]fsmock=1/.test(location.search); // 테스트용 가짜 서버
    if (!mock && !(c.projectId && c.apiKey && c.room)) return;
    this.pid = c.projectId || 'mock'; this.key = c.apiKey || 'mock'; this.room = c.room || 'room';
    this.base = mock ? new URL('fsmock', location.href).href : 'https://firestore.googleapis.com';
    this.enabled = true;
    document.body.classList.add('can-add');
    const saved = LS.get('usTripSharedCache', null);
    if (saved) this.cache = { expenses: {}, places: {}, checklist: {}, ...saved };
    this.chip();
    this.sync();
    this.timer = setInterval(() => { if (!document.hidden) this.sync(); }, 10000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.sync(); });
    addEventListener('online', () => this.sync());
  },

  // ---- Firestore 값 변환 ----
  toFs(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'string') return { stringValue: v };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return { doubleValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(x => this.toFs(x)) } };
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, this.toFs(x)])) } };
  },
  fromFs(f) {
    if ('stringValue' in f) return f.stringValue;
    if ('doubleValue' in f) return f.doubleValue;
    if ('integerValue' in f) return Number(f.integerValue);
    if ('booleanValue' in f) return f.booleanValue;
    if ('nullValue' in f) return null;
    if ('arrayValue' in f) return (f.arrayValue.values || []).map(x => this.fromFs(x));
    if ('mapValue' in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, this.fromFs(x)]));
    return null;
  },
  docUrl(coll, id) { return `${this.base}/v1/projects/${this.pid}/databases/(default)/documents/trips/${this.room}/${coll}${id ? '/' + encodeURIComponent(id) : ''}`; },

  // ---- 읽기/쓰기 ----
  newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },
  put(coll, id, data) {
    const doc = { ...data, id, ts: Date.now() };
    this.cache[coll][id] = doc;
    this.queue = this.queue.filter(q => !(q.coll === coll && q.id === id));
    this.queue.push({ op: 'put', coll, id, data: doc });
    this.persist(); this.changed(); this.flush();
  },
  del(coll, id) {
    delete this.cache[coll][id];
    this.queue = this.queue.filter(q => !(q.coll === coll && q.id === id));
    this.queue.push({ op: 'del', coll, id });
    this.persist(); this.changed(); this.flush();
  },
  persist() { LS.set('usTripQueue', this.queue); LS.set('usTripSharedCache', this.cache); },
  async flush() {
    if (!this.enabled || this.busy || !navigator.onLine) return;
    this.busy = true;
    try {
      while (this.queue.length) {
        const q = this.queue[0];
        const url = this.docUrl(q.coll, q.id) + `?key=${this.key}`;
        const r = q.op === 'put'
          ? await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: this.toFs(q.data).mapValue.fields }) })
          : await fetch(url, { method: 'DELETE' });
        if (!r.ok && r.status !== 404) throw new Error('HTTP ' + r.status);
        this.queue.shift(); LS.set('usTripQueue', this.queue);
      }
      this.lastOk = Date.now();
    } catch (e) { /* 다음 동기화 때 재시도 */ }
    this.busy = false; this.chip();
  },
  async sync() {
    if (!this.enabled || !navigator.onLine) { this.chip(); return; }
    await this.flush();
    try {
      for (const coll of this.COLLS) {
        const map = {}; let token = '';
        do {
          const r = await fetch(this.docUrl(coll) + `?key=${this.key}&pageSize=300` + (token ? `&pageToken=${encodeURIComponent(token)}` : ''));
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const j = await r.json();
          (j.documents || []).forEach(d => { const id = decodeURIComponent(d.name.split('/').pop()); map[id] = this.fromFs({ mapValue: { fields: d.fields || {} } }); map[id].id = id; });
          token = j.nextPageToken || '';
        } while (token);
        // 아직 못 올린 내 변경(큐)은 서버 값보다 우선
        this.queue.filter(q => q.coll === coll).forEach(q => { if (q.op === 'put') map[q.id] = q.data; else delete map[q.id]; });
        this.cache[coll] = map;
      }
      this.lastOk = Date.now(); LS.set('usTripSharedCache', this.cache); this.changed();
    } catch (e) { /* 오프라인/일시 오류: 저장된 값 사용 */ }
    this.chip();
  },

  // ---- 화면 갱신 ----
  changed() {
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      if (typeof Schedule !== 'undefined') Schedule.render();
      if (typeof Expense !== 'undefined') Expense.render();
      if (typeof Checklist !== 'undefined') Checklist.render();
      if (typeof MapView !== 'undefined') MapView.update();
    }, 50);
  },
  chip() {
    const row = $('clock-row'); if (!row) return;
    let el = $('sync-chip');
    if (!el) { el = document.createElement('span'); el.id = 'sync-chip'; el.className = 'ck sync'; el.onclick = () => this.pickMe(); row.appendChild(el); }
    const pending = this.queue.length, off = !navigator.onLine;
    el.innerHTML = `👥 공유 ${off ? '⚪ 오프라인' : pending ? '🟡 전송 대기 ' + pending : '🟢'} · <b>${esc(this.me || '이름 선택')}</b>`;
  },

  // ---- 내 이름 / 권한 ----
  members() { return Store.trip.meta.members; },
  pickMe(cb) {
    Sheet.open({
      title: '누구세요? 👤',
      fields: [{ key: 'me', label: '이 폰의 주인 (추가한 항목에 이름이 표시돼요)', type: 'select', value: this.me || this.members()[0], options: this.members().map(m => ({ v: m, l: m })) }],
      onSave: v => { this.me = v.me; LS.set('usTripMe', v.me); Sheet.close(); this.chip(); this.changed(); if (cb) cb(); }
    });
  },
  needMe(cb) { if (this.me) cb(); else this.pickMe(cb); },
  mine(d) { return !!d && (Edit.isEditor || (this.me && d.by === this.me)); },
  list(coll) { return Object.values(this.cache[coll] || {}); }
};
