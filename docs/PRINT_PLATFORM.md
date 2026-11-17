# 가게온 인쇄 제작 매칭 확장 설계서

- 기준 코드: `ryu` 브랜치 cf4b717 (main과 동일)
- 작성일: 2026-11-13, 해커톤 시연 2026-11-20~21
- 범위: 1단계 현황 분석, 2단계 설계, 3단계 개발 계획. 코드 수정, 커밋 없음
- 함께 볼 문서: `docs/PRD.md` (기존 브랜드 제작 기능 PRD)

---

## 1단계. 현황 분석

### 1.1 기존 기능 상태

| 기능 | 위치 | 상태 | 비고 |
|---|---|---|---|
| 아이디/비밀번호 회원가입, 로그인, 복구 코드, 비밀번호 재설정, 탈퇴 | index.html | 부분 (목업) | 계정이 이 브라우저 localStorage에만 있음. PBKDF2 해시 저장. 다른 기기에서 로그인 불가. 실제 인증 아님 |
| 체험 계정 자동 입력 (demo / demo1234) | index.html | 완료 (목업 전용) | 실제 인증으로 바꿀 때 제거 대상 |
| 홈, 마이페이지, 하단 메뉴 | index.html | 부분 | 데이터는 브라우저 저장 |
| 가게 정보 입력 (1단계) | index.html | 완료 | |
| AI 브랜드 분석 `/api/brand` | server.py | 부분 | 서버 코드와 가짜 응답 테스트는 있음. 실제 OpenAI 키로는 미검증 |
| AI 캐릭터 생성 `/api/generate` | server.py | 부분 | 노트북 로컬 서버에서만 동작. 실제 키로 생성은 SERVER.md 기준 미검증 |
| 목업 생성, 진행 단계 표시, 체험 5회 제한 | index.html | 완료 (목업) | |
| 스티커 편집, 스티커 세트 4장, SNS 홍보물, 포장 미리보기 | index.html | 완료 | |
| PNG 다운로드 (스티커 800px, SNS/포장 1080px) | index.html | 완료 | 인쇄용 해상도 아님 |
| 내 브랜드 저장, 목록, 삭제 | index.html | 부분 | localStorage, 최대 12개 |
| 임시 저장, 뒤로가기 | index.html | 완료 | |
| PWA 설치, 오프라인 캐시 | manifest.json, sw.js | 부분 | manifest 색상 예전 값 |
| 서버 테스트 | test_server.py | 완료 | 13개 통과. 프런트 테스트 없음 |
| 클라우드 저장, 실제 인증, 인쇄소, 견적, 채팅, 알림 | 없음 | 미구현 | 이번 확장 대상 |

### 1.2 새 기능과 충돌하는 지점

| 지점 | 내용 | 대응 |
|---|---|---|
| 목업 로그인 | `users()`, `signIn()`, `SESSION_KEY`가 localStorage 기준. Supabase 세션과 동시에 쓰면 로그인 상태가 둘로 갈림 | Supabase 연결 시 `auth` 모듈 하나로 교체. 목업은 `?mock=1`일 때만 켜지게 분리해서 오프라인 시연 백업으로 남김 |
| 아이디 로그인 | Supabase Auth는 이메일/전화 기반이라 아이디 로그인이 기본 기능 아님 | 아이디를 내부용 주소 `{아이디}@users.gageon.invalid`로 바꿔 가입. 이메일 확인 끔. 화면에는 아이디만 표시 (PRD.md 10.2와 동일) |
| server.py 접속 제한 | `trusted()`가 Host를 127.0.0.1/localhost로 고정, 세션 토큰도 서버 메모리 값 | AI 호출은 노트북 서버 유지(시연). 대신 Supabase JWT 검증을 추가해서 로그인 사용자만, 사용자별 횟수 제한 |
| 단일 HTML 크기 | index.html 약 111KB (대부분 인라인 SVG 캐릭터), 전역 `page/step/state` | 새 화면은 같은 `render()/bind()` 패턴을 따르되 `print.js`, `chat.js`, `supa.js` 파일로 분리. sw.js와 server.py의 정적 파일 목록에 추가 |
| 브라우저 저장 데이터 | 브랜드가 localStorage에 있음. 제작 요청에는 클라우드 이미지가 필요 | 제작 요청 시점에 브랜드 PNG를 Storage에 올림. 기존 내 브랜드는 그대로 두고, 클라우드 동기화는 해커톤 이후 |
| 배포 구조 | GitHub Pages(https)는 정적 파일만. AI는 노트북에서만 | 인쇄소 계정과 채팅은 Supabase만 쓰므로 Pages 링크에서도 동작. AI 생성만 노트북. 시연 구성은 3.6 참고 |
| PWA 캐시 | sw.js가 같은 출처 GET만 캐시 | Supabase 요청은 다른 출처라 캐시 대상 아님. 새 JS 파일만 SHELL에 추가 |

---

