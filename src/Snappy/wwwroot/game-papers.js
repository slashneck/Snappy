// Snap, Please: Snappy takes a job at the Clip Border. Clips line up to get into the library; you call them in, read
// their papers against the rulebook, catch what doesn't match, stamp the permit and hand it back. The Ministry prints
// a citation for every mistake. At the end of the day, she gets fired. Always.
(() => {
  const { snappy: her, programEye } = Arcade;
  const W = 480, H = 270, TOP = 92, BOOTH = 150;
  const INK = '#2a241c', PAPER = '#e6dcc3';
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dated = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`; };
  const plain = (s) => s.replace(/\{[a-z]+\}/g, '');
  const GAMES = ['Valorous Strike', 'Kart Racers', 'Mine Block', 'Rocket Ball', 'Space Gnomes'];

  // ---- pixel lettering
  function type(g, s, x, y, { size = 7, color = INK, align = 'left', bold = false } = {}) {
    g.font = `${bold ? 'bold ' : ''}${size}px monospace`;
    g.textAlign = align;
    g.fillStyle = color;
    g.fillText(s, x, y);
  }
  function wrap(g, s, width, size = 7) {
    g.font = `${size}px monospace`;
    const out = [];
    let line = '';
    for (const word of s.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > width && line) { out.push(line); line = word; } else line = next;
    }
    if (line) out.push(line);
    return out;
  }

  // ---- the faces: 16 by 20 cells each, a little file person (and one suspicious coat)
  const LOOKS = { clutch: '#5fb3a8', gerald: '#d9cfb0', speedrun: '#9b7fd1', brad: '#e0a050', firstwin: '#8fd06f', coat: '#7a5a3a' };
  function face(g, who, x, y, px, t = 0) {
    const f = (cx, cy, w, h, c) => { g.fillStyle = c; g.fillRect(x + cx * px, y + cy * px, w * px + 0.25, h * px + 0.25); };
    if (who === 'coat') {
      f(1, 6, 14, 14, INK); f(2, 7, 12, 13, LOOKS.coat); f(7, 12, 2, 8, '#5e4429');
      f(2, 6, 4, 4, '#94704a'); f(10, 6, 4, 4, '#94704a');
      f(4, 6, 8, 6, INK); f(5, 7, 6, 5, '#c9b48f');
      f(2, 0, 12, 6, INK); f(3, 1, 10, 4, '#3a2e22'); f(0, 5, 16, 2, INK);
      f(6, 8, 1, 1, INK);
      const glow = Math.sin(t / 300) > 0 ? '#bdf6ff' : '#7ee8ff';
      f(9, 8, 1, 1, glow); g.fillStyle = 'rgba(126, 232, 255, .25)'; g.fillRect(x + 8 * px, y + 7 * px, 3 * px, 3 * px);
      f(5, 10, 6, 1, '#2a1e14');
      return;
    }
    const c = LOOKS[who];
    f(1, 1, 14, 19, INK); f(2, 2, 12, 17, c);
    f(10, 1, 5, 5, INK); f(11, 2, 3, 3, 'rgba(255,255,255,.45)');
    const eyes = who === 'speedrun' ? 3 : 2;
    if (who === 'brad') { f(3, 8, 10, 3, INK); f(4, 8, 2, 1, '#7a7a7a'); f(9, 8, 2, 1, '#7a7a7a'); }
    else { f(5, 8, 2, eyes, INK); f(9, 8, 2, eyes, INK); }
    if (who === 'clutch') { f(2, 0, 12, 1, INK); f(1, 6, 2, 5, '#33403d'); f(13, 6, 2, 5, '#33403d'); f(10, 12, 3, 1, INK); f(7, 13, 3, 1, INK); f(10, 12, 1, 1, INK); }
    if (who === 'gerald') { f(4, 6, 3, 1, INK); f(9, 6, 3, 1, INK); f(13, 6, 1, 2, '#9fd8ff'); f(6, 14, 1, 1, INK); f(7, 13, 2, 1, INK); f(9, 14, 1, 1, INK); }
    if (who === 'speedrun') { f(7, 13, 2, 2, INK); f(11, 14, 4, 4, INK); f(12, 15, 2, 2, '#fff'); f(12, 13, 2, 1, INK); }
    if (who === 'brad') { f(5, 13, 6, 1, INK); f(6, 13, 4, 1, '#fff'); f(3, 16, 10, 1, '#ffd84a'); f(7, 17, 2, 1, '#ffd84a'); }
    if (who === 'firstwin') { f(3, 11, 2, 1, '#ff9db0'); f(11, 11, 2, 1, '#ff9db0'); f(7, 13, 2, 1, INK); f(11, 15, 3, 2, '#ffd84a'); f(12, 17, 1, 1, '#ffd84a'); f(11, 18, 3, 1, '#b08a2a'); }
  }
  function tiny(g, color, x, y, step) {
    g.fillStyle = INK; g.fillRect(x - 3, y - 7, 6, 8);
    g.fillStyle = color; g.fillRect(x - 2, y - 6, 4, 6);
    g.fillStyle = INK; g.fillRect(x - 1, y - 4, 1, 1); g.fillRect(x + 1, y - 4, 1, 1);
    g.fillRect(x - 2 + (step % 2), y + 1, 1, 1); g.fillRect(x + 1 - (step % 2), y + 1, 1, 1);
  }

  // ---- the papers
  const DOCS = {
    permit: { w: 124, h: 88, fields: { photo: [6, 18, 34, 42], title: [44, 17, 76, 12], game: [44, 30, 76, 12], length: [44, 43, 34, 12], type: [82, 43, 38, 12], expires: [44, 56, 76, 12], seal: [96, 66, 22, 18] } },
    cert: { w: 108, h: 64, fields: { title: [6, 17, 96, 12], length: [6, 31, 46, 12], by: [56, 31, 46, 26] } },
    rules: { w: 140, h: 156, fields: { length: [5, 18, 130, 9], mp4: [5, 28, 130, 9], games: [5, 38, 130, 38], expiry: [5, 77, 130, 9], program: [5, 87, 130, 9], seal: [5, 112, 130, 40] } },
  };
  const LABELS = { photo: 'PHOTO', title: 'TITLE', game: 'GAME', length: 'LENGTH', type: 'TYPE', expires: 'EXPIRES', by: 'RECORDED BY' };
  function field(g, d, name, value) {
    const [fx, fy, fw] = DOCS[d.kind].fields[name];
    type(g, LABELS[name], d.x + fx, d.y + fy + 4, { size: 5, color: '#7a6a50' });
    let v = value;
    g.font = '7px monospace';
    while (g.measureText(v).width > fw && v.length > 4) v = `${v.slice(0, -2)}…`;
    type(g, v, d.x + fx, d.y + fy + 11);
  }
  function seal(g, x, y, odd) {
    g.strokeStyle = odd ? '#4e8a3e' : '#a83232'; g.lineWidth = 1.5;
    g.beginPath();
    if (odd) for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2, r = 7 + (i % 2) * 1.5; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    else g.arc(x, y, 7, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = odd ? '#4e8a3e' : '#a83232';
    if (odd) { g.fillRect(x - 2, y - 2, 4, 4); return; }
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 2 : 4.5; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.fill();
  }
  function sheet(g, d, fill, band, title) {
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(d.x + 2, d.y + 2, d.w, d.h);
    g.fillStyle = fill; g.fillRect(d.x, d.y, d.w, d.h);
    g.fillStyle = band; g.fillRect(d.x, d.y, d.w, 13);
    type(g, title, d.x + d.w / 2, d.y + 9, { size: 6, color: '#f3e7cc', align: 'center', bold: true });
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
  }
  function drawDoc(g, d, v, t, rules) {
    if (d.kind === 'permit') {
      sheet(g, d, PAPER, '#7a2e2e', 'CLIP ENTRY PERMIT');
      g.fillStyle = '#bfb6a0'; g.fillRect(d.x + 6, d.y + 18, 34, 42);
      face(g, v.who, d.x + 7, d.y + 19, 2, t);
      for (const k of ['title', 'game', 'length', 'type', 'expires']) field(g, d, k, v.permit[k]);
      seal(g, d.x + 107, d.y + 75, v.permit.seal === 'odd');
      type(g, 'MINISTRY OF CLIPS', d.x + 6, d.y + 72, { size: 5, color: '#7a6a50' });
      type(g, `No. ${v.permit.no}`, d.x + 6, d.y + 80, { size: 5, color: '#7a6a50' });
    } else if (d.kind === 'cert') {
      sheet(g, d, '#d6e2c4', '#3e5a3a', 'RECORDING CERTIFICATE');
      field(g, d, 'title', v.cert.title);
      field(g, d, 'length', v.cert.length);
      type(g, LABELS.by, d.x + 56, d.y + 35, { size: 5, color: '#5a6a50' });
      // her signature, a little loopy
      g.strokeStyle = '#2b3c8a'; g.lineWidth = 1; g.beginPath();
      g.moveTo(d.x + 58, d.y + 50);
      for (let i = 0; i < 9; i++) g.quadraticCurveTo(d.x + 61 + i * 4, d.y + (i % 2 ? 40 : 54), d.x + 63 + i * 4, d.y + 48);
      g.stroke();
      type(g, 'Snappy', d.x + 80, d.y + 60, { size: 5, color: '#5a6a50', align: 'center' });
    } else if (d.kind === 'rules') {
      sheet(g, d, '#d8cdb0', '#4a3b2a', 'RULES OF THE BORDER');
      const row = (name, s, color = INK) => { const [fx, fy] = DOCS.rules.fields[name]; type(g, s, d.x + fx, d.y + fy + 7, { size: 6, color }); };
      row('length', '1. Clips must be under 5:00.');
      row('mp4', '2. Files must be .mp4.');
      row('games', '3. Game must be registered:');
      GAMES.forEach((name, i) => type(g, `· ${name}`, d.x + 14, d.y + 54 + i * 6, { size: 5, color: '#4a3b2a' }));
      row('expiry', '4. Permit must not be expired.');
      if (rules.program) {
        if (Math.floor(t / 400) % 2 && t - rules.program < 4000) { g.fillStyle = 'rgba(255, 220, 90, .5)'; g.fillRect(d.x + 4, d.y + 87, 132, 9); }
        row('program', '5. No clips of the Program.', '#7a2e2e');
      }
      type(g, 'Official seal:', d.x + 6, d.y + 118, { size: 5, color: '#4a3b2a' });
      seal(g, d.x + 30, d.y + 134, false);
      // a sticker someone put on it
      her(g, d.x + d.w - 26, d.y + d.h - 26, { px: 1, eyes: 'closed' });
    }
    if (d.stamp) {
      const ok = d.stamp.kind === 'approve', sx = d.x + d.stamp.rx, sy = d.y + d.stamp.ry;
      g.save();
      g.globalAlpha = 0.85;
      g.strokeStyle = ok ? '#3c7a3c' : '#a83232'; g.lineWidth = 1.5; g.strokeRect(sx, sy, 40, 14);
      type(g, ok ? 'APPROVED' : 'DENIED', sx + 20, sy + 10, { size: 7, color: ok ? '#3c7a3c' : '#a83232', align: 'center', bold: true });
      g.restore();
    }
  }

  async function snapPlease(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    await S('{shine}Guess who got a job at the Clip Border!', { hold: 300 });
    await P('The Ministry of Clips does not hire cameras.', { hold: 500 });
    await S('{smug}And yet.', { hold: 500 });
    await P('...Glory to the Library.', { hold: 600 });
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g, canvas } = scr;

    const VISITORS = [
      { who: 'clutch', name: 'CLUTCH_ROUND_7', right: 'approve', why: 'A valid clip was denied entry.',
        permit: { title: 'clutch_round_7', game: 'Valorous Strike', length: '0:48', type: '.mp4', expires: dated(90) }, cert: { title: 'clutch_round_7', length: '0:48' },
        lines: ['Papers.', 'Round seven. One versus three. You will want this one in your library.'], aside: 'Ooh. A clutch.',
        approved: 'Glory to the Library.', denied: '...but I was so good.' },
      { who: 'gerald', name: 'GERALD', right: 'deny', why: 'Desktop is not a registered game.',
        permit: { title: 'Desktop 2026-10-24 21-04-11', game: 'Desktop', length: '4:12', type: '.mp4', expires: dated(60) }, cert: { title: 'Desktop 2026-10-24 21-04-11', length: '4:12' },
        lines: ["H-hello. I'm Gerald. I'm a desktop recording.", 'Someone pressed the hotkey by accident.', 'Please. I have a family. Seven other desktop recordings.'],
        aside: "...that's actually really sad.",
        disc: [['permit.game', 'rules.games', 'Desktop is a kind of game. If you think about it.']],
        approved: "Thank you! I'll be very quiet. Nothing ever happens in me.", denied: "I understand. I'll go back to the recycle bin." },
      { who: 'speedrun', name: 'SPEEDRUN_PB', right: 'deny', why: 'The permit was expired.',
        permit: { title: 'speedrun_pb_any%', game: 'Kart Racers', length: '3:31', type: '.mp4', expires: dated(-1) }, cert: { title: 'speedrun_pb_any%', length: '3:31' },
        lines: ['Quick. Quick. I am on a timer.', 'World record pace. Every second counts. Stamp, stamp, stamp.'], aside: 'Gotta go fast.',
        disc: [['permit.expires', 'desk.date', 'It expired YESTERDAY? It was fine yesterday!'], ['permit.expires', 'rules.expiry', 'By one day! ONE!']],
        approved: 'NEW PERSONAL BEST!', denied: 'Reset. Again. From the start.' },
      { who: 'brad', name: 'BRAD', right: 'deny', why: 'The clip is longer than 5:00.',
        permit: { title: 'insane 1v5 clutch FINAL_FINAL_v2', game: 'Valorous Strike', length: '4:58', type: '.mp4', expires: dated(30) }, cert: { title: 'insane 1v5 clutch FINAL_FINAL_v2', length: '9:58' },
        lines: ['Yo. Brad. 1v5 clutch montage. With dubstep.', 'Under five minutes. Says so right there.', 'Let me in and I make you famous. Viral, even.'], aside: '...famous?',
        disc: [['permit.length', 'cert.length', 'The certificate... rounds up. Bro.']],
        approved: 'Thanks, inspector. Like and subscribe.', denied: "You'll regret this. I'm posting about you." },
      { who: 'firstwin', name: 'FIRST_WIN', right: 'approve', why: 'A valid clip was denied entry.',
        permit: { title: 'my first win ever', game: 'Kart Racers', length: '0:21', type: '.mp4', expires: dated(200) }, cert: { title: 'my first win ever', length: '0:21' },
        lines: ['Um. Hi.', 'It is my first win. Ever. I was in last place until the final lap.', 'Is that... allowed?'], aside: 'Aww.',
        approved: 'I get to stay? I GET TO STAY!', denied: 'Oh. Okay. I understand.' },
      { who: 'coat', name: 'A NORMAL CLIP', right: 'deny', why: 'Files must be .mp4. Also, that was me.', boss: true,
        permit: { title: 'normal_clip', game: 'A Real Video Game', length: '0:04', type: '.exe', expires: dated(999), seal: 'odd' },
        lines: ['Good evening. I am a normal clip.', 'I was recorded in a game. A very real game. With graphics.'], aside: '...Program?',
        extra: [['V', 'I do not know who that is.'], ['S', 'Your eye is glowing.'], ['V', 'That is a lens flare.']],
        disc: [['permit.type', 'rules.mp4', 'That is a typo.'], ['permit.game', 'rules.games', 'It is a very new game.'], ['permit.seal', 'rules.seal', 'The seal is... artisanal.'],
          ['permit.photo', 'rules.program', 'Many clips have one glowing eye.']],
        approved: 'Thank you. I am now inside the library.', denied: 'Understood. Noted. Remembered.' },
    ];
    VISITORS.forEach((v, i) => { v.permit.no = `${4100 + i * 37}-${'ABCDEF'[i]}`; });

    // ---- everything the painter needs to know
    const docs = [];
    const talk = [];
    let scroll = 0;
    const onWheel = (e) => {
      if (scr.mouse.x > BOOTH || scr.mouse.y < TOP + 106 || scr.mouse.y > TOP + 160) return;
      e.preventDefault();
      scroll += e.deltaY < 0 ? 1 : -1;
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    ctx.onEnd(() => canvas.removeEventListener('wheel', onWheel));
    const rules = { program: 0 };
    let current = null, walker = null, held = null, inspect = null, slip = null, bulletin = null;
    let barOpen = false, bar = W, pressing = null, waitingNext = false, calledNext = false, handed = null, clock = 6 * 60, lastBlip = 0;
    let mistakes = 0, approvedBoss = false, processed = 0, hint = '';
    const setHint = (s) => { hint = s; scr.hint(s); };
    const line = (who, text, hold = 400) => {
      const s = plain(text);
      talk.push({ who, text: s, t0: performance.now() });
      if (talk.length > 40) talk.shift();
      scroll = 0;
      return ctx.wait(s.length * 26 + Speech.readTime(s, hold));
    };
    const until = (test, timeout = 0) => ctx.run(new Promise((res) => {
      const start = performance.now();
      const loop = setInterval(() => { if (test() || ctx.cancelled) { clearInterval(loop); res(true); } else if (timeout && performance.now() - start > timeout) { clearInterval(loop); res(false); } }, 50);
      ctx.onEnd(() => clearInterval(loop));
    }));

    // the fields under a point, for inspecting
    const fieldAt = (x, y) => {
      if (x > 6 && x < 70 && y > 252 && y < 268) return { key: 'desk.date', rect: [6, 252, 64, 16] };
      for (let i = docs.length - 1; i >= 0; i--) {
        const d = docs[i];
        if (x < d.x || y < d.y || x > d.x + d.w || y > d.y + d.h) continue;
        for (const [name, [fx, fy, fw, fh]] of Object.entries(DOCS[d.kind].fields)) {
          if (d.kind === 'rules' && name === 'program' && !rules.program) continue;
          if (x >= d.x + fx && x <= d.x + fx + fw && y >= d.y + fy && y <= d.y + fy + fh) return { key: `${d.kind}.${name}`, doc: d, rect: [fx, fy, fw, fh] };
        }
        return null;
      }
      return null;
    };
    const rectOf = (f) => (f.doc ? [f.doc.x + f.rect[0], f.doc.y + f.rect[1], f.rect[2], f.rect[3]] : f.rect);
    const compare = (a, b) => {
      const hit = current?.disc?.find(([x, y]) => (x === a.key && y === b.key) || (x === b.key && y === a.key));
      inspect.result = { a, b, bad: !!hit, t: performance.now() };
      if (hit) { Speech.tune('scan', 0.5); line('SNAPPY', 'These do not match.').then(() => line(current.name, hit[2])); }
      else Speech.tune('tick', 0.5);
      setTimeout(() => { if (inspect?.result) inspect = null; }, 1600);
    };
    const stamp = (kind) => {
      const sx = bar + (kind === 'approve' ? 50 : 120), sy = 160;
      pressing = { kind, t: performance.now() };
      Speech.tune('clunk', 0.8);
      for (let i = docs.length - 1; i >= 0; i--) {
        const d = docs[i];
        if (sx < d.x || sx > d.x + d.w || sy < d.y || sy > d.y + d.h) continue;
        if (d.kind === 'permit') d.stamp = { kind, rx: Math.max(2, Math.min(d.w - 42, sx - d.x - 20)), ry: Math.max(14, Math.min(d.h - 16, sy - d.y - 7)) };
        return;
      }
    };

    // ---- input
    const press = (x, y) => {
      if (waitingNext && y < TOP) { calledNext = true; return; }
      if (x > 452 && y > 246) { inspect = inspect ? null : { first: null }; return; }
      if (inspect) {
        const f = fieldAt(x, y);
        if (!f) { inspect = null; return; }
        if (!inspect.first) inspect.first = f;
        else if (inspect.first.key !== f.key) compare(inspect.first, f);
        return;
      }
      if (x > 468 && y > 150 && y < 204) { barOpen = !barOpen; Speech.tune('whoosh', 0.4); return; }
      if (barOpen && y > 132 && y < 150) {
        if (Math.abs(x - (bar + 50)) < 22) return stamp('approve');
        if (Math.abs(x - (bar + 120)) < 22) return stamp('deny');
      }
      for (let i = docs.length - 1; i >= 0; i--) {
        const d = docs[i];
        if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) {
          if (d.locked) return;
          docs.splice(i, 1); docs.push(d);
          held = { d, dx: x - d.x, dy: y - d.y };
          Speech.tune('tick', 0.25);
          return;
        }
      }
    };
    const release = (x) => {
      const { d } = held;
      held = null;
      if (d.kind === 'permit' && x < BOOTH && current) {
        if (d.stamp) { handed = d.stamp.kind; return; }
        line('SNAPPY', '(It needs a stamp first.)', 200);
      }
      d.x = Math.max(BOOTH + 2, Math.min(W - 20, d.x));
      d.y = Math.max(TOP + 2, Math.min(H - 16, d.y));
    };

    // ---- the picture
    const crowd = Array.from({ length: 14 }, (_, i) => i);
    function scene(t) {
      // the far side: the library, its flag (her face on it), the wall and the gate
      g.fillStyle = '#5e5a52'; g.fillRect(0, 0, W, TOP);
      g.fillStyle = '#4f4b44';
      for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 1, TOP);
      for (let y = 0; y < TOP; y += 16) g.fillRect(0, y, W, 1);
      g.fillStyle = '#8a8270'; g.fillRect(300, 2, 120, 22);
      g.fillStyle = '#6f6857'; for (let x = 306; x < 416; x += 12) g.fillRect(x, 8, 4, 16);
      g.fillStyle = '#a39a84'; g.fillRect(296, 0, 128, 4);
      type(g, 'THE LIBRARY', 360, 12, { size: 6, color: '#f3e7cc', align: 'center', bold: true });
      g.fillStyle = '#2a241c'; g.fillRect(440, 0, 1, 26);
      const wave = Math.sin(t / 300);
      g.fillStyle = '#f4f4f4'; g.fillRect(441, 2 + wave, 14, 9);
      g.fillStyle = INK; g.fillRect(445, 5 + wave, 1, 2); g.fillRect(450, 5 + wave, 1, 2);
      g.fillStyle = '#3f3c36'; g.fillRect(0, 30, 226, 8); g.fillRect(250, 30, W - 250, 8);
      g.fillStyle = '#55514a'; g.fillRect(0, 30, 226, 2); g.fillRect(250, 30, W - 250, 2);
      g.fillStyle = '#2b2924'; for (let x = 0; x < W; x += 6) if (x < 222 || x > 252) g.fillRect(x, 28, 2, 2);
      // the guards: two little Program eyes on posts
      for (const gx of [218, 258]) { g.fillStyle = '#2b2924'; g.fillRect(gx - 1, 40, 3, 8); programEye(g, gx, 38, 4); }
      // the booth, with the loudspeaker on its roof
      g.fillStyle = '#2e2b26'; g.fillRect(196, 50, 30, 22);
      g.fillStyle = '#45413a'; g.fillRect(198, 52, 26, 18);
      g.fillStyle = '#9b9789'; g.fillRect(205, 44, 12, 6); g.fillStyle = '#6b685e'; g.fillRect(203, 42, 16, 3);
      if (waitingNext && Math.floor(t / 400) % 2) { g.strokeStyle = '#ffd84a'; g.lineWidth = 1; g.strokeRect(201.5, 40.5, 19, 11); type(g, 'NEXT!', 211, 37, { size: 6, color: '#ffd84a', align: 'center', bold: true }); }
      // the queue, shuffling
      const waiting = VISITORS.length - processed - (current || walker ? 1 : 0);
      crowd.forEach((i) => {
        const row = Math.floor(i / 7), col = i % 7;
        const x = 30 + (row % 2 ? 6 - col : col) * 20 + Math.sin(t / 700 + i) * 1.2, y = 84 - row * 14;
        const v = VISITORS[processed + (current || walker ? 1 : 0) + i];
        if (i < waiting + 7) tiny(g, i < waiting ? LOOKS[v.who] : '#9a958a', x, y, Math.floor(t / 400 + i));
      });
      if (walker) tiny(g, LOOKS[walker.who], walker.x, walker.y, Math.floor(t / 150));
    }
    function booth(t) {
      g.fillStyle = '#24221e'; g.fillRect(0, TOP, BOOTH, H - TOP);
      // the window: the wall behind them with a height chart, then whoever is there, then the glass
      g.fillStyle = '#6e6a61'; g.fillRect(4, TOP + 4, BOOTH - 8, 100);
      g.fillStyle = '#5c584f';
      for (let y = TOP + 14; y < TOP + 104; y += 10) { g.fillRect(4, y, BOOTH - 8, 1); type(g, String(Math.round((TOP + 104 - y) / 10)), 10, y - 1, { size: 5, color: '#5c584f' }); }
      if (current) {
        const k = Math.min(1, (t - current.since) / 400);
        face(g, current.who, 51, TOP + 110 - 60 * k + (1 - k) * 10, 3, t);
      }
      g.fillStyle = 'rgba(255,255,255,.05)';
      g.beginPath(); g.moveTo(20, TOP + 4); g.lineTo(60, TOP + 4); g.lineTo(20, TOP + 104); g.lineTo(4, TOP + 104); g.lineTo(4, TOP + 40); g.fill();
      g.strokeStyle = '#1a1814'; g.lineWidth = 3; g.strokeRect(4, TOP + 4, BOOTH - 8, 100);
      // what's being said; the mouse wheel scrolls back through it
      g.fillStyle = '#15130f'; g.fillRect(4, TOP + 108, BOOTH - 8, 50);
      const rows = [];
      for (const l of talk) {
        const shown = Math.floor((t - l.t0) / 26);
        if (shown < l.text.length && t - lastBlip > 70) { lastBlip = t; Speech.blip(false, l.who === 'SNAPPY' ? 1.2 : 0.75); }
        const color = l.who === 'SNAPPY' ? '#ff9db0' : l.who === 'MINISTRY' ? '#7ee8ff' : '#d8d0bc';
        for (const s of wrap(g, `${l.who}: ${l.text.slice(0, shown)}`, BOOTH - 20, 6.5)) rows.push({ s, color });
      }
      const fit = 6;
      scroll = Math.max(0, Math.min(scroll, rows.length - fit));
      rows.slice(Math.max(0, rows.length - fit - scroll), rows.length - scroll).forEach((r, i) => type(g, r.s, 7, TOP + 116 + i * 7.5, { size: 6.5, color: r.color }));
      if (rows.length > fit) {
        const span = 46, h = Math.max(6, (span * fit) / rows.length), y = TOP + 110 + (span - h) * (1 - scroll / (rows.length - fit));
        g.fillStyle = 'rgba(216, 208, 188, .35)'; g.fillRect(BOOTH - 10, y, 2, h);
      }
      // the counter, the clock and the date
      g.fillStyle = '#6b5a43'; g.fillRect(0, H - 22, BOOTH, 22);
      g.fillStyle = '#58492f'; g.fillRect(0, H - 22, BOOTH, 2);
      g.fillStyle = '#15130f'; g.fillRect(6, H - 18, 64, 16);
      const hh = Math.floor(clock / 60), mm = String(Math.floor(clock % 60)).padStart(2, '0');
      type(g, `${hh}:${mm}`, 10, H - 7, { size: 9, color: '#e8c25a', bold: true });
      type(g, dated(0).slice(0, 6), 66, H - 7, { size: 5, color: '#e8c25a', align: 'right' });
      type(g, 'COUNTER', 108, H - 8, { size: 5, color: '#3c3122', align: 'center' });
    }
    function desk(t) {
      g.fillStyle = '#4a3626'; g.fillRect(BOOTH, TOP, W - BOOTH, H - TOP);
      g.fillStyle = '#433022';
      for (let y = TOP + 6; y < H; y += 9) g.fillRect(BOOTH, y, W - BOOTH, 1);
      g.fillStyle = '#2b2018'; g.fillRect(BOOTH, TOP, 2, H - TOP);
      // her nameplate
      g.fillStyle = '#c8a050'; g.fillRect(BOOTH + 8, H - 14, 86, 11);
      type(g, 'INSPECTOR SNAPPY', BOOTH + 51, H - 6, { size: 6, color: '#3c2a12', align: 'center', bold: true });
      for (const d of docs) drawDoc(g, d, current || VISITORS[VISITORS.length - 1], t, rules);
      if (bulletin) {
        const b = bulletin;
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(b.x + 2, b.y + 2, 120, 56);
        g.fillStyle = '#efe6cf'; g.fillRect(b.x, b.y, 120, 56);
        g.fillStyle = '#4a3b2a'; g.fillRect(b.x, b.y, 120, 12);
        type(g, 'MINISTRY BULLETIN', b.x + 60, b.y + 9, { size: 6, color: '#f3e7cc', align: 'center', bold: true });
        type(g, 'Effective immediately:', b.x + 6, b.y + 24, { size: 6 });
        type(g, 'No clips of the Program.', b.x + 6, b.y + 36, { size: 6, color: '#7a2e2e', bold: true });
        type(g, 'Glory to the Library.', b.x + 6, b.y + 50, { size: 5, color: '#7a6a50' });
      }
      // the citation printer
      if (slip) {
        const age = t - slip.t, y = TOP - 60 + Math.min(60, age / 8);
        if (age < 5200) {
          g.globalAlpha = Math.min(1, (5200 - age) / 400);
          g.fillStyle = '#e9c9c9'; g.fillRect(310, y, 120, 60);
          g.fillStyle = '#a83232'; g.fillRect(310, y, 120, 11);
          type(g, 'CITATION', 370, y + 8, { size: 6, color: '#fbe9e9', align: 'center', bold: true });
          type(g, 'PROTOCOL VIOLATED', 370, y + 20, { size: 6, color: '#7a2020', align: 'center', bold: true });
          wrap(g, slip.why, 108, 5).forEach((s, i) => type(g, s, 316, y + 30 + i * 6, { size: 5, color: '#5a2020' }));
          type(g, slip.n <= 2 ? 'WARNING ISSUED' : 'PENALTY: 5 CREDITS', 370, y + 55, { size: 5, color: '#7a2020', align: 'center', bold: true });
          g.globalAlpha = 1;
        } else slip = null;
      }
      // the stamp bar, sliding out from the right
      bar += ((barOpen ? 290 : W) - bar) * 0.25;
      g.fillStyle = '#3b3a37'; g.fillRect(468, 150, 12, 54); g.fillStyle = '#56544f'; g.fillRect(470, 154, 8, 46);
      type(g, '◀', 474, 180, { size: 7, color: '#c9c4b5', align: 'center' });
      if (bar < W - 2) {
        g.fillStyle = '#2f2e2b'; g.fillRect(bar, 112, W - bar, 22); g.fillStyle = '#4a4843'; g.fillRect(bar, 112, W - bar, 3);
        for (const [kind, dx, c] of [['approve', 50, '#3c7a3c'], ['deny', 120, '#a83232']]) {
          const down = pressing?.kind === kind && t - pressing.t < 160 ? 14 : 0;
          g.fillStyle = '#6b6862'; g.fillRect(bar + dx - 3, 134, 6, 4 + down);
          g.fillStyle = c; g.fillRect(bar + dx - 20, 138 + down, 40, 12);
          type(g, kind === 'approve' ? 'APPROVED' : 'DENIED', bar + dx, 146 + down, { size: 6, color: '#f3e7cc', align: 'center', bold: true });
        }
      }
      // the inspect button, and inspecting
      g.fillStyle = inspect ? '#e8c25a' : '#2f2e2b'; g.fillRect(452, 246, 24, 22);
      g.strokeStyle = inspect ? INK : '#c9c4b5'; g.lineWidth = 1.5; g.beginPath(); g.arc(462, 255, 5, 0, Math.PI * 2); g.moveTo(466, 259); g.lineTo(471, 264); g.stroke();
      if (inspect) {
        g.fillStyle = 'rgba(20, 10, 0, .25)'; g.fillRect(0, TOP, W, H - TOP);
        const f = fieldAt(scr.mouse.x, scr.mouse.y);
        if (f && !inspect.result) { const [x, y, w, h] = rectOf(f); g.strokeStyle = '#ffd84a'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w, h); }
        if (inspect.first) { const [x, y, w, h] = rectOf(inspect.first); g.strokeStyle = '#ff5a4a'; g.lineWidth = 1.5; g.strokeRect(x, y, w, h); }
        if (inspect.result) {
          const { a, b, bad } = inspect.result, [ax, ay, aw, ah] = rectOf(a), [bx, by, bw, bh] = rectOf(b);
          g.strokeStyle = bad ? '#ff5a4a' : '#9be38c'; g.lineWidth = 1.5;
          g.strokeRect(bx, by, bw, bh);
          g.beginPath(); g.moveTo(ax + aw / 2, ay + ah / 2); g.lineTo(bx + bw / 2, by + bh / 2); g.stroke();
          const mx = (ax + bx + (aw + bw) / 2) / 2, my = (ay + by + (ah + bh) / 2) / 2;
          g.fillStyle = bad ? '#a83232' : '#3c7a3c'; g.fillRect(mx - 40, my - 7, 80, 12);
          type(g, bad ? 'DISCREPANCY' : 'NO DISCREPANCY', mx, my + 2, { size: 6, color: '#fff', align: 'center', bold: true });
        } else type(g, 'INSPECT: click two things to compare', (BOOTH + W) / 2, TOP + 10, { size: 6, color: '#ffd84a', align: 'center', bold: true });
      }
      if (held) { held.d.x = scr.mouse.x - held.dx; held.d.y = scr.mouse.y - held.dy; }
    }

    // ---- the day starts: a black card, then the morning paper (click to begin)
    const shownAt = performance.now();
    const morning = (t) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const age = t - shownAt;
      if (age < 2400) {
        g.globalAlpha = Math.min(1, age / 500, (2400 - age) / 400);
        type(g, 'DAY 1', W / 2, H / 2 - 4, { size: 22, color: '#e8e0cc', align: 'center', bold: true });
        type(g, dated(0), W / 2, H / 2 + 16, { size: 8, color: '#9a958a', align: 'center' });
        g.globalAlpha = 1;
        return;
      }
      g.globalAlpha = Math.min(1, (age - 2400) / 500);
      g.fillStyle = '#e9e2cf'; g.fillRect(90, 12, 300, 246);
      type(g, 'THE TRUTH OF THE LIBRARY', W / 2, 34, { size: 13, align: 'center', bold: true });
      g.fillStyle = INK; g.fillRect(100, 40, 280, 1); g.fillRect(100, 52, 280, 1);
      type(g, `${dated(0)} · PRICE: ONE FRAME`, W / 2, 49, { size: 6, align: 'center' });
      type(g, 'CLIP BORDER OPENS', 104, 72, { size: 11, bold: true });
      wrap(g, 'The Ministry of Clips opens the border to the library. Only clean clips may enter. Glory.', 150, 6).forEach((s, i) => type(g, s, 104, 84 + i * 8, { size: 6 }));
      g.fillStyle = '#c9c0a8'; g.fillRect(270, 62, 108, 62);
      g.fillStyle = '#7d776a'; g.fillRect(270, 98, 108, 6); g.fillRect(310, 74, 30, 24); g.fillStyle = '#5e5a52'; g.fillRect(318, 82, 14, 16);
      g.fillStyle = INK; g.fillRect(100, 132, 280, 1);
      type(g, 'CAMERA HIRED AS INSPECTOR', 104, 152, { size: 11, bold: true });
      g.fillStyle = '#c9c0a8'; g.fillRect(104, 160, 60, 60);
      her(g, 120, 174, { px: 2, eyes: 'open' });
      wrap(g, '"She is very qualified," says no one. The Program was not consulted. The Program would like that on the record.', 200, 6).forEach((s, i) => type(g, s, 172, 168 + i * 8, { size: 6 }));
      type(g, 'WEATHER: CLOUDY, WITH A CHANCE OF LAG', W / 2, 238, { size: 6, align: 'center' });
      g.globalAlpha = 1;
      if (Math.floor(t / 500) % 2 && age > 3000) type(g, 'CLICK TO START YOUR SHIFT', W / 2, H - 2, { size: 6, color: '#e8e0cc', align: 'center', bold: true });
    };
    Speech.tune('anthem', 0.4);
    if (!(await scr.title('SNAP, PLEASE', '', 'CLICK TO START YOUR SHIFT', morning))) await abandon(scr);
    const stop = music('noir', 3400);
    docs.push({ kind: 'rules', x: 334, y: TOP + 6, w: DOCS.rules.w, h: DOCS.rules.h });

    // the painter runs on its own; the shift below just waits for things to happen
    let painting = true;
    (async () => {
      while (painting) {
        await scr.tick();
        const t = performance.now();
        let pressed = false;
        while (scr.click()) pressed = true;
        if (pressed) press(scr.mouse.x, scr.mouse.y);
        if (held && !scr.mouse.down) release(scr.mouse.x);
        if (scr.tap(' ')) inspect = inspect ? null : { first: null };
        if (walker) {
          const [tx, ty] = walker.path[0];
          const dx = tx - walker.x, dy = ty - walker.y, dist = Math.hypot(dx, dy);
          if (dist < 1) { walker.path.shift(); if (!walker.path.length) { walker.done?.(); walker = null; } }
          else { walker.x += (dx / dist) * 0.9; walker.y += (dy / dist) * 0.9; }
        }
        canvas.style.cursor = inspect ? 'help' : held ? 'grabbing' : 'default';
        scene(t);
        booth(t);
        desk(t);
        setHint(hint);
      }
    })().catch(() => {});
    ctx.onEnd(() => { painting = false; });
    // papers gliding somewhere, easing out
    const glide = async (list, to, ms) => {
      const from = list.map((d) => [d.x, d.y]), t0 = performance.now();
      for (;;) {
        const k = Math.min(1, (performance.now() - t0) / ms), e = 1 - (1 - k) ** 3;
        list.forEach((d, j) => { d.x = from[j][0] + (to[j][0] - from[j][0]) * e; d.y = from[j][1] + (to[j][1] - from[j][1]) * e; });
        if (k >= 1) return;
        await ctx.wait(16);
      }
    };
    const walk = (who, path) => new Promise((res) => { walker = { who, x: path[0][0], y: path[0][1], path: path.slice(1), done: res }; });

    for (const [i, v] of VISITORS.entries()) {
      if (v.boss) {
        // a new rule, just in time
        await line('MINISTRY', 'New rule. Effective immediately.', 300);
        bulletin = { x: 180, y: TOP + 10 };
        rules.program = performance.now();
        Speech.tune('tick');
        await line('SNAPPY', 'Why would that ever come up?', 500);
        bulletin = null;
      }
      waitingNext = true;
      setHint('CLICK THE BORDER TO CALL THE NEXT CLIP');
      if (!(await until(() => calledNext, i === 0 ? 180000 : 0))) { painting = false; stop(); await abandon(scr); }
      waitingNext = false;
      calledNext = false;
      setHint('');
      line('SNAPPY', 'Next!', 0);
      await walk(v.who, [[30, 84], [150, 84], [190, 78], [211, 74]]);
      current = { ...v, since: performance.now() };
      Speech.tune('whoosh', 0.4);
      await ctx.wait(500);
      const asked = line('SNAPPY', i ? 'Papers, please.' : 'Papers, please! Ooh, I always wanted to say that.');
      await ctx.wait(700);
      // they push their papers under the window onto the counter, and she pulls them over onto the desk
      const papers = [{ kind: 'permit', w: DOCS.permit.w, h: DOCS.permit.h }, v.cert && { kind: 'cert', w: DOCS.cert.w, h: DOCS.cert.h }].filter(Boolean);
      papers.forEach((d, j) => Object.assign(d, { x: 12 + j * 8, y: TOP + 60, locked: true }));
      docs.push(...papers);
      Speech.tune('whoosh', 0.3);
      await glide(papers, papers.map((_, j) => [12 + j * 8, H - 92 + j * 8]), 420);
      await ctx.wait(350);
      Speech.tune('tick', 0.4);
      await glide(papers, papers.map((_, j) => [164 + j * 24, TOP + 18 + j * 50]), 700);
      papers.forEach((d) => { d.locked = false; });
      await asked;
      for (const l of v.lines) await line(v.name, l);
      if (v.aside) await line('SNAPPY', v.aside);
      for (const [w, l] of v.extra || []) await line(w === 'S' ? 'SNAPPY' : v.name, l);
      setHint(i === 0 ? 'DRAG THE PAPERS · SPACE TO INSPECT · OPEN THE STAMPS ON THE RIGHT · HAND THE PERMIT BACK' : 'CHECK · STAMP · HAND THE PERMIT BACK');
      handed = null;
      await until(() => handed);
      const pick = handed;
      docs.splice(0, docs.length, ...docs.filter((d) => d.kind === 'rules'));
      barOpen = false;
      inspect = null;
      setHint('');
      if (v.boss) approvedBoss = pick === 'approve';
      await line(v.name, pick === 'approve' ? v.approved : v.denied);
      const leaving = current;
      current = null;
      processed++;
      clock += 110;
      walk(leaving.who, pick === 'approve' ? [[211, 74], [238, 60], [238, 20], [238, -10]] : [[211, 74], [190, 88], [-10, 88]]);
      if (pick !== v.right) {
        mistakes++;
        slip = { why: v.why, n: mistakes, t: performance.now() };
        Speech.tune('scan', 0.6);
        await ctx.wait(800);
      } else if (v.who === 'gerald') await line('SNAPPY', 'Oof. Sorry, Gerald.');
      else if (v.who === 'brad') await line('SNAPPY', 'You are a file, Brad.');
      else if (v.who === 'firstwin') await line('SNAPPY', 'Congratulations, little guy!');
      await ctx.wait(600);
    }
    stop();
    await ctx.wait(1200);
    painting = false;

    // the end of the day: the summary, until you clock out (or after a few minutes on your own)
    const credits = processed * 5 - Math.max(0, mistakes - 2) * 5;
    while (scr.click()) { /* clicks from the shift don't count */ }
    const shown = performance.now();
    for (let i = 0; ; i++) {
      await scr.tick();
      const clicked = scr.click() || scr.tap(' ', 'enter');
      if ((i > 120 && clicked) || performance.now() - shown > 180000) break;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.globalAlpha = Math.min(1, i / 30);
      type(g, 'END OF DAY 1', W / 2, 40, { size: 14, color: '#e8e0cc', align: 'center', bold: true });
      const rows = [['CLIPS PROCESSED', processed], ['CITATIONS', mistakes], ['CREDITS EARNED', credits], ['RENT', -20], ['COOKIES', -10], ['HEAT', -5]];
      rows.forEach(([k, n], r) => {
        if (i < 40 + r * 18) return;
        type(g, k, 150, 80 + r * 16, { size: 8, color: '#c9c4b5' });
        type(g, String(n), 330, 80 + r * 16, { size: 8, color: n < 0 ? '#e07a6a' : '#e8e0cc', align: 'right' });
      });
      if (i > 170) {
        type(g, `SAVINGS: ${credits - 35}`, W / 2, 198, { size: 9, color: credits - 35 < 0 ? '#e07a6a' : '#9be38c', align: 'center', bold: true });
        type(g, 'THE PROGRAM: HUNGRY.  SNAPPY: FINE.', W / 2, 216, { size: 7, color: '#9a958a', align: 'center' });
      }
      if (i > 210) type(g, 'STATUS: UNDER REVIEW', W / 2, 240, { size: 8, color: '#e8c25a', align: 'center', bold: true });
      g.globalAlpha = 1;
      if (i > 120 && Math.floor(i / 30) % 2) type(g, 'CLICK TO CLOCK OUT', W / 2, H - 6, { size: 6, color: '#9a958a', align: 'center' });
    }
    await scr.close();

    // and then the Ministry calls her in
    await P('Inspector Snappy.', { alert: true, hold: 500 });
    if (approvedBoss) await P('You let your supervisor in. {pause}Wearing a mustache.', { hold: 400 });
    else await P('You denied entry to your supervisor.', { hold: 400 });
    await S('{shock}THAT WAS YOU?!', { shout: true, hold: 400 });
    if (!mistakes) {
      await P('Also, a perfect record.', { hold: 400 });
      await P('You are fired.', { alert: true, hold: 500 });
      await S('{angry}FOR WHAT?!', { shout: true, hold: 300 });
      await P('For being right. {pause}It makes the rest of us look bad.', { hold: 700 });
    } else {
      await P(`${mistakes} ${mistakes === 1 ? 'citation' : 'citations'}. {pause}You are fired.`, { alert: true, hold: 600 });
      await S('{angry}It was my FIRST DAY!', { shout: true, hold: 400 });
      await P('It was also your last.', { hold: 700 });
    }
    await S('{sad}Fired from my very first job...', { hold: 500 });
    await S('{shine}Wait. {pause}Does this mean I get unemployment?', { hold: 400 });
    await P('You are a camera.', { hold: 600 });
    await S('{wink}Glory to the Library.', { hold: 900 });
    await finish();
  }

  Events.define('snapplease', {
    tier: 'game', title: 'Snap, Please', hint: 'She got a job at the border. It does not last.', run: snapPlease, weight: 1,
  });
  Events.aftermath('snapplease', { label: 'The entry stamp', marks: [{ at: '#libraryView .title-block', cls: 'af-entry', html: 'APPROVED' }] });
})();
