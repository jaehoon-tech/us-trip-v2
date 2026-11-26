// 편집 모드 + 바텀시트 폼
const Sheet = {
  cfg: null, picked: null,
  open(cfg) {
    this.cfg = cfg; this.picked = null;
    $('sheet-title').textContent = cfg.title;
    $('sheet-body').innerHTML = cfg.fields.map(f => {
      const v = f.value == null ? '' : f.value;
      let inp;
      if (f.type === 'select') inp = `<select data-key="${f.key}">${f.options.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
      else if (f.type === 'file') inp = `<input type="file" accept="image/*" data-key="${f.key}">`;
      else if (f.type === 'checks') inp = `<div class="sf-checks" data-checks="${f.key}">${f.options.map(o => `<label><input type="checkbox" value="${esc(o)}" ${(f.value || []).includes(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div>`;
      else if (f.type === 'textarea') inp = `<textarea data-key="${f.key}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`;
      else inp = `<input data-key="${f.key}" type="${f.type || 'text'}" ${f.type === 'number' ? 'step="0.01" inputmode="decimal"' : ''} value="${esc(v)}" placeholder="${esc(f.ph || '')}" ${f.ac ? 'autocomplete="off"' : ''}>`;
      return `<label class="sf"><span>${esc(f.label)}</span>${inp}${f.hint ? `<em>${esc(f.hint)}</em>` : ''}</label>`;
    }).join('');
    const extra = (cfg.buttons || []).map((b, i) => `<button class="mbtn ${b.cls || 'mbtn-gray'}" data-sbtn="${i}">${esc(b.label)}</button>`).join('');
    $('sheet-actions').innerHTML = `${extra}<button class="mbtn mbtn-blue" data-sbtn="save">저장</button>`;
    $('sheet').style.display = 'flex';
    $('sheet-body').scrollTop = 0;
    const fi = cfg.fields.find(f => f.focus); if (fi) setTimeout(() => { const el = $('sheet-body').querySelector(`[data-key="${fi.key}"]`); el && el.focus(); }, 80);
    const ac = $('sheet-body').querySelector('[data-key="address"]');
    if (ac && cfg.fields.find(f => f.key === 'address' && f.ac)) this.attachAC(ac);
  },
  values() {
    const o = {};
    $('sheet-body').querySelectorAll('[data-key]').forEach(el => o[el.dataset.key] = el.type === 'file' ? (el.files[0] || null) : el.value.trim());
    $('sheet-body').querySelectorAll('[data-checks]').forEach(el => o[el.dataset.checks] = [...el.querySelectorAll('input:checked')].map(i => i.value));
    return o;
  },
  close() { $('sheet').style.display = 'none'; this.cfg = null; },
  async attachAC(input) {
    try {
      if (!(window.google && google.maps && google.maps.importLibrary)) return;
      await google.maps.importLibrary('places');
      const ac = new google.maps.places.Autocomplete(input, { fields: ['geometry', 'formatted_address', 'name'] });
      ac.addListener('place_changed', () => {
        const p = ac.getPlace();
        if (!p || !p.geometry) return;
        this.picked = { lat: p.geometry.location.lat(), lng: p.geometry.location.lng(), address: p.formatted_address || input.value, name: p.name };
        input.value = this.picked.address;
        const nm = $('sheet-body').querySelector('[data-key="name"]');
        if (nm && !nm.value.trim() && p.name) nm.value = p.name;
      });
    } catch (e) { /* Places 미사용 키면 주소 직접 입력 + 저장 시 지오코딩 */ }
  }
};

const Edit = {
  isEditor: false, on: false,
  TYPES: [{ v: 'visit', l: '📍 방문' }, { v: 'food', l: '🍽️ 식사' }, { v: 'cafe', l: '☕ 카페' }, { v: 'move', l: '🚗 이동' }, { v: 'flight', l: '✈️ 항공/공항' }, { v: 'sleep', l: '🏠 숙소' }],
  typeIcon(t) { return { food: '🍽️ ', cafe: '☕ ', move: '🚗 ' }[t] || ''; },

  init() {
    if (/[?&]edit=1/.test(location.search)) localStorage.setItem('usTripEditor', '1');
    if (/[?&]edit=0/.test(location.search)) localStorage.removeItem('usTripEditor');
    this.isEditor = localStorage.getItem('usTripEditor') === '1';
    document.body.classList.toggle('editor', this.isEditor);
    $('btn-edit').style.display = this.isEditor ? 'flex' : 'none';
  },
  toggle() {
    this.on = !this.on;
    document.body.classList.toggle('editing', this.on);
    $('btn-edit').classList.toggle('on', this.on);
    this.refreshBar();
  },
  refreshBar() {
    const bar = $('edit-bar');
    bar.style.display = this.on ? 'flex' : 'none';
    $('edit-bar-msg').textContent = Store.hasDraft ? '✏️ 편집 모드 · 이 기기에 임시 저장됨 (아직 공개 전)' : '✏️ 편집 모드 · 수정하면 이 기기에 임시 저장돼요';
    $('edit-reset').style.display = Store.hasDraft ? 'inline-block' : 'none';
  },
  reset() { showConfirm('이 기기의 수정 내용을 모두 버리고 공개본으로 되돌릴까요?', () => Store.resetDraft()); },

  rerender() { Schedule.render(); Bookings.render(); MapView.update(); },

  // ---------- 장소 ----------
  placeSheet(dayId, placeId) {
    const day = Store.day(dayId);
    const sharedP = placeId && Shared.enabled ? Shared.cache.places[placeId] : null;
    const p = placeId ? (sharedP || day.places.find(x => x.id === placeId)) : { type: 'visit' };
    if (!p) return;
    const isNew = !placeId;
    const shared = !!sharedP || (isNew && Shared.enabled);
    Sheet.open({
      title: isNew ? `장소 추가 · ${day.label}` : '장소 수정',
      fields: [
        { key: 'time', label: '시간', value: p.time, ph: '예: 14:30' },
        { key: 'name', label: '장소명', value: p.name, ph: '예: 인앤아웃 버거' },
        { key: 'type', label: '종류', type: 'select', value: p.type, options: this.TYPES },
        { key: 'address', label: '주소 (검색해서 고르면 지도 핀 자동 설정)', value: p.address, ac: true, ph: '장소/주소 검색' },
        { key: 'desc', label: '메모', type: 'textarea', value: p.desc },
        { key: 'nextDist', label: '다음 장소까지 이동', value: p.nextDist, ph: '예: 약 40분 · 30km' },
        { key: 'nextMode', label: '이동 수단', type: 'select', value: p.nextMode || 'car', options: [{ v: 'car', l: '🚗 차량' }, { v: 'flight', l: '✈️ 비행' }, { v: 'walk', l: '🚶 도보' }] },
        { key: 'bookingId', label: '연결된 예약', type: 'select', value: p.bookingId || '', options: [{ v: '', l: '없음' }, ...(Store.trip.bookings || []).map(b => ({ v: b.id, l: b.title }))] },
        { key: 'day', label: '일차', type: 'select', value: dayId, options: Store.trip.days.map(d => ({ v: d.id, l: d.label })) }
      ],
      buttons: isNew ? [] : [
        ...(shared ? [] : [{ label: '복제', fn: () => { this.dupPlace(dayId, placeId); Sheet.close(); } }]),
        { label: '삭제', cls: 'mbtn-red', fn: () => { Sheet.close(); this.delPlace(dayId, placeId); } }
      ],
      onSave: v => shared ? this.saveShared(dayId, placeId, v) : this.savePlace(dayId, placeId, v)
    });
  },
  async savePlace(dayId, placeId, v) {
    if (!v.name) return showToast('장소명을 입력해주세요.');
    const day = Store.day(dayId);
    let p = placeId ? day.places.find(x => x.id === placeId) : null;
    const isNew = !p;
    if (isNew) p = { id: 'p_' + Date.now(), lat: null, lng: null };
    const oldAddr = p.address || '';
    let geo = null;
    if (Sheet.picked && v.address === Sheet.picked.address) geo = Sheet.picked;
    else if (v.address && v.address !== oldAddr) {
      showToast('📍 위치 찾는 중...');
      geo = await geocode(v.address);
      if (!geo) showToast('⚠️ 위치를 찾지 못했어요 (기존 핀 유지)');
    }
    if (geo) { p.lat = geo.lat; p.lng = geo.lng; p.address = geo.address || v.address; delete p.approx; }
    else p.address = v.address;
    Object.assign(p, { time: v.time || undefined, name: v.name, type: v.type, desc: v.desc, nextDist: v.nextDist || undefined, nextMode: v.nextMode && v.nextMode !== 'car' ? v.nextMode : undefined, bookingId: v.bookingId || undefined });
    Object.keys(p).forEach(k => p[k] === undefined && delete p[k]);
    const target = Store.day(Number(v.day));
    if (isNew) target.places.push(p);
    else if (target.id !== day.id) { day.places = day.places.filter(x => x.id !== p.id); target.places.push(p); }
    Store.save(); Sheet.close(); this.rerender(); showToast('저장되었습니다 ✅');
  },
  // 모두에게 공유되는 장소 저장 (Firestore)
  async saveShared(dayId, placeId, v) {
    if (!v.name) return showToast('장소명을 입력해주세요.');
    const old = placeId ? Shared.cache.places[placeId] : null;
    let geo = null;
    if (Sheet.picked && v.address === Sheet.picked.address) geo = Sheet.picked;
    else if (v.address && (!old || v.address !== old.address)) {
      showToast('📍 위치 찾는 중...');
      geo = await geocode(v.address);
      if (!geo) showToast('⚠️ 위치를 찾지 못했어요 (지도 핀 없이 저장)');
    }
    const doc = { dayId: Number(v.day), name: v.name, type: v.type, time: v.time || '', desc: v.desc || '', nextDist: v.nextDist || '', nextMode: v.nextMode || 'car',
      address: geo ? (geo.address || v.address) : v.address, lat: geo ? geo.lat : (old ? old.lat : null), lng: geo ? geo.lng : (old ? old.lng : null), by: old ? old.by : Shared.me };
    Shared.put('places', placeId || Shared.newId('p_'), doc);
    Sheet.close(); showToast('저장했어요 · 모두에게 보여요 ✅');
  },
  dupPlace(dayId, id) {
    const day = Store.day(dayId), i = day.places.findIndex(x => x.id === id);
    const c = JSON.parse(JSON.stringify(day.places[i])); c.id = 'p_' + Date.now(); c.name += ' (복제)';
    day.places.splice(i + 1, 0, c); Store.save(); this.rerender(); showToast('복제했어요');
  },
  delPlace(dayId, id) {
    if (Shared.enabled && Shared.cache.places[id]) {
      if (!Shared.mine(Shared.cache.places[id])) return showToast('추가한 사람만 삭제할 수 있어요');
      return showConfirm('이 장소를 삭제할까요? (모두에게서 사라져요)', () => Shared.del('places', id));
    }
    showConfirm('이 장소를 삭제할까요?', () => {
      const day = Store.day(dayId); day.places = day.places.filter(x => x.id !== id);
      Store.save(); this.rerender();
    });
  },
  movePlace(dayId, id, dir) {
    const arr = Store.day(dayId).places, i = arr.findIndex(x => x.id === id), j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    Store.save(); this.rerender();
  },
  daySheet(dayId) {
    const d = Store.day(dayId);
    Sheet.open({
      title: `${d.label} 수정`,
      fields: [
        { key: 'title', label: '제목', value: d.title },
        { key: 'driveInfo', label: '운전 정보 (상단 배지)', value: d.driveInfo, ph: '예: 총 340km, 약 4시간' },
        { key: 'shortDrive', label: '지도 배지 (짧게)', value: d.shortDrive, ph: '예: 340km (4h)' }
      ],
      onSave: v => {
        if (!v.title) return showToast('제목을 입력해주세요.');
        d.title = v.title; v.driveInfo ? d.driveInfo = v.driveInfo : delete d.driveInfo; v.shortDrive ? d.shortDrive = v.shortDrive : delete d.shortDrive;
        Store.save(); Sheet.close(); this.rerender();
      }
    });
  },

  // ---------- 예약 ----------
  bookingSheet(id) {
    const b = id ? Store.booking(id) : { type: 'stay' };
    const isNew = !id;
    const bd = (b.breakdown || []).map(x => `${x.label} ${x.amount}`).join('\n');
    const fields = [
      { key: 'type', label: '종류', type: 'select', value: b.type, options: [{ v: 'stay', l: '🏨 숙소' }, { v: 'flight', l: '✈️ 항공' }, { v: 'car', l: '🚗 렌터카' }, { v: 'other', l: '🎫 기타(입장권 등)' }] },
      { key: 'title', label: '이름', value: b.title },
      { key: 'site', label: '예약처', value: b.site, ph: 'Airbnb / Priceline ...' },
      { key: 'checkIn', label: '체크인·시작', value: b.checkIn || b.date, ph: '2026-12-25 16:00' },
      { key: 'checkOut', label: '체크아웃·종료', value: b.checkOut },
      { key: 'address', label: '주소', value: b.address },
      { key: 'confirmation', label: '예약번호 (공개됨 · 코드/PIN은 넣지 마세요)', value: b.confirmation },
      { key: 'phone', label: '전화', value: b.phone },
      { key: 'breakdown', label: '요금 상세 (한 줄에 "이름 금액") — 있으면 합계가 총액', type: 'textarea', rows: 3, value: bd, ph: '객실 161.93\n세금·서비스 26.23' },
      { key: 'amount', label: '총액 ($) — 요금 상세가 없을 때', type: 'number', value: b.breakdown && b.breakdown.length ? '' : b.amount },
      { key: 'cancelDeadline', label: '취소 기한', value: b.cancelDeadline, ph: '2026-12-22 23:59 / 환불 불가' },
      { key: 'warn', label: '주의사항', value: b.warn },
      { key: 'note', label: '메모 (공개됨)', type: 'textarea', value: b.note },
      { key: 'privateMemo', label: '🔒 비공개 메모 (이 기기에만 저장 · 출입코드/PIN 등)', type: 'textarea', value: id ? (Private.get(id) || '') : '', ph: '예: 출입문 코드 ****' }
    ];
    if (isNew) fields.push({ key: 'payer', label: '결제자 (정산에 지출로 추가)', type: 'select', value: '', options: [{ v: '', l: '정산에 추가 안 함' }, ...Store.trip.meta.members.map(m => ({ v: m, l: m }))] });
    Sheet.open({
      title: isNew ? '예약 추가' : '예약 수정', fields,
      buttons: isNew ? [] : [{ label: '삭제', cls: 'mbtn-red', fn: () => { Sheet.close(); this.delBooking(id); } }],
      onSave: v => this.saveBooking(id, v)
    });
  },
  parseBreakdown(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const m = l.match(/^(.*?)[\s:]*\$?(-?\d+(?:\.\d+)?)$/);
      return m ? { label: m[1].trim() || '항목', amount: parseFloat(m[2]) } : null;
    }).filter(Boolean);
  },
  saveBooking(id, v) {
    if (!v.title) return showToast('이름을 입력해주세요.');
    let b = id ? Store.booking(id) : null;
    const isNew = !b;
    if (isNew) { b = { id: 'b_' + Date.now() }; Store.trip.bookings.push(b); }
    const bd = this.parseBreakdown(v.breakdown || '');
    const amount = bd.length ? Math.round(bd.reduce((s, x) => s + x.amount, 0) * 100) / 100 : (v.amount ? parseFloat(v.amount) : undefined);
    Object.assign(b, { type: v.type, title: v.title, site: v.site, checkIn: v.checkIn, checkOut: v.checkOut, address: v.address, confirmation: v.confirmation, phone: v.phone, cancelDeadline: v.cancelDeadline, warn: v.warn, note: v.note, amount, breakdown: bd.length ? bd : undefined });
    delete b.date; delete b.time; delete b.paidNow; delete b.amountNote;
    Object.keys(b).forEach(k => (b[k] === undefined || b[k] === '') && delete b[k]);
    // 연결된 지출 동기화
    (Store.trip.expenses || []).filter(e => e.bookingId === b.id).forEach(e => {
      if (amount != null) e.amount = amount; e.desc = e.desc; if (b.breakdown) e.breakdown = b.breakdown; else delete e.breakdown;
    });
    if (isNew && v.payer && amount) {
      const cat = v.type === 'stay' ? '숙박' : (v.type === 'other' ? '기타' : '교통');
      Store.trip.expenses.push({ id: 'x_' + Date.now(), day: '1일차', category: cat, desc: b.title, amount, payer: v.payer, members: [...Store.trip.meta.members], settled: false, bookingId: b.id, ...(b.breakdown ? { breakdown: b.breakdown } : {}) });
    }
    Private.set(b.id, v.privateMemo);
    Store.save(); Sheet.close(); this.rerender(); Expense.render(); showToast('저장되었습니다 ✅');
  },
  delBooking(id) {
    showConfirm('이 예약을 삭제할까요? (연결된 지출은 유지돼요)', () => {
      Store.trip.bookings = Store.trip.bookings.filter(b => b.id !== id);
      Store.trip.days.forEach(d => d.places.forEach(p => { if (p.bookingId === id) delete p.bookingId; }));
      Store.trip.expenses.forEach(e => { if (e.bookingId === id) delete e.bookingId; });
      Private.set(id, '');
      Store.save(); this.rerender();
    });
  }
};

