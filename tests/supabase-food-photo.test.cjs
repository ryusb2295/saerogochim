const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
function fixture(){
 const calls=[];
 const context=vm.createContext({FormData,Blob,AbortSignal,Uint8Array,DataView,atob,Response,
  Deno:{env:{get(){return undefined}}},fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({data:[{b64_json:png}]}))}});
 const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/ai/index.ts'),'utf8').replace(/^import .*;$/m,'').split('Deno.serve(')[0];
 vm.runInContext(stripTypeScriptTypes(source),context);
 return {calls,run:code=>vm.runInContext(code,context)};
}
test('Edge validates food photos before invoking paid image work',()=>{
 const f=fixture();
 assert.equal(f.run("validate({name:'가게',industry:'분식',image_mode:'food',source_image:'https://example.com/food.png'})"),null);
 assert.equal(f.run("validate({name:'가게',industry:'분식',image_mode:'food',source_image:'data:image/png;base64,bm9wZQ=='})"),null);
 assert.equal(f.run(`validate({name:'가게',industry:'분식',image_mode:'food',source_image:'data:image/png;base64,${png}'}).image_mode`),'food');
});
test('Edge food edit uses uploaded pixels with no mascot style references',async()=>{
 const f=fixture();const result=await f.run(`image(validate({name:'가게',industry:'분식',image_mode:'food',source_image:'data:image/png;base64,${png}'}),'test-key')`);
 assert.equal(f.calls.length,1);const call=f.calls[0];
 assert.match(call.url,/images\/edits$/);assert.match(call.options.body.get('prompt'),/Remove the background/);
 assert.doesNotMatch(call.options.body.get('prompt'),/Create ONE original brand mascot/);
 assert.equal(call.options.body.getAll('image[]').length,1);
 assert.equal(call.options.body.get('image[]').name,'food.png');assert.equal(result.image_mode,'food');
});
