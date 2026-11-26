const Checklist = {
  render() {
    const sharedOn = typeof Shared !== 'undefined' && Shared.enabled;
    $('checklist-render-area').innerHTML = Store.trip.checklist.map((g, gi) => {
      const sh = sharedOn ? Shared.list('checklist').filter(x => Number(x.gi) === gi).sort((a, b) => (a.ts || 0) - (b.ts || 0)) : [];
      const items = [...g.items.map(i => ({ ...i })), ...sh.map(i => ({ ...i, shared: true }))];
      return `
      <div class="checklist-group"><h3>${esc(g.category)} <span class="chk-prog">${items.filter(i => Store.isChecked(i.id)).length}/${items.length}</span></h3>
        ${items.map(item => `
        <div class="check-item">
          <input type="checkbox" id="${esc(item.id)}" data-action="chk-toggle" data-id="${esc(item.id)}" ${Store.isChecked(item.id) ? 'checked' : ''}>
          <label for="${esc(item.id)}">${esc(item.label)}${item.shared && item.by ? ` <span class="by-chip">👤 ${esc(item.by)}</span>` : ''}</label>
          ${item.shared ? (Shared.mine(item) ? `<button class="btn-del-item" data-action="chk-del" data-g="${gi}" data-id="${esc(item.id)}" title="삭제">-</button>` : '')
            : `<button class="btn-del-item edit-only" data-action="chk-del" data-g="${gi}" data-id="${esc(item.id)}" title="삭제">-</button>`}
        </div>`).join('')}
        <button class="btn-add-item ${sharedOn ? '' : 'edit-only'}" data-action="chk-add" data-g="${gi}">+ ${esc(g.category)} 항목 추가</button>
      </div>`;
    }).join('');
  },
  toggle(id, v) { Store.setChecked(id, v); this.render(); },
  add(gi) { openAddModal({ title: '준비물 추가', placeholder1: '준비물 이름 (예: 선크림)', type: 'checklist', ctx: gi }); },
  remove(gi, id) {
    if (typeof Shared !== 'undefined' && Shared.enabled && Shared.cache.checklist[id]) {
      if (!Shared.mine(Shared.cache.checklist[id])) return showToast('추가한 사람만 삭제할 수 있어요');
      return showConfirm('이 준비물을 삭제할까요? (모두에게서 사라져요)', () => Shared.del('checklist', id));
    }
    showConfirm('이 준비물을 목록에서 삭제할까요?', () => {
      const g = Store.trip.checklist[gi]; g.items = g.items.filter(i => i.id !== id);
      Store.save(); localStorage.removeItem(id); this.render();
    });
  },
  confirmAdd(label) {
    if (typeof Shared !== 'undefined' && Shared.enabled) {
      Shared.put('checklist', Shared.newId('chk_'), { gi: addModal.ctx, label, by: Shared.me });
      showToast('준비물이 추가되었습니다 · 모두에게 보여요'); closeAddModal(); return;
    }
    Store.trip.checklist[addModal.ctx].items.push({ id: 'chk_' + Date.now(), label });
    Store.save(); this.render(); showToast('준비물이 추가되었습니다.'); closeAddModal();
  }
};
