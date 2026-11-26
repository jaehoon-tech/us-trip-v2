// 정산: 결제자 기반 최소 송금 계산 / 정산완료 제외 / 카테고리 통계
const Expense = {
  syncRate() {
    const i = $('exp-rate'); if (document.activeElement !== i) i.value = this.rate();
    const m = Store.trip.meta, auto = !this.localRate && !m.rateManual && Fx.rate;
    $('exp-rate-note').textContent = auto ? '실시간 환율 (카드 수수료 별도) · 비우면 자동' : '수동 입력값 · 비우면 자동';
  },
  fmt(n) { return '$' + n.toFixed(2); },
  rate() { const m = Store.trip.meta; return this.localRate || (m.rateManual ? m.rate : (Fx.rate || m.rate)) || 1400; },
  cats() { return Store.trip.meta.categories; },
  icon(c) { const f = this.cats().find(x => x[0] === c); return f ? f[1] : '📦'; },

  init() {
    const days = Store.trip.days.map(d => `<option value="${d.id}일차">${Store.dayText(d.id)}</option>`).join('');
    $('exp-f-cat').innerHTML = '<option value="all">카테고리 전체</option>' + this.cats().map(([c]) => `<option>${esc(c)}</option>`).join('');
    $('exp-f-day').innerHTML = '<option value="all">일차 전체</option>' + days;
    ['exp-f-cat', 'exp-f-day', 'exp-f-state', 'exp-f-sort'].forEach(id => $(id).onchange = () => this.renderList());
    this.syncRate();
    $('exp-rate').onchange = e => {
      const v = parseFloat(e.target.value);
      if (Edit.isEditor) { if (v > 0) { Store.trip.meta.rate = v; Store.trip.meta.rateManual = true; } else delete Store.trip.meta.rateManual; Store.save(); }
      else this.localRate = v > 0 ? v : null;
      this.render();
    };
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
    this.syncRate();
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
    let lastDay = null;
    const head = e => {
      if (so !== 'day' || e.day === lastDay) return '';
      lastDay = e.day;
      const sum = list.filter(x => x.day === e.day).reduce((a, x) => a + x.amount, 0);
      return `<div class="day-head"><span>${esc(Store.dayText(e.day))}</span><span>${this.fmt(sum)}</span></div>`;
    };
    $('exp-list').innerHTML = list.length ? list.map(e => head(e) + `
      <div class="exp-item ${e.settled ? 'settled' : ''}">
        <input type="checkbox" class="settle-chk" data-action="exp-settle" data-id="${esc(e.id)}" ${e.settled ? 'checked' : ''} ${(!e.shared && !Edit.isEditor) ? 'disabled' : ''} title="정산완료">
        <div class="exp-info" data-action="exp-edit" data-id="${esc(e.id)}">
          <div class="exp-name">${this.icon(e.category)} ${esc(e.category)} | ${esc(e.desc)}${Receipts.has(e.id) ? ` <span class="rcpt" data-action="exp-receipt" data-id="${esc(e.id)}">📎</span>` : ''}</div>
          <div class="exp-meta">${esc(Store.dayText(e.day))} · 💳 ${esc(e.payer)} · 👥 ${e.members.length === Store.trip.meta.members.length ? '전체' : esc(e.members.join(', '))}${e.note ? ' · ' + esc(e.note) : ''}${e.shared && e.by ? ' · ✍️ ' + esc(e.by) : ''}</div>
          ${e.breakdown && e.breakdown.length ? `<div class="exp-bd">${e.breakdown.map(x => `${esc(x.label)} ${this.fmt(x.amount)}`).join(' + ')}</div>` : ''}
        </div>
        <div class="exp-amount">${this.fmt(e.amount)}<small>≈${Math.round(e.amount * this.rate() / 10000 * 10) / 10}만</small></div>
      </div>`).join('') : '<div class="empty-msg">조건에 맞는 내역이 없어요.</div>';
  },

  // 지출 추가/수정 시트 (편집자 전용)
  sheet(id) {
    const sh = id && Shared.enabled ? Shared.cache.expenses[id] : null;
    const e = id ? (sh || Store.trip.expenses.find(x => String(x.id) === String(id))) : null;
    const isShared = !!sh || (!id && Shared.enabled);
    const canDel = e && (isShared ? Shared.mine(e) : Edit.isEditor);
    const members = Store.trip.meta.members;
    const today = Schedule.todayDay();
    Sheet.open({
      title: e ? '지출 수정' : '지출 추가',
      fields: [
        { key: 'amount', label: '금액 ($)', type: 'number', value: e ? e.amount : '', ph: '0.00', focus: !e },
        { key: 'desc', label: '내용', value: e ? e.desc : '', ph: '예: 인앤아웃 버거' },
        { key: 'category', label: '카테고리', type: 'select', value: e ? e.category : '식비', options: this.cats().map(([c, i]) => ({ v: c, l: `${i} ${c}` })) },
        { key: 'day', label: '일차', type: 'select', value: e ? e.day : (today ? today + '일차' : '1일차'), options: Store.trip.days.map(d => ({ v: d.id + '일차', l: Store.dayText(d.id) })) },
        { key: 'payer', label: '결제한 사람', type: 'select', value: e ? e.payer : (Shared.enabled && Shared.me ? Shared.me : LS.get('usTripLastPayer', members[0])), options: members.map(m => ({ v: m, l: m })) },
        { key: 'members', label: '정산 포함 인원', type: 'checks', options: members, value: e ? e.members : members },
        { key: 'receipt', label: '📷 영수증 사진 (이 기기에만 저장, 공개 안 됨)', type: 'file' }
      ],
      buttons: [
        ...(e && Receipts.has(e.id) ? [{ label: '사진 삭제', fn: async () => { await Receipts.del(e.id); Sheet.close(); this.render(); showToast('사진을 지웠어요'); } }] : []),
        ...(canDel ? [{ label: '삭제', cls: 'mbtn-red', fn: () => { Sheet.close(); this.remove(e.id); } }] : [])
      ],
      onSave: async v => {
        const amount = parseFloat(v.amount);
        if (!v.desc || isNaN(amount) || amount <= 0) return showToast('내용과 올바른 금액을 입력해주세요.');
        if (!v.members.length) return showToast('정산 포함 인원을 1명 이상 선택해주세요.');
        const data = { day: v.day, category: v.category, desc: v.desc, amount, payer: v.payer, members: v.members };
        if (isShared) {
          const rid = e ? e.id : Shared.newId('x_');
          Shared.put('expenses', rid, { ...(e || {}), ...data, settled: e ? !!e.settled : false, by: e ? e.by : Shared.me });
          if (v.receipt) { try { await Receipts.put(rid, await Receipts.shrink(v.receipt)); } catch (x) { showToast('⚠️ 사진 저장 실패'); } }
          LS.set('usTripLastPayer', v.payer); Sheet.close(); this.render(); showToast(e ? '수정되었습니다' : '지출이 등록되었어요 · 모두에게 보여요 ✅');
          return;
        }
        if (e) { Object.assign(e, data); }
        let rid = e && e.id;
        if (!e) { rid = 'x_' + Date.now(); Store.trip.expenses.push({ id: rid, settled: false, ...data }); }
        if (v.receipt) { try { await Receipts.put(rid, await Receipts.shrink(v.receipt)); } catch (x) { showToast('⚠️ 사진 저장 실패'); } }
        LS.set('usTripLastPayer', v.payer);
        Store.save(); Sheet.close(); this.render(); showToast(e ? '수정되었습니다' : '지출이 등록되었습니다 ✅');
      }
    });
  },
  copySummary() {
    const open = Store.allExpenses().filter(e => !e.settled), r = this.compute(open);
    const lines = ['💸 금쪽이 정산 (미정산 기준)', `정산 대상 합계 $${open.reduce((s, e) => s + e.amount, 0).toFixed(2)} (≈${Math.round(open.reduce((s, e) => s + e.amount, 0) * this.rate() / 10000)}만원)`, ''];
    if (r.tr.length) r.tr.forEach(t => lines.push(`${t.from} ➔ ${t.to}  $${t.amt.toFixed(2)} (≈${Math.round(t.amt * this.rate()).toLocaleString()}원)`)); else lines.push('송금할 내역 없음 🎉');
    copyText(lines.join('\n'));
  },
  openEdit(id) {
    const sh = Shared.enabled ? Shared.cache.expenses[id] : null;
    if (sh ? !Shared.mine(sh) : !Edit.isEditor) return showToast(sh ? '추가한 사람만 수정할 수 있어요' : '편집자만 수정할 수 있어요');
    this.sheet(id);
  },
  settle(id, v) {
    const sh = Shared.enabled ? Shared.cache.expenses[id] : null;
    if (sh) { Shared.put('expenses', id, { ...sh, settled: v }); this.render(); return; }
    if (!Edit.isEditor) { this.render(); return showToast('편집자만 바꿀 수 있어요'); }
    const e = Store.trip.expenses.find(x => String(x.id) === String(id)); if (e) { e.settled = v; Store.save(); } this.render();
  },
  remove(id) {
    const sh = Shared.enabled ? Shared.cache.expenses[id] : null;
    if (sh) {
      if (!Shared.mine(sh)) return showToast('추가한 사람만 삭제할 수 있어요');
      return showConfirm('이 지출 내역을 삭제하시겠습니까? (모두에게서 사라져요)', () => { Shared.del('expenses', id); this.render(); });
    }
    showConfirm('이 지출 내역을 삭제하시겠습니까?', () => {
      Store.trip.expenses = Store.trip.expenses.filter(e => String(e.id) !== String(id));
      Store.save(); this.render();
    });
  }
};
