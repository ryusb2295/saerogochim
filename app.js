'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={doc:'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8M8 17h5',hammer:'m15 12-8.4 8.4a2 2 0 0 1-2.8-2.8L12.2 9M17.6 15 22 10.6M20.9 11.7l-1.3-1.3a2 2 0 0 1-.6-1.4V7.9l-2.3-2.3A6 6 0 0 0 12.4 4H9l.9.8A6.6 6.6 0 0 1 12 9.7v1.3l2 2h1.2a2 2 0 0 1 1.4.6l1.3 1.3',card:'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM2 10h20M6 15h4',star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9Z',shield:'M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6ZM9 12l2 2 4-4',eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',eyeoff:'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',x:'M18 6 6 18M6 6l12 12',plus:'M12 5v14M5 12h14',brush:'M18.4 2.6a2 2 0 0 1 2.8 2.8L11 15.6 8.4 13ZM8 14c-2 0-3.5 1.5-3.5 3.5 0 1.3-.8 2.5-2 3 3 .8 6.5.4 8-1.5a3.4 3.4 0 0 0 .3-4.5',dice:'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',chat:'M4 5h16v11H8l-4 4Z',search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.5-4.5',bell:'M6 16V11a6 6 0 0 1 12 0v5l2 2H4ZM10 20h4',box:'M3 7l9-4 9 4v10l-9 4-9-4ZM3 7l9 4 9-4M12 11v10',home:'M3 11l9-8 9 8M5 9v12h14V9M10 21v-6h4v6',user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 4-6 8-6s8 2 8 6',shop:'M3 10h18M4 10v11h16V10M2 10l3-7h14l3 7M9 21v-7h6v7M2 10c0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3M20 2v4M18 4h4',folder:'M3 6h7l2 3h9v11H3V6Z',book:'M3 4h6c2 0 3 1 3 2 0-1 1-2 3-2h6v16h-6c-2 0-3 1-3 2 0-1-1-2-3-2H3V4ZM12 6v16',arrow:'M4 12h16m-6-6 6 6-6 6',back:'M20 12H4m6-6-6 6 6 6',check:'m5 12 4 4L19 6',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',smile:'M8 9h.1M16 9h.1M8 14c2 3 6 3 8 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',heart:'M12 21S1 14 3 7c2-5 7-4 9 0 2-4 7-5 9 0 2 7-9 14-9 14Z',box:'m3 7 9-4 9 4v13l-9 3-9-3V7Zm0 0 9 4 9-4M12 11v12M7 5l9 4',info:'M12 11v6M12 7h.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',save:'M5 3h12l4 4v14H3V3h2Zm2 0v7h10V3M7 21v-7h10v7',image:'M3 3h18v18H3V3Zm0 14 6-6 4 4 3-3 5 5M16 7h.1',leaf:'M20 3C8 1 1 8 6 15c7 7 16 0 14-12ZM4 21 16 9'};
const icon=n=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[n]||''}"/></svg>`;
const themes=[
  {name:'포근한 크림',bg:'#fff4df',ink:'#664633',accent:'#d9955f'},
  {name:'따뜻한 코랄',bg:'#ffe5da',ink:'#8a4436',accent:'#ed8a6a'},
  {name:'차분한 세이지',bg:'#e7eedc',ink:'#455e3b',accent:'#8ba370'},
  {name:'맑은 블루',bg:'#e4f1ff',ink:'#1f497e',accent:'#4e8bca'},
  {name:'은은한 라벤더',bg:'#f0e8ff',ink:'#573c79',accent:'#9a74cd'},
  {name:'선명한 옐로',bg:'#fff3bd',ink:'#604900',accent:'#d5a025'}
];
const initial=()=>({name:'',industry:'',style:'',mood:'귀엽고 친근한',audience:'전 연령',feature:'',service:'',moods:[],colorPrefs:[],keywords:'',theme:0,recommendedColor:null,customColor:null,shape:'circle',message:'맛있게 드세요!',fontSize:58,stickerEdits:{},commerceBrandId:null,mockup:'bag',customImage:null,id:null,dong:'',postTpl:'신메뉴',postText:'',brand:null});
const isHexColor=color=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color);
function colorChannels(color){
  return [1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16));
}
function contrastInk(color){
  const [r,g,b]=colorChannels(color).map(channel=>{
    const value=channel/255;
    return value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4;
  });
  return 0.2126*r+0.7152*g+0.0722*b>0.179?'#000000':'#ffffff';
}
function brandTheme(st=state){
  const base=themes[st.theme]||themes[0],colors=st.brand?.colors,index=st.recommendedColor;
  const selected=isHexColor(st.customColor)?st.customColor:Number.isInteger(index)&&index>=0&&index<4&&Array.isArray(colors)&&colors.length===4&&colors.every(isHexColor)?colors[index]:null;
  if(!selected)return base;
  const bg=selected,ink=contrastInk(bg),target=ink==='#000000'?0:255;
  const accent='#'+colorChannels(bg).map(v=>Math.round(v*.72+target*.28).toString(16).padStart(2,'0')).join('');
  return {...base,bg,ink,accent};
}
const isPresetSelected=index=>!isHexColor(state.customColor)&&state.recommendedColor===null&&state.theme===index;
const extraRecommendedColors=[
  {name:'차분한 블루그레이',color:'#a5b7c7'},
  {name:'부드러운 세이지',color:'#b3c1ab'},
  {name:'은은한 라벤더 그레이',color:'#c6bdce'},
  {name:'따뜻한 오트 베이지',color:'#dbccb5'}
];
function recommendedSwatches(){
  const colors=state.brand?.colors,swatches=[];
  const add=(color,name)=>{if(isHexColor(color)&&!swatches.some(s=>s.color.toLowerCase()===color.toLowerCase()))swatches.push({color:color.toLowerCase(),name})};
  if(Array.isArray(colors))colors.forEach((c,i)=>add(c,'추천 색상 '+(i+1)));
  extraRecommendedColors.forEach(({color,name})=>add(color,name));
  themes.forEach(t=>add(t.bg,t.name));
  const current=brandTheme().bg.toLowerCase();
  return `<div class="rec-colors" role="group" aria-label="추천 컬러">${swatches.map(({name,color})=>`<button type="button" data-rec-hex="${color}" class="${current===color?'selected':''}" style="background:${color}" aria-label="${esc(name)} ${color} 적용" aria-pressed="${current===color}" title="${esc(name)} ${color}"></button>`).join('')}</div>`;
}
function customColorPicker(){return StickerEditor.colorMarkup(brandTheme().bg)}
function bindCustomColor(){
  StickerEditor.bindColor($('#app'),brandTheme().bg,color=>{
    state.customColor=color.toLowerCase();state.recommendedColor=null;
    $('#app').querySelectorAll('[data-rec-hex]').forEach(button=>{
      const selected=button.dataset.recHex===state.customColor;
      button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
    });
    saveDraft();refreshSticker();
  });
}
let state=initial(),page='studio',step=1,assets={},toastTimer,shop='';
let generating=false,genStart=0,genPct=0,genError='',autoKey='';let askQ=0;// 질문 수. AI 켜진 계정은 마지막에 그림체 고르기가 하나 더 있음
const askN=()=>5;
// 시디과 학생 그림체 (assets/styles, server.py와 supabase/functions/ai의 STYLES와 같은 이름)
const STYLE_CARDS=[['','알아서 골라 주세요'],['duck','동글 오리'],['object','상품 캐릭터'],['pastel','파스텔'],['line','흑백 선화'],['flat','플랫'],['crayon','크레용'],['doodle','낙서 선화'],['airbrush','에어브러시']];let aiReady=false;
const KEY='gageon-brands-v1';
// 체험용 시작 화면이라 실제 인증 없이 가게 이름만 이 브라우저에 기억한다
const SHOP_KEY='gageon-shop-v1',SEED_KEY='gageon-seeded-v2',DRAFT_KEY='gageon-draft-v1',USAGE_KEY='gageon-usage-v1';
// 체험 버전의 AI 생성 횟수 제한. 실제 서비스에서는 서버가 사용자별로 센다

function saveDraft(){if(page!=='studio'||!(state.name||state.industry))return;const d={state,step,at:Date.now(),user};try{localStorage.setItem(DRAFT_KEY,JSON.stringify(d))}catch{try{localStorage.setItem(DRAFT_KEY,JSON.stringify({...d,state:{...state,customImage:null,generated:false}}))}catch{}}}
// 같은 브라우저에서 계정을 바꿔도 남의 작업이 보이지 않게, 저장한 계정과 지금 계정이 같을 때만 꺼낸다
function draft(){try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');return d&&d.user===user?d:null}catch{return null}}
// 처음 들어온 브라우저의 내 브랜드가 비어 보이지 않게 예시 브랜드를 한 번만 넣어둔다
const samples=(day=864e5,now=Date.now())=>[
{...initial(),id:'sample-dalbit',name:'달빛분식',industry:'떡볶이 분식집',feature:'밤늦게까지 여는 국물 떡볶이',audience:'청년',art:'duck',message:'오늘 밤도 따끈하게',savedAt:now-2*day},
{...initial(),id:'sample-bamcham',name:'밤참떡볶이',industry:'야식 떡볶이 배달',mood:'재미있고 개성 있는',audience:'청년',art:'object',theme:1,message:'야식은 역시 떡볶이',savedAt:now-5*day},
{...initial(),id:'sample-kkum',name:'꿈나라 떡볶이',industry:'떡볶이 포장 전문점',mood:'고급스럽고 차분한',art:'pastel',theme:2,shape:'square',message:'포장도 맛있게',savedAt:now-9*day}];
// v1 예시(한우랑, 몽글빵집, 오늘의 원두)가 남아 있으면 새 예시로 바꾼다
function seedSamples(){try{if(localStorage.getItem(SEED_KEY))return;const r=records(),old=['sample-hanwoo','sample-bread','sample-cafe'];if(!r.length||r.some(x=>old.includes(x.id)))localStorage.setItem(KEY,JSON.stringify([...r.filter(x=>!old.includes(x.id)),...samples()]));localStorage.setItem(SEED_KEY,'1')}catch{}}
function records(){try{const r=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(r)?r:[]}catch{return[]}}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('toast');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('toast'),3200)}
function assetType(){return typeOf(state)}
function svgUri(svg){return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}
// 스티커 글꼴 (구글 폰트, OFL). 스티커는 SVG 그림이라 화면 글꼴을 못 써서, 쓰인 글자만 잘라 SVG 안에 넣는다
const STICKER_FONTS=[['','기본'],['Jua','주아'],['Do Hyeon','도현'],['Black Han Sans','검은고딕'],['Gaegu','개구'],['Yeon Sung','연성'],['Gugi','구기'],['Gamja Flower','감자꽃'],['Gowun Batang','고운바탕'],['Gowun Dodum','고운돋움'],['Stylish','스타일리시'],['Dongle','동글']];
const STYLE_FONT={duck:'Jua',pastel:'Jua',object:'Black Han Sans',flat:'Do Hyeon',airbrush:'Do Hyeon',doodle:'Gaegu',crayon:'Gaegu',line:'Yeon Sung'};
const MOOD_FONT_STYLE={'귀엽고 친근한':'duck','따뜻하고 정겨운':'crayon','깔끔하고 모던한':'flat','고급스럽고 차분한':'pastel','재미있고 개성 있는':'object','힙하고 트렌디한':'airbrush'};
// 직접 고른 글꼴이 없으면 그림체(없으면 분위기)에 맞춰 정한다
function fontOf(s){return s.font??STYLE_FONT[s.style||MOOD_FONT_STYLE[moodKey(s)]]??''}
const fontCache={},fontJobs={},fontFailed={};let fontQueue=[],fontTimer=0;
function fontFace(family,text){
 if(!family)return '';const chars=[...new Set(text.replace(/\s/g,''))].sort().join('');if(!chars)return '';const key=family+'|'+chars;
 if(fontCache[key])return `<style>@font-face{font-family:'GageonSticker';src:url(${fontCache[key]})}</style>`;
 if(!fontJobs[key]&&!fontFailed[key]){fontJobs[key]=new Promise(res=>fontQueue.push([family,chars,key,res]));clearTimeout(fontTimer);fontTimer=setTimeout(flushFonts,250)}
 return ''}
