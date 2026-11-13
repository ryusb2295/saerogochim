// 서버 권한 키는 환경변수에서만 읽는다. 브라우저나 저장소에 넣지 않는다.
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const config = await readFile(join(dirname(fileURLToPath(import.meta.url)), '..', 'config.js'), 'utf8');
const url = config.match(/supabaseUrl: '([^']+)'/)?.[1];
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.GAGEON_ADMIN_PASSWORD;
if (!url || !key || !password) throw Error('Supabase URL, SUPABASE_SERVICE_ROLE_KEY, GAGEON_ADMIN_PASSWORD가 필요합니다.');
if (password.length < 8) throw Error('관리자 비밀번호는 8자 이상이어야 합니다.');

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(url + path, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const content = await response.text();
  if (!response.ok) throw Error(`${method} ${path}: ${response.status} ${content}`);
  return content ? JSON.parse(content) : null;
}

const existing = await api('/rest/v1/profiles?select=id&username=eq.admin');
if (existing.length) {
  console.log('admin 계정이 이미 있습니다. 비밀번호는 변경하지 않았습니다.');
  process.exit(0);
}

// 공개 가입에서 admin 아이디를 예약했으므로 임시 아이디로 생성한 직후
// service role 권한으로만 프로필을 admin 역할/아이디로 바꾼다.
const temporaryName = `setup${randomBytes(6).toString('hex')}`;
const created = await api('/auth/v1/admin/users', {
  method: 'POST',
  body: {
    email: 'admin@users.gageon.invalid', password, email_confirm: true,
    user_metadata: { username: temporaryName, role: 'owner', display_name: '관리자' }
  }
});
const id = created.id || created.user?.id;
if (!id) throw Error('관리자 인증 계정 생성 결과에 사용자 ID가 없습니다.');
try {
  await api(`/rest/v1/profiles?id=eq.${id}`, {
    method: 'PATCH', body: { username: 'admin', role: 'admin', display_name: '관리자' }
  });
  await api(`/auth/v1/admin/users/${id}`, {
    method: 'PUT', body: { user_metadata: { username: 'admin', role: 'admin', display_name: '관리자' } }
  });
  const profile = await api(`/rest/v1/profiles?select=id,username,role&id=eq.${id}`);
  if (profile[0]?.username !== 'admin' || profile[0]?.role !== 'admin') throw Error('관리자 권한 확인에 실패했습니다.');
} catch (error) {
  // 권한 승격이 실패한 임시 일반 회원을 남기지 않는다.
  await api(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
  throw error;
}
console.log('admin 계정을 만들었습니다. 관리자 화면에서 로그인할 수 있습니다.');
