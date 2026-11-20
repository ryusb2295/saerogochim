const {deflateSync}=require('node:zlib');
const {createHash}=require('node:crypto');
const C=require('../../sticker-print-core.js');
function pngChunk(type,data){const name=Buffer.from(type),body=Buffer.concat([name,data]),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);body.copy(out,4);out.writeUInt32BE(C.crc32(body),out.length-4);return out;}
function makeAsset(size=900,transparent=true){
 const rgba=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,inside=Math.hypot(x-size/2,y-size/2)<size*.34;rgba[i]=inside?(x<size/2?242:70):230;rgba[i+1]=inside?(y<size/2?165:90):240;rgba[i+2]=inside?70:250;rgba[i+3]=inside||!transparent?255:0;}
 const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 const rows=Buffer.alloc(size*(size*4+1));for(let y=0;y<size;y++)Buffer.from(rgba.buffer,y*size*4,size*4).copy(rows,y*(size*4+1)+1);
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(rows)),pngChunk('IEND',Buffer.alloc(0))]);
 return {id:'fixture-900',version:createHash('sha256').update(png).digest('hex'),width:size,height:size,frames:1,hasAlpha:transparent,rgba,png:'data:image/png;base64,'+png.toString('base64'),pngBytes:png};
}
module.exports={makeAsset,pngChunk};
