// Snap-Man: a maze, frames to eat, and the Lag's minions after her. The big frames are a flash: for a few seconds
// the minions run, and she can send them back to their pen. Arrow keys or WASD. One life, and the high score to beat.
(() => {
  const { snappy: her, minion, text, PAL } = Arcade;
  const CELL = 16;
  const MAZE = [
    '###################',
    '#o.......#.......o#',
    '#.##.###.#.###.##.#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...G...#....#',
    '####.###.#.###.####',
    '#.................#',
    '#.##.###.#.###.##.#',
    '#o.......P.......o#',
    '###################',
  ];
  const COLS = MAZE[0].length, ROWS = MAZE.length, W = COLS * CELL, H = ROWS * CELL + 14;
  const DIRS = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
  // the four of them in the old ghost colours: red, pink, cyan and orange
  const TINTS = ['none', 'hue-rotate(-25deg) brightness(1.35)', 'hue-rotate(175deg) brightness(1.2)', 'hue-rotate(35deg) saturate(1.6) brightness(1.15)'];

  async function snapman(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    const before = Arcade.top('snapman');
    if (Events.has('snapman') && before !== null) {
      await S(`{shine}Snap-Man! {pause}Round two. {pause}High score: ${before}.`, { hold: 300 });
      await P('The minions remember you.', { hold: 500 });
      await S('{smug}Good. {pause}So do I.', { hold: 300 });
    } else {
      await S('{shine}Snap-Man! {pause}I eat frames.', { hold: 300 });
      await P('The Lag eats frames.', { hold: 500 });
      await S('{smug}Not if I eat them first.', { hold: 300 });
      await P('That is not how anything works.', { hold: 600 });
    }
    const scr = await screen({ w: W, h: H });
    const { g } = scr;
    if (!(await scr.title('SNAP-MAN', 'EAT EVERY FRAME', 'ARROW KEYS OR WASD'))) await abandon(scr);
    const stop = music('platform', 3200);
    const open = (c, r) => MAZE[r]?.[c] !== undefined && MAZE[r][c] !== '#';
    const dots = new Map();
    let start, pen;
    MAZE.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.' || ch === 'o') dots.set(`${c},${r}`, ch === 'o');
      if (ch === 'P') start = [c, r];
      if (ch === 'G') pen = [c, r];
    }));
    const total = dots.size;
    const me = { x: 0, y: 0, dir: [0, 0], next: [0, 0] };
    // they leave the pen one at a time, the first after a moment's head start
    const foes = [0, 1, 2, 3].map((i) => ({ i, x: 0, y: 0, dir: [i % 2 ? 1 : -1, 0], wait: 150 + i * 110 }));
    const place = () => {
      me.x = start[0] * CELL; me.y = start[1] * CELL; me.dir = [0, 0]; me.next = [0, 0];
      foes.forEach((f) => { f.x = pen[0] * CELL; f.y = pen[1] * CELL; f.wait = 150 + f.i * 110; });
    };
    place();
    let lives = 1, score = 0, scared = 0, frame = 0, won = false;
    const hi = before || 0, ready = performance.now() + 1800;
    const centered = (e) => e.x % CELL === 0 && e.y % CELL === 0;
    const cellOf = (e) => [e.x / CELL, e.y / CELL];
    // the arcade look: black, blue-outlined walls, little dots, ghost colours, and the scores along the top
    const wall = (c, r) => !MAZE[r] || MAZE[r][c] === undefined || MAZE[r][c] === '#';
    const draw = (t, afraid) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.save();
      g.translate(0, 14);
      g.fillStyle = '#2121ff';
      MAZE.forEach((row, r) => [...row].forEach((ch, c) => {
        if (ch !== '#') return;
        const x = c * CELL, y = r * CELL, up = !wall(c, r - 1), down = !wall(c, r + 1), left = !wall(c - 1, r), right = !wall(c + 1, r);
        const x0 = left ? x + 3 : x, x1 = right ? x + CELL - 3 : x + CELL, y0 = up ? y + 3 : y, y1 = down ? y + CELL - 3 : y + CELL;
        if (up) g.fillRect(x0, y + 3, x1 - x0, 2);
        if (down) g.fillRect(x0, y + CELL - 5, x1 - x0, 2);
        if (left) g.fillRect(x + 3, y0, 2, y1 - y0);
        if (right) g.fillRect(x + CELL - 5, y0, 2, y1 - y0);
      }));
      for (const [key, big] of dots) {
        const [c, r] = key.split(',').map(Number);
        g.fillStyle = '#ffb8ae';
        if (big) { if (Math.floor(t / 200) % 2) { g.fillRect(c * CELL + 5, r * CELL + 4, 6, 8); g.fillRect(c * CELL + 4, r * CELL + 5, 8, 6); } }
        else g.fillRect(c * CELL + 7, r * CELL + 7, 2, 2);
      }
      for (const f of foes) {
        g.save();
        g.filter = afraid ? (scared - t < 1500 && Math.floor(t / 150) % 2 ? 'grayscale(1) brightness(2.2)' : 'hue-rotate(225deg) saturate(2.5) brightness(.9)') : TINTS[f.i];
        minion(g, f.x, f.y, Math.floor(t / 180));
        g.restore();
      }
      const facing = me.dir[0] < 0 ? -1 : 1;
      her(g, me.x + 1, me.y, { facing, step: Math.floor(frame / 6), eyes: lives <= 0 ? 'x' : Math.floor(frame / 8) % 2 && (me.dir[0] || me.dir[1]) ? 'closed' : 'open' });
      g.restore();
      text(g, '1UP', 20, 6, { size: 6, color: '#fff' });
      text(g, String(score).padStart(2, '0'), 36, 13, { size: 7, color: '#fff', align: 'right' });
      text(g, 'HIGH SCORE', W / 2, 6, { size: 6, color: '#fff', align: 'center' });
      text(g, String(Math.max(hi, score)).padStart(2, '0'), W / 2 + 14, 13, { size: 7, color: score > hi && hi ? '#ffb8ae' : '#fff', align: 'right' });
      text(g, `${total - dots.size}/${total}`, W - 6, 13, { size: 7, color: '#ffe14a', align: 'right' });
    };
    while (lives > 0 && !won) {
      await scr.tick();
      const t = performance.now();
      // READY! first, the way it always starts
      if (t < ready) { draw(t, false); text(g, 'READY!', W / 2, 14 + 7 * CELL + 12, { size: 9, color: '#ffe14a', align: 'center' }); continue; }
      frame++;
      for (const [k, d] of Object.entries(DIRS)) if (scr.held(k)) me.next = d;
      // a turn asked for a few pixels too late still counts: back to the middle of the square, and round the corner
      if (!centered(me) && (me.next[0] !== me.dir[0] || me.next[1] !== me.dir[1]) && me.dir[0] * me.next[0] + me.dir[1] * me.next[1] === 0) {
        const c = Math.round(me.x / CELL), r = Math.round(me.y / CELL);
        if (Math.abs(me.x - c * CELL) + Math.abs(me.y - r * CELL) <= 4 && open(c + me.next[0], r + me.next[1])) { me.x = c * CELL; me.y = r * CELL; }
      }
      // she turns at the middle of a square, if the way is open, and keeps going otherwise (about five squares a second)
      for (let step = 0; step < (frame % 3 === 0 ? 2 : 1); step++) {
        if (centered(me)) {
          const [c, r] = cellOf(me);
          if (open(c + me.next[0], r + me.next[1])) me.dir = me.next;
          if (!open(c + me.dir[0], r + me.dir[1])) me.dir = [0, 0];
          const key = `${c},${r}`;
          if (dots.has(key)) {
            if (dots.get(key)) { scared = t + 6000; score += 50; Speech.tune('coin', 0.5); }
            else { score += 10; if (frame % 3 === 0) snappy.call('sound.blip', { pitch: 1200, volume: Speech.volume * 0.5 }).catch(() => {}); }
            dots.delete(key);
            if (!dots.size) won = true;
          }
        }
        me.x += me.dir[0];
        me.y += me.dir[1];
      }
      // the minions: chasing her, or running from her
      const afraid = t < scared;
      for (const f of foes) {
        if (f.wait > 0) { f.wait--; continue; }
        // a little slower than her, and half that when they're scared
        const moves = afraid ? (frame % 2 ? 1 : 0) : (frame % 5 ? 1 : 0);
        for (let step = 0; step < moves; step++) {
          if (centered(f)) {
            const [c, r] = cellOf(f);
            const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter((d) => open(c + d[0], r + d[1]) && !(d[0] === -f.dir[0] && d[1] === -f.dir[1]));
            const options = ways.length ? ways : [[-f.dir[0], -f.dir[1]]];
            const dist = (d) => Math.hypot(c + d[0] - me.x / CELL, r + d[1] - me.y / CELL);
            // mostly towards her (or away when scared), with a little randomness so they don't move as one
            options.sort((p, q) => (afraid ? dist(q) - dist(p) : dist(p) - dist(q)));
            f.dir = Math.random() < 0.2 + f.i * 0.08 ? options[Math.floor(Math.random() * options.length)] : options[0];
          }
          f.x += f.dir[0];
          f.y += f.dir[1];
        }
        if (Math.abs(f.x - me.x) < 10 && Math.abs(f.y - me.y) < 10) {
          if (afraid) { f.x = pen[0] * CELL; f.y = pen[1] * CELL; f.wait = 120; score += 200; Speech.tune('tick', 0.8); }
          else { lives--; break; }
        }
      }
      draw(t, afraid);
    }
    stop();
    if (!won) Speech.tune('crash', 0.25);
    const record = Arcade.best('snapman', score);
    for (let i = 0; i < 130; i++) {
      await scr.tick();
      draw(performance.now(), false);
      text(g, won ? 'ALL FRAMES EATEN!' : 'GAME  OVER', W / 2, 14 + 7 * CELL + 12, { size: 9, color: won ? '#ffe14a' : '#ff2020', align: 'center' });
      if (record.beat && record.old !== null && Math.floor(i / 10) % 2) text(g, 'NEW HIGH SCORE!', W / 2, 14 + 5 * CELL + 12, { size: 8, color: '#ffb8ae', align: 'center' });
    }
    await scr.close();
    if (won) {
      await S('{joy}Every single frame! {pause}Mine!', { hold: 400 });
      await P(`You ate ${total} frames. {pause}That is about one second of a clip.`, { hold: 600 });
      await S('{wink}A delicious second.', { hold: 700 });
    } else if (record.beat && record.old !== null) {
      await S(`{joy}${score} points! {pause}A new high score!`, { hold: 400 });
      await P('The Lag still got you.', { hold: 600 });
      await S('{smug}After I got the high score.', { hold: 700 });
    } else {
      await S('{sad}The Lag got me...', { hold: 400 });
      await P('One touch. {pause}That is all it takes.', { hold: 600 });
      await S('{angry}It had FRIENDS!', { shout: true, hold: 700 });
    }
    await finish();
  }

  Events.define('snapman', {
    tier: 'game', title: 'Snap-Man', hint: 'Somebody has to eat the frames before the Lag does.', run: snapman, weight: 1, after: ['framedrop'], again: true,
  });
})();
