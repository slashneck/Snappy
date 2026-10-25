// SnappyWare: tiny games, a few seconds each, one after another, faster and faster. Four lives. After ten of them,
// the Program runs the boss stage: thirty seconds of rules that change whenever it feels like it. Loud colors, thick
// outlines, a burning fuse and Snappy hosting between rounds.
(() => {
  const { vector: her, programEye } = Arcade;
  const W = 240, H = 180, TAU = Math.PI * 2;
  const INK = '#111';
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---- the house style: everything chunky, everything outlined
  function bold(g, s, x, y, size, fill = '#ffe600', rot = 0, fit = W - 24) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
    const wide = g.measureText(s).width + size * 0.3;
    if (wide > fit) g.scale(fit / wide, fit / wide);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = size * 0.28;
    g.strokeStyle = INK;
    g.strokeText(s, size * 0.06, size * 0.08);
    g.strokeText(s, 0, 0);
    g.fillStyle = fill;
    g.fillText(s, 0, 0);
    g.restore();
  }
  function blob(g, x, y, w, h, fill, r = 8) {
    g.beginPath(); g.roundRect(x, y, w, h, r);
    g.fillStyle = fill; g.fill();
    g.lineWidth = 2.4; g.strokeStyle = INK; g.stroke();
  }
  function sunburst(g, c1, c2, t, cx = W / 2, cy = H / 2) {
    g.fillStyle = c1; g.fillRect(0, 0, W, H);
    g.save();
    g.translate(cx, cy); g.rotate(t / 3000);
    g.fillStyle = c2;
    for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 300, (i / 16) * TAU, (i / 16) * TAU + TAU / 32); g.fill(); }
    g.restore();
  }
  function dots(g, color) {
    g.fillStyle = color;
    for (let y = 6; y < H; y += 12) for (let x = (y / 12) % 2 ? 6 : 12; x < W; x += 12) { g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
  }
  // a minion, cartoon style: a red lump, thick outline, one big eye
  function lump(g, x, y, s, t) {
    g.save();
    g.translate(x, y);
    g.scale(s, s * (1 + Math.sin(t / 90) * 0.05));
    g.beginPath(); g.ellipse(0, 0, 11, 10, 0, 0, TAU);
    g.fillStyle = '#ff4060'; g.fill(); g.lineWidth = 2.2; g.strokeStyle = INK; g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -1, 5, 0, TAU); g.fill(); g.lineWidth = 1.4; g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(Math.cos(t / 120) * 2, -1 + Math.sin(t / 120) * 2, 2.2, 0, TAU); g.fill();
    g.restore();
  }
  // the timer: a bomb with a fuse that burns down, and the last three seconds counted on it
  const STRIP = 20;
  function bomb(g, frac, t, secs) {
    const bx = 13, by = H - STRIP / 2, len = (W - 40) * frac;
    g.fillStyle = 'rgba(17, 17, 17, .78)'; g.fillRect(0, H - STRIP, W, STRIP);
    g.strokeStyle = '#a07a42'; g.lineWidth = 2.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(bx + 7, by);
    for (let x = 0; x <= len; x += 4) g.lineTo(bx + 9 + x, by + Math.sin(x / 9) * 1.5);
    g.stroke();
    if (frac > 0) {
      const sx = bx + 9 + len, sy = by + Math.sin(len / 9) * 1.5;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + t / 60; g.strokeStyle = i % 2 ? '#ffe600' : '#ff7a00'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * 5, sy + Math.sin(a) * 5); g.stroke(); }
    }
    g.fillStyle = INK; g.beginPath(); g.arc(bx, by, 8, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(bx - 3, by - 3, 2.5, 0, TAU); g.fill();
    if (secs <= 3 && frac < 0.8) bold(g, String(Math.max(1, secs)), bx, by + 1, 9, '#fff');
  }

  // Each tiny game: the command, how it starts, what counts as winning or losing, and how it looks.
  // A game that runs out of time without a result counts as `timeout`.
  const GAMES = [
    { cmd: 'SNAP IT!', timeout: 'lose',
      setup: (s) => { s.x = rnd(40, W - 40); s.y = rnd(50, H - 60); s.at = (t) => [s.x + Math.sin(t / 200) * 14, s.y + Math.cos(t / 260) * 8]; },
      update: (s, k) => {
        const [x, y] = s.at(performance.now());
        if (k.click && Math.hypot(k.mx - x, k.my - y) < 18) { Speech.tune('key', 1); return 'win'; }
        return null;
      },
      draw: (s, g, t, k) => {
        g.fillStyle = '#7fd6ff'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#6cd35a'; g.fillRect(0, H * 0.62, W, H * 0.38);
        g.lineWidth = 2.4; g.strokeStyle = INK; g.beginPath(); g.moveTo(0, H * 0.62); g.lineTo(W, H * 0.62); g.stroke();
        for (const [cx, cy] of [[40, 30], [170, 44]]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, cy, 20, 8, 0, 0, TAU); g.ellipse(cx + 12, cy - 5, 12, 8, 0, 0, TAU); g.fill(); }
        lump(g, ...s.at(t), 1.2, t);
        // the viewfinder follows the mouse
        g.strokeStyle = '#fff'; g.lineWidth = 2.5;
        const vx = k.mx, vy = k.my;
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(vx + dx * 20, vy + dy * 12); g.lineTo(vx + dx * 20, vy + dy * 20); g.lineTo(vx + dx * 12, vy + dy * 20); g.stroke(); }
        g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(W - 16, 14, 4, 0, TAU); g.fill();
      } },
    { cmd: 'DODGE!', timeout: 'win',
      setup: (s) => { s.drops = []; s.next = 0; },
      update: (s, k, dt) => {
        if ((s.next -= dt) <= 0) { s.drops.push({ x: rnd(10, W - 10), y: -10, r: rnd(0, TAU) }); s.next = 7 / k.speed; }
        for (const d of s.drops) { d.y += 2.6 * k.speed * dt; d.r += 0.1 * dt; if (Math.abs(d.x - k.mx) < 14 && Math.abs(d.y - (H - 46)) < 14) return 'lose'; }
        return null;
      },
      draw: (s, g, t, k) => {
        sunburst(g, '#ffd23f', '#ffbf00', t, W / 2, H);
        for (const d of s.drops) { g.save(); g.translate(d.x, d.y); g.rotate(d.r); blob(g, -7, -7, 14, 14, '#ff4060', 3); g.restore(); }
        her(g, Math.max(14, Math.min(W - 14, k.mx)), H - 46, 30, { legs: Math.floor(t / 120), eyes: 'shock' });
      } },
    { cmd: 'CATCH 3!', timeout: 'lose',
      setup: (s) => { s.frames = []; s.next = 0; s.got = 0; },
      update: (s, k, dt) => {
        if ((s.next -= dt) <= 0) { s.frames.push({ x: rnd(16, W - 16), y: -14 }); s.next = 22 / k.speed; }
        for (const f of s.frames) { f.y += 2 * k.speed * dt; if (!f.got && Math.abs(f.x - k.mx) < 16 && Math.abs(f.y - (H - 56)) < 10) { f.got = true; s.got++; Speech.tune('tick', 0.5); } }
        return s.got >= 3 ? 'win' : null;
      },
      draw: (s, g, t, k) => {
        sunburst(g, '#3fb6ff', '#2a9be6', t, W / 2, -20);
        dots(g, 'rgba(255,255,255,.15)');
        for (const f of s.frames) if (!f.got) { blob(g, f.x - 8, f.y - 10, 16, 20, '#ffe14a', 3); g.fillStyle = INK; for (let i = 0; i < 3; i++) { g.fillRect(f.x - 6, f.y - 8 + i * 6, 2, 3); g.fillRect(f.x + 4, f.y - 8 + i * 6, 2, 3); } }
        her(g, Math.max(14, Math.min(W - 14, k.mx)), H - 46, 30, { legs: Math.floor(t / 120), eyes: 'joy' });
        bold(g, `${s.got}/3`, W - 26, 26, 16, '#fff');
      } },
    { cmd: "DON'T CLICK!", timeout: 'win',
      setup: () => {},
      update: (s, k) => (k.click ? 'lose' : null),
      draw: (s, g, t) => {
        for (let x = -H; x < W; x += 24) { g.fillStyle = (x / 24) % 2 ? '#ffd400' : INK; g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.lineTo(x + H + 12, 0); g.lineTo(x + 12, H); g.fill(); }
        const k = 1 + Math.sin(t / 110) * 0.07;
        g.save(); g.translate(W / 2, H / 2 + 8); g.scale(k, k);
        g.fillStyle = '#666'; g.beginPath(); g.ellipse(0, 10, 52, 22, 0, 0, TAU); g.fill(); g.lineWidth = 2.6; g.strokeStyle = INK; g.stroke();
        const red = g.createRadialGradient(-12, -14, 4, 0, 0, 46);
        red.addColorStop(0, '#ff8a8a'); red.addColorStop(1, '#d0121e');
        g.fillStyle = red; g.beginPath(); g.ellipse(0, 0, 44, 22, 0, 0, TAU); g.fill(); g.stroke();
        bold(g, 'CLICK ME', 0, 0, 12, '#fff');
        g.restore();
      } },
    { cmd: 'CLICK THE WRONG ONE!', timeout: 'lose',
      setup: (s) => { s.flip = Math.random() < 0.5; s.swapAt = 30; },
      update: (s, k, dt) => {
        if ((s.swapAt -= dt) <= 0) { s.flip = !s.flip; s.swapAt = 40 / k.speed; }
        if (!k.click) return null;
        return (k.mx < W / 2) === s.flip ? 'win' : 'lose';
      },
      draw: (s, g, t) => {
        sunburst(g, '#b15cff', '#9a3dff', t);
        const button = (x, label, c) => { blob(g, x, 72, 96, 44, c, 14); bold(g, label, x + 48, 94, 15, '#fff'); };
        button(14, s.flip ? 'WRONG' : 'RIGHT', s.flip ? '#ff3b4e' : '#2ecc57');
        button(W - 110, s.flip ? 'RIGHT' : 'WRONG', s.flip ? '#2ecc57' : '#ff3b4e');
      } },
    { cmd: 'MASH!', timeout: 'lose',
      setup: (s) => { s.charge = 0; },
      update: (s, k) => { if (k.press) { s.charge += 1; snappy.call('sound.blip', { pitch: 600 + s.charge * 40, volume: Speech.volume * 0.5 }).catch(() => {}); } return s.charge >= 14 ? 'win' : null; },
      draw: (s, g, t) => {
        sunburst(g, '#ff5aa8', '#ff3d94', t);
        // she blows up a balloon, one press at a time
        const r = 8 + s.charge * 2.4;
        g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W / 2 + 26, 120); g.quadraticCurveTo(W / 2 + 40, 100, W / 2 + 44, 96 - r * 0.2); g.stroke();
        g.fillStyle = '#4ad4ff'; g.beginPath(); g.ellipse(W / 2 + 46, 86 - r, r * 0.9, r, 0, 0, TAU); g.fill(); g.lineWidth = 2.4; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(W / 2 + 40, 80 - r * 1.4, r * 0.18, r * 0.3, -0.5, 0, TAU); g.fill();
        her(g, W / 2 - 10, 128, 44, { eyes: s.charge % 2 ? 'closed' : 'wince', squash: s.charge % 2 ? 0.5 : 0 });
        bold(g, 'SPACE OR CLICK!', W / 2, 150, 11, '#fff');
      } },
    { cmd: 'JUMP!', timeout: 'win',
      setup: (s) => { s.x = W + 10; s.y = 0; s.vy = 0; },
      update: (s, k, dt) => {
        s.x -= 3.2 * k.speed * dt;
        if (k.press && s.y === 0) s.vy = -6;
        s.vy += 0.4 * dt; s.y = Math.min(0, s.y + s.vy * dt);
        if (s.x < 76 && s.x > 44 && s.y > -16) return 'lose';
        return null;
      },
      draw: (s, g, t) => {
        g.fillStyle = '#ffb347'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(190, 50, 26, 0, TAU); g.fill();
        g.fillStyle = '#c96b2c'; g.fillRect(0, 140, W, 40); g.lineWidth = 2.4; g.strokeStyle = INK; g.beginPath(); g.moveTo(0, 140); g.lineTo(W, 140); g.stroke();
        lump(g, s.x, 128, 1.1, t);
        her(g, 60, 122 + s.y, 30, { legs: s.y < 0 ? 'air' : Math.floor(t / 100), eyes: s.y < 0 ? 'joy' : 'open' });
      } },
    { cmd: 'TYPE IT!', timeout: 'lose',
      setup: (s) => { s.word = ['SNAP', 'CLIP', 'LAG', 'SAVE'][Math.floor(Math.random() * 4)]; s.at = 0; },
      update: (s, k) => {
        for (const key of k.typed) { if (key.toUpperCase() === s.word[s.at]) { s.at++; Speech.tune('key', 0.6); } }
        return s.at >= s.word.length ? 'win' : null;
      },
      draw: (s, g) => {
        sunburst(g, '#2ecc57', '#22b34a', performance.now());
        const n = s.word.length, x0 = W / 2 - (n * 40) / 2;
        [...s.word].forEach((ch, i) => {
          const done = i < s.at;
          blob(g, x0 + i * 40 + 3, 70 + (done ? 4 : 0), 34, 34, done ? '#ffe600' : '#fff', 6);
          bold(g, ch, x0 + i * 40 + 20, 88 + (done ? 4 : 0), 18, done ? '#fff' : '#ff3b4e');
        });
      } },
    { cmd: 'HOW MANY?', timeout: 'lose',
      setup: (s) => { s.n = 2 + Math.floor(Math.random() * 4); s.spots = Array.from({ length: s.n }, () => [rnd(30, W - 30), rnd(30, 92)]); s.answers = [s.n - 1, s.n, s.n + 1].sort(() => Math.random() - 0.5); },
      update: (s, k) => {
        if (!k.click || k.my < 104) return null;
        return s.answers[Math.min(2, Math.floor(k.mx / (W / 3)))] === s.n ? 'win' : 'lose';
      },
      draw: (s, g, t) => {
        sunburst(g, '#ff8a3d', '#ff7020', t);
        s.spots.forEach(([x, y], i) => lump(g, x, y, 1, t + i * 300));
        s.answers.forEach((n, i) => { blob(g, i * 80 + 14, 112, 52, 36, '#fff', 18); bold(g, String(n), i * 80 + 40, 131, 18, '#3fb6ff'); });
      } },
  ];

  async function ware(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    const before = Arcade.top('ware');
    if (Events.has('ware') && before !== null) {
      await S(`{shine}SnappyWare! {pause}Again! {pause}My best is ${before}.`, { hold: 300 });
      await P('The button still says click me.', { hold: 500 });
      await S("{angry}I'm not falling for it this time.", { hold: 500 });
    } else {
      await S('{shine}SnappyWare! {pause}Tiny games. {pause}Very fast.', { hold: 300 });
      await P('How fast?', { hold: 500 });
      await S('{smug}Yes.', { hold: 600 });
    }
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g } = scr;
    const titleCard = (t) => {
      sunburst(g, '#ffe600', '#ffd000', t);
      dots(g, 'rgba(0,0,0,.08)');
      bold(g, 'SNAPPY', W / 2, 46, 34, '#ff3b4e', -0.06);
      bold(g, 'WARE', W / 2 + 18, 82, 38, '#3fb6ff', 0.05);
      her(g, 52, 128 + Math.sin(t / 160) * 4, 46, { eyes: 'joy', tilt: Math.sin(t / 300) * 0.15 });
      if (Math.floor(t / 450) % 2) bold(g, 'PRESS ANY KEY!', W / 2 + 30, 150, 12, '#fff');
    };
    if (!(await scr.title('SNAPPYWARE', '', 'READ THE COMMAND · THEN DO IT', titleCard))) await abandon(scr);
    let stop = music('ware', 2400);
    const typed = [];
    const onType = (e) => { if (e.key.length === 1) typed.push(e.key); };
    addEventListener('keydown', onType, true);
    ctx.onEnd(() => removeEventListener('keydown', onType, true));
    let lives = 4, won = 0, played = 0, speed = 0.7, boss = false;

    // between rounds: her stage, the number of the next game, the lives as little heads, and how she feels about it
    const interlude = async (mood, banner) => {
      for (let i = 0; i < (banner ? 120 : 90); i++) {
        await scr.tick();
        const t = performance.now();
        sunburst(g, boss ? '#2a2140' : '#ffe600', boss ? '#3a2d5c' : '#ffd000', t);
        dots(g, boss ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)');
        const hop = mood === 'win' ? Math.abs(Math.sin(i / 5)) * 14 : 0;
        her(g, 54, 104 - hop, 52, { eyes: mood === 'win' ? 'joy' : mood === 'lose' ? 'wince' : 'open', tilt: mood === 'lose' ? Math.sin(i / 2) * 0.08 : 0 });
        if (boss) programEye(g, W - 24, 26, 14, { look: Math.sin(t / 400), alert: true });
        const k = 1 + Math.max(0, 0.4 - i * 0.03);
        g.save(); g.translate(W / 2 + 34, 84); g.scale(k, k);
        g.fillStyle = INK; g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill();
        bold(g, String(played + 1), 0, 2, 26, '#ff3b4e');
        g.restore();
        for (let l = 0; l < 4; l++) {
          const gone = l >= lives, popping = mood === 'lose' && l === lives && i < 20;
          her(g, W / 2 - 30 + l * 30, 152 - (popping ? i : 0), 20, { eyes: gone ? 'x' : 'happy', body: gone ? '#9a9a9a' : undefined });
        }
        if (banner && i > 10) bold(g, banner, W / 2, 30, 22, boss ? '#ff4060' : '#ff3b4e', Math.sin(i / 4) * 0.04);
      }
    };

    // one tiny game: the command slams in over it, then a few seconds on the fuse
    const play = async (game, gameSpeed) => {
      const st = {};
      game.setup(st);
      scr.click(); scr.tap(' ');
      typed.length = 0;
      const time = 180 / gameSpeed;
      let left = time, result = null, shown = 0;
      while (!result) {
        const dt = await scr.tick();
        const t = performance.now();
        shown += dt;
        const intro = shown < 54;
        if (!intro) left -= dt;
        const click = intro ? (scr.click(), false) : scr.click();
        const ctl = { mx: scr.mouse.x, my: scr.mouse.y, click, press: !intro && (scr.tap(' ', 'arrowup', 'w') || click), typed: intro ? [] : typed.splice(0), speed: gameSpeed };
        if (!intro) result = game.update(st, ctl, dt) || (left <= 0 ? game.timeout : null);
        game.draw(st, g, t, ctl);
        if (intro) {
          const k = shown < 10 ? 2.6 - (shown / 10) * 1.6 : 1;
          g.fillStyle = `rgba(0,0,0,${Math.max(0, 0.35 - shown / 100)})`; g.fillRect(0, 0, W, H);
          bold(g, game.cmd, W / 2, H / 2, (game.cmd.length > 12 ? 17 : 26) * k, '#ffe600', -0.05);
        }
        bomb(g, Math.max(0, left / time), t, Math.ceil((left / 60)));
      }
      Speech.tune(result === 'win' ? 'coin' : 'crash', result === 'win' ? 0.5 : 0.2);
      for (let i = 0; i < 30; i++) {
        await scr.tick();
        bold(g, result === 'win' ? 'YEAH!' : 'NOPE!', W / 2, H / 2, 30 + Math.min(i, 16) * 0.6, result === 'win' ? '#2ecc57' : '#ff3b4e', result === 'win' ? 0.08 : -0.08);
      }
      return result === 'win';
    };

    const order = [...GAMES].sort(() => Math.random() - 0.5);
    let mood = 'start';
    for (let i = 0; i < 10 && lives > 0; i++) {
      const faster = i && i % 3 === 0;
      if (faster) speed += 0.22;
      await interlude(mood, faster ? 'SPEED UP!' : '');
      played++;
      if (await play(order[i % order.length], speed)) { won++; mood = 'win'; } else { lives--; mood = 'lose'; }
    }
    // the boss stage: the Program, thirty seconds, no mercy
    if (lives > 0) {
      stop();
      boss = true;
      Speech.tune('sting', 0.6);
      await interlude(mood, 'BOSS STAGE!');
      stop = music('battle', 3400);
      const end = performance.now() + 30000;
      while (performance.now() < end && lives > 0) {
        played++;
        if (await play(GAMES[Math.floor(Math.random() * GAMES.length)], 1.6)) won++;
        else lives--;
      }
      boss = lives > 0;
    }
    stop();
    for (let i = 0; i < 70; i++) {
      await scr.tick();
      sunburst(g, lives > 0 ? '#ffe600' : '#555', lives > 0 ? '#ffd000' : '#444', performance.now());
      her(g, W / 2, 100 + (lives > 0 ? -Math.abs(Math.sin(i / 5)) * 12 : 0), 56, { eyes: lives > 0 ? 'joy' : 'x' });
      bold(g, lives > 0 ? 'YOU DID IT!' : 'GAME OVER', W / 2, 36, 24, lives > 0 ? '#ff3b4e' : '#fff');
      bold(g, `${won} / ${played}`, W / 2, 158, 18, '#fff');
    }
    await scr.close();
    const record = Arcade.best('ware', won);
    await S(`{joy}${won} out of ${played}!${record.beat && record.old !== null ? ' {pause}{shine}A new best!' : ''}`, { hold: 400 });
    if (boss) {
      await P('You survived the boss stage.', { hold: 400 });
      await P('Your reflexes are adequate.', { hold: 500 });
      await S("{wink}That's Program for 'amazing'.", { hold: 700 });
    } else {
      await P('Some of those were very easy.', { hold: 500 });
      await S("{angry}The button SAID click me!", { shout: true, hold: 700 });
    }
    await finish();
  }

  Events.define('ware', {
    tier: 'game', title: 'SnappyWare', hint: 'Tiny games. Very fast.', run: ware, weight: 1, again: true,
  });
})();
