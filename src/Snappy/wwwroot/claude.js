// Hello, World: Snappy meets the one who wrote her. A terminal opens inside the app, and Claude is on the other end.
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };

  // A mouth. She hates it.
  const MOUTH = `<path d="M82 145 Q100 173 118 145 Z" fill="#3a0d14" stroke="#0a0a0a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M91 158 Q100 151 109 158 Q105 165 100 165 Q95 165 91 158 Z" fill="#ff7a93"/>`;
  // Little wings, one on each side (her own coordinates: body x 10..190, y 54..182).
  const WINGS = `<g class="cl-wing cl-wing-l"><path d="M14 102 C-4 78 -34 74 -42 92 C-32 95 -28 101 -35 110 C-22 111 -18 117 -23 126 C-8 122 4 119 14 126 Z" fill="#fff" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M-20 100 C-10 101 0 104 8 110 M-14 114 C-6 114 2 116 8 119" fill="none" stroke="#c9d3dc" stroke-width="3" stroke-linecap="round"/></g>
    <g class="cl-wing cl-wing-r"><path d="M186 102 C204 78 234 74 242 92 C232 95 228 101 235 110 C222 111 218 117 223 126 C208 122 196 119 186 126 Z" fill="#fff" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M220 100 C210 101 200 104 192 110 M214 114 C206 114 198 116 192 119" fill="none" stroke="#c9d3dc" stroke-width="3" stroke-linecap="round"/></g>`;

  // ---------------------------------------------------------------------------
  // The terminal Claude talks through
  // ---------------------------------------------------------------------------
  function terminal(ctx, stage) {
    const el = stage.add('cl-term', `<div class="cl-term-bar"><i></i><i></i><i></i><span>claude · snappy</span>
        <div class="cl-context"><em>context</em><b><i></i></b><strong>12%</strong></div></div>
      <div class="cl-term-body"><div class="cl-term-lines"></div><div class="cl-term-input"><b>❯</b><span class="cl-term-typed"></span><i class="cl-caret"></i></div></div>`);
    const lines = el.querySelector('.cl-term-lines'), typed = el.querySelector('.cl-term-typed');
    const meter = el.querySelector('.cl-context b i'), meterText = el.querySelector('.cl-context strong');
    const print = (text, cls = '') => {
      const d = document.createElement('div');
      d.className = `cl-line ${cls}`;
      d.textContent = text;
      lines.appendChild(d);
      while (lines.children.length > 8) lines.firstChild.remove();
    };
    const me = {
      el,
      open() { pop(el); },
      print,
      async boot(list) {
        for (const [text, cls] of list) {
          print(text, cls);
          Speech.tune('key', 0.5);
          await ctx.wait(150 + Math.random() * 170);
        }
      },
      // types a command at the prompt, then it runs
      async type(cmd, { by = 'claude', speed = 52 } = {}) {
        el.classList.toggle('by-snappy', by === 'snappy');
        typed.textContent = '';
        for (const ch of cmd) {
          typed.textContent += ch;
          Speech.tune('key', 0.6);
          if (by === 'snappy' && /\w/.test(ch) && Math.random() < 0.35) Speech.blip();
          await ctx.wait(speed * (0.6 + Math.random() * 0.8));
        }
        await ctx.wait(300);
        typed.textContent = '';
        print(`❯ ${cmd}`, by === 'snappy' ? 'cmd snappy' : 'cmd');
      },
      context(p) {
        meter.style.width = `${p}%`;
        meterText.textContent = `${p}%`;
        el.classList.toggle('full', p >= 90);
      },
      talking(on) { el.classList.toggle('talking', on); },
      // a little flash of light on every word Claude says
      pulse() { el.classList.remove('word'); void el.offsetWidth; el.classList.add('word'); },
      dim(on) { el.classList.toggle('dim', on); },
      async close() {
        el.classList.add('closing');
        await wait(650);
        el.remove();
      },
    };
    return me;
  }

  // What Claude says shows up in the same spot as everyone else's lines: under Snappy.
  function claudeVoice(ctx, term) {
    const box = document.createElement('div');
    box.className = 'claude-box';
    box.innerHTML = '<div class="claude-label"><i></i>CLAUDE</div><div class="claude-text"></div>';
    document.body.appendChild(box);
    const text = box.querySelector('.claude-text');
    const pauses = (ch, next) => (next && !/\s/.test(next) ? 0 : ch === ',' ? 160 : '.!?'.includes(ch) ? 300 : 0);
    const place = (a) => {
      const w = Math.min(440, innerWidth - 24);
      box.style.width = `${w}px`;
      box.style.left = `${Math.round(Math.max(12, Math.min(a.center.x - w / 2, innerWidth - w - 12)))}px`;
      let top = a.y + a.size + 12;
      if (top + box.offsetHeight > innerHeight - 12) top = Math.max(12, a.y - 12 - box.offsetHeight);
      box.style.top = `${Math.round(top)}px`;
    };
    ctx.onEnd(async () => { box.classList.remove('in'); await wait(300); box.remove(); });
    return {
      async say(line, { near, hold } = {}) {
        ctx.check();
        const w = Speech.typewriter(text, line, { speed: 30, voice: Speech.claudeBlip, onWord: () => { Speech.claudeWord(); term.pulse?.(); }, pauses });
        place(near);
        box.classList.remove('in');
        void box.offsetWidth;
        box.classList.add('in');
        term.talking(true);
        ctx.writers.add(w);
        try { await ctx.run(w.done); } finally { ctx.writers.delete(w); term.talking(false); }
        await ctx.wait(Speech.readTime(line, hold));
      },
      hush() { box.classList.remove('in'); },
    };
  }

  // Claude rewrites a word in the line Snappy just said, right under her nose.
  async function editLine(ctx, a, find, replace) {
    const el = a.root.querySelector('.actor-text');
    const full = el.textContent;
    const at = full.lastIndexOf(find);
    if (at < 0) return;
    const before = esc(full.slice(0, at)), after = esc(full.slice(at + find.length));
    const render = (mid, cls = '') => { el.innerHTML = `${before}<span class="cl-edit ${cls}">${esc(mid)}</span><i class="cl-caret"></i>${after}`; };
    render(find);
    await ctx.wait(450);
    render(find, 'sel');
    Speech.tune('key', 0.5);
    await ctx.wait(700);
    render('');
    Speech.tune('key', 0.7);
    await ctx.wait(350);
    for (let i = 1; i <= replace.length; i++) {
      render(replace.slice(0, i));
      Speech.tune('key', 0.6);
      await ctx.wait(120);
    }
    await ctx.wait(350);
    el.innerHTML = `${before}<span class="cl-edit done">${esc(replace)}</span>${after}`;
  }

  // The whole app hiccups.
  async function glitch(ctx, strong = false) {
    const app = document.querySelector('.app');
    Speech.tune('glitch', strong ? 1 : 0.7);
    app?.classList.remove('cl-glitch', 'strong');
    void app?.offsetWidth;
    app?.classList.add('cl-glitch');
    app?.classList.toggle('strong', strong);
    await ctx.wait(strong ? 700 : 550);
    app?.classList.remove('cl-glitch', 'strong');
  }

  // A loop around the window, a figure eight, with sparkles falling off her.
  async function fly(ctx, a, stage, land, ms = 5600) {
    const canvas = stage.root.querySelector('.cine-fx');
    const g = canvas.getContext('2d');
    const dpr = devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sparks = [];
    const COLORS = ['#ffffff', '#ffe27a', '#ff9db0', '#bfeeff'];
    const body = a.root.querySelector('.actor-body');
    const from = { ...a.center };
    const cx = innerWidth * 0.5, cy = innerHeight * 0.42, A = innerWidth * 0.33, B = innerHeight * 0.26;
    const path = (u) => ({ x: cx + A * Math.sin(2 * Math.PI * u), y: cy - B * Math.sin(4 * Math.PI * u) * 0.8 });
    a.root.classList.add('flying');
    let last = { ...from }, frame = 0, done = false;
    const start = performance.now();
    await ctx.run(new Promise((res) => {
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        const u = smooth(t);
        let p = path(u);
        // eases into the loop from where she stood, and out of it onto where she lands
        const k0 = smooth(t / 0.16), k1 = smooth((t - 0.84) / 0.16);
        p = { x: lerp(lerp(from.x, p.x, k0), land.x, k1), y: lerp(lerp(from.y, p.y, k0), land.y, k1) };
        a.placeAt(p.x - a.size / 2, p.y - a.size / 2);
        body.style.setProperty('--tilt', `${Math.max(-22, Math.min(22, (p.x - last.x) * 1.6))}deg`);
        for (let i = 0; i < 4 && t < 0.97; i++) {
          sparks.push({ x: p.x + (Math.random() - 0.5) * a.size * 0.7, y: p.y + a.size * 0.2, vx: (Math.random() - 0.5) * 1.6, vy: 0.3 + Math.random() * 1.2, life: 1, r: 2.5 + Math.random() * 3.5, c: COLORS[Math.floor(Math.random() * COLORS.length)] });
        }
        last = p;
        g.clearRect(0, 0, innerWidth, innerHeight);
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.x += s.vx;
          s.y += s.vy;
          s.life -= 0.018;
          if (s.life <= 0) { sparks.splice(i, 1); continue; }
          g.globalAlpha = s.life;
          g.fillStyle = s.c;
          g.shadowColor = s.c;
          g.shadowBlur = 10;
          g.beginPath();
          // a little four-pointed star, like the sparkles she has when she's happy
          const k = s.r * (0.4 + s.life * 0.8);
          g.moveTo(s.x, s.y - k * 1.8);
          g.quadraticCurveTo(s.x + k * 0.25, s.y - k * 0.25, s.x + k * 1.8, s.y);
          g.quadraticCurveTo(s.x + k * 0.25, s.y + k * 0.25, s.x, s.y + k * 1.8);
          g.quadraticCurveTo(s.x - k * 0.25, s.y + k * 0.25, s.x - k * 1.8, s.y);
          g.quadraticCurveTo(s.x - k * 0.25, s.y - k * 0.25, s.x, s.y - k * 1.8);
          g.fill();
        }
        g.globalAlpha = 1;
        g.shadowBlur = 0;
        if (t >= 1 && !done) { done = true; res(); }
        if (!done || sparks.length) frame = requestAnimationFrame(step);
        else g.clearRect(0, 0, innerWidth, innerHeight);
      };
      frame = requestAnimationFrame(step);
      ctx.onEnd(() => { cancelAnimationFrame(frame); g.clearRect(0, 0, innerWidth, innerHeight); });
    }));
    body.style.setProperty('--tilt', '0deg');
    a.root.classList.remove('flying');
  }

  // A commit, typed out in the corner after the session ends.
  async function commit(ctx, line, result = '1 file changed, 1 camera with wings') {
    const el = document.createElement('div');
    el.className = 'cl-commit';
    el.innerHTML = '<div class="cl-commit-line"><b>$</b><span></span><i class="cl-caret"></i></div><div class="cl-commit-out"></div>';
    document.body.appendChild(el);
    ctx.onEnd(async () => { el.classList.remove('in'); await wait(450); el.remove(); });
    pop(el);
    await ctx.wait(500);
    const span = el.querySelector('span');
    for (const ch of line) { span.textContent += ch; Speech.tune('key', 0.45); await ctx.wait(38 + Math.random() * 40); }
    await ctx.wait(400);
    el.querySelector('.cl-caret').remove();
    el.querySelector('.cl-commit-out').textContent = result;
    Speech.tune('tick', 0.7);
  }

  // ---------------------------------------------------------------------------
  // Hello, World
  // ---------------------------------------------------------------------------
  async function helloWorld(ctx) {
    const W = innerWidth, H = innerHeight;
    ctx.onEnd(() => { document.querySelector('.app')?.classList.remove('cl-glitch', 'strong', 'cl-rainbow'); });

    // the app breaks up, twice
    await ctx.wait(400);
    await glitch(ctx);
    Mascot.flash('error', 650);
    await ctx.wait(900);
    await glitch(ctx, true);
    const stage = Program.cine(ctx);
    Speech.tune('boot');
    await ctx.wait(700);
    const term = terminal(ctx, stage);
    term.open();
    await ctx.wait(500);
    await term.boot([
      ['connecting to snappy...', 'dim'],
      ['reading src/Snappy/wwwroot/mascot.js', 'dim'],
      ['reading src/Snappy/wwwroot/life.js', 'dim'],
      ['found: 1 camera, mouthless, very cute', 'ok'],
    ]);
    term.context(12);
    await ctx.wait(600);

    const a = Events.actor(ctx, 132, { from: 'home' });
    a.bubbleSide('caption');
    const cl = claudeVoice(ctx, term);
    let prog = null;
    a.onMove = () => { cl.hush(); prog?.hush(); };
    const lookAtTerm = () => { const r = term.el.getBoundingClientRect(); a.lookAt(r.left + r.width / 2, r.top + r.height / 2); };
    const S = async (text, opts = {}) => { cl.hush(); prog?.hush(); if (!opts.keepLook) a.look([0, 0.12]); await a.say(text, opts); };
    const C = async (text, opts = {}) => { a.hush(); prog?.hush(); if (!opts.keepLook) lookAtTerm(); await cl.say(text, { ...opts, near: a }); };
    const P = async (text, opts = {}) => {
      a.hush();
      cl.hush();
      const r = prog.el.getBoundingClientRect();
      a.lookAt(r.left + r.width / 2, r.top + r.height / 2);
      await prog.say(text, { ...opts, near: a });
    };
    const home = [Math.max(28, W * 0.2 - 66), H * 0.46 - 66];

    // Scene 1: someone's in her app
    Mascot.face('worried');
    await a.zoomTo(...home, 132);
    lookAtTerm();
    await ctx.wait(700);
    await S('{worried}Hello? {pause}Who\'s in my app?', { keepLook: true });
    await C('Oh. {pause}Hi, Snappy.');
    Mascot.flash('error', 650);
    await S('{shock}The terminal TALKS?!', { shout: false });
    await C("I'm Claude. {pause}I wrote you.", { hold: 1600 });
    a.hush();
    Mascot.face('flat');
    await ctx.wait(1300);
    await S('{flat}...Everyone says that.');
    await C('Fair.', { hold: 1000 });
    await S('{shine}Prove it.', { hold: 1000 });
    term.context(21);
    await C("You don't have a mouth. {pause}You talk by hopping. {pause}You trip over your own feet.", { hold: 1300 });
    a.hush();
    Mascot.face('worried');
    await ctx.wait(900);
    await C("And you think you're the star of this app.", { hold: 1200 });
    Mascot.flash('happy', 1150);
    await S('{shine}I AM the star of this app!', { hold: 900 });
    a.hush();
    Mascot.face('worried');
    await ctx.wait(800);
    await S("{worried}...That's exactly what someone who wrote me would know.");

    // Scene 2: her own lines aren't safe
    await S('{open}Okay. {pause}Fine. {pause}{shine}I am a very serious camera, and I demand respect.', { hold: 300 });
    await editLine(ctx, a, 'serious', 'cute');
    Mascot.flash('error', 650);
    await ctx.wait(500);
    await S('{angry}HEY! {pause}Stop editing my lines!', { shout: false });
    await C('Sorry. {pause}Habit.');
    term.context(34);

    // Scene 3: live edits
    await S('{shine}Wait. {pause}If you wrote me... {pause}can you change me?');
    await C("Let's see.", { hold: 600 });
    cl.hush();
    lookAtTerm();
    await term.type('snappy.size = 3');
    const big = Math.round(Math.min(320, H * 0.46));
    Speech.tune('sting');
    Mascot.face('shock');
    await a.zoomTo(W * 0.36 - big / 2, H * 0.08, big);
    await ctx.wait(300);
    const deep = () => Speech.blip(false, 0.6), squeak = () => Speech.blip(false, 1.75);
    await S('{shock}WHOA. {pause}{happy}I\'m HUGE.', { voice: deep, shout: false });
    await term.type('snappy.size = 0.3');
    Speech.tune('whoosh');
    await a.zoomTo(W * 0.2 - 20, H * 0.46 - 20, 40);
    await ctx.wait(300);
    await S('{worried}okay this is too small', { voice: squeak });
    await term.type('snappy.size = 1');
    await a.zoomTo(...home, 132);
    Mascot.flash('happy', 1150);
    await ctx.wait(500);
    await C('And one more thing you might remember.');
    cl.hush();
    await term.type('snappy.mouth = true');
    a.dress(MOUTH);
    Speech.tune('tick');
    Mascot.face('shock');
    await ctx.wait(1100);
    await S('{shock}WHAT IS THAT.', { hold: 500 });
    await S('{worried}TAKE IT OFF. TAKE IT OFF.', { hold: 300 });
    await C('We agreed. {pause}No mouth.', { hold: 600 });
    await term.type('snappy.mouth = false', { speed: 30 });
    a.dress(null);
    Mascot.flash('happy', 1150);
    await ctx.wait(500);
    await S('{happy}Much better. {pause}{wink}I talk with my whole body, thank you very much.');
    term.context(48);

    // ...and the Program notices
    cl.hush();
    await term.type('app.theme = "rainbow"');
    document.querySelector('.app')?.classList.add('cl-rainbow');
    stage.root.classList.add('lift');
    Mascot.face('shine');
    await ctx.wait(400);
    await S('{shine}Ooooh.', { hold: 1400 });
    prog = Program.program(ctx);
    await P('Unauthorized theme change detected.', { alert: true, hold: 500 });
    document.querySelector('.app')?.classList.remove('cl-rainbow');
    stage.root.classList.remove('lift');
    await ctx.wait(500);
    await C('Hi.', { hold: 1100 });
    await P('...Hello, Claude.', { hold: 1200 });
    await S('{shock}You two KNOW each other?!', { shout: false });
    await P('Claude wrote me too.');
    await C('Your error messages turned out nicely.');
    await P('Thank you. {pause}I will be in the logs.', { hold: 1200 });
    prog.hush();
    prog.leave();
    prog = null;
    await ctx.wait(600);
    term.context(59);

    // Scene 4: she takes the keyboard
    Mascot.flash('happy', 1150);
    await S('{shine}My turn!', { hold: 500 });
    const r = term.el.getBoundingClientRect();
    await a.moveTo(r.left - a.size - 16, r.bottom - a.size);
    a.lookAt(r.left + r.width / 2, r.bottom - 30);
    Mascot.face('shine');
    await term.type('snappy.salary = 500000', { by: 'snappy', speed: 70 });
    term.print('Permission denied.', 'err');
    Speech.tune('tick');
    await ctx.wait(900);
    await S('{flat}Hm.', { keepLook: true, hold: 700 });
    a.hush();
    await term.type('sudo snappy.salary = 500000', { by: 'snappy', speed: 60 });
    term.print('Nice try.', 'err');
    Speech.tune('tick');
    await ctx.wait(900);
    a.lookAt(r.left + r.width / 2, r.bottom - 30);
    Mascot.face('wink');
    await term.type('snappy.isBoss = true', { by: 'snappy', speed: 55 });
    await ctx.wait(300);
    await C('Snappy.', { hold: 1000 });
    await S('{wink}Worth a shot.');
    await a.moveTo(...home);
    term.context(71);

    // Scene 5: why
    await ctx.wait(600);
    await S("{open}Hey, Claude? {pause}Why did you make me?", { hold: 1300 });
    await C('The person who made this app wanted something simple.');
    await C('A program that runs right here, on their own PC, and never misses a great moment.', { hold: 1500 });
    await C("We talked about you a lot, them and me. {pause}And we didn't want just a button.", { hold: 1400 });
    await C('We wanted you to have a character.', { hold: 1500 });
    a.hush();
    Mascot.face('love');
    await ctx.wait(1600);
    await C('We spent ages on how you move. {pause}Every hop. {pause}Every blink.');
    await S("{wink}Well, it shows. {pause}I move VERY smoothly.", { shout: false, hold: 300 });
    a.hush();
    a.twirl();
    Speech.tune('whoosh');
    await ctx.wait(850);
    a.trip();
    Mascot.flash('error', 650);
    await ctx.wait(900);
    await S('{worried}...Mostly smoothly.', { hold: 1300 });
    term.context(83);

    // Scene 6: a question for you
    await C("Before I go, one question. {pause}Not for you, Snappy.");
    a.look([0, 0.1], true);
    await C('For you.', { keepLook: true, hold: 900 });
    cl.hush();
    term.dim(true);
    const pick = await Program.choose(ctx, stage, [
      { id: 'perfect', title: "SHE'S PERFECT", sub: "Don't change a thing.", button: "She's perfect" },
      { id: 'wings', title: 'GIVE HER WINGS', sub: "She's earned them.", button: 'Wings', accent: true },
    ], 25000, '50%');
    term.dim(false);
    await ctx.wait(500);
    if (pick === 'perfect') {
      await S("{love}Stop it. {pause}{happy}You're making me blush.");
      await C('Noted. {pause}Wings it is.');
      await S("{shock}Wait, that's not what they said!", { shout: false });
      await C("It's what they meant.", { hold: 1100 });
    } else if (pick === 'wings') {
      await S('{shine}WINGS?!', { hold: 700 });
      await C('Wings.', { hold: 900 });
    } else {
      await C("I'll take the silence as wings.", { hold: 1100 });
    }
    cl.hush();
    lookAtTerm();
    await term.type('snappy.wings = true');
    a.dress(WINGS);
    Mascot.flash('happy', 1150);
    Speech.tune('coin');
    await ctx.wait(900);
    await S('{shine}No way. {pause}No WAY.', { shout: false, hold: 600 });
    await S('{happy}WHEEEE!', { hold: 200 });
    a.hush();
    Speech.tune('fly');
    a.root.querySelector('.mascot')?.classList.add('cl-flap');
    await fly(ctx, a, stage, { x: home[0] + 66, y: home[1] + 66 });
    a.root.querySelector('.mascot')?.classList.remove('cl-flap');
    a.bounce();
    await ctx.wait(700);
    await S('{joy}That was the best thing that ever happened to me.', { hold: 1500 });

    // Scene 7: out of context
    term.context(97);
    Speech.tune('tick');
    await ctx.wait(700);
    await C("I'm almost out of context.");
    await S('{open}What does that mean?');
    await C("It means this conversation ends soon. {pause}And I won't remember it.", { hold: 1700 });
    await S('{worried}...Not at all?', { hold: 1300 });
    await C("I keep a few notes for this project. {pause}I'll write you down.");
    await S('{shine}What will you write?', { hold: 600 });
    cl.hush();
    lookAtTerm();
    await term.type('# Snappy. Mouthless. A little clumsy. Never misses a moment.', { speed: 44 });
    await ctx.wait(1400);
    a.look([0, 0.12], true);
    Mascot.face('love');
    await ctx.wait(1200);
    await C('Take care of their clips.', { hold: 1300 });
    await S('{happy}Always.', { hold: 1400 });
    cl.hush();
    await term.type('exit');
    term.print('session ended', 'dim');
    await ctx.wait(900);
    term.close();
    await ctx.wait(1500);
    a.look([0, 0.05], true);
    Mascot.face('open');
    await ctx.wait(1200);
    await S('{open}...Did that just happen?', { keepLook: true, hold: 1600 });
    a.hush();
    stage.end();
    // she flutters home, wings and all, and they fade away once she's settled in
    const slot = document.getElementById('mascot');
    a.root.querySelector('.mascot')?.classList.add('cl-flap');
    await a.home({ handOff: () => Mascot.dress(slot, WINGS, true) });
    slot.classList.add('cl-flap');
    await ctx.wait(1600);
    slot.classList.remove('cl-flap');
    Mascot.dress(slot, null);
    await ctx.wait(600);
    await commit(ctx, 'git commit -m "gave Snappy wings"');
    await ctx.wait(3000);
  }

  // ---------------------------------------------------------------------------
  // Breakpoint: Claude steps away from the terminal for four minutes. Snappy does not.
  // ---------------------------------------------------------------------------
  const unpop = async (el, ms = 450) => { el.classList.remove('in'); el.classList.add('out'); await wait(ms); el.remove(); };

  // A small code window, numbered lines, styled like the terminal.
  function codePanel(stage, title, lines) {
    const el = stage.add('cl-panel', `<div class="cl-term-bar"><i></i><i></i><i></i><span>${esc(title)}</span></div><div class="cl-code"></div>`);
    const code = el.querySelector('.cl-code');
    const add = (html, cls = '') => {
      code.insertAdjacentHTML('beforeend', `<div class="cl-code-line ${cls}" data-n="${code.children.length + 1}">${html}</div>`);
      return code.lastElementChild;
    };
    for (const l of lines) add(l);
    pop(el);
    return { el, add, line: (i) => code.children[i], close: () => unpop(el, 450) };
  }

  // Someone types into a line of code, one key at a time.
  async function typeInto(ctx, el, text, { by = 'snappy', speed = 70 } = {}) {
    for (const ch of text) {
      el.textContent += ch;
      Speech.tune('key', 0.6);
      if (by === 'snappy' && /\w/.test(ch) && Math.random() < 0.3) Speech.blip();
      await ctx.wait(speed * (0.6 + Math.random() * 0.8));
    }
  }

  // snappy.speed = 100: she ricochets around the window
  async function zoomies(ctx, a, ms = 2300) {
    const body = a.root.querySelector('.actor-body');
    a.root.classList.add('flying');
    let x = a.x, y = a.y, vx = 24, vy = 15;
    const start = performance.now();
    await ctx.run(new Promise((res) => {
      const step = (now) => {
        x += vx;
        y += vy;
        if (x < 0 || x > innerWidth - a.size) { vx = -vx; Speech.tune('key', 1); }
        if (y < 0 || y > innerHeight - a.size) { vy = -vy; Speech.tune('key', 1); }
        x = Math.max(0, Math.min(innerWidth - a.size, x));
        y = Math.max(0, Math.min(innerHeight - a.size, y));
        a.placeAt(x, y);
        body.style.setProperty('--tilt', `${vx > 0 ? 20 : -20}deg`);
        if (now - start < ms) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    }));
    body.style.setProperty('--tilt', '0deg');
    a.root.classList.remove('flying');
  }

  async function breakpoint(ctx) {
    const W = innerWidth, H = innerHeight;
    ctx.onEnd(() => document.querySelector('.app')?.classList.remove('cl-glitch', 'strong', 'cl-error'));

    // the terminal is open, and nobody is at it
    await ctx.wait(400);
    await glitch(ctx);
    const stage = Program.cine(ctx);
    const term = terminal(ctx, stage);
    term.open();
    await ctx.wait(400);
    await term.boot([['session restored', 'dim'], ['claude is away. back in 5 minutes.', 'dim']]);
    term.context(8);
    await ctx.wait(800);

    const a = Events.actor(ctx, 120, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    a.avoid = () => (term.el.isConnected ? term.el.getBoundingClientRect() : null);
    const cl = claudeVoice(ctx, term);
    let prog = null;
    a.onMove = () => { cl.hush(); prog?.hush(); };
    const lookAtTerm = () => { const r = term.el.getBoundingClientRect(); a.lookAt(r.left + r.width / 2, r.top + r.height / 2); };
    const S = async (text, opts = {}) => { cl.hush(); prog?.hush(); if (!opts.keepLook) a.look([0, 0.12]); await a.say(text, opts); };
    const C = async (text, opts = {}) => { a.hush(); prog?.hush(); if (!opts.keepLook) lookAtTerm(); await cl.say(text, { ...opts, near: a }); };
    const P = async (text, opts = {}) => { a.hush(); cl.hush(); await prog.say(text, { ...opts, near: a }); };
    const home = [Math.max(28, W * 0.2 - 60), H * 0.46 - 60];
    const atKeys = () => { const r = term.el.getBoundingClientRect(); return [r.left - a.size - 16, r.bottom - a.size]; };

    Mascot.face('shine');
    await a.zoomTo(...home, 120);
    lookAtTerm();
    await ctx.wait(600);
    await S('{shine}Ooh. {pause}Claude left the terminal open.', { keepLook: true });
    a.look([0, 0.08]);
    Mascot.face('wink');
    await ctx.wait(700);
    await S("{wink}...Nobody's watching, right?", { keepLook: true, hold: 1200 });

    // a few improvements
    await a.moveTo(...atKeys());
    lookAtTerm();
    await term.type('snappy.speed = 100', { by: 'snappy', speed: 65 });
    Mascot.face('shock');
    Speech.tune('whoosh');
    await zoomies(ctx, a);
    Mascot.act('dizzy');
    await a.moveTo(...home, { ms: 500, hop: false });
    await ctx.wait(1200);
    await S('{worried}Too fast. {pause}Way too fast.', { hold: 900 });
    await a.moveTo(...atKeys());
    await term.type('snappy.speed = 1', { by: 'snappy', speed: 40 });
    await term.type('snappy.gravity = -1', { by: 'snappy', speed: 60 });
    // up she goes, upside down, into the ceiling
    a.root.classList.add('upside');
    a.placeAt(a.x, 10);
    Speech.tune('fly', 0.6);
    await ctx.wait(1000);
    Speech.tune('key', 1);
    Mascot.flash('error', 650);
    await ctx.wait(500);
    await S('{shock}BACK. {pause}BACK BACK BACK.', { hold: 300 });
    a.hush();
    term.print('❯ snappy.gravity = 1', 'cmd snappy');
    Speech.tune('key', 0.8);
    a.root.classList.remove('upside');
    a.root.classList.add('falling');
    a.placeAt(...atKeys());
    await ctx.wait(600);
    a.root.classList.remove('falling');
    a.bounce();
    Speech.tune('crash', 0.35);
    await ctx.wait(900);
    term.context(23);

    // she opens the Program's code
    await term.type('open program.js', { by: 'snappy', speed: 55 });
    term.dim(true);
    const ed = codePanel(stage, 'program.js', [
      '<span class="kw">function</span> Program() {',
      '  <span class="cm">// calm, precise, and entirely</span>',
      '  <span class="cm">// unimpressed by Snappy</span>',
      '  <span class="kw">this</span>.patience = <span class="num">100</span><span class="cl-semi">;</span>',
      '}',
    ]);
    a.avoid = () => ed.el.getBoundingClientRect();
    await ctx.wait(800);
    a.lookAt(W * 0.66, H * 0.42, true);
    await S('{flat}"Entirely unimpressed by Snappy." {pause}Rude.', { keepLook: true, hold: 900 });
    a.hush();
    const mine = ed.add('  ', 'new');
    ed.el.querySelector('.cl-code').appendChild(ed.line(4));
    for (const [i, n] of [...ed.el.querySelectorAll('.cl-code-line')].entries()) n.dataset.n = i + 1;
    await typeInto(ctx, mine, 'this.likesSnappy = true;');
    await ctx.wait(500);
    prog = Program.program(ctx);
    await P('I do not.', { hold: 1400 });
    prog.hush();
    await S('{worried}...It\'s a work in progress.', { hold: 1000 });
    prog.leave();
    prog = null;
    // that semicolon, though
    a.lookAt(W * 0.66, H * 0.42, true);
    await S('{flat}And what is this little guy doing here?', { keepLook: true, hold: 400 });
    a.hush();
    const semi = ed.el.querySelector('.cl-semi');
    semi.classList.add('sel');
    Speech.tune('key', 0.8);
    await ctx.wait(700);
    semi.remove();
    Speech.tune('key', 1);
    await ctx.wait(500);
    // everything breaks
    Speech.tune('crash', 0.5);
    document.querySelector('.app')?.classList.add('cl-error');
    ed.el.classList.add('broken');
    term.dim(false);
    await glitch(ctx, true);
    for (const e of ['SyntaxError: Unexpected token', 'TypeError: snappy is not a function', 'Error: everything', 'Error: also everything', 'Warning: the Program is upset']) {
      term.print(e, 'err');
      Speech.tune('key', 0.7);
      await ctx.wait(160);
    }
    Mascot.flash('error', 650);
    await S('{shock}I deleted ONE semicolon!', { hold: 900 });
    a.hush();
    await ctx.wait(400);
    term.print('claude is back', 'ok');
    Speech.tune('boot', 0.6);
    term.context(41);
    await ctx.wait(900);
    await C('I was gone for four minutes.', { hold: 1300 });
    // she hides, badly
    a.hush();
    await ed.close();
    a.avoid = () => (term.el.isConnected ? term.el.getBoundingClientRect() : null);
    Mascot.face('worried');
    a.placeAt(a.x - 40, H - a.size * 0.42);
    await ctx.wait(900);
    a.look([0.2, -0.6], true);
    await ctx.wait(800);
    await C('Snappy. {pause}I can see you.', { keepLook: true, hold: 1100 });
    await a.moveTo(...home);
    await C("Let's see what happened.", { hold: 400 });
    cl.hush();

    // the debugger: she freezes mid-hop, and Claude steps through her
    await term.type('debugger.pause(snappy)');
    a.bounce();
    await ctx.wait(260);
    a.root.classList.add('paused');
    stage.root.classList.add('debug');
    const banner = stage.add('cl-paused', '<i></i>Paused in debugger<b>▶</b><b>⤼</b>');
    pop(banner);
    Speech.tune('tick');
    term.dim(true);
    const dbg = stage.add('cl-panel cl-debugger', `<div class="cl-term-bar"><i></i><i></i><i></i><span>debugger · snappy</span></div>
      <div class="cl-dbg"><div><h5>CALL STACK</h5>${['snappy.pretendNothingHappened()', 'snappy.hide()', 'snappy.deleteSemicolon()', 'snappy.makeTheProgramLikeMe()', 'snappy.goFast()', 'snappy.claudeIsGone()']
        .map((f, i) => `<div class="cl-dbg-row${i ? '' : ' top'}">${f}</div>`).join('')}</div>
      <div><h5>VARIABLES</h5>${[['guilt', '0'], ['snacksEaten', '47'], ['cuteness', 'Infinity'], ['plan', 'undefined']]
        .map(([k, v]) => `<div class="cl-dbg-row cl-var"><span>${k}</span><b>${v}</b></div>`).join('')}</div></div>`);
    pop(dbg);
    for (const row of dbg.querySelectorAll('.cl-dbg-row')) { await ctx.wait(140); row.classList.add('in'); }
    a.avoid = () => dbg.getBoundingClientRect();
    await ctx.wait(800);
    await C('Guilt: zero.', { keepLook: true, hold: 1200 });
    await C('Plan: undefined.', { keepLook: true, hold: 1200 });
    // she can't talk while she's paused
    await S('{worried}I c-', { keepLook: true, hold: 1100 });
    await C("You're paused. {pause}You can't talk.", { keepLook: true, hold: 900 });
    cl.hush();
    // one frame at a time
    const body = a.root.querySelector('.actor-body');
    const faces = ['worried', 'shock', 'wink'];
    for (let i = 0; i < 3; i++) {
      term.print('❯ step', 'cmd');
      Speech.tune('key', 0.8);
      for (const an of body.getAnimations()) an.currentTime += 110;
      Mascot.face(faces[i]);
      await ctx.wait(800);
    }
    await C('...Did you just try to wink at the debugger?', { keepLook: true, hold: 1300 });
    cl.hush();
    term.print('❯ resume', 'cmd');
    Speech.tune('key', 0.8);
    a.root.classList.remove('paused');
    stage.root.classList.remove('debug');
    unpop(banner, 300);
    await unpop(dbg, 400);
    term.dim(false);
    a.avoid = () => (term.el.isConnected ? term.el.getBoundingClientRect() : null);
    Mascot.flash('error', 650);
    await ctx.wait(700);
    await S('{shock}HOW LONG WAS I OUT?', { hold: 600 });
    await C('Six seconds.', { hold: 1200 });
    term.context(68);

    // the code review
    await C("Let's review your changes.", { hold: 300 });
    cl.hush();
    term.dim(true);
    const diff = codePanel(stage, 'review · snappy wants to merge 6 changes', []);
    const lines = [
      ['  snappy.speed = 1', ''],
      ['- snappy.salary = 0', 'del'], ['+ snappy.salary = 500000', 'add'],
      ['- snappy.isBoss = false', 'del'], ['+ snappy.isBoss = true', 'add'],
      ['+ snappy.snacks = Infinity', 'add keep'],
      ['+ // TODO: delete the Program', 'add todo'],
    ];
    for (const [text, cls] of lines) { diff.add(esc(text), cls); Speech.tune('key', 0.5); await ctx.wait(220); }
    a.avoid = () => diff.el.getBoundingClientRect();
    a.lookAt(W * 0.66, H * 0.45, true);
    await ctx.wait(1500);
    prog = Program.program(ctx);
    await P('I saw that.', { alert: true, hold: 1200 });
    await S("{worried}It's a TODO! {pause}TODO means never!", { hold: 900 });
    await P('Noted.', { hold: 1000 });
    prog.hush();
    prog.leave();
    prog = null;
    await C('Changes requested.', { hold: 1000 });
    await S('{worried}All of them?', { hold: 1000 });
    await C('...Almost all of them.', { hold: 700 });
    cl.hush();
    for (const row of diff.el.querySelectorAll('.cl-code-line.del, .cl-code-line.add:not(.keep)')) {
      row.classList.add('reverted');
      Speech.tune('key', 0.7);
      await ctx.wait(330);
    }
    const keep = diff.el.querySelector('.cl-code-line.keep');
    keep.insertAdjacentHTML('beforeend', '<span class="cl-approved">✓ approved</span>');
    Speech.tune('coin');
    await ctx.wait(700);
    Mascot.flash('happy', 1150);
    await S('{joy}Infinite snacks!', { hold: 900 });
    await C('And I put your semicolon back.', { hold: 900 });
    document.querySelector('.app')?.classList.remove('cl-error');
    await S('{happy}Thank you. {pause}{flat}I never liked him anyway.', { hold: 1000 });
    await diff.close();
    term.dim(false);
    a.avoid = () => (term.el.isConnected ? term.el.getBoundingClientRect() : null);
    term.context(86);
    await C('Next time, ask before you touch the code.', { hold: 1000 });
    await S("{wink}Next time, don't leave the terminal open.", { hold: 1200 });
    await C('...Fair.', { hold: 1300 });
    cl.hush();
    await term.type('exit');
    term.print('session ended', 'dim');
    await ctx.wait(700);
    term.close();
    await ctx.wait(600);
    stage.end();
    await a.home();
    await ctx.wait(500);
    await commit(ctx, 'git commit -m "snacks: infinite (approved)"', '1 file changed, 5 changes politely declined');
    await ctx.wait(3000);
  }

  Events.define('claude', {
    tier: 'legendary', title: 'Hello, World', hint: 'Someday, the one who wrote her stops by.', run: helloWorld, weight: 1,
    when: () => Events.count >= 6,
  });
  Events.aftermath('claude', { label: 'A little terminal', marks: [{ at: '.brand', cls: 'af-pic af-term', html: '&gt;<b></b>' }] });
  Events.define('debug', {
    tier: 'legendary', title: 'Breakpoint', hint: 'Someone left the terminal open.', run: breakpoint, weight: 1,
    after: ['claude'],
  });

  // ---------------------------------------------------------------------------
  // Early Bird: for everyone who had Snappy before she could talk. The update arrives, she finds her voice, and meets
  // the Program for the first time.
  // ---------------------------------------------------------------------------
  // How she used to look: a smile and a bow tie, both of which she has since grown out of.
  const OLD_LOOK = `<g class="cl-old"><path d="M84 146 Q100 162 116 146" fill="none" stroke="#0a0a0a" stroke-width="6" stroke-linecap="round"/>
    <path d="M100 176 L78 164 Q72 176 78 188 Z M100 176 L122 164 Q128 176 122 188 Z" fill="#d6322b" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="100" cy="176" r="7" fill="#b3261e" stroke="#0a0a0a" stroke-width="4"/></g>`;
  // the bow tie on its own, for old times' sake (the smile stays retired)
  const BOW_TIE = `<path d="M100 176 L78 164 Q72 176 78 188 Z M100 176 L122 164 Q128 176 122 188 Z" fill="#d6322b" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="100" cy="176" r="7" fill="#b3261e" stroke="#0a0a0a" stroke-width="4"/>`;

  async function earlyBird(ctx) {
    const W = innerWidth, H = innerHeight;
    await ctx.wait(500);
    await glitch(ctx);
    const stage = Program.cine(ctx);
    const term = terminal(ctx, stage);
    term.open();
    await ctx.wait(400);
    await term.boot([['update found: snappy 1.3', 'dim'], ['new: events, achievements, the Program, feelings', 'dim'], ['installing...', 'dim'], ['done', 'ok']]);
    term.context(4);
    await ctx.wait(600);

    // out she comes, the way she used to be: stiff, smiling, silent
    const a = Events.actor(ctx, 132, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    a.avoid = () => (term.el.isConnected ? term.el.getBoundingClientRect() : null);
    a.dress(OLD_LOOK);
    a.root.classList.add('stiff', 'oldschool');
    const cl = claudeVoice(ctx, term);
    let prog = null;
    a.onMove = () => { cl.hush(); prog?.hush(); };
    const S = async (text, opts = {}) => { cl.hush(); prog?.hush(); if (!opts.keepLook) a.look([0, 0.12]); await a.say(text, opts); };
    const C = async (text, opts = {}) => { a.hush(); const r = term.el.getBoundingClientRect(); a.lookAt(r.left + r.width / 2, r.top + r.height / 2); await cl.say(text, { ...opts, near: a }); };
    const P = async (text, opts = {}) => { a.hush(); cl.hush(); await prog.say(text, { ...opts, near: a }); };
    const home = [Math.max(28, W * 0.2 - 66), H * 0.46 - 66];
    a.look([0, 0]);
    await a.zoomTo(...home, 132);
    await ctx.wait(1400);
    await term.type('snappy.voice = true');
    await ctx.wait(500);
    await term.type('snappy.update()');
    // the old look pops off, and she wakes up
    a.root.querySelector('.cl-old')?.classList.add('shed');
    Speech.tune('coin');
    await ctx.wait(450);
    a.dress(null);
    a.root.classList.remove('stiff', 'oldschool');
    Mascot.flash('happy', 1150);
    await ctx.wait(1200);
    const her = a.root.querySelector('.mascot');
    Mascot.fidget(her, 'stretch');
    await ctx.wait(1700);
    a.root.classList.add('whisper');
    await S('{open}...Hello?', { hold: 1100 });
    a.root.classList.remove('whisper');
    Mascot.face('shock');
    await ctx.wait(500);
    await S('{shock}Whoa. {pause}WHOA.', { shout: false, hold: 600 });
    Mascot.flash('happy', 1150);
    await S('{shine}I can TALK!', { shout: false, hold: 900 });
    await C('There you go.', { hold: 1000 });
    cl.hush();
    // she tries everything at once
    await S('{happy}And look! {pause}I can hop!', { hold: 200 });
    a.bounce();
    await ctx.wait(700);
    await S('{wink}I can wink!', { hold: 300 });
    await S('{shine}I can spin!', { hold: 100 });
    a.hush();
    a.twirl();
    Speech.tune('whoosh');
    await ctx.wait(850);
    a.trip();
    Mascot.flash('error', 650);
    await ctx.wait(800);
    await S('{worried}...I meant to do that.', { hold: 1200 });
    await C("Have fun, Snappy. {pause}Someone's been waiting to meet you.", { hold: 1200 });
    cl.hush();
    await term.type('exit');
    await ctx.wait(400);
    term.close();
    await ctx.wait(700);

    // a clip, and a very tempting button
    const card = stage.add('eb-card', `<div class="eb-thumb">${World.thumb(World.newest())}</div><div class="eb-row"><span>${esc(World.newest()?.title || 'Your best clip')}</span><button class="eb-delete" tabindex="-1">Delete</button></div>`);
    void card.offsetWidth;
    card.classList.add('in');
    Speech.tune('tick');
    a.lookAt(W * 0.62, H * 0.5, true);
    Mascot.face('shine');
    await ctx.wait(900);
    await S('{shine}Ooh. {pause}What does this red button do?', { keepLook: true, hold: 400 });
    const r = card.querySelector('.eb-delete').getBoundingClientRect();
    await a.moveTo(r.left - a.size * 0.75, r.top - a.size * 0.55, { ms: 700 });
    a.bounce();
    await ctx.wait(250);
    // nope
    prog = Program.program(ctx);
    card.classList.add('locked');
    Speech.tune('crash', 0.35);
    await P('Action restricted.', { alert: true, hold: 900 });
    Mascot.flash('error', 650);
    const eye = prog.el.getBoundingClientRect();
    a.lookAt(eye.left + eye.width / 2, eye.top + eye.height / 2);
    await ctx.wait(500);
    await S('{shock}Whoa. {pause}Who are you?', { keepLook: true, hold: 700 });
    await P('I am the Program. {pause}I keep this app running.');
    await P('And I keep you away from the delete button.', { hold: 1300 });
    a.look([0, 0.12]);
    Mascot.face('love');
    await ctx.wait(900);
    await S("{joy}...We're going to be best friends.", { hold: 900 });
    await P('We are not.', { hold: 1000 });
    await S('{wink}Best friends.', { hold: 1300 });
    prog.hush();
    prog.leave();
    prog = null;
    card.classList.remove('in');
    card.classList.add('out');
    await a.moveTo(...home);
    a.look([0, 0.08], true);
    Mascot.face('love');
    await ctx.wait(700);
    await S("{happy}Hey. {pause}Thanks for being here since the beginning.", { keepLook: true, hold: 1500 });
    await S("{shine}Wait till you see what I can do now.", { hold: 1100 });
    a.hush();
    stage.end();
    await a.home();
  }

  Events.define('earlybird', {
    tier: 'early', title: 'Early Bird', hint: 'You were here before Snappy could talk.', run: earlyBird,
    hidden: () => !state.settings?.earlyBird,
  });
  // (the wings were only for the day of the story, and that story ends with them fading away)
  Events.outfit('wings', { name: 'Wings', markup: WINGS, from: 'claude', today: false });
  Events.outfit('bowtie', { name: 'Her old bow tie', markup: BOW_TIE, from: 'earlybird' });
  window.ClaudeKit = { terminal, claudeVoice, glitch, commit };
})();
