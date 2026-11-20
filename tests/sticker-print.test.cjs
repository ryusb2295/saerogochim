const test=require('node:test');
const assert=require('node:assert/strict');
const {inflateSync}=require('node:zlib');
const C=require('../sticker-print-core.js');
const {makeAsset,pngChunk}=require('./helpers/print-fixture.cjs');
const asset=makeAsset(),opaque=makeAsset(900,false);
function pageBox(text,key){return text.match(new RegExp('/'+key+' \\[\\s*([^\\]]+)\\]'))[1].trim().split(/\s+/).map(Number);}
function streams(bytes){const b=Buffer.from(bytes),text=b.toString('latin1'),parts=[];const re=/(\d+) 0 obj\n([\s\S]*?)\nstream\n/g;let m;while((m=re.exec(text))){const len=Number(m[2].match(/\/Length (\d+)/)[1]),data=b.subarray(re.lastIndex,re.lastIndex+len);parts.push({head:m[2],data:m[2].includes('/FlateDecode')?inflateSync(data):data});re.lastIndex+=len;}return parts;}
test('50mm template keeps the specified page, trim and common artwork/cutline center',()=>{
 assert.deepEqual(C.placement({mode:'white'}),{widthMM:50,heightMM:50,xMM:13,yMM:13,centerXMM:38,centerYMM:38});
 assert.equal(C.placement({mode:'full-bleed'}).xMM,10);
 assert.equal(C.placement({mode:'full-bleed'}).widthMM,56);
});
test('300ppi thresholds reject 590px at 50mm and 661px at 56mm before export',()=>{
 assert.throws(()=>C.validate({...asset,width:590,height:590,rgba:null},{mode:'white'}),e=>e.code==='LOW_RESOLUTION'&&e.minPixels===591);
 assert.ok(C.validate({...asset,width:591,height:591,rgba:null},{mode:'white'}).ppi>=300);
 assert.throws(()=>C.validate({...opaque,width:661,height:661,rgba:null},{mode:'full-bleed'}),e=>e.code==='LOW_RESOLUTION'&&e.minPixels===662);
 assert.ok(C.validate({...opaque,width:662,height:662,rgba:null},{mode:'full-bleed'}).ppi>=300);
});
test('input rejects nonsquare, animated, nontransparent solid, transparent full-bleed and unconverted CMYK',()=>{
 assert.throws(()=>C.validate({...asset,height:800}),/정사각형/);
 assert.throws(()=>C.validate({...asset,frames:2}),/단일 프레임/);
 assert.throws(()=>C.validate(opaque,{mode:'solid'}),/투명/);
 assert.throws(()=>C.validate(asset,{mode:'full-bleed'}),/불투명/);
 assert.throws(()=>C.validate(asset,{colorSpace:'CMYK'}),/ICC/);
});
test('PNG header inspection checks dimensions and animation frame count',()=>{
 assert.deepEqual(C.pngInfo(asset.pngBytes),{width:900,height:900,frames:1});
 const frames=Buffer.alloc(8);frames.writeUInt32BE(2);
 const animated=Buffer.concat([asset.pngBytes.subarray(0,33),pngChunk('acTL',frames),asset.pngBytes.subarray(33)]);
 assert.equal(C.pngInfo(animated).frames,2);
 assert.throws(()=>C.pngInfo(new Uint8Array(40)),/PNG/);
});
test('both proof slots reuse the exact PNG at the same physical size',()=>{
 const left=C.layoutSVG(asset,{mode:'solid',color:'#f2cc77'},true),right=C.layoutSVG(asset,{mode:'solid',color:'#f2cc77'},false);
 const image=/<image [^>]+\/>/;assert.equal(left.match(image)[0],right.match(image)[0]);assert.match(left,/width="76mm" height="76mm"/);assert.match(left,/x="13" y="13" width="50" height="50"/);
 assert.match(left,/artwork" clip-path/);assert.match(right,/r="28" fill="#f2cc77"/);
 const full=C.layoutSVG(opaque,{mode:'full-bleed'},false);assert.match(full,/x="10" y="10" width="56" height="56"/);
});
test('artwork PDF measures 76mm with 70mm TrimBox and contains no cutline',async()=>{
 const pdf=await C.pdf(asset,{mode:'solid',color:'#f2cc77'},'artwork'),s=Buffer.from(pdf).toString('latin1'),factor=25.4/72;
 const media=pageBox(s,'MediaBox').map(x=>x*factor),trim=pageBox(s,'TrimBox').map(x=>x*factor);
 assert.ok(Math.abs(media[2]-76)<.00001);assert.ok(Math.abs(media[3]-76)<.00001);
 assert.ok(Math.abs(trim[0]-3)<.00001);assert.ok(Math.abs(trim[2]-73)<.00001);
 assert.doesNotMatch(s,/CutContour|\/Separation/);
 const parts=streams(pdf),rgb=parts.find(x=>x.head.includes('/DeviceRGB')).data,alpha=parts.find(x=>x.head.includes('/DeviceGray')).data;
 assert.equal(rgb.length,900*900*3);assert.equal(alpha.length,900*900);assert.equal(alpha[0],0);assert.equal(alpha[450*900+450],255);
});
test('cutline PDF is a closed vector circle without a raster image',async()=>{
 const pdf=await C.pdf(asset,{},'cutline'),s=Buffer.from(pdf).toString('latin1');assert.doesNotMatch(s,/\/Subtype \/Image|\/XObject/);assert.match(s,/\/Separation \/CutContour \/DeviceCMYK/);
 assert.match(streams(pdf)[0].data.toString(),/ c h S/);
 const path=C.circlePath(38*72/25.4,38*72/25.4,25*72/25.4);assert.ok(streams(pdf)[0].data.toString().includes(path));
});
test('proof PDF has two 76mm pages sharing one embedded source image',async()=>{
 const pdf=await C.pdf(asset,{mode:'white'},'proof'),s=Buffer.from(pdf).toString('latin1');assert.match(s,/\/Count 2/);
 assert.equal((s.match(/\/Subtype \/Image/g)||[]).length,2); // RGB image + its alpha mask, reused on both pages.
 assert.equal((s.match(/\/MediaBox/g)||[]).length,2);assert.equal((s.match(/\/Im0 7 0 R/g)||[]).length,2);
});
test('version, background, printer files and spot options invalidate the approval key',()=>{
 const key=C.key(asset,{});assert.notEqual(key,C.key({...asset,version:'next'},{}));assert.notEqual(key,C.key(asset,{mode:'solid'}));assert.notEqual(key,C.key(asset,{files:['artwork.pdf']}));assert.notEqual(key,C.key(asset,{spotName:'DieCut'}));
});
test('file bundle contains five outputs, physical metadata and valid PDF byte offsets',async()=>{
 const built=await C.build(asset,{mode:'solid',color:'#f2cc77'});assert.deepEqual(Object.keys(built.files),C.NAMES);assert.equal(built.metadata.ppi,457.2);assert.equal(built.metadata.asset.version,asset.version);assert.equal(built.metadata.cutline.radiusMM,25);
 for(const name of ['artwork.pdf','cutline.pdf','proof.pdf']){const b=Buffer.from(built.files[name]),s=b.toString('latin1'),xref=Number(s.match(/startxref\n(\d+)/)[1]);assert.equal(b.subarray(xref,xref+4).toString(),'xref');const lines=s.slice(xref).split('\n'),count=Number(lines[1].split(' ')[1]);for(let i=1;i<count;i++){const at=Number(lines[i+2].slice(0,10));assert.equal(b.subarray(at,at+String(i).length+6).toString(),i+' 0 obj');}}
});
test('delivery ZIP includes only requested files with correct CRC and byte lengths',async()=>{
 const built=await C.build(asset,{}),selected={'artwork.pdf':built.files['artwork.pdf'],'cutline.pdf':built.files['cutline.pdf']},zip=Buffer.from(C.zip(selected));let at=0,found=[];
 while(zip.readUInt32LE(at)===0x04034b50){const size=zip.readUInt32LE(at+18),n=zip.readUInt16LE(at+26),name=zip.subarray(at+30,at+30+n).toString(),body=zip.subarray(at+30+n,at+30+n+size);assert.equal(C.crc32(body),zip.readUInt32LE(at+14));found.push(name);at+=30+n+size;}
 assert.deepEqual(found,Object.keys(selected));assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
});
