// 공용 유틸: 이스케이프, 토스트, 확인창, 입력 모달
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function showToast(msg) {
  const t = $('toast-msg');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.style.display = 'none', 2000);
}

function copyText(text) {
  const done = () => showToast('복사되었습니다! ✅');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done, () => legacyCopy(text, done));
  } else legacyCopy(text, done);
}
function legacyCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta); cb();
}

// 확인 모달
let confirmAction = null;
function showConfirm(msg, action) {
  $('confirm-msg').textContent = msg;
  $('custom-confirm').style.display = 'flex';
  confirmAction = action;
}
function closeConfirm(ok) {
  $('custom-confirm').style.display = 'none';
  const a = confirmAction; confirmAction = null;
  if (ok && a) a();
}

// 입력 모달 (일정 추가 / 주소 수정 / 준비물 추가 공용)
let addModal = { type: null, ctx: null };
function openAddModal({ title, placeholder1, placeholder2, type, ctx, showAddr }) {
  $('add-modal-title').textContent = title;
  const i1 = $('add-input-1'), ia = $('add-input-addr'), i2 = $('add-input-2');
  i1.placeholder = placeholder1; i1.value = '';
  ia.style.display = showAddr ? 'block' : 'none'; ia.value = '';
  i2.style.display = placeholder2 ? 'block' : 'none';
  if (placeholder2) { i2.placeholder = placeholder2; i2.value = ''; }
  addModal = { type, ctx };
  $('geocoding-loader').style.display = 'none';
  $('add-modal').style.display = 'flex';
  setTimeout(() => i1.focus(), 50);
}
function closeAddModal() {
  $('add-modal').style.display = 'none';
  $('geocoding-loader').style.display = 'none';
}

function geocode(query) {
  return new Promise(resolve => {
    if (!(window.google && google.maps && google.maps.Geocoder)) return resolve(null);
    new google.maps.Geocoder().geocode({ address: query }, (r, status) => {
      if (status === 'OK' && r[0]) {
        resolve({ lat: r[0].geometry.location.lat(), lng: r[0].geometry.location.lng(), address: r[0].formatted_address });
      } else resolve(null);
    });
  });
}
