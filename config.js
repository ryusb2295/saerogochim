// 가게온 화면 설정. 아래 두 값은 브라우저에 공개되는 값이다 (데이터 보호는 Supabase RLS가 맡는다).
// 서버 전용 키(sb_secret_..., service_role)는 절대 여기에 넣지 않는다.
// tossClientKey는 토스페이먼츠 문서에 공개된 테스트 클라이언트 키라 실제 돈이 나가지 않는다. 시크릿 키(test_gsk_, live_gsk_)는 넣지 않는다.
window.GAGEON_CONFIG = {
  tossClientKey: 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm',
  supabaseUrl: 'https://fthcyxhmgqqxtltyombf.supabase.co',
  supabaseKey: 'sb_publishable_OSadgrkSIjhtYZx_jfQR3w_H_2EVbFT',
  // 웹 푸시 공개 키 (짝이 되는 비공개 키는 Supabase Secrets에만 있음)
  vapidPublicKey: 'BEkKgC9BmjMW81hsxrBjScz3DLuFzhynFqU8rJ0OL5_unZsiv8LzV6d6HyrKMEG6J6VUKWKn6KV8Y9X5VnUU-Hs'
};
