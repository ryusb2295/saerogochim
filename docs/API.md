# 쓴 외부 서비스와 API

로그인, 결제, 주소 검색 같은 건 직접 안 만들고 있는 서비스 가져다 씀.

| 서비스 | 하는 일 |
|---|---|
| OpenAI (이미지) | 캐릭터 그림. 기본 모델 `gpt-image-2.5-flare` |
| OpenAI (글) | 슬로건, 추천 색, 키워드. 기본 모델 `gpt-4.1-mini` |
| Google Gemini | 서비스엔 안 씀. OpenAI 그림이랑 비교할 때만 |
| Supabase | 회원가입, 로그인, 데이터, 사진 저장, 실시간 채팅. 서버 직접 안 만들려고 씀 |
| Supabase Edge Functions | 키가 필요한 서버 작업. `ai`(AI 캐릭터, 브랜드 분석), `verify-biz`(국세청 확인), `send-push`(폰 알림 보내기) |
| 웹 푸시 (Apple, Google 푸시 서버) | 앱 닫아도 폰에 배너 알림. VAPID 키로 서명해서 보냄 |
| 국세청 사업자 상태조회 (공공데이터포털) | 인쇄소가 진짜 영업 중인지 확인 |
| 토스페이먼츠 | 결제 (테스트 모드) |
| 카카오 우편번호 | 주소 검색 |

AI 키, 국세청 키는 브라우저에 안 둠. Supabase 서버(함수 Secrets)나 노트북 서버에만 둠.
브라우저에 두면 누구나 키 빼 가서 우리 돈으로 AI 씀.

**노트북 AI 서버 요청** (`server.py`, 노트북에서 `python server.py`로 열었을 때만. 휴대폰, Vercel은 Supabase 함수 `ai`가 같은 일을 함)

| 주소 | 하는 일 |
|---|---|
| `GET /api/status` | AI 키 있는지, 남은 횟수 |
| `POST /api/brand` | 슬로건, 색, 키워드 만들기 |
| `POST /api/generate` | 캐릭터 그림 만들기 |

같은 요청 두 번 와도 돈 두 번 안 나가게 요청마다 번호로 확인함. 그림은 한 번에 하나씩만 만듦.

**Supabase DB 함수 (RPC)**

견적 수락처럼 여러 표를 같이 바꾸는 일은 화면에서 직접 안 하고 DB 함수로 처리함. 권한 확인도 함수 안에서 함.

| 함수 | 하는 일 |
|---|---|
| `list_open_requests` | 인쇄소가 볼 수 있는 새 요청 목록 |
| `submit_quotation`, `withdraw_quotation` | 견적 보내기(수정 포함), 철회 |
| `accept_quotation` | 견적 수락. 나머지 견적 거절 처리, 채팅방 생성, 알림 |
| `cancel_request` | 사장님이 요청 취소 |
| `advance_request`, `set_tracking` | 제작 시작, 납품, 완료 단계 바꾸기, 송장번호 |
| `mark_paid` | 토스 결제 끝나면 결제 완료 표시 |
| `write_review` | 후기 작성 |
| `my_conversations`, `mark_read` | 채팅 목록, 읽음 처리 |
| `consume_ai` | AI 하루 사용 횟수 차감 |
| `register_push` | 폰 알림 받을 기기 등록 |
| `admin_set_verified` | 관리자가 인쇄소 승인 |
