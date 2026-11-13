// 가게온 실제 서비스 연결: Supabase 로그인, 제작 요청, 견적, 수락, 알림.
// config.js에 Supabase 값이 있고 supabase-js가 불러와졌으면 실제 모드, 아니면(또는 ?mock=1) 기존 브라우저 목업 모드.
// index.html의 전역(state, page, render, toast, esc, icon, $ 등)을 함께 쓴다. 설계: docs/PRINT_PLATFORM.md
const CFG = window.GAGEON_CONFIG || {};
const REAL = !!(CFG.supabaseUrl && CFG.supabaseKey && window.supabase && !/[?&]mock=1/.test(location.search));
const sb = REAL ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;
// 아이디 로그인을 Supabase 이메일 로그인에 얹기 위한 내부용 주소 (.invalid는 실제로 메일이 가지 않는 예약 도메인)
const ID_DOMAIN = '@users.gageon.invalid';
// 누구나 써 보는 공개 체험 계정. 비밀번호가 공개돼 있으니 시연 발표에는 별도 계정을 쓴다
const PUBLIC_DEMO = { id: 'demo', pw: 'demo1234' };
// 다른 학과 팀원용 '바로 둘러보기' 버튼. 해커톤 시연 전에 false로 바꿔 버튼을 숨긴다
const QUICK_LOGIN = true;
const QUICK = { owner: PUBLIC_DEMO, printer: { id: 'demoprint', pw: 'demo1234' } };
let myRole = 'owner', uid = '', myShop = null, notiCount = 0, notiChannel = null, quoteChannel = null;
let reqId = '', convId = '', signupRole = 'owner', marketFilter = '', marketItems = {}, quoteSort = 'total';
let reqDraft = { item: 'sticker', quantity: 500, width: 50, height: 50, unit: 'mm', material: '아트지', finishing: [], region_sido: '대구', region_sigungu: '', note: '', title: '', item_other: '' };
let uploadFile = null;

const ITEM = { sticker: '스티커', wrapping: '포장지', shopping_bag: '쇼핑백', other: '기타' };
const REQ_ST = { open: ['견적 받는 중', 'st-open'], accepted: ['업체 선택', 'st-acc'], in_progress: ['제작 중', 'st-prog'], delivered: ['납품 완료', 'st-prog'], completed: ['완료', 'st-done'], canceled: ['취소', 'st-done'], expired: ['마감', 'st-done'] };
const Q_ST = { submitted: ['검토 중', 'st-open'], withdrawn: ['철회', 'st-done'], accepted: ['수락됨', 'st-acc'], declined: ['미선택', 'st-done'] };
const SIDO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const MATERIALS = ['아트지', '유포지', '투명 PET', '크라프트지', '기타'];
const FINISH = ['무광 코팅', '유광 코팅', '도무송 재단', '박'];
const PAGE_LABEL = { dash: '대시보드', market: '요청 찾기', quote: '견적 작성', myquotes: '보낸 견적', jobs: '수락된 의뢰', requests: '받은 견적', newreq: '제작 견적 요청', request: '견적 비교', chats: '채팅', chat: '채팅', notis: '알림' };
const ERR = { not_verified_printer: '승인된 인쇄소만 할 수 있어요.', request_closed: '견적이 마감된 요청이에요.', quote_locked: '이미 결정된 견적이라 수정할 수 없어요.', already_closed: '이미 다른 견적을 수락했거나 마감된 요청이에요.', quote_unavailable: '지금은 처리할 수 없는 견적이에요.', forbidden: '권한이 없어요.', invalid_transition: '지금 단계에서는 바꿀 수 없어요.', ai_limit: '오늘 AI 생성 횟수를 다 썼어요.', invalid_delivery_date: '납품 예상일을 확인해주세요.' };

const chip = ([label, cls]) => `<span class="st ${cls}">${label}</span>`;
const won = n => Number(n || 0).toLocaleString('ko-KR') + '원';
const ymd = d => new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
const dayAfter = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
function errMsg(e) {
  const m = String(e?.message || e || '');
  for (const k in ERR) if (m.includes(k)) return ERR[k];
  if (/fetch|network|timeout|시간/i.test(m)) return '인터넷 연결을 확인해주세요.';
  return '처리하지 못했어요. 잠시 후 다시 시도해주세요.';
}
// supabase 응답 { data, error }를 풀고, 10초가 지나면 시간 초과로 본다
async function q(promise, ms = 10000) {
  let t;
  const r = await Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(Error('시간 초과')), ms) })]).finally(() => clearTimeout(t));
  if (r?.error) throw r.error;
  return r?.data;
}
async function authHeader() {
  if (!REAL) return {};
  const { data } = await sb.auth.getSession();
  return data.session ? { Authorization: 'Bearer ' + data.session.access_token } : {};
}

// ---------- 공통 UI: 데이터 불러오기, 상태 화면, 모달 ----------
const V = {};
let enteredKey = '';
// 화면에 들어올 때마다 새로 불러오고, 같은 화면을 다시 그릴 때는 받아 둔 값을 쓴다
function useData(key, fn) {
  if (enteredKey !== key) { enteredKey = key; delete V[key] }
  if (!V[key]) {
    V[key] = { loading: true };
    fn().then(d => { V[key] = { data: d } }, e => { V[key] = { error: errMsg(e) } }).finally(() => { if (enteredKey === key) render() });
  }
  return V[key];
}
const reload = key => { delete V[key]; enteredKey = ''; render() };
const skeleton = (n = 3) => `<div aria-busy="true" aria-label="불러오는 중">${'<div class="sk sk-card"></div>'.repeat(n)}</div>`;
const errorBox = (msg, key) => `<div class="empty" role="alert"><h2>불러오지 못했어요</h2><p>${esc(msg)}</p><button class="secondary" data-reload="${esc(key)}">다시 시도</button></div>`;
const emptyBox = (title, sub, btn = '') => `<div class="empty-card">${icon('box')}<div><strong>${title}</strong><small>${sub}</small></div>${btn}</div>`;
function stateView(r, key, body) { return r.loading ? skeleton() : r.error ? errorBox(r.error, key) : body(r.data) }

function modal({ title, body, ok, danger = false, onOk }) {
  const prev = document.activeElement;
  const el = document.createElement('div');
  el.className = 'modal-back';
  el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">${title}</h2><div class="modal-body">${body}</div><p class="field-error" role="alert" hidden></p><div class="modal-actions"><button class="secondary" data-x>취소</button><button class="primary${danger ? ' danger' : ''}" data-ok>${ok}</button></div></div>`;
  document.body.append(el);
  const close = () => { el.remove(); prev?.focus?.() };
  el.querySelector('[data-x]').onclick = close;
  el.onclick = e => { if (e.target === el) close() };
  el.onkeydown = e => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { const f = [...el.querySelectorAll('button')]; if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus() } else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus() } }
  };
  const okBtn = el.querySelector('[data-ok]');
  okBtn.onclick = async () => {
    okBtn.disabled = true; okBtn.textContent = '처리 중…';
    try { await onOk(); close() } catch (e) { const p = el.querySelector('.field-error'); p.textContent = errMsg(e); p.hidden = false; okBtn.disabled = false; okBtn.textContent = ok }
  };
  okBtn.focus();
}
const modalOpen = () => !!document.querySelector('.modal-back');

