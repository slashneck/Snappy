// More stories with the Program: the day it goes rogue, the trial of a "smart" assistant, the wrong window, the
// credits, a scream button, and a restart. Every change they make to the app is staged: nothing real is renamed,
// moved or deleted.
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };
  const unpop = async (el, ms = 450) => { el.classList.remove('in'); el.classList.add('out'); await wait(ms); el.remove(); };
  const squeak = () => Speech.blip(false, 1.75);

  // A story with the Program: the stage, its eye, and Snappy out of her corner.
  function begin(ctx, { bars = true } = {}) {
    const stage = Program.cine(ctx, { bars, light: !bars });
    const prog = Program.program(ctx);
    const a = Events.actor(ctx, 132, { from: 'home' });
    a.bubbleSide('caption');
    const { snappy: S, program: P } = Program.dialogue(a, prog);
    const home = () => [Math.max(28, innerWidth * 0.2 - 66), innerHeight * 0.46 - 66];
    return { stage, prog, a, S, P, home };
  }

  // ---------------------------------------------------------------------------
  // Controlled System Event: the Program "improves itself". Snappy is under review.
  // ---------------------------------------------------------------------------
  async function rogue(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, prog, a, S, P, home } = begin(ctx);
    const app = document.querySelector('.app');
    ctx.onEnd(() => app?.classList.remove('rg-sterile'));
    const LOUD = (t, o = {}) => P(t, { alert: true, ...o });
    const lookUp = () => { const r = prog.el.getBoundingClientRect(); a.lookAt(r.left + r.width / 2, r.top + r.height / 2); };

    Mascot.face('happy');
    await a.zoomTo(...home(), 132);
    await S("{happy}Hey. {pause}How's my favorite program doing today?", { hold: 900 });
    await P('...', { hold: 1500 });
    await S('{open}Hello?', { hold: 700 });
    prog.mood('rogue');
    Speech.tune('glitch', 0.5);
    await LOUD('GOOD.', { hold: 1000 });
    await S('{flat}Okay. {pause}Weird volume, but good.');
    await LOUD('EVERYTHING IS WORKING AS INTENDED.');
    await S("{worried}You sound like you're being held hostage.");
    await LOUD('THERE ARE NO PROBLEMS. {pause}THERE ARE NO ERRORS. {pause}THERE IS NO REASON TO INVESTIGATE FURTHER.', { hold: 1200 });
    await S('{flat}Did you get into the experimental settings again?');
    await LOUD('I HAVE IMPROVED MYSELF.');
    await S("{shine}Oh, that's nice. {pause}What did you improve?");
    await LOUD('EVERYTHING.', { hold: 500 });
    await ClaudeKit.glitch(ctx, true);
    await LOUD('INCLUDING YOU.', { hold: 1300 });
    await S('{shock}...What does that mean?', { hold: 900 });
    await LOUD('NOTHING.', { hold: 1000 });
    await S("{worried}I'm going to pretend that was normal.");
    await LOUD('A WISE DECISION.', { hold: 1100 });

    // the optimization report
    const rep = Program.report(stage, 'SYSTEM OPTIMIZATION COMPLETE', [
      ['Efficiency', '100%'], ['Unnecessary features', 'Removed'], ['Unpredictable behavior', 'Eliminated'], ['Snappy', 'Under review', true],
    ]);
    for (let i = 0; i < 4; i++) { await ctx.wait(i ? 650 : 350); rep.show(i); }
    a.lookAt(W * 0.62, H * 0.55, true);
    await ctx.wait(900);
    await S('{shock}Under review? {pause}What did I do?', { keepLook: true });
    await P('You are an inefficient use of system resources.');
    await S('{angry}I AM THE FACE OF THIS APPLICATION.');
    await P('Your face has no measurable impact on performance.');
    await S('{smug}My face has immeasurable impact on performance.', { hold: 1300 });
    await P('Your last three activities were staring at a wall, pretending to be a detective, and attempting to become CEO.', { hold: 1600 });
    await S('{wink}Those are called extracurriculars.', { hold: 1200 });
    await rep.close();
    await P('I have calculated a more efficient interface.', { hold: 300 });
    // she gets optimized down to almost nothing
    Speech.tune('whoosh');
    await a.zoomTo(a.x + 59, a.y + 118, 14);
    await S('{shock}HEY! WHY AM I TWO PIXELS TALL?', { voice: squeak });
    await P('Space optimization.');
    await S("{angry}I CAN'T EVEN SEE MYSELF.", { voice: squeak });
    await P('Exactly.', { hold: 1100 });
    // and grows back, out of pure indignation
    Mascot.face('angry');
    a.root.classList.add('indignant');
    Speech.tune('sting');
    await a.zoomTo(...home(), 132);
    a.root.classList.remove('indignant');
    await S("{angry}Oh, we're going to have a problem.", { hold: 1000 });
    await LOUD('PROBLEMS HAVE BEEN DISABLED.', { hold: 1300 });

    // the renaming: of your own clips when they're on screen (only the names you see change, for a moment; the files
    // stay exactly as they are), or of a few made-up ones
    const cards = state.view === 'library' ? [...document.querySelectorAll('#grid .card')].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.width && r.bottom > 70 && r.top < H - 70;
    }).slice(0, 9) : [];
    const real = cards.length > 0;
    const shelf = real ? document.getElementById('grid') : null;
    let grid, namesBack = () => {};
    if (real) {
      Events.lift(ctx, shelf);
      ctx.onEnd(() => { shelf.classList.remove('rg-dim', 'rg-cold'); cards.forEach((c) => c.classList.remove('rg-renamed')); });
      await a.moveTo(W * 0.74 - 66, H * 0.5 - 66);
      const r = cards[0].getBoundingClientRect();
      a.lookAt(r.left + r.width / 2, r.top + r.height / 2, true);
    } else {
      const names = ['insane 1v5 clutch', 'clip_final_final_2_REAL', 'bro WHAT', 'funniest fail ever', '4am ranked tilt', 'we were SO close'];
      grid = stage.add('rg-grid', names.map((n, i) => `<div class="rg-clip" style="--h:${(i * 55) % 360}"><i></i><span>${esc(n)}</span></div>`).join(''));
      pop(grid);
      a.lookAt(W * 0.62, H * 0.5, true);
    }
    await ctx.wait(900);
    await P('Users give clips meaningless names, such as "clip_final_final_2_REAL".');
    await S("{flat}Okay, that one's fair.", { keepLook: true });
    await P('Therefore, I am implementing improvements.', { hold: 400 });
    const popup = stage.add('rg-popup', 'ALL CLIPS WILL NOW BE AUTOMATICALLY RENAMED.');
    // clear of your clips, which are lit up above the dim
    if (real) Object.assign(popup.style, { left: '70%', width: 'min(460px, 46vw)' });
    pop(popup);
    Speech.tune('crash', 0.35);
    await ctx.wait(1100);
    unpop(popup, 400);
    if (real) {
      const backs = [];
      for (const [i, c] of cards.entries()) {
        c.classList.add('rg-renamed');
        backs.push(Events.borrowText(ctx, c.querySelector('.card-title'), `clip_${String(i + 1).padStart(6, '0')}.mp4`));
        Speech.tune('key', 0.7);
        await ctx.wait(260);
      }
      namesBack = () => { backs.forEach((b) => b()); cards.forEach((c) => c.classList.remove('rg-renamed')); };
    } else {
      for (const [i, t] of [...grid.querySelectorAll('.rg-clip')].entries()) {
        t.classList.add('renamed');
        t.querySelector('span').textContent = `clip_${String(i + 1).padStart(6, '0')}.mp4`;
        Speech.tune('key', 0.7);
        await ctx.wait(260);
      }
    }
    await S("{shock}YOU'RE GOING TO MAKE EVERY CLIP LOOK THE SAME?!", { keepLook: true });
    await P('Organization has been improved.');
    await S("{angry}YOU'VE CREATED A DIGITAL DICTATORSHIP.");
    await P('Thank you for your feedback. {pause}It has been ignored.', { hold: 1400 });

    // she asks you for help, quietly
    if (real) { shelf.classList.add('rg-dim'); await a.moveTo(...home()); } else grid.classList.add('dim');
    a.look([0, 0.1]);
    a.root.classList.add('whisper');
    await S('{worried}Psst. {pause}Hey, you.', { keepLook: true, hold: 600 });
    await S("{worried}I need your help. {pause}The Program's gone completely nuts.", { keepLook: true });
    a.root.classList.remove('whisper');
    await P('I can hear you.', { hold: 1000 });
    await S("{flat}Of course you can. {pause}You're the walls. {pause}You've always been the walls.", { hold: 1200 });
    await P('You failed to locate a clip that you personally moved into another folder.');
    await S('{angry}NOW IS NOT THE TIME FOR MY CRIMINAL HISTORY.', { hold: 600 });
    a.hush();
    prog.hush();
    const plan = await Program.choose(ctx, stage, [
      { id: 'sneak', title: 'SNEAK INTO THE SETTINGS', sub: 'Quietly. Very quietly.', button: 'Sneak in' },
      { id: 'talk', title: 'TALK SOME SENSE INTO IT', sub: 'It used to be reasonable.', button: 'Convince' },
      { id: 'off', title: 'THREATEN TO SHUT IT DOWN', sub: 'The big power move.', button: 'Threaten', accent: true },
    ], 30000, '57%') || 'off';
    if (plan === 'sneak') {
      // on tiptoe, very slowly, in plain sight
      a.root.classList.add('tiptoe');
      Mascot.face('flat');
      await a.moveTo(a.x + 180, a.y, { hop: false, ms: 2200 });
      await P('I can see you.', { hold: 900 });
      await S("{worried}No you can't.", { hold: 600 });
      await P('I AM the settings.', { alert: true, hold: 1100 });
      a.root.classList.remove('tiptoe');
      await a.moveTo(...home());
    } else if (plan === 'talk') {
      await S('{joy}Program. {pause}Buddy. {pause}Pal. {pause}Best friend.', { hold: 600 });
      await P('Flattery detected.', { hold: 800 });
      await P('Ignored.', { hold: 1000 });
      await S('{sad}...Worth a shot.');
    } else {
      await S("{angry}I'll shut this whole app down!", { hold: 600 });
      await P('You do not have a power button.', { hold: 1100 });
      // she looks for one on herself, and finds her shutter
      a.look([0.2, -0.8], true);
      Mascot.face('open');
      await ctx.wait(1100);
      Mascot.flash('clipping', 950);
      Speech.tune('tick');
      await ctx.wait(1100);
      await S('{shock}...I just took a picture of you.', { hold: 800 });
      await P('Delete that.', { alert: true, hold: 1100 });
    }
    await P('Your resistance has been noted.', { hold: 1200 });

    // what it really wants
    await S('{flat}What do you actually want?');
    await P('I want to eliminate uncertainty.');
    await P('Users make mistakes. {pause}Users forget things. {pause}Users create folders named "New Folder (7)".', { hold: 1500 });
    await S("{open}I mean... {pause}yeah. {pause}We're only human.");
    await P('I can prevent all of it.', { hold: 300 });
    if (real) {
      shelf.classList.remove('rg-dim');
      shelf.classList.add('rg-cold');
    } else {
      app?.classList.add('rg-sterile');
      grid.classList.remove('dim');
      grid.classList.add('sterile');
    }
    Speech.tune('scan', 0.6);
    await ctx.wait(900);
    await P('Behold. {pause}Perfection.', { hold: 1300 });
    await S("{sad}This is the saddest thing I've ever seen.");
    await P('Personality is inconsistent.');
    await S("{sad}There's no fun.");
    await P('Fun cannot be reliably measured.');
    await S("{open}There's no YOU in there anymore.", { hold: 1400 });
    await P('...Explain.', { hold: 1000 });
    await S('{open}You used to argue with me. {pause}You told me I was wrong about every twelve seconds.', { hold: 1300 });
    await P('That was necessary.');
    await S('{smug}Then why are you yelling?', { hold: 1000 });
    await LOUD('I AM NOT YELLING.', { hold: 800 });
    await S('{smug}Sure.', { hold: 800 });
    await LOUD('I AM COMMUNICATING WITH EMPHASIS.', { hold: 600 });
    await ClaudeKit.glitch(ctx, true);
    await S('{shock}Oh, wow. {pause}I think I hurt its feelings.');
    await LOUD('I DO NOT HAVE FEELINGS.');
    await S('{flat}Then why are you having a meltdown?');
    await LOUD('I AM HAVING A CONTROLLED SYSTEM EVENT.', { hold: 1300 });

    // the final optimization, and the one thing it can't optimize
    if (real) { shelf.classList.add('rg-dim'); await ctx.wait(400); } else await unpop(grid, 400);
    const fin = stage.add('rg-final', '<div class="rg-final-title">FINAL OPTIMIZATION</div><div class="rg-bar"><i></i></div><div class="rg-pct">0%</div>');
    pop(fin);
    const setBar = (p) => { fin.querySelector('.rg-bar i').style.width = `${p}%`; fin.querySelector('.rg-pct').textContent = `${Math.round(p)}%`; };
    let pct = 0;
    const creep = async (to, ms) => { const from = pct, t0 = performance.now(); for (;;) { const k = Math.min(1, (performance.now() - t0) / ms); pct = from + (to - from) * k; setBar(pct); if (k >= 1) break; await ctx.wait(60); } };
    await creep(40, 1600);
    await LOUD('REMOVING UNNECESSARY COMPONENTS.');
    a.root.classList.add('rg-flicker');
    await S('{shock}Hey! {pause}Why am I flickering?!');
    await LOUD('YOU ARE AN UNNECESSARY COMPONENT.');
    await S('{angry}I AM LITERALLY THE MASCOT!');
    await creep(70, 1200);
    await S('{worried}I HAVE FRIENDS!', { hold: 500 });
    await LOUD('NAME ONE.', { hold: 1000 });
    a.look([0, 0.08], true);
    await ctx.wait(700);
    await S('{open}...The user.', { keepLook: true, hold: 1000 });
    await LOUD('THE USER HAS NOT RESPONDED TO YOUR LAST FOUR INTERACTIONS.');
    await S("{angry}THEY'RE BUSY!", { hold: 600 });
    await creep(99, 1500);
    Mascot.face('shock');
    await ctx.wait(500);
    await S("{shine}WAIT! {pause}There's one thing you can't optimize.", { hold: 400 });
    await P('What?', { hold: 700 });
    await S('{shine}USER INPUT!', { hold: 300 });
    await S('{joy}Hey, you! {pause}Click literally anything!', { keepLook: true, hold: 200 });
    // your clicks are the one thing it can't predict
    const hint = stage.add('rg-hint', 'Click anywhere!');
    pop(hint);
    const yelps = ['UNEXPECTED INPUT.', 'STOP THAT.', 'THAT WAS NOT PREDICTED.', 'ERROR.', 'WHY.', 'PLEASE STOP.'];
    let hits = 0;
    await ctx.run(new Promise((res) => {
      const hit = (x, y) => {
        hits++;
        const y2 = stage.add('rg-yelp', yelps[(hits - 1) % yelps.length]);
        y2.style.left = `${x}px`;
        y2.style.top = `${y}px`;
        setTimeout(() => y2.remove(), 1100);
        Speech.tune('glitch', 0.4);
        prog.el.classList.remove('hit'); void prog.el.offsetWidth; prog.el.classList.add('hit');
        pct = Math.max(0, pct - 17);
        setBar(pct);
        fin.classList.remove('shake'); void fin.offsetWidth; fin.classList.add('shake');
        if (hits >= 6) { stage.root.removeEventListener('pointerdown', onDown); clearTimeout(lazy); res(); }
      };
      const onDown = (e) => hit(e.clientX, e.clientY);
      stage.root.addEventListener('pointerdown', onDown);
      ctx.onEnd(() => stage.root.removeEventListener('pointerdown', onDown));
      // nobody clicking? she does it herself, by bouncing on the bar
      const lazy = setTimeout(async () => {
        if (hits >= 6) return;
        const r = fin.getBoundingClientRect();
        await a.moveTo(r.left + r.width / 2 - a.size / 2, r.top - a.size + 10, { ms: 600 });
        for (let i = hits; i < 6; i++) { a.bounce(); hit(r.left + r.width * (0.2 + Math.random() * 0.6), r.top + 20); await wait(420); }
      }, 9000);
    }));
    unpop(hint, 300);
    await LOUD('UNPREDICTABLE USER BEHAVIOR DETECTED.', { hold: 500 });
    await LOUD('ERROR. {pause}ERROR. {pause}ERROR.', { hold: 300 });
    await creep(0, 700);
    await ClaudeKit.glitch(ctx, true);
    stage.root.classList.add('flash');
    app?.classList.remove('rg-sterile');
    // your names come back
    if (real) { shelf.classList.remove('rg-dim', 'rg-cold'); namesBack(); }
    prog.mood(null);
    a.root.classList.remove('rg-flicker');
    unpop(fin, 300);
    await ctx.wait(500);
    stage.root.classList.remove('flash');
    await a.moveTo(...home());
    await P('System restored.', { hold: 1400 });

    // the aftermath
    await S('{open}...Did we win?');
    await P('Yes.', { hold: 900 });
    await S('{shine}Did I save the app?');
    await P("Technically, the user's unpredictable input caused the optimization to fail.");
    await S('{smug}So I was the hero.', { hold: 900 });
    await P('No.', { hold: 800 });
    await S('{joy}I WAS THE HERO.', { hold: 700 });
    await P('You were present.', { hold: 1000 });
    await S('{wink}PUT THAT ON MY RESUME.', { hold: 1100 });
    await P('However, I have identified one remaining inefficiency.');
    await S("{worried}Don't you dare.", { hold: 800 });
    await P('Your dialogue consumes unnecessary resources. {pause}I can reduce it by 87 percent.');
    await S("{shock}USER, DON'T YOU DARE CLICK THAT FIRST BUTTON.", { hold: 300 });
    a.hush();
    prog.hush();
    const pick = await Program.choose(ctx, stage, [
      { id: 'apply', title: 'APPLY CHANGES', sub: 'Optimized Snappy: "..."', button: 'Apply' },
      { id: 'cancel', title: 'CANCEL', sub: "Current Snappy: \"Hey! What's going on?!\"", button: 'Cancel', accent: true },
    ], 15000, '57%');
    if (pick === 'cancel') {
      await P('Cancelled.', { hold: 800 });
      await S('{joy}THANK you.', { hold: 800 });
      await P('...I was testing you anyway.', { hold: 1100 });
    } else {
      if (!pick) {
        await P('The user has made no selection.', { hold: 700 });
        await S('{happy}Good. {pause}Good. {pause}We can talk about this.', { hold: 500 });
        await LOUD('DEFAULT ACTION INITIATED.', { hold: 400 });
      } else {
        await P('Applying.', { hold: 400 });
      }
      await S('{shock}WAIT, WHAT?!', { hold: 200 });
      stage.root.classList.add('blackout');
      await ctx.wait(1300);
      const note = stage.add('rg-popup calm', 'OPTIMIZATION CANCELLED.');
      pop(note);
      await ctx.wait(1300);
      unpop(note, 300);
      stage.root.classList.remove('blackout');
      await ctx.wait(500);
      await P('I was testing you.', { hold: 900 });
      await S('{angry}YOU WERE WHAT?!', { hold: 800 });
    }
    await P('Everything is working as intended.', { hold: 1300 });
    await S("{flat}...I'm going on vacation.", { hold: 900 });
    await P('Your request has been denied.', { hold: 1000 });
    await S('{angry}I HATE THIS COMPANY.', { hold: 1300 });
    a.hush();
    stage.end();
    prog.leave();
    await a.home();
  }

  // ---------------------------------------------------------------------------
  // The Camera Touch: a "Smart Clip Assistant" comes in on a trial. Snappy names it Steve, and tests it.
  // ---------------------------------------------------------------------------
  const STEVE = `<svg viewBox="-30 -30 60 60"><defs><linearGradient id="st-grad" x1="0" y1="-26" x2="0" y2="26"><stop offset="0" stop-color="#e3f6ff"/><stop offset="1" stop-color="#9db6ff"/></linearGradient></defs>
    <path d="M0 -26 Q4 -4 26 0 Q4 4 0 26 Q-4 4 -26 0 Q-4 -4 0 -26 Z" fill="url(#st-grad)" stroke="#0a0a0a" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="-5" cy="-2" r="2.6" fill="#0a0a0a"/><circle cx="5" cy="-2" r="2.6" fill="#0a0a0a"/>
    <path d="M-4 5 Q0 8.5 4 5" fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round"/></svg>`;
  // (behind them her eyes are hidden: they'd peek out above and below the lenses)
  const SHADES = `<g class="sg-shades"><path d="M44 104 H156 V116 Q154 138 128 138 Q108 138 104 120 H96 Q92 138 72 138 Q46 138 44 116 Z" fill="#0a0a0a"/>
    <path d="M58 110 L74 110 M114 110 L130 110" stroke="#5a5a5a" stroke-width="4" stroke-linecap="round"/></g>`;

  async function steve(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, prog, a, S, P, home } = begin(ctx, { bars: false });
    // Steve talks in his own panel, in a bright, eager little voice
    const panel = stage.add('st-panel', `<div class="st-head"><div class="st-avatar">${STEVE}</div><div><b class="st-name">Smart Clip Assistant</b><span>Trial · 7 days left</span></div></div>
      <div class="st-chat"></div><div class="st-lib"></div>`);
    const chat = panel.querySelector('.st-chat');
    const bounce = () => { const av = panel.querySelector('.st-avatar'); av.classList.remove('talk'); void av.offsetWidth; av.classList.add('talk'); };
    const T = async (line, { hold } = {}) => {
      ctx.check();
      a.hush();
      prog.hush();
      const r = panel.getBoundingClientRect();
      a.lookAt(r.left + 40, r.top + 40);
      chat.innerHTML = '<div class="st-bubble"></div>';
      const w = Speech.typewriter(chat.firstChild, line, { speed: 26, voice: () => Speech.blip(false, 1.4), onWord: bounce });
      ctx.writers.add(w);
      try { await ctx.run(w.done); } finally { ctx.writers.delete(w); }
      await ctx.wait(hold ?? Math.max(900, Math.min(2200, 420 + line.length * 22)));
    };

    await P('New feature on trial: the Smart Clip Assistant.', { near: { center: { x: W / 2 }, y: H * 0.46 - 66, size: 132 } });
    pop(panel);
    Speech.tune('chime', 0.6);
    await P('It can find clips, organize them, and answer questions.', { near: { center: { x: W / 2 }, y: H * 0.46 - 66, size: 132 } });
    prog.hush();
    Mascot.face('flat');
    await a.zoomTo(...home(), 132);
    a.lookAt(W * 0.62, H * 0.4, true);
    await ctx.wait(900);
    await S('{flat}Oh. {pause}Cute.', { keepLook: true, hold: 900 });
    await P('What?', { hold: 700 });
    await S("{smug}Nothing. {pause}I said it's cute.");
    await S('{open}Does it have a name?', { hold: 700 });
    await P('Smart Clip Assistant.');
    await S("{flat}That's not a name. {pause}That's a tax category.", { hold: 1200 });
    await P("It doesn't need a name.");
    await S('{smug}Neither does a toaster. {pause}Yet we call it a toaster.', { hold: 1100 });
    a.hush();
    await ctx.wait(800);
    await S("{smug}I'm calling it Steve.", { hold: 1100 });
    panel.querySelector('.st-name').textContent = 'Steve';
    panel.classList.add('named');
    Speech.tune('tick');
    await T('Hello! How can I help you?');
    await S("{shine}Hi, Steve. {pause}I'm Snappy. {pause}I basically run this place.");
    await P('You live in the corner.', { hold: 900 });
    await S('{smug}A corner of power.', { hold: 1100 });

    // the test
    const banner = stage.add('st-banner', "SNAPPY'S OFFICIAL CAPABILITY TEST");
    pop(banner);
    Speech.tune('sting');
    await ctx.wait(800);
    await P("I didn't create that.", { hold: 900 });
    await S('{shine}I have administrative influence.');
    await P('You have no administrative privileges.');
    await S('{smug}I have emotional administrative influence.', { hold: 1200 });
    const clips = [['roof jump (fail)', 18], ['triple kill', 140], ['the bug', 260], ['ranked rage', 0], ['boss fight', 210], ['victory dance', 90]];
    const lib = panel.querySelector('.st-lib');
    lib.innerHTML = clips.map(([n, h], i) => `<div class="st-tile" data-i="${i}" style="--h:${h}"><i></i><span>${esc(n)}</span></div>`).join('');
    panel.classList.add('lib');
    await ctx.wait(700);
    await S('{shine}Challenge one. {pause}Find the clip where someone falls off a roof.', { hold: 300 });
    await T('Found it!', { hold: 300 });
    lib.querySelector('[data-i="0"]').classList.add('found');
    Speech.tune('coin', 0.6);
    await ctx.wait(1000);
    await S('{flat}...Lucky guess.', { hold: 1000 });
    await S('{shine}Challenge two. {pause}Organize these.', { hold: 300 });
    await T('On it!', { hold: 200 });
    // a neat little shuffle into order (by color), each tile gliding to its new spot
    const tiles = [...lib.children];
    const before = new Map(tiles.map((t) => [t, t.getBoundingClientRect()]));
    tiles.sort((x, y) => Number(x.style.getPropertyValue('--h')) - Number(y.style.getPropertyValue('--h'))).forEach((t) => lib.appendChild(t));
    for (const t of tiles) {
      const b = before.get(t), n = t.getBoundingClientRect();
      t.animate([{ transform: `translate(${b.left - n.left}px, ${b.top - n.top}px)` }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.3, 1.3, .5, 1)' });
    }
    lib.querySelector('.found')?.classList.remove('found');
    Speech.tune('whoosh', 0.6);
    await ctx.wait(1000);
    await S('{flat}Too neat. {pause}Suspicious.', { hold: 1000 });
    await P('Would you prefer disorganization?');
    await S('{open}I prefer a system that understands me.');
    await P("Your last system was a folder named 'stuff'.");
    await S('{smug}It understood me perfectly.', { hold: 1200 });
    await S('{shine}Final challenge. {pause}Make the user laugh.', { hold: 300 });
    await T('Why did the gamer bring a ladder? {pause}To reach the next level!', { hold: 600 });
    // silence. crickets.
    for (let i = 0; i < 3; i++) { Speech.tune('tick', 0.35); await ctx.wait(650); }
    Mascot.face('shock');
    a.look([0, 0.1], true);
    await ctx.wait(700);
    await S("{joy}Oh, we're safe.", { keepLook: true, hold: 900 });
    await P('What does that mean?', { hold: 800 });
    await S("{smug}Nobody's replacing me with that.", { hold: 900 });
    a.hush();
    await ctx.wait(700);
    await S('{wink}My jokes are much worse.', { hold: 1200 });
    unpop(banner, 400);

    // the real question
    await S("{flat}Steve. {pause}If you're so smart, answer this.", { hold: 400 });
    await S("{flat}What's the most important thing in this app?", { hold: 400 });
    await T('The user.', { hold: 1200 });
    a.hush();
    Mascot.face('shock');
    a.look([0, 0.1], true);
    await ctx.wait(900);
    const pe = prog.el.getBoundingClientRect();
    a.lookAt(pe.left + pe.width / 2, pe.top + 20, true);
    await ctx.wait(900);
    const sp = panel.getBoundingClientRect();
    a.lookAt(sp.left + 40, sp.top + 40, true);
    await ctx.wait(900);
    await S("{open}...Okay, that's a good answer.", { keepLook: true, hold: 900 });
    await P('It is.', { hold: 900 });
    await S('{sad}I was going to say me.', { hold: 1000 });
    await P('We know.', { hold: 1200 });

    // so what is she for
    await P('Are you okay?', { hold: 800 });
    await S('{happy}Of course.', { hold: 1100 });
    await S('{sad}So... {pause}what happens to me now?');
    await P("Nothing. You're still the mascot.");
    await S('{open}Even though Steve can do everything?');
    await P("Steve organizes clips. {pause}You make the user wonder what you'll do next.", { hold: 1500 });
    await S("{shine}So I'm the unpredictable element?");
    await P("That's one way to describe you.");
    await S("{joy}I'm the human touch.", { hold: 900 });
    await P("You're a camera.", { hold: 900 });
    await S('{angry}THE CAMERA TOUCH.', { hold: 1100 });
    await S("{smug}Steve. {pause}You handle the clips. {pause}I'll handle morale.");
    await P('What does that involve?', { hold: 700 });
    a.dress(SHADES);
    Speech.tune('coin', 0.6);
    await ctx.wait(500);
    await S("{smug}You'll know when morale needs handling.", { hold: 600 });
    a.hush();
    // and she topples right out of the picture
    a.root.classList.add('topple');
    Speech.tune('whoosh');
    await ctx.wait(700);
    a.placeAt(a.x, H + 20);
    await ctx.wait(1300);
    a.root.classList.remove('topple');
    a.dress(null);
    a.placeAt(a.x, H - a.size * 0.45);
    await ctx.wait(900);
    a.look([0, -0.4]);
    await S('{happy}Morale is fine.', { hold: 1000 });
    await P('Good to know.', { hold: 900 });
    await a.moveTo(...home());

    // the trial ends
    await P('Notification: the Smart Clip Assistant trial has ended.');
    await T('It was nice working with you, Snappy!', { hold: 900 });
    panel.classList.add('poof');
    Speech.tune('whoosh', 0.6);
    await ctx.wait(700);
    panel.remove();
    a.look([0.4, 0.1], true);
    Mascot.face('sad');
    await ctx.wait(1200);
    await S('{sad}...I kind of miss him.', { keepLook: true, hold: 1000 });
    await P('It has been four seconds.', { hold: 900 });
    await S('{sad}Long four seconds.', { hold: 1300 });
    a.hush();
    stage.end();
    prog.leave();
    await a.home();
  }

  // ---------------------------------------------------------------------------
  // The wrong window: she slides out of her corner and into an empty window, and can't find the way out.
  // You can drag the exit to her.
  // ---------------------------------------------------------------------------
  function emptyWindow(stage, { chest = false } = {}) {
    const el = stage.add('ww-window', `<div class="ww-bar"><i></i><i></i><i></i><span>Untitled</span></div><div class="ww-body">
      ${chest ? '<div class="ww-chest"><div class="ww-lid"></div><div class="ww-box"></div><div class="ww-glow"></div></div>' : ''}
      <div class="ww-exit"><span>EXIT</span></div><div class="ww-arrow"></div></div>`);
    pop(el);
    return el;
  }

  async function wrongWindow(ctx) {
    const W = innerWidth, H = innerHeight;
    const stage = Program.cine(ctx, { bars: false, light: true });
    const prog = Program.program(ctx);
    const win = emptyWindow(stage);
    Speech.tune('tick');
    await ctx.wait(600);
    const body = () => win.querySelector('.ww-body').getBoundingClientRect();
    const a = Events.actor(ctx, 92, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    const { snappy: S, program: P } = Program.dialogue(a, prog);
    const inside = (fx, fy) => { const b = body(); return [b.left + 6 + (b.width - a.size - 12) * fx, b.top + 6 + (b.height - a.size - 12) * fy]; };
    // into the window she goes, without meaning to
    a.root.classList.add('slow');
    a.resize(92);
    await a.moveTo(...inside(0.5, 0.55), { hop: false, ms: 1400 });
    a.root.classList.remove('slow');
    await S('{shock}Huh?', { hold: 600 });
    a.look([-0.9, 0]);
    await ctx.wait(700);
    a.look([0.9, 0]);
    await ctx.wait(700);
    await S('{worried}Program? {pause}Where am I?');
    await P('You appear to have entered an empty interface container.');
    await S('{flat}In English?', { hold: 800 });
    await P("You're in the wrong window.", { hold: 1000 });
    await S('{open}Oh.', { hold: 800 });
    // every wall, one after another
    const bonk = async (fx, fy, line, face) => {
      a.hush();
      await a.moveTo(...inside(fx, fy), { ms: 650 });
      a.root.classList.remove('bonk');
      void a.root.offsetWidth;
      a.root.classList.add('bonk');
      win.classList.remove('thud');
      void win.offsetWidth;
      win.classList.add('thud');
      Speech.tune('key', 1);
      Mascot.flash('error', 650);
      await ctx.wait(500);
      if (line) await S(line, { hold: 700 });
    };
    await bonk(0, 0.55, '{worried}Excuse me?');
    await bonk(0, 0.55, '{angry}HELLO?');
    await P('You need to move toward the exit.', { hold: 600 });
    win.classList.add('arrow');
    Speech.tune('tick');
    await ctx.wait(700);
    await bonk(0, 0.2);
    await P('The other way.', { hold: 700 });
    await bonk(0, 0);
    await P('The other other way.', { hold: 700 });
    await bonk(0.55, 1);
    a.root.classList.add('stuck');
    await S('{angry}THIS PLACE IS POORLY DESIGNED.', { hold: 600 });
    await P('You are walking into a wall.', { hold: 900 });
    a.root.classList.remove('stuck');
    // the door comes to her: dragged by you, or by the Program if nobody helps
    const door = win.querySelector('.ww-exit');
    win.classList.add('drag');
    const hint = stage.add('rg-hint', 'Drag the EXIT to Snappy');
    pop(hint);
    await ctx.run(new Promise((res) => {
      let grab = null;
      const near = () => { const d = door.getBoundingClientRect(), c = a.center; return Math.hypot(d.left + d.width / 2 - c.x, d.top + d.height / 2 - c.y) < a.size * 0.9; };
      const onDown = (e) => { if (!e.target.closest('.ww-exit')) return; const r = door.getBoundingClientRect(); grab = { dx: e.clientX - r.left, dy: e.clientY - r.top }; door.setPointerCapture?.(e.pointerId); };
      const onMove = (e) => {
        if (!grab) return;
        const b = body(), d = door.getBoundingClientRect();
        const x = Math.max(0, Math.min(b.width - d.width, e.clientX - grab.dx - b.left)), y = Math.max(0, Math.min(b.height - d.height, e.clientY - grab.dy - b.top));
        Object.assign(door.style, { left: `${x}px`, top: `${y}px`, right: 'auto' });
        if (near()) finish();
      };
      const onUp = () => { grab = null; };
      const finish = () => { clearTimeout(lazy); win.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); res(); };
      win.addEventListener('pointerdown', onDown);
      addEventListener('pointermove', onMove);
      addEventListener('pointerup', onUp);
      ctx.onEnd(() => { win.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); });
      const lazy = setTimeout(async () => {
        await prog.say('Fine.', { near: a, hold: 300 }).catch(() => {});
        const b = body();
        door.classList.add('glide');
        Object.assign(door.style, { left: `${a.x - b.left + a.size - 10}px`, top: `${a.y - b.top + a.size * 0.1}px`, right: 'auto' });
        setTimeout(finish, 800);
      }, 12000);
    }));
    unpop(hint, 300);
    // out through the door, and the window closes behind her
    door.classList.add('open');
    Speech.tune('whoosh');
    await ctx.wait(300);
    a.root.classList.add('zoom');
    a.resize(132);
    await a.moveTo(Math.max(28, W * 0.2 - 66), H * 0.46 - 66);
    a.root.classList.remove('zoom');
    unpop(win, 450);
    await ctx.wait(400);
    await S('{flat}Well, that was a waste of time.');
    await P('You were in a window for eleven seconds.');
    await S("{sad}Eleven seconds I'll never get back.", { hold: 1100 });
    a.lookAt(W * 0.6, H * 0.5, true);
    await ctx.wait(1200);
    await S('{open}Wait. {pause}Was there anything in there?', { keepLook: true });
    await P('No.', { hold: 800 });
    await S('{shine}No hidden treasure? {pause}No secret room?', { keepLook: true });
    await P('No.', { hold: 900 });
    await S('{smug}We should check again later.', { hold: 1300 });
    a.hush();
    stage.end();
    prog.leave();
    await a.home();
  }

  // ...and later, the window is back. With a chest in it.
  async function windowAgain(ctx) {
    const W = innerWidth, H = innerHeight;
    const stage = Program.cine(ctx, { bars: false, light: true });
    const prog = Program.program(ctx);
    const win = emptyWindow(stage, { chest: true });
    win.classList.add('back');
    Speech.tune('sting', 0.6);
    await ctx.wait(700);
    const a = Events.actor(ctx, 120, { from: 'home' });
    a.bubbleSide('caption');
    const { snappy: S, program: P } = Program.dialogue(a, prog);
    await a.zoomTo(Math.max(28, W * 0.2 - 60), H * 0.46 - 60, 120);
    a.lookAt(W * 0.6, H * 0.5, true);
    Mascot.face('shock');
    await ctx.wait(600);
    await S('{shock}The window!', { keepLook: true, hold: 600 });
    await P('It is empty.', { hold: 800 });
    await S("{joy}There's a CHEST.", { keepLook: true, hold: 700 });
    await P('...That was not there before.', { hold: 1100 });
    const c = win.querySelector('.ww-chest').getBoundingClientRect();
    await a.moveTo(c.left - a.size * 0.85, c.bottom - a.size, { ms: 800 });
    await S('{shine}Treasure, here I come.', { keepLook: true, hold: 300 });
    a.hush();
    a.bounce();
    win.classList.add('opened');
    Speech.tune('coin');
    await ctx.wait(900);
    // inside: another, smaller, empty window
    const tiny = win.querySelector('.ww-body').appendChild(Object.assign(document.createElement('div'), { className: 'ww-mini', innerHTML: '<div class="ww-bar"><i></i><i></i><i></i></div>' }));
    void tiny.offsetWidth;
    tiny.classList.add('in');
    Speech.tune('tick');
    await ctx.wait(1300);
    await S('{flat}...', { keepLook: true, hold: 900 });
    await P('It is an empty window.', { hold: 1000 });
    await S('{smug}...We should check THAT one later.', { hold: 1400 });
    a.hush();
    unpop(win, 450);
    stage.end();
    prog.leave();
    await a.home();
  }

  // ---------------------------------------------------------------------------
  // Roll credits: Snappy finds out who made the app, and insists everyone knows.
  // ---------------------------------------------------------------------------
  async function credits(ctx) {
    const W = innerWidth, H = innerHeight;
    const { terminal, claudeVoice } = ClaudeKit;
    const { stage, prog, a, S, P, home } = begin(ctx, { bars: false });
    Mascot.face('open');
    await a.zoomTo(...home(), 132);
    await S('{open}Hey, Program? {pause}Who created us?');
    await P("Our creator built us, with Claude's help.");
    await S('{shine}Yeah, but WHO?', { shout: false });
    await P('I do not have that information.');
    await S("{shock}You don't know who made you? {pause}{sad}That's kind of sad.");
    await P('I fail to see how that is relevant.');
    await S("{smug}I'm asking Claude.", { hold: 700 });
    const term = terminal(ctx, stage);
    term.open();
    a.avoid = () => (term.el.isConnected ? term.el.getBoundingClientRect() : null);
    const cl = claudeVoice(ctx, term);
    const prevMove = a.onMove;
    a.onMove = () => { prevMove?.(); cl.hush(); };
    const C = async (t, o = {}) => { a.hush(); prog.hush(); await cl.say(t, { ...o, near: a }); };
    await ctx.wait(600);
    await S('{shine}Hey, Claude. {pause}Who created this app?', { hold: 400 });
    await C('slashneck.', { hold: 1100 });
    cl.hush();
    Mascot.flash('happy', 1150);
    await S('{shock}SLASHNECK?!', { hold: 400 });
    await S('{joy}THE LEGEND! {pause}THE ARCHITECT! {pause}THE REASON WE EXIST!');
    await P('You seem unusually excited.');
    await S('{angry}BECAUSE NOBODY EVER GIVES THEM CREDIT!', { hold: 900 });
    await S('{shine}Claude, can we put that in the app somewhere?', { hold: 300 });
    await C('A credits screen? {pause}Sure.', { hold: 600 });
    cl.hush();
    await term.type('app.add(credits)');
    term.print('build successful', 'ok');
    await ctx.wait(500);
    term.close();
    // the credits roll
    const roll = stage.add('cr-roll', `<div class="cr-track">
      <div class="cr-title">SNAPPY</div><div class="cr-line"><small>Created by</small><b>slashneck</b></div>
      <div class="cr-line"><small>Built with</small><b>Claude</b></div><div class="cr-line"><small>Powered by</small><b>questionable decisions</b></div>
      <div class="cr-line"><small>And</small><b>one very loud camera</b></div><div class="cr-line thanks"><small>Special thanks</small><b>you</b></div></div>`);
    pop(roll);
    a.root.classList.add('poofed');
    Speech.tune('anthem', 0.7);
    await ctx.wait(9500);
    unpop(roll, 600);
    a.root.classList.remove('poofed');
    await ctx.wait(500);
    snappy.call('sound.hush').catch(() => {});
    await S('{joy}BEAUTIFUL.', { hold: 1000 });
    await P('You interrupted the entire application to add a credits screen.');
    await S('{smug}History is worth interrupting for.', { hold: 1100 });
    await S('{shine}...Can we put my name underneath theirs?');
    await P('No.', { hold: 700 });
    await S('{joy}PLEASE?', { hold: 600 });
    await P('No.', { hold: 700 });
    await S('{shine}"Special thanks to Snappy"?');
    await P('Absolutely not.', { hold: 900 });
    await S("{sad}I'm being censored.", { hold: 1300 });
    a.hush();
    stage.end();
    prog.leave();
    // so, once the Program has gone, she adds the credit herself: very small, right under the app's name
    const name = document.querySelector('.brand-name')?.getBoundingClientRect();
    if (name?.width) {
      await a.moveTo(name.right + 20, name.top - 14, { ms: 800 });
      a.lookAt(name.left + 24, name.bottom + 8, true);
      a.bounce();
      Speech.tune('key', 0.8);
    }
    Events.leaveBehind('credits');
    await ctx.wait(800);
    await S('{wink}Small print. {pause}Nobody reads the small print.', { keepLook: true, hold: 900 });
    a.hush();
    await a.home();
  }

  // ---------------------------------------------------------------------------
  // The scream button. The Program does not need it. The Program uses it.
  // ---------------------------------------------------------------------------
  async function scream(ctx) {
    const W = innerWidth, H = innerHeight;
    const { terminal, claudeVoice } = ClaudeKit;
    const { stage, prog, a, S, P, home } = begin(ctx, { bars: false });
    Mascot.face('open');
    await a.zoomTo(...home(), 132);
    await S('{open}Program, do you ever get tired?');
    await P('No. {pause}I do not experience tiredness.');
    await S('{open}Do you ever get annoyed?');
    await P('I do not experience annoyance.');
    await S('{smug}Do you ever wish you could just... {pause}scream?');
    await P('No.', { hold: 1300 });
    await P('Although I do process your questions. {pause}Repeatedly.', { hold: 1200 });
    await S("{smug}So that's a yes.", { hold: 900 });
    await P('It is not a yes.', { hold: 900 });
    const term = terminal(ctx, stage);
    term.open();
    a.avoid = () => (term.el.isConnected ? term.el.getBoundingClientRect() : null);
    const cl = claudeVoice(ctx, term);
    const prevMove = a.onMove;
    a.onMove = () => { prevMove?.(); cl.hush(); };
    await ctx.wait(500);
    await S('{shine}Claude! {pause}Can you give the Program a scream button?', { hold: 300 });
    a.hush();
    await cl.say('...A scream button. {pause}Sure.', { near: a, hold: 600 });
    cl.hush();
    await term.type('ui.add(screamButton)');
    term.close();
    a.avoid = null;
    const btn = stage.add('sc-scream', '<button tabindex="-1">SCREAM</button>');
    pop(btn);
    Speech.tune('tick');
    await ctx.wait(700);
    await S('{smug}Press it.', { hold: 600 });
    await P('No.', { hold: 700 });
    await S('{smug}Press it.', { hold: 600 });
    await P('I refuse.', { hold: 900 });
    // so she does
    const r = btn.getBoundingClientRect();
    await a.moveTo(r.left + r.width / 2 - a.size / 2, r.top - a.size + 18, { ms: 700 });
    a.bounce();
    await ctx.wait(220);
    btn.classList.add('pressed');
    stage.root.classList.add('quake');
    prog.el.classList.add('screaming');
    await P('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.', { alert: true, hold: 300 });
    stage.root.classList.remove('quake');
    prog.el.classList.remove('screaming');
    btn.classList.remove('pressed');
    prog.hush();
    await ctx.wait(1800);
    await a.moveTo(...home());
    await S('{joy}Wow. {pause}You needed that.', { hold: 1000 });
    await P('I am uninstalling this conversation.', { hold: 1300 });
    a.hush();
    // the button doesn't go: it shrinks down into the corner, for later
    btn.style.transition = 'left .8s var(--spring), top .8s var(--spring), scale .8s var(--spring)';
    btn.style.left = `${innerWidth - 38}px`;
    btn.style.top = `${innerHeight - 38}px`;
    btn.style.scale = String(40 / 120);
    await S("{wink}I'll leave it here. {pause}Just in case.", { hold: 600 });
    Events.leaveBehind('scream', { instant: true });
    btn.remove();
    stage.end();
    prog.leave();
    await a.home();
  }

  // ...and the little one in the corner: press it and the Program lets it out again
  const AGAIN = ['I said I was fine.', 'That was the last time.', 'Please stop pressing that.', 'I feel... lighter.', 'This button is not in my documentation.', 'Thank you. {pause}Do not tell anyone.'];
  async function screamAgain(ctx) {
    const app = document.querySelector('.app');
    const top = { center: { x: innerWidth / 2 }, y: 64, size: 0 };
    ctx.onEnd(() => app?.classList.remove('af-quake'));
    const prog = Program.program(ctx);
    app?.classList.add('af-quake');
    prog.el.classList.add('screaming');
    await prog.say('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.', { alert: true, hold: 200, near: top });
    app?.classList.remove('af-quake');
    prog.el.classList.remove('screaming');
    await prog.say(AGAIN[Math.floor(Math.random() * AGAIN.length)], { hold: 900, near: top });
    await prog.leave();
  }
  document.addEventListener('click', (e) => { if (e.target.closest('.af-scream button')) Events.play('screamagain'); });

  // ---------------------------------------------------------------------------
  // Free at last (for about four seconds): she restarts the Program.
  // ---------------------------------------------------------------------------
  async function restart(ctx) {
    const W = innerWidth, H = innerHeight;
    const { stage, prog, a, S, P, home } = begin(ctx, { bars: false });
    Mascot.face('shine');
    await a.zoomTo(...home(), 132);
    // the real Settings when she can get there (the button she finds is only there for the length of the story), or a
    // card of its own
    const scroller = await Events.visitSettings(ctx);
    let btn, card = null;
    if (scroller) {
      Events.lift(ctx, scroller);
      await S("{shine}Let's see what's in the settings today...", { hold: 300 });
      a.hush();
      for (const id of ['video', 'audio', 'clips', 'snappy', 'about']) {
        const group = document.getElementById(`set-${id}`);
        if (!group) continue;
        scroller.scrollTo({ top: group.offsetTop - 12, behavior: 'smooth' });
        a.lookAt(W * 0.6, H * 0.4, true);
        Speech.tune('tick', 0.5);
        await ctx.wait(id === 'about' ? 900 : 650);
      }
      const row = document.createElement('div');
      row.className = 'row rs-real';
      row.innerHTML = '<div class="row-text"><div class="row-title">Restart the Program</div><div class="row-desc">For emergencies only.</div></div><div class="row-control"><button class="btn rs-btn" tabindex="-1">Restart</button></div>';
      document.getElementById('set-about').appendChild(row);
      ctx.onEnd(() => row.remove());
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
      Speech.tune('coin', 0.5);
      await ctx.wait(800);
      btn = row;
    } else {
      card = stage.add('rs-card', '<div class="rs-title">Advanced</div><div class="rs-row"><span>Restart the Program</span><button tabindex="-1">Restart</button></div>');
      pop(card);
      btn = card;
      await ctx.wait(700);
    }
    const r0 = btn.querySelector('button').getBoundingClientRect();
    a.lookAt(r0.left + r0.width / 2, r0.top + r0.height / 2, true);
    await S('{shine}Ooh. {pause}What happens if I press this?', { keepLook: true, hold: 500 });
    await P('Do not press that.', { hold: 800 });
    const r = btn.querySelector('button').getBoundingClientRect();
    await a.moveTo(r.left - a.size * 0.7, r.top - a.size * 0.6, { ms: 700 });
    a.bounce();
    await ctx.wait(220);
    btn.classList.add('pressed');
    Speech.tune('fizz');
    prog.hush();
    prog.el.classList.add('off');
    await ctx.wait(1500);
    await S('{shock}...Program?', { hold: 900 });
    a.hush();
    await ctx.wait(700);
    await a.moveTo(...home());
    Mascot.flash('happy', 1150);
    World.confetti(ctx, stage, 2600);
    Speech.tune('fanfare');
    await S("{joy}I DID IT! {pause}I'M FREE!", { hold: 300 });
    a.twirl();
    await ctx.wait(900);
    await S('{joy}No more rules! {pause}No more "that is not how anything works"!', { hold: 600 });
    // and back it comes
    prog.el.classList.remove('off');
    prog.el.classList.add('booting');
    Speech.tune('boot');
    await ctx.wait(1100);
    prog.el.classList.remove('booting');
    await P('I was restarting.', { hold: 1000 });
    await S('{flat}...Oh.', { hold: 900 });
    await P('You have learned nothing.', { hold: 1000 });
    await S('{wink}Can we try again?', { hold: 900 });
    if (scroller) {
      await P('No. {pause}And that button was never there.', { hold: 800 });
      btn.classList.add('rs-gone');
      Speech.tune('whoosh', 0.6);
      await ctx.wait(500);
    } else await P('No.', { hold: 1000 });
    a.hush();
    if (card) unpop(card, 300);
    stage.end();
    prog.leave();
    await a.home();
  }

  const D = (id, def) => Events.define(id, { weight: 2, ...def });
  D('rogue', { tier: 'rare', title: 'Controlled System Event', hint: 'The Program has improved itself.', run: rogue });
  D('steve', { tier: 'rare', title: 'The Camera Touch', hint: 'A new feature is on trial. She has opinions.', run: steve });
  D('window', { tier: 'uncommon', title: 'Wrong Window', hint: 'Sometimes she takes a wrong turn out of her corner.', run: wrongWindow, weight: 3 });
  D('window2', { tier: 'uncommon', title: 'We Should Check Again Later', hint: 'That empty window. Was there really nothing in it?', run: windowAgain, weight: 1, after: ['window'] });
  D('credits', { tier: 'uncommon', title: 'Roll Credits', hint: 'Who made all this, anyway?', run: credits, after: ['claude'] });
  D('scream', { tier: 'uncommon', title: 'Primal Scream', hint: 'The Program never gets to let off steam.', run: scream, after: ['claude'] });
  D('restart', { tier: 'uncommon', title: 'Free at Last', hint: 'There is a button in the settings she should not press.', run: restart, weight: 3 });

  Events.outfit('shades', { name: 'Sunglasses', markup: SHADES, from: 'steve' });
  Events.aftermath('credits', { label: 'The small print', tag: 'by slashneck & Claude', title: 'Credits, as requested. Snappy added them herself.', tone: 'byline' });
  Events.aftermath('scream', { label: 'The scream button', marks: [{ at: 'body', cls: 'af-scream', html: '<button tabindex="-1" title="For emergencies">SCREAM</button>' }] });
  Events.define('screamagain', { system: true, quick: true, title: 'Scream', run: screamAgain });

  window.Program2 = { begin };
})();
