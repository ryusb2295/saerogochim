# 관리자 계정 설정

관리자 화면은 기존 Supabase 계정과 같은 로그인 화면에서 `admin`으로 들어갑니다. 소상공인과 인쇄소 계정을 나눠 보여주고, 탈퇴할 계정의 아이디를 다시 입력하면 해당 계정과 관련 데이터를 삭제합니다.

## 최초 1회 설정

1. Supabase Dashboard의 SQL Editor에서 [`supabase/07_admin.sql`](supabase/07_admin.sql)을 실행합니다.
2. **로컬 컴퓨터에서만** Supabase 프로젝트의 `service_role` 키와 관리자 초기 비밀번호를 환경변수 `SUPABASE_SERVICE_ROLE_KEY`, `GAGEON_ADMIN_PASSWORD`로 설정합니다.
3. `node scripts/create_admin.mjs`를 실행합니다. 이미 `admin` 계정이 있으면 비밀번호를 바꾸지 않습니다.

`service_role` 키는 서버 전용 권한이므로 `config.js`, GitHub 저장소, GitHub Pages, 브라우저에 넣으면 안 됩니다. 초기 비밀번호도 파일에 저장하지 않습니다. 실행 후 환경변수를 지웁니다.

## 탈퇴 처리

관리자 화면의 **탈퇴** 버튼은 해당 회원의 브랜드·요청 파일을 Storage API로 삭제한 다음, 데이터베이스에서 계정과 관련 요청·견적·채팅을 삭제합니다. 인쇄소가 수락한 의뢰는 견적 대기 또는 마감 상태로 돌아갑니다. 삭제된 계정은 다시 로그인할 수 없지만 이미 발급된 액세스 토큰은 만료될 때까지 유효할 수 있습니다.

SQL 마이그레이션과 관리자 계정 생성이 끝나기 전에는 관리자 로그인을 사용할 수 없습니다.
