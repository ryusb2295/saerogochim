const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const context = vm.createContext({ setTimeout, clearTimeout, addEventListener() {} });
vm.runInContext(fs.readFileSync(path.join(root, 'sticker-editor.js'), 'utf8'), context);
// Load the application definitions without starting browser/network side effects.
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8').split("['gesturestart','gesturechange']")[0];
vm.runInContext(app, context);
const run = source => vm.runInContext(source, context);

test('all four recommended colors become the exact sticker background', () => {
  for (let i = 0; i < 4; i++) {
    const color = run(`brandTheme({...initial(),brand:{colors:['#664633','#ba4a2b','#e6a55b','#fff4df']},recommendedColor:${i}}).bg`);
    assert.equal(color, ['#664633', '#ba4a2b', '#e6a55b', '#fff4df'][i]);
  }
  assert.equal(run("brandTheme({...initial(),customColor:'#123456',recommendedColor:0}).bg"), '#123456');
  assert.equal(run("brandTheme({...initial(),brand:{colors:['broken']},recommendedColor:0}).bg"), '#fff4df');
});

test('old saved presets and readable foreground colors remain supported', () => {
  assert.equal(run('brandTheme({...initial(),theme:2}).bg'), '#e7eedc');
  assert.equal(run("brandTheme({...initial(),customColor:'#000000'}).ink"), '#ffffff');
  assert.equal(run("brandTheme({...initial(),customColor:'#ffffff'}).ink"), '#000000');
});

test('picker preserves colors through HSV conversion including grayscale', () => {
  for (const hex of ['#664633', '#ba4a2b', '#000000', '#ffffff', '#808080', '#a5b7c7', '#00ff88']) {
    assert.equal(run(`(()=>{const {h,s,v}=StickerEditor.hexToHSV('${hex}');return StickerEditor.hsvToHex(h,s,v)})()`), hex);
  }
});

test('all sticker layouts preserve moved layers after serialization', () => {
  for (const layout of ['basic', 'arc', 'big', 'band', 'char']) {
    const result = JSON.parse(run(`JSON.stringify((()=>{
      const s={...initial(),layout:'${layout}',font:'',name:'달빛분식',message:'감사합니다'};
      StickerEditor.update(s,'character',{x:120,y:-80,scale:1.3,rotation:15});
      const restored=JSON.parse(JSON.stringify(s));
      return {svg:stickerSVG(restored),placement:StickerEditor.placement(restored,'character'),pack:packSVG(restored)};
    })())`));
    assert.deepEqual(result.placement, { x: 120, y: -80, scale: 1.3, rotation: 15 });
    assert.match(result.svg, /translate\(120 -80\).*rotate\(15\) scale\(1.3\)/);
    assert.match(result.pack, /translate\(120%20-80\)/);
    assert.doesNotMatch(result.svg, /is-selected|NaN|undefined/);
    assert.equal((result.svg.match(/data-sticker-layer=/g) || []).length, layout === 'char' ? 1 : 3);
  }
});

test('layout placement is isolated and corrupt values are bounded', () => {
  const result = JSON.parse(run(`JSON.stringify((()=>{const s={};StickerEditor.update(s,'name',{x:100,y:30});s.layout='arc';const arc=StickerEditor.placement(s,'name');StickerEditor.update(s,'name',{x:9999,scale:99,rotation:999,y:'oops'});return {arc,bounded:StickerEditor.placement(s,'name')}})())`));
  assert.deepEqual(result.arc, { x: 0, y: 0, scale: 1, rotation: 0 });
  assert.deepEqual(result.bounded, { x: 650, y: 0, scale: 1.8, rotation: 180 });
});

test('12 unique fonts and single picker are available', () => {
  assert.equal(run('STICKER_FONTS.length'), 12);
  assert.equal(run('new Set(STICKER_FONTS.map(f=>f[0])).size'), 12);
  assert.equal((run('customColorPicker()').match(/id="color-sv"/g) || []).length, 1);
  assert.doesNotMatch(run('customColorPicker()'), /type="color"/);
});
