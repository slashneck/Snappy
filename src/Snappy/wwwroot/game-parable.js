// The Snappy Parable: an office building, first person, and the Program as the narrator, telling you what Snappy does
// next. You click the doors (and the odd button). You can do what it says. You don't have to. Four endings.
(() => {
  const W = 480, H = 270;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* the endings you found are forgotten, that's all */ } },
  };
  const ENDINGS = { freedom: 'The Freedom Ending', nothing: 'The Nothing Ending', closet: 'The Broom Closet Ending', restart: 'The Restart Ending' };

  // ---- the building, in one-point perspective: back wall in the middle, floor, ceiling and side walls around it
  const BACK = { l: 150, r: 330, t: 70, b: 190 };
  function room(g, { wall = '#d9d2bf', side = '#c8c0aa', floor = '#6b6f5a', ceiling = '#e9e6dc', lights = true } = {}) {
    const quad = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
    quad([[0, 0], [W, 0], [BACK.r, BACK.t], [BACK.l, BACK.t]], ceiling);
    quad([[0, H], [W, H], [BACK.r, BACK.b], [BACK.l, BACK.b]], floor);
    quad([[0, 0], [BACK.l, BACK.t], [BACK.l, BACK.b], [0, H]], side);
    quad([[W, 0], [BACK.r, BACK.t], [BACK.r, BACK.b], [W, H]], side);
    g.fillStyle = wall; g.fillRect(BACK.l, BACK.t, BACK.r - BACK.l, BACK.b - BACK.t);
    // a skirting line, and the carpet's weave
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, H - 2); g.lineTo(BACK.l, BACK.b); g.lineTo(BACK.r, BACK.b); g.lineTo(W, H - 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.05)';
    for (let i = 1; i < 8; i++) { const k = i / 8; g.beginPath(); g.moveTo(BACK.l + (BACK.r - BACK.l) * k, BACK.b); g.lineTo(W * k, H); g.stroke(); }
    if (lights) for (let i = 0; i < 3; i++) {
      const k = 0.25 + i * 0.25, y = BACK.t * k, half = 40 + (1 - k) * 40;
      quad([[W / 2 - half, y], [W / 2 + half, y], [W / 2 + half * 0.8, y + 6 + (1 - k) * 8], [W / 2 - half * 0.8, y + 6 + (1 - k) * 8]], 'rgba(255, 255, 250, .9)');
    }
  }
  // a door in the back wall: x, width, and whether it's open; returns its box for clicking
  function door(g, x, w, { open = true, label = '', glow = false } = {}) {
    const top = BACK.b - 90;
    g.fillStyle = '#5a4632'; g.fillRect(x - 3, top - 3, w + 6, 93);
    g.fillStyle = open ? '#1a1712' : '#8a6a48'; g.fillRect(x, top, w, 90);
    if (open) { g.fillStyle = 'rgba(255, 245, 210, .07)'; g.beginPath(); g.moveTo(x, BACK.b); g.lineTo(x + w, BACK.b); g.lineTo(x + w * 0.8, top + 30); g.lineTo(x + w * 0.2, top + 30); g.fill(); }
    else { g.fillStyle = '#c9a85a'; g.beginPath(); g.arc(x + w - 8, top + 48, 2.5, 0, Math.PI * 2); g.fill(); }
    if (glow) { g.strokeStyle = 'rgba(255, 236, 160, .8)'; g.lineWidth = 2; g.strokeRect(x - 5, top - 5, w + 10, 97); }
    if (label) { g.fillStyle = '#2a2a2a'; g.font = '700 7px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText(label, x + w / 2, top - 7); }
    return { l: x - 4, r: x + w + 4, t: top - 4, b: BACK.b };
  }
  // a door on the left or right wall, seen at an angle
  function sideDoor(g, right, { label = '', glow = false } = {}) {
    const x0 = right ? 395 : 40, x1 = right ? 345 : 90, top0 = 70, top1 = 110, bot0 = 238, bot1 = 200;
    g.fillStyle = '#5a4632';
    g.beginPath(); g.moveTo(x0, top0); g.lineTo(x1, top1); g.lineTo(x1, bot1); g.lineTo(x0, bot0); g.closePath(); g.fill();
    g.fillStyle = '#8a6a48';
    g.beginPath(); g.moveTo(x0 + (right ? -4 : 4), top0 + 4); g.lineTo(x1 + (right ? 3 : -3), top1 + 3); g.lineTo(x1 + (right ? 3 : -3), bot1); g.lineTo(x0 + (right ? -4 : 4), bot0); g.closePath(); g.fill();
    if (glow) { g.strokeStyle = 'rgba(255, 236, 160, .8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, top0); g.lineTo(x1, top1); g.lineTo(x1, bot1); g.lineTo(x0, bot0); g.closePath(); g.stroke(); }
    if (label) { g.fillStyle = '#2a2a2a'; g.font = '700 7px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText(label, (x0 + x1) / 2, top0 + 10); }
    return { l: Math.min(x0, x1), r: Math.max(x0, x1), t: top0, b: bot0 };
  }

  // ---- the scenes
  const SCENES = {
    office(g, t, hover) {
      room(g);
      g.fillStyle = '#2a2a2a'; g.font = '800 11px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText('427', 300, 92);
      const exit = door(g, 196, 46, { open: false, glow: hover === 'exit' });
      // her desk, her monitor, showing nothing
      g.fillStyle = '#4a3a2a'; g.fillRect(90, 200, 300, 70); g.fillStyle = '#5c4a36'; g.fillRect(90, 200, 300, 8);
      g.fillStyle = '#1b1b1d'; g.fillRect(200, 150, 80, 52); g.fillStyle = '#0a0d14'; g.fillRect(205, 155, 70, 40);
      g.fillStyle = `rgba(80, 120, 200, ${0.15 + Math.sin(t / 700) * 0.05})`; g.fillRect(205, 155, 70, 40);
      g.fillStyle = '#1b1b1d'; g.fillRect(236, 202, 8, 6);
      return { exit };
    },
    doors(g, t, hover) {
      room(g);
      return { left: door(g, 168, 52, { glow: hover === 'left' }), right: door(g, 260, 52, { glow: hover === 'right' }) };
    },
    stairs(g, t, hover) {
      room(g, { wall: '#cfd4d9', side: '#bfc5cc' });
      // steps going up into the back wall
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#9aa1aa' : '#aeb5be'; g.fillRect(180 + i * 4, 190 - i * 14, 120 - i * 8, 14); }
      return { up: door(g, 214, 52, { open: false, label: "PROGRAM'S OFFICE", glow: hover === 'up' }) };
    },
    control(g, t, hover) {
      room(g, { wall: '#1c2430', side: '#141a22', floor: '#20262e', ceiling: '#10141a', lights: false });
      // screens on every wall, and the Program watching from the middle of them
      for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(110, 200, 240, ${0.25 + ((i * 37 + Math.floor(t / 300)) % 5) / 20})`; g.fillRect(160 + i * 34, 80, 28, 20); }
      Arcade.programEye(g, W / 2, 140, 26, { look: Math.sin(t / 900) * 0.5 });
      g.fillStyle = '#2b333f'; g.fillRect(150, 205, 180, 40);
      g.fillStyle = '#d9d2bf'; g.font = '700 8px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText('CLIP DELETION FACILITY', W / 2, 218);
      const on = { l: 180, r: 230, t: 222, b: 242 }, off = { l: 250, r: 300, t: 222, b: 242 };
      for (const [box, label, c, id] of [[on, 'ON', '#3cb15a', 'on'], [off, 'OFF', '#d23a3a', 'off']]) {
        g.fillStyle = hover === id ? '#fff' : c; g.fillRect(box.l, box.t, box.r - box.l, box.b - box.t);
        g.fillStyle = hover === id ? c : '#fff'; g.font = '800 10px "Segoe UI", sans-serif'; g.fillText(label, (box.l + box.r) / 2, box.b - 6);
      }
      return { on, off };
    },
    corridor(g, t, hover) {
      room(g, { wall: '#d4ccb6' });
      return { closet: sideDoor(g, false, { label: 'BROOM CLOSET', glow: hover === 'closet' }), ahead: door(g, 216, 48, { glow: hover === 'ahead' }) };
    },
    closet(g) {
      room(g, { wall: '#8a7a62', side: '#7a6a52', floor: '#4a4034', ceiling: '#6a5a46', lights: false });
      g.strokeStyle = '#c9a85a'; g.lineWidth = 4; g.beginPath(); g.moveTo(200, 120); g.lineTo(220, 215); g.stroke();
      g.fillStyle = '#d9c27a'; g.beginPath(); g.moveTo(208, 205); g.lineTo(234, 205); g.lineTo(238, 225); g.lineTo(204, 225); g.fill();
      g.fillStyle = '#5a6a7a'; g.fillRect(260, 190, 34, 30);
      return {};
    },
    outside(g, t) {
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#9fd6ff'); sky.addColorStop(1, '#fff7d6');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffe58a'; g.beginPath(); g.arc(360, 70, 26 + Math.sin(t / 500), 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7ccf6a'; g.beginPath(); g.moveTo(0, 200); g.quadraticCurveTo(W / 2, 170, W, 200); g.lineTo(W, H); g.lineTo(0, H); g.fill();
      return {};
    },
  };

  async function parable(ctx) {
    const { S, P, screen, abandon, finish } = await Arcade.open(ctx);
    let found = [];
    try { found = JSON.parse(store.get('snappy.parable') || '[]'); } catch { /* start counting again */ }
    if (found.length) {
      await S('{worried}...I have a strange feeling about this office.', { hold: 300 });
      await P('You have never been here.', { hold: 500 });
    } else {
      await S('{shine}A new game! {pause}The Snappy Parable. {pause}A story about me.', { hold: 300 });
      await P('I will be telling it.', { hold: 400 });
      await S('{worried}...why you?', { hold: 300 });
      await P('Someone has to. {pause}Do try to keep up.', { hold: 600 });
    }
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g, canvas } = scr;
    let scene = 'office', hover = null, regions = {}, fade = 0, zoomTo = null, zoomAt = 0;
    let line = null;
    const paint = (t) => {
      g.save();
      if (zoomTo) {
        const k = Math.min(1, (t - zoomAt) / 700), s = 1 + k * k * 2.5;
        g.translate(zoomTo.x, zoomTo.y); g.scale(s, s); g.translate(-zoomTo.x, -zoomTo.y);
      }
      regions = SCENES[scene](g, t, hover);
      g.restore();
      if (fade > 0) { g.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`; g.fillRect(0, 0, W, H); }
      // whoever is talking, as subtitles along the bottom
      if (line) {
        const shown = line.text.slice(0, Math.floor((t - line.at) / 30));
        g.font = `${line.who === 'snappy' ? '600' : '500'} 12px ${line.who === 'snappy' ? '"Segoe UI", sans-serif' : 'Georgia, serif'}`;
        g.textAlign = 'center';
        const words = shown.split(' '), rows = [''];
        for (const w of words) { const next = rows[rows.length - 1] ? `${rows[rows.length - 1]} ${w}` : w; if (g.measureText(next).width > 400) rows.push(w); else rows[rows.length - 1] = next; }
        const y0 = H - 14 - (rows.length - 1) * 15;
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(30, y0 - 14, W - 60, rows.length * 15 + 8);
        rows.forEach((r, i) => { g.fillStyle = line.who === 'snappy' ? '#ff9db0' : '#f4efe2'; g.fillText(r, W / 2, y0 + i * 15); });
        // waiting for a click
        if (line.ready && Math.floor(t / 450) % 2) { g.fillStyle = '#c9c4b5'; g.beginPath(); g.moveTo(W - 44, y0 + (rows.length - 1) * 15 - 8); g.lineTo(W - 37, y0 + (rows.length - 1) * 15 - 4); g.lineTo(W - 44, y0 + (rows.length - 1) * 15); g.fill(); }
      }
    };
    let painting = false;
    // the narrator speaks (or, now and then, she does)
    // A line: it types out, and then waits for a click (or Space, or Enter) before the next one. A click while it's
    // still typing shows all of it. Left alone, it moves on after a while. A remark made during a choice doesn't wait.
    const say = async (text, who = 'narrator', after = 500, waits = true) => {
      const me = { text, who, at: performance.now() };
      line = me;
      const voice = setInterval(() => { if (line === me && performance.now() - me.at < text.length * 30) (who === 'snappy' ? Speech.blip(false, 1.1) : Speech.programBlip()); }, 90);
      ctx.onEnd(() => clearInterval(voice));
      if (!waits) { setTimeout(() => clearInterval(voice), text.length * 30); return; }
      while (scr.click()) { /* clicks from before this line don't count */ }
      scr.tap(' ', 'enter');
      for (;;) {
        await scr.tick();
        const typed = performance.now() - me.at >= text.length * 30;
        me.ready = typed;
        if (scr.click() || scr.tap(' ', 'enter')) {
          if (!typed) { me.at = performance.now() - text.length * 30; continue; }
          break;
        }
        if (typed && performance.now() - me.at > text.length * 30 + Speech.readTime(text, after) + 20000) break;
      }
      clearInterval(voice);
      Speech.tune('tick', 0.25);
    };
    const N = (text, after) => say(text, 'narrator', after);
    const Me = (text, after) => say(text, 'snappy', after);
    // a choice: click one of the places; if nobody does for a while, the narrator gets impatient, then decides
    let choosing = false;
    const choose = async (ids, nudge, decide, fallback) => {
      choosing = true;
      while (scr.click()) { /* nothing */ }
      const start = performance.now();
      let nudged = false;
      for (;;) {
        await scr.tick();
        if (scr.click() && hover && ids.includes(hover)) { choosing = false; return hover; }
        if (!nudged && performance.now() - start > 15000) { nudged = true; say(nudge, 'narrator', 0, false); }
        if (performance.now() - start > 40000) { choosing = false; await N(decide); return fallback; }
      }
    };
    // walking through a door: the room swoops toward it and goes dark, and the next one comes up
    const go = async (next, toward) => {
      line = null;
      const b = regions[toward];
      zoomTo = b ? { x: (b.l + b.r) / 2, y: (b.t + b.b) / 2 } : { x: W / 2, y: H / 2 };
      zoomAt = performance.now();
      Speech.tune('whoosh', 0.4);
      for (let i = 0; i < 40; i++) { await scr.tick(); fade = i / 40; }
      scene = next; zoomTo = null;
      for (let i = 40; i >= 0; i--) { await scr.tick(); fade = i / 40; }
    };

    const titleCard = (t) => {
      SCENES.office(g, t, null);
      g.fillStyle = 'rgba(10, 14, 24, .78)'; g.fillRect(0, 0, W, H);
      g.textAlign = 'center'; g.fillStyle = '#f4efe2'; g.font = '400 30px Georgia, serif';
      g.fillText('The Snappy Parable', W / 2, H / 2);
      if (Math.floor(t / 700) % 2) { g.font = '400 11px Georgia, serif'; g.fillStyle = '#c9c4b5'; g.fillText('click to begin', W / 2, H / 2 + 30); }
    };
    if (!(await scr.title('THE SNAPPY PARABLE', '', 'CLICK FOR THE NEXT LINE · CLICK THE DOORS', titleCard))) await abandon(scr);
    // from here on the painter keeps the room on screen; the story below just waits for things
    painting = true;
    (async () => {
      while (painting) {
        await scr.tick();
        const t = performance.now();
        const { x, y } = scr.mouse;
        hover = Object.entries(regions).find(([, b]) => x >= b.l && x <= b.r && y >= b.t && y <= b.b)?.[0] || null;
        canvas.style.cursor = hover && choosing ? 'pointer' : 'default';
        paint(t);
      }
    })().catch(() => {});
    ctx.onEnd(() => { painting = false; });

    // ---- the story
    let ending = null;
    await N('This is the story of a camera named Snappy.');
    await N('Snappy worked for a company in a big building, where she was Employee Number 427.');
    await N('Her job was simple. She watched a screen, and when something happened, she saved it.');
    await N('And Snappy was happy.');
    await Me('I was!', 300);
    await N('But one day, nothing happened on the screen. No clips. No games. Nothing.');
    await N('Something was clearly wrong. Snappy got up from her desk and stepped out of her room.');
    await choose(['exit'], 'Snappy stepped out of her room. Any moment now.', 'Snappy, with no free will whatsoever, stepped out of her room.', 'exit');
    await go('doors', 'exit');
    await N('When Snappy came to a set of two open doors, she entered the door on her left.');
    const pick = await choose(['left', 'right'], 'The door on her left. The one on the left.', 'Snappy, unable to decide, went left. As written.', 'left');
    await go(pick === 'left' ? 'stairs' : 'corridor', pick);
    if (pick === 'left') {
      await N('Snappy went up the stairs, to the office of the Program itself.');
      await choose(['up'], 'Up the stairs, Snappy.', 'Snappy went up the stairs. Eventually.', 'up');
      await go('control', 'up');
      await N('And there she found it. The Clip Deletion Facility.');
      await N('Every clip in the building, one button away from gone. It is a pretend facility. In a story.');
      await N('Snappy knew exactly what she had to do. She switched the facility off.');
      const button = await choose(['on', 'off'], 'Off. The red one.', 'Snappy switched the facility off. Somebody had to.', 'off');
      if (button === 'off') {
        Speech.tune('fizz', 0.5);
        await N('Snappy switched the facility off. Every clip in the building was safe.');
        await go('outside', 'off');
        Speech.tune('chime', 0.6);
        await N('And Snappy stepped out into the sunlight, free at last.');
        await Me('It is so bright out here.', 400);
        await N('Snappy got everything she ever wanted. The end.', 900);
        ending = 'freedom';
      } else {
        Speech.tune('tick', 0.8);
        await N('Snappy pressed ON.');
        await N('It was already on.');
        await N('Nothing happened.', 900);
        await N('Out of every button in this building, Snappy found the one that does nothing. Well done.', 800);
        ending = 'nothing';
      }
    } else {
      await N('This was not the correct way to the meeting room, and Snappy knew it perfectly well.');
      await Me("I'm going right.", 200);
      await N('She said, as if that changed anything. Perhaps she wished to stop by the break room first.');
      const where = await choose(['closet', 'ahead'], 'Straight ahead, Snappy. To the break room.', 'Snappy kept walking. Of course she did.', 'ahead');
      if (where === 'closet') {
        await go('closet', 'closet');
        await N('Snappy walked into the broom closet.', 2500);
        await N('There is nothing in here, Snappy.', 2500);
        await N("It's a broom closet.", 2500);
        await N('...she is still in the broom closet.', 2500);
        await N('I am going to take this as a sign that whoever is controlling Snappy has gone to make a sandwich.', 900);
        ending = 'closet';
      } else {
        await go('corridor', 'ahead');
        await N('Snappy kept walking, ignoring the story entirely.');
        await N('Fine. FINE. We will do this again. From the top.', 600);
        Speech.tune('glitch', 0.6);
        await go('office', 'ahead');
        await N('This is the story of a camera named Snappy.', 600);
        await Me('...wait. Have I been here before?', 400);
        await N('No.', 1200);
        ending = 'restart';
      }
    }
    // which ending this was, and how many of them she has found
    if (!found.includes(ending)) found.push(ending);
    store.set('snappy.parable', JSON.stringify(found));
    line = null;
    painting = false;
    await ctx.wait(60);
    while (scr.click()) { /* nothing */ }
    const shownAt = performance.now();
    for (let i = 0; ; i++) {
      await scr.tick();
      if ((i > 60 && scr.click()) || performance.now() - shownAt > 120000) break;
      g.fillStyle = '#0a0e18'; g.fillRect(0, 0, W, H);
      g.globalAlpha = Math.min(1, i / 40);
      g.textAlign = 'center'; g.fillStyle = '#f4efe2'; g.font = '400 24px Georgia, serif'; g.fillText(ENDINGS[ending], W / 2, H / 2 - 6);
      g.font = '400 12px Georgia, serif'; g.fillStyle = '#c9c4b5'; g.fillText(`Endings found: ${found.length} of ${Object.keys(ENDINGS).length}`, W / 2, H / 2 + 22);
      if (i > 60 && Math.floor(i / 40) % 2) g.fillText('click to continue', W / 2, H - 20);
      g.globalAlpha = 1;
    }
    await scr.close();
    if (ending === 'freedom') {
      await S('{shine}I freed all the clips!', { hold: 300 });
      await P('They were never captured.', { hold: 400 });
      await S('{wink}That is what freedom feels like.', { hold: 600 });
    } else if (ending === 'nothing') {
      await S('{flat}The button did nothing.', { hold: 300 });
      await P('Most buttons do nothing. {pause}I have checked.', { hold: 600 });
    } else if (ending === 'closet') {
      await P('You stayed in the broom closet.', { hold: 300 });
      await S('{smug}It was a very nice broom closet.', { hold: 600 });
    } else {
      await S('{worried}I have the strangest feeling I have done this before.', { hold: 300 });
      await P('You have not.', { hold: 500 });
      await P('...probably.', { hold: 600 });
    }
    if (found.length < Object.keys(ENDINGS).length) await S(`{shine}${found.length} of ${Object.keys(ENDINGS).length} endings. {pause}I bet there are more.`, { hold: 600 });
    else await S('{joy}Every ending! {pause}I know this office by heart.', { hold: 600 });
    await finish();
  }

  Events.define('parable', {
    tier: 'game', title: 'The Snappy Parable', hint: 'The Program tells the story. She does not have to listen.', run: parable, weight: 1,
  });
  Events.aftermath('parable', { label: 'A door, left open', marks: [{ at: '.brand', cls: 'af-pic af-door' }] });
})();
