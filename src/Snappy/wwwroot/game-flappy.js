// Snappy Bird: Space, Up or a click to flap, through the gaps between the pipes. One try, a tall little screen,
// a teal sky with a city in it, green pipes and striped sand, just like the bird's.
(() => {
  const { snappy: her, PAL } = Arcade;
  const W = 144, H = 256, GROUND = 224, GAP = 62, PIPE = 26, SPEED = 1.3;
  const C = { sky: '#4ec0ca', cloud: '#e9fcf6', city: '#c3ecd2', window: '#a4dcbc', bush: '#5ee270', bushDark: '#3fb64c',
    pipe: '#73bf2e', pipeLight: '#9ce659', pipeDark: '#4f8a1f', sand: '#ded895', sandDark: '#cbbf6b', grass: '#9ce659', grassDark: '#73bf2e',
    ink: '#543847', orange: '#f7a200' };

  // big digits and words with a dark outline, the way the bird's game writes them
  function label(g, s, x, y, size, fill = '#fff', stroke = '#000') {
    g.font = `bold ${size}px monospace`;
    g.textAlign = 'center';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(2, size / 5);
    g.strokeStyle = stroke;
    g.strokeText(s, x, y);
    g.fillStyle = fill;
    g.fillText(s, x, y);
  }

  // the scenery, scrolling slower than the pipes
  function backdrop(g, shift) {
    g.fillStyle = C.sky; g.fillRect(0, 0, W, H);
    const s = shift * 0.25;
    g.fillStyle = C.cloud;
    for (let i = 0; i < 10; i++) { const x = ((i * 22 - s * 0.5) % 220 + 220) % 220 - 30; g.beginPath(); g.arc(x, 168 - (i % 3) * 5, 13 + (i % 2) * 4, 0, Math.PI * 2); g.fill(); }
    g.fillRect(0, 168, W, 30);
    for (let i = 0; i < 12; i++) {
      const x = ((i * 16 - s) % 192 + 192) % 192 - 24, hgt = 18 + ((i * 7) % 4) * 6;
      g.fillStyle = C.city; g.fillRect(x, 200 - hgt, 14, hgt);
      g.fillStyle = C.window;
      for (let wy = 204 - hgt; wy < 196; wy += 5) { g.fillRect(x + 3, wy, 2, 2); g.fillRect(x + 8, wy, 2, 2); }
    }
    g.fillStyle = C.bushDark;
    for (let i = 0; i < 14; i++) { const x = ((i * 14 - s * 1.6) % 196 + 196) % 196 - 26; g.beginPath(); g.arc(x, 214, 11, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = C.bush;
    for (let i = 0; i < 14; i++) { const x = ((i * 14 - s * 1.6) % 196 + 196) % 196 - 26; g.beginPath(); g.arc(x, 215, 9.5, 0, Math.PI * 2); g.fill(); }
    g.fillRect(0, 214, W, 10);
  }
  function ground(g, shift) {
    g.fillStyle = C.ink; g.fillRect(0, GROUND, W, 1);
    g.fillStyle = C.grass; g.fillRect(0, GROUND + 1, W, 6);
    g.fillStyle = C.grassDark;
    for (let x = -(shift % 8); x < W; x += 8) { g.beginPath(); g.moveTo(x, GROUND + 7); g.lineTo(x + 4, GROUND + 1); g.lineTo(x + 7, GROUND + 1); g.lineTo(x + 3, GROUND + 7); g.fill(); }
    g.fillStyle = '#558022'; g.fillRect(0, GROUND + 7, W, 1);
    g.fillStyle = C.sand; g.fillRect(0, GROUND + 8, W, H - GROUND - 8);
    g.fillStyle = C.sandDark;
    for (let x = -(shift % 12); x < W; x += 12) for (let y = GROUND + 13; y < H; y += 8) g.fillRect(x + ((y / 8) % 2) * 6, y, 2, 1);
  }
  function pipe(g, x, top, bottom) {
    const body = (y, h) => {
      g.fillStyle = C.ink; g.fillRect(x, y, PIPE, h);
      g.fillStyle = C.pipe; g.fillRect(x + 1, y, PIPE - 2, h);
      g.fillStyle = C.pipeLight; g.fillRect(x + 3, y, 3, h);
      g.fillStyle = C.pipeDark; g.fillRect(x + PIPE - 6, y, 4, h);
    };
    const lip = (y) => {
      g.fillStyle = C.ink; g.fillRect(x - 2, y, PIPE + 4, 12);
      g.fillStyle = C.pipe; g.fillRect(x - 1, y + 1, PIPE + 2, 10);
      g.fillStyle = C.pipeLight; g.fillRect(x + 1, y + 1, 3, 10);
      g.fillStyle = C.pipeDark; g.fillRect(x + PIPE - 5, y + 1, 4, 10);
    };
    body(0, top - 12); lip(top - 12);
    body(bottom + 12, GROUND - bottom - 12); lip(bottom);
  }

  // her, with a little white wing beating, tipped up when she flaps and nose down when she falls
  function bird(g, y, tilt, beat, eyes) {
    g.save();
    g.translate(37, y + 8);
    g.rotate(tilt);
    g.translate(-7, -8);
    her(g, 0, 0, { air: true, eyes });
    const wy = [4, 7, 10][beat];
    g.fillStyle = PAL.ink; g.fillRect(-4, wy - 1, 7, 5);
    g.fillStyle = PAL.white; g.fillRect(-3, wy, 5, 3);
    g.restore();
  }

  function medal(n) {
    return n >= 30 ? ['#e8e8e8', '#b8b8c0'] : n >= 20 ? ['#ffd94a', '#d9a400'] : n >= 10 ? ['#e0a060', '#b07030'] : null;
  }

  async function flappy(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    const before = Arcade.top('flappy');
    if (Events.has('flappy') && before !== null) {
      await S(`{shine}Snappy Bird! {pause}Rematch! {pause}My best is ${before}.`, { hold: 400 });
      await P(before ? 'You are still a camera.' : 'Your best is zero.', { hold: 500 });
      await S('{smug}A camera with something to prove.', { hold: 300 });
    } else {
      await S('{shine}New game! {pause}It is called Snappy Bird.', { hold: 400 });
      await P('You cannot fly.', { hold: 500 });
      await S('{smug}I had wings once. {pause}Claude gave them to me.', { hold: 400 });
      await P('Those were temporary.', { hold: 500 });
      await S('{wink}So is gravity. {pause}One try. {pause}Let\'s go!', { hold: 300 });
    }
    const scr = await screen({ w: W, h: H });
    const { g } = scr;
    const titleCard = (t) => {
      backdrop(g, t / 16);
      ground(g, t / 16);
      label(g, 'Snappy', W / 2, 62, 22, '#fff', C.ink);
      label(g, 'Bird', W / 2, 84, 22, '#ffd94a', C.ink);
      bird(g, 110 + Math.sin(t / 220) * 5, 0, Math.floor(t / 110) % 3, 'open');
      g.fillStyle = C.ink; g.fillRect(W / 2 - 25, 159, 50, 26);
      g.fillStyle = '#fff'; g.fillRect(W / 2 - 24, 160, 48, 24);
      g.fillStyle = '#e86101'; g.fillRect(W / 2 - 24, 180, 48, 4);
      g.fillStyle = '#58c33a'; g.beginPath(); g.moveTo(W / 2 - 6, 164); g.lineTo(W / 2 + 8, 171); g.lineTo(W / 2 - 6, 178); g.fill();
      if (before) label(g, `BEST ${before}`, W / 2, 206, 9, '#fff', C.ink);
    };
    if (!(await scr.title('SNAPPY BIRD', '', 'SPACE, UP OR CLICK TO FLAP', titleCard))) await abandon(scr);
    const stop = music('platform', 3200);
    const me = { y: H / 2 - 20, vy: 0 };
    const pipes = [];
    let score = 0, alive = true, shift = 0, flapT = 0, ready = true;
    while (alive) {
      const dt = await scr.tick();
      const t = performance.now();
      if (scr.tap(' ', 'arrowup', 'w') || scr.click()) { me.vy = -4.2; flapT = t; ready = false; snappy.call('sound.blip', { pitch: 1180, volume: Speech.volume }).catch(() => {}); }
      if (ready) me.y = H / 2 - 20 + Math.sin(t / 200) * 4;
      else {
        me.vy = Math.min(6, me.vy + 0.28 * dt);
        me.y += me.vy * dt;
        if (!pipes.length || pipes[pipes.length - 1].x < W - 84) pipes.push({ x: W + 10, top: 40 + Math.random() * (GROUND - GAP - 80), passed: false });
      }
      shift += SPEED * dt;
      for (const p of pipes) {
        if (!ready) p.x -= SPEED * dt;
        if (!p.passed && p.x + PIPE < 30) { p.passed = true; score++; Speech.tune('coin', 0.35); }
        // touching a pipe ends the run
        if (30 + 13 > p.x - 1 && 30 + 1 < p.x + PIPE + 1 && (me.y + 2 < p.top || me.y + 14 > p.top + GAP)) alive = false;
      }
      while (pipes.length && pipes[0].x < -40) pipes.shift();
      if (me.y + 16 > GROUND || me.y < -30) alive = false;
      backdrop(g, shift);
      for (const p of pipes) pipe(g, Math.round(p.x), Math.round(p.top), Math.round(p.top + GAP));
      ground(g, shift);
      const tilt = ready ? 0 : Math.max(-0.45, Math.min(1.4, me.vy * 0.2 - (t - flapT < 250 ? 0.4 : 0)));
      bird(g, me.y, tilt, ready || t - flapT < 300 ? Math.floor(t / 70) % 3 : 1, alive ? 'open' : 'x');
      if (ready) {
        label(g, 'Get Ready!', W / 2, 60, 16, '#5ee270', C.ink);
        g.fillStyle = 'rgba(255,255,255,.85)';
        g.fillRect(W / 2 + 8, 112, 2, 10); g.fillRect(W / 2 + 4, 120, 10, 8);
        label(g, 'TAP', W / 2 + 30, 124, 8, '#fff', C.ink);
      } else label(g, String(score), W / 2, 40, 22);
    }
    // crashed: a white flash, then the scoreboard with the best so far
    Speech.tune('crash', 0.3);
    stop();
    const record = Arcade.best('flappy', score);
    const shine = medal(score);
    for (let i = 0; i < 150; i++) {
      await scr.tick();
      backdrop(g, shift);
      for (const p of pipes) pipe(g, Math.round(p.x), Math.round(p.top), Math.round(p.top + GAP));
      ground(g, shift);
      me.y = Math.min(GROUND - 14, me.y + 4);
      bird(g, me.y, 1.4, 1, 'x');
      if (i < 6) { g.fillStyle = `rgba(255,255,255,${1 - i / 6})`; g.fillRect(0, 0, W, H); }
      if (i > 14) {
        label(g, 'Game Over', W / 2, 62, 18, C.orange, C.ink);
        const py = Math.max(84, 150 - (i - 14) * 6);
        g.fillStyle = C.ink; g.fillRect(14, py, W - 28, 62);
        g.fillStyle = C.sand; g.fillRect(16, py + 2, W - 32, 58);
        g.fillStyle = '#c8bd6e'; g.fillRect(16, py + 56, W - 32, 4);
        g.font = 'bold 7px monospace'; g.textAlign = 'right'; g.fillStyle = C.orange;
        g.fillText('SCORE', W - 22, py + 14); g.fillText('BEST', W - 22, py + 36);
        label(g, String(score), W - 34, py + 28, 12);
        label(g, String(record.best), W - 34, py + 50, 12);
        if (record.beat && record.old !== null && Math.floor(i / 8) % 2) { g.fillStyle = '#e0475a'; g.fillRect(W - 76, py + 41, 20, 9); g.font = 'bold 6px monospace'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('NEW', W - 66, py + 48); }
        g.font = 'bold 7px monospace'; g.textAlign = 'left'; g.fillStyle = C.orange; g.fillText('MEDAL', 24, py + 14);
        g.fillStyle = shine ? shine[1] : '#cfc58a'; g.beginPath(); g.arc(40, py + 36, 13, 0, Math.PI * 2); g.fill();
        if (shine) { g.fillStyle = shine[0]; g.beginPath(); g.arc(40, py + 36, 10, 0, Math.PI * 2); g.fill(); her(g, 33, py + 28, {}); }
      }
    }
    await scr.close();
    if (record.beat && record.old !== null) {
      await S(`{joy}${score}! {pause}A new best! {pause}The old one was ${record.old}!`, { hold: 500 });
      await P('Noted. {pause}Reluctantly.', { hold: 600 });
    } else if (score === 0) {
      await S('{sad}Zero. {pause}I am a camera. {pause}Not a bird.', { hold: 500 });
      await P('Correct.', { hold: 700 });
    } else if (score >= 10) {
      await S(`{joy}${score} pipes! {pause}I'm a natural!`, { hold: 500 });
      await P('You flew between several green pipes. {pause}We do not have pipes.', { hold: 600 });
    } else {
      await S(`{happy}${score} ${score === 1 ? 'pipe' : 'pipes'}!${record.old ? ` {pause}{smug}My best is still ${record.old}.` : ''}`, { hold: 500 });
      await P('Where did those pipes even come from?', { hold: 600 });
    }
    await S('{wink}Same time tomorrow?', { hold: 700 });
    await finish();
  }

  Events.define('flappy', {
    tier: 'game', title: 'Snappy Bird', hint: 'She says she can fly. She cannot.', run: flappy, weight: 1, after: ['claude'], again: true,
  });
})();
