(function (root, factory) {
  const pricing = factory();
  if (typeof module === 'object' && module.exports) module.exports = pricing;
  else root.GAGEON_PRICING = pricing;
})(globalThis, () => Object.freeze({
  packages: {
    starter: { name: '스타터', price: 9900, rank: 1, items: ['캐릭터 PNG', '기본 스티커 PNG'] },
    opening: { name: '개업', price: 29000, rank: 2, recommended: true, items: ['캐릭터·스티커 3종 PNG', '포장·SNS 홍보물', '칼선 SVG·PDF'] },
    brand: { name: '디자인', price: 49000, rank: 3, items: ['개업 패키지 전체', '메뉴판·쿠폰 PNG', '라이트 1개월'] }
  },
  plans: {
    free: { name: '무료', price: 0, tokens: 150, benefits: ['가입 시 온 1회 지급'] },
    lite: { name: '라이트', price: 9900, tokens: 300, benefits: ['매월 온 한도까지 충전'] },
    pro: { name: '프로', price: 19900, tokens: 1000, recommended: true, benefits: ['매월 온 한도까지 충전', '정기배송 신청', '시즌 시안 무료'] }
  },
  tokenPacks: {
    small: { tokens: 100, price: 4900 },
    large: { tokens: 500, price: 19900 }
  },
  costs: { generate: 30, edit: 10, suggestion: 10 },
  feeRate: 0.08,
  checkoutDelay: 1000,
  deliveryDay: 1,
  seasonLeadDays: 30,
  seasons: [
    { id: 'white', name: '화이트데이', month: 3, day: 14, message: '달콤한 마음을 전해요' },
    { id: 'parents', name: '어버이날', month: 5, day: 8, message: '고마운 마음을 담았어요' },
    { id: 'summer', name: '여름', month: 7, day: 1, message: '시원한 여름 보내세요' },
    { id: 'halloween', name: '핼러윈', month: 10, day: 31, message: '달콤한 즐거움이 가득해요' },
    { id: 'winter', name: '겨울맞이', month: 12, day: 1, message: '따뜻한 마음을 담았어요' },
    { id: 'christmas', name: '크리스마스', month: 12, day: 25, message: '행복한 크리스마스 보내세요' }
  ],
  demoOrder: { amount: 92000, quantity: 500, shipping: 0, printerId: 'demoprint', printerName: '가게온 체험 인쇄소' },
  print: { pixels: 1600, pageMM: 60, cutlineWidth: 0.25 }
}));
