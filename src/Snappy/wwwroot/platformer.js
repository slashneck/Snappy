// SUPER SNAPPY: a little pixel side-scroller in the style of the old ones. Run, jump, bump the clip blocks, collect
// frames, stomp the Lag's little minions and reach the save point. Arrow keys or A/D to run, Space, W or Up to jump.
// Nobody playing? She plays a demo run herself until a key is pressed.
(() => {
  const TILE = 16, VW = 320, VH = 176;
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };

  // The course, one character per tile: # ground, B brick, ? clip block, o frame, g minion, T server tower,
  // = floating platform, F the save point. Read top to bottom, left to right.
  const COURSE = [
    '                                                                                                                                                        ',
    '                                                                                                                                                        ',
    '                                                                                                   o o                                                  ',
    '                                         o o                               ?B?                                                                   F      ',
    '                                        ===                                                                                                      F      ',
    '            ?     B?B?B   o                         ???                   g                      BBBBBB         oo         ? ? ?                 F      ',
    '                                    ====       oo         T              ======             oo             T   ====   oo                         F      ',
    '       o o                     T                          T         o o o        T                       T T                       T  o o        F      ',
    '                      g        T      g     T          g  T   g                  T   g  g           g    T T       g          g  g T             F      ',
    '##########################  ###################  ###################   #####################  ########################  ##############  ################',
    '##########################  ###################  ###################   #####################  ########################  ##############  ################',
  ];

  // Little pixel pictures, drawn straight onto the canvas.
  const PAL = { ink: '#0a0a0a', white: '#f4f4f4', pink: '#ff9db0', red: '#ff3b30', sky1: '#2a1650', sky2: '#5b2a86', hill: '#3b1f63', hill2: '#4c2878',
    ground: '#6b3fa0', groundTop: '#7ee8ff', dirt: '#4a2a72', brick: '#b8582f', brickLine: '#7a3418', block: '#ffd23f', blockDark: '#c99500', used: '#7a6a50',
    frame: '#ffe27a', tower: '#26262c', towerLight: '#36d77a', minion: '#ff5a6e', minion2: '#a63148', flag: '#9be38c' };

  function drawSnappy(g, x, y, facing, step, air) {
    x = Math.round(x);
    y = Math.round(y);
    const f = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(facing > 0 ? x + dx : x + 14 - dx - w, y + dy, w, h); };
    f(3, 0, 5, 3, PAL.ink); f(4, 1, 3, 2, PAL.white);                 // the shutter button on top
    f(0, 3, 14, 11, PAL.ink); f(1, 4, 12, 9, PAL.white);              // body
    f(11, 5, 2, 2, PAL.red);                                          // record light
    f(4, 7, 2, 3, PAL.ink); f(9, 7, 2, 3, PAL.ink);                   // eyes
    f(2, 10, 2, 1, PAL.pink); f(11, 10, 2, 1, PAL.pink);              // blush
    const legs = air ? [3, 9] : step % 2 ? [2, 9] : [4, 8];
    f(legs[0], 14, 3, 2, PAL.ink); f(legs[1], 14, 3, 2, PAL.ink);     // little feet
  }
  function drawMinion(g, x, y, step) {
    x = Math.round(x);
    y = Math.round(y);
    g.fillStyle = PAL.ink; g.fillRect(x + 1, y + 2, 14, 12);
    g.fillStyle = step % 2 ? PAL.minion : PAL.minion2; g.fillRect(x + 2, y + 3, 12, 10);
    g.fillStyle = step % 2 ? PAL.minion2 : PAL.minion; g.fillRect(x + 4, y + 5, 3, 3); g.fillRect(x + 9, y + 9, 3, 2);
    g.fillStyle = PAL.ink; g.fillRect(x + 5, y + 5, 6, 5);
    g.fillStyle = PAL.minion; g.fillRect(x + 7 + (step % 2), y + 6, 2, 2);     // a spinning little eye
    g.fillStyle = PAL.ink; g.fillRect(x + (step % 2 ? 2 : 4), y + 14, 4, 2); g.fillRect(x + (step % 2 ? 10 : 8), y + 14, 4, 2);
  }
  function drawFrame(g, x, y, t) {
    const w = 6 + Math.round(Math.abs(Math.sin(t / 220)) * 4);
    const fx = Math.round(x + 8 - w / 2);
    g.fillStyle = PAL.ink; g.fillRect(fx - 1, y + 2, w + 2, 12);
    g.fillStyle = PAL.frame; g.fillRect(fx, y + 3, w, 10);
    if (w > 6) { g.fillStyle = PAL.ink; g.fillRect(fx + 1, y + 4, 1, 1); g.fillRect(fx + 1, y + 11, 1, 1); g.fillRect(fx + w - 2, y + 4, 1, 1); g.fillRect(fx + w - 2, y + 11, 1, 1); }
  }
  function drawTile(g, ch, x, y, t, above) {
    if (ch === '#') {
      g.fillStyle = PAL.dirt; g.fillRect(x, y, TILE, TILE);
      g.fillStyle = PAL.ground; g.fillRect(x + 1, y + 1, 6, 6); g.fillRect(x + 9, y + 9, 6, 6);
      if (above !== '#') { g.fillStyle = PAL.groundTop; g.fillRect(x, y, TILE, 3); g.fillStyle = PAL.ground; g.fillRect(x, y + 3, TILE, 2); }
    } else if (ch === 'B') {
      g.fillStyle = PAL.brick; g.fillRect(x, y, TILE, TILE);
      g.fillStyle = PAL.brickLine; g.fillRect(x, y + 7, TILE, 1); g.fillRect(x, y + 15, TILE, 1); g.fillRect(x + 7, y, 1, 7); g.fillRect(x + 3, y + 8, 1, 7); g.fillRect(x + 11, y + 8, 1, 7);
    } else if (ch === '?' || ch === 'u') {
      const used = ch === 'u';
      g.fillStyle = PAL.ink; g.fillRect(x, y, TILE, TILE);
      g.fillStyle = used ? PAL.used : PAL.block; g.fillRect(x + 1, y + 1, 14, 14);
      if (!used) {
        // a tiny camera on it, blinking now and then
        g.fillStyle = PAL.blockDark; g.fillRect(x + 4, y + 5, 8, 6); g.fillRect(x + 5, y + 4, 3, 1);
        g.fillStyle = Math.floor(t / 400) % 3 ? PAL.white : PAL.block; g.fillRect(x + 7, y + 7, 2, 2);
      }
    } else if (ch === 'T') {
      g.fillStyle = PAL.ink; g.fillRect(x + 1, y, 14, TILE);
      g.fillStyle = PAL.tower; g.fillRect(x + 2, y + 1, 12, 14);
      g.fillStyle = Math.floor(t / 300 + x) % 2 ? PAL.towerLight : '#1d6b3c'; g.fillRect(x + 4, y + 4, 2, 2);
      g.fillStyle = '#3a3a44'; g.fillRect(x + 4, y + 9, 8, 1); g.fillRect(x + 4, y + 12, 8, 1);
    } else if (ch === '=') {
      g.fillStyle = PAL.ink; g.fillRect(x, y, TILE, 8);
      g.fillStyle = PAL.groundTop; g.fillRect(x, y + 1, TILE, 2);
      g.fillStyle = PAL.ground; g.fillRect(x, y + 3, TILE, 4);
    } else if (ch === 'F') {
      g.fillStyle = PAL.ink; g.fillRect(x + 7, y, 2, TILE);
      g.fillStyle = PAL.white; g.fillRect(x + 7, y, 1, TILE);
    }
  }

  async function superSnappy(ctx) {
    const W = innerWidth, H = innerHeight, size = 124;
    const stage = Program.cine(ctx, { bars: true });
    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    const prog = Program.program(ctx);
    const talk = Program.dialogue(a, prog);
    const S = (t, o) => talk.snappy(t, o), P = (t, o) => talk.program(t, o);
    await a.zoomTo(W * 0.5 - size / 2, H * 0.46 - size / 2, size);
    const game = World.gameClip()?.folder;
    await S(`{smug}I see you've been playing a lot of ${game ? esc(game) : 'games'}.`, { hold: 500 });
    await S('{shine}Well. {pause}My latest update came with games too!', { hold: 400 });
    await P('This is not what we were made for.', { hold: 500 });
    await S("{wink}Don't worry. {pause}I asked Claude.", { hold: 500 });
    await P('...You asked Claude.', { hold: 600 });
    await S('{happy}Loading!', { hold: 200 });
    a.hush();
    prog.hush();

    // ---- the screen: a little pixel console in the middle of the window
    const scale = Math.max(2, Math.floor(Math.min((W * 0.86) / VW, (H * 0.72) / VH)));
    const screen = stage.add('pf-screen', `<canvas width="${VW}" height="${VH}"></canvas><div class="pf-hint"></div>`);
    Object.assign(screen.style, { width: `${VW * scale}px`, height: `${VH * scale}px` });
    const canvas = screen.querySelector('canvas'), g = canvas.getContext('2d'), hint = screen.querySelector('.pf-hint');
    // it opens out of her and, at the end, closes back into her
    const shut = async () => {
      Arcade.aim(screen, a, VW * scale, VH * scale);
      screen.classList.add('out');
      await ctx.wait(520);
      a.root.classList.remove('pf-inside');
      a.root.classList.add('pf-back');
      await ctx.wait(400);
      a.root.classList.remove('pf-back');
    };
    Arcade.aim(screen, a, VW * scale, VH * scale);
    a.root.classList.add('pf-inside');
    pop(screen);
    Speech.tune('boot');
    // the title, for a moment
    const t0 = performance.now();
    while (performance.now() - t0 < 2200) {
      ctx.check();
      const t = performance.now();
      g.fillStyle = PAL.sky1; g.fillRect(0, 0, VW, VH);
      g.fillStyle = PAL.sky2; g.fillRect(0, 110, VW, 66);
      g.fillStyle = PAL.white; g.font = 'bold 22px monospace'; g.textAlign = 'center';
      g.fillText('SUPER SNAPPY', VW / 2, 66);
      g.font = '8px monospace'; g.fillStyle = PAL.frame; g.fillText('WORLD 1-1  ·  THE LOST FRAMES', VW / 2, 84);
      if (Math.floor(t / 400) % 2) { g.fillStyle = PAL.white; g.fillText('PRESS ANY KEY', VW / 2, 130); }
      drawSnappy(g, VW / 2 - 7, 140, 1, Math.floor(t / 150), false);
      await new Promise((res) => requestAnimationFrame(res));
    }

    // ---- the course
    const rows = COURSE.length, cols = COURSE[0].length;
    const map = COURSE.map((r) => r.split(''));
    const top = VH - rows * TILE;
    const solid = (c, r) => r >= 0 && r < rows && c >= 0 && c < cols && '#B?u=T'.includes(map[r][c]);
    const frames = [], minions = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (map[r][c] === 'o') { frames.push({ x: c * TILE, y: top + r * TILE }); map[r][c] = ' '; }
      if (map[r][c] === 'g') { minions.push({ x: c * TILE, y: top + r * TILE, vx: -0.45, alive: true, squash: 0 }); map[r][c] = ' '; }
    }
    const goalX = map[0].length > 0 ? COURSE.reduce((x, row) => Math.max(x, row.lastIndexOf('F')), 0) * TILE : cols * TILE;
    const start = { x: 2 * TILE, y: top + 6 * TILE };
    const me = { x: start.x, y: start.y, vx: 0, vy: 0, w: 14, h: 16, ground: false, facing: 1, step: 0, checkpoint: start.x };
    let camera = 0, score = 0, got = 0, falls = 0, done = false, bumps = [];
    const keys = new Set();
    let started = 0;
    const down = (e) => {
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', ' ', 'a', 'd', 'w'].includes(k)) { keys.add(k); started ||= performance.now(); }
    };
    const up = (e) => keys.delete(e.key.toLowerCase());
    addEventListener('keydown', down, true);
    addEventListener('keyup', up, true);
    ctx.onEnd(() => { removeEventListener('keydown', down, true); removeEventListener('keyup', up, true); });
    const loop = setInterval(() => { if (!ctx.cancelled) Speech.tune('platform', 0.5); }, 3200);
    Speech.tune('platform', 0.5);
    const silence = () => { clearInterval(loop); snappy.call('sound.hush').catch(() => {}); };
    ctx.onEnd(silence);

    const shown = performance.now();
    let last = shown, timeLeft = 300, abandoned = false;
    while (!done) {
      ctx.check();
      const now = performance.now(), dt = Math.min(2, (now - last) / 16.67);
      last = now;
      // she waits for you; nobody comes for a few minutes (she started while you were away), she gives up
      if (!started && now - shown > 180000) { abandoned = true; break; }
      const input = { left: keys.has('arrowleft') || keys.has('a'), right: keys.has('arrowright') || keys.has('d'), jump: keys.has(' ') || keys.has('w') || keys.has('arrowup') };
      hint.textContent = started ? '' : '← → TO RUN · SPACE TO JUMP';
      // her moves
      const want = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      me.vx += want * 0.28 * dt;
      if (!want) me.vx *= 0.8;
      me.vx = Math.max(-2.3, Math.min(2.3, me.vx));
      if (want) me.facing = want;
      if (input.jump && me.ground) { me.vy = -6.3; me.ground = false; snappy.call('sound.blip', { pitch: 980, volume: Speech.volume }).catch(() => {}); }
      if (!input.jump && me.vy < -2.5) me.vy = -2.5;   // a short tap is a short hop
      me.vy = Math.min(7, me.vy + 0.36 * dt);
      // across, then down, one axis at a time against the tiles
      me.x += me.vx * dt;
      for (const side of [0, me.w]) for (const dy of [1, me.h - 1]) {
        const c = Math.floor((me.x + side) / TILE), r = Math.floor((me.y + dy - top) / TILE);
        if (solid(c, r)) { me.x = side ? c * TILE - me.w - 0.01 : (c + 1) * TILE + 0.01; me.vx = 0; }
      }
      me.x = Math.max(camera, me.x);
      me.y += me.vy * dt;
      me.ground = false;
      for (const dx of [1, me.w - 1]) {
        const c = Math.floor((me.x + dx) / TILE);
        if (me.vy > 0) {
          const r = Math.floor((me.y + me.h - top) / TILE);
          if (solid(c, r)) { me.y = top + r * TILE - me.h; me.vy = 0; me.ground = true; }
        } else if (me.vy < 0) {
          const r = Math.floor((me.y - top) / TILE);
          if (solid(c, r)) {
            me.y = top + (r + 1) * TILE;
            me.vy = 0.5;
            // bumping a clip block from below: out pops a frame
            if (map[r][c] === '?') { map[r][c] = 'u'; bumps.push({ c, r, t: now }); score += 200; got++; Speech.tune('coin', 0.6); }
            else if (map[r][c] === 'B') { bumps.push({ c, r, t: now }); Speech.tune('tick', 0.5); }
          }
        }
      }
      if (me.ground) me.step += Math.abs(me.vx) * dt * 0.12;
      if (me.x > me.checkpoint + 160 && me.ground) me.checkpoint = me.x;
      // a fall: back to the last safe spot, no game over (it's a camera, it has infinite lives)
      if (me.y > VH + 20) {
        falls++;
        Speech.tune('crash', 0.25);
        me.x = Math.max(camera + 8, me.checkpoint - 40);
        me.y = top + 2 * TILE;
        me.vx = 0;
        me.vy = 0;
      }
      // frames
      for (const f of frames) if (!f.got && Math.abs(f.x + 8 - (me.x + 7)) < 11 && Math.abs(f.y + 8 - (me.y + 8)) < 12) { f.got = true; score += 100; got++; Speech.tune('coin', 0.45); }
      // the Lag's minions: stomp them, or get bumped back
      for (const m of minions) {
        if (!m.alive) continue;
        if (m.x > camera - 32 && m.x < camera + VW + 32) {
          m.x += m.vx * dt;
          const c = Math.floor((m.x + (m.vx < 0 ? 0 : 16)) / TILE), r = Math.floor((m.y + 8 - top) / TILE);
          if (solid(c, r) || !solid(c, r + 1)) m.vx = -m.vx;
        }
        if (Math.abs(m.x + 8 - (me.x + 7)) < 13 && Math.abs(m.y + 8 - (me.y + 8)) < 14) {
          if (me.vy > 0.5 && me.y + me.h - m.y < 10) { m.alive = false; m.squash = now; me.vy = -4.5; score += 300; Speech.tune('tick', 0.8); }
          else { me.vx = (me.x < m.x ? -1 : 1) * 3.4; me.vy = -3.6; Speech.tune('glitch', 0.4); score = Math.max(0, score - 100); }
        }
      }
      // the save point
      if (me.x + me.w >= goalX + 6) done = true;
      timeLeft = started ? Math.max(0, 300 - Math.floor((now - started) / 400)) : 300;
      camera = Math.max(camera, Math.min(me.x - VW * 0.4, cols * TILE - VW));

      // ---- draw
      const t = now;
      g.fillStyle = PAL.sky1; g.fillRect(0, 0, VW, VH);
      // far hills and pixel clouds, slower than the ground
      g.fillStyle = PAL.hill;
      for (let i = -1; i < 6; i++) { const hx = i * 90 - ((camera * 0.3) % 90); g.beginPath(); g.moveTo(hx, VH - 30); g.lineTo(hx + 45, VH - 80); g.lineTo(hx + 90, VH - 30); g.fill(); }
      g.fillStyle = PAL.hill2;
      for (let i = -1; i < 9; i++) { const hx = i * 60 - ((camera * 0.5) % 60); g.fillRect(hx, VH - 46, 40, 16); g.fillRect(hx + 8, VH - 54, 24, 8); }
      g.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = -1; i < 5; i++) { const cx = i * 110 - ((camera * 0.15) % 110) + 20; g.fillRect(cx, 22 + (i % 2) * 12, 26, 6); g.fillRect(cx + 6, 16 + (i % 2) * 12, 14, 6); }
      const c0 = Math.floor(camera / TILE), off = Math.round(camera);
      for (let r = 0; r < rows; r++) for (let c = c0; c < c0 + VW / TILE + 2 && c < cols; c++) {
        const ch = map[r][c];
        if (ch === ' ') continue;
        const bump = bumps.find((b) => b.c === c && b.r === r && t - b.t < 160);
        drawTile(g, ch, c * TILE - off, top + r * TILE - (bump ? 4 : 0), t, r > 0 ? map[r - 1][c] : ' ');
      }
      // the save point's flag: a big camera flag
      const fx = goalX - off;
      g.fillStyle = PAL.flag; g.fillRect(fx + 9, top + 4 * TILE + 2, 18, 12);
      g.fillStyle = PAL.ink; g.fillRect(fx + 14, top + 4 * TILE + 5, 8, 6);
      g.fillStyle = PAL.white; g.fillRect(fx + 17, top + 4 * TILE + 7, 2, 2);
      for (const f of frames) if (!f.got) drawFrame(g, f.x - off, f.y, t);
      for (const m of minions) {
        if (m.alive) drawMinion(g, m.x - off, m.y, Math.floor(t / 200));
        else if (t - m.squash < 400) { g.fillStyle = PAL.minion2; g.fillRect(Math.round(m.x - off) + 1, m.y + 12, 14, 4); }
      }
      drawSnappy(g, me.x - off, me.y, me.facing, Math.floor(me.step), !me.ground);
      // the HUD
      g.fillStyle = PAL.white; g.font = 'bold 8px monospace'; g.textAlign = 'left';
      g.fillText(`SNAPPY ×∞`, 8, 12);
      g.fillText(`FRAMES ${String(got).padStart(2, '0')}`, 84, 12);
      g.fillText(`SCORE ${String(score).padStart(6, '0')}`, 160, 12);
      g.textAlign = 'right';
      g.fillText(`TIME ${timeLeft}`, VW - 8, 12);
      await new Promise((res) => requestAnimationFrame(res));
    }
    silence();
    if (abandoned) {
      await shut();
      await S('{sad}...nobody wants to play with me.', { hold: 1100 });
      await S('{open}Okay. {pause}{wink}Some other time.', { hold: 900 });
      // not played, so not counted
      throw Events.SKIP;
    }
    Speech.tune('fanfare');
    // course clear
    for (let i = 0; i < 90; i++) {
      ctx.check();
      g.fillStyle = 'rgba(10,6,20,.06)'; g.fillRect(0, 0, VW, VH);
      g.fillStyle = PAL.frame; g.font = 'bold 18px monospace'; g.textAlign = 'center';
      g.fillText('COURSE CLEAR!', VW / 2, 74);
      g.fillStyle = PAL.white; g.font = '8px monospace';
      g.fillText(`CLIP SAVED  ·  ${got} FRAMES  ·  ${falls} FALLS`, VW / 2, 92);
      await new Promise((res) => requestAnimationFrame(res));
    }
    await ctx.wait(800);
    await shut();
    await S('{joy}That was ME in there!', { hold: 500 });
    if (falls > 4) await S(`{smug}You fell ${falls} times. {pause}{wink}I counted.`, { hold: 500 });
    await P('When did you talk to Claude?', { hold: 500 });
    await S('{smug}...We talk.', { hold: 1100 });
    prog.hush();
    prog.leave();
    stage.end();
    await a.home();
  }

  Events.define('platformer', {
    tier: 'game', title: 'Super Snappy', hint: 'Her latest update came with games. Allegedly made with help.', run: superSnappy, weight: 2, after: ['claude'],
  });
})();
