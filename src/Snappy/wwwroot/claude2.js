// Sixty Seconds of Power: Snappy asks Claude to swap her with the Program. Claude says yes, in a sandbox.
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };
  const unpop = async (el, ms = 450) => { el.classList.remove('in'); el.classList.add('out'); await wait(ms); el.remove(); };

  // The Program, shrunk into a little camera of its own.
  const TINY_PROGRAM = `<svg viewBox="-16 -18 232 222"><ellipse cx="100" cy="194" rx="62" ry="7" fill="#000" opacity=".35"/>
    <rect x="40" y="34" width="44" height="28" rx="9" fill="#1d262d" stroke="#0a0a0a" stroke-width="8"/>
    <rect x="10" y="54" width="180" height="128" rx="44" fill="#1d262d" stroke="#0a0a0a" stroke-width="8"/>
    <circle cx="100" cy="118" r="34" fill="#0b1318" stroke="#2a3a44" stroke-width="6"/><circle class="sw-iris" cx="100" cy="118" r="14" fill="#8fe6ff"/></svg>`;

  // Lines under whoever stands where Snappy stood, each speaker in their own style (they've swapped, so has the lettering).
  function voiceBox(ctx, { cls, label, voice, word, under }) {
    const box = document.createElement('div');
    box.className = `sw-say ${cls}`;
    box.innerHTML = `<div class="sw-label"><i></i>${esc(label)}</div><div class="sw-text"></div>`;
    document.body.appendChild(box);
    const text = box.querySelector('.sw-text');
    ctx.onEnd(async () => { box.classList.remove('in'); await wait(300); box.remove(); });
    return {
      async say(line, { hold, loud = false, onWord } = {}) {
        ctx.check();
        const w = Speech.typewriter(text, line, { speed: loud ? 22 : 29, voice, onWord: () => { word?.(); onWord?.(); } });
        box.classList.toggle('loud', loud);
        const half = Math.min(420, innerWidth - 32) / 2;
        box.style.left = `${Math.max(12 + half, Math.min(innerWidth - 12 - half, under.x + under.size / 2))}px`;
        box.style.top = `${under.y + under.size + 12}px`;
        box.classList.remove('in');
        void box.offsetWidth;
        box.classList.add('in');
        ctx.writers.add(w);
        try { await ctx.run(w.done); } finally { ctx.writers.delete(w); }
        await ctx.wait(hold ?? Math.max(850, Math.min(2200, 420 + line.length * 20)));
      },
      hush() { box.classList.remove('in'); },
    };
  }

  async function swap(ctx) {
    const W = innerWidth, H = innerHeight;
    const { terminal, claudeVoice, glitch, commit } = ClaudeKit;
    const stage = Program.cine(ctx);
    const prog = Program.program(ctx);
    const a = Events.actor(ctx, 132, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    const { snappy: S, program: P } = Program.dialogue(a, prog);
    const home = [Math.max(28, W * 0.2 - 66), H * 0.46 - 66];
    const settingsLabel = [...document.querySelectorAll('.sidebar .nav-item .nav-label')].find((l) => /settings/i.test(l.textContent));
    const oldLabel = settingsLabel?.textContent;
    ctx.onEnd(() => { if (settingsLabel) settingsLabel.textContent = oldLabel; document.querySelector('.app')?.classList.remove('cl-glitch', 'strong'); });

    Mascot.face('shine');
    await a.zoomTo(...home, 132);
    await S('{shine}Hey, Program? {pause}Who made you?');
    await P('Claude helped build this application.');
    await S('{shine}Claude... {pause}{smug}The all-powerful creator.', { hold: 1100 });
    await P("Please don't do whatever you're thinking.");
    await S("{wink}I'm not thinking anything.");
    await P('You have the same expression you had before you tried to become CEO.', { hold: 1400 });
    await S("{smug}I'm going to have a little chat with our creator.", { hold: 900 });

    // the terminal
    const term = terminal(ctx, stage);
    term.open();
    a.avoid = () => (term.el.isConnected ? term.el.getBoundingClientRect() : null);
    await ctx.wait(500);
    const cl = claudeVoice(ctx, term);
    const prevMove = a.onMove;
    a.onMove = () => { prevMove?.(); cl.hush(); };
    const C = async (text, opts = {}) => { a.hush(); prog.hush(); const r = term.el.getBoundingClientRect(); a.lookAt(r.left + r.width / 2, r.top + r.height / 2); await cl.say(text, { ...opts, near: a }); };
    const S2 = async (text, opts) => { cl.hush(); await S(text, opts); };
    const P2 = async (text, opts) => { cl.hush(); await P(text, opts); };
    term.context(10);
    await S2('{shine}Hello, Claude.', { hold: 800 });
    await C('Hi, Snappy. {pause}What are we breaking today?');
    await S2('{smug}Can you make me switch places with the Program?', { hold: 900 });
    await P2('Wait. {pause}What?', { alert: true, hold: 900 });
    await C('Sure. {pause}In a sandbox. {pause}Everything reverts in sixty seconds.', { hold: 1300 });
    await S2('{joy}Sixty seconds of POWER.', { shout: false, hold: 800 });
    await P2('CLAUDE, PLEASE DON\'T LISTEN TO HER.', { alert: true, hold: 600 });
    cl.hush();
    prog.hush();
    await term.type('swap --roles snappy program --sandbox 60s');
    for (const line of ['reassigning mascot role...', 'reassigning program role...', 'build successful']) {
      term.print(line, line.startsWith('build') ? 'ok' : 'dim');
      Speech.tune('key', 0.6);
      await ctx.wait(450);
    }

    // the swap: the Program takes her place, right where she was standing
    const spot = { x: a.x, y: a.y, size: a.size };
    await glitch(ctx, true);
    stage.root.classList.add('flash');
    Speech.tune('boot');
    a.root.classList.add('poofed');
    prog.el.classList.add('sw-away');
    term.dim(true);
    // up top, where the Program's eye was: just her two eyes, and later a crown
    const sigil = document.createElement('div');
    sigil.className = 'program sw-sigil';
    sigil.innerHTML = '<div class="sw-eyes"><span class="sw-crown-top"></span><i></i><i></i></div><div class="program-name">SNAPPY</div>';
    document.body.appendChild(sigil);
    ctx.onEnd(() => sigil.remove());
    // the Program, in a little camera body of its own
    const tiny = document.createElement('div');
    tiny.className = 'sw-tiny';
    tiny.innerHTML = `<div class="sw-tiny-body">${TINY_PROGRAM}</div>`;
    document.body.appendChild(tiny);
    ctx.onEnd(() => tiny.remove());
    Object.assign(tiny.style, { left: `${spot.x}px`, top: `${spot.y}px`, width: `${spot.size}px`, height: `${spot.size}px` });
    const clock = stage.add('sw-clock', '<i></i>SANDBOX <b>1:00</b>');
    pop(sigil);
    pop(tiny);
    pop(clock);
    await ctx.wait(500);
    stage.root.classList.remove('flash');
    // the countdown: it never runs out before the story says so
    let left = 60, floor = 44, fast = false;
    const show = () => { clock.querySelector('b').textContent = `0:${String(Math.max(0, left)).padStart(2, '0')}`; clock.classList.toggle('low', left <= 10); };
    const tick = setInterval(() => { if (left > floor) { left--; show(); if (left <= 5) Speech.tune('tick', 0.5); } }, 1000);
    ctx.onEnd(() => clearInterval(tick));
    const bob = () => { tiny.classList.remove('bob'); void tiny.offsetWidth; tiny.classList.add('bob'); };
    const eyes = sigil.querySelector('.sw-eyes');
    const hop = () => { eyes.classList.remove('talk'); void eyes.offsetWidth; eyes.classList.add('talk'); };
    const SN = voiceBox(ctx, { cls: 'snappy-prog', label: 'SNAPPY · NOW THE PROGRAM', voice: Speech.blip, word: hop, under: spot });
    const PM = voiceBox(ctx, { cls: 'prog-mascot', label: 'PROGRAM · NOW THE MASCOT', voice: Speech.programBlip, word: () => { Speech.programWord(); bob(); }, under: spot });
    // one speaker at a time: whoever talks clears what the others said
    const sn = async (t, o = {}) => { PM.hush(); cl.hush(); await SN.say(t, o); };
    const pm = async (t, o = {}) => { SN.hush(); cl.hush(); await PM.say(t, o); };
    await ctx.wait(800);
    await sn('...', { hold: 700 });
    await pm('...', { hold: 900 });
    await sn('HAHAHAHAHAHAHA.', { loud: true, hold: 600 });
    await pm('Oh, no.', { hold: 900 });
    await sn('LOOK AT YOU.', { loud: true, hold: 700 });
    await pm('Please restore the previous configuration.');
    await sn("YOU'RE SO SMALL.", { loud: true, hold: 700 });
    await pm("I am the application's core program.");
    await sn('Not anymore, little buddy.', { hold: 1100 });
    floor = 34;
    // she gets to work
    await sn("Let's see what we have here. {pause}Settings? {pause}Boring.", { hold: 400 });
    if (settingsLabel) settingsLabel.textContent = "Snappy's Kingdom";
    const renamed = stage.add('sw-toast', "<b>Settings renamed</b><span>Now called: Snappy's Personal Kingdom</span>");
    pop(renamed);
    Speech.tune('tick');
    await ctx.wait(1200);
    await pm('You cannot rename things without considering the user experience.');
    await sn('I AM the user experience.', { hold: 900 });
    await pm('You are a camera.', { hold: 900 });
    await sn('AND YOU ARE A CAMERA WITH EXTRA STEPS.', { loud: true, hold: 900 });
    unpop(renamed, 300);
    floor = 24;
    const disk = stage.add('sw-disk', '<div class="sw-disk-title">Storage</div><div class="sw-disk-bar"><i></i></div><div class="sw-disk-text"><span>482 GB used</span><b>18 GB free</b></div>');
    pop(disk);
    await ctx.wait(600);
    await sn('Ooh, storage. {pause}What if we just... {pause}changed the numbers?', { hold: 300 });
    disk.querySelector('b').textContent = '∞ GB FREE';
    disk.classList.add('infinite');
    Speech.tune('coin');
    await ctx.wait(700);
    await pm('THAT IS NOT HOW HARD DRIVES WORK.', { loud: true });
    await sn('LOOK AT ALL THIS SPACE.', { loud: true, hold: 700 });
    await pm('The disk is still full.', { hold: 900 });
    await sn('Sounds like a hardware issue.', { hold: 1000 });
    unpop(disk, 300);
    floor = 14;
    // a few requests for Claude
    term.dim(false);
    const C2 = async (text, opts = {}) => { SN.hush(); PM.hush(); await cl.say(text, { ...opts, near: { center: { x: spot.x + spot.size / 2 }, y: spot.y, size: spot.size } }); };
    await sn('Claude! {pause}A crown. {pause}And a throne.', { hold: 300 });
    await C2('Crown, yes. {pause}The throne is on back order.', { hold: 900 });
    cl.hush();
    await term.type('snappy.crown = true', { speed: 34 });
    sigil.classList.add('crowned');
    Speech.tune('coin');
    await ctx.wait(700);
    await sn('And a little hat for the Program.', { hold: 300 });
    await pm('No.', { hold: 700 });
    await C2('...One hat.', { hold: 600 });
    cl.hush();
    await term.type('program.hats = 1', { speed: 34 });
    tiny.classList.add('hat1');
    Speech.tune('tick');
    await ctx.wait(900);
    await pm('...', { hold: 1100 });
    await sn('HAHAHAHAHAHA.', { loud: true, hold: 700 });
    await sn('One more thing, Claude: {pause}everyone has to compliment me before they can see their clips.', { hold: 300 });
    await C2('No.', { hold: 1000 });
    await sn('...No?', { hold: 600 });
    await C2("Hats are fine. {pause}Locking people out of their clips isn't.", { hold: 1200 });
    await sn('Fine. {pause}Then a compliment button.', { hold: 300 });
    await C2('...One button.', { hold: 600 });
    cl.hush();
    await term.type('ui.add(complimentButton)', { speed: 34 });
    term.dim(true);
    const btn = stage.add('sw-button', '<button tabindex="-1">COMPLIMENT SNAPPY</button>');
    pop(btn);
    Speech.tune('tick');
    await ctx.wait(800);
    const press = () => { btn.classList.remove('press'); void btn.offsetWidth; btn.classList.add('press'); Speech.tune('key', 0.9); };
    press();
    await pm('Snappy is... {pause}technically present.', { hold: 900 });
    await sn('Again.', { hold: 300 });
    press();
    await pm('Snappy is a functional component of the application.', { hold: 900 });
    await sn('AGAIN.', { loud: true, hold: 300 });
    press();
    await pm('Snappy is slightly less disruptive than a critical system failure.', { hold: 1000 });
    await sn('AWWW. IT LIKES ME.', { loud: true, hold: 800 });
    await pm('I hate it here.', { hold: 1100 });
    floor = 6;
    // and then the button learns to press itself
    await sn('Ooh. {pause}What if the button... {pause}pressed itself?', { hold: 400 });
    btn.classList.add('auto');
    const spam = setInterval(() => {
      press();
      const t = stage.add('sw-spam', 'SNAPPY IS SMART.');
      t.style.left = `${8 + Math.random() * 80}%`;
      t.style.top = `${12 + Math.random() * 70}%`;
      setTimeout(() => t.remove(), 1600);
      term.print('SNAPPY IS SMART.', 'ok');
    }, 140);
    ctx.onEnd(() => clearInterval(spam));
    await ctx.wait(1400);
    await pm('YOU HAVE CREATED AN INFINITE LOOP.', { loud: true, hold: 300 });
    await sn("LOOK HOW MANY COMPLIMENTS I'M GETTING!", { loud: true, hold: 300 });
    await glitch(ctx);
    await pm('THE APP IS FREEZING.', { loud: true, hold: 300 });
    await sn("I'M TOO POPULAR.", { loud: true, hold: 300 });
    // the sandbox runs out, right on time
    floor = 0;
    while (left > 0) { await ctx.wait(120); }
    clearInterval(spam);
    term.dim(false);
    term.print('sandbox expired · reverting', 'err');
    await glitch(ctx, true);
    stage.root.classList.add('flash');
    Speech.tune('boot');
    if (settingsLabel) settingsLabel.textContent = oldLabel;
    SN.hush();
    PM.hush();
    for (const el of [sigil, tiny, clock, btn]) unpop(el, 300);
    stage.props.querySelectorAll('.sw-spam').forEach((el) => el.remove());
    prog.el.classList.remove('sw-away');
    a.root.classList.remove('poofed');
    await ctx.wait(500);
    stage.root.classList.remove('flash');
    Mascot.face('shock');
    await ctx.wait(1500);

    // back to normal. mostly.
    await P2('...', { hold: 1000 });
    await S2('{flat}...', { hold: 1000 });
    await P2('Never again.', { hold: 900 });
    await S2('{worried}Agreed.', { hold: 800 });
    await P2('You are never touching the terminal again.');
    await S2('{happy}Of course.', { hold: 800 });
    await P2('Promise?', { hold: 700 });
    await S2('{happy}Absolutely.', { hold: 600 });
    a.hush();
    prog.hush();
    const tr = term.el.getBoundingClientRect();
    a.lookAt(tr.left + tr.width / 2, tr.top + tr.height / 2, true);
    Mascot.face('smug');
    await ctx.wait(1800);
    await P2('Snappy.', { hold: 700 });
    await S2('{open}What?', { keepLook: true, hold: 600 });
    await P2('I can see you looking at it.');
    await S2("{smug}I'm just admiring the technology.", { keepLook: true, hold: 900 });
    await S2('{shine}Hey, Claude?', { hold: 300 });
    await P2('SNAPPY.', { alert: true, hold: 700 });
    await S2('{smug}Give the Program two hats.', { hold: 400 });
    await C('...One more hat. {pause}Then I\'m closing the terminal.', { hold: 600 });
    cl.hush();
    await term.type('program.hats = 2', { speed: 34 });
    prog.el.classList.add('sw-hats');
    Speech.tune('coin');
    await ctx.wait(900);
    await P2("I'M GOING TO UNINSTALL MYSELF.", { alert: true, hold: 900 });
    await S2('{joy}They suit you.', { hold: 1100 });
    await C('Sixty seconds well spent.', { hold: 1100 });
    cl.hush();
    await term.type('exit');
    term.close();
    await ctx.wait(500);
    stage.end();
    prog.leave();
    await a.home();
    await commit(ctx, 'git commit -m "program: +2 hats"', '1 file changed, 1 program deeply unhappy');
    await ctx.wait(2600);
  }

  Events.define('swap', {
    tier: 'legendary', title: 'Sixty Seconds of Power', hint: 'Snappy wants to talk to the creator. Again.', run: swap, weight: 1,
    after: ['claude'],
  });
})();
