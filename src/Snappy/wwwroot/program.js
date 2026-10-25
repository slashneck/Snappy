// The Program: the voice of the app itself. Calm, precise, and entirely unimpressed by Snappy. It only ever shows up
// in her stories, as a panel at the top of the window with one glowing eye. Also here: the stage those stories play
// on, and the props they use.
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  // ---------------------------------------------------------------------------
  // The stage: the app dims, black bars slide in, and there's a layer for props. Snappy's own adventures use a
  // lighter one: no bars, and the app stays a little more visible.
  // ---------------------------------------------------------------------------
  function cine(ctx, { bars = true, light = false } = {}) {
    const root = document.createElement('div');
    root.className = `cine${bars ? '' : ' no-bars'}${light ? ' light' : ''}`;
    root.innerHTML = '<div class="cine-dim"></div><canvas class="cine-fx"></canvas><div class="cine-props"></div><div class="cine-bar top"></div><div class="cine-bar bottom"></div>';
    document.body.appendChild(root);
    void root.offsetWidth;
    root.classList.add('in');
    const props = root.querySelector('.cine-props');
    const me = {
      root, props,
      add(cls, html = '') {
        const el = document.createElement('div');
        el.className = cls;
        el.innerHTML = html;
        props.appendChild(el);
        return el;
      },
      async end() {
        if (!root.isConnected) return;
        root.classList.remove('in');
        root.classList.add('out');
        await wait(700);
        root.remove();
      },
    };
    ctx.onEnd(() => me.end());
    return me;
  }

  // Pops a prop in, or out (and then removes it).
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };
  const unpop = async (el, ms = 420) => { el.classList.remove('in'); el.classList.add('out'); await wait(ms); el.remove(); };

  // ---------------------------------------------------------------------------
  // The Program's panel and voice
  // ---------------------------------------------------------------------------
  // Its eye watches from the top of the window. What it says shows up right where Snappy's lines do, under her, so
  // there's only ever one place to read.
  function program(ctx) {
    const el = document.createElement('div');
    el.className = 'program';
    el.innerHTML = '<div class="program-eye"><i></i></div><div class="program-name">PROGRAM</div>';
    const box = document.createElement('div');
    box.className = 'program-box';
    box.innerHTML = '<div class="program-label"><i></i>PROGRAM</div><div class="program-text"></div>';
    document.body.append(el, box);
    const eye = el.querySelector('.program-eye');
    const text = box.querySelector('.program-text');
    let shown = false;
    const pulse = () => { eye.classList.remove('pulse'); void eye.offsetWidth; eye.classList.add('pulse'); };
    // every word the same length, a short stop at commas and full stops: it reads, it doesn't talk
    const pauses = (ch, next) => (next && !/\s/.test(next) ? 0 : ch === ',' ? 150 : '.!?'.includes(ch) ? 240 : 0);
    // centred under Snappy, the same spot as her bubble, and never out of the window
    const place = (a) => {
      const w = Math.min(420, innerWidth - 24);
      box.style.width = `${w}px`;
      box.style.left = `${Math.round(Math.max(12, Math.min(a.center.x - w / 2, innerWidth - w - 12)))}px`;
      // under her, or above her when that would run off the bottom of the window
      let top = a.y + a.size + 12;
      if (top + box.offsetHeight > innerHeight - 12) top = Math.max(12, a.y - 12 - box.offsetHeight);
      box.style.top = `${Math.round(top)}px`;
    };
    const me = {
      el,
      async say(line, { hold, alert = false, near } = {}) {
        ctx.check();
        if (!shown) {
          shown = true;
          Speech.tune('scan', 0.6);
          void el.offsetWidth;
          el.classList.add('in');
          await ctx.wait(420);
        }
        el.classList.toggle('alert', alert);
        box.classList.toggle('alert', alert);
        // the text is laid out before the box pops, so it never changes size while it types
        const w = Speech.typewriter(text, line, { speed: 31, voice: Speech.programBlip, onWord: () => { Speech.programWord(); pulse(); }, pauses });
        if (near) place(near);
        box.classList.remove('in');
        void box.offsetWidth;
        box.classList.add('in');
        el.classList.add('speaking');
        ctx.writers.add(w);
        try { await ctx.run(w.done); } finally { ctx.writers.delete(w); el.classList.remove('speaking'); }
        await ctx.wait(Speech.readTime(line, hold));
      },
      // someone else is talking
      hush() { box.classList.remove('in'); },
      // 'rogue' when it has gone wrong, null for its usual self
      mood(m) { el.classList.toggle('rogue', m === 'rogue'); box.classList.toggle('rogue', m === 'rogue'); },
      // where the eye looks, -1 to 1
      look(x) { eye.style.setProperty('--px', `${Math.max(-1, Math.min(1, x)) * 7}px`); },
      async leave() {
        box.classList.remove('in');
        el.classList.remove('in');
        el.classList.add('out');
        await wait(500);
        el.remove();
        box.remove();
      },
    };
    ctx.onEnd(() => me.leave());
    return me;
  }

  // A conversation between Snappy and the Program: one talks at a time, and each looks at whoever is talking.
  function dialogue(a, prog) {
    // what the Program said stays under her only until she moves
    a.onMove = () => prog.hush();
    return {
      async snappy(text, opts) {
        prog.hush();
        prog.look((a.center.x - innerWidth / 2) / (innerWidth / 2));
        if (!opts?.keepLook) a.look([0, 0.12]);
        await a.say(text, opts);
      },
      async program(text, opts) {
        a.hush();
        const r = prog.el.getBoundingClientRect();
        if (!opts?.keepLook) a.lookAt(r.left + r.width / 2, r.top + r.height / 2);
        prog.look(0);
        await prog.say(text, { ...opts, near: opts?.near || a });
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  // whole euros with cents, and the crumbs after a crash with as many digits as they need
  const eur = (v) => (v >= 0.01 || v === 0
    ? `€${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `€${v.toFixed(7).replace(/0+$/, '')}`);

  // A report window that fills in line by line.
  function report(stage, title, rows) {
    const el = stage.add('pg-window pg-report', `<div class="pg-title"><i></i>${esc(title)}</div>
      <div class="pg-rows">${rows.map(([label, value, bad]) => `<div class="pg-row${bad ? ' bad' : ''}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('')}</div>`);
    pop(el);
    const lines = [...el.querySelectorAll('.pg-row')];
    return {
      el,
      show(i) { lines[i]?.classList.add('in'); Speech.tune('tick', 0.8); },
      close: () => unpop(el),
    };
  }

  // A light bulb over her head: lights up, flickers, and burns out.
  function bulb(a) {
    const el = document.createElement('div');
    el.className = 'actor-bulb';
    el.innerHTML = `<svg viewBox="0 0 40 56"><g class="bulb-rays" stroke="#ffe27a" stroke-width="3" stroke-linecap="round"><path d="M20 2v-6M4 10l-4-4M36 10l4-4M-2 24h-5M42 24h5"/></g>
      <path class="bulb-glass" d="M20 4C10.6 4 4 11 4 19.5c0 6.3 3.6 10 6.4 13.3 1.9 2.2 2.6 4 2.6 6.2h14c0-2.2.7-4 2.6-6.2C32.4 29.5 36 25.8 36 19.5 36 11 29.4 4 20 4z" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M15 30l2.5-8 2.5 5 2.5-5 2.5 8" fill="none" stroke="#7a6a3a" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="13" y="39" width="14" height="10" rx="2.5" fill="#9a9a9a" stroke="#0a0a0a" stroke-width="2.5"/><path d="M13 43.5h14" stroke="#0a0a0a" stroke-width="2"/></svg>
      <span class="bulb-smoke"></span><span class="bulb-smoke s2"></span>`;
    a.root.appendChild(el);
    return {
      on() { pop(el); el.classList.add('lit'); Speech.tune('coin', 0.7); },
      flicker() { el.classList.add('flicker'); },
      burn() { el.classList.remove('flicker', 'lit'); el.classList.add('burnt'); Speech.tune('fizz'); },
      gone: () => unpop(el, 500),
    };
  }

  // A scan line passing over her, twice.
  async function scan(ctx, a) {
    const el = document.createElement('div');
    el.className = 'actor-scan';
    a.root.appendChild(el);
    Speech.tune('scan');
    void el.offsetWidth;
    el.classList.add('in');
    try { await ctx.wait(1700); } finally { el.remove(); }
  }

  // The coin itself, with Snappy stamped on it.
  const COIN_FACE = `<svg viewBox="0 0 100 100"><g fill="none" stroke="#7a4f00" stroke-width="5" stroke-linejoin="round">
    <rect x="22" y="38" width="56" height="38" rx="14"/><path d="M32 38v-6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6"/></g>
    <ellipse cx="42" cy="56" rx="4" ry="6" fill="#7a4f00"/><ellipse cx="58" cy="56" rx="4" ry="6" fill="#7a4f00"/></svg>`;
  const coinHtml = (cls = '') => `<div class="sc-coin ${cls}"><div class="sc-coin-face">${COIN_FACE}</div></div>`;

  function coinLogo(stage) {
    const el = stage.add('sc-logo', `${coinHtml()}<div class="sc-word">SNAPPYCOIN</div><div class="sc-tag">THE FUTURE OF FINANCE</div><div class="sc-trust">Trust me bro.™</div>
      <button class="sc-server" tabindex="-1">CREATE DISCORD SERVER</button>`);
    return {
      el,
      async reveal(ctx) {
        pop(el);
        Speech.tune('whoosh');
        await ctx.wait(500);
        Speech.tune('coin');
        el.classList.add('word');
        await ctx.wait(700);
        el.classList.add('tag');
        await ctx.wait(800);
        el.classList.add('trust');
      },
      server() { el.classList.add('server'); Speech.tune('tick'); },
      faster() { el.classList.add('fast'); },
      close: () => unpop(el, 500),
    };
  }

  // The price chart: candles drawn on a canvas, a ticker on top. It climbs, freezes and crashes on cue.
  function chart(ctx, stage) {
    const el = stage.add('pg-window sc-chart', `<div class="sc-head">${coinHtml('small')}<div class="sc-name">SNAPPYCOIN<span>SNC / EUR</span></div>
      <div class="sc-price"><b>€1.00</b><em>+0.00%</em></div></div><div class="sc-plot"><canvas></canvas><div class="sc-pop"></div></div>
      <div class="sc-foot"><span class="sc-cap">Market cap €84,000.00</span><span class="sc-vol">Volume €0.00</span></div>`);
    const canvas = el.querySelector('canvas');
    const g = canvas.getContext('2d');
    const priceEl = el.querySelector('.sc-price b'), changeEl = el.querySelector('.sc-price em');
    const capEl = el.querySelector('.sc-cap'), volEl = el.querySelector('.sc-vol'), popEl = el.querySelector('.sc-pop');
    const SUPPLY = 84000, CANDLES = 34;
    let candles = [];
    let price = 1, lo = -0.4, hi = 0.6, mode = 'idle', frame = 0, lockedScale = false;
    let target = null; // { fromLog, toLog, start, ms }
    let lastCandle = 0, volume = 0;
    for (let i = 0; i < 14; i++) {
      const o = 1 * (1 + (Math.random() - 0.5) * 0.04), c = o * (1 + (Math.random() - 0.5) * 0.05);
      candles.push({ o, c, h: Math.max(o, c) * 1.015, l: Math.min(o, c) * 0.985 });
    }

    // the layout size, not the on-screen one: the window pops in scaled down, and the drawing must not be
    const fit = () => {
      const dpr = devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    function addCandle(close) {
      const o = candles[candles.length - 1].c;
      const up = close >= o;
      const wick = 1 + Math.random() * 0.04;
      candles.push({ o, c: close, h: Math.max(o, close) * (up ? wick : 1.01), l: Math.min(o, close) / (up ? 1.01 : wick) });
      if (candles.length > CANDLES) candles.shift();
    }

    function draw(now) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (target && mode === 'climb' && now - lastCandle > 95) {
        lastCandle = now;
        const t = Math.min(1, (now - target.start) / target.ms);
        const goal = 10 ** lerp(target.fromLog, target.toLog, t);
        // mostly up, with the odd little dip so it looks like a market
        const close = t >= 1 ? goal : Math.random() < 0.16 ? price * (0.95 + Math.random() * 0.03) : goal * (1 + (Math.random() - 0.3) * 0.06);
        price = close;
        addCandle(close);
        if (t >= 1) { price = goal; target.done?.(); target = null; mode = 'hold'; }
        setTicker();
      }
      if (mode === 'crash' && now - lastCandle > 70) {
        lastCandle = now;
        price = Math.max(1e-7, price * 0.06);
        addCandle(price);
        setTicker();
      }
      // the scale follows the price, except during the crash: then it stays put and the price falls right through
      const logs = candles.flatMap((k) => [Math.log10(k.h), Math.log10(k.l)]);
      if (!lockedScale) {
        const want = [Math.min(...logs), Math.max(...logs)];
        const pad = Math.max(0.12, (want[1] - want[0]) * 0.12);
        lo = lerp(lo, want[0] - pad, 0.12);
        hi = lerp(hi, want[1] + pad, 0.12);
      }
      const y = (v) => h - ((Math.log10(v) - lo) / (hi - lo)) * h;
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(160, 220, 255, .07)';
      g.lineWidth = 1;
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(0, Math.round((h * i) / 5) + 0.5); g.lineTo(w, Math.round((h * i) / 5) + 0.5); g.stroke(); }
      const step = w / CANDLES, bw = Math.max(3, step * 0.58);
      candles.forEach((k, i) => {
        const x = i * step + step / 2;
        const up = k.c >= k.o;
        const color = mode === 'frozen' ? (up ? '#7fa58e' : '#a57f7f') : up ? '#36d77a' : '#ff5148';
        g.strokeStyle = color;
        g.fillStyle = color;
        g.beginPath(); g.moveTo(x, y(k.h)); g.lineTo(x, y(k.l)); g.stroke();
        const top = y(Math.max(k.o, k.c)), bottom = y(Math.min(k.o, k.c));
        g.fillRect(x - bw / 2, top, bw, Math.max(1.5, bottom - top));
      });
      // a glowing line through the closes
      g.beginPath();
      candles.forEach((k, i) => { const x = i * step + step / 2; if (i) g.lineTo(x, y(k.c)); else g.moveTo(x, y(k.c)); });
      g.strokeStyle = mode === 'crash' || mode === 'down' ? 'rgba(255, 90, 80, .5)' : 'rgba(80, 255, 160, .35)';
      g.lineWidth = 2;
      g.shadowColor = g.strokeStyle;
      g.shadowBlur = 12;
      g.stroke();
      g.shadowBlur = 0;
      frame = requestAnimationFrame(draw);
    }

    function setTicker() {
      priceEl.textContent = eur(price);
      const change = (price - 1) * 100;
      changeEl.textContent = change > -99.99 ? `${change >= 0 ? '+' : ''}${change.toLocaleString('en-US', { maximumFractionDigits: 2 })}%` : '-99.99%';
      el.classList.toggle('down', change < 0);
      const cap = price * SUPPLY;
      capEl.textContent = `Market cap ${cap >= 1e9 ? `€${(cap / 1e9).toFixed(1)} billion` : eur(cap)}`;
      volEl.textContent = `Volume ${eur(volume)}`;
    }

    // a little label that floats up out of the chart
    function shout(text, cls = '') {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = text;
      popEl.appendChild(s);
      setTimeout(() => s.remove(), 1700);
    }

    const me = {
      el,
      show() { pop(el); requestAnimationFrame(() => { fit(); frame = requestAnimationFrame(draw); }); },
      climbTo(to, ms) {
        mode = 'climb';
        return new Promise((done) => { target = { fromLog: Math.log10(price), toLog: Math.log10(to), start: performance.now(), ms, done }; });
      },
      set volume(v) { volume = v; setTicker(); },
      shout,
      freeze() { mode = 'frozen'; target = null; el.classList.add('frozen'); },
      crash() {
        mode = 'crash';
        lockedScale = true;
        el.classList.remove('frozen');
        el.classList.add('crash');
        setTimeout(() => { if (mode === 'crash') { mode = 'down'; price = 1e-7; setTicker(); } }, 900);
      },
      // and it keeps going down, right out of the window
      sink() { el.classList.add('sink'); },
      close: () => unpop(el, 600),
    };
    addEventListener('resize', fit);
    ctx.onEnd(() => { cancelAnimationFrame(frame); removeEventListener('resize', fit); });
    return me;
  }

  // A faint chart drifting up behind everything.
  function backdropChart(ctx, stage) {
    const canvas = document.createElement('canvas');
    canvas.className = 'cine-chart';
    stage.root.insertBefore(canvas, stage.props);
    const g = canvas.getContext('2d');
    let frame = 0;
    const pts = [];
    let v = 0;
    const fit = () => {
      const dpr = devicePixelRatio || 1;
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    for (let i = 0; i < 60; i++) { v += (Math.random() - 0.38) * 14; pts.push(v); }
    let last = 0;
    const draw = (now) => {
      if (now - last > 160) {
        last = now;
        v += (Math.random() - 0.36) * 14;
        pts.push(v);
        pts.shift();
      }
      const w = innerWidth, h = innerHeight;
      const lo = Math.min(...pts), hi = Math.max(...pts);
      g.clearRect(0, 0, w, h);
      g.beginPath();
      pts.forEach((p, i) => {
        const x = (i / (pts.length - 1)) * w, yy = h * 0.82 - ((p - lo) / (hi - lo || 1)) * h * 0.55;
        if (i) g.lineTo(x, yy); else g.moveTo(x, yy);
      });
      g.strokeStyle = 'rgba(60, 230, 140, .5)';
      g.lineWidth = 3;
      g.shadowColor = 'rgba(60, 230, 140, .6)';
      g.shadowBlur = 18;
      g.stroke();
      g.lineTo(w, h);
      g.lineTo(0, h);
      g.closePath();
      const fill = g.createLinearGradient(0, h * 0.25, 0, h);
      fill.addColorStop(0, 'rgba(60, 230, 140, .14)');
      fill.addColorStop(1, 'rgba(60, 230, 140, 0)');
      g.fillStyle = fill;
      g.shadowBlur = 0;
      g.fill();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    void canvas.offsetWidth;
    canvas.classList.add('in');
    const me = {
      async close() { canvas.classList.remove('in'); await wait(800); cancelAnimationFrame(frame); canvas.remove(); },
    };
    ctx.onEnd(() => me.close());
    return me;
  }

  // Fireworks over the chart.
  function fireworks(ctx, stage) {
    const canvas = stage.root.querySelector('.cine-fx');
    const g = canvas.getContext('2d');
    const dpr = devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sparks = [];
    let frame = 0, running = true;
    const COLORS = ['#ffd84d', '#36d77a', '#ffffff', '#7ee8ff', '#ff9db0'];
    const burst = (x, y) => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let i = 0; i < 46; i++) {
        const angle = (i / 46) * Math.PI * 2 + Math.random() * 0.2, speed = 2.2 + Math.random() * 2.8;
        sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
      }
    };
    let next = 0;
    const draw = (now) => {
      if (running && now > next) {
        next = now + 380 + Math.random() * 420;
        burst(innerWidth * (0.35 + Math.random() * 0.55), innerHeight * (0.15 + Math.random() * 0.35));
      }
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.97;
        s.vy = s.vy * 0.97 + 0.06;
        s.life -= 0.014;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        g.globalAlpha = Math.min(1, s.life * 1.6);
        g.fillStyle = s.color;
        g.beginPath();
        g.arc(s.x, s.y, 2.2 * s.life + 0.6, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      if (running || sparks.length) frame = requestAnimationFrame(draw);
      else g.clearRect(0, 0, innerWidth, innerHeight);
    };
    frame = requestAnimationFrame(draw);
    const stop = () => { running = false; };
    ctx.onEnd(() => { running = false; cancelAnimationFrame(frame); g.clearRect(0, 0, innerWidth, innerHeight); });
    return { stop };
  }

  // Two big choices; resolves with the one you click, or null if you don't. at: how far across the window they sit.
  function choose(ctx, stage, options, timeoutMs = 30000, at = '62%') {
    const el = stage.add('sc-choices', options.map((o, i) => `<button class="sc-choice${o.accent ? ' accent' : ''}" data-i="${i}" style="--d:${i * 0.12}s">
      <div class="sc-choice-title">${esc(o.title)}</div><div class="sc-choice-sub">${esc(o.sub)}</div><span class="sc-choice-btn">${esc(o.button)}</span></button>`).join(''));
    el.style.left = at;
    pop(el);
    return ctx.run(new Promise((res) => {
      const timer = setTimeout(() => res(null), timeoutMs);
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]');
        if (!b) return;
        clearTimeout(timer);
        b.classList.add('picked');
        el.classList.add('chosen');
        Speech.tune('tick');
        res(options[Number(b.dataset.i)].id);
      });
    })).finally(() => setTimeout(() => unpop(el, 500), 450));
  }

  // A little crown that sits on her head (her own coordinates: body x 10..190, y 54..182).
  const CROWN = `<g class="sc-crown">
    <path d="M114 50 L116 20 L130 36 L142 13 L154 36 L168 20 L170 50 Z" fill="#ffcf3d" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
    <rect x="112" y="44" width="60" height="12" rx="4" fill="#f2b51f" stroke="#0a0a0a" stroke-width="4.5"/>
    <circle cx="142" cy="50" r="3.6" fill="#ff5a6e" stroke="#0a0a0a" stroke-width="2"/>
    <circle cx="126" cy="50" r="2.6" fill="#7ee8ff" stroke="#0a0a0a" stroke-width="1.8"/>
    <circle cx="158" cy="50" r="2.6" fill="#7ee8ff" stroke="#0a0a0a" stroke-width="1.8"/>
    <circle cx="116" cy="19" r="3.4" fill="#ffcf3d" stroke="#0a0a0a" stroke-width="2.4"/>
    <circle cx="142" cy="12" r="3.6" fill="#ffcf3d" stroke="#0a0a0a" stroke-width="2.4"/>
    <circle cx="168" cy="19" r="3.4" fill="#ffcf3d" stroke="#0a0a0a" stroke-width="2.4"/>
  </g>`;

  // A notification that slides in at the bottom right.
  function notice(ctx, title, text, buttons) {
    const el = document.createElement('div');
    el.className = 'pg-notice';
    el.innerHTML = `${coinHtml('small')}<div><div class="pg-notice-title">${esc(title)}</div><div class="pg-notice-text">${esc(text)}</div>
      <div class="pg-notice-actions">${buttons.map((b, i) => `<button class="${i ? 'ghost' : ''}">${esc(b)}</button>`).join('')}</div></div>`;
    document.body.appendChild(el);
    pop(el);
    Speech.tune('tick');
    const close = () => unpop(el, 450);
    el.addEventListener('click', (e) => { if (e.target.closest('button')) close(); });
    ctx.onEnd(close);
    return { close };
  }

  // ---------------------------------------------------------------------------
  // Snappy's Investment Opportunity™
  // ---------------------------------------------------------------------------
  async function snappycoin(ctx) {
    const W = innerWidth, H = innerHeight;
    const stage = cine(ctx);
    const prog = program(ctx);
    Speech.tune('sting');
    await ctx.wait(450);
    const a = Events.actor(ctx, 132, { from: 'home' });
    a.bubbleSide('caption');
    const { snappy: S, program: P } = dialogue(a, prog);
    // her lines go under her, so she stands a little above the middle
    const spot = {
      center: () => [W / 2 - 66, H * 0.46 - 66],
      left: () => [Math.max(28, W * 0.2 - 66), H * 0.46 - 66],
    };
    ctx.onEnd(() => snappy.call('sound.hush').catch(() => {}));

    // Scene 1: the big announcement
    const bg = backdropChart(ctx, stage);
    await a.zoomTo(...spot.center(), 132);
    Mascot.face('shine');
    await S("{shine}Stop whatever you're doing. {pause}I have some very exciting news.");
    await ctx.wait(500);
    Mascot.flash('happy', 1150);
    await S('{happy}I\'m rich.', { hold: 1500 });
    await P("Scanning Snappy's financial records...", { hold: 300 });
    Mascot.face('shine');
    await scan(ctx, a);
    a.hush();
    await a.moveTo(...spot.left());
    const rep = report(stage, 'SNAPPY FINANCIAL REPORT', [
      ['Bank balance', '€0.00'], ['Cryptocurrency', '0.00000003 BTC'], ['Outstanding debt', '€84,291.67', true],
      ['Credit score', 'Error 404', true], ['Financial literacy', 'Not detected', true],
    ]);
    const repBox = () => rep.el.getBoundingClientRect();
    await ctx.wait(450);
    a.lookAt(repBox().left, repBox().top + 60);
    const faces = ['shine', 'open', 'shock', 'worried', 'flat'];
    for (let i = 0; i < 5; i++) {
      await ctx.wait(i ? 650 : 250);
      rep.show(i);
      Mascot.face(faces[i]);
      if (i === 2) Mascot.flash('error', 650);
    }
    await ctx.wait(900);
    await S("{worried}Okay, first of all, {pause}that's private.");
    await P('You requested a financial audit.');
    await S('{flat}I requested a financial compliment.', { hold: 1400 });
    await P('Your current net worth is approximately negative €84,291.67.');
    a.hush();
    Mascot.face('worried');
    a.lookAt(repBox().left, repBox().top + repBox().height * 0.55, true);
    await ctx.wait(1700);
    await S("{worried}That's a temporary liquidity issue.", { keepLook: true });
    await P('Your account has been overdrawn for 417 days.');
    await S('{open}A long-term {pause}temporary liquidity issue.', { hold: 1300 });
    a.hush();
    await rep.close();
    Mascot.face('shine');
    await a.zoomTo(...spot.center(), 140);
    Mascot.flash('happy', 1150);
    await S('{shine}BUT! {pause}{happy}I have an idea.', { hold: 900 });
    a.hush();

    // Scene 2: the revolutionary business plan
    const idea = bulb(a);
    idea.on();
    Mascot.face('shine');
    await ctx.wait(900);
    idea.flicker();
    await ctx.wait(800);
    idea.burn();
    Mascot.face('shock');
    await ctx.wait(1100);
    idea.gone();
    await ctx.wait(350);
    await S('{shine}What if we made a cryptocurrency?');
    await P('You have no experience in cryptocurrency development.');
    await S('{wink}Exactly. {pause}No bad habits.');
    await P('You have no capital.');
    await S('{happy}Less overhead.');
    await P('You have outstanding debt.');
    await S('{shine}Existing investors.');
    await P('Those are creditors.');
    await S('{smug}They invested in my character development.', { hold: 1300 });
    a.hush();
    await a.moveTo(...spot.left());
    const logo = coinLogo(stage);
    a.lookAt(W * 0.62, H * 0.45);
    Mascot.face('shine');
    await logo.reveal(ctx);
    await ctx.wait(700);
    await S("{shine}Introducing SnappyCoin! {pause}{happy}The world's first cryptocurrency {pause}backed by absolutely nothing.");
    await P('Most cryptocurrencies are not backed by physical assets.');
    await S("{wink}See? {pause}We're already industry standard.");
    await P('That is not what I said.', { hold: 1100 });
    await S('{shine}Early investors get exclusive benefits, {pause}including financial freedom, {pause}generational wealth, {pause}{smug}and a special role in my Discord server.');
    await P('You do not have a Discord server.');
    await S('{wink}We do now.', { hold: 300 });
    logo.server();
    await ctx.wait(1100);
    await S('{happy}All I need is a little starting capital.', { hold: 1200 });
    a.hush();

    // Scene 3: your investment opportunity
    logo.faster();
    await ctx.wait(600);
    await logo.close();
    const ch = chart(ctx, stage);
    ch.show();
    await ctx.wait(900);
    await S('{shine}So! {pause}Would you like to invest?', { hold: 500 });
    const choice = await choose(ctx, stage, [
      { id: 'invest', title: 'INVEST IN SNAPPYCOIN', sub: 'Become an early investor. Potential returns: ∞%', button: 'Invest', accent: true },
      { id: 'good', title: "NO THANKS, I'M GOOD", sub: 'Remain financially responsible.', button: "I'm good" },
    ]);
    a.hush();
    await ctx.wait(500);
    let fx = null;
    if (choice !== 'good') {
      if (!choice) await S("{flat}I'll take that as a yes.", { hold: 700 });
      Mascot.flash('happy', 1150);
      await S('{shine}YES! {pause}A visionary! {pause}A pioneer! {pause}{joy}Someone who understands the future!', { shout: false });
      await P('Investment received: €0.00.');
      await S('{wink}Every great empire starts somewhere.');
      a.hush();
      fx = fireworks(ctx, stage);
      Speech.tune('fanfare');
      a.lookAt(W * 0.62, H * 0.5);
      await ctx.run(ch.climbTo(9, 2600));
      ch.shout('+800%');
      Mascot.flash('happy', 1150);
      await S("{shine}LOOK AT THAT! {pause}WE'RE UP 800%!");
      ch.volume = 3.42;
      await P('Trading volume: €3.42.');
      await S("{happy}NUMBERS DON'T LIE.");
      await P('The only buyer was Snappy.');
      await S('{worried}NUMBERS CAN BE MISLEADING.', { hold: 1200 });
    } else {
      await S("{happy}Oh. {pause}That's okay. {pause}I respect your decision.", { hold: 1100 });
      a.hush();
      Mascot.face('flat');
      await ctx.wait(1300);
      await S('{flat}Unfortunately, {pause}I already invested your money.');
      await P("You do not have access to the user's money.");
      await S("{open}I invested my money. {pause}{wink}Which, technically, is your problem because we're friends.");
      await P('You have €0.00.');
      Mascot.flash('happy', 1150);
      await S("{shine}THEN WE'RE BOTH ALL IN.", { hold: 900 });
      a.hush();
      fx = fireworks(ctx, stage);
      Speech.tune('fanfare');
      a.lookAt(W * 0.62, H * 0.5);
      await ctx.run(ch.climbTo(9, 2600));
      ch.shout('+800%');
    }
    a.hush();

    // Scene 4: to the moon
    let anthem = true;
    const music = async () => { while (anthem && !ctx.cancelled) { Speech.tune('anthem', 0.9); await wait(5400); } };
    music();
    ctx.onEnd(() => { anthem = false; });
    a.lookAt(W * 0.62, H * 0.5);
    const climb = (async () => {
      for (const [to, ms, label] of [[10, 1300, '€10'], [100, 1900, '€100'], [1000, 2100, '€1,000'], [100000, 3600, '€100,000']]) {
        await ctx.run(ch.climbTo(to, ms));
        ch.shout(label);
      }
    })();
    climb.catch(() => {});
    await ctx.wait(400);
    await S('{shine}Look at it! {pause}Look at it! {pause}{happy}I told you!', { keepLook: true });
    await ctx.wait(600);
    Mascot.flash('happy', 1150);
    await S("{shine}I'M A GENIUS!", { keepLook: true });
    a.hush();
    await climb;
    fx?.stop();
    await P('SnappyCoin has reached a market capitalization of €8.4 billion.');
    Mascot.face('shock');
    await ctx.wait(500);
    await S('{shock}EIGHT. {pause}POINT. {pause}FOUR. {pause}BILLION.', { hold: 600 });
    a.hush();
    Mascot.face('dollar');
    a.dress(CROWN);
    Speech.tune('coin');
    Mascot.flash('happy', 1150);
    await ctx.wait(1300);
    ch.climbTo(120000, 9000);
    await S("{dollar}I'm buying a mansion. {pause}I'm buying a yacht. {pause}I'm buying a second yacht {pause}for the first yacht.", { hold: 1300 });
    await P('Warning: unusual trading activity detected.', { alert: true });
    await S('{dollar}Shhh. {pause}The market is speaking.', { keepLook: true, hold: 1300 });
    await P('The original developers have sold all their holdings.', { alert: true, hold: 500 });
    anthem = false;
    snappy.call('sound.hush').catch(() => {});
    ch.freeze();
    a.hush();
    await ctx.wait(1300);
    a.lookAt(W * 0.62, H * 0.5);
    await S('{flat}...What?', { keepLook: true, hold: 900 });
    await P('Liquidity has been withdrawn.', { alert: true, hold: 400 });
    ch.crash();
    a.root.classList.add('crashing');
    Speech.tune('whoosh');
    Mascot.face('shock');
    Mascot.flash('error', 650);
    a.root.querySelector('.sc-crown')?.classList.add('askew');
    await ctx.wait(1300);
    await P('SnappyCoin has lost 99.99% of its value.', { alert: true });
    ch.shout('Current value: €0.0000001', 'bad');
    await ctx.wait(900);
    await S('{shock}No.', { hold: 900 });
    ch.sink();
    await S('{worried}No, no, no, no, no.', { hold: 600 });
    Speech.tune('crash');
    await P('You have been rug-pulled.', { alert: true, hold: 2600 });
    a.hush();
    a.look([0, 0.05], true);
    Mascot.face('open');
    await ctx.wait(2000);
    await S('{sad}...Who would do this to me?', { keepLook: true, hold: 1100 });
    await P('You created the coin.', { alert: true });
    await S('{sad}I trusted myself.', { hold: 1100 });
    await P('That was your first mistake.', { hold: 1600 });
    a.hush();

    // Scene 5: the aftermath
    a.root.classList.remove('crashing');
    ch.close();
    await bg.close();
    const fin = report(stage, 'SNAPPYCOIN: FINAL REPORT', [
      ['All-time high', '€8,400,000,000'], ['Current market cap', '€12.43', true], ['Investors who profited', '1'], ['Investors who lost money', 'Everyone else', true],
    ]);
    for (let i = 0; i < 4; i++) { await ctx.wait(i ? 650 : 400); fin.show(i); }
    a.root.querySelector('.sc-crown')?.classList.add('fall');
    await ctx.wait(700);
    a.dress(null);
    await S('{flat}Well...', { hold: 600 });
    a.hush();
    Mascot.face(null);
    await ctx.wait(1600);
    await S('{happy}You win some, {pause}you lose some.');
    await P('You lost everything.');
    await S("{worried}That's a very negative way of looking at it.");
    await P('You are now €168,583.34 in debt.');
    await S("{open}Wait. {pause}Wasn't I only €84,000 in debt before?");
    await P('You borrowed money to buy more SnappyCoin.', { hold: 600 });
    a.hush();
    // she freezes
    a.root.classList.add('stiff');
    Mascot.face('shock');
    await ctx.wait(1700);
    a.root.classList.remove('stiff');
    await S('{flat}...Oh well.', { hold: 900 });
    a.hush();
    fin.close();
    // and slowly slides back toward her corner
    const slot = document.getElementById('mascot').getBoundingClientRect();
    a.root.classList.add('slow');
    await a.moveTo(lerp(a.x, slot.left, 0.45), lerp(a.y, slot.top, 0.4), { ms: 1300 });
    a.root.classList.remove('slow');
    await S("{happy}Anyway, {pause}who's hungry? {pause}I know a great restaurant.");
    await P('Your card has been declined.', { alert: true });
    Mascot.flash('happy', 1150);
    await S('{wink}I KNOW A GREAT RESTAURANT WITH A VERY GENEROUS OWNER.', { hold: 1400 });
    a.hush();
    stage.end();
    prog.leave();
    await a.home();
    await ctx.wait(700);

    // the final notification, and one last look out of her corner
    notice(ctx, 'SnappyCoin is no longer available.', 'Would you like to invest in SnappyCoin 2?', ['YES', 'ABSOLUTELY NOT']);
    await ctx.wait(1300);
    const home = document.getElementById('mascot');
    Mascot.fidget(home, 'peek');
    await ctx.wait(700);
    Speech.say('{wink}The sequel is going to be huge.', { kind: 'news', interrupt: true });
    await ctx.wait(4200);
  }

  const lerp = (a, b, t) => a + (b - a) * t;

  Events.define('snappycoin', {
    tier: 'rare', title: 'Trust Me Bro', hint: 'Snappy has a business idea. The Program has questions.', run: snappycoin, weight: 2,
  });
  Events.outfit('crown', { name: 'Crown', markup: CROWN, from: 'snappycoin' });

  window.Program = { cine, program, dialogue, report, choose, fireworks };
})();