## 2단계. 설계

### 2.1 서비스 정의

- 한 줄: 소상공인이 AI로 가게 캐릭터와 디자인을 만들고, 그 디자인으로 여러 인쇄소의 견적을 받아 비교한 뒤 바로 제작을 맡기는 서비스
- 회원 유형
  - 소상공인(owner): 브랜드 제작, 제작 요청, 견적 비교와 수락, 채팅
  - 인쇄소(printer): 업체 정보 등록, 공개 요청 조회, 견적 제출, 수락된 의뢰 채팅
- 핵심 흐름: 브랜드 제작 → 제작 요청 → 견적 2개 이상 도착 → 비교 → 수락 → 1:1 채팅 → 제작 진행 표시
- MVP 제외: 결제, 정산, 택배 API, 세금계산서, 관리자 대시보드, 리뷰/평점, 위치 추적

### 2.2 상태 모델

```
제작 요청 print_requests.status
  open        견적 받는 중 (인쇄소에 공개)
  accepted    업체 선택 완료, 채팅 시작
  in_progress 제작 중 (인쇄소가 변경)
  delivered   납품 완료 (인쇄소가 변경)
  completed   소상공인이 완료 확인
  canceled    소상공인이 취소 (open일 때만)
  expired     마감일이 지나도록 수락 없음

견적 quotations.status
  submitted   제출됨 (인쇄소가 수정, 철회 가능)
  withdrawn   인쇄소가 철회
  accepted    소상공인이 수락
  declined    같은 요청의 다른 견적이 수락되면 자동 변경
```

### 2.3 화면 목록

공통 상태 규칙: 모든 목록과 상세는 정상, 로딩(Skeleton), 빈 데이터, 오류(다시 시도 버튼), 타임아웃(10초, 다시 시도)을 가짐. 표에는 화면 고유의 상태만 적음.

| ID | 화면 | 대상 | 주요 내용 | 고유 상태, 동작 |
|---|---|---|---|---|
| C01 | 시작 | 공통 | 예시 브랜드, 로그인 버튼, 회원가입 | 로그인 세션 있으면 역할별 홈으로 이동 |
| C02 | 회원 유형 선택 | 공통 | 소상공인 / 인쇄소 카드 2개 | 선택 전 다음 비활성 |
| C03 | 회원가입 | 공통 | 아이디, 비밀번호, 확인, 표시 이름, 약관 동의. 인쇄소는 업체명 추가 | 아이디 중복 확인, 제출 중 버튼 잠금 |
| C04 | 로그인 | 공통 | 아이디, 비밀번호 | 5회 실패 잠금 안내 |
| C05 | 마이페이지 | 공통 | 표시 이름, 역할, 비밀번호 변경, 로그아웃, 탈퇴 | 탈퇴 전 진행 중 의뢰 있으면 막음 |
| C06 | 알림 | 공통 | 새 견적, 견적 수락, 새 메시지, 상태 변경 | 읽음 처리, 20개씩 더 보기 |
| C07 | 채팅 목록 | 공통 | 상대 이름, 요청 제목, 마지막 메시지, 시간, 안 읽은 수 | 실시간 갱신 |
| C08 | 1:1 채팅 | 공통 | 상단에 요청 요약과 상태, 메시지, 입력창 | 전송 중, 실패와 재시도, 연결 끊김 띠, 위로 스크롤 시 이전 50개 |
| C09 | 설정 | 공통 | 알림 켜기, 약관, 개인정보 처리방침, 앱 정보 | |
| O01 | 소상공인 홈 | 소상공인 | 새 브랜드, 진행 중 요청 요약(견적 수), 최근 브랜드, AI 남은 횟수 | |
| O02 | AI 브랜드 제작 | 소상공인 | 기존 1~2단계 (가게 정보, 분석, 캐릭터) | 기존 기능 유지 |
| O03 | 브랜드 편집 | 소상공인 | 기존 3~4단계 + "이 디자인으로 제작 견적 받기" 버튼 | |
| O04 | 내 브랜드 목록 | 소상공인 | 기존 화면 | |
| O05 | 제작 견적 요청 | 소상공인 | 품목, 디자인 이미지, 수량, 크기, 재질, 후가공, 희망 납기, 배송 지역, 요청사항 | 3단계 폼, 입력 자동 저장, 업로드 진행률 |
| O06 | 받은 견적 (요청 목록) | 소상공인 | 요청별 상태 칩, 견적 수, 마감일 | 상태 탭: 진행 중 / 완료 |
| O07 | 견적 비교 | 소상공인 | 업체별 총액, 배송비, 제작 기간, 납품 예상일, 업체 정보. 정렬: 총액순 / 빠른 납기순 | 견적 0개면 대기 안내, 1개면 비교 대신 상세 |
| O08 | 견적 상세 | 소상공인 | 단가, 수량, 금액 내역, 조건, 업체 프로필 | |
| O09 | 견적 수락 확인 | 소상공인 | 모달: 업체명, 총액, 납기, "다른 견적은 자동으로 거절돼요" | 처리 중 잠금, 이미 수락됨 오류 처리 |
| O10 | 의뢰 진행 현황 | 소상공인 | 단계 표시(수락, 제작 중, 납품, 완료), 채팅 바로가기, 완료 확인 | |
| P01 | 인쇄소 대시보드 | 인쇄소 | 신규 요청 수, 답변 대기 견적, 진행 중 의뢰, 안 읽은 채팅 | |
| P02 | 신규 제작 요청 목록 | 인쇄소 | 품목 필터, 지역 필터, 마감 임박순 | 이미 견적 낸 요청 표시 |
| P03 | 요청 상세 | 인쇄소 | 미리보기 이미지(워터마크), 사양, 희망 납기, 배송 시/구 | 소상공인 이름, 연락처 비노출 |
| P04 | 견적 작성 | 인쇄소 | 단가, 수량, 총액(자동 계산, 수정 가능), 배송비, 제작 기간, 납품 예상일, 비고 | 제출 확인 모달, 요청이 마감되면 제출 불가 |
| P05 | 보낸 견적 관리 | 인쇄소 | 상태별 탭, 수정, 철회 | 수락된 견적은 수정 불가 |
| P06 | 수락된 의뢰 관리 | 인쇄소 | 원본 파일 받기, 상태 변경(제작 중, 납품), 채팅 | |
| P07 | 업체 프로필 | 인쇄소 | 업체명, 주소(시/구까지 공개), 취급 품목, 소개, 최소 수량 | |