// ---------- 로그인, 가입 ----------
async function loadMe() {
  const { data: { user: u } } = await sb.auth.getUser();
  if (!u) return false;
  const p = await q(sb.from('profiles').select('role,display_name').eq('id', u.id).single());
  uid = u.id; myRole = p.role; user = u.user_metadata?.username || ''; shop = p.display_name;
  if (myRole === 'printer') { myShop = await q(sb.from('print_shops').select('id,name,verified').eq('owner_id', u.id).maybeSingle()); shop = myShop?.name || shop }
  startNotis();
  return true;
}
async function restoreSession() {
  try { const { data } = await sb.auth.getSession(); if (data.session && await loadMe()) { page = myRole === 'printer' ? 'dash' : 'home'; if (myRole === 'owner') state.name = shop; return } } catch {}
  page = 'start';
}
function realAuthForm() {
  if (auth === 'signup') {
    const owner = signupRole === 'owner';
    return `<h1>회원가입</h1><p class="sub">어떤 회원으로 가입할지 골라주세요.</p><div class="choices role-pick" role="radiogroup" aria-label="회원 유형">${[['owner', '소상공인', 'AI로 브랜드를 만들고 인쇄 견적을 받아요'], ['printer', '인쇄소', '제작 요청을 보고 견적을 보내요']].map(([v, l, d]) => `<button type="button" class="choice${signupRole === v ? ' selected' : ''}" role="radio" aria-checked="${signupRole === v}" data-signup-role="${v}"><strong>${l}</strong><small>${d}</small></button>`).join('')}</div>
<form id="real-signup" novalidate>${fld('su-id', '아이디', 'text', 'data-rule="id" maxlength="20" autocomplete="username" autocapitalize="off" placeholder="영문 소문자, 숫자 4~20자"')}${fld('su-pw', '비밀번호', 'password', 'data-rule="pw" maxlength="64" autocomplete="new-password" placeholder="영문+숫자 8자 이상"')}${fld('su-pw2', '비밀번호 확인', 'password', 'data-rule="pw" data-same="su-pw" maxlength="64" autocomplete="new-password"')}${fld('su-shop', owner ? '가게 이름' : '업체명', 'text', `data-rule="shop" maxlength="24" placeholder="${owner ? '예: 몽글빵집' : '예: 대구인쇄'}"`)}<label class="check"><input type="checkbox" id="su-agree" aria-describedby="su-agree-err">시연용 서비스라 입력한 정보가 해커톤 기간 동안 저장되는 것에 동의해요. (필수)</label><p class="field-error" id="su-agree-err" role="alert" hidden></p><p class="field-error" id="su-form-err" role="alert" hidden></p><button class="primary full" type="submit" style="margin-top:12px">가입하기</button></form><div class="auth-links"><span>이미 계정이 있나요?</span><button type="button" class="text-button" data-auth="login">로그인</button></div>`;
  }
  return `<h1>우리 가게만의 캐릭터를 만들어보세요</h1><p class="sub">AI로 브랜드를 만들고, 인쇄소 견적까지 한 번에 받아요.</p><ol class="flow" aria-label="만드는 순서"><li>가게 정보 입력</li><li class="ai-step">AI 브랜드 분석</li><li>캐릭터·홍보물</li><li>인쇄 견적</li></ol><form id="real-login" novalidate>${fld('li-id', '아이디', 'text', 'maxlength="20" autocomplete="username" autocapitalize="off"')}${fld('li-pw', '비밀번호', 'password', 'maxlength="64" autocomplete="current-password"')}<p class="field-error" id="li-form-err" role="alert" hidden></p><button class="primary full" type="submit">로그인 ${icon('arrow')}</button></form><div class="auth-links"><button type="button" class="text-button" data-auth="signup">회원가입</button></div><p class="help" style="text-align:center">비밀번호를 잊으면 운영자에게 문의해주세요. (시연 기간)</p>${QUICK_LOGIN ? `<div class="quick-login"><p>체험용 계정으로 바로 둘러보기</p><button type="button" class="quick-btn" data-quick="owner"><span class="q-ico">${icon('shop')}</span><span><strong>소상공인으로 둘러보기</strong><small>브랜드 만들기, 견적 비교, 채팅</small></span><span class="chev" aria-hidden="true">›</span></button><button type="button" class="quick-btn" data-quick="printer"><span class="q-ico dark">${icon('box')}</span><span><strong>인쇄소로 둘러보기</strong><small>요청 찾기, 견적 보내기, 의뢰 관리</small></span><span class="chev" aria-hidden="true">›</span></button><p class="help">체험 계정은 모두가 함께 써서 다른 사람이 바꾼 내용이 보일 수 있어요.</p></div>` : ''}`;
}
function goHomeAfterLogin() { page = myRole === 'printer' ? 'dash' : 'home'; state = { ...initial(), name: myRole === 'owner' ? shop : '' }; step = 1; render(); scrollTo(0, 0) }
function bindReal() {
  document.querySelectorAll('[data-signup-role]').forEach(b => b.onclick = () => { signupRole = b.dataset.signupRole; const keep = ['su-id', 'su-shop'].map(i => $('#' + i)?.value); render(); ['su-id', 'su-shop'].forEach((i, n) => { if ($('#' + i)) $('#' + i).value = keep[n] || '' }) });
  document.querySelectorAll('[data-quick]').forEach(b => b.onclick = async () => {
    const a = QUICK[b.dataset.quick], all = document.querySelectorAll('[data-quick]');
    all.forEach(x => x.disabled = true); b.querySelector('small').textContent = '들어가는 중…';
    try {
      const { error } = await sb.auth.signInWithPassword({ email: a.id + ID_DOMAIN, password: a.pw });
      if (error) throw error;
      if (!await loadMe()) throw Error('profile');
      goHomeAfterLogin();
    } catch (e) { toast('체험 계정으로 들어가지 못했어요. ' + errMsg(e)); render() }
  });
  if ($('#real-login')) $('#real-login').onsubmit = async e => {
    e.preventDefault();
    const b = e.target.querySelector('[type=submit]'), err = m => { $('#li-form-err').textContent = m; $('#li-form-err').hidden = !m };
    const id = $('#li-id').value.trim().toLowerCase(), pw = $('#li-pw').value;
    if (!id || !pw) return err('아이디와 비밀번호를 적어주세요.');
    b.disabled = true;
    try {
      const { error } = await sb.auth.signInWithPassword({ email: id + ID_DOMAIN, password: pw });
      if (error) { $('#li-pw').value = ''; return err(/rate|many/i.test(error.message) ? '로그인 시도가 너무 많아요. 잠시 후 다시 시도해주세요.' : '아이디 또는 비밀번호가 맞지 않아요.') }
      if (!await loadMe()) throw Error('profile');
      goHomeAfterLogin();
    } catch (e2) { err(errMsg(e2)) } finally { if (b.isConnected) b.disabled = false }
  };
  if ($('#real-signup')) $('#real-signup').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, b = f.querySelector('[type=submit]'), err = m => { $('#su-form-err').textContent = m; $('#su-form-err').hidden = !m };
    if (!checkForm(f)) return;
    if (!$('#su-agree').checked) { setErr('su-agree', '안내를 확인하고 체크해주세요.'); $('#su-agree').focus(); return }
    setErr('su-agree', '');
    const id = $('#su-id').value.trim().toLowerCase(), name = $('#su-shop').value.trim();
    b.disabled = true; b.textContent = '가입하는 중…';
    try {
      if (!await q(sb.rpc('username_available', { p_username: id }))) { setErr('su-id', '이미 쓰고 있는 아이디예요.'); $('#su-id').focus(); return }
      const { error } = await sb.auth.signUp({ email: id + ID_DOMAIN, password: $('#su-pw').value, options: { data: { username: id, role: signupRole, display_name: name, shop_name: name } } });
      if (error) return err(/registered|exists/i.test(error.message) ? '이미 쓰고 있는 아이디예요.' : errMsg(error));
      if (!await loadMe()) throw Error('profile');
      toast(signupRole === 'printer' ? '가입했어요. 운영자 승인 후 견적을 보낼 수 있어요.' : '가입했어요. 첫 브랜드를 만들어보세요.');
      goHomeAfterLogin();
    } catch (e2) { err(errMsg(e2)) } finally { if (b.isConnected) { b.disabled = false; b.textContent = '가입하기' } }
  };
  // 아이디 중복 확인은 칸을 벗어날 때 서버에 묻는다 (목업의 브라우저 확인을 덮어씀)
  if ($('#su-id')) $('#su-id').onblur = async e => {
    const v = e.target.value.trim().toLowerCase(); if (!v) return;
    const m = rules.id(v); if (m) return setErr('su-id', m);
    try { setErr('su-id', await q(sb.rpc('username_available', { p_username: v })) ? '' : '이미 쓰고 있는 아이디예요.') } catch {}
  };
  if ($('#logout')) $('#logout').onclick = async () => { stopChannels(); try { await sb.auth.signOut() } catch {} uid = ''; myRole = 'owner'; myShop = null; notiCount = 0; signOut(); render() };
  if ($('#real-name-form')) $('#real-name-form').onsubmit = async e => {
    e.preventDefault(); const v = $('#my-shop').value.trim(); if (!v || v.length > 24) return toast('이름은 1~24자로 적어주세요.');
    try { await q(sb.from('profiles').update({ display_name: v }).eq('id', uid)); if (myShop) await q(sb.from('print_shops').update({ name: v }).eq('id', myShop.id)); shop = v; render(); toast('이름을 바꿨어요.') } catch (e2) { toast(errMsg(e2)) }
  };
  if ($('#real-pw-form')) $('#real-pw-form').onsubmit = async e => {
    e.preventDefault(); const f = e.target; if ([PUBLIC_DEMO.id, QUICK.printer.id].includes(user) || !checkForm(f)) return;
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    try {
      const { error } = await sb.auth.signInWithPassword({ email: user + ID_DOMAIN, password: $('#pw-cur').value });
      if (error) { setErr('pw-cur', '현재 비밀번호가 맞지 않아요.'); $('#pw-cur').focus(); return }
      await q(sb.auth.updateUser({ password: $('#pw-new').value })); f.reset(); f.closest('details').open = false; toast('비밀번호를 바꿨어요.');
    } catch (e2) { toast(errMsg(e2)) } finally { b.disabled = false }
  };
}
function realMypage() {
  return `<section class="intro"><h1>마이페이지</h1><p>${myRole === 'printer' ? '인쇄소' : '소상공인'} 회원${myRole === 'printer' && !myShop?.verified ? ' · 승인 대기' : ''}</p></section>
<div class="my-list"><div>아이디<small>${esc(user)}</small></div><div>회원 유형<small>${myRole === 'printer' ? '인쇄소' : '소상공인'}</small></div></div>
<div class="my-list"><form class="my-name" id="real-name-form"><input id="my-shop" type="text" maxlength="24" value="${esc(shop)}" aria-label="${myRole === 'printer' ? '업체명' : '가게 이름'}"><button class="secondary" type="submit">이름 변경</button></form></div>
<div class="my-list"><button data-page="notis">알림<small>${notiCount ? notiCount + '개 안 읽음' : '›'}</small></button>${myRole === 'printer' ? '<button data-page="jobs">수락된 의뢰<small>›</small></button>' : '<button data-page="requests">받은 견적<small>›</small></button>'}<button data-page="guide">이용 가이드<small>›</small></button></div>
${[PUBLIC_DEMO.id, QUICK.printer.id].includes(user) ? '<p class="help">공개 체험 계정이라 비밀번호는 바꿀 수 없어요.</p>' : ''}<div class="my-list"${[PUBLIC_DEMO.id, QUICK.printer.id].includes(user) ? ' hidden' : ''}><details><summary>비밀번호 변경</summary><form id="real-pw-form" novalidate>${fld('pw-cur', '현재 비밀번호', 'password', 'maxlength="64" autocomplete="current-password"')}${fld('pw-new', '새 비밀번호', 'password', 'data-rule="pw" maxlength="64" autocomplete="new-password"')}${fld('pw-new2', '새 비밀번호 확인', 'password', 'data-rule="pw" data-same="pw-new" maxlength="64" autocomplete="new-password"')}<button class="primary full" type="submit">변경하기</button></form></details></div>
<div class="my-list"><button id="logout-my">로그아웃<small>›</small></button></div><p class="help">회원 탈퇴는 시연 기간에는 운영자에게 요청해주세요.</p>`;
}

