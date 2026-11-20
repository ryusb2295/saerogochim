# 관리자 계정 설정

관리자 화면은 기존 Supabase 계정과 같은 로그인 화면에서 `admin`으로 들어갑니다. 소상공인과 인쇄소 계정을 나눠 보여주고, 탈퇴할 계정의 아이디를 다시 입력하면 해당 계정과 관련 데이터를 삭제합니다.

## 최초 1회 설정

1. Supabase Dashboard의 SQL Editor에서 [`supabase/07_admin.sql`](supabase/07_admin.sql)을 실행합니다.
2. **로컬 컴퓨터에서만** Supabase 프로젝트의 `service_role` 키와 관리자 초기 비밀번호를 환경변수 `SUPABASE_SERVICE_ROLE_KEY`, `GAGEON_ADMIN_PASSWORD`로 설정합니다.
3. `node scripts/create_admin.mjs`를 실행합니다. 이미 `admin` 계정이 있으면 비밀번호를 바꾸지 않습니다.
4. SQL Editor에서 [`supabase/08_launch.sql`](supabase/08_launch.sql)을 실행합니다. 인쇄소 승인 버튼이 이 함수를 씁니다.

`service_role` 키는 서버 전용 권한이므로 `config.js`, GitHub 저장소, GitHub Pages, 브라우저에 넣으면 안 됩니다. 초기 비밀번호도 파일에 저장하지 않습니다. 실행 후 환경변수를 지웁니다.

## 인쇄소 승인

새로 가입한 인쇄소는 '승인 대기' 상태라 견적을 보낼 수 없습니다. 관리자 화면 인쇄소 목록의 **승인** 버튼을 누르면 바로 견적을 보낼 수 있고, 인쇄소에 알림이 갑니다. **승인 취소**를 누르면 다시 견적을 보낼 수 없습니다.

## 사업자등록번호 확인 (국세청)

인쇄소는 가입할 때 사업자등록번호를 적습니다. 관리자 화면 인쇄소 목록의 **국세청 확인**을 누르면 국세청에서 계속사업자, 휴업자, 폐업자 여부를 받아와 보여줍니다. 계속사업자인지 보고 **승인**을 누르면 됩니다.

최초 1회 설정:

1. 공공데이터포털(data.go.kr)에서 "국세청_사업자등록정보 진위확인 및 상태조회 서비스"를 활용신청하고, 마이페이지에서 **일반 인증키(Decoding)** 를 복사합니다.
2. SQL Editor에서 [`supabase/09_bizno.sql`](supabase/09_bizno.sql)을 실행합니다.
3. Supabase Dashboard → Edge Functions → **Deploy a new function** → Via Editor에서 이름을 `verify-biz`로 하고 [`supabase/functions/verify-biz/index.ts`](supabase/functions/verify-biz/index.ts) 내용을 붙여넣어 배포합니다. 함수가 관리자 여부를 직접 확인하므로 함수 설정의 **Verify JWT** 는 꺼도 됩니다.
4. Edge Functions → Secrets에서 `NTS_SERVICE_KEY` 이름으로 1번의 인증키를 저장합니다. 이 키는 저장소나 채팅에 올리지 않습니다.

## 웹 푸시 (폰 알림)

회원이 마이페이지에서 **폰 알림 받기**를 켜면, 앱을 닫아 둬도 새 견적, 채팅, 진행 상황이 폰 알림으로 옵니다. 아이폰은 사파리에서 **홈 화면에 추가**한 앱에서만 켤 수 있습니다.

최초 1회 설정:

1. SQL Editor에서 [`supabase/10_push.sql`](supabase/10_push.sql)을 실행합니다. `pg_net` 확장을 켜고, 알림이 생길 때 `send-push` 함수를 부르는 트리거를 만듭니다. 이어서 [`supabase/12_chat_notify.sql`](supabase/12_chat_notify.sql)을 실행하면 채팅 메시지도 상대방에게 알림으로 갑니다.
2. Edge Functions → Deploy a new function → Via Editor에서 이름을 `send-push`로 하고 [`supabase/functions/send-push/index.ts`](supabase/functions/send-push/index.ts) 내용을 `index.ts`에 붙여넣어 배포합니다. DB 트리거가 로그인 없이 부르므로 함수 Settings에서 **Verify JWT** 를 끕니다. 함수는 알림 id만 받고 서버에서 알림을 다시 읽어 한 번만 보내므로, 누가 직접 불러도 가짜 알림을 보낼 수 없습니다.
3. Edge Functions → Secrets에 `.env.push` 파일의 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` 두 줄을 저장합니다. `.env.push`는 저장소에 올라가지 않으며, 공개 키는 `config.js`에도 들어 있습니다.

## AI 생성 (휴대폰 포함)

휴대폰, Vercel 사이트에서 "AI로 새 캐릭터 만들기"를 누르면 Supabase 함수 `ai`가 OpenAI를 부릅니다. 요금이 나가서 **관리자가 켜 준 계정만** 실제 생성되고, 나머지 계정은 예시 캐릭터(목업)로 동작합니다. 새 계정은 기본으로 꺼져 있습니다.

최초 1회 설정:

1. SQL Editor에서 [`supabase/13_ai_access.sql`](supabase/13_ai_access.sql)을 실행합니다. 계정마다 AI 사용 여부 칸을 만들고, 꺼진 계정은 AI 요청을 막습니다.
2. Edge Functions → Deploy a new function → Via Editor에서 이름을 `ai`로 하고 [`supabase/functions/ai/index.ts`](supabase/functions/ai/index.ts) 내용을 붙여넣어 배포합니다. 함수 Settings에서 **Verify JWT** 를 끕니다. 로그인 확인과 사용 횟수는 함수 안에서 DB 함수 `consume_ai`가 맡습니다.
3. Edge Functions → Secrets에 `OPENAI_API_KEY` 이름으로 OpenAI API 키를 저장합니다. 이 키는 저장소나 채팅에 올리지 않습니다.

사용: 관리자 화면 계정 목록에서 **AI 켜기 / AI 끄기**를 누릅니다. 켠 계정은 그림·문구를 일일 횟수 제한 없이 사용합니다.

기존 프로젝트의 일일 제한 해제: SQL Editor에서 [`supabase/18_ai_unlimited.sql`](supabase/18_ai_unlimited.sql)을 실행합니다. Python 서버는 재시작하고, 휴대폰용 `ai` Edge Function은 최신 코드로 다시 배포합니다.

## 탈퇴 처리

관리자 화면의 **탈퇴** 버튼은 해당 회원의 브랜드·요청 파일을 Storage API로 삭제한 다음, 데이터베이스에서 계정과 관련 요청·견적·채팅을 삭제합니다. 인쇄소가 수락한 의뢰는 견적 대기 또는 마감 상태로 돌아갑니다. 삭제된 계정은 다시 로그인할 수 없지만 이미 발급된 액세스 토큰은 만료될 때까지 유효할 수 있습니다.

SQL 마이그레이션과 관리자 계정 생성이 끝나기 전에는 관리자 로그인을 사용할 수 없습니다.
