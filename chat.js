// 가게온 1:1 채팅: Supabase Realtime으로 새 메시지를 받고, 보낼 때는 client_id로 재시도 중복을 막는다.
// 채팅방은 견적 수락 때 DB 함수가 만들고, 읽기/쓰기는 RLS가 두 참여자로 제한한다.
let chatCh = null, chatConv = '', chatMsgs = [], chatInfo = null, chatLive = 'connecting', chatAll = false, chatHadError = false;

function chatsPage() {
  const r = useData('chats', () => q(sb.rpc('my_conversations')));
  return `<section class="intro"><h1>채팅</h1><p>견적을 수락한 업체와 대화해요.</p></section>${stateView(r, 'chats', d => (d = d.filter(c => c.last_body)).length ? `<div class="list">${d.map(c => `<button class="chat-row" data-chat="${c.id}">${avatar(c.other_name)}<div><strong>${esc(c.other_name)}</strong><small>${esc(c.title)}</small><p>${esc(c.last_body || '대화를 시작해 보세요')}</p></div><div class="meta"><small>${chatTime(c.last_at)}</small>${Number(c.unread) ? `<i class="badge">${c.unread}</i>` : ''}</div></button>`).join('')}</div>` : emptyBox('아직 채팅이 없어요', myRole === 'printer' ? '견적이 수락되면 채팅이 열려요.' : '견적을 수락하면 그 업체와 채팅이 열려요.', myRole === 'printer' ? '<button class="secondary" data-page="market">요청 찾기</button>' : '<button class="secondary" data-page="requests">받은 견적 보기</button>', 'chat'))}`;
}
const chatTime = t => { const d = new Date(t), now = new Date(); return d.toDateString() === now.toDateString() ? d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) };

// 빠른 답장: 누르면 입력칸에 넣어 주고, 고쳐서 보낼 수 있다
const QUICK_REPLIES = { owner: ['견적 확인했어요', '시안 보내드릴게요', '언제 받을 수 있나요?', '감사합니다!'], printer: ['견적 보내드렸어요', '시안 확인 부탁드려요', '오늘 발송했어요', '감사합니다!'] };
function chatPage() {
  const i = chatConv === convId ? chatInfo : null;
  return `<div class="chat-wrap"><header class="chat-head"><button class="ask-back" data-page="chats" aria-label="채팅 목록">${icon('back')}</button><div class="chat-title"><strong>${esc(i?.other_name || '채팅')}</strong><small>${esc(i?.title || '')} ${i ? chip(REQ_ST[i.request_status]) : ''}</small></div></header>
<div id="chat-banner" class="chat-banner" role="status" hidden>연결이 끊겼어요. 다시 연결하는 중…</div>
<div id="chat-log" class="chat-log" aria-live="polite" aria-label="메시지"></div>
<div class="quick-replies" aria-label="빠른 답장">${QUICK_REPLIES[myRole === 'printer' ? 'printer' : 'owner'].map(t => `<button type="button" data-quick-reply="${esc(t)}">${esc(t)}</button>`).join('')}</div>
<form id="chat-form" class="chat-input"><label for="chat-text" class="sr-only">메시지</label><textarea id="chat-text" rows="1" maxlength="1000" placeholder="메시지 보내기..."></textarea><label class="chat-attach" aria-label="사진 보내기">${icon('image')}<input type="file" id="chat-file" accept="image/png,image/jpeg,image/webp" hidden></label><button class="chat-send" type="submit" aria-label="보내기">${icon('arrow')}</button></form></div>`;
}