// 글자를 칠 때마다 받지 않게 0.25초 모았다가 한 번에 받는다. 받으면 그림을 다시 그린다
async function flushFonts(){const q=fontQueue;fontQueue=[];let got=false;
 await Promise.all(q.map(async([family,chars,key,res])=>{try{const css=await(await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}${family==='Gaegu'?':wght@700':''}&text=${encodeURIComponent(chars)}`)).text();const url=css.match(/url\((https:[^)]+)\)/)?.[1];if(!url)throw Error();const blob=await(await fetch(url)).blob();fontCache[key]=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(blob)});got=true}catch{fontFailed[key]=true}res()}));
 if(got){if(page==='studio'&&step===3)refreshSticker();else render()}}
const fontsReady=()=>new Promise(r=>setTimeout(r,0)).then(()=>Promise.all(Object.values(fontJobs)));
const fontAttr=f=>`font-family="${f?'GageonSticker,':''}Malgun Gothic,Apple SD Gothic Neo,sans-serif"`;
function mascotUri(){return state.customImage||svgUri(assets[assetType()]||assets.shop||'<svg xmlns="http://www.w3.org/2000/svg"/>')}
// 스티커와 같은 규칙으로 업종에 맞는 기본 캐릭터를 고른다
// 예시 캐릭터 고르기: 정해 둔 그림(art) → 고른 그림체 → 분위기에 맞는 그림체 → 가게 이름으로 하나
const EX_ART=['duck','object','pastel','line'];
const typeOf=s=>{const m=MOOD_FONT_STYLE[moodKey(s)];return s.art||(EX_ART.includes(s.style)?s.style:EX_ART.includes(m)?m:EX_ART[[...(s.name||'')].reduce((a,c)=>a+c.charCodeAt(0),0)%EX_ART.length])};
// 스티커 세트: 같은 캐릭터에 문구와 모양만 바꾼 4장
const STICKER_SET=['감사합니다','오늘도 좋은 하루!','오늘의 할인','신메뉴 출시'];
// 세트에서는 문구를 크게, 상호명을 작게 바꿔 넣는다 (shopName은 파일 이름용)
const setSticker=i=>({...state,name:STICKER_SET[i],message:state.name,shopName:state.name,shape:i%2?'square':'circle'});
// SNS 홍보물 템플릿. 제목을 비워 두면 템플릿 기본 문구를 쓴다
const POST_TPL={신메뉴:'{n} 신메뉴 출시!',이벤트:'이번 주 특별 이벤트',할인:'오늘의 할인 소식'};
const postHead=st=>(st.postText||'').trim()||(POST_TPL[st.postTpl]||POST_TPL.신메뉴).replace('{n}',st.name||'우리 가게');
function wrapText(t,max,lines=2){const out=[];let cur='';for(const w of t.split(' ')){const next=cur?cur+' '+w:w;if(next.length<=max){cur=next;continue}if(cur)out.push(cur);cur=w;while(cur.length>max){out.push(cur.slice(0,max));cur=cur.slice(max)}}if(cur)out.push(cur);return out.length>lines?[...out.slice(0,lines-1),out.slice(lines-1).join(' ').slice(0,max-1)+'…']:out}
function postSVG(st=state){const t=brandTheme(st),raw=st.customImage||svgUri(assets[typeOf(st)]||assets.shop||''),tpl=st.postTpl||'신메뉴',head=wrapText(postHead(st),9),sub=st.brand?.slogan??st.message??'',y=270+head.length*104,f=fontOf(st),face=fontFace(f,tpl+head.join('')+sub+(st.name||'우리 가게')+st.industry),fw=w=>face?400:w;
return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="${t.bg}"/><circle cx="770" cy="760" r="360" fill="white" opacity=".5"/>${face}<image href="${esc(raw)}" x="500" y="500" width="520" height="520"/><g ${fontAttr(face&&f)}><rect x="80" y="80" width="${60+tpl.length*38}" height="72" rx="36" fill="${t.accent}"/><text x="110" y="129" font-size="36" font-weight="${fw(700)}" fill="${contrastInk(t.accent)}">${esc(tpl)}</text>${head.map((l,i)=>`<text x="80" y="${270+i*104}" font-size="92" font-weight="${fw(800)}" fill="${t.ink}">${esc(l)}</text>`).join('')}${wrapText(sub,22,2).map((l,i)=>`<text x="80" y="${y+6+i*50}" font-size="38" fill="${t.ink}" opacity=".8">${esc(l)}</text>`).join('')}<text x="80" y="960" font-size="52" font-weight="${fw(800)}" fill="${t.ink}">${esc(st.name||'우리 가게')}</text><text x="80" y="1010" font-size="30" fill="${t.ink}" opacity=".6">${esc(st.industry)}</text></g></svg>`}
// AI 브랜드 분석: 먼저 업종·분위기 규칙으로 예시 분석을 보여주고, 서버에 AI가 연결돼 있으면 결과를 바꿔 끼운다
const kindOf=t=>/한우|소고기|고기|정육|갈비/.test(t)?'cow':/카페|커피|찻집/.test(t)?'coffee':/빵|베이커리|제과|케이크|디저트/.test(t)?'bread':'shop';
function mockBrand(){const k=kindOf(state.industry),who={가족:'가족이',청년:'친구와','청년·학생':'친구와',직장인:'동료와',어르신:'어르신과','연인·친구':'둘이서',['전 연령']:'누구나'}[state.audience]||'누구나';
 const slogan={cow:`${who} 함께 즐기는 든든한 한 끼`,bread:'매일 아침 갓 구운 행복',coffee:'하루를 여는 따뜻한 한 잔',shop:`${state.name||'우리 가게'}에서 만나는 작은 행복`}[k];
 const classicColors={
   cow:['#492a35','#ae4b39','#e5ad53','#f8ecdc'],
   bread:['#50334e','#be6c3c','#e6b952','#fff4e0'],
   coffee:['#384038','#a66248','#b6c38d','#f4ebe0'],
   shop:['#35364e','#a35c68','#82b4a3','#faf3ea']
 }[k];
 const m=moodKey(state)||'';
 const colors=m.startsWith('고급')?['#27334f','#456d71','#bca371','#eeeaf4']:m.startsWith('재미')?['#40296d','#bf3974','#efa83c','#dff4fa']:
   m.startsWith('따뜻')?['#5b2e1f','#a4502f','#e2a46b','#fbe9d3']:m.startsWith('깔끔')?['#2f3e4e','#4f7f9f','#a9c7d8','#f3f6f8']:
   m.startsWith('힙')?['#16161d','#ff4f9a','#c6f432','#f5f3ff']:classicColors;
 const mood=m.startsWith('고급')?['차분한','정성스러운','품격 있는']:m.startsWith('재미')?['유쾌한','개성 있는','톡톡 튀는']:
   m.startsWith('깔끔')?['깔끔한','세련된','모던한']:m.startsWith('힙')?['트렌디한','감각적인','힙한']:['따뜻한','친근한','정겨운'];
 return {slogan,colors,keywords:[...mood,{가족:'가족',청년:'청년','청년·학생':'청년',직장인:'직장인',어르신:'단골','연인·친구':'데이트',['전 연령']:'모두의'}[state.audience]||'모두의']}}
let brandLoading=false;
const brandKey=()=>JSON.stringify(buildBrandRequest());
function applyBrand(b){const old=state.brand;if(old?.sloganEdited&&old.key===b.key){b.slogan=old.slogan;b.sloganEdited=true}if(old?.key!==b.key)state.recommendedColor=null;state.brand=b;if(state.message===initial().message||state.message===old?.slogan)state.message=b.slogan}
function setSlogan(value){if(!state.brand)return;const previous=state.brand.slogan;state.brand.slogan=value;state.brand.sloganEdited=true;if(state.message===previous)state.message=value;saveDraft();refreshSticker()}
const fontSizeLabel=n=>n<50?'작게':n<66?'보통':'크게';
function ensureBrand(){const key=brandKey();if(state.brand?.key===key)return;applyBrand({...mockBrand(),src:'mock',key});analyzeAI()}
async function analyzeAI(){if(brandLoading||!aiReady)return;brandLoading=true;const key=brandKey();if(page==='studio'&&step===2)render();
 try{const d=await aiCall('brand',buildBrandRequest());if(brandKey()===key)applyBrand({slogan:d.slogan,colors:d.colors,keywords:d.keywords,src:'ai',key})}
 catch{toast('AI 분석을 받지 못해서 예시 분석을 보여드려요.')}finally{brandLoading=false;if(page==='studio'&&step===2)render()}}
function analysisCard(){const b=state.brand;if(!b)return '';return `<div class="analysis"><div class="analysis-head"><strong>브랜드 분석 결과</strong><span class="ai-badge">${b.src==='ai'?'AI':'예시'}</span></div>${brandLoading?'<p class="analysis-loading" role="status">AI가 가게 정보를 분석하고 있어요…</p>':''}<label class="mini-label" for="brand-slogan">슬로건 · 직접 바꿀 수 있어요</label><input class="slogan-input" id="brand-slogan" type="text" maxlength="60" value="${esc(b.slogan)}"><p class="mini-label">추천 컬러 · 눌러서 적용해요</p>${recommendedSwatches()}${customColorPicker()}<p class="mini-label">브랜드 키워드</p><div class="tags">${b.keywords.map(k=>`<span>#${esc(k)}</span>`).join('')}</div><div class="analysis-actions"><button type="button" class="chip-btn" id="use-slogan">${icon('brush')}스티커 문구로 쓰기</button>${aiReady?'<button type="button" class="chip-btn" id="reanalyze">'+icon('dice')+'다시 분석</button>':''}</div></div>`}
// 스티커 배치와 자주 쓰는 배달 스티커 문구. 문구를 고르면 어울리는 배치도 같이 바꾼다
// 리뷰·배달 스티커 배치는 문구가 길면 글자가 작아져서 18자(공백, / 빼고)까지만
const MSG_MAX=18,msgLen=m=>String(m||'').replace(/[\s/]/g,'').length,shortLayout=s=>!['basic','char'].includes(s.layout||'basic');
const LAYOUTS=[['char','캐릭터만'],['basic','기본'],['arc','둥근 글씨'],['big','큰 글씨'],['band','띠']];
const PHRASES=[['소중한 주문 / 감사합니다','big'],['이것은 / 뇌물 / 답례는 리뷰♥','big'],['사장님 몰래 드리는 / 서비스 / 맛있게 드세요','big'],['맛있게 드세요!','basic']];
function stickerSVG(s=state,mode='sticker'){
const t=brandTheme(s),type=typeOf(s),raw=s.customImage||svgUri(assets[type]||''),size=mode==='sns'?1080:800;
const outer=s.shape==='circle'?`<circle cx="400" cy="400" r="390" fill="white"/><circle cx="400" cy="400" r="372" fill="${t.bg}" stroke="${t.accent}" stroke-width="2" stroke-dasharray="4 8"/>`:`<rect x="10" y="10" width="780" height="780" rx="60" fill="white"/><rect x="28" y="28" width="744" height="744" rx="47" fill="${t.bg}" stroke="${t.accent}" stroke-width="2" stroke-dasharray="4 8"/>`;
const nameSize=Math.min(Number(s.fontSize)||58,620/Math.max((s.name||'').length,1)),f=fontOf(s),face=fontFace(f,(s.name||'')+(s.message||'')+(s.industry||'')),name=esc(s.name||''),weight=face?400:800;
const bg=mode==='sns'?`<rect width="800" height="800" fill="${t.bg}"/><circle cx="400" cy="355" r="270" fill="white" opacity=".45"/>`:outer;
const open=`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 800 800">${bg}${face}`,txt=`fill="${t.ink}" ${fontAttr(face&&f)} text-anchor="middle"`;
const parts=String(s.message||'').split('/').map(x=>x.trim()).filter(Boolean),line=parts.join(' ');
const layer=(key,content,x,y)=>StickerEditor.wrap(s,key,content,x,y);
const character=(x,y,w,h)=>layer('character',`<image href="${esc(raw)}" x="${x}" y="${y}" width="${w}" height="${h}"/>`,x+w/2,y+h/2);
const label=(y,fs,extra='')=>layer('name',`<text x="400" y="${y}" ${txt} font-size="${fs}" font-weight="${weight}" ${extra}>${name}</text>`,400,y-fs*.35);
if(s.layout==='char'||((s.layout||'basic')==='basic'&&!(s.name||'').trim()&&!line))return open+character(110,110,580,580)+'</svg>';
if(s.layout==='arc'){
 const top=Math.min(64,820/Math.max(line.length,1)),bot=Math.min(52,560/Math.max((s.name||'').length,1));
 const message=layer('message',`<text ${txt} font-weight="${weight}" font-size="${top}"><textPath href="#arc-top" startOffset="50%">${esc(line)}</textPath></text>`,400,170);
 const shop=layer('name',`<text ${txt} font-weight="${weight}" font-size="${bot}" dy="${bot*.8}"><textPath href="#arc-bot" startOffset="50%">${name}</textPath></text>`,400,650);
 return `${open}<defs><path id="arc-top" d="M 120 410 A 280 280 0 0 1 680 410"/><path id="arc-bot" d="M 150 420 A 250 250 0 0 0 650 420"/></defs>${character(185,150,430,405)}${message}${shop}</svg>`;
}
if(s.layout==='big'){
 const three=parts.length>=3,small1=three?parts[0]:'',small2=three?parts.slice(2).join(' '):'',bigs=three?[parts[1]]:parts.length?parts:[s.name||''];
 const lines=bigs.flatMap(x=>wrapText(x,6,3)),bs=Math.min(200,600/Math.max(...lines.map(l=>l.length),1),300/lines.length),mid=330-(lines.length-1)*bs*.55,sm=x=>Math.min(50,480/Math.max(x.length,1));
 const message=layer('message',`<g ${txt} font-weight="${weight}">${small1?`<text x="400" y="${mid-bs*.75}" font-size="${sm(small1)}">${esc(small1)}</text>`:''}${lines.map((l,i)=>`<text x="400" y="${mid+bs*.35+i*bs*1.08}" font-size="${bs}">${esc(l)}</text>`).join('')}${small2?`<text x="400" y="${mid+bs*.35+(lines.length-1)*bs*1.08+sm(small2)*1.5}" font-size="${sm(small2)}" fill="${t.accent}">${esc(small2)}</text>`:''}</g>`,400,330);
 return open+message+character(270,500,260,245)+label(108,Math.min(30,300/Math.max((s.name||'').length,1)),'opacity=".75"')+'</svg>';
}
if(s.layout==='band'){
 const clip=s.shape==='circle'?'<circle cx="400" cy="400" r="372"/>':'<rect x="28" y="28" width="744" height="744" rx="47"/>',lines=wrapText(line,9,3),fs=Math.min(68,560/Math.max(...lines.map(l=>l.length),1));
 const message=layer('message',`<g clip-path="url(#band-clip)"><rect x="-100" y="${470-lines.length*fs*.75}" width="1000" height="${lines.length*fs*1.5}" fill="${t.accent}" transform="rotate(-10 400 470)"/></g><g ${fontAttr(face&&f)} text-anchor="middle" fill="${contrastInk(t.accent)}" font-weight="${weight}" transform="rotate(-10 400 470)">${lines.map((l,i)=>`<text x="400" y="${470+fs*.35+(i-(lines.length-1)/2)*fs*1.15}" font-size="${fs}">${esc(l)}</text>`).join('')}</g>`,400,470);
 return `${open}<defs><clipPath id="band-clip">${clip}</clipPath></defs>${character(225,45,350,330)}${message}${label(665,Math.min(54,520/Math.max((s.name||'').length,1)))}</svg>`;
}
const message=layer('message',`<text x="400" y="661" ${txt} font-size="${Math.min(28,600/Math.max(line.length,1))}" letter-spacing="1">${esc(line)}</text>`,400,650);
return open+character(170,110,460,430)+label(600,nameSize)+message+'</svg>';
}
function logo(){return `<button class="logo" data-page="home" aria-label="가게온 홈"><img class="wordmark" src="assets/brand/logo-green.svg" alt="가게온"></button>`}
function nav(cls){return `<nav class="${cls}" aria-label="주요 메뉴">${navItems().map(([p,i,l])=>`<button data-page="${p}" class="${navTab()===p?'active':''}" ${navTab()===p?'aria-current="page"':''}>${icon(i)}<span>${l}</span>${p==='chats'&&typeof chatUnread!=='undefined'&&chatUnread?`<i class="nav-badge">${chatUnread>99?'99+':chatUnread}</i>`:''}</button>`).join('')}</nav>`}
// 체험용 계정: 아이디·비밀번호·복구 코드를 이 브라우저에만 저장한다. 원문 대신 PBKDF2 해시만 둔다.
// 이 브라우저에만 저장되는 로컬 계정이라 다른 기기에서는 로그인 안 됨. 출시 때 Supabase Auth로 바꿀 것
const USERS_KEY='gageon-users-v1',SESSION_KEY='gageon-session-v1';
let user='',auth='login',pendingCode='',codeReturn='home';
// 시연용 체험 계정. 로그인 폼에 미리 채워 두고, 없으면 첫 실행 때 만든다 (브라우저 저장 목업이라 공개돼도 됨)
const DEMO={id:'demo',pw:'demo1234',shop:'달빛분식'};
async function seedDemo(){try{const all=users();if(all[DEMO.id])return;all[DEMO.id]={shop:DEMO.shop,pw:await secretRecord(DEMO.pw),rc:await secretRecord(normCode(newCode())),createdAt:Date.now()};saveUsers(all)}catch{}}
function users(){try{const u=JSON.parse(localStorage.getItem(USERS_KEY)||'{}');return u&&typeof u==='object'?u:{}}catch{return {}}}
function saveUsers(u){localStorage.setItem(USERS_KEY,JSON.stringify(u))}
const hex=a=>[...a].map(b=>b.toString(16).padStart(2,'0')).join('');
const randHex=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
async function pbkdf2(secret,salt){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},k,256)))}
async function secretRecord(secret){const salt=randHex(16);return {salt,hash:await pbkdf2(secret,salt)}}
async function matches(secret,rec){return !!rec&&await pbkdf2(secret,rec.salt)===rec.hash}
// 복구 코드: 헷갈리는 0/O, 1/I/L을 뺀 31자 중 16자. 248 이상은 버려서 글자마다 확률을 같게 한다
const CODE_CHARS='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode(){let c='';while(c.length<16){for(const b of crypto.getRandomValues(new Uint8Array(32))){if(b<248&&c.length<16)c+=CODE_CHARS[b%31]}}return c.match(/.{4}/g).join('-')}
const normCode=v=>v.toUpperCase().replace(/[^A-Z0-9]/g,'');
// 사업자등록번호 끝자리 검증: 가중치 1,3,7,1,3,7,1,3,5
const bizOk=v=>{const d=v.replace(/\D/g,'');if(!/^\d{10}$/.test(d))return false;const w=[1,3,7,1,3,7,1,3,5];let s=w.reduce((a,x,i)=>a+x*d[i],0)+Math.floor(d[8]*5/10);return (10-s%10)%10===Number(d[9])};
const rules={biz:v=>bizOk(v)?'':'사업자등록번호 10자리를 확인해주세요.',id:v=>/^[a-z0-9]{4,20}$/.test(v)?'':'아이디는 영문 소문자와 숫자 4~20자로 적어주세요.',
 pw:v=>v.length>=8&&v.length<=64&&/[a-zA-Z]/.test(v)&&/\d/.test(v)?'':'비밀번호는 영문과 숫자를 섞어 8자 이상으로 적어주세요.',
 shop:v=>v.trim()&&v.trim().length<=24?'':'가게 이름을 적어주세요.',
 code:v=>normCode(v).length===16?'':'복구 코드 16자리를 확인해주세요.'};
function setErr(id,msg){const f=$('#'+id),e=$('#'+id+'-err');if(!f||!e)return;f.classList.toggle('invalid',!!msg);msg?f.setAttribute('aria-invalid','true'):f.removeAttribute('aria-invalid');e.textContent=msg;e.hidden=!msg}
function fld(id,label,type,extra=''){return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" aria-describedby="${id}-err" ${extra}><p class="field-error" id="${id}-err" role="alert" hidden></p></div>`}
// 폼의 [data-rule] 칸을 모두 검사하고 첫 오류 칸으로 포커스를 옮긴다
function checkForm(form){let first=null;form.querySelectorAll('[data-rule]').forEach(f=>{let m=rules[f.dataset.rule]?.(f.dataset.rule==='id'?f.value.trim().toLowerCase():f.value)||'';if(!m&&f.dataset.same&&f.value!==$('#'+f.dataset.same).value)m='비밀번호가 서로 달라요.';setErr(f.id,m);if(m&&!first)first=f});first?.focus();return !first}
function lockMsg(until){return `${Math.ceil((until-Date.now())/60000)}분 뒤에 다시 시도해주세요.`}
function signIn(id){user=id;shop=users()[id]?.shop||'';try{localStorage.setItem(SESSION_KEY,id)}catch{}}
function signOut(){user='';shop='';try{localStorage.removeItem(SESSION_KEY)}catch{}state=initial();step=1;auth='login';page='start'}
function authForm(){
 if(auth==='signup')return `<h1>회원가입</h1><p class="sub">아이디와 비밀번호만 있으면 돼요.</p><form id="signup-form" novalidate>${fld('su-id','아이디','text','data-rule="id" maxlength="20" autocomplete="username" autocapitalize="off" placeholder="영문 소문자, 숫자 4~20자"')}${fld('su-pw','비밀번호','password','data-rule="pw" maxlength="64" autocomplete="new-password" placeholder="영문+숫자 8자 이상"')}${fld('su-pw2','비밀번호 확인','password','data-rule="pw" data-same="su-pw" maxlength="64" autocomplete="new-password"')}${fld('su-shop','가게 이름','text','data-rule="shop" maxlength="24" autocomplete="organization" placeholder="예: 몽글빵집"')}<label class="check"><input type="checkbox" id="su-agree" aria-describedby="su-agree-err">체험 버전이라 계정이 이 브라우저에만 저장되는 것을 확인했어요. (필수)</label><p class="field-error" id="su-agree-err" role="alert" hidden></p><button class="primary full" type="submit" style="margin-top:12px">가입하기</button></form><div class="auth-links"><span>이미 계정이 있나요?</span><button type="button" class="text-button" data-auth="login">로그인</button></div>`;
 if(auth==='reset')return `<h1>비밀번호 재설정</h1><p class="sub">가입할 때 받은 복구 코드로 새 비밀번호를 정해요.</p><form id="reset-form" novalidate>${fld('rs-id','아이디','text','data-rule="id" maxlength="20" autocomplete="username" autocapitalize="off"')}${fld('rs-code','복구 코드','text','data-rule="code" maxlength="19" autocapitalize="characters" autocomplete="off" placeholder="XXXX-XXXX-XXXX-XXXX"')}${fld('rs-pw','새 비밀번호','password','data-rule="pw" maxlength="64" autocomplete="new-password"')}${fld('rs-pw2','새 비밀번호 확인','password','data-rule="pw" data-same="rs-pw" maxlength="64" autocomplete="new-password"')}<p class="field-error" id="rs-form-err" role="alert" hidden></p><button class="primary full" type="submit">비밀번호 바꾸기</button></form><div class="auth-links"><button type="button" class="text-button" data-auth="login">로그인으로 돌아가기</button></div>`;
 return `<h1>우리 가게만의 캐릭터를 만들어보세요</h1><p class="sub">디자인 경험이 없어도 괜찮아요. 로그인하고 AI와 함께 시작해요.</p><ol class="flow" aria-label="만드는 순서"><li>가게 정보 입력</li><li class="ai-step">AI 브랜드 분석</li><li>캐릭터·홍보물</li><li>다운로드</li></ol><form id="login-form" novalidate>${fld('li-id','아이디','text',`maxlength="20" autocomplete="username" autocapitalize="off" value="${DEMO.id}"`)}${fld('li-pw','비밀번호','password',`maxlength="64" autocomplete="current-password" value="${DEMO.pw}"`)}<p class="help" style="margin:-12px 0 16px">체험 계정(${DEMO.id} / ${DEMO.pw})이 채워져 있어요. 로그인만 누르면 돼요.</p><p class="field-error" id="li-form-err" role="alert" hidden></p><button class="primary full" type="submit">로그인 ${icon('arrow')}</button></form><div class="auth-links"><button type="button" class="text-button" data-auth="signup">회원가입</button><button type="button" class="text-button" data-auth="reset">비밀번호를 잊었어요</button></div>`}
function codePage(){return `<main class="start"><section class="panel"><div class="start-body"><div class="logo"><img class="wordmark" src="assets/brand/logo-green.svg" alt="가게온"></div><h1>복구 코드를 저장해주세요</h1><p class="sub">비밀번호를 잊었을 때 이 코드로 새 비밀번호를 정해요. 이 화면을 나가면 다시 볼 수 없어요.</p><div class="code-box" id="code-text">${esc(pendingCode)}</div><div class="code-actions"><button type="button" class="secondary" id="copy-code">복사하기</button><button type="button" class="secondary" id="save-code">파일로 저장</button></div><p class="warn">비밀번호와 복구 코드를 둘 다 잃으면 계정을 되찾을 수 없어요. 새 코드를 받으면 이전 코드는 쓸 수 없어요.</p><label class="check"><input type="checkbox" id="code-ok">복구 코드를 안전한 곳에 저장했어요.</label><button class="primary full" id="code-done" disabled style="margin-top:12px">계속하기</button></div></section></main>`}
function startPage(){return `<main class="start"><section class="panel"><div class="start-body"><div class="logo"><img class="wordmark" src="assets/brand/logo-green.svg" alt="가게온"></div>${REAL?realAuthForm():authForm()}${REAL?'':`<p class="form-foot">${icon('info')}체험 버전이라 계정은 이 브라우저에만 저장돼요.</p>`}</div></section></main>`}
// 화면을 그리다 오류가 나면 흰 화면 대신 다시 시도 안내를 보여 준다
function showCrash(){const app=document.getElementById('app');if(!app)return;document.querySelector('.gen-modal')?.remove();document.body.classList.remove('modal-open');app.innerHTML=`<main class="main crash" role="alert"><div class="crash-art">${mascotImg()||icon('info')}</div><h1>문제가 생겼어요</h1><p>잠시 후 다시 시도해 주세요. 계속 안 되면 앱을 껐다 켜 주세요.</p><button class="primary" id="crash-retry">다시 시도</button></main>`;document.getElementById('crash-retry').onclick=()=>location.reload()}
// 스크립트가 시작부터 멈춰 아무것도 안 그려졌을 때도 같은 안내
addEventListener('error',()=>{const app=document.getElementById('app');if(app&&!app.innerHTML.trim())showCrash()});
function render(){try{if(Commerce.prepare()===false)return;renderPage();Commerce.afterRender();enhanceInputs();document.body.classList.toggle('immersive',(page==='studio'&&step===1)||page==='chat');if(typeof fitChat==='function')fitChat()}catch(e){console.error(e);showCrash()}}
// 비밀번호 칸에는 보기(눈) 버튼, 질문 단계 글 칸에는 지우기(X) 버튼을 붙인다
function enhanceInputs(){
 document.querySelectorAll('input[type=password]:not([data-wrapped]),.ask-q input[type=text]:not([data-wrapped])').forEach(inp=>{
  inp.dataset.wrapped=1;const pw=inp.type==='password',wrap=document.createElement('span');wrap.className='input-wrap';inp.replaceWith(wrap);wrap.append(inp);
  const b=document.createElement('button');b.type='button';b.className='input-act'+(pw?'':' clear');wrap.append(b);
  if(pw){const paint=()=>{const shown=inp.type==='text';b.innerHTML=icon(shown?'eyeoff':'eye');b.setAttribute('aria-label',shown?'비밀번호 가리기':'비밀번호 보기')};paint();b.onclick=()=>{inp.type=inp.type==='password'?'text':'password';paint();inp.focus()}}
  else{b.innerHTML=icon('x');b.setAttribute('aria-label','지우기');const show=()=>{b.hidden=!inp.value};show();inp.addEventListener('input',show);b.onclick=()=>{inp.value='';inp.dispatchEvent(new Event('input',{bubbles:true}));show();inp.focus()}}
 })}
function renderPage(){
if(REAL&&myRole==='admin'&&page!=='admin'&&page!=='start')page='admin';
// 단계와 화면을 브라우저 기록에 남겨 휴대폰 뒤로가기로 이전 화면에 가게 한다
if(!history.state||history.state.page!==page||history.state.step!==step)history[history.state?'pushState':'replaceState']({page,step},'');saveDraft();
if(page==='code'&&!pendingCode)page=user?'home':'start';
if(page==='start'||page==='code'){$('#app').innerHTML=page==='code'?codePage():startPage();bind();return}
$('#app').innerHTML=`<aside class="sidebar">${logo()}${nav('nav')}<div class="side-note">${icon('leaf')}<strong>작은 가게, 빛나는 브랜드</strong>사장님의 이야기에<br>우리 가게다운 모습을 더해요.</div></aside><main class="main${REAL&&APP_TITLE_PAGES.includes(page)?' app-page':''}">${REAL?appBar():`<header class="topbar"><div class="mobile-logo">${logo()}</div><div class="breadcrumb">가게온 <span>/ ${PAGE_LABEL[page]||({home:'홈',studio:'브랜드 만들기',saved:'내 브랜드',mypage:'마이페이지'})[page]||'이용 가이드'}</span></div><button class="text-button shop-chip" id="logout">${esc(shop)} 사장님 · 나가기</button></header>`}${PAGES[page]?PAGES[page]():page==='studio'?studio():page==='saved'?saved():page==='home'?home():page==='mypage'?mypage():guide()}<footer class="mini-foot"><span>가게온 · 작은 가게의 시작을 응원합니다.</span></footer></main>${nav('bottomnav')}`;
bind();
}
function home(){const d=draft(),rs=records().slice(0,3);return `<section class="intro"><h1>${esc(shop)} 사장님, 안녕하세요</h1><p>오늘은 어떤 브랜드를 만들어볼까요?</p></section>
<button class="home-new" id="new-brand" aria-haspopup="dialog">${icon('plus')}<span><strong>만들기</strong><small>브랜드, 스티커, 홍보물을 만들어요</small></span></button>
${d&&d.state&&d.state.name?`<button class="home-resume" id="resume-draft"><img src="${svgUri(stickerSVG({...initial(),...d.state}))}" alt=""><span><strong>${esc(d.state.name)} 이어서 만들기</strong><small>${['가게 정보 입력','AI 브랜드 분석','캐릭터·홍보물','다운로드'][(d.step||1)-1]} 단계에서 멈췄어요</small></span></button>`:''}${Commerce.homeCard()}<div class="section-head"><h2>최근 작업</h2><button class="text-button" data-page="saved">전체 보기</button></div>
${rs.length?`<div class="recent">${rs.map(r=>`<button data-open="${esc(r.id)}"><img src="${svgUri(stickerSVG(r))}" alt="">${esc(r.name)}</button>`).join('')}</div>`:'<div class="empty"><p>아직 저장한 브랜드가 없어요. 첫 브랜드를 만들어보세요.</p></div>'}`}
function mypage(){const n=records().length;return `${Commerce.accountCard()}<section class="intro"><h1>마이페이지</h1><p>체험 버전이라 계정과 정보는 이 브라우저에만 저장돼요.</p></section>
<div class="my-list"><div>아이디<small>${esc(user)}</small></div></div>
<div class="my-list"><form class="my-name" id="name-form"><input id="my-shop" type="text" maxlength="24" value="${esc(shop)}" aria-label="가게 이름"><button class="secondary" type="submit">이름 변경</button></form></div>
<div class="my-list"><div>저장한 브랜드<small>${n} / 12개</small></div><button data-page="guide">이용 가이드<small>›</small></button></div>
<div class="my-list"><details><summary>비밀번호 변경</summary><form id="pw-form" novalidate>${fld('pw-cur','현재 비밀번호','password','maxlength="64" autocomplete="current-password"')}${fld('pw-new','새 비밀번호','password','data-rule="pw" maxlength="64" autocomplete="new-password"')}${fld('pw-new2','새 비밀번호 확인','password','data-rule="pw" data-same="pw-new" maxlength="64" autocomplete="new-password"')}<button class="primary full" type="submit">변경하기</button></form></details><details><summary>복구 코드 다시 받기</summary><form id="rc-form" novalidate><p class="help" style="margin:0 0 12px">새 코드를 받으면 지금 코드는 쓸 수 없어요.</p>${fld('rc-cur','현재 비밀번호','password','maxlength="64" autocomplete="current-password"')}<button class="primary full" type="submit">새 복구 코드 받기</button></form></details></div>
<div class="my-list"><button id="logout-my">로그아웃<small>›</small></button><details><summary class="danger">회원 탈퇴</summary><form id="leave-form" novalidate><p class="help" style="margin:0 0 12px">계정이 지워지고 되돌릴 수 없어요. 저장한 브랜드는 이 브라우저에 남아요.</p>${fld('lv-cur','현재 비밀번호','password','maxlength="64" autocomplete="current-password"')}<button class="primary full" type="submit">탈퇴하기</button></form></details><button class="danger" id="wipe">이 브라우저의 가게온 데이터 모두 지우기</button></div>`}
function steps(){return `<div class="steps" aria-label="진행 단계">${['가게 정보 입력',aiReady?'AI 브랜드 분석':'브랜드 분석','캐릭터·홍보물','다운로드'].map((v,i)=>`${i?'<span class="step-line"></span>':''}<div class="step ${step===i+1?'active':step>i+1?'done':''}" ${step===i+1?'aria-current="step"':''}><b>${step>i+1?'✓':i+1}</b><span class="step-label">${v}</span></div>`).join('')}</div>`}
// 분석 결과로 넘어가기 전에 무엇을 보고 있는지 단계별로 보여준다. 다른 화면으로 나가면 멈춘다
// 분석 중 캐릭터: 시디과 Figma의 픽셀 시바. 컵 위 김(원본 그림)만 따로 잘라 올려서 움직인다
const shibaArt=()=>`<span class="shiba-art"><img src="assets/brand/shiba.webp" alt=""><img class="steam" src="assets/brand/shiba-steam.webp" alt=""></span>`;
// 로딩 화면 (Figma '로딩'): 민트 배경, 말풍선, 엔티(개미), 가로 진행 막대. assets/brand/ant.png가 생기면 시바 대신 엔티가 나온다
const loaderArt=()=>`<div class="ld-art"><span class="ld-bubble">영차영차~</span><img class="ld-ant" src="assets/brand/ant.png" alt="" onload="this.parentNode.classList.add('has-ant')">${shibaArt()}</div>`;
// 아래 양쪽 치즈 (Figma 로딩 시안을 438px 화면 기준 좌표로 옮김). 오른쪽은 왼쪽을 뒤집고 연한 치즈가 앞에 온다
const cheeseL='<g transform="translate(113 128) rotate(15)"><rect x="-150" width="150" height="100" rx="16" fill="#ffeeaa"/><circle cx="-28" cy="35" r="12" fill="#ffde55"/></g>',cheeseD='<g transform="translate(78 83) rotate(36)"><rect x="-130" width="130" height="140" rx="18" fill="#ffde55"/><circle cx="-44" r="15" fill="#fff"/></g>';
const loaderDeco=`<div class="ld-deco" aria-hidden="true"><svg viewBox="0 0 438 180">${cheeseL}${cheeseD}<g transform="translate(438 0) scale(-1 1)">${cheeseD}${cheeseL}</g></svg></div>`;
const loaderBar=label=>`<div class="an-ring ld-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${label}"><i class="an-fill"></i></div>`;
function analyzing(){candidates=[];const items=['업종을 읽고 있어요','가게 분위기를 정리하고 있어요','어울리는 색을 고르고 있어요'];
 $('#brand-form').outerHTML=`<section class="analyzing an2 loader" role="status" aria-live="polite">${loaderArt()}${loaderBar('브랜드 분석 진행률')}<b class="an-pct sr-only" id="an-pct">0%</b><h2>브랜드 분석 중…</h2><p class="ld-sub">엔티가 가게 정보를 살펴보고 있어요!</p>${aiReady?'':'<small class="an-note">시연용 예시 분석이에요.</small>'}${loaderDeco}</section>`;
 // 약 2.6초 동안 1%씩 올라간다. 링이 차고, 3단계 목록은 끝난 건 체크, 하는 중인 건 빙글 도는 표시. 100%면 결과로
 let p=0;const t=setInterval(()=>{const ring=$('.an-ring');if(!ring){clearInterval(t);return}p++;ring.setAttribute('aria-valuenow',p);ring.querySelector('.an-fill').style.width=p+'%';$('#an-pct').textContent=p+'%';
  document.querySelectorAll('.an-list li').forEach(li=>{const i=+li.dataset.i,done=p>=(i+1)*100/3;li.classList.toggle('done',done);li.classList.toggle('active',!done&&p>=i*100/3)});
  if(p>=100){clearInterval(t);setTimeout(()=>{if($('.an-ring'))go(2)},400)}},26)}
function studio(){const titles=['가게 정보를 알려주세요',(state.brand?.src==='ai'?'AI가 브랜드를 분석했어요':'예시 브랜드 분석이에요'),'캐릭터와 홍보물을 다듬어요','다운로드하고 바로 쓰세요'];const subs=['몇 가지만 알려주시면 AI가 브랜드 방향을 제안해요.',(state.brand?.src==='ai'?'슬로건, 추천 컬러, 키워드를 확인하고 캐릭터를 만들어요.':(aiReady&&brandLoading?'AI 분석이 끝날 때까지 예시를 먼저 보여드려요.':'실제 AI 분석이 아닌 예시예요. 슬로건과 색은 직접 바꿀 수 있어요.')),'스티커 문구와 SNS 홍보물을 바꾸면 바로 반영돼요.','스티커 세트, SNS 홍보물, 포장 이미지를 받아 가세요.'];if(focusMode&&step>=3){const t={sticker:'스티커 만들기',post:'홍보물 만들기',edit:`${esc(state.name||'브랜드')} 꾸미기`}[focusMode]||'꾸미기';return `<section class="intro focus-intro"><button type="button" class="ask-back" id="focus-back" aria-label="홈으로">${icon('back')}</button><div><h1>${step===4?'다운로드':t}</h1><p>${step===4?'스티커 세트, SNS 홍보물, 포장 이미지를 받아 가세요.':esc(state.name||'')+' 캐릭터로 만들어요.'}</p></div></section>${step===3?editorPage():resultPage()}`}
 return `${step===1?'':`<section class="intro"><h1>${titles[step-1]}</h1><p>${subs[step-1]}</p></section>`}${step===1?'':steps()}${step===1?formPage():step===2?conceptPage():step===3?editorPage():resultPage()}`}
// 분위기, 손님층 선택지. [값, 설명, 색 3개(분위기만)]
function choice(field,values,withIcon=false){return `<div class="choices">${values.map((v,i)=>`<button type="button" class="choice${withIcon?' with-icon':''} ${state[field]===v?'selected':''}" data-field="${field}" data-value="${esc(v)}" aria-pressed="${state[field]===v}">${v}</button>`).join('')}</div>`}
// 예시 입력 버튼은 시연용 체험 계정(로그인 화면의 소상공인 둘러보기)에서만 보인다
const isDemoAccount=()=>!REAL||(typeof PUBLIC_DEMO!=='undefined'&&user===PUBLIC_DEMO.id);
// 가게 정보 질문 5단계 (시디과 Figma 시안 26.11.20): 가게 정보 → 분위기 → 디자인 → 특별한 점 → 확인
const MOOD_WORDS=[['귀여운','귀엽고 친근한'],['심플한','깔끔하고 모던한'],['고급스러운','고급스럽고 차분한'],['힙한','힙하고 트렌디한'],['발랄한','귀엽고 친근한'],['전통적인','따뜻하고 정겨운'],['화려한','재미있고 개성 있는'],['감성적인','따뜻하고 정겨운'],['따뜻한','따뜻하고 정겨운'],['차가운','깔끔하고 모던한']];
const COLOR_PREFS=[['빨강','#ff2d2d'],['주황','#ff7a00'],['노랑','#ffd42a'],['연두','#6fd400'],['초록','#00a36c'],['하늘','#5be3ea'],['파랑','#0a8ff0'],['보라','#a54bf5'],['분홍','#ff8cc8'],['갈색','#8b4513'],['검정','#111111']];
// 처음 고른 분위기 단어를 예전 6가지 분위기로 바꿔 그림체, 글꼴, 예시 색을 정한다 (server.py MOOD_STYLE과 같게)
const moodKey=s=>{const w=(s.moods||[])[0];return w?(MOOD_WORDS.find(x=>x[0]===w)||[])[1]||s.mood:s.mood};
let refImgs=[];   // 참고 이미지: 아직 AI에 보내지 않고 미리보기만 (시연 뒤 반영)
const refThumbs=()=>`<label class="ref-upload" for="ref-img" aria-label="참고 이미지 올리기">${icon('image')}<span>${refImgs.length}/3</span><input type="file" id="ref-img" accept="image/png,image/jpeg,image/webp" multiple hidden></label>`+refImgs.map(u=>`<img src="${u}" alt="참고 이미지">`).join('');
function confirmHTML(){const row=(k,v)=>`<div class="cf-row"><span>${k}</span><b>${v?esc(v):'<em>없음</em>'}</b></div>`,sec=(t,q,rows)=>`<div class="cf-sec"><div class="cf-head"><strong>${t}</strong><button type="button" class="chip-btn" data-goto="${q}">수정</button></div>${rows}</div>`;
 return sec('가게 정보',0,row('가게 이름',state.name)+row('업종',state.industry))+sec('분위기',1,row('분위기',(state.moods||[]).join(', ')))+sec('특별한 점',2,row('가게 특징',state.feature))+sec('취향',3,row('선호 색상',(state.colorPrefs||[]).join(', '))+row('참고 이미지',refImgs.length?refImgs.length+'장':''))}
function formPage(){const hid=q=>askQ===q?'':'hidden',pick=(field,items)=>`<div class="picks">${items.map(([v,c])=>{const on=(state[field]||[]).includes(v);return `<button type="button" class="pick${on?' on':''}" data-multi="${field}" data-value="${v}" aria-pressed="${on}">${c?`<i style="background:${c}"></i>`:''}${v}</button>`}).join('')}</div>`;
return `<form id="brand-form" class="ask ask5" novalidate><div class="ask-top"><button type="button" class="ask-back" id="ask-prev" aria-label="이전">${icon('back')}</button>${isDemoAccount()?'<button type="button" class="text-button" id="fill-example">예시 입력</button>':''}</div><div class="ask-prog" aria-hidden="true">${Array.from({length:4},(_,i)=>`<span class="${i===Math.min(askQ,3)?'on':''}"></span>`).join('')}</div>
<section class="ask-q" data-q="0" ${hid(0)}><h2>우리 가게를 소개해주세요!</h2><p class="ask-sub">가게에 딱 맞는 캐릭터를 만들어드릴게요.</p><div class="field"><label for="store-name">가게 이름</label><input id="store-name" name="name" type="text" maxlength="24" aria-required="true" aria-describedby="name-error" placeholder="예: 달빛분식" autocomplete="organization" value="${esc(state.name)}"><p class="field-error" id="name-error" role="alert" hidden>가게 이름을 적어주세요.</p></div><div class="field"><label for="industry">가게 업종</label><input id="industry" name="industry" type="text" maxlength="100" aria-required="true" aria-describedby="industry-error" placeholder="예: 소고기 전문점, 꽃집, 카페" value="${esc(state.industry)}"><p class="field-error" id="industry-error" role="alert" hidden>어떤 가게인지 적어주세요.</p><div class="suggest-chips" id="industry-chips" aria-label="자주 쓰는 업종" ${state.industry.trim()?'hidden':''}>${['카페','베이커리','고깃집','분식','꽃집','미용실','술집','반려동물 용품점'].map(v=>`<button type="button" data-industry="${v}">${v}</button>`).join('')}</div></div></section>
<section class="ask-q" data-q="1" ${hid(1)}><h2>어떤 분위기를 원하시나요?</h2><p class="ask-sub">원하는 느낌을 골라 캐릭터에 개성을 더해보세요.</p>${pick('moods',MOOD_WORDS.map(x=>[x[0]]))}</section>
<section class="ask-q" data-q="3" ${hid(3)}><h2>캐릭터에 취향을 더해볼까요?</h2><p class="ask-sub">좋아하는 색상이나 참고 이미지를 알려주세요.</p><div class="field"><p class="ask-label">선호 색상 <small>최대 3개</small></p><div class="swatches"><button type="button" class="swatch swatch-none" id="color-clear" aria-label="색상 선택 지우기">${icon('x')}</button>${COLOR_PREFS.map(([v,c])=>{const on=(state.colorPrefs||[]).includes(v);return `<button type="button" class="swatch${on?' on':''}" data-multi="colorPrefs" data-value="${v}" aria-pressed="${on}" aria-label="${v}"><i style="background:${c}"></i></button>`}).join('')}</div></div><div class="field"><p class="ask-label">참고 이미지 업로드 <small>선택</small></p><div class="ref-row" id="ref-thumbs">${refThumbs()}</div></div></section>
<section class="ask-q" data-q="2" ${hid(2)}><h2>우리 가게는 어떤 점이 특별한가요?</h2><p class="ask-sub">우리 가게만의 자랑거리를 알려주세요.</p><div class="field"><label for="feature" class="sr-only">가게 특징</label><textarea id="feature" name="feature" maxlength="100" rows="3" placeholder="예: 강아지와 함께 방문할 수 있는 작은 동네 빵집이에요. 반려견을 위한 간식도 판매해요.">${esc(state.feature)}</textarea><div class="ask-meta"><span>선택 입력</span><span class="counter" id="feature-count">${state.feature.length}/100</span></div></div></section>
<section class="ask-q" data-q="4" ${hid(4)}><h2>입력하신 가게 정보를 확인해 주세요</h2><p class="ask-sub">수정 버튼을 눌러 바로 고칠 수 있어요.</p><div id="ask-confirm">${askQ===4?confirmHTML():''}</div></section>
<div class="ask-actions"><button type="button" class="secondary" id="ask-before" ${askQ?'':'hidden'}>이전</button><button type="button" class="primary" id="ask-next" ${askQ<askN()-1?'':'hidden'}>다음</button><button class="primary ai" type="submit" id="ask-submit" ${askQ===askN()-1?'':'hidden'}>캐릭터 생성하기</button></div></form>`}
function conceptPage(){return `<div class="layout"><section class="panel"><div class="panel-title">${esc(state.name)} 브랜드 분석 <span class="ai-badge">${state.brand?.src==='ai'?'AI':'예시'}</span></div><p class="sub">가게 정보를 바탕으로 브랜드 방향을 정리했어요.</p>${analysisCard()}<h3 class="sec-title">캐릭터</h3><div class="notice">${aiWaiting()?(generating?'AI가 캐릭터를 그리고 있어요. 잠시만 기다려 주세요.':'AI 캐릭터를 아직 못 만들었어요. 아래 버튼으로 다시 시도해 주세요.'):state.generated?(aiReady?'AI가 생성한 캐릭터예요. 같은 원본을 스티커에 재사용해요.':'목업 시연용 결과예요. 실제 서비스에서는 AI가 새로 그린 캐릭터가 들어가요.'):state.customImage?'직접 올린 이미지로 제작 중이에요.':(aiReady?'현재는 예시 캐릭터예요. 아래 버튼으로 AI 생성을 요청할 수 있어요.':'현재는 예시 캐릭터예요. 직접 만든 캐릭터 이미지를 올려 쓸 수도 있어요.')}</div>${aiReady?(generating?'':`<button class="primary ai full" id="generate-ai">${icon('brush')}${state.generated?'다른 캐릭터로 다시 만들기':'AI로 새 캐릭터 만들기'}</button><p class="help">캐릭터 1회 생성 · ${Commerce.P.costs.generate}토큰. 업종과 가게 특징을 반영해요.</p>`):`<button class="primary ai full" id="generate-ai">${icon('brush')}AI로 새 캐릭터 만들기</button><p class="help">캐릭터 1회 생성 · ${Commerce.P.costs.generate}토큰. 예시 캐릭터로 생성 과정을 보여주는 시연이에요.</p>`}<div id="generation-status" role="status" aria-live="polite">${genError&&aiReady&&!generating?`<p class="field-error">${esc(genError)} <button type="button" class="text-button" id="retry-ai">다시 시도</button></p>`:''}</div><label class="upload-label" for="upload">내 캐릭터로 만들고 싶다면?<input type="file" id="upload" accept="image/png,image/jpeg,image/webp"><span>PNG·JPG·WebP, 2MB 이하 · 투명 PNG 권장</span></label><p class="field-error" id="upload-error" role="alert" hidden></p>${state.customImage?'<button class="text-button" id="reset-image">예시 캐릭터로 돌아가기</button>':''}<div class="actions"><button class="secondary" data-step="1">${icon('back')}이전</button><button class="primary" data-step="3">이 브랜드로 만들기 ${icon('arrow')}</button></div></section><aside class="panel"><div class="preview-stage">${aiWaiting()?`<div class="char-wait big">${shibaArt()}<small>${generating?'캐릭터를 그리고 있어요':'캐릭터가 아직 없어요'}</small></div>`:`${exampleChar()?'<span class="example-tag">예시 캐릭터</span>':''}<img id="concept-sticker" class="big-sticker" src="${svgUri(stickerSVG())}" alt="${esc(state.name)} 브랜드 미리보기">`}</div>${candidates.length>1?`<div class="cand-row" role="group" aria-label="만든 캐릭터 후보">${candidates.map((u,i)=>`<button type="button" class="cand${u===state.customImage?' on':''}" data-cand="${i}" aria-pressed="${u===state.customImage}" aria-label="후보 ${i+1}"><img src="${u}" alt=""></button>`).join('')}</div>`:''}<p class="preview-caption">${candidates.length>1?'다시 만든 캐릭터는 아래에 쌓여요. 눌러서 고를 수 있어요.':'선택한 캐릭터와 색상은 다음 단계에도 유지돼요.'}</p><div class="note">${icon('save')}완성한 브랜드를 저장하면 다음에도 같은 캐릭터로 만들 수 있어요.</div></aside></div>`}
function editorAppearance(){return `<div class="field"><label>브랜드 색상</label><p class="mini-label">추천 컬러</p>${recommendedSwatches()}${customColorPicker()}</div><div class="field"><label>상호명 글꼴</label><div class="font-carousel"><button type="button" class="font-nav" id="font-prev" aria-label="이전 글꼴">‹</button><div class="font-choices" id="font-choices" role="group" aria-label="스티커 글꼴 12종">${STICKER_FONTS.map(([v,l])=>`<button type="button" class="font-choice ${fontOf(state)===v?'selected':''}" data-field="font" data-value="${v}" aria-pressed="${fontOf(state)===v}"><b style="font-family:${v?`'${v}',`:''}sans-serif">${esc(state.name||'우리 가게')}</b><small>${l}</small></button>`).join('')}</div><button type="button" class="font-nav" id="font-next" aria-label="다음 글꼴">›</button></div><p class="help">좌우로 넘겨 12가지 글꼴을 골라보세요. 스티커, SNS 홍보물, 다운로드 PNG에 같이 들어가요.</p></div>`}
function editorPage(){return `<div class="layout"><section class="panel"><div class="panel-title">스티커를 내 마음에 쏙 맞게</div><p class="sub">캐릭터와 글씨를 직접 옮기고 크기를 바꿔보세요.</p><div class="field"><label for="edit-name">상호명</label><input type="text" id="edit-name" maxlength="24" value="${esc(state.name)}"></div><div class="field"><label for="message">스티커 문구</label><input type="text" id="message" maxlength="40" value="${esc(state.message)}"><div class="suggest-chips phrase-chips" aria-label="자주 쓰는 문구">${PHRASES.map(([m],i)=>`<button type="button" data-phrase="${i}">${esc(m.replace(/\s*\/\s*/g,' '))}</button>`).join('')}</div><p class="help">‘/’로 줄을 나눌 수 있어요. 예: 이것은 / 뇌물 / 답례는 리뷰♥${shortLayout(state)?`<span class="counter" id="msg-count">${msgLen(state.message)}/${MSG_MAX}</span>`:''}</p><p class="field-error" id="msg-error" role="alert" ${shortLayout(state)&&msgLen(state.message)>MSG_MAX?'':'hidden'}>이 배치는 ${MSG_MAX}자까지 들어가요. 문구를 줄여 주세요.</p></div><div class="field"><label>배치</label><div class="choices layout-choices">${LAYOUTS.map(([v,l])=>`<button class="choice ${(state.layout||'basic')===v?'selected':''}" data-field="layout" data-value="${v}" aria-pressed="${(state.layout||'basic')===v}">${l}</button>`).join('')}</div></div><div class="field"><label>스티커 모양</label><div class="choices">${[['circle','원형'],['square','둥근 사각형']].map(([v,l])=>`<button class="choice ${state.shape===v?'selected':''}" data-field="shape" data-value="${v}" aria-pressed="${state.shape===v}">${l}</button>`).join('')}</div></div><div class="field"><label for="font-size">상호명 크기</label><div class="range-row"><span class="range-end">작게</span><input id="font-size" type="range" min="36" max="80" value="${state.fontSize}" aria-valuetext="${fontSizeLabel(state.fontSize)}"><span class="range-end">크게</span></div><p class="help">크기를 바꾸면 위 편집 화면에 반영돼요. 긴 상호명은 스티커에 맞게 자동으로 줄어들어요.</p></div><div class="field"><label>SNS 홍보물</label>${choice('postTpl',['신메뉴','이벤트','할인'])}<input type="text" id="post-text" maxlength="24" style="margin-top:10px" aria-label="홍보물 제목" placeholder="${esc(postHead({...state,postText:''}))}" value="${esc(state.postText)}"><p class="help">비워 두면 템플릿 기본 문구가 들어가요.</p><label for="edit-slogan">슬로건</label><input type="text" id="edit-slogan" maxlength="60" value="${esc(state.brand?.slogan||'')}" placeholder="SNS 홍보물에 들어갈 문구"><img id="live-post" class="post-preview" src="${svgUri(postSVG())}" alt="SNS 홍보물 미리보기"></div><button type="button" class="secondary full" id="apply-design">문구·홍보물 반영 · ${Commerce.P.costs.edit}토큰</button><div class="actions">${focusMode?'':`<button class="secondary" data-step="2">${icon('back')}이전</button>`}<button class="primary" id="to-result">결과물 보기 ${icon('arrow')}</button></div></section><aside class="panel sticker-editor-panel"><div class="preview-stage"><div id="sticker-canvas" class="sticker-canvas" tabindex="0" role="group" aria-label="스티커 편집 화면">${stickerSVG()}</div></div>${StickerEditor.controls(editorAppearance())}<details class="pack-fold"><summary>포장에 붙여 보기</summary><img id="live-pack" class="pack-preview" src="${svgUri(packSVG())}" alt="편집 중인 스티커의 포장 미리보기"></details><div class="download-info">${icon('image')}<div><strong>스티커 디자인 PNG</strong><small>${Commerce.P.print.pixels} × ${Commerce.P.print.pixels} px · 스티커 바깥 투명 배경</small></div></div></aside></div>`}
function resultPage(){return `<div class="layout"><section class="panel"><div class="panel-title success-title">${icon('check')}우리 가게의 브랜드가 완성됐어요</div><p class="sub">미리보기는 참고용이며 실제 인쇄 결과와 차이가 있을 수 있어요.</p><div class="choices">${[['bag','종이 쇼핑백'],['box','포장 상자'],['cup','테이크아웃 컵']].map(([v,l])=>`<button class="choice ${(state.mockup||'bag')===v?'selected':''}" data-field="mockup" data-value="${v}" aria-pressed="${(state.mockup||'bag')===v}">${l}</button>`).join('')}</div><img class="pack-preview" src="${svgUri(packSVG())}" alt="${esc(state.name)} 스티커를 붙인 포장 미리보기"><p class="preview-caption">한 번 만든 캐릭터, 다양한 곳에서 같은 모습으로.</p><div class="insta" aria-label="인스타그램 게시물 미리보기"><div class="insta-head"><span class="insta-av"><img src="${svgUri(stickerSVG())}" alt=""></span>${esc(state.name)}</div><img src="${svgUri(postSVG())}" alt="${esc(postHead(state))} 홍보물"><div class="insta-foot">${icon('heart')}<b>${esc(state.name)}</b> ${esc(state.brand?.slogan||state.message)} <span>${(state.brand?.keywords||[]).map(k=>'#'+esc(k.replace(/\s/g,''))).join(' ')}</span></div></div><button class="secondary full" style="margin-top:20px" data-step="3">${icon('back')}디자인 더 다듬기</button></section><aside class="panel"><div class="panel-title">${esc(state.name)} 브랜드 패키지</div><div class="deliverables"><figure><img src="${svgUri(stickerSVG())}" alt="스티커"><figcaption>스티커</figcaption><button class="secondary" id="download" data-commerce-download="sticker" data-label="스티커 PNG 받기">${icon('download')}받기</button></figure><figure><img src="${svgUri(postSVG())}" alt="SNS 홍보물"><figcaption>SNS 홍보물</figcaption><button class="secondary" id="download-sns" data-commerce-download="sns" data-label="SNS 홍보물 받기">${icon('download')}받기</button></figure><figure><img src="${svgUri(packSVG())}" alt="포장 미리보기"><figcaption>포장</figcaption><button class="secondary" id="download-pack" data-commerce-download="pack" data-label="포장 미리보기 받기">${icon('download')}받기</button></figure></div><p class="mini-label">스티커 세트</p><div class="deliverables set">${STICKER_SET.slice(0,2).map((m,i)=>`<figure><img src="${svgUri(stickerSVG(setSticker(i)))}" alt="${m} 스티커"><figcaption>${m}</figcaption><button class="secondary" data-set="${i}">${icon('download')}받기</button></figure>`).join('')}</div><div class="my-list"><button data-commerce-download="character" data-label="캐릭터 PNG 받기">캐릭터 PNG 받기</button><button data-commerce-download="svg" data-label="칼선 SVG 받기">칼선 SVG 받기</button><button data-commerce-download="pdf" data-label="칼선 PDF 받기">칼선 PDF 받기</button><button data-commerce-download="menu" data-label="메뉴판 PNG 받기">메뉴판 PNG 받기</button><button data-commerce-download="coupon" data-label="쿠폰 PNG 받기">쿠폰 PNG 받기</button></div><details class="market-fold"><summary>메뉴판·쿠폰 문구 수정</summary><label class="mini-label" for="menu-items">메뉴명|가격을 한 줄에 하나씩 적어주세요</label><textarea id="menu-items" data-export-field="menuItems" maxlength="300">${esc(state.menuItems||'대표 메뉴|가격\n추천 메뉴|가격\n인기 메뉴|가격')}</textarea><label class="mini-label" for="coupon-text">쿠폰 혜택</label><input id="coupon-text" data-export-field="couponText" type="text" maxlength="36" value="${esc(state.couponText||'')}" placeholder="쿠폰 혜택을 입력해주세요"></details><p class="help">기본 스티커와 세트 2종, 총 3종이에요. 칼선 파일은 인쇄소와 규격·색상을 확인한 뒤 사용해주세요.</p><button class="primary full" id="to-request" style="margin-bottom:10px">${icon('box')}이 디자인으로 인쇄 견적 받기</button><button class="secondary full" id="save">${icon('save')}내 브랜드에 저장</button><p class="help">스티커 ${Commerce.P.print.pixels} × ${Commerce.P.print.pixels} px / SNS·포장 1080 × 1080 px<br>${REAL?'저장하면 내 계정에 남아 다른 기기에서도 이어 만들 수 있어요.':'체험 모드라 이 브라우저에만 저장돼요.'}</p><div class="note">${icon('info')}${REAL?'인쇄 견적을 요청하면 여러 인쇄소가 견적을 보내요. 업체를 고른 뒤 채팅으로 규격과 배송을 맞춰요.':'시연 견적을 요청하면 예시 인쇄소로 모의 주문을 만들어요.'}</div></aside></div>`}
function saved(){const rs=records();return `<section class="intro"><h1>다시 만나도, <em>우리다운 모습.</em></h1><p>저장해둔 캐릭터와 디자인으로 언제든 다시 시작해요.</p></section>${REAL?'':`<div class="notice">이 브라우저에 저장된 브랜드 ${rs.length}개. 브라우저 데이터를 지우면 함께 삭제돼요.</div>`}${rs.length?`<div class="saved-grid">${rs.map(r=>`<article class="saved-card"><div class="saved-art"><img src="${svgUri(stickerSVG(r))}" alt="${esc(r.name)} 스티커"></div><div class="saved-body"><h3>${esc(r.name)}</h3><p>${esc(r.industry)}</p><p class="date">${new Date(r.savedAt).toLocaleDateString('ko-KR')}</p><div class="actions"><button class="secondary" data-open="${esc(r.id)}">이어 만들기</button></div><button class="card-del" data-delete="${esc(r.id)}" aria-label="${esc(r.name)} 삭제">×</button></div></article>`).join('')}</div>`:`<div class="empty"><h2>첫 번째 브랜드를 기다리고 있어요</h2><p>우리 가게의 이야기를 들려주고, 나만의 브랜드를 저장해보세요.</p><button class="primary" data-page="studio">브랜드 만들기 ${icon('arrow')}</button></div>`}`}
function guide(){return `<section class="intro"><h1>처음이어도, <em>차근차근.</em></h1><p>가게의 이야기가 스티커가 되기까지, 네 단계면 충분해요.</p></section><div class="guide-grid">${[['01','가게 이야기를 들려주세요','상호명, 업종, 분위기, 고객층을 입력해요. 우리 가게만의 특징에는 “밤늦게까지 여는 국물 떡볶이”처럼 차별점을 적어주세요.'],['02','우리다운 브랜드를 골라요','업종에 맞춘 예시 캐릭터와 세 가지 색상으로 체험해요. 직접 만든 캐릭터 이미지를 올려 사용할 수도 있어요.'],['03','문구와 모양을 바꿔보세요','캐릭터는 유지하면서 상호명, 문구, 글자 크기, 스티커 모양을 직접 바꿀 수 있어요.'],['04','붙여보고, 저장하고, 가져가요','쇼핑백과 상자에 적용한 모습을 보고 PNG로 내려받아요. 내 브랜드에 저장하면 같은 브라우저에서 다시 편집할 수 있어요.']].map(([n,t,p])=>`<article class="panel"><div class="num">${Number(n)}단계</div><h3>${t}</h3><p>${p}</p></article>`).join('')}</div><div class="panel guide-status"><strong>현재 버전에서 가능한 것</strong><p>입력 · Python 서버 연결 시 AI 생성 · 예시 캐릭터 선택 · 이미지 업로드 · 스티커 편집 · 포장 미리보기 · PNG 다운로드 · 브라우저 저장</p><strong>다음 단계</strong><p>계정과 클라우드 저장 · 실물 주문 연계</p><p>현재 앱은 모바일에 맞춘 웹 프로토타입이에요. 브라우저 메뉴의 ‘홈 화면에 추가’를 지원하는 기기에서는 바로가기로 사용할 수 있어요.</p></div>`}
function buildBrandRequest(){return {name:state.name.trim(),industry:state.industry.trim(),mood:(state.moods||[]).length?state.moods.join(', '):state.mood,audience:state.audience,feature:state.feature.trim(),service:(state.service||'').trim(),colors:(state.colorPrefs||[]).join(', '),keywords:(state.keywords||'').trim(),style:state.style||MOOD_FONT_STYLE[moodKey(state)]||''}}
function syncForm(){if($('#store-name'))state.name=$('#store-name').value;if($('#industry'))state.industry=$('#industry').value;if($('#feature'))state.feature=$('#feature').value;if($('#service'))state.service=$('#service').value;if($('#keywords'))state.keywords=$('#keywords').value}
function refreshSticker(){const svg=stickerSVG(),sticker=svgUri(svg);const canvas=$('#sticker-canvas');if(canvas){canvas.innerHTML=svg;canvas.dispatchEvent(new Event('stickerrefresh'))}if($('#concept-sticker'))$('#concept-sticker').src=sticker;if($('#live-sticker'))$('#live-sticker').src=sticker;if($('#live-pack'))$('#live-pack').src=svgUri(packSVG());if($('#font-preview-sticker'))$('#font-preview-sticker').src=sticker;if($('#live-post'))$('#live-post').src=svgUri(postSVG())}
function clearError(f,err){if(!f.value.trim())return;f.classList.remove('invalid');f.removeAttribute('aria-invalid');$('#'+err).hidden=true}
// 가게 정보 입력은 질문 하나씩 보여준다 (삼쩜삼, 토스 방식). 입력칸은 모두 그려 두고 지금 질문만 보이게 한다
function askShow(n){syncForm();askQ=Math.max(0,Math.min(askN()-1,n));if(askQ===4&&$('#ask-confirm'))$('#ask-confirm').innerHTML=confirmHTML();setTimeout(()=>growArea($('#feature')));$('#app').querySelectorAll('.ask-q').forEach(s=>s.hidden=Number(s.dataset.q)!==askQ);$('#app').querySelectorAll('.ask-prog span').forEach((b,i)=>b.classList.toggle('on',i===Math.min(askQ,3)));$('#ask-next').hidden=askQ===askN()-1;if($('#ask-before'))$('#ask-before').hidden=!askQ;$('#ask-submit').hidden=askQ!==askN()-1;window.scrollTo({top:0});const f=$('.ask-q:not([hidden]) input[type=text]');if(f&&askQ===0)f.focus({preventScroll:true})}
function askNext(){syncForm();if(askQ===0){const miss=[['store-name','name-error',state.name.trim()],['industry','industry-error',state.industry.trim()]].filter(x=>!x[2]);miss.forEach(([id,err])=>{const f=$('#'+id);f.classList.add('invalid');f.setAttribute('aria-invalid','true');$('#'+err).hidden=false});if(miss.length){$('#'+miss[0][0]).focus();return}}askShow(askQ+1)}
function go(n){if(n===1)askQ=0;step=n;if(n>=2&&(!state.brand||n===2))ensureBrand();render();window.scrollTo({top:0,behavior:'smooth'});if(n===2&&aiReady&&!state.customImage&&!generating&&autoKey!==brandKey()){autoKey=brandKey();setTimeout(generateAI,0)}}
// 로그인·회원가입·재설정·복구 코드·마이페이지 계정 폼
function bindAuth(){
$('#app').querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>{auth=b.dataset.auth;render();$('.start-body input')?.focus()});
$('#app').querySelectorAll('[data-rule]').forEach(f=>f.onblur=()=>{if(!f.value)return;let m=rules[f.dataset.rule](f.dataset.rule==='id'?f.value.trim().toLowerCase():f.value);if(!m&&f.id==='su-id'&&users()[f.value.trim().toLowerCase()])m='이미 쓰고 있는 아이디예요.';if(!m&&f.dataset.same&&f.value!==$('#'+f.dataset.same).value)m='비밀번호가 서로 달라요.';setErr(f.id,m)});
const busy=async(form,fn)=>{const b=form.querySelector('[type=submit]');b.disabled=true;try{await fn()}catch{toast('처리하지 못했어요. 브라우저 저장 설정을 확인해주세요.')}finally{if(b.isConnected)b.disabled=false}};
const showCode=(code,back)=>{pendingCode=code;codeReturn=back;page='code';render()};
if($('#login-form'))$('#login-form').onsubmit=e=>{e.preventDefault();const f=e.target;busy(f,async()=>{const id=$('#li-id').value.trim().toLowerCase(),pw=$('#li-pw').value,err=m=>{$('#li-form-err').textContent=m;$('#li-form-err').hidden=!m};if(!id||!pw)return err('아이디와 비밀번호를 적어주세요.');const all=users(),u=all[id];if(u?.loginLock>Date.now())return err('로그인을 5번 틀려서 잠시 막아뒀어요. '+lockMsg(u.loginLock));if(!(await matches(pw,u?.pw))){if(u){u.loginFail=(u.loginFail||0)+1;if(u.loginFail>=5){u.loginLock=Date.now()+5*60000;u.loginFail=0}saveUsers(all)}$('#li-pw').value='';return err('아이디 또는 비밀번호가 맞지 않아요.')}u.loginFail=0;u.loginLock=0;saveUsers(all);signIn(id);state={...initial(),name:shop};page='home';render()})};
if($('#signup-form'))$('#signup-form').onsubmit=e=>{e.preventDefault();const f=e.target;if(!checkForm(f))return;const id=$('#su-id').value.trim().toLowerCase();if(users()[id]){setErr('su-id','이미 쓰고 있는 아이디예요.');$('#su-id').focus();return}if(!$('#su-agree').checked){setErr('su-agree','안내를 확인하고 체크해주세요.');$('#su-agree').focus();return}setErr('su-agree','');
 busy(f,async()=>{const code=newCode(),all=users();all[id]={shop:$('#su-shop').value.trim(),pw:await secretRecord($('#su-pw').value),rc:await secretRecord(normCode(code)),createdAt:Date.now()};saveUsers(all);signIn(id);state={...initial(),name:shop};showCode(code,'home')})};
if($('#reset-form'))$('#reset-form').onsubmit=e=>{e.preventDefault();const f=e.target;if(!checkForm(f))return;busy(f,async()=>{const id=$('#rs-id').value.trim().toLowerCase(),all=users(),u=all[id],err=m=>{$('#rs-form-err').textContent=m;$('#rs-form-err').hidden=!m};if(u?.resetLock>Date.now())return err('복구 코드를 5번 틀려서 잠시 막아뒀어요. '+lockMsg(u.resetLock));if(!(await matches(normCode($('#rs-code').value),u?.rc))){if(u){u.resetFail=(u.resetFail||0)+1;if(u.resetFail>=5){u.resetLock=Date.now()+15*60000;u.resetFail=0}saveUsers(all)}return err('아이디 또는 복구 코드가 맞지 않아요.')}
 const code=newCode();u.pw=await secretRecord($('#rs-pw').value);u.rc=await secretRecord(normCode(code));u.resetFail=0;u.resetLock=0;u.loginFail=0;u.loginLock=0;saveUsers(all);signIn(id);state={...initial(),name:shop};toast('비밀번호를 바꿨어요.');showCode(code,'home')})};
if($('#copy-code'))$('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(pendingCode);toast('복구 코드를 복사했어요.')}catch{toast('복사하지 못했어요. 코드를 길게 눌러 직접 복사해주세요.')}};
if($('#save-code'))$('#save-code').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([`가게온 복구 코드\n아이디: ${user}\n코드: ${pendingCode}\n\n비밀번호를 잊었을 때 로그인 화면의 "비밀번호를 잊었어요"에서 사용하세요.\n`],{type:'text/plain'}));a.href=url;a.download=`가게온_복구코드_${user}.txt`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)};
if($('#code-ok'))$('#code-ok').onchange=e=>{$('#code-done').disabled=!e.target.checked};
if($('#code-done'))$('#code-done').onclick=()=>{pendingCode='';page=codeReturn;render();scrollTo(0,0)};
const verifyCur=async(id)=>{const ok=await matches($('#'+id).value,users()[user]?.pw);setErr(id,ok?'':'현재 비밀번호가 맞지 않아요.');if(!ok)$('#'+id).focus();return ok};
if($('#pw-form'))$('#pw-form').onsubmit=e=>{e.preventDefault();const f=e.target;if(!checkForm(f))return;busy(f,async()=>{if(!(await verifyCur('pw-cur')))return;const all=users();all[user].pw=await secretRecord($('#pw-new').value);saveUsers(all);f.reset();f.closest('details').open=false;toast('비밀번호를 바꿨어요.')})};
if($('#rc-form'))$('#rc-form').onsubmit=e=>{e.preventDefault();const f=e.target;busy(f,async()=>{if(!(await verifyCur('rc-cur')))return;const code=newCode(),all=users();all[user].rc=await secretRecord(normCode(code));saveUsers(all);showCode(code,'mypage')})};
if($('#leave-form'))$('#leave-form').onsubmit=e=>{e.preventDefault();const f=e.target;busy(f,async()=>{if(!(await verifyCur('lv-cur')))return;modal({title:'정말 탈퇴할까요?',body:'<p>계정은 되돌릴 수 없어요.</p>',ok:'탈퇴하기',danger:true,onOk:()=>{const all=users();delete all[user];saveUsers(all);signOut();render();toast('탈퇴했어요.')}})})};
}
function bind(){
if($('#generate-ai'))$('#generate-ai').onclick=generateAI;if($('#retry-ai'))$('#retry-ai').onclick=generateAI;
$('#app').querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{syncForm();page=b.dataset.page;render();window.scrollTo({top:0})});
$('#app').querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>go(Number(b.dataset.step)));
$('#app').querySelectorAll('[data-field]').forEach(b=>b.onclick=()=>{syncForm();state[b.dataset.field]=b.dataset.value;if(b.dataset.field==='font'){saveDraft();$('#app').querySelectorAll('[data-field=font]').forEach(x=>{const selected=x.dataset.value===state.font;x.classList.toggle('selected',selected);x.setAttribute('aria-pressed',String(selected))});refreshSticker();return}if(step===1){$('#app').querySelectorAll('[data-field]').forEach(x=>{const selected=state[x.dataset.field]===x.dataset.value;x.classList.toggle('selected',selected);x.setAttribute('aria-pressed',String(selected))})}else render()});
// <html data-theme> 같은 브라우저·확장 프로그램 속성과 겹치지 않게 버튼만 고른다
$('#app').querySelectorAll('button[data-theme]').forEach(b=>b.onclick=()=>{state.theme=Number(b.dataset.theme);state.recommendedColor=null;state.customColor=null;render()});
$('#app').querySelectorAll('button[data-rec-color]').forEach(b=>b.onclick=()=>{state.recommendedColor=Number(b.dataset.recColor);state.customColor=null;render()});
 bindCustomColor();
 StickerEditor.bindCanvas($('#app'),()=>state,refreshSticker,saveDraft,key=>Commerce.editText(key));
 StickerEditor.bindFonts($('#app'));