// ---------- 알림 ----------
async function startNotis() {
  try {
    const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    notiCount = count || 0;
    if (notiChannel) sb.removeChannel(notiChannel);
    notiChannel = sb.channel('notis-' + uid).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid }, p => {
      notiCount++; toast(p.new.title);
      if (!modalOpen() && ['requests', 'request', 'dash', 'myquotes', 'jobs', 'notis', 'chats'].includes(page)) reload(enteredKey); else paintBell();
    }).subscribe();
    paintBell();
  } catch {}
}
function paintBell() { const b = $('#bell-count'); if (b) { b.textContent = notiCount > 99 ? '99+' : notiCount; b.hidden = !notiCount } }
function stopChannels() { [notiChannel, quoteChannel].forEach(c => c && sb.removeChannel(c)); notiChannel = quoteChannel = null; if (window.leaveChat) leaveChat() }
const NOTI_GO = { quote_received: n => ['request', n.ref_id], quote_accepted: () => ['chats'], quote_declined: () => ['myquotes'], status_changed: n => myRole === 'owner' ? ['request', n.ref_id] : ['jobs'], message: () => ['chats'] };
function notisPage() {
  const r = useData('notis', async () => {
    const d = await q(sb.from('notifications').select('id,type,ref_id,title,read_at,created_at').order('id', { ascending: false }).limit(50));
    if (d.some(n => !n.read_at)) { await q(sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)); notiCount = 0 }
    return d;
  });
  return `<section class="intro"><h1>알림</h1><p>최근 50개까지 보여줘요.</p></section>${stateView(r, 'notis', d => d.length ? `<div class="list">${d.map(n => `<button class="row-card${n.read_at ? '' : ' unread'}" data-noti="${n.id}"><span>${esc(n.title)}</span><small>${ymd(n.created_at)}</small></button>`).join('')}</div>` : emptyBox('새 알림이 없어요', '견적이 오거나 메시지가 오면 여기에 알려드려요.'))}`;
}

