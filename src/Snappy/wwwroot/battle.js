// Frame Drop: the app starts to stutter, and the thing eating the frames shows itself: the Lag. Snappy takes it on in
// a proper battle, and you pick her moves. Flash it to pieces, use what the Program hands over, or talk to it: there's
// a second way out for whoever listens. Nothing in the app is really slowed down, it only looks that way.
(() => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const pop = (el) => { void el.offsetWidth; el.classList.add('in'); };
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  // What the battle box says each turn.
  const FLAVOR = ['* LAG buffers menacingly.', '* LAG is stuck at 99%. It has been stuck at 99% for a while.', '* Smells like dropped frames.',
    '* LAG checks its ping. It does not like what it sees.', '* The air is thick with lost packets.', '* LAG is loading. Please wait.'];

  // How the Lag talks: words that catch and repeat, like a call breaking up.
  const stutter = (text) => text.replace(/\b([A-Za-z])([A-Za-z]{2,})/g, (word, first, rest) => (Math.random() < 0.45 ? `${first}-${first.toLowerCase()}-${first}${rest}` : word));

  // The Lag: a lump of stuck pixels, a buffering wheel for an eye and a progress bar of a mouth stuck at 99%.
  // (the floating is on the outside, a shake when it's hit on the inside, so one never cuts the other off)
  const MONSTER = `<div class="lg-inner"><div class="lg-body">${Array.from({ length: 64 }, (_, i) => `<i style="--i:${i};--r:${Math.random().toFixed(2)}"></i>`).join('')}</div>
    <div class="lg-eye"><b></b></div><div class="lg-mouth"><i></i><span>99%</span></div></div>`;

  async function frameDrop(ctx) {
    const W = innerWidth, H = innerHeight, size = 128;
    const app = document.querySelector('.app');
    ctx.onEnd(() => app?.classList.remove('lg-choppy'));

    // ---- it starts as a stutter in the app itself
    const fps = document.createElement('div');
    fps.className = 'lg-fps';
    document.body.appendChild(fps);
    ctx.onEnd(() => fps.remove());
    const showFps = (n) => { fps.textContent = `${n} FPS`; fps.classList.toggle('bad', n < 60); fps.classList.toggle('awful', n < 20); };
    showFps(144);
    pop(fps);
    await ctx.wait(900);
    app?.classList.add('lg-choppy');
    for (const n of [118, 87, 61, 40, 23, 9]) { showFps(n); Speech.tune('tick', 0.4); await ctx.wait(420); }

    const stage = Program.cine(ctx);
    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    const prog = Program.program(ctx);
    const talk = Program.dialogue(a, prog);
    const S = (t, o) => talk.snappy(t, o);
    const P = (t, o) => talk.program(t, o);
    const home = [Math.max(28, W * 0.2 - size / 2), H * 0.5 - size / 2];
    await a.zoomTo(...home, size);
    a.root.classList.add('lg-jitter');
    await S('{worried}Is it just me, {pause}or is everything... {pause}choppy?', { hold: 700 });
    await P('Frame time anomaly detected.', { alert: true, hold: 600 });
    await P('Something is eating the frames.', { alert: true, hold: 600 });
    a.root.classList.remove('lg-jitter');

    // ---- the Lag shows itself
    const monster = stage.add('lg-monster', MONSTER);
    Object.assign(monster.style, { left: `${Math.round(W * 0.68)}px`, top: `${Math.round(H * 0.4)}px` });
    Speech.tune('glitch');
    pop(monster);
    await ctx.wait(1300);
    const mr = monster.getBoundingClientRect();
    const lagNear = { center: { x: mr.left + mr.width / 2 }, y: mr.top, size: mr.height };
    const lagSay = document.createElement('div');
    lagSay.className = 'lg-say';
    document.body.appendChild(lagSay);
    ctx.onEnd(() => lagSay.remove());
    const L = async (text, hold = 1100) => {
      a.hush();
      prog.hush();
      lagSay.style.left = `${lagNear.center.x}px`;
      lagSay.style.top = `${lagNear.y + lagNear.size + 14}px`;
      lagSay.classList.add('in');
      monster.classList.add('talking');
      const w = Speech.typewriter(lagSay, stutter(text), { speed: 40, voice: () => Speech.blip(false, 0.55 + Math.random() * 0.12) });
      ctx.writers.add(w);
      try { await ctx.run(w.done); } finally { ctx.writers.delete(w); monster.classList.remove('talking'); }
      await ctx.wait(Speech.readTime(text, hold));
    };
    a.onMove = () => { lagSay.classList.remove('in'); prog.hush(); };
    a.lookAt(mr.left + mr.width / 2, mr.top + mr.height / 2, true);
    await L('Hello. I am LAG.');
    await S('{shock}You! {pause}You ate the frames!', { keepLook: true, hold: 500 });
    await L('All of them. Delicious.', 900);
    await S('{angry}Those were HIS frames. {pause}Okay, their frames. {pause}YOUR frames!', { keepLook: true, hold: 600 });
    lagSay.classList.remove('in');
    await P('Battle mode engaged.', { alert: true, hold: 200 });
    prog.hush();

    // ---- the battle: the arena, the bars, the menu
    app?.classList.remove('lg-choppy');
    showFps(144);
    stage.root.classList.add('lg-arena');
    Speech.tune('sting');
    const loop = setInterval(() => { if (!ctx.cancelled) Speech.tune('battle', 0.55); }, 3400);
    Speech.tune('battle', 0.55);
    // the music stops with the fight, not at the end of its bar
    const silence = () => { clearInterval(loop); snappy.call('sound.hush').catch(() => {}); };
    ctx.onEnd(silence);
    const bars = stage.add('lg-bars', `<div class="lg-bar lag"><span>LAG</span><div><i></i></div><b></b></div>
      <div class="lg-bar her"><span>SNAPPY</span><div><i></i></div><b></b></div>`);
    pop(bars);
    const state = { lag: 100, her: 144, talks: 0, guard: 0, items: { driver: 1, bitrate: 2, restart: 1 } };
    const draw = () => {
      bars.querySelector('.lag i').style.width = `${state.lag}%`;
      bars.querySelector('.lag b').textContent = `${state.lag} HP`;
      bars.querySelector('.her i').style.width = `${(state.her / 144) * 100}%`;
      bars.querySelector('.her b').textContent = `${state.her} FPS`;
      showFps(state.her);
    };
    draw();
    const hit = (target, amount, text) => {
      const r = (target === 'lag' ? monster : a.root).getBoundingClientRect();
      const num = stage.add('lg-hit', text || `-${amount}`);
      Object.assign(num.style, { left: `${r.left + r.width / 2}px`, top: `${r.top}px` });
      setTimeout(() => num.remove(), 1200);
      if (target === 'lag') {
        state.lag = Math.max(0, state.lag - amount);
        monster.classList.remove('hurt');
        void monster.offsetWidth;
        monster.classList.add('hurt');
        setTimeout(() => monster.classList.remove('hurt'), 450);
      }
      else { state.her = Math.max(1, state.her - amount); a.root.classList.add('crashing'); setTimeout(() => a.root.classList.remove('crashing'), 500); }
      draw();
    };
    // the menu: four big buttons, and she waits for you to pick (if nobody ever does, she gives up after a few minutes)
    let present = false;
    const menu = async (options) => {
      const el = stage.add('lg-menu', options.map((o, i) => `<button class="lg-cmd${o.hot ? ' hot' : ''}" data-i="${i}" tabindex="-1"><b>${esc(o.title)}</b><span>${esc(o.sub)}</span></button>`).join(''));
      pop(el);
      const picked = await ctx.run(Promise.race([
        new Promise((res) => el.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { present = true; res(options[Number(b.dataset.i)].id); } })),
        ...(present ? [] : [wait(180000).then(() => null)]),
      ]));
      Speech.tune('key');
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
      return picked;
    };

    // her moves
    const flashAt = async () => {
      Mascot.flash('clipping', 950);
      Speech.tune('scratch', 0.3);
      const f = stage.add('lg-zap');
      Object.assign(f.style, { left: `${mr.left + mr.width / 2}px`, top: `${mr.top + mr.height / 2}px` });
      setTimeout(() => f.remove(), 700);
      await ctx.wait(350);
    };
    // Her attack is a timing bar: a line sweeps across, you click, and the closer to the middle the harder it hits.
    const aim = async () => {
      const el = stage.add('lg-aim', '<div class="lg-aim-zone"><i></i></div><b class="lg-aim-line"></b><span>CLICK TO SNAP</span>');
      pop(el);
      const line = el.querySelector('.lg-aim-line');
      const start = performance.now(), ms = 1300;
      let at = null;
      const strike = () => { if (at == null) at = (performance.now() - start) / ms; };
      stage.root.addEventListener('pointerdown', strike);
      for (;;) {
        ctx.check();
        const k = (performance.now() - start) / ms;
        line.style.left = `${Math.min(1, k) * 100}%`;
        if (at != null || k >= 1) break;
        await new Promise((res) => requestAnimationFrame(res));
      }
      stage.root.removeEventListener('pointerdown', strike);
      el.classList.add('struck');
      const off = at == null ? 1 : Math.abs(at - 0.5) * 2;
      const grade = off < 0.1 ? ['PERFECT', 2] : off < 0.35 ? ['GOOD', 1.3] : off < 0.7 ? ['OK', 1] : ['MISS', 0];
      el.querySelector('span').textContent = grade[0];
      el.classList.add(grade[0].toLowerCase());
      await ctx.wait(500);
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
      return grade;
    };
    const snap = async () => {
      a.lookAt(mr.left + mr.width / 2, mr.top + mr.height / 2);
      const [grade, times] = await aim();
      if (!times) {
        Speech.tune('crash', 0.25);
        hit('lag', 0, 'MISS');
        await S(pick(['{worried}...I blinked.', '{sad}The lens cap was on.', '{flat}That was a warning shot.']), { hold: 400 });
        return;
      }
      await a.moveTo(home[0] + 70, home[1], { ms: 400 });
      await flashAt();
      const dmg = Math.round(rand(12, 18) * times);
      hit('lag', dmg, grade === 'PERFECT' ? `PERFECT -${dmg}` : null);
      Speech.tune(grade === 'PERFECT' ? 'coin' : 'tick');
      await ctx.wait(500);
      if (grade === 'PERFECT') await S('{joy}PERFECT SHOT!', { hold: 300 });
      await a.moveTo(...home, { ms: 400 });
    };
    const useItem = async () => {
      const left = state.items;
      const pick = await menu([
        { id: 'driver', title: `DRIVER UPDATE ×${left.driver}`, sub: 'Brings the frames back.' },
        { id: 'bitrate', title: `LOWER BITRATE ×${left.bitrate}`, sub: 'Takes less of a hit.' },
        { id: 'restart', title: `RESTART ×${left.restart}`, sub: 'Fixes everything. Supposedly.' },
        { id: 'back', title: 'NEVER MIND', sub: 'Back to the fight.' },
      ]);
      if (pick === 'back' || !left[pick]) { if (pick !== 'back') await P('You are out of that.', { hold: 500 }); return false; }
      left[pick]--;
      if (pick === 'driver') {
        await P('Installing driver update. {pause}Do not turn off your Snappy.', { hold: 300 });
        Speech.tune('boot');
        await ctx.wait(700);
        state.her = Math.min(144, state.her + 70);
        draw();
        await S('{shine}Ooh. {pause}Smooth.', { hold: 500 });
      } else if (pick === 'bitrate') {
        state.guard = 2;
        await P('Bitrate lowered. {pause}Incoming damage reduced.', { hold: 500 });
        await S('{smug}Fewer bits to bite.', { hold: 500 });
      } else {
        await P('Restarting.', { hold: 300 });
        a.root.classList.add('lg-restart');
        await ctx.wait(1100);
        a.root.classList.remove('lg-restart');
        await S('{open}...did that do anything?', { hold: 400 });
        await P('No. {pause}It never does.', { hold: 600 });
      }
      return true;
    };
    const TALKS = [
      ['{open}Why do you even eat frames?', 'I am always hungry. Nobody ever asks why.'],
      ['{worried}Have you tried a snack that is not frames?', '...like what?'],
    ];
    const chat = async () => {
      const [mine, its] = TALKS[Math.min(state.talks, TALKS.length - 1)];
      state.talks++;
      await S(mine, { keepLook: true, hold: 300 });
      await L(its, 900);
      if (state.talks === 2) await S('{shine}Wait. {pause}I have an idea.', { keepLook: true, hold: 500 });
    };
    const run = async () => {
      await S('{worried}Run!', { hold: 100 });
      await a.moveTo(home[0] - 80, home[1], { ms: 300 });
      await L('You cannot run from lag. It follows you everywhere.', 600);
      await a.moveTo(...home, { ms: 400 });
    };

    // Its attacks are dodged: a box with her little camera "soul" in it, which follows your mouse, while dropped
    // frames, ping spikes and lost packets fly through. Every touch costs frames. Nobody steering, she mostly sits still.
    const dodge = async (kind, ms = 4200) => {
      const box = stage.add('lg-box', `<div class="lg-box-label">${kind.toUpperCase()}</div><i class="lg-soul"></i>`);
      pop(box);
      await ctx.wait(350);
      const r = box.getBoundingClientRect(), pad = 10, size = 18;
      const soul = box.querySelector('.lg-soul');
      let sx = r.width / 2, sy = r.height / 2, tx = sx, ty = sy, hurtUntil = 0, taken = 0;
      const follow = (e) => { tx = e.clientX - r.left; ty = e.clientY - r.top; };
      addEventListener('pointermove', follow);
      const bits = [];
      const add = (x, y, vx, vy, w, h, cls = '') => {
        const el = document.createElement('i');
        el.className = `lg-bit ${cls}`;
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        box.appendChild(el);
        bits.push({ el, x, y, vx, vy, w, h });
      };
      const start = performance.now();
      let last = start, next = start, frozen = 0, yank = start + 1000;
      try {
        for (;;) {
          ctx.check();
          const now = performance.now(), dt = Math.min(40, now - last);
          last = now;
          if (now - start > ms) break;
          // what comes at her
          if (now >= next) {
            if (kind === 'frame freeze') { const left = Math.random() < 0.5; add(left ? -24 : r.width + 4, pad + Math.random() * (r.height - 40), left ? 0.22 : -0.22, 0, 22, 22); next = now + 260; }
            else if (kind === 'rubber band') { add(Math.random() * r.width, -24, (Math.random() - 0.5) * 0.12, 0.2, 18, 18); next = now + 220; }
            else if (kind === 'ping spike') { const x = pad + Math.random() * (r.width - 40); add(x, r.height + 2, 0, -0.42, 26, 70, 'spike'); next = now + 420; }
            else { const gap = pad + Math.random() * (r.width - 90); for (let x = 0; x < r.width; x += 30) if (x < gap || x > gap + 70) add(x, -20, 0, 0.16, 24, 16, 'packet'); next = now + 1150; }
          }
          // frame freeze: every so often everything stops dead for a moment, then carries on
          if (kind === 'frame freeze' && now - start > 900 && !frozen && Math.random() < 0.012) { frozen = now + 420; box.classList.add('frozen'); }
          if (frozen && now > frozen) { frozen = 0; box.classList.remove('frozen'); }
          // rubber band: she gets snapped back to the middle now and then
          if (kind === 'rubber band' && now > yank) { sx = r.width / 2; sy = r.height / 2; yank = now + 1100; soul.classList.remove('yank'); void soul.offsetWidth; soul.classList.add('yank'); }
          sx += (Math.max(pad, Math.min(r.width - pad - size, tx - size / 2)) - sx) * 0.35;
          sy += (Math.max(pad, Math.min(r.height - pad - size, ty - size / 2)) - sy) * 0.35;
          soul.style.transform = `translate(${sx}px, ${sy}px)`;
          for (let i = bits.length - 1; i >= 0; i--) {
            const b = bits[i];
            if (!frozen) { b.x += b.vx * dt; b.y += b.vy * dt; }
            b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
            if (b.x < -60 || b.x > r.width + 60 || b.y < -90 || b.y > r.height + 40) { b.el.remove(); bits.splice(i, 1); continue; }
            const touch = sx + size > b.x && sx < b.x + b.w && sy + size > b.y && sy < b.y + b.h;
            if (touch && now > hurtUntil) {
              hurtUntil = now + 650;
              taken++;
              soul.classList.remove('hit');
              void soul.offsetWidth;
              soul.classList.add('hit');
              Speech.tune('tick', 0.6);
            }
          }
          await new Promise((res) => requestAnimationFrame(res));
        }
      } finally {
        removeEventListener('pointermove', follow);
      }
      box.classList.add('out');
      setTimeout(() => box.remove(), 300);
      return taken;
    };

    // its moves
    let packetLoss = false;
    const lagTurn = async () => {
      const move = pick(['frame freeze', 'rubber band', 'ping spike', 'packet loss']);
      const guard = state.guard > 0 ? 0.5 : 1;
      if (state.guard) state.guard--;
      monster.classList.add('attack');
      await L(`${move.toUpperCase()}.`, 200);
      lagSay.classList.remove('in');
      a.hush();
      // the battle box makes way for the dodging
      flavor.classList.add('out');
      const taken = await dodge(move);
      flavor.classList.remove('out');
      monster.classList.remove('attack');
      if (taken) hit('her', Math.round(Math.min(40, taken * rand(6, 9)) * guard));
      else hit('her', 0, 'DODGED');
      if (move === 'packet loss' && taken) packetLoss = true;
      await ctx.wait(500);
      lagSay.classList.remove('in');
      // it never gets the better of her: the Program steps in when it's close
      if (state.her < 30 && state.items.driver === 0) {
        await P('Emergency driver update.', { alert: true, hold: 300 });
        state.her = 90;
        draw();
      }
    };
    // her line after it hit her with packet loss: some of it just doesn't arrive
    const lossy = (text) => text.replace(/[a-z]/g, (c) => (Math.random() < 0.3 ? '_' : c));

    // the battle box: a line of what's going on, typed out, before every turn
    const flavor = stage.add('lg-flavor');
    pop(flavor);
    const narrate = async (text) => {
      const w = Speech.typewriter(flavor, text, { speed: 24, voice: () => Speech.blip(false, 0.8) });
      ctx.writers.add(w);
      try { await ctx.run(w.done); } finally { ctx.writers.delete(w); }
    };

    let befriended = false;
    await S('{angry}Okay, Lag. {pause}You and me.', { keepLook: true, hold: 400 });
    while (state.lag > 0 && !befriended) {
      a.hush();
      await narrate(state.lag < 30 ? '* LAG is barely holding a frame together.' : state.talks >= 2 ? '* LAG looks a little less hungry.' : pick(FLAVOR));
      const options = [
        { id: 'snap', title: 'SNAP', sub: 'Her flash, right in its eye.' },
        { id: 'item', title: 'ITEMS', sub: 'Whatever the Program has.' },
        { id: 'talk', title: state.talks >= 2 ? 'BEFRIEND' : 'TALK', sub: state.talks >= 2 ? 'She has a better idea.' : 'Maybe it has a reason.', hot: state.talks >= 2 },
        { id: 'run', title: 'RUN', sub: 'Worth a try.' },
      ];
      const choice = await menu(options);
      if (!choice) {
        // she started while nobody was around: not played, so not counted
        silence();
        flavor.classList.add('out');
        await S('{sad}...nobody wants to fight with me.', { hold: 1000 });
        await L('I will be back. I am always back.', 900);
        throw Events.SKIP;
      }
      if (packetLoss) { await S(lossy("{worried}Wait, my words aren't all arriving!"), { hold: 300 }); packetLoss = false; }
      if (choice === 'snap') await snap();
      else if (choice === 'item') { if (!(await useItem())) continue; }
      else if (choice === 'talk' && state.talks >= 2) befriended = true;
      else if (choice === 'talk') await chat();
      else await run();
      if (state.lag <= 0 || befriended) break;
      await lagTurn();
    }
    silence();
    flavor.classList.add('out');

    if (befriended) {
      // the cookies she grabbed during her "deep scan"
      await S('{happy}Here. {pause}I grabbed some cookies earlier.', { keepLook: true, hold: 300 });
      const cookie = stage.add('lg-cookie');
      Object.assign(cookie.style, { left: `${a.center.x}px`, top: `${a.center.y}px` });
      cookie.style.setProperty('--tx', `${mr.left + mr.width / 2 - a.center.x}px`);
      cookie.style.setProperty('--ty', `${mr.top + mr.height * 0.6 - a.center.y}px`);
      pop(cookie);
      Speech.tune('whoosh', 0.6);
      await ctx.wait(800);
      cookie.remove();
      monster.classList.add('calm');
      Speech.tune('chime');
      await ctx.wait(900);
      await L('...that is... really good.', 600);
      lagSay.textContent = '';
      await ctx.wait(300);
      // and it doesn't stutter anymore
      lagSay.classList.add('clear');
      const w = Speech.typewriter(lagSay, 'Thank you. I feel so... smooth.', { speed: 30, voice: () => Speech.blip(false, 0.7) });
      lagSay.classList.add('in');
      ctx.writers.add(w);
      try { await ctx.run(w.done); } finally { ctx.writers.delete(w); }
      await ctx.wait(1300);
      lagSay.classList.remove('in');
      monster.classList.add('gone');
      await ctx.wait(900);
      await P('That is not how anything works.', { hold: 700 });
      await S('{wink}It is now.', { hold: 900 });
    } else {
      monster.classList.add('break');
      Speech.tune('shatter');
      await ctx.wait(1100);
      Speech.tune('fanfare');
      const win = stage.add('lg-win', '<b>VICTORY</b><span>+144 FPS · Snappy reached LV 2</span>');
      pop(win);
      World.confetti(ctx, stage, 2200);
      await S('{joy}FRAMES! {pause}Free at last!', { hold: 600 });
      await P('Frame pacing restored.', { hold: 600 });
      win.classList.add('out');
    }
    state.her = 144;
    draw();
    bars.classList.add('out');
    stage.root.classList.remove('lg-arena');
    await S("{happy}Real talk, though: {pause}if your clips ever stutter, check Settings, Video. {wink}I'll tell you when your driver needs an update.", { hold: 1100 });
    prog.hush();
    prog.leave();
    fps.classList.remove('in');
    stage.end();
    await a.home();
  }

  Events.define('framedrop', {
    tier: 'game', title: 'Frame Drop', hint: 'Something is eating your frames.', run: frameDrop, weight: 2,
  });
})();
