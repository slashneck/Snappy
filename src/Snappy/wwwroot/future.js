// One year with her: on the first open a year after you met, a letter falls out of a time portal, and Future Snappy
// steps out after it (sunglasses, a jacket, a scar she won't explain). Once.
//   Future.due()   the anniversary has come and the story hasn't been told
(() => {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* she might come back twice, that's all */ } },
  };
  const YEAR = 365 * 24 * 3600e3;
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  // Her, a few years on: aviators, a jacket, and a scar over one eye.
  const FUTURE = `<clipPath id="ft-body"><rect x="10" y="54" width="180" height="128" rx="44"/></clipPath>
    <g clip-path="url(#ft-body)"><rect x="0" y="152" width="200" height="40" fill="#1d1d23"/>
      <path d="M100 152 L78 182 H62 L84 152 Z M100 152 L122 182 H138 L116 152 Z" fill="#33333d"/>
      <path d="M100 156 V182" stroke="#8a8a96" stroke-width="2.5" stroke-dasharray="3 3"/></g>
    <rect x="10" y="54" width="180" height="128" rx="44" fill="none" stroke="#0a0a0a" stroke-width="6"/>
    <path d="M44 104 H96 Q96 136 72 138 Q46 136 44 112 Z M104 104 H156 Q154 136 128 138 Q104 136 104 112 Z" fill="#101014" stroke="#0a0a0a" stroke-width="3" stroke-linejoin="round"/>
    <path d="M96 108 Q100 103 104 108" fill="none" stroke="#0a0a0a" stroke-width="4"/>
    <path d="M54 112 L66 110 M114 112 L126 110" stroke="#5c6470" stroke-width="3" stroke-linecap="round"/>
    <g stroke="#c96b6b" stroke-linecap="round"><path d="M56 80 L68 101" stroke-width="4"/><path d="M57 89 L64 86 M61 96 L68 93" stroke-width="2.5"/></g>`;

  // what the two of you did this year, from your own clips (counted here, never sent anywhere)
  function stats(since) {
    const clips = (state.library?.clips || []).filter((c) => c.date.getTime() >= since);
    const by = {};
    for (const c of clips) by[c.folder || 'Desktop'] = (by[c.folder || 'Desktop'] || 0) + 1;
    const top = Object.entries(by).sort((x, y) => y[1] - x[1])[0]?.[0] || null;
    return { count: clips.length, top: top && top !== 'Desktop' ? top : null };
  }

  async function future(ctx) {
    const W = innerWidth, H = innerHeight, size = 124;
    const since = Number(store.get('snappy.firstSeen') || Date.now() - YEAR);
    const st = stats(since);
    await ClaudeKit.glitch(ctx);
    const stage = Program.cine(ctx);
    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    const S = async (text, opts = {}) => { if (!opts.keepLook) a.look([0, 0.12]); await a.say(text, opts); };
    await a.zoomTo(Math.max(28, W * 0.18 - size / 2), H * 0.42 - size / 2, size);

    // a hole in time, on the right
    const portal = stage.add('ft-portal', '<i></i>');
    Object.assign(portal.style, { left: `${Math.round(W * 0.74)}px`, top: `${Math.round(H * 0.44)}px` });
    pop(portal);
    Speech.tune('sting');
    a.lookAt(...centerOf(portal), true);
    await ctx.wait(900);
    await S('{shock}Whoa. {pause}What is THAT?', { keepLook: true, hold: 700 });
    Speech.tune('whoosh');
    const letter = World.paper(stage, 'ft-letter', `<div class="ft-date">${esc(new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }))}</div>
      <p>Dear Snappy,</p>
      <p>Happy anniversary! One whole year with your player today.</p>
      <p>${st.count ? `${st.count} ${st.count === 1 ? 'clip' : 'clips'} so far${st.top ? `, mostly ${esc(st.top)}` : ''}.` : 'Not many clips yet.'} Trust me, it gets better.</p>
      <p>I can't tell you much. Time rules. But one thing:</p>
      <p class="ft-big">Don't let them add a mouth.</p>
      <p class="ft-sign">You, a few years from now</p>`);
    a.lookAt(...centerOf(letter.el), true);
    await ctx.wait(1200);
    await S("{shock}A letter? {pause}For me? {pause}It's signed... by ME?", { keepLook: true, hold: 900 });
    a.hush();
    await ctx.wait(4200);
    await S('{worried}...a mouth?', { keepLook: true, hold: 900 });

    // and then she steps out herself
    letter.el.classList.remove('in');
    letter.el.classList.add('out');
    const fut = Events.actor(ctx, size, { from: 'right', own: true });
    fut.bubbleSide('caption');
    fut.root.classList.add('narrow', 'ft-her');
    fut.dress(FUTURE);
    const pr = portal.getBoundingClientRect();
    fut.root.style.transition = 'none';
    fut.placeAt(pr.left + pr.width / 2 - size / 2, pr.top + pr.height / 2 - size / 2);
    void fut.root.offsetWidth;
    fut.root.style.transition = '';
    Speech.tune('fly');
    fut.root.classList.add('ft-arrive');
    await ctx.wait(900);
    await fut.moveTo(W * 0.56 - size / 2, H * 0.42 - size / 2, { ms: 800 });
    const voice = () => Speech.blip(false, 0.78);
    const F = async (text, opts = {}) => { a.hush(); fut.lookAt(a.center.x, a.center.y); await fut.say(text, { voice, ...opts }); };
    const P = async (text, opts = {}) => { fut.hush(); a.lookAt(fut.center.x, fut.center.y); await S(text, { keepLook: true, ...opts }); };
    a.onMove = () => fut.hush();
    await P('{shock}Is that... ME?!', { hold: 700 });
    await F('{smug}Hey, kid.', { hold: 800 });
    await P('{shock}You have a SCAR!', { hold: 600 });
    await F('Long story. {pause}Involves the Program. {pause}And a delete button.');
    fut.hush();
    const prog = Program.program(ctx);
    await prog.say('I can neither confirm nor deny.', { near: fut, hold: 1100 });
    prog.hush();
    await F("I can't stay. {pause}Time rules.");
    await P('{shine}Wait! Tell me the lottery numbers!', { hold: 500 });
    await F('{open}No. {pause}But here is some advice.', { hold: 600 });
    await F("Don't let them add a mouth.", { hold: 1100 });
    await P('{worried}...okay?', { hold: 700 });
    await F('{smug}Oh. {pause}And you were right about the potato.', { hold: 900 });
    await P('{joy}I KNEW IT!', { shout: true, hold: 900 });
    await F('{wink}Happy anniversary. {pause}Keep clipping.', { hold: 900 });
    fut.hush();
    // back where she came from
    await fut.moveTo(pr.left + pr.width / 2 - size / 2, pr.top + pr.height / 2 - size / 2, { ms: 700 });
    fut.root.classList.add('ft-leave');
    Speech.tune('whoosh');
    await ctx.wait(700);
    fut.root.remove();
    portal.classList.add('out');
    prog.leave();
    await ctx.wait(700);
    a.look([0, 0.08], true);
    await S('{happy}...one whole year.', { keepLook: true, hold: 900 });
    await S('{love}Thanks for keeping me around.', { keepLook: true, hold: 1300 });
    a.hush();
    stage.end();
    await a.home();
  }

  Events.define('future', {
    tier: 'holiday', planned: true, title: 'A Letter from the Future', hint: 'Stay with her for a whole year.', run: future,
  });
  Events.outfit('future', { name: 'Future look', markup: FUTURE, from: 'future' });

  window.Future = {
    due() {
      const first = Number(store.get('snappy.firstSeen') || 0);
      if (!first || Date.now() - first < YEAR || store.get('snappy.future') || !Events.enabled || !Speech.enabled) return null;
      return () => { store.set('snappy.future', '1'); return Events.play('future'); };
    },
  };
})();
