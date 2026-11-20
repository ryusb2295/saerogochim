(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./pricing.js'));
  else root.GageonCommerceStore = factory(root.GAGEON_PRICING);
})(globalThis, P => {
  const KEY = 'gageon-commerce-demo-v1';
  const id = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
  const clone = x => JSON.parse(JSON.stringify(x));
  const monthAfter = value => {
    const d = new Date(value), day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, end)); return d.toISOString();
  };
  const nextFirst = value => {
    const d = new Date(value); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, P.deliveryDay)).toISOString();
  };
  const settlement = amount => {
    if (!Number.isSafeInteger(amount) || amount < 0) throw Error('금액을 확인해주세요.');
    const platformFee = Math.round(amount * P.feeRate);
    return { amount, ownerFee: 0, platformFeeRate: P.feeRate, platformFee, printerPayout: amount - platformFee };
  };
  class Store {
    constructor(storage, clock = () => new Date()) { this.storage = storage; this.clock = clock; }
    now() { return this.clock().toISOString(); }
    read() {
      const raw = this.storage.getItem(KEY); if (!raw) return { accounts: {}, orders: {} };
      const d = JSON.parse(raw); if (!d.accounts || !d.orders) throw Error('시연 저장 정보를 확인해주세요.'); return d;
    }
    ledger(a, delta, reason, extra = {}) {
      a.tokenBalance += delta;
      a.ledger.unshift({ id: id(), userId: a.userId, delta, reason, createdAt: this.now(), ...extra });
    }
    account(d, user) {
      if (!user) throw Error('로그인 후 이용해주세요.');
      if (!d.accounts[user]) {
        const a = d.accounts[user] = { userId: user, tokenBalance: 0, plan: 'free', planRenewsAt: null, cancelAtRenewal: false, ledger: [], purchases: [], checkouts: [], recurring: [], suggestions: [], appliedDesigns: {} };
        this.ledger(a, P.plans.free.tokens, 'signup');
      }
      const a = d.accounts[user];
      if (a.plan !== 'free' && a.planRenewsAt <= this.now()) {
        if (a.cancelAtRenewal) { a.plan = 'free'; a.planRenewsAt = null; a.cancelAtRenewal = false; this.ledger(a, -a.tokenBalance, 'subscription', { note: '구독 종료 · 이월 없음' }); }
        else {
          const before = a.planRenewsAt;
          while (a.planRenewsAt <= this.now()) a.planRenewsAt = monthAfter(a.planRenewsAt);
          this.ledger(a, P.plans[a.plan].tokens - a.tokenBalance, 'subscription', { period: before, note: '월 한도 갱신 · 이월 없음' });
        }
      }
      return a;
    }
    transact(user, fn) {
      const d = this.read(), a = this.account(d, user), result = fn(a, d);
      this.storage.setItem(KEY, JSON.stringify(d)); return clone(result === undefined ? a : result);
    }
    get(user) { return this.transact(user, a => a); }
    spend(user, amount, reason) {
      if (!Number.isSafeInteger(amount) || amount < 0) throw Error('토큰 사용량을 확인해주세요.');
      return this.transact(user, a => {
        if (a.tokenBalance < amount) return { ok: false, balance: a.tokenBalance, required: amount };
        const reservation = id(); this.ledger(a, -amount, reason, { reservation }); return { ok: true, reservation, amount, userId: user };
      });
    }
    refund(user, reservation) {
      return this.transact(user, a => {
        const debit = a.ledger.find(x => x.reservation === reservation && x.delta < 0);
        if (!debit || a.ledger.some(x => x.refundOf === reservation)) return false;
        this.ledger(a, -debit.delta, debit.reason, { refundOf: reservation, note: '작업 실패로 반환' }); return true;
      });
    }
    subscribe(a, plan) {
      if (!P.plans[plan] || plan === 'free') throw Error('요금제를 확인해주세요.');
      a.plan = plan; a.planRenewsAt = monthAfter(this.now()); a.cancelAtRenewal = false;
      this.ledger(a, P.plans[plan].tokens - a.tokenBalance, 'subscription', { plan });
    }
    checkout(user, item, receipt) {
      if (!receipt?.startsWith('mock-')) throw Error('시연 결제 기록을 확인해주세요.');
      return this.transact(user, a => {
        if (a.checkouts.includes(receipt)) return a;
        if (item.kind === 'tokens') {
          const pack = P.tokenPacks[item.id]; if (!pack) throw Error('충전 상품을 확인해주세요.');
          this.ledger(a, pack.tokens, 'purchase', { receipt });
        } else if (item.kind === 'plan') this.subscribe(a, item.id);
        else if (item.kind === 'package') {
          const pkg = P.packages[item.id]; if (!pkg || !item.brandId) throw Error('브랜드 패키지를 확인해주세요.');
          const old = a.purchases.filter(p => p.brandId === item.brandId).sort((a, b) => P.packages[b.packageId].rank - P.packages[a.packageId].rank)[0];
          if (!old || P.packages[old.packageId].rank < pkg.rank) {
            a.purchases.push({ id: id(), userId: user, brandId: item.brandId, packageId: item.id, price: Math.max(0, pkg.price - (old ? P.packages[old.packageId].price : 0)), createdAt: this.now(), receipt });
            if (item.id === 'brand' && a.plan !== 'pro') this.subscribe(a, 'lite');
          }
        } else throw Error('결제 상품을 확인해주세요.');
        a.checkouts.push(receipt); return a;
      });
    }
    cancel(user) { return this.transact(user, a => { if (a.plan !== 'free') a.cancelAtRenewal = true; }); }
    package(user, brandId) { return this.get(user).purchases.filter(p => p.brandId === brandId).sort((a, b) => P.packages[b.packageId].rank - P.packages[a.packageId].rank)[0] || null; }
    applyDesign(user, brandId, signature) { return this.transact(user, a => { a.appliedDesigns[brandId] = signature; }); }
    saveSuggestion(user, suggestion) {
      return this.transact(user, a => { if (!a.suggestions.some(x => x.id === suggestion.id)) a.suggestions.unshift(suggestion); return a.suggestions.find(x => x.id === suggestion.id); });
    }
    updateSuggestion(user, suggestionId, status) { return this.transact(user, a => { const s = a.suggestions.find(x => x.id === suggestionId); if (s) s.status = status; }); }
    importOrder(user, order) {
      return this.transact(user, (a, d) => {
        if (d.orders[order.id] && d.orders[order.id].userId !== user) throw Error('의뢰 계정을 확인해주세요.');
        d.orders[order.id] = { ...clone(order), ...settlement(order.amount), userId: user, simulated: true }; return d.orders[order.id];
      });
    }
    orders(user, printerId) {
      return Object.values(this.read().orders).filter(o => printerId ? o.printerId === printerId : o.userId === user).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    reorder(user, sourceId, changes = {}, recurringDeliveryId = null, cycleKey = null) {
      return this.transact(user, (a, d) => {
        const source = d.orders[sourceId];
        if (!source || source.userId !== user || !['delivered', 'completed'].includes(source.status)) throw Error('납품이 끝난 내 의뢰만 다시 주문할 수 있어요.');
        if (cycleKey) { const existing = Object.values(d.orders).find(o => o.recurringDeliveryId === recurringDeliveryId && o.cycleKey === cycleKey); if (existing) return existing; }
        const quantity = Number(changes.quantity ?? source.quantity);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) throw Error('수량은 1~100,000개로 적어주세요.');
        const due = changes.due || new Date(this.clock().getTime() + 14 * 864e5).toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < this.now().slice(0, 10)) throw Error('희망 납기를 확인해주세요.');
        const amount = Math.round((source.amount - (source.shipping || 0)) * quantity / source.quantity) + (source.shipping || 0);
        const order = { ...source, ...settlement(amount), id: id(), quantity, due, status: 'awaiting_payment', paidAt: null, createdAt: this.now(), reorderOf: source.id, recurringDeliveryId, cycleKey, confirmedAt: null };
        d.orders[order.id] = order; return order;
      });
    }
    payOrder(user, orderId, receipt) {
      return this.transact(user, (a, d) => {
        const o = d.orders[orderId]; if (!o || o.userId !== user) throw Error('내 주문을 확인해주세요.');
        if (o.paidAt) return o;
        if (!receipt?.startsWith('mock-')) throw Error('시연 결제를 확인해주세요.');
        o.status = 'accepted'; o.paidAt = this.now(); o.receipt = receipt; return o;
      });
    }
    advance(user, orderId, printerId) {
      return this.transact(user, (a, d) => {
        const o = d.orders[orderId]; if (!o) throw Error('주문을 확인해주세요.');
        if (printerId) { if (o.printerId !== printerId || !o.paidAt) throw Error('인쇄소와 결제 상태를 확인해주세요.'); const next = { accepted: 'in_progress', in_progress: 'delivered' }[o.status]; if (!next) throw Error('현재 상태에서는 진행할 수 없어요.'); o.status = next; }
        else { if (o.userId !== user || o.status !== 'delivered' || !o.paidAt) throw Error('수령한 내 주문을 확인해주세요.'); o.status = 'completed'; o.confirmedAt = this.now(); }
        return o;
      });
    }
    recurring(user, sourceId) {
      return this.transact(user, (a, d) => {
        if (a.plan !== 'pro') throw Error('정기배송은 프로 구독 혜택이에요.');
        const o = d.orders[sourceId]; if (!o || o.userId !== user || !['delivered', 'completed'].includes(o.status)) throw Error('완료한 의뢰를 확인해주세요.');
        const old = a.recurring.find(r => r.sourceOrderId === sourceId && r.active); if (old) return old;
        const r = { id: id(), userId: user, sourceOrderId: sourceId, cycle: 'monthly', dayOfMonth: P.deliveryDay, nextRunAt: nextFirst(this.now()), active: true };
        a.recurring.push(r); return r;
      });
    }
    stopRecurring(user, recurringId) { return this.transact(user, a => { const r = a.recurring.find(x => x.id === recurringId); if (r) r.active = false; }); }
    runRecurring(user, recurringId, demo = false) {
      const a = this.get(user), r = a.recurring.find(x => x.id === recurringId && x.active);
      if (a.plan !== 'pro' || !r) throw Error('활성화된 프로 정기배송을 확인해주세요.');
      if (!demo && r.nextRunAt > this.now()) return null;
      const key = r.nextRunAt.slice(0, 7), order = this.reorder(user, r.sourceOrderId, {}, r.id, key);
      this.transact(user, a => { const current = a.recurring.find(x => x.id === r.id); current.nextRunAt = nextFirst(r.nextRunAt); }); return order;
    }
    dueRecurring(user) { const a = this.get(user); if (a.plan !== 'pro') return []; return a.recurring.filter(r => r.active && r.nextRunAt <= this.now()).map(r => this.runRecurring(user, r.id)); }
    reset(user) { const d = this.read(); delete d.accounts[user]; for (const [key, order] of Object.entries(d.orders)) if (order.userId === user) delete d.orders[key]; this.storage.setItem(KEY, JSON.stringify(d)); return this.get(user); }
  }
  return { Store, KEY, monthAfter, nextFirst, settlement, id };
});
