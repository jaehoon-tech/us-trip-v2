function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
  $('view-' + tab).classList.add('active');
  $('view-' + tab).scrollTop = 0;
  document.body.classList.toggle('tab-expense', tab === 'expense');
  $('filter-bar-container').style.display = (tab === 'schedule' || tab === 'map') ? 'flex' : 'none';
  if (tab === 'map') MapView.onShow();
}

function updateDday() {
  const diff = new Date(Store.trip.meta.departure).getTime() - Clock.now().getTime();
  const b = $('dday-banner');
  if (diff < 0) {
    const t = Schedule.todayDay(), end = new Date(Store.trip.meta.tripEnd + 'T23:59:59');
    if (Clock.now() > end) { b.textContent = '🏁 금쪽이들의 세계정복, 무사히 완료!'; return; }
    b.innerHTML = t ? `🇺🇸 여행 <span style="font-size:22px;font-weight:900;">${t}일차</span> · ${esc(Store.day(t).title.split('|')[1] || '')}` : '✈️ 미국 서부 여행 중! 안전하고 즐거운 여행 되세요!';
    return;
  }
  const d = Math.floor(diff / 86400000), h = Math.floor(diff % 86400000 / 3600000);
  b.innerHTML = `금쪽이들 미국여행까지 <span style="font-size:22px;font-weight:900;">D-${d}일 ${String(h).padStart(2, '0')}시간</span>!`;
}

async function onAddOk() {
  const v1 = $('add-input-1').value.trim(), addr = $('add-input-addr').value.trim(), v2 = $('add-input-2').value.trim();
  if (!v1) return showToast('내용을 입력해주세요.');
  const t = addModal.type;
  if (t === 'checklist') Checklist.confirmAdd(v1);
}

// 모든 클릭을 data-action 으로 위임 (inline onclick 제거 → 따옴표/XSS 문제 해결)
document.addEventListener('click', e => {
  const chip = e.target.closest('#filter-bar .chip');
  if (chip) return Schedule.toggleDay(chip.dataset.day === 'all' ? 'all' : Number(chip.dataset.day));
  const nav = e.target.closest('.nav-item');
  if (nav) return switchTab(nav.dataset.tab);
  const sb = e.target.closest('[data-sbtn]');
  if (sb && Sheet.cfg) {
    const k = sb.dataset.sbtn, vals = Sheet.values();
    if (k === 'save') Sheet.cfg.onSave(vals); else Sheet.cfg.buttons[Number(k)].fn(vals);
    return;
  }
  if (e.target.closest('#sheet-x') || e.target.id === 'sheet') return Sheet.close();
  if (e.target.closest('#btn-edit')) return Edit.toggle();
  if (e.target.closest('#edit-done')) return Edit.toggle();
  if (e.target.closest('#edit-reset')) return Edit.reset();
  if (e.target.closest('#edit-publish')) return Publish.run();
  if (e.target.closest('#edit-settings')) return Publish.settings();
  if (e.target.closest('#btn-theme')) return Theme.toggle();
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const d = el.dataset;
  switch (d.action) {
    case 'copy': copyText(d.text); break;
    case 'sch-add': Shared.enabled ? Shared.needMe(() => Edit.placeSheet(Number(d.day), null)) : Edit.placeSheet(Number(d.day), null); break;
    case 'sch-edit': Edit.placeSheet(Number(d.day), d.id); break;
    case 'sch-up': Edit.movePlace(Number(d.day), d.id, -1); break;
    case 'sch-down': Edit.movePlace(Number(d.day), d.id, 1); break;
    case 'day-edit': Edit.daySheet(Number(d.day)); break;
    case 'bk-go': Bookings.go(d.id); break;
    case 'bk-add': Edit.bookingSheet(null); break;
    case 'bk-edit': Edit.bookingSheet(d.id); break;
    case 'chk-add': Shared.enabled ? Shared.needMe(() => Checklist.add(Number(d.g))) : Checklist.add(Number(d.g)); break;
    case 'chk-del': Checklist.remove(Number(d.g), d.id); break;
    case 'photo-close': $('photo-view').style.display = 'none'; break;
    case 'exp-receipt': Receipts.show(d.id); break;
    case 'exp-copy': Expense.copySummary(); break;
    case 'exp-add': Shared.enabled ? Shared.needMe(() => Expense.sheet(null)) : Expense.sheet(null); break;
    case 'exp-edit': Expense.openEdit(d.id); break;
    case 'day-fold': Schedule.toggleCollapse(Number(d.day)); break;
  }
});
document.addEventListener('change', e => {
  if (e.target.dataset.action === 'chk-toggle') Checklist.toggle(e.target.dataset.id, e.target.checked);
  if (e.target.dataset.action === 'exp-settle') Expense.settle(e.target.dataset.id, e.target.checked);
});

async function boot() {
  $('confirm-ok').onclick = () => closeConfirm(true);
  $('confirm-cancel').onclick = () => closeConfirm(false);
  $('add-ok').onclick = onAddOk;
  $('add-cancel').onclick = closeAddModal;
  $('add-input-1').addEventListener('keydown', e => { if (e.key === 'Enter') onAddOk(); });

  try { await Store.load(); }
  catch (e) {
    $('dday-banner').textContent = '⚠️ 일정 데이터를 불러오지 못했어요';
    $('schedule-container').innerHTML = '<div class="empty-msg">data/trip.json 을 확인해주세요.<br>(file:// 로 열면 안 되고 웹서버/GitHub Pages 로 열어야 해요)</div>';
    return;
  }
  Theme.init(); Edit.init(); Clock.init(); await Receipts.init();
  if (Schedule.todayDay()) Schedule.selected = new Set([Schedule.todayDay()]);
  Schedule.renderFilters(); Schedule.render(); Bookings.render();
  Checklist.render(); Expense.init(); Expense.render();
  if (Store.discarded) showToast('원본 데이터가 새로 업데이트되어 임시 수정본을 정리했어요');
  updateDday(); setInterval(updateDday, 60000);
  Weather.load(); Fx.load(); Tip.init(); Drag.init(); Shared.init();
  setInterval(() => Live.update(), 60000);
  MapView.load();
  registerSW();
  const off = () => $('offline-bar').style.display = navigator.onLine ? 'none' : 'block';
  addEventListener('online', off); addEventListener('offline', off); off();
}

function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https?:/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showToast('🔄 새 버전이 준비됐어요. 앱을 닫았다 다시 열어주세요'); });
    });
  }).catch(() => {});
}
boot();
