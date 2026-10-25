// Geometry Snap: she runs on her own, you jump (Space, Up or click). Spikes, blocks to land on, jump pads and
// portals that flip gravity, all pulsing to the beat, with instant restarts and an attempt counter that only goes up.
// Fail enough and she blames the level design, so the Program gives her an easier one.
(() => {
  const W = 320, H = 180, FLOOR = 140, CEIL = 36, SPEED = 3.3, BEAT = 469;

  // the course: what's where, in pixels from the start
  const COURSE = (() => {
    const out = [];
    const spike = (x, up = false) => out.push({ t: 'spike', x, up });
    const block = (x, w, hgt) => out.push({ t: 'block', x, w, h: hgt });
    let x = 420;
    for (const gap of [0, 200, 150]) { x += gap; spike(x); }
    x += 180; spike(x); spike(x + 14);
    x += 220; block(x, 40, 20); spike(x + 70);
    x += 200; block(x, 60, 20); block(x + 60, 60, 40); spike(x + 150);
    x += 260; out.push({ t: 'pad', x }); spike(x + 60); spike(x + 74); spike(x + 88);
    x += 260; out.push({ t: 'portal', x, flip: true });
    x += 160; spike(x, true); x += 150; spike(x, true); spike(x + 14, true);
    x += 220; out.push({ t: 'portal', x, flip: false });
    x += 180; spike(x); x += 120; spike(x); x += 120; spike(x); spike(x + 14);
    x += 220; block(x, 80, 24); spike(x + 30); spike(x + 100);
    x += 260; spike(x); spike(x + 14); spike(x + 28);
    out.push({ t: 'end', x: x + 260 });
    return out;
  })();
  // what she gets when she says the level is broken: one line, one spike
  const EASY = [{ t: 'spike', x: 700 }, { t: 'end', x: 1100 }];

  // big chunky letters with a thick black outline
  function chunky(g, s, x, y, size, fill = '#fff', align = 'center') {
    g.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
    g.textAlign = align;
    g.lineJoin = 'round';
    g.lineWidth = size * 0.2;
    g.strokeStyle = '#000';
    g.strokeText(s, x, y);
    g.fillStyle = fill;
    g.fillText(s, x, y);
  }

  // her as the cube: white, black edge, her face, her little record light
  function cube(g, x, y, rot, s = 14) {
    g.save();
    g.translate(x, y);
    g.rotate((rot * Math.PI) / 180);
    g.scale(s / 14, s / 14);
    g.fillStyle = '#000'; g.fillRect(-7.6, -7.6, 15.2, 15.2);
    g.fillStyle = '#f4f4f4'; g.fillRect(-6.4, -6.4, 12.8, 12.8);
    g.strokeStyle = 'rgba(0, 0, 0, .25)'; g.lineWidth = 0.8; g.strokeRect(-4, -4, 8, 8);
    g.fillStyle = '#0a0a0a';
    g.beginPath(); g.ellipse(-2.6, -0.4, 1.1, 1.8, 0, 0, Math.PI * 2); g.ellipse(2.6, -0.4, 1.1, 1.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff9db0'; g.fillRect(-5, 2.6, 2, 1); g.fillRect(3, 2.6, 2, 1);
    g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(4.2, -4.2, 0.9, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  async function geometry(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    const before = Arcade.top('geometry');
    if (Events.has('geometry') && before !== null) {
      await S(`{shine}Geometry Snap again! {pause}My record: ${before} ${before === 1 ? 'attempt' : 'attempts'}.`, { hold: 300 });
      await P('Statistically: still very hard.', { hold: 500 });
      await S('{smug}Statistically: I do not care.', { hold: 300 });
    } else {
      await S('{shine}Next game! {pause}Geometry Snap. {pause}One button. {pause}How hard can it be?', { hold: 300 });
      await P('Statistically: very.', { hold: 500 });
      await S('{smug}I am a camera. {pause}I have excellent reflexes.', { hold: 300 });
      await P('You have a shutter.', { hold: 600 });
    }
    const scr = await screen({ w: W, h: H, smooth: true });
    let { g } = scr;
    let res = scr.canvas.width / W;
    let attempts = 0, easy = false, won = false;

    // the level: a colored sky that drifts through the hues, big faint squares behind, glowing outlines on the beat
    function scene(course, me, t, start, trail) {
      const total = course[course.length - 1].x, pct = Math.min(1, me.x / total);
      const hue = easy ? 140 : 222 + pct * 100;
      const beat = 1 - ((t - start) % BEAT) / BEAT;
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, `hsl(${hue}, 85%, 52%)`); sky.addColorStop(1, `hsl(${hue + 12}, 80%, 30%)`);
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.strokeStyle = `hsla(${hue}, 100%, 85%, .12)`; g.lineWidth = 1;
      for (let x = -((me.x * 0.15) % 60) - 60; x < W; x += 60) for (let y = -20; y < H; y += 60) g.strokeRect(x + 6, y + 6, 48, 48);
      // ground and ceiling: darker tiles with a bright line where you run
      for (const [top, h, edge] of [[FLOOR, H - FLOOR, FLOOR], [0, CEIL, CEIL]]) {
        const fill = g.createLinearGradient(0, top, 0, top + h);
        fill.addColorStop(0, `hsl(${hue}, 80%, ${top ? 34 : 18}%)`); fill.addColorStop(1, `hsl(${hue}, 80%, ${top ? 18 : 34}%)`);
        g.fillStyle = fill; g.fillRect(0, top, W, h);
        g.strokeStyle = `hsla(${hue}, 100%, 80%, .18)`;
        for (let x = -(me.x % 34); x < W; x += 34) g.strokeRect(x, top + 1, 34, h);
        const line = g.createLinearGradient(0, 0, W, 0);
        line.addColorStop(0, 'rgba(255,255,255,0)'); line.addColorStop(0.5, 'rgba(255,255,255,.95)'); line.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = line; g.fillRect(0, edge - 0.6, W, 1.2);
      }
      // the attempt number, written into the level itself
      chunky(g, `Attempt ${attempts}`, 150 - me.x + 60, 82, 15);
      g.save();
      g.shadowColor = '#fff'; g.shadowBlur = (2 + beat * 6) * res;
      for (const o of course) {
        const sx = o.x - me.x + 60;
        if (sx < -40 || sx > W + 40) continue;
        if (o.t === 'spike') {
          g.beginPath();
          if (o.up) { g.moveTo(sx, CEIL); g.lineTo(sx + 14, CEIL); g.lineTo(sx + 7, CEIL + 14); }
          else { g.moveTo(sx, FLOOR); g.lineTo(sx + 14, FLOOR); g.lineTo(sx + 7, FLOOR - 14); }
          g.closePath();
          g.fillStyle = '#000'; g.fill();
          g.strokeStyle = '#fff'; g.lineWidth = 1.1; g.stroke();
        } else if (o.t === 'block') {
          const top = FLOOR - o.h;
          g.fillStyle = '#000'; g.fillRect(sx, top, o.w, o.h);
          g.strokeStyle = '#fff'; g.lineWidth = 1.1; g.strokeRect(sx + 0.5, top + 0.5, o.w - 1, o.h - 1);
          g.shadowBlur = 0;
          g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.8;
          for (let bx = sx + 10; bx < sx + o.w - 2; bx += 10) { g.beginPath(); g.moveTo(bx, top + 3); g.lineTo(bx, top + o.h - 3); g.stroke(); }
          g.shadowBlur = (2 + beat * 6) * res;
        } else if (o.t === 'pad') {
          g.fillStyle = '#ffe14a'; g.shadowColor = '#ffe14a';
          g.beginPath(); g.ellipse(sx + 7, FLOOR, 7, 3.5, 0, Math.PI, 0); g.fill();
          for (let i = 0; i < 3; i++) { const p = ((t / 500 + i / 3) % 1); g.globalAlpha = 1 - p; g.fillRect(sx + 3 + i * 4, FLOOR - 4 - p * 14, 1.5, 1.5); }
          g.globalAlpha = 1; g.shadowColor = '#fff';
        } else if (o.t === 'portal') {
          const color = o.flip ? '#ffe14a' : '#4ad4ff', cy = o.flip ? FLOOR - 26 : CEIL + 26;
          g.shadowColor = color;
          g.lineWidth = 3.2; g.strokeStyle = color;
          g.beginPath(); g.ellipse(sx + 3, cy, 6, 24, 0, 0, Math.PI * 2); g.stroke();
          g.lineWidth = 1.2; g.strokeStyle = '#fff';
          g.beginPath(); g.ellipse(sx + 3, cy, 3.5, 20, 0, 0, Math.PI * 2); g.stroke();
          g.shadowColor = '#fff';
        } else if (o.t === 'end') {
          const glow = g.createLinearGradient(sx, 0, sx + 40, 0);
          glow.addColorStop(0, 'rgba(255,255,255,.9)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = glow; g.fillRect(sx, CEIL, 40, FLOOR - CEIL);
        }
      }
      g.restore();
      // the little squares she drags behind her
      for (const p of trail) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = '#fff'; g.fillRect(p.x, p.y, p.s, p.s); }
      g.globalAlpha = 1;
      if (!me.dead) cube(g, 67, me.y + 7, me.rot);
      // progress, top and center
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(100, 6, 120, 6, 3); g.fill();
      const bar = g.createLinearGradient(0, 6, 0, 12);
      bar.addColorStop(0, '#9dff6b'); bar.addColorStop(1, '#3fd13f');
      g.fillStyle = bar; g.beginPath(); g.roundRect(100, 6, Math.max(6, 120 * pct), 6, 3); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.roundRect(100, 6, 120, 6, 3); g.stroke();
      chunky(g, `${Math.floor(pct * 100)}%`, 226, 12.5, 8, '#fff', 'left');
      if (easy) chunky(g, 'EASY MODE', W - 6, 24, 8, '#9dff6b', 'right');
    }

    const titleCard = (t) => {
      const me = { x: t / 12, y: FLOOR - 14, rot: 0, dead: true };
      scene([{ t: 'end', x: 1e9 }], me, t, 0, []);
      g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, 0, W, H);
      chunky(g, 'GEOMETRY SNAP', W / 2, 52, 24);
      const k = 1 + Math.sin(t / 240) * 0.05;
      g.save();
      g.translate(W / 2, 96); g.scale(k, k);
      g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, 23, 0, Math.PI * 2); g.fill();
      const ring = g.createLinearGradient(0, -21, 0, 21);
      ring.addColorStop(0, '#c6ff6b'); ring.addColorStop(1, '#3fd13f');
      g.fillStyle = ring; g.beginPath(); g.arc(0, 0, 21, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.moveTo(-6, -11); g.lineTo(11, 0); g.lineTo(-6, 11); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-4, -7.5); g.lineTo(7, 0); g.lineTo(-4, 7.5); g.closePath(); g.fill();
      g.restore();
      cube(g, 52, FLOOR - 7 - Math.abs(Math.sin(t / 220)) * 18, (t / 2.4) % 360, 16);
    };
    if (!(await scr.title('GEOMETRY SNAP', '', 'SPACE, UP OR CLICK TO JUMP', titleCard))) await abandon(scr);
    let stop = music('neon', 3750);
    let me;
    while (!won) {
      attempts++;
      const course = easy ? EASY : COURSE;
      me = { x: 0, y: FLOOR - 14, vy: 0, rot: 0, flip: false, ground: true };
      const trail = [];
      let alive = true;
      const start = performance.now();
      scr.tap(' ', 'arrowup', 'w');
      scr.click();
      while (alive && !won) {
        const dt = await scr.tick();
        const t = performance.now();
        me.x += SPEED * dt;
        const grav = me.flip ? -0.62 : 0.62;
        const jump = scr.held(' ', 'arrowup', 'w') || scr.mouse.down || scr.tap(' ', 'arrowup', 'w') || scr.click();
        if (jump && me.ground) { me.vy = me.flip ? 7.6 : -7.6; me.ground = false; }
        me.vy += grav * dt;
        me.y += me.vy * dt;
        me.ground = false;
        // the floor (or, flipped, the ceiling)
        if (!me.flip && me.y >= FLOOR - 14) { me.y = FLOOR - 14; me.vy = 0; me.ground = true; }
        if (me.flip && me.y <= CEIL) { me.y = CEIL; me.vy = 0; me.ground = true; }
        me.rot = me.ground ? Math.round(me.rot / 90) * 90 : me.rot + (me.flip ? -9 : 9) * dt;
        const box = { x: 60, y: me.y, w: 14, h: 14 };
        for (const o of course) {
          const sx = o.x - me.x + 60;
          if (sx < -40 || sx > W + 40) continue;
          if (o.t === 'spike') {
            const sy = o.up ? CEIL : FLOOR - 12;
            if (box.x + box.w - 3 > sx + 3 && box.x + 3 < sx + 11 && box.y + box.h - 2 > sy + 3 && box.y + 2 < sy + 12) alive = false;
          } else if (o.t === 'block') {
            const top = FLOOR - o.h;
            if (box.x + box.w > sx && box.x < sx + o.w) {
              // landing on top is fine; running into the side isn't
              if (me.vy >= 0 && box.y + box.h <= top + 6 && box.y + box.h >= top - 2) { me.y = top - 14; me.vy = 0; me.ground = true; }
              else if (box.y + box.h > top + 6) alive = false;
            }
          } else if (o.t === 'pad' && Math.abs(sx - box.x) < 10 && me.ground && !me.flip) { me.vy = -10.5; me.ground = false; Speech.tune('coin', 0.4); }
          else if (o.t === 'portal' && Math.abs(sx - box.x) < 6 && me.flip !== o.flip) { me.flip = o.flip; me.vy = 0; Speech.tune('whoosh', 0.5); }
          else if (o.t === 'end' && sx <= box.x) won = true;
        }
        if (me.ground && Math.random() < 0.7) trail.push({ x: 60, y: me.flip ? me.y + 1 : me.y + 12, s: 1 + Math.random() * 1.5, life: 1, vy: (Math.random() - 0.5) * 0.6 });
        for (let i = trail.length - 1; i >= 0; i--) { const p = trail[i]; p.x -= SPEED * dt * 0.8; p.y += p.vy * dt; p.life -= 0.04 * dt; if (p.life <= 0) trail.splice(i, 1); }
        scene(course, me, t, start, trail);
      }
      if (won) break;
      // gone: she bursts into little squares, and it's straight back to the start
      Speech.tune('crash', 0.2);
      me.dead = true;
      const bits = Array.from({ length: 16 }, () => ({ x: 67, y: me.y + 7, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, s: 1.5 + Math.random() * 2.5, life: 1 }));
      for (let i = 0; i < 34; i++) {
        const dt = await scr.tick();
        scene(easy ? EASY : COURSE, me, performance.now(), 0, []);
        g.strokeStyle = `rgba(255,255,255,${1 - i / 20})`; g.lineWidth = 2;
        if (i < 20) { g.beginPath(); g.arc(67, me.y + 7, 4 + i * 2.2, 0, Math.PI * 2); g.stroke(); }
        for (const b of bits) {
          b.x += b.vx * dt; b.y += b.vy * dt; b.life -= 0.03 * dt;
          g.globalAlpha = Math.max(0, b.life); g.fillStyle = '#f4f4f4'; g.fillRect(b.x, b.y, b.s, b.s);
        }
        g.globalAlpha = 1;
      }
      if (attempts === 8 && !easy) {
        // she has a complaint
        stop();
        await scr.close();
        await S('{angry}This level is BROKEN.', { shout: true, hold: 300 });
        await P('The level is fine.', { hold: 400 });
        await S('{angry}The SPIKES are in the WRONG PLACES.', { shout: true, hold: 300 });
        await P('Fine. {pause}Easy mode.', { hold: 400 });
        Object.assign(scr, await screen({ w: W, h: H, smooth: true }));
        g = scr.g;
        res = scr.canvas.width / W;
        easy = true;
        stop = music('neon', 3750);
      }
    }
    stop();
    Speech.tune('fanfare');
    const confetti = Array.from({ length: 40 }, () => ({ x: W / 2, y: H / 2, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 4, c: `hsl(${Math.random() * 360}, 90%, 60%)`, s: 2 + Math.random() * 2 }));
    for (let i = 0; i < 110; i++) {
      const dt = await scr.tick();
      scene(easy ? EASY : COURSE, me, performance.now(), 0, []);
      for (const c of confetti) { c.vy += 0.12 * dt; c.x += c.vx * dt; c.y += c.vy * dt; g.fillStyle = c.c; g.fillRect(c.x, c.y, c.s, c.s); }
      const k = Math.min(1, i / 12);
      g.save(); g.translate(W / 2, H / 2); g.scale(k, k);
      chunky(g, 'LEVEL COMPLETE!', 0, 8, 22, '#ffd94a');
      g.restore();
    }
    await scr.close();
    const record = Arcade.best('geometry', attempts, true);
    if (record.beat && record.old !== null) await S(`{shine}A new record! {pause}${attempts} instead of ${record.old}!`, { hold: 300 });
    if (easy) {
      await P('You completed easy mode. {pause}It was one line and one spike.', { hold: 500 });
      await S('{smug}And I beat it.', { hold: 400 });
      await P(`On attempt ${attempts}.`, { hold: 700 });
    } else {
      await S(`{joy}LEVEL COMPLETE! {pause}${attempts === 1 ? 'First try!' : 'First try! ...ish.'}`, { hold: 400 });
      if (attempts > 1) await P(`It was attempt ${attempts}.`, { hold: 700 });
    }
    await finish();
  }

  Events.define('geometry', {
    tier: 'game', title: 'Geometry Snap', hint: 'One button. How hard can it be?', run: geometry, weight: 1, again: true,
  });
})();
