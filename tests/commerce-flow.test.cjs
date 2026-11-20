const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.join(__dirname, '..');
function fixture(storage = new Map(), session = null) {
  const context = vm.createContext({
    console, setTimeout, clearTimeout, crypto: { randomUUID },
    REAL: false, user: 'owner', uid: '', myRole: 'owner',
    state: session || { name: '테스트 가게', message: '감사합니다' },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) },
    document: { querySelectorAll: () => [] }, saveDraft() {}, toast() {},
    navigator: { locks: { request: async (_, fn) => fn() } }
  });
  for (const file of ['pricing.js', 'commerce-store.js', 'commerce.js'])
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  return { storage, context, run: code => vm.runInContext(code, context) };
}
test('opening a work session and changing text never spends On', () => {
  const f = fixture();
  f.run("Commerce.noteDesign();state.message='수정한 문구';Commerce.noteDesign()");
  assert.equal(f.run('Commerce.account().tokenBalance'), 150);
  assert.equal(f.run("Commerce.account().ledger.filter(x=>x.reason==='edit').length"), 0);
});
test('successful use costs once across formats and persists after reopening the draft', async () => {
  const f = fixture();
  assert.equal(await f.run("Commerce.gate('sticker',async()=>true)"), true);
  assert.equal(f.run('Commerce.account().tokenBalance'), 140);
  await f.run("Commerce.gate('pdf',async()=>true)");
  f.run("state.message='다시 고친 문구'");
  await f.run("Commerce.gate('save',async()=>true)");
  assert.equal(f.run('Commerce.account().tokenBalance'), 140);
  const session = JSON.parse(f.run('JSON.stringify(state)'));
  const reopened = fixture(f.storage, session);
  await reopened.run("Commerce.gate('svg',async()=>true)");
  assert.equal(reopened.run('Commerce.account().tokenBalance'), 140);
  assert.equal(reopened.run("Commerce.account().ledger.filter(x=>x.reason==='edit').length"), 1);
});
test('failed file creation or save returns the reservation and permits retry', async () => {
  const f = fixture();
  assert.equal(await f.run("Commerce.gate('save',async()=>false)"), false);
  assert.equal(f.run('Commerce.account().tokenBalance'), 150);
  await assert.rejects(f.run("Commerce.gate('pdf',async()=>{throw Error('export failed')})"), /export failed/);
  assert.equal(f.run('Commerce.account().tokenBalance'), 150);
  await f.run("Commerce.gate('pdf',async()=>true)");
  assert.equal(f.run('Commerce.account().tokenBalance'), 140);
});
test('only explicit successful generation costs 30 and its exports cost no extra', async () => {
  const f = fixture();
  assert.equal(await f.run("Commerce.generate(async()=>false)"), false);
  assert.equal(f.run('Commerce.account().tokenBalance'), 150);
  assert.equal(await f.run("Commerce.generate(async()=>true)"), true);
  assert.equal(f.run('Commerce.account().tokenBalance'), 120);
  await f.run("Commerce.gate('sticker',async()=>true)");
  await f.run("Commerce.gate('menu',async()=>true)");
  assert.equal(f.run('Commerce.account().tokenBalance'), 120);
});
test('changing accounts during an operation cannot mark a different account as paid', async () => {
  const f = fixture();
  await assert.rejects(f.run("Commerce.gate('save',async()=>{user='another';return true})"), /계정/);
  assert.equal(f.run("Commerce.db().get('owner').tokenBalance"), 150);
  assert.equal(f.run("Commerce.db().get('another').tokenBalance"), 150);
  assert.equal(f.run("Object.keys(Commerce.db().get('another').appliedDesigns).length"), 0);
});
test('another editing session has its own single use fee', async () => {
  const f = fixture();
  await f.run("Commerce.gate('sticker',async()=>true)");
  f.run("state={name:'두 번째 작업',message:'안녕하세요'};Commerce.noteDesign()");
  assert.equal(f.run('Commerce.account().tokenBalance'), 140);
  await f.run("Commerce.gate('sticker',async()=>true)");
  assert.equal(f.run('Commerce.account().tokenBalance'), 130);
});

