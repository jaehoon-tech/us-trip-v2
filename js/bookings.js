const Bookings = {
  ICON: { flight: '✈️', car: '🚗', stay: '🏨', other: '🎫' },
  LABEL: { flight: '항공', car: '렌터카', stay: '숙소', other: '기타' },
  fmt(n) { return '$' + Number(n).toFixed(2); },
  render() {
    const list = Store.trip.bookings || [];
    const total = list.filter(b => b.type !== 'flight' || !b.payer).reduce((s, b) => s + (b.amount || 0), 0);
    const order = ['flight', 'car', 'stay', 'other'];
    let html = '';
    order.forEach(t => {
      const items = list.filter(b => b.type === t);
      if (!items.length) return;
      html += `<h3 class="bk-group">${this.ICON[t]} ${this.LABEL[t]}</h3>` + items.map(b => this.card(b)).join('');
    });
    $('bookings-area').innerHTML = html || '<div class="empty-msg">등록된 예약이 없어요.</div>';
  },
  card(b) {
    const when = [b.checkIn || b.date, b.checkOut].filter(Boolean).join(' → ') + (b.time ? ` (${b.time})` : '');
    const bd = b.breakdown && b.breakdown.length ? `<div class="bk-bd">${b.breakdown.map(x => `${esc(x.label)} ${this.fmt(x.amount)}`).join(' + ')}</div>` : '';
    return `<div class="bk-card" id="bk-${esc(b.id)}">
      <div class="bk-top"><div class="bk-title">${esc(b.title)}</div>${b.amount != null ? `<div class="bk-amt">${this.fmt(b.amount)}</div>` : ''}</div>
      ${b.site ? `<div class="bk-sub">${esc(b.site)}${b.amountNote ? ' · ' + esc(b.amountNote) : ''}</div>` : (b.amountNote ? `<div class="bk-sub">${esc(b.amountNote)}</div>` : '')}
      ${bd}
      ${when ? `<div class="bk-row">🗓️ ${esc(when)}</div>` : ''}
      ${b.address ? `<div class="bk-row">📍 ${esc(b.address)} <button class="btn-copy" data-action="copy" data-text="${esc(b.address)}">복사</button> <a class="btn-gmap" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}">맵</a></div>` : ''}
      ${b.confirmation ? `<div class="bk-row">🔖 <b>${esc(b.confirmation)}</b> <button class="btn-copy" data-action="copy" data-text="${esc(b.confirmation)}">복사</button></div>` : ''}
      ${b.phone ? `<div class="bk-row">📞 <a href="tel:${esc(b.phone.replace(/[^+\d]/g, ''))}">${esc(b.phone)}</a></div>` : ''}
      ${b.cancelDeadline ? `<div class="bk-row">⏰ 취소 기한: ${esc(b.cancelDeadline)}</div>` : ''}
      ${b.warn ? `<div class="tl-warn">⚠️ ${esc(b.warn)}</div>` : ''}
      ${b.note ? `<div class="bk-note">${esc(b.note)}</div>` : ''}
      ${Edit.isEditor && Private.get(b.id) ? `<div class="bk-private">🔒 <span>${esc(Private.get(b.id))}</span><button class="btn-copy" data-action="copy" data-text="${esc(Private.get(b.id))}">복사</button></div>` : ''}
      <div class="edit-only bk-edit"><button class="btn-copy" data-action="bk-edit" data-id="${esc(b.id)}">✏️ 수정</button></div>
    </div>`;
  },
  go(id) {
    switchTab('bookings');
    setTimeout(() => { const el = $('bk-' + id); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); } }, 80);
  }
};
