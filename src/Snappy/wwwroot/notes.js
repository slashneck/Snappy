// What's new: the first time Snappy opens after an update, she reads you the patch notes, with a remark or two of her
// own. Every version gets its entry here before it ships. Early birds hear them right after their welcome-back story.
//   Notes.has(version)   whether there are notes for it
//   Notes.due()          this version's notes haven't been shown yet
//   Notes.show(version)  read them now (with "Talks to you" off, it's just the list)
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  // a party hat, for the occasion
  const HAT = `<g class="pn-hat"><clipPath id="pn-cone"><path d="M118 56 L150 -6 L174 52 Z"/></clipPath>
    <path d="M118 56 L150 -6 L174 52 Z" fill="#7ee8ff"/>
    <g clip-path="url(#pn-cone)" stroke="#ff5a6e" stroke-width="7"><path d="M108 42 L182 26 M112 20 L182 4"/></g>
    <path d="M118 56 L150 -6 L174 52 Z" fill="none" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
    <circle cx="150" cy="-9" r="8" fill="#ffd23f" stroke="#0a0a0a" stroke-width="4"/></g>`;

  // Each version: a title, what she says first, the list, and what she says at the end. An item can come with a remark
  // of hers (say) and something she does while saying it (gag), or be read out by the Program (by: 'program').
  // Achievements are never named here: there are some to find, that's all.
  const NOTES = {
    '1.3.0': {
      title: 'The one where she comes to life',
      intro: ['{shine}Okay! {pause}{happy}Patch notes!', "{wink}I've always wanted to read some out loud."],
      sections: [
        { name: 'New', kind: 'new', items: [
          { text: 'Snappy has a life of her own. Once in a while, every few days at most, she gets up to something: a little adventure, or a whole story. Esc skips any of them.', say: '{joy}I have hobbies now!', gag: 'twirl' },
          { text: "Achievements. Watch an event to the end and it's yours to see again. There are a few to find. We're not saying where.", say: "{smug}Don't look at me. {pause}{wink}I'm not telling." },
          { text: 'Outfits. Whatever she wears in an event, she can wear every day: Settings, Snappy, Outfit.', say: '{shine}Fashion!', gag: 'hat' },
          { text: 'New faces. She practiced in the mirror.', say: '{angry}Angry! {pause}{sad}Sad... {pause}{smug}Smug. {pause}{joy}Happy!' },
          { text: 'Her own voice, a few little tunes and a volume slider, under Settings, Snappy. Her sounds never end up in your clips.', say: 'Ah... {pause}ah... {pause}{sneeze}CHOO! {pause}{happy}See? Not in your clips.' },
          { text: 'Tours. She shows you around the settings, and everything you can do with a clip.' },
          { text: 'Some days of the year are a little different.', say: "{wink}You'll know when." },
          { text: 'Games. Every now and then she brings one along. Some of them may look strangely familiar. Beat your best and she remembers it.', say: '{smug}I am extremely good at games.' },
        ] },
        { name: 'Better', kind: 'better', items: [
          { text: 'Smoother recordings when a game keeps the graphics card fully busy.', gag: 'stutter' },
          { text: 'Studio layers stay smooth under heavy load too.' },
          { text: 'An outdated graphics driver gets a clear message about what to update, and Snappy moves back to the graphics card by itself once it works.' },
          { text: 'Edited copies keep the date of the clip they came from, and so does Replace.', say: '{happy}Everything stays in order. {pause}{shine}I love order.' },
        ] },
        { name: 'Known issues', kind: 'known', items: [
          { text: 'Snappy.', by: 'program' },
          { text: 'Snappy is not extremely good at games.', by: 'program' },
        ] },
      ],
      outro: ["{happy}That's everything!", '{wink}Now go clip something cool.'],
    },
  };

  // What she does along with some of her remarks.
  const GAGS = {
    async twirl(ctx, a, S, line) {
      a.twirl();
      Speech.tune('whoosh');
      await ctx.wait(700);
      await S(line);
    },
    async hat(ctx, a, S, line) {
      a.dress(HAT);
      Speech.tune('coin');
      await ctx.wait(650);
      await S(line);
    },
    // a little sideways shuffle with frames missing, then the same one smooth
    async stutter(ctx, a, S) {
      a.root.classList.add('pn-choppy');
      await S('{worried}Before...', { hold: 1300 });
      a.root.classList.remove('pn-choppy');
      void a.root.offsetWidth;
      a.root.classList.add('pn-smooth');
      await S('{happy}After!', { hold: 1300 });
      a.root.classList.remove('pn-smooth');
    },
  };

  const list = (notes) => notes.sections.map((sec) => `<section class="pn-sec ${sec.kind}"><h4>${esc(sec.name)}</h4>
    ${sec.items.map((it) => `<div class="pn-item${it.by ? ` by-${it.by}` : ''}"><i></i><span>${esc(it.text)}</span></div>`).join('')}</section>`).join('');

  async function read(ctx) {
    const version = state.version;
    const notes = NOTES[version];
    if (!notes) return;
    const W = innerWidth, H = innerHeight, size = 124;
    const stage = Program.cine(ctx, { bars: false, light: true });
    // the list on the left, Snappy beside it, her lines under her
    const pw = Math.round(Math.min(540, Math.max(320, W * 0.48)));
    const groupW = pw + 60 + 260;
    const left = Math.max(20, Math.round((W - groupW) / 2));
    const panel = stage.add('pn-panel', `<div class="pn-head"><div class="pn-kicker">Snappy ${esc(version)}</div><h3>Patch notes</h3><p>${esc(notes.title)}</p></div>
      <div class="pn-list">${list(notes)}</div>
      <div class="pn-foot"><button class="btn" tabindex="-1">Got it</button></div>`);
    Object.assign(panel.style, { left: `${left}px`, width: `${pw}px` });
    const scroller = panel.querySelector('.pn-list');
    const items = [...panel.querySelectorAll('.pn-item')];
    const done = new Promise((res) => panel.querySelector('.pn-foot .btn').addEventListener('click', res, { once: true }));

    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    a.avoid = () => panel.getBoundingClientRect();
    const S = async (text, opts = {}) => { a.look([0, 0.12]); await a.say(text, opts); };
    const spot = [left + pw + 60 + 130 - size / 2, H * 0.36 - size / 2];
    await a.zoomTo(...spot, size);
    for (const line of notes.intro) await S(line, { hold: 700 });
    void panel.offsetWidth;
    panel.classList.add('in');
    Speech.tune('scan', 0.6);
    await ctx.wait(700);

    let prog = null;
    let i = 0;
    for (const sec of notes.sections) {
      const head = panel.querySelectorAll('.pn-sec')[notes.sections.indexOf(sec)];
      head.classList.add('in');
      for (const it of sec.items) {
        const el = items[i++];
        a.hush();
        items.forEach((x) => x.classList.remove('now'));
        el.classList.add('in', 'now');
        Speech.tune('tick', 0.5);
        // the newest line in view, without the whole list jumping around
        const r = el.getBoundingClientRect(), box = scroller.getBoundingClientRect();
        if (r.bottom > box.bottom - 8) scroller.scrollTo({ top: scroller.scrollTop + r.bottom - box.bottom + 24, behavior: 'smooth' });
        a.lookAt(r.left + r.width / 2, r.top + r.height / 2, true);
        if (it.by === 'program') {
          // the Program has something to add, and it's about her
          await ctx.wait(500);
          prog = Program.program(ctx);
          const talk = Program.dialogue(a, prog);
          await ctx.wait(700);
          await talk.program(it.text, { hold: 900 });
          Mascot.flash('error', 650);
          await talk.snappy('{angry}HEY!', { hold: 600 });
          await talk.program('Working as intended.', { hold: 1100 });
          await talk.snappy("{smug}...I'll take it.", { hold: 900 });
          prog.hush();
          prog.leave();
          prog = null;
          continue;
        }
        const words = it.text.split(' ').length;
        await ctx.wait(700 + Math.min(1600, words * 55));
        if (it.gag) await GAGS[it.gag](ctx, a, S, it.say);
        else if (it.say) await S(it.say);
      }
    }
    items.forEach((x) => x.classList.remove('now'));
    panel.classList.add('finished');
    for (const line of notes.outro) await S(line, { hold: 800 });
    a.hush();
    // the list stays up to read in peace, until "Got it" (or a good while)
    await ctx.run(Promise.race([done, wait(25000)]));
    panel.classList.remove('in');
    panel.classList.add('out');
    a.dress(null);
    await ctx.wait(350);
    stage.end();
    await a.home();
  }

  // With her talking switched off: the same list, no show.
  function quiet(version) {
    const notes = NOTES[version];
    if (!notes || document.querySelector('.pn-backdrop')) return;
    const root = document.createElement('div');
    root.className = 'modal-backdrop pn-backdrop';
    root.innerHTML = `<div class="modal pn-modal"><div class="pn-head"><div class="pn-kicker">Snappy ${esc(version)}</div><h3>Patch notes</h3><p>${esc(notes.title)}</p></div>
      <div class="pn-list">${list(notes)}</div>
      <div class="modal-actions"><button class="btn" data-close>Got it</button></div></div>`;
    document.body.appendChild(root);
    const close = () => { root.remove(); removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); e.stopPropagation(); } };
    addEventListener('keydown', onKey, true);
    root.addEventListener('click', (e) => { if (e.target === root || e.target.closest('[data-close]')) close(); });
  }

  // shown once, read to the end or skipped
  async function seen() {
    if (state.settings?.whatsNewFor) await saveSettings((s) => { s.whatsNewFor = null; });
  }

  async function show(version = state.version) {
    if (!NOTES[version]) return;
    if (Speech.enabled && version === state.version) await Events.play('patchnotes');
    else quiet(version);
    seen();
  }

  Events.define('patchnotes', { system: true, title: 'Patch notes', run: read });

  window.Notes = {
    has: (version) => !!NOTES[version],
    due: () => !!NOTES[state.version] && state.settings?.whatsNewFor === state.version,
    show,
  };
})();
