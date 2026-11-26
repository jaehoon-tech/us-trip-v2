const Bookings = {
  ICON: { flight: '✈️', car: '🚗', stay: '🏨', other: '🎫' },
  LABEL: { flight: '항공', car: '렌터카', stay: '숙소', other: '기타' },
  fmt(n) { return '$' + Number(n).toFixed(2); },
  render() {
    const list = Store.trip.bookings || [];
    const order = ['flight', 'car', 'stay', 'other'];
    let html = '';
    order.forEach(t => {
      const items = list.filter(b => b.type === t);
      if (!items.length) return;
      html += `<h3 class="bk-group">${this.ICON[t]} ${this.LABEL[t]}</h3>` + items.map(b => this.card(b)).join('');
    });
    $('bookings-area').innerHTML = this.summary(list) + (html || '<div class="empty-msg">등록된 예약이 없어요.</div>');
  },
  nights(b) { const a = /^(\d{4}-\d{2}-\d{2})/.exec(b.checkIn || ''), z = /^(\d{4}-\d{2}-\d{2})/.exec(b.checkOut || ''); return a && z ? Math.round((new Date(z[1]) - new Date(a[1])) / 86400000) : 0; },
  summary(list) {
    const sum = t => list.filter(b => b.type === t && b.id !== 'b_flight_in').reduce((s, b) => s + (b.amount || 0), 0);
    const stays = list.filter(b => b.type === 'stay'), n = stays.reduce((s, b) => s + this.nights(b), 0);
    const stay$ = sum('stay'), car$ = sum('car'), fl$ = sum('flight'), tot = stay$ + car$ + fl$;
    // 숙박 커버리지 점검
    const cover = {}; stays.forEach(b => { const a = new Date((b.checkIn || '').slice(0, 10)), z = new Date((b.checkOut || '').slice(0, 10)); if (isNaN(a) || isNaN(z)) return; for (let d = new Date(a); d < z; d.setDate(d.getDate() + 1)) { const k = d.toISOString().slice(0, 10); cover[k] = (cover[k] || 0) + 1; } });
    const first = Store.trip.meta.tripStart, last = Store.trip.meta.lastNight || Store.trip.meta.tripEnd, miss = [], dup = [];
    for (let d = new Date(first); d <= new Date(last); d.setDate(d.getDate() + 1)) { const k = d.toISOString().slice(0, 10); if (!cover[k]) miss.push(k); else if (cover[k] > 1) dup.push(k); }
    const need = Math.round((new Date(last) - new Date(first)) / 86400000) + 1;
    const chk = miss.length || dup.length ? `<div class="tl-warn">⚠️ ${miss.length ? '숙소 없는 날: ' + miss.map(k => Store.dateText(k)).join(', ') : ''}${dup.length ? ' 중복 예약: ' + dup.map(k => Store.dateText(k)).join(', ') : ''}</div>` : `<div class="bk-ok">✅ ${need}박 모두 숙소 확정</div>`;
    return `<div class="bk-summary"><div class="bk-sum-title">📊 예약 요약 <small>(인천 왕복 항공 제외)</small></div>
      <div class="bk-sum-grid"><div><span>🏨 숙박 ${n}박</span><b>${this.fmt(stay$)}</b><small>1박 평균 ${n ? this.fmt(stay$ / n) : '-'}</small></div>
      <div><span>🚗 렌터카</span><b>${this.fmt(car$)}</b></div><div><span>✈️ 국내선</span><b>${this.fmt(fl$)}</b></div>
      <div class="tot"><span>합계</span><b>${this.fmt(tot)}</b></div></div>${chk}</div>`;
  },
  card(b) {
    const when = [Store.dtText(b.checkIn || b.date), Store.dtText(b.checkOut)].filter(Boolean).join(' → ') + (b.time ? ` (${b.time})` : '');
    const bd = b.breakdown && b.breakdown.length ? `<div class="bk-bd">${b.breakdown.map(x => `${esc(x.label)} ${this.fmt(x.amount)}`).join(' + ')}</div>` : '';
    return `<div class="bk-card" id="bk-${esc(b.id)}">
      <div class="bk-top"><div class="bk-title">${esc(b.title)}</div>${b.amount != null ? `<div class="bk-amt">${this.fmt(b.amount)}</div>` : ''}</div>
      ${b.site ? `<div class="bk-sub">${esc(b.site)}${b.amountNote ? ' · ' + esc(b.amountNote) : ''}</div>` : (b.amountNote ? `<div class="bk-sub">${esc(b.amountNote)}</div>` : '')}
      ${bd}
      ${when ? `<div class="bk-row">🗓️ ${esc(when)}</div>` : ''}
      ${b.address ? `<div class="bk-row">📍 ${esc(b.address)} <button class="btn-copy" data-action="copy" data-text="${esc(b.address)}">복사</button> <a class="btn-gmap" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}">맵</a></div>` : ''}
      ${b.confirmation ? `<div class="bk-row">🔖 <b>${esc(b.confirmation)}</b> <button class="btn-copy" data-action="copy" data-text="${esc(b.confirmation)}">복사</button></div>` : ''}
      ${b.phone ? `<div class="bk-row">📞 <a href="tel:${esc(b.phone.replace(/[^+\d]/g, ''))}">${esc(b.phone)}</a></div>` : ''}
      ${b.cancelDeadline ? `<div class="bk-row">⏰ 취소 기한: ${esc(Store.dtText(b.cancelDeadline))}${this.dLeft(b.cancelDeadline)}</div>` : ''}
      ${b.type === 'flight' && flightLinks(b.title) ? `<div class="bk-row">${flightLinks(b.title)}</div>` : ''}
      ${b.warn ? `<div class="tl-warn">⚠️ ${esc(b.warn)}</div>` : ''}
      ${b.note ? `<div class="bk-note">${esc(b.note)}</div>` : ''}
      ${Edit.isEditor && Private.get(b.id) ? `<div class="bk-private">🔒 <span>${esc(Private.get(b.id))}</span><button class="btn-copy" data-action="copy" data-text="${esc(Private.get(b.id))}">복사</button></div>` : ''}
      <div class="edit-only bk-edit"><button class="btn-copy" data-action="bk-edit" data-id="${esc(b.id)}">✏️ 수정</button></div>
    </div>`;
  },
  dLeft(s) {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(s || ''); if (!m) return '';
    const n = Math.ceil((new Date(m[1] + 'T23:59:59') - Date.now()) / 86400000);
    return n < 0 ? ' <b class="late">마감 지남</b>' : ` <b class="${n <= 7 ? 'late' : 'ok'}">D-${n}</b>`;
  },
  go(id) {
    switchTab('bookings');
    setTimeout(() => { const el = $('bk-' + id); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); } }, 80);
  }
};
