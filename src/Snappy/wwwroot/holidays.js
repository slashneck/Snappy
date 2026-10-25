// Special days. On the day itself the app dresses up a little (an orange glow for Halloween, snow at Christmas...),
// Snappy wears something for it, and the first time you open her that day she has a story for it, once a year.
// Nothing here happens with "Events and surprises" off.
//   Holidays.today()   the date she goes by
//   Holidays.due()     today's story, if there is one and it hasn't been told this year
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };
  const unpop = async (el, ms = 450) => { el.classList.remove('in'); el.classList.add('out'); await wait(ms); el.remove(); };
  const user = () => (state.userName ? state.userName[0].toUpperCase() + state.userName.slice(1) : 'you');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* the story might be told twice, that's all */ } },
  };

  // Development only: snappy.dev.today = 2026-10-31 pretends it's that day.
  function today() {
    const fake = state.dev && store.get('snappy.dev.today');
    const d = fake ? new Date(`${fake}T12:00:00`) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }
  const md = (m, d) => (t) => t.getMonth() === m - 1 && t.getDate() === d;

  // Her outfits for the days, drawn in her own coordinates (body x 10..190, y 54..182; hats sit on the right, clear of
  // her shutter button).
  const WITCH = `<path d="M90 57 Q146 42 202 57 Q146 68 90 57 Z" fill="#2b1f3a" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M118 54 Q128 22 144 0 Q152 -12 168 -10 Q158 -3 157 8 Q158 32 172 54 Z" fill="#2b1f3a" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M121 43 Q146 49 169 43 L172 53 Q146 59 118 53 Z" fill="#ff8a1f" stroke="#0a0a0a" stroke-width="3.5" stroke-linejoin="round"/>
    <rect x="139" y="44" width="11" height="10" rx="2" fill="#ffd23f" stroke="#0a0a0a" stroke-width="2.5"/>`;
  const SANTA = `<g class="hd-santa"><path d="M108 54 Q110 16 150 10 Q186 8 202 40 L190 44 Q178 28 168 54 Z" fill="#d6322b" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
    <rect x="100" y="44" width="82" height="17" rx="8.5" fill="#fff" stroke="#0a0a0a" stroke-width="4"/>
    <circle cx="200" cy="46" r="10" fill="#fff" stroke="#0a0a0a" stroke-width="4"/></g>`;
  const PARTY = `<g class="hd-party"><clipPath id="hd-cone"><path d="M118 56 L150 -6 L174 52 Z"/></clipPath>
    <path d="M118 56 L150 -6 L174 52 Z" fill="#ffd23f"/>
    <g clip-path="url(#hd-cone)" fill="#fff"><circle cx="138" cy="40" r="4"/><circle cx="158" cy="30" r="4"/><circle cx="148" cy="14" r="3.5"/><circle cx="162" cy="46" r="3.5"/></g>
    <path d="M118 56 L150 -6 L174 52 Z" fill="none" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
    <g stroke="#0a0a0a" stroke-width="3" stroke-linecap="round"><path d="M150 -8 L143 -20 M150 -8 L150 -22 M150 -8 L158 -19"/></g>
    <g stroke-width="2" stroke-linecap="round"><path d="M150 -8 L143 -20" stroke="#ff5a6e"/><path d="M150 -8 L150 -22" stroke="#7ee8ff"/><path d="M150 -8 L158 -19" stroke="#9be38c"/></g></g>`;
  const BOW = `<g class="hd-bow"><path d="M150 50 C136 32 116 36 120 51 C124 64 140 60 150 50 Z" fill="#ff6b9a" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M150 50 C164 32 184 36 180 51 C176 64 160 60 150 50 Z" fill="#ff6b9a" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M150 60 C140 53 141 43 150 46 C159 43 160 53 150 60 Z" fill="#e0245e" stroke="#0a0a0a" stroke-width="3.5" stroke-linejoin="round"/></g>`;
  const JESTER = `<g class="hd-jester"><path d="M112 50 Q100 14 80 8 Q108 0 146 46 Z" fill="#8a4dff" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M176 50 Q190 14 210 10 Q182 0 144 46 Z" fill="#ffd23f" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
    <rect x="104" y="44" width="82" height="14" rx="7" fill="#d6322b" stroke="#0a0a0a" stroke-width="4"/>
    <circle cx="80" cy="8" r="7" fill="#ffd23f" stroke="#0a0a0a" stroke-width="3.5"/><circle cx="210" cy="10" r="7" fill="#8a4dff" stroke="#0a0a0a" stroke-width="3.5"/></g>`;

  // The days. season: the year a day's story belongs to (New Year's Day still counts as the year that just ended).
  const DAYS = [
    { id: 'halloween', on: md(10, 31), outfit: 'witch' },
    { id: 'christmas', on: (t) => t.getMonth() === 11 && t.getDate() >= 24 && t.getDate() <= 26, outfit: 'santa' },
    { id: 'newyear', on: (t) => md(12, 31)(t) || md(1, 1)(t), outfit: 'party', season: (t) => (t.getMonth() === 0 ? t.getFullYear() - 1 : t.getFullYear()) },
    { id: 'valentine', on: md(2, 14), outfit: 'bow' },
    { id: 'aprilfools', on: md(4, 1), outfit: 'jester' },
  ];
  const day = () => (Events.enabled ? DAYS.find((d) => d.on(today())) || null : null);
  const season = (d) => String(d.season ? d.season(today()) : today().getFullYear());

  const told = (d) => store.get(`snappy.holiday.${d.id}`) === season(d);
  function due() {
    const d = day();
    if (!d || !Speech.enabled || told(d)) return null;
    // still due by the time it's its turn (it may have been played some other way in the meantime)
    return () => (told(d) ? false : Events.play(d.id));
  }

  // ---------------------------------------------------------------------------
  // The app on the day: a glow around the window, and for some days a bit of weather. Nothing falls while a clip
  // plays or with her animations off.
  // ---------------------------------------------------------------------------
  let fx = null;
  function theme() {
    const d = day();
    const id = d?.id || '';
    if (document.documentElement.dataset.day !== id) {
      if (id) document.documentElement.dataset.day = id;
      else delete document.documentElement.dataset.day;
    }
    const kind = id === 'christmas' ? 'snow' : id === 'valentine' ? 'hearts' : null;
    if (kind !== fx?.kind) { fx?.stop(); fx = kind ? weather(kind) : null; }
  }
  setInterval(theme, 30000);

  function weather(kind) {
    const canvas = document.createElement('canvas');
    canvas.className = `day-fx ${kind}`;
    document.body.appendChild(canvas);
    const g = canvas.getContext('2d');
    let w = 0, h = 0, frame = 0, odd = false;
    const size = () => {
      const dpr = devicePixelRatio || 1;
      w = innerWidth; h = innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    addEventListener('resize', size);
    const count = kind === 'snow' ? Math.round(Math.min(90, w * h / 16000)) : 14;
    const bits = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: kind === 'snow' ? 1 + Math.random() * 2.4 : 5 + Math.random() * 5,
      v: kind === 'snow' ? 0.35 + Math.random() * 0.6 : 0.25 + Math.random() * 0.35, p: Math.random() * 6.3, a: 0.35 + Math.random() * 0.5,
    }));
    const heart = (x, y, r) => {
      g.beginPath();
      g.moveTo(x, y + r * 0.9);
      g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.8, y - r * 1.5, x, y - r * 0.6);
      g.bezierCurveTo(x + r * 0.8, y - r * 1.5, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
      g.fill();
    };
    const quiet = () => document.hidden || state.settings?.mascotAnimations === false || (state.view === 'player' && !document.getElementById('video')?.paused);
    const draw = (now) => {
      frame = requestAnimationFrame(draw);
      // half the frame rate is plenty for weather
      odd = !odd;
      if (odd) return;
      const hide = quiet();
      canvas.classList.toggle('off', hide);
      if (hide) return;
      g.clearRect(0, 0, w, h);
      for (const b of bits) {
        if (kind === 'snow') {
          b.y += b.v;
          b.x += Math.sin(now / 1800 + b.p) * 0.35;
          if (b.y > h + 4) { b.y = -4; b.x = Math.random() * w; }
          g.globalAlpha = b.a;
          g.fillStyle = '#fff';
          g.beginPath();
          g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          g.fill();
        } else {
          b.y -= b.v;
          b.x += Math.sin(now / 1400 + b.p) * 0.3;
          if (b.y < -14) { b.y = h + 14; b.x = Math.random() * w; }
          g.globalAlpha = b.a * 0.5;
          g.fillStyle = '#ff6b9a';
          heart(b.x, b.y, b.r);
        }
      }
      g.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);
    return { kind, stop() { cancelAnimationFrame(frame); removeEventListener('resize', size); canvas.remove(); } };
  }

  // ---------------------------------------------------------------------------
  // The stories
  // ---------------------------------------------------------------------------
  function begin(ctx, { bars = false, size = 128, outfit = null } = {}) {
    const stage = Program.cine(ctx, { bars, light: !bars });
    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    if (outfit) a.dress(outfit);
    const S = async (text, opts = {}) => { if (!opts.keepLook) a.look([0, 0.12]); await a.say(text, opts); };
    const left = () => [Math.max(28, innerWidth * 0.2 - size / 2), innerHeight * 0.42 - size / 2];
    // out of her corner, growing to full size on the way
    const enter = () => a.zoomTo(...left(), size);
    return { stage, a, S, left, enter };
  }
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  // where the Program's lines go when it's standing somewhere on stage instead of in its panel
  const nearEl = (el) => { const r = el.getBoundingClientRect(); return { center: { x: r.left + r.width / 2 }, y: r.top, size: r.height }; };

  // A ghost: a sheet with two holes, the Program's eye glowing through one of them.
  const GHOST = `<svg viewBox="0 0 120 150" aria-hidden="true"><path d="M60 6 C26 6 12 34 12 66 V138 L28 126 L44 140 L60 126 L76 140 L92 126 L108 138 V66 C108 34 94 6 60 6 Z" fill="#f2f4f7" stroke="#0a0a0a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M24 70 Q22 104 30 128" fill="none" stroke="#d3d8de" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="44" cy="58" rx="9" ry="12" fill="#0a0a0a"/><ellipse cx="76" cy="58" rx="9" ry="12" fill="#0a1318"/>
    <circle class="hd-ghost-eye" cx="76" cy="58" r="5" fill="#a6ecff"/></svg>`;

  async function halloween(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, a, S, enter } = begin(ctx, { bars: true });
    stage.root.classList.add('hd-spooky');
    Speech.tune('spooky', 0.9);
    await enter();
    a.look([0.4, 0.1], true);
    await S("{worried}Psst. {pause}It's Halloween.");
    await S('{worried}Want to hear a scary story?', { hold: 900 });
    await S("{smug}Too late. {pause}I'm telling it.");

    // the newest clip, in a cold little spotlight
    const c = World.newest();
    const card = stage.add('hd-card', `<div class="hd-thumb">${World.thumb(c)}<div class="hd-eyes"><i></i><i></i></div></div>
      <div class="hd-title">${esc(c?.title || 'Your newest clip')}</div>`);
    Object.assign(card.style, { left: `${Math.round(W * 0.62)}px`, top: `${Math.round(H * 0.46)}px` });
    pop(card);
    Speech.tune('sting', 0.7);
    await ctx.wait(700);
    a.lookAt(...centerOf(card), true);
    await S('{worried}This is your newest clip.', { keepLook: true });
    await S('{worried}They say that on Halloween night... {pause}a clip can watch back.', { keepLook: true, hold: 1300 });
    a.hush();
    await ctx.wait(900);
    card.classList.add('eyes');
    Speech.tune('sting');
    await ctx.wait(1500);
    card.classList.add('blink');
    await ctx.wait(700);
    await S('{shock}...did it just BLINK?', { keepLook: true, hold: 900 });
    card.classList.remove('eyes', 'blink');
    await ctx.wait(800);
    a.look([-0.7, 0]);
    await ctx.wait(550);
    a.look([0.7, 0]);
    await ctx.wait(550);
    await S('{worried}O-okay. {pause}Compression artifact. {pause}Totally normal.', { hold: 900 });

    // something behind her
    const ghost = stage.add('hd-ghost', GHOST);
    const gs = Math.round(a.size * 1.15);
    Object.assign(ghost.style, { left: `${Math.round(a.x + a.size * 0.9)}px`, top: `${Math.round(a.y - a.size * 0.2)}px`, width: `${gs}px`, height: `${Math.round(gs * 1.25)}px` });
    pop(ghost);
    Speech.tune('boo');
    await ctx.wait(1200);
    // it's the Program under there (its panel waits until the sheet comes off)
    a.hush();
    const prog = Program.program(ctx);
    prog.el.classList.add('hd-later');
    await prog.say('Boo.', { near: nearEl(ghost), hold: 600 });
    prog.hush();
    Mascot.flash('clipping', 950);
    a.lookAt(...centerOf(ghost));
    await S('{shock}AAAAAH!', { shout: true, keepLook: true, hold: 300 });
    a.hush();
    const spot = [a.x, a.y];
    a.root.classList.add('crashing');
    await a.moveTo(Math.max(20, a.x - a.size * 0.6), a.y + 10, { ms: 500 });
    a.root.classList.remove('crashing');
    a.lookAt(...centerOf(ghost));
    await ctx.wait(500);
    // the sheet slides off
    ghost.classList.add('drop');
    Speech.tune('whoosh', 0.7);
    await ctx.wait(500);
    prog.el.classList.remove('hd-later');
    await a.moveTo(...spot, { ms: 600 });
    const talk = Program.dialogue(a, prog);
    await talk.program('I was told this is a tradition.');
    await talk.snappy('{angry}PROGRAM! {pause}My flash went off!', { hold: 900 });
    await talk.program('Scaring you was not the goal. {pause}It was a bonus.');
    await talk.snappy('{smug}Okay. {pause}That was a good one.');
    await talk.snappy('{shine}My turn! {pause}Costume time!', { hold: 300 });
    a.hush();
    a.twirl();
    Speech.tune('whoosh');
    await ctx.wait(450);
    a.dress(WITCH);
    Speech.tune('coin');
    // bats, out of nowhere
    const bats = stage.add('hd-bats', Array.from({ length: 6 }, (_, i) => `<i style="--i:${i}"></i>`).join(''));
    Object.assign(bats.style, { left: `${Math.round(a.center.x)}px`, top: `${Math.round(a.center.y)}px` });
    pop(bats);
    await ctx.wait(1100);
    await talk.snappy('{joy}Happy Halloween!', { hold: 1000 });
    await talk.program('Happy Halloween. {pause}Your clips are safe. {pause}Nothing in them is watching you.');
    await talk.snappy("{wink}...except me. {pause}I'm a camera.", { hold: 1300 });
    prog.hush();
    prog.leave();
    unpop(card);
    await ctx.wait(400);
    stage.end();
    await a.home({ handOff: () => Events.wearNow('witch') });
  }

  // The present has the best clip of the year in it: one you starred, or else the newest from a game.
  function clipOfYear() {
    const year = today().getFullYear();
    const clips = (state.library?.clips || []).filter((c) => c.date.getFullYear() === year);
    const newest = (list) => [...list].sort((x, y) => y.date - x.date)[0] || null;
    const fav = newest(clips.filter((c) => c.favorite));
    return { clip: fav || World.gameClip() || newest(clips) || World.newest(), starred: !!fav, count: clips.length };
  }

  async function christmas(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, a, S, enter } = begin(ctx, { outfit: SANTA });
    stage.root.classList.add('hd-wintry');
    Speech.tune('bells', 0.9);
    await enter();
    await S('{joy}Merry Christmas!', { hold: 800 });
    await S('{shine}I got you something!');

    const best = clipOfYear();
    const gift = stage.add('hd-gift', `<div class="hd-gift-inside">${best.clip ? `<div class="hd-thumb">${World.thumb(best.clip)}</div>
        <div class="hd-gift-label">Clip of the year</div><div class="hd-title">${esc(best.clip.title)}</div>`
      : '<div class="hd-gift-me"><div class="mascot"></div></div><div class="hd-gift-label">A picture of me</div>'}</div>
      <div class="hd-box"><i class="hd-ribbon"></i></div><div class="hd-lid"><i class="hd-ribbon"></i><i class="hd-knot"></i></div><div class="hd-gift-hint">Click to open</div>`);
    Object.assign(gift.style, { left: `${Math.round(W * 0.62)}px`, top: `${Math.round(H * 0.5)}px` });
    if (!best.clip) { const photo = gift.querySelector('.hd-gift-me .mascot'); Mascot.own(photo); Mascot.mount(photo); }
    pop(gift);
    Speech.tune('whoosh', 0.7);
    await ctx.wait(800);
    a.lookAt(...centerOf(gift), true);
    await S('{shine}Go on! {pause}Open it!', { keepLook: true, hold: 300 });
    a.hush();
    gift.classList.add('ready');
    const clicked = new Promise((res) => gift.addEventListener('click', () => res(true), { once: true }));
    const you = await ctx.run(Promise.race([clicked, wait(7000).then(() => false)]));
    gift.classList.remove('ready');
    if (!you) {
      await S("{smug}Too slow. {pause}I'll do it.", { keepLook: true, hold: 300 });
      await a.moveTo(gift.getBoundingClientRect().left - a.size * 0.9, a.y, { ms: 600 });
      a.bounce();
      await ctx.wait(300);
    }
    gift.classList.add('open');
    Speech.tune('fanfare', 0.8);
    World.confetti(ctx, stage, 2200);
    await ctx.wait(1300);
    a.lookAt(...centerOf(gift), true);
    if (!best.clip) await S("{joy}It's me! {pause}{wink}So you're never alone.", { keepLook: true });
    else {
      await S(best.starred ? '{happy}You starred this one yourself. {pause}{shine}Good taste.' : '{happy}The best clip of your year. {pause}{shine}I picked it myself.', { keepLook: true });
      if (best.count > 1) await S(`{open}You saved ${best.count} clips this year. {pause}{love}This one's my favorite.`, { keepLook: true });
    }

    // the Program, in a sweater it didn't ask for
    const prog = Program.program(ctx);
    prog.el.classList.add('hd-sweater');
    const talk = Program.dialogue(a, prog);
    await talk.program('I was given a sweater.');
    await talk.snappy('{joy}It fits perfectly!');
    await talk.program('I do not have a body.');
    await talk.snappy('{wink}It fits perfectly.', { hold: 900 });
    await talk.program('I have also prepared a gift.');
    await talk.snappy('{shine}Really?!', { hold: 600 });
    await talk.program('Your clips were uploaded to... {pause}nowhere. {pause}They never leave this PC.');
    await talk.snappy("{sad}...that's not a gift.", { hold: 800 });
    await talk.program('It is privacy. {pause}It is the best gift.');
    await talk.snappy('{happy}...okay, it is a pretty good gift.');
    prog.hush();
    prog.leave();
    await talk.snappy('{joy}Merry Christmas!', { hold: 1100 });
    unpop(gift);
    await ctx.wait(300);
    stage.end();
    await a.home({ handOff: () => Events.wearNow('santa') });
  }

  // The year in numbers, from your own clips (computed here, never sent anywhere).
  function yearStats(year) {
    const clips = (state.library?.clips || []).filter((c) => c.date.getFullYear() === year);
    const seconds = clips.reduce((n, c) => n + (c.duration || 0), 0);
    const count = (key) => {
      const by = {};
      for (const c of clips) { const k = key(c); by[k] = (by[k] || 0) + 1; }
      return Object.entries(by).sort((x, y) => y[1] - x[1])[0] || null;
    };
    const game = count((c) => c.folder || 'Desktop');
    const month = count((c) => c.date.toLocaleDateString(undefined, { month: 'long' }));
    return { clips: clips.length, seconds, game, month, favorites: clips.filter((c) => c.favorite).length };
  }
  const hm = (s) => { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h} h ${m} min` : s < 60 ? `${Math.round(s)} s` : `${m} min`; };

  async function newYear(ctx) {
    const W = innerWidth, H = innerHeight, t = today();
    const eve = t.getMonth() === 11 && t.getDate() === 31, day1 = t.getMonth() === 0 && t.getDate() === 1;
    const year = day1 ? t.getFullYear() - 1 : t.getFullYear();
    const { stage, a, S, enter } = begin(ctx, { bars: true, outfit: PARTY });
    stage.root.classList.add('hd-night');
    await enter();
    if (eve) await S("{shine}It's the last day of the year! {pause}{happy}Let's look back.");
    else if (day1) await S(`{joy}Happy New Year! {pause}{happy}Let's look back at ${year}.`);
    else await S(`{shine}Let's look at ${year} so far!`);

    const st = yearStats(year);
    const rows = st.clips ? [
      ['Clips saved', String(st.clips)],
      ['Gameplay saved', hm(st.seconds)],
      ...(st.game ? [['Top game', `${st.game[0]} (${st.game[1]})`]] : []),
      ...(st.month && st.clips > 2 ? [['Busiest month', st.month[0]]] : []),
      ['Starred', String(st.favorites)],
    ] : [['Clips saved', '0'], ['Moments missed', 'probably a few', true]];
    const report = Program.report(stage, `${year} · Annual report`, rows);
    const prog = Program.program(ctx);
    const talk = Program.dialogue(a, prog);
    a.lookAt(innerWidth * 0.62, innerHeight * 0.54, true);
    for (let i = 0; i < rows.length; i++) { await ctx.wait(450); report.show(i); }
    await talk.program(`Annual report for ${year}. {pause}Compiled on this PC.`);
    if (st.clips) await talk.snappy(`{shine}${st.clips} ${st.clips === 1 ? 'clip' : 'clips'}! {pause}{happy}That's ${st.clips} ${st.clips === 1 ? 'moment' : 'moments'} I didn't let get away.`);
    else await talk.snappy("{worried}Zero clips?! {pause}{wink}We'll fix that this year. Together.");

    // resolutions
    await talk.snappy('{open}My resolution: {pause}fewer sneezes.', { hold: 500 });
    await talk.snappy('Ah... {pause}{sneeze}CHOO! {pause}{sad}...starting tomorrow.', { hold: 900 });
    await talk.program('My resolution: fewer events.');
    await talk.snappy('{angry}HEY!', { hold: 600 });
    await talk.program('That was a joke. {pause}I have learned jokes this year.');
    prog.hush();
    report.close();

    // the countdown (a day late is still on time)
    await talk.snappy(eve || !day1 ? '{shine}Countdown! {pause}Ready?' : "{worried}We missed the countdown! {pause}{shine}Let's do it anyway!", { hold: 300 });
    a.hush();
    const big = stage.add('hd-count');
    for (const n of ['3', '2', '1']) {
      big.textContent = n;
      big.classList.remove('in');
      void big.offsetWidth;
      big.classList.add('in');
      Speech.tune('tick');
      a.bounce();
      await ctx.wait(800);
    }
    big.textContent = String(year + 1);
    big.classList.add('year');
    Speech.tune('fanfare');
    const show = Program.fireworks(ctx, stage);
    await talk.snappy('{joy}HAPPY NEW YEAR!', { shout: true, hold: 1600 });
    await talk.program(`Happy ${year + 1}.`, { hold: 1200 });
    show.stop();
    prog.leave();
    big.classList.remove('in');
    await ctx.wait(500);
    stage.end();
    await a.home({ handOff: () => Events.wearNow('party') });
  }

  async function valentine(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, a, S, enter } = begin(ctx);
    stage.root.classList.add('hd-rosy');
    await enter();
    a.look([0.2, 0.3], true);
    await S('{worried}Um. {pause}Hi.', { keepLook: true, hold: 700 });
    await S('{worried}I made you something.', { keepLook: true });
    const card = stage.add('hd-valentine', `<div class="hd-v-front"><svg viewBox="0 0 40 36"><path d="M20 34 C-6 18 2 -2 20 9 C38 -2 46 18 20 34 Z" fill="#e0245e"/></svg><span>For ${esc(user())}</span></div>
      <div class="hd-v-inside"><div class="hd-v-line">You're my favorite player.</div><div class="hd-v-from">Love, Snappy</div></div>`);
    Object.assign(card.style, { left: `${Math.round(W * 0.62)}px`, top: `${Math.round(H * 0.46)}px` });
    pop(card);
    Speech.tune('chime', 0.8);
    await ctx.wait(1300);
    card.classList.add('open');
    Speech.tune('whoosh', 0.6);
    await ctx.wait(900);
    a.lookAt(...centerOf(card), true);
    await S("{love}You're my favorite player.", { keepLook: true, hold: 900 });
    await S('{wink}Out of all one of you.', { hold: 1000 });

    const prog = Program.program(ctx);
    const talk = Program.dialogue(a, prog);
    await talk.snappy('{shine}Program! {pause}Say something nice too!', { hold: 600 });
    await talk.program('...', { hold: 900 });
    await talk.program('You are... {pause}fine.');
    await talk.snappy('{angry}PROGRAM.', { hold: 700 });
    await talk.program('You are... {pause}above average.');
    await talk.snappy("{joy}That's Program for 'I love you'!", { hold: 900 });
    await talk.program('It is not.', { hold: 900 });
    prog.hush();
    prog.leave();
    await talk.snappy("{happy}Happy Valentine's Day!", { hold: 600 });
    a.hush();
    a.dress(BOW);
    Speech.tune('coin');
    await ctx.wait(1200);
    unpop(card);
    stage.end();
    await a.home({ handOff: () => Events.wearNow('bow') });
  }

  async function aprilFools(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, a, S, enter } = begin(ctx);
    await enter();
    await S('{shine}Big news! {pause}{happy}Snappy is going premium!');
    const card = stage.add('hd-premium', `<div class="hd-p-name">Snappy Premium</div><div class="hd-p-price"><b>49.99</b><span>per month</span></div>
      <ul><li>The save button</li><li>Clips longer than three seconds</li><li>Her eyes</li><li>Blinking (billed per blink)</li></ul>
      <div class="hd-p-btn">Subscribe</div>`);
    Object.assign(card.style, { left: `${Math.round(W * 0.62)}px`, top: `${Math.round(H * 0.47)}px` });
    pop(card);
    Speech.tune('fanfare', 0.7);
    await ctx.wait(900);
    a.lookAt(...centerOf(card), true);
    await S('{smug}Blinking is extra. {pause}Blinking was always extra.', { keepLook: true });
    const prog = Program.program(ctx);
    const talk = Program.dialogue(a, prog);
    await talk.program('Snappy.', { hold: 700 });
    await talk.snappy('{smug}Yes?', { hold: 600 });
    await talk.program('It is the first of April.', { hold: 900 });
    a.hush();
    a.twirl();
    Speech.tune('whoosh');
    await ctx.wait(450);
    a.dress(JESTER);
    Speech.tune('coin');
    await ctx.wait(500);
    await talk.snappy('{joy}April Fools!', { hold: 600 });
    card.querySelector('.hd-p-price').innerHTML = '<b>Free</b><span>forever, for everyone</span>';
    card.querySelector('.hd-p-btn').textContent = 'Already yours';
    card.classList.add('free');
    Speech.tune('chime');
    await talk.snappy('{happy}Snappy is free. Forever. {pause}{wink}No subscriptions, no ads, no catch.');
    await talk.program('I have corrected the pricing page.', { hold: 1100 });
    prog.hush();
    prog.leave();
    unpop(card);
    await ctx.wait(300);
    stage.end();
    await a.home({ handOff: () => Events.wearNow('jester') });
  }

  // ---------------------------------------------------------------------------
  // however a story gets played on its day, it counts as told for this year
  const D = (id, def) => Events.define(id, {
    tier: 'holiday', planned: true, ...def,
    run: (ctx) => { const d = DAYS.find((x) => x.id === id); if (d.on(today())) store.set(`snappy.holiday.${id}`, season(d)); return def.run(ctx); },
  });
  D('halloween', { title: 'The Clip That Watches Back', hint: 'Visit her on Halloween.', run: halloween });
  D('christmas', { title: 'Clip of the Year', hint: 'Visit her at Christmas.', run: christmas });
  D('newyear', { title: 'Annual Report', hint: "Visit her on New Year's Eve, or the day after.", run: newYear });
  D('valentine', { title: 'Favorite Player', hint: "Visit her on Valentine's Day.", run: valentine });
  D('aprilfools', { title: 'Snappy Premium', hint: 'Visit her on the first of April.', run: aprilFools });

  const isDay = (id) => () => day()?.id === id;
  Events.outfit('witch', { name: 'Witch hat', markup: WITCH, from: 'halloween', day: isDay('halloween') });
  Events.outfit('santa', { name: 'Santa hat', markup: SANTA, from: 'christmas', day: isDay('christmas') });
  Events.outfit('party', { name: 'Party hat', markup: PARTY, from: 'newyear', day: isDay('newyear') });
  Events.outfit('bow', { name: 'Heart bow', markup: BOW, from: 'valentine', day: isDay('valentine') });
  Events.outfit('jester', { name: 'Jester hat', markup: JESTER, from: 'aprilfools', day: isDay('aprilfools') });

  // the day can also begin while the app is open, just after midnight
  setInterval(() => {
    const story = !Speech.waiting && Events.calm() && due();
    if (story) story();
  }, 5 * 60e3);

  window.Holidays = { today, due, theme, get id() { return day()?.id || null; } };
})();
