const test = require('node:test');
const assert = require('node:assert/strict');
const { Store, settlement, monthAfter, KEY } = require('../commerce-store.js');
const P = require('../pricing.js');
function fixture() {
  let time = new Date('2026-11-20T04:00:00Z'); const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  return { store: new Store(storage, () => time), storage, setTime: t => { time = new Date(t); } };
}
const source = { id: 'original', amount: 92000, quantity: 500, shipping: 0, title: '달빛분식 스티커', width: 50, height: 50, unit: 'mm', material: '아트지', finishing: ['무광'], region: '대구', printerId: 'printer', printerName: '인쇄소', status: 'completed', createdAt: '2026-11-20T00:00:00Z', designPath: 'same-design.png' };

test('signup is once per account, persistent and isolated', () => {
  const { store, storage } = fixture(); assert.equal(store.get('a').tokenBalance, 150);
  store.spend('a', 30, 'generate'); assert.equal(new Store(storage).get('a').tokenBalance, 120);
  assert.equal(store.get('b').tokenBalance, 150); assert.equal(store.get('a').ledger.filter(x => x.reason === 'signup').length, 1);
});
test('insufficient balance does not debit; topup resumes; failure refund is idempotent', () => {
  const { store } = fixture(); store.spend('a', 140, 'edit'); assert.equal(store.spend('a', 30, 'generate').ok, false);
  store.checkout('a', { kind: 'tokens', id: 'small' }, 'mock-purchase'); store.checkout('a', { kind: 'tokens', id: 'small' }, 'mock-purchase');
  const debit = store.spend('a', 30, 'generate'); assert.equal(store.get('a').tokenBalance, 80);
  store.refund('a', debit.reservation); store.refund('a', debit.reservation); assert.equal(store.get('a').tokenBalance, 110);
});
test('package purchase survives reopen, supports difference upgrades and grants lite once', () => {
  const { store, storage } = fixture(); const item = { kind: 'package', brandId: 'brand-a', id: 'starter' };
  store.checkout('a', item, 'mock-starter'); assert.equal(new Store(storage).package('a', 'brand-a').packageId, 'starter');
  store.checkout('a', { ...item, id: 'brand' }, 'mock-brand'); assert.equal(store.get('a').plan, 'lite'); assert.equal(store.get('a').tokenBalance, 300);
  assert.equal(store.package('a', 'brand-a').price, 49000 - 9900);
  store.spend('a', 30, 'generate'); store.checkout('a', { ...item, id: 'brand' }, 'mock-brand-again'); assert.equal(store.get('a').tokenBalance, 270);
  assert.equal(store.package('a', 'brand-b'), null);
});
test('subscription renews to its cap without rollover, cancellation does not grant free tokens again', () => {
  const { store, setTime } = fixture(); store.checkout('a', { kind: 'plan', id: 'pro' }, 'mock-pro');
  store.checkout('a', { kind: 'tokens', id: 'small' }, 'mock-extra'); assert.equal(store.get('a').tokenBalance, 1100);
  setTime('2026-12-20T05:00:00Z'); assert.equal(store.get('a').tokenBalance, 1000);
  store.cancel('a'); setTime('2027-01-20T06:00:00Z'); assert.equal(store.get('a').plan, 'free'); assert.equal(store.get('a').tokenBalance, 0);
  assert.equal(monthAfter('2027-01-31T04:00:00Z'), '2027-02-28T04:00:00.000Z');
});
test('owner and printer see the same fee and preserve the exact order conditions', () => {
  const { store } = fixture(); store.importOrder('a', source); const copy = store.reorder('a', 'original', { quantity: 1000, due: '2026-12-10' });
  assert.equal(copy.amount, 184000); assert.equal(copy.platformFee, 14720); assert.equal(copy.printerPayout, 169280);
  for (const key of ['designPath', 'material', 'region', 'printerId', 'width', 'height']) assert.equal(copy[key], source[key]);
  assert.equal(copy.reorderOf, 'original'); assert.equal(store.orders(null, 'printer').find(x => x.id === copy.id).amount, copy.amount);
  assert.deepEqual(settlement(92000), { amount: 92000, ownerFee: 0, platformFeeRate: .08, platformFee: 7360, printerPayout: 84640 });
  assert.throws(() => store.reorder('b', 'original'), /내 의뢰/);
});
test('simulation payment and delivery require the right owner, printer and sequence', () => {
  const { store } = fixture(); store.importOrder('a', source); const copy = store.reorder('a', source.id);
  assert.throws(() => store.advance('printer-user', copy.id, 'printer'), /결제 상태/);
  store.payOrder('a', copy.id, 'mock-pay'); store.payOrder('a', copy.id, 'mock-pay-again');
  assert.throws(() => store.advance('printer-user', copy.id, 'other-printer'), /인쇄소/);
  store.advance('printer-user', copy.id, 'printer'); store.advance('printer-user', copy.id, 'printer'); store.advance('a', copy.id);
  assert.equal(store.orders('a').find(x => x.id === copy.id).status, 'completed');
});
test('pro-only recurring runs once per due cycle and stops after cancellation', () => {
  const { store, setTime } = fixture(); store.importOrder('a', source); assert.throws(() => store.recurring('a', source.id), /프로/);
  store.checkout('a', { kind: 'plan', id: 'pro' }, 'mock-pro'); const r = store.recurring('a', source.id); assert.equal(store.recurring('a', source.id).id, r.id);
  setTime('2026-12-01T01:00:00Z'); assert.equal(store.dueRecurring('a').length, 1); assert.equal(store.dueRecurring('a').length, 0);
  const cycle = store.orders('a').find(o => o.recurringDeliveryId === r.id); assert.equal(cycle.cycleKey, '2026-12'); assert.equal(cycle.status, 'awaiting_payment'); assert.equal(cycle.platformFee, 7360);
  store.stopRecurring('a', r.id); setTime('2027-01-01T00:00:00Z'); assert.equal(store.dueRecurring('a').length, 0);
});
test('account reset removes only its simulation state and prevents invalid costs', () => {
  const { store, storage } = fixture(); store.importOrder('a', source); store.get('b'); store.spend('b', 30, 'generate'); store.reset('a');
  assert.equal(store.orders('a').length, 0); assert.equal(store.get('a').tokenBalance, P.plans.free.tokens); assert.equal(store.get('b').tokenBalance, 120);
  assert.throws(() => store.spend('a', -10, 'edit')); assert.ok(JSON.parse(storage.getItem(KEY)).accounts.b);
});
