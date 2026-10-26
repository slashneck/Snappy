// Doodle Snappy: she bounces up on her own; steer with the mouse or the arrow keys. Springs send her flying, brown
// platforms snap in half, the Lag's minions knock her down unless she lands on them, and a propeller hat carries her
// up for a while. One fall and it's over. All of it drawn in pen on graph paper.
(() => {
  const { vector: her, FONTS } = Arcade;
  const W = 180, H = 270, TAU = Math.PI * 2;
  const PEN = '#2b2620';

  // a stroke drawn twice, a little off, the way a pen does
  function inked(g, path, width = 1.2) {
    g.strokeStyle = PEN; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
    g.stroke(path);
    g.save(); g.translate(0.35, 0.3); g.globalAlpha = 0.45; g.stroke(path); g.restore();
  }
  function scribble(g, s, x, y, size, color = PEN, align = 'left') {
    g.font = `bold ${size}px ${FONTS.hand}`;
    g.textAlign = align;
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  function platform(g, p, y) {
    const x = p.x, w = p.w;
    const colors = { still: ['#9be05a', '#5a9e2c'], moving: ['#8fd3f5', '#3d8fc0'], brittle: ['#c9965c', '#8a5a2c'] }[p.kind];
    const halves = p.broken ? [[-1, p.broken], [1, p.broken]] : [[0, 0]];
    for (const [side, t] of halves) {
      g.save();
      if (side) { g.translate(x + w / 2 + side * (2 + t * 6), y + t * t * 1.5); g.rotate(side * t * 0.06); g.translate(-(x + w / 2), -y); }
      const body = new Path2D();
      if (side < 0) body.roundRect(x, y, w / 2, 7, [3.5, 0, 0, 3.5]);
      else if (side > 0) body.roundRect(x + w / 2, y, w / 2, 7, [0, 3.5, 3.5, 0]);
      else body.roundRect(x, y, w, 7, 3.5);
      const fill = g.createLinearGradient(0, y, 0, y + 7);
      fill.addColorStop(0, colors[0]); fill.addColorStop(1, colors[1]);
      g.fillStyle = fill; g.fill(body);
      g.fillStyle = 'rgba(255, 255, 255, .45)'; g.fillRect(x + 3, y + 1.4, w - 6, 1.2);
      if (p.kind === 'brittle' && !side) { g.strokeStyle = PEN; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2 - 1.5, y + 3.5); g.lineTo(x + w / 2 + 1, y + 7); g.stroke(); }
      inked(g, body);
      g.restore();
    }
  }

  function spring(g, x, y, squash) {
    const h = squash ? 4 : 8, coil = new Path2D();
    coil.moveTo(x, y);
    for (let i = 1; i <= 4; i++) coil.lineTo(x + (i % 2 ? 3 : -3), y - (h * i) / 4);
    g.strokeStyle = '#8a8f96'; g.lineWidth = 1.6; g.stroke(coil);
    inked(g, coil, 0.6);
    const plate = new Path2D();
    plate.roundRect(x - 5, y - h - 2, 10, 2.4, 1);
    g.fillStyle = '#c9ced4'; g.fill(plate); inked(g, plate, 0.9);
  }

  // a minion, sketched: a lumpy red thing with stubby legs and one wide eye
  function sketchMinion(g, x, y, t) {
    const bob = Math.sin(t / 160) * 1.2, body = new Path2D();
    body.ellipse(x, y - 8 + bob, 9, 7.5, 0, 0, TAU);
    for (const lx of [-5, 0, 5]) { const leg = new Path2D(); leg.moveTo(x + lx, y - 2 + bob); leg.lineTo(x + lx + Math.sin(t / 90 + lx) * 1.5, y + 1); inked(g, leg); }
    g.fillStyle = '#ff6b7a'; g.fill(body);
    g.fillStyle = 'rgba(255, 255, 255, .35)'; g.beginPath(); g.ellipse(x - 3, y - 11 + bob, 3, 1.6, -0.4, 0, TAU); g.fill();
    inked(g, body);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y - 8 + bob, 3.4, 0, TAU); g.fill();
    g.fillStyle = PEN; g.beginPath(); g.arc(x + Math.cos(t / 140) * 1.4, y - 8 + bob + Math.sin(t / 140) * 1.4, 1.5, 0, TAU); g.fill();
  }

  // the propeller hat: on a platform it just sits there; on her head it spins and carries her up
  function propeller(g, x, y, t, spinning) {
    const cap = new Path2D();
    cap.moveTo(x - 7, y); cap.quadraticCurveTo(x, y - 9, x + 7, y); cap.closePath();
    g.fillStyle = '#ff5a6e'; g.fill(cap);
    g.fillStyle = '#ffd84a'; g.fillRect(x - 1.5, y - 7, 3, 7);
    inked(g, cap);
    const stem = new Path2D(); stem.moveTo(x, y - 6); stem.lineTo(x, y - 10); inked(g, stem);
    const w = spinning ? Math.abs(Math.cos(t / 40)) * 9 : 9;
    const blade = new Path2D(); blade.ellipse(x, y - 10.5, w, 1.6, 0, 0, TAU);
    g.fillStyle = '#7fd0ff'; g.fill(blade); inked(g, blade, 0.9);
  }

  function paper(g, camera) {
    g.fillStyle = '#faf5e8'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(196, 170, 120, .35)';
    for (let y = -(((camera % 9) + 9) % 9); y < H; y += 9) g.fillRect(0, Math.round(y), W, 0.6);
    for (let x = 0; x < W; x += 9) g.fillRect(x, 0, 0.6, H);
  }

  async function doodle(ctx) {
    const { S, P, screen, abandon, finish } = await Arcade.open(ctx);
    const before = Arcade.top('doodle');
    if (Events.has('doodle') && before !== null) {
      await S(`{shine}Doodle Snappy! {pause}Again! {pause}My best is ${before}.`, { hold: 300 });
      await P('Up again. {pause}Where does it end?', { hold: 500 });
      await S('{smug}Higher than last time.', { hold: 300 });
    } else {
      await S('{shine}Doodle Snappy! {pause}I just keep bouncing up.', { hold: 300 });
      await P('Where does it end?', { hold: 500 });
      await S("{smug}It doesn't. {pause}That's the point.", { hold: 300 });
      await P('That is concerning.', { hold: 600 });
    }
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g } = scr;
    const titleCard = (t) => {
      paper(g, t / 20);
      scribble(g, 'doodle', W / 2 - 2, 62, 30, '#5a9e2c', 'center');
      scribble(g, 'snappy', W / 2 + 10, 92, 26, '#e0475a', 'center');
      const hop = Math.abs(Math.sin(t / 320));
      platform(g, { x: W / 2 - 18, w: 36, kind: 'still' }, 196);
      her(g, W / 2, 182 - hop * 52, 26, { legs: hop > 0.2 ? 'air' : 0, eyes: hop > 0.5 ? 'happy' : 'open', squash: hop < 0.15 ? 0.6 : 0 });
      platform(g, { x: 16, w: 32, kind: 'moving' }, 140 + Math.sin(t / 700) * 6);
      platform(g, { x: W - 50, w: 32, kind: 'still' }, 120);
      spring(g, W - 34, 120, false);
      if (before) scribble(g, `best: ${before}`, W / 2, 222, 11, PEN, 'center');
      if (Math.floor(t / 600) % 2) scribble(g, 'press any key to play', W / 2, 242, 9, PEN, 'center');
    };
    if (!(await scr.title('DOODLE SNAPPY', '', 'MOUSE OR ← → TO STEER', titleCard))) await abandon(scr);
    const me = { x: W / 2, y: H - 60, vy: -7, fly: 0, facing: 1 };
    const plats = [];
    let camera = 0, top = H - 20, height = 0, alive = true, springAt = null, flew = false;
    // The way up is always solid: each solid platform is within an easy jump of the last. Brown ones (they snap)
    // are only ever extras in between. Higher up there are more moving ones (and faster), and more minions.
    const make = (y) => {
      const roll = Math.random(), high = y < H - 100, up = Math.min(1, -y / 9000);
      plats.push({ x: 8 + Math.random() * (W - 48), y, w: 32, kind: high && roll < 0.1 + up * 0.3 ? 'moving' : 'still', dir: Math.random() < 0.5 ? -1 : 1,
        speed: 0.8 + up * 0.7, spring: roll > 0.9, foe: y < -200 && roll > 0.3 && roll < 0.38 + up * 0.06, hat: y < -300 && roll > 0.5 && roll < 0.53,
        broken: 0, gone: false });
      if (high && Math.random() < 0.3) plats.push({ x: 8 + Math.random() * (W - 48), y: y + 14 + Math.random() * 10, w: 32, kind: 'brittle', broken: 0, gone: false });
    };
    make(top);
    Object.assign(plats[0], { x: W / 2 - 16, kind: 'still', spring: false });
    while (alive) {
      const dt = await scr.tick();
      const t = performance.now();
      // steering: the keys if held, otherwise the mouse
      const want = scr.held('arrowleft', 'a') ? -1 : scr.held('arrowright', 'd') ? 1 : 0;
      const was = me.x;
      if (want) me.x += want * 2.6 * dt;
      else me.x += (scr.mouse.x - me.x) * 0.12 * dt;
      if (Math.abs(me.x - was) > 0.2) me.facing = me.x > was ? 1 : -1;
      // off one side, back in on the other
      if (me.x < -10) me.x = W + 8;
      if (me.x > W + 10) me.x = -8;
      const flying = me.fly > t;
      if (flying) me.vy = -8;
      else me.vy = Math.min(7, me.vy + 0.24 * dt);
      const feetBefore = me.y;
      me.y += me.vy * dt;
      for (const p of plats) {
        if (p.gone) continue;
        if (p.broken) { p.broken += 0.06 * dt; if (p.broken > 3) p.gone = true; continue; }
        if (p.kind === 'moving') { p.x += p.dir * p.speed * dt; if (p.x < 0 || p.x > W - p.w) p.dir *= -1; }
        const overlap = me.x + 9 > p.x && me.x - 9 < p.x + p.w;
        if (flying) continue;
        // the propeller hat: touch it and up she goes
        if (p.hat && Math.abs(me.x - (p.x + 16)) < 12 && me.y > p.y - 26 && me.y < p.y + 4) {
          p.hat = false; me.fly = t + 2600; flew = true; Speech.tune('whoosh', 0.6); Speech.tune('fanfare', 0.3);
          continue;
        }
        // falling onto a platform: bounce (a brown one just snaps)
        if (me.vy > 0 && overlap && feetBefore <= p.y && me.y >= p.y) {
          if (p.foe) { p.foe = false; me.vy = -8; Speech.tune('tick', 0.7); continue; }
          if (p.kind === 'brittle') { p.broken = 0.01; Speech.tune('crack', 0.5); continue; }
          const onSpring = p.spring && Math.abs(me.x - (p.x + 16)) < 9;
          me.vy = onSpring ? -12.5 : -7.4;
          if (onSpring) springAt = { p, t };
          snappy.call('sound.blip', { pitch: onSpring ? 1500 : 900 + Math.random() * 100, volume: Speech.volume }).catch(() => {});
        }
        // a minion on a platform, met from the side or below: down she goes
        if (p.foe && overlap && me.y > p.y - 18 && me.y - 16 < p.y && me.vy < 0) { me.vy = 4; Speech.tune('glitch', 0.4); }
      }
      // the page scrolls with her, and new platforms appear above
      if (me.y < camera + H * 0.42) camera = me.y - H * 0.42;
      // (never more than about 80 apart: a normal bounce goes over a hundred)
      while (top > camera - 60) { top -= 28 + Math.random() * 16 + Math.min(36, -camera / 180); make(top); }
      for (const p of plats) if (p.y > camera + H + 20) p.gone = true;
      for (let i = plats.length - 1; i >= 0; i--) if (plats[i].gone && plats[i].y > camera + H) plats.splice(i, 1);
      height = Math.max(height, Math.floor((H - 60 - me.y) / 10));
      if (me.y - 16 > camera + H + 10) alive = false;

      paper(g, camera);
      for (const p of plats) {
        if (p.gone) continue;
        const y = p.y - camera;
        if (y < -30 || y > H + 10) continue;
        platform(g, p, y);
        if (p.spring && !p.broken) spring(g, p.x + 16, y, springAt?.p === p && t - springAt.t < 150);
        if (p.foe) sketchMinion(g, p.x + 16, y, t);
        if (p.hat) propeller(g, p.x + 16, y - 1, t, false);
      }
      her(g, me.x, me.y - camera - 9, 22, { facing: me.facing, legs: me.vy < -2 ? 'air' : 0, eyes: alive ? flying || me.vy < -9 ? 'joy' : 'open' : 'x',
        squash: me.vy < -6 && !flying ? -0.4 : 0 });
      if (flying) propeller(g, me.x, me.y - camera - 20, t, true);
      // the bar on top: the score, and the best so far
      g.fillStyle = 'rgba(120, 170, 220, .35)'; g.fillRect(0, 0, W, 22);
      g.fillStyle = 'rgba(80, 120, 170, .5)'; g.fillRect(0, 22, W, 1);
      scribble(g, String(height), 8, 16, 14);
      if (before) scribble(g, `best ${Math.max(before, height)}`, W - 8, 15, 9, height > before ? '#e0475a' : PEN, 'right');
    }
    Speech.tune('crash', 0.25);
    const record = Arcade.best('doodle', height);
    for (let i = 0; i < 150; i++) {
      await scr.tick();
      g.fillStyle = 'rgba(250, 245, 232, .2)'; g.fillRect(0, 70, W, 110);
      scribble(g, 'game over!', W / 2, 108, 24, '#e0475a', 'center');
      scribble(g, `your score: ${height}`, W / 2, 134, 12, PEN, 'center');
      scribble(g, `your best: ${record.best}`, W / 2, 152, 12, PEN, 'center');
      if (record.beat && record.old !== null && Math.floor(i / 10) % 2) scribble(g, 'new best!', W / 2, 172, 12, '#5a9e2c', 'center');
    }
    await scr.close();
    if (record.beat && record.old !== null) await S(`{joy}${height} high! {pause}{shine}A new best! {pause}{wink}I could see my house.`, { hold: 500 });
    else await S(`{joy}${height} high! {pause}{wink}I could see my house.`, { hold: 500 });
    if (flew) {
      await S('{shine}And the propeller hat! {pause}I FLEW!', { hold: 300 });
      await P('You are a camera in a hat.', { hold: 600 });
      await S('{smug}A FLYING camera in a hat.', { hold: 700 });
    } else {
      await P('You fell. {pause}Eventually, everyone does.', { hold: 600 });
      await S('{wink}Gravity is just a suggestion.', { hold: 700 });
    }
    await finish();
  }

  Events.define('doodle', {
    tier: 'game', title: 'Doodle Snappy', hint: 'Up, up, up. Mind the brown ones.', run: doodle, weight: 1, arcade: true, unit: 'high',
  });
})();