하단 메뉴 (모바일, 5칸)
- 소상공인: 홈 / 브랜드 / 받은 견적 / 채팅 / 마이
- 인쇄소: 대시보드 / 요청 찾기 / 보낸 견적 / 채팅 / 마이

### 2.4 사용자 흐름

```
소상공인
C01 → C04 로그인 → O01 홈 → O02 브랜드 제작 → O03 편집
  → "제작 견적 받기" → O05 요청 작성 (디자인 PNG 자동 첨부)
  → O06 받은 견적 → O07 비교 → O08 상세 → O09 수락
  → C08 채팅 (자동 생성) → O10 진행 현황

인쇄소
C01 → C04 로그인 → P01 대시보드 → P02 요청 목록 → P03 상세
  → P04 견적 작성 → P05 보낸 견적
  → (수락 알림) C06 → C08 채팅 → P06 의뢰 관리 → 상태 변경
```

### 2.5 제작 요청 폼 명세 (O05)

| 필드 | 필수 | 형식, 검증 |
|---|---|---|
| 제작 품목 | 예 | sticker / wrapping / shopping_bag / other. other이면 품목명 1~30자 필수 |
| 디자인 이미지 | 예 | 브랜드에서 자동 첨부 또는 직접 업로드. PNG, JPG, WebP, PDF. 10MB 이하. 이미지 최소 1000px 권장(미만이면 경고만) |
| 제작 수량 | 예 | 정수 1~100,000 |
| 가로, 세로 | 예 | 숫자 1~2000, 소수 한 자리 |
| 단위 | 예 | mm / cm |
| 인쇄 재질 | 예 | 목록(아트지, 유포지, 투명 PET, 크라프트지, 기타) + 기타 입력 |
| 코팅, 후가공 | 아니요 | 복수 선택(무광 코팅, 유광 코팅, 도무송 재단, 박, 없음) |
| 희망 납기 | 예 | 오늘 + 3일 이후 날짜 |
| 견적 마감 | 예 | 기본 3일 후, 희망 납기보다 앞 |
| 배송 지역 | 예 | 시/도 + 시/군/구 선택. 상세 주소는 수락 후 채팅에서 주고받음 |
| 추가 요청사항 | 아니요 | 0~500자 |

### 2.6 DB 스키마 (Supabase PostgreSQL)