// 비공개 메모: 이 기기 localStorage 에만 저장 (trip.json / GitHub 에 올라가지 않음)
const Private = {
  all() { return LS.get('usTripPrivate', {}); },
  get(id) { return this.all()[id]; },
  set(id, text) { const a = this.all(); if (text) a[id] = text; else delete a[id]; LS.set('usTripPrivate', a); }
};

// GitHub 공개(커밋)
const Publish = {
  cfg() { return LS.get('usTripGh', { repo: '', branch: 'main', path: 'data/trip.json', token: '' }); },
  settings() {
    const c = this.cfg();
    Sheet.open({
      title: '⚙️ GitHub 공개 설정',
      fields: [
        { key: 'repo', label: '저장소 (아이디/저장소명)', value: c.repo, ph: '예: myname/us-trip' },
        { key: 'branch', label: '브랜치', value: c.branch },
        { key: 'path', label: '데이터 파일 경로', value: c.path },
        { key: 'token', label: '토큰 (Fine-grained PAT)', type: 'password', value: c.token, ph: 'github_pat_...', hint: '이 저장소 하나에 Contents: Read and write 권한만 준 토큰. 이 기기에만 저장돼요.' }
      ],
      onSave: v => {
        if (!/^[\w.-]+\/[\w.-]+$/.test(v.repo)) return showToast('저장소는 아이디/저장소명 형식으로 적어주세요.');
        LS.set('usTripGh', { repo: v.repo, branch: v.branch || 'main', path: v.path || 'data/trip.json', token: v.token });
        Sheet.close(); showToast('저장했어요 ✅');
      }
    });
  },
  b64(str) { return btoa(unescape(encodeURIComponent(str))); },
  run() {
    const c = this.cfg();
    if (!c.repo || !c.token) { showToast('먼저 ⚙️ 에서 저장소와 토큰을 설정해주세요.'); return this.settings(); }
    showConfirm('지금까지 수정한 내용을 공개할까요?\n(친구들 화면에 1~2분 뒤 반영돼요)', () => this.push(c));
  },
  async push(c) {
    const btn = $('edit-publish'); btn.disabled = true; btn.textContent = '공개 중...';
    try {
      const url = `https://api.github.com/repos/${c.repo}/contents/${c.path}`;
      const h = { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
      const g = await fetch(`${url}?ref=${encodeURIComponent(c.branch)}`, { headers: h });
      let sha;
      if (g.ok) sha = (await g.json()).sha; else if (g.status !== 404) throw this.err(g.status);
      const ver = 'pub-' + Date.now();
      const out = { ...Store.trip, meta: { ...Store.trip.meta, version: ver } };
      const r = await fetch(url, { method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'update trip data (' + new Date().toISOString().slice(0, 16) + ')', content: this.b64(JSON.stringify(out, null, 1)), branch: c.branch, ...(sha ? { sha } : {}) }) });
      if (!r.ok) throw this.err(r.status);
      Store.trip.meta.version = ver; Store.save();
      showToast('🚀 공개 완료! 1~2분 뒤 친구들 화면에 반영돼요');
    } catch (e) { showToast('⚠️ ' + (e.message || '공개 실패')); }
    btn.disabled = false; btn.textContent = '🚀 공개';
  },
  err(s) {
    return new Error({ 401: '토큰이 올바르지 않아요 (401)', 403: '토큰 권한이 부족해요 (Contents 쓰기 필요)', 404: '저장소/경로를 찾지 못했어요 (404)', 409: '다른 곳에서 먼저 수정됐어요. 다시 시도해주세요 (409)', 422: '요청이 거부됐어요 (422)' }[s] || `GitHub 오류 (${s})`);
  }
};
