// 가게온 실제 서비스 연결: Supabase 로그인, 제작 요청, 견적, 수락, 알림.
// config.js에 Supabase 값이 있고 supabase-js가 불러와졌으면 실제 모드, 아니면(또는 ?mock=1) 기존 브라우저 목업 모드.
// app.js의 전역(state, page, render, toast, esc, icon, $ 등)을 함께 쓴다.
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
let myRole = 'owner', uid = '', myShop = null, notiCount = 0, chatUnread = 0, notiChannel = null, quoteChannel = null;
let aiAllowed = false;   // 관리자가 켜 준 계정만 실제 AI 생성 (13_ai_access.sql). 꺼져 있으면 예시 캐릭터로 동작
let reqId = '', convId = '', signupRole = 'owner', marketFilter = '', marketItems = {}, quoteSort = 'total';
let reqDraft = { item: 'sticker', quantity: 500, width: 50, height: 50, unit: 'mm', material: '아트지', finishing: [], region_sido: '대구', region_sigungu: '', note: '', title: '', item_other: '' };
let uploadFile = null;

const ITEM = { sticker: '스티커', wrapping: '포장지', shopping_bag: '쇼핑백', other: '기타' };
const REQ_ST = { open: ['견적 받는 중', 'st-open'], accepted: ['업체 선택', 'st-acc'], in_progress: ['제작 중', 'st-prog'], delivered: ['납품 완료', 'st-prog'], completed: ['완료', 'st-done'], canceled: ['취소', 'st-done'], expired: ['마감', 'st-done'], choose: ['업체 고르기', 'st-acc'] };
// 소상공인 의뢰 화면의 진행 상황. 지금 단계에만 설명을 보여준다
const STEP_INFO = [['업체 선택', '견적을 수락했어요. 채팅으로 규격과 배송을 맞춰요'], ['제작 중', '인쇄소가 만들고 있어요'], ['납품', '인쇄소가 보냈어요. 받으면 완료 확인을 눌러주세요'], ['완료', '받은 걸 확인했어요']];
const Q_ST = { submitted: ['검토 중', 'st-open'], withdrawn: ['철회', 'st-done'], accepted: ['수락됨', 'st-acc'], declined: ['미선택', 'st-done'] };
const SIDO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const MATERIALS = ['아트지', '유포지', '투명 PET', '크라프트지', '기타'];
const FINISH = ['무광 코팅', '유광 코팅', '도무송 재단', '박'];
const PAGE_LABEL = { admin: '계정 관리', dash: '대시보드', market: '요청 찾기', quote: '견적 작성', myquotes: '보낸 견적', jobs: '수락된 의뢰', requests: '인쇄', newreq: '제작 견적 요청', request: '견적 비교', pay: '결제', chats: '채팅', chat: '채팅', notis: '알림' };
const ERR = { account_unavailable: '해당 계정을 찾지 못했어요.', files_remaining: '계정 파일이 남아 있어요. 다시 시도해주세요.', confirm_username: '삭제할 계정의 아이디를 정확히 입력해주세요.', not_verified_printer: '승인된 인쇄소만 할 수 있어요.', request_closed: '견적이 마감된 요청이에요.', quote_locked: '이미 결정된 견적이라 수정할 수 없어요.', already_closed: '이미 다른 견적을 수락했거나 마감된 요청이에요.', quote_unavailable: '지금은 처리할 수 없는 견적이에요.', forbidden: '권한이 없어요.', invalid_transition: '지금 단계에서는 바꿀 수 없어요.', ai_limit: '오늘 AI 생성 횟수를 다 썼어요.', invalid_delivery_date: '납품 예상일을 확인해주세요.', biz_no_missing: '사업자등록번호가 없는 인쇄소예요.', nts_key_missing: '국세청 API 키가 아직 설정되지 않았어요.', nts_failed: '국세청 조회에 실패했어요. 잠시 뒤 다시 시도해주세요.' };

