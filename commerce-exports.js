'use strict';
const CommerceExports = (() => {
  const P = GAGEON_PRICING;
  const name = (s, suffix) => (s.name || '우리 가게').replace(/[<>:"/\\|?*]/g, '_') + '_' + suffix;
  function saveFile(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function couponSVG(s) {
    const t = brandTheme(s), title = s.couponText || '쿠폰 혜택을 입력해주세요', face = fontFace(fontOf(s), (s.name || '') + title + 'COUPON');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="640" viewBox="0 0 1080 640"><rect width="1080" height="640" rx="40" fill="${t.bg}"/>${face}<rect x="28" y="28" width="1024" height="584" rx="30" fill="none" stroke="${t.accent}" stroke-width="3" stroke-dasharray="10 10"/><image href="${esc(s.customImage || svgUri(assets[typeOf(s)] || ''))}" x="60" y="100" width="360" height="400"/><g ${fontAttr(face && fontOf(s))} fill="${t.ink}"><text x="470" y="160" font-size="42">${esc(s.name)}</text><text x="470" y="245" font-size="60">COUPON</text>${wrapText(title, 12, 3).map((line, i) => `<text x="470" y="350" dy="${i * 60}" font-size="42">${esc(line)}</text>`).join('')}</g></svg>`;
  }
  function menuSVG(s) {
    const t = brandTheme(s), items = String(s.menuItems || '대표 메뉴|가격\n추천 메뉴|가격\n인기 메뉴|가격').split('\n').filter(Boolean).slice(0, 6).map(x => x.split('|'));
    const face = fontFace(fontOf(s), (s.name || '') + items.flat().join('') + 'MENU');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440"><rect width="1080" height="1440" fill="${t.bg}"/>${face}<image href="${esc(s.customImage || svgUri(assets[typeOf(s)] || ''))}" x="410" y="60" width="260" height="280"/><g ${fontAttr(face && fontOf(s))} fill="${t.ink}"><text x="540" y="430" text-anchor="middle" font-size="64">${esc(s.name)}</text><text x="540" y="515" text-anchor="middle" font-size="40">MENU</text>${items.map(([label, price = ''], i) => `<text x="100" y="${680 + i * 100}" font-size="40">${esc(label.slice(0, 16))}</text><text x="980" y="${680 + i * 100}" text-anchor="end" font-size="36">${esc(price.slice(0, 12))}</text>`).join('')}</g></svg>`;
  }
  async function canvasOf(svg, width, height) {
    const image = await loadImg(svgUri(svg)), c = document.createElement('canvas'); c.width = width; c.height = height;
    c.getContext('2d').drawImage(image, 0, 0, width, height); return c;
  }
  function cutSVG(s) {
    const cut = s.shape === 'circle' ? '<circle cx="400" cy="400" r="390"/>' : '<rect x="10" y="10" width="780" height="780" rx="60"/>';
    return stickerSVG(s).replace('width="800" height="800"', `width="${P.print.pageMM}mm" height="${P.print.pageMM}mm"`).replace('</svg>', `<g id="CutContour" data-layer="cutline" fill="none" stroke="#ff00ff" stroke-width="1">${cut}</g></svg>`);
  }
  // Single-page PDF with a high-resolution image and a named spot-color cutline.
  // Source images remain RGB; a print shop should confirm CMYK/bleed before production.
  function pdfBytes(jpeg, width, height, circle) {
    const page = P.print.pageMM * 72 / 25.4, inset = page * 10 / 800, edge = page - inset, r = page * 390 / 800, c = page / 2, k = .5522847498;
    const contour = circle ? `${c + r} ${c} m ${c + r} ${c + k * r} ${c + k * r} ${c + r} ${c} ${c + r} c ${c - k * r} ${c + r} ${c - r} ${c + k * r} ${c - r} ${c} c ${c - r} ${c - k * r} ${c - k * r} ${c - r} ${c} ${c - r} c ${c + k * r} ${c - r} ${c + r} ${c - k * r} ${c + r} ${c} c h S` : (() => {
      const radius = page * 60 / 800, b = inset, e = edge, d = radius * k;
      return `${b + radius} ${b} m ${e - radius} ${b} l ${e - radius + d} ${b} ${e} ${b + radius - d} ${e} ${b + radius} c ${e} ${e - radius} l ${e} ${e - radius + d} ${e - radius + d} ${e} ${e - radius} ${e} c ${b + radius} ${e} l ${b + radius - d} ${e} ${b} ${e - radius + d} ${b} ${e - radius} c ${b} ${b + radius} l ${b} ${b + radius - d} ${b + radius - d} ${b} ${b + radius} ${b} c h S`;
    })();
    const content = `q ${page} 0 0 ${page} 0 0 cm /Im0 Do Q\n/CutContour CS 1 SCN ${P.print.cutlineWidth} w ${contour}\n`;
    const encoder = new TextEncoder(), parts = [], offsets = [0]; let length = 0;
    const add = x => { const bytes = typeof x === 'string' ? encoder.encode(x) : x; parts.push(bytes); length += bytes.length; };
    const obj = (n, head, stream) => { offsets[n] = length; add(`${n} 0 obj\n${head}`); if (stream) { add('\nstream\n'); add(stream); add('\nendstream'); } add('\nendobj\n'); };
    add('%PDF-1.4\n'); obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page} ${page}] /Resources << /XObject << /Im0 4 0 R >> /ColorSpace << /CutContour [/Separation /CutContour /DeviceCMYK 6 0 R] >> >> /Contents 5 0 R >>`);
    obj(4, `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
    obj(5, `<< /Length ${encoder.encode(content).length} >>`, encoder.encode(content));
    obj(6, '<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [0 1 0 0] /N 1 >>');
    const xref = length; add('xref\n0 7\n0000000000 65535 f \n'); for (let i = 1; i <= 6; i++) add(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    add(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const output = new Uint8Array(length); let at = 0; for (const b of parts) { output.set(b, at); at += b.length; } return output;
  }
  async function download(kind, s = state) {
    const build = () => kind === 'coupon' ? couponSVG(s) : kind === 'menu' ? menuSVG(s) : stickerSVG(s);
    build(); await document.fonts.ready; await fontsReady();
    if (kind === 'svg') { saveFile(new Blob([cutSVG(s)], { type: 'image/svg+xml' }), name(s, '칼선.svg')); return; }
    if (kind === 'character') {
      const src = s.customImage || svgUri(assets[typeOf(s)] || ''), img = await loadImg(src), blob = await toBlob(img, P.print.pixels, false, 'image/png');
      saveFile(blob, name(s, '캐릭터.png')); return;
    }
    const width = kind === 'pdf' ? P.print.pixels : 1080, height = kind === 'coupon' ? 640 : kind === 'menu' ? 1440 : width;
    const canvas = await canvasOf(build(), width, height);
    if (kind === 'pdf') {
      const white = document.createElement('canvas'); white.width = white.height = width; const ctx = white.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, width); ctx.drawImage(canvas, 0, 0);
      const blob = await new Promise(r => white.toBlob(r, 'image/jpeg', .95)); if (!blob) throw Error('PDF 이미지를 만들지 못했어요.');
      saveFile(new Blob([pdfBytes(new Uint8Array(await blob.arrayBuffer()), width, height, s.shape === 'circle')], { type: 'application/pdf' }), name(s, '칼선.pdf'));
    } else {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png')); if (!blob) throw Error('이미지를 만들지 못했어요.');
      saveFile(blob, name(s, kind === 'menu' ? '메뉴판.png' : '쿠폰.png'));
    }
    toast('파일을 만들었어요. 다운로드를 확인해주세요.');
  }
  return { download, pdfBytes, cutSVG, menuSVG, couponSVG };
})();