if($('#brand-form'))$('#brand-form').onsubmit=e=>{e.preventDefault();syncForm();state.name=state.name.trim();const empty=[['store-name','name-error',state.name],['industry','industry-error',state.industry.trim()]].filter(x=>!x[2]);empty.forEach(([id,err])=>{const f=$('#'+id);f.classList.add('invalid');f.setAttribute('aria-invalid','true');$('#'+err).hidden=false});if(empty.length){askShow(0);const f=$('#'+empty[0][0]);f.scrollIntoView({behavior:'smooth',block:'center'});f.focus({preventScroll:true});return}analyzing()};
if($('#ask-next')){$('#ask-next').onclick=askNext;if($('#ask-before'))$('#ask-before').onclick=()=>askShow(askQ-1);$('#ask-prev').onclick=()=>{if(askQ)askShow(askQ-1);else{page='home';render()}};$('#app').querySelectorAll('.ask-q input[type=text]').forEach(x=>{x.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();askNext()}}});
 $('#app').querySelectorAll('[data-multi]').forEach(b=>b.onclick=()=>{const f=b.dataset.multi,v=b.dataset.value,a=[...(state[f]||[])],i=a.indexOf(v);if(f==='colorPrefs'&&i<0&&a.length>=3)return toast('색상은 3개까지 고를 수 있어요.');if(i<0)a.push(v);else a.splice(i,1);state[f]=a;if(f==='moods')state.mood=a.length?a.join(', '):initial().mood;b.classList.toggle('on',i<0);b.setAttribute('aria-pressed',String(i<0))});
 $('#ask-confirm').onclick=e=>{const g=e.target.closest('[data-goto]');if(g)askShow(Number(g.dataset.goto))};
 const bindRef=()=>{if($('#ref-img'))$('#ref-img').onchange=e=>{const fs=[...e.target.files].slice(0,Math.max(0,3-refImgs.length));e.target.value='';if(!fs.length)return toast('참고 이미지는 3장까지 올릴 수 있어요.');Promise.all(fs.map(f=>shrinkImage(URL.createObjectURL(f),400))).then(us=>{refImgs.push(...us);$('#ref-thumbs').innerHTML=refThumbs();bindRef()})}};bindRef();if($('#color-clear'))$('#color-clear').onclick=()=>{state.colorPrefs=[];$('#app').querySelectorAll('.swatch.on').forEach(b=>{b.classList.remove('on');b.setAttribute('aria-pressed','false')})}}