// 후기: 11_reviews.sql을 아직 실행하지 않은 DB에서는 빈 목록으로 돌아간다
const loadReviews = async (col, ids) => { if (!ids.length) return []; try { return await q(sb.from('reviews').select('*').in(col, ids).order('created_at', { ascending: false })) } catch { return [] } };
const reviewer = x => `${esc(x.author || '익명')} 사장님`;   // author 칸이 없는 예전 후기는 익명
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const rateLine = rs => rs.length ? `<span class="rate">★ ${(rs.reduce((s, x) => s + x.rating, 0) / rs.length).toFixed(1)} <small>후기 ${rs.length}개</small></span>` : '';
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
    // 전에 본 내용을 먼저 보여주고 뒤에서 새로 받아온다. 달라졌을 때만 다시 그려 입력 중인 글이 덜 지워지게 한다
    const old = seen[uid + key];
    V[key] = old ? { data: JSON.parse(old) } : { loading: true };
    fn().then(d => {
      const s = JSON.stringify(d), same = s === old;
      seen[uid + key] = s; V[key] = { data: d };
      if (!same && enteredKey === key) render();
    }, e => { V[key] = { error: errMsg(e) }; if (enteredKey === key) render() });
  }
  return V[key];
}
const seen = {};
// 채팅 상대마다 다른 바탕색을 줘서 목록에서 구분되게 한다
const avatar = name => { const n = name || '?'; return `<span class="avatar" style="background:hsl(${[...n].reduce((a, c) => a + c.codePointAt(0), 0) % 360} 45% 90%)">${esc(n.slice(0, 1))}</span>` };
const reload = key => { delete V[key]; enteredKey = ''; render() };
const skeleton = (n = 3) => `<div aria-busy="true" aria-label="불러오는 중">${'<div class="sk sk-card"></div>'.repeat(n)}</div>`;
const errorBox = (msg, key) => `<div class="empty" role="alert"><h2>불러오지 못했어요</h2><p>${esc(msg)}</p><button class="secondary" data-reload="${esc(key)}">다시 시도</button></div>`;
const emptyBox = (title, sub, btn = '', ic = 'box') => `<div class="empty-card">${icon(ic)}<div><strong>${title}</strong><small>${sub}</small></div>${btn}</div>`;
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
// 수락, 완료처럼 되돌릴 수 없는 일이 끝났을 때 체크 표시와 다음 할 일을 보여준다
function doneSheet(title, sub, ok, go) {
  const el = document.createElement('div');
  el.className = 'modal-back';
  el.innerHTML = `<div class="modal done-modal" role="alertdialog" aria-modal="true" aria-labelledby="done-title"><span class="done-check">${icon('check')}</span><h2 id="done-title">${title}</h2><p class="help">${sub}</p><button class="primary full">${ok}</button></div>`;
  document.body.append(el);
  const b = el.querySelector('button');
  b.onclick = () => { el.remove(); go?.() };
  b.focus();
}
const modalOpen = () => !!document.querySelector('.modal-back');
// 카카오(다음) 우편번호 서비스. API 키 없이 스크립트만 불러 쓰고, 처음 누를 때 한 번만 받는다
let postcodeJs = null;
const loadPostcode = () => postcodeJs ||= new Promise((ok, fail) => { const s = document.createElement('script'); s.src = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'; s.onload = ok; s.onerror = () => { postcodeJs = null; fail(Error('postcode')) }; document.head.append(s) });
const SIDO_FULL = { 경상북도: '경북', 경상남도: '경남', 충청북도: '충북', 충청남도: '충남', 전라북도: '전북', 전라남도: '전남' };
const toSido = x => { const s = SIDO_FULL[x] || String(x || '').replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, ''); return SIDO.includes(s) ? s : '' };
async function findAddress(done) {
  try { await loadPostcode() } catch { return toast('주소 검색을 불러오지 못했어요. 인터넷 연결을 확인하거나 직접 입력해주세요.') }
  const prev = document.activeElement, el = document.createElement('div');
  el.className = 'modal-back';
  el.innerHTML = '<div class="modal addr-sheet" role="dialog" aria-modal="true" aria-label="주소 검색"><div class="addr-head"><h2>주소 검색</h2><button class="text-button" data-x>닫기</button></div><div class="addr-embed"></div></div>';
  document.body.append(el);
  const close = () => { el.remove(); prev?.focus?.() };
  el.querySelector('[data-x]').onclick = close; el.onclick = e => { if (e.target === el) close() }; el.onkeydown = e => { if (e.key === 'Escape') close() };
  new daum.Postcode({ width: '100%', height: '100%', oncomplete: d => { close(); done({ sido: toSido(d.sido), sigungu: d.sigungu, road: d.roadAddress || d.jibunAddress, zonecode: d.zonecode }) } }).embed(el.querySelector('.addr-embed'));
}

// ---------- 로그인, 가입 ----------
async function loadMe() {
  const { data: { user: u } } = await sb.auth.getUser();
  if (!u) return false;
  const p = await q(sb.from('profiles').select('role,display_name').eq('id', u.id).single());
  uid = u.id; myRole = p.role; user = u.user_metadata?.username || ''; shop = p.display_name;
  if (myRole === 'printer') { myShop = await q(sb.from('print_shops').select('id,name,verified,region_sido,region_sigungu').eq('owner_id', u.id).maybeSingle()); shop = myShop?.name || shop }
  if (myRole !== 'admin') { startNotis(); checkPush() }
  try { aiAllowed = !!(await q(sb.rpc('my_ai_enabled'))) } catch { aiAllowed = false }
  if (typeof refreshAI === 'function') refreshAI();
  if (myRole === 'owner') await cloudBrand.load();
  return true;
}
// 내 브랜드: 화면은 지금처럼 localStorage(KEY) 목록을 읽고, 로그인하면 계정(brands 테이블) 내용으로 채운다
const cloudBrand = {
  async load() {
    let list = [];
    try { list = (await q(sb.from('brands').select('id,data,updated_at').eq('owner_id', uid).order('updated_at', { ascending: false }).limit(12))).map(b => ({ ...b.data, id: b.id, savedAt: Date.parse(b.updated_at) })) } catch {}
    if (!list.length && user === PUBLIC_DEMO.id) list = samples();   // 공개 체험 계정만 예시 브랜드를 보여준다
    try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
  },
  save(r) {
    const { id, savedAt, ...data } = r;
    return q(sb.from('brands').upsert({ id, owner_id: uid, name: r.name || '이름 없는 브랜드', industry: r.industry || null, data, updated_at: new Date().toISOString() })).then(() => true).catch(() => { toast('계정에 저장하지 못했어요. 이 기기에만 저장됐어요.'); return false; });
  },
  remove(id) { q(sb.from('brands').delete().eq('id', id)).catch(() => toast('계정에서 지우지 못했어요. 다시 시도해주세요.')) }
};
window.cloudBrand = cloudBrand;
async function restoreSession() {
  try { const { data } = await sb.auth.getSession(); if (data.session && await loadMe()) { page = myRole === 'admin' ? 'admin' : myRole === 'printer' ? 'dash' : 'home'; if (myRole === 'owner') state.name = shop; const go = new URLSearchParams(location.search).get('go'); if (PUSH_PAGES.includes(go)) { page = go; history.replaceState(null, '', location.pathname) } await payReturn(); return } } catch {}
  page = 'start';
}
function realAuthForm() {
  if (auth === 'signup') {
    const owner = signupRole === 'owner';
    return `<h1 class="start-title">회원가입</h1><div class="choices role-pick" role="radiogroup" aria-label="회원 유형">${[['owner', '소상공인', 'AI로 브랜드를 만들고 인쇄 견적을 받아요'], ['printer', '인쇄소', '제작 요청을 보고 견적을 보내요']].map(([v, l, d]) => `<button type="button" class="choice${signupRole === v ? ' selected' : ''}" role="radio" aria-checked="${signupRole === v}" data-signup-role="${v}" title="${d}"><strong>${l}</strong></button>`).join('')}</div>
<form id="real-signup" class="signup-compact" novalidate>${fld('su-id', '아이디', 'text', 'data-rule="id" maxlength="20" autocomplete="username" autocapitalize="off" placeholder="영문 소문자, 숫자 4~20자"')}${fld('su-pw', '비밀번호', 'password', 'data-rule="pw" maxlength="64" autocomplete="new-password" placeholder="영문+숫자 8자 이상"')}${fld('su-pw2', '비밀번호 확인', 'password', 'data-rule="pw" data-same="su-pw" maxlength="64" autocomplete="new-password" placeholder="한 번 더 입력하세요"')}${fld('su-shop', owner ? '가게 이름' : '업체명', 'text', `data-rule="shop" maxlength="24" placeholder="${owner ? '예: 몽글빵집' : '예: 대구인쇄'}"`)}${owner ? '' : fld('su-biz', '사업자등록번호', 'text', 'data-rule="biz" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="숫자 10자리"') + '<p class="help" style="margin:-4px 0 8px">국세청에서 영업 중인지 확인한 뒤 승인해요.</p>'}<label class="check"><input type="checkbox" id="su-agree" aria-describedby="su-agree-err">시연용 서비스라 입력한 정보가 해커톤 기간 동안 저장되는 것에 동의해요. (필수)</label><p class="field-error" id="su-agree-err" role="alert" hidden></p><p class="field-error" id="su-form-err" role="alert" hidden></p><button class="primary full" type="submit">가입하기</button></form><div class="auth-links start-bottom"><span>이미 계정이 있나요?</span><button type="button" class="text-button" data-auth="login">로그인</button></div>`;
  }
  return `<h1 class="sr-only">가게온 로그인</h1><p class="start-tag">누구나 쉽게 시작하는 가게 브랜딩</p><form id="real-login" class="login-compact" novalidate>${fld('li-id', '아이디', 'text', 'maxlength="20" autocomplete="username" autocapitalize="off" placeholder="아이디를 입력하세요"')}${fld('li-pw', '비밀번호', 'password', 'maxlength="64" autocomplete="current-password" placeholder="비밀번호를 입력하세요"')}<p class="field-error" id="li-form-err" role="alert" hidden></p><button class="primary full" type="submit">로그인</button></form><div class="auth-links"><button type="button" class="text-button" data-auth="signup">회원가입</button><span class="link-bar" aria-hidden="true"></span><button type="button" class="text-button" id="pw-help">비밀번호 찾기</button></div>${QUICK_LOGIN ? `<div class="quick-login start-bottom"><p>체험용 계정으로 바로 둘러보기</p><div class="quick-row"><button type="button" class="quick-btn" data-quick="owner" aria-label="소상공인으로 둘러보기"><span class="q-ico">${icon('shop')}</span><strong>소상공인</strong></button><button type="button" class="quick-btn" data-quick="printer" aria-label="인쇄소로 둘러보기"><span class="q-ico dark">${icon('box')}</span><strong>인쇄소</strong></button></div><p class="help">체험 계정은 모두가 함께 써서 다른 사람이 바꾼 내용이 보일 수 있어요.</p></div>` : ''}`;
}
function goHomeAfterLogin() { page = myRole === 'admin' ? 'admin' : myRole === 'printer' ? 'dash' : 'home'; state = { ...initial(), name: myRole === 'owner' ? shop : '' }; step = 1; render(); scrollTo(0, 0) }
function bindReal() {
  if ($('#pw-help')) $('#pw-help').onclick = () => toast('비밀번호를 잊으면 운영자에게 문의해주세요. (시연 기간)');
  $('#app').querySelectorAll('[data-signup-role]').forEach(b => b.onclick = () => { signupRole = b.dataset.signupRole; const keep = ['su-id', 'su-shop'].map(i => $('#' + i)?.value); render(); ['su-id', 'su-shop'].forEach((i, n) => { if ($('#' + i)) $('#' + i).value = keep[n] || '' }) });
  $('#app').querySelectorAll('[data-quick]').forEach(b => b.onclick = async () => {
    const a = QUICK[b.dataset.quick], all = $('#app').querySelectorAll('[data-quick]');
    all.forEach(x => x.disabled = true); b.querySelector('strong').textContent = '들어가는 중…';
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
      const { error } = await sb.auth.signUp({ email: id + ID_DOMAIN, password: $('#su-pw').value, options: { data: { username: id, role: signupRole, display_name: name, shop_name: name, ...(signupRole === 'printer' ? { biz_no: $('#su-biz').value.replace(/\D/g, '') } : {}) } } });
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
  if ($('#logout')) $('#logout').onclick = async () => { await disablePush(true); aiAllowed = false; stopChannels(); try { await sb.auth.signOut() } catch {} for (const k in V) delete V[k]; enteredKey = ''; uid = ''; myRole = 'owner'; myShop = null; notiCount = 0; chatUnread = 0; signOut(); render() };
  if ($('#admin-logout')) $('#admin-logout').onclick = () => $('#logout').click();
  $('#app').querySelectorAll('[data-biz-check]').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = '확인 중…';
    const { data, error } = await sb.functions.invoke('verify-biz', { body: { user_id: b.dataset.bizCheck } });
    if (error) { let code = ''; try { code = (await error.context.json()).error } catch {} toast(ERR[code] || '국세청 확인에 실패했어요. 잠시 뒤 다시 시도해주세요.'); b.disabled = false; b.textContent = '국세청 확인'; return }
    toast(`국세청 확인: ${BIZ_ST[data.biz_status]?.[0] || data.biz_status}`); reload('admin-accounts');
  });
  $('#app').querySelectorAll('[data-admin-verify]').forEach(b => b.onclick = async () => {
    const on = b.dataset.on === 'true'; b.disabled = true;
    try { await q(sb.rpc('admin_set_verified', { p_user: b.dataset.adminVerify, p_verified: on })); toast(`${b.dataset.username} ${on ? '인쇄소를 승인했어요.' : '인쇄소 승인을 취소했어요.'}`); reload('admin-accounts') } catch (e) { toast(errMsg(e)); b.disabled = false }
  });
  $('#app').querySelectorAll('[data-admin-ai]').forEach(b => b.onclick = async () => {
    const on = b.dataset.on === 'true'; b.disabled = true;
    try { await q(sb.rpc('admin_set_ai', { p_user: b.dataset.adminAi, p_on: on })); toast(`${b.dataset.username} AI 생성을 ${on ? '켰어요' : '껐어요'}.`); reload('admin-accounts') } catch (e) { toast(errMsg(e)); b.disabled = false }
  });
  // 시연용 무료 충전 (supabase/17_admin_tokens.sql)
  $('#app').querySelectorAll('[data-admin-tokens]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { const left = await q(sb.rpc('admin_grant_tokens', { p_user: b.dataset.adminTokens, p_amount: 1000 })); toast(`${b.dataset.username}에 1000온을 충전했어요. 지금 ${Number(left).toLocaleString()}온`) }
    catch (e) { toast(/no_demo_account/.test(e?.message || '') ? '아직 온 기록이 없는 계정이에요. 그 계정으로 한 번 로그인한 뒤 다시 눌러주세요.' : /admin_grant_tokens/.test(e?.message || '') ? '서버에 17_admin_tokens.sql을 먼저 적용해 주세요.' : errMsg(e)) }
    b.disabled = false
  });
  $('#app').querySelectorAll('[data-admin-delete]').forEach(b => b.onclick = () => {
    const name = b.dataset.username, id = b.dataset.adminDelete;
    modal({ title: '계정을 탈퇴시킬까요?', ok: '계정 탈퇴', danger: true,
      body: `<p><b>${esc(name)}</b> 계정과 관련 요청·견적·채팅·파일이 삭제됩니다. 되돌릴 수 없어요.</p><label for="admin-confirm">확인하려면 아이디를 입력해주세요.</label><input id="admin-confirm" type="text" autocomplete="off" autocapitalize="off" placeholder="${esc(name)}">`,
      onOk: async () => {
        if ($('#admin-confirm').value.trim() !== name) throw Error('confirm_username');
        const files = await q(sb.rpc('admin_account_files', { p_user: id }));
        for (const bucket of ['brand-assets', 'request-files', 'request-previews']) {
          const paths = files.filter(f => f.bucket_id === bucket).map(f => f.name);
          for (let i = 0; i < paths.length; i += 100) await q(sb.storage.from(bucket).remove(paths.slice(i, i + 100)));
        }
        await q(sb.rpc('admin_delete_account', { p_user: id }));
        toast(`${name} 계정을 탈퇴 처리했어요.`);
        reload('admin-accounts');
      }
    });
    $('#admin-confirm')?.focus();
  });
  if ($('#rq-addr')) $('#rq-addr').onclick = () => findAddress(a => {
    if (a.sido) $('#rq-sido').value = a.sido; $('#rq-sigungu').value = a.sigungu; syncReq();
    toast(`${a.sido || ''} ${a.sigungu}(으)로 넣었어요. 상세 주소는 업체를 고른 뒤 채팅으로 알려주세요.`);
  });
  // 상세 주소는 수락된 의뢰 상대에게만 보인다 (shop_address 함수)
  if ($('#shop-addr')) $('#shop-addr').onclick = () => findAddress(a => modal({ title: '상세 주소를 적어주세요', ok: '저장',
    body: `<p>${esc(a.road)}</p><label for="addr-detail">상세 주소 <small>선택</small></label><input id="addr-detail" type="text" maxlength="60" placeholder="예: 2층 201호">`,
    onOk: async () => {
      // 상세 주소는 본인도 다시 읽을 수 없게 막혀 있어서(02_policies.sql) 이번 화면에서만 보여준다
      const full = (a.road + ' ' + $('#addr-detail').value.trim()).trim(), patch = { region_sido: a.sido || null, region_sigungu: a.sigungu, address_detail: full };
      await q(sb.from('print_shops').update(patch).eq('id', myShop.id)); Object.assign(myShop, patch); render(); toast('업체 주소를 저장했어요.');
    } }));
  if ($('#my-edit-btn')) $('#my-edit-btn').onclick = e => { const box = $('#my-edit'); box.hidden = !box.hidden; e.currentTarget.setAttribute('aria-expanded', String(!box.hidden)); if (!box.hidden) $('#my-shop').focus() };
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
// 사장님 마이페이지 (시안): 프로필, 남은 온 카드, 메뉴 묶음 3개. 인쇄소는 아래 기존 화면
function ownerMypage() {
  if (!user) return ''; const a = Commerce.account(), plan = Commerce.P.plans[a.plan], rec = records()[0], pic = rec ? rec.customImage || svgUri(stickerSVG(rec)) : '', demo = user === PUBLIC_DEMO.id;
  const row = (attr, label, side = '') => `<button ${attr}>${label}<span class="my-side">${side ? `<small>${side}</small>` : ''}${icon('chev')}</span></button>`;
  const why = !pushSupported() ? '지원 안 함' : iosBrowser() ? '홈 화면 앱에서 켜기' : Notification.permission === 'denied' ? '차단됨' : pushOn ? '켜짐' : '꺼짐';
  return `<section class="my-profile">${pic ? `<img class="my-pic" src="${esc(pic)}" alt="">` : `<span class="my-pic">${avatar(shop)}</span>`}<strong>${esc(shop)}</strong><button type="button" class="my-edit-btn" id="my-edit-btn" aria-expanded="false" aria-controls="my-edit">${icon('brush')}내 정보 수정</button></section>
<section class="my-edit" id="my-edit" hidden><div class="my-list"><form class="my-name" id="real-name-form"><input id="my-shop" type="text" maxlength="24" value="${esc(shop)}" aria-label="가게 이름"><button class="secondary" type="submit">이름 변경</button></form></div>${demo ? '<p class="help">공개 체험 계정이라 비밀번호는 바꿀 수 없어요.</p>' : `<div class="my-list"><details><summary>비밀번호 변경</summary><form id="real-pw-form" novalidate>${fld('pw-cur', '현재 비밀번호', 'password', 'maxlength="64" autocomplete="current-password"')}${fld('pw-new', '새 비밀번호', 'password', 'data-rule="pw" maxlength="64" autocomplete="new-password"')}${fld('pw-new2', '새 비밀번호 확인', 'password', 'data-rule="pw" data-same="pw-new" maxlength="64" autocomplete="new-password"')}<button class="primary full" type="submit">변경하기</button></form></details></div>`}</section>
<button type="button" class="my-tokens" data-page="token-history" aria-label="남은 온 ${a.tokenBalance} / ${plan.tokens}, 사용 내역 보기"><span class="my-tokens-head"><span><i aria-hidden="true">C</i>남은 온</span><b data-token-balance>${a.tokenBalance}/${plan.tokens}</b></span><span class="my-tokens-bar"><span style="width:${Math.min(100, a.tokenBalance / plan.tokens * 100)}%"></span></span></button>
<div class="my-list">${row('data-page="requests"', '받은 견적')}${row('data-page="guide"', '이용 가이드')}</div>
<div class="my-list">${row('data-page="plans"', '요금제')}${row('data-commerce-topup', '온 충전')}${row('data-page="token-history"', '구매 내역')}${row('data-page="demo-orders"', '배송 내역')}</div>
<div class="my-list"><button id="push-toggle"${/지원|홈 화면|차단/.test(why) ? ' disabled' : ''} aria-pressed="${pushOn}">알림 설정<span class="my-side"><small>${why}</small>${icon('chev')}</span></button>${row('id="logout-my"', '로그아웃')}${row('data-page="token-history"', '구매 내역')}${row('data-page="demo-orders"', '배송 내역')}</div><p class="help">회원 탈퇴는 시연 기간에는 운영자에게 요청해주세요.</p>`;
}
function realMypage() {
  if (myRole === 'owner') return ownerMypage();
  return `<section class="shop-hero">${avatar(shop)}<div><strong>${esc(shop)}</strong><small>${myRole === 'printer' ? '인쇄소' : '소상공인'} 회원${myRole === 'printer' && !myShop?.verified ? ' · 승인 대기' : ''} · ${esc(user)}</small></div></section>
<div class="my-list"><form class="my-name" id="real-name-form"><input id="my-shop" type="text" maxlength="24" value="${esc(shop)}" aria-label="${myRole === 'printer' ? '업체명' : '가게 이름'}"><button class="secondary" type="submit">이름 변경</button></form>${myRole === 'printer' && myShop ? `<button id="shop-addr">업체 주소<small>${myShop.address_detail ? esc(myShop.address_detail) : myShop.region_sigungu ? esc(`${myShop.region_sido || ''} ${myShop.region_sigungu}`.trim()) + ' · 다시 찾기 ›' : '주소 검색 ›'}</small></button>` : ''}</div>
<div class="my-list"><button data-page="notis">알림<small>${notiCount ? notiCount + '개 안 읽음' : '›'}</small></button>${myRole === 'printer' ? '<button data-page="jobs">수락된 의뢰<small>›</small></button>' : '<button data-page="requests">받은 견적<small>›</small></button>'}${myRole === 'owner' ? `` : ''}<button data-page="guide">이용 가이드<small>›</small></button></div>
${myRole==='owner'?Commerce.accountCard():''}${pushRow()}${[PUBLIC_DEMO.id, QUICK.printer.id].includes(user) ? '<p class="help">공개 체험 계정이라 비밀번호는 바꿀 수 없어요.</p>' : ''}<div class="my-list"${[PUBLIC_DEMO.id, QUICK.printer.id].includes(user) ? ' hidden' : ''}><details><summary>비밀번호 변경</summary><form id="real-pw-form" novalidate>${fld('pw-cur', '현재 비밀번호', 'password', 'maxlength="64" autocomplete="current-password"')}${fld('pw-new', '새 비밀번호', 'password', 'data-rule="pw" maxlength="64" autocomplete="new-password"')}${fld('pw-new2', '새 비밀번호 확인', 'password', 'data-rule="pw" data-same="pw-new" maxlength="64" autocomplete="new-password"')}<button class="primary full" type="submit">변경하기</button></form></details></div>
<div class="my-list"><button id="logout-my">로그아웃<small>›</small></button></div><p class="help">회원 탈퇴는 시연 기간에는 운영자에게 요청해주세요.</p>`;
}

// 국세청 상태 코드 (supabase/functions/verify-biz)
const BIZ_ST = { '01': ['계속사업자', 'ok'], '02': ['휴업자', 'bad'], '03': ['폐업자', 'bad'], none: ['국세청에 없는 번호', 'bad'] };
const bizNo = n => n.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3');
function bizLine(x) {
  if (!x.biz_no) return '<small class="biz-line">사업자등록번호 없음</small>';
  const st = BIZ_ST[x.biz_status];
  return `<small class="biz-line">사업자 ${bizNo(x.biz_no)} · ${st ? `<b class="biz-${st[1]}">국세청 ${st[0]}</b>` : '국세청 확인 전'} <button class="text-button" data-biz-check="${esc(x.id)}">${st ? '다시 확인' : '국세청 확인'}</button></small>`;
}
function adminPage() {
  const r = useData('admin-accounts', () => q(sb.rpc('admin_accounts')));
  const group = (rows, role, title) => {
    const accounts = rows.filter(x => x.role === role);
    return `<section class="admin-group"><h2 class="sec-label">${title} <small>${accounts.length}명</small></h2>${accounts.length ? accounts.map(x => `<article class="admin-account"><div><strong>${esc(x.display_name)}</strong><span class="admin-id">@${esc(x.username)}</span><small>가입 ${esc(new Date(x.created_at).toLocaleDateString('ko-KR'))}${role === 'printer' ? ` · ${x.verified ? '승인됨' : '승인 대기'}` : ''} · AI ${x.ai_enabled ? '켜짐' : '꺼짐'}</small>${role === 'printer' ? bizLine(x) : ''}</div><span class="admin-actions"><button class="${x.ai_enabled ? 'secondary' : 'primary'}" data-admin-ai="${esc(x.id)}" data-on="${!x.ai_enabled}" data-username="${esc(x.username)}" aria-label="${esc(x.username)} AI ${x.ai_enabled ? '끄기' : '켜기'}">AI ${x.ai_enabled ? '끄기' : '켜기'}</button>${role === 'printer' ? `<button class="${x.verified ? 'secondary' : 'primary'}" data-admin-verify="${esc(x.id)}" data-on="${!x.verified}" data-username="${esc(x.username)}" aria-label="${esc(x.username)} ${x.verified ? '승인 취소' : '승인'}">${x.verified ? '승인 취소' : '승인'}</button>` : ''}${role === 'owner' ? `<button class="secondary" data-admin-tokens="${esc(x.id)}" data-username="${esc(x.username)}" aria-label="${esc(x.username)} 온 1000 무료 충전">+1000온</button>` : ''}<button class="secondary admin-remove" data-admin-delete="${esc(x.id)}" data-username="${esc(x.username)}" aria-label="${esc(x.username)} 계정 탈퇴">탈퇴</button></span></article>`).join('') : '<p class="help">등록된 계정이 없어요.</p>'}</section>`;
  };
  return `<section class="intro"><h1>계정 관리</h1><p>가입한 회원을 확인하고, 인쇄소를 승인하거나 탈퇴 처리해요. 승인된 인쇄소만 견적을 보낼 수 있어요. AI 생성은 켜 준 계정만 쓸 수 있어요(요금이 나가요).</p></section>${stateView(r, 'admin-accounts', rows => `<div class="admin-summary"><strong>전체 ${rows.length}명</strong><button class="secondary" data-reload="admin-accounts">새로고침</button></div>${group(rows, 'owner', '소상공인')}${group(rows, 'printer', '인쇄소')}`)}`;
}

// ---------- 웹 푸시 (앱을 닫아 둬도 폰 알림) ----------
// 서버 쪽: supabase/10_push.sql, supabase/functions/send-push
const PUSH_PAGES = ['notis', 'chats'];
let pushOn = false;
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!CFG.vapidPublicKey;
const iosBrowser = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches;
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), ch => ch.charCodeAt(0));
async function pushSub() { try { return await (await navigator.serviceWorker.ready).pushManager.getSubscription() } catch { return null } }
// 이 기기 구독이 지금 계정 것으로 등록돼 있는지 (다른 계정이 쓰던 기기면 꺼진 것으로 본다)
async function checkPush() {
  if (!pushSupported()) return;
  const s = await pushSub();
  try { pushOn = !!s && Notification.permission === 'granted' && (await q(sb.from('push_subscriptions').select('id').eq('endpoint', s.endpoint))).length > 0 } catch { pushOn = false }
  if (page === 'mypage') render();
}
function pushRow() {
  const why = !pushSupported() ? '이 브라우저는 지원하지 않아요' : iosBrowser() ? '아이폰은 홈 화면에 추가한 앱에서 켤 수 있어요' : Notification.permission === 'denied' ? '브라우저 설정에서 알림이 차단돼 있어요' : '';
  return `<div class="my-list"><button id="push-toggle"${why ? ' disabled' : ''} aria-pressed="${pushOn}">폰 알림 받기<small>${why || (pushOn ? '켜짐 ›' : '꺼짐 ›')}</small></button></div><p class="help" style="margin-top:-6px">앱을 닫아 둬도 새 견적, 채팅, 진행 상황을 폰 알림으로 알려드려요.</p>`;
}
async function enablePush() {
  if (await Notification.requestPermission() !== 'granted') return toast('알림을 허용해야 받을 수 있어요.');
  const reg = await navigator.serviceWorker.ready;
  const s = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(CFG.vapidPublicKey) });
  const j = s.toJSON();
  await q(sb.rpc('register_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth }));
  pushOn = true; toast('폰 알림을 켰어요.');
}
// 로그아웃할 때도 부른다: 이 기기로 이전 계정의 알림이 가지 않게 서버 등록부터 지운다
async function disablePush(quiet) {
  if (!pushSupported()) return;
  const s = await pushSub(); if (!s) return;
  try { await q(sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint)); await s.unsubscribe() } catch (e) { if (!quiet) throw e }
  pushOn = false; if (!quiet) toast('폰 알림을 껐어요.');
}
if (REAL && 'serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (uid && PUSH_PAGES.includes(e.data?.go)) { page = e.data.go; render(); scrollTo(0, 0) } });

// ---------- 알림 ----------
async function startNotis() {
  try {
    const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    notiCount = count || 0;
    if (notiChannel) sb.removeChannel(notiChannel);
    notiChannel = sb.channel('notis-' + uid).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid }, p => {
      notiCount++; if (!(p.new.type === 'message' && page === 'chat')) toast(p.new.title); if (p.new.type === 'message') refreshChatUnread();   // 채팅방 안에서는 메시지마다 팝업 안 띄움
      if (myShop && p.new.type === 'status_changed' && !p.new.ref_id) myShop.verified = true;   // 관리자 승인 알림 (08_launch.sql)
      if (!modalOpen() && ['requests', 'request', 'dash', 'myquotes', 'jobs', 'notis', 'chats'].includes(page)) reload(enteredKey); else paintBell();
    }).subscribe();
    paintBell(); refreshChatUnread();
  } catch {}
}
// 하단 메뉴 채팅 탭의 안 읽은 메시지 수. 알림 종처럼 앱이 켜질 때 세고, 새 메시지 알림이나 읽음 처리 때 다시 센다
async function refreshChatUnread() { try { const d = await q(sb.rpc('my_conversations')); chatUnread = (d || []).reduce((s, c) => s + Number(c.unread || 0), 0); paintNav() } catch {} }
function paintNav() { document.querySelectorAll('nav [data-page="chats"]').forEach(b => { let i = b.querySelector('.nav-badge'); if (!chatUnread) { if (i) i.remove(); return } if (!i) { i = document.createElement('i'); i.className = 'nav-badge'; b.appendChild(i) } i.textContent = chatUnread > 99 ? '99+' : chatUnread }) }
function paintBell() { const b = $('#bell-count'); if (b) { b.hidden = !notiCount; b.closest('.bell')?.setAttribute('aria-label', notiCount ? `알림 ${notiCount}개 안 읽음` : '알림') } }
function stopChannels() { [notiChannel, quoteChannel].forEach(c => c && sb.removeChannel(c)); notiChannel = quoteChannel = null; if (window.leaveChat) leaveChat() }
const NOTI_GO = { quote_received: n => ['request', n.ref_id], quote_accepted: () => ['chats'], quote_declined: () => ['myquotes'], status_changed: n => myRole === 'owner' ? ['request', n.ref_id] : ['jobs'], message: () => ['chats'] };
// 알림 한 줄을 종류별 아이콘, 굵은 제목(무슨 일), 작은 설명(어떤 요청)으로 나눈다. DB에 저장된 문장을 풀어서 만든다
function notiView(n) {
  const m = /^"([^"]+)"\s*(.*)$/.exec(n.title || ''), name = m ? m[1] : '', rest = m ? m[2] : n.title || '';
  if (n.type === 'quote_received') return ['doc', 'new', '새 견적이 도착했어요', name];
  if (n.type === 'quote_accepted') return ['check', 'ok', '견적이 수락됐어요', name ? `${name} · 채팅을 시작해 보세요` : ''];
  if (n.type === 'quote_declined') return ['x', 'off', '다른 업체로 정해졌어요', name];
  if (n.type === 'message') { const i = (n.title || '').indexOf(': '); return ['chat', 'chat', i > 0 ? `${n.title.slice(0, i)}님의 새 메시지` : '새 메시지', i > 0 ? n.title.slice(i + 2) : n.title] }
  if (/상태: 제작 중/.test(rest)) return ['hammer', 'work', '제작이 시작됐어요', name];
  if (/상태: 납품 완료/.test(rest)) return ['box', 'work', '납품이 완료됐어요', name];
  if (/상태: 완료/.test(rest)) return ['check', 'ok', '거래가 끝났어요', name];
  if (/결제가 완료/.test(rest)) return ['card', 'ok', '결제가 완료됐어요', name];
  const star = /별점 (\d)점/.exec(rest);
  if (/후기가 등록/.test(rest)) return ['star', 'star', '새 후기가 등록됐어요', [name, star ? `★ ${star[1]}점` : ''].filter(Boolean).join(' · ')];
  if (/인쇄소 승인/.test(n.title || '')) return ['shield', 'ok', '인쇄소 승인이 끝났어요', '이제 견적을 보낼 수 있어요'];
  return ['bell', 'new', name || n.title, name ? rest : ''];
}
// 방금, N분 전, N시간 전, 어제, M월 D일
function ago(iso) {
  const t = new Date(iso), s = (Date.now() - t) / 1000, day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (s < 60) return '방금'; if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  const days = Math.round((day(new Date()) - day(t)) / 864e5);
  if (days === 0) return `${Math.floor(s / 3600)}시간 전`; if (days === 1) return '어제';
  return `${t.getMonth() + 1}월 ${t.getDate()}일`;
}
function notiGroup(iso) { const t = new Date(iso), n = new Date(), d = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5); return d <= 0 ? '오늘' : d === 1 ? '어제' : d < 7 ? '이번 주' : '이전' }
function notisPage() {
  const r = useData('notis', async () => {
    const d = await q(sb.from('notifications').select('id,type,ref_id,title,read_at,created_at').order('id', { ascending: false }).limit(50));
    if (d.some(n => !n.read_at)) { await q(sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)); notiCount = 0 }
    return d;   // 받아 온 목록에는 read_at이 그대로 남아 있어서, 이번에 연 화면에서는 안 읽었던 알림이 표시된다
  });
  const item = n => { const [ic, tone, head, sub] = notiView(n), unread = !n.read_at;
    return `<button class="noti-item${unread ? ' unread' : ''}" data-noti="${n.id}"><span class="noti-ic tone-${tone}">${icon(ic)}</span><span class="noti-body"><strong>${esc(head)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="noti-side"><time datetime="${esc(n.created_at)}">${ago(n.created_at)}</time>${unread ? '<i class="dot" aria-label="안 읽음"></i>' : ''}</span></button>` };
  const groups = d => { const out = []; d.forEach(n => { const g = notiGroup(n.created_at); (out.at(-1)?.[0] === g ? out.at(-1)[1] : (out.push([g, []]), out.at(-1)[1])).push(n) }); return out };
  return `<section class="intro"><h1>알림</h1></section>${stateView(r, 'notis', d => d.length ? `${groups(d).map(([g, list]) => `<section class="noti-group"><h2 class="noti-day">${g}</h2><div class="noti-list">${list.map(item).join('')}</div></section>`).join('')}<p class="noti-foot">최근 알림 50개까지 보여줘요.</p>` : emptyBox('새 알림이 없어요', '견적이 오거나 메시지가 오면 여기에 알려드려요.', `<button class="secondary" data-page="${myRole === 'printer' ? 'dash' : 'home'}">홈으로 가기</button>`, 'bell'))}`;
}

