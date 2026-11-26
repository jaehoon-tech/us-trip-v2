const Schedule = {
  selected: new Set(['all']),

  mapUrl(p) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address || p.name)}`; },
  routeUrl(places) {
    const pts = places.filter(p => p.lat != null && p.lng != null).filter((p, i, a) => i === 0 || p.lat !== a[i - 1].lat || p.lng !== a[i - 1].lng);
    if (pts.length < 2) return pts[0] ? `https://www.google.com/maps/search/?api=1&query=${pts[0].lat},${pts[0].lng}` : '#';
    return 'https://www.google.com/maps/dir/' + pts.map(p => `${p.lat},${p.lng}`).join('/');
  },

  renderFilters() {
    const bar = $('filter-bar');
    const t = this.todayDay();
    const md = d => { const t = Store.dateText(d.date); return t.replace('(', ' ').replace(')', ''); };
    bar.innerHTML = '<div class="chip" data-day="all">전체</div>' + (t ? `<div class="chip chip-today" data-day="${t}">📍 오늘</div>` : '') +
      Store.trip.days.map(d => `<div class="chip" data-day="${d.id}"><b>D${d.id}</b> ${md(d)}</div>`).join('');
    this.syncChips();
  },
  syncChips() {
    document.querySelectorAll('#filter-bar .chip').forEach(c => {
      const k = c.dataset.day === 'all' ? 'all' : Number(c.dataset.day);
      c.classList.toggle('active', this.selected.has(k));
    });
  },
  toggleDay(key) {
    if (key === 'all') { this.selected = new Set(['all']); }
    else {
      this.selected.delete('all');
      if (this.selected.has(key)) this.selected.delete(key); else this.selected.add(key);
      if (!this.selected.size) this.selected.add('all');
    }
    this.syncChips(); this.applyFilter(); MapView.update();
  },
  todayDay() {
    const n = Clock.now(), ymd = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    const d = Store.trip.days.find(x => x.date === ymd);
    return d ? d.id : null;
  },
  toggleCollapse(id) { const c = $('card-day-' + id); if (c) c.classList.toggle('collapsed'); },
  isVisible(id) { return this.selected.has('all') || this.selected.has(id); },
  applyFilter() {
    Store.trip.days.forEach(d => {
      const c = $('card-day-' + d.id);
      if (c) c.classList.toggle('hidden', !this.isVisible(d.id));
    });
  },

  render() {
    $('schedule-container').innerHTML = Store.trip.days.map(day => {
      const places = Store.getPlaces(day.id);
      const items = places.map((p, idx) => `
        <div class="timeline-item" data-pid="${esc(p.id)}">
          <div class="timeline-number">${p.type === 'sleep' ? '🏠' : idx + 1}</div>
          <div class="timeline-content"><div class="timeline-info">
            <div class="timeline-title">${p.time ? `<span class="tl-time">${esc(p.time)}</span> ` : ''}${Edit.typeIcon(p.type)}${esc(p.name)}</div>
            ${p.desc ? `<div class="timeline-desc">${esc(p.desc)}</div>` : ''}
            ${p.warn ? `<div class="tl-warn">⚠️ ${esc(p.warn)}</div>` : ''}
            ${p.address ? `<div class="timeline-addr">${esc(p.address)}${p.approx ? ' <i class="approx">(대략 위치)</i>' : ''}</div>` : ''}
            <div class="tl-btns">
              <a class="btn-gmap" href="${esc(this.mapUrl(p))}" target="_blank" rel="noopener">📍 맵 보기</a>
              ${p.address ? `<button class="btn-copy" data-action="copy" data-text="${esc(p.address)}">📋 주소</button>` : ''}
              ${p.bookingId && Store.booking(p.bookingId) ? `<button class="btn-copy bk-link" data-action="bk-go" data-id="${esc(p.bookingId)}">🎫 예약</button>` : ''}
              ${flightLinks(p.name + ' ' + p.desc)}
              <span class="edit-only">
                <span class="drag-h" data-day="${day.id}" title="길게 눌러 끌어서 순서 변경">⠿</span>
                <button class="btn-copy" data-action="sch-up" data-day="${day.id}" data-id="${esc(p.id)}">▲</button>
                <button class="btn-copy" data-action="sch-down" data-day="${day.id}" data-id="${esc(p.id)}">▼</button>
                <button class="btn-copy" data-action="sch-edit" data-day="${day.id}" data-id="${esc(p.id)}">✏️ 수정</button>
              </span>
            </div>
          </div></div>
          ${idx < places.length - 1 && p.nextDist ? `<div class="timeline-distance">🚗 ${esc(p.nextDist)}</div>` : ''}
        </div>`).join('');
      return `<div class="day-card ${this.isVisible(day.id) ? '' : 'hidden'}" id="card-day-${day.id}">
        <div class="day-header">
          <div class="day-title" data-action="day-fold" data-day="${day.id}" style="color:${esc(day.color)}"><span class="day-date">${esc(Store.dateText(day.date))}</span> ${esc(day.title)} <span class="fold-ico">▾</span></div>
          <span style="display:flex;gap:6px;align-items:center;">
            <button class="btn-copy edit-only" data-action="day-edit" data-day="${day.id}">✏️</button>
            <a href="${esc(this.routeUrl(places))}" target="_blank" rel="noopener" class="btn-route" style="color:${esc(day.color)}; border-color:${esc(day.color)};">당일 길찾기</a>
          </span>
        </div>
        ${day.driveInfo ? `<div class="drive-badge">🛣️ ${esc(day.driveInfo)}</div>` : ''}
        <div class="timeline">${items}</div>
        <button class="btn-add-item edit-only" data-action="sch-add" data-day="${day.id}">+ 장소 추가하기</button>
      </div>`;
    }).join('');
    if (typeof Live !== 'undefined') Live.update();
  }
};