// ---------- 소상공인: 받은 견적 목록, 견적 비교, 제작 요청 ----------
let reqLimit = 20;
const ST_CLS = { open: 'open', accepted: 'acc', in_progress: 'prog', delivered: 'prog', completed: 'done', canceled: 'done', expired: 'done' };
function reqCard(x) {
  const qs = (x.quotations || []).filter(q => q.status !== 'withdrawn'), names = qs.map(q => q.print_shops?.name || '?');
  const tail = x.status === 'open' ? (qs.length ? '견적을 비교하고 업체를 골라보세요' : '인쇄소 견적을 기다리고 있어요') : ['accepted', 'in_progress', 'delivered'].includes(x.status) ? '업체와 제작을 진행하고 있어요' : '진행이 끝난 요청이에요';
  return `<button class="req-card2" data-req="${x.id}"><div class="top"><div><p class="meta" style="margin:0"><b class="${ST_CLS[x.status]}">${REQ_ST[x.status][0]}</b>${ymd(x.created_at)} 요청</p><strong>${esc(x.title)}</strong></div><span class="cnt">견적 ${qs.length}개 ›</span></div><div class="bottom">${names.length ? `<span class="av-stack">${names.slice(0, 3).map(n => `<i>${esc(n.slice(0, 1))}</i>`).join('')}</span>` : ''}<span>${tail}</span></div></button>`;
}
function requestsPage() {
  const r = useData('requests', () => q(sb.from('print_requests').select('id,title,item,status,created_at,quotations!quotations_request_id_fkey(status,print_shops(name))').eq('owner_id', uid).order('created_at', { ascending: false }).range(0, reqLimit)));
  const goNew = `<button class="go-card" data-go-new>${icon('box')}<div><strong>견적을 요청해 보세요</strong><small>여러 인쇄소의 견적을 한 번에 비교할 수 있어요</small></div><span class="chev" aria-hidden="true">›</span></button>`;
  return stateView(r, 'requests', d => {
    const open = d.slice(0, reqLimit).filter(x => x.status === 'open'), rest = d.slice(0, reqLimit).filter(x => x.status !== 'open');
    return `<h2 class="sec-label">견적 받는 중</h2>${goNew}${open.map(reqCard).join('')}
${rest.length ? `<h2 class="sec-label">요청 마감<small>견적 받기가 끝났어요</small></h2>${rest.map(reqCard).join('')}` : ''}${d.length > reqLimit ? '<button class="secondary full" data-more="requests">더 보기</button>' : ''}`;
  });
}
async function loadRequest(id) {
  const req = await q(sb.from('print_requests').select('*').eq('id', id).single());
  const [quotes, conv, prev] = await Promise.all([
    q(sb.from('quotations').select('id,unit_price,quantity,total_price,shipping_fee,production_days,delivery_date,note,status,print_shops(name,region_sido,region_sigungu,items,intro)').eq('request_id', id)),
    q(sb.from('conversations').select('id').eq('request_id', id).maybeSingle()),
    sb.storage.from('request-previews').createSignedUrl(req.preview_path, 300)
  ]);
  return { req, quotes, conv, preview: prev.data?.signedUrl };
}
function watchQuotes(id) {
  if (quoteChannel?.topic === 'realtime:quotes-' + id) return;
  if (quoteChannel) sb.removeChannel(quoteChannel);
  quoteChannel = sb.channel('quotes-' + id).on('postgres_changes', { event: '*', schema: 'public', table: 'quotations', filter: 'request_id=eq.' + id }, () => { if (page === 'request' && !modalOpen()) reload('request-' + id) }).subscribe();
}
function specLine(x) { return `${x.item === 'other' ? esc(x.item_other) : ITEM[x.item]} · ${Number(x.quantity).toLocaleString()}개 · ${x.width}×${x.height}${x.unit} · ${esc(x.material)}${x.finishing?.length ? ' · ' + x.finishing.map(esc).join(', ') : ''}` }
function requestPage() {
  watchQuotes(reqId);
  const r = useData('request-' + reqId, () => loadRequest(reqId));
  return stateView(r, 'request-' + reqId, ({ req, quotes, conv, preview }) => {
    const live = quotes.filter(x => x.status !== 'withdrawn');
    const sorted = [...live].sort(quoteSort === 'total' ? (a, b) => (a.total_price + a.shipping_fee) - (b.total_price + b.shipping_fee) : (a, b) => a.delivery_date.localeCompare(b.delivery_date));
    const steps = ['accepted', 'in_progress', 'delivered', 'completed'], at = steps.indexOf(req.status);
    return `<button class="text-button" data-page="requests">${icon('back')}받은 견적</button>
<section class="req-head">${preview ? `<img src="${esc(preview)}" alt="${esc(req.title)} 디자인 미리보기">` : ''}<div>${chip(REQ_ST[req.status])}<h1>${esc(req.title)}</h1><p>${specLine(req)}</p><small>희망 납기 ${ymd(req.due_date)} · 견적 마감 ${ymd(req.quote_deadline)}</small><small>배송 ${esc(req.region_sido)} ${esc(req.region_sigungu)}</small></div></section>
${at >= 0 ? `<ol class="progress">${['업체 선택', '제작 중', '납품', '완료'].map((l, i) => `<li class="${i <= at ? 'done' : ''}">${l}</li>`).join('')}</ol><div class="actions">${conv ? `<button class="primary" data-chat="${conv.id}">${icon('chat')}채팅하기</button>` : ''}${req.status === 'delivered' ? `<button class="secondary" data-complete="${req.id}">완료 확인</button>` : ''}</div>` : ''}
<div class="section-head"><h2>견적 ${live.length}개</h2>${live.length > 1 ? `<div class="seg">${[['total', '총액순'], ['date', '빠른 납기순']].map(([v, l]) => `<button class="${quoteSort === v ? 'on' : ''}" data-sort="${v}">${l}</button>`).join('')}</div>` : ''}</div>
${live.length ? sorted.map(x => `<article class="quote-card${x.status === 'accepted' ? ' picked' : ''}"><header><div><strong>${esc(x.print_shops?.name || '인쇄소')}</strong><small>${esc(x.print_shops?.region_sido || '')} ${esc(x.print_shops?.region_sigungu || '')}</small></div>${x.status !== 'submitted' ? chip(Q_ST[x.status]) : ''}</header>
<div class="nums"><div><small>총액 (배송비 포함)</small><b>${won(x.total_price + x.shipping_fee)}</b></div><div><small>배송비</small><b>${won(x.shipping_fee)}</b></div><div><small>납품 예상</small><b>${ymd(x.delivery_date)}</b></div></div>
<p class="price-row">${won(x.unit_price)} × ${Number(x.quantity).toLocaleString()}개 = ${won(x.total_price)} · 제작 ${x.production_days}일</p>${x.note ? `<p class="quote-note">${esc(x.note)}</p>` : ''}
${req.status === 'open' && x.status === 'submitted' ? `<button class="primary full" data-accept="${x.id}" data-shop="${esc(x.print_shops?.name || '')}" data-total="${x.total_price + x.shipping_fee}" data-date="${x.delivery_date}">이 견적 수락</button>` : ''}</article>`).join('')
        : emptyBox(req.status === 'open' ? '견적을 기다리고 있어요' : '받은 견적이 없어요', req.status === 'open' ? '인쇄소가 견적을 보내면 알림으로 알려드려요.' : '')}
${req.status === 'open' ? `<button class="text-button danger-text" data-cancel="${req.id}">요청 취소</button>` : ''}`;
  });
}

