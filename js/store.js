// 데이터 저장소
// - 기본 데이터: data/trip.json (GitHub Pages 에 올라간 공개본, 모두에게 동일)
// - 편집자(나) 기기: 수정하면 localStorage 초안(draft)에 저장. 다음 단계에서 "공개(GitHub 커밋)" 기능이 붙음
const LS = {
  get(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { showToast('⚠️ 저장 공간 오류'); }
  }
};

const Store = {
  DRAFT_KEY: 'usTripDraft',
  trip: null,
  hasDraft: false,

  async load() {
    const res = await fetch('data/trip.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('trip.json ' + res.status);
    const base = await res.json();
    const draft = LS.get(this.DRAFT_KEY, null);
    if (draft && draft.meta && draft.meta.version === base.meta.version) { this.trip = draft; this.hasDraft = true; }
    else {
      this.trip = base;
      if (draft) { localStorage.removeItem(this.DRAFT_KEY); this.discarded = true; } // 원본이 새 버전 → 옛 초안 폐기
    }
  },
  save() { LS.set(this.DRAFT_KEY, this.trip); this.hasDraft = true; if (window.Edit) Edit.refreshBar(); },
  resetDraft() { localStorage.removeItem(this.DRAFT_KEY); location.reload(); },

  day(id) { return this.trip.days.find(d => d.id === id); },
  getPlaces(dayId) { const d = this.day(dayId); return d ? d.places : []; },
  booking(id) { return (this.trip.bookings || []).find(b => b.id === id); },
  allExpenses() {
    const first = this.trip.meta.members[0];
    return (this.trip.expenses || []).map((e, i) => ({ ...e, _i: i, payer: e.payer || first, settled: !!e.settled }));
  },
  // 준비물 체크 상태는 사람마다 따로 (내 폰에만 저장)
  isChecked(id) { return localStorage.getItem(id) === 'true'; },
  setChecked(id, v) { try { localStorage.setItem(id, v); } catch (e) {} }
};
