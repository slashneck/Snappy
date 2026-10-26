// New Snappy Snap: a ride through Glitch Meadow on a little cart. Aim with the mouse and click to take a photo (twelve
// of them), hold Shift to zoom in, press Space to throw a cookie. The creatures go about their day; afterwards Professor
// Program looks at the pictures you actually took and grades them on size, pose and how centred they are.
(() => {
  const { vector: her, programEye } = Arcade;
  const W = 480, H = 270, TAU = Math.PI * 2;
  const RIDE = 48000, SPEED = 0.058, GROUND = 196, FILM = 12, DASH = 236;
  const NAMES = { minion: 'Lag Minion', frameling: 'Frameling', bug: 'Bug', pixel: 'Shy Pixel', program: 'The Program' };
  const POSES = { walking: 'Walking', eating: 'Eating', jumping: 'Mid-jump', tripping: 'Tripping', flying: 'Flying', peeking: 'Peeking out', watching: 'Watching you' };
  const BONUS = { eating: 1.6, jumping: 1.5, tripping: 1.8, peeking: 2, watching: 1.2 };
  // who lives where along the track
  const CAST = [
    { kind: 'minion', x: 520 }, { kind: 'frameling', x: 760 }, { kind: 'minion', x: 980, trips: true }, { kind: 'bug', x: 1180 },
    { kind: 'frameling', x: 1380 }, { kind: 'pixel', x: 1600 }, { kind: 'minion', x: 1820 }, { kind: 'bug', x: 2050 },
    { kind: 'program', x: 2240 }, { kind: 'frameling', x: 2420 }, { kind: 'pixel', x: 2620 }, { kind: 'minion', x: 2790, trips: true },
  ];

  async function safari(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    const before = Arcade.top('safari');
    if (before !== null) {
      await S(`{shine}Back to Glitch Meadow! {pause}My best report: ${before.toLocaleString('en-US')} points.`, { hold: 300 });
      await P('I remember your photos. {pause}Most of them were grass.', { hold: 500 });
    } else {
      await S('{shine}Finally! {pause}A game where I do my actual job.', { hold: 300 });
      await P('Taking pictures.', { hold: 300 });
      await S('{joy}Of WILD GLITCHES. {pause}From a little cart.', { hold: 300 });
      await P('I will review your photos afterwards. {pause}Call me Professor Program.', { hold: 400 });
      await S('{worried}...will you be harsh?', { hold: 300 });
      await P('Fair. {pause}Which is worse.', { hold: 600 });
    }
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g, canvas } = scr;
    const res = canvas.width / W;

    // ---- the meadow, in layers that slide by at different speeds
    function meadow(cam, t) {
      const sky = g.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, '#79c6ff'); sky.addColorStop(1, '#e0f5ff');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255, 250, 220, .9)'; g.beginPath(); g.arc(400, 46, 20, 0, TAU); g.fill();
      for (let i = 0; i < 5; i++) { const x = ((i * 170 - cam * 0.08) % 760 + 760) % 760 - 100; g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(x, 40 + (i % 2) * 22, 34, 11, 0, 0, TAU); g.ellipse(x + 20, 34 + (i % 2) * 22, 20, 10, 0, 0, TAU); g.fill(); }
      g.fillStyle = '#a7d98f';
      for (let i = 0; i < 6; i++) { const x = ((i * 140 - cam * 0.15) % 840 + 840) % 840 - 120; g.beginPath(); g.ellipse(x, GROUND - 6, 110, 46, 0, Math.PI, 0); g.fill(); }
      for (let i = 0; i < 9; i++) {
        const x = ((i * 95 - cam * 0.4) % 855 + 855) % 855 - 60;
        g.fillStyle = '#7a5a3a'; g.fillRect(x - 3, GROUND - 40, 6, 30);
        g.fillStyle = i % 2 ? '#5fb85a' : '#4fa64e'; g.beginPath(); g.arc(x, GROUND - 48, 20, 0, TAU); g.arc(x - 12, GROUND - 38, 13, 0, TAU); g.arc(x + 12, GROUND - 38, 13, 0, TAU); g.fill();
      }
      g.fillStyle = '#86cf6c'; g.fillRect(0, GROUND - 9, W, H - GROUND + 9);
      g.fillStyle = '#76bf5c'; for (let x = -((cam * 1) % 22); x < W; x += 22) g.fillRect(x, GROUND + 6, 12, 2);
      for (let i = 0; i < 14; i++) { const x = ((i * 61 - cam) % 860 + 860) % 860 - 30; g.fillStyle = ['#ffd84a', '#ff9db0', '#ffffff'][i % 3]; g.beginPath(); g.arc(x, GROUND + 14 + (i % 3) * 6, 2.2, 0, TAU); g.fill(); }
    }
    function foreground(cam) {
      g.fillStyle = '#4f9a3e';
      for (let i = 0; i < 24; i++) {
        const x = ((i * 37 - cam * 1.5) % 900 + 900) % 900 - 20;
        g.beginPath(); g.moveTo(x, DASH); g.quadraticCurveTo(x + 4, DASH - 26 - (i % 3) * 8, x + 9, DASH - 30 - (i % 4) * 6); g.lineTo(x + 6, DASH); g.fill();
      }
    }

    // where each creature is right now, what it's doing, and the box it fills on screen
    function pose(c, t, cam, cookies) {
      const near = cookies.find((k) => k.landed && t - k.landed < 5000 && Math.abs(k.wx - c.x) < 130);
      let x = c.x, y = GROUND, w = 26, h = 24, state = 'walking', hidden = false;
      if (c.kind === 'minion') {
        x = near ? c.x + Math.max(-1, Math.min(1, (near.wx - c.x) / 60)) * Math.min(1, (t - near.landed) / 1200) * Math.abs(near.wx - c.x) : c.x + Math.sin(t / 1400 + c.x) * 28;
        state = near && t - near.landed > 1200 ? 'eating' : c.trips && (t / 1000 + c.x / 100) % 6 < 1.2 ? 'tripping' : 'walking';
      } else if (c.kind === 'frameling') {
        const hop = Math.abs(Math.sin(t / 420 + c.x));
        x = near ? near.wx : c.x + Math.sin(t / 1800 + c.x) * 20; y = GROUND - (near ? 0 : hop * 46); w = 20; h = 26;
        state = near && t - near.landed > 900 ? 'eating' : hop > 0.6 && !near ? 'jumping' : 'walking';
      } else if (c.kind === 'bug') {
        x = c.x + Math.sin(t / 520 + c.x) * 70; y = 120 + Math.sin(t / 330 + c.x) * 34; w = 18; h = 14; state = 'flying';
      } else if (c.kind === 'pixel') {
        hidden = !near; state = 'peeking'; w = 18; h = 18; y = GROUND - 14;
      } else if (c.kind === 'program') {
        y = 76; w = 40; h = 30; state = 'watching';
      }
      return { kind: c.kind, x, y, w, h, state, hidden, sx: x - cam };
    }
    function drawCreature(p, t) {
      const x = p.sx, y = p.y;
      if (p.kind === 'minion') {
        g.save(); g.translate(x, y - 10);
        if (p.state === 'tripping') g.rotate(Math.PI / 2.3);
        g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(2, 12, 13, 4, 0, 0, TAU); g.fill();
        g.fillStyle = '#1a1414'; g.beginPath(); g.ellipse(0, 0, 14, 12, 0, 0, TAU); g.fill();
        g.fillStyle = '#ff5a6e'; g.beginPath(); g.ellipse(0, 0, 12, 10, 0, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -2, 5, 0, TAU); g.fill();
        g.fillStyle = '#111';
        if (p.state === 'tripping') { g.lineWidth = 1.5; g.strokeStyle = '#111'; g.beginPath(); g.moveTo(-2, -4); g.lineTo(2, 0); g.moveTo(2, -4); g.lineTo(-2, 0); g.stroke(); }
        else { g.beginPath(); g.arc(Math.cos(t / 200) * 1.5, -2 + Math.sin(t / 200) * 1.5, 2.2, 0, TAU); g.fill(); }
        if (p.state === 'eating') { g.fillStyle = '#d39a5c'; g.beginPath(); g.arc(9, 4, 4, 0, TAU); g.fill(); }
        g.restore();
      } else if (p.kind === 'frameling') {
        g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x, GROUND + 2, 10, 3, 0, 0, TAU); g.fill();
        g.fillStyle = '#1a1414'; g.fillRect(x - 10, y - 26, 20, 24);
        g.fillStyle = '#ffd84a'; g.fillRect(x - 8, y - 24, 16, 20);
        g.fillStyle = '#1a1414'; for (let i = 0; i < 3; i++) { g.fillRect(x - 7, y - 22 + i * 7, 2, 3); g.fillRect(x + 5, y - 22 + i * 7, 2, 3); }
        g.fillStyle = '#111'; g.fillRect(x - 3, y - 17, 2, 4); g.fillRect(x + 1, y - 17, 2, 4);
        g.fillStyle = '#ff9db0'; g.fillRect(x - 5, y - 11, 2, 1.5); g.fillRect(x + 3, y - 11, 2, 1.5);
      } else if (p.kind === 'bug') {
        g.fillStyle = 'rgba(220, 240, 255, .7)'; g.beginPath(); g.ellipse(x - 6, y - 6 + Math.sin(t / 25) * 3, 7, 3, -0.5, 0, TAU); g.ellipse(x + 6, y - 6 - Math.sin(t / 25) * 3, 7, 3, 0.5, 0, TAU); g.fill();
        g.fillStyle = '#4caa3a'; g.beginPath(); g.ellipse(x, y, 9, 7, 0, 0, TAU); g.fill();
        g.fillStyle = '#111'; g.fillRect(x - 4, y - 2, 2, 2); g.fillRect(x + 2, y - 2, 2, 2);
      } else if (p.kind === 'pixel') {
        if (!p.hidden) {
          const up = Math.min(1, Math.sin(t / 300) * 0.3 + 0.8);
          g.fillStyle = '#b28cff'; g.fillRect(x - 8, y - 6 - up * 10, 16, 16);
          g.fillStyle = '#fff'; g.fillRect(x - 5, y - 2 - up * 10, 3, 3); g.fillRect(x + 2, y - 2 - up * 10, 3, 3);
        }
        g.fillStyle = '#3f8a34'; g.beginPath(); g.arc(x - 12, GROUND - 4, 12, 0, TAU); g.arc(x, GROUND - 10, 14, 0, TAU); g.arc(x + 12, GROUND - 4, 12, 0, TAU); g.fill();
      } else if (p.kind === 'program') {
        g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(x, y, 30, 15, 0, 0, TAU); g.ellipse(x - 18, y + 4, 16, 10, 0, 0, TAU); g.ellipse(x + 18, y + 4, 16, 10, 0, 0, TAU); g.fill();
        programEye(g, x, y + 2, 9, { look: Math.sin(t / 800) });
      }
    }

    const titleCard = (t) => {
      meadow(t / 20, t);
      g.textAlign = 'center'; g.lineJoin = 'round'; g.font = '900 34px "Arial Black", "Segoe UI", sans-serif';
      g.lineWidth = 8; g.strokeStyle = '#2a4aa8'; g.strokeText('NEW SNAPPY SNAP', W / 2, 92); g.fillStyle = '#ffd84a'; g.fillText('NEW SNAPPY SNAP', W / 2, 92);
      her(g, W / 2, 158 + Math.sin(t / 400) * 3, 46, { eyes: 'joy', rec: Math.floor(t / 500) % 2 === 0 });
      if (Math.floor(t / 600) % 2) { g.font = '800 11px "Segoe UI", sans-serif'; g.fillStyle = '#2a4aa8'; g.fillText('click to start the ride', W / 2, 220); }
    };
    if (!(await scr.title('NEW SNAPPY SNAP', '', 'MOUSE AIMS · CLICK SNAPS · SHIFT ZOOMS · SPACE THROWS A COOKIE', titleCard))) await abandon(scr);
    let stop = music('safari', 8720);
    canvas.style.cursor = 'none';
    const photos = [], cookies = [];
    let cookiesLeft = 5, flash = 0;
    const start = performance.now();
    for (;;) {
      await scr.tick();
      const now = performance.now(), t = now - start;
      if (t > RIDE) break;
      const cam = t * SPEED;
      const zoom = scr.held('shift', 'z');
      const fw = zoom ? 70 : 128, fh = fw * 0.66;
      const fx = Math.max(4, Math.min(W - fw - 4, scr.mouse.x - fw / 2)), fy = Math.max(4, Math.min(DASH - fh - 4, scr.mouse.y - fh / 2));
      if (scr.tap(' ', 'e') && cookiesLeft > 0) {
        cookiesLeft--;
        cookies.push({ from: { x: 40, y: DASH }, wx: cam + fx + fw / 2, at: t, landed: 0 });
        Speech.tune('whoosh', 0.3);
      }
      for (const k of cookies) if (!k.landed && t - k.at > 600) { k.landed = t; Speech.tune('tick', 0.4); }
      meadow(cam, t);
      const cast = CAST.map((c) => pose(c, t, cam, cookies)).filter((p) => p.sx > -60 && p.sx < W + 60);
      for (const p of cast) drawCreature(p, t);
      for (const k of cookies) {
        const k1 = Math.min(1, (t - k.at) / 600), sx = (k.landed ? k.wx - cam : k.from.x + (k.wx - cam - k.from.x) * k1), sy = k.landed ? GROUND + 6 : k.from.y + (GROUND + 6 - k.from.y) * k1 - Math.sin(k1 * Math.PI) * 60;
        if (k.landed && t - k.landed > 5000) continue;
        g.fillStyle = '#7a4a22'; g.beginPath(); g.arc(sx, sy, 5, 0, TAU); g.fill(); g.fillStyle = '#d39a5c'; g.beginPath(); g.arc(sx, sy, 4, 0, TAU); g.fill();
      }
      foreground(cam);
      // the shutter: what's in the frame becomes a photo, and Professor Program will judge it later
      if (scr.click() && photos.length < FILM) {
        const img = document.createElement('canvas');
        img.width = 192; img.height = 127;
        img.getContext('2d').drawImage(canvas, fx * res, fy * res, fw * res, fh * res, 0, 0, 192, 127);
        let best = null;
        for (const p of cast) {
          if (p.hidden) continue;
          const bx = p.sx - p.w / 2, by = p.y - p.h - (p.kind === 'program' ? -p.h / 2 : 0);
          const ix = Math.max(0, Math.min(bx + p.w, fx + fw) - Math.max(bx, fx)), iy = Math.max(0, Math.min(by + p.h, fy + fh) - Math.max(by, fy));
          if (ix * iy < p.w * p.h * 0.5) continue;
          const size = Math.min(1, (p.w * p.h) / (fw * fh) / 0.12);
          const off = Math.hypot(bx + p.w / 2 - (fx + fw / 2), by + p.h / 2 - (fy + fh / 2)) / Math.hypot(fw / 2, fh / 2);
          const centered = Math.max(0, 1 - off);
          const pts = Math.round((size * 600 + centered * 300) * (BONUS[p.state] || 1)) + (p.kind === 'pixel' ? 300 : 0) + (p.kind === 'program' ? 500 : 0);
          if (!best || pts > best.pts) best = { kind: p.kind, state: p.state, size, centered, pts };
        }
        photos.push({ img, best });
        flash = now;
        snappy.call('sound.snap', { volume: Speech.volume * 0.8 }).catch(() => {});
      }
      // the viewfinder
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const cx = fx + dx * fw, cy = fy + dy * fh, sx = dx ? -1 : 1, sy = dy ? -1 : 1;
        g.beginPath(); g.moveTo(cx, cy + sy * 12); g.lineTo(cx, cy); g.lineTo(cx + sx * 12, cy); g.stroke();
      }
      g.beginPath(); g.moveTo(fx + fw / 2 - 5, fy + fh / 2); g.lineTo(fx + fw / 2 + 5, fy + fh / 2); g.moveTo(fx + fw / 2, fy + fh / 2 - 5); g.lineTo(fx + fw / 2, fy + fh / 2 + 5); g.stroke();
      if (zoom) { g.fillStyle = '#fff'; g.font = '800 8px "Segoe UI", sans-serif'; g.textAlign = 'left'; g.fillText('ZOOM', fx + 4, fy + 11); }
      if (now - flash < 180) { g.fillStyle = `rgba(255,255,255,${0.8 * (1 - (now - flash) / 180)})`; g.fillRect(0, 0, W, H); }
      // the cart's dashboard: her, the film left, cookies, how far along the ride is
      g.fillStyle = '#2a3a6a'; g.fillRect(0, DASH, W, H - DASH);
      g.fillStyle = '#3a5090'; g.fillRect(0, DASH, W, 3);
      her(g, 26, DASH + 18, 30, { look: Math.max(-1, Math.min(1, (scr.mouse.x - 26) / 200)), rec: true });
      for (let i = 0; i < FILM; i++) { g.fillStyle = i < FILM - photos.length ? '#ffd84a' : '#4a5a8a'; g.fillRect(56 + i * 11, DASH + 12, 8, 12); }
      g.fillStyle = '#fff'; g.font = '700 9px "Segoe UI", sans-serif'; g.textAlign = 'left';
      g.fillText(`${FILM - photos.length} left`, 56, DASH + 33);
      g.fillText(`Cookies: ${cookiesLeft}`, 200, DASH + 22);
      g.fillStyle = '#1a2850'; g.fillRect(290, DASH + 15, 170, 6); g.fillStyle = '#7fdc6c'; g.fillRect(290, DASH + 15, 170 * (t / RIDE), 6);
      g.fillStyle = '#c9d4f0'; g.fillText('Glitch Meadow', 290, DASH + 32);
    }
    stop();
    canvas.style.cursor = '';

    // ---- Professor Program's report: the best photo of each kind of creature, one by one
    const best = {};
    for (const ph of photos) if (ph.best && (!best[ph.best.kind] || ph.best.pts > best[ph.best.kind].best.pts)) best[ph.best.kind] = ph;
    const grass = photos.filter((ph) => !ph.best).length;
    const report = Object.values(best);
    let total = 0;
    stop = music('mystery', 6400);
    const lab = () => {
      g.fillStyle = '#e9e1d0'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#c9b48a'; g.fillRect(0, 200, W, 70);
      g.fillStyle = '#b8a07a'; g.fillRect(0, 200, W, 4);
      programEye(g, 410, 70, 26, { look: -0.6 });
      g.fillStyle = '#3a3a4a'; g.font = '700 10px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText('PROFESSOR PROGRAM', 410, 112);
    };
    const comment = (ph) => {
      const b = ph.best;
      if (b.kind === 'program') return 'That is me. Delete that.';
      if (b.kind === 'pixel') return 'The Shy Pixel. It did not want to be found. You found it anyway.';
      if (b.size < 0.35) return 'It is very small. Is it a dot? It might be a dot.';
      if (b.centered < 0.4) return 'It is not in the middle. Was that on purpose?';
      return { eating: 'It is eating. A good picture.', jumping: 'Mid-jump. I am impressed, against my will.', tripping: 'It tripped. You captured its worst moment. Excellent.', flying: 'A bug, in focus. Rarer than the bug.' }[b.state] || 'Acceptable.';
    };
    const waitClick = async (draw) => {
      while (scr.click()) { /* nothing */ }
      const from = performance.now();
      for (let i = 0; ; i++) {
        await scr.tick();
        draw(i);
        if (i > 20 && Math.floor(i / 30) % 2) { g.fillStyle = '#6a6a7a'; g.font = '600 9px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText('click to continue', W / 2, H - 8); }
        if ((i > 20 && scr.click()) || performance.now() - from > 90000) return;
      }
    };
    for (const ph of report) {
      total += ph.best.pts;
      Speech.tune('tick', 0.5);
      await waitClick((i) => {
        lab();
        const k = Math.min(1, i / 14);
        g.save(); g.translate(160, 110); g.rotate(-0.03); g.scale(0.7 + k * 0.3, 0.7 + k * 0.3);
        g.fillStyle = '#fff'; g.fillRect(-106, -76, 212, 160); g.drawImage(ph.img, -96, -66, 192, 127);
        g.restore();
        g.textAlign = 'left'; g.fillStyle = '#2a2a3a'; g.font = '800 13px "Segoe UI", sans-serif'; g.fillText(NAMES[ph.best.kind], 290, 140);
        g.font = '600 9px "Segoe UI", sans-serif'; g.fillStyle = '#4a4a5a';
        g.fillText(`Size ${Math.round(ph.best.size * 100)} · Centered ${Math.round(ph.best.centered * 100)} · ${POSES[ph.best.state]}`, 290, 156);
        g.fillStyle = '#2a64c8'; g.font = '800 16px "Segoe UI", sans-serif'; g.fillText(`${ph.best.pts} points`, 290, 180);
        g.fillStyle = '#2a2a3a'; g.font = 'italic 600 10px "Segoe UI", sans-serif'; g.textAlign = 'center';
        g.fillText(`"${comment(ph)}"`, W / 2, 222);
      });
    }
    const record = Arcade.best('safari', total);
    await waitClick(() => {
      lab();
      g.textAlign = 'center'; g.fillStyle = '#2a2a3a'; g.font = '800 18px "Segoe UI", sans-serif'; g.fillText('Photo Report', 180, 70);
      g.font = '700 30px "Segoe UI", sans-serif'; g.fillStyle = '#2a64c8'; g.fillText(`${total.toLocaleString('en-US')} points`, 180, 120);
      g.font = '600 10px "Segoe UI", sans-serif'; g.fillStyle = '#4a4a5a';
      g.fillText(`${report.length} of ${Object.keys(NAMES).length} creatures on film · ${photos.length} photos taken`, 180, 146);
      if (grass) g.fillText(`${grass} ${grass === 1 ? 'photo' : 'photos'} of grass`, 180, 162);
      if (record.beat && record.old !== null) { g.fillStyle = '#c28a10'; g.font = '800 11px "Segoe UI", sans-serif'; g.fillText('NEW BEST REPORT!', 180, 182); }
    });
    stop();
    await scr.close();
    if (!photos.length) {
      await P('You did not take a single photo.', { hold: 300 });
      await S('{smug}I was living in the moment.', { hold: 600 });
    } else if (grass >= photos.length / 2) {
      await P(`${grass} of your photos are of grass.`, { hold: 300 });
      await S('{smug}The grass was very photogenic today.', { hold: 600 });
    } else if (best.program) {
      await P('You took a photo of me.', { hold: 300 });
      await S('{wink}It is going on the fridge.', { hold: 300 });
      await P('We do not have a fridge.', { hold: 600 });
    } else {
      await S(`{joy}${total.toLocaleString('en-US')} points! {pause}I am a professional.`, { hold: 300 });
      await P('You are a camera. {pause}It would be strange if you were not.', { hold: 600 });
    }
    if (!best.pixel) await S('{shine}I bet a cookie would bring out something shy...', { hold: 500 });
    await finish();
  }

  Events.define('safari', {
    tier: 'game', title: 'New Snappy Snap', hint: 'A cart, a meadow, twelve photos, and a professor with opinions.', run: safari, weight: 1, arcade: true, unit: 'points',
  });
})();
