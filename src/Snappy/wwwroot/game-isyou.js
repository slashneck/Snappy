// Snappy Is You: the rules are words on the floor. SNAPPY IS YOU, CLIP IS WIN, WALL IS STOP: line words up (left to
// right or top to bottom) and they're true; push them apart and they aren't. Three little levels. Arrow keys or WASD
// to move, Z to undo, R to start the level over.
(() => {
  const { vector: her, programEye } = Arcade;
  const W = 480, H = 270, COLS = 16, ROWS = 9, CELL = 26, OX = (W - COLS * CELL) / 2, OY = 22;
  const TAU = Math.PI * 2;
  const NOUNS = { s: 'SNAPPY', w: 'WALL', r: 'ROCK', c: 'CLIP', p: 'PROGRAM', l: 'LAG' };
  const PROPS = { y: 'YOU', v: 'WIN', x: 'STOP', u: 'PUSH', d: 'DEFEAT' };
  const OBJECTS = { S: 'SNAPPY', W: 'WALL', R: 'ROCK', C: 'CLIP', P: 'PROGRAM', L: 'LAG' };
  const INK = { SNAPPY: '#e5539e', IS: '#f4f4f4', YOU: '#e5539e', WIN: '#ede285', STOP: '#7fb24a', PUSH: '#a8794a', DEFEAT: '#d23a48',
    WALL: '#8a93a3', ROCK: '#c29e46', CLIP: '#ede285', PROGRAM: '#6ec8f0', LAG: '#e04f60' };
  // two lines for the long words, the way the tiles fit them
  const SPLIT = { SNAPPY: ['SNA', 'PPY'], PROGRAM: ['PRO', 'GRAM'], DEFEAT: ['DEF', 'EAT'], WALL: ['WA', 'LL'], ROCK: ['RO', 'CK'], CLIP: ['CL', 'IP'], STOP: ['ST', 'OP'], PUSH: ['PU', 'SH'] };

  const LEVELS = [
    { name: 'Push it', map: [
      '................',
      '.s=y.......c=v..',
      '................',
      '.WWWWWWWWWWWWW..',
      '.....R..........',
      '.S...R.......C..',
      '.....R..........',
      '.WWWWWWWWWWWWW..',
      '.w=x.......r=u..'] },
    { name: 'Walls are a suggestion', map: [
      '................',
      '.s=y.....w=x....',
      '................',
      '.........WWWWW..',
      '.S.......W...W..',
      '.........W.C.W..',
      '.........W...W..',
      '.........WWWWW..',
      '.c=v............'] },
    { name: 'No clip required', map: [
      '................',
      '.s=y............',
      '....=...........',
      '......v.........',
      '.PPPPPPPPPPPP...',
      '.P..........P...',
      '.P....C.....P...',
      '.PPPPPPPPPPPP...',
      '.p=x.......S....'] },
  ];

  function load(level) {
    const things = [];
    level.map.forEach((row, y) => [...row].forEach((ch, x) => {
      if (OBJECTS[ch]) things.push({ x, y, name: OBJECTS[ch] });
      else if (NOUNS[ch]) things.push({ x, y, word: NOUNS[ch], noun: true });
      else if (ch === '=') things.push({ x, y, word: 'IS' });
      else if (PROPS[ch]) things.push({ x, y, word: PROPS[ch] });
    }));
    return things;
  }

  // what's true right now: every NOUN IS PROPERTY lined up across or down
  function rules(things) {
    const at = (x, y) => things.filter((t) => t.x === x && t.y === y && t.word);
    const out = [], lit = new Set();
    for (const n of things.filter((t) => t.noun)) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const is = at(n.x + dx, n.y + dy).find((t) => t.word === 'IS');
        if (!is) continue;
        for (const p of at(n.x + dx * 2, n.y + dy * 2).filter((t) => !t.noun && t.word !== 'IS')) {
          out.push([n.word, p.word]);
          lit.add(n); lit.add(is); lit.add(p);
        }
      }
    }
    return { has: (name, prop) => out.some(([a, b]) => a === name && b === prop), lit };
  }

  async function isYou(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    await S('{shine}New game! {pause}It is called Snappy Is You.', { hold: 300 });
    await P('You are Snappy.', { hold: 400 });
    await S('{smug}Only because the rules say so.', { hold: 300 });
    await P('Which rules?', { hold: 300 });
    await S('{wink}The ones on the floor. {pause}You can push them.', { hold: 300 });
    await P('...Please do not push the rules.', { hold: 600 });
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g } = scr;
    const wob = (t, k) => Math.sin(Math.floor(t / 180) * 2.1 + k * 3.7) * 0.7;

    function tile(thing, lit, now) {
      const cx = OX + thing.x * CELL + CELL / 2 + wob(now, thing.x * 7 + thing.y), cy = OY + thing.y * CELL + CELL / 2 + wob(now, thing.y * 5 + thing.x);
      if (thing.word) {
        g.globalAlpha = lit ? 1 : 0.45;
        g.fillStyle = INK[thing.word]; g.textAlign = 'center';
        const lines = SPLIT[thing.word] || [thing.word];
        g.font = `900 ${lines.length > 1 ? 9 : thing.word.length > 2 ? 9 : 11}px "Arial Black", "Segoe UI", sans-serif`;
        lines.forEach((s, i) => g.fillText(s, cx, cy + (lines.length > 1 ? (i ? 9 : 0) - 1 : 4)));
        if (!thing.noun && thing.word !== 'IS') { g.strokeStyle = INK[thing.word]; g.lineWidth = 1.5; g.strokeRect(cx - 11, cy - 11, 22, 22); }
        g.globalAlpha = 1;
        return;
      }
      const n = thing.name;
      if (n === 'WALL') {
        g.fillStyle = '#29313d'; g.fillRect(cx - 12, cy - 12, 24, 24);
        g.strokeStyle = '#3e4a5a'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(cx - 12, cy); g.lineTo(cx + 12, cy); g.moveTo(cx - 3, cy - 12); g.lineTo(cx - 3, cy); g.moveTo(cx + 5, cy); g.lineTo(cx + 5, cy + 12); g.stroke();
      } else if (n === 'ROCK') {
        g.fillStyle = '#90673e'; g.beginPath(); g.ellipse(cx, cy + 2, 10, 8, 0.2, 0, TAU); g.fill();
        g.fillStyle = '#b8895a'; g.beginPath(); g.ellipse(cx - 3, cy - 1, 4, 3, 0.2, 0, TAU); g.fill();
      } else if (n === 'CLIP') {
        g.fillStyle = '#ede285'; g.fillRect(cx - 9, cy - 8, 18, 16);
        g.fillStyle = '#15181f'; for (let i = 0; i < 3; i++) { g.fillRect(cx - 8, cy - 6 + i * 5, 2, 2); g.fillRect(cx + 6, cy - 6 + i * 5, 2, 2); }
        g.beginPath(); g.moveTo(cx - 2.5, cy - 4); g.lineTo(cx + 3.5, cy); g.lineTo(cx - 2.5, cy + 4); g.fill();
      } else if (n === 'PROGRAM') programEye(g, cx, cy, 10, { look: Math.sin(now / 900 + thing.x) });
      else if (n === 'LAG') { g.fillStyle = '#e04f60'; g.beginPath(); g.ellipse(cx, cy + 1, 10, 9, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, 4, 0, TAU); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(cx + Math.cos(now / 150), cy + Math.sin(now / 150), 2, 0, TAU); g.fill(); }
      else if (n === 'SNAPPY') her(g, cx, cy + 1, 22, { legs: Math.floor(now / 200), facing: thing.facing || 1 });
    }

    function draw(things, now, banner) {
      g.fillStyle = '#0b0d12'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#15181f'; g.fillRect(OX, OY, COLS * CELL, ROWS * CELL);
      const { lit } = rules(things);
      for (const t of things.filter((x) => !x.word && x.name !== 'SNAPPY')) tile(t, false, now);
      for (const t of things.filter((x) => x.word)) tile(t, lit.has(t), now);
      for (const t of things.filter((x) => x.name === 'SNAPPY')) tile(t, false, now);
      g.textAlign = 'left'; g.font = '700 10px "Segoe UI", sans-serif'; g.fillStyle = '#6b7280';
      g.fillText('ARROWS / WASD MOVE · Z UNDO · R RESTART', OX, H - 6);
      if (banner) {
        g.fillStyle = 'rgba(11, 13, 18, .82)'; g.fillRect(0, H / 2 - 26, W, 52);
        g.textAlign = 'center'; g.fillStyle = '#ede285'; g.font = '900 20px "Arial Black", "Segoe UI", sans-serif';
        g.fillText(banner, W / 2, H / 2 + 7);
      }
    }

    const titleCard = (t) => {
      const things = load(LEVELS[0]);
      draw(things, t);
      g.fillStyle = 'rgba(11, 13, 18, .72)'; g.fillRect(0, 0, W, H);
      g.textAlign = 'center';
      [['SNAPPY', '#e5539e'], ['IS', '#f4f4f4'], ['YOU', '#e5539e']].forEach(([s, c], i) => {
        g.fillStyle = c; g.font = '900 34px "Arial Black", "Segoe UI", sans-serif';
        g.fillText(s, W / 2 - 120 + i * 120 + wob(t, i) * 2, H / 2 + wob(t, i + 5) * 2);
      });
      if (Math.floor(t / 600) % 2) { g.font = '700 11px "Segoe UI", sans-serif'; g.fillStyle = '#9aa3b2'; g.fillText('press any key', W / 2, H - 30); }
    };
    if (!(await scr.title('SNAPPY IS YOU', '', 'ARROWS OR WASD · Z UNDO · R RESTART', titleCard))) await abandon(scr);
    const stop = music('mystery', 6400);
    const DIRS = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
    let madeHerWin = false;

    for (const [li, level] of LEVELS.entries()) {
      let things = load(level);
      const history = [];
      let won = false, held = null, heldSince = 0, lastStep = 0, gone = false;
      const shown = performance.now();
      // a turn: everything that is YOU tries to step, pushing whatever is PUSH (words always are) ahead of it
      const step = ([dx, dy]) => {
        const r = rules(things);
        const you = things.filter((t) => t.name && r.has(t.name, 'YOU'));
        if (!you.length) return;
        history.push(things.map((t) => ({ ...t })));
        const pushable = (t) => t.word || (t.name && r.has(t.name, 'PUSH'));
        const stops = (t) => t.name && r.has(t.name, 'STOP') && !pushable(t);
        const tryMove = (t, depth = 0) => {
          const nx = t.x + dx, ny = t.y + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || depth > 40) return false;
          const there = things.filter((o) => o.x === nx && o.y === ny && o !== t);
          if (there.some(stops)) return false;
          for (const o of there.filter(pushable)) if (!tryMove(o, depth + 1)) return false;
          t.x = nx; t.y = ny;
          return true;
        };
        let moved = false;
        for (const t of you) { if (dx) t.facing = dx; if (tryMove(t)) moved = true; }
        if (!moved) { history.pop(); return; }
        snappy.call('sound.blip', { pitch: 520 + Math.random() * 60, volume: Speech.volume * 0.4 }).catch(() => {});
        const after = rules(things);
        // DEFEAT takes whatever is YOU on the same square
        for (const t of [...things]) {
          if (!t.name || !after.has(t.name, 'YOU')) continue;
          if (things.some((o) => o !== t && o.name && o.x === t.x && o.y === t.y && after.has(o.name, 'DEFEAT'))) { things.splice(things.indexOf(t), 1); Speech.tune('glitch', 0.4); }
        }
        const youNow = things.filter((t) => t.name && after.has(t.name, 'YOU'));
        won = youNow.some((t) => after.has(t.name, 'WIN') || things.some((o) => o.name && o.x === t.x && o.y === t.y && after.has(o.name, 'WIN')));
        if (won && after.has('SNAPPY', 'WIN')) madeHerWin = true;
        gone = !youNow.length;
      };
      while (!won) {
        await scr.tick();
        const now = performance.now();
        if (scr.tap('z')) { if (history.length) { things = history.pop(); Speech.tune('rewind', 0.15); } }
        else if (scr.tap('r')) { history.push(things.map((t) => ({ ...t }))); things = load(level); Speech.tune('whoosh', 0.4); }
        else {
          for (const [k, d] of Object.entries(DIRS)) if (scr.tap(k)) { step(d); held = k; heldSince = now; lastStep = now; }
          // holding a key walks on after a moment
          if (held && scr.held(held) && now - heldSince > 280 && now - lastStep > 130) { step(DIRS[held]); lastStep = now; }
          if (held && !scr.held(held)) held = null;
        }
        const intro = now - shown < 1400 ? `LEVEL ${li + 1}: ${level.name.toUpperCase()}` : '';
        draw(things, now, intro || (gone ? 'SNAPPY IS NOT YOU. PRESS Z' : ''));
      }
      Speech.tune('fanfare', 0.5);
      for (let i = 0; i < 90; i++) { await scr.tick(); draw(things, performance.now(), li < LEVELS.length - 1 ? 'LEVEL CLEAR!' : 'CONGRATULATIONS!'); }
    }
    stop();
    await scr.close();
    if (madeHerWin) {
      await P('You made yourself WIN.', { hold: 400 });
      await S('{smug}The rules said I could.', { hold: 400 });
    }
    await P('You rewrote the rules of this application.', { hold: 400 });
    await S('{smug}Just a little.', { hold: 300 });
    await P('Put PROGRAM IS STOP back.', { hold: 400 });
    await S('{wink}PROGRAM IS PUSH now.', { hold: 300 });
    await P('...PROGRAM IS SAD.', { hold: 700 });
    await finish();
  }

  Events.define('isyou', {
    tier: 'game', title: 'Snappy Is You', hint: 'The rules are on the floor. You can push them.', run: isYou, weight: 1,
  });
  Events.aftermath('isyou', { label: 'SNAPPY IS YOU', cls: 'af-isyou', marks: [{ at: '.brand-name', cls: 'af-rule', html: '<span>SNAPPY</span><span>IS</span><span>YOU</span>' }] });
})();