if($('#store-name'))$('#store-name').oninput=e=>{state.name=e.target.value;clearError(e.target,'name-error')};
$('#app').querySelectorAll('[data-help]').forEach(b=>b.onclick=()=>helpSheet(b.dataset.help));
if($('#focus-back'))$('#focus-back').onclick=()=>{if(step===4){go(3);return}focusMode='';page='home';render();scrollTo(0,0)};
$('#app').querySelectorAll('[data-cand]').forEach(b=>b.onclick=()=>{state.customImage=candidates[b.dataset.cand];render()});
if($('#industry'))$('#industry').oninput=e=>{state.industry=e.target.value;clearError(e.target,'industry-error');if($('#industry-chips'))$('#industry-chips').hidden=!!e.target.value.trim()};
if($('#feature'))$('#app').querySelectorAll('[data-industry]').forEach(b=>b.onclick=()=>{const i=$('#industry');i.value=b.dataset.industry;state.industry=i.value;i.dispatchEvent(new Event('input',{bubbles:true}));i.classList.remove('invalid');i.removeAttribute('aria-invalid');$('#industry-error').hidden=true});if($('#feature'))$('#feature').oninput=()=>{state.feature=$('#feature').value;$('#feature-count').textContent=state.feature.length+'/100';growArea($('#feature'))};growArea($('#feature'));
if($('#fill-example'))$('#fill-example').onclick=()=>{state={...initial(),name:'달빛분식',industry:'떡볶이 분식집',moods:['귀여운','따뜻한'],mood:'귀여운, 따뜻한',colorPrefs:['주황','갈색'],feature:'밤늦게까지 여는 국물 떡볶이 가게예요.'};askQ=4;render();toast('달빛분식 예시를 입력했어요. 수정 버튼으로 바꿔보세요.')};
if($('#edit-name'))$('#edit-name').oninput=e=>{state.name=e.target.value;refreshSticker()};
if($('#message'))$('#message').oninput=e=>{const v=e.target.value,over=shortLayout(state)&&msgLen(v)>MSG_MAX;if(over&&msgLen(v)>msgLen(state.message)){e.target.value=state.message}else state.message=v;$('#msg-error').hidden=!(shortLayout(state)&&msgLen(state.message)>MSG_MAX);if($('#msg-count'))$('#msg-count').textContent=msgLen(state.message)+'/'+MSG_MAX;refreshSticker()};
$('#app').querySelectorAll('[data-phrase]').forEach(b=>b.onclick=()=>{const[m,l]=PHRASES[b.dataset.phrase];state.message=m;state.layout=l;render()});
if($('#brand-slogan'))$('#brand-slogan').oninput=e=>setSlogan(e.target.value);
if($('#edit-slogan'))$('#edit-slogan').oninput=e=>setSlogan(e.target.value);
if($('#font-size'))$('#font-size').oninput=e=>{state.fontSize=Number(e.target.value);e.target.setAttribute('aria-valuetext',fontSizeLabel(state.fontSize));refreshSticker()};
if($('#to-result'))$('#to-result').onclick=()=>{state.name=state.name.trim();if(!state.name){toast('상호명을 입력해주세요.');$('#edit-name').focus();return}go(4)};
if($('#upload'))$('#upload').onchange=upload;
if($('#reset-image'))$('#reset-image').onclick=()=>{state.customImage=null;state.generated=false;render()};
if($('#download'))$('#download').onclick=()=>download('sticker');
if($('#download-sns'))$('#download-sns').onclick=()=>download('sns');
if($('#download-pack'))$('#download-pack').onclick=()=>download('pack');
if($('#logout'))$('#logout').onclick=()=>{signOut();render()};
bindAuth();
bindPrint();
if($('#save'))$('#save').onclick=save;
$('#app').querySelectorAll('[data-set]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.set);download('sticker',setSticker(i),b,'_스티커_'+STICKER_SET[i].replace(/[!\s]/g,''))});
if($('#post-text'))$('#post-text').oninput=e=>{state.postText=e.target.value;refreshSticker()};
if($('#use-slogan'))$('#use-slogan').onclick=()=>{state.message=state.brand.slogan;render();toast('슬로건을 스티커 문구로 넣었어요.')};
if($('#reanalyze'))$('#reanalyze').onclick=()=>{if(state.brand){state.brand.key='';state.brand.sloganEdited=false}ensureBrand()};
if($('#new-brand'))$('#new-brand').onclick=createSheet;
if($('#resume-draft'))$('#resume-draft').onclick=()=>{const d=draft();if(!d)return;focusMode='';state={...initial(),...d.state};page='studio';go(d.step||1)};
if($('#name-form'))$('#name-form').onsubmit=e=>{e.preventDefault();const v=$('#my-shop').value.trim();if(!v){toast('가게 이름을 적어주세요.');return}try{const u=users();if(u[user]){u[user].shop=v;saveUsers(u)}}catch{toast('저장하지 못했어요.');return}shop=v;render();toast('가게 이름을 바꿨어요.')};
if($('#logout-my'))$('#logout-my').onclick=()=>$('#logout').click();
if($('#wipe'))$('#wipe').onclick=()=>{if(!confirm('이 브라우저의 계정, 저장한 브랜드, 작업 중인 내용, 체험 횟수가 모두 지워져요. 되돌릴 수 없어요. 지울까요?'))return;try{[KEY,SHOP_KEY,SEED_KEY,DRAFT_KEY,USAGE_KEY,USERS_KEY,SESSION_KEY].forEach(k=>localStorage.removeItem(k))}catch{}signOut();render()};
$('#app').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const r=records().find(r=>r.id===b.dataset.open);if(r){focusMode='edit';state={...initial(),...r};page='studio';go(3)}});
$('#app').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{const id=b.dataset.delete,all=records(),idx=all.findIndex(r=>r.id===id);if(idx<0)return;const rec=all[idx];try{localStorage.setItem(KEY,JSON.stringify(all.filter(r=>r.id!==id)))}catch{return toast('삭제하지 못했어요. 브라우저 저장 설정을 확인해주세요.')}render();snackbar(`${rec.name||'브랜드'} 브랜드를 삭제했어요.`,'되돌리기',()=>{const now=records();now.splice(Math.min(idx,now.length),0,rec);try{localStorage.setItem(KEY,JSON.stringify(now))}catch{}render()},()=>{if(REAL)cloudBrand.remove(id)})});
}
async function upload(e){const file=e.target.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){uploadError('2MB 이하 PNG, JPG, WebP 파일만 올릴 수 있어요.');e.target.value='';return}uploadError('');try{const bmp=await createImageBitmap(file);const c=document.createElement('canvas');const ratio=Math.min(1,640/Math.max(bmp.width,bmp.height));c.width=bmp.width*ratio;c.height=bmp.height*ratio;c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);state.customImage=c.toDataURL('image/png');state.generated=false;bmp.close();render();toast('내 캐릭터를 적용했어요.')}catch{uploadError('이 그림을 열 수 없어요. 다른 파일을 골라 주세요.')}}
function save(){try{let rs=records();if(!/^[0-9a-f-]{36}$/.test(state.id||''))state.id=globalThis.crypto?.randomUUID?.()||'brand-'+Date.now()+'-'+Math.random().toString(36).slice(2);const r={...state,savedAt:Date.now()};const idx=rs.findIndex(x=>x.id===r.id);if(idx>=0)rs[idx]=r;else rs.unshift(r);if(rs.length>12){toast('최대 12개까지 저장할 수 있어요. 기존 브랜드를 정리해주세요.');return}let local=true;const write=()=>localStorage.setItem(KEY,JSON.stringify(rs));try{write()}catch{try{localStorage.removeItem(DRAFT_KEY);write()}catch{local=false}}   // 꽉 차면 만들던 초안을 비우고 한 번 더
 if(REAL)cloudBrand.save(r);   // 기기 저장이 안 돼도 계정에는 저장
 toast(local?'내 브랜드에 저장했어요.':REAL?'계정에 저장했어요. 이 기기 저장 공간이 부족해요.':'저장 공간이 부족해요. PNG를 다운로드해주세요.')}catch{toast('저장하지 못했어요. PNG를 다운로드해주세요.')}}
