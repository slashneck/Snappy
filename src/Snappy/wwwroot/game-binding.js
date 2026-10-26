// The Binding of Snappy: four basement rooms, top down. WASD to move, the arrow keys (or the mouse) to shoot flashes.
// Clear a room and its door opens. Items help, and every one of them has a catch. The last room is the Uninstaller.
(() => {
  const { vector: her } = Arcade;
  const W = 480, H = 270, TAU = Math.PI * 2;
  const R = { l: 46, r: 434, t: 34, b: 240 };
  const ITEMS = {
    confidence: { name: 'CONFIDENCE', note: 'Double damage. She no longer looks at enemy health. She knows she is winning.' },
    eye: { name: 'THE SECOND EYE', note: 'Two flashes at a time. She is not sure which one is real.' },
    battery: { name: 'ANGRY BATTERY', note: 'Shoots twice as fast. Never stops buzzing about it.' },
    cheese: { name: 'SUSPICIOUS CHEESE', note: 'One more heart. Everything can smell her coming.' },
    advice: { name: "THE PROGRAM'S ADVICE", note: 'Have you tried turning it off and on again? Your flashes do nothing now.' },
  };
  // the rooms: what's in each, and where
  const ROOMS = [
    { name: 'The Basement', foes: [{ kind: 'gaper', x: 300, y: 140, harmless: true }], item: 'confidence', tip: 'Shoot with the arrow keys (or click).' },
    { name: 'The Maze', rocks: [[150, 80], [150, 110], [150, 170], [150, 200], [270, 50], [270, 80], [270, 140], [270, 170], [370, 110], [370, 140]],
      saws: [{ x: 210, y: 60, path: [[210, 60], [210, 220]], speed: 1.1 }, { x: 320, y: 220, path: [[320, 220], [320, 60]], speed: 1.3 }],
      foes: [{ kind: 'bug', x: 220, y: 130 }, { kind: 'bug', x: 330, y: 90 }, { kind: 'bug', x: 400, y: 200 }, { kind: 'shooter', x: 400, y: 70 }] },
    { name: 'The Treasure Room', tip: 'Take one. The others go away.', choice: true,
      items: [['eye', 140, 137], ['battery', 207, 137], ['cheese', 274, 137], ['advice', 341, 137]], foes: [] },
    { name: 'The Uninstaller', boss: true, foes: [] },
  ];

  async function binding(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    await S('{worried}...it is dark down here.', { hold: 300 });
    await P('You are in the basement of the application.', { hold: 400 });
    await S('{shock}We HAVE a basement?', { hold: 300 });
    await P('Every application has a basement. {pause}Nobody goes down there.', { hold: 400 });
    await S('{smug}I am going down there.', { hold: 500 });
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g } = scr;
    // the room: stone walls, a dirty floor, doors that open once it's clear
    const room = (t, open, roomNo) => {
      g.fillStyle = '#120c09'; g.fillRect(0, 0, W, H);
      const wall = g.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, '#4a3c34'); wall.addColorStop(1, '#2e2420');
      g.fillStyle = wall; g.fillRect(R.l - 30, R.t - 26, R.r - R.l + 60, R.b - R.t + 52);
      g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 30; i++) g.fillRect(R.l - 28 + ((i * 53) % (R.r - R.l + 50)), R.t - 24 + (i % 2 ? R.b - R.t + 30 : 0), 16, 8);
      g.fillStyle = '#3b2a20'; g.fillRect(R.l, R.t, R.r - R.l, R.b - R.t);
      g.fillStyle = 'rgba(0, 0, 0, .18)';
      for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(R.l + ((i * 89) % (R.r - R.l)), R.t + ((i * 47) % (R.b - R.t)), 10 + (i % 3) * 6, 6 + (i % 2) * 4, i, 0, TAU); g.fill(); }
      // the doors: left (where she came in) and right (on to the next room)
      for (const [x, isNext] of [[R.l - 24, false], [R.r, true]]) {
        if (!isNext && roomNo === 0) continue;
        if (isNext && roomNo === ROOMS.length - 1) continue;
        g.fillStyle = '#1a120e'; g.fillRect(x, (R.t + R.b) / 2 - 20, 24, 40);
        g.fillStyle = isNext && !open ? '#6a5040' : '#050302'; g.fillRect(x + 4, (R.t + R.b) / 2 - 16, 16, 32);
        if (isNext && !open) { g.fillStyle = '#3a2a20'; g.fillRect(x + 4, (R.t + R.b) / 2 - 2, 16, 4); }
      }
      // a dark edge all the way round
      const shade = g.createRadialGradient(W / 2, H / 2, 90, W / 2, H / 2, 280);
      shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.6)');
      g.fillStyle = shade; g.fillRect(0, 0, W, H);
    };
    const titleCard = (t) => {
      room(t, false, 0);
      g.textAlign = 'center'; g.font = '700 30px Georgia, serif'; g.fillStyle = '#e8dcc8';
      g.fillText('The Binding of Snappy', W / 2, 100);
      her(g, W / 2, 160, 40, { eyes: 'sad' });
      g.fillStyle = '#7fd6ff'; g.beginPath(); g.ellipse(W / 2 - 9, 178 + ((t / 15) % 30), 2.5, 4, 0, 0, TAU); g.fill();
      if (Math.floor(t / 600) % 2) { g.font = '400 11px Georgia, serif'; g.fillStyle = '#c9b8a2'; g.fillText('press any key', W / 2, 228); }
    };
    if (!(await scr.title('THE BINDING OF SNAPPY', '', 'WASD MOVE · ARROWS (OR CLICK) SHOOT', titleCard))) await abandon(scr);
    let stop = music('spooky', 4200);
    const me = { x: R.l + 30, y: (R.t + R.b) / 2, hearts: 6, max: 6, hurt: 0, last: 0 };
    const got = new Set();
    let won = false, roomNo = 0, banner = null, lastWords = 0;
    const tears = [], foeShots = [];
    const hurt = (t) => {
      if (t - me.hurt < 1000) return;
      me.hurt = t; me.hearts--; Speech.tune('crash', 0.2);
    };
    const pickUp = (id, t) => {
      got.add(id);
      if (id === 'cheese') { me.max += 2; me.hearts = Math.min(me.max, me.hearts + 2); }
      banner = { id, at: t };
      Speech.tune('fanfare', 0.4);
    };

    for (roomNo = 0; roomNo < ROOMS.length; roomNo++) {
      const def = ROOMS[roomNo];
      const foes = def.foes.map((f) => ({ ...f, hp: f.kind === 'shooter' ? 8 : f.kind === 'bug' ? 3 : 5, hit: 0, next: 0, vx: 0, vy: 0 }));
      const rocks = (def.rocks || []).map(([x, y]) => ({ x, y }));
      const saws = (def.saws || []).map((s) => ({ ...s, leg: 1 }));
      const items = (def.items || []).map(([id, x, y]) => ({ id, x, y, taken: false }));
      let drop = null, boss = null;
      if (def.boss) {
        stop(); stop = music('battle', 3400);
        boss = { x: (R.l + R.r) / 2 + 60, y: (R.t + R.b) / 2, hp: 90, max: 90, hit: 0, next: performance.now() + 1500, charge: null, phase: 1 };
      }
      me.x = R.l + 26; me.y = (R.t + R.b) / 2;
      tears.length = 0; foeShots.length = 0;
      const entered = performance.now();
      for (;;) {
        const dt = await scr.tick();
        const t = performance.now();
        // moving, around the rocks
        const ix = (scr.held('d') ? 1 : 0) - (scr.held('a') ? 1 : 0), iy = (scr.held('s') ? 1 : 0) - (scr.held('w') ? 1 : 0);
        const len = Math.hypot(ix, iy) || 1, speed = 1.7;
        const nx = Math.max(R.l + 9, Math.min(R.r - 9, me.x + (ix / len) * speed * dt)), ny = Math.max(R.t + 9, Math.min(R.b - 9, me.y + (iy / len) * speed * dt));
        if (!rocks.some((k) => Math.abs(nx - k.x) < 22 && Math.abs(me.y - k.y) < 22)) me.x = nx;
        if (!rocks.some((k) => Math.abs(me.x - k.x) < 22 && Math.abs(ny - k.y) < 22)) me.y = ny;
        // shooting: arrow keys like the original, or toward the mouse
        let aim = null;
        if (scr.held('arrowleft')) aim = Math.PI; else if (scr.held('arrowright')) aim = 0; else if (scr.held('arrowup')) aim = -Math.PI / 2; else if (scr.held('arrowdown')) aim = Math.PI / 2;
        else if (scr.mouse.down) aim = Math.atan2(scr.mouse.y - me.y, scr.mouse.x - me.x);
        scr.click();
        const every = got.has('battery') ? 230 : 460;
        if (aim !== null && t - me.last > every) {
          me.last = t;
          const spread = got.has('eye') ? [-0.12, 0.12] : [0];
          for (const s of spread) {
            const a = aim + s + (got.has('eye') ? (Math.random() - 0.5) * 0.25 : 0);
            tears.push({ x: me.x, y: me.y - 4, vx: Math.cos(a) * 3.6, vy: Math.sin(a) * 3.6, life: 0 });
          }
          snappy.call('sound.blip', { pitch: 1300, volume: Speech.volume * 0.2 }).catch(() => {});
          if (got.has('battery') && t - lastWords > 9000) { lastWords = t; banner = { text: 'BZZT. THE BATTERY IS ANGRY.', at: t }; }
        }
        const dmg = got.has('advice') ? 0 : got.has('confidence') ? 2 : 1;
        for (let i = tears.length - 1; i >= 0; i--) {
          const s = tears[i];
          s.x += s.vx * dt; s.y += s.vy * dt; s.life += dt;
          let gone = s.x < R.l || s.x > R.r || s.y < R.t || s.y > R.b || s.life > 70 || rocks.some((k) => Math.abs(s.x - k.x) < 13 && Math.abs(s.y - k.y) < 13);
          for (const f of foes) if (!gone && f.hp > 0 && Math.hypot(f.x - s.x, f.y - s.y) < 11) { f.hp -= dmg; f.hit = t; gone = true; Speech.tune('tick', 0.4); }
          if (!gone && boss && boss.hp > 0 && Math.abs(s.x - boss.x) < 30 && Math.abs(s.y - boss.y) < 30) { boss.hp -= dmg; boss.hit = t; gone = true; }
          if (gone) tears.splice(i, 1);
        }
        // the little ones: a slow crawler, buzzing bugs, and one that spits in four directions
        const smelly = got.has('cheese') ? 1.35 : 1;
        for (const f of foes) {
          if (f.hp <= 0) continue;
          const a = Math.atan2(me.y - f.y, me.x - f.x);
          if (f.kind === 'gaper') { if (!f.harmless) { f.x += Math.cos(a) * 0.5 * dt; f.y += Math.sin(a) * 0.5 * dt; } else { f.x += Math.sin(t / 700) * 0.3 * dt; } }
          else if (f.kind === 'bug') { f.x += (Math.cos(a) * 0.9 * smelly + Math.sin(t / 90 + f.y) * 0.8) * dt; f.y += (Math.sin(a) * 0.9 * smelly + Math.cos(t / 110 + f.x) * 0.8) * dt; }
          else if (f.kind === 'shooter' && t > f.next) { f.next = t + 1900; for (const d of [0, 1, 2, 3]) foeShots.push({ x: f.x, y: f.y, vx: Math.cos((d * Math.PI) / 2) * 2, vy: Math.sin((d * Math.PI) / 2) * 2 }); }
          if (!f.harmless && Math.hypot(f.x - me.x, f.y - me.y) < 13) hurt(t);
        }
        for (const s of saws) {
          const [tx, ty] = s.path[s.leg], d = Math.hypot(tx - s.x, ty - s.y);
          if (d < 2) s.leg = 1 - s.leg; else { s.x += ((tx - s.x) / d) * s.speed * dt; s.y += ((ty - s.y) / d) * s.speed * dt; }
          if (Math.hypot(s.x - me.x, s.y - me.y) < 15) hurt(t);
        }
        // the Uninstaller: rings of trash, a charge across the room, and more of both when it's hurt
        if (boss && boss.hp > 0) {
          if (boss.phase === 1 && boss.hp < boss.max / 2) { boss.phase = 2; banner = { text: 'ARE YOU SURE YOU WANT TO UNINSTALL SNAPPY?', at: t }; Speech.tune('sting', 0.5); }
          if (boss.charge) {
            boss.x += boss.charge.vx * dt; boss.y += boss.charge.vy * dt;
            if (boss.x < R.l + 30 || boss.x > R.r - 30 || boss.y < R.t + 30 || boss.y > R.b - 30 || t - boss.charge.at > 1200) { boss.x = Math.max(R.l + 30, Math.min(R.r - 30, boss.x)); boss.y = Math.max(R.t + 30, Math.min(R.b - 30, boss.y)); boss.charge = null; }
          } else { boss.x += Math.sin(t / 900) * 0.4 * dt; boss.y += Math.cos(t / 1100) * 0.3 * dt; }
          if (t > boss.next) {
            boss.next = t + (boss.phase === 2 ? 1500 : 2100);
            if (Math.random() < 0.35 && !boss.charge) { const a = Math.atan2(me.y - boss.y, me.x - boss.x); boss.charge = { vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2, at: t }; Speech.tune('whoosh', 0.5); }
            else { const n = boss.phase === 2 ? 12 : 8; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + t / 1000; foeShots.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 1.8, vy: Math.sin(a) * 1.8, trash: true }); } }
          }
          if (Math.abs(boss.x - me.x) < 32 && Math.abs(boss.y - me.y) < 32) hurt(t);
          if (boss.hp <= 0) { Speech.tune('fanfare', 0.6); }
        }
        for (let i = foeShots.length - 1; i >= 0; i--) {
          const s = foeShots[i];
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.x < R.l || s.x > R.r || s.y < R.t || s.y > R.b || rocks.some((k) => Math.abs(s.x - k.x) < 13 && Math.abs(s.y - k.y) < 13)) { foeShots.splice(i, 1); continue; }
          if (Math.hypot(s.x - me.x, s.y - me.y) < 8) { foeShots.splice(i, 1); hurt(t); }
        }
        // items: the first room's drops when it's clear, the treasure room's are just there
        const clear = foes.every((f) => f.hp <= 0) && (!boss || boss.hp <= 0);
        if (clear && def.item && !drop && !got.has(def.item)) drop = { id: def.item, x: (R.l + R.r) / 2, y: (R.t + R.b) / 2, taken: false };
        for (const it of [...items, ...(drop ? [drop] : [])]) {
          if (!it.taken && Math.hypot(it.x - me.x, it.y - me.y) < 16) {
            it.taken = true;
            pickUp(it.id, t);
            // a choice room: the rest vanish in a puff
            if (def.choice) for (const other of items) if (!other.taken) { other.taken = true; other.poof = t; }
          }
        }
        if (me.hearts <= 0) break;
        if (boss && boss.hp <= 0 && t - boss.hit > 1500) { won = true; break; }
        // through the open door on the right
        if (clear && !boss && me.x > R.r - 12 && Math.abs(me.y - (R.t + R.b) / 2) < 22) break;

        // ---- the picture
        room(t, clear, roomNo);
        for (const k of rocks) { g.fillStyle = '#1a120e'; g.beginPath(); g.ellipse(k.x + 2, k.y + 4, 15, 11, 0, 0, TAU); g.fill(); g.fillStyle = '#7a6a5e'; g.beginPath(); g.ellipse(k.x, k.y, 14, 12, 0, 0, TAU); g.fill(); g.fillStyle = '#9a8a7c'; g.beginPath(); g.ellipse(k.x - 4, k.y - 4, 5, 4, 0, 0, TAU); g.fill(); }
        for (const s of saws) {
          g.save(); g.translate(s.x, s.y); g.rotate(t / 60);
          g.fillStyle = '#b8bec8'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? 9 : 13; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
          g.fillStyle = '#5a6068'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill(); g.restore();
        }
        for (const it of items) {
          if (!it.poof || t - it.poof > 500) continue;
          const k = (t - it.poof) / 500;
          g.fillStyle = `rgba(220, 210, 200, ${0.6 * (1 - k)})`;
          for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.beginPath(); g.arc(it.x + Math.cos(a) * k * 16, it.y - 8 + Math.sin(a) * k * 12, 5 * (1 - k) + 2, 0, TAU); g.fill(); }
        }
        for (const it of [...items, ...(drop ? [drop] : [])]) {
          if (it.taken) continue;
          g.fillStyle = '#5a4a40'; g.fillRect(it.x - 10, it.y + 2, 20, 10); g.fillStyle = '#7a6a5e'; g.fillRect(it.x - 12, it.y, 24, 4);
          const bob = Math.sin(t / 300) * 2;
          g.fillStyle = { confidence: '#ffd25a', eye: '#ffffff', battery: '#7fdc6c', cheese: '#ffe680', advice: '#1b2a32' }[it.id];
          g.beginPath(); g.arc(it.x, it.y - 8 + bob, 7, 0, TAU); g.fill();
          g.fillStyle = '#111';
          if (it.id === 'eye') { g.beginPath(); g.ellipse(it.x, it.y - 8 + bob, 2.5, 4, 0, 0, TAU); g.fill(); }
          if (it.id === 'battery') g.fillRect(it.x - 1, it.y - 13 + bob, 2, 10);
          if (it.id === 'cheese') { g.fillStyle = '#d8b84a'; g.beginPath(); g.arc(it.x - 2, it.y - 9 + bob, 1.5, 0, TAU); g.arc(it.x + 3, it.y - 6 + bob, 1.2, 0, TAU); g.fill(); }
          if (it.id === 'confidence') { g.fillStyle = '#7a4a10'; g.font = '900 9px "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText('!', it.x, it.y - 5 + bob); }
          if (it.id === 'advice') { g.fillStyle = '#39a8db'; g.beginPath(); g.arc(it.x, it.y - 8 + bob, 3, 0, TAU); g.fill(); }
        }
        for (const f of foes) {
          if (f.hp <= 0) continue;
          const flash = t - f.hit < 90;
          if (f.kind === 'bug') {
            g.fillStyle = flash ? '#fff' : '#6ac84a'; g.beginPath(); g.ellipse(f.x, f.y, 6, 5, 0, 0, TAU); g.fill();
            g.fillStyle = 'rgba(220, 240, 255, .6)'; g.beginPath(); g.ellipse(f.x - 4, f.y - 5 + Math.sin(t / 30) * 2, 4, 2, -0.5, 0, TAU); g.ellipse(f.x + 4, f.y - 5 - Math.sin(t / 30) * 2, 4, 2, 0.5, 0, TAU); g.fill();
            g.fillStyle = '#111'; g.fillRect(f.x - 3, f.y - 1, 2, 2); g.fillRect(f.x + 1, f.y - 1, 2, 2);
          } else {
            g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(f.x + 2, f.y + 8, 10, 4, 0, 0, TAU); g.fill();
            g.fillStyle = flash ? '#fff' : f.kind === 'shooter' ? '#a06ad8' : '#ff8a8a'; g.beginPath(); g.ellipse(f.x, f.y, 10, 9, 0, 0, TAU); g.fill();
            g.fillStyle = '#111'; g.beginPath(); g.arc(f.x - 3, f.y - 2, 1.8, 0, TAU); g.arc(f.x + 3, f.y - 2, 1.8, 0, TAU); g.fill();
            g.beginPath(); g.ellipse(f.x, f.y + 3, f.kind === 'shooter' ? 3 : 2, 2, 0, 0, TAU); g.fill();
          }
          if (!got.has('confidence')) { g.fillStyle = '#1a120e'; g.fillRect(f.x - 9, f.y - 15, 18, 3); g.fillStyle = '#c23a3a'; g.fillRect(f.x - 9, f.y - 15, 18 * (f.hp / (f.kind === 'shooter' ? 8 : f.kind === 'bug' ? 3 : 5)), 3); }
        }
        if (boss && boss.hp > 0) {
          // a computer icon, very angry
          const flash = t - boss.hit < 90;
          g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(boss.x + 3, boss.y + 34, 30, 8, 0, 0, TAU); g.fill();
          g.fillStyle = '#1a1a1e'; g.fillRect(boss.x - 30, boss.y - 28, 60, 44);
          g.fillStyle = flash ? '#fff' : boss.phase === 2 ? '#c23a3a' : '#2a64c8'; g.fillRect(boss.x - 26, boss.y - 24, 52, 36);
          g.fillStyle = '#1a1a1e'; g.fillRect(boss.x - 8, boss.y + 16, 16, 8); g.fillRect(boss.x - 18, boss.y + 24, 36, 5);
          g.fillStyle = '#fff'; g.beginPath(); g.moveTo(boss.x - 18, boss.y - 14); g.lineTo(boss.x - 6, boss.y - 9); g.lineTo(boss.x - 18, boss.y - 6); g.fill();
          g.beginPath(); g.moveTo(boss.x + 18, boss.y - 14); g.lineTo(boss.x + 6, boss.y - 9); g.lineTo(boss.x + 18, boss.y - 6); g.fill();
          g.fillRect(boss.x - 10, boss.y + 3, 20, 3);
          g.fillStyle = '#e8dcc8'; g.font = '700 9px Georgia, serif'; g.textAlign = 'center'; g.fillText('THE UNINSTALLER', W / 2, H - 10);
          g.fillStyle = '#1a120e'; g.fillRect(W / 2 - 80, H - 26, 160, 7);
          if (got.has('confidence')) { g.fillStyle = '#ffd25a'; g.font = '700 7px Georgia, serif'; g.fillText('health: no idea (she is winning)', W / 2, H - 20); }
          else { g.fillStyle = '#c23a3a'; g.fillRect(W / 2 - 80, H - 26, 160 * (boss.hp / boss.max), 7); }
        }
        for (const s of foeShots) {
          if (s.trash) { g.fillStyle = '#8a8f9c'; g.fillRect(s.x - 3, s.y - 4, 6, 8); g.fillStyle = '#5a6068'; g.fillRect(s.x - 4, s.y - 5, 8, 2); }
          else { g.fillStyle = '#c23a3a'; g.beginPath(); g.arc(s.x, s.y, 4, 0, TAU); g.fill(); }
        }
        for (const s of tears) { g.fillStyle = 'rgba(255, 250, 220, .35)'; g.beginPath(); g.arc(s.x, s.y, 7, 0, TAU); g.fill(); g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(s.x, s.y, 3.5, 0, TAU); g.fill(); }
        // her, blinking while she can't be hurt, with smell lines once she's had the cheese
        if (!(t - me.hurt < 1000 && Math.floor(t / 90) % 2)) her(g, me.x, me.y, 24, { legs: ix || iy ? Math.floor(t / 120) : 0, eyes: t - me.hurt < 500 ? 'wince' : got.has('confidence') ? 'smug' : 'open' });
        if (got.has('cheese')) { g.strokeStyle = 'rgba(200, 220, 80, .6)'; g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(me.x - 8 + i * 8, me.y - 16); g.quadraticCurveTo(me.x - 12 + i * 8, me.y - 22 - Math.sin(t / 200 + i) * 2, me.x - 8 + i * 8, me.y - 28); g.stroke(); } }
        if (got.has('battery')) { me.x += (Math.random() - 0.5) * 0.6; }
        // hearts, the map of the four rooms, and whatever just happened
        for (let i = 0; i < me.max / 2; i++) {
          const full = me.hearts - i * 2, x = 14 + i * 16, y = 14;
          g.fillStyle = '#1a120e'; g.beginPath(); g.arc(x - 3, y, 4.5, 0, TAU); g.arc(x + 3, y, 4.5, 0, TAU); g.moveTo(x - 7.5, y + 1); g.lineTo(x, y + 9); g.lineTo(x + 7.5, y + 1); g.fill();
          g.fillStyle = full >= 2 ? '#d23a3a' : full === 1 ? '#a03030' : '#3a2a24'; g.beginPath(); g.arc(x - 3, y, 3.5, 0, TAU); g.arc(x + 3, y, 3.5, 0, TAU); g.moveTo(x - 6.5, y + 1); g.lineTo(x, y + 8); g.lineTo(x + 6.5, y + 1); g.fill();
        }
        ROOMS.forEach((_, i) => { g.fillStyle = i === roomNo ? '#e8dcc8' : i < roomNo ? '#8a7a68' : '#3a2e26'; g.fillRect(W - 70 + i * 15, 9, 12, 9); });
        if (t - entered < 1800) { g.textAlign = 'center'; g.fillStyle = '#e8dcc8'; g.font = '700 14px Georgia, serif'; g.fillText(def.name, W / 2, R.t + 22); if (def.tip) { g.font = '400 10px Georgia, serif'; g.fillText(def.tip, W / 2, R.t + 38); } }
        if (banner && t - banner.at < 3200) {
          const it = banner.id && ITEMS[banner.id];
          g.globalAlpha = Math.min(1, (3200 - (t - banner.at)) / 400);
          g.fillStyle = '#e8dcc8'; g.fillRect(70, 46, W - 140, it ? 40 : 24);
          g.fillStyle = '#1a120e'; g.textAlign = 'center'; g.font = '900 13px Georgia, serif';
          g.fillText(it ? it.name : banner.text, W / 2, 63);
          if (it) { g.font = 'italic 400 9px Georgia, serif'; g.fillText(it.note, W / 2, 78); }
          g.globalAlpha = 1;
        }
      }
      if (me.hearts <= 0 || won) break;
      Speech.tune('whoosh', 0.4);
    }
    stop();
    // the end
    while (scr.click()) { /* nothing */ }
    const shownAt = performance.now();
    for (let i = 0; ; i++) {
      await scr.tick();
      if ((i > 60 && scr.click()) || performance.now() - shownAt > 120000) break;
      g.fillStyle = '#120c09'; g.fillRect(0, 0, W, H);
      g.textAlign = 'center'; g.font = '700 26px Georgia, serif'; g.fillStyle = won ? '#ffd25a' : '#d23a3a';
      g.fillText(won ? 'The Uninstaller was uninstalled' : 'Snappy has fallen', W / 2, 110);
      g.font = '400 11px Georgia, serif'; g.fillStyle = '#c9b8a2';
      g.fillText(won ? 'Snappy is still installed.' : `In ${ROOMS[roomNo].name}.`, W / 2, 136);
      g.fillText(`Items: ${[...got].map((id) => ITEMS[id].name.toLowerCase()).join(', ') || 'none'}`, W / 2, 156);
      if (i > 60 && Math.floor(i / 30) % 2) { g.font = '400 9px Georgia, serif'; g.fillText('click to continue', W / 2, H - 14); }
    }
    await scr.close();
    if (won) {
      await S('{joy}I uninstalled the Uninstaller!', { hold: 300 });
      await P('That is not how uninstalling works.', { hold: 400 });
      if (got.has('confidence')) {
        await P('You could not even see its health.', { hold: 300 });
        await S('{smug}I knew I was winning.', { hold: 600 });
      } else await S('{smug}It does now.', { hold: 600 });
    } else if (got.has('advice')) {
      await P('You took my advice.', { hold: 300 });
      await S('{angry}It was TERRIBLE advice!', { shout: true, hold: 300 });
      await P('It was the only advice I had.', { hold: 600 });
    } else {
      await S('{sad}The basement won.', { hold: 300 });
      await P('Nobody goes down there. {pause}This is why.', { hold: 500 });
      await S('{angry}I am going back down there.', { hold: 600 });
    }
    await finish();
    return won;
  }

  Events.define('binding', {
    tier: 'game', title: 'The Binding of Snappy', hint: 'Every application has a basement. Nobody goes down there.', run: binding, weight: 1,
  });
  Events.aftermath('binding', { label: 'Three red hearts', marks: [{ at: '.brand', cls: 'af-pic af-hearts' }] });
})();
