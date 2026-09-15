'use strict';

// Keyboard and mouse layer for the Studio preview. Studio/InputOverlayRenderer.cs draws the same thing into clips,
// so keep the two in step when changing the look.
const InputOverlay = (() => {
  // US QWERTY positions in key units: vk -> [x, y, width, label]
  const K = {};
  const row = (codes, x0, y, labels) => codes.forEach((c, i) => { K[c] = [x0 + i, y, 1, labels[i]]; });
  row([0xC0, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x30], 0, 0, '`1234567890'.split(''));
  row([0x51, 0x57, 0x45, 0x52, 0x54, 0x59, 0x55, 0x49, 0x4F, 0x50], 1.5, 1, 'QWERTYUIOP'.split(''));
  row([0x41, 0x53, 0x44, 0x46, 0x47, 0x48, 0x4A, 0x4B, 0x4C], 1.75, 2, 'ASDFGHJKL'.split(''));
  row([0x5A, 0x58, 0x43, 0x56, 0x42, 0x4E, 0x4D], 2.25, 3, 'ZXCVBNM'.split(''));
  Object.assign(K, {
    0x09: [0, 1, 1.5, 'Tab'], 0x14: [0, 2, 1.75, 'Caps'], 0x10: [0, 3, 2.25, 'Shift'],
    0x11: [0, 4, 1.5, 'Ctrl'], 0x12: [2.5, 4, 1.25, 'Alt'], 0x20: [3.75, 4, 4.5, 'Space'],
  });
  for (let i = 1; i <= 12; i++) K[0x6F + i] = [i - 1 + (i > 4 ? 0.5 : 0) + (i > 8 ? 0.5 : 0), -1.2, 1, `F${i}`];

  const NAMES = {
    0x08: 'Bksp', 0x0D: 'Enter', 0x1B: 'Esc', 0x21: 'PgUp', 0x22: 'PgDn', 0x23: 'End', 0x24: 'Home',
    0x25: '←', 0x26: '↑', 0x27: '→', 0x28: '↓', 0x2D: 'Ins', 0x2E: 'Del',
    0xBA: ';', 0xBB: '=', 0xBC: ',', 0xBD: '-', 0xBE: '.', 0xBF: '/', 0xDB: '[', 0xDC: '\\', 0xDD: ']', 0xDE: "'",
  };
  for (let i = 0; i <= 9; i++) NAMES[0x60 + i] = `Num${i}`;

  /** Short label for a virtual key code. */
  const keyName = (code) => K[code]?.[3] ?? NAMES[code] ?? (code >= 0x30 && code <= 0x5A ? String.fromCharCode(code) : `#${code}`);

  const INK = '#0a0a0a', PAPER = '#f4f4f4';

  function keyCodes(layer, presets) {
    const codes = new Set(layer.extraKeys || []);
    for (const p of presets) if ((layer.presets || []).includes(p.id)) p.keys.forEach((k) => codes.add(k));
    return [...codes].sort((a, b) => a - b);
  }

  /** Keys laid out like a real keyboard, plus the mouse. Units are key widths. */
  function layout(layer, presets) {
    const keys = [];
    if (layer.showKeys) {
      let extraX = 0;
      for (const c of keyCodes(layer, presets)) {
        if (K[c]) keys.push({ code: c, x: K[c][0], y: K[c][1], w: K[c][2], label: K[c][3] });
        else keys.push({ code: c, x: extraX++, y: 5.2, w: 1, label: keyName(c) });
      }
    }
    let minX = 0, minY = 0, width = 0, height = 0;
    if (keys.length) {
      minX = Math.min(...keys.map((k) => k.x));
      minY = Math.min(...keys.map((k) => k.y));
      keys.forEach((k) => { k.x -= minX; k.y -= minY; });
      width = Math.max(...keys.map((k) => k.x + k.w));
      height = Math.max(...keys.map((k) => k.y + 1));
    }
    let mouse = null;
    if (layer.showMouse) {
      const mx = keys.length ? width + 0.45 : 0;
      width = mx + 1.9;
      const my = keys.length ? Math.max(0, (Math.max(height, 2.9) - 2.9) / 2) : 0;
      height = Math.max(height, 2.9);
      mouse = { x: mx, y: my, w: 1.9, h: 2.9 };
    }
    return { keys, mouse, width: Math.max(width, 0.01), height: Math.max(height, 0.01) };
  }

  /** Width divided by height of the drawing, so a layer can keep its proportions. */
  function aspect(layer, presets) {
    if (layer.style === 'cat') return 5.6 / 3.7;
    const L = layout(layer, presets);
    return L.width / L.height;
  }

  const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); };

  function drawKeys(ctx, L, st, u) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const k of L.keys) {
      const on = st.keys.has(k.code);
      const pad = u * 0.07, x = k.x * u + pad, y = k.y * u + pad + (on ? u * 0.03 : 0), w = k.w * u - pad * 2, h = u - pad * 2;
      roundRect(ctx, x, y, w, h, u * 0.18);
      ctx.fillStyle = on ? PAPER : 'rgba(10,10,10,0.62)';
      ctx.fill();
      ctx.lineWidth = Math.max(1, u * 0.045);
      ctx.strokeStyle = on ? PAPER : 'rgba(244,244,244,0.55)';
      ctx.stroke();
      ctx.fillStyle = on ? INK : PAPER;
      ctx.font = `600 ${Math.max(1, u * (k.label.length > 2 ? 0.27 : 0.38))}px "Segoe UI Variable Text","Segoe UI",sans-serif`;
      ctx.fillText(k.label, x + w / 2, y + h / 2 + u * 0.01);
    }
    if (L.mouse) drawMouse(ctx, L.mouse, st, u);
  }

  function drawMouse(ctx, m, st, u) {
    const x = m.x * u, y = m.y * u, w = m.w * u, h = m.h * u, lw = Math.max(1, u * 0.045);
    const body = () => roundRect(ctx, x + lw, y + lw, w - lw * 2, h - lw * 2, w * 0.48);
    body();
    ctx.fillStyle = 'rgba(10,10,10,0.62)';
    ctx.fill();
    const split = y + h * 0.4;
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = PAPER;
    if (st.buttons.has(1)) ctx.fillRect(x, y, w / 2, split - y);
    if (st.buttons.has(2)) ctx.fillRect(x + w / 2, y, w / 2, split - y);
    ctx.restore();
    ctx.strokeStyle = 'rgba(244,244,244,0.55)';
    ctx.lineWidth = lw;
    body();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + lw, split); ctx.lineTo(x + w - lw, split);
    ctx.moveTo(x + w / 2, y + lw); ctx.lineTo(x + w / 2, split);
    ctx.stroke();
    roundRect(ctx, x + w / 2 - u * 0.1, y + h * 0.14, u * 0.2, h * 0.16, u * 0.1);
    ctx.fillStyle = st.buttons.has(3) || st.wheel ? PAPER : 'rgba(244,244,244,0.35)';
    ctx.fill();
    if (st.wheel) {
      const ax = x + w / 2, ay = st.wheel > 0 ? y - u * 0.12 : y + h * 0.36;
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.moveTo(ax - u * 0.14, ay); ctx.lineTo(ax + u * 0.14, ay); ctx.lineTo(ax, ay + (st.wheel > 0 ? -u * 0.16 : u * 0.16));
      ctx.fill();
    }
    // A dot that swings toward where the mouse is moving
    const mag = Math.hypot(st.vx, st.vy);
    const k = mag > 0 ? Math.min(1, mag / 160) / mag : 0;
    ctx.beginPath();
    ctx.arc(x + w / 2 + st.vx * k * w * 0.28, y + h * 0.68 + st.vy * k * h * 0.16, u * 0.11, 0, Math.PI * 2);
    ctx.fillStyle = mag > 3 ? PAPER : 'rgba(244,244,244,0.35)';
    ctx.fill();
  }

  /** Line art cat: the left paw taps keys, the right paw rides the mouse. Drawn in a 200 unit wide box. */
  function drawCat(ctx, st, t) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const shape = (path) => { ctx.beginPath(); path(); };
    const inkThenPaper = (path) => {
      shape(path); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke();
      shape(path); ctx.fillStyle = PAPER; ctx.fill();
    };
    const mag = Math.hypot(st.vx, st.vy);
    const mk = mag > 0 ? Math.min(1, mag / 160) / mag : 0;
    const mx = 152 + st.vx * mk * 14, my = 110 + st.vy * mk * 4;

    inkThenPaper(() => {
      ctx.ellipse(100, 104, 60, 38, 0, Math.PI, 0);
      ctx.closePath();
      ctx.moveTo(134, 58); ctx.arc(100, 58, 34, 0, Math.PI * 2);
      ctx.moveTo(72, 44); ctx.lineTo(76, 16); ctx.lineTo(96, 30); ctx.closePath();
      ctx.moveTo(128, 44); ctx.lineTo(124, 16); ctx.lineTo(104, 30); ctx.closePath();
    });
    ctx.fillStyle = INK;
    if (t % 3700 < 120) { ctx.fillRect(84, 57, 9, 3); ctx.fillRect(107, 57, 9, 3); }
    else { shape(() => { ctx.arc(88.5, 58, 4, 0, Math.PI * 2); ctx.moveTo(115.5, 58); ctx.arc(111.5, 58, 4, 0, Math.PI * 2); }); ctx.fill(); }
    shape(() => { ctx.moveTo(93, 69); ctx.quadraticCurveTo(96.5, 73, 100, 69); ctx.quadraticCurveTo(103.5, 73, 107, 69); });
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();

    shape(() => { ctx.moveTo(4, 118); ctx.lineTo(196, 118); });
    ctx.lineWidth = 4.5; ctx.strokeStyle = PAPER; ctx.stroke();
    inkThenPaper(() => ctx.roundRect(18, 106, 78, 14, 4));
    ctx.fillStyle = INK;
    for (let i = 0; i < 6; i++) ctx.fillRect(24 + i * 11.5, 111, 7, 3);
    inkThenPaper(() => ctx.ellipse(mx, my, 15, 9, 0, 0, Math.PI * 2));
    if (mag > 25) {
      const dir = Math.sign(st.vx) || 1;
      shape(() => { ctx.moveTo(mx - dir * 24, my - 6); ctx.lineTo(mx - dir * 34, my - 6); ctx.moveTo(mx - dir * 24, my + 2); ctx.lineTo(mx - dir * 32, my + 2); });
      ctx.strokeStyle = PAPER; ctx.lineWidth = 3; ctx.stroke();
    }
    inkThenPaper(() => ctx.ellipse(58, st.keys.size > 0 ? 104 : 86, 13, 9, -0.2, 0, Math.PI * 2));
    inkThenPaper(() => ctx.ellipse(mx - 2, my - (st.buttons.size > 0 ? 5 : 10), 13, 9, 0.2, 0, Math.PI * 2));
  }

  /** Draws the layer into a w by h pixel area starting at (0, 0). */
  function draw(ctx, layer, presets, st, w, h, t) {
    ctx.save();
    ctx.translate(2, 2);
    if (layer.style === 'cat') {
      const u = Math.min((w - 4) / 5.6, (h - 4) / 3.7);
      const s = (u * 5.6) / 200;
      ctx.scale(s, s);
      drawCat(ctx, layer.showKeys ? st : { ...st, keys: new Set() }, t);
    } else {
      const L = layout(layer, presets);
      drawKeys(ctx, L, st, Math.min((w - 4) / L.width, (h - 4) / L.height));
    }
    ctx.restore();
  }

  const idle = () => ({ keys: new Set(), buttons: new Set(), wheel: 0, vx: 0, vy: 0 });

  return { draw, aspect, keyName, idle };
})();

window.InputOverlay = InputOverlay;