// 제작 요청 폼: 디자인은 지금 만든 스티커(1600px PNG) 또는 직접 올린 이미지
function newreqPage() {
  const d = reqDraft, hasBrand = !!(state.name && (state.customImage || state.industry));
  if (!d.title) d.title = (state.name || shop || '우리 가게') + ' ' + ITEM[d.item];
  const opt = (arr, v) => arr.map(x => `<option${x === v ? ' selected' : ''}>${x}</option>`).join('');
  return `<button class="text-button" data-page="requests">${icon('back')}받은 견적</button><section class="intro"><h1>제작 견적 요청</h1><p>인쇄소들이 이 내용을 보고 견적을 보내요. 가게 이름, 연락처는 공개되지 않아요.</p></section>
<form id="req-form" class="panel" novalidate>
<fieldset class="field"><legend>제작 품목</legend><div class="choices">${Object.entries(ITEM).map(([v, l]) => `<button type="button" class="choice${d.item === v ? ' selected' : ''}" data-req-item="${v}" aria-pressed="${d.item === v}">${l}</button>`).join('')}</div>${d.item === 'other' ? fld('rq-other', '품목 이름', 'text', `maxlength="30" value="${esc(d.item_other)}"`) : ''}</fieldset>
<div class="field"><label>디자인 이미지</label><div class="design-pick">${uploadFile ? `<img id="rq-thumb" alt="올린 디자인">` : hasBrand ? `<img src="${svgUri(stickerSVG())}" alt="지금 만든 스티커 디자인">` : `<div class="design-empty">${icon('image')}</div>`}<div><p class="help" style="margin:0 0 8px">${uploadFile ? esc(uploadFile.name) : hasBrand ? '지금 만든 스티커를 1600px PNG로 첨부해요.' : '브랜드를 만들거나 이미지를 올려주세요.'}</p><label class="secondary file-btn">${icon('image')}${hasBrand || uploadFile ? '다른 이미지 올리기' : '이미지 올리기'}<input type="file" id="rq-file" accept="image/png,image/jpeg,image/webp" hidden></label><small class="help">PNG, JPG, WebP · 10MB 이하</small></div></div><p class="field-error" id="rq-file-err" role="alert" hidden></p></div>
${fld('rq-title', '요청 제목', 'text', `maxlength="40" value="${esc(d.title)}"`)}
<div class="grid2">${fld('rq-qty', '제작 수량 (개)', 'number', `min="1" max="100000" inputmode="numeric" value="${d.quantity}"`)}<div class="field"><label for="rq-unit">단위</label><select id="rq-unit">${['mm', 'cm'].map(u => `<option${u === d.unit ? ' selected' : ''}>${u}</option>`).join('')}</select></div></div>
<div class="grid2">${fld('rq-w', '가로', 'number', `min="1" max="2000" step="0.1" inputmode="decimal" value="${d.width}"`)}${fld('rq-h', '세로', 'number', `min="1" max="2000" step="0.1" inputmode="decimal" value="${d.height}"`)}</div>
<div class="field"><label for="rq-mat">인쇄 재질</label><select id="rq-mat">${opt(MATERIALS, d.material)}</select></div>
<fieldset class="field"><legend>코팅, 후가공 <small>선택</small></legend><div class="choices wrap">${FINISH.map(x => `<button type="button" class="choice${d.finishing.includes(x) ? ' selected' : ''}" data-finish="${x}" aria-pressed="${d.finishing.includes(x)}">${x}</button>`).join('')}</div></fieldset>
<div class="grid2">${fld('rq-due', '희망 납기', 'date', `min="${dayAfter(3)}" value="${d.due || dayAfter(14)}"`)}${fld('rq-deadline', '견적 마감', 'date', `min="${dayAfter(1)}" value="${d.deadline || dayAfter(3)}"`)}</div>
<div class="grid2"><div class="field"><label for="rq-sido">배송 지역</label><select id="rq-sido">${opt(SIDO, d.region_sido)}</select></div>${fld('rq-sigungu', '시/군/구', 'text', `maxlength="20" placeholder="예: 북구" value="${esc(d.region_sigungu)}"`)}</div>
<div class="field"><label for="rq-note">추가 요청사항 <small>선택</small></label><textarea id="rq-note" maxlength="500" placeholder="예: 원형 재단, 흰 테두리 2mm">${esc(d.note)}</textarea></div>
<p class="help">상세 주소와 연락처는 업체를 고른 뒤 채팅으로 주고받아요.</p><p class="field-error" id="rq-form-err" role="alert" hidden></p>
<button class="primary full" type="submit">견적 요청 보내기</button></form>`;
}
function syncReq() {
  const v = id => $('#' + id)?.value, d = reqDraft;
  if ($('#rq-title')) Object.assign(d, { title: v('rq-title'), quantity: v('rq-qty'), unit: v('rq-unit'), width: v('rq-w'), height: v('rq-h'), material: v('rq-mat'), due: v('rq-due'), deadline: v('rq-deadline'), region_sido: v('rq-sido'), region_sigungu: v('rq-sigungu'), note: v('rq-note'), item_other: v('rq-other') ?? d.item_other });
}
function checkReq() {
  syncReq();
  const d = reqDraft, errs = [];
  const need = (id, ok, msg) => { setErr(id, ok ? '' : msg); if (!ok) errs.push(id) };
  if (d.item === 'other') need('rq-other', d.item_other?.trim(), '품목 이름을 적어주세요.');
  need('rq-title', d.title.trim() && d.title.trim().length <= 40, '요청 제목을 적어주세요.');
  need('rq-qty', Number.isInteger(+d.quantity) && +d.quantity >= 1 && +d.quantity <= 100000, '수량은 1~100,000개로 적어주세요.');
  need('rq-w', +d.width >= 1 && +d.width <= 2000, '가로 크기를 확인해주세요.');
  need('rq-h', +d.height >= 1 && +d.height <= 2000, '세로 크기를 확인해주세요.');
  need('rq-due', d.due >= dayAfter(3), '희망 납기는 3일 뒤부터 고를 수 있어요.');
  need('rq-deadline', d.deadline >= dayAfter(1) && d.deadline <= d.due, '견적 마감은 내일부터 희망 납기 사이로 골라주세요.');
  need('rq-sigungu', d.region_sigungu.trim(), '시/군/구를 적어주세요.');
  const hasDesign = uploadFile || (state.name && (state.customImage || state.industry));
  setErr('rq-file', hasDesign ? '' : '디자인 이미지를 올려주세요.'); if (!hasDesign) errs.push('rq-file');
  if (errs[0]) $('#' + errs[0])?.focus();
  return !errs.length;
}
// 이미지 → canvas. 원본은 긴 변 1600px PNG, 미리보기는 1000px에 워터마크
function loadImg(src) { return new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src }) }
async function toBlob(img, max, watermark, type) {
  const s = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height)) || 1;
  const c = document.createElement('canvas'); c.width = Math.round((img.naturalWidth || img.width) * s); c.height = Math.round((img.naturalHeight || img.height) * s);
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
  if (watermark) { x.save(); x.translate(c.width / 2, c.height / 2); x.rotate(-Math.PI / 6); x.font = `bold ${Math.round(c.width / 14)}px sans-serif`; x.fillStyle = 'rgba(0,0,0,.18)'; x.textAlign = 'center'; for (let i = -2; i <= 2; i++) x.fillText('가게온 견적용 미리보기', 0, i * c.height / 4); x.restore() }
  return new Promise(ok => c.toBlob(ok, type, .85));
}
async function submitRequest(btn) {
  const d = reqDraft, id = crypto.randomUUID(), done = [];
  const label = t => { btn.textContent = t };
  btn.disabled = true;
  try {
    label('디자인 준비 중…');
    let src;
    if (uploadFile) src = URL.createObjectURL(uploadFile);
    else { const svg = stickerSVG().replace('width="800" height="800"', 'width="1600" height="1600"'); src = svgUri(svg); await document.fonts.ready }
    const img = await loadImg(src);
    const original = uploadFile && uploadFile.type !== 'image/webp' ? uploadFile : await toBlob(img, 1600, false, 'image/png');
    let preview = await toBlob(img, 1000, true, 'image/webp');
    const pext = preview.type === 'image/webp' ? 'webp' : 'png';
    const oext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[original.type] || 'png';
    const dpath = `${uid}/${id}/original.${oext}`, ppath = `${uid}/${id}.${pext}`;
    label('파일 올리는 중…');
    await q(sb.storage.from('request-files').upload(dpath, original, { contentType: original.type }), 60000); done.push(['request-files', dpath]);
    await q(sb.storage.from('request-previews').upload(ppath, preview, { contentType: preview.type }), 60000); done.push(['request-previews', ppath]);
    label('요청 등록 중…');
    await q(sb.from('print_requests').insert({
      id, owner_id: uid, title: d.title.trim(), item: d.item, item_other: d.item === 'other' ? d.item_other.trim() : null,
      quantity: +d.quantity, width: +d.width, height: +d.height, unit: d.unit, material: d.material, finishing: d.finishing,
      due_date: d.due, quote_deadline: new Date(d.deadline + 'T23:59:00').toISOString(), region_sido: d.region_sido,
      region_sigungu: d.region_sigungu.trim(), note: d.note.trim() || null, design_path: dpath, preview_path: ppath
    }));
    if (uploadFile) URL.revokeObjectURL(src);
    uploadFile = null; reqDraft = { ...reqDraft, title: '', note: '' };
    toast('견적 요청을 보냈어요. 인쇄소 견적이 오면 알려드려요.');
    reqId = id; page = 'request'; render(); scrollTo(0, 0);
  } catch (e) {
    for (const [b, p] of done) sb.storage.from(b).remove([p]).catch(() => {});   // 등록 실패 시 올린 파일 정리
    const m = $('#rq-form-err'); if (m) { m.textContent = errMsg(e); m.hidden = false }
    btn.disabled = false; label('견적 요청 보내기');
  }
}