// 포장 미리보기(CSS로 그린 쇼핑백·상자)를 파일로도 받을 수 있게 같은 모양을 SVG로 다시 그린다
// 포장 미리보기: 정면, 플랫(그라데이션, 기울기 없음), 연회색 배경. 시디과 포장재 그림이 오면 이 그림만 바꾸면 된다
function packSVG(st=state){const s=svgUri(stickerSVG(st)),kind=['box','cup'].includes(st.mockup)?st.mockup:'bag';
const art={
bag:`<path d="M440 352 C440 190 640 190 640 352" fill="none" stroke="#a87f50" stroke-width="16" stroke-linecap="round"/><path d="M460 352 C460 215 620 215 620 352" fill="none" stroke="#bf956a" stroke-width="12" stroke-linecap="round"/><rect x="300" y="330" width="480" height="580" rx="12" fill="#dcbb8e"/><rect x="300" y="330" width="480" height="46" rx="12" fill="#cfab7b"/><rect x="300" y="360" width="480" height="16" fill="#cfab7b"/><circle cx="440" cy="356" r="8" fill="#a87f50"/><circle cx="640" cy="356" r="8" fill="#a87f50"/><image href="${s}" x="380" y="470" width="320" height="320"/>`,
box:`<rect x="250" y="440" width="580" height="440" rx="12" fill="#d8b283"/><rect x="230" y="390" width="620" height="78" rx="12" fill="#c99f6b"/><rect x="500" y="390" width="80" height="78" fill="#e9d3b2"/><rect x="250" y="468" width="580" height="10" fill="#c49a66" opacity=".5"/><image href="${s}" x="395" y="515" width="290" height="290"/>`,
cup:`<path d="M380 360 L700 360 L662 900 L418 900 Z" fill="#ffffff" stroke="#e3e3e3" stroke-width="4"/><path d="M392 520 L688 520 L672 760 L408 760 Z" fill="#dcbb8e"/><rect x="356" y="318" width="368" height="56" rx="16" fill="#ececec"/><rect x="392" y="282" width="296" height="48" rx="20" fill="#f5f5f5" stroke="#e3e3e3" stroke-width="4"/><image href="${s}" x="430" y="530" width="220" height="220"/>`}[kind];
const label={bag:'종이 쇼핑백',box:'포장 상자',cup:'테이크아웃 컵'}[kind];
return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="#f4f5f7"/><ellipse cx="540" cy="${kind==='cup'?906:kind==='box'?888:918}" rx="${kind==='cup'?170:300}" ry="22" fill="#000" opacity=".07"/>${art}<text x="540" y="1010" text-anchor="middle" font-family="Pretendard,Malgun Gothic,Apple SD Gothic Neo,sans-serif" font-size="28" fill="#9d9d9d">${esc(st.name||'우리 가게')} · ${label} 미리보기</text></svg>`}
async function download(mode,st=state,btn,suffix){const b=btn||$({sns:'#download-sns',pack:'#download-pack'}[mode]||'#download');b.disabled=true;try{await document.fonts.ready;mode==='sns'?postSVG(st):stickerSVG(st);await fontsReady();const svg=mode==='pack'?packSVG(st):mode==='sns'?postSVG(st):stickerSVG(st,mode);const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=svgUri(svg)});const c=document.createElement('canvas');c.width=c.height=mode==='sticker'?Commerce.P.print.pixels:1080;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);const blob=await new Promise(res=>c.toBlob(res,'image/png'));if(!blob)throw Error();const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=(st.shopName||st.name).replace(/[<>:"/\\|?*]/g,'_')+(suffix||({sns:'_SNS홍보물',pack:'_포장'}[mode]||'_스티커'))+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('PNG 파일을 만들었어요. 다운로드를 확인해주세요.')}catch{toast('다운로드를 완료하지 못했어요. 다시 시도해주세요.')}finally{b.disabled=false}}

// AI 켜진 계정에서 아직 AI 캐릭터가 없으면 예시 캐릭터 대신 빈 자리를 보여 준다
// 가게온 마스코트(쇼핑백 캐릭터). 로딩, 빈 자리, 오류 화면에 반짝이 아이콘 대신 쓴다
function mascotImg(){return assets.shop?`<img class="mascot-img" src="${svgUri(assets.shop)}" alt="">`:''}
// 실행 취소가 붙은 스낵바. 토스트와 달리 버튼을 누를 수 있고, 5초 지나면 onTimeout을 부른다
function snackbar(msg,action,onAction,onTimeout){document.querySelector('.snackbar')?.dispatchEvent(new Event('flush'));const el=document.createElement('div');el.className='snackbar';el.setAttribute('role','status');el.innerHTML=`<span>${esc(msg)}</span><button type="button">${esc(action)}</button>`;document.body.append(el);requestAnimationFrame(()=>el.classList.add('show'));let done=false;const finish=undo=>{if(done)return;done=true;clearTimeout(t);el.classList.remove('show');setTimeout(()=>el.remove(),250);undo?onAction():onTimeout?.()};const t=setTimeout(()=>finish(false),5000);el.querySelector('button').onclick=()=>finish(true);el.addEventListener('flush',()=>finish(false))}
// 스낵바가 떠 있는 채로 앱을 닫으면 기다리던 삭제를 바로 끝낸다
addEventListener('pagehide',()=>document.querySelector('.snackbar')?.dispatchEvent(new Event('flush')));
// 글 길이에 맞춰 textarea 높이를 늘린다
// 질문 옆 ? 버튼: 고른 답이 AI에 어떻게 쓰이는지 바텀시트로 설명한다 (폰은 아래에서, PC는 가운데 아래)
function helpBody(k){
 if(k==='mood')return ['분위기는 이렇게 쓰여요','<p>고른 분위기는 세 군데에 들어가요.</p><ul><li><b>캐릭터 표정과 자세</b>: 귀엽게, 차분하게처럼 느낌을 맞춰요.</li><li><b>추천 색과 슬로건</b>: 분위기에 어울리는 색 4개와 말투로 만들어요.</li><li><b>그림체</b>: 다음에 그림체를 ‘알아서’로 두면 분위기에 맞는 그림체를 골라요.</li></ul>'];
 if(k==='feature')return ['가게 자랑은 이렇게 쓰여요','<p>적은 내용에서 캐릭터가 들고 있을 소품을 한두 개 골라 그려요. 슬로건과 키워드에도 들어가요.</p><ul class="help-ex"><li><span>갓 구운 소금빵이 대표 메뉴</span><b>소금빵을 든 캐릭터</b></li><li><span>30년 된 동네 방앗간</span><b>떡 소품, 정겨운 표정</b></li><li><span>강아지 동반 가능한 카페</span><b>강아지와 함께 있는 캐릭터</b></li></ul><p class="help">메뉴 이름, 재료, 가게 이야기처럼 눈에 보이는 걸 적으면 잘 맞아요. 비워 둬도 업종을 보고 만들어요.</p>'];
 return ['‘알아서 골라 주세요’를 고르면','<p>앞에서 고른 분위기에 어울리는 그림체를 골라서 그려요. 가게 이름, 업종, 자랑은 어떤 그림체를 골라도 똑같이 캐릭터에 들어가요.</p><p class="help">그림체 카드를 직접 고르면 그 그림을 참고해서 그려요. 그림 속 캐릭터를 따라 그리지는 않고, 우리 가게에 맞는 캐릭터를 새로 만들어요.</p>'];
}
function helpSheet(k){const[title,body]=helpBody(k),prev=document.activeElement,el=document.createElement('div');el.className='modal-back';
 el.innerHTML=`<div class="modal help-sheet" role="dialog" aria-modal="true" aria-labelledby="help-title"><div class="help-head"><h2 id="help-title">${title}</h2><button type="button" class="text-button" data-x>닫기</button></div>${body}<button type="button" class="primary full" data-x>알겠어요</button></div>`;
 document.body.append(el);document.body.classList.add('modal-open');const close=()=>{el.remove();document.body.classList.remove('modal-open');prev?.focus?.()};
 el.querySelectorAll('[data-x]').forEach(b=>b.onclick=close);el.onclick=e=>{if(e.target===el)close()};el.onkeydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const f=[...el.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===f.at(-1)){e.preventDefault();f[0].focus()}}};el.querySelector('.primary').focus()}
function growArea(t){if(!t||!t.offsetParent)return;t.style.height='auto';t.style.height=t.scrollHeight+2+'px'}
function uploadError(m){const p=$('#upload-error');if(p){p.textContent=m;p.hidden=!m}else if(m)toast(m)}
function aiWaiting(){return aiReady&&!state.customImage}
// 준비해 둔 예시 캐릭터(목업 생성 포함)면 true. AI가 만든 그림이나 직접 올린 그림은 false
// 캐릭터 후보: 만들 때마다 최대 4개까지 쌓고 눌러서 고른다 (Figma '캐릭터를 생성했어요'). 이미지가 커서 저장(초안)에는 넣지 않음
let candidates=[];
function addCandidate(u){candidates=[...candidates.filter(x=>x!==u),u].slice(-4)}
// AI 그림(1024px PNG, 글자로 약 2MB)을 512px로 줄인다. 아이폰 사파리 저장 공간이 사이트당 약 5MB라 그대로면 1~2개만 저장돼도 꽉 참.
// 스티커 안 캐릭터는 460px 정도로 그려져서 화질 차이는 거의 없음
async function shrinkImage(uri,max=512){try{const img=new Image();img.src=uri;await img.decode();if(Math.max(img.width,img.height)<=max)return uri;const k=max/Math.max(img.width,img.height),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/png')}catch{return uri}}
// 홈 + 만들기: 무엇을 만들지 고르는 바텀시트. 스티커, 홍보물은 저장한 브랜드를 골라 그 단계로 바로 간다
// 저장한 브랜드로 바로 들어오면(스티커, 홍보물, 다시 꾸미기) 4단계 표시 없이 하는 일만 제목으로 보여준다
let focusMode='';
function startNewBrand(){focusMode='';try{localStorage.removeItem(DRAFT_KEY)}catch{}state={...initial(),name:shop};page='studio';go(1)}
function openBrand(id,mode){const r=records().find(r=>r.id===id);if(!r)return;focusMode=mode;state={...initial(),...r};page='studio';go(3);if(mode==='post')setTimeout(()=>$('#live-post')?.scrollIntoView({block:'center'}),120)}
function createSheet(){const rs=records(),prev=document.activeElement,el=document.createElement('div');el.className='modal-back';
 const opt=(k,ic,t,d,off)=>`<button type="button" class="make-opt" data-make="${k}" ${off?'disabled':''}><span class="make-ic">${icon(ic)}</span><span class="make-txt"><strong>${t}</strong><small>${off?'먼저 브랜드를 만들어 주세요':d}</small></span><span class="chev" aria-hidden="true">›</span></button>`;
 el.innerHTML=`<div class="modal make-sheet" role="dialog" aria-modal="true" aria-labelledby="make-title"><div class="help-head"><h2 id="make-title">무엇을 만들까요?</h2><button type="button" class="text-button" data-x>닫기</button></div><div class="make-list">${opt('brand','plus','새 브랜드 만들기','질문에 답하면 캐릭터와 슬로건이 나와요')}${opt('sticker','brush','스티커 만들기','저장한 캐릭터로 리뷰·배달 스티커',!rs.length)}${opt('post','image','홍보물 만들기','SNS 홍보물, 포장 디자인',!rs.length)}</div><div class="make-pick" hidden><div class="make-brands">${rs.map(r=>`<button type="button" data-make-brand="${esc(r.id)}"><img src="${svgUri(stickerSVG(r))}" alt=""><span>${esc(r.name)}</span></button>`).join('')}</div></div></div>`;
 document.body.append(el);document.body.classList.add('modal-open');let mode='';
 const close=()=>{el.remove();document.body.classList.remove('modal-open');prev?.focus?.()};
 el.querySelectorAll('[data-x]').forEach(b=>b.onclick=close);el.onclick=e=>{if(e.target===el)close()};el.onkeydown=e=>{if(e.key==='Escape')close()};
 el.querySelectorAll('[data-make]').forEach(b=>b.onclick=()=>{mode=b.dataset.make;if(mode==='brand'){close();startNewBrand();return}
  if(rs.length===1){close();openBrand(rs[0].id,mode);return}
  el.querySelector('.make-list').hidden=true;el.querySelector('.make-pick').hidden=false;el.querySelector('#make-title').textContent=mode==='sticker'?'어떤 브랜드로 스티커를 만들까요?':'어떤 브랜드로 홍보물을 만들까요?';el.querySelector('[data-make-brand]')?.focus()});
 el.querySelectorAll('[data-make-brand]').forEach(b=>b.onclick=()=>{close();openBrand(b.dataset.makeBrand,mode)});
 el.querySelector('.make-opt').focus()}
function exampleChar(){return !state.customImage||(state.generated&&!aiReady)}
// AI 캐릭터 만드는 동안 화면 전체를 덮는 로딩 창 (분석 화면과 같은 원형 링 + 단계 체크리스트)
const GEN_STEPS=[[0,'가게 특징을 읽고 있어요'],[20,'시디과 그림체를 맞추고 있어요'],[45,'캐릭터를 그리고 있어요'],[80,'마무리하고 있어요']];
function openGenModal(){closeGenModal();document.body.classList.add('modal-open');document.body.insertAdjacentHTML('beforeend',`<div class="gen-modal" role="dialog" aria-modal="true" aria-labelledby="gen-title"><section class="an2 loader">${loaderArt()}${loaderBar('캐릭터 만들기 진행률')}<b class="an-pct sr-only" id="gen-pct">0%</b><h2 id="gen-title">캐릭터 만드는 중…</h2><p class="ld-sub">엔티가 일을 하고 있어요!</p><small class="an-note">보통 10~20초 걸려요. 완료 전 앱을 닫지 마세요.</small>${loaderDeco}</section></div>`);paintGen()}
function closeGenModal(){$('.gen-modal')?.remove();document.body.classList.remove('modal-open')}
// 실제 진행률은 알 수 없어서 보통 걸리는 시간(약 15초)에 맞춰 95%까지 천천히 오르고, 끝나면 100%
function paintGen(){if(genPct<100)genPct=Math.min(95,Math.round(95*(1-Math.exp(-(Date.now()-genStart)/6000))));const m=$('.gen-modal');if(!m)return;const ring=m.querySelector('.an-ring');ring.setAttribute('aria-valuenow',genPct);ring.querySelector('.an-fill').style.width=genPct+'%';$('#gen-pct').textContent=genPct+'%';
 m.querySelectorAll('.an-list li').forEach(li=>{const i=+li.dataset.i,next=GEN_STEPS[i+1]?.[0]??100,done=genPct>=next;li.classList.toggle('done',done);li.classList.toggle('active',!done&&genPct>=GEN_STEPS[i][0])})}
async function generateAI(){if(generating)return false;try{return await Commerce.withTokens(Commerce.P.costs.generate,'generate',generateAIInternal)}catch(e){toast(e.message);return false}}
async function generateAIInternal(){
 if(generating)return;
 if(!aiReady)return mockGenerate();
 if(!['http:','https:'].includes(location.protocol)){const s=$('#generation-status');if(s)s.textContent='python server.py로 서버를 실행하고 http://127.0.0.1:8000에서 열어주세요.';return}
 generating=true;genStart=Date.now();genPct=0;genError='';if(page==='studio'&&step===2)render();openGenModal();
 const tick=setInterval(paintGen,100);
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),200000);
 try{
  const data=await aiCall('image',buildBrandRequest(),controller.signal);
  if(typeof data.image!=='string'||!data.image.startsWith('data:image/png;base64,'))throw Error('올바른 이미지를 받지 못했어요.');
  genPct=100;paintGen();await new Promise(r=>setTimeout(r,600));
  state.customImage=await shrinkImage(data.image);state.generated=true;state.id=null;addCandidate(state.customImage);toast('AI 캐릭터를 적용했어요.');return true;
 }catch(error){genError=error.name==='AbortError'?'응답 대기 시간이 초과됐어요. 서버에서 생성이 계속될 수 있으니 과금 내역을 확인한 뒤 다시 시도해주세요.':error.message||'서버 연결을 확인해주세요.';toast('캐릭터를 만들지 못했어요.');return false}
 finally{clearInterval(tick);clearTimeout(timer);generating=false;closeGenModal();if(page==='studio')render()}
}

// 서버 없이 여는 링크(GitHub Pages)용: 생성 과정을 흉내 내고 업종에 맞는 예시 캐릭터를 결과로 쓴다
async function mockGenerate(){
 const status=$('#generation-status');
 if(!status)return false;
 generating=true;
 const controls=[...document.querySelectorAll('button,input,select,textarea')];const previous=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),labels=['업종과 가게 특징 읽기','캐릭터 그리기','스티커에 적용하기'],stage=document.querySelector('.preview-stage');
 const show=i=>{status.innerHTML=`<ol class="gen-steps">${labels.map((l,j)=>`<li class="${j<i?'done':j===i?'active':''}">${l}</li>`).join('')}</ol>`};
 stage?.classList.add('is-loading');
 try{show(0);await wait(1000);show(1);await wait(1600);show(2);await wait(700);
  const cur=state.generated?typeOf(state):'';state.art=cur?EX_ART[(EX_ART.indexOf(cur)+1)%EX_ART.length]:typeOf(state);
  state.customImage=svgUri(assets[state.art]);state.generated=true;state.id=null;addCandidate(state.customImage);}
 finally{generating=false;controls.forEach((c,i)=>c.disabled=previous[i])}
 render();toast('캐릭터를 적용했어요. (목업)');return true}
// 노트북 서버(python server.py)로 열었으면 /api로, 휴대폰이나 Vercel이면 Supabase 함수 ai(supabase/functions/ai)로 보낸다
let localAI=false;
async function checkAI(){try{const c=new AbortController();const t=setTimeout(()=>c.abort(),3000);const r=await fetch('/api/status',{signal:c.signal});clearTimeout(t);const d=r.ok?await r.json():null;localAI=!!(d&&d.ready)}catch{localAI=false}refreshAI()}
// 로그인한 앱에서는 관리자가 AI를 켜 준 계정(aiAllowed, print.js)만 실제 생성. 아니면 예시 캐릭터(목업)
function refreshAI(){const was=aiReady;aiReady=REAL?(localAI||!!CFG.aiFunction)&&aiAllowed:localAI;if(was!==aiReady&&page==='studio'&&step===2)render()}
async function aiCall(kind,brief,signal){
 if(!localAI){const{data,error}=await sb.functions.invoke('ai',{body:{kind,brief}});if(error){let m='';try{m=(await error.context.json()).error}catch{}throw Error(m||'AI 요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.')}return data}
 const health=await (await fetch('/api/status',{signal})).json();if(!health.ready)throw Error('서버를 다시 실행하고 API 키를 입력해주세요.');
 const r=await fetch(kind==='image'?'/api/generate':'/api/brand',{method:'POST',headers:{'Content-Type':'application/json','X-Gageon-Token':health.token,...(await authHeader())},body:JSON.stringify(kind==='image'?{...brief,request_id:crypto.randomUUID()}:brief),signal});
 const d=await r.json();if(!r.ok)throw Error(d.error||'생성에 실패했어요.');return d}
// 아이폰 사파리는 viewport 설정을 무시해서 두 손가락 확대 제스처를 직접 막는다
['gesturestart','gesturechange'].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));
document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault()},{passive:false});
// 스플래시(앱 켤 때 한 번)와 첫 방문 소개 화면. 시디과 Figma 시안
const INTRO_KEY='gageon-intro-v1';
function showSplash(){let seen=false;try{seen=sessionStorage.getItem('gageon-splash')}catch{}if(seen)return null;try{sessionStorage.setItem('gageon-splash','1')}catch{}
 document.body.insertAdjacentHTML('beforeend','<div class="splash" role="img" aria-label="가게온, 누구나 쉽게 시작하는 가게 브랜딩"><p>누구나 쉽게 시작하는 가게 브랜딩</p><img src="assets/brand/logo.svg" alt=""><small>© 가게온</small></div>');return Date.now()}
function hideSplash(at){const el=$('.splash');if(!el)return;setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),450)},Math.max(0,1200-(Date.now()-at)))}
function showIntro(){try{if(localStorage.getItem(INTRO_KEY))return}catch{}
 document.body.insertAdjacentHTML('beforeend','<section class="intro-screen" role="dialog" aria-modal="true" aria-labelledby="intro-title"><div class="intro-art" aria-hidden="true"></div><div class="intro-copy"><h1 id="intro-title">우리 가게만의 캐릭터,<br>쉽게 만들어 볼까요?</h1><p>가게를 소개하면 AI가 캐릭터부터<br>브랜드 디자인까지 만들어드려요.</p></div><button class="primary" id="intro-start">시작하기</button></section>');
 $('#intro-start').onclick=()=>{try{localStorage.setItem(INTRO_KEY,'1')}catch{}$('.intro-screen').remove()};$('#intro-start').focus()}
async function init(){const splashAt=showSplash();checkAI();try{if(window.GAGEON_ASSETS){assets=window.GAGEON_ASSETS}else{await Promise.all([...EX_ART,'shop'].map(async n=>{const r=await fetch('assets/'+n+'.svg');if(!r.ok)throw Error(n);assets[n]=await r.text()}))}seedSamples();await seedDemo();if(REAL){await restoreSession()}else{try{const id=localStorage.getItem(SESSION_KEY)||'';if(users()[id])signIn(id)}catch{}page=user?'home':'start'}state.name=shop;render();if(splashAt)hideSplash(splashAt);if(page==='start')showIntro()}catch(e){if(splashAt)hideSplash(splashAt);console.error(e);showCrash()}}
addEventListener('pagehide',saveDraft);
// 입력이 멈추고 1초 뒤 임시 저장, AI 생성 중에는 창을 닫기 전에 한 번 묻는다
let draftTimer;addEventListener('input',()=>{clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,1000)});
addEventListener('beforeunload',e=>{if(generating){e.preventDefault();e.returnValue=''}});
// 오프라인 안내 띠
const offBar=document.createElement('div');offBar.id='offline-bar';offBar.setAttribute('role','status');offBar.textContent='인터넷 연결이 끊겼어요. 연결되면 다시 시도해주세요.';document.body.prepend(offBar);
const syncOnline=()=>{offBar.hidden=navigator.onLine};addEventListener('online',syncOnline);addEventListener('offline',syncOnline);syncOnline();
addEventListener('popstate',e=>{const h=e.state;if(!h)return;page=!user?'start':h.page==='start'?(pendingCode?'code':'home'):h.page;step=h.step||1;render();scrollTo(0,0)});
Commerce.install();init();
