// 가게온 1:1 채팅: Supabase Realtime으로 새 메시지를 받고, 보낼 때는 client_id로 재시도 중복을 막는다.
// 채팅방은 견적 수락 때 DB 함수가 만들고, 읽기/쓰기는 RLS가 두 참여자로 제한한다. 설계: docs/PRINT_PLATFORM.md 2.9
let chatCh = null, chatConv = '', chatMsgs = [], chatInfo = null, chatLive = 'connecting', chatAll = false, chatHadError = false;

function chatsPage() {
  const r = useData('chats', () => q(sb.rpc('my_conversations')));
  return `<section class="intro"><h1>채팅</h1><p>견적을 수락한 업체와 대화해요.</p></section>${stateView(r, 'chats', d => d.length ? `<div class="list">${d.map(c => `<button class="chat-row" data-chat="${c.id}"><span class="avatar">${esc((c.other_name || '?').slice(0, 1))}</span><div><strong>${esc(c.other_name)}</strong><small>${esc(c.title)}</small><p>${esc(c.last_body || '대화를 시작해 보세요')}</p></div><div class="meta"><small>${chatTime(c.last_at)}</small>${Number(c.unread) ? `<i class="badge">${c.unread}</i>` : ''}</div></button>`).join('')}</div>` : emptyBox('아직 채팅이 없어요', myRole === 'printer' ? '견적이 수락되면 채팅이 열려요.' : '견적을 수락하면 그 업체와 채팅이 열려요.'))}`;
}
const chatTime = t => { const d = new Date(t), now = new Date(); return d.toDateString() === now.toDateString() ? d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) };

function chatPage() {
  const i = chatConv === convId ? chatInfo : null;
  return `<div class="chat-wrap"><header class="chat-head"><button class="text-button" data-page="chats" aria-label="채팅 목록">${icon('back')}</button><div><strong>${esc(i?.other_name || '채팅')}</strong><small>${esc(i?.title || '')} ${i ? chip(REQ_ST[i.request_status]) : ''}</small></div></header>
<div id="chat-banner" class="chat-banner" role="status" hidden>연결이 끊겼어요. 다시 연결하는 중…</div>
<div id="chat-log" class="chat-log" aria-live="polite" aria-label="메시지"></div>
<form id="chat-form" class="chat-input"><label for="chat-text" class="sr-only">메시지</label><textarea id="chat-text" rows="1" maxlength="1000" placeholder="메시지를 입력하세요"></textarea><button class="primary" type="submit" aria-label="보내기">보내기</button></form></div>`;
}

// 화면을 다시 그릴 때마다 호출된다. 방이 바뀌었을 때만 새로 불러오고 구독한다
async function mountChat() {
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
    if (!chatInfo) { if (log) log.innerHTML = emptyBox('볼 수 없는 채팅이에요', '참여한 채팅만 열 수 있어요.'); return }
    chatMsgs = rows.reverse(); chatAll = rows.length < 50;
    render();                                       // 헤더에 상대 이름 반영
    sb.rpc('mark_read', { p_conv: convId }).then(() => {}, () => {});
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
    const mine = m.sender_id === uid;
    // 같은 사람이 같은 분에 보낸 연속 메시지는 마지막에만 시간 표시
    const showTime = !next || next.sender_id !== m.sender_id || new Date(next.created_at).getMinutes() !== d.getMinutes();
    html += `<div class="bubble-row${mine ? ' mine' : ''}"><p class="bubble${m.failed ? ' failed' : ''}">${esc(m.body)}</p>${m.failed ? `<button class="text-button danger-text" data-resend="${m.client_id}">다시 보내기</button>` : m.pending ? '<small>보내는 중</small>' : showTime ? `<small>${d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}</small>` : ''}</div>`;
  });
  log.innerHTML = html || '<p class="day-sep">첫 메시지를 보내보세요.</p>';
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
async function sendMsg(m) {
  m.failed = false; m.pending = true; paintChat(true);
  try {
    const { data, error } = await sb.from('messages').insert({ conversation_id: chatConv, sender_id: uid, client_id: m.client_id, body: m.body }).select().single();
    if (error && error.code !== '23505') throw error;   // 23505: 이미 저장됨 (재시도 중복)
    if (data) addMsg(data); else { m.pending = false; paintChat() }
  } catch { m.pending = false; m.failed = true; paintChat() }
}
function bindChatForm() {
  const f = $('#chat-form'), t = $('#chat-text'); if (!f) return;
  f.onsubmit = e => {
    e.preventDefault();
    const body = t.value.trim(); if (!body || !chatInfo) return;
    t.value = '';
    const m = { client_id: crypto.randomUUID(), sender_id: uid, body: body.slice(0, 1000), created_at: new Date().toISOString(), pending: true };
    chatMsgs.push(m); sendMsg(m); t.focus();
  };
  // 한글 조합 중 Enter는 글자 확정이라 보내지 않는다
  t.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); f.requestSubmit() } };
}
Object.assign(PAGES, REAL ? { chats: chatsPage, chat: chatPage } : {});