```sql
-- 회원 공통. auth.users와 1:1
profiles (
  id uuid pk references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9]{4,20}$'),
  role text not null check (role in ('owner','printer')),
  display_name text not null check (char_length(display_name) between 1 and 24),
  created_at timestamptz default now()
)

-- 인쇄소 업체 정보. printer 1명당 1개
print_shops (
  id uuid pk default gen_random_uuid(),
  owner_id uuid unique not null references profiles(id) on delete cascade,
  name text not null,
  region_sido text not null, region_sigungu text not null,
  address_detail text,              -- 수락된 의뢰 상대에게만 공개
  items text[] not null,            -- 취급 품목
  intro text, min_quantity int,
  verified boolean default false,   -- 출시 때 관리자 승인용. MVP는 true로 시드
  created_at timestamptz default now()
)

-- 브랜드. 기존 localStorage 브랜드 객체를 그대로 옮길 수 있게 data jsonb 유지
brands (
  id uuid pk default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null, industry text,
  data jsonb not null,              -- mood, theme, shape, message, brand 분석 등
  character_path text,              -- storage: brand-assets/{owner_id}/...
  created_at timestamptz default now(), updated_at timestamptz default now()
)

print_requests (
  id uuid pk default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  title text not null,
  item text not null check (item in ('sticker','wrapping','shopping_bag','other')),
  item_other text,
  quantity int not null check (quantity between 1 and 100000),
  width numeric(6,1) not null, height numeric(6,1) not null,
  unit text not null check (unit in ('mm','cm')),
  material text not null, finishing text[] default '{}',
  due_date date not null, quote_deadline timestamptz not null,
  region_sido text not null, region_sigungu text not null,
  note text check (char_length(note) <= 500),
  design_path text not null,        -- request-files/{owner_id}/{request_id}/original.*
  preview_path text not null,       -- request-previews/{request_id}.webp (워터마크)
  status text not null default 'open'
    check (status in ('open','accepted','in_progress','delivered','completed','canceled','expired')),
  accepted_quotation_id uuid,
  created_at timestamptz default now(), updated_at timestamptz default now()
)

quotations (
  id uuid pk default gen_random_uuid(),
  request_id uuid not null references print_requests(id) on delete cascade,
  shop_id uuid not null references print_shops(id) on delete cascade,
  unit_price int not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  total_price int not null check (total_price >= 0),
  shipping_fee int not null default 0 check (shipping_fee >= 0),
  production_days int not null check (production_days between 1 and 90),
  delivery_date date not null,
  note text check (char_length(note) <= 500),
  status text not null default 'submitted'
    check (status in ('submitted','withdrawn','accepted','declined')),
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (request_id, shop_id)      -- 한 요청에 업체당 견적 1개
)
-- 요청당 수락된 견적은 하나뿐 (중복 수락 방지의 DB 쪽 최종 방어선)
create unique index one_accepted_per_request on quotations(request_id) where status = 'accepted';

conversations (
  id uuid pk default gen_random_uuid(),
  request_id uuid unique not null references print_requests(id),  -- 요청당 채팅방 1개
  owner_id uuid not null references profiles(id),
  printer_id uuid not null references profiles(id),
  last_message_at timestamptz,
  created_at timestamptz default now()
)

messages (
  id bigint generated always as identity pk,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  client_id uuid not null,          -- 재시도 때 중복 저장 방지
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz default now(),
  unique (conversation_id, client_id)
)

conversation_reads (                 -- 안 읽은 메시지 계산용
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  last_read_id bigint default 0,
  primary key (conversation_id, user_id)
)

notifications (
  id bigint generated always as identity pk,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('quote_received','quote_accepted','quote_declined','message','status_changed')),
  ref_id uuid, title text not null, read_at timestamptz,
  created_at timestamptz default now()
)

ai_usage (                           -- AI 생성 횟수 제한 (Python 서버만 기록)
  user_id uuid references profiles(id) on delete cascade,
  day date, kind text check (kind in ('image','brand')),
  used int default 0,
  primary key (user_id, day, kind)
)
```

관계 요약: profiles 1:1 print_shops, profiles 1:N brands, profiles 1:N print_requests, print_requests 1:N quotations, print_requests 1:1 conversations, conversations 1:N messages.

### 2.7 인증과 접근 권한 (RLS)

모든 테이블에 RLS를 켜고, 아래 정책 외에는 전부 거부함.

| 테이블 | 조회 | 생성 | 수정, 삭제 |
|---|---|---|---|
| profiles | 본인. 채팅 상대와 견적 낸 업체 담당자는 `display_name`만 (뷰 `public_profiles`) | 가입 트리거만 | 본인 `display_name`만. `role`, `username`은 변경 불가 |
| print_shops | 로그인 사용자 전체 (주소 상세 제외 뷰 `shop_cards`). `address_detail`은 본인과 수락된 의뢰 상대만 | role = printer인 본인 1개 | 본인 |
| brands | 본인 | 본인 (role = owner) | 본인 |
| print_requests | 본인 전체 컬럼. verified 인쇄소는 `status = 'open'` 요청을 뷰 `open_requests`로 조회(owner_id, note 일부 외 개인정보 없음). 수락된 업체는 자기 의뢰 전체 | role = owner인 본인 | 본인은 open일 때 취소만. 상태 진행(in_progress, delivered)은 함수 `advance_request()`로만 |
| quotations | 요청 주인: 자기 요청의 모든 견적. 인쇄소: 자기 업체 견적만 (다른 업체 금액 조회 불가) | verified 인쇄소, 요청이 open이고 마감 전일 때만 | 인쇄소 본인, status = submitted일 때만 수정, 철회. accepted, declined 변경은 함수 `accept_quotation()`만 |
| conversations | 참여자(owner_id 또는 printer_id) | 직접 생성 불가. `accept_quotation()`만 | 불가 |
| messages | 참여자 | 참여자이고 `sender_id = auth.uid()` | 불가 (MVP) |
| conversation_reads | 본인 | 본인 | 본인 |
| notifications | 본인 | 트리거, 함수만 | 본인 `read_at`만 |
| ai_usage | 본인 조회 | Python 서버(서버 전용 키)만 | Python 서버만 |

