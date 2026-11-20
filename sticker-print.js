'use strict';
const StickerPrint = (() => {
 const C=StickerPrintCore,encoder=new TextEncoder();let database,pending=null,opening=false;const requiredStates=new WeakSet();
 const owner=()=>REAL&&uid?uid:user;
 const safe=fn=>async e=>{try{await fn(e);}catch(error){toast(error.message||'인쇄 파일을 만들지 못했어요.');}};
 const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof data==='string'?encoder.encode(data):data))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const fingerprint=s=>JSON.stringify([s.name,s.message,s.shape,s.layout,s.theme,s.customColor,s.recommendedColor,s.fontSize,fontOf(s),typeOf(s),s.customImage,s.stickerEdits,s.brand?.colors]);
 const readDataURL=blob=>new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>bad(Error('PNG를 읽지 못했어요.'));r.readAsDataURL(blob);});
 async function db(){if(database)return database;database=await new Promise((ok,bad)=>{const r=indexedDB.open('gageon-print-assets-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('assets');r.result.createObjectStore('jobs');};r.onsuccess=()=>ok(r.result);r.onerror=()=>bad(Error('인쇄 원본을 보관할 공간을 열지 못했어요. 브라우저 저장 설정을 확인해주세요.'));});return database;}
 async function storage(store,key,value){const d=await db();return new Promise((ok,bad)=>{const tx=d.transaction(store,value===undefined?'readonly':'readwrite'),r=tx.objectStore(store)[value===undefined?'get':'put'](...(value===undefined?[key]:[value,key]));let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>ok(result);tx.onerror=()=>bad(Error('인쇄 원본을 저장하거나 불러오지 못했어요.'));tx.onabort=tx.onerror;});}
 const assetKey=(a,id=owner())=>id+'|'+a.id+'|'+a.version;
 async function decode(blob,id,sourceHash){
  if(blob.type!=='image/png'||blob.size>20*1024*1024)throw Error('20MB 이하의 원본 PNG를 골라주세요.');
  const raw=new Uint8Array(await blob.arrayBuffer()),info=C.pngInfo(raw);
  if(info.width!==info.height||!info.width||info.width>4096||info.frames!==1)throw Error('4096px 이하 정사각형 단일 프레임 PNG만 사용할 수 있어요.');
  const png=await readDataURL(blob),image=await loadImg(png),canvas=document.createElement('canvas');canvas.width=info.width;canvas.height=info.height;
  canvas.getContext('2d').drawImage(image,0,0);const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  const hasAlpha=rgba.some((v,i)=>i%4===3&&v<255),version=await digest(raw);
  return {id,version,width:info.width,height:info.height,frames:1,png,rgba,hasAlpha,blob,sourceHash};
 }
 async function remember(asset,s){await storage('assets',assetKey(asset),{id:asset.id,version:asset.version,blob:asset.blob,sourceHash:asset.sourceHash});s.printAsset={id:asset.id,version:asset.version,sourceHash:asset.sourceHash};saveDraft();return asset;}
 async function confirmedAsset(s){
  stickerSVG(s);await document.fonts.ready;await fontsReady();
  const sourceHash=await digest(fingerprint(s)),id=s.printAsset?.id||'asset-'+Commerce.brandId(s);
  if(s.printAsset?.sourceHash===sourceHash){const saved=await storage('assets',assetKey(s.printAsset));if(saved){const asset=await decode(saved.blob,id,sourceHash);if(asset.version!==s.printAsset.version)throw Error('저장된 PNG 버전이 달라요. 시안을 다시 확정해주세요.');return asset;}}
  const img=await loadImg(svgUri(stickerSVG(s))),canvas=document.createElement('canvas');canvas.width=canvas.height=GAGEON_PRICING.print.pixels;
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw Error('확정 PNG를 만들지 못했어요.');
  return remember(await decode(blob,id,sourceHash),s);
 }
 function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);return true;}
 function noticeError(el,error){const p=el.querySelector('[data-print-status]');p.textContent=error.message;p.className='field-error';}
 async function open(){
  if(opening)return;opening=true;const s=state,who=owner();
  try{
   if(s.shape!=='circle')throw Error('이 인쇄 양식은 50mm 원형 전용이에요. 스티커 모양을 원형으로 바꿔주세요.');
   let asset=await confirmedAsset(s);if(state!==s||owner()!==who)throw Error('시안이나 계정이 바뀌었어요. 다시 열어주세요.');
   pending=null;let built=null,approved='',currentOptions=C.options(s.printOptions),building=false,revision=0;
   const fileChecks=C.NAMES.map(n=>'<label><input type="checkbox" data-print-file="'+n+'" '+(currentOptions.files.includes(n)?'checked':'')+'> '+n+'</label>').join('');
   const html='<p class="help">확정한 PNG 한 장을 두 영역에 같은 물리 크기로 배치해요. 인쇄 파일 만들기·미리보기는 무료예요.</p><p class="help" data-print-asset></p>'+
   '<label class="mini-label" for="print-source-png">다른 확정 원본 PNG 사용</label><input id="print-source-png" type="file" accept="image/png"><small class="help">정사각형 단일 프레임 PNG · 최대 4096px · 20MB</small>'+
   '<div class="grid2"><div class="field"><label for="print-bg-mode">배경 처리</label><select id="print-bg-mode"><option value="white">흰색 · PNG 50mm</option><option value="solid">단색 · PNG 50mm + 배경 여분</option><option value="full-bleed">전체 배경 · 불투명 PNG 56mm</option></select></div><div class="field"><label for="print-bg-color">단색 배경색</label><input id="print-bg-color" type="color" value="'+(s.printOptions?.color||brandTheme(s).bg)+'"></div></div>'+
   '<details class="market-fold"><summary>인쇄소 전달 규격</summary><label for="print-printer">인쇄소명 또는 규격명</label><input id="print-printer" type="text" maxlength="80" value="'+esc(currentOptions.printerName)+'"><label for="print-color-space">인쇄 이미지 색상</label><select id="print-color-space"><option value="RGB">RGB · 인쇄소 확인 필요</option value="CMYK">CMYK · ICC 변환 필요</option></select><label for="print-spot">별도 칼선의 별색 이름</label><input id="print-spot" value="'+esc(currentOptions.spotName)+'" maxlength="40"><label for="print-line-width">칼선 굵기 (pt)</label><input id="print-line-width" type="number" min=".1" max="2" step=".05" value="'+currentOptions.cutlineWidthPt+'"><fieldset class="print-file-list"><legend>인쇄소가 요청한 파일만 선택</legend>'+fileChecks+'</fieldset><p class="help">인쇄소가 지정한 파일·별색 이름·선 굵기를 입력해주세요. CMYK는 해당 인쇄소의 ICC 프로필을 적용한 변환 전까지 생성하지 않아요.</p></details>'+
   '<div class="print-preview-grid"><figure><figcaption>완성 모양 · 원형 50mm</figcaption><div data-print-finished></div></figure><figure><figcaption>인쇄 작업 영역 · 76×76mm</figcaption><div data-print-work></div></figure></div><p class="help" data-print-status role="status"></p>'+
   '<button class="secondary full" type="button" data-print-build>인쇄 미리보기 만들기</button><label class="print-approval"><input type="checkbox" data-print-approve disabled> 원본 버전·50mm 원형·배경 여분·인쇄소 규격과 두 미리보기를 확인했습니다.</label>'+
   '<div class="my-list"><button type="button" data-print-download="artwork.pdf" disabled>인쇄 이미지 PDF 받기</button><button type="button" data-print-download="cutline.pdf" disabled>별도 칼선 PDF 받기</button><button type="button" data-print-download="proof.pdf" disabled>확인용 PDF 받기</button><button type="button" data-print-download="all" disabled>전체 5개 파일 ZIP 받기</button></div><button type="button" class="primary full" data-print-send disabled>확인한 파일로 인쇄 견적 받기</button><p class="help">인쇄 이미지에는 칼선을 넣지 않아요. 업체 지정 규격은 인쇄소와 확인한 뒤 전달해주세요.</p>';
   Commerce.sheet('시안 확정 · 인쇄 미리보기',html,({el,busy})=>{
    el.querySelector('.commerce-sheet').classList.add('sticker-print-sheet');
    el.querySelector('#print-bg-mode').value=currentOptions.mode;
    const read=()=>C.options({mode:el.querySelector('#print-bg-mode').value,color:el.querySelector('#print-bg-color').value,colorSpace:el.querySelector('#print-color-space').value,printerName:el.querySelector('#print-printer').value,spotName:el.querySelector('#print-spot').value,cutlineWidthPt:el.querySelector('#print-line-width').value,files:[...el.querySelectorAll('[data-print-file]:checked')].map(x=>x.dataset.printFile)});
    const controls=()=>el.querySelectorAll('[data-print-download],[data-print-send]').forEach(b=>b.disabled=!built||approved!==built.key);
    const invalidate=()=>{revision++;built=null;approved='';pending=null;el.querySelector('[data-print-approve]').checked=false;el.querySelector('[data-print-approve]').disabled=true;controls();};
    const paint=()=>{invalidate();try{currentOptions=read();const v=C.validate(asset,currentOptions);el.querySelector('[data-print-asset]').textContent='원본 '+asset.id+' · 버전 '+asset.version.slice(0,12)+' · '+asset.width+'×'+asset.height+'px';el.querySelector('[data-print-finished]').innerHTML=C.layoutSVG(asset,currentOptions,true,true);el.querySelector('[data-print-work]').innerHTML=C.layoutSVG(asset,currentOptions,false,true);const status=el.querySelector('[data-print-status]');status.className='help';status.textContent='배치 '+v.placement.widthMM+'mm · '+v.ppi.toFixed(1)+'ppi · 페이지 76×76mm / TrimBox 70×70mm';}catch(error){el.querySelector('[data-print-finished]').textContent='원본과 배경 모드를 확인해주세요.';el.querySelector('[data-print-work]').textContent='검증을 통과해야 파일을 만들 수 있어요.';noticeError(el,error);}};
    el.querySelectorAll('select,input:not([type=file])').forEach(x=>{if(!x.hasAttribute('data-print-approve'))x.oninput=paint;});
    el.querySelector('#print-source-png').onchange=e=>{const file=e.target.files[0];if(!file)return;busy(async()=>{asset=await remember(await decode(file,asset.id,await digest(fingerprint(s))),s);paint();});};
    el.querySelector('[data-print-build]').onclick=safe(async()=>{if(building)return;building=true;try{invalidate();const input=read(),generation=revision;C.validate(asset,input);if(state!==s||owner()!==who||await digest(fingerprint(s))!==asset.sourceHash)throw Error('시안이 바뀌었어요. 창을 닫고 다시 인쇄하기를 눌러주세요.');const result=await C.build(asset,input);if(generation!==revision)return;built=result;currentOptions=input;s.printOptions=input;saveDraft();el.querySelector('[data-print-approve]').disabled=false;el.querySelector('[data-print-status]').textContent='파일 5개를 생성했어요. 두 미리보기와 규격을 확인한 뒤 승인해주세요.';}catch(error){noticeError(el,error);}finally{building=false;}});
    el.querySelector('[data-print-approve]').onchange=e=>{approved=e.target.checked&&built?built.key:'';if(approved){built.metadata.approvedAt=new Date().toISOString();built.files['metadata.json']=encoder.encode(JSON.stringify(built.metadata,null,2));}controls();};
    const assert=async()=>{if(!built||approved!==built.key||C.key(asset,read())!==approved||state!==s||owner()!==who||await digest(fingerprint(s))!==asset.sourceHash)throw Error('시안 버전이나 옵션이 바뀌었어요. 다시 생성하고 승인해주세요.');};
    el.querySelectorAll('[data-print-download]').forEach(b=>b.onclick=safe(async()=>{await assert();await Commerce.gate('print',async()=>{await assert();const kind=b.dataset.printDownload,all=kind==='all';return download(all?C.zip(built.files):built.files[kind],(s.name||'우리 가게')+'_'+(all?'원형50mm_인쇄파일.zip':kind),all?'application/zip':'application/pdf');});}));
    el.querySelector('[data-print-send]').onclick=safe(async()=>{await assert();const jobId=await digest(built.key);await storage('jobs',owner()+'|'+jobId,{asset:{id:asset.id,version:asset.version},options:currentOptions,metadata:built.metadata,files:built.files});const pngFile=new File([asset.blob],asset.id+'.png',{type:'image/png'});requiredStates.add(s);pending={owner:who,s,sourceHash:asset.sourceHash,asset,options:currentOptions,built,approved,jobId,pngFile};uploadFile=pngFile;reqDraft={...reqDraft,item:'sticker',width:50,height:50,unit:'mm',title:(s.name||'우리 가게')+' 원형 50mm 스티커'};el.querySelector('[data-close]').click();page='newreq';render();scrollTo(0,0);});
    paint();
   });
  }catch(error){toast(error.message);}finally{opening=false;}
 }
 async function delivery(){
  if(!pending){if(requiredStates.has(state))throw Error('승인한 인쇄 파일이 변경됐어요. 인쇄 미리보기를 다시 생성하고 승인해주세요.');return null;}const p=pending,d=reqDraft;
  if(owner()!==p.owner||state!==p.s||await digest(fingerprint(state))!==p.sourceHash||uploadFile!==p.pngFile||d.item!=='sticker'||Number(d.width)*(d.unit==='cm'?10:1)!==50||Number(d.height)*(d.unit==='cm'?10:1)!==50||p.approved!==C.key(p.asset,p.options))throw Error('승인한 원형 50mm 시안과 요청 내용이 달라요. 인쇄하기에서 다시 확인해주세요.');
  const files=Object.fromEntries(p.options.files.map(n=>[n,p.built.files[n]])),zip=C.zip(files);
  if(zip.length>30*1024*1024)throw Error('전달 파일이 30MB를 넘어요. 원본을 줄이거나 필요한 파일만 골라주세요.');
  return {file:new File([zip],'circle-50mm-print.zip',{type:'application/zip'}),metadata:p.built.metadata,jobId:p.jobId,files:p.options.files};
 }
 function decorate(){
  if(page!=='newreq'||!pending)return;
  const form=$('#req-form');if(!form)return;form.insertAdjacentHTML('afterbegin','<div class="notice">승인한 원형 50mm 인쇄 파일 '+pending.options.files.length+'개를 ZIP으로 첨부해요. 원본 버전 '+pending.asset.version.slice(0,12)+'<br><button type="button" class="text-button" data-review-print>인쇄 미리보기 다시 확인</button></div>');form.querySelector('[data-review-print]').onclick=open;
 }
 async function downloadStored(jobId){const job=await storage('jobs',owner()+'|'+jobId);if(!job)throw Error('이 브라우저에 보관된 인쇄 파일을 찾지 못했어요.');const files=Object.fromEntries(job.options.files.map(n=>[n,job.files[n]]));return download(C.zip(files),'원형50mm_승인인쇄파일.zip','application/zip');}
 function clear(){pending=null;requiredStates.delete(state);}
 return {open,delivery,decorate,clear,downloadStored};
})();
