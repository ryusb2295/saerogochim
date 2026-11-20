const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function edge(){
 const calls=[];
 const ctx=vm.createContext({FormData,Blob,AbortSignal,Uint8Array,DataView,atob,Response,
 Deno:{env:{get(){return undefined}}},fetch:async(url,options)=>{calls.push({url,options});return url.includes('/assets/')?new Response(new Uint8Array([137,80,78,71])):new Response(JSON.stringify({data:[{b64_json:png}]}));}});
 const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/ai/index.ts'),'utf8').replace(/^import .*;$/m,'').split('Deno.serve(')[0];
 vm.runInContext(stripTypeScriptTypes(source),ctx);
 return {calls,run:code=>vm.runInContext(code,ctx)};
}
test('Edge rejects invalid texture before paid generation',()=>{
 const f=edge();for(const value of [null,[],{},42,'unknown','__proto__','toString']){
 assert.equal(f.run(`validate({name:'가게',industry:'분식',texture:${JSON.stringify(value)}})`),null);
 }
});
test('all six textures reach image provider with the supplied sheet',async()=>{
 for(const texture of ['flat','clay','watercolor','crayon','felt','pencil','auto']){
 const f=edge();const result=await f.run(`image(validate({name:'가게',industry:'분식',texture:'${texture}'}),'test-key')`);
 assert.equal(f.calls.length,2);assert.match(f.calls[0].url,/assets\/textures\/texture-sheet.png$/);
 const body=f.calls[1].options.body;
 assert.equal(body.getAll('image[]').length,1);assert.equal(body.get('image[]').name,'texture-sheet.png');
 assert.match(body.get('prompt'),/Never copy the ant/);assert.equal(result.texture,texture);
 if(texture==='auto')assert.match(body.get('prompt'),/Choose exactly ONE/);
 }
});
test('food photos keep original image processing even when texture is selected',async()=>{
 const f=edge();const result=await f.run(`image(validate({name:'가게',industry:'분식',texture:'felt',image_mode:'food',source_image:'data:image/png;base64,${png}'}),'test-key')`);
 assert.equal(f.calls.length,1);const body=f.calls[0].options.body;
 assert.match(body.get('prompt'),/Remove the background/);assert.doesNotMatch(body.get('prompt'),/Surface texture/);
 assert.equal(body.get('image[]').name,'food.png');assert.equal(result.image_mode,'food');assert.equal(result.texture,undefined);
});
test('preference UI and request preserve selected texture and show six examples',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
 const start=source.indexOf('const TEXTURES ='),end=source.indexOf('function confirmHTML()',start);
 const context=vm.createContext({state:{texture:'clay'},icon:()=>'',hasFoodPhoto:()=>false});
 vm.runInContext(source.slice(start,end),context);
 const html=vm.runInContext('textureChoices()',context);
 assert.equal((html.match(/class="texture-card/g)||[]).length,6);
 assert.match(html,/texture-card selected" data-texture="clay" aria-pressed="true"/);
 assert.match(html,/클레이/);assert.match(html,/말랑한 점토/);
 const fn=source.match(/function buildBrandRequest\(\)\{[^\n]+/)[0];
 const ctx=vm.createContext({state:{name:'가게',industry:'분식',mood:'귀여운',audience:'가족',feature:'',texture:'clay',style:'duck'}});
 vm.runInContext(fn,ctx);assert.equal(vm.runInContext('buildBrandRequest().texture',ctx),'clay');
});