Storage 버킷 (모두 비공개)

| 버킷 | 경로 | 읽기 | 쓰기 |
|---|---|---|---|
| brand-assets | `{owner_id}/...` | 본인 | 본인. PNG/WebP, 5MB |
| request-files (원본) | `{owner_id}/{request_id}/original.*` | 요청 주인, 수락된 인쇄소 | 요청 주인. PNG/JPG/WebP/PDF, 10MB |
| request-previews | `{request_id}.webp` | 요청 주인, verified 인쇄소 (요청이 open이거나 자기 의뢰일 때) | 요청 주인 |

- 파일 다운로드는 5분 만료 서명 URL만 씀. 공개 URL 없음
- 버킷 설정으로 허용 형식과 최대 크기를 강제하고, 화면에서도 같은 검사로 미리 안내함
- 미리보기는 화면에서 긴 변 1000px, 대각선 반투명 "가게온 견적용" 워터마크를 넣은 WebP로 만들어 올림 (원본 노출 최소화)

역할 지정과 권한 상승 방지
- 가입 때 고른 역할을 `auth.users`의 metadata로 넘기고, 트리거가 profiles에 한 번만 기록함. 이후 profiles.role은 아무도 수정할 수 없음
- 인쇄소 `verified`는 MVP에서 시연 계정 2개만 미리 true. 출시 때는 사업자 확인 후 관리자가 변경

### 2.8 견적 수락 원자 처리

Postgres 함수 `accept_quotation(p_quote uuid)` (security definer, 한 트랜잭션)

1. `auth.uid()`가 해당 요청의 owner_id인지 확인, 아니면 오류 `forbidden`
2. 요청 행을 `select ... for update`로 잠금. status가 open이 아니면 오류 `already_closed`
3. 견적이 이 요청 것이고 status = submitted인지 확인, 아니면 오류 `quote_unavailable`
4. 견적 → accepted, 같은 요청의 나머지 submitted 견적 → declined
5. 요청 → accepted, accepted_quotation_id 기록
6. conversations에 `insert ... on conflict (request_id) do nothing`, 방 id 반환
7. 인쇄소에 quote_accepted, 나머지 업체에 quote_declined 알림 기록
8. 반환: `{conversation_id}`

중복 클릭, 두 기기 동시 수락 대비: 2번 행 잠금이 순서를 정하고, `one_accepted_per_request` 유니크 인덱스가 마지막 방어선. 화면은 처리 중 버튼을 잠그고, `already_closed`를 받으면 "이미 다른 견적을 수락했어요"로 안내 후 목록을 새로 고침.

같은 방식의 함수: `submit_quotation()` (마감, verified, 중복 확인 후 insert와 알림), `advance_request()` (상태 순서 검사), `cancel_request()`.

### 2.9 실시간 채팅

- 구독: Supabase Realtime의 Postgres Changes로 `messages` insert를 `conversation_id` 필터로 구독. RLS가 적용돼 참여자만 받음 (지원 방식은 구현 시작 전 Supabase 문서로 재확인)
- 전송
  1. 화면에 바로 "전송 중" 말풍선 표시, `client_id`(UUID) 생성
  2. insert 성공하면 전송 완료, 실패하면 "다시 보내기" 버튼
  3. 재시도는 같은 `client_id`로 보내서 중복 저장 안 됨
- 실시간 이벤트로 내 메시지가 다시 오면 `client_id`로 화면의 임시 말풍선과 합침
- 안 읽은 수: `conversation_reads.last_read_id`보다 큰 상대 메시지 수. 채팅방을 열고 맨 아래가 보이면 갱신
- 시간 표시: 같은 분 연속 메시지는 마지막에만 시간, 날짜가 바뀌면 구분선
- 연결 끊김: 구독 상태가 끊기면 상단 띠 "연결이 끊겼어요. 다시 연결하는 중", 다시 연결되면 마지막 메시지 이후 것을 조회해서 빈틈 메움
- 기록: 위로 스크롤하면 `id < 가장 오래된 id`로 50개씩

### 2.10 API 명세

대부분은 브라우저가 supabase-js로 직접 호출하고 RLS가 막음. 비싼 AI 호출과 서버 전용 키가 필요한 일만 Python 서버가 맡음.

