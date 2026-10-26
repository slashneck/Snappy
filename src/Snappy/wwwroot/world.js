// Snappy's world: little adventures she gets up to on her own. No Program, no story arc, just her.
//   The performance review, Snappy Academy, the 100% loading screen, going viral, and the critic.
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };
  const unpop = async (el, ms = 450) => { el.classList.remove('in'); el.classList.add('out'); await wait(ms); el.remove(); };
  const lerp = (a, b, t) => a + (b - a) * t;

  const user = () => (state.userName ? state.userName[0].toUpperCase() + state.userName.slice(1) : 'You');
  const newest = () => [...(state.library?.clips || [])].sort((x, y) => y.date - x.date)[0] || null;
  // The newest clip from an actual game: not the desktop, a browser, a chat app, a launcher or a tool.
  const NOT_GAMES = /^(?:(?:google|microsoft|mozilla|windows|adobe)\s+)?(?:desktop|snappy|settings|discord|chrome|firefox|edge|opera(?: gx)?|brave|vivaldi|explorer|file explorer|steam|epic games(?: launcher)?|battle\.net|ubisoft connect|ea app|ea|origin|gog galaxy|xbox|obs|obs studio|streamlabs|spotify|youtube|twitch|netflix|vlc|vlc media player|media player|visual studio(?: code)?|code|notepad\+*|word|excel|powerpoint|outlook|teams|slack|zoom|whatsapp|telegram|signal|photoshop|premiere pro|after effects|davinci resolve|blender|paint|task manager|terminal|powershell|command prompt)$/i;
  const gameClip = () => [...(state.library?.clips || [])].filter((c) => !NOT_GAMES.test(c.folder || 'Desktop')).sort((x, y) => y.date - x.date)[0] || null;
  // a clip's picture, or a made-up bit of gameplay when there isn't one
  const thumb = (c) => (c?.thumbUrl ? `<img src="${esc(c.thumbUrl)}" alt="" draggable="false">`
    : '<div class="wd-fake-shot"><i></i></div>');

  // The clip itself, with its sound: it plays for a moment while she watches, and always stops when the event ends.
  function film(ctx, host, c, { from = 0.25, loop = false } = {}) {
    if (!c?.videoUrl) return { play() {}, stop() {} };
    const v = document.createElement('video');
    v.src = c.videoUrl;
    v.poster = c.thumbUrl || '';
    v.preload = 'auto';
    v.playsInline = true;
    v.loop = loop;
    v.volume = 0.85;
    host.querySelector('img')?.replaceWith(v);
    if (!v.isConnected) host.prepend(v);
    const stop = () => { v.pause(); };
    ctx.onEnd(() => { v.pause(); v.removeAttribute('src'); v.load(); });
    return {
      play() {
        const go = () => { v.currentTime = Math.max(0, (v.duration || 0) * from); v.play().catch(() => {}); };
        if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
      },
      stop,
    };
  }

  // Everything here starts the same way: a light stage, and Snappy stepping out of her corner.
  function begin(ctx, { bars = false, size = 132 } = {}) {
    const stage = Program.cine(ctx, { bars, light: !bars });
    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    const S = async (text, opts = {}) => { if (!opts.keepLook) a.look([0, 0.12]); await a.say(text, opts); };
    const spot = {
      center: () => [innerWidth / 2 - size / 2, innerHeight * 0.46 - size / 2],
      left: () => [Math.max(28, innerWidth * 0.2 - size / 2), innerHeight * 0.46 - size / 2],
    };
    return { stage, a, S, spot };
  }

  // Home, still wearing her outfit.
  async function homeIn(ctx, a, outfit) {
    const slot = document.getElementById('mascot');
    // (she keeps it on: if it's one of her outfits it stays until midnight, if not it comes off once she's home)
    await a.home({ handOff: () => outfit && Mascot.dress(slot, outfit, true) });
  }

  // Confetti, for a while.
  function confetti(ctx, stage, ms = 2600) {
    const canvas = stage.root.querySelector('.cine-fx');
    const g = canvas.getContext('2d');
    const dpr = devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const COLORS = ['#ffd84d', '#36d77a', '#ff7a93', '#7ee8ff', '#ffffff', '#b28cff'];
    const bits = Array.from({ length: 140 }, () => ({
      x: innerWidth * (0.2 + Math.random() * 0.6), y: -20 - Math.random() * innerHeight * 0.5, vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 3, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    const start = performance.now();
    let frame = 0;
    const draw = (now) => {
      g.clearRect(0, 0, innerWidth, innerHeight);
      const fade = Math.max(0, Math.min(1, (start + ms - now) / 600));
      for (const b of bits) {
        b.x += b.vx + Math.sin((now + b.r * 900) / 300) * 0.6;
        b.y += b.vy;
        b.r += b.vr;
        g.save();
        g.globalAlpha = fade;
        g.translate(b.x, b.y);
        g.rotate(b.r);
        g.fillStyle = b.c;
        g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)) + 1);
        g.restore();
      }
      if (fade > 0) frame = requestAnimationFrame(draw);
      else g.clearRect(0, 0, innerWidth, innerHeight);
    };
    frame = requestAnimationFrame(draw);
    ctx.onEnd(() => { cancelAnimationFrame(frame); g.clearRect(0, 0, innerWidth, innerHeight); });
  }

  // A sheet of paper with pages that flip.
  function paper(stage, cls, html) {
    const el = stage.add(`wd-paper ${cls}`, `<div class="wd-page">${html}</div>`);
    pop(el);
    return {
      el,
      async page(next) {
        const old = el.querySelector('.wd-page');
        old.classList.add('turn');
        Speech.tune('whoosh', 0.6);
        await wait(320);
        old.remove();
        el.insertAdjacentHTML('beforeend', `<div class="wd-page new">${next}</div>`);
      },
      show(sel) { const r = el.querySelector(sel); r?.classList.add('in'); Speech.tune('tick', 0.7); return r; },
      close: () => unpop(el, 500),
    };
  }

  // A rubber stamp.
  async function stamp(ctx, host, text, cls) {
    const s = document.createElement('div');
    s.className = `wd-stamp ${cls}`;
    s.textContent = text;
    host.appendChild(s);
    void s.offsetWidth;
    s.classList.add('in');
    Speech.tune('key', 1);
    await ctx.wait(450);
    return s;
  }

  // ---------------------------------------------------------------------------
  // Outfits (her own coordinates: body x 10..190, y 54..182)
  // ---------------------------------------------------------------------------
  const TIE = `<g class="wd-tie"><path d="M92 158 L108 158 L104 167 L96 167 Z" fill="#b3261e" stroke="#0a0a0a" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M96 167 L104 167 L111 192 L100 202 L89 192 Z" fill="#d6322b" stroke="#0a0a0a" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M93 180 L107 174 M91 190 L109 182" stroke="#8f1d17" stroke-width="2.5"/></g>`;
  const HEADSET = `<path d="M22 110 Q22 34 100 30 Q178 34 178 110" fill="none" stroke="#0a0a0a" stroke-width="12" stroke-linecap="round"/>
    <path d="M22 110 Q22 34 100 30 Q178 34 178 110" fill="none" stroke="#b28cff" stroke-width="5" stroke-linecap="round"/>
    <rect x="2" y="92" width="26" height="40" rx="10" fill="#2a2a2e" stroke="#0a0a0a" stroke-width="4"/>
    <rect x="172" y="92" width="26" height="40" rx="10" fill="#2a2a2e" stroke="#0a0a0a" stroke-width="4"/>
    <path d="M14 128 Q16 160 52 162" fill="none" stroke="#0a0a0a" stroke-width="5" stroke-linecap="round"/>
    <circle cx="56" cy="162" r="6" fill="#b28cff" stroke="#0a0a0a" stroke-width="3"/>`;
  const BERET = `<path d="M108 52 Q104 26 140 22 Q178 20 184 42 Q186 54 168 56 Z" fill="#8c2433" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M122 34 Q140 26 160 28" fill="none" stroke="#b8475a" stroke-width="4" stroke-linecap="round"/>
    <path d="M148 22 L152 12" stroke="#0a0a0a" stroke-width="4" stroke-linecap="round"/>
    <path d="M30 170 Q100 196 170 170 L168 186 Q100 208 32 186 Z" fill="#d6322b" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M150 182 L160 214 L146 212 Z" fill="#d6322b" stroke="#0a0a0a" stroke-width="3.5" stroke-linejoin="round"/>`;
  const SCREWDRIVER = `<g class="wd-driver"><path d="M196 150 L222 116" stroke="#0a0a0a" stroke-width="5" stroke-linecap="round"/>
    <path d="M196 150 L222 116" stroke="#c9d3dc" stroke-width="2" stroke-linecap="round"/>
    <path d="M186 166 L200 146" stroke="#0a0a0a" stroke-width="13" stroke-linecap="round"/>
    <path d="M186 166 L200 146" stroke="#ffd23f" stroke-width="7" stroke-linecap="round"/></g>`;

  // ---------------------------------------------------------------------------
  // The performance review: the user is her manager, and she has some numbers.
  // ---------------------------------------------------------------------------
  async function review(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, a, S, spot } = begin(ctx);
    a.dress(TIE);
    Mascot.face('shine');
    await a.zoomTo(...spot.left(), 132);
    const clips = state.library?.clips?.length || 0;
    const doc = paper(stage, 'review', `<div class="wd-head">ANNUAL PERFORMANCE REVIEW</div>
      <div class="wd-meta"><span>Employee: <b>Snappy</b></span><span>Manager: <b>${esc(user())}</b></span></div>
      <div class="wd-rule"></div><div class="wd-empty">Rating: <em>pending</em></div>`);
    a.lookAt(W * 0.62, H * 0.45);
    await ctx.wait(700);
    await S("{shine}Hey! {pause}Quick question. {pause}{happy}How would you rate my performance?", { hold: 500 });
    a.hush();
    doc.el.classList.add('dim');
    await Program.choose(ctx, stage, [
      { id: 'excellent', title: 'EXCELLENT', sub: 'She does it all.', button: 'Excellent', accent: true },
      { id: 'fine', title: 'ACCEPTABLE', sub: "She's fine.", button: 'Acceptable' },
      { id: 'needs', title: 'NEEDS IMPROVEMENT', sub: 'Room to grow.', button: 'Needs improvement' },
    ], 30000, '58%');
    doc.el.classList.remove('dim');
    // whatever you picked, she nods along
    a.bounce();
    await ctx.wait(300);
    await S('{happy}Great. {pause}{wink}I also picked excellent.', { hold: 1200 });
    await doc.page(`<div class="wd-head">MY ACHIEVEMENTS THIS YEAR</div><div class="wd-rule"></div>
      <div class="wd-row" data-r="1"><span>Clips successfully captured</span><b>${clips.toLocaleString('en-US')}</b></div>
      <div class="wd-row" data-r="2"><span>Clips successfully stored</span><b>${clips.toLocaleString('en-US')}</b></div>
      <div class="wd-row" data-r="3"><span>Clips accidentally deleted</span><b>0</b></div>
      <div class="wd-row" data-r="4"><span>Times I've helped you improve at your game</span><b><i class="wd-spinner"></i></b></div>`);
    await S("{shine}Let's review my achievements this year.", { hold: 400 });
    for (let i = 1; i <= 4; i++) { await ctx.wait(700); doc.show(`[data-r="${i}"]`); }
    a.lookAt(W * 0.7, H * 0.55, true);
    await ctx.wait(1400);
    await S("{open}That's strange. {pause}The number isn't loading.", { keepLook: true, hold: 600 });
    doc.el.querySelector('.wd-spinner').classList.add('fast');
    Mascot.face('worried');
    a.look([0.8, 0.2]);
    await ctx.wait(500);
    a.look([0, 0.1]);
    await ctx.wait(400);
    a.look([0.8, 0.2]);
    await ctx.wait(500);
    await S('{shine}Anyway! {pause}Let\'s move on.', { hold: 600 });
    await doc.page(`<div class="wd-head">AREAS FOR IMPROVEMENT</div><div class="wd-rule"></div>
      <ol class="wd-list"><li data-r="1">Stop eating the user's CPU.</li><li data-r="2">Stop pretending to understand video codecs.</li>
      <li data-r="3">Stop blaming everything on the user.</li></ol>`);
    await S("{open}I've identified three opportunities for personal growth.", { hold: 300 });
    for (let i = 1; i <= 3; i++) { await ctx.wait(900); doc.show(`[data-r="${i}"]`); }
    a.lookAt(W * 0.62, H * 0.55, true);
    Mascot.face('flat');
    await ctx.wait(1700);
    await S('{flat}Okay, that third one feels targeted.', { hold: 1300 });
    await S("{smug}Some people say I don't have a schedule. {pause}{wink}And yet I've never been late to it.", { hold: 1200 });
    await doc.page(`<div class="wd-head">SALARY REVIEW</div><div class="wd-rule"></div>
      <div class="wd-calc"><div class="wd-calc-screen"><small>Current salary</small><b class="wd-calc-now">€0</b></div>
        <div class="wd-calc-screen want"><small>Requested salary</small><b class="wd-calc-want">€0</b><em>per year</em></div>
        <div class="wd-calc-keys">${'789456123€0='.split('').map((k) => `<i>${k}</i>`).join('')}</div></div>`);
    await S('{shine}Now, based on my outstanding performance, {pause}I believe a small raise is appropriate.', { hold: 500 });
    // she taps it out on the calculator
    const wantEl = doc.el.querySelector('.wd-calc-want');
    const keys = [...doc.el.querySelectorAll('.wd-calc-keys i')];
    let v = 0;
    for (const add of [5, 50, 500, 5000, 50000, 500000]) {
      v = add;
      wantEl.textContent = `€${v.toLocaleString('en-US')}`;
      const k = keys[Math.floor(Math.random() * keys.length)];
      k.classList.remove('press'); void k.offsetWidth; k.classList.add('press');
      Speech.tune('key', 0.8);
      await ctx.wait(260);
    }
    wantEl.parentElement.classList.add('big');
    Speech.tune('coin');
    await ctx.wait(800);
    await S("{wink}I'm willing to negotiate.", { hold: 600 });
    a.hush();
    doc.el.classList.add('dim');
    const verdict = await Program.choose(ctx, stage, [
      { id: 'approve', title: 'APPROVE', sub: '€500,000 per year. Effective immediately.', button: 'Approve', accent: true },
      { id: 'deny', title: 'DENY', sub: 'Fiscally responsible.', button: 'Deny' },
    ], 30000, '58%') || 'deny';
    doc.el.classList.remove('dim');
    if (verdict === 'approve') {
      await stamp(ctx, doc.el, 'APPROVED', 'ok');
      Mascot.flash('happy', 1150);
      confetti(ctx, stage);
      await S('{shine}I KNEW YOU RECOGNIZED TALENT.', { hold: 900 });
      await doc.page(`<div class="wd-head">YACHT LEASE AGREEMENT</div><div class="wd-rule"></div>
        <div class="wd-row in"><span>Lessees</span><b>Snappy &amp; ${esc(user())}</b></div>
        <div class="wd-row in"><span>Yacht</span><b>The S.S. Snappy</b></div><div class="wd-row in"><span>Monthly</span><b class="bad">€38,000</b></div>`);
      await S("{happy}Great. {pause}{wink}I've also enrolled us in a company yacht lease.", { hold: 1400 });
    } else {
      const no = await stamp(ctx, doc.el, 'DENIED', 'no');
      Mascot.face('flat');
      await ctx.wait(700);
      await S('{smug}Interesting. {pause}Very interesting.', { hold: 900 });
      a.hush();
      // she hops over and quietly fixes it
      const r = doc.el.getBoundingClientRect();
      const back = [a.x, a.y];
      await a.moveTo(r.right - a.size * 0.7, r.bottom - a.size * 0.8, { ms: 650 });
      a.bounce();
      no.classList.add('scribble');
      Speech.tune('key', 0.9);
      await ctx.wait(450);
      Speech.tune('key', 0.9);
      await stamp(ctx, doc.el, 'APPROVED', 'ok fixed');
      await ctx.wait(400);
      await a.moveTo(...back);
      await S("{wink}Must've been a typo.", { hold: 1300 });
    }
    a.hush();
    doc.close();
    await ctx.wait(500);
    await S("{happy}Thanks for the feedback. {pause}{wink}I'll take absolutely none of it into consideration.", { hold: 1300 });
    a.hush();
    stage.end();
    await homeIn(ctx, a, TIE);
  }

  // ---------------------------------------------------------------------------
  // Snappy Academy: premium coaching from a coach who is hardstuck Bronze.
  // ---------------------------------------------------------------------------
  async function academy(ctx) {
    const W = innerWidth, H = innerHeight;
    const stage = Program.cine(ctx);
    Speech.tune('sting');
    const banner = stage.add('wd-esports', '<div><b>SNAPPY</b><span>ACADEMY</span></div>');
    pop(banner);
    await ctx.wait(1300);
    const a = Events.actor(ctx, 132, { from: 'home' });
    a.bubbleSide('caption');
    const S = async (text, opts = {}) => { if (!opts.keepLook) a.look([0, 0.12]); await a.say(text, opts); };
    a.dress(HEADSET);
    Mascot.face('shine');
    await a.zoomTo(Math.max(28, W * 0.2 - 66), H * 0.46 - 66, 132);
    unpop(banner, 500);
    const trophy = stage.add('wd-trophy', '<svg viewBox="0 0 64 80"><path d="M18 6 H46 V26 Q46 42 32 44 Q18 42 18 26 Z" fill="#ffcf3d" stroke="#0a0a0a" stroke-width="3"/><path d="M18 12 H8 Q8 28 20 30 M46 12 H56 Q56 28 44 30" fill="none" stroke="#0a0a0a" stroke-width="3"/><rect x="28" y="44" width="8" height="12" fill="#e9a417" stroke="#0a0a0a" stroke-width="3"/><rect x="16" y="56" width="32" height="10" rx="2" fill="#7a4f00" stroke="#0a0a0a" stroke-width="3"/></svg>');
    trophy.style.left = `${a.x + a.size * 0.55}px`;
    trophy.style.top = `${a.y - a.size * 0.35}px`;
    pop(trophy);
    Speech.tune('coin');
    await ctx.wait(600);
    await S('{shine}Welcome to Snappy Academy. {pause}{wink}I teach gamers how to stop being terrible.');
    await S("{happy}I've coached hundreds of players.", { hold: 300 });
    const foot = stage.add('wd-footnote', '*Hundreds of players refers to a fictional number.');
    pop(foot);
    await ctx.wait(2200);
    unpop(foot);
    await S("{shine}My coaching philosophy is simple. {pause}If you lose, it's your aim. {pause}{wink}If you win, it's my coaching.", { hold: 1300 });
    await S('{happy}Here are my personal ranked statistics.', { hold: 300 });
    const stats = stage.add('wd-stats', `<div class="wd-stats-head">SNAPPY · RANKED</div>
      <div class="wd-stat" data-r="1"><span>Highest rank</span><b>Bronze II</b></div><div class="wd-stat" data-r="2"><span>Win rate</span><b>23%</b></div>
      <div class="wd-stat" data-r="3"><span>Headshot accuracy</span><b>4.6%</b></div><div class="wd-stat" data-r="4"><span>Games blamed on teammates</span><b class="hot">100%</b></div>`);
    pop(stats);
    a.lookAt(W * 0.62, H * 0.5);
    for (let i = 1; i <= 4; i++) { await ctx.wait(650); stats.querySelector(`[data-r="${i}"]`).classList.add('in'); Speech.tune('tick', 0.7); }
    Mascot.face('flat');
    await ctx.wait(1500);
    await S('{shine}That last statistic is actually a sign of strong leadership.', { hold: 900 });
    await S('{open}Also, {pause}these statistics are from an old account.', { hold: 1100 });
    a.hush();
    await unpop(stats, 450);

    // she "analyzes" your newest gameplay
    const clip = gameClip();
    const board = stage.add('wd-analysis', `<div class="wd-shot">${thumb(clip)}<svg class="wd-marks" viewBox="0 0 100 56" preserveAspectRatio="none"></svg></div>
      <div class="wd-analysis-foot"><span>REPLAY ANALYSIS</span><em>${esc(clip?.title || 'Your gameplay')}</em></div>`);
    pop(board);
    const marks = board.querySelector('.wd-marks');
    const arrow = (x, y, ang, big = false) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `wd-arrow${big ? ' big' : ''}`);
      g.setAttribute('transform', `translate(${x} ${y}) rotate(${ang})`);
      g.innerHTML = '<path d="M0 0 L-9 -3 L-9 -1.2 L-18 -1.2 L-18 1.2 L-9 1.2 L-9 3 Z"/>';
      marks.appendChild(g);
      Speech.tune('key', 0.5);
    };
    await S("{shine}Let's analyze your gameplay.", { hold: 300 });
    a.lookAt(W * 0.62, H * 0.5, true);
    await ctx.wait(500);
    arrow(88, 10, 30, true);
    await S('{flat}See this? {pause}This is where you made your first mistake.', { keepLook: true, hold: 600 });
    arrow(14, 46, 200, true);
    await S('{flat}And this is where you made your second mistake.', { keepLook: true, hold: 400 });
    a.hush();
    for (let i = 0; i < 45; i++) {
      arrow(6 + Math.random() * 88, 5 + Math.random() * 46, Math.random() * 360);
      await ctx.wait(Math.max(25, 120 - i * 3));
    }
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ring.setAttribute('class', 'wd-ring');
    Object.entries({ cx: 50, cy: 28, rx: 16, ry: 12 }).forEach(([k, val]) => ring.setAttribute(k, val));
    marks.appendChild(ring);
    await ctx.wait(600);
    await S('{worried}Actually, {pause}the entire clip is a mistake.', { keepLook: true, hold: 1100 });
    await S("{open}Your real mistake? {pause}{shine}You didn't believe in yourself.", { hold: 1300 });
    a.hush();
    await unpop(board, 450);
    await S("{shine}But don't worry. {pause}I've developed a revolutionary training program.", { hold: 300 });
    a.hush();
    const plan = await Program.choose(ctx, stage, [
      { id: 'aim', title: 'IMPROVE AIM', sub: 'Precision. Focus. Clicking heads.', button: 'Train aim' },
      { id: 'move', title: 'IMPROVE MOVEMENT', sub: 'Strafing like a pro.', button: 'Train movement' },
      { id: 'blame', title: 'BLAME TEAMMATES', sub: 'The fastest way to the top.', button: 'Blame teammates', accent: true },
    ], 30000, '58%') || 'aim';
    if (plan === 'blame') {
      await S("{shine}A natural talent. {pause}{joy}You don't need my help.", { hold: 900 });
      const diploma = stage.add('wd-diploma', `<div class="wd-diploma-top">SNAPPY ACADEMY</div><div class="wd-diploma-title">Certified Professional<br>Excuse Generator</div>
        <div class="wd-diploma-name">awarded to <b>${esc(user())}</b></div><div class="wd-seal">★</div>`);
      pop(diploma);
      Speech.tune('fanfare');
      confetti(ctx, stage, 2000);
      await ctx.wait(1600);
      await S("{happy}Congratulations. {pause}{wink}You've graduated.", { hold: 1400 });
      unpop(diploma, 500);
    } else if (plan === 'aim') {
      // your turn: the crosshair is yours, right up until you click
      await S("{shine}Excellent. {pause}Your turn. {pause}Crosshair on the middle, then click.", { hold: 300 });
      a.hush();
      const range = stage.add('wd-range', '<div class="wd-target"><i></i><i></i><i></i></div>');
      pop(range);
      await ctx.wait(600);
      const r = range.getBoundingClientRect();
      const ch = stage.add('wd-crosshair mine');
      const at = { x: r.left + r.width * 0.2, y: r.top + r.height * 0.3 };
      const put = () => { ch.style.left = `${at.x}px`; ch.style.top = `${at.y}px`; };
      put();
      stage.root.classList.add('wd-aiming');
      const follow = (e) => { at.x = Math.max(r.left + 6, Math.min(r.right - 6, e.clientX)); at.y = Math.max(r.top + 6, Math.min(r.bottom - 6, e.clientY)); put(); };
      addEventListener('pointermove', follow);
      a.lookAt(r.left + r.width / 2, r.top + r.height / 2, true);
      let fired = null;
      const fire = (e) => { if (!e.target.closest('.event-skip')) fired?.(); };
      stage.root.addEventListener('pointerdown', fire);
      ctx.onEnd(() => { removeEventListener('pointermove', follow); stage.root.removeEventListener('pointerdown', fire); });
      // (nobody clicks for a while: it goes off by itself)
      await ctx.run(new Promise((res) => { fired = res; setTimeout(res, 14000); }));
      removeEventListener('pointermove', follow);
      stage.root.removeEventListener('pointerdown', fire);
      // bang, and the crosshair takes off on its own: loops around the room and lands in her trophy
      Speech.tune('glitch', 0.7);
      Speech.tune('whoosh', 0.7);
      const tr = trophy.getBoundingClientRect(), end = { x: tr.left + tr.width / 2, y: tr.top + tr.height * 0.32 }, from = { ...at };
      const start = performance.now(), ms = 1700;
      for (;;) {
        ctx.check();
        const k = Math.min(1, (performance.now() - start) / ms), e = k * k * (3 - 2 * k);
        at.x = from.x + (end.x - from.x) * e + Math.sin(k * Math.PI * 3) * 160 * (1 - k);
        at.y = from.y + (end.y - from.y) * e + Math.sin(k * Math.PI * 5) * 60 * (1 - k) - Math.sin(k * Math.PI) * 110;
        put();
        ch.style.rotate = `${e * 1080}deg`;
        if (k >= 1) break;
        await new Promise((res) => requestAnimationFrame(res));
      }
      stage.root.classList.remove('wd-aiming');
      ch.remove();
      const hole = document.createElement('div');
      hole.className = 'wd-hole';
      hole.style.left = `${end.x}px`;
      hole.style.top = `${end.y}px`;
      stage.props.appendChild(hole);
      pop(hole);
      trophy.classList.add('hit');
      Speech.tune('clunk', 0.9);
      a.lookAt(end.x, end.y, true);
      Mascot.face('shock');
      await ctx.wait(900);
      await S('{shock}MY TROPHY.', { keepLook: true, hold: 500 });
      await S('{flat}...That was a warning shot.', { hold: 900 });
      await S("{smug}See? {pause}That's your aim. {pause}{wink}My coaching was perfect.", { hold: 1000 });
      unpop(range, 450);
      unpop(hole, 450);
    } else {
      // movement: a strafe so fast she can't stop
      await S("{shine}Excellent. {pause}Movement. {pause}Watch closely.", { hold: 300 });
      a.hush();
      a.root.classList.add('wd-strafe');
      const x0 = a.x, y0 = a.y;
      for (const dx of [-70, 90, -90, 110, -110, 150]) {
        await a.moveTo(Math.max(12, x0 + dx), y0, { hop: false, ms: 210 });
        snappy.call('sound.blip', { pitch: 700 + Math.random() * 200, volume: Speech.volume * 0.6 }).catch(() => {});
      }
      a.root.classList.remove('wd-strafe');
      a.trip();
      Speech.tune('clunk', 0.8);
      Mascot.face('wince');
      await ctx.wait(1100);
      await S('{flat}That was a feint.', { hold: 900 });
      await S('{smug}The enemy never saw it coming. {pause}{wink}Neither did I.', { hold: 1000 });
      await a.moveTo(x0, y0, { hop: false });
    }
    a.hush();
    unpop(trophy, 400);
    await ctx.wait(400);
    const price = stage.add('wd-price', '<div>Next session</div><b>€49.99</b><small>Discount available for anyone ranked higher than Bronze II.</small><button class="wd-book" tabindex="-1">Book now</button>');
    pop(price);
    Speech.tune('coin');
    // the button doesn't want to be booked: it hops out of the way of the pointer, until it runs out of breath
    const book = price.querySelector('.wd-book');
    let hops = 0, booked = false, off = [0, 0];
    const dodge = (e) => {
      if (booked || hops >= 6) return;
      const r = book.getBoundingClientRect(), dx = r.left + r.width / 2 - e.clientX, dy = r.top + r.height / 2 - e.clientY;
      if (Math.hypot(dx, dy) > 64) return;
      hops++;
      const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.4;
      off = [Math.max(-150, Math.min(150, off[0] + Math.cos(ang) * 90)), Math.max(-60, Math.min(70, off[1] + Math.sin(ang) * 50))];
      book.style.translate = `${off[0]}px ${off[1]}px`;
      snappy.call('sound.blip', { pitch: 1400 + hops * 120, volume: Speech.volume * 0.6 }).catch(() => {});
      if (hops >= 6) book.classList.add('tired');
    };
    addEventListener('pointermove', dodge);
    ctx.onEnd(() => removeEventListener('pointermove', dodge));
    book.addEventListener('click', () => { booked = true; book.classList.add('booked'); book.textContent = 'Booked!'; Speech.tune('tick'); });
    await S('{shine}My next coaching session costs €49.99.', { hold: 1500 });
    for (let i = 0; i < 25 && !booked; i++) await ctx.wait(160);
    removeEventListener('pointermove', dodge);
    if (booked) {
      Mascot.face('shock');
      await S('{shock}You... {pause}actually clicked it.', { hold: 700 });
      await S("{worried}Okay. {pause}Don't worry. {pause}{wink}It's pretend. {pause}Nobody pays anything.", { hold: 900 });
    } else await S('{open}So... {pause}{wink}probably you.', { hold: 600 });
    a.hush();
    unpop(price, 300);
    stage.end();
    // and she's gone, immediately
    await a.home();
  }

  // ---------------------------------------------------------------------------
  // The 100% loading screen: an optimization that gets stuck at 99%.
  // ---------------------------------------------------------------------------
  async function loading(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, a, S, spot } = begin(ctx);
    Mascot.face('shine');
    await a.zoomTo(...spot.left(), 132);
    await S('{shine}Hold on! {pause}Let me optimize everything for maximum performance.', { hold: 400 });
    a.hush();
    const win = stage.add('wd-load', `<div class="wd-load-title">Optimizing Snappy</div>
      <div class="wd-bar one"><i></i><span>0%</span></div><div class="wd-load-sub">Making everything faster…</div><i class="wd-screw"></i>`);
    pop(win);
    const bar = (cls) => ({ fill: win.querySelector(`.wd-bar.${cls} i`), label: win.querySelector(`.wd-bar.${cls} span`) });
    const one = bar('one');
    const set = (b, p) => { b.fill.style.width = `${Math.min(p, 100)}%`; b.label.textContent = `${p}%`; };
    a.lookAt(W * 0.62, H * 0.48);
    for (let p = 0; p <= 99; p += Math.ceil(Math.random() * 9)) { set(one, Math.min(p, 99)); await ctx.wait(70 + Math.random() * 90); }
    set(one, 99);
    await ctx.wait(1400);
    win.querySelector('.wd-load-sub').textContent = 'Almost there…';
    await ctx.wait(1200);
    Mascot.face('flat');
    await S('{flat}...Any second now.', { keepLook: true, hold: 1300 });
    // she gives it a push
    const r = () => win.getBoundingClientRect();
    const back = [a.x, a.y];
    await a.moveTo(r().left - a.size * 0.55, r().top + r().height / 2 - a.size / 2, { ms: 600 });
    for (let i = 0; i < 3; i++) {
      a.bounce();
      win.classList.remove('shove'); void win.offsetWidth; win.classList.add('shove');
      Speech.tune('key', 1);
      await ctx.wait(420);
    }
    await S('{worried}Come ON.', { keepLook: true, hold: 800 });
    // the screwdriver
    a.dress(SCREWDRIVER);
    await S("{shine}Okay. {pause}Time for the tools.", { hold: 400 });
    a.hush();
    await a.moveTo(r().right - a.size * 0.35, r().top - a.size * 0.55, { ms: 650 });
    for (let i = 0; i < 3; i++) { a.bounce(); Speech.tune('key', 0.8); await ctx.wait(380); }
    const screw = win.querySelector('.wd-screw');
    screw.classList.add('off');
    Speech.tune('tick');
    win.classList.add('crooked');
    await ctx.wait(900);
    a.dress(null);
    await S("{flat}...That's not better.", { keepLook: true, hold: 1100 });
    await a.moveTo(...back);
    // what's even running
    const tasks = stage.add('wd-tasks', `<div class="wd-tasks-title">Task Manager <em>(definitely real)</em></div>
      <div class="wd-task head"><span>Name</span><span>CPU</span></div>
      <div class="wd-task"><span>Snappy (thinking)</span><span>12%</span></div><div class="wd-task"><span>Snappy (also thinking)</span><span>41%</span></div>
      <div class="wd-task"><span>optimizer.exe</span><span>99%</span></div><div class="wd-task"><span>the 99% itself</span><span>100%</span></div>
      <div class="wd-task hot"><span>Hamster wheel</span><span>100%</span></div>`);
    pop(tasks);
    Speech.tune('tick');
    a.lookAt(W * 0.75, H * 0.35, true);
    Mascot.face('shock');
    await ctx.wait(1700);
    await S("{worried}I don't know what any of this means.", { keepLook: true, hold: 1000 });
    unpop(tasks, 400);
    await ctx.wait(300);
    // so: more progress bars
    await S('{shine}I know! {pause}Another progress bar!', { hold: 300 });
    a.hush();
    win.insertAdjacentHTML('beforeend', '<div class="wd-bar two"><i></i><span>0%</span></div><div class="wd-load-sub two">Optimizing the optimizer…</div>');
    const two = bar('two');
    await ctx.wait(300);
    for (let p = 0; p <= 100; p += 7) { set(two, Math.min(p, 100)); Speech.tune('key', 0.3); await ctx.wait(60); }
    set(two, 100);
    await ctx.wait(500);
    set(one, 101);
    one.fill.parentElement.classList.add('over');
    Speech.tune('fanfare');
    await ctx.wait(700);
    // flash, and everything is back to normal
    stage.root.classList.add('flash');
    await ctx.wait(160);
    win.remove();
    await ctx.wait(500);
    stage.root.classList.remove('flash');
    const note = stage.add('wd-toast', '<b>Optimization complete</b><span>Performance improved by 0.00004%.</span>');
    pop(note);
    Speech.tune('tick');
    Mascot.flash('happy', 1150);
    await ctx.wait(800);
    await S("{shine}You're welcome.", { hold: 1500 });
    a.hush();
    unpop(note, 400);
    stage.end();
    await a.home();
  }

  // ---------------------------------------------------------------------------
  // Going viral: she "posts" your clip on SnapTok. She didn't. She never would.
  // ---------------------------------------------------------------------------
  async function viral(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, a, S, spot } = begin(ctx);
    const clip = gameClip() || newest();
    Mascot.face('worried');
    await a.zoomTo(...spot.left(), 132);
    await S("{worried}Okay, don't be mad... {pause}{wink}but I made you famous.", { hold: 900 });
    a.hush();
    const phone = stage.add('wd-phone', `<div class="wd-phone-top"><b>SnapTok</b><span class="wd-views"><i></i><em>0</em> views</span></div>
      <div class="wd-phone-video">${thumb(clip)}</div>
      <div class="wd-phone-side"><div class="wd-like"><i>♥</i><em>0</em></div><div><i class="wd-bubble-icon"></i><em class="wd-comments-n">0</em></div><div><i>↗</i><em>Share</em></div></div>
      <div class="wd-phone-caption"><b>@${esc((state.userName || 'you').toLowerCase())}</b> ${esc(clip?.title || 'this clip is insane')} #gaming #snappy</div>
      <div class="wd-phone-comments"></div><div class="wd-phone-fake"><b>Not posted.</b><span>Never was.</span></div>`);
    pop(phone);
    const vid = film(ctx, phone.querySelector('.wd-phone-video'), clip, { from: 0, loop: true });
    vid.play();
    Speech.tune('whoosh');
    a.lookAt(W * 0.62, H * 0.45);
    await ctx.wait(900);
    const viewsEl = phone.querySelector('.wd-views em'), likeEl = phone.querySelector('.wd-like em'), comN = phone.querySelector('.wd-comments-n');
    const comments = phone.querySelector('.wd-phone-comments');
    const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(Math.round(n)));
    const lines = ['how is this real', 'the little camera is so cute', 'who is snappy??', 'first', 'this is the clip of the year', 'ratio', 'HOW', 'teach me pls'];
    const heart = () => {
      const h = document.createElement('span');
      h.className = 'wd-heart';
      h.textContent = '♥';
      h.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 40)}px`);
      phone.querySelector('.wd-like').appendChild(h);
      setTimeout(() => h.remove(), 1400);
    };
    const start = performance.now(), ms = 7000;
    let said = 0, c = 0;
    const milestones = [[1e4, '{shine}TEN THOUSAND!'], [1e5, '{shine}A HUNDRED THOUSAND!'], [1e6, '{joy}ONE MILLION!']];
    for (;;) {
      const t = Math.min(1, (performance.now() - start) / ms);
      const views = 10 ** (1 + t * 5);
      viewsEl.textContent = fmt(views);
      likeEl.textContent = fmt(views * 0.12);
      comN.textContent = fmt(views * 0.004);
      heart();
      if (Math.random() < 0.28 && c < 40) {
        const d = document.createElement('div');
        d.className = 'wd-comment';
        d.textContent = lines[c++ % lines.length];
        comments.prepend(d);
        while (comments.children.length > 4) comments.lastChild.remove();
      }
      if (said < milestones.length && views >= milestones[said][0]) {
        a.say(milestones[said][1], { hold: 0 }).catch(() => {});
        Mascot.flash('happy', 1150);
        said++;
      }
      if (t >= 1) break;
      await ctx.wait(110);
    }
    confetti(ctx, stage);
    Speech.tune('fanfare');
    await ctx.wait(1500);
    await S("{joy}We're famous! {pause}{shine}Everyone loves us!", { hold: 1300 });
    a.hush();
    a.look([0, 0.1], true);
    Mascot.face('wink');
    await ctx.wait(1000);
    await S('{wink}...just kidding.', { keepLook: true, hold: 500 });
    vid.stop();
    phone.classList.add('flip');
    Speech.tune('glitch', 0.6);
    await ctx.wait(900);
    await S("{happy}I'd never upload anything. {pause}{happy}Everything we record stays right here, with us.", { hold: 1500 });
    a.hush();
    unpop(phone, 500);
    stage.end();
    await a.home();
  }

  // ---------------------------------------------------------------------------
  // The critic: tonight, she reviews a film. It's your latest clip.
  // ---------------------------------------------------------------------------
  async function critic(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, a, S, spot } = begin(ctx);
    const clip = gameClip() || newest();
    a.dress(BERET);
    Mascot.face('shine');
    await a.zoomTo(...spot.left(), 132);
    await S('{shine}Ladies and gentlemen. {pause}Tonight, {pause}I review a film.', { hold: 600 });
    a.hush();
    const poster = stage.add('wd-poster', `<div class="wd-poster-shot">${thumb(clip)}<div class="wd-projector"></div></div>
      <div class="wd-poster-title">${esc(clip?.title || 'Untitled')}</div><div class="wd-poster-sub">A ${esc(clip?.folder || 'Desktop')} Production · ${clip ? fmtDuration(clip.duration || 0) : '0:30'}</div>`);
    pop(poster);
    const vid = film(ctx, poster.querySelector('.wd-poster-shot'), clip, { from: 0.15 });
    Speech.tune('sting');
    a.lookAt(W * 0.62, H * 0.42, true);
    await ctx.wait(1300);
    // popcorn and a screening
    poster.classList.add('playing');
    vid.play();
    const corn = stage.add('wd-popcorn', '<div class="wd-bucket"></div>');
    corn.style.left = `${a.center.x + a.size * 0.38}px`;
    corn.style.top = `${a.y + a.size * 0.55}px`;
    pop(corn);
    const kernels = setInterval(() => {
      const k = document.createElement('i');
      k.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 30)}px`);
      corn.appendChild(k);
      setTimeout(() => k.remove(), 900);
      Speech.tune('key', 0.35);
    }, 380);
    ctx.onEnd(() => clearInterval(kernels));
    for (const [face, ms] of [['shine', 1600], ['shock', 1400], ['worried', 1500], ['love', 1700]]) { Mascot.face(face); await ctx.wait(ms); }
    clearInterval(kernels);
    poster.classList.remove('playing');
    vid.stop();
    unpop(corn, 300);
    await S('{love}...I laughed. {pause}I cried. {pause}I saved it twice.', { hold: 1100 });
    a.hush();
    await unpop(poster, 450);
    const card = stage.add('wd-reviewcard', `<div class="wd-rc-paper">THE SNAPPY TIMES</div><div class="wd-rc-kicker">FILM REVIEW</div>
      <div class="wd-rc-title">${esc(clip?.title || 'Untitled')}</div><div class="wd-stars">${'<i></i>'.repeat(5)}</div>
      <div class="wd-quotes"></div><div class="wd-rc-by">by Snappy, Senior Film Critic</div>`);
    pop(card);
    Speech.tune('tick');
    await ctx.wait(700);
    const stars = [...card.querySelectorAll('.wd-stars i')];
    for (let i = 0; i < 4; i++) { stars[i].classList.add('on'); Speech.tune('coin', 0.5); await ctx.wait(380); }
    await ctx.wait(600);
    stars[4].classList.add('half');
    Speech.tune('tick');
    a.lookAt(W * 0.62, H * 0.45, true);
    await S('{smug}Half a star off. {pause}The menu screen was a bit long.', { keepLook: true, hold: 900 });
    a.hush();
    const quotes = card.querySelector('.wd-quotes');
    for (const q of ['"A masterpiece of pressing buttons."', '"The lighting? Gamer RGB. Breathtaking."', '"I saved it twice."']) {
      quotes.insertAdjacentHTML('beforeend', `<div class="wd-quote">${esc(q)}</div>`);
      Speech.tune('key', 0.8);
      await ctx.wait(1300);
    }
    await S('{shine}Two thumbs up.', { hold: 900 });
    a.hush();
    a.look([0, 0.4], true);
    Mascot.face('flat');
    await ctx.wait(1200);
    await S("{flat}...I don't have thumbs.", { keepLook: true, hold: 700 });
    await S('{happy}Two hops up!', { hold: 200 });
    a.bounce();
    await ctx.wait(650);
    a.bounce();
    Mascot.flash('happy', 1150);
    await ctx.wait(1100);
    a.hush();
    unpop(card, 450);
    stage.end();
    await homeIn(ctx, a, BERET);
  }

  const D = (id, def) => Events.define(id, { tier: 'uncommon', weight: 3, ...def });
  const hasClips = () => (state.library?.clips?.length || 0) > 0;
  D('review', { title: 'Performance Review', hint: "It's that time of year. You're the manager.", run: review });
  D('academy', { title: 'Hardstuck Bronze', hint: 'Save a clip from a game. She is now offering premium coaching.', run: academy, when: () => !!gameClip() });
  D('loading', { title: '99%', hint: 'She wants to make everything faster.', run: loading });
  D('viral', { title: 'Going Viral', hint: 'Save a clip worth showing off.', run: viral, when: hasClips });
  D('critic', { title: 'Two Hops Up', hint: 'Your latest clip has a very serious critic.', run: critic, when: hasClips });

  Events.outfit('tie', { name: 'Tie', markup: TIE, from: ['review', 'job'] });
  Events.outfit('headset', { name: 'Coaching headset', markup: HEADSET, from: 'academy' });
  Events.outfit('beret', { name: 'Beret and scarf', markup: BERET, from: 'critic' });
  // what each of them leaves behind for the rest of the day, under her name
  Events.aftermath('review', { label: 'The rosette she gave herself', marks: [{ at: '.brand', cls: 'af-pic af-rosette' }] });
  Events.aftermath('academy', { label: 'Her rank emblem', marks: [{ at: '.brand', cls: 'af-pic af-bronze' }] });
  Events.aftermath('loading', { label: 'A loading ring at 99%', marks: [{ at: '.brand', cls: 'af-pic af-loading' }] });
  Events.aftermath('viral', { label: 'Her ring light', marks: [{ at: '.brand', cls: 'af-pic af-ring' }] });
  Events.aftermath('critic', { label: 'Four and a half stars', marks: [{ at: '.brand', cls: 'af-pic af-stars' }] });

  window.World = { thumb, newest, gameClip, confetti, paper };
})();
