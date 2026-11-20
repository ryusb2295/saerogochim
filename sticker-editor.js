'use strict';

// Shared by the live SVG, saved designs, packaging previews and PNG exports.
const StickerEditor = (() => {
  const layers = { character: '캐릭터', name: '상호명', message: '문구' };
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const finite = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const layoutKey = s => s.layout || 'basic';
  function placement(s, layer) {
    const p = s.stickerEdits?.[layoutKey(s)]?.[layer] || {};
    return { x: clamp(finite(p.x, 0), -650, 650), y: clamp(finite(p.y, 0), -650, 650), scale: clamp(finite(p.scale, 1), .4, 1.8), rotation: clamp(finite(p.rotation, 0), -180, 180) };
  }
  function update(s, layer, patch) {
    if (!Object.hasOwn(layers, layer)) return;
    const key = layoutKey(s);
    s.stickerEdits = { ...s.stickerEdits, [key]: { ...s.stickerEdits?.[key], [layer]: { ...placement(s, layer), ...patch } } };
    s.stickerEdits[key][layer] = placement(s, layer);
  }
  function transform(s, layer, cx, cy) {
    const p = placement(s, layer);
    return `translate(${p.x} ${p.y}) translate(${cx} ${cy}) rotate(${p.rotation}) scale(${p.scale}) translate(${-cx} ${-cy})`;
  }
  function wrap(s, layer, content, cx, cy) {
    return `<g data-sticker-layer="${layer}" data-cx="${cx}" data-cy="${cy}" transform="${transform(s, layer, cx, cy)}">${content}</g>`;
  }
  function hexToHSV(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = !d ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
  }
  function hsvToHex(h, s, v) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); v = clamp(v, 0, 1);
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + rgb.map(n => Math.round((n + m) * 255).toString(16).padStart(2, '0')).join('');
  }
  // One in-page picker: saturation/brightness, hue and HEX stay in sync.
  function colorMarkup(hex) {
    const c = hexToHSV(hex);
    return `<div class="brand-color-picker unified-color-picker">
      <div id="color-sv" class="color-sv" role="group" tabindex="0" aria-label="채도와 밝기, 좌우 방향키로 채도, 위아래 방향키로 밝기 조절" style="--picker-hue:hsl(${c.h} 100% 50%)">
        <span id="color-cursor" class="color-cursor" style="left:${c.s * 100}%;top:${(1 - c.v) * 100}%"></span>
      </div>
      <label class="hue-label" for="brand-color-hue">색조</label><input id="brand-color-hue" class="color-hue" type="range" min="0" max="359" step="1" value="${Math.round(c.h)}" aria-label="색조">
      <div class="color-code-row"><span id="brand-color-sample" class="color-sample" style="background:${hex}" aria-hidden="true"></span><div class="brand-color-code"><label for="brand-color-hex">색상 코드</label><input id="brand-color-hex" type="text" value="${hex.toUpperCase()}" placeholder="#3B82F6" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="brand-color-error"></div></div>
      <p class="field-error" id="brand-color-error" role="alert" hidden>색상 코드를 #3B82F6처럼 입력해 주세요.</p>
    </div>`;
  }
  function bindColor(container, current, apply) {
    const sv = container.querySelector('#color-sv'), hue = container.querySelector('#brand-color-hue'), code = container.querySelector('#brand-color-hex');
    if (!sv || !hue || !code) return;
    const error = container.querySelector('#brand-color-error');
    let hsv = hexToHSV(current), pointer = null;
    const paint = (hex, writeCode = true) => {
      sv.style.setProperty('--picker-hue', `hsl(${hsv.h} 100% 50%)`);
      const cursor = container.querySelector('#color-cursor');
      cursor.style.left = hsv.s * 100 + '%'; cursor.style.top = (1 - hsv.v) * 100 + '%';
      hue.value = Math.round(hsv.h); if (writeCode) code.value = hex.toUpperCase();
      container.querySelector('#brand-color-sample').style.background = hex;
      sv.setAttribute('aria-label', `채도 ${Math.round(hsv.s * 100)}%, 밝기 ${Math.round(hsv.v * 100)}%. 좌우 방향키로 채도, 위아래 방향키로 밝기 조절`);
      code.removeAttribute('aria-invalid'); error.hidden = true; apply(hex);
    };
    const point = e => {
      const r = sv.getBoundingClientRect();
      if (!r.width || !r.height) return;
      hsv.s = clamp((e.clientX - r.left) / r.width, 0, 1); hsv.v = 1 - clamp((e.clientY - r.top) / r.height, 0, 1);
      paint(hsvToHex(hsv.h, hsv.s, hsv.v));
    };
    sv.onpointerdown = e => { if (e.button !== 0 || pointer !== null) return; e.preventDefault(); pointer = e.pointerId; sv.setPointerCapture(pointer); sv.focus({ preventScroll: true }); point(e); };
    sv.onpointermove = e => { if (pointer === e.pointerId) point(e); };
    sv.onpointerup = sv.onpointercancel = e => { if (pointer === e.pointerId) { pointer = null; if (sv.hasPointerCapture(e.pointerId)) sv.releasePointerCapture(e.pointerId); } };
    sv.onlostpointercapture = () => { pointer = null; };
    sv.onkeydown = e => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault(); const n = e.shiftKey ? .1 : .01;
      hsv.s = clamp(hsv.s + (e.key === 'ArrowRight' ? n : e.key === 'ArrowLeft' ? -n : 0), 0, 1);
      hsv.v = clamp(hsv.v + (e.key === 'ArrowUp' ? n : e.key === 'ArrowDown' ? -n : 0), 0, 1);
      paint(hsvToHex(hsv.h, hsv.s, hsv.v));
    };
    hue.oninput = () => { hsv.h = Number(hue.value); paint(hsvToHex(hsv.h, hsv.s, hsv.v)); };
    const valid = hex => /^#[\da-f]{6}$/i.test(hex);
    const read = () => '#' + code.value.trim().replace(/^#/, '').toLowerCase();
    code.oninput = () => { const hex = read(); if (valid(hex)) { hsv = hexToHSV(hex); paint(hex, false); } };
    code.onblur = () => { const hex = read(); if (valid(hex)) code.value = hex.toUpperCase(); else { code.setAttribute('aria-invalid', 'true'); error.hidden = false; } };
    code.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); code.blur(); } };
    container.querySelectorAll('[data-rec-hex]').forEach(b => b.onclick = () => { hsv = hexToHSV(b.dataset.recHex); paint(b.dataset.recHex); });
  }
  let active = 'character';
  function controls(appearance = '') {
    return `<div class="sticker-tools"><div class="sticker-layer-buttons" role="group" aria-label="편집할 요소">${Object.entries(layers).map(([key, label]) => `<button type="button" data-edit-layer="${key}" aria-pressed="false">${label}</button>`).join('')}</div>
      <div class="range-row"><label for="layer-scale">선택 요소 크기</label><input id="layer-scale" type="range" min="40" max="180" value="100"><output id="layer-scale-value" for="layer-scale">100%</output></div>
      <div class="range-row"><label for="layer-rotation">회전</label><input id="layer-rotation" type="range" min="-180" max="180" value="0"><output id="layer-rotation-value" for="layer-rotation">0°</output></div>
      ${appearance}
      <div class="sticker-reset"><button type="button" class="text-button" id="reset-layer">선택 요소 초기화</button><button type="button" class="text-button" id="reset-sticker">이 배치 전체 초기화</button></div>
      <p class="help" id="sticker-selection" role="status" aria-live="polite"></p></div>`;
  }
  function bindCanvas(container, getState, refresh, save, editText) {
    const canvas = container.querySelector('#sticker-canvas');
    if (!canvas) return;
    let drag = null;
    const svg = () => canvas.querySelector('svg');
    const group = key => canvas.querySelector(`[data-sticker-layer="${key}"]`);
    const paintSelection = () => {
      if (!group(active)) active = 'character';
      canvas.querySelectorAll('[data-sticker-layer]').forEach(g => g.classList.toggle('is-selected', g.dataset.stickerLayer === active));
      container.querySelectorAll('[data-edit-layer]').forEach(b => { const key = b.dataset.editLayer; b.disabled = !group(key); b.setAttribute('aria-pressed', String(key === active)); });
      const p = placement(getState(), active), scale = container.querySelector('#layer-scale'), rotation = container.querySelector('#layer-rotation');
      scale.value = Math.round(p.scale * 100); rotation.value = p.rotation;
      container.querySelector('#layer-scale-value').textContent = scale.value + '%';
      container.querySelector('#layer-rotation-value').textContent = rotation.value + '°';
      container.querySelector('#sticker-selection').textContent = layers[active] + ' 선택됨';
    };
    const paintTransform = () => { const g = group(active); if (g) g.setAttribute('transform', transform(getState(), active, Number(g.dataset.cx), Number(g.dataset.cy))); };
    const select = key => { active = key; paintSelection(); };
    const point = e => { const matrix = svg()?.getScreenCTM(); if (!matrix) return null; const p = svg().createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(matrix.inverse()); };
    const commit = () => { refresh(); save(); paintSelection(); };
    canvas.onpointerdown = e => {
      const g = e.target.closest('[data-sticker-layer]');
      if (!g || e.button !== 0 || drag) return;
      const p = point(e); if (!p) return;
      e.preventDefault(); select(g.dataset.stickerLayer); canvas.focus({ preventScroll: true });
      drag = { id: e.pointerId, point: p, clientX: e.clientX, clientY: e.clientY, moved: false, layer: active, start: placement(getState(), active) }; canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointermove = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = point(e); if (!p) return;
      if(!drag.moved&&Math.hypot(e.clientX-drag.clientX,e.clientY-drag.clientY)<6)return;drag.moved=true;
      update(getState(), active, { x: drag.start.x + p.x - drag.point.x, y: drag.start.y + p.y - drag.point.y }); paintTransform();
    };
    const finish = e => { if (!drag || e.pointerId !== drag.id) return; const gesture=drag;drag = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); if(gesture.moved)commit();else if(e.type==='pointerup'&&['name','message'].includes(gesture.layer))editText?.(gesture.layer); };
    canvas.onpointerup = canvas.onpointercancel = finish;
    canvas.onlostpointercapture = () => { if (drag) { drag = null; commit(); } };
    canvas.ondblclick = null;
    canvas.onkeydown = e => {
      if(e.key==='Enter'&&['name','message'].includes(active)){e.preventDefault();editText?.(active);return}
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || !group(active)) return;
      e.preventDefault(); const n = e.shiftKey ? 10 : 2, p = placement(getState(), active);
      update(getState(), active, { x: p.x + (e.key === 'ArrowRight' ? n : e.key === 'ArrowLeft' ? -n : 0), y: p.y + (e.key === 'ArrowDown' ? n : e.key === 'ArrowUp' ? -n : 0) }); commit();
    };
    container.querySelectorAll('[data-edit-layer]').forEach(b => b.onclick = () => { select(b.dataset.editLayer); canvas.focus({ preventScroll: true }); });
    container.querySelector('#layer-scale').oninput = e => { update(getState(), active, { scale: Number(e.target.value) / 100 }); commit(); };
    container.querySelector('#layer-rotation').oninput = e => { update(getState(), active, { rotation: Number(e.target.value) }); commit(); };
    container.querySelector('#reset-layer').onclick = () => { update(getState(), active, { x: 0, y: 0, scale: 1, rotation: 0 }); commit(); };
    container.querySelector('#reset-sticker').onclick = () => { getState().stickerEdits = { ...getState().stickerEdits, [layoutKey(getState())]: {} }; commit(); };
    canvas.addEventListener('stickerrefresh', paintSelection);
    paintSelection();
  }
  function bindFonts(container) {
    const track = container.querySelector('#font-choices'); if (!track) return;
    const buttons = [...track.querySelectorAll('[data-field="font"]')];
    const paint = () => { const end = track.scrollWidth - track.clientWidth; container.querySelector('#font-prev').disabled = track.scrollLeft <= 2; container.querySelector('#font-next').disabled = track.scrollLeft >= end - 2; };
    const move = direction => { track.scrollBy({ left: direction * track.clientWidth * .85, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); };
    container.querySelector('#font-prev').onclick = () => move(-1); container.querySelector('#font-next').onclick = () => move(1);
    track.onscroll = paint;
    track.onkeydown = e => { const i = buttons.indexOf(e.target); if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : clamp(i + (e.key === 'ArrowRight' ? 1 : -1), 0, buttons.length - 1); buttons[next].focus(); };
    const selected = buttons.find(b => b.getAttribute('aria-pressed') === 'true');
    if (selected) track.scrollLeft = Math.max(0, selected.offsetLeft - track.offsetLeft - (track.clientWidth - selected.offsetWidth) / 2);
    paint();
  }
  return { placement, update, transform, wrap, hexToHSV, hsvToHex, colorMarkup, bindColor, controls, bindCanvas, bindFonts };
})();
