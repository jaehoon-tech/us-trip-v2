const Checklist = {
  render() {
    $('checklist-render-area').innerHTML = Store.trip.checklist.map((g, gi) => `
      <div class="checklist-group"><h3>${esc(g.category)} <span class="chk-prog">${g.items.filter(i => Store.isChecked(i.id)).length}/${g.items.length}</span></h3>
        ${g.items.map(item => `
        <div class="check-item">
          <input type="checkbox" id="${esc(item.id)}" data-action="chk-toggle" data-id="${esc(item.id)}" ${Store.isChecked(item.id) ? 'checked' : ''}>
          <label for="${esc(item.id)}">${esc(item.label)}</label>
          <button class="btn-del-item edit-only" data-action="chk-del" data-g="${gi}" data-id="${esc(item.id)}" title="삭제">-</button>
        </div>`).join('')}
        <button class="btn-add-item edit-only" data-action="chk-add" data-g="${gi}">+ ${esc(g.category)} 항목 추가</button>
      </div>`).join('');
  },
  toggle(id, v) { Store.setChecked(id, v); this.render(); },
  add(gi) { openAddModal({ title: '준비물 추가', placeholder1: '준비물 이름 (예: 선크림)', type: 'checklist', ctx: gi }); },
  remove(gi, id) {
    showConfirm('이 준비물을 목록에서 삭제할까요?', () => {
      const g = Store.trip.checklist[gi]; g.items = g.items.filter(i => i.id !== id);
      Store.save(); localStorage.removeItem(id); this.render();
    });
  },
  confirmAdd(label) {
    Store.trip.checklist[addModal.ctx].items.push({ id: 'chk_' + Date.now(), label });
    Store.save(); this.render(); showToast('준비물이 추가되었습니다.'); closeAddModal();
  }
};
