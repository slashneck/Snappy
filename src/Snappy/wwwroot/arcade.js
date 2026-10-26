// The arcade: what every little game shares. A stage with Snappy and the Program for the story around it, a screen
// to play on (pixel or smooth, whatever the original was), keys and mouse, her tunes, best scores, and pictures of her
// and the Lag's minions in both styles.
// A game always waits for you to start it; if nobody comes for a few minutes (it started while you were away), she
// gives up, and it doesn't count as played.
(() => {
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* a best score might be forgotten, that's all */ } },
  };
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  // called once when the next game actually starts (past its title card)
  let claim = null;

  const PAL = { ink: '#0a0a0a', white: '#f4f4f4', pink: '#ff9db0', red: '#ff3b30', sky: '#2a1650', sky2: '#5b2a86', gold: '#ffe27a',
    cyan: '#7ee8ff', green: '#9be38c', purple: '#b28cff', minion: '#ff5a6e', minion2: '#a63148', grey: '#6b6b78' };

  // Her, 14 by 16 pixels (times px): shutter on top, body, record light, eyes, blush and two little feet.
  function pixelSnappy(g, x, y, { facing = 1, step = 0, air = false, px = 1, eyes = 'open' } = {}) {
    const f = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x + (facing > 0 ? dx : 14 - dx - w) * px), Math.round(y + dy * px), w * px, h * px); };
    f(3, 0, 5, 3, PAL.ink); f(4, 1, 3, 2, PAL.white);
    f(0, 3, 14, 11, PAL.ink); f(1, 4, 12, 9, PAL.white);
    f(11, 5, 2, 2, PAL.red);
    if (eyes === 'closed') { f(3, 8, 3, 1, PAL.ink); f(8, 8, 3, 1, PAL.ink); }
    else if (eyes === 'x') { f(4, 7, 1, 1, PAL.ink); f(5, 8, 1, 1, PAL.ink); f(4, 9, 1, 1, PAL.ink); f(9, 7, 1, 1, PAL.ink); f(10, 8, 1, 1, PAL.ink); f(9, 9, 1, 1, PAL.ink); }
    else { f(4, 7, 2, 3, PAL.ink); f(9, 7, 2, 3, PAL.ink); }
    f(2, 10, 2, 1, PAL.pink); f(11, 10, 2, 1, PAL.pink);
    const legs = air ? [3, 9] : step % 2 ? [2, 9] : [4, 8];
    f(legs[0], 14, 3, 2, PAL.ink); f(legs[1], 14, 3, 2, PAL.ink);
  }

  // One of the Lag's minions, 16 by 16: a lump of stuck pixels with a spinning eye.
  function minion(g, x, y, step = 0, px = 1) {
    const f = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x + dx * px), Math.round(y + dy * px), w * px, h * px); };
    f(1, 2, 14, 12, PAL.ink); f(2, 3, 12, 10, step % 2 ? PAL.minion : PAL.minion2);
    f(4, 5, 3, 3, step % 2 ? PAL.minion2 : PAL.minion); f(9, 9, 3, 2, step % 2 ? PAL.minion2 : PAL.minion);
    f(5, 5, 6, 5, PAL.ink); f(7 + (step % 2), 6, 2, 2, PAL.minion);
    f(step % 2 ? 2 : 4, 14, 4, 2, PAL.ink); f(step % 2 ? 10 : 8, 14, 4, 2, PAL.ink);
  }

  // Her again, smooth this time and drawn like the real mascot: (x, y) is the middle of her body, size is its width.
  // `legs` gives her two little feet (a step count, or 'air' to tuck them in); `body` recolors her.
  const TAU = Math.PI * 2;
  function eye(g, kind, side, lw, body, detail) {
    const path = (d) => { g.beginPath(); d(); g.stroke(); };
    g.lineWidth = lw;
    if (kind === 'happy' || (kind === 'wink' && side > 0)) return path(() => { g.moveTo(-15, 6); g.quadraticCurveTo(0, -14, 15, 6); });
    if (kind === 'closed') return path(() => { g.moveTo(-15, 1); g.quadraticCurveTo(0, 9, 15, 1); });
    if (kind === 'x') return path(() => { g.moveTo(-11, -11); g.lineTo(11, 11); g.moveTo(11, -11); g.lineTo(-11, 11); });
    if (kind === 'wince') return path(() => { g.moveTo(-11 * side, -11); g.lineTo(10 * side, 0); g.lineTo(-11 * side, 11); });
    if (kind === 'heart') {
      g.beginPath();
      g.moveTo(0, 15); g.bezierCurveTo(-21, 2, -22, -12, -12, -16); g.bezierCurveTo(-6, -18.5, -1.5, -15, 0, -10);
      g.bezierCurveTo(1.5, -15, 6, -18.5, 12, -16); g.bezierCurveTo(22, -12, 21, 2, 0, 15);
      g.fillStyle = '#ff6f8e'; g.fill(); g.lineWidth = lw * 0.7; g.stroke();
      return;
    }
    const k = kind === 'shock' ? 0.6 : kind === 'joy' ? 1.12 : 1;
    g.save();
    if (kind === 'flat' || kind === 'smug') { g.translate(0, 4); g.scale(1, kind === 'flat' ? 0.42 : 0.5); }
    g.scale(k, k);
    g.fillStyle = PAL.ink; g.beginPath(); g.ellipse(0, 0, 14, 20, 0, 0, TAU); g.fill();
    if (detail) {
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(-4.5, -8, 4, 5.5, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(5, 7, 2.6, 0, TAU); g.fill();
    }
    // a lid slanted across the top, for cross or sad
    if (kind === 'angry' || kind === 'sad') {
      const down = (kind === 'angry') === (side < 0);
      g.fillStyle = body; g.beginPath(); g.moveTo(-20, -26); g.lineTo(20, -26);
      g.lineTo(20, down ? -1 : -15); g.lineTo(-20, down ? -15 : -1); g.closePath(); g.fill();
    }
    g.restore();
  }
  function vectorSnappy(g, x, y, size, { facing = 1, eyes = 'open', squash = 0, tilt = 0, rec = false, legs = null, body = PAL.white, look = 0 } = {}) {
    const s = size / 180, lw = Math.max(6, 1.4 / s);
    g.save();
    g.translate(x, y);
    g.rotate(tilt);
    g.scale(facing * s * (1 + squash * 0.12), s * (1 - squash * 0.12));
    g.translate(-100, -118);
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = PAL.ink; g.lineWidth = lw;
    const shape = (d, fill) => { g.beginPath(); d(); g.fillStyle = fill; g.fill(); g.stroke(); };
    if (legs !== null) {
      const lift = legs === 'air' ? [10, 10] : legs % 2 ? [10, 0] : [0, 10];
      g.fillStyle = PAL.ink;
      for (const [i, fx] of [52, 120].entries()) { g.beginPath(); g.roundRect(fx, 168 - lift[i], 28, 26, 10); g.fill(); }
    }
    shape(() => g.roundRect(40, 34, 44, 28, 9), body);
    shape(() => g.roundRect(10, 54, 180, 128, 44), body);
    g.fillStyle = PAL.ink; g.beginPath(); g.roundRect(38, 76, 30, 12, 6); g.fill();
    g.lineWidth = lw * 0.75;
    shape(() => g.arc(158, 82, 7.5, 0, TAU), rec ? PAL.red : '#cfcfcf');
    g.fillStyle = PAL.pink;
    for (const cx of [50, 150]) { g.beginPath(); g.ellipse(cx, 147, 11, 6.5, 0, 0, TAU); g.fill(); }
    for (const [cx, side] of [[72, -1], [128, 1]]) {
      g.save();
      g.translate(cx + look * 9, 120);
      eye(g, eyes, side, lw, body, size > 40);
      g.restore();
    }
    g.restore();
  }

  // The Program, smooth: its dark round eye with the glowing iris. `look` moves the iris (-1 to 1).
  function programEye(g, x, y, r, { look = 0, alert = false } = {}) {
    g.save();
    g.translate(x, y);
    g.fillStyle = '#1b2a32'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.fillStyle = '#0a1318'; g.beginPath(); g.arc(0, 0, r * 0.88, 0, TAU); g.fill();
    g.fillStyle = '#12222b'; g.beginPath(); g.arc(0, 0, r * 0.52, 0, TAU); g.fill();
    const ix = look * r * 0.3, glow = g.createRadialGradient(ix, 0, 0, ix, 0, r * 0.62);
    glow.addColorStop(0, '#fff'); glow.addColorStop(0.22, '#fff');
    glow.addColorStop(0.38, alert ? '#ffd39a' : '#a6ecff'); glow.addColorStop(0.7, alert ? '#ff8a2b' : '#39a8db');
    glow.addColorStop(1, alert ? 'rgba(255, 138, 43, 0)' : 'rgba(57, 168, 219, 0)');
    g.fillStyle = glow; g.beginPath(); g.arc(ix, 0, r * 0.62, 0, TAU); g.fill();
    g.restore();
  }

  // Text with a hard shadow. `font` picks a family: monospace for pixel screens, one of FONTS, or any CSS family.
  const FONTS = { sans: '"Segoe UI", system-ui, sans-serif', serif: 'Georgia, "Times New Roman", serif', hand: '"Segoe Print", "Comic Sans MS", cursive',
    loud: '"Arial Black", Impact, sans-serif' };
  function text(g, s, x, y, { size = 8, color = PAL.white, align = 'left', bold = true, font = 'monospace', shadow = PAL.ink } = {}) {
    g.font = `${bold ? 'bold ' : ''}${size}px ${FONTS[font] || font}`;
    g.textAlign = align;
    if (shadow) {
      const d = font === 'monospace' ? 1 : Math.max(1, size / 14);
      g.fillStyle = shadow;
      g.fillText(s, x + d, y + d);
    }
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  // A game screen opens out of her like an iris and closes back into her: this points it at her (the screen is
  // centered in the window and ew by eh big).
  function aim(el, a, ew, eh) {
    const r = a.root.getBoundingClientRect();
    const ox = r.left + r.width / 2 - (innerWidth - ew) / 2, oy = r.top + r.height / 2 - (innerHeight - eh) / 2;
    const reach = Math.max(...[[0, 0], [ew, 0], [0, eh], [ew, eh]].map(([cx, cy]) => Math.hypot(cx - ox, cy - oy))) + 120;
    el.style.setProperty('--ox', `${Math.round(ox)}px`);
    el.style.setProperty('--oy', `${Math.round(oy)}px`);
    el.style.setProperty('--reach', `${Math.round(reach)}px`);
  }

  // The stage for a game's story, with Snappy out of her corner and the Program at hand.
  async function open(ctx, { size = 124 } = {}) {
    const stage = Program.cine(ctx, { bars: true });
    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    const prog = Program.program(ctx);
    const talk = Program.dialogue(a, prog);
    await a.zoomTo(innerWidth * 0.5 - size / 2, innerHeight * 0.46 - size / 2, size);

    // The screen she disappears into while you play. Games always draw in w by h; a pixel screen blows that up in
    // chunky pixels, a smooth one is drawn at the real resolution. `look` is a class for the frame around it.
    async function screen({ w = 320, h = 180, smooth = false, look = '' } = {}) {
      a.hush();
      prog.hush();
      const fit = Math.min((innerWidth * 0.86) / w, (innerHeight * 0.72) / h);
      const scale = smooth ? fit : Math.max(2, Math.floor(fit));
      const res = smooth ? scale * (devicePixelRatio || 1) : 1;
      const el = stage.add(`pf-screen${smooth ? ' smooth' : ''}${look ? ` ${look}` : ''}`,
        `<canvas width="${Math.round(w * res)}" height="${Math.round(h * res)}"></canvas><div class="pf-hint"></div>`);
      Object.assign(el.style, { width: `${Math.round(w * scale)}px`, height: `${Math.round(h * scale)}px` });
      const canvas = el.querySelector('canvas'), g = canvas.getContext('2d');
      g.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
      g.imageSmoothingEnabled = smooth;
      const hint = el.querySelector('.pf-hint');
      const iris = () => aim(el, a, w * scale, h * scale);
      iris();
      a.root.classList.remove('pf-back');
      a.root.classList.add('pf-inside');
      pop(el);
      Speech.tune('boot', 0.7);

      // keys held, keys just pressed, the mouse in screen pixels, clicks
      const keys = new Set(), fresh = new Set();
      const mouse = { x: w / 2, y: h / 2, down: false };
      let clicks = 0, started = 0;
      const begin = () => { started ||= performance.now(); };
      const down = (e) => {
        if (e.key === 'Escape') return;
        const k = e.key.toLowerCase();
        if (!e.repeat) fresh.add(k);
        keys.add(k);
        begin();
      };
      const up = (e) => keys.delete(e.key.toLowerCase());
      const move = (e) => {
        const r = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - r.left) / r.width) * w;
        mouse.y = ((e.clientY - r.top) / r.height) * h;
      };
      const press = (e) => { if (e.target.closest?.('.event-skip')) return; move(e); mouse.down = true; clicks++; begin(); };
      const release = () => { mouse.down = false; };
      addEventListener('keydown', down, true);
      addEventListener('keyup', up, true);
      addEventListener('pointermove', move, true);
      stage.root.addEventListener('pointerdown', press);
      addEventListener('pointerup', release, true);
      const unhook = () => {
        removeEventListener('keydown', down, true);
        removeEventListener('keyup', up, true);
        removeEventListener('pointermove', move, true);
        stage.root.removeEventListener('pointerdown', press);
        removeEventListener('pointerup', release, true);
      };
      ctx.onEnd(unhook);
      let last = performance.now(), due = 0;
      return {
        el, canvas, g, w, h, keys, mouse,
        get started() { return started; },
        hint(s) { hint.textContent = s || ''; },
        // was this key (or any of these) just pressed? Each press counts once.
        tap(...ks) { for (const k of ks) if (fresh.has(k)) { fresh.delete(k); return true; } return false; },
        held(...ks) { return ks.some((k) => keys.has(k)); },
        click() { if (!clicks) return false; clicks--; return true; },
        // the next frame, and how long since the last one (in 60ths of a second, capped). About sixty a second
        // whatever the screen does: on a 144 Hz screen everything that counts frames would run twice as fast.
        async tick() {
          ctx.check();
          do await frame(); while (performance.now() < due - 4);
          const now = performance.now(), dt = Math.min(2, (now - last) / 16.67);
          due = Math.max(due, now - 16.67) + 16.67;
          last = now;
          return dt;
        },
        // a title card until you press something; false if nobody does for a few minutes. `paint(t)` draws a game's
        // own title card instead of the usual one.
        async title(name, sub, how, paint) {
          const shown = performance.now();
          started = 0;
          fresh.clear();
          clicks = 0;
          hint.textContent = how;
          while (!started) {
            ctx.check();
            if (performance.now() - shown > 180000) return false;
            const t = performance.now();
            if (paint) paint(t);
            else if (smooth) {
              const sky = g.createLinearGradient(0, 0, 0, h);
              sky.addColorStop(0, PAL.sky); sky.addColorStop(1, PAL.sky2);
              g.fillStyle = sky; g.fillRect(0, 0, w, h);
              text(g, name, w / 2, h * 0.34, { size: h * 0.12, align: 'center', font: 'sans' });
              text(g, sub, w / 2, h * 0.43, { size: h * 0.045, color: PAL.gold, align: 'center', font: 'sans' });
              if (Math.floor(t / 500) % 2) text(g, 'Press any key', w / 2, h * 0.62, { size: h * 0.045, align: 'center', font: 'sans' });
              vectorSnappy(g, w / 2, h * 0.8 - Math.abs(Math.sin(t / 260)) * h * 0.05, h * 0.16, { legs: Math.floor(t / 260) });
            } else {
              g.fillStyle = PAL.sky; g.fillRect(0, 0, w, h);
              g.fillStyle = PAL.sky2; g.fillRect(0, h * 0.62, w, h * 0.38);
              text(g, name, w / 2, h * 0.36, { size: 20, align: 'center' });
              text(g, sub, w / 2, h * 0.36 + 16, { size: 8, color: PAL.gold, align: 'center' });
              if (Math.floor(t / 400) % 2) text(g, 'PRESS ANY KEY', w / 2, h * 0.72, { size: 8, align: 'center' });
              pixelSnappy(g, w / 2 - 7, h * 0.78, { step: Math.floor(t / 150) });
            }
            await frame();
          }
          fresh.clear();
          clicks = 0;
          last = performance.now();
          // from here on it counts as played (the arcade's one try a day)
          const c = claim;
          claim = null;
          c?.();
          return true;
        },
        async close() {
          unhook();
          iris();
          el.classList.add('out');
          await ctx.wait(520);
          a.root.classList.remove('pf-inside');
          a.root.classList.add('pf-back');
          await ctx.wait(280);
          el.remove();
          setTimeout(() => a.root.classList.remove('pf-back'), 400);
        },
      };
    }

    // the music loops until the game ends
    function music(name, every) {
      Speech.tune(name, 0.5);
      const loop = setInterval(() => { if (!ctx.cancelled) Speech.tune(name, 0.5); }, every);
      const stop = () => { clearInterval(loop); snappy.call('sound.hush').catch(() => {}); };
      ctx.onEnd(stop);
      return stop;
    }

    // nobody came to play: she says so, and it doesn't count
    async function abandon(scr) {
      await scr?.close();
      await talk.snappy('{sad}...nobody wants to play with me.', { hold: 1000 });
      await talk.snappy('{open}Okay. {pause}{wink}Some other time.', { hold: 800 });
      throw Events.SKIP;
    }

    // wraps up: everything put away, her home
    async function finish() {
      prog.hush();
      prog.leave();
      stage.end();
      await a.home();
    }

    return { stage, a, prog, S: talk.snappy, P: talk.program, screen, music, abandon, finish };
  }

  // A game's best score so far (higher is better unless lower is), saved as the new best when beaten.
  function best(id, score, lower = false) {
    const key = `snappy.arcade.${id}`;
    const old = Number(store.get(key) || (lower ? Infinity : 0));
    const beat = lower ? score < old : score > old;
    if (beat) store.set(key, String(score));
    return { old: Number.isFinite(old) ? old : null, beat, best: beat ? score : old };
  }
  // the best so far without touching it, or null if there isn't one yet
  const top = (id) => { const v = store.get(`snappy.arcade.${id}`); return v === null ? null : Number(v); };

  window.Arcade = { open, best, top, aim, onStart(fn) { claim = fn; }, snappy: pixelSnappy, vector: vectorSnappy, programEye, minion, text, FONTS, PAL, pop };
})();