// ---------- 소상공인: 받은 견적 목록, 견적 비교, 제작 요청 ----------
let reqLimit = 20, reqTab = 'live';
const ST_CLS = { open: 'open', accepted: 'acc', in_progress: 'prog', delivered: 'prog', completed: 'done', canceled: 'done', expired: 'done', choose: 'acc' };
// 견적 마감이 지난 open 요청: 받은 견적이 있으면 아직 고를 수 있고(accept_quotation은 마감 뒤에도 허용), 없으면 마감
const reqSt = (x, n) => x.status === 'open' && Date.parse(x.quote_deadline) <= Date.now() ? (n ? 'choose' : 'expired') : x.status;
function reqCard(x) {
  const qs = (x.quotations || []).filter(q => q.status !== 'withdrawn'), names = qs.map(q => q.print_shops?.name || '?'), st = reqSt(x, qs.length);
  const tail = st === 'choose' ? '견적 마감, 받은 견적 중에서 업체를 골라주세요' : st === 'open' ? (qs.length ? '견적을 비교하고 업체를 골라보세요' : '인쇄소 견적을 기다리고 있어요') : ['accepted', 'in_progress', 'delivered'].includes(x.status) ? (x.paid_at ? '결제 완료 · 업체와 제작을 진행하고 있어요' : '<b class="need-pay">결제 대기</b> 눌러서 결제해 주세요') : '진행이 끝난 요청이에요';
  return `<button class="req-card2" data-req="${x.id}"><div class="top">${x.url ? `<img class="req-thumb" src="${esc(x.url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<div><p class="meta" style="margin:0"><b class="${ST_CLS[st]}">${REQ_ST[st][0]}</b>${ymd(x.created_at)} 요청</p><strong>${esc(x.title)}</strong></div><span class="cnt">견적 ${qs.length}개 ›</span></div><div class="bottom">${names.length ? `<span class="av-stack">${names.slice(0, 3).map(n => `<i>${esc(n.slice(0, 1))}</i>`).join('')}</span>` : ''}<span>${tail}</span></div></button>`;
}
const ORDER_STEPS = ['전달', '제작중', '도착'], ORDER_AT = { accepted: 0, in_progress: 1, delivered: 2 };
function orderCard(x) {
  const qt = (x.quotations || []).find(q => q.status === 'accepted'), at = ORDER_AT[x.status], done = at === undefined;
  const steps = done ? '' : `<ol class="order-steps" aria-label="진행 단계 ${ORDER_STEPS[at]}"><b style="width:calc((100% - 12px) * ${at / 2})"></b>${ORDER_STEPS.map((l, i) => `<li class="${i < at ? 'past' : i === at ? 'now' : ''}"><i></i>${i === at ? `<span>${l}</span>` : ''}</li>`).join('')}</ol>${x.paid_at ? '' : '<p class="order-pay"><b class="need-pay">결제 대기</b> 주문상세에서 결제해 주세요</p>'}`;
  return `<article class="order-card"><div class="order-top">${x.url ? `<img class="order-thumb" src="${esc(x.url)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'order-thumb'}))">` : '<span class="order-thumb"></span>'}<div class="order-body"><p class="order-meta"><span>${ymd(x.created_at)} 요청</span><button type="button" class="order-link" data-req="${x.id}">주문상세 ›</button></p><strong>${esc(x.title)}</strong><p class="order-line"><span>${esc(qt?.print_shops?.name || '')} ${Number(qt?.quantity || x.quantity || 0).toLocaleString()}매</span>${qt ? `<b>${Number(qt.total_price).toLocaleString()}원</b>` : ''}</p></div></div>${steps}${done && x.status === 'completed' ? `<button type="button" class="primary full order-again" data-reorder-req="${x.id}">다시 주문하기</button>` : ''}</article>`;
}
function requestsPage() {
  const r = useData('requests', async () => {
    const rows = await q(sb.from('print_requests').select('id,title,item,status,quantity,created_at,quote_deadline,preview_path,paid_at,quotations!quotations_request_id_fkey(status,total_price,quantity,print_shops(name))').eq('owner_id', uid).order('created_at', { ascending: false }).range(0, reqLimit));
    if (!rows.length) return rows;
    const { data } = await sb.storage.from('request-previews').createSignedUrls(rows.map(x => x.preview_path), 300);
    const urls = Object.fromEntries((data || []).filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
    return rows.map(x => ({ ...x, url: urls[x.preview_path] }));
  });
  const goNew = `<button class="go-card" data-go-new>${icon('box')}<div><strong>견적을 요청해 보세요</strong><small>여러 인쇄소의 견적을 한 번에 비교할 수 있어요</small></div><span class="chev" aria-hidden="true">›</span></button>`;
  return stateView(r, 'requests', d => {
    const live = x => ['open', 'choose'].includes(reqSt(x, (x.quotations || []).filter(q => q.status !== 'withdrawn').length));
    const all = d.slice(0, reqLimit), open = all.filter(live), making = all.filter(x => ['accepted', 'in_progress', 'delivered'].includes(x.status)), past = all.filter(x => !live(x) && !making.includes(x));
    const tabs = `<div class="seg req-tabs" role="tablist">${[['live', '진행중'], ['past', '거래내역']].map(([v, l]) => `<button role="tab" aria-selected="${reqTab === v}" class="${reqTab === v ? 'on' : ''}" data-reqtab="${v}">${l}</button>`).join('')}</div>`;
    const more = d.length > reqLimit ? '<button class="secondary full" data-more="requests">더 보기</button>' : '';
    if (reqTab === 'past') return tabs + (past.length ? past.map(x => x.status === 'completed' ? orderCard(x) : reqCard(x)).join('') : emptyBox('거래내역이 없어요', '완료하거나 취소한 주문이 여기에 모여요.')) + more;
    return `${tabs}${goNew}${making.length ? `<h2 class="sec-label">제작 진행 중</h2>${making.map(orderCard).join('')}` : ''}
${open.length ? `<h2 class="sec-label">견적 받는 중</h2>${open.map(reqCard).join('')}` : ''}${more}`;
  });
}
async function loadRequest(id) {
  const req = await q(sb.from('print_requests').select('*').eq('id', id).single());
  const [quotes, conv, prev] = await Promise.all([
    q(sb.from('quotations').select('id,shop_id,unit_price,quantity,total_price,shipping_fee,production_days,delivery_date,note,status,print_shops(name,region_sido,region_sigungu,items,intro)').eq('request_id', id)),
    q(sb.from('conversations').select('id').eq('request_id', id).maybeSingle()),
    sb.storage.from('request-previews').createSignedUrl(req.preview_path, 300)
  ]);
  return { req, quotes, conv, preview: prev.data?.signedUrl, reviews: await loadReviews('shop_id', [...new Set(quotes.map(x => x.shop_id))]) };
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
  return stateView(r, 'request-' + reqId, ({ req, quotes, conv, preview, reviews = [] }) => {
    const mine = reviews.find(x => x.request_id === req.id);
    const review = req.status !== 'completed' ? '' : mine ? `<div class="review-box"><strong>내가 남긴 후기</strong><p class="stars" aria-label="별점 ${mine.rating}점">${stars(mine.rating)}</p>${mine.body ? `<p>${esc(mine.body)}</p>` : ''}</div>`
      : `<form class="review-box" id="review-form" novalidate><strong>거래는 어떠셨나요?</strong><small>후기는 다른 사장님이 인쇄소를 고를 때 보여요. 이름은 첫 글자만 보여요. (예: ${esc((shop || '사').slice(0, 1))}○○ 사장님)</small><div class="star-pick" role="radiogroup" aria-label="별점">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" aria-label="${n}점" data-star="${n}">★</button>`).join('')}</div><label for="review-body" class="sr-only">후기 내용</label><textarea id="review-body" maxlength="300" placeholder="인쇄 품질, 납기, 응대는 어땠나요? (선택)"></textarea><p class="field-error" role="alert" hidden></p><button class="primary full" type="submit">후기 남기기</button></form>`;
    const live = quotes.filter(x => x.status !== 'withdrawn');
    const sorted = [...live].sort(quoteSort === 'total' ? (a, b) => (a.total_price + a.shipping_fee) - (b.total_price + b.shipping_fee) : (a, b) => a.delivery_date.localeCompare(b.delivery_date));
    const steps = ['accepted', 'in_progress', 'delivered', 'completed'], at = steps.indexOf(req.status);
    // 견적이 둘 이상일 때만 가장 싼 곳과 가장 빨리 오는 곳을 표시한다
    const minT = Math.min(...live.map(x => x.total_price + x.shipping_fee)), minD = live.map(x => x.delivery_date).sort()[0];
    const tags = x => live.length < 2 ? '' : (x.total_price + x.shipping_fee === minT ? '<span class="q-tag">최저가</span>' : '') + (x.delivery_date === minD ? '<span class="q-tag fast">가장 빠른 납기</span>' : '');
    // 단계별 시각 칸(10_photo_tracking_pay.sql)이 없는 DB에서는 지금 단계에 마지막 수정일만 보여준다
    const when = i => { const t = req[['accepted_at', 'started_at', 'delivered_at', 'completed_at'][i]] || (i === at && req.updated_at); return t ? ' · ' + ymd(t) : '' };
    const ship = req.tracking_no ? `<small class="track">${esc(req.courier || '택배')} ${esc(req.tracking_no)}</small>` : '';
    const picked = quotes.find(x => x.status === 'accepted'), due = picked ? picked.total_price + picked.shipping_fee : 0;
    // 이미 끝난 의뢰에는 결제하라고 조르지 않는다
    const pay = at < 0 || !picked || (at === 3 && !req.paid_at) ? '' : req.paid_at ? `<p class="paid">${icon('check')}결제 완료 · ${won(due)} · ${ymd(req.paid_at)} <small>테스트 결제</small></p>`
      : 'paid_at' in req ? `<div class="pay-card"><strong>결제를 기다리고 있어요</strong>${Commerce.ownerSummary(due)}<small>모의 결제예요. 실제 돈은 나가지 않아요.</small><button class="primary full" data-pay="${due}">${won(due)} 결제하기</button></div>` : '';
    return `<button class="text-button" data-page="requests">${icon('back')}받은 견적</button>
<section class="req-head">${preview ? `<img src="${esc(preview)}" alt="${esc(req.title)} 디자인 미리보기">` : ''}<div>${chip(REQ_ST[reqSt(req, live.length)])}<h1>${esc(req.title)}</h1><p>${specLine(req)}</p><small>희망 납기 ${ymd(req.due_date)} · 견적 마감 ${ymd(req.quote_deadline)}</small><small>배송 ${esc(req.region_sido)} ${esc(req.region_sigungu)}</small></div></section>
${at >= 0 ? `${pay}<ol class="timeline" aria-label="진행 상황">${STEP_INFO.map(([l, d], i) => `<li class="${i <= at ? 'done' : ''}${i === at ? ' now' : ''}"${i === at ? ' aria-current="step"' : ''}><b>${l}</b>${i === at ? `<small>${d}${when(i)}</small>` : i < at && when(i) ? `<small>${when(i).slice(3)}</small>` : ''}${i === 2 && i <= at ? ship : ''}</li>`).join('')}</ol>${review}<div class="actions">${conv ? `<button class="${pay.includes('data-pay') || review.includes('<form') ? 'secondary' : 'primary'}" data-chat="${conv.id}">${icon('chat')}채팅하기</button>` : ''}${req.status === 'delivered' ? `<button class="secondary" data-complete="${req.id}">완료 확인</button>` : ''}</div>` : ''}
<div class="section-head" style="margin-top:${at >= 0 ? 32 : 0}px"><h2>견적 ${live.length}개</h2>${live.length > 1 ? `<div class="seg">${[['total', '총액순'], ['date', '빠른 납기순']].map(([v, l]) => `<button class="${quoteSort === v ? 'on' : ''}" data-sort="${v}">${l}</button>`).join('')}</div>` : ''}</div>
${live.length ? sorted.map(x => `<article class="quote-card${x.status === 'accepted' ? ' picked' : ''}"><header><div><strong>${esc(x.print_shops?.name || '인쇄소')}</strong>${rateLine(reviews.filter(v => v.shop_id === x.shop_id))}${tags(x)}<small>${esc(x.print_shops?.region_sido || '')} ${esc(x.print_shops?.region_sigungu || '')}</small></div>${x.status !== 'submitted' ? chip(Q_ST[x.status]) : ''}</header>
<div class="nums"><div><small>총액 (배송비 포함)</small><b>${won(x.total_price + x.shipping_fee)}</b></div><div><small>배송비</small><b>${won(x.shipping_fee)}</b></div><div><small>납품 예상</small><b>${ymd(x.delivery_date)}</b></div></div>
<p class="price-row">${won(x.unit_price)} × ${Number(x.quantity).toLocaleString()}개 = ${won(x.total_price)} · 제작 ${x.production_days}일</p>${x.note ? `<p class="quote-note">${esc(x.note)}</p>` : ''}${(v => v ? `<p class="quote-review">“${esc(v.body)}” <small>${reviewer(v)}</small></p>` : '')(reviews.find(v => v.shop_id === x.shop_id && v.body))}
${req.status === 'open' && x.status === 'submitted' ? `<button class="primary full" data-accept="${x.id}" data-shop="${esc(x.print_shops?.name || '')}" data-total="${x.total_price + x.shipping_fee}" data-date="${x.delivery_date}">이 견적 수락</button>` : ''}</article>`).join('')
        : reqSt(req, 0) === 'expired' ? emptyBox('견적 마감 전에 받은 견적이 없어요', '마감일을 넉넉히 잡아 다시 요청해 보세요.') : emptyBox(req.status === 'open' ? '견적을 기다리고 있어요' : '받은 견적이 없어요', req.status === 'open' ? '인쇄소가 견적을 보내면 알림으로 알려드려요.' : '', '', 'bell')}
${req.status === 'open' ? `<button class="text-button danger-text" data-cancel="${req.id}">요청 취소</button>` : ''}`;
  });
}

// ---------- 결제 (토스페이먼츠 테스트) ----------
// 시연용: 토스 승인 API를 부르지 않고 결제창에서 돌아오면 결제 완료로 적는다.
//           실제 돈을 받으려면 Edge Function에서 시크릿 키로 승인한 뒤 mark_paid를 부르게 바꾼다
let payAmount = 0, payWidgets = null;
function payPage() {return `<button class="text-button" data-req="${esc(reqId)}">견적 비교로</button><section class="intro"><h1>결제하기 (시연)</h1><p>카드 정보 없이 시연 결제를 진행해요. 실제 돈은 나가지 않아요.</p></section>${Commerce.ownerSummary(payAmount)}<p class="field-error" id="pay-err" role="alert" hidden></p><button class="primary full" id="pay-go">${won(payAmount)} 결제하기 (시연)</button>`;}
const loadScript = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s) });
async function mountPay(){const button=$('#pay-go');if(!button)return;button.onclick=async()=>{if(button.disabled)return;button.disabled=true;try{await Commerce.payLive();page='request';render()}catch(e){const err=$('#pay-err');if(err){err.textContent=e.message;err.hidden=false}button.disabled=false}}}
// 결제창에서 돌아왔을 때: 주소의 결과를 읽고 지운 뒤 그 의뢰 화면으로 간다
async function payReturn() {
  const p = new URLSearchParams(location.search), st = p.get('pay');
  if (!st) return;
  history.replaceState(history.state, '', location.pathname);
  if (myRole !== 'owner' || !p.get('req')) return;
  reqId = p.get('req'); page = 'request';
  if (st !== 'ok' || !p.get('paymentKey')) { setTimeout(() => toast(p.get('message') || '결제를 취소했어요.')); return }
  try { await q(sb.rpc('mark_paid', { p_request: reqId, p_pay_key: p.get('paymentKey') })); setTimeout(() => doneSheet('결제가 완료됐어요', `${won(p.get('amount'))} · 테스트 결제라 실제 돈은 나가지 않았어요.`, '확인')) }
  catch (e) { setTimeout(() => toast(errMsg(e))) }
}

// 제작 요청 폼: 디자인은 지금 만든 스티커(1600px PNG) 또는 직접 올린 이미지
function newreqPage() {
  const d = reqDraft, hasBrand = !!(state.name && (state.customImage || state.industry));
  if (!d.title) d.title = (state.name || shop || '우리 가게') + ' ' + ITEM[d.item];
  const opt = (arr, v) => arr.map(x => `<option${x === v ? ' selected' : ''}>${x}</option>`).join('');
  return `<button class="text-button" data-page="requests">${icon('back')}받은 견적</button><section class="intro"><h1>제작 견적 요청</h1><p>인쇄소들이 이 내용을 보고 견적을 보내요. 가게 이름, 연락처는 공개되지 않아요.</p></section>
${!REAL?'<div class="notice">모의 견적 시연이에요. 예시 인쇄소 단가로 결제 대기 주문을 만들며 실제 제작은 접수되지 않아요.</div>':''}<form id="req-form" class="panel" novalidate>
<fieldset class="field"><legend>제작 품목</legend><div class="choices">${Object.entries(ITEM).map(([v, l]) => `<button type="button" class="choice${d.item === v ? ' selected' : ''}" data-req-item="${v}" aria-pressed="${d.item === v}">${l}</button>`).join('')}</div>${d.item === 'other' ? fld('rq-other', '품목 이름', 'text', `maxlength="30" value="${esc(d.item_other)}"`) : ''}</fieldset>
<div class="field"><label>디자인 이미지</label><div class="design-pick">${uploadFile ? `<img id="rq-thumb" alt="올린 디자인">` : hasBrand ? `<img src="${svgUri(stickerSVG())}" alt="지금 만든 스티커 디자인">` : `<div class="design-empty">${icon('image')}</div>`}<div><p class="help" style="margin:0 0 8px">${uploadFile ? esc(uploadFile.name) : hasBrand ? '지금 만든 스티커를 1600px PNG로 첨부해요.' : '브랜드를 만들거나 이미지를 올려주세요.'}</p><label class="secondary file-btn">${icon('image')}${hasBrand || uploadFile ? '다른 이미지 올리기' : '이미지 올리기'}<input type="file" id="rq-file" accept="image/png,image/jpeg,image/webp" hidden></label><small class="help">PNG, JPG, WebP · 10MB 이하</small></div></div><p class="field-error" id="rq-file-err" role="alert" hidden></p></div>
${fld('rq-title', '요청 제목', 'text', `maxlength="40" value="${esc(d.title)}"`)}
<div class="grid2">${fld('rq-qty', '제작 수량 (개)', 'number', `min="1" max="100000" inputmode="numeric" value="${d.quantity}"`)}<div class="field"><label for="rq-unit">단위</label><select id="rq-unit">${['mm', 'cm'].map(u => `<option${u === d.unit ? ' selected' : ''}>${u}</option>`).join('')}</select></div></div>
<div class="grid2">${fld('rq-w', '가로', 'number', `min="1" max="2000" step="0.1" inputmode="decimal" value="${d.width}"`)}${fld('rq-h', '세로', 'number', `min="1" max="2000" step="0.1" inputmode="decimal" value="${d.height}"`)}</div>
<div class="field"><label for="rq-mat">인쇄 재질</label><select id="rq-mat">${opt(MATERIALS, d.material)}</select></div>
<fieldset class="field"><legend>코팅, 후가공 <small>선택</small></legend><div class="choices wrap">${FINISH.map(x => `<button type="button" class="choice${d.finishing.includes(x) ? ' selected' : ''}" data-finish="${x}" aria-pressed="${d.finishing.includes(x)}">${x}</button>`).join('')}</div></fieldset>
<div class="grid2">${fld('rq-due', '희망 납기', 'date', `min="${dayAfter(3)}" value="${d.due || dayAfter(14)}"`)}${fld('rq-deadline', '견적 마감', 'date', `min="${dayAfter(1)}" value="${d.deadline || dayAfter(3)}"`)}</div>
<div class="grid2"><div class="field"><label for="rq-sido">배송 지역</label><select id="rq-sido">${opt(SIDO, d.region_sido)}</select></div>${fld('rq-sigungu', '시/군/구', 'text', `maxlength="20" placeholder="예: 북구" value="${esc(d.region_sigungu)}"`)}</div>
<button type="button" class="secondary full addr-btn" id="rq-addr">${icon('search')}주소로 배송 지역 찾기</button>
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
    else {
      stickerSVG(); // Queue the selected font before composing the print original.
      await document.fonts.ready;
      await fontsReady();
      const svg = stickerSVG().replace('width="800" height="800"', 'width="1600" height="1600"');
      src = svgUri(svg);
    }
    const img = await loadImg(src);
    const printDelivery = await StickerPrint.delivery();
    const original = printDelivery?.file || (uploadFile && uploadFile.type !== 'image/webp' ? uploadFile : await toBlob(img, 1600, false, 'image/png'));
    if(printDelivery&&original.size>30*1024*1024)throw Error('전달 파일이 30MB를 넘어요.');
    let preview = await toBlob(img, 1000, true, 'image/webp');
    const pext = preview.type === 'image/webp' ? 'webp' : 'png';
    const oext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/zip':'zip' }[original.type] || 'png';
    const dpath = `${uid}/${id}/original.${oext}`, ppath = `${uid}/${id}.${pext}`;
    label('파일 올리는 중…');
    try{await q(sb.storage.from('request-files').upload(dpath, original, { contentType: original.type }), 60000);}catch(error){if(printDelivery)throw Error('승인 인쇄 ZIP을 업로드하지 못했어요. ZIP 파일을 내려받아 인쇄소에 전달하거나 관리자에게 파일 업로드 설정을 확인해주세요.');throw error;} done.push(['request-files', dpath]);
    await q(sb.storage.from('request-previews').upload(ppath, preview, { contentType: preview.type }), 60000); done.push(['request-previews', ppath]);
    label('요청 등록 중…');
    await q(sb.from('print_requests').insert({
      id, owner_id: uid, title: d.title.trim(), item: d.item, item_other: d.item === 'other' ? d.item_other.trim() : null,
      quantity: +d.quantity, width: +d.width, height: +d.height, unit: d.unit, material: d.material, finishing: d.finishing,
      due_date: d.due, quote_deadline: new Date(d.deadline + 'T23:59:00').toISOString(), region_sido: d.region_sido,
      region_sigungu: d.region_sigungu.trim(), note: d.note.trim() || null, design_path: dpath, preview_path: ppath
    }));
    if (uploadFile) URL.revokeObjectURL(src);
    StickerPrint.clear();uploadFile = null; reqDraft = { ...reqDraft, title: '', note: '' };
    toast('견적 요청을 보냈어요. 인쇄소 견적이 오면 알려드려요.');
    reqId = id; page = 'request'; render(); scrollTo(0, 0); return true;
  } catch (e) {
    for (const [b, p] of done) sb.storage.from(b).remove([p]).catch(() => {});   // 등록 실패 시 올린 파일 정리
    const m = $('#rq-form-err'); if (m) { m.textContent = errMsg(e); m.hidden = false }
    btn.disabled = false; label('견적 요청 보내기'); return false;
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
    return { fresh, urls: Object.fromEntries(signed.map(x => [x.path, x.signedUrl])), mine, jobs, convs, reviews: myShop ? await loadReviews('shop_id', [myShop.id]) : [],
      decided: decided.length, rate: decided.length ? Math.round(decided.filter(x => x.status === 'accepted').length / decided.length * 100) : null };
  });
  const head = `<section class="shop-hero"><span class="avatar">${esc((shop || '?').slice(0, 1))}</span><div><strong>${esc(shop)}</strong><small>${myShop?.verified ? '<b class="ok">승인된 인쇄소</b>' : '<b class="wait">승인 대기 중</b>'}${V.dash?.data?.rate != null ? ` · 수락률 ${V.dash.data.rate}% (${V.dash.data.decided}건 중)` : ' · 새 요청에 견적을 보내 의뢰를 받아요'}</small></div></section>`;
  if (!myShop?.verified) return head + emptyBox('운영자 승인을 기다리고 있어요', '승인되면 소상공인의 제작 요청을 보고 견적을 보낼 수 있어요.', '', 'info');
  const next = { accepted: '제작 시작하기', in_progress: '납품 완료 알리기', delivered: '소상공인 확인 대기' };
  return head + stateView(r, 'dash', d => {
    const waitList = d.mine.filter(x => x.status === 'submitted');
    const daysAgo = t => { const n = Math.floor((Date.now() - new Date(t)) / 864e5); return n <= 0 ? '오늘' : n + '일 전' };
    const soonest = d.fresh.map(x => x.quote_deadline).filter(Boolean).sort()[0], oldest = waitList.map(x => x.updated_at).sort()[0];
    const byStatus = s => d.jobs.filter(x => x.status === s).length, dueToday = d.jobs.filter(x => x.status !== 'delivered' && x.due_date && new Date(x.due_date) - Date.now() < 864e5).length;
    const jobHint = [dueToday && `<b class="urgent">오늘 마감 ${dueToday}건</b>`, byStatus('accepted') && `제작 전 ${byStatus('accepted')}건`, byStatus('in_progress') && `제작 중 ${byStatus('in_progress')}건`, byStatus('delivered') && `확인 대기 ${byStatus('delivered')}건`].filter(Boolean).join(' · ');
    const todo = [['market', '새 요청', d.fresh.length, d.fresh.length ? `견적 마감이 가장 빠른 요청: ${dday(soonest)}` : '새 요청이 오면 알림으로 알려드려요'],
      ['myquotes', '답을 기다리는 견적', waitList.length, waitList.length ? `가장 오래 기다린 견적: ${daysAgo(oldest)} 보냄` : '보낸 견적에 답이 오면 알려드려요'],
      ['jobs', '진행 중인 의뢰', d.jobs.length, d.jobs.length ? jobHint : '견적이 수락되면 여기에서 제작을 관리해요']];
    const rv = d.reviews || [];
    return `${rv.length ? `<div class="section-head"><h2>받은 후기</h2>${rateLine(rv)}</div><div class="list">${rv.slice(0, 3).map(x => `<div class="row-card review-row"><div><p class="stars" aria-label="별점 ${x.rating}점">${stars(x.rating)}</p>${x.body ? `<span>${esc(x.body)}</span>` : ''}</div><small>${reviewer(x)}<br>${ymd(x.created_at)}</small></div>`).join('')}</div>` : ''}<div class="section-head"><h2>지금 할 일</h2></div><div class="todo">${todo.map(([p, l, n, hint]) => `<button data-page="${p}" class="${n ? '' : 'idle'}"><div><strong>${l} <em>${n}건</em></strong><small>${hint}</small></div><span class="chev" aria-hidden="true">›</span></button>`).join('')}</div>
<div class="section-head"><h2>새로 올라온 요청</h2>${d.fresh.length ? '<button class="text-button" data-page="market">전체 보기</button>' : ''}</div>
${d.fresh.length ? `<div class="h-scroll">${d.fresh.slice(0, 6).map(x => `<button class="mini-req" data-quote="${x.id}"><div class="thumb">${d.urls[x.preview_path] ? `<img src="${esc(d.urls[x.preview_path])}" alt="" loading="lazy">` : ''}<span class="dday">${dday(x.quote_deadline)}</span></div><strong>${esc(x.title)}</strong><small>${x.item === 'other' ? esc(x.item_other) : ITEM[x.item]} · ${Number(x.quantity).toLocaleString()}개</small><small>${esc(x.region_sido)} ${esc(x.region_sigungu)}</small></button>`).join('')}</div>`
      : `<div class="go-card" style="cursor:default">${icon('search')}<div><strong>지금은 새 요청이 없어요</strong><small>요청이 올라오면 알림으로 알려드려요</small></div></div>`}
<div class="section-head"><h2>진행 중인 의뢰</h2>${d.jobs.length ? '<button class="text-button" data-page="jobs">관리</button>' : ''}</div>
${d.jobs.length ? `<div class="list">${d.jobs.slice(0, 3).map(x => `<button class="job-row" data-page="jobs"><div><strong>${esc(x.title)}</strong><small>납기 ${ymd(x.due_date)} · ${next[x.status]}</small></div>${chip(REQ_ST[x.status])}</button>`).join('')}</div>`
      : `<div class="go-card" style="cursor:default">${icon('box')}<div><strong>진행 중인 의뢰가 없어요</strong><small>견적이 수락되면 여기에서 제작 상태를 관리해요</small></div></div>`}
<div class="section-head"><h2>최근 채팅</h2></div>
${d.convs.length ? `<div class="list">${d.convs.slice(0, 2).map(c => `<button class="chat-row" data-chat="${c.id}">${avatar(c.other_name)}<div><strong>${esc(c.other_name)}</strong><small>${esc(c.title)}</small><p>${esc(c.last_body || '대화를 시작해 보세요')}</p></div><div class="meta"><small>${chatTime(c.last_at)}</small>${Number(c.unread) ? `<i class="badge">${c.unread}</i>` : ''}</div></button>`).join('')}</div>`
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
${!myShop?.verified ? emptyBox('승인 대기 중이에요', '운영자가 업체를 확인하면 요청을 볼 수 있어요.', '', 'info') : stateView(r, key, ({ rows, urls }) => rows.length ? `<div class="grid-cards">${rows.slice(0, marketLimit).map(x => `<button class="market-card" data-quote="${x.id}"><div class="thumb">${urls[x.preview_path] ? `<img src="${esc(urls[x.preview_path])}" alt="" loading="lazy">` : ''}${x.my_quote_status ? `<span class="st st-acc">견적 보냄</span>` : ''}</div><strong>${esc(x.title)}</strong><small>${x.item === 'other' ? esc(x.item_other) : ITEM[x.item]} · ${Number(x.quantity).toLocaleString()}개</small><small>${esc(x.region_sido)} ${esc(x.region_sigungu)} · 마감 ${ymd(x.quote_deadline)}</small></button>`).join('')}</div>${rows.length > marketLimit ? '<button class="secondary full" data-more="market">더 보기</button>' : ''}` : emptyBox('지금 열린 요청이 없어요', '새 요청이 올라오면 알림으로 알려드려요.', '', 'search'))}`;
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
    const rows = await q(sb.from('print_requests').select('*').neq('owner_id', uid).order('due_date'));   // 결제, 송장 칸은 DB에 있을 때만 온다
    if (!rows.length) return [];
    const acceptedQuotes=await q(sb.from('quotations').select('request_id,total_price,shipping_fee').in('request_id',rows.map(x=>x.id)).eq('status','accepted'));
    const [convs, people, signed] = await Promise.all([
      q(sb.from('conversations').select('id,request_id').in('request_id', rows.map(x => x.id))),
      q(sb.from('profiles').select('id,display_name').in('id', [...new Set(rows.map(x => x.owner_id))])),
      sb.storage.from('request-previews').createSignedUrls(rows.map(x => x.preview_path), 300)]);
    const urls = Object.fromEntries((signed.data || []).map(x => [x.path, x.signedUrl]));
    return rows.map(x => ({ ...x, _commerceAmount:(()=>{const quote=acceptedQuotes.find(q=>q.request_id===x.id);return quote?quote.total_price+quote.shipping_fee:null})(), conv: convs.find(c => c.request_id === x.id)?.id, client: people.find(p => p.id === x.owner_id)?.display_name, url: urls[x.preview_path] }));
  });
  const next = { accepted: ['in_progress', '제작 시작하기', '제작을 시작할까요?'], in_progress: ['delivered', '납품 완료 알리기', '납품 완료로 바꿀까요?'] };
  const steps = ['accepted', 'in_progress', 'delivered', 'completed'];
  const active = d => d.filter(x => x.status !== 'completed'), done = d => d.filter(x => x.status === 'completed');
  const card = x => `<article class="job-card">
<div class="job-top"><div class="job-info"><p class="meta"><b class="${ST_CLS[x.status]}">${REQ_ST[x.status][0]}</b>납기 ${ymd(x.due_date)}${x.status !== 'completed' ? ` · ${dday(x.due_date).replace('오늘 마감', '오늘')}` : ''}</p><strong>${esc(x.title)}</strong><small>${specLine(x)}</small><small>의뢰인 ${esc(x.client || '소상공인')} · ${esc(x.region_sido)} ${esc(x.region_sigungu)}</small>${x.paid_at || x.tracking_no ? `<small>${x.paid_at ? '<b class="open">결제 완료</b>' : ''}${x.tracking_no ? `송장 ${esc(x.courier || '')} ${esc(x.tracking_no)}` : ''}</small>` : ''}</div>${x.url ? `<img src="${esc(x.url)}" alt="${esc(x.title)} 디자인" loading="lazy">` : ''}</div>
<ol class="progress">${['업체 선택', '제작 중', '납품', '완료'].map((l, i) => `<li class="${i <= steps.indexOf(x.status) ? 'done' : ''}">${l}</li>`).join('')}</ol>
${x.note ? `<p class="quote-note">${esc(x.note)}</p>` : ''}
${Commerce.printerSummary(x._commerceAmount,x.status,!!x.paid_at)}<div class="job-links"><button data-original="${esc(x.design_path)}">${icon('download')}${x.design_path.endsWith('.zip')?'인쇄 파일 ZIP':'원본 파일'}</button>${x.conv ? `<button data-chat="${x.conv}">${icon('chat')}채팅하기</button>` : ''}</div>
${next[x.status] ? `<button class="primary full" data-advance="${x.id}" data-to="${next[x.status][0]}" data-ask="${next[x.status][2]}">${next[x.status][1]}</button>` : x.status === 'delivered' ? '<p class="job-wait">소상공인이 받았는지 확인하면 완료돼요</p>' : ''}</article>`;
  return stateView(r, 'jobs', d => d.length ? `<h2 class="sec-label">진행 중 ${active(d).length}건</h2>${active(d).map(card).join('') || '<p class="help">진행 중인 의뢰가 없어요.</p>'}${done(d).length ? `<h2 class="sec-label">완료<small>제작이 끝난 의뢰예요</small></h2>${done(d).map(card).join('')}` : ''}`
    : emptyBox('수락된 의뢰가 없어요', '견적이 수락되면 여기에서 원본을 받고 제작 상태를 알려요.', '<button class="secondary" data-page="market">요청 찾기</button>'));
}

