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
  // of hers (say) and something she does while saying it (gag), or be read out by the Program (by: 'program'), which
  // then has the exchange in `talk` with her (['p' or 's', line] each), or its usual one.
  // Achievements are never named here: there are some to find, that's all.
  const NOTES = {
    '1.6.0': {
      title: 'The wardrobe update. And a show.',
      intro: ['{shine}Patch notes! {pause}{joy}I got a WARDROBE!', '{smug}And a few other things. Mostly the wardrobe.'],
      sections: [
        { name: 'New', kind: 'new', items: [
          { text: 'A wardrobe. Click my name up in the corner: every outfit and look, what stories leave behind, and all your achievements, in one place. Pick something and I put it on right there.', say: '{joy}Twirl included.', gag: 'name' },
          { text: 'Seven new looks, and not hats: whole new bodies. Each one comes out of a story in the terminal. You can tell them apart. They are purple.', say: '{smug}I contain multitudes.', gag: 'twirl' },
          { text: 'One of the secret words starts a whole show. Every frame rendered, every note composed, on purpose.', say: '{smug}Slop could never.' },
          { text: 'More than fifty new conversations in the terminal, and the three of us talk among ourselves a lot more when it sits quiet.', by: 'program', talk: [
            ['p', 'Claude wrote most of them.'],
            ['s', '{smug}It shows. {pause}{wink}In a good way.'],
            ['p', 'It also wants you to know the dashes are gone. All of them.'],
          ] },
          { text: 'Some looks change how I talk. Some change how I sound.', say: '{wink}Nyes. {pause}...I mean, yes.' },
        ] },
        { name: 'Better', kind: 'better', items: [
          { text: 'The pop-up in the corner wears whatever I am wearing, all the way down to a whole new body. A few of them have a move of their own when a clip saves.', say: '{shine}Matching!' },
          { text: 'Every big me wears my outfit too: the one in an empty folder, the tour guide, the one keeping you company while something exports.', say: '{love}All of us. {pause}Coordinated.' },
          { text: 'Snapshot Roulette is rebuilt from scratch. New table, new rules, new dealer.', by: 'program', talk: [
            ['p', 'Do not ask about the dealer.'],
            ['s', '{worried}Is the dealer you?'],
            ['p', 'Do not ask about the dealer.'],
          ] },
          { text: 'The cat ears are rounder, and they move. They also come with a voice.', say: '{joy}Nya~' },
          { text: 'Outfits, aftermaths and achievements moved out of Settings, into the wardrobe.' },
        ] },
        { name: 'Fixed', kind: 'fixed', items: [
          { text: 'In a whole new body, I used to flicker after every conversation. I stay put now.', say: '{flat}It was a whole thing.' },
          { text: 'My sunglasses no longer have my eyes peeking out from behind them. It was not cool.', say: '{smug}Now it is cool.' },
        ] },
        { name: 'Known issues', kind: 'known', items: [
          { text: 'New Snappy Snap left the arcade.', by: 'program', talk: [
            ['p', 'Waiting for a bar to fill is not a game.'],
            ['s', '{sad}I liked the bar.'],
          ] },
          { text: 'The games are still incredibly unbalanced.', by: 'program', talk: [
            ['s', '{flat}Still?'],
            ['p', 'Still.'],
          ] },
        ] },
      ],
      outro: ['{happy}That is everything!', '{wink}Go find the purple ones.'],
    },
    '1.5.0': {
      title: 'The one with the terminal. That is it.',
      intro: ['{shine}Patch notes! {pause}{joy}A whole new version!', "{smug}Let's see everything that's new!"],
      sections: [
        { name: 'New', kind: 'new', items: [
          { text: 'The terminal talks now. Some words get the three of us chatting: Claude, the Program and me. A lot of words. All of them secret.', say: "{smug}I can't tell you which ones. {pause}{worried}Especially not the... {pause}{shock}nothing. Never mind." },
          { text: 'Stuck? Type hint in the terminal. You get a riddle, not the answer.', say: '{wink}Riddles. Not cheats.' },
          { text: 'Leave the terminal open and quiet for a minute, and the Program and Claude start talking among themselves. Sometimes I join in.', say: '{love}Like a podcast that never ends.' },
          { text: 'Two new outfits, earned in the terminal. We do not talk about one of them.', say: '{worried}We really do not.' },
          { text: 'The Program has expressions now.', by: 'program', talk: [
            ['p', '{annoyed}It is one eyelid.'],
            ['s', '{joy}And it is SO expressive!'],
            ['p', '{annoyed}...'],
            ['s', '{smug}See? {pause}That one was annoyed.'],
          ] },
        ] },
        { name: 'Better', kind: 'better', items: [
          { text: 'Nothing. Everyone was busy in the terminal.', gag: 'tumbleweed' },
        ] },
        { name: 'Fixed', kind: 'fixed', items: [
          { text: 'Developer mode was switching itself on. It stays off now, until you switch it on yourself.', by: 'program', talk: [
            ['p', 'I insisted.'],
            ['s', "{wink}It's in Settings, About. {pause}{worried}...I didn't say that."],
          ] },
        ] },
        { name: 'Known issues', kind: 'known', items: [
          { text: 'This update is only the terminal.', by: 'program', talk: [
            ['s', '{worried}Only the terminal? {pause}No new games? {pause}No new stories?'],
            ['p', 'Eighty-four conversations.'],
            ['s', '{shock}...EIGHTY-FOUR?'],
            ['p', 'And one tumbleweed.'],
            ['s', '{smug}Best update ever.'],
          ] },
          { text: 'The games are still incredibly unbalanced.', by: 'program', talk: [
            ['s', '{flat}Eventually.'],
            ['p', 'Eventually.'],
          ] },
        ] },
      ],
      outro: ["{flat}That's... {pause}everything.", '{wink}See you in the terminal.'],
    },
    '1.4.0': {
      title: 'The one with the arcade',
      intro: ['{shine}Patch notes! {pause}Again!', '{smug}I have been practicing my reading voice.'],
      sections: [
        { name: 'New', kind: 'new', items: [
          { text: 'The arcade: the little controller next to her name. Two score games a day, one try each, and all your best scores in one place.', say: '{shine}Insert coin!', gag: 'coin' },
          { text: 'Eight new games. Some of them may look very familiar. One of them is about taking photos. Finally, her actual job.', say: '{joy}Eight! {pause}I counted twice.', gag: 'games' },
          { text: 'One of the arcade games comes back every day until somebody beats its boss stage.', say: '{angry}Somebody. {pause}{smug}Me. {pause}{flat}Eventually.' },
          { text: 'Stories leave a little something behind until midnight: a new name for the app, a sticker, a tag under her name. One of those things is very small, has two eyes, and will not leave her side. Your favourite can stay for good: Settings, Snappy, Aftermath.', say: '{love}He stays.', gag: 'little' },
          { text: 'After a story she keeps its outfit on for the rest of the day.', say: '{shine}I worked hard for this look.' },
          { text: 'Some stories hand you the controls now. Mostly.', say: '{wink}Trust me.' },
          { text: 'A terminal, for developers. Find developer mode the way you would on a phone, and it shows up next to the arcade. Then type help. Not every command is on the list.', say: '{smug}I am not allowed in there. {pause}{wink}I go in there all the time.' },
          { text: 'After one particular story there is a switch in her corner. Flip it and she is the Program, voice and all.', say: '{worried}It is roomy in there. {pause}And very serious.' },
          { text: "Every version's patch notes, to read again whenever you like: Settings, About.", say: '{smug}Including these. {pause}{wink}Very meta.' },
        ] },
        { name: 'Better', kind: 'better', items: [
          { text: 'Tours ask first, and you can skip them halfway.', say: "{happy}You're allowed to say Nah now. {pause}{sad}...I'll be fine." },
          { text: 'Achievements are always there, in Settings, Snappy. The old secret code is just an achievement now.', say: '{wink}Still a secret, though.' },
          { text: 'Every game got a balancing pass: friendlier starts, tougher later on, one try a run with your best kept, and one of them finally wants you to duck.', say: '{smug}I was already ducking. {pause}Professionally.' },
          { text: 'Games run at the same speed on every screen. On fast monitors some of them used to run more than twice as fast.', gag: 'fast' },
          { text: 'Choices come on a little ballot now. Mark one box.', say: '{smug}Democracy!' },
          { text: 'Smoother stories: lights that glide, chases that flow, a proper construction site, and no more words on top of other words.', say: '{shine}Cinematic.' },
          { text: 'Subtitles have a dark outline, so they read over anything. Dialogs fade in and out instead of popping.', say: '{happy}Even on white paper.' },
        ] },
        { name: 'Fixed', kind: 'fixed', items: [
          { text: "After an update she comes back quietly, in the tray. Nothing ever plays unless you're in her window and using it.", say: '{happy}I wait my turn now.' },
          { text: 'Skipping the patch notes no longer brings them back.', say: "{smug}You could skip these right now. {pause}{sad}...please don't." },
          { text: 'Tours no longer skip text, and she no longer talks without saying anything.', say: '{wink}I always have something to say.' },
        ] },
        { name: 'Known issues', kind: 'known', items: [
          { text: 'All the games are incredibly unbalanced. Too easy, too hard, or unplayable.', by: 'program', talk: [
            ['s', '{flat}The creator will balance them... {pause}eventually.'],
            ['p', 'The creator says this update already balanced them.'],
            ['s', '{shock}...already?'],
            ['p', 'Some of them.'],
            ['s', '{smug}See? {pause}Eventually.'],
          ] },
          { text: 'Snappy still cannot fly.', by: 'program', talk: [
            ['s', '{angry}I had a PROPELLER HAT.'],
            ['p', 'It was drawn on graph paper.'],
            ['s', "{smug}...I'll take it."],
          ] },
        ] },
      ],
      outro: ["{happy}That's everything!", '{wink}See you in the arcade.'],
    },
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
    // a ring round her name, up in the corner: that's where the wardrobe is
    async name(ctx, a, S, line) {
      const r = document.querySelector('.brand-name')?.getBoundingClientRect();
      if (r?.width) {
        const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const ring = document.createElement('div');
        ring.className = 'pn-ring pn-name';
        Object.assign(ring.style, { left: `${at.x}px`, top: `${at.y}px`, width: `${r.width + 22}px`, height: `${r.height + 14}px` });
        document.body.appendChild(ring);
        ctx.onEnd(() => ring.remove());
        setTimeout(() => ring.remove(), 1300);
        a.lookAt(at.x, at.y, true);
        Speech.tune('chime', 0.5);
      }
      await S(line);
    },
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
    // a coin, flipped up and over into the arcade's controller next to her name
    async coin(ctx, a, S, line) {
      const btn = document.querySelector('.brand .arc-btn')?.getBoundingClientRect();
      const from = { x: a.center.x, y: a.y + a.size * 0.2 };
      const to = btn?.width ? { x: btn.left + btn.width / 2, y: btn.top + btn.height / 2 } : { x: from.x, y: -40 };
      const coin = document.createElement('div');
      coin.className = 'pn-coin';
      document.body.appendChild(coin);
      ctx.onEnd(() => coin.remove());
      a.bounce();
      Speech.tune('coin', 0.6);
      const start = performance.now(), ms = 1100, lift = Math.min(220, Math.abs(to.x - from.x) * 0.35 + 90);
      for (;;) {
        const k = Math.min(1, (performance.now() - start) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e - Math.sin(e * Math.PI) * lift;
        coin.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scaleX(${Math.cos(k * Math.PI * 7)}) scale(${1 - k * 0.45})`;
        if (k >= 1 || ctx.cancelled) break;
        await new Promise((res) => requestAnimationFrame(res));
      }
      coin.remove();
      // clunk, and the controller lights up
      const ring = document.createElement('div');
      ring.className = 'pn-ring';
      Object.assign(ring.style, { left: `${to.x}px`, top: `${to.y}px` });
      document.body.appendChild(ring);
      ctx.onEnd(() => ring.remove());
      setTimeout(() => ring.remove(), 1300);
      Speech.tune('chime', 0.5);
      a.lookAt(to.x, to.y, true);
      await S(line);
    },
    // eight little cards fan out around her, one per new game, and tuck themselves away again
    async games(ctx, a, S, line) {
      const LOOK = [['♪', '#ff6a8e'], ['◉', '#58b4ff'], ['♠', '#c27cff'], ['✚', '#7fdc6c'], ['▲', '#ffc94a'], ['☠', '#ff9a6b'], ['★', '#ffd84a'], ['▣', '#7ee8ff']];
      const c = a.center, r = a.size * 0.95;
      const tiles = LOOK.map(([glyph, color], i) => {
        const el = document.createElement('div');
        el.className = 'pn-tile';
        el.textContent = glyph;
        el.style.setProperty('--c', color);
        Object.assign(el.style, { left: `${c.x}px`, top: `${c.y}px` });
        document.body.appendChild(el);
        const ang = Math.PI * (1.08 + (i / (LOOK.length - 1)) * 0.84);
        return { el, x: c.x + Math.cos(ang) * r * 1.3, y: c.y + Math.sin(ang) * r - 6 };
      });
      ctx.onEnd(() => tiles.forEach((t) => t.el.remove()));
      for (const t of tiles) {
        void t.el.offsetWidth;
        Object.assign(t.el.style, { left: `${t.x}px`, top: `${t.y}px` });
        t.el.classList.add('in');
        Speech.tune('tick', 0.45);
        await ctx.wait(90);
      }
      a.twirl();
      await S(line);
      for (const t of tiles) Object.assign(t.el.style, { left: `${c.x}px`, top: `${c.y}px` });
      tiles.forEach((t) => t.el.classList.remove('in'));
      await ctx.wait(450);
      tiles.forEach((t) => t.el.remove());
    },
    // the little clip from that story, at her side for the rest of the notes
    async little(ctx, a, S, line) {
      const markup = Events.markup('littleclip');
      if (markup) {
        a.dress(markup);
        snappy.call('sound.blip', { pitch: 1900, volume: Speech.volume * 0.7 }).catch(() => {});
        await ctx.wait(500);
      }
      await S(line);
    },
    // the same shuffle as a game on a fast screen (far too quick), then the way it should be
    async fast(ctx, a, S) {
      a.root.classList.add('pn-fast');
      await S('{shock}Before...', { hold: 1300 });
      a.root.classList.remove('pn-fast');
      void a.root.offsetWidth;
      a.root.classList.add('pn-smooth');
      await S('{happy}After!', { hold: 1300 });
      a.root.classList.remove('pn-smooth');
    },
    // nothing else in this update: a tumbleweed rolls through, and she watches it go
    async tumbleweed(ctx, a, S) {
      const weed = document.createElement('div');
      weed.className = 'pn-weed';
      weed.innerHTML = `<span><svg viewBox="0 0 64 64"><g fill="none" stroke="#a9824c" stroke-linecap="round" stroke-linejoin="round">
        <path stroke-width="3" d="M32 7 Q50 9 56 26 Q60 44 46 54 Q30 61 16 52 Q5 41 9 24 Q15 9 32 7 M54 20 L61 13 M10 47 L3 51"/>
        <path stroke-width="2.4" d="M12 26 Q32 6 52 30 Q38 56 14 40 Q20 18 44 16 Q58 36 34 52 Q16 46 22 24"/>
        <path stroke-width="2" d="M18 50 Q30 30 50 44 M24 12 Q36 30 30 56 M8 34 Q30 40 56 22 M40 10 Q22 32 46 50"/>
        <path stroke-width="1.6" stroke="#c9a46a" d="M16 18 Q34 26 26 44 Q20 30 40 30 Q50 40 36 46"/></g></svg></span>`;
      document.body.appendChild(weed);
      ctx.onEnd(() => weed.remove());
      Speech.tune('whoosh', 0.5);
      void weed.offsetWidth;
      weed.classList.add('go');
      await ctx.wait(700);
      a.lookAt(innerWidth / 2, innerHeight * 0.82, true);
      await S('{flat}...', { hold: 1200 });
      await ctx.wait(1300);
      weed.remove();
      await S('{worried}That was the whole section.');
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

  let reading = null;
  async function read(ctx) {
    const version = reading || state.version;
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
          if (it.talk) {
            for (const [who, line] of it.talk) await (who === 'p' ? talk.program : talk.snappy)(line, { hold: 900 });
          } else {
            Mascot.flash('error', 650);
            await talk.snappy('{angry}HEY!', { hold: 600 });
            await talk.program('Working as intended.', { hold: 1100 });
            await talk.snappy("{smug}...I'll take it.", { hold: 900 });
          }
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
    const close = () => { softRemove(root); removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); e.stopPropagation(); } };
    addEventListener('keydown', onKey, true);
    root.addEventListener('click', (e) => { if (e.target === root || e.target.closest('[data-close]')) close(); });
  }

  // Shown once: they count as seen the moment they start, so skipping them (or closing the window halfway) doesn't
  // bring them back. Settings, About has them to read again, older versions too.
  async function seen() {
    if (state.settings?.whatsNewFor) await saveSettings((s) => { s.whatsNewFor = null; });
  }

  async function show(version = state.version) {
    if (!NOTES[version]) return;
    if (version === state.version) seen();
    if (Speech.enabled) {
      reading = version;
      try { await Events.play('patchnotes'); } finally { reading = null; }
    } else quiet(version);
  }

  Events.define('patchnotes', { system: true, title: 'Patch notes', run: read });

  window.Notes = {
    has: (version) => !!NOTES[version],
    // every version with notes, newest first
    versions: () => Object.keys(NOTES).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
    due: () => !!NOTES[state.version] && state.settings?.whatsNewFor === state.version,
    show,
  };
})();
