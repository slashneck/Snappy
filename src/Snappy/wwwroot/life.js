// Little bits of life: her adventures, dozing off when you're away, and reactions to the odd thing you do. Each one
// is an achievement (see events.js), and all of it stays quiet when she's not allowed to talk.
(() => {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const say = (text) => () => Speech.say(text, { kind: 'news', interrupt: true });

  // Her maid outfit for spring cleaning: frilly white lace headdress, black dress, white apron, feather duster.
  // Drawn in her own coordinates (body: x 10..190, y 54..182), so it moves with her.
  const lace = (x, y, n, r, up) => {
    let d = `M${x} ${y}`;
    for (let i = 0; i < n; i++) d += ` a${r} ${r} 0 0 ${up ? 1 : 0} ${2 * r} 0`;
    return `${d} Z`;
  };
  const MAID = `
  <clipPath id="m-maid-body"><rect x="10" y="54" width="180" height="128" rx="44"/></clipPath>
  <rect x="0" y="156" width="200" height="40" fill="#1b1b1b" clip-path="url(#m-maid-body)"/>
  <rect x="10" y="54" width="180" height="128" rx="44" fill="none" stroke="#0a0a0a" stroke-width="6"/>
  <path d="${lace(36, 179, 11, 6, false)}" fill="#fff" stroke="#0a0a0a" stroke-width="3" stroke-linejoin="round"/>
  <path d="M70 160 H130 V180 Q130 191 119 191 H81 Q70 191 70 180 Z" fill="#fff" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
  <path d="${lace(70, 189, 6, 5, false)}" fill="#fff" stroke="#0a0a0a" stroke-width="3" stroke-linejoin="round"/>
  <path d="${lace(70, 162, 6, 5, true)}" fill="#fff" stroke="#0a0a0a" stroke-width="3" stroke-linejoin="round"/>
  <path d="${lace(90, 55, 7, 7.5, true)}" fill="#fff" stroke="#0a0a0a" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="${lace(97, 50, 6, 7.5, true)}" fill="#fff" stroke="#0a0a0a" stroke-width="3" stroke-linejoin="round"/>
  <rect x="86" y="51" width="112" height="10" rx="5" fill="#1b1b1b" stroke="#0a0a0a" stroke-width="2"/>
  <g class="maid-duster">
    <path d="M186 172 L212 110" stroke="#0a0a0a" stroke-width="8" stroke-linecap="round"/>
    <path d="M186 172 L212 110" stroke="#4a4a4a" stroke-width="3.5" stroke-linecap="round"/>
    <g stroke="#0a0a0a" stroke-width="3">
      <circle cx="203" cy="100" r="10" fill="#fff"/>
      <circle cx="222" cy="98" r="10" fill="#1b1b1b"/>
      <circle cx="212" cy="86" r="11" fill="#fff"/>
    </g>
  </g>`;

  // ---------------------------------------------------------------------------
  // The user agreement: she updates her terms, you don't read them, so she grabs your mouse and signs for you.
  // Then the contract goes off to her lawyer. She doesn't have one.
  // ---------------------------------------------------------------------------
  async function agreement(ctx) {
    const a = Events.actor(ctx);
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    const Cursor = Events.cursor(ctx);
    Program.cine(ctx, { bars: false, light: true });
    const paper = document.createElement('div');
    const name = state.userName ? state.userName[0].toUpperCase() + state.userName.slice(1) : 'You';
    paper.className = 'gag-paper';
    paper.innerHTML = `<h3>Snappy User Agreement</h3>
      <div class="gag-sub">Version 2.0 · effective immediately · please read every word</div>
      <ol>
        <li>Snappy may send your most embarrassing clip to your boss, your mom and your group chat. At random. Every Monday.</li>
        <li>Snappy may join your Minecraft world at night and loot your diamond stash. She will leave a sign that says "thx".</li>
        <li>In Rainbow Six Siege, Snappy may tell the enemy team where you're hiding. For content.</li>
        <li>Snappy may play your ranked games while you sleep. She is hardstuck Bronze.</li>
        <li>Snappy is entitled to 50% of all your ranked wins. Your losses remain 100% yours.</li>
        <li>Snappy may spend your in-game currency on the ugliest skin in the shop and equip it.</li>
        <li>Everything you ever tame, adopt or catch will be named "Snappy".</li>
        <li>Any rage quit will be clipped, saved forever and played at your wedding.</li>
        <li>Snappy may replace your desktop wallpaper with a picture of herself. A big one.</li>
      </ol>
      <div class="gag-fine">The small print: by signing, you also give Snappy your PC, your chair and the last slice of pizza. Do not read this part. If you are reading this part, stop. To cancel, send a handwritten letter by fax and say "Snappy is the best" three times without laughing.</div>
      <div class="gag-sign"><span>Signature</span><div class="gag-line"><span class="gag-sig">${esc(name)}</span></div></div>
      <div class="gag-buttons"><button class="gag-decline">Decline</button><button class="gag-agree">I agree</button></div>
      <div class="gag-stamp">AGREED</div>`;
    a.avoid = () => (paper.isConnected && !paper.classList.contains('send') ? paper.getBoundingClientRect() : null);
    const beside = () => [Math.max(24, innerWidth * 0.5 - 420), innerHeight * 0.5 - 40];
    ctx.onEnd(async () => {
      if (!paper.classList.contains('send')) paper.classList.add('away');
      await new Promise((res) => setTimeout(res, 800));
      paper.remove();
    });

    await a.enter(...beside());
    await a.say("{shine}Ahem! {open}Snappy has updated her User Agreement. {pause}{wink}Please read it very carefully. {pause}{worried}Except the small print.", { hold: 300 });
    a.hush();
    document.body.appendChild(paper);
    // a small window gets a smaller sheet, so the signature line is always in view
    paper.style.zoom = String(Math.min(1, (innerHeight - 48) / paper.offsetHeight));
    void paper.offsetWidth;
    paper.classList.add('in');

    // While you "read": Decline runs away from your pointer, and agreeing yourself is allowed, of course.
    let agreedSelf = false, declineTries = 0;
    const decline = paper.querySelector('.gag-decline'), agree = paper.querySelector('.gag-agree');
    const dodger = setInterval(() => {
      const r = decline.getBoundingClientRect(), p = Cursor.real;
      if (Math.hypot(p.x - (r.left + r.width / 2), p.y - (r.top + r.height / 2)) < 70) {
        declineTries++;
        decline.style.setProperty('--dx', `${(Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 60)}px`);
        decline.style.setProperty('--dy', `${(Math.random() - 0.5) * 50}px`);
        decline.classList.add('dodge');
      }
    }, 60);
    ctx.onEnd(() => clearInterval(dodger));
    // the block sits over the page, but the paper's own buttons can still be reached while you read
    paper.classList.add('live');
    agree.addEventListener('click', () => { agreedSelf = true; }, { once: true });
    // and if your pointer wanders down to the small print, she panics
    const fine = paper.querySelector('.gag-fine');
    let caught = false;
    for (let i = 0; i < 50 && !agreedSelf; i++) {
      const r = fine.getBoundingClientRect(), p = Cursor.real;
      if (!caught && p.x > r.left - 20 && p.x < r.right + 20 && p.y > r.top - 20 && p.y < r.bottom + 20) {
        caught = true;
        i = Math.min(i, 25); // give her time to say it
        a.say("{worried}Hey! {pause}Don't look at the small print!").catch(() => {});
      }
      await ctx.wait(100);
    }
    clearInterval(dodger);
    paper.classList.remove('live');

    const stampIt = async () => {
      paper.classList.add('stamped');
      Mascot.flash('happy', 1150);
      await ctx.wait(650);
    };
    // the signed contract folds up and flies off to her lawyer
    const sendOff = async (line) => {
      await Cursor.release();
      await a.moveTo(...beside());
      await a.say(line, { hold: 600 });
      a.hush();
      Mascot.face('shine');
      paper.classList.add('send');
      Speech.tune('whoosh');
      await ctx.wait(1000);
      await a.say("{shine}Sent! {pause}{happy}Straight to my lawyer.", { hold: 900 });
      await a.say("{open}... {pause}{worried}I should probably get a lawyer.", { hold: 1500 });
      await a.home();
    };
    if (agreedSelf) {
      await stampIt();
      return sendOff("{shine}Oh! You actually read it? {pause}{joy}Wow. Nobody ever reads it.");
    }

    await a.say(declineTries > 1 ? "{worried}That Decline button seems broken. {pause}{wink}Let me help!" : "{open}You're taking forever... {pause}{wink}Let me help!");
    // she walks up to your pointer and takes it
    const p = Cursor.pos;
    await a.moveTo(p.x - a.size - 4, p.y - a.size * 0.55);
    Cursor.grab();
    a.hush();
    Mascot.face('happy');
    await ctx.wait(250);

    const line = paper.querySelector('.gag-line').getBoundingClientRect();
    const sig = paper.querySelector('.gag-sig');
    // a long PC name gets written smaller, so it always fits on the line
    sig.style.fontSize = `${Math.max(15, 30 * Math.min(1, (line.width - 26) / sig.scrollWidth))}px`;
    const toward = (x, y, ms) => ctx.run(Promise.all([Cursor.moveTo(x, y, ms), a.moveTo(x - a.size - 4, y - a.size * 0.55, { hop: false, ms: 0 })]));
    await toward(line.left + 10, line.top + line.height * 0.45, 900);

    // the autograph: a fast, loopy scribble while the name appears behind the pointer
    let complained = false;
    const sx = line.left + 10, ex = line.left + Math.min(line.width - 10, sig.scrollWidth + 24), cy = line.top + line.height * 0.45;
    const steps = 26;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const fight = Math.min(26, Cursor.strain / 40);
      Cursor.shake = fight;
      if (fight > 9 && !complained) {
        complained = true;
        Mascot.face('worried');
        a.say("{angry}Hey! {pause}Let go! {shine}I'm stronger than I look!").catch(() => {});
      }
      sig.style.setProperty('--shown', `${t * 100}%`);
      sig.style.setProperty('--wobble', `${fight * 0.6}px`);
      await ctx.run(Cursor.moveTo(lerp(sx, ex, t), cy + Math.sin(i * 1.9) * 9 + (i % 3 === 0 ? -6 : 4), 55, (k) => k));
    }
    Cursor.shake = 0;
    a.hush();
    const btn = agree.getBoundingClientRect();
    await toward(btn.left + btn.width * 0.55, btn.top + btn.height * 0.5, 650);
    await ctx.wait(700);
    Cursor.press();
    agree.classList.add('pressed');
    await stampIt();
    return sendOff(complained ? "{happy}All set! {pause}{wink}You put up a good fight though." : "{happy}All set! {pause}{wink}Pleasure doing business with you.");
  }

  // Hide and seek: her spot in the corner is empty, and she comes hopping in from the side, a little out of breath.
  async function hide(ctx) {
    if (!document.getElementById('mascot')) return;
    Events.stage(ctx, { dim: false });
    const a = Events.actor(ctx, 100); // waits off to the side, so the corner stands empty
    a.bubbleSide('caption');
    await ctx.wait(1700);
    Mascot.face('worried'); // out of breath, sweating a little
    await a.enter(Math.max(24, innerWidth * 0.42 - 50), innerHeight * 0.5 - 60);
    Mascot.flash('error', 650); // she notices you
    await ctx.wait(500);
    await a.say("{worried}Oh! {pause}You're back already? {happy}I was just... {pause}{wink}stretching my legs!", { hold: 700 });
    await a.home();
    Mascot.flash('happy', 1150);
    await ctx.wait(400);
  }

  // Spring cleaning: she puts on a maid outfit to tidy up your clips, deletes a terrible fake one... and then
  // "accidentally" all of them. Nothing is ever deleted: the real Select all and Delete buttons only look pressed,
  // and the clips are just hidden for a moment.
  async function maid(ctx) {
    const before = state.folder;
    const total = state.library.clips.reduce((n, c) => n + c.size, 0);
    let fake = null;
    const restore = () => {
      $('#grid').classList.remove('gag-vanish');
      $('#grid').style.visibility = '';
      $('#emptyState').hidden = true;
      $$('.gag-press').forEach((b) => b.classList.remove('gag-press'));
      fake?.remove();
      setSelecting(false);
      if (state.folder !== before) selectFolder(before);
      else renderGrid();
    };
    ctx.onEnd(restore);
    Events.stage(ctx);
    const a = Events.actor(ctx, 104);
    a.bubbleSide('caption');
    const Cursor = Events.cursor(ctx);

    selectFolder('*');
    await a.enter(Math.max(24, innerWidth * 0.36), innerHeight * 0.5 - 40);
    await a.say(`{shine}Ooh, I see your clips already take up ${fmtSize(total)}!`, { hold: 900 });
    await a.say("{open}Luckily, I'm built to keep your storage nice and tidy. {happy}Let me help you clean up!", { hold: 900 });
    a.hush();
    a.dress(MAID);
    Mascot.flash('happy', 1150);
    await a.say('{wink}Ta-da! {shine}Cleaning mode!', { hold: 900 });
    await a.say("{happy}Let's delete some clips! {worried}Don't worry... {pause}{wink}only the ones where you whiffed. {shine}Hardcore missed shots.", { hold: 900 });
    a.hush();

    // she grabs your pointer and turns on selecting
    const toward = (x, y, ms) => ctx.run(Promise.all([Cursor.moveTo(x, y, ms), a.moveTo(x - a.size - 6, y - a.size * 0.5, { hop: false, ms: 0 })]));
    const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const press = async (el) => { Cursor.press(); el.classList.add('gag-press'); await ctx.wait(260); };
    const p = Cursor.pos;
    await a.moveTo(p.x - a.size - 6, p.y - a.size * 0.5);
    Cursor.grab();
    await toward(...center($('#selectModeBtn')), 800);
    await press($('#selectModeBtn'));
    setSelecting(true);

    // the terrible clip, at the very end of your library
    fake = document.createElement('div');
    fake.className = 'card gag-card';
    fake.innerHTML = `<div class="card-thumb"><div class="gag-thumb"><span>MISSED</span></div><div class="card-check">${icon('check')}</div><span class="badge">4:12</span></div>
      <div class="card-body"><div class="card-text"><div class="card-title">missing every single shot (again)</div><div class="card-meta">Today, 3:12 AM · 0 hits, 47 misses</div></div></div>`;
    $('#grid').appendChild(fake);
    const scroller = $('#gridScroller');
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    await ctx.wait(900);
    await a.say("{open}Oh, look at this one... {pause}{worried}we definitely don't need that. {happy}Let me delete it for you!", { hold: 900 });
    a.hush();
    await toward(...center(fake.querySelector('.card-thumb')), 900);
    Cursor.press();
    fake.classList.add('selected');
    $('#selectionCount').textContent = '1 selected';
    await ctx.wait(500);

    // On the way to Delete she trips, the pointer jerks onto Select all, and she doesn't notice what that did.
    const del = center($('#bulkDeleteBtn')), all = $('#selectAllBtn');
    const from = Cursor.pos;
    await toward(from.x + (del[0] - from.x) * 0.45, from.y + (del[1] - from.y) * 0.45, 650);
    a.trip();
    Mascot.flash('error', 600);
    Cursor.shake = 14;
    a.say('{worried}Whoa-!').catch(() => {});
    await ctx.run(Cursor.moveTo(...center(all), 160, (k) => k));
    Cursor.shake = 0;
    await press(all);
    $$('#grid .card').forEach((c) => c.classList.add('selected'));
    $('#selectionCount').textContent = `${$$('#grid .card').length} selected`;
    await ctx.wait(700);
    await a.say('{open}...anyway.', { hold: 500 });
    a.hush();
    await toward(...del, 900);
    await a.say('{happy}Bye-bye, bad clip!', { hold: 300 });
    a.hush();
    await press($('#bulkDeleteBtn'));
    $('#grid').classList.add('gag-vanish');
    await ctx.wait(900);
    $('#grid').style.visibility = 'hidden';
    $('#selectionBar').hidden = true;
    $('#emptyState').hidden = false;
    $('#emptyTitle').textContent = 'No clips yet';
    $('#emptyText').innerHTML = `Press <kbd>${esc(hotkeyLabel(state.settings?.saveClipHotkey))}</kbd> anytime to save what just happened.`;
    Mascot.flash('error', 900);
    Mascot.face('worried');
    await ctx.wait(700);
    await a.say("{worried}Oh no. {pause}Oh no no no. {pause}{sad}I... I deleted ALL of your clips. {pause}I'm so sorry...", { hold: 1600 });
    a.hush();
    await ctx.wait(400);

    // just kidding
    Mascot.face('wink');
    $('#emptyState').hidden = true;
    $('#grid').style.visibility = '';
    $('#grid').classList.remove('gag-vanish');
    fake.remove();
    setSelecting(false);
    $('#grid').classList.add('gag-return');
    setTimeout(() => $('#grid').classList.remove('gag-return'), 1600);
    Mascot.flash('happy', 1150);
    await a.say('{wink}...just kidding! {hop}{happy}They were never gone.', { hold: 500 });
    await a.say("{happy}Snappy will never delete your clips. {love}They're safe with me.", { hold: 1300 });
    a.hush();
    a.dress(null);
    await Cursor.release();
    await ctx.wait(250);
    await a.home();
  }

  // A sneeze that fires her flash.
  async function sneeze(ctx) {
    Speech.say('{worried}Ah... {pause}ah... {pause}{sneeze}ACHOO! {pause}{worried}...did I just take a picture?', { kind: 'news', key: 'sneeze' });
    await ctx.wait(5200);
  }

  // ---------------------------------------------------------------------------
  // All of them, as achievements
  // ---------------------------------------------------------------------------
  const D = (id, def) => Events.define(id, def);
  D('sneeze', { tier: 'common', title: 'Bless You', hint: "Hang around for a while. It's dusty in here.", run: sneeze, quick: true, weight: 2 });
  D('doze', { tier: 'common', title: 'Power Nap', hint: 'Leave her alone for a while.', replay: () => devWords.doze() });
  D('dizzy', { tier: 'common', title: 'Seeing Stars', hint: 'Poke her. Then keep poking.', replay: () => Mascot.act('dizzy') });
  D('pokes', { tier: 'common', title: 'Calling HR', hint: 'Poke, poke, poke, poke, poke, poke...', replay: say("{worried}Okay, okay! {pause}{wink}I'm telling HR.") });
  D('stare', { tier: 'common', title: 'Staring Contest', hint: 'Hold very still. On her.', replay: say('{happy}W-why are you staring? {pause}{love}...hehe.') });
  D('cramped', { tier: 'common', title: 'Tiny Window', hint: 'Give her a little less room.', replay: say("{worried}Hey! {pause}It's getting cramped in here!") });
  D('called', { tier: 'common', title: 'You Called?', hint: 'Say her name. With your keyboard.', replay: say('{shine}You called?') });
  D('rapid', { tier: 'common', title: 'Slow Down!', hint: 'Clip, clip, clip!', replay: say("{worried}Whoa, whoa, slow down! {pause}{wink}I'm only one camera!") });
  D('night', { tier: 'common', title: 'Night Owl', hint: "Visit her when everyone's asleep.", replay: say("{worried}It's so late! {pause}Go to sleep! {pause}{open}... {pause}{wink}okay, one more game.") });
  D('firstClip', { tier: 'common', title: 'First Clip', hint: 'Save your very first clip.', replay: say('{joy}Your very first clip! {happy}I could cry.') });
  D('party', { tier: 'common', title: 'Party Time', hint: 'Save a hundred clips.', replay: say("{shine}A hundred clips!! {hop}{wink}I'll bring the flash.") });
  D('konami', { tier: 'common', title: 'Up, Up, Down, Down', hint: 'An old code, on a settings page.', replay: say('{wink}Up, up, down, down... {pause}{shine}you know the rest.') });
  D('hide', { tier: 'uncommon', title: 'Hide and Seek', hint: "Open Snappy now and then. Sometimes she isn't home.", run: hide });
  D('agreement', { tier: 'uncommon', title: 'The Fine Print', hint: 'Spend some time with her. She has paperwork.', run: agreement, weight: 3 });
  D('maid', {
    tier: 'uncommon', title: 'Spring Cleaning', hint: 'Collect a bunch of clips. She likes things tidy.', run: maid, weight: 3,
    when: () => state.view === 'library' && state.library.clips.length >= 10,
    replay: () => { if (state.view !== 'library') showView('library'); selectFolder('*'); setTimeout(() => Events.play('maid'), 300); },
  });

  Events.outfit('maid', { name: 'Maid outfit', markup: MAID, from: 'maid' });
  // The golden pop-up over a game: one clip in five hundred. Not listed until it happens.
  D('shiny', {
    tier: 'legendary', title: 'Shiny Snappy', hint: 'A golden Snappy saved one of your clips. One clip in five hundred.', hidden: () => true,
    replay: () => snappy.call('mascot.shiny'),
  });
  snappy.on('shiny', () => Events.achieve('shiny'));

  // Opening the app now and then finds her corner empty.
  // What opening the app brings, in order: an early bird's welcome-back story (she doesn't say a word before it, that's
  // where she finds her voice), the patch notes after an update, and a special day's story. Each waits until you're
  // settled in the window.
  function opened() {
    // the golden pop-up showed up while this window was closed
    if (state.settings?.shinySeen) Events.achieve('shiny');
    const queue = [];
    if (state.settings?.earlyBird && !Events.has('earlybird') && Events.enabled) {
      queue.push(() => Events.play('earlybird'));
      if (!state.settings.earlyBirdSeen) Speech.waiting = true;
    }
    if (Notes.due()) queue.push(() => Notes.show());
    const holiday = Holidays.due();
    if (holiday) queue.push(holiday);
    const anniversary = Future.due();
    if (anniversary) queue.push(anniversary);
    if (queue.length) {
      (async () => {
        for (const [n, next] of queue.entries()) {
          await wait(n ? 900 : 1800);
          while (!Events.calm()) await wait(1500);
          await next();
          if (Speech.waiting) {
            Speech.waiting = false;
            // played or skipped, she has her voice now; the pop-up over games may talk too from here on
            saveSettings((s) => { s.earlyBirdSeen = true; });
          }
        }
      })();
      return true;
    }
    if (Number(localStorage.getItem('snappy.opens') || 0) >= 6 && Events.ready('hide') && Math.random() < 0.15) {
      setTimeout(() => Events.calm() && Events.play('hide'), 1200);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Dozing off: ten minutes without you, and she nods off. Come back and she startles awake.
  // ---------------------------------------------------------------------------
  let lastInput = Date.now(), dozing = false;
  const touched = () => {
    lastInput = Date.now();
    if (!dozing || Events.running) return;
    dozing = false;
    Mascot.release('doze');
    Mascot.flash('error', 650);
    Events.achieve('doze');
    setTimeout(() => Speech.say(pick(["{worried}I wasn't sleeping! {pause}{wink}...okay, maybe a little.", "{worried}Huh? What? {pause}{happy}Oh, it's you! Hi!"]), { kind: 'news', key: 'doze' }), 700);
  };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) addEventListener(ev, touched, { passive: true, capture: true });
  setInterval(() => {
    if (dozing || Events.running || Work.busy || window.Tour?.active || document.hidden) return;
    if (Date.now() - lastInput > 10 * 60e3 && state.status?.state !== 'paused') {
      dozing = true;
      Mascot.hold('doze', 'paused');
    }
  }, 20000);
  // an event is starting: she's wide awake for it
  function wake() {
    if (!dozing) return;
    dozing = false;
    Mascot.release('doze');
  }

  // ---------------------------------------------------------------------------
  // Small reactions
  // ---------------------------------------------------------------------------
  // too many pokes
  let pokes = [];
  Mascot.on((what, el) => {
    if (el.id !== 'mascot' || (what !== 'pet' && what !== 'love' && what !== 'dizzy')) return;
    const now = Date.now();
    pokes = pokes.filter((t) => now - t < 12000);
    pokes.push(now);
    if (pokes.length >= 15) { pokes = []; Speech.say("{worried}Okay, okay! {pause}{wink}I'm telling HR.", { kind: 'news', key: 'pokes' }); Events.achieve('pokes'); }
    if (what === 'dizzy') Events.achieve('dizzy');
  });

  // staring at her without moving
  let stareTimer = 0, stared = false;
  document.addEventListener('pointermove', (e) => {
    clearTimeout(stareTimer);
    if (stared || !e.target.closest?.('#mascot')) return;
    stareTimer = setTimeout(() => {
      if (stared || !Events.calm()) return;
      stared = true;
      Speech.say('{happy}W-why are you staring? {pause}{love}...hehe.', { kind: 'news', key: 'stare' });
      Events.achieve('stare');
    }, 4000);
  }, { passive: true });

  // a squeezed window
  let cramped = false;
  addEventListener('resize', () => {
    if (cramped || innerWidth > 860 || Events.running) return;
    cramped = true;
    Speech.say("{worried}Hey! {pause}It's getting cramped in here!", { kind: 'news', key: 'cramped' });
    Events.achieve('cramped');
  });

  // typing her name anywhere that isn't a text field (and, in development builds, a few words that play the events)
  let typed = '', calledAt = 0;
  const devWords = {
    agree: () => Events.play('agreement'), hide: () => Events.play('hide'), achoo: () => Events.play('sneeze'),
    maid: () => { if (state.view !== 'library') showView('library'); Events.play('maid'); },
    coin: () => Events.play('snappycoin'), claude: () => Events.play('claude'), debug: () => Events.play('debug'), early: () => Events.play('earlybird'), rogue: () => Events.play('rogue'), swap: () => Events.play('swap'), steve: () => Events.play('steve'), window: () => Events.play('window'), chest: () => Events.play('window2'),
    credits: () => Events.play('credits'), scream: () => Events.play('scream'), restart: () => Events.play('restart'), case: () => Events.play('investigation'),
    review: () => Events.play('review'), coach: () => Events.play('academy'), load: () => Events.play('loading'),
    viral: () => Events.play('viral'), critic: () => Events.play('critic'),
    job: () => Events.play('job'), meet: () => Events.play('meeting'), magic: () => Events.play('magic'),
    tidy: () => Events.play('reality'), float: () => Events.play('gravity'), crack: () => Events.play('maintenance'), bug: () => Events.play('bugfix'),
    spooky: () => Events.play('halloween'), xmas: () => Events.play('christmas'), newyear: () => Events.play('newyear'), heart: () => Events.play('valentine'),
    fools: () => Events.play('aprilfools'), notes: () => Notes.show(), future: () => Events.play('future'), escape: () => Events.play('escape'), scan: () => Events.play('deepscan'), lag: () => Events.play('framedrop'), compact: () => Events.play('context'), mario: () => Events.play('platformer'), flappy: () => Events.play('flappy'), offline: () => Events.play('offline'), papers: () => Events.play('snapplease'), geo: () => Events.play('geometry'), doodle: () => Events.play('doodle'), cookie: () => Events.play('cookies'), pacman: () => Events.play('snapman'), ware: () => Events.play('ware'), lastclip: () => Events.play('lastclip'), shiny: () => snappy.call('dev.popup', { shiny: true }), replay: () => Events.play('rewind'),
    doze: () => { lastInput = 0; setTimeout(() => { dozing = true; Mascot.hold('doze', 'paused'); }, 600); },
    work: async () => { Work.begin({ text: Talk.workLine('trim') }); for (let p = 0; p <= 1; p += 0.05) { await new Promise((r) => setTimeout(r, 180)); Work.progress(p); } Work.end(true, Talk.doneLine('trim')); },
    recap: () => Talk.debug('recap'), news: () => Talk.debug('news'), popup: () => snappy.call('dev.popup'),
  };
  addEventListener('keydown', (e) => {
    if (Events.running || e.target.closest?.('input, textarea, select, [contenteditable]') || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-8);
    if (state.dev) for (const [word, fn] of Object.entries(devWords)) if (typed.endsWith(word)) { typed = ''; fn(); return; }
    if (typed.endsWith('snappy') && Date.now() - calledAt > 20000) {
      calledAt = Date.now();
      Mascot.flash('happy', 1150);
      Speech.say(pick(['{shine}You called?', '{shine}Yes? {happy}Did somebody say my name?']), { kind: 'news', key: 'called', interrupt: true });
      Events.achieve('called');
    }
  });

  window.Life = { opened, wake, found: (id) => Events.achieve(id), MAID };
})();
