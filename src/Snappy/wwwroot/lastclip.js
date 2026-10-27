// The Last Clip: Snappy finds a sample clip nobody ever opened, sitting alone at the bottom of a dusty folder, just as a
// (pretend) cleanup comes for it. She pulls it out of the interface, gets sucked into the app's storage with it, outruns
// the Cleanup Process, crosses a bridge of buttons with your help and gets it restored. It's three seconds of her falling
// over. She'd do it again. All of it is made up: no clip is moved or deleted (the shelf only shows your own clips'
// pictures). Afterwards she keeps the little clip with her for the rest of the day, and then as an outfit.
(() => {
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };
  const TAU = Math.PI * 2;

  // her headlamp, in her own coordinates (body x 10..190, y 54..182)
  const LAMP = `<path d="M26 66 Q100 40 174 66" fill="none" stroke="#2a2a2e" stroke-width="7" stroke-linecap="round"/>
    <rect x="116" y="26" width="34" height="22" rx="6" fill="#4a4a52" stroke="#0a0a0a" stroke-width="5"/>
    <circle cx="152" cy="37" r="8" fill="#fff6c8" stroke="#0a0a0a" stroke-width="4"/>`;
  // the little clip, held at her side (an outfit, so it's drawn in her coordinates; tucked in close, so in her corner
  // he doesn't cover what's written next to her)
  const LITTLE = `<g class="lc-little"><g transform="translate(168 122) scale(1.1) translate(-176 -118)"><rect x="176" y="118" width="58" height="38" rx="7" fill="#c9ecff" stroke="#0a0a0a" stroke-width="5"/>
    <path d="M178.5 142 Q196 130 214 142 T231.5 140 V151 Q231.5 153.5 229 153.5 H181 Q178.5 153.5 178.5 151 Z" fill="#7fcf7a"/>
    <circle cx="222" cy="128" r="4.5" fill="#ffd84a"/>
    <rect class="lc-little-eye" x="195" y="129" width="4.5" height="8" rx="2.2" fill="#0a0a0a"/><rect class="lc-little-eye" x="210" y="129" width="4.5" height="8" rx="2.2" fill="#0a0a0a"/></g></g>`;
  const FILES = ['IMG_0042.png', 'clip_final.mp4', 'notes (3).txt', 'clip_final_v2.mp4', 'untitled.mp4', 'screenshot.png', 'backup_old.zip',
    'Desktop 2026-01-03.mp4', 'thumbs.db', 'clutch.mp4', 'new folder (7)', 'readme.txt', 'clip_final_REAL.mp4'];

  // The clip itself, three seconds: she walks in, bumps a big button (boop), wobbles, and falls out of the frame.
  function clipFrame(g, w, h, k) {
    g.fillStyle = '#e9edf2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#cdd5df'; g.fillRect(0, h * 0.78, w, h * 0.22);
    const bx = w * 0.66, press = k > 0.5 && k < 0.6 ? 3 : 0;
    g.fillStyle = '#6b7280'; g.fillRect(bx - 4, h * 0.56, 8, h * 0.22);
    g.fillStyle = '#0a0a0a'; g.beginPath(); g.ellipse(bx, h * 0.56 + press, 15, 7, 0, 0, TAU); g.fill();
    g.fillStyle = '#ff3b30'; g.beginPath(); g.ellipse(bx, h * 0.55 + press, 13, 5.5, 0, 0, TAU); g.fill();
    let x, y = h * 0.6, tilt = 0;
    if (k < 0.5) x = w * 0.1 + (bx - 30 - w * 0.1) * (k / 0.5);
    else if (k < 0.66) { x = bx - 30 - Math.sin(((k - 0.5) / 0.16) * Math.PI) * 4; tilt = -Math.sin(((k - 0.5) / 0.16) * Math.PI) * 0.25; }
    else { const f = (k - 0.66) / 0.34; x = bx - 30 - f * 20; y = h * 0.6 + f * f * h * 1.1; tilt = -f * 2.4; }
    Arcade.vector(g, x, y, 40, { legs: k < 0.5 ? Math.floor(k * 18) : 'air', tilt, eyes: k > 0.55 ? 'shock' : 'open' });
  }

  async function lastClip(ctx) {
    const W = innerWidth, H = innerHeight, size = 124;
    const stage = Program.cine(ctx, { bars: true });
    stage.root.classList.add('lc');
    const canvas = stage.root.querySelector('.cine-fx'), g = canvas.getContext('2d');
    const dpr = devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    const prog = Program.program(ctx);
    const talk = Program.dialogue(a, prog);
    const S = talk.snappy, P = talk.program;
    const music = (name, every) => {
      Speech.tune(name, 0.5);
      const loop = setInterval(() => { if (!ctx.cancelled) Speech.tune(name, 0.5); }, every);
      const stop = () => { clearInterval(loop); snappy.call('sound.hush').catch(() => {}); };
      ctx.onEnd(stop);
      return stop;
    };
    const ground = H * 0.84;
    const box = () => a.root.getBoundingClientRect();
    const standAt = (x, opts) => a.moveTo(x - size / 2, ground - size * 0.92, opts);

    // ---- the little guy: a thumbnail with two tiny eyes
    const thumb = document.createElement('div');
    thumb.className = 'lc-thumb';
    thumb.innerHTML = '<div class="lc-pic"><i class="lc-sun"></i><i class="lc-hill"></i><i class="lc-play"></i><b class="lc-eye l"></b><b class="lc-eye r"></b></div>';
    document.body.appendChild(thumb);
    ctx.onEnd(() => thumb.remove());
    let follow = false;
    const put = (x, y, s = 1) => { thumb.style.left = `${x}px`; thumb.style.top = `${y}px`; thumb.style.setProperty('--s', s); };
    const jump = (x, y, s = 1) => { thumb.style.transition = 'none'; put(x, y, s); void thumb.offsetWidth; thumb.style.transition = ''; };
    const flicker = () => { thumb.classList.remove('flicker'); void thumb.offsetWidth; thumb.classList.add('flicker'); Speech.tune('tick', 0.6); };
    const squeak = () => snappy.call('sound.blip', { pitch: 1900, volume: Speech.volume * 0.7 }).catch(() => {});
    // eases some numbers on an object to new values, a frame at a time (each runs after every frame)
    const tween = (o, to, ms, ease = (k) => 1 - (1 - k) ** 3, each) => new Promise((res) => {
      const from = Object.fromEntries(Object.keys(to).map((key) => [key, o[key]])), start = performance.now();
      const step = (now) => {
        if (ctx.cancelled) { res(); return; }
        const k = Math.min(1, (now - start) / ms), e = ease(k);
        for (const key in to) o[key] = from[key] + (to[key] - from[key]) * e;
        each?.();
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });

    // ---- everything drawn behind her: dust, the storage world, the warm room
    const fx = { kind: 'dust', scroll: 0, speed: 0, shake: 0, alarm: 0, sweep: null, target: null, creature: null, chase: 0, slam: null, chasm: 0, beamTo: null, fold: 0, veil: 0, bits: [] };
    // where her headlamp actually points: it swings over to wherever she wants it, and fades in and out
    const beam = { x: W * 0.2, y: H * 0.32, k: 0 };
    const motes = Array.from({ length: 80 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.6 + Math.random() * 1.8, vx: (Math.random() - 0.5) * 0.15, vy: -0.04 - Math.random() * 0.14 }));
    const glows = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 2 + Math.random() * 5, v: 0.1 + Math.random() * 0.3, c: Math.random() < 0.5 ? '255, 196, 120' : '255, 150, 170' }));
    const islands = Array.from({ length: 6 }, (_, i) => ({ x: (i + 0.5) * (W / 5), y: H * (0.12 + (i % 3) * 0.1), w: 50 + (i % 2) * 20 }));
    const towers = Array.from({ length: 14 }, (_, i) => ({ x: i * 150 + Math.random() * 60, w: 70 + Math.random() * 50, h: H * (0.25 + Math.random() * 0.35), near: i % 2 === 0 }));
    let last = performance.now();

    function folder(x, y, w, h, body, tab) {
      g.fillStyle = tab; g.beginPath(); g.roundRect(x, y - 10, w * 0.4, 14, 4); g.fill();
      g.fillStyle = body; g.beginPath(); g.roundRect(x, y, w, h, 5); g.fill();
    }
    function creature(c, t) {
      g.save();
      g.translate(c.x, c.y);
      g.scale(c.scale, c.scale);
      // gears on its shoulders
      for (const [gx, dir] of [[-120, 1], [120, -1]]) {
        g.save(); g.translate(gx, -150); g.rotate((t / 400) * dir);
        g.fillStyle = '#5b6170';
        for (let i = 0; i < 10; i++) { g.rotate(TAU / 10); g.fillRect(-7, -52, 14, 16); }
        g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill();
        g.fillStyle = '#2a2d36'; g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.fill();
        g.restore();
      }
      // a body of stacked folders, a shredder for a mouth, warning signs for eyes
      folder(-110, -230, 220, 90, '#8a8f9c', '#a3a8b4');
      folder(-130, -140, 260, 120, '#6f7584', '#8a8f9c');
      folder(-115, -20, 230, 70, '#555b69', '#6f7584');
      g.fillStyle = '#1b1d24'; g.fillRect(-80, -70, 160, 30);
      g.fillStyle = '#c9ced8'; for (let i = 0; i < 9; i++) g.fillRect(-76 + i * 18, -70, 8, 12 + Math.sin(t / 80 + i) * 4);
      for (const ex of [-50, 50]) {
        g.fillStyle = c.angry ? '#ff3b30' : '#ffcc00';
        g.beginPath(); g.moveTo(ex, -205); g.lineTo(ex + 26, -160); g.lineTo(ex - 26, -160); g.closePath(); g.fill();
        g.fillStyle = '#111'; g.fillRect(ex - 3, -195, 6, 20); g.fillRect(ex - 3, -171, 6, 6);
      }
      g.restore();
      g.font = `800 ${Math.max(12, 22 * c.scale)}px ui-monospace, Consolas, monospace`;
      g.textAlign = 'center';
      g.fillStyle = '#ff6a5a';
      // its name stays readable even when it's half off the screen
      const half = g.measureText('THE CLEANUP PROCESS').width / 2 + 12;
      g.fillText('THE CLEANUP PROCESS', Math.max(half, Math.min(W - half, c.x)), c.y - 270 * c.scale);
    }
    function paint(t) {
      const dt = Math.min(50, t - last);
      last = t;
      g.save();
      g.clearRect(0, 0, W, H);
      if (fx.shake > 0) { g.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake); fx.shake *= 0.92; }
      if (fx.kind === 'dust') {
        // her headlamp lighting up the dust: it swings over smoothly, never jumps
        const r = box(), lx = r.left + r.width * 0.76, ly = r.top + r.height * 0.19;
        const on = !!fx.beamTo && a.root.isConnected, ease = 1 - Math.exp(-dt / 170);
        if (on) {
          if (beam.k < 0.05) { beam.x = fx.beamTo[0]; beam.y = fx.beamTo[1]; }
          beam.x += (fx.beamTo[0] - beam.x) * ease; beam.y += (fx.beamTo[1] - beam.y) * ease;
        }
        beam.k += ((on ? 1 : 0) - beam.k) * (1 - Math.exp(-dt / 240));
        if (beam.k > 0.01) {
          const ang = Math.atan2(beam.y - ly, beam.x - lx), len = Math.hypot(beam.x - lx, beam.y - ly) + 120, k = beam.k * (0.94 + Math.sin(t / 90) * 0.03);
          const cone = g.createRadialGradient(lx, ly, 4, lx, ly, len);
          cone.addColorStop(0, `rgba(255, 246, 200, ${0.32 * k})`); cone.addColorStop(1, 'rgba(255, 246, 200, 0)');
          g.fillStyle = cone;
          g.beginPath(); g.moveTo(lx, ly); g.arc(lx, ly, len, ang - 0.2, ang + 0.2); g.closePath(); g.fill();
          // and a soft pool of light where it lands
          const pool = g.createRadialGradient(beam.x, beam.y, 2, beam.x, beam.y, 110);
          pool.addColorStop(0, `rgba(255, 240, 190, ${0.16 * k})`); pool.addColorStop(1, 'rgba(255, 240, 190, 0)');
          g.fillStyle = pool;
          g.beginPath(); g.arc(beam.x, beam.y, 110, 0, TAU); g.fill();
        }
        for (const m of motes) {
          m.x += m.vx * dt * 0.06; m.y += m.vy * dt * 0.06;
          if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
          g.fillStyle = `rgba(230, 220, 200, ${0.18 + Math.sin(t / 900 + m.x) * 0.08})`;
          g.beginPath(); g.arc(m.x, m.y, m.r, 0, TAU); g.fill();
        }
      } else if (fx.kind === 'world') {
        fx.scroll += fx.speed * dt * 0.06;
        const sky = g.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#0a0f2c'); sky.addColorStop(0.6, '#2b1b55'); sky.addColorStop(1, '#41296e');
        g.fillStyle = sky; g.fillRect(-20, -20, W + 40, H + 40);
        // far away: a mountain with a giant loading spinner over it
        const mx = W * 0.78 - fx.scroll * 0.04;
        g.fillStyle = '#1c1740'; g.beginPath(); g.moveTo(mx - 260, ground); g.lineTo(mx, H * 0.36); g.lineTo(mx + 260, ground); g.fill();
        for (let i = 0; i < 8; i++) {
          const ang = t / 160 + (i / 8) * TAU;
          g.fillStyle = `rgba(220, 230, 255, ${0.15 + (i / 8) * 0.6})`;
          g.beginPath(); g.arc(mx + Math.cos(ang) * 46, H * 0.24 + Math.sin(ang) * 46, 5 + i * 0.6, 0, TAU); g.fill();
        }
        // thumbnails drifting like little islands
        for (const is of islands) {
          const x = ((is.x - fx.scroll * 0.12) % (W + 120) + W + 120) % (W + 120) - 60, y = is.y + Math.sin(t / 900 + is.x) * 6;
          g.fillStyle = '#3d3170'; g.beginPath(); g.moveTo(x, y + 20); g.lineTo(x + is.w, y + 20); g.lineTo(x + is.w / 2, y + 44); g.fill();
          const pic = g.createLinearGradient(0, y, 0, y + 22); pic.addColorStop(0, '#7fd6ff'); pic.addColorStop(1, '#4fae6a');
          g.fillStyle = pic; g.beginPath(); g.roundRect(x, y, is.w, 22, 4); g.fill();
          g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(x + is.w / 2 - 4, y + 6); g.lineTo(x + is.w / 2 + 5, y + 11); g.lineTo(x + is.w / 2 - 4, y + 16); g.fill();
        }
        // folder skyscrapers, far ones dim and near ones bright
        for (const near of [false, true]) {
          for (const tw of towers.filter((it) => it.near === near)) {
            const span = 14 * 150, x = ((tw.x - fx.scroll * (near ? 0.6 : 0.3)) % span + span) % span - 150;
            const h = tw.h * (near ? 1 : 0.8), y = ground - h;
            folder(x, y, tw.w, h, near ? '#d9a93e' : '#3b3478', near ? '#f2c14e' : '#4a4290');
            g.fillStyle = near ? 'rgba(255, 245, 200, .5)' : 'rgba(180, 170, 255, .25)';
            for (let wy = y + 14; wy < ground - 10; wy += 16) for (let wx = x + 10; wx < x + tw.w - 10; wx += 16) if ((wx * 7 + wy * 3) % 5 > 1) g.fillRect(wx, wy, 7, 8);
          }
        }
        // the river of file names
        g.fillStyle = '#122b5e'; g.fillRect(-20, ground, W + 40, H - ground + 20);
        g.font = '12px ui-monospace, Consolas, monospace'; g.textAlign = 'left';
        for (let row = 0; row < 4; row++) {
          // each row repeats every its own length, so the names never run into each other
          const line = FILES.slice(row * 3).concat(FILES.slice(0, row * 3)).join('   ·   ') + '   ·   ', span = g.measureText(line).width;
          const y = ground + 16 + row * 16, off = (fx.scroll * (0.9 + row * 0.15) + t * 0.03 * (row + 1)) % span;
          g.fillStyle = `rgba(126, 232, 255, ${0.34 - row * 0.06})`;
          for (let x = -off; x < W; x += span) g.fillText(line, x, y);
        }
        g.fillStyle = 'rgba(160, 200, 255, .35)'; g.fillRect(-20, ground - 2, W + 40, 2);
        if (fx.chasm) {
          // a gap tears open in the world (the river pours into it), and the way out is on the other side
          const open = 1 - (1 - Math.min(1, (t - fx.chasm) / 700)) ** 3, cw = W * 0.3 * open, cx = W * 0.61 - cw / 2, deep = H - ground + 22;
          const pit = g.createLinearGradient(0, ground, 0, H);
          pit.addColorStop(0, '#1a1236'); pit.addColorStop(0.35, '#0a0718'); pit.addColorStop(1, '#020106');
          g.fillStyle = pit; g.fillRect(cx, ground - 2, cw, deep);
          // jagged cliff edges
          g.fillStyle = '#2a4f8e';
          for (const [ex, dir] of [[cx, 1], [cx + cw, -1]]) {
            g.beginPath(); g.moveTo(ex, ground - 2);
            for (let y = 0; y <= deep; y += 14) g.lineTo(ex + dir * (4 + ((y * 7) % 9)), ground + y);
            g.lineTo(ex, H + 20); g.closePath(); g.fill();
          }
          g.save(); g.beginPath(); g.rect(cx, ground, cw, deep); g.clip();
          g.font = '11px ui-monospace, Consolas, monospace';
          for (let i = 0; i < 22; i++) {
            const fy = (t / 5 + i * 37) % deep, x = cx + 10 + ((i * 53) % Math.max(1, cw - 20));
            g.fillStyle = `rgba(126, 232, 255, ${0.4 * (1 - fy / deep)})`;
            g.fillText(i % 2 ? '1' : '0', x, ground + fy);
          }
          g.restore();
          const px = W * 0.88, py = ground - 70, spin = t / 600;
          g.globalAlpha = open;
          for (let i = 0; i < 3; i++) {
            g.strokeStyle = `rgba(${i ? '255, 220, 120' : '126, 232, 255'}, ${0.8 - i * 0.2})`; g.lineWidth = 6 - i * 1.5;
            g.beginPath(); g.ellipse(px, py, 46 - i * 9, 70 - i * 12, Math.sin(spin + i) * 0.1, 0, TAU); g.stroke();
          }
          const core = g.createRadialGradient(px, py, 4, px, py, 60); core.addColorStop(0, 'rgba(255, 250, 220, .9)'); core.addColorStop(1, 'rgba(255, 220, 120, 0)');
          g.fillStyle = core; g.beginPath(); g.ellipse(px, py, 44, 66, 0, 0, TAU); g.fill();
          g.font = '800 13px ui-monospace, Consolas, monospace'; g.textAlign = 'center'; g.fillStyle = '#ffe9a8';
          g.fillText('RESTORE POINT', px, py - 86);
          g.globalAlpha = 1;
        }
        if (fx.creature && fx.chase) {
          // stomping after her
          const k = t - fx.chase;
          fx.creature.x = W * 0.18 + Math.sin(k / 300) * 20;
          fx.creature.y = ground + 10 - Math.abs(Math.sin(k / 160)) * 12;
        }
        if (fx.creature) creature(fx.creature, t);
        // its red beams: one sweeping the land, one locked on her
        if (fx.sweep) {
          const k = (t - fx.sweep) / 2200;
          if (k > 1) fx.sweep = null;
          else {
            const x = -200 + k * (W + 400), band = g.createLinearGradient(x - 90, 0, x + 90, 0);
            band.addColorStop(0, 'rgba(255, 40, 40, 0)'); band.addColorStop(0.5, 'rgba(255, 60, 50, .45)'); band.addColorStop(1, 'rgba(255, 40, 40, 0)');
            g.fillStyle = band; g.fillRect(x - 90, 0, 180, H);
          }
        }
        if (fx.target && fx.creature) {
          const c = fx.creature, ex = c.x, ey = c.y - 180 * c.scale, tx = fx.target.x, ty = fx.target.y;
          g.fillStyle = 'rgba(255, 50, 40, .28)';
          g.beginPath(); g.moveTo(ex, ey); g.lineTo(tx - 50, ty + 60); g.lineTo(tx + 50, ty + 60); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(255, 80, 60, .9)'; g.lineWidth = 2; g.beginPath(); g.ellipse(tx, ty + 56, 56, 14, 0, 0, TAU); g.stroke();
        }
        // the huge cursor slamming down
        if (fx.slam) {
          const k = Math.min(1, (t - fx.slam.t) / 260), y = -300 + k * (ground + 40);
          g.save(); g.translate(fx.slam.x, y - 230); g.scale(9, 9);
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 22); g.lineTo(5.5, 16.5); g.lineTo(9.5, 25); g.lineTo(13, 23.5); g.lineTo(9, 15); g.lineTo(16, 15); g.closePath();
          g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#000'; g.stroke();
          g.restore();
          if (k >= 1 && !fx.slam.hit) { fx.slam.hit = true; fx.shake = 26; Speech.tune('crash', 0.35); }
          if (t - fx.slam.t > 1400) fx.slam = null;
        }
        for (let i = fx.bits.length - 1; i >= 0; i--) {
          const b = fx.bits[i];
          b.vy += 0.25; b.x += b.vx; b.y += b.vy; b.r += b.vr;
          if (b.y > H + 40) { fx.bits.splice(i, 1); continue; }
          g.save(); g.translate(b.x, b.y); g.rotate(b.r);
          if (b.ch) { g.fillStyle = b.c; g.font = '800 16px ui-monospace, Consolas, monospace'; g.fillText(b.ch, 0, 0); }
          else folder(-18, -10, 36, 26, b.c, '#f2c14e');
          g.restore();
        }
        if (fx.alarm > 0) { g.fillStyle = `rgba(255, 0, 0, ${(Math.sin(t / 120) * 0.5 + 0.5) * 0.22 * fx.alarm})`; g.fillRect(-20, -20, W + 40, H + 40); }
      } else if (fx.kind === 'room' || fx.kind === 'fold') {
        const k = fx.kind === 'fold' ? Math.max(0.002, 1 - fx.fold) : 1;
        g.translate(W / 2, H / 2); g.scale(k, k); g.translate(-W / 2, -H / 2);
        const warm = g.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.5, Math.max(W, H) * 0.7);
        warm.addColorStop(0, '#7a4416'); warm.addColorStop(0.5, '#3a1c0c'); warm.addColorStop(1, '#140804');
        g.fillStyle = warm; g.fillRect(0, 0, W, H);
        for (const p of glows) {
          p.y -= p.v * dt * 0.05; if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
          g.fillStyle = `rgba(${p.c}, ${0.25 + Math.sin(t / 700 + p.x) * 0.15})`; g.fillRect(p.x, p.y, p.s, p.s);
        }
      }
      g.restore();
      // a black veil to fade a new place in
      if (fx.veil > 0.004) { g.fillStyle = `rgba(0, 0, 0, ${fx.veil})`; g.fillRect(0, 0, W, H); }
      if (fx.kind === 'fold' && fx.fold >= 1) { g.fillStyle = '#fff'; g.fillRect(W / 2 - 1, H / 2 - 1, 2, 2); }
      if (follow && a.root.isConnected) { const r = box(); put(r.right - r.width * 0.05, r.bottom - r.height * 0.25, 0.9); }
    }
    let painting = true;
    (async () => { while (painting && !ctx.cancelled) { await new Promise((res) => requestAnimationFrame(res)); paint(performance.now()); } })();
    ctx.onEnd(() => { painting = false; });

    // ================= ACT I: a disturbance in the library =================
    let stop = music('mystery', 6400);
    a.dress(LAMP);
    put(W * 0.5, H + 80, 0.4);
    // the shelf is your own clips when you have some (only looked at, never touched), made-up ones otherwise
    const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const yours = (state.library?.clips || []).filter((c) => c.thumbUrl).sort(() => Math.random() - 0.5).slice(0, 4);
    const shelf = [
      ['clutch_round_7.mp4', 'Excellent clip.', 'a'], ['boss_fight_final.mp4', 'Good clip.', 'b'],
      ['desktop_recording.mp4', 'Questionable clip.', 'c'], ['the_dance_again.mp4', "Oh, I've seen this one seventeen times.", 'd'],
    ].map(([name, line, look], i) => {
      const clip = yours[i];
      const shot = clip ? ` style="background: #000 url(&quot;${esc(clip.thumbUrl)}&quot;) center / cover"` : '';
      const el = stage.add(`lc-card lc-${look}`, `<div class="lc-shot"${shot}></div><div class="lc-name">${esc(clip ? clip.title : name)}</div>`);
      el.style.left = `${W * (0.2 + i * 0.2)}px`; el.style.top = `${H * 0.3 + (i % 2) * 26}px`;
      el.style.setProperty('--d', `${i * 0.15}s`);
      return { el, line, x: W * (0.2 + i * 0.2) };
    });
    await a.zoomTo(W * 0.08, H * 0.48 - size / 2, size);
    shelf.forEach((c) => pop(c.el));
    fx.beamTo = [W * 0.2, H * 0.32];
    await S('{shine}Another day. {pause}Another library. {pause}Another opportunity for greatness.', { hold: 300 });
    await P("You're supposed to be helping users.", { hold: 300 });
    await S("{smug}I am. {pause}I'm making sure the library has a strong emotional foundation.", { hold: 400 });
    a.root.classList.add('slow');
    for (const c of shelf) {
      // the lamp swings over to the next one while she walks
      fx.beamTo = [c.x, H * 0.33];
      a.lookAt(c.x, H * 0.33, true);
      await a.moveTo(c.x - size / 2, H * 0.52, { hop: false, ms: 900 });
      c.el.classList.add('lit');
      await S(c.line, { keepLook: true, hold: 200 });
      c.el.classList.remove('lit');
    }
    a.root.classList.remove('slow');
    // at the very bottom, in a dusty folder, something small
    const dusty = stage.add('lc-folder', '<i class="lc-web"></i><span>old_samples</span>');
    dusty.style.left = `${W * 0.5}px`; dusty.style.top = `${H * 0.8}px`;
    pop(dusty);
    put(W * 0.5, H * 0.8 + 6, 0.45);
    thumb.classList.add('in', 'dusty');
    await ctx.wait(900);
    flicker();
    await ctx.wait(1200);
    a.lookAt(W * 0.5, H * 0.8, true);
    fx.beamTo = [W * 0.5, H * 0.8];
    await ctx.wait(700);
    await S('{worried}...did that clip just blink?', { keepLook: true, hold: 300 });
    await P("It's a sample thumbnail. {pause}It's part of the event.", { hold: 200 });
    await S('{flat}It blinked.', { keepLook: true, hold: 200 });
    await P("It's an animation.", { hold: 200 });
    await S("{angry}THAT'S WHAT THEY WANT YOU TO THINK.", { shout: true, hold: 300 });
    // the dramatic zoom
    shelf.forEach((c) => c.el.classList.add('out'));
    a.hush();
    Speech.tune('sting', 0.5);
    thumb.classList.add('zoom');
    put(W * 0.5, H * 0.42, 2.6);
    const label = stage.add('lc-label', 'UNOPENED: 999 DAYS');
    label.style.left = `${W * 0.5}px`; label.style.top = `${H * 0.42 + 72}px`;
    fx.beamTo = [W * 0.5, H * 0.42];
    await ctx.wait(700);
    pop(label);
    await ctx.wait(800);
    await a.moveTo(W * 0.12, H * 0.42 - size / 2);
    await S('{shock}Nine hundred and ninety-nine days?', { hold: 200 });
    await P("It's fictional data.", { hold: 200 });
    await S('{shock}NINE HUNDRED AND NINETY-NINE DAYS ALONE?', { shout: true, hold: 300 });
    label.classList.add('out');
    thumb.classList.remove('dusty');
    put(W * 0.5, H * 0.46, 1.4);
    fx.beamTo = [W * 0.5, H * 0.46];
    await a.moveTo(W * 0.5 - size - 40, H * 0.46 - size / 2);
    // up close, she turns the lamp off so it isn't in his eyes
    fx.beamTo = null;
    a.lookAt(W * 0.5, H * 0.46);
    await S('{love}Hey, little guy.', { keepLook: true, hold: 300 });
    flicker();
    await S("{happy}Don't worry. {pause}I'm here now.", { keepLook: true, hold: 300 });
    // and then, of course
    const alert = stage.add('lc-alert', `<div class="lc-alert-head">SIMULATED CLEANUP EVENT</div>
      <div class="lc-alert-body">Unopened sample data scheduled for removal.</div><div class="lc-alert-bar"><i></i></div><div class="lc-alert-foot">CLEANUP IN PROGRESS...</div>`);
    Speech.tune('scan', 0.7);
    pop(alert);
    await ctx.wait(900);
    await S('{shock}PROGRAM.', { shout: true, hold: 200 });
    await P('Yes?', { hold: 200 });
    await S('{angry}WHY IS THE LITTLE GUY BEING EXECUTED?', { shout: true, hold: 200 });
    await P('Nothing is being executed. {pause}It is a simulated cleanup.', { hold: 200 });
    await S("{angry}THAT'S WHAT EXECUTION LOOKS LIKE WITH GOOD PR.", { shout: true, hold: 300 });
    await S('{angry}We are leaving.', { hold: 200 });
    follow = true;
    thumb.classList.add('held');
    squeak();
    await P('You cannot just take a thumbnail out of the interface.', { hold: 200 });
    a.look([0, 0.15]);
    await S('{smug}Watch me.', { keepLook: true, hold: 400 });
    // she pulls, and the whole interface stretches like rubber
    alert.classList.add('out');
    stop();
    stage.root.classList.add('lift');
    const app = document.querySelector('.app');
    app?.style.setProperty('--pull-x', `${box().left + size / 2}px`);
    app?.style.setProperty('--pull-y', `${box().top + size / 2}px`);
    app?.classList.add('lc-rubber');
    ctx.onEnd(() => app?.classList.remove('lc-rubber'));
    Mascot.face('wince');
    a.root.classList.add('crashing');
    for (let i = 0; i < 4; i++) { squeak(); await ctx.wait(360); }
    a.root.classList.remove('crashing');
    // WHOOSH: in they go
    Speech.tune('whoosh', 1);
    Speech.tune('rewind', 0.5);
    a.root.classList.add('lc-sucked');
    thumb.classList.add('lc-sucked');
    await ctx.wait(900);
    app?.classList.remove('lc-rubber');
    stage.root.classList.remove('lift');
    Mascot.face(null);
    follow = false;
    await ctx.wait(500);
    const where = { center: { x: W / 2, y: H * 0.42 }, x: W / 2 - 60, y: H * 0.42 - 60, size: 120 };
    await prog.say("...I'm going to need a minute.", { near: where, hold: 800 });
    prog.hush();
    dusty.classList.add('out');

    // ================= ACT II: the digital wilderness =================
    stage.root.classList.add('world');
    fx.kind = 'world';
    fx.speed = 0.4;
    fx.veil = 1;
    await tween(fx, { veil: 0 }, 900, (k) => k);
    // she lands face-first on a pile of icons
    a.root.classList.remove('lc-sucked');
    a.placeAt(W * 0.42 - size / 2, -size - 20);
    thumb.classList.remove('lc-sucked', 'held');
    put(W * 0.5, -60, 0.9);
    await ctx.wait(60);
    const pile = stage.add('lc-pile', '<i></i><i></i><i></i><i></i><i></i><i></i><i></i>');
    pile.style.left = `${W * 0.42}px`; pile.style.top = `${ground}px`;
    pop(pile);
    await standAt(W * 0.42, { hop: false, ms: 500 });
    Speech.tune('clunk', 0.9);
    a.trip();
    Mascot.face('wince');
    fx.shake = 10;
    await ctx.wait(700);
    Mascot.face(null);
    await S('{smug}I meant to do that.', { hold: 300 });
    put(W * 0.42 + size * 0.6, ground - 18, 0.9);
    squeak();
    await ctx.wait(700);
    await S("{shine}Okay. {pause}We're in the system.", { hold: 300 });
    await S('{worried}I have absolutely no idea where we are.', { hold: 300 });
    await P("You're inside a fictional representation of the app's storage system.", { hold: 300 });
    await S('{flat}Can you be less helpful and more scared? {pause}It would really help the atmosphere.', { hold: 300 });
    // BWOOOOM
    fx.sweep = performance.now();
    Speech.tune('beam', 0.8);
    await ctx.wait(1300);
    Speech.tune('sting', 0.9);
    stage.root.classList.add('shadow');
    fx.creature = { x: W * 0.84, y: ground + 10, scale: 0.35, angry: false };
    await ctx.wait(600);
    await tween(fx.creature, { scale: 0.7, x: W * 0.84 - 80 }, 1300);
    a.lookAt(fx.creature.x, fx.creature.y - 160, true);
    Mascot.face('shock');
    await ctx.wait(600);
    await S('{shock}...that is a very large metaphor.', { keepLook: true, hold: 200 });
    await P('It is a visual representation of the simulated cleanup.', { hold: 200 });
    await S('{angry}I KNOW WHAT IT REPRESENTS.', { shout: true, keepLook: true, hold: 300 });
    // it scans, and it finds her
    fx.target = { x: W * 0.2, y: ground - 60 };
    await tween(fx.target, { x: box().left + size / 2 }, 1600, (k) => (1 - Math.cos(k * Math.PI)) / 2);
    const detect = stage.add('lc-detect', 'UNREGISTERED OBJECT DETECTED.');
    Speech.tune('scan', 0.8);
    pop(detect);
    a.look([0.3, -0.2]);
    await S('{worried}You do not see us.', { keepLook: true, hold: 500 });
    fx.creature.angry = true;
    await S('{shock}You absolutely see us.', { keepLook: true, hold: 300 });
    detect.classList.add('out');
    fx.alarm = 1;
    fx.shake = 18;
    Speech.tune('glitch', 0.8);
    stop = music('battle', 3400);
    await ctx.wait(500);
    // RUN
    fx.target = null;
    follow = true;
    thumb.classList.add('held');
    await S('{shock}RUN, TINY MEMORY!', { shout: true, hold: 0 });
    a.hush();
    await a.moveTo(W * 0.62 - size / 2, ground - size * 0.92, { ms: 500 });
    tween(fx, { speed: 9 }, 600);
    await tween(fx.creature, { x: W * 0.18, scale: 0.95 }, 900);
    const chase = performance.now();
    fx.chase = chase;
    let hop = 0;
    while (performance.now() - chase < 6500) {
      const t = performance.now() - chase;
      if (t > hop) { a.bounce(); hop = t + 330; }
      // folders tumbling, file names flying apart
      if (Math.random() < 0.18) fx.bits.push({ x: W * (0.1 + Math.random() * 0.4), y: ground - 200 - Math.random() * 200, vx: 2 + Math.random() * 3, vy: -4 - Math.random() * 4, r: 0, vr: (Math.random() - 0.5) * 0.2, c: Math.random() < 0.5 ? '#d9a93e' : '#8a8f9c' });
      if (Math.random() < 0.35) fx.bits.push({ x: W * (0.2 + Math.random() * 0.3), y: ground + 20, vx: (Math.random() - 0.3) * 6, vy: -6 - Math.random() * 6, r: 0, vr: 0.1, ch: 'abcdefghijklmnopqrstuvwxyz.mp4'[Math.floor(Math.random() * 30)], c: '#7ee8ff' });
      if (t > 3000 && !fx.slam) fx.slam = { x: box().left - 40, t: performance.now() };
      await ctx.wait(30);
    }
    // it loses her
    fx.chase = 0;
    // she dives behind a folder
    // (in front of her, so it's on the page itself rather than behind her on the stage)
    const hide = document.createElement('div');
    hide.className = 'lc-hide';
    hide.innerHTML = '<span>misc_final_FINAL_2</span>';
    hide.style.left = `${W * 0.8}px`; hide.style.top = `${ground}px`;
    document.body.appendChild(hide);
    ctx.onEnd(() => hide.remove());
    pop(hide);
    tween(fx, { speed: 0.3 }, 800);
    await a.moveTo(W * 0.8 - size / 2, ground - size * 0.7, { ms: 600 });
    tween(fx, { alarm: 0.4 }, 600);
    fx.creature.angry = false;
    await S('{shine}Whoever named this folder is a genius.', { hold: 200 });
    await P('That was you.', { hold: 200 });
    await S('{angry}NOW IS NOT THE TIME.', { shout: true, hold: 300 });

    // ================= ACT III: the most dangerous button =================
    stop();
    stop = music('dread', 4000);
    tween(fx, { alarm: 0 }, 900);
    hide.classList.add('out');
    // the ground tears open ahead, and the Cleanup Process backs off to look for her somewhere else
    fx.chasm = performance.now();
    fx.shake = 8;
    Speech.tune('clunk', 0.6);
    tween(fx.creature, { x: W * 0.02, scale: 0.85 }, 1400, (k) => (1 - Math.cos(k * Math.PI)) / 2);
    await a.moveTo(W * 0.36 - size / 2, ground - size * 0.92);
    await ctx.wait(500);
    const bridge = stage.add('lc-bridge', `<div class="lc-bridge-title">THE BRIDGE OF QUESTIONABLE DESIGN <b>0/3</b></div>
      ${['SAVE', 'CANCEL', 'ARE YOU SURE?'].map((s, i) => `<button class="lc-step" data-i="${i}" style="left:${W * (0.52 + i * 0.09)}px;top:${ground + (i === 1 ? 10 : 0)}px;--d:${i * 0.4}s">${s}</button>`).join('')}
      <div class="lc-bridge-hint">Click the next button</div>`);
    pop(bridge);
    a.lookAt(W * 0.88, ground - 70);
    await S("{shine}Okay. {pause}We cross the bridge, enter the portal, and save our little friend.", { keepLook: true, hold: 200 });
    await P('The bridge is unstable.', { hold: 200 });
    await S('{smug}So am I. {pause}We have that in common.', { hold: 300 });
    // you help her across, one button at a time (if nobody does for a while, she goes on her own)
    const steps = [...bridge.querySelectorAll('.lc-step')], count = bridge.querySelector('.lc-bridge-title b');
    let next = 0, lastHelp = performance.now();
    const go = (i) => {
      if (i !== next) { steps[i].classList.remove('nope'); void steps[i].offsetWidth; steps[i].classList.add('nope'); Speech.tune('tick', 0.5); return; }
      next++;
      lastHelp = performance.now();
      steps[i].classList.add('pressed');
      Speech.tune('clunk', 0.9);
      count.textContent = `${next}/3`;
    };
    steps.forEach((b, i) => b.addEventListener('click', () => go(i)));
    for (let i = 0; i < 3; i++) {
      await new Promise((res) => {
        const loop = setInterval(() => {
          if (ctx.cancelled || next > i) { clearInterval(loop); res(); }
          else if (performance.now() - lastHelp > 25000) { go(i); }
        }, 60);
        ctx.onEnd(() => clearInterval(loop));
      });
      ctx.check();
      const r = steps[i].getBoundingClientRect();
      await a.moveTo(r.left + r.width / 2 - size / 2, r.top - size * 0.86, { ms: 600 });
      if (i === 1) {
        bridge.classList.add('tilt');
        Speech.tune('scratch', 0.4);
        Mascot.face('worried');
        await S('{worried}I would like to formally complain about the architecture.', { keepLook: true, hold: 300 });
        Mascot.face(null);
      }
    }
    bridge.querySelector('.lc-bridge-hint').textContent = '';
    a.twirl();
    await a.moveTo(W * 0.86 - size / 2, ground - size * 0.92, { ms: 700 });
    Speech.tune('whoosh', 0.8);
    a.root.classList.add('lc-sucked');
    thumb.classList.add('lc-sucked');
    await ctx.wait(800);
    stop();
    bridge.classList.add('out');
    pile.classList.add('out');
    fx.creature = null;
    fx.chasm = 0;
    stage.root.classList.remove('shadow');
    // the other side
    fx.kind = 'room';
    fx.veil = 1;
    stage.root.classList.add('warm');
    follow = false;
    a.root.classList.remove('lc-sucked');
    thumb.classList.remove('lc-sucked', 'held');
    a.placeAt(W * 0.22 - size / 2, H * 0.5 - size / 2);
    jump(W * 0.22 + size * 0.6, H * 0.5 + 30, 0.9);
    a.root.classList.add('lc-spat');
    thumb.classList.add('lc-spat');
    snappy.call('sound.blip', { pitch: 880, volume: Speech.volume * 0.8 }).catch(() => {});
    await tween(fx, { veil: 0 }, 700, (k) => k);
    a.root.classList.remove('lc-spat');
    thumb.classList.remove('lc-spat');
    await S('{joy}I DID IT!', { shout: true, hold: 200 });
    await P('You clicked three buttons.', { hold: 200 });
    await S('{angry}THREE BUTTONS THAT STOOD BETWEEN US AND OBLIVION.', { shout: true, hold: 300 });
    a.lookAt(W * 0.22 + size * 0.6, H * 0.5 + 30);
    await S("{love}We're almost home.", { keepLook: true, hold: 200 });
    flicker();
    const restore = stage.add('lc-restore', 'RESTORING... <b>12%</b>');
    restore.style.left = `${W * 0.22 + size * 0.6 + 40}px`; restore.style.top = `${H * 0.5 + 24}px`; restore.style.translate = '0 0';
    pop(restore);
    await ctx.wait(600);
    await S('{flat}Oh, come on.', { keepLook: true, hold: 500 });

    // ================= ACT IV: what was the clip? =================
    stop = music('lullaby', 7200);
    restore.classList.add('out');
    thumb.classList.add('float');
    put(W * 0.56, H * 0.42, 1.4);
    a.lookAt(W * 0.56, H * 0.42, true);
    await ctx.wait(1400);
    const pct = stage.add('lc-restore big', 'RESTORING... <b>12%</b>');
    pct.style.left = `${W * 0.56}px`; pct.style.top = `${H * 0.42 + 54}px`;
    pop(pct);
    for (let p = 12; p <= 100; p += 2) { pct.querySelector('b').textContent = `${p}%`; await ctx.wait(28); }
    Speech.tune('chime', 0.6);
    await ctx.wait(500);
    pct.classList.add('out');
    // it opens: a tiny video
    thumb.classList.add('gone');
    const video = stage.add('lc-video', `<canvas></canvas><div class="lc-video-bar"><i></i></div><div class="lc-video-time">0:00 / 0:03</div>`);
    video.style.left = `${W * 0.56}px`; video.style.top = `${H * 0.42}px`;
    const vc = video.querySelector('canvas'), vw = 320, vh = 180;
    vc.width = vw * dpr; vc.height = vh * dpr;
    const vg = vc.getContext('2d');
    vg.setTransform(dpr, 0, 0, dpr, 0, 0);
    clipFrame(vg, vw, vh, 0);
    pop(video);
    const play = async () => {
      const start = performance.now();
      let booped = false;
      for (;;) {
        ctx.check();
        const k = Math.min(1, (performance.now() - start) / 3000);
        clipFrame(vg, vw, vh, k);
        video.querySelector('.lc-video-bar i').style.width = `${k * 100}%`;
        video.querySelector('.lc-video-time').textContent = `0:0${Math.min(3, Math.floor(k * 3))} / 0:03`;
        if (k > 0.52 && !booped) { booped = true; snappy.call('sound.blip', { pitch: 320, volume: Speech.volume }).catch(() => {}); }
        if (k >= 1) break;
        await new Promise((res) => requestAnimationFrame(res));
      }
    };
    await ctx.wait(500);
    await play();
    await ctx.wait(1400);
    await S('{flat}...that\'s it?', { keepLook: true, hold: 300 });
    await P("That's the sample clip.", { hold: 200 });
    await S("{shock}I've risked my life for a recording of me falling over?", { keepLook: true, hold: 300 });
    await P('Technically, you risked your life for a simulated recording of you falling over.', { hold: 300 });
    await S('{flat}That distinction has done nothing for me.', { keepLook: true, hold: 300 });
    a.hush();
    await play();
    await ctx.wait(600);
    await play();
    Mascot.face('happy');
    await ctx.wait(700);
    await S('{open}Wait.', { keepLook: true, hold: 200 });
    await a.moveTo(Math.max(12, W * 0.56 - 400 - size / 2), H * 0.42 - size / 2, { hop: false, ms: 900 });
    a.lookAt(W * 0.56, H * 0.42);
    await S("{joy}That's actually kind of funny.", { keepLook: true, hold: 300 });
    await P('You laughed at your own accident.', { hold: 200 });
    await S('{smug}I am a very generous audience.', { keepLook: true, hold: 300 });
    await S('{sad}You were just sitting in that folder all this time.', { keepLook: true, hold: 300 });
    await S('{sad}Nobody watched you. {pause}Nobody even knew you were there.', { keepLook: true, hold: 600 });
    await S('{love}Well... {pause}I found you.', { keepLook: true, hold: 900 });
    a.hush();
    await ctx.wait(1000);
    const restored = stage.add('lc-stamp', 'SAMPLE CLIP RESTORED.');
    restored.style.left = `${W * 0.56 + 96}px`; restored.style.top = `${H * 0.42 - 128}px`;
    Speech.tune('coin', 0.5);
    pop(restored);
    await ctx.wait(900);
    await P("For what it's worth, the app doesn't measure the importance of a clip by how many times it's watched.", { hold: 600 });
    a.look([0, 0.1]);
    await S('{shine}That was surprisingly nice.', { hold: 200 });
    await P("Don't make it weird.", { hold: 200 });
    await S("{love}Too late. {pause}I'm emotionally invested.", { hold: 400 });
    restored.classList.add('out');
    video.classList.add('out');
    thumb.classList.remove('gone', 'float');
    put(W * 0.56, H * 0.42, 1);
    await ctx.wait(400);
    await a.moveTo(W * 0.56 - size - 30, H * 0.42 - size / 2);
    await S("{happy}Come on. {pause}Let's go home.", { keepLook: true, hold: 300 });
    follow = true;
    stop();

    // ================= ACT V: the hero returns =================
    a.hush();
    prog.hush();
    fx.kind = 'fold';
    Speech.tune('rewind', 0.6);
    await tween(fx, { fold: 1 }, 950, (k) => k * k * k, () => { a.root.style.opacity = String(1 - fx.fold); thumb.style.opacity = String(1 - fx.fold); });
    await ctx.wait(300);
    stage.root.classList.add('flash');
    Speech.tune('crash', 0.2);
    fx.kind = 'none';
    stage.root.classList.remove('warm', 'world');
    stage.root.classList.add('lift');
    a.dress(null);
    // back in the library, a little dizzy, right where the pedestal is about to go up
    follow = false;
    a.placeAt(W * 0.56 - size * 1.9, H * 0.5 - size / 2);
    jump(W * 0.56 - size * 1.9 + size * 1.1, H * 0.5 + 34, 0.9);
    await ctx.wait(80);
    a.root.style.opacity = '';
    thumb.style.opacity = '';
    a.trip();
    Mascot.face('dizzy');
    await ctx.wait(1400);
    Mascot.face(null);
    await P('Event complete. {pause}No actual files were modified.', { hold: 300 });
    await S('{worried}And the little guy?', { hold: 200 });
    await P('Still a fictional sample clip.', { hold: 200 });
    await S('{shine}But a fictional sample clip with a future.', { hold: 300 });
    // the pedestal, the spotlight, the fanfare
    const ped = stage.add('lc-pedestal', '<i class="lc-spot"></i><div class="lc-column"></div>');
    ped.style.left = `${W * 0.56}px`; ped.style.top = `${H * 0.62}px`;
    await a.zoomTo(W * 0.56 - size * 1.9, H * 0.5 - size / 2, size);
    thumb.classList.add('float');
    put(W * 0.56, H * 0.62 - 24, 1.2);
    pop(ped);
    stop = music('anthem', 5400);
    Speech.tune('fanfare', 0.6);
    const confetti = stage.add('lc-confetti', Array.from({ length: 40 }, (_, i) => `<i style="--x:${(i * 37) % 100}vw;--d:${(i % 10) * 0.2}s;--c:${['#ffd84a', '#ff6a8e', '#7ee8ff', '#9be38c'][i % 4]}"></i>`).join(''));
    pop(confetti);
    const title = stage.add('lc-title', '<div class="lc-title-main">SNAPPY: HERO OF THE LIBRARY</div><div class="lc-title-cause">CAUSE OF INCIDENT: SNAPPY.</div>');
    title.style.left = `${W * 0.56}px`; title.style.top = `${H * 0.2}px`;
    await ctx.wait(500);
    pop(title);
    a.twirl();
    await S("{shine}I'd like to thank myself, my bravery, and whoever invented buttons.", { hold: 300 });
    await P('You got scared of a loading bar.', { hold: 200 });
    await S('{angry}A LOADING BAR WITH BAD INTENTIONS.', { shout: true, hold: 200 });
    // the fanfare stops dead
    stop();
    Speech.tune('scratch', 0.8);
    confetti.classList.add('out');
    await ctx.wait(700);
    title.classList.add('cause');
    Speech.tune('tick', 0.8);
    await ctx.wait(900);
    a.lookAt(W * 0.56, H * 0.2, true);
    await ctx.wait(800);
    await S('{flat}Remove that.', { keepLook: true, hold: 300 });
    await P("It's part of the official report.", { hold: 200 });
    await S('{angry}I SAVED A LIFE.', { shout: true, hold: 200 });
    await P('You rescued a three-second video of yourself falling over.', { hold: 400 });
    a.lookAt(W * 0.56, H * 0.62 - 24, true);
    await ctx.wait(1000);
    a.look([0, 0.1], true);
    await ctx.wait(700);
    await S("{smug}And I'd do it again.", { hold: 900 });
    a.hush();
    prog.hush();
    // one more time, for the road
    thumb.classList.add('gone');
    const again = stage.add('lc-video small', '<canvas></canvas>');
    again.style.left = `${W * 0.56}px`; again.style.top = `${H * 0.62 - 50}px`;
    const ac = again.querySelector('canvas');
    ac.width = vw * dpr; ac.height = vh * dpr;
    const ag = ac.getContext('2d');
    ag.setTransform(dpr, 0, 0, dpr, 0, 0);
    pop(again);
    const begin = performance.now();
    let booped = false;
    for (;;) {
      ctx.check();
      const k = Math.min(1, (performance.now() - begin) / 3000);
      clipFrame(ag, vw, vh, k);
      if (k > 0.52 && !booped) { booped = true; snappy.call('sound.blip', { pitch: 320, volume: Speech.volume }).catch(() => {}); }
      // freeze frame, right as she falls
      if (k > 0.8) break;
      await new Promise((res) => requestAnimationFrame(res));
    }
    const freeze = stage.add('lc-freeze', '<div>SHE WOULD, IN FACT, DO IT AGAIN.</div>');
    Speech.tune('chime', 0.7);
    pop(freeze);
    await ctx.wait(3800);
    freeze.classList.add('out');
    again.classList.add('out');
    title.classList.add('out');
    ped.classList.add('out');
    await ctx.wait(600);
    prog.leave();
    stage.end();
    // she takes him home with her, and he stays for the rest of the day
    thumb.classList.add('gone');
    a.dress(LITTLE);
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    Events.linger('lastclip', midnight.getTime());
    await a.home({ handOff: () => Events.wearNow('littleclip') });
  }

  Events.define('lastclip', {
    tier: 'rare', title: 'The Last Clip', hint: 'A clip nobody ever opened. Somebody should.', run: lastClip, weight: 2,
  });
  // After the story he's at her side until midnight; after that he's hers to bring along (her wardrobe).
  Events.outfit('littleclip', { name: 'The little clip', markup: LITTLE, from: 'lastclip', day: () => Events.lasting('lastclip') });

  // ---- while she has him: now and then she pats him, sometimes they both eye a cleanup notice that pops up (it's
  // pretend too), and if the pointer comes near him, she tucks him away behind herself.
  const little = () => document.querySelector('#mascot .lc-little');
  let nextMove = 0, hiddenUntil = 0, told = 0;
  const replay = (el, cls) => { el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); };
  addEventListener('pointermove', (e) => {
    const him = little();
    if (!him || Events.running || Date.now() < hiddenUntil) return;
    const r = him.getBoundingClientRect();
    if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) > 60) return;
    hiddenUntil = Date.now() + 6000;
    him.classList.add('hiding');
    Mascot.flash('happy', 1200);
    if (Date.now() - told > 60000) { told = Date.now(); Speech.say("{smug}Nope. {pause}He's with me.", { kind: 'news', key: 'lastclip' }); }
    setTimeout(() => little()?.classList.remove('hiding'), 5000);
  }, { passive: true });
  setInterval(() => {
    const him = little();
    if (!him || Events.running || !document.hasFocus() || document.hidden) { nextMove = Date.now() + 15000; return; }
    if (Date.now() < nextMove || Date.now() < hiddenUntil) return;
    nextMove = Date.now() + 30000 + Math.random() * 30000;
    if (Math.random() < 0.6) {
      // a pat
      Mascot.flash('happy', 1100);
      replay(him, 'patted');
      return;
    }
    // that notice again. They both stare at it until it leaves.
    const r = document.getElementById('mascot').getBoundingClientRect();
    const tip = document.createElement('div');
    tip.className = 'lc-tip';
    tip.textContent = 'Cleanup? (just pretend)';
    tip.style.left = `${r.right + 40}px`;
    tip.style.top = `${r.top + 6}px`;
    document.body.appendChild(tip);
    void tip.offsetWidth;
    tip.classList.add('in');
    him.classList.add('suspicious');
    const slot = document.getElementById('mascot');
    Mascot.gaze(slot, [1, -0.2], true);
    setTimeout(() => { tip.classList.remove('in'); little()?.classList.remove('suspicious'); Mascot.gaze(slot, null); setTimeout(() => tip.remove(), 400); }, 3200);
  }, 1000);
})();