| 호출 | 방식 | 권한 | 비고 |
|---|---|---|---|
| 회원가입, 로그인, 로그아웃 | supabase-js Auth | 공개 | 아이디 → 내부용 주소 변환은 화면에서 |
| 아이디 중복 확인 | RPC `username_available(text)` | 공개 | true/false만 반환 |
| 브랜드 CRUD | supabase-js `brands` | RLS | |
| 이미지 업로드 | supabase-js Storage | 버킷 정책 | |
| 제작 요청 생성, 취소 | `print_requests` insert, RPC `cancel_request` | RLS | |
| 공개 요청 목록 | 뷰 `open_requests`, `range()` 20개씩 | verified 인쇄소 | |
| 견적 제출, 수정, 철회 | RPC `submit_quotation`, `quotations` update | RLS | |
| 견적 수락 | RPC `accept_quotation` | 요청 주인 | 2.8 |
| 의뢰 상태 변경 | RPC `advance_request` | 해당 인쇄소, 완료 확인은 요청 주인 | |
| 채팅 목록, 메시지, 읽음 | `conversations`, `messages`, `conversation_reads` | RLS | |
| 알림 | `notifications` + Realtime 구독 | RLS | |
| AI 캐릭터 생성 | Python `POST /api/generate` | Supabase JWT 필요 | 기존 코드에 JWT 검증, `ai_usage` 하루 횟수 제한 추가 |
| AI 브랜드 분석 | Python `POST /api/brand` | Supabase JWT 필요 | 위와 같음 |

Python 서버의 JWT 검증: 요청 헤더 `Authorization: Bearer <access_token>`을 Supabase Auth의 사용자 조회 API로 확인하는 방식이 가장 단순함(표준 라이브러리만으로 가능). 서명 직접 검증은 키 방식에 따라 달라서 구현 시작 전에 확인.

### 2.11 환경변수

| 이름 | 위치 | 공개 여부 | 발급처, 설정 방법 |
|---|---|---|---|
| OPENAI_API_KEY | Python 서버 | 비밀 | platform.openai.com → API keys 메뉴. ChatGPT 구독과 별도로 결제 수단과 잔액 필요 |
| OPENAI_IMAGE_MODEL | Python 서버 | 공개 가능 | 기본 gpt-image-2.5-flare. 계정에서 쓸 수 있는 이미지 모델로 |
| OPENAI_TEXT_MODEL | Python 서버 | 공개 가능 | 기본 gpt-4.1-mini. 리허설 때 사용 가능 여부 확인 |
| SUPABASE_URL | 화면, 서버 | 공개 | Supabase 대시보드 → Project Settings → API |
| SUPABASE_PUBLISHABLE_KEY | 화면 | 공개 (RLS 전제) | 같은 메뉴의 publishable 키(예전 이름 anon 키) |
| SUPABASE_SECRET_KEY | Python 서버만 | 비밀 | 같은 메뉴의 secret 키(예전 이름 service_role 키). `ai_usage` 기록에만 사용. 화면, 저장소에 절대 넣지 않음 |

- 서버 비밀 값은 `.env` 파일이나 실행 시 환경변수로만 둠. `.gitignore`에 `.env`가 이미 들어 있음. `.env.example`에는 이름만 적어 커밋
- 화면용 공개 값 두 개는 `config.js`에 둠. 공개돼도 되지만, 이 값이 공개되는 만큼 RLS가 유일한 보호막이라는 뜻이므로 RLS 테스트(3.5)를 먼저 통과해야 함
- Supabase 키 이름과 메뉴 위치는 대시보드 개편에 따라 다를 수 있어서 프로젝트 생성 때 화면 기준으로 다시 확인

### 2.12 디자인 시스템

참고한 화면: 견적 비교형 서비스 앱 스크린샷 5장. 브랜드 요소(색, 로고, 문구)는 가져오지 않고 아래 패턴만 참고함.

| 참고 패턴 | 가게온 적용 |
|---|---|
| 하단 5칸 메뉴, 현재 탭만 진한 아이콘 | 역할별 5칸 메뉴 (2.3) |
| 요청 카드: 상태 칩(색 글자) + 요청일 + 제목 + 오른쪽 "견적 N개 >" + 업체 아바타 묶음 | O06 받은 견적 카드 |
| 업체 카드: 이름, 경력/실적 숫자 3칸, 배지, 오른쪽 사진 | O07 견적 비교 카드 (총액, 배송비, 납기 3칸 숫자) |
| 빈 상태 카드: 아이콘 + "견적을 요청해 보세요" + 보조 문구 + 화살표 | 모든 빈 상태 |
| 2열 이미지 카드 + 저장 아이콘 | 인쇄소 P02 요청 목록 (미리보기 이미지 중심) |
| 로그인: 라벨 위 입력칸, 넓은 주 버튼, 아래 보조 링크 | C04 (현재 구현과 같은 구조) |

