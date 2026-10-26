// Snap the Sprite: climb a short Spire of four floors, choosing the path on the map, and fight with a deck of cards.
// Three energy a turn, five cards in hand, and the enemies show what they're about to do. After a fight you pick a
// card. Her favourite card asks the Program to decide for her.
(() => {
  const { vector: her, programEye, minion } = Arcade;
  const W = 480, H = 270, TAU = Math.PI * 2;
  const CW = 78, CH = 106;
  const DRAW_AT = { x: 22, y: H - 22 }, DISCARD_AT = { x: W - 22, y: H - 22 };

  const CARDS = {
    snap: { name: 'Snap', cost: 1, type: 'attack', text: 'Deal 6 damage.', act: (b, t) => b.hit(t, 6) },
    cap: { name: 'Lens Cap', cost: 1, type: 'skill', text: 'Gain 5 Block.', act: (b) => b.guard(5) },
    flash: { name: 'Flash', cost: 2, type: 'attack', text: 'Deal 8 damage. Apply 2 Dazzled.', act: (b, t) => { b.hit(t, 8); t.dazzled += 2; } },
    ask: { name: 'Ask the Program', cost: 0, type: 'skill', text: '0 damage. The Program plays a random card for you.', act: (b) => b.ask() },
    quick: { name: 'Quick Clip', cost: 0, type: 'attack', text: 'Deal 3 damage. Draw 1 card.', act: (b, t) => { b.hit(t, 3); b.draw(1); } },
    reel: { name: 'Highlight Reel', cost: 1, type: 'attack', text: 'Deal 4 damage twice.', act: (b, t) => { b.hit(t, 4); b.hit(t, 4); } },
    buffer: { name: 'Buffer', cost: 1, type: 'skill', text: 'Gain 8 Block.', act: (b) => b.guard(8) },
    slowmo: { name: 'Slow Motion', cost: 1, type: 'skill', text: 'Gain 4 Block. Enemies deal 25% less this turn.', act: (b) => { b.guard(4); b.slow = true; } },
    render: { name: 'Render', cost: 2, type: 'attack', text: 'Deal 15 damage.', act: (b, t) => b.hit(t, 15) },
    burst: { name: 'Burst Mode', cost: 1, type: 'attack', text: 'Deal 3 damage to ALL enemies 3 times.', all: true, act: (b) => { for (let i = 0; i < 3; i++) b.foes.filter((f) => f.hp > 0).forEach((f) => b.hit(f, 3)); } },
  };
  const REWARDS = ['quick', 'reel', 'buffer', 'slowmo', 'render', 'burst', 'flash', 'ask'];
  const FOES = {
    frame: () => [{ name: 'Stuck Frame', hp: 26, art: 'frame', intents: [{ k: 'attack', n: 6 }, { k: 'attack', n: 7 }, { k: 'block', n: 6 }] }],
    minions: () => [0, 1].map((i) => ({ name: 'Lag Minion', hp: 15, art: 'minion', intents: i ? [{ k: 'block', n: 4 }, { k: 'attack', n: 5 }] : [{ k: 'attack', n: 5 }, { k: 'block', n: 4 }] })),
    wheel: () => [{ name: 'The Buffer Wheel', hp: 36, art: 'wheel', intents: [{ k: 'attack', n: 3, times: 3 }, { k: 'block', n: 10 }, { k: 'attack', n: 11 }] }],
    update: () => [{ name: 'The Forced Update', hp: 56, art: 'update', intents: [{ k: 'block', n: 8 }, { k: 'attack', n: 9 }, { k: 'restart' }] }],
  };
  const MAP = [
    [{ kind: 'fight', foes: 'frame' }],
    [{ kind: 'fight', foes: 'minions' }, { kind: 'rest' }],
    [{ kind: 'elite', foes: 'wheel' }, { kind: 'treasure' }],
    [{ kind: 'boss', foes: 'update' }],
  ];
  const nodeAt = (row, i) => ({ x: W / 2 + (i - (MAP[row].length - 1) / 2) * 120, y: 226 - row * 58 });
  const ease = (from, to, k) => from + (to - from) * k;

  function wrap(g, s, width) {
    const rows = [''];
    for (const w of s.split(' ')) { const next = rows[rows.length - 1] ? `${rows[rows.length - 1]} ${w}` : w; if (g.measureText(next).width > width) rows.push(w); else rows[rows.length - 1] = next; }
    return rows;
  }
  // a card, laid out like the real ones: ribbon, picture, type, words, and the cost in an orb
  function cardFace(g, id, x, y, { scale = 1, rot = 0, alpha = 1, dim = false } = {}) {
    const c = CARDS[id], attack = c.type === 'attack';
    g.save();
    g.translate(x, y); g.rotate(rot); g.scale(scale, scale);
    g.globalAlpha = alpha;
    g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.roundRect(-CW / 2 + 3, -CH / 2 + 4, CW, CH, 7); g.fill();
    g.fillStyle = '#0d0b0a'; g.beginPath(); g.roundRect(-CW / 2 - 1.5, -CH / 2 - 1.5, CW + 3, CH + 3, 8); g.fill();
    const frame = g.createLinearGradient(0, -CH / 2, 0, CH / 2);
    frame.addColorStop(0, attack ? '#b4473d' : '#3f80c0'); frame.addColorStop(1, attack ? '#7a2a24' : '#24507e');
    g.fillStyle = frame; g.beginPath(); g.roundRect(-CW / 2, -CH / 2, CW, CH, 7); g.fill();
    // the picture
    g.fillStyle = '#1c1714'; g.beginPath(); g.roundRect(-CW / 2 + 6, -CH / 2 + 21, CW - 12, 36, 4); g.fill();
    g.save(); g.translate(0, -CH / 2 + 39);
    if (id === 'ask') programEye(g, 0, 0, 13);
    else if (attack) { g.fillStyle = '#ffd25a'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, r = i % 2 ? 6 : 14; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); }
    else { g.fillStyle = '#9fd2ff'; g.beginPath(); g.moveTo(0, -13); g.lineTo(11, -8); g.lineTo(9, 7); g.lineTo(0, 14); g.lineTo(-9, 7); g.lineTo(-11, -8); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-1.5, -9, 3, 18); }
    g.restore();
    // the name, on its ribbon
    g.fillStyle = 'rgba(0, 0, 0, .35)'; g.fillRect(-CW / 2 + 3, -CH / 2 + 5, CW - 6, 13);
    g.fillStyle = '#fff4e0'; g.font = '700 8.5px "Segoe UI", sans-serif'; g.textAlign = 'center';
    g.fillText(c.name, 0, -CH / 2 + 14.5);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(-14, -CH / 2 + 59, 28, 9, 4); g.fill();
    g.fillStyle = '#e8dcc8'; g.font = '600 6px "Segoe UI", sans-serif'; g.fillText(attack ? 'Attack' : 'Skill', 0, -CH / 2 + 65.5);
    // what it does
    g.fillStyle = '#1c1714'; g.beginPath(); g.roundRect(-CW / 2 + 5, -CH / 2 + 71, CW - 10, CH - 76, 4); g.fill();
    g.fillStyle = '#f4ead6'; g.font = '600 7.2px "Segoe UI", sans-serif';
    const rows = wrap(g, c.text, CW - 16);
    const top = -CH / 2 + 71 + (CH - 76) / 2 - (rows.length * 9) / 2 + 7;
    rows.forEach((r, i) => g.fillText(r, 0, top + i * 9));
    // the cost
    g.fillStyle = '#0d0b0a'; g.beginPath(); g.arc(-CW / 2 + 4, -CH / 2 + 4, 10, 0, TAU); g.fill();
    const orb = g.createRadialGradient(-CW / 2 + 1, -CH / 2 + 1, 1, -CW / 2 + 4, -CH / 2 + 4, 9);
    orb.addColorStop(0, '#ffd28a'); orb.addColorStop(1, '#e8701c');
    g.fillStyle = orb; g.beginPath(); g.arc(-CW / 2 + 4, -CH / 2 + 4, 8.5, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.font = '900 11px "Segoe UI", sans-serif'; g.fillText(String(c.cost), -CW / 2 + 4, -CH / 2 + 8);
    if (dim) { g.fillStyle = 'rgba(10, 8, 6, .45)'; g.beginPath(); g.roundRect(-CW / 2, -CH / 2, CW, CH, 7); g.fill(); }
    g.restore();
  }
  function foeArt(g, f, t) {
    const x = f.x + f.dx, y = f.y;
    if (f.art === 'frame') {
      g.fillStyle = '#2b2b33'; g.fillRect(x - 28, y - 46, 56, 48);
      g.fillStyle = `rgba(110, 160, 220, ${0.5 + Math.sin(t / 60) * 0.2})`; g.fillRect(x - 22, y - 40, 44, 36);
      g.fillStyle = '#ff5a6e'; g.fillRect(x - 22 + ((t / 40) % 44), y - 40, 4, 36);
      g.fillStyle = '#fff'; g.fillRect(x - 11, y - 28, 6, 7); g.fillRect(x + 5, y - 28, 6, 7);
    } else if (f.art === 'minion') { g.save(); g.translate(x - 16, y - 34); minion(g, 0, 0, Math.floor(t / 200), 2); g.restore(); }
    else if (f.art === 'wheel') {
      for (let i = 0; i < 8; i++) { const a = t / 200 + (i / 8) * TAU; g.fillStyle = `rgba(230, 230, 255, ${0.25 + (i / 8) * 0.7})`; g.beginPath(); g.arc(x + Math.cos(a) * 26, y - 26 + Math.sin(a) * 26, 6, 0, TAU); g.fill(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 6, y - 28, 3, 0, TAU); g.arc(x + 6, y - 28, 3, 0, TAU); g.fill();
    } else if (f.art === 'update') {
      g.fillStyle = '#1f4fbf'; g.fillRect(x - 48, y - 76, 96, 76);
      g.fillStyle = '#fff'; g.font = '700 8px "Segoe UI", sans-serif'; g.textAlign = 'center';
      g.fillText('Working on updates', x, y - 44);
      g.fillText(`${Math.min(99, Math.floor(f.pct))}% complete`, x, y - 32);
      g.font = '600 7px "Segoe UI", sans-serif'; g.fillText("Don't turn off your Snappy", x, y - 20);
      for (let i = 0; i < 5; i++) { const a = t / 150 + i * 0.5; g.beginPath(); g.arc(x + Math.cos(a) * 9, y - 62 + Math.sin(a) * 9, 1.6, 0, TAU); g.fill(); }
    }
  }
  const intentOf = (f) => f.intents[f.step % f.intents.length];
  const hitFor = (f, n) => Math.floor(n * (f.slowed ? 0.75 : 1));
  const intentWords = (f) => {
    const it = intentOf(f);
    if (it.k === 'attack') return `Will attack for ${hitFor(f, it.n)}${it.times ? `, ${it.times} times` : ''}.`;
    if (it.k === 'block') return `Will gain ${it.n} Block.`;
    return f.countdown > 1 ? `Restarting in ${f.countdown} turns.` : 'Restarting next turn: 20 damage.';
  };

  async function spire(ctx) {
    const { S, P, screen, music, abandon, finish } = await Arcade.open(ctx);
    await S('{shine}Snap the Sprite! {pause}I climb the Spire. {pause}With cards.', { hold: 300 });
    await P('Why cards?', { hold: 300 });
    await S('{smug}Every decision is a card. {pause}I am very good at decisions.', { hold: 300 });
    await P('You have a card called Ask the Program.', { hold: 400 });
    await S('{wink}It is my best card.', { hold: 500 });
    const scr = await screen({ w: W, h: H, smooth: true });
    const { g, canvas } = scr;
    const stone = (t) => {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#1d1b26'); bg.addColorStop(1, '#2e2434');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255, 255, 255, .025)';
      for (let y = 0; y < H; y += 18) for (let x = (y / 18) % 2 ? 0 : 20; x < W; x += 40) g.fillRect(x, y, 38, 16);
      const glow = g.createRadialGradient(W / 2, 40, 10, W / 2, 40, 260);
      glow.addColorStop(0, `rgba(255, 160, 90, ${0.12 + Math.sin(t / 900) * 0.03})`); glow.addColorStop(1, 'rgba(255, 160, 90, 0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
    };
    const titleCard = (t) => {
      stone(t);
      g.textAlign = 'center'; g.fillStyle = '#f4ead6'; g.font = '700 32px Georgia, serif'; g.fillText('Snap the Sprite', W / 2, 70);
      cardFace(g, 'ask', W / 2 - 86, 160 + Math.sin(t / 700) * 3, { rot: -0.14 });
      cardFace(g, 'snap', W / 2, 152 + Math.sin(t / 700 + 1) * 3);
      cardFace(g, 'cap', W / 2 + 86, 160 + Math.sin(t / 700 + 2) * 3, { rot: 0.14 });
      if (Math.floor(t / 600) % 2) { g.font = '400 11px Georgia, serif'; g.fillStyle = '#c9b89a'; g.fillText('click to climb', W / 2, H - 12); }
    };
    if (!(await scr.title('SNAP THE SPRITE', '', 'CLICK A CARD TO PLAY IT · ATTACKS: THEN CLICK AN ENEMY', titleCard))) await abandon(scr);
    const stop = music('mystery', 6400);
    const deck = ['snap', 'snap', 'snap', 'snap', 'snap', 'cap', 'cap', 'cap', 'cap', 'flash', 'ask'];
    const me = { hp: 70, max: 70 };
    let relic = null, asks = 0, row = 0, from = 0, won = null;
    const waitClick = async (draw, hit) => {
      while (scr.click()) { /* nothing */ }
      for (;;) {
        await scr.tick();
        const over = draw(performance.now());
        canvas.style.cursor = over !== null && over !== undefined ? 'pointer' : 'default';
        if (scr.click()) { const r = hit(scr.mouse.x, scr.mouse.y); if (r !== null && r !== undefined) { canvas.style.cursor = 'default'; return r; } }
      }
    };

    // ---- a fight
    async function fight(kind) {
      const foes = FOES[kind]().map((f, i, all) => ({ ...f, max: f.hp, block: 0, dazzled: 0, step: 0, countdown: 3, pct: 0, x: 336 + (i - (all.length - 1) / 2) * 96, y: 152, dx: 0, hitAt: 0, lungeAt: 0, gone: 0 }));
      let pile = [...deck].sort(() => Math.random() - 0.5), discard = [], energy = 3, block = relic === 'eye' ? 6 : 0, blockAt = 0;
      const hand = [], flying = [], pops = [];
      let banner = null, meHit = 0, meLunge = 0, note = null, selected = null, busy = false;
      const say = (text, color = '#fff', x = W / 2, y = 64, big = false) => pops.push({ text, color, x, y, at: performance.now(), big });
      const b = {
        foes, slow: false,
        hit(t, n) {
          if (!t || t.hp <= 0) return;
          let d = Math.floor(n * (t.dazzled ? 1.5 : 1));
          const soak = Math.min(t.block, d); t.block -= soak; d -= soak;
          t.hp -= d; t.hitAt = performance.now();
          say(d ? String(d) : 'Blocked', d ? '#ffd25a' : '#9fd2ff', t.x + (Math.random() - 0.5) * 16, t.y - 60, true);
          Speech.tune('clunk', 0.5);
          if (t.hp <= 0) t.gone = performance.now();
        },
        guard(n) { block += n; blockAt = performance.now(); say(`+${n} Block`, '#9fd2ff', 110, 96); },
        draw(n) {
          for (let i = 0; i < n; i++) {
            if (!pile.length) { pile = discard.sort(() => Math.random() - 0.5); discard = []; }
            if (!pile.length || hand.length >= 8) return;
            hand.push({ id: pile.pop(), x: DRAW_AT.x, y: DRAW_AT.y, rot: -0.6, scale: 0.4, delay: performance.now() + i * 90 });
          }
        },
        ask() {
          asks++;
          const options = hand.filter((c) => c.id !== 'ask');
          if (!options.length) { say('The Program has no opinion.', '#7ee8ff'); return; }
          const pick = options[Math.floor(Math.random() * options.length)];
          say(`The Program plays ${CARDS[pick.id].name}.`, '#7ee8ff');
          hand.splice(hand.indexOf(pick), 1);
          flying.push({ ...pick, to: { x: W / 2, y: 110 }, at: performance.now(), end: DISCARD_AT });
          discard.push(pick.id);
          CARDS[pick.id].act(b, alive()[0]);
        },
      };
      const alive = () => foes.filter((f) => f.hp > 0);
      const slot = (i) => {
        const n = hand.length, spread = Math.min(60, 320 / Math.max(1, n));
        return { x: W / 2 + (i - (n - 1) / 2) * spread, y: H + 8, rot: (i - (n - 1) / 2) * 0.06 };
      };
      const cardUnder = (x, y) => {
        for (let i = hand.length - 1; i >= 0; i--) { const s = slot(i); if (Math.abs(x - s.x) < CW * 0.42 && y > H - 56) return i; }
        return null;
      };
      const foeUnder = (x, y) => alive().find((f) => Math.abs(x - f.x) < 46 && y > 60 && y < 196) || null;
      const endOver = (x, y) => x > W - 86 && x < W - 12 && y > H - 74 && y < H - 50;
      const play = (i, target) => {
        const card = hand[i], c = CARDS[card.id];
        if (c.cost > energy) { note = { text: 'Not enough energy', at: performance.now() }; Speech.tune('tick', 0.4); return; }
        energy -= c.cost;
        hand.splice(i, 1);
        const to = c.type === 'attack' && !c.all && target ? { x: target.x, y: target.y - 40 } : { x: W / 2, y: 120 };
        flying.push({ ...card, to, at: performance.now(), end: DISCARD_AT });
        discard.push(card.id);
        if (c.type === 'attack') meLunge = performance.now();
        c.act(b, target || alive()[0]);
        selected = null;
      };
      const scene = (t, hover) => {
        stone(t);
        g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(W / 2, 168, 240, 24, 0, 0, TAU); g.fill();
        // her: bobbing, lunging forward on an attack, shaking when she's hit
        const lunge = Math.max(0, 1 - (t - meLunge) / 220), shake = t - meHit < 300 ? Math.sin(t / 18) * 3 : 0;
        her(g, 112 + Math.sin(lunge * Math.PI) * 18 + shake, 122 + Math.sin(t / 500) * 2, 58, { eyes: t - meHit < 400 ? 'wince' : me.hp < 20 ? 'worried' : 'open', look: 0.6 });
        drawBar(g, t, 112, 160, 76, me.hp, me.max, block, blockAt);
        for (const f of foes) {
          const fade = f.gone ? Math.max(0, 1 - (t - f.gone) / 450) : 1;
          if (fade <= 0) continue;
          const back = Math.max(0, 1 - (t - f.lungeAt) / 260);
          f.dx = -Math.sin(back * Math.PI) * 20 + (t - f.hitAt < 280 ? Math.sin(t / 16) * 4 : 0);
          g.globalAlpha = fade;
          foeArt(g, f, t);
          if (t - f.hitAt < 110) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(f.x + f.dx - 46, f.y - 80, 92, 84); }
          g.globalAlpha = 1;
          if (f.gone) continue;
          drawBar(g, t, f.x, 160, 76, f.hp, f.max, f.block, 0);
          if (f.dazzled) { g.fillStyle = '#ffe680'; g.font = '700 7.5px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText(`Dazzled ${f.dazzled} (takes 50% more)`, f.x, 184); }
          g.fillStyle = '#d8cfbf'; g.font = '700 8.5px Georgia, serif'; g.textAlign = 'center'; g.fillText(f.name, f.x, 194);
          intentIcon(g, f, t);
          if (hover === f) {
            g.strokeStyle = selected !== null ? '#ffd25a' : 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath(); g.roundRect(f.x - 48, 50, 96, 150, 8); g.stroke();
            g.fillStyle = 'rgba(10, 8, 6, .9)'; g.beginPath(); g.roundRect(f.x - 62, 28, 124, 16, 5); g.fill();
            g.fillStyle = '#f4ead6'; g.font = '600 8px "Segoe UI", sans-serif'; g.fillText(intentWords(f), f.x, 39);
          }
        }
        // energy, the piles and End Turn
        const out = energy === 0 && !busy;
        g.fillStyle = '#0d0b0a'; g.beginPath(); g.arc(DRAW_AT.x + 22, H - 64, 17, 0, TAU); g.fill();
        const orb = g.createRadialGradient(DRAW_AT.x + 18, H - 68, 2, DRAW_AT.x + 22, H - 64, 16);
        orb.addColorStop(0, '#ffd28a'); orb.addColorStop(1, energy ? '#e8701c' : '#6a4a30');
        g.fillStyle = orb; g.beginPath(); g.arc(DRAW_AT.x + 22, H - 64, 15, 0, TAU); g.fill();
        g.fillStyle = '#fff'; g.font = '900 12px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText(`${energy}/3`, DRAW_AT.x + 22, H - 60);
        for (const [at, n, label] of [[DRAW_AT, pile.length, 'Draw'], [DISCARD_AT, discard.length, 'Discard']]) {
          g.fillStyle = '#3a2e26'; g.beginPath(); g.roundRect(at.x - 13, at.y - 16, 26, 30, 4); g.fill();
          g.strokeStyle = '#c9b89a'; g.lineWidth = 1; g.stroke();
          g.fillStyle = '#fff'; g.font = '800 10px "Segoe UI", sans-serif'; g.fillText(String(n), at.x, at.y + 3);
          g.fillStyle = '#c9b89a'; g.font = '600 6px "Segoe UI", sans-serif'; g.fillText(label, at.x, at.y + 22);
        }
        const eo = endOver(scr.mouse.x, scr.mouse.y), glowing = out && Math.floor(t / 400) % 2;
        g.fillStyle = busy ? '#5a4a3a' : eo || glowing ? '#f0c060' : '#c9902a'; g.beginPath(); g.roundRect(W - 86, H - 74, 74, 24, 7); g.fill();
        g.fillStyle = '#2a1a0a'; g.font = '800 10px "Segoe UI", sans-serif'; g.fillText('End Turn', W - 49, H - 58);
        // the hand, each card easing to its place; the hovered one lifted to read
        const hc = !busy && selected === null ? cardUnder(scr.mouse.x, scr.mouse.y) : null;
        hand.forEach((card, i) => {
          if (card.delay > t) return;
          const s = slot(i), up = hc === i || selected === i;
          card.x = ease(card.x, s.x, 0.22); card.y = ease(card.y, up ? H - 70 : s.y, 0.22);
          card.rot = ease(card.rot, up ? 0 : s.rot, 0.22); card.scale = ease(card.scale, up ? 1.25 : 0.9, 0.22);
        });
        hand.forEach((card, i) => { if (hc !== i && selected !== i && card.delay <= t) cardFace(g, card.id, card.x, card.y, { scale: card.scale, rot: card.rot, dim: CARDS[card.id].cost > energy }); });
        const top = hc ?? selected;
        if (top !== null && hand[top]) cardFace(g, hand[top].id, hand[top].x, hand[top].y, { scale: hand[top].scale, rot: hand[top].rot, dim: CARDS[hand[top].id].cost > energy });
        // cards on their way: to whoever they hit, then off to the discard pile
        for (let i = flying.length - 1; i >= 0; i--) {
          const f = flying[i], k = (t - f.at) / 520;
          if (k >= 1) { flying.splice(i, 1); continue; }
          const p = k < 0.55 ? k / 0.55 : 1, q = k < 0.55 ? 0 : (k - 0.55) / 0.45;
          const x = ease(ease(f.x, f.to.x, p), f.end.x, q), y = ease(ease(f.y, f.to.y, p), f.end.y, q);
          cardFace(g, f.id, x, y, { scale: ease(1.1, 0.3, q), alpha: 1 - q * 0.8 });
        }
        if (selected !== null && hand[selected]) {
          const s = hand[selected];
          g.strokeStyle = 'rgba(255, 210, 90, .85)'; g.lineWidth = 3; g.setLineDash([7, 5]);
          g.beginPath(); g.moveTo(s.x, s.y - 50); g.quadraticCurveTo(s.x, scr.mouse.y - 50, scr.mouse.x, scr.mouse.y); g.stroke(); g.setLineDash([]);
          g.fillStyle = '#ffd25a'; g.font = '700 8px "Segoe UI", sans-serif'; g.fillText('Click an enemy (or anywhere else to cancel)', W / 2, 20);
        }
        for (let i = pops.length - 1; i >= 0; i--) {
          const pp = pops[i], k = (t - pp.at) / 1200;
          if (k > 1) { pops.splice(i, 1); continue; }
          g.globalAlpha = 1 - k * k; g.font = `900 ${pp.big ? 18 : 10}px "Segoe UI", sans-serif`; g.textAlign = 'center';
          g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.7)'; g.strokeText(pp.text, pp.x, pp.y - k * 20);
          g.fillStyle = pp.color; g.fillText(pp.text, pp.x, pp.y - k * 20); g.globalAlpha = 1;
        }
        if (note && t - note.at < 1200) { g.fillStyle = '#ff8a7a'; g.font = '700 9px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText(note.text, W / 2, H - 86); }
        if (banner && t - banner.at < 1100) {
          const k = (t - banner.at) / 1100, slide = k < 0.2 ? 1 - k / 0.2 : k > 0.8 ? -(k - 0.8) / 0.2 : 0;
          g.fillStyle = 'rgba(10, 8, 6, .8)'; g.fillRect(0, H / 2 - 22, W, 34);
          g.fillStyle = banner.color; g.font = '700 20px Georgia, serif'; g.textAlign = 'center'; g.fillText(banner.text, W / 2 + slide * 200, H / 2 + 2);
        }
      };
      const show = async (ms) => { const end = performance.now() + ms; while (performance.now() < end) { await scr.tick(); scene(performance.now(), null); } };

      for (;;) {
        // your turn
        b.slow = false;
        foes.forEach((f) => { f.slowed = false; });
        banner = { text: 'Your Turn', color: '#ffd25a', at: performance.now() };
        Speech.tune('chime', 0.3);
        b.draw(5);
        busy = false;
        const result = await waitClick((t) => {
          const hf = foeUnder(scr.mouse.x, scr.mouse.y);
          scene(t, hf);
          return cardUnder(scr.mouse.x, scr.mouse.y) ?? (selected !== null && hf ? hf : null) ?? (endOver(scr.mouse.x, scr.mouse.y) ? 'end' : null);
        }, (x, y) => {
          if (endOver(x, y)) return 'end';
          if (selected !== null) {
            const f = foeUnder(x, y);
            if (f) { play(selected, f); return alive().length ? null : 'won'; }
            selected = null;
            return null;
          }
          const i = cardUnder(x, y);
          if (i === null) return null;
          const c = CARDS[hand[i].id];
          if (c.cost > energy) { note = { text: 'Not enough energy', at: performance.now() }; Speech.tune('tick', 0.4); return null; }
          if (c.type === 'attack' && !c.all && alive().length > 1) { selected = i; return null; }
          play(i);
          return alive().length ? null : 'won';
        });
        if (result === 'won') break;
        // the rest of your hand goes to the discard pile
        busy = true;
        selected = null;
        while (hand.length) { const card = hand.pop(); flying.push({ ...card, to: { x: card.x, y: card.y }, at: performance.now() - 280, end: DISCARD_AT }); discard.push(card.id); }
        await show(450);
        foes.forEach((f) => { if (b.slow) f.slowed = true; });
        banner = { text: 'Enemy Turn', color: '#ff7a6a', at: performance.now() };
        await show(900);
        for (const f of alive()) {
          f.block = 0;
          const it = intentOf(f);
          if (it.k === 'attack') {
            for (let i = 0; i < (it.times || 1); i++) {
              f.lungeAt = performance.now();
              await show(130);
              let d = hitFor(f, it.n); const soak = Math.min(block, d); block -= soak; d -= soak; me.hp -= d;
              if (d) meHit = performance.now();
              say(d ? String(d) : 'Blocked', d ? '#ff6a5a' : '#9fd2ff', 112, 80, true);
              Speech.tune(d ? 'crash' : 'tick', d ? 0.12 : 0.5);
              await show(260);
            }
          } else if (it.k === 'block') { f.block += it.n; say(`+${it.n} Block`, '#9fd2ff', f.x, 90); Speech.tune('tick', 0.5); await show(500); }
          else {
            // counting down to a restart nobody asked for
            f.countdown--;
            if (f.countdown <= 0) {
              f.lungeAt = performance.now();
              await show(130);
              let d = 20; const soak = Math.min(block, d); block -= soak; d -= soak; me.hp -= d;
              if (d) meHit = performance.now();
              say(`RESTARTING. ${d}`, '#ffd25a', 112, 80, true);
              Speech.tune('crash', 0.25);
              f.countdown = 3;
              await show(500);
            } else { f.step--; say(`Restarting in ${f.countdown}...`, '#ffd25a', f.x, 90); await show(600); }
          }
          if (f.art === 'update') f.pct = Math.min(99, f.pct + 17 + Math.random() * 10);
          f.step++;
          if (f.dazzled) f.dazzled--;
          if (me.hp <= 0) return false;
        }
        block = 0;
        energy = 3;
      }
      await show(700);
      return true;
    }
    function drawBar(g, t, x, y, w, hp, max, block, blockAt) {
      g.fillStyle = '#1a1214'; g.beginPath(); g.roundRect(x - w / 2, y, w, 8, 3); g.fill();
      g.fillStyle = block > 0 ? '#4a8ad8' : '#d23a3a'; g.beginPath(); g.roundRect(x - w / 2, y, w * Math.max(0, hp / max), 8, 3); g.fill();
      g.fillStyle = '#fff'; g.font = '800 7.5px "Segoe UI", sans-serif'; g.textAlign = 'center'; g.fillText(`${Math.max(0, hp)}/${max}`, x, y + 7);
      if (block > 0) {
        const pulse = 1 + Math.max(0, 1 - (t - blockAt) / 300) * 0.4;
        g.save(); g.translate(x - w / 2 - 8, y + 4); g.scale(pulse, pulse);
        g.fillStyle = '#4a8ad8'; g.beginPath(); g.moveTo(0, -8); g.lineTo(7, -5); g.lineTo(6, 4); g.lineTo(0, 8); g.lineTo(-6, 4); g.lineTo(-7, -5); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.font = '800 8px "Segoe UI", sans-serif'; g.fillText(String(block), 0, 3);
        g.restore();
      }
    }
    function intentIcon(g, f, t) {
      const it = intentOf(f), x = f.x, y = 66 + Math.sin(t / 300) * 2;
      g.textAlign = 'center'; g.font = '900 11px "Segoe UI", sans-serif';
      if (it.k === 'attack') {
        g.fillStyle = '#ff6a5a'; g.beginPath(); g.moveTo(x - 8, y + 6); g.lineTo(x + 6, y - 8); g.lineTo(x + 8, y - 6); g.lineTo(x - 6, y + 8); g.fill();
        g.fillStyle = '#fff'; g.fillText(`${hitFor(f, it.n)}${it.times ? `×${it.times}` : ''}`, x + 18, y + 4);
      } else if (it.k === 'block') {
        g.fillStyle = '#6ab8ff'; g.beginPath(); g.moveTo(x, y - 9); g.lineTo(8, 0); g.fill();
        g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 8, y - 6); g.lineTo(x + 6, y + 5); g.lineTo(x, y + 9); g.lineTo(x - 6, y + 5); g.lineTo(x - 8, y - 6); g.closePath(); g.fill();
      } else {
        g.fillStyle = '#ffd25a'; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill();
        g.fillStyle = '#1f2a44'; g.fillText(String(f.countdown), x, y + 4);
      }
    }

    // ---- the climb
    const mapScreen = async () => waitClick((t) => {
      g.fillStyle = '#d9c9a3'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(120, 90, 50, .08)'; for (let i = 0; i < 40; i++) g.fillRect((i * 97) % W, (i * 53) % H, 30, 2);
      g.strokeStyle = 'rgba(70, 50, 30, .5)'; g.setLineDash([3, 4]); g.lineWidth = 1.5;
      for (let r = 0; r < MAP.length - 1; r++) for (let i = 0; i < MAP[r].length; i++) for (let j = 0; j < MAP[r + 1].length; j++) {
        const a = nodeAt(r, i), c = nodeAt(r + 1, j); g.beginPath(); g.moveTo(a.x, a.y - 14); g.lineTo(c.x, c.y + 14); g.stroke();
      }
      g.setLineDash([]);
      let over = null;
      MAP.forEach((nodes, r) => nodes.forEach((n, i) => {
        const p = nodeAt(r, i), open = r === row, hovering = open && Math.hypot(scr.mouse.x - p.x, scr.mouse.y - p.y) < 18;
        if (hovering) over = i;
        const pulse = open ? 1 + Math.sin(t / 250) * 0.06 : 1, rad = (n.kind === 'boss' ? 19 : 14) * pulse * (hovering ? 1.15 : 1);
        g.fillStyle = r < row ? 'rgba(70, 50, 30, .25)' : open ? (hovering ? '#fff2c8' : '#f4e6c0') : '#cbb98f';
        g.beginPath(); g.arc(p.x, p.y, rad, 0, TAU); g.fill();
        g.strokeStyle = open ? '#3a2a14' : 'rgba(58, 42, 20, .4)'; g.lineWidth = open ? 2 : 1; g.stroke();
        g.fillStyle = '#3a2a14'; g.font = `800 ${n.kind === 'boss' ? 13 : 11}px Georgia, serif`; g.textAlign = 'center';
        g.fillText({ fight: '⚔', rest: '☼', elite: '☠', treasure: '◆', boss: '♛' }[n.kind], p.x, p.y + 4);
        g.font = '600 9px Georgia, serif'; g.fillText({ fight: 'Fight', rest: 'Rest', elite: 'Elite (tougher)', treasure: 'Treasure', boss: 'The Forced Update' }[n.kind], p.x, p.y + 28);
        if (r === row - 1 && i === from) { g.strokeStyle = '#b4473d'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 19, 0, TAU); g.stroke(); }
      }));
      g.fillStyle = '#3a2a14'; g.font = '700 15px Georgia, serif'; g.textAlign = 'left'; g.fillText('The Spire', 14, 24);
      g.font = '600 9px Georgia, serif'; g.fillText(`HP ${me.hp}/${me.max} · ${deck.length} cards${relic ? ' · The Second Eye' : ''}`, 14, 38);
      g.textAlign = 'right'; g.fillText(MAP[row].length > 1 ? 'Pick where to go next' : 'Click to go on', W - 14, 24);
      return over;
    }, (x, y) => {
      const i = MAP[row].findIndex((_, k) => { const p = nodeAt(row, k); return Math.hypot(x - p.x, y - p.y) < 18; });
      return i >= 0 ? i : null;
    });

    for (row = 0; row < MAP.length; row++) {
      const pick = await mapScreen();
      from = pick;
      const node = MAP[row][pick];
      Speech.tune('whoosh', 0.4);
      if (node.kind === 'rest') {
        const heal = Math.round(me.max * 0.3);
        me.hp = Math.min(me.max, me.hp + heal);
        await waitClick((t) => { stone(t); g.textAlign = 'center'; g.fillStyle = '#ffb05a'; g.font = '700 22px Georgia, serif'; g.fillText('Rest Site', W / 2, 70);
          her(g, W / 2, 150, 60, { eyes: 'closed' }); g.fillStyle = '#ff9a3c'; g.beginPath(); g.ellipse(W / 2, 196, 18 + Math.sin(t / 90) * 2, 8, 0, 0, TAU); g.fill();
          g.fillStyle = '#f4ead6'; g.font = '600 11px Georgia, serif'; g.fillText(`She takes a nap. +${heal} HP.`, W / 2, 228); g.font = '600 9px Georgia, serif'; g.fillText('click to go on', W / 2, 250); return 1; }, () => true);
        continue;
      }
      if (node.kind === 'treasure') {
        relic = 'eye';
        await waitClick((t) => { stone(t); g.textAlign = 'center'; g.fillStyle = '#ffd25a'; g.font = '700 22px Georgia, serif'; g.fillText('Treasure!', W / 2, 70);
          g.fillStyle = '#fff'; g.beginPath(); g.ellipse(W / 2, 140, 26, 34 + Math.sin(t / 400) * 2, 0, 0, TAU); g.fill(); g.fillStyle = '#0a0a0a'; g.beginPath(); g.ellipse(W / 2, 140, 12, 18, 0, 0, TAU); g.fill();
          g.fillStyle = '#f4ead6'; g.font = '600 11px Georgia, serif'; g.fillText('The Second Eye: start every fight with 6 Block.', W / 2, 205);
          g.fillText('She already had two. Now she has three.', W / 2, 222); g.font = '600 9px Georgia, serif'; g.fillText('click to go on', W / 2, 250); return 1; }, () => true);
        continue;
      }
      if (!(await fight(node.foes))) { won = false; break; }
      if (node.kind === 'boss') { won = true; break; }
      // a card for the deck
      const offer = [...REWARDS].sort(() => Math.random() - 0.5).slice(0, 3);
      const chosen = await waitClick((t) => {
        stone(t);
        g.textAlign = 'center'; g.fillStyle = '#f4ead6'; g.font = '700 18px Georgia, serif'; g.fillText('Choose a Card', W / 2, 36);
        let over = null;
        offer.forEach((id, i) => { const x = W / 2 + (i - 1) * 104, hov = Math.abs(scr.mouse.x - x) < CW / 2 && Math.abs(scr.mouse.y - 128) < CH / 2; if (hov) over = i; cardFace(g, id, x, 128 + (hov ? -6 : 0), { scale: hov ? 1.15 : 1 }); });
        const skip = scr.mouse.y > 214 && scr.mouse.y < 240 && Math.abs(scr.mouse.x - W / 2) < 40;
        g.fillStyle = skip ? '#e8dcc0' : '#a89878'; g.font = '700 11px Georgia, serif'; g.fillText('Skip', W / 2, 232);
        return over ?? (skip ? 'skip' : null);
      }, (x, y) => {
        const i = offer.findIndex((_, k) => Math.abs(x - (W / 2 + (k - 1) * 104)) < CW / 2 && Math.abs(y - 128) < CH / 2);
        if (i >= 0) return offer[i];
        return y > 214 && y < 240 && Math.abs(x - W / 2) < 40 ? 'skip' : null;
      });
      if (chosen !== 'skip') { deck.push(chosen); Speech.tune('coin', 0.5); }
    }
    stop();
    // the end: victory, or the Spire wins this time
    while (scr.click()) { /* nothing */ }
    const shownAt = performance.now();
    for (let i = 0; ; i++) {
      await scr.tick();
      if ((i > 60 && scr.click()) || performance.now() - shownAt > 120000) break;
      stone(performance.now());
      g.textAlign = 'center'; g.fillStyle = won ? '#ffd25a' : '#ff6a5a'; g.font = '700 30px Georgia, serif';
      g.fillText(won ? 'Victory' : 'Defeat', W / 2, 100);
      g.fillStyle = '#f4ead6'; g.font = '600 11px Georgia, serif';
      g.fillText(won ? 'The Forced Update has been postponed.' : `She fell on floor ${row + 1}.`, W / 2, 130);
      g.fillText(`Times she asked the Program: ${asks}`, W / 2, 150);
      if (i > 60 && Math.floor(i / 30) % 2) { g.font = '600 9px Georgia, serif'; g.fillText('click to continue', W / 2, H - 16); }
    }
    await scr.close();
    if (won) {
      await S('{joy}I conquered the Spire!', { hold: 300 });
      await P(`You asked me ${asks} ${asks === 1 ? 'time' : 'times'}.`, { hold: 400 });
      await S('{wink}And I never had to decide anything.', { hold: 600 });
    } else {
      await S('{sad}The Spire won this time.', { hold: 300 });
      await P(`You asked me ${asks} ${asks === 1 ? 'time' : 'times'}.`, { hold: 400 });
      await S('{flat}...and you were no help at all.', { hold: 600 });
    }
    await finish();
    // only a climb all the way up counts
    return won;
  }

  Events.define('spire', {
    tier: 'game', title: 'Snap the Sprite', hint: 'A Spire, a deck of cards, and one card that decides for her.', run: spire, weight: 1,
  });
  Events.aftermath('spire', { label: 'The Second Eye', marks: [{ at: '.brand', cls: 'af-pic af-relic' }] });
})();
