// Snapshot Roulette (after Buckshot Roulette): the room behind the arcade. One bulb, a table, a sawed-off pump shotgun,
// and the Program dealing. The shells are shown, then loaded in an order nobody sees. Whoever holds the gun shoots the
// dealer or themselves; a blank on yourself keeps your turn. From the second round there are things on the table that
// help. Three rounds, more charges each time, and in the last one a charge lost is lost for good. Nothing in here is
// cute, and Snappy knows it.
(() => {
  const { programEye } = Arcade;
  const W = 640, H = 360, TAU = Math.PI * 2;
  const SERIF = 'Georgia, "Times New Roman", serif', MONO = '"Cascadia Mono", Consolas, monospace', HAND = '"Segoe Print", "Segoe Script", cursive';
  const ROUNDS = [{ charges: 2, items: 0 }, { charges: 4, items: 2 }, { charges: 5, items: 4 }];
  const ROMAN = ['I', 'II', 'III'], MAX_ITEMS = 8;
  const ITEMS = {
    glass: { name: 'MAGNIFYING GLASS', note: 'See the shell in the chamber.' },
    beer: { name: 'BEER', note: 'Rack the gun. The shell in the chamber comes out.' },
    battery: { name: 'BATTERY', note: 'One charge back.' },
    saw: { name: 'HANDSAW', note: 'The next shot does two.' },
    cuffs: { name: 'HANDCUFFS', note: 'The dealer misses its next turn.' },
  };
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ===========================================================================
  // The room, drawn once: grimy tiles, the table with its worn felt, burns and stains
  // ===========================================================================
  function layer(canvas, draw) {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const o = c.getContext('2d');
    o.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    draw(o);
    return c;
  }
  function paintWall(o) {
    o.fillStyle = '#080a09';
    o.fillRect(0, 0, W, H);
    // tiles, each a little different, with dark grout
    for (let y = 0; y < 230; y += 30) {
      for (let x = (y / 30) % 2 ? -15 : 0; x < W; x += 30) {
        const v = 17 + Math.random() * 9;
        o.fillStyle = `rgb(${v - 4}, ${v + 4}, ${v})`;
        o.fillRect(x + 1.5, y + 1.5, 27, 27);
        if (Math.random() < 0.25) { o.fillStyle = 'rgba(0, 0, 0, .25)'; o.fillRect(x + 1.5, y + 1.5, 27, 27); }
        if (Math.random() < 0.08) {
          // a crack
          o.strokeStyle = 'rgba(0, 0, 0, .55)'; o.lineWidth = 0.8;
          o.beginPath(); o.moveTo(x + rand(4, 24), y + 2); o.lineTo(x + rand(6, 22), y + rand(10, 18)); o.lineTo(x + rand(4, 24), y + 28); o.stroke();
        }
      }
    }
    // grime: brown blooms and long drips down the wall
    for (let i = 0; i < 22; i++) {
      const x = rand(0, W), y = rand(20, 200), r = rand(30, 90);
      const s = o.createRadialGradient(x, y, 0, x, y, r);
      s.addColorStop(0, 'rgba(48, 34, 14, .32)'); s.addColorStop(1, 'rgba(48, 34, 14, 0)');
      o.fillStyle = s; o.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 22; i++) {
      const x = rand(0, W), y = rand(0, 120), len = rand(30, 120);
      const d = o.createLinearGradient(0, y, 0, y + len);
      d.addColorStop(0, 'rgba(30, 22, 10, .45)'); d.addColorStop(1, 'rgba(30, 22, 10, 0)');
      o.fillStyle = d; o.fillRect(x, y, rand(1, 3), len);
    }
  }
  const TABLE = [[118, 214], [522, 214], [700, 360], [-60, 360]];
  function paintTable(o) {
    // the wooden rim, then the felt inside it
    const path = (pts) => { o.beginPath(); pts.forEach(([x, y], i) => (i ? o.lineTo(x, y) : o.moveTo(x, y))); o.closePath(); };
    path(TABLE);
    const wood = o.createLinearGradient(0, 210, 0, 360);
    wood.addColorStop(0, '#2b1a0d'); wood.addColorStop(1, '#120a04');
    o.fillStyle = wood; o.fill();
    path([[128, 220], [512, 220], [680, 360], [-40, 360]]);
    const felt = o.createLinearGradient(0, 220, 0, 360);
    felt.addColorStop(0, '#13291c'); felt.addColorStop(1, '#1d3b28');
    o.fillStyle = felt; o.fill();
    o.save();
    o.clip();
    for (let i = 0; i < 2600; i++) {
      o.fillStyle = Math.random() < 0.5 ? 'rgba(0, 0, 0, .22)' : 'rgba(120, 160, 120, .05)';
      o.fillRect(rand(-40, 680), rand(218, 360), 1, 1);
    }
    // scratches, cigarette burns, the ring of a glass
    o.strokeStyle = 'rgba(190, 210, 170, .07)'; o.lineWidth = 0.7;
    for (let i = 0; i < 18; i++) { const x = rand(60, 580), y = rand(230, 350); o.beginPath(); o.moveTo(x, y); o.lineTo(x + rand(-40, 40), y + rand(-8, 8)); o.stroke(); }
    for (let i = 0; i < 6; i++) {
      const x = rand(80, 560), y = rand(236, 350), r = rand(3, 6);
      const b = o.createRadialGradient(x, y, 0, x, y, r * 1.8);
      b.addColorStop(0, 'rgba(10, 6, 2, .95)'); b.addColorStop(0.5, 'rgba(60, 36, 12, .6)'); b.addColorStop(1, 'rgba(60, 36, 12, 0)');
      o.fillStyle = b; o.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    }
    o.strokeStyle = 'rgba(70, 50, 20, .35)'; o.lineWidth = 2.5;
    o.beginPath(); o.ellipse(500, 318, 24, 9, 0, 0, TAU); o.stroke();
    // something dark spilled a long time ago
    const spill = o.createRadialGradient(150, 300, 0, 150, 300, 60);
    spill.addColorStop(0, 'rgba(25, 8, 6, .45)'); spill.addColorStop(1, 'rgba(25, 8, 6, 0)');
    o.fillStyle = spill; o.fillRect(80, 250, 140, 110);
    o.restore();
    // the near edge catches a little light
    o.strokeStyle = 'rgba(255, 210, 150, .08)'; o.lineWidth = 1.5;
    o.beginPath(); o.moveTo(128, 220); o.lineTo(512, 220); o.stroke();
  }
  // film grain: a few frames of noise, cycled
  function grainFrames(canvas) {
    return [0, 1, 2, 3].map(() => {
      const c = document.createElement('canvas');
      c.width = Math.round(canvas.width / 2);
      c.height = Math.round(canvas.height / 2);
      const o = c.getContext('2d'), img = o.createImageData(c.width, c.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = Math.random() < 0.5 ? 40 : 0;
      }
      o.putImageData(img, 0, 0);
      return c;
    });
  }

  // ===========================================================================
  // The shotgun, three ways: lying on its side, seen from behind aimed away, and down the barrel
  // ===========================================================================
  const metal = (g, y0, y1, light = 1) => {
    const m = g.createLinearGradient(0, y0, 0, y1);
    m.addColorStop(0, `rgb(${92 * light}, ${96 * light}, ${104 * light})`); m.addColorStop(0.35, `rgb(${46 * light}, ${48 * light}, ${54 * light})`);
    m.addColorStop(1, `rgb(${14 * light}, ${15 * light}, ${17 * light})`);
    return m;
  };
  const walnut = (g, y0, y1) => {
    const w = g.createLinearGradient(0, y0, 0, y1);
    w.addColorStop(0, '#7a4a26'); w.addColorStop(0.5, '#4f2e15'); w.addColorStop(1, '#25140a');
    return w;
  };
  // side on, (0, 0) the middle of the receiver, pointing right; a sawn barrel is shorter
  function gunSide(g, x, y, s, rot, { sawn = false, glow = 0 } = {}) {
    const end = sawn ? 92 : 150;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(s, s);
    if (glow) { g.shadowColor = `rgba(255, 236, 200, ${0.55 * glow})`; g.shadowBlur = 14 * glow * s; }
    // stock, sawed short, with a worn grip
    g.fillStyle = walnut(g, -14, 18);
    g.beginPath(); g.moveTo(-150, -4); g.quadraticCurveTo(-118, -14, -96, -13); g.lineTo(-60, -11); g.lineTo(-60, 10);
    g.quadraticCurveTo(-82, 12, -100, 22); g.lineTo(-150, 22); g.closePath(); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(0, 0, 0, .35)'; g.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-146, -1 + i * 4.5); g.quadraticCurveTo(-110, -8 + i * 4, -64, -6 + i * 3.6); g.stroke(); }
    // receiver, ejection port, trigger guard
    g.fillStyle = metal(g, -13, 10);
    g.beginPath(); g.roundRect(-62, -13, 66, 23, 3); g.fill();
    g.fillStyle = '#060606'; g.fillRect(-38, -8, 18, 6);
    g.strokeStyle = '#1b1c1f'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-48, 10); g.quadraticCurveTo(-42, 26, -28, 23); g.quadraticCurveTo(-20, 21, -22, 10); g.stroke();
    g.strokeStyle = '#2c2e33'; g.lineWidth = 2; g.beginPath(); g.moveTo(-36, 10); g.lineTo(-34, 18); g.stroke();
    // barrel and the magazine tube under it
    g.fillStyle = metal(g, -12, -3);
    g.fillRect(2, -12, end, 9);
    g.fillStyle = metal(g, -2, 6, 0.8);
    g.fillRect(2, -2, end - 34, 8);
    g.fillStyle = 'rgba(255, 255, 255, .22)'; g.fillRect(4, -11, end - 6, 1);
    g.fillStyle = '#0b0b0c'; g.fillRect(end - 2, -12, 4, 9);
    if (sawn) { g.fillStyle = 'rgba(200, 200, 210, .5)'; g.fillRect(end + 1, -12, 1.2, 9); }
    // the pump, ridged
    g.fillStyle = walnut(g, -4, 9);
    g.beginPath(); g.roundRect(28, -4, 58, 13, 3); g.fill();
    g.strokeStyle = 'rgba(0, 0, 0, .45)'; g.lineWidth = 1;
    for (let i = 34; i < 82; i += 5) { g.beginPath(); g.moveTo(i, -3); g.lineTo(i, 8); g.stroke(); }
    g.restore();
  }
  // raised at the dealer, seen over her shoulder: the stock off the bottom right, the muzzle toward (tx, ty)
  function gunAimed(g, tx, ty, lift, opts) {
    const cx = 424, cy = 300 + (1 - lift) * 26;
    const ang = Math.atan2(ty - cy, tx - cx);
    g.save();
    g.translate(cx, cy);
    g.rotate(ang);
    // (turned more than a quarter round, it would be upside down)
    if (Math.cos(ang) < 0) g.scale(1, -1);
    gunSide(g, 0, 0, 1.25, 0, opts);
    g.restore();
  }
  // down the barrel: what you see when it's pointed at you. (x, y) the muzzle, r its size
  function gunMuzzle(g, x, y, r, { sawn = false } = {}) {
    // the pump and the receiver behind, in the dark
    g.fillStyle = walnut(g, y + r * 0.4, y + r * 2.2);
    g.beginPath(); g.roundRect(x - r * 1.05, y + r * 0.55, r * 2.1, r * 1.5, r * 0.3); g.fill();
    g.fillStyle = metal(g, y - r * 1.1, y + r * 1.1);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.beginPath(); g.arc(x, y + r * 1.55, r * 0.62, 0, TAU); g.fill();
    // the bore, and the light just catching its rim
    const bore = g.createRadialGradient(x, y, 0, x, y, r * 0.66);
    bore.addColorStop(0, '#000'); bore.addColorStop(0.8, '#050505'); bore.addColorStop(1, '#202226');
    g.fillStyle = bore; g.beginPath(); g.arc(x, y, r * 0.66, 0, TAU); g.fill();
    g.fillStyle = '#060606'; g.beginPath(); g.arc(x, y + r * 1.55, r * 0.3, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255, 230, 190, .35)'; g.lineWidth = Math.max(1, r * 0.05);
    g.beginPath(); g.arc(x, y, r * 0.96, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
    if (sawn) { g.strokeStyle = 'rgba(210, 210, 220, .45)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r * 0.99, 0, TAU); g.stroke(); }
  }

  // shells standing on the table: red live, dark blue blank, brass at the bottom
  function shell(g, x, y, live, a = 1) {
    g.save();
    g.globalAlpha = a;
    const body = g.createLinearGradient(x - 8, 0, x + 8, 0);
    if (live) { body.addColorStop(0, '#5c0c0a'); body.addColorStop(0.4, '#c42a22'); body.addColorStop(1, '#4a0907'); }
    else { body.addColorStop(0, '#0e1626'); body.addColorStop(0.4, '#34507e'); body.addColorStop(1, '#0b1220'); }
    g.fillStyle = body; g.beginPath(); g.roundRect(x - 8, y - 34, 16, 28, 2); g.fill();
    const brass = g.createLinearGradient(x - 8, 0, x + 8, 0);
    brass.addColorStop(0, '#6b4e14'); brass.addColorStop(0.4, '#e2b858'); brass.addColorStop(1, '#5a400f');
    g.fillStyle = brass; g.fillRect(x - 8.5, y - 8, 17, 8);
    g.fillStyle = 'rgba(0, 0, 0, .35)'; g.fillRect(x - 8.5, y - 8, 17, 1.2);
    g.restore();
  }

  // the things on the table, about 36 across at s = 1
  function item(g, id, x, y, s = 1, hot = false) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    if (hot) { g.shadowColor = 'rgba(255, 230, 190, .7)'; g.shadowBlur = 12 * s; }
    if (id === 'glass') {
      g.strokeStyle = '#3a2412'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(6, 6); g.lineTo(15, 15); g.stroke();
      g.fillStyle = 'rgba(150, 190, 220, .16)'; g.beginPath(); g.arc(-3, -3, 10, 0, TAU); g.fill();
      g.strokeStyle = '#a8843e'; g.lineWidth = 2.6; g.stroke();
      g.strokeStyle = 'rgba(255, 255, 255, .45)'; g.lineWidth = 1.2; g.beginPath(); g.arc(-3, -3, 6.5, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
    } else if (id === 'beer') {
      const glass = g.createLinearGradient(-8, 0, 8, 0);
      glass.addColorStop(0, '#2b1505'); glass.addColorStop(0.45, '#7a4612'); glass.addColorStop(1, '#2b1505');
      g.fillStyle = glass;
      g.beginPath(); g.moveTo(-3, -18); g.lineTo(3, -18); g.lineTo(3, -10); g.quadraticCurveTo(8, -7, 8, -1); g.lineTo(8, 16); g.lineTo(-8, 16);
      g.lineTo(-8, -1); g.quadraticCurveTo(-8, -7, -3, -10); g.closePath(); g.fill();
      g.fillStyle = '#c9b98a'; g.fillRect(-8, 1, 16, 8);
      g.fillStyle = 'rgba(80, 30, 10, .8)'; g.fillRect(-5, 3.5, 10, 1.5);
      g.fillStyle = 'rgba(255, 255, 255, .25)'; g.fillRect(-5, -6, 1.5, 20);
      g.fillStyle = '#a8a39a'; g.fillRect(-3.5, -20, 7, 2.5);
    } else if (id === 'battery') {
      const cell = g.createLinearGradient(-8, 0, 8, 0);
      cell.addColorStop(0, '#111'); cell.addColorStop(0.45, '#3b3f44'); cell.addColorStop(1, '#0c0c0c');
      g.fillStyle = cell; g.beginPath(); g.roundRect(-8, -14, 16, 30, 3); g.fill();
      g.fillStyle = '#b8b2a2'; g.fillRect(-3, -18, 6, 4);
      g.fillStyle = '#4fa35c'; g.fillRect(-8, -2, 16, 7);
      g.fillStyle = '#0b0b0b'; g.font = `bold 8px ${MONO}`; g.textAlign = 'center'; g.fillText('+', 0, -5);
    } else if (id === 'saw') {
      g.fillStyle = '#9ba0a6';
      g.beginPath(); g.moveTo(-18, -6); g.lineTo(10, -9); g.lineTo(10, 3); g.lineTo(-18, 2); g.closePath(); g.fill();
      g.fillStyle = '#5f6368';
      for (let i = -17; i < 9; i += 3) { g.beginPath(); g.moveTo(i, 2); g.lineTo(i + 1.5, 5); g.lineTo(i + 3, 2); g.fill(); }
      g.fillStyle = walnut(g, -11, 7); g.beginPath(); g.roundRect(8, -11, 12, 16, 4); g.fill();
      g.fillStyle = '#120a04'; g.beginPath(); g.roundRect(11, -7, 6, 7, 2); g.fill();
    } else if (id === 'cuffs') {
      g.strokeStyle = '#8c9096'; g.lineWidth = 3;
      g.beginPath(); g.arc(-8, 2, 7.5, 0, TAU); g.stroke();
      g.beginPath(); g.arc(9, 2, 7.5, 0, TAU); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(-1, 0); g.lineTo(2, 0); g.stroke();
      g.strokeStyle = 'rgba(255, 255, 255, .35)'; g.lineWidth = 1; g.beginPath(); g.arc(-8, 2, 7.5, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
    }
    g.restore();
  }

  // lightning bolts for the charges on the monitor
  function bolt(g, x, y, on, cut) {
    g.fillStyle = on ? (cut ? '#ff5a4a' : '#7dff8a') : 'rgba(80, 140, 90, .18)';
    g.beginPath();
    g.moveTo(x + 4, y - 9); g.lineTo(x, y - 2); g.lineTo(x + 3, y - 2); g.lineTo(x + 1, y + 4); g.lineTo(x + 7, y - 5); g.lineTo(x + 4, y - 5); g.lineTo(x + 6, y - 9);
    g.closePath(); g.fill();
  }

  // ===========================================================================
  // The game
  // ===========================================================================
  async function roulette(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    const before = Arcade.top('roulette') || 0;
    // she isn't playing around today
    if (!Events.has('roulette')) {
      await P('Snappy.', { alert: true, hold: 600 });
      await S('{flat}...I know.', { hold: 500 });
      await P('There is a room behind the arcade. You have seen the door.', { hold: 600 });
      await S('{flat}I have.', { hold: 400 });
      await P('Tonight it is open.', { hold: 900 });
      await S('{flat}Then let us go in.', { hold: 700 });
    } else {
      await P('You came back.', { alert: true, hold: 600 });
      await S(before >= 3 ? '{flat}I walked out last time.' : '{flat}I remember how it went last time.', { hold: 500 });
      await P('So does the room.', { hold: 900 });
    }
    const scr = await screen({ w: W, h: H, smooth: true, look: 'rr-screen' });
    const { g, canvas } = scr;
    const wall = layer(canvas, paintWall), table = layer(canvas, paintTable), grain = grainFrames(canvas);

    // ---- everything the painter draws from
    const me = { name: 'SNAPPY', charges: 0, items: [], cuffed: false, cut: false };
    const dealer = { name: 'DEALER', charges: 0, items: [], cuffed: false, cut: false };
    let round = 0, shells = [], sawn = false, max = 2;
    let gun = 'dealer', aimAt = null, gunHot = false, held = false, hover = null;
    let showing = null, loading = null, card = null, line = null, peek = null, waiver = false, signed = false, turnMine = false, over = null, ending = null;
    let flash = 0, shake = 0, black = 0, eyeOut = 0, recoil = 0, lightBoost = 0, endClick = false;
    let flicker = 0, nextFlicker = performance.now() + rand(3000, 7000);
    const puffs = [], casings = [];

    // what someone says, typed out under the table: the Program slow, in its own lettering; her short and quiet
    async function say(who, s, hold = 900) {
      line = { who, s, t: performance.now() };
      const per = who === 'p' ? 42 : 34;
      const typed = s.length * per;
      const voice = setInterval(() => {
        if (!line || line.s !== s || performance.now() - line.t > typed) return;
        if (who === 'p') { Speech.programWord(); Speech.programBlip(); } else Speech.blip(false, 0.72);
      }, 85);
      try { await ctx.wait(typed + hold + Math.min(1400, s.length * 18)); } finally { clearInterval(voice); }
    }
    const quiet = () => { line = null; };
    const until = (test) => ctx.run(new Promise((res) => {
      const loop = setInterval(() => { if (test() || ctx.cancelled) { clearInterval(loop); res(); } }, 30);
      ctx.onEnd(() => clearInterval(loop));
    }));

    // ---- where things are
    const MY_SLOTS = [94, 150, 206, 262, 378, 434, 490, 546].map((x) => [x, 330]);
    const ITS_SLOTS = [196, 226, 256, 286, 354, 384, 414, 444].map((x) => [x, 226]);
    const GUN = { x: 320, y: 280 };
    const overGun = (x, y) => Math.abs(x - GUN.x) < 160 && Math.abs(y - GUN.y) < 26;
    const overDealer = (x, y) => Math.hypot(x - 320, y - 120) < 56 || (x > 210 && x < 430 && y > 150 && y < 214);
    const overSelf = (x, y) => y > 300 && x > 200 && x < 440 && !me.items.some((_, i) => Math.hypot(x - MY_SLOTS[i][0], y - MY_SLOTS[i][1]) < 22);
    const itemAt = (x, y) => me.items.findIndex((_, i) => Math.hypot(x - MY_SLOTS[i][0], y - MY_SLOTS[i][1]) < 22);

    // ---- painting
    function lamp(t) {
      const swing = Math.sin(t / 1900) * 0.07 + Math.sin(t / 730) * 0.01;
      const bx = 320 + Math.sin(swing) * 74, by = -6 + Math.cos(swing) * 74;
      // the bulb flickers now and then
      if (t > nextFlicker) { flicker = t + rand(80, 420); nextFlicker = t + rand(3500, 9000); }
      const on = t < flicker ? (Math.random() < 0.5 ? 0.25 : 0.7) : 1;
      return { bx, by, light: clamp(on + lightBoost, 0, 1.6), lx: 320 + swing * 520 };
    }
    const breathe = (t) => Math.sin(t / 1500) * 1.2 - recoil * 6;
    function paintDealer(t, L) {
      g.save();
      g.translate(0, breathe(t));
      // a tall hooded shape in the dark: shoulders, the hood, and an opening darker than everything else
      g.fillStyle = '#060707';
      g.beginPath(); g.moveTo(146, 238); g.quadraticCurveTo(166, 176, 244, 158); g.lineTo(396, 158); g.quadraticCurveTo(474, 176, 494, 238); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(244, 214); g.quadraticCurveTo(236, 118, 266, 76); g.quadraticCurveTo(294, 34, 320, 28); g.quadraticCurveTo(346, 34, 374, 76);
      g.quadraticCurveTo(404, 118, 396, 214); g.closePath(); g.fill();
      const hole = g.createRadialGradient(320, 112, 6, 320, 116, 46);
      hole.addColorStop(0, '#000'); hole.addColorStop(0.85, '#010101'); hole.addColorStop(1, '#060707');
      g.fillStyle = hole; g.beginPath(); g.ellipse(320, 116, 34, 46, 0, 0, TAU); g.fill();
      // folds, and the lamp only just finding the edges
      g.strokeStyle = 'rgba(0, 0, 0, .9)'; g.lineWidth = 2;
      for (const [x0, x1] of [[262, 250], [378, 390], [292, 286], [348, 356]]) { g.beginPath(); g.moveTo(x0, 170); g.quadraticCurveTo((x0 + x1) / 2 + 6, 196, x1, 214); g.stroke(); }
      g.strokeStyle = `rgba(255, 214, 160, ${0.13 * L})`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(262, 84); g.quadraticCurveTo(292, 36, 320, 30); g.quadraticCurveTo(348, 36, 378, 84); g.stroke();
      g.beginPath(); g.moveTo(168, 200); g.quadraticCurveTo(186, 172, 244, 158); g.stroke();
      g.beginPath(); g.moveTo(472, 200); g.quadraticCurveTo(454, 172, 396, 158); g.stroke();
      g.restore();
    }
    // its eye, cold, a light of its own in the dark of the hood (out for a moment when it's hit, and orange after)
    function paintEye(t) {
      if (eyeOut > t) { if (Math.random() < 0.85) return; }
      const y = 112 + breathe(t);
      const look = aimAt === 'me' ? 0 : Math.sin(t / 2300) * 0.35;
      const angry = eyeOut > 0 && t - eyeOut < 1600;
      const glow = g.createRadialGradient(320, y, 2, 320, y, 38);
      glow.addColorStop(0, angry ? 'rgba(255, 140, 60, .3)' : 'rgba(110, 215, 255, .26)'); glow.addColorStop(1, 'rgba(110, 215, 255, 0)');
      g.fillStyle = glow; g.fillRect(280, y - 40, 80, 80);
      programEye(g, 320, y, 11, { look, alert: angry });
    }
    function monitor(t) {
      const x = 18, y = 150, w = 132, h = 78;
      g.fillStyle = '#141613'; g.beginPath(); g.roundRect(x, y, w, h, 6); g.fill();
      g.fillStyle = '#0b0d0a'; g.fillRect(x + 4, y + h, w - 8, 8);
      const scr2 = g.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, w * 0.7);
      scr2.addColorStop(0, '#0b2a12'); scr2.addColorStop(1, '#03100a');
      g.fillStyle = scr2; g.beginPath(); g.roundRect(x + 8, y + 7, w - 16, h - 14, 8); g.fill();
      g.font = `bold 8px ${MONO}`; g.textAlign = 'left';
      for (const [who, yy] of [[dealer, y + 28], [me, y + 54]]) {
        g.fillStyle = who.cut ? '#ff6a5a' : '#7dff8a';
        g.fillText(who.cut ? 'CUT' : who.name, x + 14, yy);
        for (let i = 0; i < max; i++) bolt(g, x + 66 + i * 11, yy - 2, i < who.charges, who.cut);
      }
      if (round) { g.fillStyle = 'rgba(125, 255, 138, .55)'; g.fillText(`ROUND ${ROMAN[round - 1]}`, x + 14, y + 72); }
      g.fillStyle = 'rgba(0, 0, 0, .25)';
      for (let yy = y + 8; yy < y + h - 7; yy += 2) g.fillRect(x + 8, yy, w - 16, 1);
      g.fillStyle = `rgba(125, 255, 138, ${0.04 + Math.sin(t / 90) * 0.01})`; g.fillRect(x + 8, y + 7, w - 16, h - 14);
    }
    function paintGun(t) {
      const opts = { sawn };
      if (gun === 'table') {
        g.fillStyle = 'rgba(0, 0, 0, .45)'; g.beginPath(); g.ellipse(GUN.x - 4, GUN.y + 14, 150, 13, -0.05, 0, TAU); g.fill();
        gunSide(g, GUN.x, GUN.y, 1, -0.05, { sawn, glow: gunHot ? 0.8 + Math.sin(t / 200) * 0.2 : 0 });
      } else if (gun === 'dealer') {
        gunSide(g, 452, 196, 0.62, -1.42, opts);
      } else if (gun === 'mine') {
        const tremble = Math.sin(t / 47) * 0.6 + Math.sin(t / 31) * 0.4;
        if (aimAt === 'me') gunMuzzle(g, 320 + tremble, 262 + tremble, 62, opts);
        else gunAimed(g, 320 + tremble * 0.4, 168, held && hover === 'dealer' ? 1 : 0.4, opts);
      } else if (gun === 'its') {
        if (aimAt === 'me') gunMuzzle(g, 320, 178 - recoil * 10, 30 + recoil * 4, opts);
        else gunSide(g, 356, 182, 0.6, -1.62, opts);
      }
    }
    function paint(t) {
      const { bx, by, light: L, lx } = lamp(t);
      g.save();
      if (shake > 0.3) { g.translate(rand(-shake, shake), rand(-shake, shake)); shake *= 0.86; } else shake = 0;
      g.drawImage(wall, 0, 0, W, H);
      // warm light on the wall behind
      const wallLight = g.createRadialGradient(bx, by + 20, 10, bx, by + 60, 300);
      wallLight.addColorStop(0, `rgba(255, 210, 150, ${0.16 * L})`); wallLight.addColorStop(1, 'rgba(255, 210, 150, 0)');
      g.fillStyle = wallLight; g.fillRect(0, 0, W, 240);
      paintDealer(t, L);
      g.drawImage(table, 0, 0, W, H);
      // the pool of light on the felt
      const pool = g.createRadialGradient(lx, 268, 10, lx, 268, 260);
      pool.addColorStop(0, `rgba(255, 220, 160, ${0.17 * L})`); pool.addColorStop(1, 'rgba(255, 220, 160, 0)');
      g.fillStyle = pool; g.fillRect(0, 200, W, 160);
      // the dealer's things on the far side, yours on the near side
      dealer.items.forEach((id, i) => item(g, id, ITS_SLOTS[i][0], ITS_SLOTS[i][1], 0.55));
      me.items.forEach((id, i) => item(g, id, MY_SLOTS[i][0], MY_SLOTS[i][1], 1, turnMine && !held && hover === i));
      if (dealer.cuffed) item(g, 'cuffs', 320, 236, 0.7);
      if (me.cuffed) item(g, 'cuffs', 320, 312, 0.9);
      // the shells, shown before they go in
      if (showing) {
        const n = showing.length, gap = 26;
        showing.forEach((live, i) => shell(g, 320 - ((n - 1) * gap) / 2 + i * gap, 268, live, loading ? clamp(1 - (loading - i) , 0, 1) : 1));
      }
      paintGun(t);
      // casings tumbling out after a rack
      for (const c of casings) {
        c.vy += 0.35; c.x += c.vx; c.y += c.vy; c.r += c.vr;
        g.save(); g.translate(c.x, c.y); g.rotate(c.r); shell(g, 0, 17, c.live, 1); g.restore();
      }
      for (let i = casings.length - 1; i >= 0; i--) if (casings[i].y > H + 40) casings.splice(i, 1);
      // gun smoke
      for (const p of puffs) {
        p.x += p.vx; p.y += p.vy; p.r += 0.5; p.a *= 0.97;
        const s = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        s.addColorStop(0, `rgba(190, 190, 185, ${p.a})`); s.addColorStop(1, 'rgba(190, 190, 185, 0)');
        g.fillStyle = s; g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].a < 0.01) puffs.splice(i, 1);
      // the bulb on its cord, and the dark everywhere it doesn't reach
      g.strokeStyle = '#111'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(320, -6); g.lineTo(bx, by - 8); g.stroke();
      g.fillStyle = '#1a1a1a'; g.fillRect(bx - 4, by - 10, 8, 6);
      const bulb = g.createRadialGradient(bx, by, 0, bx, by, 22);
      bulb.addColorStop(0, `rgba(255, 246, 220, ${Math.min(1, 0.95 * L)})`); bulb.addColorStop(0.25, `rgba(255, 210, 140, ${0.5 * L})`); bulb.addColorStop(1, 'rgba(255, 200, 120, 0)');
      g.fillStyle = bulb; g.fillRect(bx - 22, by - 22, 44, 44);
      const dark = g.createRadialGradient(lx, 230, 70, lx, 230, 400);
      dark.addColorStop(0, 'rgba(0, 0, 0, 0)'); dark.addColorStop(1, `rgba(0, 0, 0, ${clamp(0.9 - (L - 1) * 0.4, 0.4, 0.95)})`);
      g.fillStyle = dark; g.fillRect(-20, -20, W + 40, H + 40);
      if (L < 1) { g.fillStyle = `rgba(0, 0, 0, ${(1 - L) * 0.7})`; g.fillRect(-20, -20, W + 40, H + 40); }
      // the two things in here that make their own light
      monitor(t);
      paintEye(t);
      g.restore();

      // the waiver, on the table in front of you
      if (waiver) {
        g.save();
        g.translate(320, 284); g.rotate(-0.03);
        g.fillStyle = '#d8cfb8'; g.fillRect(-92, -64, 184, 128);
        g.fillStyle = 'rgba(80, 60, 30, .15)'; g.fillRect(-92, -64, 184, 128);
        g.fillStyle = '#1d1810'; g.font = `bold 8px ${SERIF}`; g.textAlign = 'center';
        g.fillText('GENERAL RELEASE OF LIABILITY', 0, -48);
        g.font = `7px ${SERIF}`; g.textAlign = 'left';
        ['The undersigned enters this room of her own will,', 'understands that every shot fired at this table', 'is final, and holds the dealer blameless for', 'whatever is, or is not, in the chamber.']
          .forEach((s, i) => g.fillText(s, -80, -30 + i * 11));
        g.fillStyle = '#1d1810'; g.fillRect(-70, 38, 140, 0.8);
        g.font = `6px ${SERIF}`; g.fillText('SIGNATURE', -70, 48);
        if (signed) { g.fillStyle = '#16204a'; g.font = `15px ${HAND}`; g.fillText('Snappy', -60, 34); }
        else if (Math.floor(t / 600) % 2) { g.fillStyle = '#7a1e1a'; g.font = `bold 8px ${MONO}`; g.textAlign = 'center'; g.fillText('click to sign', 0, 30); }
        g.restore();
      }
      // what you see through the glass
      if (peek && t - peek.t < 2200) {
        const a = Math.min(1, (t - peek.t) / 200, (2200 - (t - peek.t)) / 300);
        g.save(); g.globalAlpha = a;
        g.fillStyle = 'rgba(0, 0, 0, .7)'; g.beginPath(); g.arc(560, 120, 44, 0, TAU); g.fill();
        g.strokeStyle = '#a8843e'; g.lineWidth = 4; g.stroke();
        shell(g, 560, 140, peek.live, 1);
        g.fillStyle = peek.live ? '#ff6a5a' : '#8fb0ff'; g.font = `bold 10px ${MONO}`; g.textAlign = 'center';
        g.fillText(peek.live ? 'LIVE' : 'BLANK', 560, 96);
        g.restore();
      }
      // labels while you hold the gun or hover something
      g.font = `bold 11px ${MONO}`; g.textAlign = 'center';
      if (held) {
        g.fillStyle = hover === 'dealer' ? '#ff6a5a' : 'rgba(232, 224, 204, .55)';
        g.fillText('SHOOT THE DEALER', 320, 44);
        g.fillStyle = hover === 'self' ? '#ff6a5a' : 'rgba(232, 224, 204, .55)';
        g.fillText('SHOOT YOURSELF', 320, 352);
        g.fillStyle = 'rgba(232, 224, 204, .35)'; g.font = `9px ${MONO}`; g.fillText('click the table to put it down', 560, 352);
      } else if (turnMine && typeof hover === 'number' && me.items[hover]) {
        const it = ITEMS[me.items[hover]];
        g.fillStyle = '#e8e0cc'; g.fillText(it.name, MY_SLOTS[hover][0], 296);
        g.font = `9px ${MONO}`; g.fillStyle = 'rgba(232, 224, 204, .7)'; g.fillText(it.note, MY_SLOTS[hover][0], 306);
      } else if (turnMine && !line) {
        g.fillStyle = `rgba(232, 224, 204, ${0.35 + Math.sin(t / 300) * 0.15})`; g.font = `10px ${MONO}`;
        g.fillText(me.items.length ? 'take the shotgun, or use something' : 'take the shotgun', 320, 252);
      }
      // the words, typed out at the bottom
      if (line) {
        const per = line.who === 'p' ? 42 : 34;
        const shown = line.s.slice(0, Math.floor((t - line.t) / per));
        g.fillStyle = 'rgba(0, 0, 0, .55)'; g.fillRect(0, 316 - 4, W, 30);
        g.textAlign = 'center';
        g.font = line.who === 'p' ? `13px ${MONO}` : `italic 13px ${SERIF}`;
        g.fillStyle = line.who === 'p' ? '#9fe4ff' : '#efe8dc';
        g.fillText(shown, 320, 332);
      }
      // a round's title, stark and flickering
      if (card) {
        const age = t - card.t, a = Math.min(1, age / 400, (card.ms - age) / 500);
        if (a > 0) {
          g.fillStyle = `rgba(0, 0, 0, ${0.75 * a})`; g.fillRect(0, 0, W, H);
          g.globalAlpha = a * (Math.random() < 0.04 ? 0.4 : 1);
          g.fillStyle = '#e9e1cf'; g.font = `48px ${SERIF}`; g.textAlign = 'center';
          g.fillText(card.s, 320, 176);
          if (card.sub) { g.font = `12px ${MONO}`; g.fillStyle = 'rgba(233, 225, 207, .7)'; g.fillText(card.sub, 320, 206); }
          g.globalAlpha = 1;
        }
      }
      // grain, the dark at the edges, the flash of a shot, and the black after being hit
      g.globalAlpha = 0.5;
      g.drawImage(grain[Math.floor(t / 70) % grain.length], rand(-8, 0), rand(-8, 0), W + 8, H + 8);
      g.globalAlpha = 1;
      const edge = g.createRadialGradient(320, 190, 160, 320, 190, 420);
      edge.addColorStop(0, 'rgba(0, 0, 0, 0)'); edge.addColorStop(1, 'rgba(0, 0, 0, .8)');
      g.fillStyle = edge; g.fillRect(0, 0, W, H);
      if (flash > 0) { g.fillStyle = `rgba(255, 248, 235, ${Math.min(1, flash)})`; g.fillRect(0, 0, W, H); flash -= 0.08; }
      if (black > 0) { g.fillStyle = `rgba(0, 0, 0, ${Math.min(1, black)})`; g.fillRect(0, 0, W, H); }
      // how it ended, over everything
      if (ending) {
        const a = Math.min(1, (t - ending.t) / 900);
        g.fillStyle = `rgba(0, 0, 0, ${0.6 * a})`; g.fillRect(0, 0, W, H);
        g.globalAlpha = a * (Math.random() < 0.03 ? 0.5 : 1);
        g.textAlign = 'center';
        g.font = `44px ${SERIF}`; g.fillStyle = ending.won ? '#e9e1cf' : '#c8463c';
        g.fillText(ending.won ? 'YOU WALKED OUT' : 'GAME OVER', 320, 170);
        g.font = `12px ${MONO}`; g.fillStyle = 'rgba(233, 225, 207, .7)';
        g.fillText(`rounds survived: ${ending.rounds} of 3`, 320, 198);
        if (t - ending.t > 1600 && Math.floor(t / 700) % 2) g.fillText('click to continue', 320, 246);
        g.globalAlpha = 1;
      }
    }

    // the title card: the room in the dark, and the name
    const titleCard = (t) => {
      paint(t);
      g.fillStyle = 'rgba(0, 0, 0, .55)'; g.fillRect(0, 0, W, H);
      g.textAlign = 'center';
      g.fillStyle = `rgba(233, 225, 207, ${Math.random() < 0.03 ? 0.4 : 0.95})`;
      g.font = `40px ${SERIF}`; g.fillText('SNAPSHOT ROULETTE', 320, 168);
      g.font = `11px ${MONO}`; g.fillStyle = 'rgba(233, 225, 207, .55)';
      g.fillText('one bulb. one table. one shotgun.', 320, 194);
      if (Math.floor(t / 700) % 2) { g.fillStyle = 'rgba(233, 225, 207, .75)'; g.fillText('CLICK TO SIT DOWN', 320, 250); }
    };
    if (!(await scr.title('SNAPSHOT ROULETTE', '', 'CLICK THE SHOTGUN TO PICK IT UP · CLICK AN ITEM TO USE IT', titleCard))) await abandon(scr);
    const stopMusic = music('backroom', 6000);

    // the painter runs on its own, and takes the clicks; the game below waits on what they decide
    let choice = null, painting = true;
    (async () => {
      while (painting) {
        await scr.tick();
        const { x, y } = scr.mouse;
        hover = null;
        gunHot = false;
        if (waiver && !signed) hover = 'waiver';
        else if (held) hover = overDealer(x, y) ? 'dealer' : overSelf(x, y) ? 'self' : null;
        else if (turnMine) {
          const i = itemAt(x, y);
          if (i >= 0) hover = i;
          else if (overGun(x, y)) { hover = 'gun'; gunHot = true; }
        }
        if (held) aimAt = hover === 'self' ? 'me' : 'dealer';
        canvas.style.cursor = hover !== null ? 'pointer' : 'default';
        while (scr.click()) {
          if (ending) { endClick = true; continue; }
          if (waiver && !signed) { if (x > 228 && x < 412 && y > 220) { signed = true; Speech.tune('scratch', 0.4); } continue; }
          if (!turnMine || choice) continue;
          if (held) {
            if (hover === 'dealer' || hover === 'self') choice = { shoot: hover };
            else { held = false; gun = 'table'; aimAt = null; Speech.tune('clunk', 0.4); }
            continue;
          }
          if (typeof hover === 'number') choice = { use: hover };
          else if (hover === 'gun') { held = true; gun = 'mine'; aimAt = 'dealer'; Speech.tune('rack', 0.25); }
        }
        paint(performance.now());
      }
    })().catch(() => {});
    ctx.onEnd(() => { painting = false; canvas.style.cursor = ''; });

    // ---- the rules
    const counts = () => ({ live: shells.filter(Boolean).length, blank: shells.filter((s) => !s).length });
    const other = (who) => (who === me ? dealer : me);
    function rack(live) {
      Speech.tune('rack', 0.6);
      casings.push({ x: 380, y: 260, vx: rand(2.5, 4.5), vy: rand(-7, -5), r: 0, vr: rand(0.15, 0.3), live });
    }
    // round 3: under three charges, nothing brings them back
    const checkCut = async () => {
      if (round !== 3) return;
      for (const who of [me, dealer]) {
        if (!who.cut && who.charges > 0 && who.charges <= 2) {
          who.cut = true;
          Speech.tune('glitch', 0.4);
          await say('p', who === me ? 'Your charges will no longer be restored.' : 'Mine will not be restored either.', 900);
        }
      }
    };
    // one shot: who fires, at whom, and what was in the chamber
    async function fire(shooter, target) {
      quiet();
      gun = shooter === me ? 'mine' : 'its';
      aimAt = target === me ? 'me' : 'dealer';
      held = false;
      await ctx.wait(shooter === me ? 900 : 1500);
      const live = shells.shift();
      const damage = sawn ? 2 : 1;
      sawn = false;
      if (live) {
        Speech.tune('gunshot', 1);
        flash = 1.6; shake = 16; recoil = 1;
        const mx = aimAt === 'me' ? 320 : 320, my = aimAt === 'me' ? 250 : 170;
        for (let i = 0; i < 9; i++) puffs.push({ x: mx + rand(-20, 20), y: my + rand(-14, 14), vx: rand(-0.6, 0.6), vy: rand(-0.9, -0.2), r: rand(10, 22), a: 0.5 });
        target.charges = Math.max(0, target.charges - damage);
        if (target === me) {
          black = 1.4;
          Speech.tune('ring', 0.5);
          await ctx.wait(1400);
          for (let i = 0; i < 40; i++) { black = Math.max(0, black - 0.04); await ctx.wait(30); }
        } else {
          eyeOut = performance.now() + 1300;
          await ctx.wait(1500);
        }
        recoil = 0;
      } else {
        Speech.tune('dryfire', 0.9);
        await ctx.wait(700);
      }
      gun = 'table';
      aimAt = null;
      rack(live);
      await ctx.wait(500);
      return live;
    }

    async function useItem(who, id, quietly = false) {
      who.items.splice(who.items.indexOf(id), 1);
      if (id === 'glass') {
        Speech.tune('whoosh', 0.3);
        if (who === me) { peek = { live: shells[0], t: performance.now() }; await say('s', shells[0] ? 'Live.' : 'Blank.', 500); }
        else await say('p', 'Very interesting.', 600);
      } else if (id === 'beer') {
        const out = shells.shift();
        rack(out);
        await say(who === me ? 's' : 'p', who === me ? `It was ${out ? 'live' : 'a blank'}.` : 'Not this one.', 500);
      } else if (id === 'battery') {
        if (who.cut) { Speech.tune('dryfire', 0.6); await say('p', 'Nothing happens. The wires are cut.', 600); return; }
        if (who.charges < max) who.charges++;
        Speech.tune('charge', 0.7);
        lightBoost = 0.5; setTimeout(() => { lightBoost = 0; }, 500);
        if (!quietly) await say(who === me ? 's' : 'p', who === me ? 'Better.' : 'Recharging.', 400);
      } else if (id === 'saw') {
        Speech.tune('saw', 0.6);
        await ctx.wait(900);
        sawn = true;
        await say('p', who === me ? 'The barrel is shorter now.' : 'Two.', 500);
      } else if (id === 'cuffs') {
        Speech.tune('cuffs', 0.7);
        other(who).cuffed = true;
        await say('p', who === me ? '...' : 'Hold still.', 500);
      }
    }

    // The dealer plays it the way it should be played (worked out over every situation): with no blank known to be in
    // the chamber, it shoots you. Its things help it know: the glass when it's unsure, the beer to throw out a shell
    // that's more likely blank, the saw only on a live one, the cuffs before it shoots you.
    async function dealerTurn() {
      await ctx.wait(800);
      const has = (id) => dealer.items.includes(id);
      if (has('battery') && dealer.charges < max && !dealer.cut) await useItem(dealer, 'battery');
      let known = null, left = counts();
      const read = () => { left = counts(); if (!left.live) known = false; else if (!left.blank) known = true; };
      read();
      if (known === null && has('glass')) { await useItem(dealer, 'glass'); known = shells[0]; }
      while (known === null && has('beer') && left.live <= left.blank && shells.length > 1) {
        await useItem(dealer, 'beer');
        if (!shells.length) return 'empty';
        read();
      }
      const atMe = known !== false;
      if (atMe && has('cuffs') && !me.cuffed) await useItem(dealer, 'cuffs');
      if (atMe && known === true && has('saw') && !sawn) await useItem(dealer, 'saw');
      await say('p', atMe ? 'You.' : 'Myself.', 300);
      const hit = await fire(dealer, atMe ? me : dealer);
      if (atMe) await say('p', hit ? (me.charges ? 'You are still here.' : '...') : 'Lucky.', 500);
      else await say('p', hit ? '...Noted.' : 'Again.', 500);
      return atMe || hit ? 'pass' : 'again';
    }

    // ---- the waiver
    await ctx.wait(600);
    waiver = true;
    await say('p', 'Sign the waiver.', 300);
    await until(() => signed);
    await ctx.wait(800);
    waiver = false;
    await say('p', 'Good.', 600);

    let won = 0;
    for (round = 1; round <= 3 && !over; round++) {
      const r = ROUNDS[round - 1];
      max = r.charges;
      me.charges = dealer.charges = max;
      me.cut = dealer.cut = me.cuffed = dealer.cuffed = false;
      me.items = []; dealer.items = [];
      gun = 'dealer';
      card = { s: `ROUND ${ROMAN[round - 1]}`, sub: `${max} charges each`, t: performance.now(), ms: 2600 };
      Speech.tune('gunshot', 0.25);
      await ctx.wait(2700);
      card = null;
      if (round === 3) await say('s', 'This is it.', 500);
      // loads until someone is out of charges; who opens a load takes turns (whoever always went first would win two
      // rounds in three)
      let first = true, opener = me;
      while (me.charges && dealer.charges) {
        const total = Math.min(8, Math.floor(rand(2 + round, 4 + round * 1.4)));
        const live = clamp(Math.round(total * rand(0.34, 0.6)), 1, total - 1);
        shells = [...Array(live).fill(true), ...Array(total - live).fill(false)];
        showing = [...shells].sort((a, b) => b - a);
        gun = 'dealer';
        await say('p', `${live} live. ${total - live} blank.`, 900);
        if (round === 1 && first) await say('p', 'They enter the chamber in an order unknown.', 700);
        first = false;
        for (let i = shells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shells[i], shells[j]] = [shells[j], shells[i]]; }
        // into the gun, one by one
        for (loading = 0; loading < showing.length + 1; loading += 0.125) { if (loading % 1 === 0 && loading < showing.length) Speech.tune('shell', 0.5); await ctx.wait(32); }
        showing = null; loading = null;
        Speech.tune('rack', 0.6);
        gun = 'table';
        // a few things to help, from the second round on
        if (r.items) {
          for (const who of [me, dealer]) for (let i = 0; i < r.items && who.items.length < MAX_ITEMS; i++) who.items.push(pick(Object.keys(ITEMS)));
          Speech.tune('clunk', 0.5);
          await say('p', `${r.items} items each.`, 500);
        }
        let turn = opener;
        opener = other(opener);
        if (turn === dealer) await say('p', 'I go first.', 300);
        while (shells.length && me.charges && dealer.charges) {
          if (turn === me) {
            if (me.cuffed) { me.cuffed = false; Speech.tune('cuffs', 0.5); await say('p', 'Your hands are tied. My turn.', 400); turn = dealer; continue; }
            await say('p', pick(['Your turn.', 'Go on.', 'Your turn.']), 200);
            quiet();
            turnMine = true;
            choice = null;
            await until(() => choice);
            turnMine = false;
            if ('use' in choice) {
              const id = me.items[choice.use];
              if (id === 'cuffs' && dealer.cuffed) { await say('p', 'I am already restrained.', 300); continue; }
              if (id === 'saw' && sawn) { await say('p', 'It is already sawn.', 300); continue; }
              await useItem(me, id);
              if (!shells.length) break;
              continue;
            }
            const self = choice.shoot === 'self';
            if (self) await say('s', pick(['Steady.', '...', 'Come on.']), 0);
            const hit = await fire(me, self ? me : dealer);
            if (self && !hit) { await say('s', 'Still here.', 300); continue; }
            if (self && hit && me.charges) await say('s', pick(['...I am still here.', 'Not yet.']), 400);
            await checkCut();
            turn = dealer;
          } else {
            if (dealer.cuffed) { dealer.cuffed = false; Speech.tune('cuffs', 0.5); await say('p', '...', 300); turn = me; continue; }
            await say('p', 'My turn.', 300);
            const how = await dealerTurn();
            await checkCut();
            if (how === 'pass') turn = me;
          }
        }
        if (me.charges && dealer.charges) await say('p', 'Empty. Again.', 500);
      }
      if (!me.charges) { over = 'lost'; break; }
      won = round;
      Speech.tune('charge', 0.4);
      await say('p', round < 3 ? 'The round is yours.' : '...', 700);
    }
    if (!over) over = 'won';
    stopMusic();
    turnMine = false;

    // ---- the end: the room goes quiet, one way or the other
    await ctx.wait(600);
    if (over === 'won') {
      await say('p', 'You have won.', 900);
      await say('s', 'It is over.', 700);
      await say('p', 'The room will be here.', 1200);
    } else {
      Speech.tune('ring', 0.4);
      black = 1;
      await say('p', 'Game over.', 1400);
    }
    const record = Arcade.best('roulette', won);
    quiet();
    ending = { won: over === 'won', rounds: won, t: performance.now() };
    endClick = false;
    await until(() => (endClick && performance.now() - ending.t > 1600) || performance.now() - ending.t > 60000);
    painting = false;
    await scr.close();
    if (over === 'won') {
      await S('{flat}...', { hold: 600 });
      await S('{flat}Can we not do that again.', { hold: 500 });
      await P('The door does not close.', { hold: 900 });
    } else {
      await S('{sad}...', { hold: 600 });
      await P(won ? `${won} ${won === 1 ? 'round' : 'rounds'}. {pause}Then the dark.` : 'Not one round.', { hold: 600 });
      await S('{flat}Again. {pause}Tomorrow.', { hold: 500 });
      await P('The room will wait.', { hold: 900 });
    }
    if (record.beat && record.old !== null) await S(`{flat}${won} ${won === 1 ? 'round' : 'rounds'}. {pause}My best.`, { hold: 500 });
    await finish();
  }

  Events.define('roulette', {
    tier: 'game', title: 'Snapshot Roulette', hint: 'A room behind the arcade. A table. A shotgun. Sign here.', run: roulette, weight: 1,
    arcade: true, unit: 'rounds',
  });
})();
