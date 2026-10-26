// Snap to the Beat: circles light up with a ring closing in on them; click (or press Z or X) as the ring meets the
// circle. Sliders: click, then hold and follow the ball to the end. One song, three times through, busier each time,
// with score, combo, accuracy, a health bar that drains, and a rank at the end.
(() => {
  const { vector: her } = Arcade;
  const W = 480, H = 270, TAU = Math.PI * 2;
  const BEAT = 500, LOOP = 16000, R = 17, APPROACH = 1100, LEAD_IN = 2200, OFFSET = 60;
  const WIN = { great: 80, good: 140, meh: 200 };
  const COLORS = ['#ff6a8e', '#58b4ff', '#ffc94a', '#7fdc6c'];
  // the song's lead line, one entry per eighth note (the same as in the synth), so the map follows the melody
  const LEAD = [1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0,
    1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0];
  const RANKS = [['SS', '#ffd84a'], ['S', '#ffd84a'], ['A', '#7fdc6c'], ['B', '#58b4ff'], ['C', '#c27cff'], ['D', '#ff5a5a']];

  // The map: the first time through, a circle on every beat; then the melody on the beat; then every note of it.
  // A note with nothing after it until the next beat becomes a slider.
  function buildMap() {
    const times = [];
    for (let b = 0; b < 32; b++) times.push({ t: b * BEAT });
    for (const loop of [1, 2]) {
      let busyUntil = -1;
      for (let e = 0; e < 64; e++) {
        const t = loop * LOOP + e * 250;
        if (!LEAD[e] || t < busyUntil || (loop === 1 && e % 2)) continue;
        const slider = e % 2 === 0 && !LEAD[e + 1] && !LEAD[e + 2] && e + 3 < 64;
        times.push(slider ? { t, len: 500 } : { t });
        if (slider) busyUntil = t + 600;
      }
    }
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    let x = W / 2, y = H / 2, ang = -0.6, n = 0, colour = -1;
    return times.map((o, i) => {
      if (i) {
        const room = Math.min(1, (o.t - times[i - 1].t - (times[i - 1].len || 0)) / 500);
        const dist = 38 + room * 72;
        ang += 0.85 + Math.sin(i * 1.7) * 0.7;
        x += Math.cos(ang) * dist; y += Math.sin(ang) * dist;
        if (x < 60 || x > W - 70) { ang = Math.PI - ang; x = clamp(x, 60, W - 70); }
        if (y < 56 || y > H - 44) { ang = -ang; y = clamp(y, 56, H - 44); }
      }
      if (i % 4 === 0) { n = 0; colour++; }
      n++;
      const obj = { ...o, x, y, n, color: COLORS[colour % COLORS.length], hit: null };
      if (o.len) {
        const a = ang + Math.PI / 2;
        obj.ex = clamp(x + Math.cos(a) * 70, 50, W - 60); obj.ey = clamp(y + Math.sin(a) * 70, 50, H - 40);
        x = obj.ex; y = obj.ey;
      }
      return obj;
    });
  }

  const ring = (g, x, y, r, color, width = 2) => { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); };
  function circle(g, o, alpha, scale = 1) {
    g.globalAlpha = alpha;
    const r = R * scale;
    const fill = g.createRadialGradient(o.x - r * 0.3, o.y - r * 0.3, 2, o.x, o.y, r);
    fill.addColorStop(0, '#ffffff55'); fill.addColorStop(0.35, o.color); fill.addColorStop(1, o.color);
    g.fillStyle = fill; g.beginPath(); g.arc(o.x, o.y, r, 0, TAU); g.fill();
    ring(g, o.x, o.y, r, '#fff', 2.6);
    g.fillStyle = '#fff'; g.font = `800 ${Math.round(13 * scale)}px "Segoe UI", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(o.n), o.x, o.y + 0.5);
    g.textBaseline = 'alphabetic';
    g.globalAlpha = 1;
  }
  function sliderBody(g, o, alpha) {
    g.globalAlpha = alpha;
    g.lineCap = 'round';
    g.strokeStyle = '#fff'; g.lineWidth = R * 2 + 3; g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.ex, o.ey); g.stroke();
    g.strokeStyle = '#1b1530'; g.lineWidth = R * 2 - 3; g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.ex, o.ey); g.stroke();
    g.strokeStyle = `${o.color}88`; g.lineWidth = R * 2 - 3; g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.ex, o.ey); g.stroke();
    ring(g, o.ex, o.ey, R, '#fff', 2.6);
    g.globalAlpha = 1;
  }

  async function beat(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    const before = Arcade.top('beat');
    if (before !== null) {
      await S(`{shine}Snap to the Beat! {pause}My best is ${before.toLocaleString('en-US')}.`, { hold: 300 });
      await P('The circles have been practicing.', { hold: 500 });
      await S('{smug}So have I.', { hold: 300 });
    } else {
      await S('{shine}Snap to the Beat! {pause}Circles show up, and you click them right on the beat.', { hold: 300 });
      await P('You do not have hands.', { hold: 500 });
      await S('{smug}I have RHYTHM.', { hold: 300 });
      await P('Debatable.', { hold: 600 });
    }
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g, canvas } = scr;
    const backdrop = (t, pulse = 0) => {
      const bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#2a1048'); bg.addColorStop(0.55, '#4a1856'); bg.addColorStop(1, '#16203f');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) {
        const x = (i * 97 + t * 0.01) % (W + 120) - 60, y = 40 + ((i * 53) % (H - 60));
        const glow = g.createRadialGradient(x, y, 2, x, y, 70);
        glow.addColorStop(0, `rgba(255, 120, 200, ${0.08 + pulse * 0.06})`); glow.addColorStop(1, 'rgba(255, 120, 200, 0)');
        g.fillStyle = glow; g.fillRect(x - 70, y - 70, 140, 140);
      }
      g.fillStyle = 'rgba(0, 0, 0, .35)'; g.fillRect(0, 0, W, H);
    };
    // the title: the big pink "snap!" circle, pulsing at the song's tempo
    const titleCard = (t) => {
      const k = 1 - ((t % BEAT) / BEAT);
      backdrop(t, k);
      const r = 62 + k * 5;
      g.fillStyle = 'rgba(255, 102, 170, .25)'; g.beginPath(); g.arc(W / 2, H / 2 - 6, r + 14 + k * 8, 0, TAU); g.fill();
      const pink = g.createRadialGradient(W / 2 - 20, H / 2 - 30, 10, W / 2, H / 2 - 6, r);
      pink.addColorStop(0, '#ff9ccc'); pink.addColorStop(1, '#ff4fa0');
      g.fillStyle = pink; g.beginPath(); g.arc(W / 2, H / 2 - 6, r, 0, TAU); g.fill();
      ring(g, W / 2, H / 2 - 6, r, '#fff', 6);
      g.fillStyle = '#fff'; g.font = '900 36px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText('snap!', W / 2, H / 2 + 6);
      g.font = '600 12px "Segoe UI", sans-serif'; g.fillStyle = '#ffe1f0'; g.fillText('Snap to the Beat · click to play', W / 2, H - 22);
      her(g, W - 44, H - 40 - Math.abs(Math.sin((t / BEAT) * Math.PI)) * 5, 40, { eyes: 'happy', legs: Math.floor(t / BEAT) });
    };
    if (!(await scr.title('SNAP TO THE BEAT', '', 'CLICK OR Z / X ON THE BEAT · HOLD SLIDERS', titleCard))) await abandon(scr);
    canvas.style.cursor = 'none';
    const map = buildMap();
    const end = map[map.length - 1].t + (map[map.length - 1].len || 0) + 1200;
    let stop = () => {};
    const first = performance.now();
    let songStart = first + LEAD_IN;
    const startSong = setTimeout(() => { songStart = performance.now(); stop = music('beat', LOOP); }, LEAD_IN);
    ctx.onEnd(() => clearTimeout(startSong));
    let score = 0, combo = 0, maxCombo = 0, health = 100, failed = false, comboPop = 0, lastMiss = -9999;
    const counts = { great: 0, good: 0, meh: 0, miss: 0 };
    const marks = [], bursts = [], trail = [];
    const judge = (o, kind, now) => {
      counts[kind]++;
      if (kind === 'miss') {
        if (combo >= 10) Speech.tune('glitch', 0.35);
        combo = 0;
        health = Math.max(0, health - 12);
        lastMiss = now;
      } else {
        combo++;
        maxCombo = Math.max(maxCombo, combo);
        comboPop = now;
        score += { great: 300, good: 100, meh: 50 }[kind] * (1 + Math.min(combo, 120) / 25);
        health = Math.min(100, health + { great: 5, good: 2.5, meh: 0.5 }[kind]);
        bursts.push({ x: o.x, y: o.y, color: o.color, at: now });
        snappy.call('sound.blip', { pitch: kind === 'great' ? 1300 : 1000, volume: Speech.volume * 0.4 }).catch(() => {});
      }
      if (kind !== 'great') marks.push({ x: o.x, y: o.y, kind, at: now });
    };

    while (true) {
      await scr.tick();
      const real = performance.now(), now = real - songStart - OFFSET;
      const { x: mx, y: my } = scr.mouse;
      trail.push({ x: mx, y: my, at: real });
      while (trail.length && real - trail[0].at > 120) trail.shift();
      // presses: a click, Z or X
      let presses = 0;
      while (scr.click()) presses++;
      if (scr.tap('z')) presses++;
      if (scr.tap('x')) presses++;
      for (; presses > 0; presses--) {
        const o = map.find((m) => m.hit === null && now >= m.t - APPROACH && now <= m.t + WIN.meh);
        if (!o || Math.hypot(mx - o.x, my - o.y) > R * 1.2) continue;
        const dt = Math.abs(now - o.t);
        if (dt > WIN.meh) { o.shake = real; continue; } // far too early: it shakes, nothing else
        o.hit = dt <= WIN.great ? 'great' : dt <= WIN.good ? 'good' : 'meh';
        o.hitAt = now;
        if (o.len) o.holding = true;
        judge(o, o.hit, now);
      }
      // anything that went by without a click is a miss
      for (const o of map) if (o.hit === null && now > o.t + WIN.meh) { o.hit = 'miss'; o.hitAt = now; judge(o, 'miss', now); }
      // sliders: hold on and stay with the ball
      const holding = scr.mouse.down || scr.held('z', 'x');
      for (const o of map) {
        if (!o.len || !o.holding || o.done) continue;
        const k = Math.min(1, (now - o.t) / o.len), bx = o.x + (o.ex - o.x) * k, by = o.y + (o.ey - o.y) * k;
        if (now >= o.t + o.len) {
          o.done = true;
          combo++; maxCombo = Math.max(maxCombo, combo); score += 30; comboPop = now;
          bursts.push({ x: o.ex, y: o.ey, color: o.color, at: now });
          snappy.call('sound.blip', { pitch: 1500, volume: Speech.volume * 0.35 }).catch(() => {});
        } else if (!holding || Math.hypot(mx - bx, my - by) > R * 2.6) {
          o.holding = false;
          if (combo >= 10) Speech.tune('glitch', 0.3);
          combo = 0;
          marks.push({ x: bx, y: by, kind: 'miss', at: now });
          lastMiss = now;
        }
      }
      if (now > 0) health = Math.max(0, health - 0.0032 * 16.7);
      if (health <= 0 && now > 0) { failed = true; break; }
      if (now > end) break;

      // ---- the picture
      const pulse = now > 0 ? 1 - ((now % BEAT) / BEAT) : 0;
      backdrop(real, pulse * 0.6);
      // little dots leading from one circle to the next
      for (let i = 1; i < map.length; i++) {
        const a = map[i - 1], b = map[i];
        if (b.t - now > APPROACH || now > b.t || a.n === undefined || b.n === 1) continue;
        const sx = a.len ? a.ex : a.x, sy = a.len ? a.ey : a.y, d = Math.hypot(b.x - sx, b.y - sy);
        g.fillStyle = 'rgba(255, 255, 255, .5)';
        for (let s = R + 6; s < d - R - 4; s += 12) { const k = s / d; g.fillRect(sx + (b.x - sx) * k - 1, sy + (b.y - sy) * k - 1, 2.4, 2.4); }
      }
      // the circles, later ones underneath
      for (let i = map.length - 1; i >= 0; i--) {
        const o = map[i];
        if (now < o.t - APPROACH) continue;
        const alpha = Math.min(1, (now - (o.t - APPROACH)) / 260);
        const shake = o.shake && real - o.shake < 200 ? Math.sin((real - o.shake) / 15) * 3 : 0;
        if (o.len && !o.done && (o.hit === null || o.holding) && now < o.t + o.len + 100) {
          sliderBody(g, o, alpha);
          if (o.hit !== null) {
            const k = Math.min(1, (now - o.t) / o.len), bx = o.x + (o.ex - o.x) * k, by = o.y + (o.ey - o.y) * k;
            ring(g, bx, by, R * 2.2, 'rgba(255,255,255,.55)', 2);
            g.fillStyle = o.color; g.beginPath(); g.arc(bx, by, R * 0.75, 0, TAU); g.fill(); ring(g, bx, by, R * 0.75, '#fff', 2);
            continue;
          }
        }
        if (o.hit !== null) continue;
        g.save(); g.translate(shake, 0);
        circle(g, o, alpha);
        const k = Math.max(0, (o.t - now) / APPROACH);
        g.globalAlpha = alpha; ring(g, o.x, o.y, R * (1 + k * 2.2), o.color, 2.4); g.globalAlpha = 1;
        g.restore();
      }
      // a hit grows and fades; anything less than perfect says what it was
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i], k = (now - b.at) / 260;
        if (k > 1) { bursts.splice(i, 1); continue; }
        g.globalAlpha = 1 - k; ring(g, b.x, b.y, R * (1 + k * 0.6), '#fff', 3); g.globalAlpha = 1;
      }
      for (let i = marks.length - 1; i >= 0; i--) {
        const m = marks[i], k = (now - m.at) / 700;
        if (k > 1) { marks.splice(i, 1); continue; }
        g.globalAlpha = 1 - k * k;
        g.font = `900 ${m.kind === 'miss' ? 22 : 15}px "Segoe UI", sans-serif`; g.textAlign = 'center';
        g.fillStyle = { good: '#7fdc6c', meh: '#ffb84a', miss: '#ff4a4a' }[m.kind];
        g.fillText({ good: '100', meh: '50', miss: '✕' }[m.kind], m.x, m.y + 6 - k * 8);
        g.globalAlpha = 1;
      }
      // her, dancing under the health bar, where no circle ever goes
      const bop = now > 0 ? Math.abs(Math.sin((now / BEAT) * Math.PI)) * 4 : 0;
      her(g, 28, 40 - bop, 30, { eyes: now - lastMiss < 600 ? 'wince' : combo >= 20 ? 'joy' : 'happy', legs: Math.floor(Math.max(0, now) / BEAT) });
      // health, score, accuracy, combo
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(10, 10, 170, 7);
      const hp = g.createLinearGradient(10, 0, 180, 0); hp.addColorStop(0, '#fff6c8'); hp.addColorStop(1, '#ffd84a');
      g.fillStyle = hp; g.fillRect(10, 10, 170 * (health / 100), 7);
      const judged = counts.great + counts.good + counts.meh + counts.miss;
      const acc = judged ? (counts.great * 300 + counts.good * 100 + counts.meh * 50) / (judged * 300) : 1;
      g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = '800 20px "Segoe UI", sans-serif';
      g.fillText(String(Math.round(score)).padStart(8, '0'), W - 10, 26);
      g.font = '700 11px "Segoe UI", sans-serif'; g.fillText(`${(acc * 100).toFixed(2)}%`, W - 10, 40);
      const prog = Math.max(0, Math.min(1, now / end));
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 3; g.beginPath(); g.arc(W - 80, 36, 5, 0, TAU); g.stroke();
      g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(W - 80, 36); g.arc(W - 80, 36, 5, -Math.PI / 2, -Math.PI / 2 + prog * TAU); g.stroke();
      const pop = Math.max(0, 1 - (now - comboPop) / 150);
      g.textAlign = 'left'; g.font = `800 ${Math.round(20 + pop * 5)}px "Segoe UI", sans-serif`;
      g.fillText(`${combo}x`, 10, H - 10);
      if (now < 0) { g.textAlign = 'center'; g.font = '700 14px "Segoe UI", sans-serif'; g.fillText(Math.ceil(-now / 700) > 0 ? 'Get ready...' : '', W / 2, H / 2); }
      // the cursor and its trail
      for (const [i, p] of trail.entries()) { g.globalAlpha = (i / trail.length) * 0.5; g.fillStyle = '#ffe7a8'; g.beginPath(); g.arc(p.x, p.y, 4, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      const cur = g.createRadialGradient(mx, my, 1, mx, my, 9);
      cur.addColorStop(0, '#fff'); cur.addColorStop(0.5, '#ffd27a'); cur.addColorStop(1, 'rgba(255, 210, 122, 0)');
      g.fillStyle = cur; g.beginPath(); g.arc(mx, my, 9, 0, TAU); g.fill();
    }
    stop();
    canvas.style.cursor = '';

    // the ranking: SS for perfect, then S, A, B, C, D (a failed run is a D)
    const judged = counts.great + counts.good + counts.meh + counts.miss || 1;
    const acc = (counts.great * 300 + counts.good * 100 + counts.meh * 50) / (judged * 300);
    const rank = failed ? 'D' : acc === 1 ? 'SS' : acc >= 0.95 && !counts.miss ? 'S' : acc >= 0.9 ? 'A' : acc >= 0.8 ? 'B' : acc >= 0.7 ? 'C' : 'D';
    const color = RANKS.find(([r]) => r === rank)[1];
    const total = Math.round(score);
    const record = Arcade.best('beat', total);
    Speech.tune(failed ? 'crash' : 'fanfare', failed ? 0.3 : 0.5);
    while (scr.click()) { /* the last clicks of the song don't count */ }
    const shown = performance.now();
    for (let i = 0; ; i++) {
      await scr.tick();
      if ((i > 60 && (scr.click() || scr.tap(' ', 'enter', 'z', 'x'))) || performance.now() - shown > 180000) break;
      backdrop(performance.now());
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, W, H);
      if (failed) { g.textAlign = 'center'; g.fillStyle = '#ff5a5a'; g.font = '900 16px "Segoe UI", sans-serif'; g.fillText('FAILED', 120, 40); }
      const k = Math.min(1, i / 20);
      g.save(); g.translate(120, 140); g.scale(0.6 + k * 0.4, 0.6 + k * 0.4);
      g.textAlign = 'center'; g.font = '900 110px "Segoe UI", sans-serif'; g.fillStyle = color;
      g.shadowColor = color; g.shadowBlur = 24; g.fillText(rank, 0, 38); g.restore();
      const rows = [['Score', total.toLocaleString('en-US')], ['Accuracy', `${(acc * 100).toFixed(2)}%`], ['Max combo', `${maxCombo}x`],
        ['300', counts.great], ['100', counts.good], ['50', counts.meh], ['Miss', counts.miss]];
      g.font = '600 13px "Segoe UI", sans-serif';
      rows.forEach(([label, value], r) => {
        if (i < 10 + r * 6) return;
        g.textAlign = 'left'; g.fillStyle = '#d8cfe8'; g.fillText(label, 250, 66 + r * 24);
        g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText(String(value), 440, 66 + r * 24);
      });
      if (record.beat && record.old !== null && i > 50) { g.textAlign = 'center'; g.fillStyle = '#ffd84a'; g.font = '800 12px "Segoe UI", sans-serif'; g.fillText('NEW BEST!', 345, 240); }
      if (i > 60 && Math.floor(i / 30) % 2) { g.textAlign = 'center'; g.fillStyle = '#c9c4d8'; g.font = '600 11px "Segoe UI", sans-serif'; g.fillText('click to continue', W / 2, H - 8); }
    }
    await scr.close();
    if (rank === 'SS') {
      await S('{joy}SS! {pause}Every single circle!', { hold: 300 });
      await P('Your timing is better than mine.', { hold: 400 });
      await S("{smug}Everyone's is. {pause}You buffer.", { hold: 700 });
    } else if (rank === 'S' || rank === 'A') {
      await S(`{shine}Rank ${rank}! {pause}I could feel the beat.`, { hold: 300 });
      await P('You felt it a little late.', { hold: 700 });
    } else if (rank === 'B' || rank === 'C') {
      await S(`{happy}Rank ${rank}. {pause}Solid!`, { hold: 300 });
      await P('The beat was steady. {pause}You were not.', { hold: 700 });
    } else {
      await S('{wince}...the beat snapped ME.', { hold: 300 });
      await P('That is not how rhythm works.', { hold: 400 });
      await S('{angry}It is now.', { hold: 700 });
    }
    if (record.beat && record.old !== null) await S(`{shine}And a new best! {pause}${total.toLocaleString('en-US')}!`, { hold: 600 });
    await finish();
  }

  Events.define('beat', {
    tier: 'game', title: 'Snap to the Beat', hint: 'Click the circles. On the beat. Allegedly easy.', run: beat, weight: 1, arcade: true, unit: 'points',
  });
})();