// 화면을 다시 그릴 때마다 호출된다. 방이 바뀌었을 때만 새로 불러오고 구독한다
async function mountChat() {
  enteredKey = '';   // 채팅방에 다녀오면 목록의 마지막 메시지를 새로 받아오게 한다
  paintChat();
  bindChatForm();
  if (chatConv === convId) return;
  leaveChat();
  chatConv = convId; chatMsgs = []; chatInfo = null; chatAll = false; chatLive = 'connecting';
  const log = $('#chat-log'); if (log) log.innerHTML = skeleton(2);
  try {
    const [convs, rows] = await Promise.all([q(sb.rpc('my_conversations')), q(sb.from('messages').select('*').eq('conversation_id', convId).order('id', { ascending: false }).limit(50))]);
    if (chatConv !== convId) return;
    chatInfo = convs.find(c => c.id === convId) || null;
    if (!chatInfo) { if (log) log.innerHTML = emptyBox('볼 수 없는 채팅이에요', '참여한 채팅만 열 수 있어요.', '<button class="secondary" data-page="chats">채팅 목록으로</button>', 'chat'); return }
    chatMsgs = rows.reverse(); chatAll = rows.length < 50;
    render();                                       // 헤더에 상대 이름 반영
    sb.rpc('mark_read', { p_conv: convId }).then(() => refreshChatUnread(), () => {});
    subscribeChat();
  } catch (e) { chatConv = ''; if (log) log.innerHTML = errorBox(errMsg(e), 'chat') }   // 다시 시도하면 처음부터 불러오게
}
function subscribeChat() {
  const conv = chatConv;
  chatCh = sb.channel('chat-' + conv).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conv }, p => {
    if (chatConv !== conv) return;
    addMsg(p.new);
    if (p.new.sender_id !== uid) sb.rpc('mark_read', { p_conv: conv }).then(() => {}, () => {});
  }).subscribe(async st => {
    if (chatConv !== conv) return;
    const banner = $('#chat-banner');
    if (st === 'SUBSCRIBED') {
      if (banner) banner.hidden = true;
      if (chatHadError) {                           // 끊긴 사이 온 메시지로 빈틈 메우기
        chatHadError = false;
        const last = chatMsgs.filter(m => m.id).at(-1)?.id || 0;
        try { (await q(sb.from('messages').select('*').eq('conversation_id', conv).gt('id', last).order('id'))).forEach(addMsg) } catch {}
      }
    } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(st)) { chatHadError = true; if (banner) banner.hidden = false }
  });
}
function leaveChat() { if (chatCh) sb.removeChannel(chatCh); chatCh = null; chatConv = '' }
window.leaveChat = leaveChat; window.mountChat = mountChat;

