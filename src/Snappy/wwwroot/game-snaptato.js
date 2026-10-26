// Snaptato: an arena, waves of the Lag's minions, and Snappy firing everything she has at the nearest one by herself.
// You only steer (WASD or arrows). Minions drop frames; between waves you spend them in the shop. Wave five is the
// Task Manager.
(() => {
  const { vector: her } = Arcade;
  const W = 480, H = 270, TAU = Math.PI * 2;
  const A = { l: 30, r: 450, t: 22, b: 252 };
  const WAVES = [{ time: 16, rate: 1.1 }, { time: 20, rate: 0.85 }, { time: 22, rate: 0.7 }, { time: 24, rate: 0.55 }, { time: 0, boss: true }];
  const WEAPONS = {
    cursor: { name: 'Cursor Cannon', note: 'Fires little cursors. 3 damage.', price: 8, every: 600, range: 150 },
    shot: { name: 'Screenshot Launcher', note: 'Lobs a screenshot that bursts. 4 damage around it.', price: 12, every: 1400, range: 170 },
    notify: { name: 'Angry Notification Gun', note: 'Notifications that go through two minions. 3 damage.', price: 10, every: 900, range: 160 },
    complain: { name: 'Complaint Generator', note: 'Zero damage. Every minion nearby stops to read the complaint.', price: 9, every: 3200, range: 0 },
  };
  const UPGRADES = {
    confidence: { name: '+50% Confidence', note: 'Everything hits 50% harder.', price: 10 },
    eyes: { name: 'Double Eyes', note: 'Shoots 25% faster and further.', price: 9 },
    boom: { name: 'Explosive Complaints', note: 'Complaints burst for 5 damage when they are done.', price: 8 },
    snack: { name: 'A Snack', note: '+4 max HP.', price: 6 },
    shoes: { name: 'Running Shoes', note: 'Moves 20% faster.', price: 7 },
  };
  const LINES = ['THIS IS UNACCEPTABLE', 'I WANT A REFUND', 'WHO DESIGNED THIS', 'FIVE STARS. NO. ONE STAR', 'SPEAK TO MANAGER'];

  async function snaptato(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    await S('{shine}Snaptato! {pause}I fight off waves of minions. {pause}By myself.', { hold: 300 });
    await P('With what?', { hold: 300 });
    await S('{smug}Cursor cannons. {pause}Screenshot launchers. {pause}Angry notifications.', { hold: 300 });
    await P('And the complaint generator?', { hold: 400 });
    await S('{wink}My strongest weapon. {pause}It does no damage at all.', { hold: 500 });
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g } = scr;
    const ground = (t) => {
      g.fillStyle = '#3a2e22'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#5a4632'; g.beginPath(); g.roundRect(A.l - 8, A.t - 8, A.r - A.l + 16, A.b - A.t + 16, 18); g.fill();
      g.fillStyle = '#d6bf92'; g.beginPath(); g.roundRect(A.l, A.t, A.r - A.l, A.b - A.t, 12); g.fill();
      g.fillStyle = 'rgba(120, 90, 50, .14)';
      for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(A.l + ((i * 97) % (A.r - A.l)), A.t + ((i * 53) % (A.b - A.t)), 8 + (i % 4) * 3, 4 + (i % 3) * 2, 0, 0, TAU); g.fill(); }
    };
    const blob = (x, y, r, fill, t, eye = true) => {
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(x + 2, y + r * 0.7, r, r * 0.45, 0, 0, TAU); g.fill();
      g.fillStyle = '#1a1414'; g.beginPath(); g.ellipse(x, y, r + 2, r * 0.9 + 2, 0, 0, TAU); g.fill();
      g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, r, r * 0.9, 0, 0, TAU); g.fill();
      if (eye) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y - 1, r * 0.4, 0, TAU); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(x + Math.cos(t / 150) * r * 0.15, y - 1 + Math.sin(t / 150) * r * 0.15, r * 0.2, 0, TAU); g.fill(); }
    };
    const titleCard = (t) => {
      ground(t);
      g.textAlign = 'center'; g.font = '900 36px "Arial Black", Impact, sans-serif'; g.lineJoin = 'round';
      g.lineWidth = 8; g.strokeStyle = '#2a1e12'; g.strokeText('SNAPTATO', W / 2, 90); g.fillStyle = '#ffd25a'; g.fillText('SNAPTATO', W / 2, 90);
      her(g, W / 2, 160 + Math.sin(t / 300) * 3, 48, { eyes: 'joy' });
      for (let i = 0; i < 4; i++) { const a = t / 600 + (i / 4) * TAU; blob(W / 2 + Math.cos(a) * 80, 160 + Math.sin(a) * 40, 10, '#ff5a6e', t); }
      if (Math.floor(t / 600) % 2) { g.font = '800 12px "Segoe UI", sans-serif'; g.fillStyle = '#2a1e12'; g.fillText('press any key', W / 2, 238); }
    };
    if (!(await scr.title('SNAPTATO', '', 'WASD OR ARROWS TO MOVE · SHE AIMS BY HERSELF', titleCard))) await abandon(scr);
    let stop = music('platform', 3200);
    const me = { x: W / 2, y: (A.t + A.b) / 2, hp: 12, max: 12, hurt: 0, speed: 1.8 };
    const arsenal = [{ id: 'cursor', last: 0 }];
    const perks = { confidence: 0, eyes: 0, boom: 0 };
    let frames = 0, won = false, waveNo = 0;
    const power = () => 1 + perks.confidence * 0.5;
    const reach = (w) => WEAPONS[w.id].range * (1 + perks.eyes * 0.25);
    const rate = (w) => WEAPONS[w.id].every / (1 + perks.eyes * 0.25);

    for (const [wi, wave] of WAVES.entries()) {
      waveNo = wi + 1;
      const foes = [], shots = [], drops = [], marks = [], complaints = [], pops = [], beams = [];
      const start = performance.now();
      let nextSpawn = start + 800, boss = null;
      if (wave.boss) {
        stop(); stop = music('battle', 3400);
        boss = { x: (A.l + A.r) / 2, y: A.t + 50, hp: 140, max: 140, w: 92, h: 62, next: start + 2500, beam: start + 4000 };
      }
      let over = false;
      while (!over) {
        const dt = await scr.tick();
        const t = performance.now(), left = wave.boss ? Infinity : wave.time * 1000 - (t - start);
        // steering
        const ix = (scr.held('d', 'arrowright') ? 1 : 0) - (scr.held('a', 'arrowleft') ? 1 : 0), iy = (scr.held('s', 'arrowdown') ? 1 : 0) - (scr.held('w', 'arrowup') ? 1 : 0);
        const len = Math.hypot(ix, iy) || 1;
        me.x = Math.max(A.l + 10, Math.min(A.r - 10, me.x + (ix / len) * me.speed * dt));
        me.y = Math.max(A.t + 10, Math.min(A.b - 10, me.y + (iy / len) * me.speed * dt));
        // minions turn up where a red cross shows first
        if (t > nextSpawn && (left > 1500 || wave.boss)) {
          const k = Math.min(3, 1 + Math.floor(wi / 2));
          for (let i = 0; i < k; i++) {
            let x, y;
            do { x = A.l + 20 + Math.random() * (A.r - A.l - 40); y = A.t + 20 + Math.random() * (A.b - A.t - 40); } while (Math.hypot(x - me.x, y - me.y) < 90);
            marks.push({ x, y, at: t, fast: Math.random() < 0.15 + wi * 0.08 });
          }
          nextSpawn = t + (wave.boss ? 2600 : wave.rate * 1000);
        }
        for (let i = marks.length - 1; i >= 0; i--) if (t - marks[i].at > 700) { const m = marks[i]; foes.push({ x: m.x, y: m.y, hp: m.fast ? 4 : 6 + wi, fast: m.fast, hit: 0 }); marks.splice(i, 1); }
        // her weapons, each on its own clock, at whatever is closest
        for (const w of arsenal) {
          if (t - w.last < rate(w)) continue;
          if (w.id === 'complain') {
            w.last = t;
            complaints.push({ x: me.x + (Math.random() - 0.5) * 120, y: me.y + (Math.random() - 0.5) * 80, at: t, text: LINES[Math.floor(Math.random() * LINES.length)] });
            Speech.tune('tick', 0.4);
            continue;
          }
          const targets = boss ? [...foes, boss] : foes;
          const near = targets.reduce((best, f) => { const d = Math.hypot(f.x - me.x, f.y - me.y); return d < reach(w) && (!best || d < best.d) ? { f, d } : best; }, null);
          if (!near) continue;
          w.last = t;
          const a = Math.atan2(near.f.y - me.y, near.f.x - me.x);
          if (w.id === 'cursor') shots.push({ kind: 'cursor', x: me.x, y: me.y, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2, dmg: 3, pierce: 1 });
          if (w.id === 'notify') shots.push({ kind: 'notify', x: me.x, y: me.y, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2, dmg: 3, pierce: 2, hits: new Set() });
          if (w.id === 'shot') shots.push({ kind: 'shot', x: me.x, y: me.y, tx: near.f.x, ty: near.f.y, at: t, dmg: 4 });
          snappy.call('sound.blip', { pitch: 900 + Math.random() * 300, volume: Speech.volume * 0.25 }).catch(() => {});
        }
        const damage = (f, n, at) => {
          f.hp -= n * power(); f.hit = t;
          pops.push({ x: f.x, y: f.y - 10, text: String(Math.round(n * power())), at: t });
          if (f === boss) return;
          if (f.hp <= 0 && !f.dead) { f.dead = true; drops.push({ x: f.x, y: f.y }); if (Math.random() < 0.3) drops.push({ x: f.x + 6, y: f.y + 4 }); }
        };
        for (let i = shots.length - 1; i >= 0; i--) {
          const s = shots[i];
          if (s.kind === 'shot') {
            const k = (t - s.at) / 500;
            if (k >= 1) {
              for (const f of boss ? [...foes, boss] : foes) if (Math.hypot(f.x - s.tx, f.y - s.ty) < 34) damage(f, s.dmg);
              pops.push({ x: s.tx, y: s.ty, text: '*SNAP*', at: t, big: true });
              shots.splice(i, 1);
            }
            continue;
          }
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.x < A.l || s.x > A.r || s.y < A.t || s.y > A.b) { shots.splice(i, 1); continue; }
          for (const f of boss ? [...foes, boss] : foes) {
            if (f.dead || s.hits?.has(f)) continue;
            const hitbox = f === boss ? Math.abs(s.x - f.x) < f.w / 2 && Math.abs(s.y - f.y) < f.h / 2 : Math.hypot(f.x - s.x, f.y - s.y) < 10;
            if (!hitbox) continue;
            damage(f, s.dmg);
            s.hits?.add(f);
            if (--s.pierce <= 0) { shots.splice(i, 1); break; }
          }
        }
        for (let i = foes.length - 1; i >= 0; i--) if (foes[i].dead) foes.splice(i, 1);
        // complaints draw every minion nearby away from her, and with the upgrade they go off at the end
        for (let i = complaints.length - 1; i >= 0; i--) {
          const c = complaints[i];
          if (t - c.at > 3000) {
            if (perks.boom) { for (const f of foes) if (Math.hypot(f.x - c.x, f.y - c.y) < 40) damage(f, 5); pops.push({ x: c.x, y: c.y, text: 'BOOM', at: t, big: true }); }
            complaints.splice(i, 1);
          }
        }
        for (const f of foes) {
          const lure = complaints.find((c) => Math.hypot(c.x - f.x, c.y - f.y) < 130);
          const tx = lure ? lure.x : me.x, ty = lure ? lure.y : me.y, a = Math.atan2(ty - f.y, tx - f.x);
          const sp = (f.fast ? 1.25 : 0.62) * dt;
          if (!lure || Math.hypot(tx - f.x, ty - f.y) > 12) { f.x += Math.cos(a) * sp; f.y += Math.sin(a) * sp; }
          if (Math.hypot(me.x - f.x, me.y - f.y) < 13 && t - me.hurt > 700) { me.hp -= 2; me.hurt = t; Speech.tune('crash', 0.15); }
        }
        // the Task Manager: sends Not Responding windows, and every so often ends a task right where she is
        if (boss) {
          boss.x += Math.sin(t / 1500) * 0.6 * dt;
          if (t > boss.next) { boss.next = t + 2600; for (let i = 0; i < 2; i++) foes.push({ x: boss.x + (i ? 30 : -30), y: boss.y + 30, hp: 5, fast: false, ghost: true, hit: 0 }); }
          if (t > boss.beam) { boss.beam = t + 3600; beams.push({ x: me.x, at: t, vertical: Math.random() < 0.5, y: me.y }); }
          if (boss.hp <= 0) { won = true; over = true; }
        }
        for (let i = beams.length - 1; i >= 0; i--) {
          const b = beams[i], age = t - b.at;
          if (age > 1300) { beams.splice(i, 1); continue; }
          if (age > 900 && age < 1050 && t - me.hurt > 700 && (b.vertical ? Math.abs(me.x - b.x) < 14 : Math.abs(me.y - b.y) < 14)) { me.hp -= 3; me.hurt = t; Speech.tune('crash', 0.2); }
        }
        // frames drift to her when she's close
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i], dist = Math.hypot(me.x - d.x, me.y - d.y);
          if (dist < 46) { d.x += ((me.x - d.x) / dist) * 3.2 * dt; d.y += ((me.y - d.y) / dist) * 3.2 * dt; }
          if (dist < 8) { frames++; drops.splice(i, 1); snappy.call('sound.blip', { pitch: 1600, volume: Speech.volume * 0.2 }).catch(() => {}); }
        }
        if (me.hp <= 0) over = true;
        if (!wave.boss && left <= 0) { frames += drops.length; over = true; }

        // ---- the picture
        ground(t);
        for (const m of marks) { g.strokeStyle = `rgba(220, 40, 40, ${0.5 + Math.sin(t / 60) * 0.3})`; g.lineWidth = 3; g.beginPath(); g.moveTo(m.x - 6, m.y - 6); g.lineTo(m.x + 6, m.y + 6); g.moveTo(m.x + 6, m.y - 6); g.lineTo(m.x - 6, m.y + 6); g.stroke(); }
        for (const d of drops) { g.fillStyle = '#1a1414'; g.fillRect(d.x - 4, d.y - 4, 8, 8); g.fillStyle = '#7fdc6c'; g.fillRect(d.x - 3, d.y - 3, 6, 6); }
        for (const b of beams) {
          const age = t - b.at, live = age > 900;
          g.fillStyle = live ? 'rgba(255, 60, 60, .7)' : `rgba(255, 60, 60, ${0.15 + Math.sin(t / 50) * 0.08})`;
          if (b.vertical) g.fillRect(b.x - (live ? 14 : 2), A.t, live ? 28 : 4, A.b - A.t); else g.fillRect(A.l, b.y - (live ? 14 : 2), A.r - A.l, live ? 28 : 4);
          if (!live) { g.fillStyle = '#c21e1e'; g.font = '800 9px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText('END TASK', b.vertical ? b.x : (A.l + A.r) / 2, b.vertical ? A.t + 12 : b.y - 6); }
        }
        for (const c of complaints) {
          g.fillStyle = '#fff'; g.strokeStyle = '#1a1414'; g.lineWidth = 2;
          g.font = '800 7px "Segoe UI", sans-serif'; const tw = g.measureText(c.text).width + 10;
          g.beginPath(); g.roundRect(c.x - tw / 2, c.y - 16, tw, 14, 5); g.fill(); g.stroke();
          g.fillStyle = '#c21e1e'; g.textAlign = 'center'; g.fillText(c.text, c.x, c.y - 6);
        }
        for (const f of foes) blob(f.x, f.y, f.fast ? 7 : 9, t - f.hit < 90 ? '#fff' : f.ghost ? '#b8c4d6' : f.fast ? '#ff9a3c' : '#ff5a6e', t, !f.ghost);
        if (boss) {
          g.fillStyle = '#1a1414'; g.fillRect(boss.x - boss.w / 2 - 2, boss.y - boss.h / 2 - 2, boss.w + 4, boss.h + 4);
          g.fillStyle = t - boss.hit < 90 ? '#fff' : '#f2f2f2'; g.fillRect(boss.x - boss.w / 2, boss.y - boss.h / 2, boss.w, boss.h);
          g.fillStyle = '#2a64c8'; g.fillRect(boss.x - boss.w / 2, boss.y - boss.h / 2, boss.w, 11);
          g.fillStyle = '#fff'; g.font = '700 7px "Segoe UI", sans-serif'; g.textAlign = 'left'; g.fillText('Task Manager', boss.x - boss.w / 2 + 3, boss.y - boss.h / 2 + 8);
          g.fillStyle = '#c21e1e'; g.fillRect(boss.x + boss.w / 2 - 10, boss.y - boss.h / 2 + 2, 8, 7);
          g.fillStyle = '#333'; g.font = '600 6px "Segoe UI", sans-serif';
          ['Snappy.exe ....... 99% CPU', 'Lag minion ...... 12%', 'Complaints ....... 0%'].forEach((s, i) => g.fillText(s, boss.x - boss.w / 2 + 4, boss.y - boss.h / 2 + 22 + i * 9));
          g.fillStyle = '#1a1414'; g.fillRect(boss.x - 40, boss.y + boss.h / 2 + 4, 80, 5);
          g.fillStyle = '#c21e1e'; g.fillRect(boss.x - 40, boss.y + boss.h / 2 + 4, 80 * Math.max(0, boss.hp / boss.max), 5);
        }
        for (const s of shots) {
          if (s.kind === 'cursor') { g.save(); g.translate(s.x, s.y); g.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2); g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -5); g.lineTo(3.5, 3); g.lineTo(-3.5, 3); g.closePath(); g.fill(); g.stroke(); g.restore(); }
          else if (s.kind === 'notify') { g.fillStyle = '#c21e1e'; g.beginPath(); g.arc(s.x, s.y, 5, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = '900 8px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText('!', s.x, s.y + 3); }
          else { const k = (t - s.at) / 500, x = s.x + (s.tx - s.x) * k, y = s.y + (s.ty - s.y) * k - Math.sin(k * Math.PI) * 30; g.fillStyle = '#fff'; g.fillRect(x - 6, y - 5, 12, 10); g.fillStyle = '#7fd6ff'; g.fillRect(x - 5, y - 4, 10, 6); }
        }
        // her, in the middle of it, blinking when she's just been hit
        if (!(t - me.hurt < 700 && Math.floor(t / 80) % 2)) her(g, me.x, me.y, 22, { legs: ix || iy ? Math.floor(t / 120) : 0, eyes: t - me.hurt < 500 ? 'wince' : 'open' });
        arsenal.forEach((w, i) => { const a = t / 900 + (i / arsenal.length) * TAU; g.fillStyle = { cursor: '#fff', shot: '#7fd6ff', notify: '#c21e1e', complain: '#ffd25a' }[w.id]; g.beginPath(); g.arc(me.x + Math.cos(a) * 18, me.y + Math.sin(a) * 14, 3, 0, TAU); g.fill(); });
        for (let i = pops.length - 1; i >= 0; i--) {
          const p = pops[i], k = (t - p.at) / 600;
          if (k > 1) { pops.splice(i, 1); continue; }
          g.globalAlpha = 1 - k; g.fillStyle = p.big ? '#ffd25a' : '#fff'; g.font = `900 ${p.big ? 11 : 8}px "Segoe UI", sans-serif`; g.textAlign = 'center'; g.fillText(p.text, p.x, p.y - k * 10); g.globalAlpha = 1;
        }
        // HP, frames, the wave and its clock
        g.fillStyle = '#1a1414'; g.fillRect(8, 6, 104, 10); g.fillStyle = '#c21e1e'; g.fillRect(10, 8, 100 * Math.max(0, me.hp / me.max), 6);
        g.fillStyle = '#fff'; g.font = '800 8px "Segoe UI", sans-serif'; g.textAlign = 'left'; g.fillText(`${Math.max(0, me.hp)} / ${me.max}`, 12, 14);
        g.fillStyle = '#7fdc6c'; g.fillText(`${frames} frames`, 120, 14);
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '900 11px "Arial Black", sans-serif';
        g.fillText(wave.boss ? 'WAVE 5 · THE TASK MANAGER' : `WAVE ${waveNo} · ${Math.max(0, Math.ceil(left / 1000))}`, W / 2, 15);
      }
      if (me.hp <= 0) break;
      if (won) break;
      // ---- the shop
      Speech.tune('coin', 0.5);
      me.hp = me.max;
      let offers = [];
      const roll = () => {
        const pool = [...Object.keys(WEAPONS).filter((id) => arsenal.length < 5).map((id) => ({ kind: 'weapon', id })), ...Object.keys(UPGRADES).map((id) => ({ kind: 'perk', id }))];
        offers = pool.sort(() => Math.random() - 0.5).slice(0, 3).map((o) => ({ ...o, bought: false }));
      };
      roll();
      for (;;) {
        await scr.tick();
        const t = performance.now(), { x, y } = scr.mouse;
        ground(t);
        g.fillStyle = 'rgba(30, 22, 14, .85)'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#ffd25a'; g.font = '900 18px "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText(`SHOP · WAVE ${waveNo + 1} NEXT`, W / 2, 34);
        g.fillStyle = '#7fdc6c'; g.font = '800 11px "Segoe UI", sans-serif'; g.fillText(`${frames} frames`, W / 2, 52);
        let over = null;
        offers.forEach((o, i) => {
          const def = o.kind === 'weapon' ? WEAPONS[o.id] : UPGRADES[o.id], cx = 90 + i * 150, can = !o.bought && frames >= def.price;
          const hov = x > cx - 66 && x < cx + 66 && y > 66 && y < 196;
          if (hov && can) over = i;
          g.fillStyle = o.bought ? '#3a3228' : hov && can ? '#6a5640' : '#4a3c2c'; g.beginPath(); g.roundRect(cx - 66, 66, 132, 130, 10); g.fill();
          g.strokeStyle = o.kind === 'weapon' ? '#ff9a3c' : '#7fd6ff'; g.lineWidth = 2; g.stroke();
          g.fillStyle = '#fff'; g.font = '800 10px "Segoe UI", sans-serif'; g.fillText(def.name, cx, 90);
          g.fillStyle = '#d8cbb0'; g.font = '600 8px "Segoe UI", sans-serif';
          const words = def.note.split(' '), rows = [''];
          for (const w of words) { const next = rows[rows.length - 1] ? `${rows[rows.length - 1]} ${w}` : w; if (g.measureText(next).width > 116) rows.push(w); else rows[rows.length - 1] = next; }
          rows.forEach((r, k) => g.fillText(r, cx, 112 + k * 11));
          g.fillStyle = o.bought ? '#8a8070' : can ? '#7fdc6c' : '#c26a5a'; g.font = '800 11px "Segoe UI", sans-serif';
          g.fillText(o.bought ? 'Bought' : `${def.price} frames`, cx, 184);
        });
        const nextHover = x > W / 2 - 60 && x < W / 2 + 60 && y > 214 && y < 240;
        const rerollHover = x > 30 && x < 120 && y > 214 && y < 240;
        g.fillStyle = nextHover ? '#ffd25a' : '#e0b040'; g.beginPath(); g.roundRect(W / 2 - 60, 214, 120, 26, 8); g.fill();
        g.fillStyle = '#2a1e12'; g.font = '900 11px "Arial Black", sans-serif'; g.fillText('NEXT WAVE', W / 2, 232);
        g.fillStyle = rerollHover && frames >= 2 ? '#8a7a64' : '#5a4c3c'; g.beginPath(); g.roundRect(30, 214, 90, 26, 8); g.fill();
        g.fillStyle = '#fff'; g.font = '800 9px "Segoe UI", sans-serif'; g.fillText('Reroll · 2', 75, 231);
        g.textAlign = 'left'; g.fillStyle = '#d8cbb0'; g.font = '600 8px "Segoe UI", sans-serif';
        g.fillText(`Weapons: ${arsenal.map((w) => WEAPONS[w.id].name).join(', ')}`, 140, 256);
        if (scr.click()) {
          if (over !== null) {
            const o = offers[over], def = o.kind === 'weapon' ? WEAPONS[o.id] : UPGRADES[o.id];
            frames -= def.price; o.bought = true; Speech.tune('coin', 0.5);
            if (o.kind === 'weapon') arsenal.push({ id: o.id, last: 0 });
            else if (o.id === 'snack') { me.max += 4; me.hp = me.max; }
            else if (o.id === 'shoes') me.speed *= 1.2;
            else perks[o.id]++;
          } else if (rerollHover && frames >= 2) { frames -= 2; roll(); Speech.tune('tick', 0.5); }
          else if (nextHover) break;
        }
      }
    }
    stop();
    // the end of the run
    while (scr.click()) { /* nothing */ }
    const shownAt = performance.now();
    for (let i = 0; ; i++) {
      await scr.tick();
      if ((i > 60 && scr.click()) || performance.now() - shownAt > 120000) break;
      ground(performance.now());
      g.fillStyle = 'rgba(30, 22, 14, .8)'; g.fillRect(0, 0, W, H);
      g.textAlign = 'center'; g.font = '900 28px "Arial Black", sans-serif'; g.fillStyle = won ? '#ffd25a' : '#ff6a5a';
      g.fillText(won ? 'TASK MANAGER: ENDED' : 'RUN LOST', W / 2, 108);
      g.fillStyle = '#fff'; g.font = '700 11px "Segoe UI", sans-serif';
      g.fillText(won ? 'Snappy.exe is still running.' : `She made it to wave ${waveNo}.`, W / 2, 136);
      g.fillText(`Weapons: ${arsenal.map((w) => WEAPONS[w.id].name).join(', ')}`, W / 2, 156);
      if (i > 60 && Math.floor(i / 30) % 2) { g.font = '600 9px "Segoe UI", sans-serif'; g.fillStyle = '#d8cbb0'; g.fillText('click to continue', W / 2, H - 14); }
    }
    await scr.close();
    const complainer = arsenal.some((w) => w.id === 'complain');
    if (won) {
      await S('{joy}I ended the Task Manager!', { hold: 300 });
      await P('That is not what End Task is for.', { hold: 400 });
      if (complainer) await S('{smug}I complained it to death.', { hold: 600 });
      else await S('{wink}It is now.', { hold: 600 });
    } else {
      await S(`{sad}Wave ${waveNo}. {pause}So many minions.`, { hold: 300 });
      await P(complainer ? 'Your complaints were very loud.' : 'Have you considered the complaint generator?', { hold: 400 });
      await S('{angry}Next time I bring MORE complaints.', { hold: 600 });
    }
    await finish();
    return won;
  }

  Events.define('snaptato', {
    tier: 'game', title: 'Snaptato', hint: 'Waves of minions. She aims. You run.', run: snaptato, weight: 1,
  });
  Events.aftermath('snaptato', { label: 'A potato friend', marks: [{ at: '.brand', cls: 'af-pic af-potato' }] });
})();
