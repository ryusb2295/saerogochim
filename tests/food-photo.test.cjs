const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function fixture(){
 const context=vm.createContext({console,setTimeout,clearTimeout,addEventListener(){},AbortSignal,
  document:{querySelector(){return null},querySelectorAll(){return []}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../sticker-editor.js'),'utf8'),context);
 const code=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').split("['gesturestart','gesturechange']")[0];
 vm.runInContext(code,context);
 vm.runInContext("render=()=>{};saveDraft=()=>{};toast=()=>{};state={...initial(),name:'음식점',industry:'분식',foodPhotos:[{image:'photo-A'},{image:'photo-B'},{image:'photo-C'}]};",context);
 return code=>vm.runInContext(code,context);
}
test('photo selection becomes the sticker image and survives serialization',()=>{
 const run=fixture();run('applyFoodPhoto(1)');
 assert.equal(run('state.customImage'),'photo-B');
 assert.equal(run('state.generated'),false);
 assert.equal(run('hasFoodPhoto()'),true);
 run('state=JSON.parse(JSON.stringify(state))');
 assert.equal(run('selectedFoodPhoto().image'),'photo-B');
 assert.match(run('stickerSVG()'),/photo-B/);
});
test('each thumbnail has an accessible X button; deleting preserves the right selected image',()=>{
 const run=fixture();run('applyFoodPhoto(1)');
 assert.equal((run('refThumbs()').match(/class="ref-remove"/g)||[]).length,3);
 run('removeFoodPhoto(0)');assert.equal(run('state.customImage'),'photo-B');
 run('removeFoodPhoto(0)');assert.equal(run('state.customImage'),'photo-C');
 run('removeFoodPhoto(0)');assert.equal(run('hasFoodPhoto()'),false);assert.equal(run('state.customImage'),null);
});
test('photo mode never invokes mascot generation or spends generation tokens',async()=>{
 const run=fixture();run("applyFoodPhoto(0);globalThis.generationCalls=0;globalThis.Commerce={generate(){generationCalls++;throw Error('must not run')}}");
 assert.equal(await run('generateAI()'),false);assert.equal(run('generationCalls'),0);
});
test('cutout failure and stale backend responses keep the original food photo',async()=>{
 const run=fixture();run("applyFoodPhoto(0);aiReady=true;globalThis.Commerce={generate:async action=>action(),P:{costs:{generate:30}}};aiCall=async()=>({image:'data:image/png;base64,bWFzY290'});");
 assert.equal(await run('cutoutFoodPhoto()'),false);
 assert.equal(run('state.customImage'),'photo-A');assert.equal(run('foodProcessing'),false);
 assert.match(run('genError'),/원본/);
});
test('successful food cutout keeps an original and cannot become a mascot',async()=>{
 const run=fixture();run("applyFoodPhoto(0);aiReady=true;globalThis.Commerce={generate:async action=>action()};aiCall=async(kind,brief)=>{globalThis.requested=brief;return {image_mode:'food',image:'data:image/png;base64,Zm9vZA=='}};shrinkImage=async image=>image;");
 assert.equal(await run('cutoutFoodPhoto()'),true);
 assert.equal(run('requested.image_mode'),'food');assert.equal(run('requested.source_image'),'photo-A');
 assert.equal(run('selectedFoodPhoto().image'),'photo-A');
 assert.equal(run('state.customImage'),'data:image/png;base64,Zm9vZA==');
 assert.equal(run('state.generated'),false);
});
