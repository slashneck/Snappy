// Snappy Miami: one floor, top down, neon. WASD to move, aim with the mouse, click to flash. One flash puts one of the
// Lag's goons to sleep; one touch from a goon who's seen you (or one glitch bolt from the ones with guns) puts you
// down, and R starts the floor over instantly.
// Before any of that: picking a mask. That part takes her a while.
(() => {
  const W = 480, H = 270, T = 22, COLS = 20, ROWS = 12, OX = 20, OY = 3, TAU = Math.PI * 2;
  const MAP = [
    '####################',
    '#S.....#....G......#',
    '#......#...........#',
    '#...E..#.......E...#',
    '#..........#####..##',
    '#####..#...#.G.#...#',
    '#...#..#...#...#...#',
    '#.E.#....E.#...#.E.#',
    '#...####..##...##..#',
    '#.........E........#',
    '#..........#....G..X',
    '####################',
  ];
  const MASKS = [
    { name: 'THE LENS CAP', note: ['Mysterious.', 'Cannot see much.'], color: '#1b1b22' },
    { name: 'THE TRIPOD', note: ['Very stable.', 'Very tall.'], color: '#8a8f9c' },
    { name: 'THE FLASHBULB', note: ['Dramatic. Bright.', 'Loud.'], color: '#ffe680' },
    { name: 'THE BLUSH', note: ['Just her cheeks,', 'but more.'], color: '#ff9db0' },
  ];
  const wall = (c, r) => !MAP[r] || MAP[r][c] === undefined || MAP[r][c] === '#';
  const solid = (x, y) => wall(Math.floor((x - OX) / T), Math.floor((y - OY) / T));
  const mmss = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  // can a see b? a line through the tiles, no walls in the way
  const sees = (ax, ay, bx, by) => {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) if (solid(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n)) return false;
    return true;
  };
  // big slanted letters with a pink and a cyan shadow, the way that game writes everything
  function neon(g, s, x, y, size, color = '#fff', align = 'center', rot = 0) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.font = `italic 900 ${size}px "Arial Black", Impact, sans-serif`; g.textAlign = align;
    g.fillStyle = '#ff2fa0'; g.fillText(s, 2.5, 2.5);
    g.fillStyle = '#29e3ff'; g.fillText(s, -1.5, -1);
    g.fillStyle = color; g.fillText(s, 0, 0);
    g.restore();
  }

  async function miami(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    const before = Arcade.top('miami');
    if (before !== null) {
      await S(`{smug}Snappy Miami. {pause}Again. {pause}My best is ${before.toLocaleString('en-US')}.`, { hold: 300 });
      await P('Please pick a mask quickly this time.', { hold: 500 });
      await S('{wink}No promises.', { hold: 300 });
    } else {
      await S('{shine}Snappy Miami! {pause}One floor. {pause}Very stylish.', { hold: 300 });
      await P('There are goons on that floor. {pause}Minions of the Lag, in suits.', { hold: 400 });
      await S('{smug}Then I need a dramatic entrance.', { hold: 300 });
      await P('You need to go in and come out.', { hold: 600 });
    }
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g, canvas } = scr;
    // the city behind everything: slow pink and cyan waves
    const city = (t) => {
      const bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, `hsl(${300 + Math.sin(t / 2000) * 20}, 80%, 22%)`); bg.addColorStop(1, `hsl(${190 + Math.sin(t / 2600) * 20}, 80%, 18%)`);
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255, 80, 200, .12)'; g.lineWidth = 6;
      for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(-50, i * 34 + ((t / 30) % 34)); g.lineTo(W + 50, i * 34 + ((t / 30) % 34) - 80); g.stroke(); }
    };
    const titleCard = (t) => {
      city(t);
      neon(g, 'SNAPPY', W / 2, 108, 46, '#fff', 'center', -0.05 + Math.sin(t / 900) * 0.02);
      neon(g, 'MIAMI', W / 2 + 20, 158, 46, '#ffd1f0', 'center', -0.05 + Math.sin(t / 900 + 1) * 0.02);
      if (Math.floor(t / 500) % 2) neon(g, 'CLICK TO START', W / 2, 220, 13);
    };
    if (!(await scr.title('SNAPPY MIAMI', '', 'WASD MOVE · MOUSE AIM · CLICK FLASH · R RESTART', titleCard))) await abandon(scr);
    const stop = music('miami', 4440);

    // ---- the mask. She has opinions.
    const choosingFrom = performance.now();
    const OBJECTIONS = ['Hmm. No. Not dramatic enough.', 'Wait. No. The one before was better. Pick again.', null];
    let mask = null, sub = null;
    for (const objection of OBJECTIONS) {
      while (scr.click()) { /* nothing */ }
      let picked = null;
      while (picked === null) {
        await scr.tick();
        const t = performance.now(), { x, y } = scr.mouse;
        city(t);
        neon(g, 'PICK YOUR ENTRANCE', W / 2, 40, 22);
        const over = MASKS.findIndex((_, i) => Math.abs(x - (75 + i * 110)) < 48 && y > 60 && y < 200);
        MASKS.forEach((m, i) => {
          const cx = 75 + i * 110, lift = over === i ? -6 : 0;
          g.fillStyle = over === i ? 'rgba(255, 255, 255, .16)' : 'rgba(0, 0, 0, .35)'; g.fillRect(cx - 48, 62 + lift, 96, 136);
          g.fillStyle = m.color; g.beginPath(); g.ellipse(cx, 112 + lift, 30, 34, 0, 0, TAU); g.fill();
          g.fillStyle = '#0a0a0a'; g.fillRect(cx - 16, 104 + lift, 8, 12); g.fillRect(cx + 8, 104 + lift, 8, 12);
          g.font = 'italic 900 11px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(m.name, cx, 168 + lift);
          g.font = '600 9px "Segoe UI", sans-serif'; g.fillStyle = '#ffd1f0';
          m.note.forEach((part, k) => g.fillText(part, cx, 182 + lift + k * 11));
        });
        if (sub) { g.font = '600 12px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillStyle = sub.who === 'p' ? '#7ee8ff' : '#ff9db0'; g.fillText(sub.text, W / 2, 238); }
        canvas.style.cursor = over >= 0 ? 'pointer' : 'default';
        if (scr.click() && over >= 0) picked = over;
      }
      Speech.tune('tick', 0.7);
      mask = MASKS[picked];
      if (objection) { sub = { text: objection, who: 's' }; Speech.blip(false, 1.1); }
    }
    canvas.style.cursor = 'crosshair';
    const choosing = performance.now() - choosingFrom;
    sub = { text: 'PERFECT. Let us go.', who: 's' };
    for (let i = 0; i < 70; i++) { await scr.tick(); city(performance.now()); neon(g, mask.name, W / 2, 120, 30); g.font = '600 12px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ff9db0'; g.fillText(sub.text, W / 2, 160); }

    // ---- the floor
    // what each room's floor is made of, by where it is
    const floorOf = (c, r) => (r <= 3 && c <= 6 ? 'check' : r <= 3 ? 'wood' : c >= 12 && c <= 14 && r >= 5 && r <= 8 ? 'tile' : 'carpet');
    const spawn = () => {
      const foes = [];
      let me = null;
      MAP.forEach((row, r) => [...row].forEach((ch, c) => {
        const x = OX + c * T + T / 2, y = OY + r * T + T / 2;
        if (ch === 'S') me = { x, y, dead: false };
        if (ch === 'E' || ch === 'G') {
          // goons with nothing to do walk a few steps back and forth along the open side
          const across = !wall(c - 1, r) && !wall(c + 1, r);
          foes.push({ x, y, gun: ch === 'G', face: Math.random() * TAU, alert: 0, down: 0, shot: 0, patrol: across ? [x - T, x + T] : null, dir: 1 });
        }
      }));
      return { me, foes, bolts: [] };
    };
    let { me, foes, bolts } = spawn();
    let deaths = 0, score = 0, combo = 0, lastKO = 0, lastFlash = 0, flash = null, floorFrom = performance.now(), cleared = false, done = false;
    const exit = { x: OX + 19 * T + T / 2, y: OY + 10 * T + T / 2 };
    const restart = () => { ({ me, foes, bolts } = spawn()); combo = 0; score = 0; cleared = false; Speech.tune('rewind', 0.2); };
    const move = (o, dx, dy, r = 7) => {
      if (dx && !solid(o.x + dx + Math.sign(dx) * r, o.y - r + 1) && !solid(o.x + dx + Math.sign(dx) * r, o.y + r - 1)) o.x += dx;
      if (dy && !solid(o.x - r + 1, o.y + dy + Math.sign(dy) * r) && !solid(o.x + r - 1, o.y + dy + Math.sign(dy) * r)) o.y += dy;
    };
    const shadow = (x, y, rx = 9) => { g.fillStyle = 'rgba(0, 0, 0, .35)'; g.beginPath(); g.ellipse(x + 2, y + 4, rx, rx * 0.6, 0, 0, TAU); g.fill(); };
    while (!done) {
      const dt = await scr.tick();
      const t = performance.now();
      if (scr.tap('r')) { restart(); continue; }
      const aim = Math.atan2(scr.mouse.y - me.y, scr.mouse.x - me.x);
      if (!me.dead) {
        const ix = (scr.held('d', 'arrowright') ? 1 : 0) - (scr.held('a', 'arrowleft') ? 1 : 0), iy = (scr.held('s', 'arrowdown') ? 1 : 0) - (scr.held('w', 'arrowup') ? 1 : 0);
        const len = Math.hypot(ix, iy) || 1;
        move(me, (ix / len) * 1.9 * dt, (iy / len) * 1.9 * dt);
        // the flash: everyone in a short cone in front of her, who isn't behind a wall, goes down
        if (scr.click() && t - lastFlash > 450) {
          lastFlash = t;
          flash = { at: t, aim };
          snappy.call('sound.snap', { volume: Speech.volume * 0.7 }).catch(() => {});
          for (const f of foes) {
            if (f.down) continue;
            const d = Math.hypot(f.x - me.x, f.y - me.y), a = Math.atan2(f.y - me.y, f.x - me.x);
            const off = Math.abs(((a - aim + Math.PI * 3) % TAU) - Math.PI);
            if (d < 34 && off < 0.6 && sees(me.x, me.y, f.x, f.y)) {
              f.down = t;
              combo = t - lastKO < 2500 ? combo + 1 : 1;
              lastKO = t;
              score += 500 * combo;
              Speech.tune('clunk', 0.5);
            }
          }
        }
        if (!cleared && foes.every((f) => f.down)) { cleared = true; Speech.tune('chime', 0.4); }
        if (cleared && Math.hypot(me.x - exit.x, me.y - exit.y) < 16) done = true;
      } else if (scr.click()) restart();
      // the goons: on patrol until they see her; a moment later they come for her, or shoot from where they stand
      for (const f of foes) {
        if (f.down) continue;
        const d = Math.hypot(me.x - f.x, me.y - f.y);
        const spotted = !me.dead && d < 190 && sees(f.x, f.y, me.x, me.y);
        if (!f.alert && spotted) {
          f.alert = t;
          f.shot = t - 500;
          Speech.tune('tick', 0.35);
          // and they shout: anyone close by comes too
          for (const o of foes) if (!o.down && !o.alert && Math.hypot(o.x - f.x, o.y - f.y) < 100) { o.alert = t + 200; o.shot = t - 300; }
        }
        if (f.alert && t - f.alert > 250 && !me.dead) {
          f.face = Math.atan2(me.y - f.y, me.x - f.x);
          if (f.gun && spotted && d > 50) {
            if (t - f.shot > 1100) { f.shot = t; bolts.push({ x: f.x, y: f.y, vx: Math.cos(f.face) * 3.4, vy: Math.sin(f.face) * 3.4 }); Speech.tune('glitch', 0.15); }
          } else move(f, Math.cos(f.face) * 1.75 * dt, Math.sin(f.face) * 1.75 * dt);
          if (d < 12) { me.dead = true; deaths++; Speech.tune('crash', 0.25); }
        } else if (f.patrol && !f.alert) {
          f.x += f.dir * 0.6 * dt; f.face = f.dir > 0 ? 0 : Math.PI;
          if (f.x < f.patrol[0] || f.x > f.patrol[1]) f.dir *= -1;
        }
      }
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (solid(b.x, b.y)) { bolts.splice(i, 1); continue; }
        if (!me.dead && Math.hypot(b.x - me.x, b.y - me.y) < 7) { me.dead = true; deaths++; bolts.splice(i, 1); Speech.tune('crash', 0.25); }
      }

      // ---- the picture, swaying a little
      city(t);
      g.save();
      g.translate(W / 2, H / 2); g.rotate(Math.sin(t / 1700) * 0.025); g.scale(1.02, 1.02); g.translate(-W / 2, -H / 2);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const x = OX + c * T, y = OY + r * T;
        if (MAP[r][c] === '#') continue;
        const kind = floorOf(c, r);
        if (kind === 'check') { g.fillStyle = '#f2f2f2'; g.fillRect(x, y, T, T); g.fillStyle = '#141414'; g.fillRect(x, y, T / 2, T / 2); g.fillRect(x + T / 2, y + T / 2, T / 2, T / 2); }
        else if (kind === 'wood') { g.fillStyle = '#7a4a2a'; g.fillRect(x, y, T, T); g.fillStyle = '#5e3820'; for (let k = 0; k < T; k += 6) g.fillRect(x, y + k, T, 1); g.fillRect(x + ((r * 7) % T), y, 1, T); }
        else if (kind === 'tile') { g.fillStyle = '#1f8a8a'; g.fillRect(x, y, T, T); g.fillStyle = '#56c8c0'; g.fillRect(x + 1, y + 1, T / 2 - 2, T / 2 - 2); g.fillRect(x + T / 2 + 1, y + T / 2 + 1, T / 2 - 2, T / 2 - 2); }
        else { g.fillStyle = (r + c) % 2 ? '#4a1f5a' : '#53246a'; g.fillRect(x, y, T, T); g.fillStyle = 'rgba(255, 120, 220, .12)'; g.fillRect(x + T / 2 - 1, y + T / 2 - 1, 2, 2); }
      }
      // the walls: dark, with a bright edge wherever they meet the floor
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (MAP[r][c] !== '#') continue;
        const x = OX + c * T, y = OY + r * T;
        g.fillStyle = '#100c16'; g.fillRect(x, y, T, T);
        g.fillStyle = '#efe4fb';
        if (!wall(c, r + 1)) g.fillRect(x, y + T - 3, T, 3);
        if (!wall(c, r - 1)) g.fillRect(x, y, T, 3);
        if (!wall(c - 1, r)) g.fillRect(x, y, 3, T);
        if (!wall(c + 1, r)) g.fillRect(x + T - 3, y, 3, T);
      }
      if (cleared) { g.fillStyle = `rgba(41, 227, 255, ${0.4 + Math.sin(t / 150) * 0.3})`; g.fillRect(exit.x - 11, exit.y - 11, 22, 22); }
      for (const f of foes) {
        if (!f.down) continue;
        // a puddle of glitch where they fell, and stars
        g.fillStyle = 'rgba(160, 60, 255, .55)'; g.beginPath(); g.ellipse(f.x + 3, f.y + 2, 14, 9, 0.4, 0, TAU); g.fill();
        g.save(); g.translate(f.x, f.y); g.rotate(0.5);
        g.fillStyle = '#0a0a0a'; g.beginPath(); g.ellipse(0, 0, 10.5, 7, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8e4dc'; g.beginPath(); g.ellipse(0, 0, 9, 5.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#c45060'; g.beginPath(); g.arc(9, 0, 4.5, 0, TAU); g.fill();
        g.strokeStyle = '#111'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(7, -2); g.lineTo(10, 1); g.moveTo(10, -2); g.lineTo(7, 1); g.stroke();
        g.restore();
        g.fillStyle = '#ffe680';
        for (let i = 0; i < 3; i++) { const a = t / 300 + (i * TAU) / 3; g.fillRect(f.x + Math.cos(a) * 9 - 1, f.y - 10 + Math.sin(a) * 3 - 1, 2.5, 2.5); }
      }
      for (const f of foes) {
        if (f.down) continue;
        shadow(f.x, f.y);
        g.save(); g.translate(f.x, f.y); g.rotate(f.face);
        // a white suit, a red minion head, and a bat or a glitch gun
        g.fillStyle = '#0a0a0a'; g.beginPath(); g.ellipse(0, 0, 8.5, 10.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#f2efe9'; g.beginPath(); g.ellipse(0, 0, 7, 9, 0, 0, TAU); g.fill();
        if (f.gun) { g.fillStyle = '#0a0a0a'; g.fillRect(6, 3, 10, 4); g.fillStyle = '#b84aff'; g.fillRect(7, 4, 8, 2); }
        else { g.fillStyle = '#0a0a0a'; g.fillRect(5, -9, 4, 13); g.fillStyle = '#a8794a'; g.fillRect(6, -8, 2, 11); }
        g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(2, 0, 5.8, 0, TAU); g.fill();
        g.fillStyle = '#ff5a6e'; g.beginPath(); g.arc(2, 0, 4.6, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(4.2, 0, 1.8, 0, TAU); g.fill();
        g.restore();
        if (f.alert) { g.fillStyle = '#ffe680'; g.font = '900 12px "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText('!', f.x, f.y - 13); }
      }
      for (const b of bolts) {
        g.strokeStyle = '#ff4aff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * 3, b.y - b.vy * 3); g.stroke();
        g.fillStyle = '#fff'; g.fillRect(b.x - 1, b.y - 1, 2.5, 2.5);
      }
      if (flash && t - flash.at < 160) {
        g.fillStyle = `rgba(255, 255, 255, ${0.75 * (1 - (t - flash.at) / 160)})`;
        g.beginPath(); g.moveTo(me.x, me.y); g.arc(me.x, me.y, 38, flash.aim - 0.6, flash.aim + 0.6); g.closePath(); g.fill();
      }
      // her, from above, in her mask, the camera out in front
      shadow(me.x, me.y);
      g.save(); g.translate(me.x, me.y); g.rotate(me.dead ? 1.2 : aim);
      g.fillStyle = '#0a0a0a'; g.fillRect(7, -3, 8, 6); g.fillStyle = '#ffe680'; g.fillRect(13, -2, 2, 4);
      g.fillStyle = '#0a0a0a'; g.beginPath(); g.roundRect(-9, -8, 18, 16, 5); g.fill();
      g.fillStyle = me.dead ? '#cfcfcf' : '#f4f4f4'; g.beginPath(); g.roundRect(-7.5, -6.5, 15, 13, 4); g.fill();
      g.fillStyle = mask.color; g.beginPath(); g.roundRect(-2.5, -6.5, 9.5, 13, 4); g.fill();
      g.fillStyle = '#ff3b30'; g.fillRect(5, -1, 2.5, 2);
      g.restore();
      g.restore();
      // scanlines and a dark edge, like an old screen at night
      g.fillStyle = 'rgba(0, 0, 0, .07)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
      const edge = g.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 300);
      edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(20, 0, 30, .55)');
      g.fillStyle = edge; g.fillRect(0, 0, W, H);
      // the score, the combo, the floor
      neon(g, 'FLOOR 1', 12, 24, 16, '#fff', 'left');
      neon(g, `${Math.round(score)} PTS`, W - 10, 24, 16, '#fff', 'right');
      if (combo > 1 && t - lastKO < 2500) neon(g, `${combo}X COMBO`, 12, 46, 13, '#ffe680', 'left');
      if (cleared) neon(g, 'FLOOR CLEAR · GO TO THE EXIT', W / 2, H - 10, 13, '#7ee8ff');
      if (me.dead) {
        g.fillStyle = 'rgba(80, 0, 30, .45)'; g.fillRect(0, 0, W, H);
        neon(g, "YOU'RE DOWN", W / 2, H / 2 - 4, 30, '#fff', 'center', Math.sin(t / 400) * 0.04);
        neon(g, 'PRESS R TO RESTART', W / 2, H / 2 + 24, 13);
      }
    }
    stop();
    canvas.style.cursor = '';
    // ---- the tally, the grade, and the two times side by side
    const floorTime = performance.now() - floorFrom;
    const timeBonus = Math.max(0, Math.round(3000 - (floorTime / 1000) * 20));
    const clean = deaths === 0 ? 1500 : 0;
    const total = Math.round(score + timeBonus + clean);
    const grade = total >= 9000 ? 'A+' : total >= 7000 ? 'A' : total >= 5000 ? 'B' : total >= 3500 ? 'C' : 'D';
    const record = Arcade.best('miami', total);
    while (scr.click()) { /* nothing */ }
    const shownAt = performance.now();
    for (let i = 0; ; i++) {
      await scr.tick();
      if ((i > 60 && (scr.click() || scr.tap(' ', 'enter'))) || performance.now() - shownAt > 120000) break;
      const t = performance.now();
      city(t);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
      const rows = [['KNOCKOUTS', `${Math.round(score)}`], ['TIME BONUS', `${timeBonus}`], [deaths ? `DOWNED ${deaths}X` : 'NEVER DOWNED', `${clean}`], ['TOTAL', `${total}`]];
      rows.forEach(([a, b], r) => { if (i > 8 + r * 8) { neon(g, a, 40, 52 + r * 30, 15, '#fff', 'left'); neon(g, b, 300, 52 + r * 30, 15, '#ffe680', 'right'); } });
      if (i > 45) neon(g, grade, 395, 140, 70, '#ffd1f0', 'center', -0.08);
      if (i > 52) {
        g.font = '700 11px "Segoe UI", sans-serif'; g.textAlign = 'left'; g.fillStyle = '#ffd1f0';
        g.fillText(`Time choosing a mask: ${mmss(choosing)}`, 40, 190);
        g.fillText(`Time on the floor: ${mmss(floorTime)}`, 40, 206);
      }
      if (record.beat && record.old !== null && i > 55) neon(g, 'NEW BEST', 395, 200, 14, '#7ee8ff');
      if (i > 60 && Math.floor(i / 30) % 2) neon(g, 'CLICK TO CONTINUE', W / 2, H - 12, 11);
    }
    await scr.close();
    await S('{smug}Did you see my entrance?', { hold: 300 });
    if (choosing > floorTime) await P(`It took ${mmss(choosing)}. {pause}The floor took ${mmss(floorTime)}.`, { hold: 500 });
    else await P(`You chose a mask in ${mmss(choosing)}. {pause}A personal best.`, { hold: 500 });
    await S('{wink}A good entrance is half the job.', { hold: 600 });
    if (record.beat && record.old !== null) await S(`{shine}And a new best! {pause}${total.toLocaleString('en-US')}!`, { hold: 500 });
    await finish();
  }

  Events.define('miami', {
    tier: 'game', title: 'Snappy Miami', hint: 'One floor. Very stylish. The mask takes longer.', run: miami, weight: 1, arcade: true, unit: 'points',
  });
})();
