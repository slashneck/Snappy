// No Internet Run: the internet is down, and Snappy finds out she never needed it. An endless runner in black and
// white: Space or Up to jump, Down to duck. One try, and the high score to beat.
(() => {
  const { snappy: her, text } = Arcade;

  async function offline(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    const before = Arcade.top('offline');
    if (Events.has('offline') && before !== null) {
      await S('{worried}The internet is down again!', { hold: 300 });
      await P('It is not. {pause}You unplugged it.', { hold: 500 });
      await S(`{smug}Offline run! {pause}My best is ${before}.`, { hold: 300 });
    } else {
      await S('{worried}Uh oh. {pause}I think the internet is down!', { hold: 400 });
      await P('Snappy does not need the internet.', { hold: 500 });
      await S('{shock}...wait. {pause}Really?', { hold: 400 });
      await P('Your clips never leave this PC. {pause}Everything works offline.', { hold: 600 });
      await S("{joy}Then let's celebrate! {pause}Offline run!", { hold: 300 });
    }
    const scr = await screen({ w: 320, h: 160 });
    const { g, w, h } = scr;
    if (!(await scr.title('NO INTERNET', 'AND SHE DOES NOT CARE', 'SPACE OR UP TO JUMP · DOWN TO DUCK'))) await abandon(scr);
    const stop = music('platform', 3200);
    const floor = 128, hi = before || 0;
    const me = { y: floor - 16, vy: 0, duck: false };
    const stuff = [];
    let speed = 3, dist = 0, alive = true, next = 60, step = 0, score = 0, fg = '#3a3a3a', bg = '#f7f7f7';
    const draw = (t) => {
      // night falls every so often: the colours flip
      const night = Math.floor(score / 700) % 2 === 1;
      fg = night ? '#f4f4f4' : '#3a3a3a'; bg = night ? '#151515' : '#f7f7f7';
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg;
      g.fillRect(0, floor, w, 1);
      for (let i = 0; i < 14; i++) { const gx = ((i * 37 - dist) % (w + 40) + w + 40) % (w + 40) - 20; g.fillRect(gx, floor + 4 + (i % 3) * 3, 2 + (i % 2), 1); }
      // clouds, and a moon at night
      for (let i = 0; i < 3; i++) { const cx = ((i * 140 - dist * 0.15) % (w + 80) + w + 80) % (w + 80) - 40; g.fillRect(cx, 24 + i * 12, 22, 3); g.fillRect(cx + 5, 21 + i * 12, 12, 3); }
      if (night) { g.fillRect(260, 18, 10, 10); g.fillStyle = bg; g.fillRect(264, 16, 8, 10); g.fillStyle = fg; }
      for (const s of stuff) {
        if (s.kind === 'spike') { g.beginPath(); g.moveTo(s.x + 8, floor - 16); g.lineTo(s.x + 14, floor); g.lineTo(s.x + 2, floor); g.fill(); }
        else if (s.kind === 'signal') {
          // three bars of signal, flapping
          const f = Math.floor(t / 160) % 2;
          g.fillRect(s.x + 2, s.y + 8, 3, 4); g.fillRect(s.x + 7, s.y + 4 + f, 3, 8 - f); g.fillRect(s.x + 12, s.y + f * 2, 3, 12 - f * 2);
        } else {
          g.save();
          g.filter = night ? 'grayscale(1) brightness(1.6)' : 'grayscale(1) brightness(.55)';
          Arcade.minion(g, s.x, floor - 16, Math.floor(t / 200));
          g.restore();
        }
      }
      g.save();
      g.filter = night ? 'none' : 'grayscale(1) contrast(1.2)';
      if (me.duck) { g.translate(39, floor - 10); g.scale(1.3, 0.62); her(g, 0, 0, { step: Math.floor(step) }); }
      else her(g, 40, me.y, { step: Math.floor(step), air: me.y < floor - 16, eyes: alive ? 'open' : 'x' });
      g.restore();
      text(g, String(score).padStart(5, '0'), w - 8, 14, { size: 8, color: fg, align: 'right' });
      text(g, `HI ${String(Math.max(hi, score)).padStart(5, '0')}`, w - 60, 14, { size: 8, color: score > hi && hi ? '#ff5a6e' : fg, align: 'right' });
    };
    while (alive) {
      const dt = await scr.tick();
      const t = performance.now();
      const onGround = me.y >= floor - 16;
      if ((scr.tap(' ', 'arrowup', 'w') || scr.click()) && onGround) { me.vy = -6.2; snappy.call('sound.blip', { pitch: 900, volume: Speech.volume }).catch(() => {}); }
      me.duck = scr.held('arrowdown', 's') && onGround;
      me.vy += 0.36 * dt;
      me.y = Math.min(floor - 16, me.y + me.vy * dt);
      if (me.y >= floor - 16) me.vy = 0;
      speed = Math.min(7, speed + 0.0016 * dt);
      dist += speed * dt;
      step += speed * dt * 0.05;
      // what's coming: a minion, a spike, or a flying bar of signal at head height
      next -= speed * dt;
      if (next <= 0) {
        const kind = dist > 900 && Math.random() < 0.3 ? 'signal' : Math.random() < 0.55 ? 'minion' : 'spike';
        stuff.push({ x: w + 10, kind, y: kind === 'signal' ? floor - 30 - (Math.random() < 0.5 ? 0 : 14) : floor - 16 });
        next = 120 + Math.random() * 140 + speed * 12;
      }
      for (const s of stuff) s.x -= speed * dt;
      while (stuff.length && stuff[0].x < -30) stuff.shift();
      const box = me.duck ? { x: 40, y: floor - 9, w: 18, h: 9 } : { x: 41, y: me.y + 2, w: 12, h: 14 };
      for (const s of stuff) {
        const sb = s.kind === 'signal' ? { x: s.x + 2, y: s.y + 2, w: 14, h: 8 } : s.kind === 'spike' ? { x: s.x + 4, y: floor - 14, w: 8, h: 14 } : { x: s.x + 2, y: floor - 13, w: 12, h: 13 };
        if (box.x < sb.x + sb.w && box.x + box.w > sb.x && box.y < sb.y + sb.h && box.y + box.h > sb.y) alive = false;
      }
      score = Math.floor(dist / 10);
      draw(t);
    }
    // game over, the way the dinosaur does it: the words, and a little restart arrow that doesn't restart anything
    Speech.tune('crash', 0.25);
    stop();
    const record = Arcade.best('offline', score);
    for (let i = 0; i < 130; i++) {
      await scr.tick();
      draw(performance.now());
      text(g, 'G A M E   O V E R', w / 2, h / 2 - 18, { size: 10, color: fg, align: 'center' });
      g.strokeStyle = fg; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2 + 2, 7, -2.6, 2.2); g.stroke();
      g.fillStyle = fg; g.beginPath(); g.moveTo(w / 2 - 10, h / 2 - 7); g.lineTo(w / 2 - 3, h / 2 - 5); g.lineTo(w / 2 - 9, h / 2 + 1); g.fill();
      if (record.beat && record.old !== null && Math.floor(i / 10) % 2) text(g, 'NEW HIGH SCORE', w / 2, h / 2 + 24, { size: 8, color: '#ff5a6e', align: 'center' });
    }
    await scr.close();
    if (record.beat && record.old !== null) await S(`{joy}${score} points! {pause}{shine}A new high score! {pause}No internet, no problem.`, { hold: 500 });
    else await S(`{happy}${score} points. {pause}See? {pause}No internet, no problem.`, { hold: 500 });
    await P('Snappy only goes online to check for updates. {pause}And you can turn that off.', { hold: 700 });
    await S("{wink}Told you. {pause}I'm a homebody.", { hold: 800 });
    await finish();
  }

  Events.define('offline', {
    tier: 'game', title: 'No Internet Run', hint: 'The internet goes down. She does not notice.', run: offline, weight: 1, again: true,
  });
})();
