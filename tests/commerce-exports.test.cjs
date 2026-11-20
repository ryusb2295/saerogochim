const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ GAGEON_PRICING: require('../pricing.js'), TextEncoder });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../commerce-exports.js'), 'utf8'), context);

for (const circle of [true, false]) test(`PDF has valid byte offsets and a separate cutline (${circle ? 'circle' : 'rounded rectangle'})`, () => {
  // The writer treats image bytes as an opaque JPEG stream; offsets must count bytes.
  const bytes = vm.runInContext(`CommerceExports.pdfBytes(new Uint8Array([255,216,255,217]),1600,1600,${circle})`, context);
  const data = Buffer.from(bytes), text = data.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.match(text, /\/Separation \/CutContour \/DeviceCMYK/);
  assert.match(text, /\/Width 1600 \/Height 1600/);
  assert.match(text, /\/Filter \/DCTDecode \/Length 4/);
  const xref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(data.subarray(xref, xref + 4).toString(), 'xref');
  const lines = text.slice(xref).split('\n');
  for (let i = 1; i <= 6; i++) {
    const offset = Number(lines[2 + i].slice(0, 10));
    assert.equal(data.subarray(offset, offset + `${i} 0 obj`.length).toString(), `${i} 0 obj`);
  }
});
