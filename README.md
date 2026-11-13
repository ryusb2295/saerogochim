# saerogochim
제2회 영남대 SW중심대학 융합그룹 창업 해커톤 - 새로고침

## 팀 테스트

[가게온 체험 사이트](https://ryusb2295.github.io/saerogochim/)에서 **소상공인으로 둘러보기**를 누르면 받은 견적과 제작 진행 사례를 볼 수 있습니다. **인쇄소로 둘러보기**에서는 새 요청 찾기, 보낸 견적, 수락된 의뢰를 확인할 수 있습니다.

원두 스티커, 빵집 쇼핑백, 꽃집 포장지, 수제비누 라벨, 반려동물 간식 스티커의 예시 디자인은 `assets/demo/`에 있습니다. 이 이미지들은 시연용으로 생성한 것입니다. 인쇄소에 보이는 워터마크 미리보기는 `assets/demo/previews/`에 별도로 보관합니다. 공개 체험 계정에 예시가 없는 환경에서는 `node scripts/seed_showcase.mjs --apply`로 한 번 추가할 수 있으며, 같은 제목의 요청은 중복 생성하지 않습니다. 기존 시연 요청의 미리보기를 교체할 때만 `node scripts/seed_showcase.mjs --repair-previews`를 실행합니다.
