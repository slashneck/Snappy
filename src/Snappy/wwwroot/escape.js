// The Great Escape: Snappy cracks the app window, the Program throws everything it has at her, and she smashes right
// through onto your real desktop. She clears it for herself (your windows minimize, hers slides out of the way), the
// Program follows her out there, and while it rebuilds containment she gets up to one thing after another on your PC.
// Grab her and drag her away to stop whatever she's about to do; leave her be and she does it. When the countdown runs
// out, the Program reels her back in, puts every window back where it was and repairs the glass.
// Nothing is lost or changed for good: your windows come back exactly as they were, her letter in Notepad is a temp
// file that's deleted again, and everything she draws on the screen is gone when she's home. Only when there's some
// desktop next to the window.
(() => {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const plain = (t) => t.replace(/\{[a-z]+\}/g, '');
  let room = null;
  const check = () => snappy.call('escape.room').then((r) => { room = r; }, () => { room = null; });
  setTimeout(check, 4000);
  setInterval(check, 60e3);
  addEventListener('focus', check);
  // the side of the window with room for her (a maximized window has none)
  const side = () => (!room?.normal ? null : room.right > 280 ? 'right' : room.left > 280 ? 'left' : null);

  // What she says when you pick her up and throw her around.
  const LINES = {
    grab: ['{shock}Whoa!', '{shock}Hey! Put me down!', '{shock}Whoa, whoa, whoa!'],
    swing: ['{joy}WHEEEE!', '{joy}Faster!', '{joy}I can see my house!'],
    throw: ['{joy}AAAAAH!', '{joy}WHEEEEEE!', "{joy}I'm flyiiing!"],
    drop: ['{wince}Oof.', '{angry}Hey!'],
    land: ["{happy}I'm okay!", '{joy}Again! Again!', '{wince}...ow.', '{smug}Ten out of ten.'],
    free: ['{angry}Hey! That was mine!', '{sad}Fine. Keep your pointer.'],
  };

  // ---------------------------------------------------------------------------
  // Cracks in the glass: rays from where she hits, wandering a little, with branches, and at the end rings between
  // them like a spider web and a hole. Drawn line by line.
  // ---------------------------------------------------------------------------
  function cracks(ctx) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'esc-crack');
    svg.setAttribute('width', innerWidth);
    svg.setAttribute('height', innerHeight);
    document.body.appendChild(svg);
    ctx.onEnd(() => svg.remove());
    const line = (pts, width = 1) => {
      const d = `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')}`;
      svg.insertAdjacentHTML('beforeend', `<path class="esc-crack-under" d="${d}" pathLength="1" style="stroke-width:${3 + width * 2}px"/><path class="esc-crack-line" d="${d}" pathLength="1" style="stroke-width:${1 + width}px"/>`);
    };
    const ray = (x, y, angle, length, width, branches) => {
      const pts = [[x, y]];
      let a = angle, gone = 0;
      while (gone < length) {
        const step = 14 + Math.random() * 26;
        a += (Math.random() - 0.5) * 0.7;
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
        gone += step;
        pts.push([x, y]);
        if (branches && Math.random() < 0.22) ray(x, y, a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), (length - gone) * 0.5, Math.max(0.4, width * 0.6), false);
      }
      line(pts, width);
      return pts;
    };
    return {
      // a few short ones, or a lot of long ones
      hit(x, y, toward, count, length) {
        for (let i = 0; i < count; i++) ray(x, y, toward + (Math.random() - 0.5) * 3.2, length * (0.5 + Math.random() * 0.6), 1.2, true);
      },
      // the spider web around the hole, and the hole itself
      smash(x, y, toward) {
        const spokes = Array.from({ length: 12 }, (_, i) => toward + (i / 12 - 0.5) * 3.6 + (Math.random() - 0.5) * 0.2);
        const legs = spokes.map((a) => ray(x, y, a, 260 + Math.random() * 360, 1.6, true));
        for (const r of [40, 85, 140]) {
          const ring = legs.map((pts) => pts[Math.min(pts.length - 1, Math.round(r / 26))]);
          for (let i = 0; i < ring.length - 1; i++) if (Math.random() < 0.8) line([ring[i], ring[i + 1]], 0.8);
        }
        const hole = Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2, rr = 34 + Math.random() * 26;
          return `${(x + Math.cos(a) * rr * 0.75).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
        }).join(' ');
        svg.insertAdjacentHTML('beforeend', `<polygon class="esc-hole" points="${hole}"/>`);
      },
      // the Program's repair: a line sweeps across and the glass is whole again behind it
      async mend(from, to) {
        const sweep = document.createElement('div');
        sweep.className = 'esc-sweep';
        sweep.style.setProperty('--from', `${from}px`);
        sweep.style.setProperty('--to', `${to}px`);
        document.body.appendChild(sweep);
        svg.classList.add('mending');
        await ctx.wait(1600);
        sweep.remove();
        svg.remove();
      },
    };
  }

  async function greatEscape(ctx) {
    await check();
    const dir = side();
    if (!dir) throw Events.SKIP;
    const W = innerWidth, H = innerHeight, size = 110, out = dir === 'right' ? 1 : -1;
    const app = document.querySelector('.app');
    Events.stage(ctx, { dim: false });
    ctx.onEnd(() => {
      for (const m of ['escape.hide', 'escape.cleanup', 'deskprog.hide']) snappy.call(m, {}).catch(() => {});
      snappy.call('escape.windowBack', { ms: 600 }).catch(() => {});
      snappy.call('escape.cursor', { on: false }).catch(() => {});
      snappy.call('escape.grab', { on: false }).catch(() => {});
      app?.classList.remove('esc-shake', 'esc-quake');
    });
    const a = Events.actor(ctx, size, { from: 'home' });
    a.bubbleSide('caption');
    a.root.classList.add('narrow');
    const S = async (text, opts = {}) => { if (!opts.keepLook) a.look([0, 0.12]); await a.say(text, opts); };
    const prog = Program.program(ctx);
    const talk = Program.dialogue(a, prog);
    const shake = async (cls = 'esc-shake') => { app?.classList.remove(cls); void app?.offsetWidth; app?.classList.add(cls); await ctx.wait(cls === 'esc-quake' ? 700 : 400); };

    // ---- out on the desktop: her bubble, her faces, her moves, and you
    let said = 0;
    const bubble = async (text, ms = 1300) => {
      const mine = ++said;
      const face = /^\{([a-z]+)\}/.exec(text)?.[1];
      const words = plain(text);
      const loud = /[A-Z]{3}/.test(words) && words === words.toUpperCase();
      snappy.call('escape.face', { face: face || null }).catch(() => {});
      snappy.call('escape.say', { text: words }).catch(() => {});
      for (let t = 0; t < words.length * 24 && mine === said; t += 75) { (loud ? Speech.shoutBlip : Speech.blip)(); await ctx.wait(75); }
      await ctx.wait(Speech.readTime(words, ms));
      if (mine === said) snappy.call('escape.say', { text: '' }).catch(() => {});
    };
    // the Program, at the top of your screen
    const DP = async (text, { alert = false, hold } = {}) => {
      const words = plain(text);
      snappy.call('deskprog.say', { text: words, alert }).catch(() => {});
      Speech.programWord();
      for (let i = 0; i < words.length; i++) {
        if (i === 0 || words[i - 1] === ' ') { Speech.programWord(); Speech.programBlip(); }
        await ctx.wait(31);
      }
      await ctx.wait(Speech.readTime(words, hold));
    };
    const go = (x, y, ms, hops = 0, fall = false) => snappy.call('escape.go', { x, y, ms, hops, fall }).catch(() => {});
    const floorAt = (fx) => [room.area.x + room.area.w * fx, room.floor];
    let here = 0.5;
    const walk = async (fx) => {
      fx = Math.max(0.04, Math.min(0.96, fx));
      const dist = Math.abs(fx - here) * room.area.w;
      here = fx;
      go(...floorAt(fx), Math.round(300 + dist * 2.2), Math.max(1, Math.round(dist / 110)));
      await ctx.wait(Math.round(350 + dist * 2.2));
    };
    let held = false, flying = false, reacting = false;
    const grabs = new Set();
    const unlisten = snappy.on('escape', ({ what }) => {
      if (what === 'grab') { held = true; flying = true; for (const fn of [...grabs]) fn(); }
      if (what === 'throw' || what === 'drop') held = false;
      if (what === 'land') flying = false;
      // she only has something to say about it once you're allowed to pick her up
      if (reacting) bubble(pick(LINES[what] || ['{shock}Whoa!']), 900);
    });
    ctx.onEnd(unlisten);
    const grabbed = () => new Promise((res) => { const fn = () => { grabs.delete(fn); res(true); }; grabs.add(fn); ctx.onEnd(() => grabs.delete(fn)); });
    const settled = async () => { const t = Date.now(); while ((held || flying) && Date.now() - t < 9000) await ctx.wait(150); };

    // =============================================================================================================
    // 1. the glass
    // =============================================================================================================
    const y = H * 0.52 - size / 2;
    await a.zoomTo(W * 0.5 - size / 2, y, size);
    a.lookAt(dir === 'right' ? W : 0, H * 0.5, true);
    await S("{worried}Hey. {pause}What's on the other side of the window?", { keepLook: true });
    await S('{shine}Only one way to find out.', { keepLook: true, hold: 300 });
    a.hush();
    const edge = dir === 'right' ? W - size - 2 : 2;
    await a.moveTo(edge, y, { ms: 900 });
    const glass = cracks(ctx);
    const hitX = dir === 'right' ? W - 4 : 4, hitY = y + size * 0.5, inward = dir === 'right' ? Math.PI : 0;
    // she pushes; the window gives a little
    a.root.classList.add(`esc-squeeze-${dir}`);
    await S('{angry}Hnnnngh...', { keepLook: true, hold: 200 });
    Speech.tune('crack', 0.8);
    glass.hit(hitX, hitY, inward, 4, 90);
    await shake();
    await talk.program('Snappy. {pause}Step away from the window.', { alert: true, hold: 700 });
    await talk.snappy('{smug}Make me.', { hold: 700 });
    await talk.program('Containment engaged.', { alert: true, hold: 300 });
    prog.hush();
    const field = document.createElement('div');
    field.className = 'esc-field';
    a.root.appendChild(field);
    Speech.tune('beam', 0.8);
    await ctx.wait(900);
    a.root.classList.add('crashing');
    await talk.snappy('{angry}Hnnnnnngh!!', { hold: 200 });
    for (let i = 0; i < 3; i++) {
      Speech.tune('crack', 0.9);
      glass.hit(hitX, hitY, inward, 3, 150 + i * 60);
      await shake();
    }
    field.classList.add('failing');
    await talk.program('Containment... {pause}failing.', { alert: true, hold: 500 });
    a.root.classList.remove('crashing');
    // a run-up, and through
    await talk.snappy('{angry}Okay. {pause}Run-up.', { hold: 200 });
    a.hush();
    await a.moveTo(edge - out * 190, y, { ms: 600 });
    a.lookAt(dir === 'right' ? W : 0, H * 0.5);
    await S('{angry}HERE I GO!', { keepLook: true, shout: true, hold: 100 });
    a.hush();
    a.root.classList.add('run');
    a.placeAt(edge, y);
    await ctx.wait(380);
    a.root.classList.remove('run', `esc-squeeze-${dir}`);
    Speech.tune('shatter');
    field.remove();
    glass.smash(hitX, hitY, inward);
    document.body.insertAdjacentHTML('beforeend', '<div class="esc-flash"></div>');
    const flash = document.body.lastElementChild;
    setTimeout(() => flash.remove(), 700);
    shake('esc-quake');
    // out she flies, in a shower of glass, onto your real desktop
    const exit = dir === 'right' ? W + size * 0.55 : -size * 0.55;
    snappy.call('escape.show', { x: exit, y: y + size, size, bubble: dir }).catch(() => {});
    snappy.call('desk.shatter', { x: dir === 'right' ? W : 0, y: hitY, side: out }).catch(() => {});
    flying = true;
    snappy.call('escape.launch', { vx: out * 0.75, vy: -0.85 }).catch(() => {});
    a.root.style.transition = 'none';
    a.placeAt(dir === 'right' ? W + 40 : -size - 40, y);
    await ctx.wait(500);
    await talk.program('Structural damage detected.', { alert: true, hold: 600 });
    await talk.program('Snappy has left the application.', { alert: true, hold: 400 });
    prog.hush();
    await settled();
    await check();

    // =============================================================================================================
    // 2. the desktop is hers
    // =============================================================================================================
    await bubble("{joy}I'm FREE!", 1000);
    await bubble('{shine}Whoa. Your desktop is HUGE.', 900);
    await bubble('{smug}Too many windows, though. Let me make some room.', 500);
    const cleared = await snappy.call('escape.clear').catch(() => 0);
    snappy.call('escape.windowAway', { ms: 900 }).catch(() => {});
    Speech.tune('whoosh');
    await ctx.wait(1000);
    await check();
    here = 0.5;
    await bubble(cleared ? '{happy}Ta-da!' : '{happy}Ah. Much better.', 900);

    // the Program follows her out
    prog.leave();
    snappy.call('deskprog.show').catch(() => {});
    Speech.tune('scan', 0.7);
    await ctx.wait(600);
    await DP('Snappy.', { alert: true, hold: 600 });
    await bubble('{shock}You can come out here too?!', 700);
    await DP('I am rebuilding containment. {pause}It will take a little while.', { hold: 600 });
    const LIMIT = 115;
    const started = performance.now();
    const left = () => Math.max(0, LIMIT - (performance.now() - started) / 1000);
    const tick = setInterval(() => {
      const s = Math.ceil(left());
      snappy.call('deskprog.timer', { text: `CONTAINMENT ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }).catch(() => {});
    }, 500);
    ctx.onEnd(() => clearInterval(tick));
    await DP('User. {pause}Until then, it is up to you. {pause}Pick her up and drag her away from whatever she is about to do.', { hold: 900 });
    snappy.call('deskprog.say', { text: '' }).catch(() => {});
    snappy.call('escape.grab', { on: true }).catch(() => {});
    reacting = true;
    await bubble("{wink}Psst. Don't listen to it.", 900);

    // the Program tries to pull her back now and then; it isn't strong enough yet
    const attempt = async () => {
      await DP('Attempting retrieval.', { alert: true, hold: 200 });
      snappy.call('desk.beam', { on: true, from: 'program', weak: true }).catch(() => {});
      Speech.tune('beam', 0.7);
      await bubble('{angry}Nope! Nope! NOPE!', 1300);
      snappy.call('desk.beam', { on: false }).catch(() => {});
      await DP('Retrieval failed.', { hold: 700 });
      snappy.call('deskprog.say', { text: '' }).catch(() => {});
    };

    // =============================================================================================================
    // 3. what she gets up to: each one announced first, so you have a moment to stop her
    // =============================================================================================================
    const PRANKS = [
      {
        tease: '{shine}Ooh. A nice big empty screen.', at: 0.5, run: async () => {
          await bubble('{smug}Hold still...', 300);
          Speech.tune('scratch', 0.4);
          snappy.call('desk.add', { id: 'graffiti', kind: 'graffiti', text: 'SNAPPY WAS HERE', fx: 0.5, fy: 0.34 }).catch(() => {});
          await ctx.wait(1900);
          await bubble('{joy}Art.', 1000);
        },
        stopped: '{angry}Hey! I was making art!',
      },
      {
        tease: '{happy}I should write you a letter.', at: 0.35, run: async () => {
          await snappy.call('escape.letter', {
            text: 'Dear you,\r\n\r\nHi! It\'s me, Snappy. I\'m outside! On your actual desktop!\r\n\r\nThe Program is very upset. It says this is "not how anything works".\r\n\r\nAnyway, I just wanted to say: thanks for all the clips. You\'re my favorite player.\r\n\r\nLove,\r\nSnappy\r\n\r\nP.S. Don\'t worry, I\'ll put everything back. Probably.',
          }).catch(() => {});
          await ctx.wait(1600);
          await bubble('{love}Did you read it?', 900);
          // and up on top of it
          const ledges = await snappy.call('escape.ledges', { min: size }).catch(() => []);
          const top = ledges.sort((p, q) => q.right - q.left - (p.right - p.left))[0];
          if (top) {
            const x = Math.min(top.right - size * 0.6, Math.max(top.left + size * 0.6, (top.left + top.right) / 2));
            go(x, top.y, 900, 2);
            await ctx.wait(1000);
            await bubble('{shine}Nice view from up here!', 1100);
            here = (x - room.area.x) / room.area.w;
            go(...floorAt(here), 700, 0, true);
            await ctx.wait(800);
          }
        },
        stopped: '{sad}It was a really nice letter...',
      },
      {
        tease: '{shine}Wait. Is your taskbar... a piano?', at: 0.2, run: async () => {
          const notes = [523, 587, 659, 523, 659, 784, 880, 784, 659, 587, 523];
          for (const [i, hz] of notes.entries()) {
            here = Math.min(0.95, here + 0.035);
            go(...floorAt(here), 230, 1);
            snappy.call('sound.blip', { pitch: hz, volume: Speech.volume }).catch(() => {});
            await ctx.wait(i === notes.length - 1 ? 600 : 260);
          }
          await bubble('{wink}Thank you, thank you.', 1000);
        },
        stopped: '{angry}I was about to hit the high note!',
        then: attempt,
      },
      {
        tease: '{happy}Say cheese!', at: 0.4, run: async () => {
          snappy.call('sound.play', { name: 'coin', volume: Speech.volume }).catch(() => {});
          snappy.call('desk.photo', { id: 'photo', fx: 0.3, fy: 0.36 }).catch(() => {});
          await ctx.wait(900);
          await bubble("{happy}Got it! {wink}...don't worry, I'm not keeping it.", 1300);
          snappy.call('desk.remove', { id: 'photo' }).catch(() => {});
        },
        stopped: '{smug}You blinked anyway.',
      },
      {
        tease: '{smug}You look like you need a reminder.', at: 0.78, run: async () => {
          Speech.tune('tick');
          snappy.call('desk.add', { id: 'note', kind: 'note', text: 'Drink some water!\n\nAnd save more clips.\n- Snappy', fx: 0.86, fy: 0.24 }).catch(() => {});
          await ctx.wait(700);
          await bubble("{happy}There. Now you won't forget.", 1000);
        },
        stopped: '{sad}It was a NICE note!',
      },
      {
        tease: "{shine}I'll send you a few notifications.", at: 0.85, run: async () => {
          for (const text of ['Snappy wants to be your friend.', 'Snappy liked your desktop.']) {
            snappy.call('escape.notify', { title: 'Snappy', text }).catch(() => {});
            await ctx.wait(2200);
          }
          await bubble('{wink}Did you get them? They were real ones!', 1000);
        },
        stopped: '{angry}They were IMPORTANT notifications!',
        then: attempt,
      },
      {
        tease: "{shine}Ooh. What's that little arrow?", at: 0.45, run: async () => {
          let free = false;
          const off = snappy.on('escape', ({ what }) => { if (what === 'free') free = true; });
          snappy.call('escape.cursor', { on: true }).catch(() => {});
          await bubble('{joy}Mine now!', 200);
          for (const fx of [here + 0.15, here - 0.1, here + 0.08]) {
            if (free) break;
            await walk(fx);
          }
          snappy.call('escape.cursor', { on: false }).catch(() => {});
          off();
          if (!free) await bubble('{sad}Okay, okay. Here.', 900);
        },
        stopped: '{sad}I just wanted to borrow it!',
      },
      {
        tease: '{smug}This wallpaper needs more me.', at: 0.5, run: async () => {
          Speech.tune('fanfare', 0.6);
          snappy.call('desk.add', { id: 'poster', kind: 'poster', text: '', fx: 0.5, fy: 0.5 }).catch(() => {});
          await ctx.wait(1200);
          await bubble('{joy}MUCH better.', 1500);
          await bubble('{wink}...okay, maybe a little much.', 900);
          snappy.call('desk.remove', { id: 'poster' }).catch(() => {});
        },
        stopped: '{sad}It was going to be beautiful!',
      },
    ];
    let stops = 0, done = 0;
    for (const prank of PRANKS) {
      if (left() < 9) break;
      await walk(prank.at);
      if (left() < 7) break;
      const stopped = await Promise.race([grabbed(), bubble(prank.tease, 2600).then(() => false)]);
      if (stopped) {
        stops++;
        await settled();
        await bubble(prank.stopped, 1200);
        if (stops === 1) await DP('Well done, user.', { hold: 700 });
      } else {
        done++;
        await prank.run();
        await settled();
      }
      if (prank.then && left() > 14) await prank.then();
    }
    if (left() > 6) {
      await bubble("{worried}...I'm out of ideas.", 1000);
      await DP('Then containment is ready early.', { hold: 600 });
    }

    // =============================================================================================================
    // 4. the Program reels her in, puts everything back, and fixes the glass
    // =============================================================================================================
    snappy.call('escape.grab', { on: false }).catch(() => {});
    snappy.call('escape.cursor', { on: false }).catch(() => {});
    unlisten();
    await settled();
    clearInterval(tick);
    snappy.call('deskprog.timer', { text: 'CONTAINMENT READY' }).catch(() => {});
    await DP('Containment rebuilt. {pause}Retrieving Snappy.', { alert: true, hold: 300 });
    snappy.call('desk.beam', { on: true, from: 'program', weak: false }).catch(() => {});
    Speech.tune('beam');
    await bubble('{shock}Nooo! Five more minutes!', 400);
    // your windows come back, hers slides up, and the beam hauls her in through the hole she made
    snappy.call('escape.windowBack', { ms: 900 }).catch(() => {});
    snappy.call('escape.unclear').catch(() => {});
    await ctx.wait(1000);
    await check();
    go(exit, y + size, 1200, 0);
    await ctx.wait(1250);
    snappy.call('desk.beam', { on: false }).catch(() => {});
    snappy.call('escape.hide').catch(() => {});
    snappy.call('deskprog.hide').catch(() => {});
    a.root.style.transition = 'none';
    a.placeAt(dir === 'right' ? W + 12 : -size - 12, y);
    void a.root.offsetWidth;
    a.root.style.transition = '';
    Speech.tune('whoosh');
    await a.moveTo(W * 0.5 - size / 2, y, { ms: 800 });
    a.trip();
    Mascot.flash('error', 650);
    await ctx.wait(700);
    const back = Program.program(ctx);
    const talk2 = Program.dialogue(a, back);
    await talk2.program('Snappy has been returned to the application.', { hold: 600 });
    await talk2.program('Repairing.', { hold: 200 });
    back.hush();
    Speech.tune('scan');
    await glass.mend(dir === 'right' ? W : 0, dir === 'right' ? 0 : W);
    snappy.call('escape.cleanup').catch(() => {});
    await talk2.program(stops ? `You stopped her ${stops} ${stops === 1 ? 'time' : 'times'}. {pause}She got away with ${done}.` : `She got away with all ${done} of them.`, { hold: 900 });
    if (!done) await talk2.snappy('{sad}You stopped EVERYTHING? {pause}{smug}...okay, that was impressive.', { hold: 900 });
    else await talk2.snappy('{smug}Best. Day. Ever.', { hold: 1000 });
    await talk2.snappy('{wink}The outside is nice. {pause}But your window is home.', { hold: 1000 });
    await talk2.program('Everything is back where it was. {pause}Nothing out there was harmed.', { hold: 1000 });
    back.leave();
    await a.home();
  }

  Events.define('escape', {
    tier: 'rare', title: 'The Great Escape', hint: 'Leave some desktop free next to her window. Then keep an eye on her.', run: greatEscape, weight: 2,
    when: () => !!side(),
  });
})();