// ---------- 페이지 등록, 이벤트 ----------
const PAGES = REAL ? { admin: adminPage, dash: dashPage, market: marketPage, quote: quotePage, myquotes: myquotesPage, jobs: jobsPage, requests: requestsPage, newreq: newreqPage, request: requestPage, pay: payPage, notis: notisPage, mypage: realMypage } : {};
function navItems() {
  if (REAL && myRole === 'admin') return [['admin', 'user', '계정 관리']];
  if (REAL && myRole === 'printer') return [['dash', 'home', '대시보드'], ['market', 'search', '요청 찾기'], ['myquotes', 'folder', '보낸 견적'], ['chats', 'chat', '채팅'], ['mypage', 'user', '마이']];
  if (REAL) return [['home', 'home', '홈'], ['saved', 'folder', '내 브랜드'], ['requests', 'box', '받은 견적'], ['chats', 'chat', '채팅'], ['mypage', 'user', '마이']];
  return [['home', 'home', '홈'], ['saved', 'folder', '내 브랜드'], ['mypage', 'user', '마이페이지']];
}
// 화면 제목을 상단 바에 크게 쓰는 화면 (본문 첫 제목은 숨김)
const APP_TITLE_PAGES = ['admin', 'saved', 'requests', 'chats', 'mypage', 'notis', 'dash', 'market', 'myquotes', 'jobs', 'newreq', 'guide'];
function appBar() {
  const title = { saved: '내 브랜드', mypage: '마이페이지', studio: typeof focusMode !== 'undefined' && focusMode && step >= 3 ? '만들기' : '브랜드 만들기', guide: '이용 가이드', ...PAGE_LABEL }[page];
  const left = title ? `<h1 class="app-title">${esc(title)}</h1>` : `<h1 class="app-title brand"><img class="wordmark" src="assets/brand/logo-green.svg" alt="가게온"></h1>`;
  // #logout은 마이페이지 '로그아웃' 버튼이 누르는 숨은 버튼
  return `<header class="app-bar">${left}<div class="app-actions">${myRole === 'admin' ? '<button class="secondary" id="admin-logout">로그아웃</button>' : `${bellButton()}<button class="icon-btn" data-page="mypage" aria-label="마이페이지">${icon('user')}</button>`}<button id="logout" hidden></button></div></header>`;
}
// 메뉴에 없는 하위 화면은 속한 메뉴 칸을 켜 둔다 (수락된 의뢰 → 대시보드 등)
const NAV_PARENT = { jobs: 'dash', quote: 'market', request: 'requests', newreq: 'requests', chat: 'chats', studio: 'home', notis: 'mypage', guide: 'mypage' };
const navTab = () => { const p = NAV_PARENT[page] || page; return p === 'requests' && !REAL ? 'home' : p };
function bellButton() { return REAL ? `<button class="bell" data-page="notis" aria-label="${notiCount ? `알림 ${notiCount}개 안 읽음` : '알림'}">${icon('bell')}<i id="bell-count" class="dot" ${notiCount ? '' : 'hidden'}></i></button>` : '' }
function bindPrint() {
  if (REAL) bindReal();
  if (page !== 'request' && quoteChannel) { sb.removeChannel(quoteChannel); quoteChannel = null }
  if (page !== 'chat' && window.leaveChat) leaveChat();
  if (page === 'chat' && window.mountChat) mountChat();
  $('#app').querySelectorAll('[data-reload]').forEach(b => b.onclick = () => reload(b.dataset.reload));
  $('#app').querySelectorAll('[data-more]').forEach(b => b.onclick = () => { if (b.dataset.more === 'market') marketLimit += 20; else reqLimit += 20; reload(enteredKey) });
  if ($('#to-request')) $('#to-request').onclick = () => { if (!REAL) return toast('실제 계정으로 로그인하면 견적을 받을 수 있어요.'); syncForm?.(); page = 'newreq'; render(); scrollTo(0, 0) };
  if ($('#push-toggle')) $('#push-toggle').onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try { pushOn ? await disablePush() : await enablePush() } catch (err) { toast(err?.name === 'NotAllowedError' ? '알림을 허용해야 받을 수 있어요.' : errMsg(err)) }
    render();
  };
  $('#app').querySelectorAll('[data-go-new]').forEach(b => b.onclick = () => { page = 'newreq'; render(); scrollTo(0, 0) });
  $('#app').querySelectorAll('[data-req]').forEach(b => b.onclick = () => { reqId = b.dataset.req; page = 'request'; render(); scrollTo(0, 0) });
  $('#app').querySelectorAll('[data-reorder-req]').forEach(b => b.onclick = () => { reqId = b.dataset.reorderReq; page = 'request'; render(); scrollTo(0, 0); let n = 0; const t = setInterval(() => { const go = $('[data-live-reorder]'); if (go || ++n > 40 || page !== 'request') { clearInterval(t); go?.click() } }, 150) });
  $('#app').querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { quoteSort = b.dataset.sort; render() });
  const rf = $('#review-form');
  if (rf) {
    // 별을 누를 때 화면을 다시 그리지 않아서 적던 후기가 지워지지 않는다
    rf.querySelectorAll('[data-star]').forEach(b => b.onclick = () => { rf.dataset.star = b.dataset.star; rf.querySelectorAll('[data-star]').forEach(s => { const on = s.dataset.star <= b.dataset.star; s.classList.toggle('on', on); s.setAttribute('aria-checked', s === b) }) });
    rf.onsubmit = async e => {
      e.preventDefault();
      const err = rf.querySelector('.field-error'), btn = rf.querySelector('[type=submit]');
      if (!rf.dataset.star) { err.textContent = '별점을 골라주세요.'; err.hidden = false; return }
      btn.disabled = true;
      try { await q(sb.rpc('write_review', { p_request: reqId, p_rating: Number(rf.dataset.star), p_body: $('#review-body').value })); toast('후기를 남겼어요. 고마워요.'); reload('request-' + reqId) }
      catch (e2) { err.textContent = errMsg(e2); err.hidden = false; btn.disabled = false }
    };
  }
  $('#app').querySelectorAll('[data-reqtab]').forEach(b => b.onclick = () => { reqTab = b.dataset.reqtab; render() });
  $('#app').querySelectorAll('[data-chat]').forEach(b => b.onclick = () => { convId = b.dataset.chat; page = 'chat'; render(); scrollTo(0, 0) });
  $('#app').querySelectorAll('[data-accept]').forEach(b => b.onclick = () => modal({
    title: '이 견적을 수락할까요?', ok: '수락하기',
    body: `<p><b>${esc(b.dataset.shop)}</b> · 총 ${won(b.dataset.total)} · ${ymd(b.dataset.date)} 납품 예상</p><p class="help">수락하면 다른 견적은 자동으로 거절되고, 이 업체와 채팅이 열려요. 되돌릴 수 없어요.</p>`,
    onOk: async () => { convId = await q(sb.rpc('accept_quotation', { p_quote: b.dataset.accept })); setTimeout(() => { reload('request-' + reqId); doneSheet('견적을 수락했어요', `${esc(b.dataset.shop)}와 채팅이 열렸어요. 결제하면 인쇄소에 알림이 가요.`, `${won(b.dataset.total)} 결제하기 (시연)`, () => { payAmount = Number(b.dataset.total); page = 'pay'; render(); scrollTo(0, 0) }) }) }
  }));
  $('#app').querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => modal({ title: '요청을 취소할까요?', ok: '요청 취소', danger: true, body: '<p class="help">받은 견적은 모두 거절 처리되고 되돌릴 수 없어요.</p>', onOk: async () => { await q(sb.rpc('cancel_request', { p_request: b.dataset.cancel })); toast('요청을 취소했어요.'); setTimeout(() => reload('request-' + reqId)) } }));
  $('#app').querySelectorAll('[data-complete]').forEach(b => b.onclick = () => modal({ title: '제작 완료를 확인할까요?', ok: '완료 확인', body: '<p class="help">물건을 받았으면 완료로 바꿔주세요.</p>', onOk: async () => { await q(sb.rpc('advance_request', { p_request: b.dataset.complete, p_status: 'completed' })); setTimeout(() => { reload('request-' + reqId); doneSheet('제작이 완료됐어요', '거래가 끝났어요. 받은 견적의 지난 의뢰에서 다시 볼 수 있어요.', '확인') }) } }));
  $('#app').querySelectorAll('[data-noti]').forEach(b => b.onclick = () => { const n = V.notis?.data?.find(x => String(x.id) === b.dataset.noti); if (!n) return; const [p, id] = (NOTI_GO[n.type] || (() => ['home']))(n); if (id) reqId = id; page = p; render(); scrollTo(0, 0) });
  // 제작 요청 폼
  $('#app').querySelectorAll('[data-req-item]').forEach(b => b.onclick = () => { syncReq(); reqDraft.item = b.dataset.reqItem; reqDraft.title = ''; render() });
  $('#app').querySelectorAll('[data-finish]').forEach(b => b.onclick = () => { syncReq(); const f = reqDraft.finishing, v = b.dataset.finish; reqDraft.finishing = f.includes(v) ? f.filter(x => x !== v) : [...f, v]; render() });
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
  $('#app').querySelectorAll('[data-market]').forEach(b => b.onclick = () => { marketFilter = b.dataset.market; marketLimit = 20; render() });
  $('#app').querySelectorAll('[data-quote]').forEach(b => b.onclick = () => { reqId = b.dataset.quote; page = 'quote'; render(); scrollTo(0, 0) });
  $('#app').querySelectorAll('[data-myquote]').forEach(b => b.onclick = () => { reqId = b.dataset.myquote; page = b.dataset.st === 'accepted' ? 'jobs' : 'quote'; render(); scrollTo(0, 0) });
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
  $('#app').querySelectorAll('[data-withdraw]').forEach(b => b.onclick = () => modal({ title: '견적을 철회할까요?', ok: '철회', danger: true, body: '<p class="help">마감 전이면 다시 보낼 수 있어요.</p>', onOk: async () => { await q(sb.rpc('withdraw_quotation', { p_quote: b.dataset.withdraw })); toast('견적을 철회했어요.'); setTimeout(() => reload('quote-' + reqId)) } }));
  $('#app').querySelectorAll('[data-original]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { const d = await q(sb.storage.from('request-files').createSignedUrl(b.dataset.original, 300, { download: true })); location.href = d.signedUrl } catch (e) { toast(errMsg(e)) } finally { b.disabled = false }
  });
  // 납품할 때는 송장번호를 같이 받는다. 비워 두면 예전처럼 상태만 바꾼다
  $('#app').querySelectorAll('[data-advance]').forEach(b => b.onclick = () => modal({
    title: b.dataset.ask || '상태를 바꿀까요?', ok: '바꾸기',
    body: (b.dataset.to === 'delivered' ? `${fld('tr-courier', '택배사 (선택)', 'text', 'maxlength="20" placeholder="예: CJ대한통운"')}${fld('tr-no', '송장번호 (선택)', 'text', 'maxlength="30" inputmode="numeric" autocomplete="off"')}` : '') + '<p class="help">소상공인에게 알림이 가요.</p>',
    onOk: async () => {
      const no = $('#tr-no')?.value.trim();
      if (no) await q(sb.rpc('set_tracking', { p_request: b.dataset.advance, p_courier: $('#tr-courier').value, p_no: no }));
      await q(sb.rpc('advance_request', { p_request: b.dataset.advance, p_status: b.dataset.to })); setTimeout(() => reload('jobs'));
    }
  }));
  $('#app').querySelectorAll('[data-pay]').forEach(b => b.onclick = () => { payAmount = Number(b.dataset.pay); page = 'pay'; render(); scrollTo(0, 0) });
  if (page === 'pay') mountPay();
}
