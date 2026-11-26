// 정산: 결제자 기반 최소 송금 계산 / 정산완료 제외 / 카테고리 통계
const Expense = {
  fmt(n) { return '$' + n.toFixed(2); },
  rate() { return this.localRate || Store.trip.meta.rate || 1400; },
  cats() { return Store.trip.meta.categories; },
  icon(c) { const f = this.cats().find(x => x[0] === c); return f ? f[1] : '📦'; },

  init() {
    const days = Store.trip.days.map(d => `<option value="${d.id}일차">${d.id}일차</option>`).join('');
    $('exp-f-cat').innerHTML = '<option value="all">카테고리 전체</option>' + this.cats().map(([c]) => `<option>${esc(c)}</option>`).join('');
    $('exp-f-day').innerHTML = '<option value="all">일차 전체</option>' + days;
    ['exp-f-cat', 'exp-f-day', 'exp-f-state', 'exp-f-sort'].forEach(id => $(id).onchange = () => this.renderList());
    $('exp-rate').value = this.rate();
    $('exp-rate').onchange = e => { const v = parseFloat(e.target.value); if (!(v > 0)) return; if (Edit.isEditor) { Store.trip.meta.rate = v; Store.save(); } else this.localRate = v; this.render(); };
  },

  // 정산 대상(미정산) 지출로 순잔액 계산 → 최소 송금
  compute(list) {
    const bal = Object.fromEntries(Store.trip.meta.members.map(m => [m, 0]));
    const paid = { ...bal }, owe = { ...bal };
    list.forEach(e => {
      if (!e.members || !e.members.length) return;
      const share = e.amount / e.members.length;
      if (e.payer in bal) { bal[e.payer] += e.amount; paid[e.payer] += e.amount; }
      e.members.forEach(m => { if (m in bal) { bal[m] -= share; owe[m] += share; } });
    });
    const cr = [], de = [];
    Object.entries(bal).forEach(([n, v]) => { const c = Math.round(v * 100); if (c > 0) cr.push([n, c]); else if (c < 0) de.push([n, -c]); });
    cr.sort((a, b) => b[1] - a[1]); de.sort((a, b) => b[1] - a[1]);
    const tr = []; let i = 0, j = 0;
    while (i < de.length && j < cr.length) {
      const amt = Math.min(de[i][1], cr[j][1]);
      tr.push({ from: de[i][0], to: cr[j][0], amt: amt / 100 });
      de[i][1] -= amt; cr[j][1] -= amt;
      if (!de[i][1]) i++; if (!cr[j][1]) j++;
    }
    return { bal, paid, owe, tr };
  },

  render() {
    const all = Store.allExpenses();
    const open = all.filter(e => !e.settled);
    const total = all.reduce((s, e) => s + e.amount, 0);
    const remain = open.reduce((s, e) => s + e.amount, 0);
    $('exp-total').textContent = total.toFixed(2);
    $('exp-total-krw').textContent = `≈ ${Math.round(total * this.rate() / 10000).toLocaleString()}만원`;
    $('exp-settled').textContent = this.fmt(total - remain);
    $('exp-remain').textContent = this.fmt(remain);

    const r = this.compute(open);
    $('exp-transfers').innerHTML = r.tr.length
      ? r.tr.map(t => `<div class="tr-row"><b>${esc(t.from)}</b> ➔ <b>${esc(t.to)}</b><span>${this.fmt(t.amt)} <small>(≈${Math.round(t.amt * this.rate()).toLocaleString()}원)</small></span></div>`).join('')
      : '<div class="empty-msg">송금할 내역이 없어요 🎉</div>';
    $('exp-person-table').innerHTML = `<table class="p-table"><tr><th></th><th>결제한 돈</th><th>내 부담</th><th>차액</th></tr>` +
      Object.keys(r.bal).map(n => { const b = r.bal[n]; return `<tr><td>${esc(n)}</td><td>${this.fmt(r.paid[n])}</td><td>${this.fmt(r.owe[n])}</td><td class="${b >= 0 ? 'pos' : 'neg'}">${b >= 0 ? '+' : '-'}${this.fmt(Math.abs(b))}</td></tr>`; }).join('') + '</table>';

    // 카테고리 통계 (정산완료 포함 전체 지출 기준)
    const byCat = {}; all.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + e.amount);
    $('exp-categories').innerHTML = this.cats().map(([c, i]) => {
      const v = byCat[c] || 0, pct = total ? v / total * 100 : 0;
      return `<div class="cat-row"><div class="cat-top"><span>${i} ${esc(c)}</span><b>${this.fmt(v)} <small>${pct.toFixed(0)}%</small></b></div><div class="cat-bar"><i style="width:${pct}%"></i></div></div>`;
    }).join('');
    this.renderList();
  },

  renderList() {
    const fc = $('exp-f-cat').value, fd = $('exp-f-day').value, fs = $('exp-f-state').value, so = $('exp-f-sort').value;
    let list = Store.allExpenses().filter(e =>
      (fc === 'all' || e.category === fc) && (fd === 'all' || e.day === fd) &&
      (fs === 'all' || (fs === 'done') === e.settled));
    const dn = e => parseInt(e.day) || 0;
    list.sort((a, b) => so === 'day' ? dn(a) - dn(b) || a._i - b._i : b._i - a._i);
    $('exp-list').innerHTML = list.length ? list.map(e => `
      <div class="exp-item ${e.settled ? 'settled' : ''}">
        <input type="checkbox" class="settle-chk" data-action="exp-settle" data-id="${esc(e.id)}" ${e.settled ? 'checked' : ''} title="정산완료">
        <div class="exp-info" data-action="exp-edit" data-id="${esc(e.id)}">
          <div class="exp-name">${this.icon(e.category)} ${esc(e.category)} | ${esc(e.desc)}</div>
          <div class="exp-meta">${esc(e.day)} · 💳 ${esc(e.payer)} · 👥 ${e.members.length === Store.trip.meta.members.length ? '전체' : esc(e.members.join(', '))}${e.note ? ' · ' + esc(e.note) : ''}</div>
          ${e.breakdown && e.breakdown.length ? `<div class="exp-bd">${e.breakdown.map(x => `${esc(x.label)} ${this.fmt(x.amount)}`).join(' + ')}</div>` : ''}
        </div>
        <div class="exp-amount">${this.fmt(e.amount)}</div>
        
      </div>`).join('') : '<div class="empty-msg">조건에 맞는 내역이 없어요.</div>';
  },

  // 지출 추가/수정 시트 (편집자 전용)
  sheet(id) {
    const e = id ? Store.trip.expenses.find(x => String(x.id) === String(id)) : null;
    const members = Store.trip.meta.members;
    const today = Schedule.todayDay();
    Sheet.open({
      title: e ? '지출 수정' : '지출 추가',
      fields: [
        { key: 'amount', label: '금액 ($)', type: 'number', value: e ? e.amount : '', ph: '0.00', focus: !e },
        { key: 'desc', label: '내용', value: e ? e.desc : '', ph: '예: 인앤아웃 버거' },
        { key: 'category', label: '카테고리', type: 'select', value: e ? e.category : '식비', options: this.cats().map(([c, i]) => ({ v: c, l: `${i} ${c}` })) },
        { key: 'day', label: '일차', type: 'select', value: e ? e.day : (today ? today + '일차' : '1일차'), options: Store.trip.days.map(d => ({ v: d.id + '일차', l: d.label })) },
        { key: 'payer', label: '결제한 사람', type: 'select', value: e ? e.payer : (LS.get('usTripLastPayer', members[0])), options: members.map(m => ({ v: m, l: m })) },
        { key: 'members', label: '정산 포함 인원', type: 'checks', options: members, value: e ? e.members : members }
      ],
      buttons: e ? [{ label: '삭제', cls: 'mbtn-red', fn: () => { Sheet.close(); this.remove(e.id); } }] : [],
      onSave: v => {
        const amount = parseFloat(v.amount);
        if (!v.desc || isNaN(amount) || amount <= 0) return showToast('내용과 올바른 금액을 입력해주세요.');
        if (!v.members.length) return showToast('정산 포함 인원을 1명 이상 선택해주세요.');
        const data = { day: v.day, category: v.category, desc: v.desc, amount, payer: v.payer, members: v.members };
        if (e) { Object.assign(e, data); }
        else Store.trip.expenses.push({ id: 'x_' + Date.now(), settled: false, ...data });
        LS.set('usTripLastPayer', v.payer);
        Store.save(); Sheet.close(); this.render(); showToast(e ? '수정되었습니다' : '지출이 등록되었습니다 ✅');
      }
    });
  },
  settle(id, v) { const e = Store.trip.expenses.find(x => String(x.id) === String(id)); if (e) { e.settled = v; Store.save(); } this.render(); },
  remove(id) {
    showConfirm('이 지출 내역을 삭제하시겠습니까?', () => {
      Store.trip.expenses = Store.trip.expenses.filter(e => String(e.id) !== String(id));
      Store.save(); this.render();
    });
  }
};
