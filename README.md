# saerogochim
제2회 영남대 SW중심대학 융합그룹 창업 해커톤 - 새로고침

## 가게온

동네 가게 사장님용 웹앱.
AI로 가게 캐릭터, 스티커를 만들고 근처 인쇄소에 바로 제작을 맡김.

- **사장님**: 가게 정보 입력 → AI 캐릭터, 슬로건 → 스티커 꾸미기 → 인쇄 요청 → 견적 고르기 → 결제 → 진행 상황 확인
- **인쇄소**: 가입, 관리자 승인 → 새 요청 찾기 → 견적 보내기 → 제작, 배송 상황 올리기

[가게온 체험 사이트](https://saerogochim.vercel.app/)에서 **소상공인으로 둘러보기**, **인쇄소로 둘러보기**를 누르면 가입 없이 써 볼 수 있음. 써 보는 순서는 [GUIDE.md](GUIDE.md).

AI는 부를 때마다 요금이 나가서 관리자가 켜 준 계정만 실제로 생성됨. 나머지 계정은 예시 캐릭터로 동작하고 화면에 "예시"라고 표시됨.

## 주요 기능

**캐릭터, 스티커**

- 가게 이름, 업종, 위치, 분위기, 손님층, 자랑거리를 단계별로 입력하면 AI가 슬로건, 추천 색, 키워드, 캐릭터를 만듦.
- 캐릭터는 시디과 학생 2명이 그린 그림체 8개 중 하나를 참고 이미지로 보내서 그 그림체로 그림. 사장님이 그림체를 고르거나, 분위기에 맞춰 자동으로 정할 수 있음.
- 경산시 동네를 고르면 주변 같은 업종 가게 수와 가게 이름에 많이 쓰인 말을 보여줌(공공데이터 상가 정보).
- 스티커의 캐릭터·상호명·문구를 직접 끌어 이동하고 요소별 크기·회전을 조절함. 배치별 편집 내용은 저장·재열기·PNG·인쇄 원본에도 유지됨.
- 색상은 추천 컬러와 하나의 색상 선택창(채도·밝기·색조·HEX)에서 고름. 글꼴 12종을 좌우로 넘겨 고르고 스티커 세트, 포장 미리보기, SNS 홍보물을 PNG로 받음.

**인쇄소 연결**

- 사장님이 요청을 올리면 인쇄소들이 견적을 보내고, 사장님이 하나 고름. 디자인 원본은 고른 인쇄소만 볼 수 있음.
- 1:1 채팅(사진 포함), 제작, 배송 단계와 송장번호, 모의 결제(실제 과금 없음), 후기와 인쇄소 평점.
- 새 인쇄소는 관리자가 국세청에서 사업자 상태를 확인하고 승인해야 견적을 보낼 수 있음.

**그 밖에**

- 휴대폰 홈 화면에 앱처럼 설치(PWA). 앱을 닫아 둬도 새 견적, 채팅, 진행 상황이 폰 알림으로 옴.
- 남의 요청, 견적, 채팅은 DB 권한 규칙(RLS)으로 막음. 화면에서만 숨긴 게 아님.
- AI는 계정마다 관리자가 켜고 끄고, 켠 계정도 하루 그림 5번, 문구 30번까지만.

이미지 생성은 LoRA 학습도 실험해 봤지만 OpenAI + 참고 이미지 방식을 골랐음. 과정과 이유는 [docs/IMAGE_GENERATION.md](docs/IMAGE_GENERATION.md).

## 구조

![가게온 서비스 구조도](architecture.png)

웹사이트는 Vercel. 로그인, 데이터, 채팅, 파일은 Supabase. AI는 Supabase 함수 `ai`(휴대폰, Vercel) 또는 노트북 서버(`server.py`)를 거쳐 OpenAI로 감. 쓴 외부 서비스와 API는 [docs/API.md](docs/API.md).

```text
index.html        껍데기 (파일 불러오기만 함)
app.js            캐릭터 만들기, 스티커, 마이페이지
sticker-editor.js  스티커 요소 편집, 색상 선택, 글꼴 넘기기
print.js          인쇄 요청, 견적, 결제, 진행 상황, 관리자, 알림
chat.js           1:1 채팅
style.css         화면 스타일
server.py         노트북 AI 서버
supabase/         DB 표, 권한 규칙, DB 함수, 서버 함수(ai, send-push, verify-biz)
assets/styles/    시디과 그림체 참고 이미지
scripts/          상가 데이터 변환, 그림체 테스트, 관리자 계정 만들기
```

## 실행

Python 3.10 이상만 있으면 됨. 따로 설치할 패키지 없음.

```powershell
python server.py
```

키를 물어보면 OpenAI API 키를 넣고(없으면 Enter로 예시 모드), 브라우저로 [127.0.0.1:8000](http://127.0.0.1:8000) 접속. 자세한 건 [SERVER.md](SERVER.md).

테스트:

```powershell
python -m unittest -v test_server.py
node --test tests/sticker-editor.test.cjs
```

## 수익화 시연

패키지 구매, 토큰 충전·구독, 인쇄소 수수료, 재주문·정기배송, 시즌 시안을 시연합니다. 스티커의 문구는 한 번 클릭해 수정할 수 있습니다. 가격은 `pricing.js`에서 관리합니다. [3분 시연 순서와 DB 적용 안내](docs/COMMERCE_DEMO.md)를 참고하세요.

```powershell
node --test tests/sticker-editor.test.cjs tests/commerce.test.cjs tests/commerce-exports.test.cjs
```

## 할 것

- 휴대폰으로 가입부터 AI 캐릭터, 스티커 다운로드, 견적, 채팅, 결제까지 끝까지 확인.
- 새 그림체 4개(플랫, 크레용, 낙서 선화, 에어브러시) 실제로 뽑아 보고 분위기별 그림체 연결 정하기.
- 시디과 새 디자인(스플래시, 소개 화면, 질문 3단계, 초록 색상) 적용.
- 시연 끝나고: AI 금액 한도, 실제 결제, 캐릭터 서버 저장, 노트북 서버와 `ai` 함수에 겹친 프롬프트 하나로 합치기.

## 쓴 기술

- 화면: HTML, CSS, JavaScript (프레임워크 없음), Pretendard, [Astryx](https://github.com/meta/astryx) 테마 색
- 서버, 데이터: Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions), Python 표준 라이브러리
- AI: OpenAI 이미지, 글 API
- 배포: Vercel, GitHub Actions

## 문서

- [GUIDE.md](GUIDE.md): 팀원용 써 보기 가이드
- [SERVER.md](SERVER.md): 노트북 AI 서버
- [ADMIN.md](ADMIN.md): 관리자 계정, 인쇄소 승인, 국세청 확인, 푸시 알림, AI 켜기 설정
- [docs/API.md](docs/API.md): 쓴 외부 서비스, 서버 요청, DB 함수
- [docs/IMAGE_GENERATION.md](docs/IMAGE_GENERATION.md): 이미지 생성 방식을 정한 과정 (LoRA 실험)
