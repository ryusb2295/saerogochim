'use strict';
// Hackathon commerce sandbox. No card data, payment SDK or real charge is used.
const Commerce = (() => {
  const P = GAGEON_PRICING;
  let database, tokenBusy = false, checkoutBusy = false, orderId = '', storageWarning = false;
  let accountStarting=false;
  let remoteUser='',remoteAvailable=null,remoteRevision=0,remoteLoading=null,autoSuggestionBusy=false;
  const rawLocalLock = fn => globalThis.navigator?.locks ? navigator.locks.request('gageon-commerce-demo',fn) : Promise.resolve().then(fn);
  function hydrateRemote(payload){const d=db().read();if(payload.account)d.accounts[who()]=payload.account;if(payload.account)for(const [key,o]of Object.entries(d.orders))if(o.userId===who())delete d.orders[key];for(const o of payload.orders||[])d.orders[o.id]=o;localStorage.setItem(GageonCommerceStore.KEY,JSON.stringify(d));remoteRevision=payload.revision;}
  async function readRemote(){const owner=who();const result=await q(sb.rpc('commerce_demo_read'));if(who()!==owner)throw Error('계정이 바뀌었어요. 다시 시도해주세요.');hydrateRemote(result);return result;}
  async function syncTransaction(fn){if(!(REAL&&uid)||remoteAvailable!==true)return fn();const payload=await readRemote();const before=localStorage.getItem(GageonCommerceStore.KEY);try{const result=await fn();if(!payload.account||localStorage.getItem(GageonCommerceStore.KEY)!==before){const d=db().read(),a=db().account(d,who()),orders=Object.values(d.orders).filter(o=>o.userId===who()||myRole==='printer'&&(o.printerId===myShop?.id||user===QUICK.printer.id&&o.printerId===P.demoOrder.printerId));const saved=await q(sb.rpc('commerce_demo_save',{p_revision:remoteRevision,p_account:a,p_orders:orders}));hydrateRemote(saved);}return result;}catch(e){if(before!==null)localStorage.setItem(GageonCommerceStore.KEY,before);if(String(e.message).includes('demo_revision_conflict')){await readRemote();throw Error('다른 기기에서 시연 정보가 바뀌었어요. 다시 눌러주세요.')}throw e;}}
  function startRemote(){if(!(REAL&&uid))return;if(remoteUser===uid)return;remoteUser=uid;remoteAvailable=null;remoteLoading=rawLocalLock(async()=>{try{await readRemote();remoteAvailable=true;await syncTransaction(()=>{account();});}catch(e){remoteAvailable=false;}finally{remoteLoading=null;if(user&&!tokenBusy&&!checkoutBusy&&!document.querySelector('.modal-back'))render();}});}
  const db = () => database ||= new GageonCommerceStore.Store(localStorage);
  const who = () => REAL && uid ? uid : user;
  const money = n => Number(n).toLocaleString('ko-KR') + '원';
  const goPage = target => { page = target; render(); scrollTo(0, 0); };
  const guard = fn => async e => { try { await fn(e); } catch (error) { toast(error.message || '처리하지 못했어요. 다시 시도해주세요.'); } };
  const lock = async fn => {if(remoteLoading)await remoteLoading;return rawLocalLock(()=>syncTransaction(fn));};
  const account = () => db().get(who());
  function brandId(s = state) { if (!s.commerceBrandId) s.commerceBrandId = s.id || GageonCommerceStore.id(); return s.commerceBrandId; }
  // Opening, editing and previewing never spend On. A work session is committed
  // only after generation, a successful export/save, or a submitted print request.
  function usageKey(s = state) {
    brandId(s);
    s.commerceSessionId ||= GageonCommerceStore.id();
    return 'use-v2:' + s.commerceSessionId;
  }
  function noteDesign(s = state) { usageKey(s); }
  async function markUsed(s = state, owner = who()) { await lock(() => { if(who()!==owner||state!==s)throw Error('브랜드나 계정이 바뀌었어요. 다시 눌러주세요.'); return db().applyDesign(owner, usageKey(s), 'used'); }); saveDraft(); }
  async function useDesign(action, s = state) {
    const owner = who(), key = usageKey(s);
    const run = async () => {
      if (who() !== owner || state !== s) throw Error('브랜드나 계정이 바뀌었어요. 다시 눌러주세요.');
      const result = await action();
      if (result === false) return false;
      await markUsed(s, owner); return true;
    };
    await lock(() => {});
    if (account().appliedDesigns[key] === 'used') return run();
    return withTokens(P.costs.edit, 'edit', run);
  }
  async function generate(action) {
    const s = state, owner = who();
    return withTokens(P.costs.generate, 'generate', async () => {
      const result = await action();
      if (result === false || state !== s || who() !== owner) return false;
      await markUsed(s, owner); return true;
    });
  }
  function sheet(title, body, setup) {
    const previous = document.activeElement, el = document.createElement('div');
    el.className = 'modal-back';
    el.innerHTML = `<section class="modal help-sheet commerce-sheet" role="dialog" aria-modal="true" aria-labelledby="commerce-title"><div class="help-head"><h2 id="commerce-title">${esc(title)}</h2><button class="text-button" type="button" data-close>닫기</button></div>${body}<p class="field-error" role="alert" data-commerce-error hidden></p></section>`;
    let closing = false, onClose = () => {};
    const close = () => { if (closing || el.dataset.busy) return; closing = true; el.remove(); if (!document.querySelector('.modal-back,.gen-modal')) document.body.classList.remove('modal-open'); previous?.isConnected && previous.focus?.(); onClose(); };
    document.body.append(el); document.body.classList.add('modal-open');
    el.querySelector('[data-close]').onclick = close; el.onclick = e => { if (e.target === el) close(); };
    el.onkeydown = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') { const f = [...el.querySelectorAll('button,input,select,textarea')].filter(x => !x.disabled && !x.hidden); if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1)?.focus(); } else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0]?.focus(); } }
    };
    const error = err => { const p = el.querySelector('[data-commerce-error]'); p.textContent = err.message; p.hidden = false; };
    const busy = async fn => { if (el.dataset.busy) return; el.dataset.busy = '1'; const controls = [...el.querySelectorAll('button,input,select,textarea')], before = controls.map(x => x.disabled); controls.forEach(x => x.disabled = true); try { await fn(); } catch (err) { error(err); } finally { delete el.dataset.busy; controls.forEach((x, i) => x.disabled = before[i]); } };
    setup({ el, close, busy, error, onClose: fn => { onClose = fn; }, done: () => { delete el.dataset.busy; close(); } });
    if(!el.contains(document.activeElement))el.querySelector('input,textarea,button')?.focus(); return el;
  }
  async function mockCheckout(item, commit) {
    if (checkoutBusy) throw Error('진행 중인 시연 결제를 기다려주세요.');
    checkoutBusy = true; const owner = who();
    try {
      await new Promise(resolve => setTimeout(resolve, P.checkoutDelay));
      if (who() !== owner) throw Error('계정이 바뀌었어요. 현재 계정에서 다시 시도해주세요.');
      const receipt = 'mock-' + GageonCommerceStore.id();
      const result = await lock(() => commit(receipt));
      toast('결제 완료(시연) · 실제 돈은 나가지 않았어요.'); return result;
    } finally { checkoutBusy = false; }
  }
  function entryCost(kind) {
    if(kind==='brand')return P.costs.generate;
    if(kind==='suggestion')return account().plan==='pro'?0:P.costs.suggestion;
    if(['resume','current'].includes(kind)&&account().appliedDesigns[usageKey(state)]==='used')return 0;
    return P.costs.edit;
  }
  function entryInfo(kind, next) {
    const cost=entryCost(kind),label=kind==='brand'?'새 브랜드 만들기':kind==='post'?'홍보물 만들기':kind==='suggestion'?'시즌 이미지 만들기':'스티커 만들기';
    return sheet('온 사용 안내', '<p><strong>'+label+' · '+cost+'온</strong></p><p>현재 남은 온: '+account().tokenBalance+'온</p><p class="help">'+(kind==='brand'?'질문 입력과 화면 진입은 무료예요. 마지막 브랜드 만들기 버튼으로 생성에 성공하면 '+cost+'온을 사용해요.':kind==='suggestion'?'시안 만들기를 실행할 때 사용해요. 실패하면 반환해요.':cost?'편집과 미리보기는 무료예요. 저장·파일 받기·인쇄 견적 제출에 성공할 때 이번 작업에 한 번만 사용해요.':'이번 작업의 온 사용이 이미 완료되어 추가 차감하지 않아요.')+'</p><button type="button" class="primary full" data-entry-next>확인하고 계속하기</button>',({el,done})=>{el.querySelector('[data-entry-next]').onclick=()=>{done();guard(next)();};});
  }
  function topup(required = 0) {
    return new Promise(resolve => {
      const a = account(); let completed = false;
      sheet(required ? `온이 조금 모자라요` : '온 충전', `<p>지금 ${a.tokenBalance}온${required ? ` · 필요 ${required}온` : ''}</p><p class="help">모든 결제는 시연용이에요.</p><div class="my-list">${Object.entries(P.tokenPacks).map(([key, pack]) => `<button type="button" data-token-pack="${key}">${pack.tokens}온<small>${money(pack.price)}</small></button>`).join('')}<button type="button" data-lite>라이트 구독으로 바꾸기<small>월 ${money(P.plans.lite.price)} · ${P.plans.lite.tokens}온</small></button></div>`, ({ el, done, busy, onClose }) => {
        onClose(() => resolve(completed));
        const buy = item => busy(async () => { await mockCheckout(item, receipt => db().checkout(who(), item, receipt)); completed = true; done(); });
        el.querySelectorAll('[data-token-pack]').forEach(b => b.onclick = () => buy({ kind: 'tokens', id: b.dataset.tokenPack }));
        el.querySelector('[data-lite]').onclick = () => buy({ kind: 'plan', id: 'lite' });
      });
    });
  }
  async function withTokens(cost, reason, operation) {
    if (tokenBusy) return false;
    tokenBusy = true; const owner = who(); let debit;
    try {
      while (!(debit = await lock(() => db().spend(owner, cost, reason))).ok) { if (!(await topup(cost))) return false; if (who() !== owner) return false; }
      let result;
      try { result = await operation(); } catch (e) { await lock(() => db().refund(owner, debit.reservation)); throw e; }
      if (result === false) await lock(() => db().refund(owner, debit.reservation));
      return result !== false;
    } finally { tokenBusy = false; paintBalance(); }
  }
  async function gate(kind, action) { return useDesign(action); }
  function editText(layer) {
    if (!['name', 'message'].includes(layer)) return;
    noteDesign(); const editing=state; const field = layer === 'name' ? 'name' : 'message', original = String(state[field] || '');
    sheet(layer === 'name' ? '상호명 수정' : '스티커 문구 수정', `<form id="inline-text-form"><label class="mini-label" for="inline-sticker-text">${layer === 'name' ? '상호명' : '문구'}</label><input type="text" id="inline-sticker-text" maxlength="${layer === 'name' ? 24 : 40}" value="${esc(original)}"><p class="help">문구 수정과 미리보기는 무료예요. 저장·파일 받기·견적 요청을 완료할 때 ${P.costs.edit}온을 한 번 사용해요.</p><button class="primary full" type="submit">수정 반영</button></form>`, ({ el, done, busy, error }) => {
      const input = el.querySelector('input'); input.focus(); input.select();
      el.querySelector('form').onsubmit = e => { e.preventDefault();if(state!==editing)return error(Error('브랜드가 바뀌었어요. 편집창을 다시 열어주세요.')); const value = input.value;
        if (field === 'name' && !value.trim()) return error(Error('상호명을 입력해주세요.'));
        if (field === 'message' && shortLayout(state) && msgLen(value) > MSG_MAX) return error(Error(`이 배치는 ${MSG_MAX}자까지 들어가요.`));
        if (value === original) return done();
        state[field] = value; refreshSticker(); saveDraft();
        const target = $(field === 'name' ? '#edit-name' : '#message');
        if (target) { target.value = value; target.dispatchEvent(new Event('input', { bubbles: true })); }
        done(); toast('문구를 반영했어요.');
      };
    });
  }
  function accountCard() {
    if (!user) return ''; const a = account(), plan = P.plans[a.plan];
    return `<section class="panel token-panel"><div class="panel-title">남은 온 <span data-token-balance>${a.tokenBalance} / ${plan.tokens}</span></div><progress max="${plan.tokens}" value="${Math.min(a.tokenBalance, plan.tokens)}" aria-label="남은 온"></progress><p class="help">브랜드 생성 ${P.costs.generate}온 · 스티커·홍보물 사용 ${P.costs.edit}온<br>편집·미리보기는 무료예요. 추가 충전분은 기본 한도를 넘을 수 있어요.</p><div class="my-list"><button data-page="plans">요금제<small>${plan.name}${a.cancelAtRenewal ? ' · 해지 예약' : ''} ›</small></button><button data-commerce-topup>온 충전<small>›</small></button><button data-page="token-history">사용·구매 내역<small>›</small></button><button data-page="demo-orders">시연 주문·정기배송<small>›</small></button>${(!REAL || user === PUBLIC_DEMO.id) ? '<button data-page="demo-printer">인쇄소 정산 시연<small>같은 주문 확인 ›</small></button>' : ''}</div><small class="help">${remoteAvailable===true?'수익화 시연 정보를 계정으로 동기화해요.':'수익화 시연 정보는 이 브라우저에서 계정별로 보관돼요.'}</small></section>`;
  }
  function plansPage() {
    const a = account();
    return `<button class="text-button" data-page="mypage">마이페이지로</button><section class="intro"><h1>우리 가게에 맞는 요금제</h1><p>시연 결제예요. 인쇄비는 구독료에 포함되지 않아요.</p></section>${Object.entries(P.plans).map(([key, plan]) => `<section class="panel" style="margin-bottom:14px"><div class="panel-title">${plan.name}${plan.recommended ? '<span class="ai-badge">추천</span>' : ''}</div><strong>${plan.price ? '월 ' + money(plan.price) : '무료'}</strong><p>${key === 'free' ? '가입 시 1회' : '매월'} ${plan.tokens}온</p><ul>${plan.benefits.map(b => `<li>${b}</li>`).join('')}</ul>${key !== 'free' ? `<button class="${a.plan === key ? 'secondary' : 'primary'} full" data-subscribe="${key}" ${a.plan === key && !a.cancelAtRenewal ? 'disabled' : ''}>${a.plan === key && !a.cancelAtRenewal ? '이용 중이에요' : '이 요금제로 시작하기 (시연)'}</button>` : '<p class="help">무료 온은 다시 지급되지 않아요.</p>'}</section>`).join('')}<p class="help">매월 갱신일에 플랜 한도까지 채우고 남은 온은 이월되지 않아요.${a.planRenewsAt ? '<br>다음 갱신: ' + esc(new Date(a.planRenewsAt).toLocaleDateString('ko-KR')) : ''}</p>${a.plan !== 'free' ? `<button class="text-button" data-cancel-plan>${a.cancelAtRenewal ? '다음 갱신일부터 무료로 바뀌어요' : '다음 갱신일부터 해지하기'}</button>` : ''}<div class="my-list"><button data-reset-commerce>수익화 시연 상태 초기화<small>현재 계정만 초기화 ›</small></button></div>`;
  }
  function historyPage() {
    const a = account(), reasons = { signup: '가입 지급', subscription: '구독 한도', purchase: '온 충전', generate: '캐릭터 생성', edit: '문구·홍보물 반영', suggestion: '시즌 시안' };
    return `<button class="text-button" data-page="mypage">마이페이지로</button>${accountCard()}<h2 class="sec-label">온 내역</h2><div class="my-list">${a.ledger.slice(0, 50).map(x => `<div>${reasons[x.reason] || esc(x.reason)}${x.note ? `<small>${esc(x.note)}</small>` : ''}<small>${x.delta > 0 ? '+' : ''}${x.delta} · ${new Date(x.createdAt).toLocaleString('ko-KR')}</small></div>`).join('')}</div><h2 class="sec-label">패키지 구매</h2><div class="my-list">${a.purchases.map(x => `<div>${P.packages[x.packageId].name}<small>${money(x.price)} · 시연</small></div>`).join('') || '<div>아직 구매한 패키지가 없어요.</div>'}</div>`;
  }
  function ownerSummary(amount) { const n = GageonCommerceStore.settlement(amount); return `<div class="my-list"><div>견적 금액<small>${money(n.amount)}</small></div><div>가게온 이용료<small>${money(n.ownerFee)}</small></div><div><strong>결제 금액</strong><strong>${money(n.amount)}</strong></div></div>`; }
  function printerSummary(amount, status, paid = true) { if (!Number.isSafeInteger(amount)) return ''; const n = GageonCommerceStore.settlement(amount); return `<div class="my-list"><div>거래액<small>${money(n.amount)}</small></div><div>플랫폼 이용료 ${P.feeRate * 100}%<small class="danger-text">−${money(n.platformFee)}</small></div><div><strong>${status === 'completed' && paid ? '정산 금액(시연)' : '정산 예정 금액'}</strong><strong>${money(n.printerPayout)}</strong></div></div><p class="help">사장님 수령 확인 후 정산돼요(에스크로). 시연 정보예요.</p>`; }
  const orderStatus = { awaiting_payment: '결제 대기', accepted: '업체 선택', in_progress: '제작 중', delivered: '납품 완료', completed: '수령 확인' };
  function orderCard(o, printer = false) {
    const completed = ['delivered', 'completed'].includes(o.status);
    return `<article class="panel" style="margin-bottom:14px"><p class="meta">시연 주문 · ${orderStatus[o.status]}${o.recurringDeliveryId ? ' · 정기배송' : ''}</p><strong>${esc(o.title)}</strong><p>${Number(o.quantity).toLocaleString()}개 · ${esc(o.width)}×${esc(o.height)}${esc(o.unit)} · ${esc(o.material)}</p><p class="help">${esc(o.printerName)} · 희망 납기 ${esc(o.due)}<br>${esc(o.region || '')}</p>${o.previewImage ? `<img class="commerce-order-thumb" src="${esc(o.previewImage)}" alt="주문한 디자인">` : ''}${!printer&&o.printJobId?`<button class="secondary full" data-print-job="${esc(o.printJobId)}">승인한 인쇄 파일 ZIP 받기</button>`:''}${printer ? printerSummary(o.amount, o.status, !!o.paidAt) : ownerSummary(o.amount)}${!printer && o.status === 'awaiting_payment' ? `<button class="primary full" data-demo-pay="${o.id}">${money(o.amount)} 결제하기 (시연)</button>` : ''}${!printer && completed ? `<button class="secondary full" data-reorder="${o.id}">같은 디자인으로 다시 주문</button>${recurringCard(o)}` : ''}${!printer && o.status === 'delivered' ? `<button class="primary full" data-demo-complete="${o.id}">수령 확인 (시연)</button>` : ''}${printer && ['accepted', 'in_progress'].includes(o.status) ? `<button class="primary full" data-demo-advance="${o.id}" data-printer="${esc(o.printerId)}">${o.status === 'accepted' ? '제작 시작 (시연)' : '납품 완료 (시연)'}</button>` : ''}</article>`;
  }
  function recurringCard(o) {
    const a = account(), recurring = a.recurring.find(r => r.sourceOrderId === o.id && r.active);
    return `<div class="note"><div><strong>${esc(ITEM[o.item] || '인쇄물')}, 매달 자동으로 받기${recurring ? ' · 정기배송' : ''}</strong><p class="help">매월 ${P.deliveryDay}일 같은 조건으로 주문돼요 · 인쇄비는 따로 결제해요.</p>${a.plan !== 'pro' ? '<span class="ai-badge">프로 구독 혜택</span><button class="text-button" data-page="plans">프로로 시작하기</button>' : recurring ? `<p class="help">다음 회차 ${esc(recurring.nextRunAt.slice(0, 10))}</p><button class="secondary" data-run-recurring="${recurring.id}">이번 회차 지금 실행 (시연)</button><button class="text-button" data-stop-recurring="${recurring.id}">정기배송 중지</button>` : `<button class="secondary" data-start-recurring="${o.id}">정기배송 신청</button>`}</div></div>`;
  }
  function ordersPage(printer = false) {
    const printerId = printer ? (REAL && myRole === 'printer' ? (user === QUICK.printer.id ? P.demoOrder.printerId : myShop?.id) : P.demoOrder.printerId) : null;
    const orders = db().orders(who(), printerId);if(printer&&REAL&&myRole==='printer'&&user===QUICK.printer.id&&myShop?.id)for(const o of db().orders(null,myShop.id))if(!orders.some(x=>x.id===o.id))orders.push(o);
    return `<button class="text-button" data-page="mypage">마이페이지로</button><section class="intro"><h1>${printer ? '인쇄소 정산 시연' : '시연 주문·정기배송'}</h1><p>이 브라우저에서 만든 모의 주문이에요. 실제 인쇄가 접수되지 않아요.</p></section>${orders.length ? orders.map(o => orderCard(o, printer)).join('') : '<div class="empty"><p>아직 시연 주문이 없어요.</p></div>'}${!printer ? '<button class="secondary full" data-seed-order>납품 완료 예시 의뢰 넣기</button>' : ''}`;
  }
  function seedOrder() {
    const id = 'demo-delivered-' + who(); if (db().orders(who()).some(o => o.id === id)) return;
    db().importOrder(who(), { id, title: (shop || state.name || '우리 가게') + ' 스티커', item: 'sticker', quantity: P.demoOrder.quantity, amount: P.demoOrder.amount, shipping: P.demoOrder.shipping, width: 50, height: 50, unit: 'mm', material: '아트지', finishing: ['무광 코팅'], region: '대구 · 체험 배송지', printerId: P.demoOrder.printerId, printerName: P.demoOrder.printerName, status: 'completed', paidAt: db().now(), confirmedAt: db().now(), due: db().now().slice(0, 10), createdAt: db().now(), previewImage: svgUri(stickerSVG(state)), brand: JSON.parse(JSON.stringify(state)) });
  }
  function reorderSheet(source) {
    sheet('같은 디자인으로 다시 주문', `<p>${esc(source.title)} · ${esc(source.printerName)}</p><p class="help">디자인·규격·재질·후가공·배송지는 그대로예요. 수량과 납기만 바꿔요.</p><form id="reorder-form"><div class="field"><label for="reorder-quantity">수량</label><input type="number" id="reorder-quantity" min="1" max="100000" value="${source.quantity}"></div><div class="field"><label for="reorder-due">희망 납기</label><input type="date" id="reorder-due" min="${dayAfter(1)}" value="${dayAfter(14)}"></div><p class="help">이전 단가 기준 시연 금액이에요. 실제 납기는 인쇄소와 확인해요.</p><button class="primary full" type="submit">이전 인쇄소로 다시 주문 (시연)</button></form>`, ({ el, done, busy }) => {
      el.querySelector('form').onsubmit = e => { e.preventDefault(); const changes = { quantity: el.querySelector('#reorder-quantity').value, due: el.querySelector('#reorder-due').value }; busy(async () => { const o = await lock(() => db().reorder(who(), source.id, changes)); orderId = o.id; done(); goPage('demo-orders'); }); };
    });
  }
  function seasonCandidate(now = new Date()) {
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));const today=new Date(parts.year+'-'+parts.month+'-'+parts.day+'T00:00:00Z');
    return [today.getUTCFullYear(), today.getUTCFullYear() + 1].flatMap(year => P.seasons.map(s => ({ ...s, date: new Date(Date.UTC(year, s.month - 1, s.day)), year }))).filter(s => s.date >= today && s.date - today <= P.seasonLeadDays * 864e5).sort((a, b) => a.date - b.date)[0] || null;
  }
  function suggestionFor(s, season) {
    const id = brandId(s) + ':' + season.id + ':' + season.year;
    return { id, userId: who(), brandId: brandId(s), brand: JSON.parse(JSON.stringify(s)), season: season.id, title: `${season.name} 스티커 시안`, previewImage: '', status: 'new', createdAt: db().now(), message: season.message };
  }
  function seasonSVG(suggestion) {
    const s = { ...suggestion.brand, message: suggestion.message, font: suggestion.brand.font ?? '', layout: 'basic', customColor: suggestion.brand.customColor || '#e7eedc' };
    return stickerSVG(s).replace('</svg>', '<g fill="white" opacity=".8"><circle cx="100" cy="180" r="10"/><circle cx="690" cy="270" r="8"/><circle cx="600" cy="110" r="12"/></g></svg>');
  }
  function homeCard() {
    if (!user) return ''; const a = account(), saved = records()[0], season = seasonCandidate();
    let card = '';
    if (saved && season) {
      const candidate = suggestionFor(saved, season); let suggestion = a.suggestions.find(x => x.id === candidate.id);
      if (a.plan === 'pro' && !suggestion) { candidate.previewImage = svgUri(seasonSVG(candidate));if(remoteAvailable===true){if(!autoSuggestionBusy){autoSuggestionBusy=true;guard(async()=>{try{await lock(()=>db().saveSuggestion(who(),candidate));}finally{autoSuggestionBusy=false;}render();})();}}else suggestion=db().saveSuggestion(who(),candidate); }
      const item = suggestion || candidate;
      card = `<section class="panel season-card"><span class="ai-badge">AI 시즌 제안 · ${new Date().getMonth() + 1}월</span><h2>${esc(item.title)}${suggestion ? '이 준비됐어요' : '을 만들어볼까요?'}</h2><p class="help">저장한 ${esc(saved.name)} 캐릭터에 계절 문구를 더했어요. 시연에서는 기존 캐릭터로 시안을 조합해요.</p>${suggestion ? `<img class="commerce-order-thumb" src="${esc(suggestion.previewImage)}" alt="${esc(item.title)}"><div class="actions"><button class="secondary" data-view-suggestion="${item.id}">시안 보기</button><button class="primary" data-print-suggestion="${item.id}">이 시안으로 인쇄 견적 받기</button></div>` : `<button class="primary full" data-make-suggestion>${a.plan === 'pro' ? '시안 만들기 · 무료' : `시안 받기 · ${P.costs.suggestion}온`}</button>`}</section>`;
    }
    return card;
  }
  async function makeSuggestion() {
    const saved = records()[0], season = seasonCandidate(); if (!saved || !season) return;
    const item = suggestionFor(saved, season); if (account().suggestions.some(x => x.id === item.id)) return;
    const create = async () => { if(account().suggestions.some(x=>x.id===item.id))return false; item.previewImage = svgUri(seasonSVG(item)); await lock(()=>db().saveSuggestion(who(), item)); return true; };
    const cost = account().plan === 'pro' ? 0 : P.costs.suggestion;
    if (await withTokens(cost, 'suggestion', create)) render();
  }
  async function showSuggestion(id, printing) {
    const s = account().suggestions.find(x => x.id === id); if (!s) return;
    state = { ...initial(), ...s.brand, message: s.message, layout: 'basic' }; state.commerceBrandId = s.brandId;
    state.commerceSessionId = GageonCommerceStore.id();
    await lock(()=>db().updateSuggestion(who(), id, printing ? 'ordered' : 'viewed'));
    await markUsed();
    if (!printing) { focusMode='sticker'; page = 'studio'; step = 3; render(); scrollTo(0, 0); return; }
    // SVG stays editable in the studio. The quote form receives a real PNG file.
    guard(async () => { const image = await loadImg(s.previewImage), blob = await toBlob(image, P.print.pixels, false, 'image/png'); uploadFile = new File([blob], s.title + '.png', { type: 'image/png' }); reqDraft = { ...reqDraft, title: s.title }; goPage('newreq'); })();
  }
  function paintBalance() {
    if (!user) return; const a = account(); document.querySelectorAll('[data-token-balance]').forEach(n => n.textContent = `${a.tokenBalance} / ${P.plans[a.plan].tokens}`);
  }
  async function payLive() {
    const details = V['request-' + reqId]?.data; if (!details) throw Error('견적을 다시 열어주세요.');
    const picked = details.quotes.find(x => x.status === 'accepted'); if (!picked) throw Error('수락한 견적을 확인해주세요.');
    const amount = picked.total_price + picked.shipping_fee;
    await mockCheckout({ kind: 'print', amount }, receipt => q(sb.rpc('mark_paid', { p_request: reqId, p_pay_key: receipt })));
    reload('request-' + reqId);
  }
  function importLive(details) {
    const { req, quotes, preview } = details, picked = quotes.find(x => x.status === 'accepted');
    if (!picked || !['delivered', 'completed'].includes(req.status)) throw Error('납품 완료 의뢰를 확인해주세요.');
    return db().importOrder(who(), { id: 'source-' + req.id, title: req.title, item: req.item, quantity: req.quantity, width: req.width, height: req.height, unit: req.unit, material: req.material, finishing: req.finishing, region: [req.region_sido, req.region_sigungu].filter(Boolean).join(' '), printerId: picked.shop_id, printerName: picked.print_shops?.name || '이전 인쇄소', amount: picked.total_price + picked.shipping_fee, shipping: picked.shipping_fee, previewImage: preview || '', designPath: req.design_path, previewPath: req.preview_path, due: req.due_date, status: req.status, paidAt: req.paid_at || null, confirmedAt: req.completed_at || null, createdAt: req.created_at });
  }
  function realRequestExtra(details) {
    if (!details) return ''; const { req, quotes } = details, picked = quotes.find(x => x.status === 'accepted'); if (!picked) return '';
    return `${['delivered', 'completed'].includes(req.status) ? `<section class="panel"><button class="secondary full" data-live-reorder>같은 디자인으로 다시 주문</button><p class="help">재주문과 정기배송은 모의 주문으로 만들어져요. 실제 제작은 접수되지 않아요.</p><button class="text-button" data-live-recurring>매달 자동으로 받기 · 프로 혜택</button></section>` : ''}`;
  }
  function afterRender() {
    if (!user || ['start', 'code'].includes(page)) return;
    if (!storageWarning) { try { account(); } catch (e) { storageWarning = true; toast('수익화 시연 정보를 저장하지 못했어요. 브라우저 저장 공간을 확인해주세요.'); return; } }
    if (page === 'studio' && step === 3) noteDesign();
    if (page === 'requests') $('.main')?.insertAdjacentHTML('beforeend', `<div class="my-list"><button data-page="demo-orders">시연 재주문·정기배송<small>›</small></button></div>${db().orders(who()).filter(x => ['delivered', 'completed'].includes(x.status)).slice(0, 2).map(o => orderCard(o)).join('')}`);
    if (page === 'request') $('.main')?.insertAdjacentHTML('beforeend', realRequestExtra(V['request-' + reqId]?.data));
    if (page === 'jobs' || page === 'dash') $('.main')?.insertAdjacentHTML('beforeend', '<div class="my-list"><button data-page="demo-printer">시연 주문·정산 보기<small>›</small></button></div>');
    bind(); StickerPrint.decorate();
  }
  function bind() {
    const box = $('#app');
    box.querySelectorAll('[data-export-field]').forEach(input=>input.oninput=()=>{state[input.dataset.exportField]=input.value;saveDraft();});
    if($('#to-request'))$('#to-request').onclick=()=>state.shape==='circle'?StickerPrint.open():goPage('newreq');
    if($('#print-sticker'))$('#print-sticker').onclick=StickerPrint.open;
    if(REAL&&$('#req-form')){$('#req-form').onsubmit=guard(async e=>{e.preventDefault();if(checkReq())await gate('request',()=>submitRequest(e.target.querySelector('[type=submit]')));});}
    if(!REAL&&$('#req-form'))$('#req-form').onsubmit=guard(async e=>{e.preventDefault();if(!checkReq())return;await gate('request',async()=>{const button=e.target.querySelector('[type=submit]');button.disabled=true;try{const delivery=await StickerPrint.delivery();const d=reqDraft;let image=svgUri(stickerSVG());if(uploadFile)image=await new Promise((ok,bad)=>{const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.onerror=bad;reader.readAsDataURL(uploadFile)});await lock(()=>db().importOrder(who(),{id:GageonCommerceStore.id(),title:d.title,item:d.item,quantity:Number(d.quantity),width:Number(d.width),height:Number(d.height),unit:d.unit,material:d.material,finishing:[...d.finishing],region:[d.region_sido,d.region_sigungu].join(' '),printerId:P.demoOrder.printerId,printerName:P.demoOrder.printerName,amount:Math.round(P.demoOrder.amount*Number(d.quantity)/P.demoOrder.quantity),shipping:P.demoOrder.shipping,status:'awaiting_payment',paidAt:null,due:d.due,createdAt:db().now(),previewImage:image,...(delivery?{printJobId:delivery.jobId,printFiles:delivery.files,printAsset:delivery.metadata.asset}:{})}));StickerPrint.clear();uploadFile=null;goPage('demo-orders');return true;}finally{button.disabled=false}});});

    box.querySelectorAll('[data-page]').forEach(b => b.onclick = () => { syncForm(); if(b.dataset.page==='studio')return entryInfo('brand',startNewBrand); goPage(b.dataset.page); });
    box.querySelectorAll('[data-commerce-topup]').forEach(b => b.onclick = guard(async () => { if (await topup()) render(); }));
    box.querySelectorAll('[data-subscribe]').forEach(b => b.onclick = () => sheet(`${P.plans[b.dataset.subscribe].name} 구독`, `<p>월 ${money(P.plans[b.dataset.subscribe].price)} · ${P.plans[b.dataset.subscribe].tokens}온</p><p class="help">시연 결제예요. 갱신 시 한도까지 채우며 이월되지 않아요.</p><button class="primary full" data-confirm>결제하기 (시연)</button>`, ({ el, busy, done }) => { el.querySelector('[data-confirm]').onclick = () => busy(async () => { const item = { kind: 'plan', id: b.dataset.subscribe }; await mockCheckout(item, receipt => db().checkout(who(), item, receipt)); done(); render(); }); }));
    box.querySelectorAll('[data-cancel-plan]').forEach(b => b.onclick = guard(async () => { await lock(() => db().cancel(who())); render(); toast('다음 갱신일부터 무료로 바뀌어요.'); }));
    box.querySelectorAll('[data-reset-commerce]').forEach(b => b.onclick = () => sheet('시연 상태를 초기화할까요?', '<p>현재 계정의 시연 온·구독·패키지·시연 주문만 초기화해요. 브랜드와 실제 견적·채팅은 그대로예요.</p><button class="primary full" data-reset-confirm>현재 계정 초기화</button>', ({ el, busy, done }) => { el.querySelector('[data-reset-confirm]').onclick = () => busy(async () => { await lock(() => db().reset(who())); done(); render(); }); }));
    const actions = { sticker: () => download('sticker'), sns: () => download('sns'), pack: () => download('pack'), character: () => CommerceExports.download('character'), svg: () => CommerceExports.download('svg'), pdf: () => CommerceExports.download('pdf'), menu: () => CommerceExports.download('menu'), coupon: () => CommerceExports.download('coupon') };
    box.querySelectorAll('[data-commerce-download]').forEach(b => b.onclick = guard(() => gate(b.dataset.commerceDownload, actions[b.dataset.commerceDownload])));
    box.querySelectorAll('[data-set]').forEach(b => b.onclick = guard(() => gate('set', () => download('sticker', setSticker(Number(b.dataset.set)), b, '_스티커_' + STICKER_SET[Number(b.dataset.set)].replace(/[!\s]/g, '')))));
    if ($('#save')) $('#save').onclick = guard(() => gate('save', save));
    if ($('#to-result')) $('#to-result').onclick = () => { if (!state.name.trim()) return toast('상호명을 입력해주세요.'); go(4); };
    if ($('#change-sticker-image')) $('#change-sticker-image').onclick = () => entryInfo('current',()=>imageSourceSheet(focusMode || 'sticker', true));
    box.querySelectorAll('[data-print-job]').forEach(b=>b.onclick=guard(()=>StickerPrint.downloadStored(b.dataset.printJob)));
    box.querySelectorAll('[data-seed-order]').forEach(b => b.onclick = guard(async () => { await lock(seedOrder); render(); }));
    box.querySelectorAll('[data-reorder]').forEach(b => b.onclick = () => { const source = db().orders(who()).find(x => x.id === b.dataset.reorder); if (source) reorderSheet(source); });
    box.querySelectorAll('[data-demo-pay]').forEach(b => b.onclick = guard(async () => { if (b.disabled) return; b.disabled = true; try { await mockCheckout({ kind: 'print' }, receipt => db().payOrder(who(), b.dataset.demoPay, receipt)); render(); } finally { b.disabled = false; } }));
    box.querySelectorAll('[data-demo-complete]').forEach(b => b.onclick = guard(async () => { await lock(() => db().advance(who(), b.dataset.demoComplete)); render(); }));
    box.querySelectorAll('[data-demo-advance]').forEach(b => b.onclick = guard(async () => { await lock(() => db().advance(who(), b.dataset.demoAdvance, b.dataset.printer)); render(); }));
    box.querySelectorAll('[data-start-recurring]').forEach(b => b.onclick = guard(async () => { await lock(() => db().recurring(who(), b.dataset.startRecurring)); render(); }));
    box.querySelectorAll('[data-stop-recurring]').forEach(b => b.onclick = guard(async () => { await lock(() => db().stopRecurring(who(), b.dataset.stopRecurring)); render(); }));
    box.querySelectorAll('[data-run-recurring]').forEach(b => b.onclick = guard(async () => { b.disabled = true; await lock(() => db().runRecurring(who(), b.dataset.runRecurring, true)); render(); }));
    box.querySelectorAll('[data-make-suggestion]').forEach(b => b.onclick = ()=>entryInfo('suggestion',makeSuggestion));
    box.querySelectorAll('[data-view-suggestion]').forEach(b => b.onclick = guard(() => showSuggestion(b.dataset.viewSuggestion, false)));
    box.querySelectorAll('[data-print-suggestion]').forEach(b => b.onclick = guard(() => showSuggestion(b.dataset.printSuggestion, true)));
    box.querySelectorAll('[data-live-reorder],[data-live-recurring]').forEach(b => b.onclick = guard(async () => { const o = await lock(() => importLive(V['request-' + reqId].data)); if (b.hasAttribute('data-live-reorder')) reorderSheet(o); else { if (account().plan !== 'pro') return goPage('plans'); await lock(() => db().recurring(who(), o.id)); goPage('demo-orders'); } }));
    box.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => sheet('인쇄비 결제 (시연)', ownerSummary(Number(b.dataset.pay)) + '<p class="help">실제 돈은 나가지 않아요.</p><button class="primary full" data-pay-confirm>결제하기 (시연)</button>', ({ el, busy, done }) => { el.querySelector('[data-pay-confirm]').onclick = () => busy(async () => { await payLive(); done(); }); }));
  }
  function prepare(){if(!user){remoteUser='';remoteAvailable=null;return true;}if(!db().read().accounts[who()]){if(!accountStarting){accountStarting=true;rawLocalLock(()=>account()).then(()=>{accountStarting=false;render()}).catch(e=>{accountStarting=false;toast(e.message)});}return false;}startRemote();if(remoteAvailable!==true)db().dueRecurring(who());return true;}
  function install() {
    Object.assign(PAGES, { plans: plansPage, 'token-history': historyPage, 'demo-orders': () => ordersPage(false), 'demo-printer': () => ordersPage(true) });
    if(!REAL)Object.assign(PAGES,{newreq:newreqPage,requests:()=>ordersPage(false)});
    Object.assign(PAGE_LABEL, { plans: '요금제', 'token-history': '사용·구매 내역', 'demo-orders': '시연 주문', 'demo-printer': '정산 시연' });
    Object.assign(NAV_PARENT, { plans: 'mypage', 'token-history': 'mypage', 'demo-orders': 'requests', 'demo-printer': 'dash' });
    window.resetDemo = async () => { if (!who()) return; await lock(()=>db().reset(who())); render(); };
    addEventListener('storage', e => { if (e.key === GageonCommerceStore.KEY && user && !tokenBusy && !checkoutBusy && !document.querySelector('.modal-back') && !document.querySelector('#inline-text-form')) render(); });
    addEventListener('visibilitychange',()=>{if(!document.hidden&&user)guard(async()=>{await lock(()=>db().dueRecurring(who()));render()})()});
  }
  return { P, account, accountCard, homeCard, brandId, noteDesign, useDesign, generate, withTokens, gate, editText, sheet, entryInfo, entryCost, afterRender, prepare, install, payLive, ownerSummary, printerSummary, seasonCandidate, seasonSVG, db };
})();
