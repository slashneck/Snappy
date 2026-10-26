// More of Snappy's world: a job, an emergency meeting, a magic show, and a few days where the app itself misbehaves.
// Whatever she does to the app is only for show: nothing is clicked, moved or deleted for real, and everything is
// put back exactly as it was when the event ends or is skipped.
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };
  const unpop = async (el, ms = 450) => { el.classList.remove('in'); el.classList.add('out'); await wait(ms); el.remove(); };
  const user = () => (state.userName ? state.userName[0].toUpperCase() + state.userName.slice(1) : 'You');
  const rect = (el) => el.getBoundingClientRect();

  function begin(ctx, { light = true, dim = true, size = 132 } = {}) {
    const stage = dim ? Program.cine(ctx, { bars: false, light }) : null;
    if (!dim) Events.stage(ctx, { dim: false });
    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    const S = async (text, opts = {}) => { if (!opts.keepLook) a.look([0, 0.12]); await a.say(text, opts); };
    const spot = {
      center: () => [innerWidth / 2 - size / 2, innerHeight * 0.46 - size / 2],
      left: () => [Math.max(28, innerWidth * 0.2 - size / 2), innerHeight * 0.46 - size / 2],
    };
    return { stage, a, S, spot };
  }

  async function homeIn(ctx, a, outfit) {
    const slot = document.getElementById('mascot');
    // (she keeps it on: if it's one of her outfits it stays until midnight, if not it comes off once she's home)
    await a.home({ handOff: () => outfit && Mascot.dress(slot, outfit, true) });
  }

  // A prop that isn't part of a stage (when the app has to stay visible).
  function prop(ctx, cls, html = '') {
    const el = document.createElement('div');
    el.className = `wd2 ${cls}`;
    el.innerHTML = html;
    document.body.appendChild(el);
    ctx.onEnd(() => el.remove());
    return el;
  }

  // A note in the corner, like the app's own.
  function note(ctx, title, text, button) {
    const el = prop(ctx, 'wd-toast', `<b>${esc(title)}</b><span>${esc(text)}</span>${button ? `<button>${esc(button)}</button>` : ''}`);
    pop(el);
    Speech.tune('tick');
    return { el, close: () => unpop(el, 400) };
  }

  // A prop on the stage, popped in unless told otherwise.
  function card(stage, cls, html, autoPop = true) {
    const el = stage.add(cls, html);
    if (autoPop) pop(el);
    return el;
  }

  // A puff of smoke where something was.
  function puff(stage, r) {
    const el = stage.add('wd-puff', '<i></i><i></i><i></i><i></i><i></i>');
    el.style.left = `${r.left + r.width / 2}px`;
    el.style.top = `${r.top + r.height / 2}px`;
    pop(el);
    setTimeout(() => el.remove(), 1300);
  }

  // Stickers, everywhere.
  function stickers(ctx, stage) {
    const shapes = ['★', '♥', '✿', '☺', '✦', '♪'];
    const colors = ['#ffd84d', '#ff7a93', '#7ee8ff', '#36d77a', '#b28cff', '#ff9a40'];
    for (let i = 0; i < 34; i++) {
      const s = stage.add('wd-sticker', shapes[i % shapes.length]);
      s.style.left = `${5 + Math.random() * 90}%`;
      s.style.top = `${8 + Math.random() * 80}%`;
      s.style.color = colors[i % colors.length];
      s.style.setProperty('--r', `${Math.round((Math.random() - 0.5) * 50)}deg`);
      s.style.setProperty('--d', `${(i * 0.05).toFixed(2)}s`);
      pop(s);
    }
  }

  // A tiny Snappy, drawn rather than alive: for crews, meetings and magic tricks.
  // They breathe, blink and glance around on their own (see .wd-mini in events.css).
  const MINI = (extra = '') => `<svg viewBox="-16 -18 232 222"><ellipse class="mini-shadow" cx="100" cy="194" rx="62" ry="7"/>
    <g class="mini-body"><rect x="40" y="34" width="44" height="28" rx="9" fill="#f4f4f4" stroke="#0a0a0a" stroke-width="8"/>
    <rect x="10" y="54" width="180" height="128" rx="44" fill="#f4f4f4" stroke="#0a0a0a" stroke-width="8"/>
    <ellipse cx="50" cy="147" rx="11" ry="6.5" fill="#ff9db0" opacity=".75"/><ellipse cx="150" cy="147" rx="11" ry="6.5" fill="#ff9db0" opacity=".75"/>
    <g class="mini-eyes"><ellipse cx="72" cy="120" rx="14" ry="20" fill="#0a0a0a"/><ellipse cx="128" cy="120" rx="14" ry="20" fill="#0a0a0a"/>
    <ellipse cx="67.5" cy="112" rx="4" ry="5.5" fill="#fff"/><ellipse cx="123.5" cy="112" rx="4" ry="5.5" fill="#fff"/></g>${extra}</g></svg>`;
  const ACC = {
    tie: '<path d="M92 158 L108 158 L111 192 L100 202 L89 192 Z" fill="#d6322b" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>',
    shades: '<path d="M46 104 H154 V118 Q152 138 128 138 Q108 138 104 120 H96 Q92 138 72 138 Q48 138 46 118 Z" fill="#0a0a0a"/><path d="M60 110 L74 110" stroke="#5a5a5a" stroke-width="4" stroke-linecap="round"/>',
    visor: '<path d="M18 74 Q100 44 182 74 L172 90 Q100 66 28 90 Z" fill="#36d77a" fill-opacity=".85" stroke="#0a0a0a" stroke-width="5" stroke-linejoin="round"/>',
    clipboard: '<rect x="164" y="118" width="44" height="58" rx="6" fill="#c99a5b" stroke="#0a0a0a" stroke-width="5"/><rect x="172" y="130" width="28" height="38" fill="#fff"/><path d="M176 140 H196 M176 150 H196 M176 160 H190" stroke="#888" stroke-width="3"/>',
    cookie: '<circle cx="186" cy="150" r="24" fill="#c98a45" stroke="#0a0a0a" stroke-width="5"/><g fill="#4a2a12"><circle cx="178" cy="142" r="4"/><circle cx="192" cy="156" r="4.5"/><circle cx="190" cy="138" r="3"/><circle cx="178" cy="160" r="3.5"/></g><path d="M206 136 A24 24 0 0 1 208 158 Z" fill="#1b1b1b"/>',
    hardhat: '<path d="M34 60 Q36 6 100 4 Q164 6 166 60 Z" fill="#ffd23f" stroke="#0a0a0a" stroke-width="6" stroke-linejoin="round"/><rect x="18" y="54" width="164" height="14" rx="7" fill="#ffd23f" stroke="#0a0a0a" stroke-width="6"/><path d="M100 8 V54" stroke="#e0b400" stroke-width="8"/>',
    wand: '<path d="M176 160 L222 110" stroke="#0a0a0a" stroke-width="9" stroke-linecap="round"/><path d="M214 118 L222 110" stroke="#fff" stroke-width="9" stroke-linecap="round"/>',
  };
  // her own outfits for these (her own coordinates: body x 10..190, y 54..182)
  const TIE = `<g class="wd-tie"><path d="M92 158 L108 158 L104 167 L96 167 Z" fill="#b3261e" stroke="#0a0a0a" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M96 167 L104 167 L111 192 L100 202 L89 192 Z" fill="#d6322b" stroke="#0a0a0a" stroke-width="3.5" stroke-linejoin="round"/></g>`;
  const BOX = `<path d="M-4 150 H204 V204 H-4 Z" fill="#c99a5b" stroke="#0a0a0a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M-4 150 L14 136 H190 L204 150" fill="#b5864c" stroke="#0a0a0a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M70 176 H130" stroke="#7a5128" stroke-width="5" stroke-linecap="round"/><text x="100" y="196" text-anchor="middle" font-family="Georgia" font-size="16" fill="#5a3a18">DESK</text>`;
  const HARDHAT = `<path d="M108 54 Q110 22 146 20 Q182 22 184 54 Z" fill="#ffd23f" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
    <rect x="100" y="50" width="92" height="10" rx="5" fill="#ffd23f" stroke="#0a0a0a" stroke-width="4"/><path d="M146 22 V50" stroke="#e0b400" stroke-width="5"/>`;
  const TOPHAT = `<g class="mg-hat"><rect x="118" y="-6" width="62" height="58" rx="5" fill="#26262c" stroke="#0a0a0a" stroke-width="5"/>
    <path d="M127 2 V30" stroke="#4a4a54" stroke-width="5" stroke-linecap="round"/>
    <rect x="118" y="32" width="62" height="11" fill="#d6322b" stroke="#0a0a0a" stroke-width="3"/>
    <path d="M104 54 H194" stroke="#0a0a0a" stroke-width="12" stroke-linecap="round"/><path d="M107 53 H191" stroke="#3c3c46" stroke-width="5" stroke-linecap="round"/></g>
    <g class="mg-wand"><path d="M178 166 L226 112" stroke="#0a0a0a" stroke-width="11" stroke-linecap="round"/><path d="M181 163 L215 124" stroke="#2c2c33" stroke-width="5" stroke-linecap="round"/>
    <path d="M216 123 L225 113" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
    <path class="mg-star" d="M230 90 L233.5 102.5 L246 106 L233.5 109.5 L230 122 L226.5 109.5 L214 106 L226.5 102.5 Z" fill="#ffe27a" stroke="#0a0a0a" stroke-width="2.5" stroke-linejoin="round"/></g>`;
  // a roll of packing tape, held at her side
  const TAPEROLL = `<g class="wd-roll"><circle cx="208" cy="148" r="18" fill="#e6c98a" stroke="#0a0a0a" stroke-width="5"/><circle cx="208" cy="148" r="8" fill="#f4f4f4" stroke="#0a0a0a" stroke-width="3"/></g>`;

  // ---------------------------------------------------------------------------
  // Snappy gets a job. CEO, even. For about ten seconds.
  // ---------------------------------------------------------------------------
  async function job(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, a, S, spot } = begin(ctx);
    Mascot.face('flat');
    await a.zoomTo(...spot.left(), 132);
    await S("{flat}I've made a decision. {pause}I'm tired of working for free.", { hold: 900 });
    await S('{shine}So I applied for a job!', { hold: 500 });
    a.hush();
    const cv = World.paper(stage, 'cv', `<div class="wd-head">RÉSUMÉ</div><div class="wd-meta"><span><b>Snappy</b></span><span>Camera, mostly</span></div><div class="wd-rule"></div>
      <div class="wd-sub">EXPERIENCE</div><ul class="wd-list cv">
      <li data-r="1">Professional button pressing</li><li data-r="2">Senior Clip Storage Specialist</li>
      <li data-r="3">Ranked gameplay coach (Bronze II)</li><li data-r="4">Three minutes of MS Paint experience</li></ul>`);
    a.lookAt(W * 0.62, H * 0.45);
    for (let i = 1; i <= 4; i++) { await ctx.wait(800); cv.show(`[data-r="${i}"]`); }
    await ctx.wait(500);
    await S('{happy}Pretty impressive, right?', { keepLook: true, hold: 900 });
    await S("{shine}Help me practice for the interview. {pause}You ask, I answer.", { hold: 400 });
    a.hush();
    const answers = {
      future: ['WHERE DO YOU SEE YOURSELF IN FIVE YEARS?', '{wink}In your chair.'],
      weak: ["WHAT'S YOUR GREATEST WEAKNESS?", '{worried}Stairs. {pause}And deadlines. {pause}{flat}Mostly stairs.'],
      why: ['WHY SHOULD WE HIRE YOU?', '{shine}I never miss a moment. {pause}{worried}Except meetings. {pause}And deadlines. {pause}{wink}But never a moment.'],
      ask: ['ANY QUESTIONS FOR US?', '{shine}Yes. {pause}How many snacks a day is too many? {pause}{flat}Asking for a friend.'],
    };
    const left = Object.keys(answers);
    for (let round = 0; round < 2; round++) {
      cv.el.classList.add('dim');
      const offer = left.slice(0, 3);
      const q = await Program.choose(ctx, stage, offer.map((id) => ({ id, title: answers[id][0], sub: '', button: 'Ask' })), 30000, '58%') || offer[0];
      left.splice(left.indexOf(q), 1);
      cv.el.classList.remove('dim');
      await ctx.wait(300);
      await S(answers[q][1], { hold: 1400 });
    }
    a.hush();
    await cv.close();
    const hired = card(stage, 'wd-hired', '<small>Congratulations, Snappy!</small><b>You have been hired as CEO.</b>');
    Speech.tune('fanfare');
    World.confetti(ctx, stage);
    Mascot.face('shock');
    await ctx.wait(1300);
    await S('{shock}CEO?!', { hold: 600 });
    Mascot.flash('happy', 1150);
    await S('{shine}I KNEW IT.', { hold: 600 });
    unpop(hired, 400);
    a.dress(TIE);
    // the app gets a new name
    // (only the words: anything else in there, like a piece of tape, stays)
    const words = [...(document.querySelector('.brand-name')?.childNodes || [])].find((n) => n.nodeType === Node.TEXT_NODE);
    const oldName = words?.nodeValue;
    ctx.onEnd(() => { if (words && !Events.lasting('job')) words.nodeValue = oldName; });
    const sign = card(stage, 'wd-corp', '<b>SNAPPY INDUSTRIES™</b><small>a very serious company</small>');
    if (words) words.nodeValue = 'Snappy Industries';
    Speech.tune('sting');
    await S('{shine}First order of business: {pause}this app is now called Snappy Industries.', { hold: 1000 });
    unpop(sign, 400);
    // her first hire: you
    await S("{shine}Next, my leadership team. {pause}{joy}You're hired!", { hold: 300 });
    const letter = World.paper(stage, 'letter', `<div class="wd-head">APPOINTMENT LETTER</div><div class="wd-rule"></div>
      <div class="wd-row in"><span>Position</span><b>Vice President of Vibes</b></div><div class="wd-row in"><span>Duties</span><b>Morale. Compliments.</b></div>
      <div class="wd-row in"><span>Salary</span><b class="bad">€0.00</b></div><div class="wd-row in"><span>Probation</span><b>Until I change my mind</b></div>`);
    Speech.tune('tick');
    await ctx.wait(1600);
    await S("{wink}The salary is €0. {pause}{smug}It's our compensation strategy.", { hold: 1000 });
    await letter.close();
    const rules = World.paper(stage, 'rules', `<div class="wd-head">COMPANY POLICIES</div><div class="wd-rule"></div><ol class="wd-list">
      <li data-r="1">Every day is pizza day.</li><li data-r="2">All clips must be at least 20% cuter.</li>
      <li data-r="3">Meetings are now held in the replay buffer.</li><li data-r="4">The CEO may not be poked.</li></ol>`);
    await S('{happy}And a few new policies.', { hold: 300 });
    for (let i = 1; i <= 4; i++) { await ctx.wait(1000); rules.show(`[data-r="${i}"]`); }
    await ctx.wait(800);
    await S("{smug}We're pre-revenue. {pause}And pre-selling. {pause}{wink}It's a whole strategy.", { hold: 900 });
    // her first big decision as CEO
    await S('{shine}And now, my first big purchase as CEO...', { hold: 500 });
    rules.close();
    await S('{joy}Stickers! {pause}A LOT of stickers!', { hold: 200 });
    a.hush();
    stickers(ctx, stage);
    Speech.tune('coin');
    Mascot.flash('happy', 1150);
    await ctx.wait(1900);
    await S('{happy}Hearts, stars, little flowers... {pause}{shine}I bought ALL of them.', { hold: 900 });
    a.hush();
    await ctx.wait(400);
    // the board finds out
    const fired = card(stage, 'wd-fired', '<small>Snappy Industries · The Board</small><b>Snappy has been fired.</b><span>Reason: spent the entire company budget on stickers.</span>');
    Speech.tune('crash', 0.6);
    Mascot.face('shock');
    await ctx.wait(2400);
    await S('{sad}...They were really good stickers.', { hold: 1300 });
    a.hush();
    unpop(fired, 400);
    if (words) words.nodeValue = oldName;
    a.dress(BOX);
    Mascot.face('flat');
    await ctx.wait(900);
    await S('{flat}Worth it.', { hold: 1200 });
    a.hush();
    const title = card(stage, 'wd-corp small', '<small>Snappy changed her title</small><b>FOUNDER &amp; EXECUTIVE CHAIRWOMAN</b>');
    Speech.tune('tick');
    await ctx.wait(1300);
    await S("{smug}You can take the CEO out of the company... {pause}but you can't take the company out of the CEO.", { hold: 1300 });
    a.hush();
    unpop(title, 300);
    // on her way out she leaves her mark: the name, and a couple of the stickers on the big button
    await S('{wink}The name stays, though. {pause}And so do some of the stickers.', { hold: 300 });
    a.hush();
    stage.end();
    const save = document.querySelector('.save-clip')?.getBoundingClientRect();
    if (save?.width) {
      await a.moveTo(save.right - a.size * 0.35, save.top - a.size * 0.75, { ms: 800 });
      a.lookAt(save.left + save.width / 2, save.top, true);
      a.bounce();
    }
    Speech.tune('coin', 0.5);
    Events.leaveBehind('job');
    await ctx.wait(1400);
    await homeIn(ctx, a, BOX);
  }

  // ---------------------------------------------------------------------------
  // An emergency meeting of all the Snappys. The agenda: storage.
  // ---------------------------------------------------------------------------
  async function meeting(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, a, S, spot } = begin(ctx);
    Speech.tune('sting');
    Mascot.face('shock');
    await a.zoomTo(...spot.left(), 132);
    Mascot.flash('error', 650);
    await S('{shock}EMERGENCY MEETING!', { hold: 600 });
    a.hush();
    const crew = [['ceo', 'CEO', ACC.tie, 1.05], ['security', 'Security', ACC.shades, 0.8], ['finance', 'Finance', ACC.visor, 1.15], ['hr', 'HR', ACC.clipboard, 1.3], ['snacks', 'Snacks', ACC.cookie, 0.95]];
    const table = card(stage, 'wd-table', `<div class="wd-table-top"></div>${crew.map(([id, name, acc], i) => `<div class="wd-seat s${i}" data-id="${id}" style="--blink:${(i * 0.83).toFixed(2)}s;--look:${(i * 1.3).toFixed(2)}s"><div class="wd-mini">${MINI(acc)}</div><span class="wd-seat-name">${name}</span><div class="wd-mini-say"></div></div>`).join('')}`, false);
    pop(table);
    for (const seat of table.querySelectorAll('.wd-seat')) { await ctx.wait(220); seat.classList.add('in'); Speech.tune('key', 0.8); }
    a.lookAt(W * 0.62, H * 0.5);
    await ctx.wait(600);
    // a little Snappy says something, in a little bubble
    const mini = async (id, text, ms = 1400) => {
      const seat = table.querySelector(`[data-id="${id}"]`);
      const say = seat.querySelector('.wd-mini-say');
      const pitch = crew.find((c) => c[0] === id)[3];
      a.hush();
      seat.classList.add('talking');
      say.classList.add('in');
      const w = Speech.typewriter(say, text, { speed: 30, voice: () => Speech.blip(false, pitch), onWord: () => { seat.classList.remove('bob'); void seat.offsetWidth; seat.classList.add('bob'); } });
      ctx.writers.add(w);
      try { await ctx.run(w.done); } finally { ctx.writers.delete(w); }
      await ctx.wait(ms);
      say.classList.remove('in');
      seat.classList.remove('talking');
    };
    await S('{flat}Thank you all for coming. {pause}We have a serious problem.', { keepLook: true });
    await S("{worried}We're running out of storage.", { keepLook: true, hold: 1000 });
    await mini('security', 'We delete everything.');
    await mini('finance', 'Compress all the clips into one ZIP file.');
    await mini('hr', 'What if we... {pause}delete the app?', 900);
    table.classList.add('gasp');
    Mascot.flash('error', 650);
    Speech.tune('glitch', 0.4);
    await ctx.wait(900);
    table.classList.remove('gasp');
    await mini('snacks', '*crunch*', 1100);
    await S("{flat}Let's vote.", { keepLook: true, hold: 600 });
    a.hush();
    for (const seat of table.querySelectorAll('.wd-seat')) {
      seat.insertAdjacentHTML('beforeend', '<div class="wd-vote">BUY MORE STORAGE</div>');
      Speech.tune('key', 0.8);
      await ctx.wait(260);
    }
    await ctx.wait(500);
    Mascot.flash('happy', 1150);
    await S('{shine}Unanimous! {pause}Buy more storage.', { keepLook: true, hold: 700 });
    await mini('ceo', 'Please approve the budget.', 600);
    const bill = World.paper(stage, 'invoice', `<div class="wd-head">INVOICE</div><div class="wd-rule"></div>
      <div class="wd-row in"><span>Storage (a lot)</span><b>€9,999,999.00</b></div><div class="wd-row in"><span>Snacks</span><b>€0.50</b></div>
      <div class="wd-row in total"><span>Total</span><b class="bad">€9,999,999.50</b></div>`);
    bill.el.classList.add('front');
    a.lookAt(W * 0.62, H * 0.5, true);
    await ctx.wait(1600);
    Mascot.face('shock');
    await ctx.wait(700);
    await S('{shock}NINE MILLION?!', { keepLook: true, hold: 500 });
    await S('{worried}Meeting cancelled! {pause}Everybody out!', { hold: 300 });
    a.hush();
    bill.close();
    table.classList.add('scatter');
    Speech.tune('whoosh');
    await ctx.wait(1100);
    stage.end();
    await a.home();
  }

  // ---------------------------------------------------------------------------
  // The magic show. The last trick goes a little too well.
  // ---------------------------------------------------------------------------
  async function magic(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, a, S, spot } = begin(ctx, { light: false });
    a.dress(TOPHAT);
    Mascot.face('shine');
    await a.zoomTo(...spot.left(), 132);
    const hat = card(stage, 'wd-hat', `<svg class="mh" viewBox="0 0 160 150"><defs><linearGradient id="mh-silk" x1="0" x2="1"><stop offset="0" stop-color="#0d0d10"/><stop offset=".35" stop-color="#2e2e36"/><stop offset=".55" stop-color="#16161a"/><stop offset="1" stop-color="#0a0a0c"/></linearGradient>
      <radialGradient id="mh-hole" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#4a3470"/><stop offset="1" stop-color="#000"/></radialGradient></defs>
      <path d="M28 112 L132 112 L140 146 L20 146 Z" fill="#7a1420" stroke="#0a0a0a" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="80" cy="112" rx="58" ry="11" fill="#a81f2a" stroke="#0a0a0a" stroke-width="3"/>
      <path d="M22 145 Q80 151 138 145" stroke="#e9b23a" stroke-width="4" fill="none" stroke-dasharray="2 5" stroke-linecap="round"/>
      <g class="mh-hat"><path d="M54 110 L57 52 L103 52 L106 110 Q80 116 54 110 Z" fill="url(#mh-silk)" stroke="#0a0a0a" stroke-width="3" stroke-linejoin="round"/>
      <path d="M57 60 L103 60 L104 71 L56 71 Z" fill="#d6322b"/>
      <ellipse cx="80" cy="52" rx="42" ry="10" fill="#1b1b20" stroke="#0a0a0a" stroke-width="3"/>
      <ellipse class="mh-hole" cx="80" cy="51" rx="25" ry="5.5" fill="url(#mh-hole)"/>
      <path d="M66 76 Q64 92 66 106" stroke="rgba(255,255,255,.2)" stroke-width="4" stroke-linecap="round" fill="none"/></g></svg><div class="wd-hat-out"></div>`, false);
    hat.style.left = `${W * 0.56}px`;
    pop(hat);
    await S("{shine}Ladies and gentlemen! {pause}I've learned magic.", { hold: 700 });
    const out = hat.querySelector('.wd-hat-out');
    // a swish of the wand, and sparkles fly from its tip into the hat
    const cast = async () => {
      a.root.classList.remove('cast');
      void a.root.offsetWidth;
      a.root.classList.add('cast');
      Speech.tune('whoosh');
      const from = { x: a.x + a.size * 1.08, y: a.y + a.size * 0.38 };
      const h = hat.getBoundingClientRect(), to = { x: h.left + h.width / 2, y: h.top + 50 };
      for (let i = 0; i < 7; i++) {
        const s = stage.add('mg-spark', '✦');
        s.style.left = `${from.x}px`;
        s.style.top = `${from.y}px`;
        s.style.setProperty('--tx', `${to.x - from.x + (Math.random() - 0.5) * 30}px`);
        s.style.setProperty('--ty', `${to.y - from.y + (Math.random() - 0.5) * 16}px`);
        s.style.animationDelay = `${i * 0.05}s`;
        setTimeout(() => s.remove(), 1200);
      }
      await ctx.wait(450);
    };
    const pull = async (html, cls, line) => {
      a.hush();
      await cast();
      hat.classList.remove('shake'); void hat.offsetWidth; hat.classList.add('shake');
      await ctx.wait(350);
      out.innerHTML = `<div class="wd-pulled ${cls}">${html}</div>`;
      Speech.tune('coin', 0.7);
      a.lookAt(W * 0.56 + 40, H * 0.4);
      await ctx.wait(700);
      if (line) await S(line, { keepLook: true, hold: 700 });
    };
    await pull('<svg viewBox="-4 -2 28 32"><path d="M1.5 1.5v20.2l5.1-4.9 3.4 8.1 3.3-1.4-3.4-8h7.1z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>', 'cursor', '{shine}A mouse pointer! {pause}Ta-da!');
    await pull('<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="28" fill="#fff"/><path d="M24 18 L42 30 L24 42 Z" fill="#0a0a0a"/></svg>', 'play', '{happy}A giant play button! {pause}Ta-daa!');
    a.hush();
    // a stack of thumbnails that doesn't stop
    hat.classList.add('shake');
    const clip = World.newest();
    const pile = out;
    pile.innerHTML = '';
    for (let i = 0; i < 47; i++) {
      const t = document.createElement('div');
      t.className = 'wd-flying-thumb';
      t.innerHTML = World.thumb(clip);
      t.style.setProperty('--x', `${Math.round((Math.random() - 0.5) * 520)}px`);
      t.style.setProperty('--y', `${Math.round(-60 - Math.random() * 280)}px`);
      t.style.setProperty('--r', `${Math.round((Math.random() - 0.5) * 70)}deg`);
      pile.appendChild(t);
      if (i % 4 === 0) Speech.tune('key', 0.5);
      await ctx.wait(45);
    }
    hat.classList.remove('shake');
    await ctx.wait(500);
    await S('{worried}...Forty-seven identical thumbnails. {pause}That seems like too many.', { keepLook: true, hold: 700 });
    pile.innerHTML = '';
    await pull(`<div class="wd-mini">${MINI(ACC.wand)}</div>`, 'snappy', '{shock}Wait. {pause}That one is not part of the act.');
    a.hush();
    // the other one does a trick of her own, and is gone
    const other = out.querySelector('.wd-pulled');
    other.classList.add('wave');
    await ctx.wait(800);
    puff(stage, rect(other));
    other.remove();
    Speech.tune('whoosh');
    await ctx.wait(1000);
    await S("{shine}Oh! {pause}I can do that!", { hold: 500 });
    a.hush();
    a.bounce();
    await ctx.wait(500);
    // ...and so is she
    puff(stage, a.root.getBoundingClientRect());
    a.root.classList.add('poofed');
    Speech.tune('whoosh');
    await ctx.wait(2600);
    hat.classList.add('shake');
    await ctx.wait(1200);
    // a little hand from the corner drags her back
    const hand = card(stage, 'wd-hand', '<svg viewBox="0 0 120 60"><path d="M0 22 H70 Q78 22 80 16 Q84 8 94 10 Q104 12 104 20 L104 40 Q104 50 94 50 L0 50 Z" fill="#f4f4f4" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/><path d="M80 26 Q92 24 100 30" fill="none" stroke="#0a0a0a" stroke-width="3" stroke-linecap="round"/></svg>', false);
    hand.style.top = `${a.y + a.size * 0.45}px`;
    pop(hand);
    await ctx.wait(700);
    a.root.classList.remove('poofed');
    a.root.classList.add('dragged');
    a.placeAt(-a.size, a.y);
    await ctx.wait(50);
    hand.classList.add('pull');
    a.placeAt(spot.left()[0], a.y);
    Mascot.face('worried');
    await ctx.wait(1300);
    a.root.classList.remove('dragged');
    unpop(hand, 500);
    await ctx.wait(400);
    // she bows as if it all went perfectly
    a.root.classList.add('bow');
    Mascot.face('happy');
    Speech.tune('fanfare');
    await ctx.wait(1300);
    a.root.classList.remove('bow');
    await S('{wink}Thank you, thank you. {pause}{smug}I do my own stunts.', { hold: 1300 });
    a.hush();
    unpop(hat, 400);
    stage.end();
    await homeIn(ctx, a, TOPHAT);
  }

  // ---------------------------------------------------------------------------
  // The app misbehaves. These only happen in the library, where there's something to move around.
  // ---------------------------------------------------------------------------
  const inLibrary = () => state.view === 'library' && document.querySelectorAll('#grid .card').length > 0;
  // classes put on the app's own elements, all taken off again at the end
  function touch(ctx) {
    const marked = new Set();
    ctx.onEnd(() => {
      for (const [el, classes] of marked) { el.classList.remove(...classes); el.style.removeProperty('--fx'); el.style.removeProperty('--fy'); el.style.removeProperty('--fr'); el.style.removeProperty('--fd'); }
    });
    return (el, ...classes) => {
      if (!el) return;
      el.classList.add(...classes);
      const prev = [...marked].find(([e]) => e === el);
      if (prev) prev[1].push(...classes);
      else marked.add([el, [...classes]]);
    };
  }

  // Snappy tidies up the interface. A bit too much.
  async function reality(ctx) {
    const { a, S, spot } = begin(ctx, { dim: false });
    const mark = touch(ctx);
    Mascot.face('shine');
    await a.zoomTo(...spot.center(), 120);
    await S('{shine}You know what this app needs? {pause}A little tidying up.', { hold: 700 });
    a.hush();
    const vanish = async (el, line) => {
      if (!el) return;
      const r = rect(el);
      await a.moveTo(r.left - a.size * 0.2, r.bottom + 6, { ms: 650 });
      a.lookAt(r.left + r.width / 2, r.top + r.height / 2);
      if (line) await S(line, { keepLook: true, hold: 300 });
      a.hush();
      a.bounce();
      mark(el, 'wd-gone');
      Speech.tune('whoosh', 0.6);
      await ctx.wait(700);
    };
    await vanish(document.querySelector('#viewSub'), '{flat}This little line? {pause}Clutter.');
    await vanish(document.querySelector('.toolbar .spacer + *') || document.querySelector('.toolbar button'), '{wink}This button has to go.');
    // and on the way back she trips, and everything goes
    await a.moveTo(...spot.center(), { ms: 700 });
    a.trip();
    Mascot.flash('error', 650);
    for (const el of [document.querySelector('#grid'), document.querySelector('.toolbar'), document.querySelector('#nav'), document.querySelector('#saveClipBtn'), document.querySelector('.buffer-meter')]) {
      mark(el, 'wd-gone');
      Speech.tune('key', 0.8);
      await ctx.wait(160);
    }
    await ctx.wait(900);
    Mascot.face('shock');
    a.look([0, 0.05]);
    await S('{shock}...Oh no.', { keepLook: true, hold: 900 });
    await S('{worried}Okay. {pause}Okay okay okay. {pause}I can fix this.', { hold: 300 });
    a.hush();
    // she drags everything back in, one piece at a time
    const back = async (el, cls = 'wd-back') => {
      if (!el) return;
      const r = rect(el);
      await a.moveTo(r.left + r.width / 2 - a.size / 2, r.top + r.height / 2 - a.size / 2, { ms: 600 });
      el.classList.remove('wd-gone');
      mark(el, cls);
      Speech.tune('coin', 0.5);
      await ctx.wait(500);
    };
    await back(document.querySelector('#nav'));
    await back(document.querySelector('#saveClipBtn'));
    await back(document.querySelector('.buffer-meter'));
    await back(document.querySelector('.toolbar'), 'wd-flipped');
    a.lookAt(innerWidth / 2, rect(document.querySelector('.toolbar')).top);
    await S('{flat}Hm.', { keepLook: true, hold: 700 });
    a.hush();
    a.bounce();
    document.querySelector('.toolbar').classList.remove('wd-flipped');
    Speech.tune('key', 1);
    await ctx.wait(700);
    await back(document.querySelector('#grid'));
    for (const el of document.querySelectorAll('.wd-gone')) { el.classList.remove('wd-gone'); mark(el, 'wd-back'); }
    await a.moveTo(...spot.center(), { ms: 700 });
    Mascot.face('worried');
    await S('{happy}Fixed! {pause}{worried}Good as new.', { hold: 600 });
    a.hush();
    const undo = note(ctx, 'Changes made', '7 elements tidied.', 'Undo');
    await ctx.wait(800);
    a.lookAt(rect(undo.el).left, rect(undo.el).top + 20, true);
    Mascot.face('shock');
    await ctx.wait(1300);
    a.look([0, 0.08], true);
    await ctx.wait(700);
    a.root.classList.add('whisper');
    await S("{worried}...Don't.", { keepLook: true, hold: 1600 });
    a.root.classList.remove('whisper');
    a.hush();
    undo.close();
    await a.home();
  }

  // Zero gravity: everything floats. Click things to put them back.
  async function gravity(ctx) {
    const W = innerWidth, H = innerHeight;
    const { a, S, spot } = begin(ctx, { dim: false });
    const mark = touch(ctx);
    Mascot.face('shine');
    await a.zoomTo(...spot.center(), 120);
    const lever = prop(ctx, 'wd-lever', '<div class="wd-lever-base"><span>GRAVITY</span></div><div class="wd-lever-arm"></div>');
    lever.style.left = `${a.x + a.size + 30}px`;
    lever.style.top = `${a.y + a.size * 0.15}px`;
    pop(lever);
    await S('{shine}Ooh. {pause}What does this switch do?', { hold: 500 });
    a.hush();
    a.bounce();
    lever.classList.add('off');
    Speech.tune('fizz');
    await ctx.wait(500);
    // everything lifts off
    const floaters = [...document.querySelectorAll('#grid .card, .nav-item, #saveClipBtn, .toolbar .btn, .toolbar .search, .brand-text, .buffer-meter')];
    for (const el of floaters) {
      el.style.setProperty('--fx', `${Math.round((Math.random() - 0.5) * 60)}px`);
      el.style.setProperty('--fy', `${Math.round(-20 - Math.random() * 50)}px`);
      el.style.setProperty('--fr', `${Math.round((Math.random() - 0.5) * 30)}deg`);
      el.style.setProperty('--fd', `${(3 + Math.random() * 3).toFixed(2)}s`);
      mark(el, 'wd-float');
    }
    a.root.classList.add('drift');
    Speech.tune('fly');
    Mascot.face('shock');
    await ctx.wait(1200);
    await S('{shock}Whoa! {pause}{happy}Everything is floating!', { hold: 600 });
    await S('{shine}Quick, help me put things back! {pause}Click them!', { hold: 300 });
    a.hush();
    // clicks put things back in place, and nothing else happens while it floats
    const settle = (el) => { el.classList.remove('wd-float'); el.classList.add('wd-land'); Speech.tune('key', 0.8); };
    const onClick = (e) => {
      if (e.target.closest?.('.event-skip')) return;
      const el = e.target.closest?.('.wd-float');
      e.preventDefault();
      e.stopPropagation();
      if (el && e.type === 'click') settle(el);
    };
    for (const t of ['click', 'pointerdown', 'dblclick', 'contextmenu']) addEventListener(t, onClick, true);
    ctx.onEnd(() => { for (const t of ['click', 'pointerdown', 'dblclick', 'contextmenu']) removeEventListener(t, onClick, true); });
    // she tries to catch a folder, and misses
    const target = floaters.find((el) => el.classList.contains('nav-item')) || floaters[0];
    const r = rect(target);
    await a.moveTo(r.right + 10, r.top - 20, { ms: 1100, hop: false });
    a.twirl();
    Mascot.flash('error', 650);
    await ctx.wait(900);
    await S('{worried}Missed!', { hold: 500 });
    a.hush();
    await ctx.wait(4500);
    // the switch, slammed
    await a.moveTo(rect(lever).left - a.size - 10, rect(lever).top - a.size * 0.2, { ms: 900, hop: false });
    await S('{shine}Found it!', { hold: 200 });
    a.hush();
    a.root.classList.remove('drift');
    lever.classList.remove('off');
    Speech.tune('crash', 0.4);
    for (const el of document.querySelectorAll('.wd-float')) settle(el);
    a.root.classList.add('faceplant');
    a.placeAt(a.x, H - a.size * 0.75);
    await ctx.wait(1200);
    await S("{worried}...I'm okay.", { hold: 1300 });
    a.hush();
    a.root.classList.remove('faceplant');
    unpop(lever, 300);
    await a.home();
  }

  // Emergency maintenance: a crack, a crew, scaffolding, and one piece of tape.
  async function maintenance(ctx) {
    const { a, S } = begin(ctx, { dim: false });
    const grid = rect(document.querySelector('#grid'));
    const cx = grid.left + Math.min(grid.width, 700) * 0.55, cy = grid.top + 170;
    const at = (el, x, y) => { el.style.left = `${x}px`; el.style.top = `${y}px`; };
    // a darker patch of the app to work in, so the site reads over whatever's in the library
    const zone = prop(ctx, 'wd-zone');
    at(zone, cx, cy);
    pop(zone);
    // the crack: it spreads out from one point, like glass
    const LINES = ['M92 58 L70 50 L52 57 L30 44 L6 50', 'M92 58 L104 40 L99 24 L118 8', 'M92 58 L118 63 L137 54 L160 67 L176 60',
      'M92 58 L84 79 L93 97 L81 116', 'M92 58 L111 81 L128 86', 'M70 50 L66 32', 'M137 54 L141 38'];
    const lines = (cls) => LINES.map((d, i) => `<path class="${cls}" d="${d}" pathLength="1" style="--d:${i * 0.05}s"/>`).join('');
    const crack = prop(ctx, 'wd-crack', `<svg viewBox="0 0 180 120">${lines('dark')}${lines('light')}<circle cx="92" cy="58" r="4.5" fill="#e8eef5"/></svg>`);
    at(crack, cx - 90, cy - 60);
    await a.zoomTo(cx - 330, cy - 40, 112);
    a.lookAt(cx, cy, true);
    Mascot.face('shock');
    pop(crack);
    Speech.tune('crack', 0.7);
    await ctx.wait(1000);
    await S('{shock}Wait. {pause}Is that... a crack?', { keepLook: true, hold: 700 });
    a.dress(HARDHAT);
    Mascot.face('flat');
    await S('{flat}This app is officially unsafe.', { hold: 600 });
    a.hush();
    // caution tape, pulled across the site from one side to the other
    const cordon = [];
    for (const [dy, tilt] of [[118, 2.5], [92, -3]]) {
      const t = prop(ctx, 'wd-cordon', `<span>${'CAUTION · '.repeat(8)}</span>`);
      at(t, cx - 230, cy + dy);
      t.style.rotate = `${tilt}deg`;
      pop(t);
      cordon.push(t);
      Speech.tune('scratch', 0.35);
      await ctx.wait(450);
    }
    await S('{shine}Crew! {pause}Get in here!', { hold: 200 });
    a.hush();
    // scaffolding goes up: poles, braces, planks
    const scaffold = prop(ctx, 'wd-scaffold', `<svg viewBox="0 0 380 240">
      ${[14, 183, 352].map((x, i) => `<rect class="pole" x="${x}" y="0" width="12" height="240" rx="2" style="--d:${i * 0.08}s"/>`).join('')}
      ${[[20, 52, 189, 182], [189, 52, 20, 182], [189, 52, 358, 182], [358, 52, 189, 182]].map(([x1, y1, x2, y2], i) => `<line class="brace" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="--d:${0.35 + i * 0.06}s"/>`).join('')}
      ${[46, 176].map((y, i) => `<rect class="plank" x="0" y="${y}" width="380" height="13" rx="2" style="--d:${0.6 + i * 0.12}s"/>`).join('')}
    </svg>`);
    at(scaffold, cx - 190, cy - 116);
    pop(scaffold);
    Speech.tune('clunk', 0.6);
    await ctx.wait(500);
    Speech.tune('clunk', 0.5);
    await ctx.wait(500);
    // three of her, in hard hats, hopping up onto the planks
    const spots = [[cx - 130, cy + 60], [cx + 80, cy + 60], [cx - 24, cy - 70]];
    const crew = [];
    for (const [i, [x, y]] of spots.entries()) {
      const m = prop(ctx, 'wd-crew', `<div class="wd-mini">${MINI(ACC.hardhat)}</div><i class="wd-hammer"></i>`);
      at(m, x, y - 50);
      m.style.setProperty('--d', `${i * 0.11}s`);
      m.style.setProperty('--from', `${a.x + a.size / 2 - x}px`);
      pop(m);
      crew.push(m);
      snappy.call('sound.blip', { pitch: 900 + i * 120, volume: Speech.volume * 0.7 }).catch(() => {});
      await ctx.wait(320);
    }
    await ctx.wait(400);
    for (const m of crew) m.classList.add('hammer');
    for (let i = 0; i < 8; i++) { Speech.tune('key', 1); await ctx.wait(230); }
    await S('{happy}Look at them go.', { hold: 900 });
    for (let i = 0; i < 6; i++) { Speech.tune('key', 1); await ctx.wait(220); }
    for (const m of crew) m.classList.remove('hammer');
    a.hush();
    const bill = prop(ctx, 'wd-paper bill', `<div class="wd-page"><div class="wd-head">MAINTENANCE INVOICE</div><div class="wd-rule"></div>
      <div class="wd-row in"><span>Crew</span><b>3 Snappys</b></div><div class="wd-row in"><span>Scaffolding</span><b>Yes</b></div>
      <div class="wd-row in total"><span>Repair cost</span><b>1 piece of tape</b></div></div>`);
    pop(bill);
    Speech.tune('tick');
    await ctx.wait(2200);
    unpop(bill, 400);
    // the repair itself: she pulls one strip of packing tape across the crack, end to end, and pats it down
    a.dress(HARDHAT + TAPEROLL);
    const tape = prop(ctx, 'wd-repair-tape', '<span>FRAGILE · FRAGILE</span>');
    at(tape, cx - 84, cy - 16);
    await a.moveTo(cx - 84 - a.size * 0.85, cy - a.size * 0.62, { ms: 700 });
    Speech.tune('scratch', 0.7);
    tape.classList.add('in');
    await a.moveTo(cx + 84 - a.size * 0.5, cy - a.size * 0.62, { hop: false, ms: 900 });
    for (let i = 0; i < 2; i++) { a.bounce(); tape.classList.remove('pat'); void tape.offsetWidth; tape.classList.add('pat'); Speech.tune('key', 1); await ctx.wait(420); }
    a.dress(HARDHAT);
    // the crew cheers and the scaffolding comes down
    for (const m of crew) m.classList.add('cheer');
    Speech.tune('chime', 0.5);
    await ctx.wait(300);
    await a.moveTo(cx - 330, cy - 40, { ms: 700 });
    await S('{shine}Job done.', { hold: 600 });
    a.hush();
    a.lookAt(cx, cy, true);
    await ctx.wait(1400);
    await S("{flat}...It's upside down, isn't it.", { keepLook: true, hold: 900 });
    await S('{wink}Still counts.', { hold: 900 });
    a.hush();
    for (const s of [...crew, scaffold, ...cordon, crack, tape, zone]) unpop(s, 450);
    // one more strip, for the sign out front: her name on tape, for the rest of the day
    const name = document.querySelector('.brand-name');
    if (name) {
      await ctx.wait(500);
      a.dress(HARDHAT + TAPEROLL);
      const r = name.getBoundingClientRect(), w = Math.max(88, r.width + 14);
      const label = prop(ctx, 'wd-repair-tape name', '<span>SNAPPY</span>');
      at(label, r.left - 6, r.top + r.height / 2 - 12);
      label.style.setProperty('--w', `${w}px`);
      await a.moveTo(r.left + w + 4, r.top - 20, { ms: 800 });
      a.lookAt(r.left + w / 2, r.top + r.height / 2, true);
      Speech.tune('scratch', 0.7);
      label.classList.add('in');
      await ctx.wait(950);
      for (let i = 0; i < 2; i++) { a.bounce(); label.classList.remove('pat'); void label.offsetWidth; label.classList.add('pat'); Speech.tune('key', 1); await ctx.wait(420); }
      // from here on it's the app's own (until midnight), drawn in exactly the same place
      Events.leaveBehind('maintenance', { instant: true });
      label.remove();
      a.dress(HARDHAT);
      await S('{wink}There. {pause}Now everybody knows whose app this is.', { keepLook: true, hold: 900 });
      a.hush();
    }
    await homeIn(ctx, a, HARDHAT);
  }

  // A bug in the app, and the chase. It's better at this job than she is.
  async function bugfix(ctx) {
    const W = innerWidth, H = innerHeight;
    const { a, S, spot } = begin(ctx, { dim: false });
    const mark = touch(ctx);
    const bug = prop(ctx, 'wd-bug', '<svg viewBox="0 0 16 14" shape-rendering="crispEdges"><path d="M4 0h1v2h6V0h1v2h1v2h2v1h-2v2h2v1h-2v2h2v1h-2v1h-1v1H4v-1H3v-1H1v-1h2V8H1V7h2V5H1V4h2V2h1z" fill="#36d77a"/><path d="M5 5h2v2H5zM9 5h2v2H9z" fill="#0a0a0a"/></svg><div class="wd-laptop"></div>');
    const place = (x, y) => { bug.style.left = `${x}px`; bug.style.top = `${y}px`; };
    place(W * 0.8, H * 0.7);
    pop(bug);
    await a.zoomTo(...spot.left(), 112);
    a.lookAt(W * 0.8, H * 0.7, true);
    Mascot.face('shock');
    await ctx.wait(600);
    await S('{shock}A BUG!', { keepLook: true, hold: 300 });
    await S('{angry}Bugs break apps! {pause}I have to catch it before it breaks something!', { hold: 300 });
    a.hush();
    // each time she almost has it, it changes something and scurries off
    const pranks = [
      () => mark(document.querySelector('.toolbar'), 'wd-swapped', 'wd-bugged'),
      () => mark(document.querySelector('#grid .card'), 'wd-upside', 'wd-bugged'),
      () => mark(document.querySelector('.sidebar'), 'wd-wobble', 'wd-bugged'),
    ];
    const hops = [[W * 0.62, H * 0.3], [W * 0.35, H * 0.72], [W * 0.75, H * 0.45]];
    for (let i = 0; i < 3; i++) {
      const bx = parseFloat(bug.style.left), by = parseFloat(bug.style.top);
      await a.moveTo(bx - a.size * 0.8, by - a.size * 0.6, { ms: 650 });
      bug.classList.add('zap');
      pranks[i]();
      Speech.tune('glitch', 0.5);
      place(...hops[i]);
      await ctx.wait(500);
      bug.classList.remove('zap');
      if (i === 0) await S('{worried}Hey! {pause}What did you do to the buttons?!', { hold: 200 });
      if (i === 1) await S("{shock}Don't flip the clips!", { hold: 200 });
      if (i === 2) await S('{angry}Now the whole sidebar is wobbling!', { hold: 200 });
      a.hush();
    }
    // cornered
    await a.moveTo(W * 0.75 - a.size - 30, H * 0.45 - a.size * 0.5, { ms: 700 });
    await S('{flat}Gotcha.', { hold: 600 });
    a.hush();
    // it pulls out a laptop, and the truth comes out: it was fixing things all along
    bug.classList.add('typing');
    const br = bug.getBoundingClientRect();
    const patch = prop(ctx, 'wd-patch', '<div class="wd-patch-head">patch.js</div><div class="wd-patch-lines"></div>');
    patch.style.left = `${br.left - 40}px`;
    patch.style.top = `${br.top - 150}px`;
    pop(patch);
    const lines = patch.querySelector('.wd-patch-lines');
    for (const t of ['put the buttons back', 'un-flipped the clip', 'stopped the wobble', 'fixed 2 bugs nobody noticed']) {
      for (let i = 0; i < 4; i++) { Speech.tune('key', 0.7); await ctx.wait(70); }
      lines.insertAdjacentHTML('beforeend', `<div>✓ ${t}</div>`);
      if (t.startsWith('put')) for (const el of document.querySelectorAll('.wd-swapped')) el.classList.remove('wd-swapped', 'wd-bugged');
      if (t.startsWith('un-')) for (const el of document.querySelectorAll('.wd-upside')) el.classList.remove('wd-upside', 'wd-bugged');
      if (t.startsWith('stopped')) for (const el of document.querySelectorAll('.wd-wobble')) el.classList.remove('wd-wobble', 'wd-bugged');
      Speech.tune('tick', 0.6);
      await ctx.wait(450);
    }
    const fixed = note(ctx, 'Bug fix deployed successfully', 'Deployed by: the bug.');
    await S('{shock}Wait. {pause}You were FIXING things?', { hold: 600 });
    await ctx.wait(800);
    bug.classList.remove('typing');
    bug.classList.add('thumbs');
    await ctx.wait(1100);
    unpop(bug, 400);
    unpop(patch, 400);
    await ctx.wait(500);
    Mascot.face('flat');
    a.look([0, 0.08], true);
    await ctx.wait(900);
    await S("{flat}...I've been doing this job wrong.", { keepLook: true, hold: 1600 });
    a.hush();
    fixed.close();
    await a.home();
  }

  const D = (id, def) => Events.define(id, { tier: 'uncommon', weight: 3, ...def });
  D('job', { title: 'Snappy Industries', hint: "She's tired of working for free.", run: job });
  D('meeting', { title: 'Emergency Meeting', hint: 'All the Snappys, one table, one agenda.', run: meeting });
  D('magic', { title: 'I Do My Own Stunts', hint: "She's been practicing a trick.", run: magic });
  D('reality', { title: 'Good as New', hint: 'The app could use some tidying up. In the library.', run: reality, when: inLibrary });
  D('gravity', { title: 'Zero Gravity', hint: 'There is a switch she should not touch. In the library.', run: gravity, when: inLibrary });
  D('maintenance', { title: 'One Piece of Tape', hint: 'Something in the library looks cracked.', run: maintenance, when: inLibrary });
  D('bugfix', { title: 'The Real Developer', hint: 'Something is crawling around the library.', run: bugfix, when: inLibrary });
  Events.outfit('tophat', { name: 'Top hat and wand', markup: TOPHAT, from: 'magic' });
  Events.outfit('hardhat', { name: 'Hard hat', markup: HARDHAT, from: 'maintenance' });
  // and what they leave behind for the rest of the day: the company name and her stickers, the meeting's one
  // decision, a sparkle, a polish, the switch still a little bit on, her name on tape, the bug count
  Events.aftermath('job', { label: 'Snappy Industries', name: 'Snappy Industries',
    marks: [{ at: '.save-clip', cls: 'af-sticker heart' }, { at: '.save-clip', cls: 'af-sticker star' }] });
  Events.aftermath('meeting', { label: 'The sticky note from the meeting', marks: [{ at: '#libraryView .title-block', cls: 'af-note', html: 'buy more storage!!' }] });
  Events.aftermath('magic', { label: 'A little sparkle', marks: [{ at: '.brand', cls: 'af-sparkle' }] });
  Events.aftermath('reality', { label: 'A fresh polish', marks: [{ at: '.save-clip', cls: 'af-shine' }] });
  Events.aftermath('gravity', { label: 'A little zero gravity', cls: 'af-float' });
  Events.aftermath('maintenance', { label: 'Her name on tape', cls: 'af-taped', marks: [{ at: '.brand-name', cls: 'af-name-tape', html: '<span>SNAPPY</span>' }] });
  Events.aftermath('bugfix', { label: 'The bug in a jar', marks: [{ at: '.brand', cls: 'af-pic af-jar' }] });
})();
