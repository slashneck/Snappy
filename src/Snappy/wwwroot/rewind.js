// Instant replay: the app rewinds like an old tape, a ghost of your own mouse pointer plays back what you just did,
// and Snappy calls it like a sports caster. The pointer's path is only ever kept in memory, for a few minutes, inside
// this window. It's never saved and never leaves the app.
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const KEEP = 4 * 60e3, SEGMENT = 14e3;

  // ---------------------------------------------------------------------------
  // The tape: where the pointer was, a few times a second, and what it was over
  // ---------------------------------------------------------------------------
  const tape = [];
  let lastAt = 0;
  addEventListener('pointermove', (e) => {
    const t = performance.now();
    if (t - lastAt < 33 || window.Events?.running) return;
    lastAt = t;
    tape.push({ t, x: e.clientX, y: e.clientY, el: e.target });
    while (tape.length && t - tape[0].t > KEEP) tape.shift();
  }, { passive: true, capture: true });
  addEventListener('pointerdown', (e) => {
    if (window.Events?.running) return;
    tape.push({ t: performance.now(), x: e.clientX, y: e.clientY, el: e.target, click: true });
  }, { passive: true, capture: true });

  // the last stretch of real moving about, up to where the pointer came to rest
  function segment() {
    if (tape.length < 40) return null;
    const end = tape[tape.length - 1].t;
    const part = tape.filter((p) => p.t >= end - SEGMENT);
    let dist = 0;
    for (let i = 1; i < part.length; i++) dist += Math.hypot(part[i].x - part[i - 1].x, part[i].y - part[i - 1].y);
    if (part.length < 30 || dist < 1500 || end - part[0].t < 6000) return null;
    return { part, dist, start: part[0].t, end };
  }

  // What the pointer was over, in a few words.
  function label(el) {
    const card = el?.closest?.('.card');
    if (card) { const t = card.querySelector('.card-title')?.textContent.trim(); return t ? `the clip "${t.length > 28 ? `${t.slice(0, 26)}...` : t}"` : 'a clip'; }
    const nav = el?.closest?.('.nav-item');
    if (nav) return `"${nav.querySelector('.nav-label')?.textContent.trim() || nav.textContent.trim()}"`;
    const btn = el?.closest?.('button');
    const text = btn?.textContent.replace(/\s+/g, ' ').trim();
    if (text && text.length < 24) return `the ${text} button`;
    const row = el?.closest?.('.row')?.querySelector('.row-title')?.textContent.trim();
    if (row) return `"${row}"`;
    if (el?.closest?.('.sidebar')) return 'the sidebar';
    return null;
  }

  // The highlights: where the pointer stopped to think, the fastest flick, and the clicks.
  function beats(seg) {
    const { part } = seg;
    const out = [];
    // dwells: a second and a half or more without going anywhere (a pointer at rest sends nothing, so it lasts until
    // the pointer moves away again)
    for (let i = 0; i < part.length;) {
      let j = i;
      while (j + 1 < part.length && Math.hypot(part[j + 1].x - part[i].x, part[j + 1].y - part[i].y) < 14) j++;
      const ms = (part[j + 1]?.t ?? part[j].t) - part[i].t;
      const what = label(part[i].el);
      if (ms >= 1500 && what) out.push({ t: part[i].t, kind: 'dwell', what, s: Math.round(ms / 1000) });
      i = j + 1;
    }
    let best = null;
    for (let i = 1; i < part.length; i++) {
      const v = Math.hypot(part[i].x - part[i - 1].x, part[i].y - part[i - 1].y) / Math.max(1, part[i].t - part[i - 1].t);
      if (v > 2.6 && (!best || v > best.v)) best = { t: part[i].t, kind: 'flick', v };
    }
    if (best) out.push(best);
    for (const p of part) if (p.click) { const what = label(p.el); if (what) out.push({ t: p.t, kind: 'click', what }); }
    // a few of them, spread out, in the order they happened
    out.sort((a, b) => a.t - b.t);
    const picked = [];
    for (const b of out) if (!picked.length || b.t - picked[picked.length - 1].t > 3200) picked.push(b);
    return picked.slice(0, 3);
  }

  const lines = {
    dwell: (b) => `{open}You hover over ${b.what}... {pause}for ${b.s} ${b.s === 1 ? 'second' : 'seconds'}. {smug}Bold.`,
    flick: () => '{shock}WHAT A FLICK!',
    click: (b) => `{shine}And the click! {pause}Right on ${b.what}!`,
  };

  // ---------------------------------------------------------------------------
  // The replay
  // ---------------------------------------------------------------------------
  function ghost(ctx) {
    const el = document.createElement('div');
    el.className = 'rw-ghost';
    el.innerHTML = '<canvas class="rw-trail"></canvas><div class="rw-pointer"><svg width="20" height="28" viewBox="0 0 20 28"><path d="M1.5 1.5v20.2l5.1-4.9 3.4 8.1 3.3-1.4-3.4-8h7.1z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg></div>';
    document.body.appendChild(el);
    ctx.onEnd(() => el.remove());
    const canvas = el.querySelector('canvas'), g = canvas.getContext('2d'), pointer = el.querySelector('.rw-pointer');
    const dpr = devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const trail = [];
    return {
      at(x, y, click = false) {
        pointer.style.transform = `translate(${x}px, ${y}px)`;
        trail.push({ x, y });
        if (trail.length > 18) trail.shift();
        g.clearRect(0, 0, innerWidth, innerHeight);
        for (let i = 1; i < trail.length; i++) {
          g.strokeStyle = `rgba(160, 230, 255, ${(i / trail.length) * 0.5})`;
          g.lineWidth = 2 + (i / trail.length) * 3;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(trail[i - 1].x, trail[i - 1].y);
          g.lineTo(trail[i].x, trail[i].y);
          g.stroke();
        }
        if (click) { pointer.classList.remove('click'); void pointer.offsetWidth; pointer.classList.add('click'); }
      },
    };
  }

  // Plays a stretch of the tape: from one moment to another (backwards when from > to), sped up by `speed`.
  async function run(ctx, seg, g, from, to, speed, onTime) {
    const { part } = seg;
    const start = performance.now(), length = Math.abs(to - from) / speed;
    let i = 0, last = null;
    for (;;) {
      ctx.check();
      const k = Math.min(1, (performance.now() - start) / length);
      const t = from + (to - from) * k;
      while (i + 1 < part.length && part[i + 1].t <= t) i++;
      while (i > 0 && part[i].t > t) i--;
      const p = part[i], q = part[Math.min(part.length - 1, i + 1)];
      // between two samples it glides, but after a rest it stays put until the pointer moved on
      const gap = q.t - p.t;
      const f = gap <= 0 ? 0 : gap > 150 ? Math.max(0, Math.min(1, (t - (q.t - 60)) / 60)) : Math.max(0, Math.min(1, (t - p.t) / gap));
      g.at(p.x + (q.x - p.x) * f, p.y + (q.y - p.y) * f, p.click && last !== i && to > from);
      last = i;
      onTime?.(t);
      if (k >= 1) break;
      await new Promise((res) => requestAnimationFrame(res));
    }
  }

  async function rewind(ctx) {
    const seg = segment();
    if (!seg) return;
    const W = innerWidth, H = innerHeight, size = 116;
    Events.stage(ctx, { dim: false });
    const vhs = document.createElement('div');
    vhs.className = 'rw-vhs';
    vhs.innerHTML = '<div class="rw-noise"></div><div class="rw-band"></div><div class="rw-osd"><b>&#9664;&#9664;</b> <span>REWIND</span></div><div class="rw-time"></div>';
    document.body.appendChild(vhs);
    ctx.onEnd(() => { vhs.remove(); document.documentElement.classList.remove('rw-tape'); });
    const osd = vhs.querySelector('.rw-osd'), clock = vhs.querySelector('.rw-time');
    const stamp = (t) => {
      const s = Math.max(0, (t - seg.start) / 1000);
      clock.textContent = `0:00:${String(Math.floor(s)).padStart(2, '0')}`;
    };

    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    const S = async (text, opts = {}) => { a.look([0, 0.12]); await a.say(text, opts); };
    await a.zoomTo(W - size - 70, H * 0.5 - size / 2, size);
    await S("{shine}Hold on. {pause}Let's see that again.", { hold: 600 });
    a.hush();

    // rewinding: the whole app wobbles, the ghost goes backwards, fast
    document.documentElement.classList.add('rw-tape');
    vhs.classList.add('in');
    Speech.tune('rewind', 0.8);
    const g = ghost(ctx);
    await run(ctx, seg, g, seg.end, seg.start, 6, stamp);
    Speech.tune('clunk');
    osd.innerHTML = '<b>&#9654;</b> <span>PLAY</span>';
    vhs.classList.add('playing');
    document.documentElement.classList.remove('rw-tape');
    await ctx.wait(500);

    // and again, at normal speed, with commentary
    const plays = beats(seg);
    let said = 0;
    const talk = (async () => {
      await S("{shine}And we're LIVE! {pause}Let's go to the replay!", { hold: 300 });
      for (const b of plays) {
        while (performance.now() < (seg.playFrom ?? Infinity) + (b.t - seg.start) - 400) await ctx.wait(60);
        await S(lines[b.kind](b), { hold: 500 });
        said++;
      }
    })();
    seg.playFrom = performance.now();
    await run(ctx, seg, g, seg.start, seg.end, 1, stamp);
    await ctx.run(talk);
    if (!said) await S('{open}A quiet game so far. {pause}{smug}Very tactical.', { hold: 600 });
    const meters = (seg.dist * 0.00026).toFixed(1);
    await S(`{happy}That's ${meters} meters of mouse. {pause}{joy}What a play!`, { hold: 800 });
    Speech.tune('clunk');
    osd.innerHTML = '<b>&#10074;&#10074;</b> <span>STOP</span>';
    a.hush();

    const prog = Program.program(ctx);
    const conv = Program.dialogue(a, prog);
    await conv.program(`That was ${Math.round((performance.now() - seg.end) / 1000)} seconds ago.`, { hold: 1000 });
    await conv.snappy("{smug}Instant replay. {pause}{wink}I'm a camera, it's what I do.");
    await conv.program('Nothing was recorded. {pause}It was only in memory, and now it is gone.', { hold: 1300 });
    prog.hush();
    prog.leave();
    vhs.classList.remove('in');
    await ctx.wait(400);
    await a.home();
  }

  Events.define('rewind', {
    tier: 'uncommon', title: 'Instant Replay', hint: 'Move around the app for a bit. Someone is keeping score.', run: rewind, weight: 2,
    when: () => !!segment(),
  });
})();
