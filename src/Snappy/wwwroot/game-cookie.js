// Cookie Snapper: click the big cookie, buy buildings that bake for you, catch golden cookies, and pop the Lag's
// minions before they nibble the bank empty. A thousand cookies baked and it's done. (Where the cookies came from is
// between her and her deep scan.)
(() => {
  const { vector: her, programEye, text, PAL } = Arcade;
  const W = 480, H = 270, GOAL = 1000, TAU = Math.PI * 2;
  // three columns, like the real thing: the bakery, the buildings, the store
  const LEFT = 170, MID = 176, STORE = 332;
  const CX = 85, CY = 150, R = 50;
  const SHOP = [
    { id: 'cursor', name: 'Extra Cursor', cost: 15, rate: 1, quote: "Clicks the cookie so you don't have to. It doesn't get tired. It doesn't get paid." },
    { id: 'snappy', name: 'Second Snappy', cost: 60, rate: 4, quote: 'Another one of her. The Program has concerns.', hired: 'Hi, me!' },
    { id: 'program', name: 'The Program Bakes', cost: 200, rate: 15, quote: 'It bakes. Reluctantly. It would like that noted.', hired: '"I am doing this under protest."' },
    { id: 'factory', name: 'Cookie Factory', cost: 500, rate: 45, quote: 'Where the cookies come from. Do not ask what goes in.', hired: 'Production has begun. Questions have not.' },
  ];
  const NEWS = [
    'Local camera opens bakery. Program "deeply concerned".',
    "Cookies found in user's browser. Nobody knows how they got there.",
    'Scientists confirm cookies are not, in fact, clips.',
    'Program files formal complaint about having to bake.',
    'Minion spotted near cookie. Says it was "just looking".',
    'Cookie factory output up 400%. Ingredients classified.',
    'Grandmas reportedly furious about the competition.',
    'Study finds clicking a cookie is "not a real job". Study has been clicked.',
    'Second Snappy hired. First Snappy thrilled. Program outnumbered.',
  ];
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  const seeded = (n) => () => ((n = (n * 16807) % 2147483647) / 2147483647);

  // A cookie, baked once into its own little canvas: bumpy edge, golden brown, cracks, chocolate chips with a shine.
  function bake(r, res, gold = false) {
    const rand = seeded(gold ? 77 : 1234), span = r * 2.3, size = Math.ceil(span * res);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.scale(size / span, size / span);
    g.translate(span / 2, span / 2);
    const edge = new Path2D();
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU, d = r * (1 + (rand() - 0.5) * 0.06);
      if (i) edge.lineTo(Math.cos(a) * d, Math.sin(a) * d); else edge.moveTo(d, 0);
    }
    edge.closePath();
    g.shadowColor = 'rgba(0, 0, 0, .45)'; g.shadowBlur = r * 0.16 * res; g.shadowOffsetY = r * 0.05 * res;
    const tones = gold ? ['#fff3b0', '#f2c230', '#b07a00'] : ['#f0c48a', '#d39a5c', '#a5683a'];
    const dough = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.05);
    dough.addColorStop(0, tones[0]); dough.addColorStop(0.6, tones[1]); dough.addColorStop(1, tones[2]);
    g.fillStyle = dough; g.fill(edge);
    g.shadowColor = 'transparent';
    g.lineWidth = r * 0.035; g.strokeStyle = gold ? '#8a5e00' : '#7a4a22'; g.stroke(edge);
    g.save();
    g.clip(edge);
    for (let i = 0; i < 90; i++) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * r * 0.95;
      g.fillStyle = gold ? 'rgba(160, 100, 0, .25)' : 'rgba(110, 60, 20, .22)';
      g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * (0.01 + rand() * 0.025), r * (0.008 + rand() * 0.015), rand() * TAU, 0, TAU); g.fill();
    }
    g.strokeStyle = gold ? 'rgba(150, 95, 0, .35)' : 'rgba(110, 60, 25, .35)'; g.lineWidth = r * 0.02;
    for (let i = 0; i < 5; i++) {
      const a = rand() * TAU, d = r * (0.3 + rand() * 0.5);
      let x = Math.cos(a) * d, y = Math.sin(a) * d;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) { x += (rand() - 0.5) * r * 0.25; y += (rand() - 0.5) * r * 0.25; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rand() * 0.5, d = i ? r * (0.35 + rand() * 0.45) : 0, cr = r * (0.09 + rand() * 0.06);
      const x = Math.cos(a) * d, y = Math.sin(a) * d, chip = new Path2D();
      for (let k = 0; k < 7; k++) {
        const b = (k / 7) * TAU, q = cr * (0.75 + rand() * 0.45);
        if (k) chip.lineTo(x + Math.cos(b) * q, y + Math.sin(b) * q); else chip.moveTo(x + q, y);
      }
      chip.closePath();
      g.fillStyle = gold ? '#b8860b' : '#4a2814'; g.fill(chip);
      g.fillStyle = gold ? 'rgba(255, 240, 180, .5)' : 'rgba(150, 95, 60, .55)';
      g.beginPath(); g.ellipse(x - cr * 0.3, y - cr * 0.35, cr * 0.35, cr * 0.22, -0.6, 0, TAU); g.fill();
    }
    const shine = g.createRadialGradient(-r * 0.45, -r * 0.5, 0, -r * 0.45, -r * 0.5, r * 0.9);
    shine.addColorStop(0, 'rgba(255, 255, 255, .22)'); shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = shine; g.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
    g.restore();
    return c;
  }
  const put = (g, img, x, y, r, k = 1, rot = 0) => {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.drawImage(img, -r * 1.15 * k, -r * 1.15 * k, r * 2.3 * k, r * 2.3 * k);
    g.restore();
  };

  // the slow-turning light behind a cookie
  function rays(g, x, y, r, t, alpha = 0.3) {
    g.save();
    g.translate(x, y);
    g.rotate(t / 6000);
    const glow = g.createRadialGradient(0, 0, r * 0.25, 0, 0, r);
    glow.addColorStop(0, `rgba(255, 245, 210, ${alpha})`); glow.addColorStop(1, 'rgba(255, 245, 210, 0)');
    g.fillStyle = glow;
    for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, (i / 12) * TAU, (i / 12) * TAU + 0.17); g.closePath(); g.fill(); }
    g.globalAlpha = 0.6;
    g.beginPath(); g.arc(0, 0, r * 0.8, 0, TAU); g.fill();
    g.restore();
  }

  // the blue room with its faint diagonal light, and the wooden planks between the columns
  function backdrop(g, x0, x1) {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#26507a'); bg.addColorStop(1, '#0f2238');
    g.fillStyle = bg; g.fillRect(x0, 0, x1 - x0, H);
    g.fillStyle = 'rgba(255, 255, 255, .025)';
    for (let x = x0 - H; x < x1; x += 28) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.lineTo(x + H + 12, 0); g.lineTo(x + 12, H); g.fill(); }
  }
  function plank(g, x, w) {
    const wood = g.createLinearGradient(x, 0, x + w, 0);
    wood.addColorStop(0, '#2b1a0e'); wood.addColorStop(0.5, '#8a5a32'); wood.addColorStop(1, '#2b1a0e');
    g.fillStyle = wood; g.fillRect(x, 0, w, H);
  }

  // a mouse pointer, tip first
  function pointer(g, x, y, angle, s = 0.7) {
    g.save();
    g.translate(x, y); g.rotate(angle); g.scale(s, s);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 14); g.lineTo(3.5, 10.5); g.lineTo(6, 16); g.lineTo(8.2, 15); g.lineTo(5.8, 9.6); g.lineTo(10, 9.6); g.closePath();
    g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#000'; g.lineJoin = 'round'; g.stroke();
    g.restore();
  }

  // a little factory with a smoking chimney
  function factory(g, x, y, t, s = 1) {
    g.save();
    g.translate(x, y); g.scale(s, s);
    for (let k = 0; k < 3; k++) {
      const p = (t / 1400 + k / 3) % 1;
      g.fillStyle = `rgba(220, 224, 230, ${(1 - p) * 0.55})`;
      g.beginPath(); g.arc(7 + p * 6, -14 - p * 22, 2 + p * 5, 0, TAU); g.fill();
    }
    g.fillStyle = '#3d424a'; g.fillRect(4, -14, 5, 12);
    g.fillStyle = '#6b7280'; g.beginPath(); g.moveTo(-12, 10); g.lineTo(-12, -4); g.lineTo(-6, -9); g.lineTo(-6, -4); g.lineTo(0, -9); g.lineTo(0, -4);
    g.lineTo(6, -9); g.lineTo(12, -4); g.lineTo(12, 10); g.closePath(); g.fill();
    g.fillStyle = '#ffd36b';
    for (const wx of [-8, -2, 4]) g.fillRect(wx, 0, 4, 4);
    g.fillStyle = '#2b2f36'; g.fillRect(-3, 4, 5, 6);
    g.restore();
  }

  // one of the Lag's minions, here as a nibbler: it crawls to the cookie, latches on and eats from the bank
  function nibbler(g, m, t) {
    const x = CX + Math.cos(m.a) * m.d, y = CY + Math.sin(m.a) * m.d;
    g.save();
    g.translate(x, y);
    g.rotate(m.a - Math.PI / 2);
    const wob = m.latched ? 1 + Math.sin(t / 110 + m.a * 3) * 0.08 : 1 + Math.sin(t / 70) * 0.04;
    g.scale(wob * (m.size || 1), (2 - wob) * (m.size || 1));
    const skin = g.createLinearGradient(0, -12, 0, 18);
    skin.addColorStop(0, '#ff7d8c'); skin.addColorStop(1, '#a63148');
    g.fillStyle = skin; g.strokeStyle = '#5a1426'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(0, 4, 10, 14, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#3a0c18'; g.beginPath(); g.ellipse(0, -8, 5, 3, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 4, 5, 0, TAU); g.fill();
    g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(Math.cos(t / 150) * 2, 4 + Math.sin(t / 150) * 2, 2.2, 0, TAU); g.fill();
    // stuck pixels flickering on it
    g.fillStyle = PAL.minion;
    for (let i = 0; i < 2; i++) g.fillRect(-9 + ((t / 90 + i * 7) % 16), 10 + i * 4, 2.5, 2.5);
    g.restore();
  }

  function wrap(g, s, x, y, width, lh) {
    let line = '';
    for (const word of s.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > width && line) { g.fillText(line, x, y); y += lh; line = word; } else line = next;
    }
    if (line) g.fillText(line, x, y);
  }

  async function cookies(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    await S('{shine}Cookie Snapper! {pause}Remember the cookies I grabbed during my deep scan?', { hold: 300 });
    await P('You did not grab any cookies.', { hold: 500 });
    await S('{wink}Then where did THESE come from?', { hold: 400 });
    await P('...I do not want to know.', { hold: 600 });
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g, canvas } = scr;
    const res = canvas.width / W;
    const big = bake(R, res * 1.1), crumb = bake(6, res * 1.4), gold = bake(14, res * 1.2, true);
    const titleCard = (t) => {
      backdrop(g, 0, W);
      rays(g, W / 2, H * 0.6, 120, t, 0.35);
      put(g, big, W / 2, H * 0.6, R, 1.1 + Math.sin(t / 500) * 0.02);
      her(g, W / 2 + 92, H * 0.6 + 44, 40, { eyes: 'happy', legs: 0 });
      text(g, 'Cookie Snapper', W / 2, 50, { font: 'serif', size: 34, align: 'center', shadow: 'rgba(0, 0, 0, .6)' });
      text(g, `Bake ${fmt(GOAL)} cookies`, W / 2, 72, { font: 'serif', size: 12, align: 'center', color: PAL.gold, shadow: 'rgba(0, 0, 0, .6)' });
      if (Math.floor(t / 600) % 2) text(g, 'Click anywhere to start', W / 2, H - 12, { font: 'serif', size: 10, align: 'center', shadow: 'rgba(0, 0, 0, .6)' });
    };
    if (!(await scr.title('COOKIE SNAPPER', '', 'CLICK THE COOKIE · BUY BUILDINGS · POP THE MINIONS', titleCard))) await abandon(scr);
    const stop = music('bakery', 5280);
    const owned = Object.fromEntries(SHOP.map((s) => [s.id, 0]));
    const cost = (s) => Math.round(s.cost * 1.15 ** owned[s.id]);
    const rate = () => SHOP.reduce((n, s) => n + s.rate * owned[s.id], 0);
    const pops = [], bits = [], minions = [], notes = [];
    const note = (title, body) => { notes.length = 0; notes.push({ title, body, t: performance.now() }); };
    const begun = performance.now();
    let pile = 0, total = 0, k = 1, golden = null, frenzy = 0, news = 0, popped = 0;
    let nextMinion = begun + 20000, nextGold = begun + 24000 + Math.random() * 12000;
    let last = begun;

    // one frame of the whole bakery
    const draw = (t, r) => {
      const hover = { x: scr.mouse.x, y: scr.mouse.y };
      backdrop(g, 0, LEFT);
      for (const b of bits) if (b.fall) put(g, crumb, b.x, b.y, b.r, 1, b.rot);
      rays(g, CX, CY, R * 1.9, t, frenzy > t ? 0.5 : 0.3);
      // the milk rises as the cookies add up
      const milk = H - (10 + 44 * Math.min(1, total / GOAL));
      g.fillStyle = 'rgba(246, 243, 236, .93)';
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= LEFT; x += 6) g.lineTo(x, milk + Math.sin(x / 14 + t / 500) * 2);
      g.lineTo(LEFT, H); g.fill();
      put(g, big, CX, CY, R, k);
      const n = Math.min(owned.cursor, 36);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * TAU + t / 24000, poke = (t / 90 + j * 9) % 40 < 4 ? 4 : 0;
        pointer(g, CX + Math.cos(a) * (R + 12 - poke), CY + Math.sin(a) * (R + 12 - poke), a - Math.PI / 2);
      }
      for (const m of minions) nibbler(g, m, t);
      for (const b of bits) if (!b.fall) put(g, crumb, b.x, b.y, b.r, 1, b.rot);
      for (const p of pops) {
        const age = (t - p.t) / 1000;
        g.globalAlpha = Math.max(0, 1 - age);
        text(g, p.text, p.x, p.y - age * 32, { font: 'serif', size: 11, align: 'center', color: p.color || '#fff', shadow: 'rgba(0, 0, 0, .5)' });
        g.globalAlpha = 1;
      }
      // the name and the count
      text(g, "Snappy's bakery", CX, 16, { font: 'serif', size: 10, align: 'center', shadow: 'rgba(0, 0, 0, .6)' });
      g.fillStyle = 'rgba(0, 0, 0, .4)'; g.fillRect(0, 24, LEFT, 38);
      text(g, `${fmt(pile)} cookies`, CX, 45, { font: 'serif', size: 17, align: 'center', shadow: 'rgba(0, 0, 0, .7)' });
      text(g, `per second: ${(r * (frenzy > t ? 7 : 1)).toFixed(r < 10 ? 1 : 0)}`, CX, 57, { font: 'serif', size: 8.5, align: 'center',
        color: frenzy > t ? PAL.gold : '#fff', bold: false, shadow: 'rgba(0, 0, 0, .7)' });

      // the buildings, a row for each kind you own
      backdrop(g, MID, STORE);
      g.fillStyle = 'rgba(0, 0, 0, .55)'; g.fillRect(MID, 0, STORE - MID, 24);
      g.globalAlpha = Math.min(1, ((t - begun) % 7000) / 400, (7000 - ((t - begun) % 7000)) / 400);
      g.font = 'italic 8px Georgia, serif'; g.fillStyle = '#e8dcc0'; g.textAlign = 'left';
      wrap(g, `News : ${NEWS[news % NEWS.length]}`, MID + 6, 10, STORE - MID - 12, 9);
      g.globalAlpha = 1;
      let row = 0;
      for (const id of ['snappy', 'program', 'factory']) {
        const count = Math.min(owned[id], 6);
        if (!count) continue;
        const y = 26 + row++ * 80, rw = STORE - MID;
        if (id === 'snappy') {
          g.fillStyle = '#f3d3d9'; g.fillRect(MID, y, rw, 78);
          g.fillStyle = 'rgba(255, 255, 255, .7)';
          for (let x = MID; x < STORE; x += 12) g.fillRect(x, y, 1, 60);
          for (let yy = y; yy < y + 60; yy += 12) g.fillRect(MID, yy, rw, 1);
          g.fillStyle = '#c99aa5'; g.fillRect(MID, y + 60, rw, 18);
          for (let j = 0; j < count; j++) {
            const px = MID + 14 + j * 23 + Math.sin(t / 700 + j * 1.7) * 4;
            her(g, px, y + 50 - Math.abs(Math.sin(t / 180 + j)) * 3, 18, { legs: Math.floor(t / 180 + j), facing: Math.cos(t / 700 + j * 1.7) > 0 ? 1 : -1,
              eyes: (Math.floor(t / 1300) + j) % 5 ? 'open' : 'happy' });
          }
        } else if (id === 'program') {
          g.fillStyle = '#0d151b'; g.fillRect(MID, y, rw, 78);
          g.fillStyle = 'rgba(110, 215, 255, .07)';
          for (let x = MID; x < STORE; x += 10) g.fillRect(x, y, 1, 78);
          for (let yy = y; yy < y + 78; yy += 10) g.fillRect(MID, yy, rw, 1);
          for (let j = 0; j < count; j++) {
            const px = MID + 14 + j * 23;
            programEye(g, px, y + 40, 9, { look: Math.sin(t / 900 + j) });
            put(g, crumb, px, y + 60, 6);
            if (Math.floor(t / 2600) % count === j && t % 2600 < 1400) text(g, 'sigh.', px, y + 20, { font: 'serif', size: 8, align: 'center', color: '#a6ecff', bold: false, shadow: null });
          }
        } else {
          const steel = g.createLinearGradient(0, y, 0, y + 78);
          steel.addColorStop(0, '#5a6069'); steel.addColorStop(1, '#3a3f47');
          g.fillStyle = steel; g.fillRect(MID, y, rw, 78);
          for (let x = MID; x < STORE; x += 10) { g.fillStyle = (x / 10) % 2 ? '#f2c230' : '#1a1a1a'; g.fillRect(x, y + 70, 10, 8); }
          for (let j = 0; j < count; j++) factory(g, MID + 16 + j * 23, y + 52, t + j * 333);
          for (let j = 0; j < 5; j++) put(g, crumb, MID + ((t / 30 + j * 30) % rw), y + 66, 3);
        }
      }
      if (!row) text(g, 'Buy buildings in the store →', (MID + STORE) / 2, H / 2, { font: 'serif', size: 9, align: 'center', color: 'rgba(255, 255, 255, .35)', bold: false, shadow: null });

      // the store
      g.fillStyle = '#1d120a'; g.fillRect(STORE, 0, W - STORE, H);
      text(g, 'Store', (STORE + W) / 2, 20, { font: 'serif', size: 15, align: 'center', shadow: 'rgba(0, 0, 0, .7)' });
      let tip = null;
      SHOP.forEach((s, i) => {
        const y = 30 + i * 46, can = pile >= cost(s), over = hover.x > STORE && hover.y > y && hover.y < y + 44;
        const wood = g.createLinearGradient(0, y, 0, y + 44);
        wood.addColorStop(0, '#8a5a34'); wood.addColorStop(1, '#5c3a1e');
        g.fillStyle = wood; g.fillRect(STORE, y, W - STORE, 44);
        g.fillStyle = 'rgba(0, 0, 0, .12)';
        for (const gy of [9, 21, 33]) g.fillRect(STORE, y + gy, W - STORE, 1);
        g.fillStyle = 'rgba(0, 0, 0, .5)'; g.fillRect(STORE, y + 43, W - STORE, 1);
        if (owned[s.id]) text(g, String(owned[s.id]), W - 6, y + 36, { font: 'serif', size: 24, align: 'right', color: 'rgba(255, 255, 255, .28)', shadow: null });
        const ix = STORE + 20, iy = y + 22;
        if (s.id === 'cursor') pointer(g, ix - 4, iy - 10, -0.25, 1.4);
        else if (s.id === 'snappy') her(g, ix, iy + 1, 26);
        else if (s.id === 'program') programEye(g, ix, iy, 12);
        else factory(g, ix, iy + 4, t, 1);
        text(g, s.name, STORE + 38, y + 18, { font: 'serif', size: 10.5, shadow: 'rgba(0, 0, 0, .7)' });
        put(g, crumb, STORE + 43, y + 31, 4.5);
        text(g, fmt(cost(s)), STORE + 51, y + 35, { font: 'serif', size: 9.5, color: can ? '#6dff6d' : '#ff6b6b', shadow: 'rgba(0, 0, 0, .7)' });
        if (!can) { g.fillStyle = 'rgba(0, 0, 0, .35)'; g.fillRect(STORE, y, W - STORE, 43); }
        else if (over) { g.fillStyle = 'rgba(255, 255, 255, .08)'; g.fillRect(STORE, y, W - STORE, 43); }
        if (over) tip = { s, y };
      });
      if (tip) {
        const { s, y } = tip, ty = Math.min(H - 72, Math.max(4, y - 4));
        g.fillStyle = 'rgba(8, 6, 4, .92)'; g.strokeStyle = '#c9a06a'; g.lineWidth = 1;
        g.beginPath(); g.roundRect(STORE - 162, ty, 158, 68, 4); g.fill(); g.stroke();
        text(g, s.name, STORE - 154, ty + 15, { font: 'serif', size: 11, shadow: null });
        text(g, `each bakes ${s.rate} ${s.rate === 1 ? 'cookie' : 'cookies'} per second`, STORE - 154, ty + 28, { font: 'serif', size: 8, bold: false, color: '#6dff6d', shadow: null });
        g.font = 'italic 8px Georgia, serif'; g.fillStyle = '#d8c8a8'; g.textAlign = 'left';
        wrap(g, `"${s.quote}"`, STORE - 154, ty + 42, 142, 9.5);
      }
      plank(g, LEFT, MID - LEFT);
      plank(g, STORE - 6, 6);

      // a golden cookie, somewhere, for a little while
      if (golden) {
        const age = t - golden.born, fade = Math.min(1, age / 600, (9000 - age) / 1500);
        g.globalAlpha = Math.max(0, fade);
        rays(g, golden.x, golden.y, 34, t * 2, 0.45);
        put(g, gold, golden.x, golden.y, 14, 1 + Math.sin(t / 180) * 0.07, Math.sin(t / 900) * 0.3);
        g.globalAlpha = 1;
      }
      // a note from the bakery, at the bottom
      const nt = notes[0];
      if (nt && t - nt.t < 3200) {
        g.globalAlpha = Math.min(1, (3200 - (t - nt.t)) / 400);
        g.fillStyle = 'rgba(8, 6, 4, .88)'; g.strokeStyle = '#c9a06a'; g.lineWidth = 1;
        g.beginPath(); g.roundRect(CX - 78, H - 44, 156, 36, 5); g.fill(); g.stroke();
        text(g, nt.title, CX, H - 29, { font: 'serif', size: 11, align: 'center', color: PAL.gold, shadow: null });
        text(g, nt.body, CX, H - 16, { font: 'serif', size: 8, align: 'center', bold: false, shadow: null });
        g.globalAlpha = 1;
      }
    };

    while (total < GOAL) {
      await scr.tick();
      const t = performance.now(), sec = Math.min(0.1, (t - last) / 1000);
      last = t;
      const r = rate(), made = r * (frenzy > t ? 7 : 1) * sec;
      pile += made;
      total += made;
      news = Math.floor((t - begun) / 7000);
      const { x, y } = scr.mouse;
      const onCookie = Math.hypot(x - CX, y - CY) < R && x < LEFT;
      k += ((onCookie ? (scr.mouse.down ? 0.96 : 1.04) : 1) - k) * Math.min(1, sec * 18);
      // clicks: a golden cookie, a minion, the cookie, or the store
      while (scr.click()) {
        if (golden && Math.hypot(x - golden.x, y - golden.y) < 18) {
          if (Math.random() < 0.5) { frenzy = t + 10000; note('Frenzy!', 'Cookie production ×7 for 10 seconds!'); }
          else {
            const lucky = Math.floor(pile * 0.15) + 13;
            pile += lucky; total += lucky;
            note('Lucky!', `+${fmt(lucky)} cookies!`);
          }
          Speech.tune('chime', 0.6);
          golden = null;
          nextGold = t + 30000 + Math.random() * 20000;
          continue;
        }
        const m = minions.find((it) => Math.hypot(x - (CX + Math.cos(it.a) * it.d), y - (CY + Math.sin(it.a) * it.d)) < 14);
        if (m) {
          // popped: everything it ate comes back, and a little extra
          const back = Math.floor(m.ate * 1.1);
          pile += back;
          minions.splice(minions.indexOf(m), 1);
          popped++;
          pops.push({ x, y, t, text: back ? `+${fmt(back)}` : 'pop!', color: '#ffb3bd' });
          for (let i = 0; i < 6; i++) bits.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 80, r: 4, rot: 0, vr: 6 });
          Speech.tune('clunk', 0.7);
          continue;
        }
        if (onCookie) {
          pile += 1; total += 1;
          pops.push({ x: x + (Math.random() - 0.5) * 8, y, t, text: '+1' });
          bits.push({ x, y, vx: (Math.random() - 0.5) * 70, vy: -50 - Math.random() * 50, r: 4.5, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 8 });
          snappy.call('sound.blip', { pitch: 500 + Math.random() * 160, volume: Speech.volume * 0.45 }).catch(() => {});
          continue;
        }
        SHOP.forEach((s, i) => {
          const sy = 30 + i * 46;
          if (x > STORE && y > sy && y < sy + 44 && pile >= cost(s)) {
            pile -= cost(s);
            if (!owned[s.id]++ && s.hired) note(s.name, s.hired);
            Speech.tune('coin', 0.5);
          }
        });
      }
      canvas.style.cursor = onCookie || x > STORE || golden || minions.length ? 'pointer' : '';
      // cookies falling in the background, more the faster you bake
      if (Math.random() < sec * Math.min(6, 0.4 + r / 6)) bits.push({ x: Math.random() * LEFT, y: -10, vx: 0, vy: 30 + Math.random() * 20, r: 5, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 2, fall: true });
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        if (!b.fall) b.vy += 260 * sec;
        b.x += b.vx * sec; b.y += b.vy * sec; b.rot += b.vr * sec;
        if (b.y > H + 12) bits.splice(i, 1);
      }
      for (let i = pops.length - 1; i >= 0; i--) if (t - pops[i].t > 1000) pops.splice(i, 1);
      // golden cookies come and go
      if (!golden && t > nextGold) golden = { x: 30 + Math.random() * (STORE - 60), y: 40 + Math.random() * (H - 90), born: t };
      if (golden && t - golden.born > 9000) { golden = null; nextGold = t + 25000 + Math.random() * 15000; }
      // the minions: crawl in, latch on, nibble the bank
      if (t > nextMinion && minions.length < 3 && pile > 20) {
        minions.push({ a: Math.random() * TAU, d: R + 80, latched: false, ate: 0 });
        nextMinion = t + 10000 + Math.random() * 6000;
      }
      for (const m of minions) {
        if (!m.latched) { m.d -= 14 * sec; if (m.d <= R + 6) { m.latched = true; Speech.tune('glitch', 0.3); } continue; }
        const bite = Math.min(pile, (1.5 + r * 0.06) * sec);
        pile -= bite; m.ate += bite;
        if (Math.random() < sec * 3) bits.push({ x: CX + Math.cos(m.a) * R * 0.9, y: CY + Math.sin(m.a) * R * 0.9, vx: Math.cos(m.a) * 40, vy: Math.sin(m.a) * 40 - 30, r: 3, rot: 0, vr: 4 });
      }
      draw(t, r);
    }
    stop();
    canvas.style.cursor = '';
    // a thousand cookies, and then a visitor
    note(`${fmt(GOAL)} cookies baked!`, 'The bakery is a success.');
    Speech.tune('fanfare', 0.6);
    const glutton = { a: Math.PI * 0.75, d: R + 70, latched: false, ate: 0, size: 1.8 };
    minions.splice(0, minions.length, glutton);
    golden = null;
    for (let i = 0; i < 300; i++) {
      await scr.tick();
      const t = performance.now(), sec = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (i > 50) {
        if (!glutton.latched) { glutton.d -= 70 * sec; if (glutton.d <= R + 14) { glutton.latched = true; Speech.tune('glitch', 0.5); } }
        else if (pile > 0) {
          pile = Math.max(0, pile - Math.max(6, pile * 1.6 * sec));
          bits.push({ x: CX + Math.cos(glutton.a) * R * 0.8, y: CY + Math.sin(glutton.a) * R * 0.8, vx: Math.cos(glutton.a) * 50, vy: Math.sin(glutton.a) * 50 - 30, r: 3.5, rot: 0, vr: 4 });
        }
      }
      for (let j = bits.length - 1; j >= 0; j--) { const b = bits[j]; if (!b.fall) b.vy += 260 * sec; b.x += b.vx * sec; b.y += b.vy * sec; if (b.y > H + 12) bits.splice(j, 1); }
      draw(t, rate());
    }
    await scr.close();
    await S('{joy}A thousand cookies!', { hold: 300 });
    await S('{shock}...wait. {pause}Where did they all go?', { hold: 400 });
    await P('A minion of the Lag ate all of them. {pause}It left a note.', { hold: 400 });
    await P('"Th-th-thank you."', { hold: 700 });
    await S('{sad}...okay. {pause}{happy}At least it looked happy.', { hold: 500 });
    if (popped) await P(`You also popped ${popped} of its friends. {pause}It did not mention that.`, { hold: 600 });
    await P('Cookies baked: one thousand. {pause}Cookies remaining: zero.', { hold: 600 });
    await S('{wink}Worth it.', { hold: 700 });
    await finish();
  }

  Events.define('cookies', {
    tier: 'game', title: 'Cookie Snapper', hint: 'Remember those cookies she grabbed?', run: cookies, weight: 1, after: ['deepscan', 'framedrop'],
  });
})();
