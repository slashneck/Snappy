// Snappy's Great Investigation™: a clip goes missing, Snappy takes the case, and the Program has the activity log.
// Nothing really goes missing: the clip, the folder and the evidence are all props.
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };
  const unpop = async (el, ms = 450) => { el.classList.remove('in'); el.classList.add('out'); await wait(ms); el.remove(); };

  // Her detective outfit: a deerstalker and a magnifying glass (her own coordinates: body x 10..190, y 54..182).
  const DETECTIVE = `
    <clipPath id="inv-hat-dome"><path d="M104 57 Q106 22 140 19 Q174 22 176 57 Z"/></clipPath>
    <path d="M104 57 Q106 22 140 19 Q174 22 176 57 Z" fill="#a8743f"/>
    <g clip-path="url(#inv-hat-dome)" stroke="#7a5128" stroke-width="2.5"><path d="M120 10 V60 M140 10 V60 M160 10 V60 M100 32 H180 M100 46 H180"/></g>
    <path d="M104 57 Q106 22 140 19 Q174 22 176 57 Z" fill="none" stroke="#0a0a0a" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M94 58 Q140 47 186 58 Q140 67 94 58 Z" fill="#8a5c2e" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M132 18 Q140 9 148 18" fill="none" stroke="#0a0a0a" stroke-width="4" stroke-linecap="round"/>
    <g class="inv-glass">
      <path d="M198 144 L182 168" stroke="#0a0a0a" stroke-width="11" stroke-linecap="round"/>
      <path d="M198 144 L182 168" stroke="#8a5c2e" stroke-width="5.5" stroke-linecap="round"/>
      <circle cx="212" cy="124" r="22" fill="rgba(190, 230, 255, .35)" stroke="#0a0a0a" stroke-width="5"/>
      <circle cx="212" cy="124" r="17" fill="none" stroke="#d7d7d7" stroke-width="3"/>
      <path d="M200 116 Q204 108 212 107" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    </g>`;

  // The suspects.
  const FOLDER_SVG = `<svg viewBox="0 0 120 96"><path d="M6 18 Q6 10 14 10 H44 L52 18 H106 Q114 18 114 26 V84 Q114 90 108 90 H12 Q6 90 6 84 Z" fill="#e7b85a" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
    <g class="inv-folder-paper"><rect x="22" y="22" width="76" height="46" rx="4" fill="#1b1b1b" stroke="#0a0a0a" stroke-width="3"/><path d="M52 36 L66 45 L52 54 Z" fill="#fff"/></g>
    <path class="inv-folder-flap" d="M6 34 Q6 28 12 28 H108 Q114 28 114 34 V84 Q114 90 108 90 H12 Q6 90 6 84 Z" fill="#f2c96b" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/></svg>`;
  const CURSOR_SVG = '<svg viewBox="-4 -2 28 32"><path d="M1.5 1.5v20.2l5.1-4.9 3.4 8.1 3.3-1.4-3.4-8h7.1z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const POTATO_SVG = `<svg viewBox="0 0 120 96"><path d="M14 52 C10 26 38 10 64 12 C92 14 112 30 108 54 C104 78 80 88 56 86 C30 84 17 72 14 52 Z" fill="#c99a5b" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
    <g fill="#9c7038"><ellipse cx="34" cy="40" rx="4" ry="3"/><ellipse cx="86" cy="64" rx="5" ry="3.5"/><ellipse cx="70" cy="30" rx="3" ry="2.4"/><ellipse cx="40" cy="70" rx="3.5" ry="2.6"/></g>
    <g class="inv-potato-eyes"><ellipse cx="54" cy="50" rx="3.4" ry="4.4" fill="#0a0a0a"/><ellipse cx="72" cy="50" rx="3.4" ry="4.4" fill="#0a0a0a"/></g></svg>`;

  // How Snappy looks in the security footage: a plain recording of her, not her.
  const FOOTAGE_SNAPPY = `<svg viewBox="-16 -18 232 222"><rect x="40" y="34" width="44" height="28" rx="9" fill="#d9d9d9" stroke="#111" stroke-width="7"/>
    <rect x="10" y="54" width="180" height="128" rx="44" fill="#d9d9d9" stroke="#111" stroke-width="7"/>
    <ellipse cx="72" cy="120" rx="14" ry="20" fill="#111"/><ellipse cx="128" cy="120" rx="14" ry="20" fill="#111"/></svg>`;

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  // police tape: two strips that unroll across the window, one from each side, crossing in the middle
  function tape(ctx, stage, texts) {
    const strip = (text, cls) => `<div class="inv-tape ${cls}"><div>${Array(10).fill(`<span>${esc(text)}</span>`).join('')}</div></div>`;
    const el = stage.add('inv-tapes', strip(texts[0], 'one') + strip(texts[1], 'two'));
    const [one, two] = el.querySelectorAll('.inv-tape');
    return {
      async open() {
        void el.offsetWidth;
        Speech.tune('whoosh');
        one.classList.add('in');
        await ctx.wait(380);
        Speech.tune('whoosh');
        two.classList.add('in');
      },
      close: () => unpop(el, 700),
    };
  }

  function board(stage) {
    const pin = (cls, svg, label, r) => `<div class="inv-photo ${cls}" style="--r:${r}deg"><i class="inv-pin"></i><div class="inv-photo-img">${svg}</div><span>${label}</span></div>`;
    const el = stage.add('inv-board', `<svg class="inv-string" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M18 30 L50 62 L82 32"/></svg>
      ${pin('p1', FOLDER_SVG, 'the folder', -5)}${pin('p2', CURSOR_SVG, 'the cursor', 3)}${pin('p3', POTATO_SVG, 'the potato', -2)}
      <div class="inv-board-title">SUSPECTS</div>`);
    pop(el);
    return { el, close: () => unpop(el, 500) };
  }

  // the lights go down to a spotlight on her, and snap back on all at once
  function spotlight(stage, a) {
    const el = stage.add('inv-spot');
    el.style.setProperty('--x', `${a.center.x}px`);
    el.style.setProperty('--y', `${a.center.y}px`);
    pop(el);
    return { off() { el.classList.add('snap'); el.classList.remove('in'); setTimeout(() => el.remove(), 300); } };
  }

  // music notes drifting up off her while her theme plays
  function musicNotes(ctx, a) {
    const glyphs = ['♪', '♫', '♩'];
    const add = () => {
      const n = document.createElement('span');
      n.className = 'inv-note';
      n.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      n.style.setProperty('--dx', `${Math.round((Math.random() - 0.3) * 60)}px`);
      n.style.left = `${55 + Math.random() * 35}%`;
      a.root.appendChild(n);
      setTimeout(() => n.remove(), 1500);
    };
    add();
    const timer = setInterval(add, 320);
    const stop = () => clearInterval(timer);
    ctx.onEnd(stop);
    return { stop };
  }

  // the interrogation room: a lamp over the suspect
  function lamp(stage) {
    const el = stage.add('inv-lamp', '<div class="inv-lamp-cord"></div><div class="inv-lamp-shade"></div><div class="inv-lamp-light"></div><div class="inv-suspect"></div>');
    pop(el);
    const suspect = el.querySelector('.inv-suspect');
    return {
      el,
      suspect,
      show(html, cls) { suspect.className = `inv-suspect ${cls}`; suspect.innerHTML = html; void suspect.offsetWidth; suspect.classList.add('in'); },
      get center() { const r = el.querySelector('.inv-lamp-light').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - 70 }; },
      close: () => unpop(el, 500),
    };
  }

  // the activity log: a screen recording of Snappy moving the clip
  function footage(stage, when) {
    const el = stage.add('pg-window inv-log', `<div class="pg-title"><i></i>ACTIVITY LOG · ${esc(when)}</div>
      <div class="inv-screen"><div class="inv-rec">● REC</div>
        <div class="inv-grid"><i></i><i class="inv-moved"></i><i></i><i></i><i></i><i></i></div>
        <div class="inv-fold">${FOLDER_SVG}<span>Funny Clips</span></div>
        <div class="inv-footage-snappy">${FOOTAGE_SNAPPY}</div></div>`);
    pop(el);
    return {
      el,
      async bump() { el.classList.remove('in'); el.classList.add('shut'); await wait(420); el.classList.remove('shut'); void el.offsetWidth; el.classList.add('in'); },
      close: () => unpop(el, 500),
    };
  }

  // ---------------------------------------------------------------------------
  // The case
  // ---------------------------------------------------------------------------
  async function investigation(ctx) {
    const W = innerWidth, H = innerHeight;
    const when = new Date(Date.now() - 11 * 60e3).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const stage = Program.cine(ctx);
    const prog = Program.program(ctx);
    ctx.onEnd(() => snappy.call('sound.hush').catch(() => {}));
    await ctx.wait(500);

    // Scene 1: the crime scene
    const caution = tape(ctx, stage, ['CLIP MISSING · DO NOT CROSS', 'CRIME SCENE · DO NOT CROSS']);
    Speech.tune('sting');
    await caution.open();
    await ctx.wait(900);
    // nobody's on stage yet, so the Program's line goes where she'll stand
    const spot = { center: { x: W / 2 }, y: H * 0.46 - 66, size: 132 };
    await prog.say('Attention. {pause}A clip appears to be missing from the library.', { alert: true, near: spot });
    prog.hush();
    const a = Events.actor(ctx, 132, { from: 'home' });
    a.bubbleSide('caption');
    const { snappy: S, program: P } = Program.dialogue(a, prog);
    a.dress(DETECTIVE);
    Mascot.face('flat');
    // she slides out of her corner, slowly, growing as she comes
    a.root.classList.add('slow');
    a.resize(132);
    await a.moveTo(W / 2 - 66, H * 0.46 - 66, { hop: false, ms: 1500 });
    a.root.classList.remove('slow');
    await ctx.wait(500);
    await S('{flat}Nobody move.', { hold: 1200 });
    await P('Nobody is moving.');
    await S('{shine}Good. {pause}That means the criminal is still here.');
    await P('That is not how criminal investigations work.');
    await S('{flat}And yet, here we are. {pause}A missing clip. {pause}A suspicious library. {pause}A program that knows too much.', { hold: 1300 });
    await P('I am the program.', { hold: 1100 });
    await S('{flat}Exactly what a suspicious program would say.', { hold: 600 });
    a.hush();
    // her theme music: the lights go down, a spotlight, notes in the air... until the Program has had enough
    a.look([0.5, 0.2], true);
    const lights = spotlight(stage, a);
    const notes = musicNotes(ctx, a);
    Speech.tune('noir');
    await ctx.wait(2200);
    snappy.call('sound.hush').catch(() => {});
    Speech.tune('scratch');
    notes.stop();
    lights.off();
    Mascot.flash('error', 650);
    await P('No.', { alert: true, hold: 1000 });
    Mascot.face('worried');
    await P('The clip was last accessed eleven minutes ago.');
    await S("{shock}Eleven minutes? {pause}That's enough time to flee the country.");
    await P('It was moved into the folder named "Funny Clips".');
    await S('{flat}...A cover-up.', { hold: 1300 });
    await P('You moved it.', { hold: 600 });
    prog.hush();
    Mascot.face('shock');
    a.look([0, 0.05]);
    await ctx.wait(1800);
    await S('{worried}I would like a lawyer.', { hold: 1300 });
    await P('You are not under arrest.');
    await S("{flat}That's what they want you to think.");
    caution.close();

    // Scene 2: the evidence board
    await a.moveTo(Math.max(28, W * 0.2 - 66), H * 0.46 - 66);
    const ev = board(stage);
    Speech.tune('tick');
    a.lookAt(W * 0.62, H * 0.45);
    await ctx.wait(900);
    await S('{shine}We have three suspects.', { keepLook: true });
    await P('Why is there a potato?', { hold: 1100 });
    await S('{flat}Motive.', { hold: 1200 });
    await P('The potato is an image file.');
    await S("{worried}That's what makes it dangerous.", { hold: 1300 });
    a.hush();
    prog.hush();
    ev.el.classList.add('dim');
    const suspect = await Program.choose(ctx, stage, [
      { id: 'folder', title: 'THE SUSPICIOUS FOLDER', sub: "It's been very quiet lately.", button: 'Interrogate' },
      { id: 'cursor', title: 'THE MOUSE CURSOR', sub: 'Always lurking. Never explains itself.', button: 'Interrogate' },
      { id: 'potato', title: 'THE POTATO', sub: 'Says nothing. Suspicious.', button: 'Interrogate', accent: true },
    ], 30000, '57%') || 'potato';
    await ev.close();

    // Scene 3: the interrogation
    const room = lamp(stage);
    Speech.tune('scan', 0.5);
    await ctx.wait(700);
    const atLamp = () => room.center;
    if (suspect === 'cursor') {
      const Cursor = Events.cursor(ctx);
      Cursor.grab();
      Cursor.big(true);
      await ctx.run(Cursor.moveTo(atLamp().x - 10, atLamp().y - 20, 1100));
      a.lookAt(atLamp().x, atLamp().y, true);
      Mascot.face('flat');
      await ctx.wait(1200);
      await S(`{flat}Where were you at ${when}?`, { keepLook: true });
      await P('The cursor is controlled by the user.');
      await S("{flat}I didn't ask who controls you. {pause}I asked where you were.", { keepLook: true });
      await P('On the screen.', { hold: 1000 });
      await S('{flat}Convenient.', { keepLook: true, hold: 900 });
      a.hush();
      // it gets away: the pointer goes back to your hand
      Cursor.big(false);
      await Cursor.release();
      Mascot.flash('error', 650);
      await S("{shock}IT'S RUNNING!");
      await P('The user moved their mouse.');
      await S('{shock}THE USER IS AN ACCOMPLICE?!');
      await P('Please do not accuse the user of crimes.');
      await S("{open}Fine. {pause}I'll be subtle.", { hold: 900 });
      a.hush();
      a.look([0, 0.1], true);
      await ctx.wait(900);
      await S('{flat}Between you and me, {pause}I think you did it.', { keepLook: true });
      await P('You moved the clip.', { hold: 900 });
      await S('{worried}BETWEEN YOU AND ME, I THINK THE PROGRAM DID IT.');
    } else if (suspect === 'folder') {
      room.show(`${FOLDER_SVG}<span>Funny Clips</span>`, 'folder');
      a.lookAt(atLamp().x, atLamp().y, true);
      Mascot.face('flat');
      await ctx.wait(1200);
      await S('{flat}So. {pause}"Funny Clips". {pause}If that IS your real name.', { keepLook: true });
      await P('That is its real name. You named it.');
      await S('{shock}...I name a lot of things.', { keepLook: true });
      await S(`{flat}Where were you at ${when}?`, { keepLook: true });
      await P('On the disk. Folders do not go anywhere.');
      await S('{flat}Convenient.', { keepLook: true, hold: 900 });
      await S('{shine}Open up!', { keepLook: true, hold: 300 });
      a.hush();
      // it does, for half a second, and something is in there
      room.suspect.classList.add('peek');
      Speech.tune('tick');
      await ctx.wait(650);
      room.suspect.classList.remove('peek');
      Speech.tune('key', 1);
      await ctx.wait(300);
      Mascot.flash('error', 650);
      await S("{shock}DID YOU SEE THAT? {pause}IT'S HIDING SOMETHING.");
      await P('It is hiding the missing clip. {pause}Because you put it there.');
      await S("{worried}A folder that hides clips. {pause}That's literally its whole job.", { keepLook: true });
      await P('Yes.', { hold: 1100 });
      await S("{flat}...I'm going to need a bigger magnifying glass.");
    } else {
      room.show(`${POTATO_SVG}<span>potato.png</span>`, 'potato');
      a.lookAt(atLamp().x, atLamp().y, true);
      Mascot.face('flat');
      await ctx.wait(1200);
      await S("{flat}Well, well, well. {pause}If it isn't potato dot P N G.", { keepLook: true });
      await P('It is a picture of a potato.');
      await S(`{flat}Where were you at ${when}?`, { keepLook: true, hold: 600 });
      a.hush();
      prog.hush();
      // nothing. and then its eyes move.
      await ctx.wait(1500);
      room.suspect.classList.add('shifty');
      await ctx.wait(1100);
      Mascot.flash('error', 650);
      await S('{shock}It moved its eyes!', { keepLook: true });
      await P('It is an image. {pause}It cannot move.');
      room.suspect.classList.remove('shifty');
      room.suspect.classList.add('blink');
      await ctx.wait(500);
      room.suspect.classList.remove('blink');
      await S('{shock}Then explain THAT.', { keepLook: true, hold: 900 });
      await P('...', { alert: true, hold: 1200 });
      await P('I cannot explain that.', { alert: true, hold: 1300 });
      await S('{worried}Okay. {pause}New plan. {pause}Good cop, bad cop.', { keepLook: true });
      await S("{joy}Hey buddy. {pause}You're a good potato, right?", { keepLook: true, hold: 900 });
      a.bounce();
      await S('{angry}TALK, SPUD!', { keepLook: true, hold: 1300 });
      a.hush();
      await ctx.wait(1200);
      await P('This interrogation is not productive.');
      await S("{flat}He's a professional.", { keepLook: true, hold: 1300 });
    }
    await P('I have a complete activity log.', { hold: 900 });
    await S('{flat}And I have a complete lack of trust.', { hold: 1300 });
    a.hush();
    await room.close();

    // Scene 4: the evidence
    await P('Here is the evidence.', { hold: 400 });
    const log = footage(stage, when);
    Speech.tune('scan');
    a.lookAt(W * 0.62, H * 0.5, true);
    Mascot.face('open');
    await ctx.wait(2400);
    Mascot.face('shock');
    await ctx.wait(1300);
    await S("{shock}That's not me.", { keepLook: true, hold: 1000 });
    await P('It is your avatar.', { hold: 1000 });
    await S('{flat}Deepfake.', { keepLook: true, hold: 1000 });
    await P('It is a screen recording.', { hold: 1000 });
    await S('{worried}Advanced deepfake.', { keepLook: true, hold: 1100 });
    await P('You dragged the clip into "Funny Clips" and then forgot where you put it.', { hold: 1400 });
    a.hush();
    prog.hush();
    a.lookAt(W * 0.62, H * 0.5);
    await ctx.wait(2400);
    await S('{open}So... {pause}the criminal was inside the library all along.');
    await P('The criminal was you.', { hold: 1200 });
    await S('{shock}I was investigating myself.', { hold: 1100 });
    await P('Yes.', { hold: 1000 });
    await S('{happy}And I found myself innocent.');
    await P('You found yourself guilty.', { hold: 1100 });
    await S('{worried}This investigation is compromised.', { hold: 800 });
    a.hush();
    // she shuts the log, and the Program opens it right back up
    const lr = log.el.getBoundingClientRect();
    const back = { x: a.x, y: a.y };
    await a.moveTo(lr.left - a.size * 0.6, lr.top + lr.height / 2 - a.size / 2, { ms: 600 });
    a.bounce();
    await ctx.wait(250);
    log.bump();
    Speech.tune('whoosh');
    await ctx.wait(700);
    Speech.tune('tick');
    await ctx.wait(200);
    await a.moveTo(back.x, back.y);
    await S('{angry}STOP SHOWING ME THE EVIDENCE.');
    await P('Would you like me to restore the clip to its original location?');
    await S("{worried}No. {pause}We can't let the public know what happened.");
    await P('The public is the user.', { hold: 1000 });
    a.look([0, 0.1]);
    await S("{shock}THEY'RE EVERYWHERE.", { keepLook: true, hold: 1300 });
    a.hush();
    await log.close();

    // Scene 5: case closed
    await ctx.wait(400);
    const rep = Program.report(stage, 'CASE REPORT', [
      ['Missing clips', '0'], ['Crimes committed', '0'], ['Time wasted', '17 minutes', true], ['Detective competence', 'Not detected', true],
    ]);
    for (let i = 0; i < 4; i++) { await ctx.wait(i ? 650 : 400); rep.show(i); }
    await ctx.wait(700);
    await P('The investigation is complete.');
    Mascot.flash('happy', 1150);
    await S('{shine}Excellent. {pause}Another case solved by the finest detective in the digital world.');
    await P('You caused the problem.');
    await S('{happy}And I solved it.');
    await P('By reading the activity log.');
    await S('{wink}Everyone has their methods.');
    await P('You could have searched for the clip.');
    await S('{smug}And miss out on all this?', { hold: 1200 });
    a.hush();
    rep.close();
    // off she goes... and stops
    const slot = document.getElementById('mascot').getBoundingClientRect();
    a.root.classList.add('slow');
    await a.moveTo(a.x + (slot.left - a.x) * 0.35, a.y + (slot.top - a.y) * 0.35, { ms: 900 });
    a.root.classList.remove('slow');
    Mascot.face('open');
    await S('{open}Wait.', { hold: 1000 });
    await P('What now?');
    await S('{flat}If I moved that clip...', { hold: 600 });
    a.hush();
    await ctx.wait(1800);
    await S('{shock}Who moved the other one?', { hold: 1200 });
    await P('There is no other missing clip.');
    await S("{flat}That's exactly what they want us to think.", { hold: 600 });
    a.hush();
    // a quick look at you
    a.look([0, 0.1]);
    await ctx.wait(450);
    a.look([0.6, 0.2]);
    await ctx.wait(300);
    a.look([0, 0.1]);
    await ctx.wait(500);
    await P('Do not start another investigation.', { alert: true });
    await S("{shine}I'm opening a new case file.");
    await P('No.', { alert: true, hold: 900 });
    await S('{flat}Operation Potato begins now.', { hold: 900 });
    a.hush();
    prog.hush();
    const denied = stage.add('inv-denied', 'SNAPPY HAS BEEN TEMPORARILY DENIED ACCESS TO THE ACTIVITY LOG.');
    pop(denied);
    Speech.tune('crash', 0.5);
    await ctx.wait(1600);
    Mascot.flash('error', 650);
    await S("{shock}YOU CAN'T SILENCE THE TRUTH.", { hold: 900 });
    unpop(denied, 500);
    a.dress(null);
    stage.end();
    await a.home();
    await ctx.wait(900);

    // one last thing in the corner
    const spud = document.createElement('div');
    spud.className = 'inv-spud';
    spud.innerHTML = POTATO_SVG;
    document.body.appendChild(spud);
    ctx.onEnd(() => spud.remove());
    pop(spud);
    await ctx.wait(650);
    spud.classList.remove('in');
    await ctx.wait(500);
    spud.remove();
    await prog.say('...I am removing that image.', { near: { center: { x: innerWidth / 2 }, y: innerHeight * 0.62, size: 0 }, hold: 1600 });
    prog.hush();
    await prog.leave();
  }

  Events.define('investigation', {
    tier: 'rare', title: 'Case Closed', hint: 'A clip goes missing. Snappy takes the case.', run: investigation, weight: 2,
  });
  Events.outfit('detective', { name: 'Detective hat', markup: DETECTIVE, from: 'investigation' });
})();