// ---------- 인쇄소: 대시보드, 요청 찾기, 견적 작성, 보낸 견적, 수락된 의뢰 ----------
// 마감까지 남은 날
const dday = d => { const n = Math.ceil((new Date(d) - Date.now()) / 864e5); return n <= 0 ? '오늘 마감' : 'D-' + n };
function dashPage() {
  const r = useData('dash', async () => {
    const [open, mine, jobs, convs] = await Promise.all([
      myShop?.verified ? q(sb.rpc('list_open_requests', { p_limit: 50 })) : [], q(sb.rpc('my_quotes')),
      q(sb.from('print_requests').select('id,title,status,due_date').neq('owner_id', uid).in('status', ['accepted', 'in_progress', 'delivered']).order('due_date')),
      q(sb.rpc('my_conversations'))]);
    const fresh = open.filter(x => !x.my_quote_status);
    fresh.forEach(x => { marketItems[x.id] = x });
    const signed = fresh.length ? (await sb.storage.from('request-previews').createSignedUrls(fresh.slice(0, 6).map(x => x.preview_path), 300)).data || [] : [];
    const decided = mine.filter(x => ['accepted', 'declined'].includes(x.status));
    return { fresh, urls: Object.fromEntries(signed.map(x => [x.path, x.signedUrl])), mine, jobs, convs,
      rate: decided.length ? Math.round(decided.filter(x => x.status === 'accepted').length / decided.length * 100) : null };
  });
  const head = `<section class="shop-hero"><span class="avatar">${esc((shop || '?').slice(0, 1))}</span><div><strong>${esc(shop)}</strong><small>${myShop?.verified ? '<b class="ok">승인된 인쇄소</b>' : '<b class="wait">승인 대기 중</b>'} · 새 요청에 견적을 보내 의뢰를 받아요</small></div></section>`;
  if (!myShop?.verified) return head + emptyBox('운영자 승인을 기다리고 있어요', '승인되면 소상공인의 제작 요청을 보고 견적을 보낼 수 있어요.');
  const next = { accepted: '제작 시작하기', in_progress: '납품 완료 알리기', delivered: '소상공인 확인 대기' };
  return head + stateView(r, 'dash', d => {
    const waiting = d.mine.filter(x => x.status === 'submitted').length, unread = d.convs.reduce((a, c) => a + Number(c.unread), 0);
    return `<div class="kpi-row">${[['market', '새 요청', d.fresh.length], ['myquotes', '검토 중 견적', waiting], ['jobs', '진행 중', d.jobs.length], ['myquotes', '수락률', d.rate === null ? '-' : d.rate + '%']].map(([p, l, n]) => `<button data-page="${p}"><b>${n}</b><small>${l}</small></button>`).join('')}</div>
<div class="section-head"><h2>새로 올라온 요청</h2>${d.fresh.length ? '<button class="text-button" data-page="market">전체 보기</button>' : ''}</div>
${d.fresh.length ? `<div class="h-scroll">${d.fresh.slice(0, 6).map(x => `<button class="mini-req" data-quote="${x.id}"><div class="thumb">${d.urls[x.preview_path] ? `<img src="${esc(d.urls[x.preview_path])}" alt="" loading="lazy">` : ''}<span class="dday">${dday(x.quote_deadline)}</span></div><strong>${esc(x.title)}</strong><small>${x.item === 'other' ? esc(x.item_other) : ITEM[x.item]} · ${Number(x.quantity).toLocaleString()}개</small><small>${esc(x.region_sido)} ${esc(x.region_sigungu)}</small></button>`).join('')}</div>`
      : `<div class="go-card" style="cursor:default">${icon('search')}<div><strong>지금은 새 요청이 없어요</strong><small>요청이 올라오면 알림으로 알려드려요</small></div></div>`}
<div class="section-head"><h2>진행 중인 의뢰</h2>${d.jobs.length ? '<button class="text-button" data-page="jobs">관리</button>' : ''}</div>
${d.jobs.length ? `<div class="list">${d.jobs.slice(0, 3).map(x => `<button class="job-row" data-page="jobs"><div><strong>${esc(x.title)}</strong><small>납기 ${ymd(x.due_date)} · ${next[x.status]}</small></div>${chip(REQ_ST[x.status])}</button>`).join('')}</div>`
      : `<div class="go-card" style="cursor:default">${icon('box')}<div><strong>진행 중인 의뢰가 없어요</strong><small>견적이 수락되면 여기에서 제작 상태를 관리해요</small></div></div>`}
<div class="section-head"><h2>최근 채팅</h2>${unread ? `<span class="badge">${unread}</span>` : ''}</div>
${d.convs.length ? `<div class="list">${d.convs.slice(0, 2).map(c => `<button class="chat-row" data-chat="${c.id}"><span class="avatar">${esc((c.other_name || '?').slice(0, 1))}</span><div><strong>${esc(c.other_name)}</strong><small>${esc(c.title)}</small><p>${esc(c.last_body || '대화를 시작해 보세요')}</p></div><div class="meta"><small>${chatTime(c.last_at)}</small>${Number(c.unread) ? `<i class="badge">${c.unread}</i>` : ''}</div></button>`).join('')}</div>`
      : `<p class="help">견적이 수락되면 소상공인과 채팅할 수 있어요.</p>`}`;
  });
}
let marketLimit = 20;
function marketPage() {
  const key = 'market-' + marketFilter;
  const r = useData(key, async () => {
    if (!myShop?.verified) return { rows: [], urls: {} };
    const rows = await q(sb.rpc('list_open_requests', { p_item: marketFilter || null, p_limit: marketLimit + 1, p_offset: 0 }));
    rows.forEach(x => { marketItems[x.id] = x });
    const signed = rows.length ? (await sb.storage.from('request-previews').createSignedUrls(rows.map(x => x.preview_path), 300)).data || [] : [];
    return { rows, urls: Object.fromEntries(signed.map(s => [s.path, s.signedUrl])) };
  });
  return `<section class="intro"><h1>요청 찾기</h1><p>견적 마감이 가까운 순서예요.</p></section><div class="chip-row">${[['', '전체'], ...Object.entries(ITEM)].map(([v, l]) => `<button class="choice${marketFilter === v ? ' selected' : ''}" data-market="${v}" aria-pressed="${marketFilter === v}">${l}</button>`).join('')}</div>
${!myShop?.verified ? emptyBox('승인 대기 중이에요', '운영자가 업체를 확인하면 요청을 볼 수 있어요.') : stateView(r, key, ({ rows, urls }) => rows.length ? `<div class="grid-cards">${rows.slice(0, marketLimit).map(x => `<button class="market-card" data-quote="${x.id}"><div class="thumb">${urls[x.preview_path] ? `<img src="${esc(urls[x.preview_path])}" alt="" loading="lazy">` : ''}${x.my_quote_status ? `<span class="st st-acc">견적 보냄</span>` : ''}</div><strong>${esc(x.title)}</strong><small>${x.item === 'other' ? esc(x.item_other) : ITEM[x.item]} · ${Number(x.quantity).toLocaleString()}개</small><small>${esc(x.region_sido)} ${esc(x.region_sigungu)} · 마감 ${ymd(x.quote_deadline)}</small></button>`).join('')}</div>${rows.length > marketLimit ? '<button class="secondary full" data-more="market">더 보기</button>' : ''}` : emptyBox('지금 열린 요청이 없어요', '새 요청이 올라오면 알림으로 알려드려요.'))}`;
}
function quotePage() {
  const r = useData('quote-' + reqId, async () => {
    let x = marketItems[reqId];
    if (!x) { const rows = await q(sb.rpc('list_open_requests', { p_limit: 50 })); x = rows.find(y => y.id === reqId) }
    const mine = await q(sb.from('quotations').select('*').eq('request_id', reqId).maybeSingle());
    const url = x ? (await sb.storage.from('request-previews').createSignedUrl(x.preview_path, 300)).data?.signedUrl : null;
    return { x, mine, url };
  });
  return `<button class="text-button" data-page="market">${icon('back')}요청 찾기</button>` + stateView(r, 'quote-' + reqId, ({ x, mine, url }) => {
    if (!x) return emptyBox('마감됐거나 볼 수 없는 요청이에요', '견적 마감이 지났거나 다른 업체로 정해졌어요.', '<button class="secondary" data-page="myquotes">보낸 견적 보기</button>');
    const locked = mine && !['submitted', 'withdrawn'].includes(mine.status), m = mine || {};
    return `<section class="req-head">${url ? `<img src="${esc(url)}" alt="요청 디자인 미리보기">` : ''}<div>${chip(REQ_ST.open)}<h1>${esc(x.title)}</h1><p>${specLine(x)}</p><small>희망 납기 ${ymd(x.due_date)} · 견적 마감 ${ymd(x.quote_deadline)}</small><small>배송 ${esc(x.region_sido)} ${esc(x.region_sigungu)}</small>${x.note ? `<p class="quote-note">${esc(x.note)}</p>` : ''}</div></section>
<form id="quote-form" class="panel" novalidate><div class="panel-title">${mine ? '내 견적 수정' : '견적 작성'}${mine ? chip(Q_ST[mine.status]) : ''}</div>
<div class="grid2">${fld('qt-unit', '제작 단가 (원)', 'number', `min="0" inputmode="numeric" value="${m.unit_price ?? ''}" ${locked ? 'disabled' : ''}`)}${fld('qt-qty', '제작 수량 (개)', 'number', `min="1" inputmode="numeric" value="${m.quantity ?? x.quantity}" ${locked ? 'disabled' : ''}`)}</div>
<p class="total-line">총 제작금액 <b id="qt-total">${won((m.unit_price || 0) * (m.quantity || x.quantity))}</b></p>
<div class="grid2">${fld('qt-ship', '배송비 (원)', 'number', `min="0" inputmode="numeric" value="${m.shipping_fee ?? 3000}" ${locked ? 'disabled' : ''}`)}${fld('qt-days', '예상 제작 기간 (일)', 'number', `min="1" max="90" inputmode="numeric" value="${m.production_days ?? 5}" ${locked ? 'disabled' : ''}`)}</div>
${fld('qt-date', '납품 예상일', 'date', `min="${dayAfter(0)}" value="${m.delivery_date ?? dayAfter(7)}" ${locked ? 'disabled' : ''}`)}
<div class="field"><label for="qt-note">추가 조건, 비고 <small>선택</small></label><textarea id="qt-note" maxlength="500" ${locked ? 'disabled' : ''}>${esc(m.note || '')}</textarea></div>
<p class="help">다른 인쇄소는 내 견적 금액을 볼 수 없어요.<br>총액은 단가 × 수량으로 계산돼요.</p>
${locked ? '' : `<button class="primary full" type="submit">${mine ? '견적 수정하기' : '견적 보내기'}</button>${mine?.status === 'submitted' ? `<button type="button" class="text-button danger-text" data-withdraw="${mine.id}">견적 철회</button>` : ''}`}</form>`;
  });
}
function myquotesPage() {
  const r = useData('myquotes', () => q(sb.rpc('my_quotes')));
  const tail = x => x.status === 'accepted' ? '수락됐어요. 의뢰인과 채팅해 보세요' : x.status === 'declined' ? '다른 업체로 정해졌어요' : x.status === 'withdrawn' ? '철회한 견적이에요' : x.request_status === 'open' ? '의뢰인이 견적을 비교하고 있어요' : '요청이 마감됐어요';
  const cls = { submitted: 'open', accepted: 'acc', declined: 'done', withdrawn: 'done' };
  return stateView(r, 'myquotes', d => d.length ? `<h2 class="sec-label">보낸 견적 ${d.length}건<small>수락되면 채팅이 열려요</small></h2>${d.map(x => `<button class="req-card2" data-myquote="${x.request_id}" data-st="${x.status}" data-rst="${x.request_status}"><div class="top"><div><p class="meta" style="margin:0"><b class="${cls[x.status]}">${Q_ST[x.status][0]}</b>${ymd(x.updated_at)}</p><strong>${esc(x.title)}</strong><small class="sub">${ITEM[x.item]} · ${Number(x.quantity).toLocaleString()}개 · 납품 ${ymd(x.delivery_date)}</small></div><span class="cnt">${won(x.total_price + x.shipping_fee)} ›</span></div><div class="bottom"><span>${tail(x)}</span></div></button>`).join('')}`
    : emptyBox('보낸 견적이 없어요', '요청 찾기에서 견적을 보내보세요.', '<button class="secondary" data-page="market">요청 찾기</button>'));
}
function jobsPage() {
  const r = useData('jobs', async () => {
    const rows = await q(sb.from('print_requests').select('id,owner_id,title,item,item_other,quantity,width,height,unit,material,finishing,due_date,region_sido,region_sigungu,note,status,design_path,preview_path').neq('owner_id', uid).order('due_date'));
    if (!rows.length) return [];
    const [convs, people, signed] = await Promise.all([
      q(sb.from('conversations').select('id,request_id').in('request_id', rows.map(x => x.id))),
      q(sb.from('profiles').select('id,display_name').in('id', [...new Set(rows.map(x => x.owner_id))])),
      sb.storage.from('request-previews').createSignedUrls(rows.map(x => x.preview_path), 300)]);
    const urls = Object.fromEntries((signed.data || []).map(x => [x.path, x.signedUrl]));
    return rows.map(x => ({ ...x, conv: convs.find(c => c.request_id === x.id)?.id, client: people.find(p => p.id === x.owner_id)?.display_name, url: urls[x.preview_path] }));
  });
  const next = { accepted: ['in_progress', '제작 시작하기', '제작을 시작할까요?'], in_progress: ['delivered', '납품 완료 알리기', '납품 완료로 바꿀까요?'] };
  const steps = ['accepted', 'in_progress', 'delivered', 'completed'];
  const active = d => d.filter(x => x.status !== 'completed'), done = d => d.filter(x => x.status === 'completed');
  const card = x => `<article class="job-card">
<div class="job-top"><div class="job-info"><p class="meta"><b class="${ST_CLS[x.status]}">${REQ_ST[x.status][0]}</b>납기 ${ymd(x.due_date)}${x.status !== 'completed' ? ` · ${dday(x.due_date).replace('오늘 마감', '오늘')}` : ''}</p><strong>${esc(x.title)}</strong><small>${specLine(x)}</small><small>의뢰인 ${esc(x.client || '소상공인')} · ${esc(x.region_sido)} ${esc(x.region_sigungu)}</small></div>${x.url ? `<img src="${esc(x.url)}" alt="${esc(x.title)} 디자인" loading="lazy">` : ''}</div>
<ol class="progress">${['업체 선택', '제작 중', '납품', '완료'].map((l, i) => `<li class="${i <= steps.indexOf(x.status) ? 'done' : ''}">${l}</li>`).join('')}</ol>
${x.note ? `<p class="quote-note">${esc(x.note)}</p>` : ''}
<div class="job-links"><button data-original="${esc(x.design_path)}">${icon('download')}원본 파일</button>${x.conv ? `<button data-chat="${x.conv}">${icon('chat')}채팅하기</button>` : ''}</div>
${next[x.status] ? `<button class="primary full" data-advance="${x.id}" data-to="${next[x.status][0]}" data-ask="${next[x.status][2]}">${next[x.status][1]}</button>` : x.status === 'delivered' ? '<p class="job-wait">소상공인이 받았는지 확인하면 완료돼요</p>' : ''}</article>`;
  return stateView(r, 'jobs', d => d.length ? `<h2 class="sec-label">진행 중 ${active(d).length}건</h2>${active(d).map(card).join('') || '<p class="help">진행 중인 의뢰가 없어요.</p>'}${done(d).length ? `<h2 class="sec-label">완료<small>제작이 끝난 의뢰예요</small></h2>${done(d).map(card).join('')}` : ''}`
    : emptyBox('수락된 의뢰가 없어요', '견적이 수락되면 여기에서 원본을 받고 제작 상태를 알려요.', '<button class="secondary" data-page="market">요청 찾기</button>'));
}

