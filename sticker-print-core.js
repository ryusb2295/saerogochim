(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StickerPrintCore=api;})(globalThis,()=>{
'use strict';
const SPEC=Object.freeze({id:'circle-50mm-v1',pageMM:76,trimInsetMM:3,trimMM:70,centerMM:38,diameterMM:50,bleedMM:3,minPPI:300});
const NAMES=['layout.svg','artwork.pdf','cutline.pdf','proof.pdf','metadata.json'];
const enc=new TextEncoder(), bytes=x=>typeof x==='string'?enc.encode(x):x;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const pt=mm=>mm*72/25.4, num=n=>Number(n.toFixed(6));
function pngInfo(data){
 const b=bytes(data),sig=[137,80,78,71,13,10,26,10];if(b.length<33||sig.some((v,i)=>b[i]!==v))throw Error('정상적인 PNG 파일을 선택해주세요.');
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength),width=v.getUint32(16),height=v.getUint32(20);let frames=1;
 for(let at=8;at+12<=b.length;){const length=v.getUint32(at),end=at+12+length;if(end>b.length)throw Error('PNG 파일이 손상됐어요.');const type=String.fromCharCode(...b.subarray(at+4,at+8));if(type==='acTL'){if(length!==8)throw Error('PNG 프레임 정보가 잘못됐어요.');frames=v.getUint32(at+8);}at=end;if(type==='IEND')break;}
 return {width,height,frames};
}
function options(input={}){
 const mode=input.mode||'white',color=input.color||'#ffffff',files=input.files||['artwork.pdf','cutline.pdf','proof.pdf','metadata.json'];
 if(!['white','solid','full-bleed'].includes(mode))throw Error('배경 모드를 확인해주세요.');
 if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('배경색을 #RRGGBB로 입력해주세요.');
 if(input.colorSpace&&input.colorSpace!=='RGB')throw Error('CMYK 인쇄는 인쇄소 ICC 프로필에 맞춘 변환이 필요해요. 현재는 RGB 분리 파일을 제공해요.');
 if(!Array.isArray(files)||!files.length||files.some(f=>!NAMES.includes(f)))throw Error('전달할 파일을 하나 이상 골라주세요.');
 const spotName=String(input.spotName||'CutContour');
 if(!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(spotName))throw Error('칼선 별색 이름은 영문·숫자·밑줄·하이픈 40자 이내로 입력해주세요.');
 const cutlineWidthPt=Number(input.cutlineWidthPt??0.25);
 if(!Number.isFinite(cutlineWidthPt)||cutlineWidthPt<0.1||cutlineWidthPt>2)throw Error('칼선 굵기는 0.1~2pt로 입력해주세요.');
 return {templateId:SPEC.id,mode,color:color.toLowerCase(),colorSpace:'RGB',printerName:String(input.printerName||'견적용 기본 규격').slice(0,80),spotName,cutlineWidthPt,files:[...new Set(files)].sort()};
}
function placement(input){const o=options(input),size=o.mode==='full-bleed'?56:50;return {widthMM:size,heightMM:size,xMM:38-size/2,yMM:38-size/2,centerXMM:38,centerYMM:38};}
function validate(asset,input={}){
 const o=options(input),p=placement(o);
 if(!asset?.id||!asset.version)throw Error('확정 PNG의 자산 ID와 버전을 확인해주세요.');
 if(!Number.isInteger(asset.width)||asset.width<=0||asset.width!==asset.height)throw Error('정사각형 단일 프레임 PNG만 사용할 수 있어요.');
 if(asset.frames&&asset.frames!==1)throw Error('움직이는 PNG는 사용할 수 없어요. 단일 프레임 PNG를 선택해주세요.');
 if(asset.rgba&&asset.rgba.length!==asset.width*asset.height*4)throw Error('PNG 픽셀 정보가 올바르지 않아요.');
 const hasAlpha=asset.hasAlpha??(asset.rgba?asset.rgba.some((v,i)=>i%4===3&&v<255):false);
 if(o.mode==='solid'&&!hasAlpha)throw Error('단색 배경 모드는 투명 영역이 있는 PNG가 필요해요.');
 if(o.mode==='full-bleed'&&hasAlpha)throw Error('전체 배경 모드는 3mm 여분을 포함한 불투명 PNG가 필요해요.');
 const ppi=asset.width*25.4/p.widthMM,minPixels=Math.ceil(SPEC.minPPI*p.widthMM/25.4);
 if(ppi<SPEC.minPPI){const e=Error('해상도가 '+ppi.toFixed(1)+'ppi예요. '+p.widthMM+'mm 배치에는 최소 '+minPixels+'px, 300ppi 이상 PNG가 필요해요.');e.code='LOW_RESOLUTION';e.ppi=ppi;e.minPixels=minPixels;throw e;}
 return {options:o,placement:p,ppi,hasAlpha,minPixels};
}
function key(asset,input){return JSON.stringify([asset.id,asset.version,asset.width,asset.height,options(input)]);}
function layoutSVG(asset,input={},finished=false,guides=true){
 const o=options(input),p=placement(o);
 const clip='<clipPath id="cut50"><circle cx="38" cy="38" r="25"/></clipPath>';
 const bg=o.mode==='solid'?'<circle cx="38" cy="38" r="28" fill="'+o.color+'"/>':'';
 const image='<image href="'+esc(asset.png)+'" x="'+p.xMM+'" y="'+p.yMM+'" width="'+p.widthMM+'" height="'+p.heightMM+'" preserveAspectRatio="none"/>';
 const art='<g id="artwork"'+(finished||o.mode==='white'?' clip-path="url(#cut50)"':'')+'>'+bg+image+'</g>';
 const guide=guides?'<g id="guides" fill="none" stroke="#9d9d9d" stroke-width=".15" stroke-dasharray="1 1"><rect x="3" y="3" width="70" height="70"/></g><g id="cutline" fill="none" stroke="#ff00ff" stroke-width=".15"><circle cx="38" cy="38" r="25"/></g>':'';
 return '<svg xmlns="http://www.w3.org/2000/svg" width="76mm" height="76mm" viewBox="0 0 76 76"><defs>'+clip+'</defs><rect width="76" height="76" fill="white"/>'+art+guide+'</svg>';
}
function concat(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;}
function adler(data){let a=1,b=0;for(const v of data){a=(a+v)%65521;b=(b+a)%65521;}return (b<<16|a)>>>0;}
async function deflate(data){
 if(typeof CompressionStream!=='undefined'){const stream=new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));return new Uint8Array(await new Response(stream).arrayBuffer());}
 const parts=[new Uint8Array([0x78,0x01])];
 for(let at=0;at<data.length||at===0;at+=65535){const n=Math.min(65535,data.length-at),last=at+n>=data.length;parts.push(new Uint8Array([last?1:0,n&255,n>>>8,(~n)&255,((~n)>>>8)&255]),data.subarray(at,at+n));if(last)break;}
 const a=adler(data);parts.push(new Uint8Array([a>>>24,(a>>>16)&255,(a>>>8)&255,a&255]));return concat(parts);
}
function writer(){
 const objects=[];
 return {add(head,stream){objects.push({head,stream});return objects.length;},finish(){
 const parts=[bytes('%PDF-1.4\n%Gageon\n')],offsets=[0];let size=parts[0].length;
 for(let i=0;i<objects.length;i++){offsets.push(size);const o=objects[i],p=[bytes((i+1)+' 0 obj\n'+o.head+(o.stream?'\nstream\n':''))];if(o.stream)p.push(o.stream,bytes('\nendstream'));p.push(bytes('\nendobj\n'));for(const x of p){parts.push(x);size+=x.length;}}
 const xref=size;let tail='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';for(let i=1;i<offsets.length;i++)tail+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 tail+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';parts.push(bytes(tail));return concat(parts);
 }};
}
function circlePath(cx,cy,r){const k=.5522847498307936*r,n=num;return n(cx+r)+' '+n(cy)+' m '+n(cx+r)+' '+n(cy+k)+' '+n(cx+k)+' '+n(cy+r)+' '+n(cx)+' '+n(cy+r)+' c '+n(cx-k)+' '+n(cy+r)+' '+n(cx-r)+' '+n(cy+k)+' '+n(cx-r)+' '+n(cy)+' c '+n(cx-r)+' '+n(cy-k)+' '+n(cx-k)+' '+n(cy-r)+' '+n(cx)+' '+n(cy-r)+' c '+n(cx+k)+' '+n(cy-r)+' '+n(cx+r)+' '+n(cy-k)+' '+n(cx+r)+' '+n(cy)+' c h';}
function colorRGB(hex){return [1,3,5].map(i=>num(parseInt(hex.slice(i,i+2),16)/255)).join(' ');}
function artworkCommands(o,finished=false){
 const p=placement(o),clip=circlePath(pt(38),pt(38),pt(25)),bg=o.mode==='solid'?colorRGB(o.color)+' rg '+circlePath(pt(38),pt(38),pt(28))+' f\n':'';
 return 'q\n'+(finished||o.mode==='white'?clip+' W n\n':'')+bg+'q '+num(pt(p.widthMM))+' 0 0 '+num(pt(p.heightMM))+' '+num(pt(p.xMM))+' '+num(pt(p.yMM))+' cm /Im0 Do Q\nQ\n';
}
function cutCommands(o){return '/'+o.spotName+' CS 1 SCN '+o.cutlineWidthPt+' w '+circlePath(pt(38),pt(38),pt(25))+' S\n';}
async function pdf(asset,input,kind){
 const {options:o}=validate(asset,input),w=writer(),proof=kind==='proof',count=proof?2:1,includeImage=kind!=='cutline';
 w.add('<< /Type /Catalog /Pages 2 0 R >>');
 w.add('<< /Type /Pages /Kids ['+Array.from({length:count},(_,i)=>(3+i*2)+' 0 R').join(' ')+'] /Count '+count+' >>');
 const imageId=3+count*2,maskId=imageId+1,spotId=imageId+(includeImage?2:0);
 const cpath=circlePath(pt(38),pt(38),pt(25)),trim='[ '+[3,3,73,73].map(v=>num(pt(v))).join(' ')+' ]',media='[0 0 '+num(pt(76))+' '+num(pt(76))+']';
 for(let i=0;i<count;i++){
 const resources='<< '+(includeImage?'/XObject << /Im0 '+imageId+' 0 R >> ':'')+(kind!=='artwork'?'/ColorSpace << /'+o.spotName+' [/Separation /'+o.spotName+' /DeviceCMYK '+spotId+' 0 R] >> ':'')+'>>';
 const content=kind==='cutline'?cutCommands(o):artworkCommands(o,proof&&i===0)+(proof?cutCommands(o)+(i===1?'0.65 G .3 w [3 3] 0 d '+num(pt(3))+' '+num(pt(3))+' '+num(pt(70))+' '+num(pt(70))+' re S\n':''):'');
 const data=bytes(content),pageId=3+i*2;
 w.add('<< /Type /Page /Parent 2 0 R /MediaBox '+media+' /TrimBox '+trim+' /BleedBox '+media+' /Resources '+resources+' /Contents '+(pageId+1)+' 0 R >>');
 w.add('<< /Length '+data.length+' >>',data);
 }
 if(includeImage){
 const rgb=new Uint8Array(asset.width*asset.height*3),alpha=new Uint8Array(asset.width*asset.height);
 for(let i=0,j=0;i<asset.rgba.length;i+=4){rgb[j++]=asset.rgba[i];rgb[j++]=asset.rgba[i+1];rgb[j++]=asset.rgba[i+2];alpha[i/4]=asset.rgba[i+3];}
 const rgbData=await deflate(rgb),alphaData=await deflate(alpha);
 w.add('<< /Type /XObject /Subtype /Image /Width '+asset.width+' /Height '+asset.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask '+maskId+' 0 R /Length '+rgbData.length+' >>',rgbData);
 w.add('<< /Type /XObject /Subtype /Image /Width '+asset.width+' /Height '+asset.height+' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length '+alphaData.length+' >>',alphaData);
 }
 if(kind!=='artwork')w.add('<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [0 1 0 0] /N 1 >>');
 return w.finish();
}
async function build(asset,input={}){
 const info=validate(asset,input),o=info.options;if(!asset.rgba||!asset.png?.startsWith('data:image/png;base64,'))throw Error('PNG 원본과 픽셀 정보를 불러와주세요.');
 const metadata={schema:'gageon-print-job-v1',template:SPEC.id,asset:{id:asset.id,version:asset.version,width:asset.width,height:asset.height,frames:1},pageMM:[76,76],trimBoxMM:[3,3,73,73],cutline:{shape:'closed-circle',centerMM:[38,38],radiusMM:25,separateFile:'cutline.pdf',spotName:o.spotName,widthPt:o.cutlineWidthPt},background:{mode:o.mode,color:o.mode==='solid'?o.color:null,bleedMM:o.mode==='white'?0:3},placement:info.placement,ppi:info.ppi,minPPI:300,colorSpace:'RGB',printer:{name:o.printerName,requestedFiles:o.files},proofPages:2,approvalKey:key(asset,o),generatedAt:new Date().toISOString()};
 const [artwork,cutline,proof]=await Promise.all(['artwork','cutline','proof'].map(kind=>pdf(asset,o,kind)));
 return {key:key(asset,o),metadata,files:{'layout.svg':bytes(layoutSVG(asset,o)),'artwork.pdf':artwork,'cutline.pdf':cutline,'proof.pdf':proof,'metadata.json':bytes(JSON.stringify(metadata,null,2))}};
}
let crcTable;function crc32(data){crcTable||=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(files){const local=[],central=[];let offset=0,size=0;const u16=(v,a,n)=>v.setUint16(a,n,true),u32=(v,a,n)=>v.setUint32(a,n,true);
 for(const [name,data]of Object.entries(files)){const nameBytes=bytes(name),content=bytes(data),crc=crc32(content),header=new Uint8Array(30+nameBytes.length),v=new DataView(header.buffer);u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x800);u32(v,14,crc);u32(v,18,content.length);u32(v,22,content.length);u16(v,26,nameBytes.length);header.set(nameBytes,30);local.push(header,content);
 const ch=new Uint8Array(46+nameBytes.length),cv=new DataView(ch.buffer);u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x800);u32(cv,16,crc);u32(cv,20,content.length);u32(cv,24,content.length);u16(cv,28,nameBytes.length);u32(cv,42,offset);ch.set(nameBytes,46);central.push(ch);size+=ch.length;offset+=header.length+content.length;
 }const end=new Uint8Array(22),v=new DataView(end.buffer),n=central.length;u32(v,0,0x06054b50);u16(v,8,n);u16(v,10,n);u32(v,12,size);u32(v,16,offset);return concat([...local,...central,end]);}
return {SPEC,NAMES,pngInfo,options,placement,validate,key,layoutSVG,pdf,build,zip,crc32,circlePath};
});
