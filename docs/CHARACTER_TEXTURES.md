# 캐릭터 질감 선택

취향 입력 화면에서 플랫, 클레이, 수채화, 크레용, 펠트, 연필 중 하나를 선택한다. 기본값은 `auto`(AI 추천)이며 이미지 모델이 가게 분위기를 보고 여섯 질감 중 하나를 고른다. 직접 선택한 질감은 기존 분위기별 그림체의 채색·명암보다 우선한다.

사용자가 제공한 동일한 개미 캐릭터의 여섯 질감 예시를 `assets/textures/texture-sheet.png`에 원본 그대로 보관한다. 화면은 각 패널을 CSS로 표시하며 예시 이름과 설명을 함께 제공한다. 이미지 API에도 이 참고 시트와 선택 질감의 재료 표현을 함께 전달한다. 프롬프트에서 개미, 포즈, 택배 상자, 색상, 배경, 글자를 복사하지 않도록 명시한다.

`brief.texture`는 `auto`, `flat`, `clay`, `watercolor`, `crayon`, `felt`, `pencil`만 허용한다. 이전 클라이언트처럼 생략하면 종전 그림체 요청을 그대로 처리한다. 음식·상품 사진 모드는 원본 사진 배경 제거를 유지하고 질감을 적용하지 않는다.

## 검증

```powershell
node --check app.js
python -m unittest test_server.py test_compare.py test_textures.py
node --test tests/textures.test.cjs
```

실제 OpenAI 이미지 생성 및 결과 화질 검증은 포함하지 않는다. 외부 유료 API 대신 요청 본문과 참고 이미지 전달, 입력 검증, 음식 사진 처리 분기, 화면 선택값을 테스트한다.

## 실서비스 반영

Vercel 프런트엔드와 Supabase AI 함수가 함께 업데이트되어야 실제 이미지 생성에 선택 질감이 반영된다. GitHub 커밋만으로 Supabase 함수가 자동 배포되지는 않는다.

1. 이 변경을 main에 반영하고 Vercel 배포 완료 및 `/assets/textures/texture-sheet.png` 응답을 확인한다.
2. 기존 프로젝트 권한으로 아래 AI 함수를 배포한다. 기존 인증 설정과 Secrets를 유지한다.

```powershell
supabase functions deploy ai --project-ref fthcyxhmgqqxtltyombf
```

3. AI 사용이 가능한 계정으로 서로 다른 질감을 선택해 생성하고, 요청의 `brief.texture`와 응답의 `texture`가 일치하는지 확인한다. 실제 이미지 생성에는 기존 온/이미지 API 비용이 든다.

노트북에서 `python server.py`로 실행할 때는 업데이트한 서버를 재시작하면 된다.