토큰: `docs/PRD.md` 12.1 유지(코랄 #B84732 주 버튼, 보라 #6B4EFF AI 전용, Pretendard). 추가할 것

| 토큰 | 값 | 용도 |
|---|---|---|
| status.open | #2F7D5B 글자 / #E8F4EE 배경 | 견적 받는 중 |
| status.accepted | #B84732 / #FBEEE9 | 업체 선택 |
| status.progress | #2B6CB0 / #E8F0FA | 제작 중 |
| status.done | #5F5650 / #F1EEEA | 완료, 취소, 마감 |
| role.printer | #2B2523 진한 헤더 | 인쇄소 화면 구분 (같은 앱 안에서 역할이 바로 보이게) |

새 공통 컴포넌트: StatusChip, QuoteCompareCard, PriceRow(단가 × 수량 = 금액), AvatarStack, ChatBubble(보냄, 받음, 전송 중, 실패), ChatInput, UnreadBadge, ConnectionBanner, ConfirmModal, Skeleton(카드, 목록, 채팅), FileDrop(진행률), DatePicker, Stepper(요청 폼 3단계).

---

## 3단계. 개발 계획

### 3.1 기능별 우선순위 (해커톤 MVP)

| 순위 | 기능 | 종류 | 난이도 | 선행 조건 |
|---|---|---|---|---|
| 1 | Supabase 프로젝트, 스키마, RLS, Storage 버킷, 시드 계정(소상공인 1, 인쇄소 2) | 백엔드 | 중 | Supabase 계정 |
| 2 | RLS 테스트 (다른 업체 견적 금액, 남의 채팅, 남의 원본 파일 접근 차단) | 테스트 | 중 | 1 |
| 3 | 회원 유형 선택, 가입, 로그인을 Supabase Auth로 (목업은 `?mock=1`로 분리) | 프런트 | 중 | 1 |
| 4 | 브랜드 편집 → 제작 요청 폼 → PNG, 미리보기 업로드 | 프런트 | 중 | 3 |
| 5 | 인쇄소: 요청 목록, 상세, 견적 작성, 보낸 견적 | 프런트 + RPC | 중 | 4 |
| 6 | 소상공인: 받은 견적, 비교, 상세, 수락 (`accept_quotation`) | 프런트 + RPC | 중 | 5 |
| 7 | 1:1 실시간 채팅, 채팅 목록, 안 읽은 수 | 프런트 | 상 | 6 |
| 8 | 알림 목록 + 실시간 배지 | 프런트 | 하 | 6 |
| 9 | Python 서버에 JWT 검증, 사용자별 AI 횟수 | 백엔드 | 중 | 1 |
| 10 | 의뢰 진행 현황, 상태 변경 | 프런트 + RPC | 하 | 6 |
| 11 | 업체 프로필, 마이페이지, 설정 | 프런트 | 하 | 3 |

시간이 모자라면 10, 11은 화면만(목업 표시) 두고 발표에서 계획으로 설명함. 1~9는 실제 DB 연결이어야 시연 흐름이 성립함.

### 3.2 프런트엔드, 백엔드 범위

| 영역 | 파일 | 작업 |
|---|---|---|
| 프런트 | index.html | 라우팅에 새 page 값 추가, 역할별 하단 메뉴, 기존 화면 유지 |
| 프런트 | 새 `supa.js` | supabase-js CDN 로드(버전 고정), 세션, 아이디 변환, 공통 오류 처리 |
| 프런트 | 새 `print.js` | 제작 요청, 견적 목록, 비교, 수락, 인쇄소 화면 |
| 프런트 | 새 `chat.js` | 채팅 목록, 채팅방, Realtime 구독, 재시도 |
| 프런트 | 새 `config.js` | SUPABASE_URL, PUBLISHABLE_KEY (공개 값) |
| DB | 새 `supabase/schema.sql`, `supabase/policies.sql`, `supabase/functions.sql`, `supabase/seed.sql` | 2.6~2.8 그대로. SQL 편집기에 순서대로 실행 |
| 백엔드 | server.py | JWT 검증, `ai_usage` 기록, 새 정적 파일 목록. 기존 생성, 분석 로직은 유지 |
| 테스트 | test_server.py | JWT 없음, 잘못된 JWT, 횟수 초과 케이스 추가 |
| 테스트 | 새 `supabase/rls_test.sql` | 역할별 접근 차단 확인 쿼리 |

### 3.3 구현 순서와 의존성

```
D1 (11/14)  Supabase 생성 → schema/policies/functions/seed → RLS 테스트
D2 (11/15)  supa.js, 회원 유형 선택, 가입/로그인, 역할별 하단 메뉴
D3 (11/16)  제작 요청 폼, 업로드, 인쇄소 요청 목록과 상세
D4 (11/17)  견적 작성, 보낸 견적, 받은 견적, 비교, 수락
D5 (11/18)  채팅 목록, 채팅방, Realtime, 알림 배지, server.py JWT
D6 (11/19)  통합 테스트(3.5), 모바일 점검, 리허설 2회, 버그 수정
```

각 날짜 끝에 기존 기능 회귀 점검(브랜드 제작 1~4단계, 다운로드, server 테스트)을 함.

### 3.4 예상 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 일정: 6일에 인증, 견적, 채팅을 모두 실연결 | 큼 | 3.1 순위대로, 10~11은 목업 허용. 매일 끝에 시연 가능한 상태 유지 |
| RLS 정책 실수로 다른 업체 견적이 보임 | 큼 (신뢰) | 정책 작성 직후 rls_test로 확인. 뷰는 필요한 컬럼만 |
| 아이디 로그인 우회 방식(내부용 주소)이 Auth 설정과 안 맞음 | 중 | D1에 가입, 로그인을 먼저 시험. 안 되면 시연은 내부용 주소 방식 대신 이메일 형식 아이디로 임시 운영 |
| 행사장 네트워크 불안 | 큼 | 휴대폰 핫스팟 준비. Supabase 장애 시 `?mock=1` 목업 흐름으로 전환 |
| AI 생성이 노트북에서만 됨 | 중 | 소상공인 시연은 노트북, 인쇄소 2곳은 휴대폰 2대로 Pages 링크 접속 |
| OpenAI 비용, 모델 이름 | 중 | 사용 한도 설정, 리허설에서 모델 확인, 생성 결과 미리 저장 |
| 단일 HTML 수정 충돌 (팀 작업) | 중 | 새 기능은 새 JS 파일에. index.html은 라우팅, 메뉴만 수정 |
| Realtime 구독 방식 차이 | 중 | D5 시작 전에 공식 문서로 확인, 실패 시 3초 폴링으로 대체 |

### 3.5 테스트 시나리오

| 번호 | 시나리오 | 기대 결과 |
|---|---|---|
| T1 | 소상공인 A 가입, 로그인, 새로고침 | 로그인 유지, 소상공인 메뉴 |
| T2 | 인쇄소 B, C 로그인 | 인쇄소 메뉴, 대시보드 |
| T3 | A가 브랜드 제작 후 "제작 견적 받기", 필수값 비우고 제출 | 칸별 오류, 첫 오류로 포커스 |
| T4 | A가 11MB 파일, GIF 업로드 | 화면에서 거절. 화면 검사를 우회해 직접 올려도 버킷이 거절 |
| T5 | A가 요청 등록 | B, C 요청 목록에 보임. 소상공인 이름, 연락처 없음 |
| T6 | B, C가 견적 제출 | A에게 알림 2개, 비교 화면에 2개 |
| T7 | B가 C의 견적 금액 조회 시도 (API 직접 호출) | 0행 반환 |
| T8 | B가 A의 원본 파일 서명 URL 요청 (수락 전) | 거부 |
| T9 | A가 B 견적 수락 버튼을 두 기기에서 동시에 누름 | 하나만 성공, 다른 쪽 "이미 수락됨" |
| T10 | 수락 후 | 요청 accepted, B 견적 accepted, C 견적 declined, 채팅방 1개, B에게 알림 |
| T11 | C가 A-B 채팅방 메시지 조회, 전송 시도 | 둘 다 거부 |
| T12 | A, B 채팅: 보내기, 받기, 비행기 모드에서 전송 실패 후 재시도 | 실시간 반영, 실패 표시, 재시도 후 1번만 저장 |
| T13 | B가 원본 파일 받기 (수락 후) | 5분짜리 서명 URL로 받음 |
| T14 | 로그인 없이 `/api/generate` 호출 | 401 |
| T15 | 기존 회귀: 브랜드 1~4단계, 스티커 세트, SNS 홍보물, 다운로드, server 테스트 | 기존과 같음 |
| T16 | 360px, 390px 화면에서 전체 흐름 | 가로 스크롤 없음, 버튼 겹침 없음 |

### 3.6 해커톤 시연 구성

- 노트북: `python server.py` (OpenAI 키) + 브라우저 `127.0.0.1:8000`에서 소상공인 A
- 휴대폰 2대: GitHub Pages 링크에서 인쇄소 B, C 로그인
- 흐름(약 4분): A 브랜드 생성 → 제작 요청 → B, C 휴대폰에서 견적 제출 → A 비교 화면에 실시간 도착 → A가 B 수락 → A와 B 채팅 실시간 왕복
- 백업: 생성 결과 이미지 미리 저장, 네트워크 장애 시 `?mock=1` 흐름

### 3.7 구현 전에 정해 주셔야 할 것

| 질문 | 기본안 |
|---|---|
| Supabase 프로젝트를 누구 계정으로 만들지 | 팀장 계정, 무료 플랜 |
| 인쇄소 가입을 누구나 할 수 있게 둘지 | MVP는 누구나 가입, 견적 제출은 verified 계정만(시연 2개) |
| 기존 목업 로그인 처리 | `?mock=1`일 때만 쓰는 백업으로 유지 |
| 시연 계정 아이디 | owner01, printer01, printer02 (비밀번호는 저장소에 넣지 않고 팀 메신저로 공유) |
| 승인 범위 | 3.1의 1~9를 먼저, 10~11은 시간 남으면 |