// ---------- 페이지 등록, 이벤트 ----------
const PAGES = REAL ? { dash: dashPage, market: marketPage, quote: quotePage, myquotes: myquotesPage, jobs: jobsPage, requests: requestsPage, newreq: newreqPage, request: requestPage, notis: notisPage, mypage: realMypage } : {};
function navItems() {
  if (REAL && myRole === 'printer') return [['dash', 'home', '대시보드'], ['market', 'search', '요청 찾기'], ['myquotes', 'folder', '보낸 견적'], ['chats', 'chat', '채팅'], ['mypage', 'user', '마이']];
  if (REAL) return [['home', 'home', '홈'], ['saved', 'folder', '내 브랜드'], ['requests', 'box', '받은 견적'], ['chats', 'chat', '채팅'], ['mypage', 'user', '마이']];
  return [['home', 'home', '홈'], ['saved', 'folder', '내 브랜드'], ['mypage', 'user', '마이페이지']];
}
// 화면 제목을 상단 바에 크게 쓰는 화면 (본문 첫 제목은 숨김)
const APP_TITLE_PAGES = ['saved', 'requests', 'chats', 'mypage', 'notis', 'dash', 'market', 'myquotes', 'jobs', 'newreq', 'guide'];
function appBar() {
  const title = { saved: '내 브랜드', mypage: '마이페이지', studio: '브랜드 만들기', guide: '이용 가이드', ...PAGE_LABEL }[page];
  const left = title ? `<h1 class="app-title">${esc(title)}</h1>` : `<h1 class="app-title brand"><span class="logo-mark">${icon('shop')}</span>가게온</h1>`;
  // #logout은 마이페이지 '로그아웃' 버튼이 누르는 숨은 버튼
  return `<header class="app-bar">${left}<div class="app-actions">${bellButton()}<button class="icon-btn" data-page="mypage" aria-label="마이페이지">${icon('user')}</button><button id="logout" hidden></button></div></header>`;
}
// 메뉴에 없는 하위 화면은 속한 메뉴 칸을 켜 둔다 (수락된 의뢰 → 대시보드 등)
const NAV_PARENT = { jobs: 'dash', quote: 'market', request: 'requests', newreq: 'requests', chat: 'chats', studio: 'home', notis: 'mypage', guide: 'mypage' };
const navTab = () => { const p = NAV_PARENT[page] || page; return p === 'requests' && !REAL ? 'home' : p };
function bellButton() { return REAL ? `<button class="bell" data-page="notis" aria-label="알림">${icon('bell')}<i id="bell-count" ${notiCount ? '' : 'hidden'}>${notiCount}</i></button>` : '' }
function bindPrint() {
  if (REAL) bindReal();
  if (page !== 'request' && quoteChannel) { sb.removeChannel(quoteChannel); quoteChannel = null }
  if (page !== 'chat' && window.leaveChat) leaveChat();
  if (page === 'chat' && window.mountChat) mountChat();
  document.querySelectorAll('[data-reload]').forEach(b => b.onclick = () => reload(b.dataset.reload));
  document.querySelectorAll('[data-more]').forEach(b => b.onclick = () => { if (b.dataset.more === 'market') marketLimit += 20; else reqLimit += 20; reload(enteredKey) });
  if ($('#to-request')) $('#to-request').onclick = () => { if (!REAL) return toast('실제 계정으로 로그인하면 견적을 받을 수 있어요.'); syncForm?.(); page = 'newreq'; render(); scrollTo(0, 0) };
  document.querySelectorAll('[data-go-new]').forEach(b => b.onclick = () => { page = 'newreq'; render(); scrollTo(0, 0) });
  document.querySelectorAll('[data-req]').forEach(b => b.onclick = () => { reqId = b.dataset.req; page = 'request'; render(); scrollTo(0, 0) });
  document.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { quoteSort = b.dataset.sort; render() });
  document.querySelectorAll('[data-chat]').forEach(b => b.onclick = () => { convId = b.dataset.chat; page = 'chat'; render(); scrollTo(0, 0) });
  document.querySelectorAll('[data-accept]').forEach(b => b.onclick = () => modal({
    title: '이 견적을 수락할까요?', ok: '수락하기',
    body: `<p><b>${esc(b.dataset.shop)}</b> · 총 ${won(b.dataset.total)} · ${ymd(b.dataset.date)} 납품 예상</p><p class="help">수락하면 다른 견적은 자동으로 거절되고, 이 업체와 채팅이 열려요. 되돌릴 수 없어요.</p>`,
    onOk: async () => { convId = await q(sb.rpc('accept_quotation', { p_quote: b.dataset.accept })); toast('견적을 수락했어요. 채팅을 시작해 보세요.'); page = 'chat'; setTimeout(() => { render(); scrollTo(0, 0) }) }
  }));
  document.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => modal({ title: '요청을 취소할까요?', ok: '요청 취소', danger: true, body: '<p class="help">받은 견적은 모두 거절 처리되고 되돌릴 수 없어요.</p>', onOk: async () => { await q(sb.rpc('cancel_request', { p_request: b.dataset.cancel })); toast('요청을 취소했어요.'); setTimeout(() => reload('request-' + reqId)) } }));
  document.querySelectorAll('[data-complete]').forEach(b => b.onclick = () => modal({ title: '제작 완료를 확인할까요?', ok: '완료 확인', body: '<p class="help">물건을 받았으면 완료로 바꿔주세요.</p>', onOk: async () => { await q(sb.rpc('advance_request', { p_request: b.dataset.complete, p_status: 'completed' })); setTimeout(() => reload('request-' + reqId)) } }));
  document.querySelectorAll('[data-noti]').forEach(b => b.onclick = () => { const n = V.notis?.data?.find(x => String(x.id) === b.dataset.noti); if (!n) return; const [p, id] = (NOTI_GO[n.type] || (() => ['home']))(n); if (id) reqId = id; page = p; render(); scrollTo(0, 0) });
  // 제작 요청 폼
  document.querySelectorAll('[data-req-item]').forEach(b => b.onclick = () => { syncReq(); reqDraft.item = b.dataset.reqItem; reqDraft.title = ''; render() });
  document.querySelectorAll('[data-finish]').forEach(b => b.onclick = () => { syncReq(); const f = reqDraft.finishing, v = b.dataset.finish; reqDraft.finishing = f.includes(v) ? f.filter(x => x !== v) : [...f, v]; render() });
  if ($('#req-form')) {
    $('#req-form').oninput = syncReq;
    $('#req-form').onsubmit = e => { e.preventDefault(); if (checkReq()) submitRequest(e.target.querySelector('[type=submit]')) };
    if (uploadFile && $('#rq-thumb')) { const u = URL.createObjectURL(uploadFile); $('#rq-thumb').src = u; $('#rq-thumb').onload = () => URL.revokeObjectURL(u) }
  }
  if ($('#rq-file')) $('#rq-file').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 10 * 1024 * 1024) { setErr('rq-file', 'PNG, JPG, WebP 10MB 이하만 올릴 수 있어요.'); e.target.value = ''; return }
    syncReq(); uploadFile = f; render();
  };
  // 인쇄소
  document.querySelectorAll('[data-market]').forEach(b => b.onclick = () => { marketFilter = b.dataset.market; marketLimit = 20; render() });
  document.querySelectorAll('[data-quote]').forEach(b => b.onclick = () => { reqId = b.dataset.quote; page = 'quote'; render(); scrollTo(0, 0) });
  document.querySelectorAll('[data-myquote]').forEach(b => b.onclick = () => { reqId = b.dataset.myquote; page = b.dataset.st === 'accepted' ? 'jobs' : 'quote'; render(); scrollTo(0, 0) });
  if ($('#quote-form')) {
    const total = () => { if ($('#qt-total')) $('#qt-total').textContent = won((+$('#qt-unit').value || 0) * (+$('#qt-qty').value || 0)) };
    $('#quote-form').oninput = total;
    $('#quote-form').onsubmit = e => {
      e.preventDefault();
      const n = id => $('#' + id).value === '' ? NaN : Number($('#' + id).value), errs = [];
      const need = (id, ok, msg) => { setErr(id, ok ? '' : msg); if (!ok) errs.push(id) };
      need('qt-unit', Number.isInteger(n('qt-unit')) && n('qt-unit') >= 0, '단가를 원 단위 숫자로 적어주세요.');
      need('qt-qty', Number.isInteger(n('qt-qty')) && n('qt-qty') >= 1, '수량을 적어주세요.');
      need('qt-ship', Number.isInteger(n('qt-ship')) && n('qt-ship') >= 0, '배송비를 적어주세요. 없으면 0');
      need('qt-days', Number.isInteger(n('qt-days')) && n('qt-days') >= 1 && n('qt-days') <= 90, '제작 기간은 1~90일로 적어주세요.');
      need('qt-date', $('#qt-date').value >= dayAfter(0), '납품 예상일을 골라주세요.');
      if (errs.length) return $('#' + errs[0]).focus();
      modal({
        title: '견적을 보낼까요?', ok: '보내기', body: `<p>총 ${won(n('qt-unit') * n('qt-qty') + n('qt-ship'))} (배송비 포함) · ${ymd($('#qt-date').value)} 납품</p><p class="help">마감 전까지는 수정, 철회할 수 있어요.</p>`,
        onOk: async () => { await q(sb.rpc('submit_quotation', { p_request: reqId, p_unit_price: n('qt-unit'), p_quantity: n('qt-qty'), p_shipping_fee: n('qt-ship'), p_production_days: n('qt-days'), p_delivery_date: $('#qt-date').value, p_note: $('#qt-note').value.trim() || null })); toast('견적을 보냈어요.'); page = 'myquotes'; setTimeout(() => { render(); scrollTo(0, 0) }) }
      });
    };
  }
  document.querySelectorAll('[data-withdraw]').forEach(b => b.onclick = () => modal({ title: '견적을 철회할까요?', ok: '철회', danger: true, body: '<p class="help">마감 전이면 다시 보낼 수 있어요.</p>', onOk: async () => { await q(sb.rpc('withdraw_quotation', { p_quote: b.dataset.withdraw })); toast('견적을 철회했어요.'); setTimeout(() => reload('quote-' + reqId)) } }));
  document.querySelectorAll('[data-original]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { const d = await q(sb.storage.from('request-files').createSignedUrl(b.dataset.original, 300, { download: true })); location.href = d.signedUrl } catch (e) { toast(errMsg(e)) } finally { b.disabled = false }
  });
  document.querySelectorAll('[data-advance]').forEach(b => b.onclick = () => modal({ title: b.dataset.ask || '상태를 바꿀까요?', ok: '바꾸기', body: '<p class="help">소상공인에게 알림이 가요.</p>', onOk: async () => { await q(sb.rpc('advance_request', { p_request: b.dataset.advance, p_status: b.dataset.to })); setTimeout(() => reload('jobs')) } }));
}