// 같은 client_id면 임시 말풍선을 서버 저장본으로 바꾼다
function addMsg(row) {
  const i = chatMsgs.findIndex(m => m.client_id === row.client_id);
  if (i >= 0) chatMsgs[i] = row; else if (!chatMsgs.some(m => m.id === row.id)) chatMsgs.push(row);
  paintChat(row.sender_id === uid);
}
function paintChat(forceBottom = false) {
  const log = $('#chat-log'); if (!log || chatConv !== convId) return;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  let html = chatAll ? '' : '<button class="text-button older" data-older>이전 메시지 더 보기</button>', day = '';
  chatMsgs.forEach((m, i) => {
    const d = new Date(m.created_at), k = d.toDateString(), next = chatMsgs[i + 1];
    if (k !== day) { day = k; html += `<p class="day-sep">${d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</p>` }
    const mine = m.sender_id === uid, prev = chatMsgs[i - 1];
    if (!mine && (!prev || prev.sender_id !== m.sender_id || new Date(prev.created_at).toDateString() !== k)) { const nm = chatInfo?.other_name || '상대'; html += `<div class="bubble-who"><span class="avatar" aria-hidden="true">${esc([...nm][0] || '?')}</span>${esc(nm)}</div>` }
    // 같은 사람이 같은 분에 보낸 연속 메시지는 마지막에만 시간 표시
    const showTime = !next || next.sender_id !== m.sender_id || new Date(next.created_at).getMinutes() !== d.getMinutes();
    const src = m.image_path && (m.localUrl || chatImgs[m.image_path]);
    html += `<div class="bubble-row${mine ? ' mine' : ''}">${m.image_path ? (src ? `<a class="bubble-img" href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="보낸 사진" loading="lazy"></a>` : '<p class="bubble">사진을 불러오는 중…</p>') : `<p class="bubble${m.failed ? ' failed' : ''}">${esc(m.body)}</p>`}${m.failed ? `<button class="text-button danger-text" data-resend="${m.client_id}">다시 보내기</button>` : m.pending ? '<small>보내는 중</small>' : showTime ? `<small>${d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}</small>` : ''}</div>`;
  });
  log.innerHTML = html || '<p class="day-sep">첫 메시지를 보내보세요.</p>';
  loadChatImgs();
  if (forceBottom || nearBottom) log.scrollTop = log.scrollHeight;
  log.querySelectorAll('[data-resend]').forEach(b => b.onclick = () => { const m = chatMsgs.find(x => x.client_id === b.dataset.resend); if (m) sendMsg(m) });
  const older = log.querySelector('[data-older]');
  if (older) older.onclick = async () => {
    older.disabled = true;
    try {
      const first = chatMsgs.find(m => m.id)?.id; const h = log.scrollHeight;
      const rows = await q(sb.from('messages').select('*').eq('conversation_id', chatConv).lt('id', first).order('id', { ascending: false }).limit(50));
      chatAll = rows.length < 50; chatMsgs = [...rows.reverse(), ...chatMsgs]; paintChat(); log.scrollTop = log.scrollHeight - h;
    } catch (e) { toast(errMsg(e)); older.disabled = false }
  };
}
// 사진은 비공개 버킷에 있어서 서명 주소를 받아와야 보인다. 한 번 물어본 경로는 다시 묻지 않는다
const chatImgs = {};
async function loadChatImgs() {
  const need = [...new Set(chatMsgs.filter(m => m.image_path && !m.localUrl && !(m.image_path in chatImgs)).map(m => m.image_path))];
  if (!need.length) return;
  need.forEach(p => chatImgs[p] = '');
  const { data } = await sb.storage.from('chat-images').createSignedUrls(need, 3600);
  (data || []).forEach(x => { if (x.signedUrl) chatImgs[x.path] = x.signedUrl });
  paintChat();
}
async function sendPhoto(file) {
  if (!chatInfo) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return toast('PNG, JPG, WebP 사진만 보낼 수 있어요.');
  if (file.size > 5242880) return toast('사진은 5MB 이하만 보낼 수 있어요.');
  const id = crypto.randomUUID(), path = `${uid}/${chatConv}/${id}.${file.type.split('/')[1]}`;
  const m = { client_id: id, sender_id: uid, body: '사진', image_path: path, localUrl: URL.createObjectURL(file), created_at: new Date().toISOString(), pending: true };
  chatMsgs.push(m); paintChat(true);
  const { error } = await sb.storage.from('chat-images').upload(path, file, { contentType: file.type });
  if (error) { chatMsgs = chatMsgs.filter(x => x !== m); paintChat(); return toast('사진을 보내지 못했어요. 잠시 뒤 다시 시도해주세요.') }
  sendMsg(m);
}
async function sendMsg(m) {
  m.failed = false; m.pending = true; paintChat(true);
  try {
    const { data, error } = await sb.from('messages').insert({ conversation_id: chatConv, sender_id: uid, client_id: m.client_id, body: m.body, ...(m.image_path ? { image_path: m.image_path } : {}) }).select().single();
    if (error && error.code !== '23505') throw error;   // 23505: 이미 저장됨 (재시도 중복)
    if (data) addMsg(data); else { m.pending = false; paintChat() }
  } catch { m.pending = false; m.failed = true; paintChat() }
}
// 채팅방은 카톡처럼 메시지 목록만 스크롤하고 입력칸은 아래에 고정한다.
// 보이는 화면 높이(visualViewport: 키보드가 올라오면 줄어듦)에 맞춰 채팅 상자 높이를 정하고, 그동안 페이지 스크롤은 막는다
function fitChat() {
  const w = document.querySelector('.chat-wrap');
  document.documentElement.classList.toggle('chat-open', !!w);
  if (!w) return;
  const vv = window.visualViewport, h = vv ? vv.height : innerHeight, off = vv ? vv.offsetTop : 0;
  const keyboard = innerHeight - h > 120;
  const nav = keyboard ? 0 : (document.querySelector('.bottomnav')?.offsetHeight || 0);
  if (scrollY) scrollTo(0, 0);
  const top = w.getBoundingClientRect().top;
  const log = document.getElementById('chat-log'), atBottom = log && log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  w.style.height = Math.max(220, off + h - top - nav - 8) + 'px';
  if (atBottom) log.scrollTop = log.scrollHeight;
}
if (window.visualViewport) { visualViewport.addEventListener('resize', fitChat); visualViewport.addEventListener('scroll', fitChat) }
addEventListener('resize', fitChat);
function bindChatForm() {
  const f = $('#chat-form'), t = $('#chat-text'); if (!f) return;
  f.onsubmit = e => {
    e.preventDefault();
    const body = t.value.trim(); if (!body || !chatInfo) return;
    t.value = '';
    const m = { client_id: crypto.randomUUID(), sender_id: uid, body: body.slice(0, 1000), created_at: new Date().toISOString(), pending: true };
    chatMsgs.push(m); sendMsg(m); t.focus();
  };
  const pick = $('#chat-file');
  if (pick) pick.onchange = () => { if (pick.files[0]) sendPhoto(pick.files[0]); pick.value = '' };
  // 한글 조합 중 Enter는 글자 확정이라 보내지 않는다
  document.querySelectorAll('[data-quick-reply]').forEach(b => b.onclick = () => { t.value = b.dataset.quickReply; t.focus() });
  t.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); f.requestSubmit() } };
}
Object.assign(PAGES, REAL ? { chats: chatsPage, chat: chatPage } : {});
